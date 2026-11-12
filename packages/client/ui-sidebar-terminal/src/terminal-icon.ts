/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Icon dấu nhắc terminal ở tiêu đề tab (giữ nguyên SVG gốc của DSH)
 */

import type { JsxRuntimeLike } from "./types.ts";

/**
 * Dựng icon terminal 16×16 theo màu chữ xung quanh.
 * Nhận: jsx runtime.
 * Trả: hàm render không tham số.
 */
export function createTerminalIcon(runtime: JsxRuntimeLike): () => unknown {
  const { jsx, jsxs } = runtime;
  return (): unknown =>
    jsxs("svg", {
      width: "16",
      height: "16",
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": "true",
      children: [
        jsx("path", { d: "M3 4L7 8L3 12", stroke: "currentColor" }),
        jsx("path", { d: "M9 12H13", stroke: "currentColor" }),
      ],
    });
}
