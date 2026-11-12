/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Controller cua chip preset: phien KE TIEP nhan preset nao — nguyen van ban goc (seat-store.ts)
 */

import { deferred } from "./deferred.ts";
import type { PresetRow } from "./display.ts";
import { presetOptions, readRoster, type PresetOption, type RosterContext } from "./roster.ts";
import type { SnapshotStore } from "./store.ts";

/** Mot lan tu choi lua chon: ly do + preset bi tu choi (de ve bang bao). */
export interface SeatRefusal {
  /** Ly do Host tu choi. */
  readonly reason: string;
  /** Preset nguoi dung vua chon (hoac chi con id khi so da doi). */
  readonly preset: PresetOption | PresetRow;
}

/** Anh chup cua chip: so lua chon, lua chon dang hien, loi, va co dang ban khong. */
export interface SeatSnapshot {
  /** Lua chon da loc (chi preset lanh). */
  readonly options: readonly PresetOption[];
  /** Preset dang duoc chon cho phien ke tiep. */
  readonly current: string;
  /** Loi tu choi dang hien, hoac thong diep loi. */
  readonly error: string | SeatRefusal | null;
  /** Dang cho Host tra loi mot lan chon. */
  readonly busy: boolean;
  /** Chip nen chay hieu ung tu gioi thieu. */
  readonly introduce: boolean;
}

/** Phien ma chip doc duoc — chi phan that su dung. */
export interface SeatSession {
  /** Id phien. */
  readonly id: string;
  /** Phien chua chay luot nao (Host chi doi preset truoc luot dau). */
  readonly blank?: boolean;
  /** Gia tri chieu cua phien (agentPreset nam o day). */
  readonly projectionValues?: Readonly<Record<string, unknown>>;
}

/** Lua chon tam thoi: preset cua phien ke tiep, va co can tu gioi thieu khong. */
export interface StagedPreset {
  /** Id preset da stage, hoac undefined khi khong stage gi. */
  id: string | undefined;
  /** Chip co nen tu gioi thieu tren phien no dat xuong khong. */
  introduce: boolean;
}

/** Gia tri dau cua store chip — nguyen van ban goc. */
export const INITIAL_SEAT_SNAPSHOT: SeatSnapshot = { options: [], current: "", error: null, busy: false, introduce: false };

/**
 * Doc preset cua mot phien tu chieu cua no.
 * Nhan: session — phien (co the undefined).
 * Tra: id preset, hoac undefined khi phien khong ghi preset.
 */
export function presetOf(session: SeatSession | undefined): string | undefined {
  const value = session?.projectionValues?.["agentPreset"];
  return typeof value === "string" ? value : undefined;
}

/** Stage preset cho phien ke tiep va ap no khi phien do xuat hien. */
export class AgentPresetSeatController {
  /** Context mang namespace Remote. */
  private readonly ctx: RosterContext;
  /** Phien dang la hien tai (undefined khi chua co). */
  private readonly currentSession: () => SeatSession | undefined;
  /** Lua chon tam thoi dung chung voi cac ghe khac. */
  private readonly staged: StagedPreset;
  /** Anh chup chip ma renderer theo doi — the hien DAY DU cua createSnapshotStore. */
  readonly store: SnapshotStore<SeatSnapshot>;
  /** Mac dinh Host dang ap dung, de mot stage da dung xong van roi ve duoc ma khong doc lai so. */
  private fallback = "";
  /** Chi lan doc so MOI NHAT duoc cong bo khi cac lan lam moi chong nhau. */
  private loadGeneration = 0;
  /** Lan hoan thanh cua lua chon Host dang chay; lua chon tu Settings cho no xong truoc khi stage. */
  private pendingSelection: Promise<void> | undefined;

  /**
   * Nhan: ctx — context mang namespace Remote; currentSession — ham doc phien hien tai;
   *   staged — o stage dung chung (mac dinh: mot o rong).
   */
  constructor(
    ctx: RosterContext,
    currentSession: () => SeatSession | undefined,
    staged: StagedPreset = { id: undefined, introduce: false },
    createStore: <T>(initial: T) => SnapshotStore<T>,
  ) {
    this.ctx = ctx;
    this.currentSession = currentSession;
    this.staged = staged;
    this.store = createStore(INITIAL_SEAT_SNAPSHOT);
  }

  /**
   * Gop mot mảnh vào anh chup hien tai.
   * Nhan: patch — cac truong can thay.
   * Tra: khong co.
   */
  set(patch: Partial<SeatSnapshot>): void {
    this.store.set({ ...this.store.getSnapshot(), ...patch });
  }

  /**
   * Xoa lua chon tam thoi.
   * Nhan: khong co.
   * Tra: khong co.
   */
  clearStage(): void {
    this.staged.id = undefined;
    this.staged.introduce = false;
  }

  /**
   * Doc so preset va mo chip tren mac dinh Host dang ap dung.
   * Nhan: khong co.
   * Tra: khi anh chup da phan anh Host.
   */
  async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    const roster = await readRoster(this.ctx);
    if (generation !== this.loadGeneration) return;
    const error = this.store.getSnapshot().error;
    if (!roster.ok) {
      if (typeof error !== "object" || error === null) this.set({ error: roster.error });
      return;
    }
    const { presets } = roster.value;
    this.fallback = presets.find((preset) => preset.isDefault)?.id ?? presets[0]?.id ?? "";
    const session = this.currentSession();
    this.set({
      options: presetOptions(presets),
      current: this.staged.id ?? (session === undefined ? this.fallback : presetOf(session) ?? ""),
      error: typeof error === "object" ? error : null,
      introduce: this.staged.introduce,
    });
    await this.apply();
  }

  /**
   * Stage mot preset cho phien ke tiep, ap ngay khi da co mot phien trong dang la hien tai.
   *
   * Loi tu choi duoc luu lai cho bang bao cua chip va tra ve cho noi goi (vi du Settings — noi cung
   * bao ket qua lan ghi cua chinh no).
   * Nhan: id — preset can stage.
   * Tra: chuoi tu choi, hoac undefined khi lua chon da yen.
   */
  async select(id: string): Promise<string | undefined> {
    if (this.store.getSnapshot().busy) return undefined;
    this.stage(id);
    return await this.apply();
  }

  /**
   * Stage mot lua chon MA KHONG ap ngay, cho mot luong tu khoi phien nhan sau khi chon (muc Creator cua
   * khung cai dat). Ap ngay cua select() se gap phien dang chay va bo stage di vi khong phuc vu duoc;
   * stage khong thoi thi de lai cho bo ap dung theo thay doi danh sach, von no chay khi phien vua khoi
   * tro thanh hien tai.
   * Nhan: id — preset can stage; introduce — true khi stage den tu man hinh khac va chip nen tu gioi thieu.
   * Tra: khong co.
   */
  stage(id: string, introduce = false): void {
    this.staged.id = id;
    this.staged.introduce = introduce;
    this.set({ current: id, error: null, introduce });
  }

  /**
   * Ghi nhan mot loi tu choi da hien xong ma khong xoa lan thu moi hon.
   * Nhan: refusal — loi lua chon vua hien xong bang bao.
   * Tra: khong co.
   */
  dismissRefusal(refusal: SeatRefusal): void {
    if (this.store.getSnapshot().error === refusal) this.set({ error: refusal.reason });
  }

  /**
   * Ghi lai dung phien trong ma mot hanh dong cua Settings co the mang theo.
   * Nhan: khong co.
   * Tra: id phien do, hoac undefined khi khong o trong mot phien trong.
   */
  blankSessionId(): string | undefined {
    const session = this.currentSession();
    return session?.blank === true ? session.id : undefined;
  }

  /**
   * Ap lua chon tu Settings chi khi phien da ghi lai van con la hien tai va con trong sau khi lua chon
   * dang cho yen. Duong ap dung van la stage/apply san co.
   * Nhan: expectedSessionId — phien trong ghi lai truoc lan ghi cua Settings; id — mac dinh da ghi.
   * Tra: chuoi tu choi cua Host, hoac undefined khi da ap hoac khong con lien quan.
   */
  async syncBlankSession(expectedSessionId: string, id: string): Promise<string | undefined> {
    while (this.pendingSelection !== undefined) await this.pendingSelection;
    const session = this.currentSession();
    if (session === undefined || session.blank !== true || session.id !== expectedSessionId) return undefined;
    this.stage(id);
    return await this.apply();
  }

  /**
   * Ghi nhan hieu tu gioi thieu khi chip da chay xong.
   * Nhan: khong co.
   * Tra: khong co.
   */
  introduced(): void {
    if (!this.store.getSnapshot().introduce) return;
    this.staged.introduce = false;
    this.set({ introduce: false });
  }

  /**
   * Trao lua chon da stage cho phien hien tai, neu co phien de nhan.
   *
   * Duoc goi ca boi select() lan boi noi quan sat phien hien tai doi, vi phien co the xuat hien truoc
   * hoac sau lua chon. Cap nhat danh sach khong lap lai mot lua chon khi phan hoi cua no con dang cho.
   * Nhan: khong co.
   * Tra: loi tu choi cua lan nay, hoac undefined khi thanh cong hoac khong mo lan doi nao.
   */
  async apply(): Promise<string | undefined> {
    if (this.store.getSnapshot().busy) return undefined;
    const staged = this.staged.id;
    const session = this.currentSession();
    if (staged === undefined) {
      const current = session === undefined ? this.fallback : presetOf(session) ?? "";
      if (current !== this.store.getSnapshot().current) this.set({ current });
      return undefined;
    }
    if (session === undefined) return undefined;
    if (session.blank !== true || presetOf(session) === staged) {
      this.clearStage();
      return undefined;
    }
    const completion = deferred<void>();
    this.pendingSelection = completion.promise;
    this.clearStage();
    const refuse = (reason: string): string => {
      this.set({
        error: {
          reason,
          preset: this.store.getSnapshot().options.find((option) => option.id === staged) ?? { id: staged },
        },
        current: this.staged.id ?? presetOf(session) ?? "",
      });
      return reason;
    };
    try {
      this.set({ busy: true, error: null });
      const result = await this.ctx.remote.agentPresets.select(session.id, staged);
      if (!result.ok) {
        const { error } = result;
        const details = error.details;
        return refuse(
          typeof details === "object" && details !== null && "reason" in details && typeof (details as { reason?: unknown }).reason === "string"
            ? ((details as { reason: string }).reason)
            : error.message,
        );
      }
      this.set({ current: this.staged.id ?? result.value });
      return undefined;
    } catch (error) {
      return refuse(error instanceof Error ? error.message : String(error));
    } finally {
      this.pendingSelection = undefined;
      this.set({ busy: false });
      completion.resolve(undefined);
    }
  }
}
