/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cắt nhận việc + dọn có hạn cho runtime Team: TeamRuntimeLifecycle (signal/reason/isCancellation/track/pending/settle/withTimeout) — port 1:1 lib/types/lifecycle.js.
 */
import { TeamError } from "./error.ts";

/** Sở hữu sự thật huỷ runtime Team duy nhất và hạn dọn. */
export class TeamRuntimeLifecycle {
  /** Hạn chờ một lượt dọn (ms). */
  readonly disposalTimeoutMs: number;
  /** Việc đã nhận còn chờ xử lý. */
  private readonly operations = new Set<Promise<unknown>>();
  /** Controller huỷ runtime. */
  private readonly controller = new AbortController();

  /**
   * Dựng lifecycle.
   * Nhận: disposalTimeoutMs — hạn chờ một lượt dọn. Trả: không.
   */
  constructor(disposalTimeoutMs: number) {
    this.disposalTimeoutMs = disposalTimeoutMs;
  }

  /** Signal huỷ đúng lúc runtime đóng nhận việc. */
  get signal(): AbortSignal { return this.controller.signal; }
  /** Runtime đã đóng nhận việc. */
  get disposed(): boolean { return this.signal.aborted; }
  /** Lý do huỷ chính xác (phân biệt từ chối do dọn). */
  get reason(): unknown { return this.signal.reason; }

  /**
   * Kiểm một từ chối có phải huỷ runtime (trực tiếp hoặc qua chuỗi cause).
   * Nhận: reason — giá trị từ chối. Trả: true khi là huỷ runtime.
   */
  isCancellation(reason: unknown): boolean {
    const seen = new Set<unknown>();
    let current: unknown = reason;
    while (!seen.has(current)) {
      if (this.disposed && current === this.reason) return true;
      if (this.disposed && current instanceof TeamError && current.code === "TEAM_DISPOSED") return true;
      if (!(current instanceof Error)) return false;
      seen.add(current);
      current = current.cause;
    }
    return false;
  }

  /** Đóng nhận việc và huỷ việc đã nhận. */
  close(): void {
    this.controller.abort(new TeamError("Agent Teams service disposed", "TEAM_DISPOSED"));
  }

  /**
   * Theo dõi một giao dịch đã nhận tới khi xong.
   * Nhận: operation — việc thuộc runtime. Trả: chính operation đó.
   */
  track<T extends Promise<unknown>>(operation: T): T {
    this.operations.add(operation);
    void operation.then(() => { this.operations.delete(operation); }, () => { this.operations.delete(operation); });
    return operation;
  }

  /** Chụp các việc còn chờ sau khi đóng nhận việc. */
  pending(): Promise<unknown>[] { return [...this.operations]; }

  /**
   * Chờ việc đã nhận và giữ lại lỗi KHÔNG phải huỷ runtime.
   * Nhận: operations — việc đã chụp; failures — nơi nhận lỗi bất ngờ. Trả: không.
   */
  async settle(operations: readonly Promise<unknown>[], failures: unknown[]): Promise<void> {
    if (operations.length === 0) return;
    try {
      const outcomes = await this.withTimeout(Promise.allSettled(operations));
      for (const outcome of outcomes) {
        if (outcome.status === "rejected" && !this.isCancellation(outcome.reason)) failures.push(outcome.reason);
      }
    } catch (error) {
      failures.push(error);
    }
  }

  /**
   * Giới hạn thời gian một lượt dọn.
   * Nhận: operation — việc có thể treo. Trả: kết quả của nó.
   */
  async withTimeout<T>(operation: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new TeamError("Agent Teams runtime disposal exceeded " + this.disposalTimeoutMs + "ms", "TEAM_DISPOSAL_TIMEOUT"));
      }, this.disposalTimeoutMs);
    });
    try {
      return await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
