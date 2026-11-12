/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng message của @deepseek-ai/dsh-llm — port 1:1 lib/index.js dòng 8–113 (nguồn per-file:
 *      lib/types/message.js 100 dòng): biên CONTEXT_SUMMARY_MAX_CHARS, boundContextSummary,
 *      freezeMessage và sáu hàm tạo message bất biến. Kiểu port từ lib/types/message.d.ts 246 dòng;
 *      `ContentBlock` lấy từ `./types.ts` (stock: `message.d.ts` → `./types.ts`).
 */

import { brandString } from "@deepseek-ai/dsh-brand";
import { randomUUID } from "@deepseek-ai/dsh-util-crypto";
import { deepFreeze } from "@deepseek-ai/dsh-util-values";
import type { MessageId, ToolCallId } from "./brand.ts";
import type { ContentBlock } from "./types.ts";

/** Provider/model identity and adapter-private replay data for an assistant message. */
export interface AssistantProviderMetadata {
  /** Provider route that produced the message. */
  provider: string;
  /** Provider model id that produced the message. */
  model: string;
  /**
   * Lossless-JSON adapter state needed to replay the provider response.
   * `LlmRuntime` exposes it to a target adapter only when that adapter instance
   * currently owns both this historical provider and the target provider.
   */
  replayState?: unknown;
}

/** Required source of an assistant message produced by a routed model. */
export interface ModelMessageSource extends AssistantProviderMetadata {
  /** Nguồn là model đã định tuyến. */
  kind: "model";
}

/** Required source of a tool-role message carrying one tool result. */
export interface ToolMessageSource {
  /** Nguồn là một lời gọi công cụ. */
  kind: "tool";
  /** Danh tính lời gọi mà message này trả lời. */
  callId: ToolCallId;
}

/** Required source of a system-role message produced by the system-prompt plugin. */
export interface SystemPromptMessageSource {
  /** Nguồn là plugin system-prompt. */
  kind: "system-prompt";
}

/**
 * The kind of information in producer-supplied context, declared by the
 * producer in the same `MessageSource`.
 *
 * `MessageSource.kind` answers *who produced this*; `form` answers *what kind
 * of thing it is*, and the two axes are deliberately independent — several
 * producers share one form, and one producer may emit more than one form over
 * a session.
 *
 * The vocabulary is SEMANTIC, never visual: a value states that the content is
 * a file's instructions or a catalog of available items, and a consumer decides
 * what that looks like. Colors, icons, ordering, and collapse defaults are the
 * consumer's business and must not enter this union. It grows one value at a
 * time as producers gain the structured fields their form needs; an absent or
 * unknown value is the documented default, presented as opaque content.
 */
export type ContextForm =
  /** Instructions read out of workspace files the model is expected to follow. */
  | "instructions"
  /** A catalog of items available in this session, republished as it changes. */
  | "catalog"
  /** Current state, where a later snapshot from the same producer supersedes an earlier one. */
  | "snapshot"
  /** A one-off account of something that just happened; it supersedes nothing. */
  | "notice"
  /** A message another agent addressed to this one. */
  | "relay"
  /** Material lifted out of another session's log, possibly reduced on the way in. */
  | "recall";

/** One named contribution to a `snapshot`-form context, in assembly order. */
export interface ContextSnapshotSection {
  /** The contributing subsystem's name. */
  readonly name: string;
  /** That contribution's model-facing text, exactly as assembled. */
  readonly text: string;
}

/**
 * Producer-declared {@link ContextForm} and the fields that form requires,
 * mixed into the source types that carry one.
 *
 * Discriminated by `form` so a producer cannot select a form without the
 * fields needed to present it: a `notice` must record its one-line
 * account, a `snapshot` its sections. Omitting `form` stays valid — an
 * undeclared context is the documented default.
 */
export type ContextFormed =
  | {
      readonly form?: never;
    }
  | {
      readonly form: "instructions";
    }
  | {
      readonly form: "catalog";
    }
  | {
      readonly form: "snapshot";
      /** The named contributions this snapshot assembled, in order. */
      readonly sections: readonly ContextSnapshotSection[];
    }
  | {
      readonly form: "notice";
      /** One-line account of what happened, shown without expanding the row. */
      readonly summary: string;
    }
  | {
      readonly form: "relay";
    }
  | {
      readonly form: "recall";
    };

/**
 * Where a message (or injected content) came from, in the harness's own
 * vocabulary. Merge-extensible sum type — each producer declares its own
 * `kind` in its own module; there is no shared catch-all `plugin` kind.
 * Model and tool sources answer their role messages; user messages carry any
 * producer's kind, and consumers fall through unknown kinds.
 */
export interface MessageSourceMap {
  user: {
    kind: "user";
  };
  model: ModelMessageSource;
  tool: ToolMessageSource;
  "system-prompt": SystemPromptMessageSource;
}

/**
 * Bound for a `notice` summary. Producers commit the one-line account to the
 * durable log; its inputs — task labels, goal objectives, tool arguments —
 * are caller text with no length of their own.
 */
export const CONTEXT_SUMMARY_MAX_CHARS = 120;

/**
 * Bound one `notice` summary to {@link CONTEXT_SUMMARY_MAX_CHARS}.
 * @param summary - the producer's one-line account, of any length.
 * @returns the account, ellipsized when it exceeds the bound.
 */
export function boundContextSummary(summary: string): string {
  return summary.length <= CONTEXT_SUMMARY_MAX_CHARS
    ? summary
    : `${summary.slice(0, CONTEXT_SUMMARY_MAX_CHARS - 1)}…`;
}

/** Any known message source, derived from {@link MessageSourceMap}; switch on `kind` and fall through unknowns (merge-extensible). */
export type MessageSource = MessageSourceMap[keyof MessageSourceMap];

/** Shared immutable fields of every conversation message. */
interface MessageBase {
  /** Stable identity preserved across every representation boundary. */
  readonly id: MessageId;
  /** Exact model-facing blocks. */
  readonly content: readonly ContentBlock[];
  /**
   * Required source fields supplied by the producer.
   * @persistenceSource user developer
   */
  readonly source: MessageSource;
}

/** A rendered system prompt attributed to the system-prompt producer; empty content sends no prompt. */
export interface SystemMessage extends MessageBase {
  /** Vai trò hệ thống. */
  readonly role: "system";
  /** Nguồn system-prompt. */
  readonly source: MessageSourceMap["system-prompt"];
}

/** Incremental agent session changes in conversation order, currently tool additions and removals. */
export interface DeveloperMessage extends MessageBase {
  /** Vai trò developer. */
  readonly role: "developer";
}

/** A user-role specialization of the shared message representation. */
export interface UserMessage extends MessageBase {
  /** Vai trò người dùng. */
  readonly role: "user";
}

/** A model-produced assistant specialization of the shared message representation. */
export interface AssistantMessage extends MessageBase {
  /** Vai trò trợ lý. */
  readonly role: "assistant";
  /** Nguồn model đã định tuyến. */
  readonly source: ModelMessageSource;
}

/** A first-class tool-role message carrying the result of one tool invocation. */
export interface ToolResultMessage extends MessageBase {
  /** Vai trò công cụ. */
  readonly role: "tool";
  /** Nguồn lời gọi công cụ. */
  readonly source: ToolMessageSource;
  /** Provider-issued id of the tool call this message answers. */
  readonly toolCallId: ToolCallId;
  /** Whether the tool invocation failed. */
  readonly isError?: boolean;
}

/**
 * The conversation messages persisted by Session, keyed by role. This map is
 * closed because every model-visible role must have a durable Session event
 * and an adapter projection.
 */
export interface MessageRoleMap {
  system: SystemMessage;
  developer: DeveloperMessage;
  user: UserMessage;
  assistant: AssistantMessage;
  tool: ToolResultMessage;
}

/** Any persisted conversation message, discriminated by its `role`. */
export type Message = MessageRoleMap[keyof MessageRoleMap];

/** Message mới chưa có danh tính — hợp của mọi vai trò sau khi bỏ `id`. */
type NewMessage = {
  [Role in keyof MessageRoleMap]: Omit<MessageRoleMap[Role], "id">;
}[keyof MessageRoleMap];

/** Đầu vào tạo developer message: bỏ `id` và `role` do hàm tự gắn. */
type NewDeveloperMessage = Omit<DeveloperMessage, "id" | "role">;

/** Đầu vào tạo user message: bỏ `id` và `role` do hàm tự gắn. */
type NewUserMessage = Omit<UserMessage, "id" | "role">;

/** Đầu vào tạo assistant message: bỏ `id`/`role`, còn `source` KHÔNG được tự khai `kind`. */
type NewAssistantMessage = Omit<AssistantMessage, "id" | "role" | "source"> & {
  readonly source: Omit<ModelMessageSource, "kind"> & {
    readonly kind?: never;
  };
};

/**
 * Detach and deep-freeze a message whose identity already exists.
 * @param message - complete message, including its stable identity.
 * @returns an immutable snapshot that preserves the identity.
 */
export function freezeMessage<T extends Message>(message: T): T {
  return deepFreeze(structuredClone(message));
}

/**
 * Create one identified message and freeze it before publication.
 * @param input - complete role, content, and source for a new message.
 * @returns an immutable message with a fresh stable identity.
 */
export function createMessage<T extends NewMessage>(
  input: T & { readonly id?: never },
): T & Pick<Message, "id"> {
  const created = {
    ...input,
    id: brandString<MessageId>(randomUUID()),
  };
  return deepFreeze(structuredClone(created)) as T & Pick<Message, "id">;
}

/**
 * Create an identified, immutable developer message.
 * @param input - content and producer source for the new message.
 * @returns a detached developer message with a fresh identity.
 */
export function createDeveloperMessage<T extends NewDeveloperMessage>(
  input: T & { readonly id?: never; readonly role?: never },
): T & Pick<DeveloperMessage, "id" | "role"> {
  return createMessage({ ...input, role: "developer" }) as T & Pick<DeveloperMessage, "id" | "role">;
}

/**
 * Create one identified user-role message and freeze it before publication.
 * @param input - complete content and source for a new user message.
 * @returns an immutable user message with a fresh stable identity.
 */
export function createUserMessage<T extends NewUserMessage>(
  input: T & { readonly id?: never; readonly role?: never },
): T & Pick<UserMessage, "id" | "role"> {
  return createMessage({ ...input, role: "user" }) as T & Pick<UserMessage, "id" | "role">;
}

/**
 * Create one identified model-produced assistant message and freeze it before publication.
 * @param input - complete content plus the provider, model, and optional replay state for a new assistant message.
 * @returns an immutable assistant message with fixed role/source tags and a fresh stable identity.
 */
export function createAssistantMessage(
  input: NewAssistantMessage & { readonly id?: never; readonly role?: never },
): AssistantMessage {
  return createMessage({
    role: "assistant",
    content: input.content,
    source: {
      kind: "model",
      ...input.source,
    },
  }) as AssistantMessage;
}

/**
 * Create and freeze one identified system-role message holding a rendered
 * system prompt.
 * @param text - the complete rendered prompt; `''` records "no system prompt".
 * @returns an immutable system message with a fresh stable identity.
 */
export function createSystemMessage(text: string): SystemMessage {
  return createMessage({
    role: "system",
    content: text.length === 0 ? [] : [{
      type: "text",
      text,
    }],
    source: { kind: "system-prompt" },
  }) as SystemMessage;
}

/** Input whose acceptance creates one tool-result message. */
export interface ToolResultMessageInput {
  /** Danh tính lời gọi công cụ mà message này trả lời. */
  readonly callId: ToolCallId;
  /** Các khối kết quả thô của công cụ. */
  readonly content: readonly ContentBlock[];
  /** Công cụ có thất bại hay không. */
  readonly isError: boolean;
}

/**
 * Create and freeze one identified tool-result message.
 * @param input - call identity, raw result blocks, and outcome.
 * @returns an immutable tool-role message that answers the tool call.
 */
export function createToolResultMessage(input: ToolResultMessageInput): ToolResultMessage {
  return createMessage({
    role: "tool",
    source: {
      kind: "tool",
      callId: input.callId,
    },
    toolCallId: input.callId,
    content: input.content,
    isError: input.isError,
  }) as ToolResultMessage;
}
