/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hàng đợi kéo-theo-nhu cầu + cầu nối waterfall của nguồn sự kiện Host được chuyển tiếp — port 1:1
 *      `RemoteEventQueue` · `remoteEventSourceEndReason` · `forwardWaterfall` · `assertJsonArgs` của bản gốc.
 */

import { Deque } from "@deepseek-ai/dsh-deque";
import { isJsonValue } from "@deepseek-ai/dsh-util-values";

/** Đại diện Agent mà một waterfall mang theo: đúng hai trường mà Host đọc (`ctx` + `id`). */
export interface AgentLike {
  /** Context của Agent — giá trị của dispatch, chỉ tồn tại phía Host. */
  readonly ctx: unknown;
  /** Danh tính Agent, chuyển thành `agentId` của dispatch. */
  readonly id: string;
}

/** Khung `emit`: tên sự kiện + tham số ĐÃ kiểm JSON + bộ đọc tài nguyên (nếu mục allowlist khai). */
export interface ForwardedEmitFrame {
  /** Tên sự kiện Cordis được chuyển tiếp. */
  readonly event: string;
  /** Tham số nguyên văn của lượt phát — đã qua phép kiểm lossless JSON. */
  readonly args: readonly unknown[];
  /** Bộ đọc mã tài nguyên từ payload; vắng khi sự kiện không mang tài nguyên riêng. */
  readonly resources?: Readonly<Record<string, (payload: never) => unknown>>;
}

/** Kết cục mà Gateway trả về cho một dispatch waterfall đang chờ. */
export type WaterfallOutcome = { readonly kind: "result"; readonly value: unknown } | { readonly kind: "next" };

/** Ngữ cảnh dispatch của waterfall: giá trị, chủ thể, và danh tính Agent. */
export interface WaterfallDispatchContext {
  /** `agent.ctx` — giá trị thật mà lượt waterfall trả về cho Gateway. */
  readonly value: unknown;
  /** Chủ thể của giá trị (Agent) để Gateway kiểm quyền. */
  readonly subject: unknown;
  /** Danh tính Agent dạng chuỗi. */
  readonly agentId: string;
}

/** Khung `waterfall`: một lượt chờ Gateway phân xử, kèm hai cửa resolve/reject. */
export interface WaterfallDispatchFrame {
  /** Tên sự kiện waterfall. */
  readonly event: string;
  /** Yêu cầu gốc của lượt waterfall (đọc `agent`). */
  readonly request: { readonly agent?: AgentLike };
  /** Ngữ cảnh dispatch mà Gateway chuyển cho Peer. */
  readonly context: WaterfallDispatchContext;
  /** Kết thúc lượt chờ bằng kết cục của Gateway. */
  resolve(outcome: WaterfallOutcome): void;
  /** Kết thúc lượt chờ bằng lỗi. */
  reject(reason: unknown): void;
}

/** Khung mà hàng đợi vận chuyển: emit hoặc dispatch waterfall. */
export type ForwardedFrame = ForwardedEmitFrame | WaterfallDispatchFrame;

/**
 * Hàng đợi MỘT nguồn, đẩy-khi-có, kéo-theo-nhu cầu: cầu nối listener Cordis ĐỒNG BỘ sang AsyncIterable.
 * Bản gốc khai lớp không generic; ở đây generic theo khung để phép kiểm kiểu chặt hơn mà hành vi y hệt.
 */
export class RemoteEventQueue<Frame extends ForwardedFrame = ForwardedFrame> {
  /** Đệm khung chưa được kéo. */
  private readonly buffer = new Deque<Frame>();
  /** Hàm đánh thức lượt kéo đang chờ (nếu có). */
  private waiter: (() => void) | undefined;
  /** `true` sau khi nguồn kết thúc — mọi lần đẩy sau đó trả `false`. */
  private done = false;

  /**
   * Đẩy một khung vào đệm và đánh thức lượt kéo đang chờ.
   * Nhận: khung cần đẩy.
   * Trả: `true` nếu khung được nhận; `false` khi nguồn đã kết thúc.
   */
  push(frame: Frame): boolean {
    if (this.done) return false;
    this.buffer.pushBack(frame);
    this.waiter?.();
    return true;
  }

  /**
   * Kết thúc nguồn: từ chối MỌI dispatch còn trong đệm rồi đánh thức lượt kéo.
   * Nhận: lý do kết thúc (chuyển nguyên văn cho `reject` của dispatch).
   * Trả: không.
   */
  end(reason: unknown): void {
    if (this.done) return;
    this.done = true;
    while (this.buffer.size > 0) {
      const dispatch = this.buffer.popFront() as Frame;
      if ("context" in dispatch) dispatch.reject(reason);
    }
    this.waiter?.();
  }

  /**
   * Vòng kéo: nhả khung theo thứ tự, kết thúc khi nguồn đóng hoặc `signal` abort.
   * Nhận: `signal` — vòng đời nguồn; `cleanup` — hàm dọn chạy ĐÚNG MỘT lần ở `finally`.
   * Trả: AsyncIterable các khung.
   */
  async *iterate(signal: AbortSignal, cleanup: () => void): AsyncIterable<Frame> {
    const abort = (): void => {
      this.end(remoteEventSourceEndReason(signal));
    };
    signal.addEventListener("abort", abort, { once: true });
    try {
      while (true) {
        if (this.done || signal.aborted) return;
        while (this.buffer.size > 0) yield this.buffer.popFront() as Frame;
        await new Promise<void>((resolve) => {
          this.waiter = resolve;
        });
        this.waiter = undefined;
      }
    } finally {
      signal.removeEventListener("abort", abort);
      this.end(remoteEventSourceEndReason(signal));
      cleanup();
    }
  }
}

/**
 * Chuẩn hoá lý do đóng nguồn cho các waterfall đang chờ.
 * Nhận: `signal` — vòng đời nguồn.
 * Trả: lý do huỷ của `signal`, hoặc lỗi 'nguồn kết thúc bất ngờ'.
 */
export function remoteEventSourceEndReason(signal: AbortSignal): unknown {
  if (signal.aborted) return signal.reason;
  return new Error("api-remotes: forwarded Remote event source ended");
}

/**
 * Bắc cầu MỘT listener waterfall Cordis qua lượt chờ do Gateway sở hữu.
 * Nhận: `queue` — hàng đợi của nguồn; `event` — tên sự kiện; `request` — yêu cầu gốc; `context` — ngữ
 * cảnh dispatch; `next` — tiếp nối waterfall của Cordis.
 * Trả: promise của kết cục; hàng đợi đã đóng thì rơi thẳng về `next()`.
 */
export function forwardWaterfall<Frame extends ForwardedFrame>(
  queue: RemoteEventQueue<Frame>,
  event: string,
  request: WaterfallDispatchFrame["request"],
  context: WaterfallDispatchContext,
  next: () => unknown,
): Promise<unknown> {
  const settled = Promise.withResolvers<unknown>();
  const dispatch: WaterfallDispatchFrame = {
    event,
    request,
    context,
    resolve: (outcome) => {
      if (outcome.kind === "result") {
        settled.resolve(outcome.value);
        return;
      }
      Promise.resolve().then(next).then(settled.resolve, settled.reject);
    },
    reject: settled.reject,
  };
  if (!queue.push(dispatch as Frame)) Promise.resolve().then(next).then(settled.resolve, settled.reject);
  return settled.promise;
}

/**
 * Từ chối sự kiện allowlist có tham số KHÔNG phải dữ liệu JSON lossless.
 * Nhận: `event` — tên sự kiện; `args` — tham số nguyên văn của lượt phát.
 * Trả: chính `args` khi hợp lệ; ném lỗi nêu ĐÚNG chỉ số khi không.
 */
export function assertJsonArgs(event: string, args: readonly unknown[]): readonly unknown[] {
  for (const [index, arg] of args.entries()) {
    if (!isJsonValue(arg)) throw new Error(`forwarded host event "${event}" argument ${String(index)} is not lossless JSON data`);
  }
  return args;
}
