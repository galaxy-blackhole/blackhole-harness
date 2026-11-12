/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Gộp vòng đời attempt bền của MỘT lượt thành số token chính xác — bản viết lại 1:1
 *      `lib/types/turn-usage.js` của `@deepseek-ai/dsh-token-meter`, chỉ dịch chú thích.
 */

import type { AssistantMessage, AssistantStreamRecord, TokenUsage } from "@deepseek-ai/dsh-llm";
import { lastAssistantStreamChunk } from "@deepseek-ai/dsh-llm/assistant-stream";
import type { SessionEvent } from "@galaxy-blackhole/gbh-session/types";
// Nạp augmentation của plugin retry để SessionEventMap có `llm/retry` + `llm/retry-started` (chỉ kiểu, không phát sinh import runtime).
import type {} from "@deepseek-ai/dsh-llm-retry/types";

/** Một tuyến provider/model đã đóng góp một lần thử được tính tiền. */
export interface TurnTokenUsageRoute {
  /** Provider đã phục vụ lần thử. */
  readonly provider: string;
  /** Model đã phục vụ lần thử. */
  readonly model: string;
}

/** Số token CHÍNH XÁC do provider báo cáo cho mọi lần thử của một lượt đã hoàn tất. */
export interface TurnTokenUsage {
  /** Tổng token đầu vào KHÔNG cache trên mọi lần thử. */
  readonly uncachedInputTokens: number;
  /** Tổng token đầu ra trên mọi lần thử. */
  readonly outputTokens: number;
  /** Tổng chính xác của prompt cộng đầu ra trên mọi lần thử. */
  readonly totalTokens: number;
  /** Chỉ có mặt khi MỌI lần thử đều báo ô này. */
  readonly cacheReadTokens?: number;
  /** Chỉ có mặt khi MỌI lần thử đều báo ô này. */
  readonly cacheWriteTokens?: number;
  /** Tập con của đầu ra, chỉ có mặt khi MỌI lần thử đều báo ô này. */
  readonly reasoningTokens?: number;
  /** Chỉ có mặt khi MỌI lần thử được tính tiền đều có quy thuộc provider/model. */
  readonly routes?: readonly TurnTokenUsageRoute[];
}

/** Máy trạng thái của MỘT lượt trong lúc gộp vòng đời attempt. */
type TurnUsageState =
  | { readonly kind: "idle" }
  | { readonly kind: "open"; readonly turn: number; readonly step: number; readonly sample?: TokenUsage }
  | { readonly kind: "settled"; readonly turn: number; readonly step: number; readonly by: "message" | "retry" }
  | { readonly kind: "finishClosed"; readonly turn: number; readonly step: number };

/** Trạng thái đã rời `idle` (luôn mang turn/step) — dùng cho phép so khớp attempt. */
type AttemptBoundState = Exclude<TurnUsageState, { readonly kind: "idle" }>;

/** Một attempt đã chuẩn hoá: usage của provider, kèm tuyến nếu tin nhắn khai được. */
type NormalizedAttempt = {
  /** Token đầu vào không cache của lần thử. */
  readonly inputTokens: number;
  /** Token đầu ra của lần thử. */
  readonly outputTokens: number;
  /** Tổng chính xác prompt cộng đầu ra của lần thử. */
  readonly totalTokens: number;
  /** Ô cache đọc, chỉ có mặt khi provider báo. */
  readonly cacheReadTokens?: number;
  /** Ô cache ghi, chỉ có mặt khi provider báo. */
  readonly cacheWriteTokens?: number;
  /** Tập con reasoning của đầu ra, chỉ có mặt khi provider báo. */
  readonly reasoningTokens?: number;
  /** Tuyến provider/model của lần thử, khi tin nhắn khai được. */
  readonly route?: TurnTokenUsageRoute;
};

/**
 * Kiểm một giá trị có phải số đếm token an toàn hay không.
 * Nhận: giá trị bất kỳ đọc từ usage của provider.
 * Trả: `true` khi giá trị là số nguyên an toàn và không âm.
 */
function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Cộng các số đếm mà không bao giờ trả tổng đã tràn độ chính xác.
 * Nhận: dãy số đếm.
 * Trả: tổng an toàn, hoặc `undefined` ngay khi tổng vượt số nguyên an toàn.
 */
function safeSum(values: readonly number[]): number | undefined {
  let total = 0;
  for (const value of values) {
    total += value;
    if (!Number.isSafeInteger(total)) return undefined;
  }
  return total;
}

/**
 * Đọc tuyến provider/model từ nguồn của tin nhắn assistant.
 * Nhận: tin nhắn assistant đã gộp.
 * Trả: tuyến khi CẢ provider lẫn model đều không rỗng; ngược lại `undefined`.
 */
function messageRoute(message: AssistantMessage): TurnTokenUsageRoute | undefined {
  const { provider, model } = message.source;
  return provider.length > 0 && model.length > 0 ? { provider, model } : undefined;
}

/**
 * Lấy usage của chunk `usage` CUỐI CÙNG trong stream của một lần thử.
 * Nhận: các bản ghi stream nén của lần thử.
 * Trả: usage do provider báo, hoặc `undefined` khi stream không có chunk usage.
 */
function streamUsage(stream: readonly AssistantStreamRecord[]): TokenUsage | undefined {
  return lastAssistantStreamChunk(stream, "usage")?.usage;
}

/**
 * Chuẩn hoá usage của MỘT lần thử thành số đếm chính xác.
 * Nhận: usage do provider báo và tuyến của tin nhắn (nếu đọc được).
 * Trả: attempt đã chuẩn hoá; `undefined` khi có số đếm không an toàn, thiếu ô bắt buộc, hoặc tổng mâu thuẫn.
 */
function normalizeUsage(usage: TokenUsage, route?: TurnTokenUsageRoute): NormalizedAttempt | undefined {
  const {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    reasoningTokens,
    totalTokens,
  } = usage;
  if (!isCount(inputTokens) || !isCount(outputTokens)) return undefined;
  if (cacheReadTokens !== undefined && !isCount(cacheReadTokens)) return undefined;
  if (cacheWriteTokens !== undefined && !isCount(cacheWriteTokens)) return undefined;
  if (reasoningTokens !== undefined && (!isCount(reasoningTokens) || reasoningTokens > outputTokens)) {
    return undefined;
  }
  const knownPrompt = safeSum([
    inputTokens,
    ...(cacheReadTokens === undefined ? [] : [cacheReadTokens]),
    ...(cacheWriteTokens === undefined ? [] : [cacheWriteTokens]),
  ]);
  if (knownPrompt === undefined) return undefined;
  let exactTotal: number;
  if (totalTokens !== undefined) {
    if (!isCount(totalTokens)) return undefined;
    const exactPrompt = totalTokens - outputTokens;
    if (!isCount(exactPrompt) || exactPrompt < knownPrompt) return undefined;
    if (cacheReadTokens !== undefined && cacheWriteTokens !== undefined && exactPrompt !== knownPrompt) {
      return undefined;
    }
    exactTotal = totalTokens;
  } else {
    if (cacheReadTokens === undefined || cacheWriteTokens === undefined) return undefined;
    const derivedTotal = safeSum([knownPrompt, outputTokens]);
    if (derivedTotal === undefined) return undefined;
    exactTotal = derivedTotal;
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens: exactTotal,
    ...(cacheReadTokens === undefined ? {} : { cacheReadTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
    ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
    ...(route === undefined ? {} : { route }),
  };
}

/**
 * Gộp các attempt đã chuẩn hoá thành tổng token của cả lượt.
 * Nhận: danh sách attempt theo đúng thứ tự đã đóng.
 * Trả: tổng chính xác (ô tuỳ chọn chỉ có mặt khi MỌI attempt đều có); `undefined` khi rỗng hoặc tổng tràn an toàn.
 */
function aggregateAttempts(attempts: readonly NormalizedAttempt[]): TurnTokenUsage | undefined {
  if (attempts.length === 0) return undefined;
  const inputTokens = safeSum(attempts.map((attempt) => attempt.inputTokens));
  const outputTokens = safeSum(attempts.map((attempt) => attempt.outputTokens));
  const totalTokens = safeSum(attempts.map((attempt) => attempt.totalTokens));
  if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined) return undefined;
  const cacheRead = attempts.map((attempt) => attempt.cacheReadTokens);
  const cacheWrite = attempts.map((attempt) => attempt.cacheWriteTokens);
  const reasoning = attempts.map((attempt) => attempt.reasoningTokens);
  const cacheReadTokens = cacheRead.every(isCount) ? safeSum(cacheRead) : undefined;
  const cacheWriteTokens = cacheWrite.every(isCount) ? safeSum(cacheWrite) : undefined;
  const reasoningTokens = reasoning.every(isCount) ? safeSum(reasoning) : undefined;
  // Ô cache có mặt bị chặn trên bởi prompt chính xác, reasoning bị chặn trên bởi đầu ra.
  // Vì vậy tổng bắt buộc an toàn suy ra tổng tuỳ chọn cũng an toàn.
  let routes: TurnTokenUsageRoute[] | undefined;
  const attributed = attempts.map((attempt) => attempt.route);
  if (attributed.every((route): route is TurnTokenUsageRoute => route !== undefined)) {
    const unique = new Map<string, TurnTokenUsageRoute>();
    for (const route of attributed) unique.set(`${route.provider}\0${route.model}`, route);
    routes = [...unique.values()];
  }
  return {
    uncachedInputTokens: inputTokens,
    outputTokens,
    totalTokens,
    ...(cacheReadTokens === undefined ? {} : { cacheReadTokens }),
    ...(cacheWriteTokens === undefined ? {} : { cacheWriteTokens }),
    ...(reasoningTokens === undefined ? {} : { reasoningTokens }),
    ...(routes === undefined ? {} : { routes }),
  };
}

/**
 * Cho biết một trạng thái đã mở có đúng là attempt của cặp (turn, step) đang xét hay không.
 * Nhận: trạng thái KHÔNG `idle`, số lượt và số bước cần so.
 * Trả: `true` khi cả turn lẫn step đều khớp.
 */
function sameAttempt(state: AttemptBoundState, turn: number, step: number): boolean {
  return state.turn === turn && state.step === step;
}

/**
 * Gộp vòng đời attempt bền của MỘT lượt đã hoàn tất thành số token chính xác.
 *
 * Không attempt nào được suy ra từ một mẫu usage. Mọi ranh giới vòng đời bị thiếu,
 * usage attempt không đầy đủ, số đếm không an toàn, hoặc tổng chính xác mâu thuẫn
 * đều làm TOÀN BỘ kết quả không khả dụng.
 * Nhận: các sự kiện bền cục bộ của lượt, từ `turn/start` đến `turn/end`.
 * Trả: usage tổng hợp chính xác, hoặc `undefined` khi không thể chứng minh.
 */
export function deriveTurnTokenUsage(events: readonly SessionEvent[]): TurnTokenUsage | undefined {
  let state: TurnUsageState = { kind: "idle" };
  const attempts: NormalizedAttempt[] = [];
  let turn: number | undefined;
  let sawEnd = false;
  let invalid = false;
  const closeOpen = (route?: TurnTokenUsageRoute): boolean => {
    if (state.kind !== "open" || state.sample === undefined) return false;
    const normalized = normalizeUsage(state.sample, route);
    if (normalized === undefined) return false;
    attempts.push(normalized);
    return true;
  };
  for (const event of events) {
    if (invalid) break;
    if (event.type === "turn/start") {
      if (turn !== undefined || state.kind !== "idle") invalid = true;
      else turn = event.data.turn;
      continue;
    }
    if (turn === undefined) {
      invalid = true;
      break;
    }
    if (event.type === "turn/end") {
      if (event.data.turn !== turn || state.kind !== "idle" || sawEnd) invalid = true;
      else sawEnd = true;
      continue;
    }
    if (sawEnd) {
      invalid = true;
      break;
    }
    if (event.type === "step/start") {
      if (event.data.turn !== turn || state.kind !== "idle") invalid = true;
      else state = { kind: "open", turn, step: event.data.step };
      continue;
    }
    if (event.type === "llm/retry-started") {
      if (
        event.data.turn !== turn ||
        state.kind !== "settled" ||
        state.by !== "retry" ||
        !sameAttempt(state, event.data.turn, event.data.step)
      )
        invalid = true;
      else state = { kind: "open", turn, step: event.data.step };
      continue;
    }
    if (event.type === "assistant/attempt") {
      if (
        event.data.turn !== turn ||
        state.kind !== "open" ||
        !sameAttempt(state, event.data.turn, event.data.step)
      ) {
        invalid = true;
        continue;
      }
      const sample: TokenUsage | undefined = streamUsage(event.data.stream) ?? state.sample;
      state = { kind: "open", turn, step: event.data.step, ...(sample === undefined ? {} : { sample }) };
      if (!closeOpen()) invalid = true;
      else state = { kind: "finishClosed", turn, step: event.data.step };
      continue;
    }
    if (event.type === "assistant/message") {
      if (
        event.data.turn !== turn ||
        state.kind !== "open" ||
        !sameAttempt(state, event.data.turn, event.data.step)
      ) {
        invalid = true;
        continue;
      }
      const sample = event.data.usage ?? streamUsage(event.data.stream);
      if (sample !== undefined) state = { ...state, sample };
      if (!closeOpen(messageRoute(event.data.message))) invalid = true;
      else state = { kind: "settled", turn, step: event.data.step, by: "message" };
      continue;
    }
    if (event.type === "llm/retry") {
      if (
        event.data.turn !== turn ||
        state.kind === "idle" ||
        !sameAttempt(state, event.data.turn, event.data.step)
      ) {
        invalid = true;
        continue;
      }
      if (state.kind === "settled" || (state.kind === "open" && !closeOpen())) invalid = true;
      if (!invalid) state = { kind: "settled", turn, step: event.data.step, by: "retry" };
      continue;
    }
    if (event.type === "step/end") {
      if (
        event.data.turn !== turn ||
        state.kind === "idle" ||
        !sameAttempt(state, event.data.turn, event.data.step)
      ) {
        invalid = true;
        continue;
      }
      if (state.kind === "open" && !closeOpen()) invalid = true;
      if (!invalid) state = { kind: "idle" };
    }
  }
  return invalid || !sawEnd || state.kind !== "idle" ? undefined : aggregateAttempts(attempts);
}
