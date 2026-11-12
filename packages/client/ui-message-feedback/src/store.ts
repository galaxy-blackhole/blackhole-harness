/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kho anh chup toi thieu cua row ui-message-feedback — hop dong ma tang khung bind vao hook
 */

/** Kho anh chup: doc anh chup hien tai, thay no, va dang ky nhan thong bao. */
export interface SnapshotStore<T> {
  /**
   * Anh chup hien tai (bat bien theo quy uoc cua nguoi goi).
   * Nhan: khong co.
   * Tra: gia tri hien tai.
   */
  getSnapshot(): T;
  /**
   * Thay anh chup bang gia tri moi va bao cho moi nguoi nghe.
   * Nhan: next — gia tri moi.
   * Tra: khong co.
   */
  set(next: T): void;
  /**
   * Dang ky mot nguoi nghe; goi lai ham tra ve de huy dang ky.
   * Nhan: listener — ham duoc goi moi lan anh chup doi.
   * Tra: ham huy dang ky.
   */
  subscribe(listener: () => void): () => void;
}

/**
 * Dung mot kho anh chup toi thieu.
 *
 * Ban goc dung `createSnapshotStore` cua @galaxy-blackhole/gbh-client-store; hop dong ma tang khung can chi la
 * `getSnapshot` + `subscribe` (hook cua slot doc qua hai ham nay), nen goi nay tu dung lay mot ban
 * toi thieu de bundle khong phu thuoc them mot module chay.
 * Nhan: initial — anh chup dau tien.
 * Tra: kho anh chup.
 */
export function createSnapshotStore<T>(initial: T): SnapshotStore<T> {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: (): T => current,
    set: (next: T): void => {
      current = next;
      for (const listener of [...listeners]) {
        try {
          listener();
        } catch (error) {
          console.error("[ui-message-feedback] nguoi nghe nem loi:", error);
        }
      }
    },
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
