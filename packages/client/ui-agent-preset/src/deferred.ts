/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hoan thanh thu cong — thay Promise.withResolvers (lib ES2023 cua repo khong khai bao ham do)
 */

/** Mot loi hua kem hai ham hoan thanh thu cong. */
export interface Deferred<T> {
  /** Loi hua hoan thanh khi resolve duoc goi. */
  readonly promise: Promise<T>;
  /** Hoan thanh loi hua voi mot gia tri. */
  readonly resolve: (value: T) => void;
}

/**
 * Tao mot loi hua hoan thanh thu cong — dung thay Promise.withResolvers cua ban goc.
 * Nhan: khong co.
 * Tra: cap { promise, resolve } dung nhu ban goc.
 */
export function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}
