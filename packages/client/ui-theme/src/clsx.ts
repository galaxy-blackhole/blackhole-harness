/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ban sao clsx trong bundle goc (vung node_modules/.pnpm/clsx@2.1.1) — bundle KHONG keo phu thuoc ngoai
 */

/** Kiểu giá trị mà clsx chấp nhận. */
export type ClassValue = string | number | bigint | null | boolean | undefined | readonly ClassValue[] | Record<string, unknown>;

/**
 * Thu một giá trị lớp vào mảng đích, đúng nhánh của clsx@2.1.1 trong bundle gốc.
 * Nhận: value — giá trị lớp; out — mảng tên lớp đang gom.
 * Trả: không (ghi vào out).
 */
function collect(value: ClassValue, out: string[]): void {
  if (!value) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    out.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collect(item as ClassValue, out);
    return;
  }
  if (typeof value === "object") {
    for (const [key, on] of Object.entries(value)) if (on) out.push(key);
  }
}

/**
 * Nối các tên lớp thành một chuỗi, bỏ mọi giá trị giả — nguyên hành vi của clsx trong bundle gốc.
 * Nhận: danh sách giá trị lớp.
 * Trả: chuỗi tên lớp nối bằng một dấu cách.
 */
export function clsx(...inputs: readonly ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) collect(input, out);
  return out.join(" ");
}
