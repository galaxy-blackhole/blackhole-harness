/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Clsx noi bo (1:1 clsx@2.1.1 ma bundle goc nhung san) — noi chuoi className, bo qua gia tri gia
 */

/** Một giá trị mà `clsx` chấp nhận: chuỗi, số, mảng lồng, hoặc bản ghi cờ. */
export type ClassValue = string | number | null | undefined | false | readonly ClassValue[] | { readonly [key: string]: unknown };

/**
 * Nối các thành phần của một giá trị thành chuỗi lớp.
 * Nhận: e — một giá trị `ClassValue`.
 * Trả: chuỗi lớp đã nối (rỗng khi không có gì).
 */
function toClass(e: ClassValue): string {
  let out = "";
  if (typeof e === "string" || typeof e === "number") out += e;
  else if (typeof e === "object" && e !== null) {
    if (Array.isArray(e)) {
      for (const item of e) {
        const part = toClass(item as ClassValue);
        if (part === "") continue;
        if (out !== "") out += " ";
        out += part;
      }
    } else {
      for (const key of Object.keys(e)) {
        if ((e as { readonly [key: string]: unknown })[key]) {
          if (out !== "") out += " ";
          out += key;
        }
      }
    }
  }
  return out;
}

/**
 * Nối các lớp có điều kiện, y như `clsx` của bundle gốc.
 * Nhận: các giá trị `ClassValue` (chuỗi, mảng, bản ghi cờ, giá trị giả).
 * Trả: chuỗi `className` đã nối bằng đúng một dấu cách giữa các phần khác rỗng.
 */
export function clsx(...values: readonly ClassValue[]): string {
  let out = "";
  for (const value of values) {
    const part = toClass(value);
    if (part === "") continue;
    if (out !== "") out += " ";
    out += part;
  }
  return out;
}
