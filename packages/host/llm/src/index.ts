/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * * modify date 08/11/2026
 * desc Điểm vào @galaxy-blackhole/gbh-llm: xuất ĐÚNG danh sách export của stock lib/index.js dòng 2429 (65 tên, gồm LlmRuntime as default), trỏ về các tệp đã port.
 */

export { ACCOUNT_QUOTA_EXCEEDED_CODE, CONTEXT_WINDOW_EXCEEDED_CODE, EMPTY_RESPONSE_CODE, HarnessError, IMAGE_OFFLOAD_REQUIRED_CODE, INVALID_CREDENTIAL_CODE, QUOTA_EXCEEDED_CODE, errorChain, isContextWindowExceededError, isHarnessError, isQuotaExceededError } from "./error.ts";
export { APP_IDENTITY, attributionHeaders, userAgent } from "./attribution.ts";
export { AssistantStreamAccumulator, assembleAssistantStream, assistantStreamChunks, assistantStreamFirstTokenTime, assistantStreamHasVisibleContent, assistantStreamHasVisibleText, chunkHasVisibleText, expandAssistantStream, isTokenDelta, isVisibleChunk, joinAssistantStreamText, lastAssistantStreamChunk, runFirstTokenTime, runFirstVisibleTime } from "./assistant-stream.ts";
export { BlockAssembler } from "./assembler.ts";
export { CONTEXT_SUMMARY_MAX_CHARS, boundContextSummary, createAssistantMessage, createDeveloperMessage, createMessage, createSystemMessage, createToolResultMessage, createUserMessage, freezeMessage } from "./message.ts";
export { LlmAdapter, LlmError, LlmRuntime, LlmRuntime as default, assertUsableApiKey } from "./service.ts";
export { LlmAttemptId, MessageId, ProviderRequestId, ReasoningEffortId, ToolCallId } from "./brand.ts";
export { RetryPolicySchema, resolveRetryPolicy } from "./retry-policy.ts";
export { callConfigEquals, isAgentLoopRequest, markAgentLoopRequest } from "./call-config.ts";
export { contentHasFile, contentHasImage, fileHandleText, offloadedImageText, projectFilesToText, projectImagesForTextModel, projectOffloadedImages, projectToolUpdates, requestImageHandleText, requiredImageOffload, resolveImageAttachmentAccess, textOnlyImageText } from "./content.ts";
export { normalizeApiKey } from "./api-key.ts";

// MẶT KIỂU (bổ sung 08/11/2026 — theo review-2): stock dsh-llm/lib/types/index.d.ts:16-27 re-export toàn bộ kiểu của 9 module;
// thiếu chúng thì consumer (host/session/src/{repair,request-header,session,surface,tool-history,types}.ts) vỡ TS2614/TS2724
// với AssistantMessage · ToolResultMessage · ToolSchema · Message · ToolHistory · ContentBlock. THUẦN CỘNG THÊM, không đổi mặt runtime.
export * from "./attribution.ts";
export * from "./brand.ts";
export * from "./error.ts";
export * from "./api-key.ts";
export * from "./types.ts";
export * from "./content.ts";
export * from "./assistant-stream.ts";
export * from "./message.ts";
export * from "./retry-policy.ts";
export type { ConfigureCall, LlmCallConfig, LlmCallConfigAdapterDefaults, LlmCallControls } from "./call-config.ts";
