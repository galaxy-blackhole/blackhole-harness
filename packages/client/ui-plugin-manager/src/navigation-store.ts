/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Port 1:1 navigation-store.js cua bundle goc (dong 4328-4350): lua chon trang Plugins dung chung
 */

/** Một trong các màn của trang: danh sách, danh sách mở rộng, một bundle, một official item, hoặc một row. */
export type NavigationView =
  | { readonly kind: "list" }
  | { readonly kind: "more" }
  | { readonly kind: "package"; readonly name: string; readonly from?: "more" }
  | { readonly kind: "item"; readonly id: string }
  | { readonly kind: "row"; readonly name: string; readonly rowId: string; readonly from?: "more" };

/** Trạng thái chọn trang: `installed` là tab của chính trang; giá trị khác là id của một mục `plugins.tab`. */
export interface NavigationState {
  /** Màn đang mở. */
  view: NavigationView;
  /** Tab đang chọn. */
  tab: string;
}

/** Hai action thay đổi lựa chọn (draft-style của defineStore). */
export interface NavigationActions {
  /**
   * Đổi màn.
   * Nhận: `draft` — trạng thái nháp của store; `view` — màn mới.
   * Trả: không.
   */
  setView(draft: NavigationState, view: NavigationView): void;
  /**
   * Đổi tab.
   * Nhận: `draft` — trạng thái nháp của store; `tab` — tab mới.
   * Trả: không.
   */
  setTab(draft: NavigationState, tab: string): void;
}

/** Định nghĩa store mà `defineStore` của `@galaxy-blackhole/gbh-client-store` nhận (phần trang này dùng). */
export interface NavigationStoreDefinition {
  /** Trạng thái khởi tạo. */
  init(): NavigationState;
  /** Action. */
  actions: NavigationActions;
}

/** Handle store do engine cấp (tạo instance + action đã ràng buộc). */
export interface NavigationStoreHandle {
  /**
   * Tạo (hoặc trả) instance dùng chung.
   * Nhận: không.
   * Trả: instance của store.
   */
  create(): {
    /** Action đã ràng buộc. */
    readonly actions: {
      /** Đổi màn. */
      setView(view: NavigationView): void;
      /** Đổi tab. */
      setTab(tab: string): void;
    };
    /** Ảnh chụp trạng thái. */
    getSnapshot(): NavigationState;
  };
}

/** Hàm `defineStore` lấy từ bảng module của trang (`@galaxy-blackhole/gbh-client-store`). */
export type DefineStore = (definition: NavigationStoreDefinition) => NavigationStoreHandle;

/**
 * Dựng lựa chọn trang Plugins TRƯỚC lần vẽ đầu (port 1:1 `createNavigationStore`).
 *
 * Nhận: `defineStore` — hàm của engine store lấy từ bảng module của trang.
 * Trả: handle store của trang (một instance dùng chung cho trang + điều hướng chéo plugin).
 */
export function createNavigationStore(defineStore: DefineStore): NavigationStoreHandle {
  return defineStore({
    init: () => ({ view: { kind: "list" }, tab: "installed" }),
    actions: {
      setView: (draft, view) => {
        draft.view = view;
      },
      setTab: (draft, tab) => {
        draft.tab = tab;
      },
    },
  });
}
