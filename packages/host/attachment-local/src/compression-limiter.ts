/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Giới hạn ĐỒNG THỜI do từng thể hiện sở hữu cho các phép biến đổi ảnh native: `CompressionLimiter` xếp hàng FIFO các tác vụ nén theo một trần số tác vụ đang chạy, còn `compressionFailure` giữ nguyên lỗi `Error` và chuẩn hoá lý do từ chối không phải `Error` — bản viết lại 1:1 vùng `lib/types/compression-limiter.js` của @deepseek-ai/dsh-attachment-local.
 */

/**
 * Giữ nguyên lỗi `Error` và chuẩn hoá giá trị native binding không phải `Error` thành một `Error`.
 * Nhận: `reason` — lý do từ chối do một tác vụ nén trả về (bất kỳ giá trị nào).
 * Trả: chính `reason` khi nó đã là `Error`, ngược lại một `Error` mới mang câu
 *      "Image compression task rejected with a non-Error value." và giữ `reason` trong `cause`.
 */
export function compressionFailure(reason: unknown): Error {
  return reason instanceof Error ? reason : new Error("Image compression task rejected with a non-Error value.", { cause: reason });
}

/**
 * Hàng đợi FIFO cho công việc nén bất đồng bộ: mỗi thể hiện giữ trần `concurrency` tác vụ đang chạy,
 * tác vụ tới khi đã đủ chỗ thì chờ trong hàng đợi và được đánh thức theo đúng thứ tự đến.
 */
export class CompressionLimiter {
  /** Số tác vụ ĐANG CHẠY tối đa mà thể hiện này cho phép. */
  readonly concurrency: number;

  /** Số tác vụ đang giữ một chỗ trong thể hiện này. */
  private active = 0;

  /** Hàng đợi FIFO các hàm `start` đang chờ chỗ trống. */
  private readonly waiting: (() => void)[] = [];

  /**
   * Dựng một bộ giới hạn với trần đồng thời cho trước.
   * Nhận: `concurrency` — số tác vụ chạy đồng thời tối đa (số dương).
   * Trả: thể hiện mới, chưa giữ chỗ nào và có hàng đợi rỗng.
   */
  constructor(concurrency: number) {
    this.concurrency = concurrency;
  }

  /**
   * Chạy một tác vụ sau khi thể hiện có chỗ trống.
   * Nhận: `task` — phép nén chiếm đúng một chỗ cho tới khi kết thúc (kể cả khi ném lỗi đồng bộ,
   *       vì tác vụ được gọi trong microtask của `Promise.resolve()`).
   * Trả: promise kết quả của tác vụ; lý do từ chối được chuẩn hoá qua {@link compressionFailure}.
   *       Chỗ được nhả TRƯỚC khi promise kết thúc nên tác vụ kế tiếp trong hàng đợi được đánh thức ngay.
   */
  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = (): void => {
        this.active += 1;
        const release = (): void => {
          this.active -= 1;
          this.waiting.shift()?.();
        };
        Promise.resolve().then(task).then(
          (value) => {
            release();
            resolve(value);
          },
          (error: unknown) => {
            release();
            reject(compressionFailure(error));
          },
        );
      };
      if (this.active < this.concurrency) start();
      else this.waiting.push(start);
    });
  }
}
