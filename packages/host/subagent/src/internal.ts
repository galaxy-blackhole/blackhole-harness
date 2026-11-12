/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Điểm vào NỘI BỘ của seam subagent: dấu danh tính công cụ nhắn tin Agent-cạnh-Agent và hai adapter
 *      giao prompt của Host (queue/steer), nằm NGOÀI Service Definition công khai và hợp đồng nhắn tin
 *      hướng model. Port 1:1 `lib/types/internal.js` (57 dòng) + `internal.d.ts` (57 dòng) của
 *      `@deepseek-ai/dsh-subagent`.
 */

/**
 * Dấu tích hợp tiếp nối và các adapter chỉ-Host, nằm ngoài Service Definition công khai và hợp đồng
 * nhắn tin Agent hướng model.
 *
 * @module @galaxy-blackhole/gbh-subagent/internal
 */

import type { Agent } from "@galaxy-blackhole/gbh-agent";
import type { ContentBlock, MessageId, MessageSource } from "@deepseek-ai/dsh-llm";
import type { SessionId } from "@galaxy-blackhole/gbh-session";
import type { ToolDefinition } from "@galaxy-blackhole/gbh-host-tools";

import type { SubagentDelivery } from "./control-types.ts";
import type SubagentRuntime from "./index.ts";

/** Danh tính ổn định theo TIẾN TRÌNH, chỉ do công cụ nhắn tin Agent-cạnh-Agent chuẩn mang. */
export const adjacentAgentSendMessageTool: unique symbol = Symbol.for("dsh.subagent.adjacentAgentSendMessageTool");

/**
 * Hình dạng của một định nghĩa công cụ ĐÃ được đánh dấu, khai theo CẤU TRÚC — thay cho phép index bằng
 * ký hiệu mà bản gốc dựa vào; repo CẤM augment module nên đây là chỗ duy nhất nới kiểu.
 */
type MarkedToolDefinition = ToolDefinition & Readonly<{ [adjacentAgentSendMessageTool]?: boolean }>;

/**
 * Đánh dấu công cụ nhắn tin Agent-cạnh-Agent chuẩn mà KHÔNG đổi schema thấy được của nó.
 * Nhận: `definition` — định nghĩa `send_message` chuẩn.
 * Trả: CHÍNH định nghĩa đó, đã cài danh tính nội bộ.
 */
export function markAdjacentAgentSendMessageTool(definition: ToolDefinition): ToolDefinition {
  Object.defineProperty(definition, adjacentAgentSendMessageTool, { value: true });
  return definition;
}

/**
 * Kiểm một định nghĩa thấy được có phải công cụ nhắn tin Agent-cạnh-Agent chuẩn hay không.
 * Nhận: `definition` — ứng viên `send_message` đã phân giải theo phạm vi.
 * Trả: `true` khi định nghĩa mang danh tính công cụ chuẩn nội bộ, ngược lại `false`.
 */
export function isAdjacentAgentSendMessageTool(definition: ToolDefinition | undefined): boolean {
  return definition !== undefined
    && (definition as MarkedToolDefinition)[adjacentAgentSendMessageTool] === true;
}

/**
 * Dấu giao prompt bằng khoá ký hiệu, ổn định theo tiến trình, dùng chung giữa mục runtime đã gộp và
 * subpath nội bộ chưa gộp này.
 * @internal
 */
export const deliverSubagentPrompt: unique symbol = Symbol.for("dsh.subagent.deliverPrompt");

/**
 * Bề mặt runtime mà các adapter prompt chỉ-Host cần: MỘT phương thức giao prompt theo khoá ký hiệu.
 * Khai theo CẤU TRÚC vì phương thức này là `private` trong lớp dịch vụ (đúng bản gốc).
 */
export interface HostPromptDeliverer {
  /**
   * Giao một prompt đã nhận vào hộp thư của con trực tiếp.
   * Nhận: `parent` — Agent cha trực tiếp đang sống; `childId` — id phiên con bền vững;
   *        `content` — khối nội dung do Host soạn; `source` — mô tả nguồn bền vững;
   *        `signal` — tín hiệu huỷ của bên gọi trước khi hộp thư nhận; `delivery` — queue hoặc steer.
   * Trả: id hộp thư của tin nhắn đã được nhận.
   */
  [deliverSubagentPrompt](
    parent: Agent,
    childId: SessionId,
    content: ContentBlock[],
    source: MessageSource,
    signal: AbortSignal,
    delivery: SubagentDelivery,
  ): Promise<MessageId>;
}

/**
 * Xếp hàng MỘT tin nhắn giao thức Host mà không mở thêm thao tác Service nào.
 * Nhận: `runtime` — runtime subagent sở hữu chỗ cư trú tiếp nối; `parent` — đúng Agent cha trực tiếp
 *        đang sống, bên cho phép giao; `childId` — id phiên con trực tiếp bền vững; `content` — nội
 *        dung do Host soạn; `source` — mô tả nguồn giao thức Host bền vững; `signal` — tín hiệu huỷ
 *        của bên gọi trước khi hộp thư nhận.
 * Trả: id hộp thư của tin nhắn đã được nhận.
 */
export function queueHostSubagentPrompt(
  runtime: SubagentRuntime,
  parent: Agent,
  childId: SessionId,
  content: ContentBlock[],
  source: MessageSource,
  signal: AbortSignal,
): Promise<MessageId> {
  return (runtime as unknown as HostPromptDeliverer)[deliverSubagentPrompt](parent, childId, content, source, signal, "queue");
}

/**
 * Lái MỘT tin nhắn giao thức Host mà không mở thêm thao tác Service nào.
 * Nhận: `runtime` — runtime subagent sở hữu chỗ cư trú tiếp nối; `parent` — đúng Agent cha trực tiếp
 *        đang sống, bên cho phép giao; `childId` — id phiên con trực tiếp bền vững; `content` — nội
 *        dung do Host soạn; `source` — mô tả nguồn giao thức Host bền vững; `signal` — tín hiệu huỷ
 *        của bên gọi trước khi hộp thư nhận.
 * Trả: id hộp thư của tin nhắn đã được nhận.
 */
export function steerHostSubagentPrompt(
  runtime: SubagentRuntime,
  parent: Agent,
  childId: SessionId,
  content: ContentBlock[],
  source: MessageSource,
  signal: AbortSignal,
): Promise<MessageId> {
  return (runtime as unknown as HostPromptDeliverer)[deliverSubagentPrompt](parent, childId, content, source, signal, "steer");
}
