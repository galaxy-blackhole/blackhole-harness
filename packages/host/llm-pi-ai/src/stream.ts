/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng stream của @deepseek-ai/dsh-llm-pi-ai — port 1:1 lib/index.js dòng 1423–1653 (nguồn
 *      per-file: lib/types/stream.js): dịch event assistant của pi-ai thành StreamChunk của Harness
 *      (block-start/delta/block-end, usage, finish), giữ arguments tool-call ở dạng JSON thô và biến
 *      event lỗi cuối stream thành finish error/aborted.
 */

import {
  CONTEXT_WINDOW_EXCEEDED_CODE,
  EMPTY_RESPONSE_CODE,
  LlmError,
  QUOTA_EXCEEDED_CODE,
  isContextWindowExceededError,
  isQuotaExceededError,
} from "@deepseek-ai/dsh-llm";
import { brandString } from "@deepseek-ai/dsh-brand";
import { isContextOverflow } from "@earendil-works/pi-ai/utils/overflow";
import type { FinishReason, StreamChunk, TokenUsage, ToolCallId } from "@deepseek-ai/dsh-llm";
import type {
  AssistantMessage,
  AssistantMessageEvent,
  Usage as PiUsage,
} from "@earendil-works/pi-ai";
import { toPiReplayState } from "./replay.ts";

/**
 * pi-ai assistant event translation into the Harness streaming protocol.
 *
 * pi-ai tool-call arguments are parsed objects while the Harness keeps their
 * raw JSON representation. pi-ai also reports failures as terminal stream
 * events, which this module maps into Harness finish chunks.
 *
 * @module dsh-llm-pi-ai/stream
 */

/**
 * Map pi-ai usage (reasoning folded into output by pi-ai).
 * Nhận: usage — usage cộng dồn từ event cuối của pi-ai.
 * Trả: số đếm của harness với đúng total của pi-ai; trường cache chỉ xuất hiện khi khác 0
 *   (pi-ai báo 0 chứ không vắng mặt).
 */
export function mapUsage(usage: PiUsage): TokenUsage {
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    totalTokens: usage.totalTokens,
    ...(usage.cacheRead > 0 ? { cacheReadTokens: usage.cacheRead } : {}),
    ...(usage.cacheWrite > 0 ? { cacheWriteTokens: usage.cacheWrite } : {}),
  };
}

/** Classify one pi-ai failure text into the harness provider-neutral code set. */
function classifyPiAiError(message: string): string {
  if (/\b(?:401|403)\b/.test(message)) return "AUTH";
  if (isQuotaExceededError(message)) return QUOTA_EXCEEDED_CODE;
  if (/\b429\b|rate.?limit/i.test(message)) return "RATE_LIMIT";
  if (/\b413\b|failed to buffer the request body:\s*length limit exceeded|payload too large|request body too large/i.test(message)) return "INVALID_REQUEST";
  if (/\b400\b|invalid.?request/i.test(message)) return "INVALID_REQUEST";
  if (/\b5\d\d\b/.test(message)) return "SERVER";
  if (/\btime(?:d)?\s*out\b|timeout/i.test(message)) return "TIMEOUT";
  if (/stream ended (?:before|without)\b/i.test(message)) return "TRANSPORT";
  if (/\b(?:network|connection|socket|fetch)\b|\bECONN[A-Z]+\b/i.test(message) || /\b(?:other side closed|HTTP2 request did not get a response|WebSocket closed unexpectedly)\b/i.test(message) || /\bterminated\b|premature close/i.test(message)) return "TRANSPORT";
  return "PI_AI_ERROR";
}

/**
 * Map a terminal pi-ai event to the harness finish reason.
 * Nhận: message — assistant message mà event done hoặc error mang theo; contextWindow — sức chứa
 *   catalog đã phân giải, dùng để phát hiện overflow dựa trên usage.
 * Trả: lý do kết thúc của harness. Văn bản lỗi đã nhận diện, usage stop vượt contextWindow và
 *   usage length không có output lấp đầy cửa sổ đều map sang CONTEXT_WINDOW_EXCEEDED; stop không
 *   có block nội dung nào map sang lỗi EMPTY_RESPONSE, còn trạng thái pending và deferred cuối
 *   stream map sang PI_AI_ERROR không thử lại.
 */
export function mapStopReason(message: AssistantMessage, contextWindow?: number): FinishReason {
  const piAiOverflow = isContextOverflow(message, contextWindow);
  const harnessOverflow = message.stopReason === "error" && message.errorMessage !== void 0 && isContextWindowExceededError(message.errorMessage);
  if (piAiOverflow || harnessOverflow) return {
    kind: "error",
    failure: {
      message: message.errorMessage ?? `pi-ai detected context overflow for model "${message.model}"`,
      code: CONTEXT_WINDOW_EXCEEDED_CODE,
    },
  };
  switch (message.stopReason) {
    case "stop":
      if (message.content.length === 0) return {
        kind: "error",
        failure: {
          message: `model "${message.model}" returned a completed response with no content`,
          code: EMPTY_RESPONSE_CODE,
        },
      };
      return { kind: "stop" };
    case "length": return { kind: "max-tokens" };
    case "toolUse": return { kind: "tool-calls" };
    case "pending": return {
      kind: "error",
      failure: {
        message: `pi-ai stream for model "${message.model}" ended pending`,
        code: "PI_AI_ERROR",
      },
    };
    case "deferred": return {
      kind: "error",
      failure: {
        message: `pi-ai deferred response for model "${message.model}" is not supported`,
        code: "PI_AI_ERROR",
      },
    };
    case "aborted": return {
      kind: "aborted",
      failure: {
        message: message.errorMessage ?? "pi-ai stream aborted",
        code: "ABORTED",
      },
    };
    case "error": {
      const text = message.errorMessage ?? "pi-ai stream error";
      return {
        kind: "error",
        failure: {
          message: text,
          code: classifyPiAiError(text),
        },
      };
    }
  }
}

/**
 * Translate the pi-ai event stream into StreamChunks. pi-ai never throws
 * mid-stream — failures arrive as error events, which become error/aborted
 * finish chunks (the harness protocol's other error-delivery style).
 * Nhận: events — event stream của một lượt assistant từ pi-ai; contextWindow — sức chứa catalog
 *   đã phân giải; callerSignal — trạng thái huỷ của caller (caller đã huỷ thì mọi lỗi cuối
 *   stream đều thành finish aborted); requestedModel — danh tính model của request, ghi cho replay.
 * Trả: các chunk của harness, kết thúc bằng usage rồi finish.
 * @throws {LlmError} STREAM_CLOSED khi nguồn kết thúc mà không có event cuối (done/error).
 */
export async function* toStreamChunks(
  events: AsyncIterable<AssistantMessageEvent>,
  contextWindow?: number,
  callerSignal?: AbortSignal,
  requestedModel?: string,
): AsyncGenerator<StreamChunk> {
  const toolIds = new Map<number, { id: string; name: string }>();
  for await (const event of events) switch (event.type) {
    case "start": break;
    case "text_start":
      yield {
        type: "block-start",
        index: event.contentIndex,
        blockType: "text",
      };
      break;
    case "text_delta":
      yield {
        type: "text-delta",
        index: event.contentIndex,
        text: event.delta,
      };
      break;
    case "text_end":
      yield {
        type: "block-end",
        index: event.contentIndex,
        block: {
          type: "text",
          text: event.content,
        },
      };
      break;
    case "thinking_start":
      yield {
        type: "block-start",
        index: event.contentIndex,
        blockType: "reasoning",
      };
      break;
    case "thinking_delta":
      yield {
        type: "reasoning-delta",
        index: event.contentIndex,
        text: event.delta,
      };
      break;
    case "thinking_end":
      yield {
        type: "block-end",
        index: event.contentIndex,
        block: {
          type: "reasoning",
          text: event.content,
        },
      };
      break;
    case "toolcall_start": {
      const partial = event.partial.content[event.contentIndex];
      const id = partial?.type === "toolCall" ? partial.id : "";
      const name = partial?.type === "toolCall" ? partial.name : "";
      toolIds.set(event.contentIndex, {
        id,
        name,
      });
      yield {
        type: "block-start",
        index: event.contentIndex,
        blockType: "tool-call",
      };
      break;
    }
    case "toolcall_delta": {
      const known = toolIds.get(event.contentIndex);
      yield {
        type: "tool-call-delta",
        index: event.contentIndex,
        id: brandString<ToolCallId>(known?.id ?? ""),
        ...(known?.name !== void 0 && known.name.length > 0 ? { name: known.name } : {}),
        argumentsDelta: event.delta,
      };
      break;
    }
    case "toolcall_end":
      yield {
        type: "block-end",
        index: event.contentIndex,
        block: {
          type: "tool-call",
          id: brandString<ToolCallId>(event.toolCall.id),
          name: event.toolCall.name,
          arguments: JSON.stringify(event.toolCall.arguments),
        },
      };
      break;
    case "done":
      yield {
        type: "usage",
        usage: mapUsage(event.message.usage),
      };
      yield {
        type: "finish",
        reason: mapStopReason(event.message, contextWindow),
        replayState: toPiReplayState(event.message, requestedModel),
      };
      return;
    case "error":
      yield {
        type: "usage",
        usage: mapUsage(event.error.usage),
      };
      yield {
        type: "finish",
        reason: mapStopReason(callerSignal?.aborted ? {
          ...event.error,
          stopReason: "aborted",
        } : event.error, contextWindow),
      };
      return;
  }
  throw new LlmError("pi-ai event stream ended without done/error", "STREAM_CLOSED");
}
