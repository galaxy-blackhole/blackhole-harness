/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ban sao clsx cua ban goc (vung node_modules/.pnpm/clsx@2.1.1 trong bundle) — khong keo phu thuoc ngoai
 */

/** Kieu gia tri ma clsx chap nhan (nguyen van tu ban goc). */
export type ClassValue = string | number | bigint | null | boolean | undefined | readonly ClassValue[] | Record<string, unknown>;

/**
 * Noi cac ten lop thanh mot chuoi, bo qua moi gia tri gia — ban sao nguyen hanh vi cua clsx trong bundle goc.
 * Nhan: danh sach gia tri lop (chuoi, so, mang long nhau, hoac object co khoa bat).
 * Tra: chuoi ten lop da noi bang mot dau cach.
 */
export function clsx(...inputs: readonly ClassValue[]): string {
  const out: string[] = [];
  const push = (value: ClassValue): void => {
    if (value === null || value === undefined || value === false || value === true || value === "") return;
    if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
      out.push(String(value));
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) push(item as ClassValue);
      return;
    }
    if (typeof value === "object") {
      for (const [key, on] of Object.entries(value)) if (on === true) out.push(key);
    }
  };
  for (const input of inputs) push(input);
  return out.join(" ");
}
