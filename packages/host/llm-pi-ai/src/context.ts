/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng context của @deepseek-ai/dsh-llm-pi-ai — port 1:1 lib/index.js dòng 1188–1421 (nguồn
 *      per-file: lib/types/context.js): chuyển lịch sử request của Harness sang từ vựng Context của
 *      pi-ai, gồm đường text-only đồng bộ và đường có ảnh bất đồng bộ (chuẩn bị request image, kiểm
 *      biên base64, placeholder cho ảnh đã offload).
 */

import {
  IMAGE_OFFLOAD_REQUIRED_CODE,
  LlmError,
  contentHasImage,
  offloadedImageText,
  projectOffloadedImages,
  requestImageHandleText,
  requiredImageOffload,
} from "@deepseek-ai/dsh-llm";
import { brandString } from "@deepseek-ai/dsh-brand";
import { requestImageDimensions } from "@deepseek-ai/dsh-attachment";
import type {
  AssistantMessage as HarnessAssistantMessage,
  ContentBlock,
  DeveloperMessage,
  GenerateOptions,
  ImageAttachmentAccessResolver,
  RequestMessage,
  TextBlock,
  ToolCallId,
  ToolResultMessage,
  ToolSchema,
} from "@deepseek-ai/dsh-llm";
import type {
  AttachmentStore,
  ImageAttachmentRef,
  ImageRequestTarget,
  RequestImageAttachment,
} from "@deepseek-ai/dsh-attachment";
import type {
  Context as PiContext,
  ImageContent,
  Message as PiMessage,
  TextContent,
  Tool as PiTool,
  ToolResultMessage as PiToolResultMessage,
} from "@earendil-works/pi-ai";
import { toPiAssistant } from "./replay.ts";

/**
 * Harness request-history conversion into pi-ai's Context vocabulary.
 *
 * @module dsh-llm-pi-ai/context
 */

/** Khoá định danh bền vững của một attachment ảnh trong một request. */
type RequestImageKey = ImageAttachmentRef["attachmentId"];

/** Các phiên bản request image đã chuẩn bị, tra theo attachment id. */
type RequestImageVersions = Map<RequestImageKey, RequestImageAttachment>;

/** Ảnh chưa offload của request, tra theo attachment id. */
type ImageRefs = Map<RequestImageKey, ImageAttachmentRef>;

/**
 * Đầu vào gắn các request image xác định của một request vào thế giới thực thi tool hiện tại.
 * Giữ nguyên tên và trường của bản gốc; seam kiểu là cấu trúc, không augment module.
 */
export interface PiImageRequestContext {
  /** Durable provider that resolves request-image bytes and provider-owned host objects. */
  attachments: AttachmentStore;
  /** Resolve current tool access separately from deterministic request-image versions. */
  resolveImageAccess: ImageAttachmentAccessResolver;
  /** Request-level bound on the base64-encoded payload of retained images; omission leaves the bound unchecked. */
  maxRequestImageBytes?: number;
  /** Route pixel and raw encoded-byte budgets. */
  requestImagePolicy?: PiImageRequestBudget;
}

/** Ngân sách pixel và byte của một route, dùng để suy ra target cho từng request image. */
export interface PiImageRequestBudget {
  /** Total-pixel budget; larger sources are downscaled proportionally. */
  maxPixels: number;
  /** Encoded-byte target for one request image. */
  maxBytes: number;
}

/** Join the text blocks of a harness message. */
function flattenText(message: RequestMessage): string {
  return message.content
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}

/** Recover the pi-ai toolResult message for one harness tool-role message. */
function toolResultOf(
  message: ToolResultMessage,
  toolNames: Map<ToolCallId, string>,
  content: string | (TextContent | ImageContent)[],
): PiToolResultMessage {
  return {
    role: "toolResult",
    toolCallId: message.toolCallId,
    toolName: toolNames.get(message.toolCallId) ?? "unknown",
    content: typeof content === "string" ? [{
      type: "text",
      text: content || "(no output)",
    }] : content,
    isError: message.isError ?? false,
    timestamp: 0,
  };
}

/** Reject misplaced tool-change blocks and unsupported image roles before replay or image offloading. */
function assertSupportedHistory(messages: readonly RequestMessage[]): void {
  for (const message of messages) {
    if (message.role !== "developer" && message.content.some((block) => block.type === "tool-addition" || block.type === "tool-removal")) throw new LlmError("Tool-change blocks require developer role", "UNSUPPORTED_CONTENT");
    if (message.role !== "user" && message.role !== "tool" && contentHasImage(message.content)) throw new LlmError(`pi-ai cannot represent an image in an in-history ${message.role} message`, "UNSUPPORTED_CONTENT");
    if (message.role === "system" && message.content.some((block) => block.type !== "text")) throw new LlmError("pi-ai cannot represent non-text system messages", "UNSUPPORTED_CONTENT");
  }
}

/** Render the user-role content of one harness message: text, or text plus base64 request images. */
function userContent(
  blocks: readonly ContentBlock[],
  requestImages: RequestImageVersions,
  resolveImageAccess: ImageAttachmentAccessResolver,
): string | (TextContent | ImageContent)[] {
  const content: (TextContent | ImageContent)[] = [];
  for (const block of blocks) switch (block.type) {
    case "text":
      if (block.text.length > 0) content.push({
        type: "text",
        text: block.text,
      });
      break;
    case "image": {
      const version = requestImages.get(block.attachment.attachmentId)!;
      content.push({
        type: "text",
        text: requestImageHandleText(block.attachment, version, resolveImageAccess(block.attachment)),
      });
      content.push({
        type: "image",
        data: Buffer.from(version.data).toString("base64"),
        mimeType: version.mediaType,
      });
      break;
    }
    default: break;
  }
  if (content.every((block): block is TextContent => block.type === "text")) return content.map((block) => block.text).join("");
  return content;
}

/** Collect the request's retained (not offloaded) image references in message order. */
function collectImageRefs(blocks: readonly ContentBlock[], refs: ImageRefs): void {
  for (const block of blocks) if (block.type === "image") {
    if (block.offloaded !== true) refs.set(block.attachment.attachmentId, block.attachment);
  }
}

/** Resolve one request version per retained image occurrence, keyed by attachment id. */
async function prepareRequestImages(
  messages: readonly RequestMessage[],
  attachments: AttachmentStore,
  budget: PiImageRequestBudget,
  signal?: AbortSignal,
): Promise<RequestImageVersions> {
  const refs: ImageRefs = new Map();
  for (const message of messages) collectImageRefs(message.content, refs);
  const orderedRefs = [...refs.values()];
  const prepared = await Promise.all(orderedRefs.map((ref) => attachments.readImageRequest(ref, requestImageTarget(ref, budget), signal)));
  const versions: RequestImageVersions = new Map();
  for (const [index, ref] of orderedRefs.entries()) versions.set(ref.attachmentId, prepared[index]!);
  return versions;
}

/** Convert a projected declaration without its harness-owned activation marker. */
function piTool(tool: ToolSchema): PiTool {
  return {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as PiTool["parameters"],
  };
}

/** Project every non-deferred tool declaration into the pi-ai vocabulary. */
function toolsOf(options: GenerateOptions): PiTool[] | undefined {
  return options.tools?.filter((tool) => !tool.deferLoading).map(piTool);
}

/** Combine request-level text and leading system history into the initial prompt. */
function splitSystemPrompt(options: GenerateOptions): { systemPrompt: string | undefined; messages: RequestMessage[] } {
  const text: (string | undefined)[] = [options.system];
  let end = 0;
  for (const message of options.messages) {
    if (message.role !== "system") break;
    text.push(flattenText(message));
    end++;
  }
  return {
    systemPrompt: text.filter(Boolean).join("\n\n") || void 0,
    messages: options.messages.slice(end),
  };
}

/** Assemble the request-level pi-ai context envelope shared by both conversion paths. */
function piContext(systemPrompt: string | undefined, options: GenerateOptions, messages: PiMessage[]): PiContext {
  const tools = toolsOf(options);
  return {
    ...(systemPrompt !== void 0 ? { systemPrompt } : {}),
    messages,
    ...(tools !== void 0 && tools.length > 0 ? { tools } : {}),
  };
}

/** Keep one developer event in one system update, resolving its projected tool declarations. */
function appendDeveloper(message: DeveloperMessage, options: GenerateOptions, messages: PiMessage[]): void {
  const content: TextContent[] = [];
  const toolsAdded: PiTool[] = [];
  const toolsRemoved: { name: string }[] = [];
  for (const block of message.content) switch (block.type) {
    case "text":
      if (block.text.length > 0) content.push({
        type: "text",
        text: block.text,
      });
      break;
    case "tool-addition": {
      const tool = options.tools?.find((tool) => tool.name === block.toolName);
      if (tool === void 0) throw new LlmError(`pi-ai tool update references undeclared tool "${block.toolName}"`, "INVALID_REQUEST");
      toolsAdded.push(piTool(tool));
      break;
    }
    case "tool-removal":
      toolsRemoved.push({ name: block.toolName });
      break;
    default: throw new LlmError(`pi-ai cannot represent developer content ${block.type}`, "UNSUPPORTED_CONTENT");
  }
  if (content.length === 0 && toolsAdded.length === 0 && toolsRemoved.length === 0) return;
  messages.push({
    role: "system",
    content,
    timestamp: 0,
    ...(toolsAdded.length === 0 ? {} : { toolsAdded }),
    ...(toolsRemoved.length === 0 ? {} : { toolsRemoved }),
  });
}

/** Reconstruct one assistant message and remember the tool-call names it declares. */
function appendAssistant(
  message: HarnessAssistantMessage,
  messages: PiMessage[],
  toolNames: Map<ToolCallId, string>,
  onReplayDegrade?: (reason: string) => void,
): void {
  const assistant = toPiAssistant(message, onReplayDegrade);
  for (const block of assistant.content) if (block.type === "toolCall") toolNames.set(brandString<ToolCallId>(block.id), block.name);
  messages.push(assistant);
}

/** Append shared system, developer, and assistant roles; true when consumed. */
function appendSharedHistory(
  message: RequestMessage,
  options: GenerateOptions,
  messages: PiMessage[],
  toolNames: Map<ToolCallId, string>,
  onReplayDegrade?: (reason: string) => void,
): boolean {
  if (message.role === "developer") {
    appendDeveloper(message, options, messages);
    return true;
  }
  if (message.role === "system") {
    const content = flattenText(message);
    if (content.length > 0) messages.push({
      role: "system",
      content,
      timestamp: 0,
    });
    return true;
  }
  if (message.role === "assistant") {
    appendAssistant(message, messages, toolNames, onReplayDegrade);
    return true;
  }
  return false;
}

/** Convert text-only history synchronously, rejecting any image occurrence. */
function textOnlyContext(options: GenerateOptions, onReplayDegrade?: (reason: string) => void): PiContext {
  assertSupportedHistory(options.messages);
  const split = splitSystemPrompt(options);
  const toolNames = new Map<ToolCallId, string>();
  const messages: PiMessage[] = [];
  for (const message of split.messages) {
    if (contentHasImage(message.content)) throw new LlmError("pi-ai image conversion requires the durable attachment service", "UNSUPPORTED_CONTENT");
    if (appendSharedHistory(message, options, messages, toolNames, onReplayDegrade)) continue;
    if (message.role === "tool") {
      messages.push(toolResultOf(message, toolNames, flattenText(message)));
      continue;
    }
    messages.push({
      role: "user",
      content: flattenText(message),
      timestamp: 0,
    });
  }
  return piContext(split.systemPrompt, options, messages);
}

/**
 * Resolve the request target for one source under the route budgets.
 * Nhận: ref — ảnh nguồn đã chuẩn hoá; budget — giới hạn pixel và byte đã chốt của route.
 * Trả: kích thước và target byte dùng chung cho serialization và ánh xạ toạ độ screenshot.
 */
export function requestImageTarget(ref: ImageAttachmentRef, budget: PiImageRequestBudget): ImageRequestTarget {
  return {
    ...requestImageDimensions(ref.width, ref.height, budget.maxPixels),
    maxBytes: budget.maxBytes,
  };
}

/**
 * Convert text-only harness history to a synchronous pi-ai Context. Tool
 * result names are recovered from preceding assistant tool calls.
 * Nhận: options — request đã project, system text một-lần đứng trước prompt lịch sử;
 *   images — vắng mặt (undefined) để chọn đường đồng bộ; onReplayDegrade — chuyển tiếp
 *   cho {@link toPiAssistant} với mỗi assistant message.
 * Trả: Context pi-ai; tools bị bỏ khi request không khai tool nào.
 * @throws {LlmError} UNSUPPORTED_CONTENT khi có ảnh ở bất kỳ role lịch sử nào, kể cả system dẫn đầu.
 */
export function toPiContext(options: GenerateOptions, images?: undefined, onReplayDegrade?: (reason: string) => void): PiContext;
/**
 * Convert harness history to a pi-ai Context while resolving durable images.
 * Nhận: options — request đã project; images — attachment provider, resolver đường dẫn hiện
 *   tại và các biên của request; onReplayDegrade — chuyển tiếp cho {@link toPiAssistant}.
 * Trả: Context pi-ai đã phân giải bất đồng bộ.
 * @throws {LlmError} IMAGE_OFFLOAD_REQUIRED khi payload base64 của ảnh giữ lại vượt
 *   maxRequestImageBytes, kèm số occurrence cũ nhất còn phải offload.
 */
export function toPiContext(options: GenerateOptions, images: PiImageRequestContext, onReplayDegrade?: (reason: string) => void): Promise<PiContext>;
/**
 * Thực thi hai chữ ký trên: images vắng mặt chọn đường text-only đồng bộ, ngược lại
 * chạy đường có ảnh bất đồng bộ.
 * Nhận: options — request đã project; images — ngữ cảnh request image (hoặc undefined);
 *   onReplayDegrade — báo hạ cấp replay cho từng assistant message.
 * Trả: Context pi-ai (đồng bộ) hoặc Promise của Context pi-ai (đường có ảnh).
 */
export function toPiContext(options: GenerateOptions, images?: PiImageRequestContext, onReplayDegrade?: (reason: string) => void): PiContext | Promise<PiContext> {
  return images === void 0 ? textOnlyContext(options, onReplayDegrade) : toPiContextWithImages(options, images, onReplayDegrade);
}

/** Convert history while resolving durable images and enforcing the request byte bound. */
async function toPiContextWithImages(options: GenerateOptions, images: PiImageRequestContext, onReplayDegrade?: (reason: string) => void): Promise<PiContext> {
  const { attachments, resolveImageAccess, maxRequestImageBytes } = images;
  const requestImagePolicy = images.requestImagePolicy ?? {
    maxPixels: 4194304,
    maxBytes: 1048576,
  };
  assertSupportedHistory(options.messages);
  const split = splitSystemPrompt(options);
  const requestImages = await prepareRequestImages(split.messages, attachments, requestImagePolicy, options.signal);
  if (maxRequestImageBytes !== void 0) {
    const offloadImages = requiredImageOffload(split.messages, {
      representation: "base64",
      maxBytes: maxRequestImageBytes,
    }, (block) => requestImages.get(block.attachment.attachmentId)!.bytes);
    if (offloadImages > 0) throw new LlmError(`pi-ai request images exceed the ${maxRequestImageBytes}-byte base64 bound; ${offloadImages} more oldest occurrence(s) must be offloaded.`, IMAGE_OFFLOAD_REQUIRED_CODE, { offloadImages });
  }
  const exactMessages = projectOffloadedImages(split.messages, (ref) => offloadedImageText(ref, resolveImageAccess(ref)));
  const toolNames = new Map<ToolCallId, string>();
  const messages: PiMessage[] = [];
  for (const message of exactMessages) {
    if (appendSharedHistory(message, options, messages, toolNames, onReplayDegrade)) continue;
    if (message.role === "tool") {
      messages.push(toolResultOf(message, toolNames, userContent(message.content, requestImages, resolveImageAccess)));
      continue;
    }
    const content = userContent(message.content, requestImages, resolveImageAccess);
    messages.push({
      role: "user",
      content,
      timestamp: 0,
    });
  }
  return piContext(split.systemPrompt, options, messages);
}
