/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kết quả tool HỎNG mà chính sách thay vào khi hạn chót của chính nó thắng — dựng MỚI mỗi lượt
 *      gọi, nên hai lượt không chia sẻ danh tính vật thể nào (C6).
 */

import { TOOL_TIMEOUT } from "./codes.ts";
import type { ToolExecutionFailure } from "./types.ts";

/**
 * Dựng kết quả thay thế cho một lượt gọi tool đã vượt hạn chót.
 * Nhận: ngân sách `timeoutMs` của tool đã trôi qua (nguyên văn con số tool khai).
 * Trả: vật thể MỚI mỗi lần gọi — `content` một khối chữ `Error: tool call timed out after <ms>ms`,
 *       `isError: true`, và `error.info = { name: "ToolTimeoutError", code: "TOOL_TIMEOUT" }` để tầng
 *       thử lại/áp lực (và replay) định tuyến được; sửa vật này KHÔNG lan sang lượt gọi khác.
 */
export function toolTimeoutResult(timeoutMs: number): ToolExecutionFailure {
  const message = `tool call timed out after ${timeoutMs}ms`;
  return {
    content: [
      {
        type: "text",
        text: `Error: ${message}`,
      },
    ],
    isError: true,
    error: {
      message,
      info: {
        name: "ToolTimeoutError",
        code: TOOL_TIMEOUT,
      },
    },
  };
}
