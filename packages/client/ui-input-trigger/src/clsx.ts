/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng clsx 2.1.1 của bản gốc — ghép tên lớp, NGUYÊN VĂN hành vi
 */

/**
 * Dựng chuỗi tên lớp từ một giá trị bất kỳ (chuỗi, số, mảng, đối tượng).
 * Nhận: value — giá trị cần dựng.
 * Trả: chuỗi tên lớp (rỗng khi không có gì).
 */
function toClassName(value: unknown): string {
  let out = "";
  if (typeof value === "string" || typeof value === "number") out += value;
  else if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const inner = item ? toClassName(item) : "";
        if (inner) {
          if (out) out += " ";
          out += inner;
        }
      }
    } else {
      for (const key in value as Record<string, unknown>) {
        if ((value as Record<string, unknown>)[key]) {
          if (out) out += " ";
          out += key;
        }
      }
    }
  }
  return out;
}

/**
 * Ghép các đối số thành một chuỗi tên lớp (bỏ giá trị giả).
 * Nhận: items — các giá trị cần ghép (chuỗi, số, mảng, đối tượng).
 * Trả: chuỗi tên lớp đã nối bằng dấu cách.
 */
export function clsx(...items: unknown[]): string {
  let out = "";
  for (const item of items) {
    if (!item) continue;
    const part = toClassName(item);
    if (!part) continue;
    if (out) out += " ";
    out += part;
  }
  return out;
}
