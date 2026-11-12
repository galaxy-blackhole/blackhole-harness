/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt cây tệp: nối việc đọc/giám sát thư mục vào Remote, và gom trạng thái về store theo tab.
 */

import { DirectoryNode } from "./directory-node.ts";
import { RemoteFailure } from "./remote-error.ts";
import type { FileLevelLike, RemoteFailureLike, RemoteResultLike, RemoteSeamLike } from "./types.ts";

/** Đọc một mức của một phiên; nhánh lỗi đi kèm để mặt cây ghi được vì sao hỏng. */
export type FilesList = (sessionId: string, path: string, signal: AbortSignal) => Promise<RemoteResultLike<FileLevelLike>>;

/** Giám sát một thư mục của một phiên; mỗi vòng lặp là một lần thư mục đổi. */
export type FilesWatch = (sessionId: string, path: string, signal: AbortSignal) => AsyncIterable<string>;

/** Hành động của store mà mặt cây gọi (đã bind, không còn tham số bản nháp). */
export interface FilesActionsLike {
  /** Ghi nhớ chế độ tự làm mới của một tab. */
  autoRefresh(tabId: string, enabled: boolean): void;
  /** Gieo cây của một tab tại gốc workspace. */
  start(tabId: string, root: string): void;
  /** Đánh dấu một thư mục đang đọc. */
  loading(tabId: string, path: string): void;
  /** Ghi nội dung đã đọc của một thư mục. */
  loaded(tabId: string, path: string, level: FileLevelLike): void;
  /** Ghi vì sao một thư mục không đọc được. */
  failed(tabId: string, path: string, failure: RemoteFailureLike): void;
  /** Ghi một lần mở/đóng thư mục. */
  toggled(tabId: string, path: string): void;
  /** Ghi vị trí cuộn của thân một tab. */
  scrolled(tabId: string, scrollTop: number): void;
  /** Quên cây của một tab đã biến mất. */
  forget(tabId: string): void;
}

/** Mặt mà chỗ ngồi §sidebar.right.pane.tab§ nhận qua §inject§. */
export interface FilesFaceLike {
  /** Đọc lại cả cây của một tab. */
  refresh(tabId: string): void;
  /** Bật/tắt tự làm mới cho một tab. */
  setAutoRefresh(tabId: string, enabled: boolean): void;
  /** Gieo cây của một tab và bắt đầu giám sát gốc. */
  start(tabId: string, root: string, signal: AbortSignal): void;
  /** Đọc một thư mục (không đổi trạng thái mở). */
  load(tabId: string, path: string, signal: AbortSignal): void;
  /** Mở hoặc đóng một thư mục. */
  toggle(tabId: string, parentPath: string, path: string, expanded: string[], signal: AbortSignal): void;
}

/** Hàm dựng mặt của một phiên: nhận phiên và hành động store, trả mặt cây. */
export type FilesFaceFactory = (sessionId: string, actions: FilesActionsLike) => FilesFaceLike;

/**
 * Nối việc giám sát thư mục vào bộ giám sát luồng của Remote.
 * Nhận: remote — mặt Remote của trang, có namespace §workspaceFiles§.
 * Trả: hàm giám sát chờ luồng được ngắt khi nút kết thúc.
 */
export function createWatch(remote: RemoteSeamLike): FilesWatch {
  return async function* watch(sessionId: string, path: string, signal: AbortSignal): AsyncIterable<string> {
    const aborted = (): boolean => signal.aborted;
    if (aborted()) return;
    const stream = remote.$stream<{ kind: string }>({
      name: "directory " + path,
      open: (lifetime) => remote.workspaceFiles.changes(sessionId, path, lifetime),
      ended: () => new Error("Directory watch ended: " + path),
    });
    const abort = (): void => {
      stream.dispose();
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      for await (const item of stream) {
        if (aborted()) return;
        if (item.value.kind === "ready") item.accept();
        yield item.value.kind;
      }
    } finally {
      signal.removeEventListener("abort", abort);
      await stream.dispose();
    }
  };
}

/**
 * Nối việc đọc một mức vào một mặt Remote, chỉ giữ thứ mà cây lưu.
 * Nhận: remote — mặt Remote của trang.
 * Trả: hàm đọc một mức thư mục.
 */
export function createList(remote: RemoteSeamLike): FilesList {
  return async (sessionId: string, path: string, signal: AbortSignal): Promise<RemoteResultLike<FileLevelLike>> => {
    const result = await remote.workspaceFiles.list(sessionId, path, signal);
    if (!result.ok) return result;
    return { ok: true, value: { entries: result.value.entries, truncated: result.value.truncated } };
  };
}

/**
 * Nối mặt cây vào MỘT lần đọc thư mục.
 *
 * Thế hệ (generation) theo từng tab/từng đường dẫn quyết định lần settled nào được ghi vào store: yêu cầu
 * mới nhất thắng, nên một lần đọc chậm về sau không ghi đè kết quả mới hơn.
 * Nhận: list — hàm đọc một mức; watch — hàm giám sát thư mục.
 * Trả: hàm dựng mặt của một phiên (phiên + hành động store vào, mặt cây ra).
 */
export function filesFace(list: FilesList, watch: FilesWatch): FilesFaceFactory {
  return (sessionId: string, actions: FilesActionsLike): FilesFaceLike => {
    /** Theo tab, theo đường dẫn: thế hệ mà một lần settled phải khớp. */
    const generations = new Map<string, Map<string, number>>();
    /** Nút gốc đang mở của mỗi tab. */
    const roots = new Map<string, DirectoryNode>();
    const nextGeneration = (tabId: string, path: string): number => {
      const byPath = generations.get(tabId) ?? new Map<string, number>();
      generations.set(tabId, byPath);
      const generation = (byPath.get(path) ?? 0) + 1;
      byPath.set(path, generation);
      return generation;
    };
    const load = async (tabId: string, path: string, signal: AbortSignal): Promise<FileLevelLike | undefined> => {
      if (signal.aborted) return undefined;
      const generation = nextGeneration(tabId, path);
      actions.loading(tabId, path);
      const result = await list(sessionId, path, signal);
      if (signal.aborted || generations.get(tabId)?.get(path) !== generation) return undefined;
      if (result.ok) actions.loaded(tabId, path, result.value);
      else actions.failed(tabId, path, result.error);
      return result.ok ? result.value : undefined;
    };
    return {
      refresh: (tabId: string): void => {
        void roots.get(tabId)?.refreshTree();
      },
      setAutoRefresh: (tabId: string, enabled: boolean): void => {
        actions.autoRefresh(tabId, enabled);
        roots.get(tabId)?.setAutomatic(enabled);
      },
      start(tabId: string, root: string, signal: AbortSignal): void {
        actions.start(tabId, root);
        signal.addEventListener(
          "abort",
          () => {
            void roots.get(tabId)?.close();
            roots.delete(tabId);
            generations.delete(tabId);
            actions.forget(tabId);
          },
          { once: true },
        );
        roots.set(
          tabId,
          new DirectoryNode(
            root,
            (path, lifetime) => load(tabId, path, lifetime),
            (path, lifetime) => watch(sessionId, path, lifetime),
            (path, error) => {
              if (signal.aborted) return;
              actions.failed(tabId, path, new RemoteFailure("gateway/internal", error instanceof Error ? error.message : String(error)));
            },
            signal,
          ).open(),
        );
      },
      load: (tabId: string, path: string, signal: AbortSignal): void => {
        void load(tabId, path, signal);
      },
      toggle(tabId: string, parentPath: string, path: string, expanded: string[], signal: AbortSignal): void {
        if (signal.aborted) return;
        const root = roots.get(tabId);
        if (root === undefined) return;
        const parent = root.find(parentPath);
        if (parent === undefined && !expanded.includes(parentPath)) return;
        const collapsing = expanded.includes(path);
        const next = collapsing ? expanded.filter((value) => value !== path) : [...expanded, path];
        root.setExpanded(next);
        if (collapsing) void parent?.collapse(path);
        else parent?.expand(path, next);
        actions.toggled(tabId, path);
      },
    };
  };
}
