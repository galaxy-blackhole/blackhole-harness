/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Store của cây tệp: mức đã đọc, thư mục đang mở và vị trí cuộn, tách theo từng tab.
 */

import type { FileLevelLike, RemoteFailureLike } from "./types.ts";

/** Một mức đang được đọc. */
export interface FilesLoadingLevel {
  /** Nhãn trạng thái. */
  kind: "loading";
}

/** Một mức đã đọc xong (có thể kèm lỗi đọc lại). */
export interface FilesReadyLevel {
  /** Nhãn trạng thái. */
  kind: "ready";
  /** Nội dung thư mục. */
  level: FileLevelLike;
  /** Lỗi của lần đọc lại gần nhất, nếu có. */
  failure?: RemoteFailureLike;
}

/** Một mức không đọc được. */
export interface FilesFailedLevel {
  /** Nhãn trạng thái. */
  kind: "failed";
  /** Vì sao không đọc được. */
  failure: RemoteFailureLike;
}

/** Trạng thái của một mức thư mục. */
export type FilesLevelState = FilesLoadingLevel | FilesReadyLevel | FilesFailedLevel;

/** Cây của MỘT tab. */
export interface FilesTreeState {
  /** Đường dẫn tuyệt đối của gốc workspace. */
  root: string;
  /** Các mức đã đọc, khoá theo đường dẫn tuyệt đối. */
  levels: Record<string, FilesLevelState>;
  /** Các thư mục đang mở. */
  expanded: string[];
  /** Vị trí cuộn của thân tab (px). */
  scrollTop: number;
  /** Có tự đọc lại khi thư mục đổi không. */
  autoRefresh: boolean;
}

/** Trạng thái store của kiểu tab §files§ (một instance cho mỗi phiên). */
export interface FilesStoreState {
  /** Cây của từng tab, khoá theo id tab. */
  byTab: Record<string, FilesTreeState>;
}

/** Hình dạng §defineStore§ mà §@galaxy-blackhole/gbh-client-store§ cấp. */
export type DefineStore = (spec: {
  /** Trạng thái đầu. */
  init: () => FilesStoreState;
  /** Tập action; tham số đầu là bản nháp trạng thái. */
  actions: Record<string, (draft: FilesStoreState, ...args: never[]) => void>;
}) => unknown;

/**
 * Lấy cây của một tab, hoặc ném khi tab chưa được gieo.
 * Nhận: state — bản nháp; tabId — tab đang ghi.
 * Trả: cây của tab đó.
 */
function bucket(state: FilesStoreState, tabId: string): FilesTreeState {
  const tree = state.byTab[tabId];
  if (tree === undefined) throw new Error('ui-sidebar-files: no tree for tab "' + tabId + '"');
  return tree;
}

/**
 * Khai store của cây tệp.
 *
 * Là FACTORY chứ không phải handle dùng chung: đăng ký khai nó là store độc quyền nên khung tự cấp một
 * instance cho mỗi phiên. Người ghi chạy giữa §start§ và §forget§ — tín hiệu của chủ sở hữu là thứ kết
 * thúc vòng đời một bucket.
 * Nhận: defineStore — hàm của bảng module.
 * Trả: handle store để khai trong spec đăng ký chỗ ngồi.
 */
export function createFilesStore(defineStore: DefineStore): unknown {
  return defineStore({
    init: (): FilesStoreState => ({ byTab: {} }),
    actions: {
      /** Ghi chế độ tự làm mới của một tab. */
      autoRefresh: (d: FilesStoreState, tabId: string, enabled: boolean) => {
        bucket(d, tabId).autoRefresh = enabled;
      },
      /** Gieo cây của một tab tại gốc workspace, mở sẵn gốc. */
      start: (d: FilesStoreState, tabId: string, root: string) => {
        d.byTab[tabId] = { root, levels: {}, expanded: [root], scrollTop: 0, autoRefresh: true };
      },
      /** Đánh dấu một thư mục đang đọc (không hạ cấp một mức đã đọc xong). */
      loading: (d: FilesStoreState, tabId: string, path: string) => {
        const state = bucket(d, tabId);
        if (state.levels[path]?.kind !== "ready") state.levels[path] = { kind: "loading" };
      },
      /** Ghi nội dung một thư mục; thư mục con đã biến mất thì quên luôn cây con của nó. */
      loaded: (d: FilesStoreState, tabId: string, path: string, level: FileLevelLike) => {
        const state = bucket(d, tabId);
        const previous = state.levels[path];
        if (previous?.kind === "ready") {
          const directories = new Set(level.entries.filter((entry) => entry.type === "directory").map((entry) => entry.name));
          for (const entry of previous.level.entries) {
            if (entry.type !== "directory" || directories.has(entry.name)) continue;
            const removed = path.replace(/[/\\]+$/, "") + "/" + entry.name;
            state.expanded = state.expanded.filter((value) => value !== removed && !value.startsWith(removed + "/"));
            state.levels = Object.fromEntries(
              Object.entries(state.levels).filter(([key]) => key !== removed && !key.startsWith(removed + "/")),
            );
          }
        }
        state.levels[path] = { kind: "ready", level };
      },
      /** Ghi vì sao một thư mục không đọc được (mức đã đọc xong thì chỉ gắn thêm lỗi). */
      failed: (d: FilesStoreState, tabId: string, path: string, failure: RemoteFailureLike) => {
        const state = bucket(d, tabId);
        const level = state.levels[path];
        state.levels[path] = level?.kind === "ready" ? { ...level, failure } : { kind: "failed", failure };
      },
      /** Ghi một lần mở/đóng thư mục (mức đã đọc vẫn giữ, nên mở lại là vẽ ngay). */
      toggled: (d: FilesStoreState, tabId: string, path: string) => {
        const state = bucket(d, tabId);
        const at = state.expanded.indexOf(path);
        if (at >= 0) state.expanded.splice(at, 1);
        else state.expanded.push(path);
      },
      /** Ghi vị trí cuộn của thân một tab. */
      scrolled: (d: FilesStoreState, tabId: string, scrollTop: number) => {
        bucket(d, tabId).scrollTop = scrollTop;
      },
      /** Bỏ mọi mức đã đọc, giữ tập đang mở (nửa đầu của thao tác đọc lại). */
      reset: (d: FilesStoreState, tabId: string) => {
        bucket(d, tabId).levels = {};
      },
      /** Quên cây của một tab đã biến mất. */
      forget: (d: FilesStoreState, tabId: string) => {
        d.byTab = Object.fromEntries(Object.entries(d.byTab).filter(([id]) => id !== tabId));
      },
    },
  });
}
