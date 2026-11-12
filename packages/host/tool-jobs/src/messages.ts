/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hai hàm thông điệp mà tool-jobs dùng từ @deepseek-ai/dsh-llm (boundContextSummary + createUserMessage) — gói không symlink peer đó, nên viết lại theo CẤU TRÚC: giới hạn 120 ký tự, UUID mới, structuredClone rồi deep-freeze như kernel.
 */

import type { ContentBlockLike, MessageSourceLike, UserMessageLike } from "./types.ts";

/** Giới hạn của một summary dạng notice — NGUYÊN VĂN CONTEXT_SUMMARY_MAX_CHARS. Nhận: không. Trả: số 120. */
export const CONTEXT_SUMMARY_MAX_CHARS = 120;

/**
 * Giới hạn một summary notice về CONTEXT_SUMMARY_MAX_CHARS — NGUYÊN VĂN bản gốc.
 * Nhận: summary — tài khoản một dòng của nhà sản xuất, dài tuỳ ý.
 * Trả: tài khoản đã cắt bằng dấu ba chấm khi vượt giới hạn.
 */
export function boundContextSummary(summary: string): string {
  return summary.length <= CONTEXT_SUMMARY_MAX_CHARS ? summary : summary.slice(0, CONTEXT_SUMMARY_MAX_CHARS - 1) + "…";
}

/**
 * Đóng băng sâu một đồ thị object tại chỗ, bỏ qua AbortSignal — NGUYÊN VĂN deepFreeze của @deepseek-ai/dsh-util-values.
 * Nhận: value — giá trị cần đóng băng.
 * Trả: chính value sau khi mọi con liệt kê được đóng băng.
 */
function deepFreeze<T>(value: T): T {
  const seen = new WeakSet<object>();
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === null || typeof node !== "object") continue;
    if (node instanceof AbortSignal) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    Object.freeze(node);
    for (const key of Object.keys(node)) pending.push((node as Record<string, unknown>)[key]);
  }
  return value;
}

/**
 * Dựng một thông điệp người dùng CÓ danh tính rồi đóng băng trước khi công bố — NGUYÊN VĂN createUserMessage của kernel.
 * Nhận: input — content và source của thông điệp mới.
 * Trả: thông điệp user bất biến với UUID mới.
 */
export function createUserMessage(input: { readonly content: readonly ContentBlockLike[]; readonly source: MessageSourceLike }): UserMessageLike {
  const message = {
    ...input,
    role: "user" as const,
    id: globalThis.crypto.randomUUID(),
  };
  return deepFreeze(structuredClone(message));
}
