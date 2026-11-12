/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Các id mang brand do llm sở hữu: tương quan lời gọi công cụ và chẩn đoán request provider.
 *      Nguyên thuỷ `Branded<B>` cùng hàm dựng không trạng thái nằm ở @deepseek-ai/dsh-brand để mọi
 *      chủ sở hữu id xuyên biên giới có thể gắn brand mà không phụ thuộc llm. Port 1:1 vùng
 *      lib/types/brand.js (dòng 881–933) của @deepseek-ai/dsh-llm — brand chỉ tồn tại ở tầng kiểu.
 */

import { brandString, type Branded } from "@deepseek-ai/dsh-brand";

/** Danh tính ổn định mà một message mang theo xuyên inbox, log và biên giới request model. */
export type MessageId = Branded<"MessageId">;

/**
 * Gắn brand cho một định danh message.
 * Nhận: id — định danh message dạng opaque.
 * Trả: đúng chuỗi đó, kèm brand message-id.
 */
export function MessageId(id: string): MessageId {
  return brandString<MessageId>(id);
}

/**
 * Tương quan một lời gọi công cụ do model phát với kết quả của nó. Adapter thật lấy id do provider
 * cấp; mock và phương án dự phòng của assembler thì tự sinh.
 */
export type ToolCallId = Branded<"ToolCallId">;

/**
 * Gắn brand cho một chuỗi thành {@link ToolCallId}.
 * Nhận: id — id lời gọi do provider cấp hoặc do bộ phận khác sinh.
 * Trả: đúng chuỗi đó, kèm brand tool-call-id.
 */
export function ToolCallId(id: string): ToolCallId {
  return brandString<ToolCallId>(id);
}

/** Định danh request do provider cấp, được giữ lại để chẩn đoán xuyên biên giới package. */
export type ProviderRequestId = Branded<"ProviderRequestId">;

/**
 * Gắn brand cho một định danh request do provider cấp.
 * Nhận: id — chuỗi opaque do provider cấp.
 * Trả: đúng chuỗi đó, đã mang brand; không kiểm tra giá trị.
 */
export function ProviderRequestId(id: string): ProviderRequestId {
  return brandString<ProviderRequestId>(id);
}

/** Danh tính của một lần thử streaming model, duy nhất trong một vòng đời Agent. */
export type LlmAttemptId = Branded<"LlmAttemptId">;

/**
 * Gắn brand cho một định danh lần thử streaming do vòng lặp sở hữu.
 * Nhận: id — định danh opaque cục bộ trong vòng đời Agent.
 * Trả: đúng chuỗi đó, kèm brand attempt-id.
 */
export function LlmAttemptId(id: string): LlmAttemptId {
  return brandString<LlmAttemptId>(id);
}

/** Định danh do adapter sở hữu cho một mức reasoning effort chọn được của một model. */
export type ReasoningEffortId = Branded<"ReasoningEffortId">;

/**
 * Gắn brand cho một định danh reasoning-effort do adapter sở hữu.
 * Nhận: id — định danh opaque do một năng lực model phơi ra.
 * Trả: đúng chuỗi đó, đã mang brand; không kiểm tra giá trị.
 */
export function ReasoningEffortId(id: string): ReasoningEffortId {
  return brandString<ReasoningEffortId>(id);
}
