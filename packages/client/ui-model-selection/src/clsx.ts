/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc clsx nguyen van ban goc (clsx@2.1.1) — noi ten lop co dieu kien, khong dung thu vien ngoai
 */

/** Mot gia tri ma clsx chap nhan: chuoi, so, mang long nhau, hoac bang ten-lop-co-dieu-kien. */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | readonly ClassValue[]
  | { readonly [key: string]: unknown };

/**
 * Noi mot gia tri thanh chuoi lop.
 * Nhận: value — gia tri clsx (chuoi, so, mang, hoac bang).
 * Trả: chuoi lop da noi (rong khi khong co lop nao).
 */
function resolveClassValue(value: ClassValue): string {
  let out = "";
  if (typeof value === "string" || typeof value === "number") out += value;
  else if (typeof value === "object" && value !== null) {
    if (Array.isArray(value)) {
      const items: readonly ClassValue[] = value;
      for (let index = 0; index < items.length; index++) {
        const item = items[index];
        if (!item) continue;
        const part = resolveClassValue(item);
        if (!part) continue;
        if (out) out += " ";
        out += part;
      }
    } else {
      const record = value as { readonly [key: string]: unknown };
      for (const key in record) {
        if (!record[key]) continue;
        if (out) out += " ";
        out += key;
      }
    }
  }
  return out;
}

/**
 * Noi cac gia tri thanh mot chuoi lop — NGUYEN VAN hanh vi cua clsx.
 * Nhận: args — cac gia tri clsx can noi.
 * Trả: chuoi lop da noi, cach nhau mot dau cach.
 */
export function clsx(...args: readonly ClassValue[]): string {
  let out = "";
  for (let index = 0; index < args.length; index++) {
    const part = resolveClassValue(args[index] as ClassValue);
    if (!part) continue;
    if (out) out += " ";
    out += part;
  }
  return out;
}
