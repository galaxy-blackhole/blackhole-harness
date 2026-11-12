/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bản xem trước có biên cho thẻ ray: nối các khối văn bản bằng MỘT dấu cách, gộp mọi khoảng
 *      trắng, rồi cắt ở ngưỡng ký tự kèm dấu ba chấm — y bản xem trước của lượt đã nạp trong ray.
 */

import type { ContentBlock } from "./types.ts";

/** Ngân sách prompt: MỘT dòng thẻ ray (13px trên ~276px), đã tính ca xấu nhất của ASCII. */
export const PROMPT_PREVIEW_LIMIT = 50;

/** Ngân sách phản hồi: BA dòng thẻ ray (12px trên ~276px). */
export const RESPONSE_PREVIEW_LIMIT = 120;

/**
 * Nối các khối văn bản bằng dấu cách, gộp khoảng trắng, và cắt ở `limit` kèm dấu ba chấm khi bị cắt.
 * Nhận: các khối nội dung của một tin và ngân sách ký tự.
 * Trả: bản xem trước một dòng; `""` khi tin không có khối văn bản nào.
 */
export function preview(content: readonly ContentBlock[], limit: number): string {
  let text = "";
  let unread = false;
  for (const block of content) {
    if (block.type !== "text") continue;
    if (text.length >= limit * 2) {
      unread = true;
      break;
    }
    // Biên theo TỪNG khối: phép gộp chạy trên MỌI sự kiện tin, nên một khối nhiều megabyte không
    // được nối (rồi chuẩn hoá bằng regex) nguyên vẹn chỉ để lấy bản xem trước ngắn thế này.
    const clipped = block.text.length > limit * 2;
    const chunk = clipped ? block.text.slice(0, limit * 2) : block.text;
    text += text === "" ? chunk : ` ${chunk}`;
    if (clipped) {
      unread = true;
      break;
    }
  }
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length > limit - 1) return `${normalized.slice(0, limit - 1).trimEnd()}…`;
  return unread ? `${normalized}…` : normalized;
}
