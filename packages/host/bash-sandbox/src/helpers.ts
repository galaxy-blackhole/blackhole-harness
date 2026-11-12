/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phép chiếu kết quả shell trên chẩn đoán sandbox dùng chung (bản viết lại của lib/types/helpers.js gốc)
 */

import { classifyRunnerFailure, isRunnerSpawnFailure, matchesSignature } from "@deepseek-ai/dsh-sandbox";
import type { ShellRunResult } from "@deepseek-ai/dsh-shell";

// Ba hàm chẩn đoán vẫn do gói seam `@deepseek-ai/dsh-sandbox` sở hữu (một nguồn sự thật cho mọi backend);
// module này chỉ tái xuất đúng như `lib/types/helpers.d.ts` của bản gốc để consumer nội bộ tìm thấy chúng.
export { classifyRunnerFailure, isRunnerSpawnFailure, matchesSignature };

/**
 * Phân loại một lần chạy hỏng theo phương ngữ từ chối của backend đang chọn.
 * Nhận: kết quả foreground đã kết thúc và danh sách chữ ký từ chối (không phân biệt hoa thường).
 * Trả: true khi lần chạy hỏng đó khớp phương ngữ từ chối ấy.
 */
export function classifyDenial(result: ShellRunResult, signatures: readonly string[]): boolean {
  return matchesSignature(result.exitCode, result.stderr.text, signatures);
}
