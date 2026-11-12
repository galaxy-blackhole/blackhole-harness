/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Một lượt chờ nền đang sống của câu hỏi có hẹn giờ: hạn chót theo đồng hồ Host và các
 *      "claim" của Client (bản gốc: `lib/types/timed-wait.js`). Trạng thái bền vẫn nằm ở chiếu phiên.
 */
import type { UserQuestionError } from "./errors.ts";

/**
 * Một lượt chờ nền đang sống, chỉ được Host đếm khi KHÔNG có UI trả lời nào giữ nó.
 *
 * Đồng hồ chỉ chạy khi không Client nào giữ lượt chờ: một UI đang mở thẻ câu hỏi tự quyết định
 * kết cục đầu tiên (nó từ chối với `ASK_TIMED_OUT` khi hết đếm ngược của nó).
 */
export class TimedQuestionWait {
  /** Hạn chót theo đồng hồ Host, dùng khi không Client nào giữ lượt chờ. */
  private readonly deadline: number;
  /** Tín hiệu huỷ của lượt đang gọi. */
  private readonly parent: AbortSignal | undefined;
  /** Lỗi nghiệp vụ dùng để chốt một lượt chờ không ai nhận. */
  private readonly timeout: UserQuestionError;
  /** Tín hiệu huỷ chia sẻ với luồng nền, KHÔNG phải với lượt đang gọi. */
  private readonly controller = new AbortController();
  /** Chốt khi lượt chờ bị huỷ, hết hạn, hoặc bị dọn. */
  private readonly completion = Promise.withResolvers<void>();
  /** Các claim đang giữ lượt chờ này. */
  private readonly claims = new Set<() => void>();
  /** Đồng hồ đang chạy, hoặc undefined khi có claim giữ. */
  private timer: ReturnType<typeof setTimeout> | undefined;
  /** Lượt gọi bị huỷ: chốt lượt chờ với nguyên nhân của nó. */
  private readonly parentAborted = (): void => {
    this.close(this.parent?.reason);
  };

  /**
   * Dựng một lượt chờ nền.
   * Nhận: `deadline` — hạn chót theo đồng hồ Host; `parent` — tín hiệu huỷ của lượt đang gọi;
   * `timeout` — lỗi nghiệp vụ dùng để chốt lượt chờ không ai nhận.
   * Trả: thể hiện đã lên lịch (hoặc đã chốt ngay khi tín hiệu cha đã huỷ).
   */
  constructor(deadline: number, parent: AbortSignal | undefined, timeout: UserQuestionError) {
    this.deadline = deadline;
    this.parent = parent;
    this.timeout = timeout;
    parent?.addEventListener("abort", this.parentAborted, { once: true });
    if (parent?.aborted === true) this.parentAborted();
    else this.schedule();
  }

  /** Tín hiệu huỷ chia sẻ với luồng nền, không phải với lượt đang gọi. */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /** Chốt khi lượt chờ bị huỷ, hết hạn, hoặc bị dọn. */
  get done(): Promise<void> {
    return this.completion.promise;
  }

  /** Lên lịch lại đồng hồ hết hạn; chỉ chạy khi không có claim nào giữ lượt chờ. */
  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.signal.aborted || this.claims.size > 0) return;
    this.timer = setTimeout(() => {
      this.close(this.timeout);
    }, Math.max(0, this.deadline - Date.now()));
  }

  /**
   * Giữ lượt chờ cho một UI trả lời cho tới khi luồng của nó đóng hoặc câu hỏi được chốt.
   * Nhận: `signal` — vòng đời huỷ của luồng nghiệp vụ này.
   * Trả: một khung thời lượng còn lại; luồng kết thúc thì claim được nhả.
   */
  async *attach(signal: AbortSignal): AsyncGenerator<{ remainingMs: number }> {
    if (signal.aborted || this.signal.aborted) return;
    if (this.claims.size === 0 && Date.now() >= this.deadline) {
      this.close(this.timeout);
      return;
    }
    const ended = Promise.withResolvers<void>();
    const release = (): void => {
      if (!this.claims.delete(release)) return;
      signal.removeEventListener("abort", release);
      this.signal.removeEventListener("abort", release);
      ended.resolve();
      this.schedule();
    };
    this.claims.add(release);
    signal.addEventListener("abort", release, { once: true });
    this.signal.addEventListener("abort", release, { once: true });
    this.schedule();
    try {
      yield { remainingMs: Math.max(0, this.deadline - Date.now()) };
      await ended.promise;
    } finally {
      release();
    }
  }

  /**
   * Nhả đồng hồ, tín hiệu cha, và mọi claim của Client.
   * Nhận: `reason` — nguyên nhân huỷ giao cho luồng nền.
   * Trả: không; gọi lần hai là vô hiệu.
   */
  close(reason?: unknown): void {
    if (this.signal.aborted) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.parent?.removeEventListener("abort", this.parentAborted);
    this.controller.abort(reason);
    this.completion.resolve();
  }
}
