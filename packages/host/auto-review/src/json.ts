/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ba phép đọc/so JSON mà bộ duyệt dùng — nguyên văn hành vi của gói gốc (lib/index.js dòng 53–76).
 */

/**
 * Kết xuất JSON nhiều dòng của một giá trị đã ghi.
 * Nhận: `value` — giá trị lossless JSON.
 * Trả: chuỗi JSON thụt 2 dấu cách; ném khi giá trị không kết xuất được (cùng thông điệp bản gốc).
 */
export function json(value: unknown): string {
  const rendered = JSON.stringify(value, null, 2);
  if (rendered === undefined) throw new Error("auto-review: a required value is not JSON-serializable");
  return rendered;
}

/**
 * Dựng lại đúng cách vòng agent bóc tham số thô đã ghi.
 * Nhận: `raw` — chuỗi tham số thô của lời gọi (rỗng khi model gọi không tham số).
 * Trả: vật thể đã bóc; chuỗi rỗng thành `{}`; JSON hỏng thì trả NGUYÊN chuỗi thô.
 */
export function parseLoggedArguments(raw: string): unknown {
  if (raw === "") return {};
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

/**
 * So hai giá trị lossless JSON mà không giữ bí danh.
 * Nhận: `left` và `right` — hai giá trị cần so.
 * Trả: `true` khi hai chuỗi JSON của chúng BẰNG NHAU (thứ tự khoá được tính).
 */
export function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Vật này có phải bản ghi JSON (không null, không mảng) không.
 * Nhận: `value` — giá trị bất kỳ.
 * Trả: `true` khi là vật thể bản ghi.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
