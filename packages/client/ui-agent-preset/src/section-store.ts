/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Store cua khung quan ly preset: doc so, ghi mac dinh, doc mot than khai bao — nguyen van ban goc
 */

import { deferred } from "./deferred.ts";
import { requiresCodingTools, type PresetRow } from "./display.ts";
import { AGENT_PRESET_SETTINGS_NS, NS, STANDARD_PRESET_ID } from "./ids.ts";
import { writeDefaultPreset, type RosterContext } from "./roster.ts";
import type { SnapshotStore } from "./store.ts";
import type { Translator } from "./runtime.ts";

/** Anh chup cua mot tai lieu cau hinh do seam configForms phuc vu. */
export interface ConfigFormSnapshot {
  /** Trang thai tai lieu ("idle" | "ready" | ...). */
  readonly status: string;
  /** Tai lieu co ghi duoc khong. */
  readonly writable?: boolean;
  /** Phien ban tai lieu de lam rao cho lan ghi. */
  readonly revision?: number;
  /** Gia tri tai lieu (voi ui-settings: { enabled }). */
  readonly value?: { readonly enabled?: boolean };
}

/** Mot than khai bao da doc de xem. */
export interface ViewedPreset {
  /** Id preset dang xem. */
  readonly id: string;
  /** Ten hien thi (ten khai bao, khong co thi lay id). */
  readonly title: string;
  /** Van ban than khai bao. */
  readonly content: string;
}

/** Anh chup cua khung quan ly preset. */
export interface SectionSnapshot {
  /** Trang thai lan doc so. */
  readonly status: "idle" | "loading" | "ready" | "error";
  /** Thong diep loi dang hien, hoac null. */
  readonly error: string | null;
  /** Dang ghi cau hinh. */
  readonly saving: boolean;
  /** So day du (ke ca dong hong). */
  readonly rows: readonly PresetRow[];
  /** Than khai bao dang mo, hoac null. */
  readonly view: ViewedPreset | null;
}

/** Context ma khung quan ly can — chi phan that su dung. */
export interface SectionContext extends RosterContext {
  /** Tu dien cua giao dien. */
  readonly locale: { bind: (ns: string) => Translator };
  /** Tai lieu cau hinh do goi ui-settings phuc vu. */
  readonly configForms: { get: (ns: string) => { getSnapshot: () => ConfigFormSnapshot } };
}

/** Gia tri dau cua store khung quan ly — nguyen van ban goc. */
export const INITIAL_SECTION_SNAPSHOT: SectionSnapshot = { status: "idle", error: null, saving: false, rows: [], view: null };

/**
 * Doc thong diep cua mot gia tri nem ra.
 * Nhan: error — gia tri bat duoc.
 * Tra: thong diep dang chuoi.
 */
function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Doc so preset, ghi mac dinh, va doc mot than khai bao moi lan mot. */
export class AgentPresetSectionController {
  /** Context mang namespace Remote, tu dien va configForms. */
  private readonly ctx: SectionContext;
  /** So, lua chon va trang thai trinh xem. */
  readonly store: SnapshotStore<SectionSnapshot>;
  /** Lan doc so dang chay (cac loi goi chong nhau dung chung mot lan doc). */
  private loading: Promise<void> | undefined;
  /** Lan ghi dang chay — lua chon tu Settings cho no xong truoc khi stage. */
  private pendingSave: Promise<void> | undefined;
  /** So thu tu yeu cau xem, de mot lan doc bi thay the bi bo qua. */
  private viewRequest = 0;

  /**
   * Nhan: ctx — context phia trinh duyet; createStore — ham tao store cua bang module.
   */
  constructor(ctx: SectionContext, createStore: <T>(initial: T) => SnapshotStore<T>) {
    this.ctx = ctx;
    this.store = createStore(INITIAL_SECTION_SNAPSHOT);
  }

  /**
   * Gop mot mảnh vào anh chup hien tai.
   * Nhan: patch — cac truong can thay.
   * Tra: khong co.
   */
  set(patch: Partial<SectionSnapshot>): void {
    this.store.set({ ...this.store.getSnapshot(), ...patch });
  }

  /**
   * Lam moi so preset; cac loi goi chong nhau dung chung mot lan doc.
   * Nhan: khong co.
   * Tra: khi lan doc so da yen.
   */
  load(): Promise<void> {
    this.loading ??= this.readRoster().finally(() => {
      this.loading = undefined;
    });
    return this.loading;
  }

  /**
   * Doc so preset tu Host.
   * Nhan: khong co.
   * Tra: khi anh chup da cap nhat (loi nam trong "error").
   */
  async readRoster(): Promise<void> {
    try {
      const result = await this.ctx.remote.agentPresets.list();
      if (!result.ok) throw new Error(result.error.message);
      this.set({ status: "ready", error: null, rows: result.value.presets });
    } catch (error) {
      this.set({ status: "error", error: message(error) });
    }
  }

  /**
   * Mo than khai bao cua mot preset trong trinh xem.
   * Nhan: id — preset can doc.
   * Tra: khi lan doc da yen; mot that bai con hieu luc vao "error", con lan doc bi lan khac thay the thi bo qua.
   */
  async view(id: string): Promise<void> {
    const request = ++this.viewRequest;
    this.set({ error: null, view: null });
    try {
      const result = await this.ctx.remote.agentPresets.read(id);
      if (request !== this.viewRequest) return;
      if (!result.ok) throw new Error(result.error.message);
      const { name, content } = result.value;
      this.set({ view: { id, title: name ?? id, content } });
    } catch (error) {
      if (request === this.viewRequest) this.set({ error: message(error) });
    }
  }

  /**
   * Dong trinh xem.
   * Nhan: khong co.
   * Tra: khong co.
   */
  closeView(): void {
    this.viewRequest++;
    this.set({ view: null });
  }

  /**
   * Dat preset lam mac dinh va dong bo phien trong hien tai khi duoc cap ham dong bo.
   * Nhan: id — mac dinh duoc chon; sync — ham dong bo phien trong (tuy chon).
   * Tra: khi da ghi va lam moi xong.
   */
  async makeDefault(id: string, sync?: (id: string) => Promise<string | undefined>): Promise<void> {
    await this.save(() => writeDefaultPreset(this.ctx, id), sync);
  }

  /**
   * Thay mot mac dinh ship san da bi an sau khi thay doi Cong cu phat trien duoc chap nhan.
   * Nhan: shouldReset — ham duoc kiem lai sau khi cho; false khi cong cu da bat hoac chu so huu nay da bi huy.
   * Tra: khi lan ghi co dieu kien da yen; loi van hien trong khung.
   */
  async reconcileCodingTools(shouldReset: () => boolean): Promise<void> {
    while (this.pendingSave !== undefined) await this.pendingSave;
    if (!shouldReset()) return;
    const settings = this.ctx.configForms.get(AGENT_PRESET_SETTINGS_NS).getSnapshot();
    if (settings.status !== "ready" || settings.writable !== true || settings.revision === undefined) return;
    await this.load();
    if (!shouldReset() || this.store.getSnapshot().status !== "ready") return;
    const rows = this.store.getSnapshot().rows;
    if (!requiresCodingTools(rows.find((row) => row.isDefault))) return;
    if (!rows.some((row) => row.id === STANDARD_PRESET_ID && row.broken === undefined)) {
      this.set({ error: this.ctx.locale.bind(NS)("standardUnavailable") });
      return;
    }
    await this.save(() => writeDefaultPreset(this.ctx, STANDARD_PRESET_ID, settings.revision));
  }

  /**
   * Ghi cau hinh roi doc lai so va dong bo phien neu co.
   * Nhan: write — ham ghi tra thong diep loi; sync — ham dong bo phien trong (tuy chon).
   * Tra: khi lan ghi da yen (loi nam trong "error").
   */
  async save(write: () => Promise<string | undefined>, sync?: (id: string) => Promise<string | undefined>): Promise<void> {
    if (this.store.getSnapshot().saving) return;
    const completion = deferred<void>();
    this.pendingSave = completion.promise;
    this.set({ saving: true, error: null });
    try {
      const error = await write();
      await this.load();
      if (error !== undefined) throw new Error(error);
      const selected = this.store.getSnapshot().rows.find((row) => row.isDefault);
      if (selected !== undefined) {
        const syncError = await sync?.(selected.id);
        if (syncError !== undefined) throw new Error(syncError);
      }
    } catch (error) {
      this.set({ error: message(error) });
    } finally {
      this.pendingSave = undefined;
      this.set({ saving: false });
      completion.resolve(undefined);
    }
  }
}
