/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Tuần tự hoá JSON an toàn thẻ cho phong bì tham chiếu — port 1:1 vùng serialization.js (stock lib/index.js dòng 110–122).
 */

/**
 * Tuần tự hoá JSON trong khi NGĂN dữ liệu nguồn viết ra một thẻ mở kiểu XML.
 * Nhận: `value` — dữ liệu tham chiếu tương thích JSON.
 * Trả: chuỗi JSON mà kết quả `JSON.parse` KHÔNG đổi và dữ liệu không còn ký tự `<` nguyên văn.
 * Ném: `TypeError` khi giá trị không tuần tự hoá được — giữ NGUYÊN câu lỗi của bản gốc.
 */
export function stringifyTagSafeJson(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (typeof serialized !== "string") throw new TypeError("session-reference data is not JSON-serializable");
  return serialized.replaceAll("<", "\\u003c");
}
