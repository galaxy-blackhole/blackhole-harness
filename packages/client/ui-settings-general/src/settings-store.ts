/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Store của ghế sidebar.settings — LUẬT 8: thể hiện ĐẦY ĐỦ { open, activeId } + getSnapshot/subscribe/actions
 */

// ⚠️ LUẬT 8 (đo được 18/10/2026): ghế `sidebar.settings` khai `store:` trong đăng ký slot, và tầng slots
//   gọi THẲNG `store.getSnapshot()` khi dựng hook `useStore`. Thiếu `getSnapshot` ⇒
//   `TypeError: w.getSnapshot is not a function` ⇒ CẢ THANH BÊN không render (không phải chỉ panel trắng).
//   Vì vậy tay nắm dưới đây phơi ĐỦ SÁU thứ: hai trường trạng thái đọc trực tiếp + getSnapshot + subscribe +
//   actions + create. Bản gốc lấy chúng từ `defineStore` của @galaxy-blackhole/gbh-client-store; ở đây viết tay
//   để (a) không phụ thuộc seam có thể vắng, (b) hình dạng là HỢP ĐỒNG KIỂM ĐƯỢC bằng test.

/** Trạng thái cửa sổ Settings — đúng hai trường bản gốc khai trong `init`. */
export interface SettingsShellState {
  /** Cửa sổ đang mở. */
  open: boolean;
  /** Id mục đang chọn (`undefined` = chưa chọn mục nào). */
  activeId: string | undefined;
}

/** Bốn động tử của cửa sổ Settings — ĐÃ BIND, gọi không cần tham số draft. */
export interface SettingsShellActions {
  /** Mở cửa sổ, GIỮ NGUYÊN mục đang chọn (đúng bản gốc). */
  open(): void;
  /** Đóng cửa sổ và xoá mục đang chọn (đúng bản gốc: `close` xoá `activeId`). */
  close(): void;
  /** Chọn một mục. */
  select(id: string): void;
  /** Mở thẳng một mục (điều hướng sâu từ phím tắt/onboarding). */
  openSection(id: string): void;
}

/** Tay nắm store mà tầng renderer nhận qua `store:` của đăng ký slot. */
export interface SettingsShellStore {
  /** Cửa sổ đang mở — đọc trực tiếp, không qua `getSnapshot`. */
  readonly open: boolean;
  /** Mục đang chọn — đọc trực tiếp, không qua `getSnapshot`. */
  readonly activeId: string | undefined;
  /**
   * Ảnh chụp trạng thái, THAM CHIẾU ỔN ĐỊNH khi chưa có thay đổi (hợp đồng useSyncExternalStore).
   * @returns ảnh chụp `{ open, activeId }`.
   */
  getSnapshot(): SettingsShellState;
  /**
   * Đăng ký nghe thay đổi.
   * @param listener - hàm được gọi sau mỗi lần trạng thái đổi.
   * @returns hàm huỷ đăng ký.
   */
  subscribe(listener: () => void): () => void;
  /** Bốn động tử đã bind. */
  actions: SettingsShellActions;
  /**
   * Trả CHÍNH thể hiện này — bản gốc ghim một thể hiện cho cả phiên (mọi lần `create()` trả cùng một cái).
   * @returns thể hiện store đang dùng.
   */
  create(): SettingsShellStore;
}

/**
 * Dựng store của ghế `sidebar.settings`.
 * @returns tay nắm đầy đủ sáu phần theo LUẬT 8.
 */
export function createSettingsShellStore(): SettingsShellStore {
  let state: SettingsShellState = { open: false, activeId: undefined };
  let snapshot: SettingsShellState = state;
  const listeners = new Set<() => void>();

  const notify = (): void => {
    snapshot = { open: state.open, activeId: state.activeId };
    for (const listener of Array.from(listeners)) {
      try {
        listener();
      } catch (error) {
        // Một người nghe hỏng KHÔNG được giết cửa sổ Settings (khuôn #5).
        console.warn("gbh-client-ui-settings-general: listener store nem loi, bo qua", error);
      }
    }
  };

  const handle: SettingsShellStore = {
    get open(): boolean {
      return state.open;
    },
    get activeId(): string | undefined {
      return state.activeId;
    },
    getSnapshot: (): SettingsShellState => snapshot,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    actions: {
      open: (): void => {
        if (state.open) return;
        state = { open: true, activeId: state.activeId };
        notify();
      },
      close: (): void => {
        if (!state.open && state.activeId === undefined) return;
        state = { open: false, activeId: undefined };
        notify();
      },
      select: (id: string): void => {
        if (state.activeId === id) return;
        state = { open: state.open, activeId: id };
        notify();
      },
      openSection: (id: string): void => {
        state = { open: true, activeId: id };
        notify();
      },
    },
    create: (): SettingsShellStore => handle,
  };

  return handle;
}
