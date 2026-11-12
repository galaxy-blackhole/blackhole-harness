/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dấu (brand) tầng kiểu cho danh tính chuỗi-thử-lại. Bản gốc lấy `Branded<'RetryId'>` từ
 *      @deepseek-ai/dsh-brand — gói NGOÀI bảng seam §3b — nên ở đây tái hiện ĐÚNG khuôn
 *      `string & { readonly [BRAND]: B }` bằng một dấu cục bộ trong chính module này.
 */

/** Khoá dấu chỉ tồn tại ở tầng kiểu; không có giá trị nào lúc chạy. */
declare const RETRY_ID_BRAND: unique symbol;

/** Danh tính bền dùng chung cho mọi lần thử của một chuỗi thử lại trong một bước agent. */
export type RetryId = string & { readonly [RETRY_ID_BRAND]: "RetryId" };

/**
 * Đóng dấu một danh tính chuỗi-thử-lại do chính bản cài sinh ra.
 * Nhận: chuỗi danh tính thử lại (opaque, không kiểm tra).
 * Trả: chính chuỗi đó, đã mang dấu tầng kiểu.
 */
export function RetryId(id: string): RetryId {
  return id as RetryId;
}
