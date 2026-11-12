/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Doc hiep tro tep dung chung giua cac control dang mount + bo doc JSON cua Host
 */

import type { PathApplicationLike, ReactLike, SnapshotStoreLike, StoreModuleLike } from "./types.ts";

/** Ham doc hiep tro cua mot dich (duong dan hoac route da xac thuc). */
export type ApplicationsQuery = (target: string, signal: AbortSignal) => Promise<readonly PathApplicationLike[] | null>;

/** Ket qua doc hiep tro tep cua mot dich. */
export interface FileApplicationsState {
  /** Ung dung da dang ky cho dich nay. */
  apps: readonly PathApplicationLike[];
  /** Con dang doc lan dau. */
  loading: boolean;
  /** Lan doc gan nhat that bai. */
  failed: boolean;
}

/** Mot muc giu trang thai doc dung chung cho mot cap (query, target). */
interface Retained {
  /** Store trang thai cua muc. */
  state: SnapshotStoreLike<FileApplicationsState>;
  /** So control dang dung muc nay. */
  users: number;
  /** Lan doc dang chay, de lan sau huy duoc. */
  controller: AbortController | null;
  /** Doc lai (huy lan cu). */
  refresh: () => void;
}

/** Trang thai truoc lan doc dau. */
const EMPTY: FileApplicationsState = { apps: [], loading: true, failed: false };

/** Bang giu dung doc: query -> dich -> muc. Moi control mount them mot nguoi dung. */
const readers = new WeakMap<ApplicationsQuery, Map<string, Retained>>();

/**
 * Bo doc JSON cua Host thanh metadata ung dung da kiem.
 * Nhan: value — danh sach ung dung da giai ma.
 * Tra: metadata da kiem.
 * Nem: Error khi muc nao sai hinh dang hoac dia chi icon khong duoc phep.
 */
export function parseNativeFileApplications(value: unknown): readonly PathApplicationLike[] {
  if (!Array.isArray(value)) throw new Error("Invalid native application list");
  const applications: PathApplicationLike[] = [];
  for (const entry of value as readonly unknown[]) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      !("id" in entry) ||
      !("name" in entry) ||
      !("default" in entry) ||
      !("icon" in entry)
    ) {
      throw new Error("Invalid native application entry");
    }
    const row = entry as { id: unknown; name: unknown; default: unknown; icon: unknown };
    if (
      typeof row.id !== "string" ||
      row.id.length === 0 ||
      typeof row.name !== "string" ||
      typeof row.default !== "boolean" ||
      !(row.icon === null || (typeof row.icon === "string" && /^data:image\/(?:png|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(row.icon)))
    ) {
      throw new Error("Invalid native application entry");
    }
    applications.push({ id: row.id, name: row.name, default: row.default, icon: row.icon });
  }
  return applications;
}

/**
 * Dung bo doc hiep tro qua route da xac thuc cua phien.
 * Nhan: fetcher — ham goi HTTP (mac dinh fetch).
 * Tra: ham doc tra metadata, hoac null khi truy van that bai.
 */
export function createRouteQuery(
  fetcher: (input: string, init?: RequestInit) => Promise<Response> = (input, init) => fetch(input, init),
): ApplicationsQuery {
  return async (url: string, signal: AbortSignal): Promise<readonly PathApplicationLike[] | null> => {
    try {
      const response = await fetcher(url, { signal });
      if (!response.ok) return null;
      return parseNativeFileApplications(await response.json());
    } catch {
      return null;
    }
  };
}

/**
 * Dung hook `useFileApplications` tren React va store cua bang module.
 * Nhan: react — module react; createStore — ham tao store cua `@galaxy-blackhole/gbh-client-store`.
 * Tra: hook chia se hiep tro va lan doc lai giua cac control cung tep, cung bo doc.
 */
export function makeUseFileApplications(
  react: ReactLike,
  createStore: StoreModuleLike["createSnapshotStore"],
): (target: string, query: ApplicationsQuery, enabled: boolean) => FileApplicationsState & { refresh: () => void } {
  /**
   * Giu lai truy van cua mot control; nguoi dung cuoi cung nha ra thi huy va bo muc.
   * Nhan: query — bo doc; target — dich; listener — ham nghe thay doi.
   * Tra: ham huy.
   */
  function subscribe(query: ApplicationsQuery, target: string, listener: () => void): () => void {
    let targets = readers.get(query);
    if (targets === undefined) {
      targets = new Map<string, Retained>();
      readers.set(query, targets);
    }
    let entry = targets.get(target);
    const initial = entry === undefined;
    if (entry === undefined) {
      const created: Retained = {
        state: createStore<FileApplicationsState>(EMPTY),
        users: 0,
        controller: null,
        refresh: () => {
          created.controller?.abort();
          const controller = new AbortController();
          created.controller = controller;
          void query(target, controller.signal).then((apps) => {
            if (!controller.signal.aborted) {
              created.state.set({ apps: apps ?? [], loading: false, failed: apps === null });
            }
          });
        },
      };
      entry = created;
      targets.set(target, entry);
    }
    const retained = entry;
    retained.users += 1;
    const release = retained.state.subscribe(listener);
    if (initial) retained.refresh();
    return () => {
      release();
      retained.users -= 1;
      if (retained.users === 0) {
        retained.controller?.abort();
        targets.delete(target);
      }
    };
  }

  /**
   * Chia se hiep tro va lan doc lai giua cac control dang mount cho cung tep va cung bo doc.
   * Nhan: target — duong dan hoac route da xac thuc; query — bo doc gan voi Host dang phuc vu
   *   (that bai tra null); enabled — desktop cua Host co san khong.
   * Tra: metadata, trang thai doc lan dau, trang thai that bai, va ham doc lai dung chung.
   */
  return function useFileApplications(
    target: string,
    query: ApplicationsQuery,
    enabled: boolean,
  ): FileApplicationsState & { refresh: () => void } {
    const retain = react.useCallback(
      (listener: () => void) => (enabled ? subscribe(query, target, listener) : () => {}),
      [enabled, query, target],
    );
    const snapshot = react.useCallback(
      () => (enabled ? readers.get(query)?.get(target)?.state.getSnapshot() ?? EMPTY : EMPTY),
      [enabled, query, target],
    );
    const state = react.useSyncExternalStore(retain, snapshot, snapshot);
    const refresh = react.useCallback(() => {
      readers.get(query)?.get(target)?.refresh();
    }, [query, target]);
    return { ...state, refresh };
  };
}
