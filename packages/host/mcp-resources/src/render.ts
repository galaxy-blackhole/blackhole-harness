/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phép chiếu kết quả tài nguyên: payload nhị phân KHÔNG vào lịch sử model, chỉ vào người gọi lập trình.
 */
import type { ContentBlock } from "@deepseek-ai/dsh-llm";
import type { JsonValue } from "./types.ts";

/**
 * Render JSON tài nguyên, giữ dữ liệu nhị phân thô chỉ cho người gọi lập trình.
 *
 * Mọi trường `blob` dạng chuỗi được thay bằng mô tả độ dài base64; URI, MIME type, text và cursor
 * vẫn hiện nguyên trong JSON. Tiền tố `MCP server: <tên>` quy kết kết quả về server đã gọi.
 * Nhận: tên server đã cấu hình và giá trị tài nguyên chuẩn.
 * Trả: MỘT khối text (mảng một phần tử) — hình dạng mà sổ tool nhận làm nội dung model.
 */
export function renderResourceResult(server: string, value: JsonValue): ContentBlock[] {
  return [
    {
      type: "text",
      text: `MCP server: ${server}\n${JSON.stringify(value, (key, item) => {
        if (key === "blob" && typeof item === "string") {
          return `[binary resource: ${item.length} base64 characters; available to programmatic callers]`;
        }
        return item;
      })}`,
    },
  ];
}
