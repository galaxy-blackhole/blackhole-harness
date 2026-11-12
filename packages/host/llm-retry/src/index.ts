/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chính sách thử lại request LLM theo provider, trên điểm mở rộng phục hồi của vòng agent.
 *      Mỗi lần thử lại được ghi BỀN trước khi chờ huỷ được. Bản viết lại của Galaxy Blackhole cho
 *      row llm-retry (@galaxy-blackhole/gbh-llm-retry) — nguồn đối chiếu: xem README.md của package (G4).
 */

import { randomUUID } from "node:crypto";
import z from "@deepseek-ai/schemastery";
import { z as zod } from "zod/v4";
import { RetryId } from "./brand.ts";
import { cancellableDelay, localDelay, retryPolicyKey, retryStateKey, settleDownstream } from "./policy.ts";
import type {
  LlmRetryEventData,
  LlmRetrySessionEvent,
  RequestErrorAction,
  RequestErrorNext,
  RequestErrorPayload,
  ResolvedRetryPolicy,
  RetryAgent,
} from "./types.ts";

export { RetryId };
export type {
  LlmFailure,
  LlmRetryEventData,
  LlmRetrySessionEvent,
  LlmRetryStartedEventData,
  RequestErrorAction,
  RequestErrorNext,
  RequestErrorPayload,
  ResolvedAlwaysRetryPolicy,
  ResolvedNormalRetryPolicy,
  ResolvedRetryBackoff,
  ResolvedRetryPolicy,
  RetryAgent,
  RetrySession,
} from "./types.ts";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "llm-retry";

/** Service bắt buộc: sổ agent (`agents`) và sổ chiếu phiên (`sessionProjections`). */
export const inject: string[] = ["agents", "sessionProjections"];

/** Bộ thi hành này không có cấu hình; chính sách `retryPolicy` thuộc về TỪNG provider. */
export type Config = Readonly<Record<string, never>>;

/** Schema cấu hình lúc chạy cho {@link Config}: rỗng, để Settings/config-editor render được field. */
export const Config: z<Config> = z.object({}) as unknown as z<Config>;

/** Hook phi tuần tự hoá để thời gian hoá chính sách TẤT ĐỊNH trong test. */
export interface RetryInternals {
  /** Mẫu ngẫu nhiên trong khoảng [0, 1] dùng cho jitter. */
  random?: () => number;
}

/** Một mục trạng thái chiếu: lần thử hiện tại và danh tính chuỗi thử lại của nó. */
interface RetryStateEntry {
  /** Số thứ tự lần thử lại đã định tuyến cho cặp (provider, chính sách) này. */
  retry: number;
  /** Danh tính dùng chung cho mọi lần thử của chuỗi đó. */
  retryId: RetryId;
}

/** Trạng thái chiếu `llmRetry`: khoá theo cặp (provider, khoá chính sách). */
export type LlmRetryProjectionState = Record<string, RetryStateEntry>;

/**
 * Schema trạng thái đã lưu: seam sessionProjections CHỈ gọi `parse` để kiểm dòng cache trước khi
 * mồi phép gộp (đo trong `dsh-session-projection/lib/index.js`), nên khai đúng phần đó.
 */
interface StateSchema<T> {
  /** Kiểm và chuẩn hoá một giá trị đã lưu; ném khi không hợp lệ. */
  parse(value: unknown): T;
}

/**
 * Schema zod của trạng thái chiếu — giữ ĐÚNG hình dạng bản gốc khai:
 * bản ghi khoá-chuỗi của `{ retry: số nguyên không âm, retryId: chuỗi }`.
 */
const llmRetryStateSchema = zod.record(
  zod.string(),
  zod.object({ retry: zod.number().int().nonnegative(), retryId: zod.string() }),
) as unknown as StateSchema<LlmRetryProjectionState>;

/** Một định nghĩa đơn vị chiếu host-only mà seam sessionProjections nhận. */
export interface SessionProjectionDefinition {
  /** Khoá chiếu; bản gốc dùng `llmRetry`. */
  readonly key: string;
  /** Phiên bản trạng thái lưu; đổi ngữ nghĩa gộp thì phải tăng. */
  readonly stateVersion: number;
  /** Schema kiểm trạng thái đã lưu trước khi mồi phép gộp. */
  readonly stateSchema: StateSchema<LlmRetryProjectionState>;
  /** Trạng thái cho log rỗng và metadata phiên. */
  init(header: unknown, inheritedEventCount: number): LlmRetryProjectionState;
  /** Phép gộp THUẦN: trạng thái trước + một sự kiện ⇒ trạng thái sau (giữ nguyên tham chiếu nếu không đổi). */
  apply(state: LlmRetryProjectionState, event: LlmRetrySessionEvent): LlmRetryProjectionState;
}

/** Seam `sessionProjections`: nơi row đăng ký bộ chiếu và đọc trạng thái hiện tại của nó. */
export interface SessionProjectionSeam {
  /** Đăng ký một đơn vị chiếu host-only; trả hàm gỡ đăng ký. */
  register(definition: SessionProjectionDefinition): () => void;
  /** Đọc trạng thái hiện tại của một khoá chiếu cho một phiên. */
  stateOf(session: unknown, key: string): LlmRetryProjectionState;
}

/** Log của kernel — chỉ phần bộ điều phối này dùng. */
export interface RetryLogger {
  /** Ghi cảnh báo, kèm tham số định dạng kiểu `%o` như bản gốc. */
  warn(message: string, ...args: unknown[]): void;
}

/** Context cordis mà plugin này dùng, khai theo CẤU TRÚC: bốn seam, không import gói seam nào. */
export interface RetryContext {
  /** Sổ chiếu phiên: nơi trạng thái thử lại theo provider được đăng ký và đọc. */
  readonly sessionProjections: SessionProjectionSeam;
  /** Log của kernel. */
  readonly logger: RetryLogger;
  /** Đăng ký listener cho waterfall `agent/request-error`; trả hàm gỡ đăng ký. */
  on(
    event: "agent/request-error",
    listener: (payload: RequestErrorPayload, next: RequestErrorNext) => Promise<RequestErrorAction>,
  ): () => void;
  /** Chạy một hiệu ứng có hàm dọn; cordis gọi hàm dọn khi plugin unload. */
  effect(callback: () => () => Promise<void>, label?: string): unknown;
}

/**
 * Kiểm cấu hình của bộ thi hành: rỗng mới hợp lệ, vì `retryPolicy` thuộc về cấu hình TỪNG provider.
 * Nhận: cấu hình đã qua schema.
 * Trả: không; ném lỗi nêu đúng khoá sai đầu tiên khi cấu hình có trường.
 */
function validateConfig(config: Config): void {
  const [key] = Object.keys(config);
  if (key === undefined) return;
  if (key === "retryPolicy") throw new Error("llm-retry: retryPolicy belongs under each provider configuration");
  throw new Error(`llm-retry: unknown key "${key}"`);
}

/**
 * Cài đặt phục hồi request theo provider, chế độ hữu hạn (`normal`) hoặc không giới hạn (`always`).
 * Nhận: context cordis sở hữu listener và các lượt chờ đang chạy, cấu hình rỗng, và hook tất định.
 * Trả: không; đăng ký bộ chiếu `llmRetry`, một listener waterfall, và một hiệu ứng dọn dẹp.
 */
export function apply(ctx: RetryContext, config: Config = {}, internals: RetryInternals = {}): void {
  validateConfig(config);
  ctx.sessionProjections.register({
    key: "llmRetry",
    stateVersion: 1,
    stateSchema: llmRetryStateSchema,
    init: () => ({}),
    apply: (state, event) => {
      // Ranh giới bước/lượt mở một chuỗi thử lại mới: trả object MỚI để hạ nguồn thấy có thay đổi.
      if (event.type === "step/start" || event.type === "turn/end") return {};
      if (event.type !== "llm/retry") return state;
      const key = retryStateKey(event.data.provider, event.data.policyKey);
      const entry = state[key];
      if (entry?.retry === event.data.retry && entry.retryId === event.data.retryId) return state;
      return {
        ...state,
        [key]: { retry: event.data.retry, retryId: event.data.retryId },
      };
    },
  });
  const random = internals.random ?? Math.random;
  /** Vòng đời của bản cài: huỷ khi plugin bị gỡ, để mọi lượt chờ đang chạy thoát ra. */
  const lifetime = new AbortController();
  /** Các lượt phục hồi đang chạy, để hàm dọn chờ chúng lặng hẳn. */
  const active = new Set<Promise<unknown>>();

  /**
   * Theo dõi một lượt phục hồi đang chạy.
   * Nhận: promise của lượt phục hồi.
   * Trả: chính promise đó, đã nằm trong tập đang chạy cho tới khi kết thúc.
   */
  function track(operation: Promise<RequestErrorAction>): Promise<RequestErrorAction> {
    const tracked = operation.finally(() => active.delete(tracked));
    active.add(tracked);
    return tracked;
  }

  /**
   * Ghi bền lần thử lại đã lên lịch, chờ huỷ được, rồi ghi chuyển tiếp trước khi trả quyền thử lại.
   * Nhận: agent, vị trí (lượt, bước), sự thật hỏng, provider, chính sách cùng khoá của nó, số thứ tự
   * lần thử, danh tính chuỗi, độ trễ đã lên lịch, và tín hiệu huỷ của lượt.
   * Trả: `{ kind: "retry" }` khi chờ trọn vẹn, hoặc `undefined` khi bị huỷ giữa đường.
   */
  async function backoff(
    agent: RetryAgent,
    turn: number,
    step: number,
    failure: LlmRetryEventData["failure"],
    provider: string,
    policy: ResolvedRetryPolicy,
    policyKey: string,
    retry: number,
    retryId: RetryId,
    delayMs: number,
    signal: AbortSignal,
  ): Promise<RequestErrorAction> {
    const fusedSignal = AbortSignal.any([signal, lifetime.signal]);
    if (fusedSignal.aborted) return;
    const eventData: LlmRetryEventData =
      policy.mode === "normal"
        ? { retryId, turn, step, provider, mode: policy.mode, policyKey, retry, maxRetries: policy.maxRetries, delayMs, failure }
        : { retryId, turn, step, provider, mode: policy.mode, policyKey, retry, delayMs, failure };
    agent.session.append("llm/retry", eventData);
    if (!(await cancellableDelay(delayMs, fusedSignal))) return;
    agent.session.append("llm/retry-started", { retryId, turn, step, retry });
    return { kind: "retry" };
  }

  /**
   * Quyết định một lần hỏng request: gọi tầng dưới, kiểm điều kiện và ngân sách, tính độ trễ, rồi chờ.
   * Nhận: payload waterfall (agent, lượt, bước, provider, hỏng hóc, chính sách, tín hiệu) và hàm gọi tiếp.
   * Trả: quyết định của tầng dưới, `{ kind: "retry" }` khi chính sách nhận lượt phục hồi, hoặc `undefined`.
   */
  async function recover(
    { agent, turn, step, provider, failure, retryPolicy: policy, signal }: RequestErrorPayload,
    next: RequestErrorNext,
  ): Promise<RequestErrorAction> {
    if (policy === undefined) return next();
    if (policy.mode === "always") {
      // Chế độ không giới hạn hỏi tầng dưới TRƯỚC: một chính sách hạ nguồn nhận phục hồi thì ta nhường.
      if (signal.aborted || lifetime.signal.aborted) return;
      const fusedSignal = AbortSignal.any([signal, lifetime.signal]);
      const downstream = await settleDownstream(next);
      if (fusedSignal.aborted) return;
      if (downstream.type === "error") {
        ctx.logger.warn(
          `llm-retry: provider "${provider}" always policy ignored a downstream recovery failure: %o`,
          downstream.error,
        );
      }
      if (downstream.type === "decision" && downstream.decision?.kind === "retry") return downstream.decision;
    } else if (!policy.retryableCodes.includes(failure.code)) return next();
    const policyKey = retryPolicyKey(policy);
    const previous = ctx.sessionProjections.stateOf(agent.session, "llmRetry")[retryStateKey(provider, policyKey)];
    const previousRetry = previous?.retry ?? 0;
    if (policy.mode === "normal" && previousRetry >= policy.maxRetries) return next();
    const retry = previousRetry + 1;
    const retryId = previous?.retryId ?? RetryId(randomUUID());
    let delayMs: number;
    if (failure.providerRetryAfterMs !== undefined && Number.isFinite(failure.providerRetryAfterMs) && failure.providerRetryAfterMs > 0) {
      if (failure.providerRetryAfterMs > policy.maxDelayMs) {
        // Provider đòi chờ quá trần chính sách: chế độ hữu hạn nhường, chế độ vô hạn dùng backoff cục bộ.
        if (policy.mode === "normal") return next();
        delayMs = localDelay(policy, retry, random);
      } else delayMs = failure.providerRetryAfterMs;
    } else delayMs = localDelay(policy, retry, random);
    return backoff(agent, turn, step, failure, provider, policy, policyKey, retry, retryId, delayMs, signal);
  }

  const disposeListener = ctx.on("agent/request-error", (payload, next) => {
    if (lifetime.signal.aborted) return Promise.resolve(undefined);
    return track(recover(payload, next));
  });
  ctx.effect(() => async () => {
    disposeListener();
    lifetime.abort(new Error("llm-retry plugin disposed"));
    await Promise.allSettled([...active]);
  }, "llm-retry: abort and drain active recovery");
}
