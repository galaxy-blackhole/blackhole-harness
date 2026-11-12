/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Waiter thay đổi Team một lần (không phụ thuộc projection): TeamActivity — chờ thay đổi có timeout + huỷ, đánh thức mọi waiter khi có thay đổi — port 1:1 lib/types/activity.js.
 */
import { errorMessage, TeamError } from "./error.ts";
import type { TeamId } from "./types.ts";

/** Một waiter đang chờ thay đổi của một Team. */
interface Waiter {
  /** Đánh thức waiter (kết quả = có thay đổi). */
  resolve(): void;
}

/** Sở hữu waiter thay đổi Team hiện tại và giải phóng mỗi waiter nhiều nhất một lần. */
export class TeamActivity {
  /** Waiter theo Team id. */
  private readonly waiters = new Map<string, Set<Waiter>>();
  /** Đã đóng nhận waiter mới. */
  private closed = false;

  /**
   * Chờ một thay đổi miền Team hoặc trạng thái thành viên kế tiếp.
   * Nhận: id — Team cần theo dõi; timeoutMs — hạn chờ 10.000..3.600.000 ms; signal — huỷ của người gọi.
   * Trả: `{ timedOut }` cho biết lượt chờ kết thúc do hết hạn hay do có thay đổi.
   */
  async wait(id: TeamId, timeoutMs: number, signal: AbortSignal): Promise<{ readonly timedOut: boolean }> {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 10_000 || timeoutMs > 3_600_000) {
      throw new TeamError("timeoutMs must be an integer from 10000 through 3600000", "TEAM_INVALID_TIMEOUT");
    }
    signal.throwIfAborted();
    if (this.closed) return { timedOut: false };
    const changed = await new Promise<boolean>((resolve, reject) => {
      let waiters = this.waiters.get(id);
      if (waiters === undefined) {
        waiters = new Set();
        this.waiters.set(id, waiters);
      }
      let settled = false;
      const finish = (settle: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", onAbort);
        waiters.delete(waiter);
        if (waiters.size === 0) this.waiters.delete(id);
        settle();
      };
      const onAbort = (): void => {
        finish(() => {
          const reason: unknown = signal.reason;
          reject(reason instanceof Error ? reason : new TeamError("wait_agent aborted: " + errorMessage(reason), "TEAM_WAIT_ABORTED"));
        });
      };
      const waiter: Waiter = { resolve: (): void => { finish(() => { resolve(true); }); } };
      waiters.add(waiter);
      const timer = setTimeout(() => { finish(() => { resolve(false); }); }, timeoutMs);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    return { timedOut: !changed };
  }

  /**
   * Đánh thức và gỡ MỌI waiter hiện tại của một Team.
   * Nhận: id — Team có thay đổi. Trả: không.
   */
  notify(id: TeamId): void {
    const waiters = this.waiters.get(id);
    if (waiters === undefined) return;
    this.waiters.delete(id);
    for (const waiter of waiters) waiter.resolve();
  }

  /** Đóng nhận waiter mới và đánh thức mọi waiter hiện tại khi runtime dọn. */
  close(): void {
    this.closed = true;
    for (const waiters of this.waiters.values()) {
      for (const waiter of waiters) waiter.resolve();
    }
    this.waiters.clear();
  }
}
