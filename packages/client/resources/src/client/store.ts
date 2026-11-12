/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Store snapshot toi gian: nguon quan sat duoc cho useSyncExternalStore (thay dsh-client-store cua DSH)
 */

/** Một nguồn quan sát được: ảnh chụp ổn định giữa các lần đổi + người nghe. */
export interface SnapshotStore<T> {
  /** Ảnh chụp hiện tại (cùng một tham chiếu cho tới lần §set§ kế tiếp). */
  getSnapshot(): T;
  /** Đăng ký người nghe; trả hàm huỷ đăng ký. */
  subscribe(listener: () => void): () => void;
  /** Thay ảnh chụp và thông báo cho mọi người nghe. */
  set(value: T): void;
}

/**
 * Dựng một snapshot store: đúng hợp đồng mà React §useSyncExternalStore§ và các hook của tầng slots cần.
 * Nhận: giá trị khởi tạo.
 * Trả: store với §getSnapshot§/§subscribe§/§set§.
 */
export function createSnapshotStore<T>(initial: T): SnapshotStore<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => current,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set: (value: T) => {
      current = value;
      for (const listener of [...listeners]) listener();
    },
  };
}

