/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hai câu ngữ cảnh model của row approval và HÌNH DẠNG seam `systemPrompt` mà row tra theo
 *      cấu trúc (không import gói seam) — chữ được giữ NGUYÊN VĂN vì model nhìn thấy chúng
 */

import type { Agent } from "@deepseek-ai/dsh-agent";

import type { ApprovalPolicy } from "./types.ts";

/** Câu ngữ cảnh model cho chính sách tất định `'never'` — NGUYÊN VĂN bản gốc. */
export const NEVER_SENTENCE =
  "Approval prompts are disabled in this session: actions that require approval are rejected automatically — do not request sandbox escalation (do not set `sandbox_permissions`).";

/** Câu ngữ cảnh model cho chính sách tương tác `'ask'` (vẫn có thể đóng khi không có người trả lời) — NGUYÊN VĂN bản gốc. */
export const ASK_SENTENCE =
  "Approval policy: ask. Operations that require approval may ask through the configured answerers; without an available answerer, the request fails closed.";

/** Ngữ cảnh lắp prompt mà nhà cung cấp chữ ngữ cảnh nhận (chỉ trường `agent` mà row này đọc). */
export interface PromptAssemblyContext {
  /** Agent của lượt lắp này, nếu có. */
  agent?: Agent;
}

/** Mục ngữ cảnh đóng góp cho system prompt (hình dạng seam `systemPrompt.context`). */
export interface PromptContextLike {
  /** Tên duy nhất của mục; đăng ký trùng tên NÉM. */
  name: string;
  /** Thứ tự ghép (tăng dần). */
  order: number;
  /** Chữ tĩnh hoặc nhà cung cấp chữ, chạy lại ở mỗi lượt lắp. */
  text: string | ((context: PromptAssemblyContext) => string);
}

/** Seam `systemPrompt` của kernel, tra theo HÌNH DẠNG (không import gói seam). */
export interface SystemPromptSeam {
  /**
   * Tra thứ tự của một mục ngữ cảnh đã biết.
   * Nhận: `name` — tên mục trong bảng thứ tự của kernel (`APPROVAL_POLICY`).
   * Trả: số thứ tự ghép.
   */
  getContextOrder(name: "APPROVAL_POLICY"): number;
  /**
   * Đăng ký một mục ngữ cảnh trong phạm vi context đang gọi.
   * Nhận: `context` — mục đóng góp.
   * Trả: bộ huỷ của cordis (hoặc bất kỳ giá trị nào kernel trả).
   */
  context(context: PromptContextLike): unknown;
}

/**
 * Chọn câu ngữ cảnh model cho một chính sách.
 * Nhận: `policy` — chính sách hiệu lực của phiên.
 * Trả: chuỗi model nhìn thấy (`NEVER_SENTENCE` hoặc `ASK_SENTENCE`).
 */
export function policySentence(policy: ApprovalPolicy): string {
  return policy === "never" ? NEVER_SENTENCE : ASK_SENTENCE;
}
