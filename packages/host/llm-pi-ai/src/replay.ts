/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng replay của @deepseek-ai/dsh-llm-pi-ai — port 1:1 lib/index.js dòng 17–254 (nguồn
 *      per-file: lib/types/replay.js): metadata replay bền vững của pi-ai và việc dựng lại lịch sử
 *      assistant. Nội dung Harness vẫn là nguồn bền cho text và tool call; module chỉ giữ metadata
 *      gốc-provider cần để dựng lại một assistant message pi-ai ở request sau, và hạ cấp MỘT
 *      message có replay state không dùng được thay vì làm hỏng cả request.
 */

import { LlmError } from "@deepseek-ai/dsh-llm";
import type { AssistantMessage as HarnessAssistantMessage, ReplayEnvelope } from "@deepseek-ai/dsh-llm";
import type {
  Api,
  AssistantMessage,
  JsonObject,
  TextContent,
  ThinkingContent,
  ToolCall,
  Usage,
} from "@earendil-works/pi-ai";

/**
 * Durable pi-ai replay metadata and assistant-history reconstruction.
 *
 * Harness content remains the durable source for text and tool calls. This
 * module stores only the provider-native metadata needed to reconstruct a
 * pi-ai assistant message on a later request.
 *
 * @module dsh-llm-pi-ai/replay
 */

/**
 * Per-block half of the pi-ai replay envelope, one entry per content block.
 * Nhận: hình dạng một mục cho mỗi khối nội dung pi-ai phát ra, đúng thứ tự khối của stream.
 * Trả: kiểu chữ ký/nhãn riêng-provider của khối text · reasoning · tool-call.
 */
export type PiAiReplayBlock =
  | {
      type: "text";
      textSignature?: string;
    }
  | {
      type: "reasoning";
      thinkingSignature?: string;
      redacted?: boolean;
    }
  | {
      type: "tool-call";
      thoughtSignature?: string;
      namespace?: string;
    };

/**
 * Versioned response-level half of the pi-ai replay envelope.
 * Nhận: hình dạng `response` mà adapter tự ghi vào envelope replay bền vững.
 * Trả: kiểu đã kiểm để `replayedAssistant` đọc lại và dựng assistant message pi-ai.
 */
export interface PiAiReplayResponse {
  kind: "pi-ai";
  version: 2;
  api: Api;
  provider: string;
  /** Requested model identity, matching the durable assistant source. */
  model: string;
  /** Provider-reported model; replay retains the requested model for signature matching. */
  responseModel?: string;
  responseId?: string;
  /** Provider-native effort for historical replay; absence is preserved. */
  providerThinkingLevel?: string;
  stopReason: AssistantMessage["stopReason"];
}

/**
 * Parse tool-call argument JSON; tolerate model malformations with {}.
 * Nhận: raw — chuỗi JSON tham số do model sinh (có thể hỏng).
 * Trả: object JSON đã parse, hoặc {} khi JSON hỏng/không phải object.
 */
function parseArguments(raw: string): JsonObject {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed as JsonObject;
  } catch {}
  return {};
}

/**
 * Construct the zero usage value required by historical pi-ai messages.
 * Nhận: không.
 * Trả: Usage toàn số 0 (kể cả cost) cho message lịch sử không còn số liệu token.
 */
function emptyPiUsage(): Usage {
  return {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 0,
    },
  };
}

/**
 * Project a successful pi-ai response into the minimal durable replay state.
 * The per-block half is index-aligned with the streamed blocks (pi-ai content
 * order), so `BlockAssembler` prunes an entry with its block whenever assembly
 * removes one.
 * Nhận: message — phản hồi assistant pi-ai đã hoàn tất; requestedModel — danh tính model của
 *   request lưu trong source assistant (mặc định là `message.model`).
 * Trả: projection replay lossless-JSON có phiên bản (version 2).
 */
export function toPiReplayState(message: AssistantMessage, requestedModel: string = message.model): ReplayEnvelope {
  return {
    response: {
      kind: "pi-ai",
      version: 2,
      api: message.api,
      provider: message.provider,
      model: requestedModel,
      ...message.responseModel === void 0 ? {} : { responseModel: message.responseModel },
      ...message.responseId === void 0 ? {} : { responseId: message.responseId },
      ...message.providerThinkingLevel === void 0 ? {} : { providerThinkingLevel: message.providerThinkingLevel },
      stopReason: message.stopReason,
    },
    blocks: message.content.map((block) => {
      switch (block.type) {
        case "text": return {
          type: "text",
          ...block.textSignature === void 0 ? {} : { textSignature: block.textSignature },
        };
        case "thinking": return {
          type: "reasoning",
          ...block.thinkingSignature === void 0 ? {} : { thinkingSignature: block.thinkingSignature },
          ...block.redacted === void 0 ? {} : { redacted: block.redacted },
        };
        case "toolCall": return {
          type: "tool-call",
          ...block.thoughtSignature === void 0 ? {} : { thoughtSignature: block.thoughtSignature },
          ...block.namespace === void 0 ? {} : { namespace: block.namespace },
        };
      }
    }),
  };
}

/**
 * Throw the canonical invalid-replay failure.
 * Nhận: message — mô tả cụ thể phần envelope không hợp lệ.
 * Trả: không trả về — luôn ném lỗi.
 * @throws {LlmError} mã "INVALID_REPLAY_STATE" cho mọi envelope không dùng được.
 */
function invalidReplay(message: string): never {
  throw new LlmError(`invalid pi-ai replay state: ${message}`, "INVALID_REPLAY_STATE");
}

/**
 * Validate the durable adapter-private envelope before it reaches pi-ai.
 * Nhận: value — giá trị `replayState` chưa tin cậy lấy từ source assistant.
 * Trả: cặp response + blocks đã kiểm hình dạng.
 * @throws {LlmError} mã "INVALID_REPLAY_STATE" khi envelope sai hình dạng.
 */
function readReplayState(value: unknown): { response: PiAiReplayResponse; blocks: readonly PiAiReplayBlock[] } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalidReplay("expected a replay envelope");
  const envelope = value as Record<string, unknown>;
  const rawResponse = envelope["response"];
  if (typeof rawResponse !== "object" || rawResponse === null || Array.isArray(rawResponse)) return invalidReplay("expected a response object");
  const response = rawResponse as Record<string, unknown>;
  if (response["kind"] !== "pi-ai") return invalidReplay("unknown state kind");
  if (response["version"] !== 2) return invalidReplay(`unsupported version ${String(response["version"])}`);
  for (const key of [
    "api",
    "provider",
    "model",
  ] as const) if (typeof response[key] !== "string" || response[key].length === 0) return invalidReplay(`${key} must be a non-empty string`);
  if (![
    "stop",
    "length",
    "toolUse",
    "error",
    "aborted",
  ].includes(String(response["stopReason"]))) return invalidReplay("unknown stopReason");
  if (response["responseModel"] !== void 0 && typeof response["responseModel"] !== "string") return invalidReplay("responseModel must be a string");
  if (response["responseId"] !== void 0 && typeof response["responseId"] !== "string") return invalidReplay("responseId must be a string");
  if (response["providerThinkingLevel"] !== void 0 && typeof response["providerThinkingLevel"] !== "string") return invalidReplay("providerThinkingLevel must be a string");
  const blocks = envelope["blocks"];
  if (!Array.isArray(blocks)) return invalidReplay("blocks must be an array");
  for (const [index, value] of (blocks as readonly unknown[]).entries()) {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return invalidReplay(`block ${index} must be an object`);
    const block = value as Record<string, unknown>;
    if (![
      "text",
      "reasoning",
      "tool-call",
    ].includes(String(block["type"]))) return invalidReplay(`block ${index} has an unknown type`);
    for (const signature of [
      "textSignature",
      "thinkingSignature",
      "thoughtSignature",
      "namespace",
    ] as const) if (block[signature] !== void 0 && typeof block[signature] !== "string") return invalidReplay(`block ${index} ${signature} must be a string`);
    if (block["redacted"] !== void 0 && typeof block["redacted"] !== "boolean") return invalidReplay(`block ${index} redacted must be boolean`);
  }
  return {
    response: response as unknown as PiAiReplayResponse,
    blocks: blocks as readonly PiAiReplayBlock[],
  };
}

/**
 * Convert provider-neutral blocks without trusting them as same-model replay.
 * Nhận: message — assistant message Harness với nội dung bền vững.
 * Trả: assistant message pi-ai trung lập provider (`api: "dsh-foreign"`, usage 0).
 * @throws {LlmError} mã "UNSUPPORTED_CONTENT" khi nội dung assistant chứa khối image.
 */
function foreignAssistant(message: HarnessAssistantMessage): AssistantMessage {
  const source = message.source;
  const content: (TextContent | ThinkingContent | ToolCall)[] = [];
  for (const block of message.content) switch (block.type) {
    case "text":
      content.push({
        type: "text",
        text: block.text,
      });
      break;
    case "reasoning":
      content.push({
        type: "thinking",
        thinking: block.text,
      });
      break;
    case "tool-call":
      content.push({
        type: "toolCall",
        id: block.id,
        name: block.name,
        arguments: parseArguments(block.arguments),
      });
      break;
    case "image": throw new LlmError("pi-ai chat history cannot represent structured assistant image output", "UNSUPPORTED_CONTENT");
    default: break;
  }
  return {
    role: "assistant",
    content,
    api: "dsh-foreign",
    provider: source.provider,
    model: source.model,
    usage: emptyPiUsage(),
    stopReason: content.some((piece) => piece.type === "toolCall") ? "toolUse" : "stop",
    timestamp: 0,
  };
}

/**
 * Recombine durable Harness content with validated pi-ai replay metadata.
 * Nhận: message — assistant message Harness; source — nguồn model bền vững;
 *   rawState — envelope replay chưa tin cậy.
 * Trả: assistant message pi-ai mang lại id/chữ ký gốc provider.
 * @throws {LlmError} mã "INVALID_REPLAY_STATE" khi envelope hoặc metadata không khớp nội dung.
 */
function replayedAssistant(
  message: HarnessAssistantMessage,
  source: HarnessAssistantMessage["source"],
  rawState: unknown,
): AssistantMessage {
  const state = readReplayState(rawState);
  if (state.response.provider !== source.provider) return invalidReplay("provider does not match assistant source");
  if (state.response.model !== source.model) return invalidReplay("model does not match assistant source");
  if (state.blocks.length !== message.content.length) return invalidReplay("block count does not match assistant content");
  return {
    role: "assistant",
    content: message.content.map((block, index): TextContent | ThinkingContent | ToolCall => {
      const replay = state.blocks[index];
      if (replay === void 0 || replay.type !== block.type) return invalidReplay(`block ${index} does not match assistant content`);
      switch (block.type) {
        case "text": return {
          type: "text",
          text: block.text,
          ...replay.type === "text" && replay.textSignature !== void 0 ? { textSignature: replay.textSignature } : {},
        };
        case "reasoning": return {
          type: "thinking",
          thinking: block.text,
          ...replay.type === "reasoning" && replay.thinkingSignature !== void 0 ? { thinkingSignature: replay.thinkingSignature } : {},
          ...replay.type === "reasoning" && replay.redacted !== void 0 ? { redacted: replay.redacted } : {},
        };
        case "tool-call": return {
          type: "toolCall",
          id: block.id,
          name: block.name,
          arguments: parseArguments(block.arguments),
          ...replay.type === "tool-call" && replay.thoughtSignature !== void 0 ? { thoughtSignature: replay.thoughtSignature } : {},
          ...replay.type === "tool-call" && replay.namespace !== void 0 ? { namespace: replay.namespace } : {},
        };
        /* v8 ignore next -- readReplayState rejects unknown replay tags, so an equal plugin-added Harness tag cannot reach this switch */
        default: return invalidReplay(`block ${index} has an unsupported Harness type`);
      }
    }),
    api: state.response.api,
    provider: state.response.provider,
    model: state.response.model,
    ...state.response.responseModel === void 0 ? {} : { responseModel: state.response.responseModel },
    ...state.response.responseId === void 0 ? {} : { responseId: state.response.responseId },
    ...state.response.providerThinkingLevel === void 0 ? {} : { providerThinkingLevel: state.response.providerThinkingLevel },
    usage: emptyPiUsage(),
    stopReason: state.response.stopReason,
    timestamp: 0,
  };
}

/**
 * Convert one durable Harness assistant message into pi-ai history.
 *
 * Durable content is the authoritative record; replay metadata only restores
 * native fidelity (ids, signatures). A replay state this build cannot use —
 * another adapter's kind, another version, a malformed value, or metadata that
 * no longer matches the content — therefore degrades the one message to
 * provider-neutral history instead of failing the request.
 * Nhận: message — nội dung assistant do model sinh, kèm provider/model và replay state tuỳ chọn
 *   của adapter; onDegrade — callback nhận lý do chẩn đoán khi replay state không dùng được.
 * Trả: assistant message pi-ai dựng lại từ nội dung bền vững.
 * @throws {LlmError} lỗi KHÔNG phải "INVALID_REPLAY_STATE" được ném lại, và
 *   "UNSUPPORTED_CONTENT" khi nội dung assistant chứa khối image.
 */
export function toPiAssistant(message: HarnessAssistantMessage, onDegrade?: (reason: string) => void): AssistantMessage {
  const source = message.source;
  if (source.replayState === void 0) return foreignAssistant(message);
  try {
    return replayedAssistant(message, source, source.replayState);
  } catch (error) {
    /* v8 ignore next -- replayedAssistant throws only INVALID_REPLAY_STATE LlmErrors; the
    guard keeps a future non-replay failure loud instead of silently degrading it */
    if (!(error instanceof LlmError) || error.code !== "INVALID_REPLAY_STATE") throw error;
    onDegrade?.(error.message);
    return foreignAssistant(message);
  }
}
