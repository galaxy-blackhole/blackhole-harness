/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Loi hua hoan thanh thu cong — thay Promise.withResolvers (lib ES2023 cua repo khong khai bao ham do)
 */

/** Một lời hứa kèm hai hàm hoàn thành thủ công. */
export interface Deferred<T> {
  /** Lời hứa hoàn thành khi `resolve`/`reject` được gọi. */
  readonly promise: Promise<T>;
  /** Hoàn thành lời hứa với một giá trị. */
  readonly resolve: (value: T) => void;
  /** Hoàn thành lời hứa với một lý do từ chối. */
  readonly reject: (reason?: unknown) => void;
}

/**
 * Tạo một lời hứa hoàn thành thủ công — thay `Promise.withResolvers` của bản gốc.
 * Nhận: không có.
 * Trả: bộ ba `{ promise, resolve, reject }` đúng như bản gốc.
 */
export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((settle, fail) => {
    resolve = settle;
    reject = fail;
  });
  return { promise, resolve, reject };
}
