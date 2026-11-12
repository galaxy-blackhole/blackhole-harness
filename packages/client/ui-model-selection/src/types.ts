/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kieu nghiep vu nua client ui-model-selection: lua chon model, danh muc Host, store anh chup va cac mat context
 */

import type { CatalogGroup, Translator } from "./runtime.ts";

/** Mot lua chon provider/model/effort — NGUYEN VAN hinh dang cua @deepseek-ai/dsh-api-remotes. */
export interface ModelSelection {
  /** Id provider so huu model. */
  readonly provider: string;
  /** Id model do provider so huu. */
  readonly model: string;
  /** Effort do adapter so huu (co the vang). */
  readonly reasoningEffort?: string;
}

/** Loi Remote: ma + thong diep — hai truong ban goc dung de noi chuoi loi. */
export interface RemoteError {
  /** Ma loi (vd "session/writer-held"). */
  readonly code: string;
  /** Thong diep loi. */
  readonly message: string;
}

/** Ket qua Remote — dung hinh dang { ok, value } / { ok, error } cua @deepseek-ai/dsh-typert-protocol. */
export type RemoteResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RemoteError };

/** Mot nhom provider loi trong lan nap danh muc gan nhat. */
export interface CatalogFailure {
  /** Id provider loi. */
  readonly id: string;
  /** Ten provider loi. */
  readonly name: string;
  /** Thong diep loi cua provider. */
  readonly message: string;
}

/** Danh muc model cua MOT the he Host, dung chung cho moi bo chon cua phien. */
export interface ModelCatalog {
  /** Nhom provider da nap duoc. */
  readonly groups: readonly CatalogGroup[];
  /** Provider loi trong lan nap nay. */
  readonly failures: readonly CatalogFailure[];
  /** Lua chon mac dinh cua Host. */
  readonly default?: ModelSelection;
}

/** Anh chup observable: doc + nghe — mat toi thieu ma row nay dung. */
export interface ObservableSnapshot<T> {
  /** Anh chup hien tai. */
  getSnapshot(): T;
  /** Nghe thay doi; tra ham huy dang ky. */
  subscribe(listener: () => void): () => void;
}

/** Store anh chup cua @galaxy-blackhole/gbh-client-store — chi ba phuong thuc row nay goi. */
export interface SnapshotStore<T> extends ObservableSnapshot<T> {
  /** Thay toan bo anh chup. */
  set(next: T): void;
  /** Sua ban nhap cua anh chup. */
  update(recipe: (draft: T) => void): void;
}

/** Ham tao store anh chup (lay tu module store luc tao plugin). */
export type CreateSnapshotStore = <T>(initial: T) => SnapshotStore<T>;

/** Anh chup cua projection "modelSelection" trong phien (Host chieu ra). */
export interface ModelSelectionProjection {
  /** Lua chon ke tiep ma projection chieu ra. */
  readonly next?: ModelSelection;
}

/** Anh chup ma hai loi vao (popup /model va ghe composer) cung ve. */
export interface ModelDirectoryState {
  /** Lua chon da luu, giu ca khi provider/model roi khoi danh muc. */
  current: ModelSelection | null;
  /** Nhan effort da luu, giu khi model dang chon khong kha dung. */
  retainedEffort?: string;
  /** Lua chon hien tai co trong danh muc kha dung khong; null khi chua phan giai duoc. */
  routable: boolean | null;
  /** Nhom provider nap thanh cong (lan nap tot gan nhat). */
  groups: readonly CatalogGroup[];
  /** Provider loi cua lan nap gan nhat; nhom dung duoc van dung duoc. */
  failures: readonly CatalogFailure[];
  /** Vong doi cua thao tac dang chay. */
  status: "idle" | "loading" | "ready" | "selecting" | "error";
  /** Lua chon da gui boi lan select moi nhat cho toi khi xong; null neu khong. */
  pending: ModelSelection | null;
  /** Chuoi loi cua ca yeu cau hoac cua lua chon; null khi khong co. */
  error: string | null;
}

/** Anh chup vong doi cua danh muc dung chung. */
export interface ModelCatalogState {
  /** Gia tri danh muc hien tai. */
  value: ModelCatalog | null;
  /** Vong doi nap. */
  status: "idle" | "loading" | "ready" | "error";
  /** Loi nap, neu co. */
  error: string | null;
}

/** Mat wire cua phien ma thu muc goi (chi phuong thuc that su dung). */
export interface SessionsWireFace {
  /** Gui lua chon model cho Host. */
  selectModel(input: {
    readonly sessionId: string;
    readonly provider: string;
    readonly model: string;
    readonly reasoningEffort?: string;
  }): Promise<RemoteResult<void>>;
}

/** Mat sessions trong context client (ban goc goi thang ctx.sessions). */
export interface SessionsFace {
  /** Dia chi subagent cua phien, neu co (co = khong chon duoc model). */
  subagentAddress(sessionId: string): unknown;
  /** Scope cua phien (noi dang ky hieu ung don dep). */
  scope(sessionId: string): { effect(run: () => () => void, label: string): unknown } | undefined;
  /** Rang buoc dang giu cua phien. */
  binding(sessionId: string): SessionBinding | undefined;
}

/** Rang buoc giua mot phien va mot ghe (do seam sessions cap). */
export interface SessionBinding {
  /** Mat phien: projection modelSelection + co "blank". */
  readonly session: {
    /** Kho projection cua phien. */
    readonly projections: { faceOf(name: string): ObservableSnapshot<unknown> };
    /** Anh chup tom tat phien. */
    getSnapshot(): { readonly blank: boolean };
  };
}

/** Ham theo doi su kien san pham (chi desktop co) — ban goc nhan tu ctx.get("productAnalytics"). */
export type TrackProductEvent = (name: string, attributes: Record<string, unknown>) => void;

/** Hop dong cua mot thu muc model cua phien (lop ModelDirectory thoa man). */
export interface DirectoryContract {
  /** Anh chup dung chung ma hai loi vao cung ve. */
  readonly store: SnapshotStore<ModelDirectoryState>;
  /** Bao dam danh muc kha dung cua the he Host da nap. */
  load(): Promise<ModelDirectoryState>;
  /** Gui mot lua chon day du provider/model/effort. */
  select(selection: ModelSelection): Promise<RemoteResult<void>>;
  /** Vo hieu phan hoi cua the he Host truoc. */
  resetConnected(): void;
  /** Don dep khi scope phien dong. */
  dispose(): void;
}

/** Dich vu ctx.modelDirectories — lop ModelDirectoryResolver thoa man. */
export interface DirectoryServiceFace {
  /** Thu muc cua mot phien (tao luoi, scope don dep se huy). */
  directoryFor(sessionId: string): DirectoryContract;
}

/** Tu dien cua mot namespace (hai bang zh/en) — tham so cua ctx.locale.register. */
export interface LocaleDictionaries {
  /** Bang tieng Trung (nguon su that ve tap khoa). */
  readonly zh: Record<string, string>;
  /** Bang tieng Anh. */
  readonly en: Record<string, string>;
}

/** Mat locale service ma row nay dung. */
export interface LocaleFace {
  /** Dang ky tu dien cho mot namespace; tra ham huy. */
  register(namespace: string, dictionaries: LocaleDictionaries): () => void;
  /** Gan ham dich cho mot namespace. */
  bind(namespace: string): Translator;
}

/** Spec dang ky mot slot — chi truong row nay dien. */
export interface SlotSpec {
  /** Ten slot (nguyen van). */
  name: string;
  /** Namespace tu dien cua slot. */
  locale: string;
  /** Nghiep vu tiem vao component cua slot. */
  inject: (sessionId: string) => unknown;
  /** Cac truong khac cua spec (ban goc khong dung o row nay). */
  [key: string]: unknown;
}

/** Mat slot registry ma row nay dung. */
export interface SlotsFace {
  /** Chay callback khi slot ton tai (va dang ky lai khi noi dung doi). */
  inject(slot: string, run: () => unknown): void;
  /** Dang ky mot nguoi ngoi cho slot; tra ham huy. */
  register(spec: SlotSpec, component: unknown): () => void;
}

/** Mat command UI ma row nay dung. */
export interface CommandUiFace {
  /** Dang ky mot lenh client; tra ham huy. */
  register(contribution: Record<string, unknown>): () => void;
}

/** Mat remote ma row nay dung. */
export interface RemoteFace {
  /** Nghe su kien Remote (khong co namespace). */
  $on(event: string, listener: () => void): () => void;
  /** Mat session cua Remote (cung mat wire ma thu muc goi, kem phep doc danh muc). */
  readonly session: SessionsWireFace & {
    /** Doc danh muc model cua the he Host hien tai. */
    modelCatalog(): Promise<RemoteResult<ModelCatalog>>;
  };
}

/** Context cua scope sau khi inject (ban goc goi scope.slots / scope.modelDirectories / scope.sessions). */
export interface ClientScope {
  /** Slot registry. */
  readonly slots: SlotsFace;
  /** Dich vu thu muc model. */
  readonly modelDirectories: DirectoryServiceFace;
  /** Mat sessions. */
  readonly sessions: SessionsFace & SessionsWireFace;
  /** Lay mot dich vu tuy chon theo ten. */
  get(name: string): unknown;
  /** Dang ky hieu ung vong doi voi nhan. */
  effect(run: () => unknown, label: string): () => void;
  /** Cho cac dich vu khac roi chay callback voi scope moi. */
  inject(deps: readonly string[], run: (scope: ClientScope) => void): void;
}

/** Context goc phia client ma Loader goi apply. */
export interface ClientCtx extends ClientScope {
  /** Locale service. */
  readonly locale: LocaleFace;
  /** Mat Remote. */
  readonly remote: RemoteFace;
  /** Nghe su kien cordis cua context. */
  on(event: string, listener: () => void): () => void;
  /** Nap mot plugin con (ban goc dung de dang ky ModelDirectoryResolver). */
  plugin(plugin: unknown): void;
}

/** Nghiep vu ma slot "conversation.input.model" tiem vao component (ban goc: slots.ts). */
export interface ModelSelectInjected {
  /** Phien nay co ho tro soi/chon model gan agent khong. */
  readonly available: boolean;
  /** Store thu muc dung chung cua phien (cung instance voi popup /model). */
  readonly directory: SnapshotStore<ModelDirectoryState>;
  /** Bao dam danh muc tu van da nap (loi roi vao store). */
  readonly load: () => void;
  /**
   * Chon mot lua chon provider/model/effort day du.
   * Nhận: selection — lua chon model va effort tuy chon.
   * Trả: ket qua cua Host, hoac undefined khi phien nay khong chon duoc model.
   */
  readonly select: (selection: ModelSelection) => Promise<RemoteResult<void> | undefined>;
}
