/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Từ vựng của row mcp-resources: một giá trị JSON lossless, một yêu cầu tài nguyên MCP, và
 *      hợp đồng provider mà chủ kết nối (row mcp-client) cài đặt.
 */
import type { ToolExecution } from "@galaxy-blackhole/gbh-host-tools";

/**
 * Một giá trị JSON lossless.
 *
 * Bản gốc import kiểu này từ `@deepseek-ai/dsh-util-values`; đây là KIỂU thuần nên khai tại chỗ
 * theo CẤU TRÚC (cùng hình dạng) thay vì thêm một peer thể-hiện-thứ-hai cho một import bị xoá lúc build.
 */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Một phép toán tài nguyên được hỗ trợ, kèm cursor và URI do server sở hữu. */
export type McpResourceRequest =
  | { method: "resources/list" | "resources/templates/list"; cursor?: string }
  | { method: "resources/read"; uri: string };

/** Truy cập tài nguyên của MỘT server đã cấu hình, do plugin kết nối MCP của server đó sở hữu. */
export interface McpResourceProvider {
  /**
   * Chạy một phép toán trên một thế hệ kết nối đang sống.
   * Nhận: yêu cầu (method + cursor/uri) và danh tính người gọi kèm tín hiệu huỷ.
   * Trả: kết quả giao thức dưới dạng JSON lossless.
   */
  request(request: McpResourceRequest, exec: ToolExecution): Promise<JsonValue>;
}
