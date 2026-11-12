/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kho trang thai xem cua trinh duyet workspace + thu tu ghim — nguyen hanh vi ban goc (stores.js, pin-order.js)
 */

import { FLAT_SESSION_ORDER_KEY } from "./ids.ts";
import { WORKSPACE_VIEW_STORAGE_KEY } from "./persist-migration.ts";
import { ext, type Dyn } from "./runtime.ts";

/**
 * Thu tu "ghim truoc" cua mot tai khoan theo thu tu nguon.
 * Nhan: workspaces — danh sach workspace; list — anh chup phien cua phien dang chay.
 * Tra: nguon thu tu ghim (pin truoc, roi theo do moi).
 */
export function pinOrderSource(workspaces: readonly Dyn[], list: Dyn, state: Dyn): string[] {
  const pinned = new Set<string>(state.pinnedSessionIds as string[]);
  const archived = new Set<string>(state.archivedSessionIds as string[]);
  const ids: string[] = [];
  for (const workspace of workspaces) for (const id of workspace.sessionIds as string[]) if (pinned.has(id) && !archived.has(id)) ids.push(id);
  for (const id of list.ids as string[]) if (pinned.has(id) && !archived.has(id) && !ids.includes(id)) ids.push(id);
  return ids;
}

/**
 * Cac tai khoan (workspace id) ma mot phien thuoc ve — dung de cap nhat thu tu ghim.
 * Nhan: workspaces — danh sach workspace; sessionId — phien vua ghim.
 * Tra: mang id tai khoan (rong khi khong workspace nao nhan).
 */
export function pinOrderAccounts(workspaces: readonly Dyn[], sessionId: string): string[] {
  return workspaces.filter((workspace: Dyn) => (workspace.sessionIds as string[]).includes(sessionId)).map((workspace: Dyn) => workspace.workspaceId as string);
}

/** Trang thai xem cua trinh duyet workspace (che do nhom, thu tu, bo loc, mo rong, thu tu phien theo tai khoan). */
export interface WorkspaceViewState {
  /** Che do nhom: theo workspace, theo cay workspace, hay mot danh sach. */
  groupBy: string;
  /** Thu tu: thu cong hay theo do moi. */
  orderBy: string;
  /** Bo loc phien luu tru. */
  archivedFilter: string;
  /** Trang thai mo rong cua tung nhom theo khoa nhom. */
  groupExpansion: Record<string, boolean>;
  /** Thu tu phien da luu theo tung tai khoan. */
  sessionOrderByAccount: Record<string, string[]>;
}

/** Cac hanh dong ma than trinh duyet goi tren kho xem. */
export interface WorkspaceViewActions {
  /** Doi che do nhom. */
  setGroupBy: (mode: string) => void;
  /** Doi thu tu (kem thu tu hien hanh de luu lai khi chuyen sang thu cong). */
  setOrderBy: (mode: string, orders: Record<string, string[]>) => void;
  /** Doi bo loc phien luu tru. */
  setArchivedFilter: (mode: string) => void;
  /** Mo hoac dong mot nhom. */
  setGroupExpanded: (key: string, expanded: boolean) => void;
  /** Luu thu tu phien cua mot tai khoan. */
  setSessionOrder: (accountKey: string, order: readonly string[], orders: Record<string, string[]>) => void;
  /** Giu lai dung cac tai khoan con ton tai (bo cac khoa cu). */
  retainAccountKeys: (keys: readonly string[]) => void;
  /** Dong bo nhieu thu tu cung luc (khi dong trong dang chon doi vi tri). */
  syncSessionOrders: (orders: Record<string, string[]>) => void;
  /** Dat thu tu ghim cho mot phien theo nguon thu tu. */
  pinSessionOrder: (sessionId: string, accounts: readonly string[], order: readonly string[]) => void;
  /** Anh chup trang thai hien tai. */
  getSnapshot: () => WorkspaceViewState;
}

/**
 * Kho xem: CHINH NO la mot store anh chup (co getSnapshot/subscribe) — slot nhan no o truong `store`
 * va `useStore(selector)` goi thang getSnapshot tren do (ban goc cung vay).
 */
export interface WorkspaceViewHandle {
  /** Anh chup trang thai xem hien tai. */
  getSnapshot: () => WorkspaceViewState;
  /** Dang ky nhan thong bao khi trang thai doi. */
  subscribe: (listener: () => void) => () => void;
  /** Ghi de mot phan trang thai. */
  set: (next: WorkspaceViewState) => void;
  /** Store goc (giu lai cho chan doan). */
  state: Dyn;
  /** Tao mot the hien hanh dong moi (ban goc: mot the hien duy nhat cho ca row). */
  create: () => { actions: WorkspaceViewActions; release: () => void };
}

/**
 * Dung kho xem cua trinh duyet workspace (che do nhom duoc luu qua nhieu lan tai).
 * Nhan: khong co.
 * Tra: kho xem voi `create()` sinh ra bo hanh dong.
 */
export function createWorkspaceViewStore(): WorkspaceViewHandle {
  const state = ext.store.createSnapshotStore(
    {
      groupBy: "workspace",
      orderBy: "manual",
      archivedFilter: "default",
      groupExpansion: {},
      sessionOrderByAccount: {},
    },
    // 18/10/2026 (task-30): khoá persist MỚI của Galaxy Blackhole; khoá cũ dsh.workspace.view được
    //   migrate MỘT LẦN ở plugin.apply (xem persist-migration.ts) trước khi store này được tạo.
    { persist: { name: WORKSPACE_VIEW_STORAGE_KEY } },
  );
  const patch = (next: Partial<WorkspaceViewState>): void => {
    state.set({ ...state.getSnapshot(), ...next });
  };
  const withKey = (orders: Record<string, string[]>): Record<string, string[]> => {
    const next: Record<string, string[]> = {};
    for (const [key, ids] of Object.entries(orders)) next[key] = [...ids];
    return next;
  };
  return {
    // ⚠️ 18/10/2026: thieu getSnapshot o day ⇒ `slot entry crashed in 'sidebar.workspaces':
    //   TypeError: w.getSnapshot is not a function` ⇒ ca thanh ben khong render (do that trong lab 5462).
    getSnapshot: () => state.getSnapshot() as WorkspaceViewState,
    subscribe: (listener: () => void) => state.subscribe(listener) as () => void,
    set: (next: WorkspaceViewState) => state.set(next),
    state,
    // ⚠️ 18/10/2026: KHUNG SLOT coi KET QUA cua `store.create()` la mot NGUON ANH CHUP (no goi
    //   `bindSnapshotSelector(w)` ⇒ `w.getSnapshot()`). Ban goc dung `defineStore` — `create()` cua no tra
    //   ve MOT THE HIEN day du (getSnapshot/subscribe/actions). Ban dau ta chi tra `{ actions }` ⇒
    //   `TypeError: w.getSnapshot is not a function` ⇒ `slot entry crashed in 'sidebar.workspaces'`.
    create: () => ({
      getSnapshot: () => state.getSnapshot() as WorkspaceViewState,
      subscribe: (listener: () => void) => state.subscribe(listener) as () => void,
      actions: {
        setGroupBy: (mode: string) => {
          patch({ groupBy: mode });
        },
        setOrderBy: (mode: string, orders: Record<string, string[]>) => {
          patch(mode === "manual" ? { orderBy: mode, sessionOrderByAccount: withKey(orders) } : { orderBy: mode });
        },
        setArchivedFilter: (mode: string) => {
          patch({ archivedFilter: mode });
        },
        setGroupExpanded: (key: string, expanded: boolean) => {
          patch({ groupExpansion: { ...state.getSnapshot().groupExpansion, [key]: expanded } });
        },
        setSessionOrder: (accountKey: string, order: readonly string[], orders: Record<string, string[]>) => {
          patch({ sessionOrderByAccount: { ...withKey(orders), [accountKey]: [...order] } });
        },
        retainAccountKeys: (keys: readonly string[]) => {
          const kept: Record<string, string[]> = {};
          for (const key of keys) kept[key] = state.getSnapshot().sessionOrderByAccount[key] ?? [];
          patch({ sessionOrderByAccount: kept });
        },
        syncSessionOrders: (orders: Record<string, string[]>) => {
          patch({ sessionOrderByAccount: withKey(orders) });
        },
        pinSessionOrder: (sessionId: string, accounts: readonly string[], order: readonly string[]) => {
          const current = state.getSnapshot().sessionOrderByAccount;
          const next: Record<string, string[]> = { ...current };
          const keys = accounts.length > 0 ? accounts : [FLAT_SESSION_ORDER_KEY];
          for (const key of keys) next[key] = [sessionId, ...((current[key] as string[] | undefined) ?? [...order]).filter((id: string) => id !== sessionId)];
          patch({ sessionOrderByAccount: next });
        },
        getSnapshot: () => state.getSnapshot(),
      },
      release: () => undefined,
    }),
  };
}

/**
 * Chieu mot nguon co dang store (getSnapshot/subscribe) thanh gia tri dan xuat.
 * Nhan: source — store nguon; project — ham chieu.
 * Tra: store dan xuat cung giao dien.
 */
export function derive(source: Dyn, project: (snapshot: Dyn) => Dyn): Dyn {
  let cached = project(source.getSnapshot());
  return {
    getSnapshot: () => {
      const next = project(source.getSnapshot());
      if (next !== cached) cached = next;
      return cached;
    },
    subscribe: (listener: () => void) => source.subscribe(listener),
  };
}
