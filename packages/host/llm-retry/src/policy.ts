/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Năm hàm thuần của row llm-retry: gộp kết quả tầng dưới, backoff cục bộ có jitter, khoá
 *      chính sách · khoá trạng thái, và bộ chờ huỷ được. Tách khỏi plugin để đo được TỪNG hàm
 *      bằng đối chứng trực tiếp với chính bundle gốc.
 */

import type {
  RequestErrorAction,
  RequestErrorNext,
  ResolvedRetryBackoff,
  ResolvedRetryPolicy,
} from "./types.ts";

/** Kết quả đã gộp của một lượt gọi tầng dưới: quyết định, hoặc lỗi bị nuốt để chính sách tự xử. */
export type DownstreamSettlement =
  | { type: "decision"; decision: RequestErrorAction }
  | { type: "error"; error: unknown };

/**
 * Chạy tầng dưới của waterfall và gộp kết quả thành dữ liệu thay vì để lỗi nổi lên.
 * Nhận: hàm gọi tiếp tầng dưới của waterfall `agent/request-error`.
 * Trả: `{ type: "decision" }` kèm quyết định, hoặc `{ type: "error" }` kèm giá trị đã ném.
 */
export async function settleDownstream(next: RequestErrorNext): Promise<DownstreamSettlement> {
  try {
    return { type: "decision", decision: await next() };
  } catch (error) {
    return { type: "error", error };
  }
}

/**
 * Độ trễ backoff cục bộ: mũ có trần, nhân dao động ngẫu nhiên đối xứng, rồi kẹp vào trần chính sách.
 * Nhận: backoff của chính sách, số thứ tự lần thử lại (từ 1), và mẫu ngẫu nhiên trong [0, 1).
 * Trả: độ trễ đã lên lịch, tính bằng mili giây.
 */
export function localDelay(config: ResolvedRetryBackoff, retry: number, random: () => number): number {
  const exponent = Math.min(retry - 1, 1024);
  const exponential = Math.min(config.initialDelayMs * 2 ** exponent, config.maxDelayMs);
  const jitter = 1 - config.jitterRatio + 2 * config.jitterRatio * random();
  return Math.min(exponential * jitter, config.maxDelayMs);
}

/**
 * Khoá chính sách: hai chính sách TƯƠNG ĐƯƠNG phải cho cùng một khoá, nên trường nào không đổi
 * hành vi thì không vào khoá — chế độ `always` bỏ qua ngân sách và tập mã đủ điều kiện.
 * Nhận: chính sách đã chốt của tuyến provider.
 * Trả: chuỗi JSON làm khoá trạng thái.
 */
export function retryPolicyKey(policy: ResolvedRetryPolicy): string {
  return policy.mode === "always"
    ? JSON.stringify([policy.mode, policy.initialDelayMs, policy.maxDelayMs, policy.jitterRatio])
    : JSON.stringify([
        policy.mode,
        policy.maxRetries,
        [...policy.retryableCodes].sort(),
        policy.initialDelayMs,
        policy.maxDelayMs,
        policy.jitterRatio,
      ]);
}

/**
 * Khoá trạng thái: một chuỗi thử lại riêng cho từng cặp (provider, chính sách).
 * Nhận: tên provider và khoá chính sách của nó.
 * Trả: chuỗi JSON dùng làm khoá trong trạng thái chiếu `llmRetry`.
 */
export function retryStateKey(provider: string, policyKey: string): string {
  return JSON.stringify([provider, policyKey]);
}

/**
 * Chờ một khoảng thời gian huỷ được: hết giờ thì trả `true`, bị huỷ thì dọn hẹn giờ và trả `false`.
 * Nhận: độ trễ cần chờ (ms) và tín hiệu huỷ.
 * Trả: promise `true` khi chờ trọn vẹn, `false` khi tín hiệu đã huỷ (kể cả huỷ trước khi gọi).
 */
export function cancellableDelay(delayMs: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    /** Dọn hẹn giờ khi tín hiệu huỷ giữa lúc chờ. */
    function onAbort(): void {
      clearTimeout(timer);
      resolve(false);
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, delayMs);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
