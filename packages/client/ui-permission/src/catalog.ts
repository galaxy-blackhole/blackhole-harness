/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Thu muc catalog quyen dung chung cho ca tien trinh: doc mot lan, moi nhat thang, co chot theo the he ket noi
 */

import { CATALOG_CHANGED_EVENT } from "./ids.ts";

/** Mot lua chon quyen do Host cong bo. */
export interface PermissionOption {
  /** Gia tri may (vi du "read-only"). */
  value: string;
  /** Ten do Host cap. */
  name: string;
  /** Mo ta do Host cap (neu co). */
  description?: string;
}

/** Catalog quyen ma Host tra ve: lua chon cho phien hien tai va mac dinh cho phien moi. */
export interface PermissionCatalog {
  /** Lua chon cho phien hien tai (co the gom "auto" khi bat tich hop thi nghiem). */
  options: readonly PermissionOption[];
  /** Gia tri mac dinh hien hanh. */
  defaultPreset: string;
  /** Lua chon cho mac dinh phien moi (KHONG gom "auto"). */
  defaultOptions: readonly PermissionOption[];
}

/** Anh chup catalog ma hai be mat cung doc. */
export interface PermissionCatalogState {
  /** Catalog day du cua the he hien tai, hoac null truoc khi lan doc dau thanh cong. */
  value: PermissionCatalog | null;
}

/** Store quan sat duoc (do @galaxy-blackhole/gbh-client-store cap luc vat chat hoa factory). */
export interface SnapshotStore<T> {
  /** Doc anh chup hien tai. */
  getSnapshot(): T;
  /** Ghi de anh chup. */
  set(next: T): void;
  /** Sua anh chup tai cho. */
  update(mutate: (draft: T) => void): void;
  /** Theo doi thay doi; tra ham go. */
  subscribe(listener: () => void): () => void;
}

/** Ket qua mot lan goi Remote (dang Result cua DSH). */
export interface RemoteResult<T> {
  /** true khi thanh cong. */
  ok: boolean;
  /** Gia tri khi thanh cong. */
  value?: T;
  /** Loi khi that bai. */
  error?: { code?: string; message?: string };
}

/** Phan context ma thu muc catalog can. */
export interface CatalogContext {
  /** Lay mot service theo ten (ban goc dung cho "connection"). */
  get(name: string): unknown;
  /** Seam Remote: goi namespace va nghe event. */
  remote: {
    /** Theo doi mot event cua Host; tra ham go. */
    $on(event: string, listener: () => void): () => void;
    /** Namespace catalog quyen. */
    permissionPresets: { catalog(): Promise<RemoteResult<PermissionCatalog>> };
  };
}

/** The he ket noi hiện tai (id doi moi khi noi lai). */
interface ConnectionGeneration {
  /** Id the he, hoac undefined khi chua noi. */
  getSnapshot(): { id?: string } | undefined;
  /** Theo doi doi the he; tra ham go. */
  subscribe(listener: () => void): () => void;
}

/** Seam ket noi ma thu muc catalog can. */
interface ConnectionService {
  /** The he ket noi. */
  generation: ConnectionGeneration;
}

/** Thu muc catalog quyen: mot ban cho ca tien trinh, chia se cho popup /permission va chip composer. */
export interface CatalogDirectory {
  /** Anh chup catalog cho ca hai be mat. */
  store: SnapshotStore<PermissionCatalogState>;
  /** Mot nhip moi lan vo hieu (catalog doi hoac the he ket noi doi). */
  invalidations: SnapshotStore<{ count: number }>;
  /** Buoc doc lai catalog day du cho the he hien tai. */
  refresh(): void;
  /** Doc catalog day du cho mot lan mo popup (co the cho lan doc dang chay). */
  load(): Promise<PermissionCatalog>;
  /** Ngung theo doi va chan moi ket qua ve muon. */
  dispose(): void;
}

/**
 * Dung thu muc catalog dung chung (ban goc: lop PermissionCatalogDirectory).
 * Nhan: context phia browser va ham tao store cua @galaxy-blackhole/gbh-client-store.
 * Tra: doi tuong CatalogDirectory — dang ky nghe TRUOC lan doc dau de khong lot event.
 */
export function makeCatalogDirectory(
  ctx: CatalogContext,
  createSnapshotStore: <T>(initial: T) => SnapshotStore<T>,
): CatalogDirectory {
  const connection = ctx.get("connection") as ConnectionService;
  const store = createSnapshotStore<PermissionCatalogState>({ value: null });
  const invalidations = createSnapshotStore<{ count: number }>({ count: 0 });
  let generationId: string | undefined;
  let initialized = false;
  let epoch = 0;
  let pending: Promise<void> | undefined;
  let failure: Error = new Error("permission catalog has no complete value");
  let disposed = false;
  // Hai ham go duoc gan ngay sau khi dinh nghia xong cac ham ben duoi (ban goc gan trong constructor).
  let stopCatalog: () => void = () => {};
  let stopGeneration: () => void = () => {};

  /** Phat mot nhip vo hieu cho ben dang hien lua chon. */
  function invalidate(): void {
    invalidations.set({ count: invalidations.getSnapshot().count + 1 });
  }

  /** Ghi nhan the he ket noi: doi the he thi xoa gia tri cu va doc lai. */
  function syncGeneration(): void {
    if (disposed) return;
    const next = connection.generation.getSnapshot()?.id;
    if (initialized && next === generationId) return;
    if (initialized) invalidate();
    initialized = true;
    generationId = next;
    ++epoch;
    pending = undefined;
    failure = new Error("permission catalog has no complete value");
    store.set({ value: null });
    if (next !== undefined) startRead(next);
  }

  /** Ket qua ve muon chi duoc ghi khi con dung the he va dung luot doc. */
  function accepts(readEpoch: number, readGeneration: string): boolean {
    return (
      !disposed &&
      readEpoch === epoch &&
      readGeneration === generationId &&
      connection.generation.getSnapshot()?.id === readGeneration
    );
  }

  /** Bat dau mot lan doc doc lap; luot moi nhat trong cung the he thang. */
  function startRead(readGeneration: string): void {
    const readEpoch = ++epoch;
    failure = new Error("permission catalog has no complete value");
    const operation = ctx.remote.permissionPresets
      .catalog()
      .then((result) => {
        if (!result.ok) throw new Error((result.error?.code ?? "error") + ": " + (result.error?.message ?? ""));
        if (!accepts(readEpoch, readGeneration)) return;
        store.set({ value: result.value ?? null });
      })
      .catch((error: unknown) => {
        if (!accepts(readEpoch, readGeneration)) return;
        failure = error instanceof Error ? error : new Error(String(error));
        store.set({ value: null });
      })
      .finally(() => {
        if (pending === operation) pending = undefined;
      });
    pending = operation;
  }

  /** Buoc doc lai cho the he hien tai (bo qua khi the he da doi — khi do dong bo lai truoc). */
  function refresh(): void {
    if (disposed) return;
    const current = connection.generation.getSnapshot()?.id;
    if (current === undefined) return;
    if (current !== generationId) {
      syncGeneration();
      return;
    }
    startRead(current);
  }

  /** Doc catalog day du cho mot lan mo popup. */
  async function load(): Promise<PermissionCatalog> {
    if (pending === undefined && store.getSnapshot().value === null) refresh();
    while (!disposed) {
      const current = connection.generation.getSnapshot()?.id;
      if (current === undefined) throw new Error("permission catalog has no active Host connection");
      if (current !== generationId) syncGeneration();
      const running = pending;
      if (running !== undefined) {
        await running;
        continue;
      }
      const state = store.getSnapshot();
      if (state.value !== null) return state.value;
      throw failure;
    }
    throw new Error("permission catalog directory is disposed");
  }

  /** Ngung theo doi va vo hieu moi ket qua ve muon. */
  function dispose(): void {
    if (disposed) return;
    disposed = true;
    ++epoch;
    pending = undefined;
    stopGeneration();
    stopCatalog();
  }

  // Dang ky nghe TRUOC lan doc dau: dong race cai-dat/doc (ban goc lam dung vay).
  stopCatalog = ctx.remote.$on(CATALOG_CHANGED_EVENT, () => {
    invalidate();
    refresh();
  });
  stopGeneration = connection.generation.subscribe(() => {
    syncGeneration();
  });
  syncGeneration();

  return { store, invalidations, refresh, load, dispose };
}
