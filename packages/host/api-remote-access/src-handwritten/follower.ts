/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Một thế hệ ảnh chụp quyền ĐANG MỞ của một Peer không-phải-chủ: các thay đổi được GỘP cho tới khi
 *      bên đọc tỉnh dậy — bản viết lại 1:1 `AccessFollower` của gói gốc.
 */

import type { Principal } from "@deepseek-ai/dsh-typert-protocol";

/** Một thế hệ ảnh chụp không-phải-chủ đang mở; thay đổi gộp cho tới khi bên đọc tỉnh. */
export class AccessFollower {
  /** Danh tính bên gọi của thế hệ này (KHÔNG BAO GIỜ là chủ). */
  readonly principal: Principal;

  /** Đã đánh dấu cũ chưa được tiêu thụ hay chưa. */
  private dirty = false;

  /** Hàm đánh thức của lượt chờ đang mở. */
  private wake?: () => void;

  /**
   * @param principal - danh tính bên gọi của thế hệ; không bao giờ là chủ.
   */
  constructor(principal: Principal) {
    this.principal = principal;
  }

  /**
   * Đánh dấu thế hệ đã cũ và đánh thức bên đọc.
   * Nhận: không.
   * Trả: không.
   */
  touch(): void {
    this.dirty = true;
    this.wake?.();
  }

  /**
   * Chờ tới khi thế hệ cũ đi hoặc bị huỷ.
   * Nhận: tín hiệu huỷ của thế hệ.
   * Trả: true khi đã cũ; false khi đã bị huỷ.
   */
  async changed(signal: AbortSignal): Promise<boolean> {
    const abort = (): void => {
      this.wake?.();
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      while (!this.dirty && !signal.aborted) {
        await new Promise<void>((resolve) => {
          this.wake = resolve;
        });
        this.wake = undefined;
      }
    } finally {
      signal.removeEventListener("abort", abort);
    }
    this.dirty = false;
    return !signal.aborted;
  }
}
