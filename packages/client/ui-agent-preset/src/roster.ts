/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc So preset dung chung: doc so, ghi mac dinh, va controller chi-hien-thi — nguyen van ban goc
 */

import type { PresetRow } from "./display.ts";
import { AGENT_PRESET_SETTINGS_NS, SETTINGS_DEFAULT_FIELD } from "./ids.ts";
import type { Roster, RemoteSeam, SnapshotStore } from "./store.ts";

/** Mot lua chon trong menu chip: id + ban quyen hien thi (khong co mo ta khi preset khong khai). */
export interface PresetOption {
  /** Id preset. */
  readonly id: string;
  /** Ten do nguoi dung khai (preset ship san de trong cho tu dien). */
  readonly name?: string;
  /** Mo ta do nguoi dung khai. */
  readonly description?: string;
}

/** Anh chup cua so preset cho cac be mat chi hien thi (chip + nhan hang dau). */
export interface RosterSnapshot {
  /** Trang thai lan doc gan nhat. */
  readonly status: "idle" | "loading" | "ready" | "error" | "unavailable";
  /** Thong diep loi, hoac null. */
  readonly error: string | null;
  /** Lua chon da loc (chi preset lanh). */
  readonly options: readonly PresetOption[];
}

/** Context toi thieu ma so preset can — chi phan that su dung. */
export interface RosterContext {
  /** Duong remote cua Host. */
  readonly remote: RemoteSeam;
}

/**
 * Ghi mot preset lam mac dinh cho cac phien tao sau.
 *
 * Mac dinh la mot truong cau hinh chu khong phai thuoc tinh cua preset; khung quan ly ghi vao day —
 * mot cho duy nhat biet namespace va truong nao Host doc luc tao phien.
 * Nhan: ctx — context mang namespace Remote; id — preset can dat lam mac dinh;
 *   expectedRevision — rao phien ban tuy chon cho lan tu sua dua tren mot lan doc truoc.
 * Tra: thong diep that bai, hoac undefined khi da ghi xong.
 */
export async function writeDefaultPreset(
  ctx: RosterContext,
  id: string,
  expectedRevision?: number,
): Promise<string | undefined> {
  const response = await ctx.remote.settings.update(AGENT_PRESET_SETTINGS_NS, { [SETTINGS_DEFAULT_FIELD]: id }, expectedRevision);
  return response.ok ? undefined : response.error.message;
}

/** So rong: deployment khong soan preset nao — mot deployment hop le, khong phai loi. */
export const EMPTY_ROSTER: Roster = { presets: [] };

/**
 * Doc so preset, doi mot lan tu choi thanh thong diep ma moi be mat deu hien.
 * Nhan: ctx — context mang namespace Remote.
 * Tra: so preset, hoac thong diep de hien thay cho no.
 */
export async function readRoster(ctx: RosterContext): Promise<{ ok: true; value: Roster } | { ok: false; error: string }> {
  const result = await ctx.remote.agentPresets.list();
  if (result.ok) return { ok: true, value: result.value };
  if (result.error.code === "gateway/invocation-unavailable") return { ok: true, value: EMPTY_ROSTER };
  return { ok: false, error: result.error.message };
}

/**
 * Nuoc mo dau ma moi be mat dua tren so preset deu lam: tu choi lan doc dang bay, danh dau store dang
 * tai, roi doc.
 *
 * Be mat nao nhan undefined thi quay ve ma khong dung tới anh chup cua no nua — hoac mot lan doc khac
 * dang so huu no, hoac chinh lan nay da ghi that bai.
 * Nhan: ctx — context mang namespace Remote; store — store anh chup cua be mat.
 * Tra: so preset, hoac undefined khi noi goi nen quay ve.
 */
export async function beginRosterRead<S extends { status: string; error: string | null }>(
  ctx: RosterContext,
  store: SnapshotStore<S>,
): Promise<Roster | undefined> {
  const before = store.getSnapshot();
  if (before.status === "loading") return undefined;
  store.set({ ...before, status: "loading", error: null });
  const roster = await readRoster(ctx);
  if (roster.ok) return roster.value;
  store.set({ ...store.getSnapshot(), status: "error", error: roster.error });
  return undefined;
}

/**
 * Cac dong so duoi dang ma menu ve: chi preset lanh.
 *
 * Chip sinh ra de chon thanh phan cua PHIEN KE TIEP, ma mot preset hong thi khong soan duoc phien nao —
 * moi no ra la hoan viec phat hien dieu do sang mot lan khoi phien that bai. Khung quan ly van ve DAY DU
 * so (ke ca dong hong) tu store cua chinh no.
 * Nhan: presets — so ma Host tra loi.
 * Tra: mot lua chon cho moi preset chon duoc, theo thu tu cua so.
 */
export function presetOptions(presets: readonly PresetRow[]): readonly PresetOption[] {
  return presets
    .filter((preset) => preset.broken === undefined)
    .map((preset) => ({
      id: preset.id,
      ...(preset.name === undefined ? {} : { name: preset.name }),
      ...(preset.description === undefined ? {} : { description: preset.description }),
    }));
}

/** Gia tri dau cua store chi-hien-thi — nguyen van ban goc. */
export const INITIAL_ROSTER_SNAPSHOT: RosterSnapshot = { status: "idle", error: null, options: [] };

/** Doc so preset cho cac be mat chi hien thi no. */
export class AgentPresetSettingsController {
  /** Context mang namespace Remote (lan doc so). */
  private readonly ctx: RosterContext;
  /** Anh chup so ma renderer theo doi — the hien DAY DU cua createSnapshotStore. */
  readonly store: SnapshotStore<RosterSnapshot>;

  /**
   * Nhan: ctx — context phia trinh duyet (lan doc so); createStore — ham tao store cua bang module.
   */
  constructor(ctx: RosterContext, createStore: <T>(initial: T) => SnapshotStore<T>) {
    this.ctx = ctx;
    this.store = createStore(INITIAL_ROSTER_SNAPSHOT);
  }

  /**
   * Gop mot mảnh vao anh chup hien tai.
   * Nhan: patch — cac truong can thay.
   * Tra: khong co.
   */
  set(patch: Partial<RosterSnapshot>): void {
    this.store.set({ ...this.store.getSnapshot(), ...patch });
  }

  /**
   * Doc so preset. So rong nghia la deployment khong soan preset nao — mot deployment hop le chu khong
   * phai that bai: cac be mat bao "unavailable" va khong ve gi.
   * Nhan: khong co.
   * Tra: khi anh chup da phan anh Host.
   */
  async load(): Promise<void> {
    const roster = await beginRosterRead(this.ctx, this.store);
    if (roster === undefined) return;
    const { presets } = roster;
    if (presets.length === 0) {
      this.set({ status: "unavailable", options: [] });
      return;
    }
    this.set({ status: "ready", error: null, options: presetOptions(presets) });
  }
}
