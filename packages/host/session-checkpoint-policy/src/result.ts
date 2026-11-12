/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Kết quả canonical cho lời gọi tool bị huỷ TRƯỚC khi vào thân tool, dựng mới mỗi lần gọi.
 */

import { TOOL_ABORTED_BEFORE_DISPATCH } from "@galaxy-blackhole/gbh-host-tools";
import type { ToolExecutionFailure } from "./types.ts";

/**
 * Dựng kết quả canonical cho một lời gọi bị huỷ trước khi vào thân tool.
 * Nhận: không.
 * Trả: vật thể MỚI mỗi lần gọi (nội dung, lỗi và info đều có danh tính riêng) — mã lỗi lấy từ
 *       hằng `TOOL_ABORTED_BEFORE_DISPATCH` của kernel, không chép chuỗi.
 */
export function abortedBeforeDispatchResult(): ToolExecutionFailure {
  return {
    content: [
      {
        type: "text",
        text: "Error: tool call aborted before dispatch",
      },
    ],
    isError: true,
    error: {
      message: "tool call aborted before dispatch",
      info: {
        name: "AbortError",
        code: TOOL_ABORTED_BEFORE_DISPATCH,
      },
    },
  };
}