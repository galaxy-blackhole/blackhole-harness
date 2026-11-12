/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Phân loại loopback không phụ thuộc thư viện: dùng chung cho hàng rào /api và cho trạng thái client
 */

/**
 * Hostname của URL đã chuẩn hoá có trỏ về loopback của máy cục bộ hay không.
 *
 * Viết lại hành vi của bản gốc: "localhost", literal IPv6 loopback giữ nguyên dấu ngoặc ([::1]), và mọi
 * địa chỉ IPv4 trong 127/8. Chuỗi khác (kể cả tên miền phân giải về loopback) KHÔNG tính.
 * @param hostname - hostname của WHATWG URL (literal IPv6 còn giữ dấu ngoặc).
 * @returns true với localhost, IPv6 loopback, hoặc IPv4 trong 127/8.
 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "[::1]") return true;
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts[0] !== "127") return false;
  return parts.every((part) => /^[0-9]{1,3}$/u.test(part) && Number(part) <= 255);
}
