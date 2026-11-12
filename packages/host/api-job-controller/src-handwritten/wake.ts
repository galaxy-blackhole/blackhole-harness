/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Sổ đánh thức dùng chung cho HAI dòng quan sát: một bộ chờ cờ đánh thức KHÔNG BAO GIỜ mất lượt
 *      đánh thức giữa hai lần chờ, và một giấc ngủ huỷ được để gộp các đợt bùng nổ thành khung có trần.
 */

/** Bộ chờ cờ đánh thức: một lượt đánh thức rơi vào giữa hai lần chờ KHÔNG BAO GIỜ bị mất. */
export class OutputWaiter {
  /** Đã có lượt đánh thức chưa được tiêu thụ hay chưa. */
  private dirty = false;

  /** Hàm hoàn tất của lượt chờ đang mở (chỉ một lượt tại một thời điểm). */
  private resolve?: () => void;

  /**
   * Ghi MỘT lượt đánh thức: giải phóng lượt chờ đang mở, hoặc nạp sẵn cho lượt chờ kế tiếp.
   * Nhận: không.
   * Trả: không.
   */
  wake(): void {
    this.dirty = true;
    this.resolve?.();
  }

  /**
   * Hoàn tất ở lượt đánh thức KẾ TIẾP, ngay lập tức khi đã có lượt đánh thức trước đó, hoặc khi bị huỷ.
   * Nhận: tín hiệu huỷ của thế hệ quan sát.
   * Trả: promise hoàn tất khi được đánh thức hoặc khi bị huỷ.
   */
  wait(signal: AbortSignal): Promise<void> {
    if (this.dirty || signal.aborted) {
      this.dirty = false;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      const finish = (): void => {
        signal.removeEventListener("abort", finish);
        if (this.resolve === finish) this.resolve = undefined;
        this.dirty = false;
        resolve();
      };
      this.resolve = finish;
      signal.addEventListener("abort", finish, { once: true });
    });
  }
}

/**
 * Ngủ hết cửa sổ gộp, hoặc trả về NGAY khi đã bị huỷ.
 * Nhận: độ dài cửa sổ tính bằng mili giây, và tín hiệu huỷ của thế hệ.
 * Trả: promise hoàn tất sau cửa sổ hoặc khi bị huỷ.
 */
export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = setTimeout(done, ms);
    /**
     * Kết thúc lượt ngủ: xoá hẹn giờ, gỡ listener, rồi hoàn tất.
     * Nhận: không.
     * Trả: không.
     */
    function done(): void {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });
}
