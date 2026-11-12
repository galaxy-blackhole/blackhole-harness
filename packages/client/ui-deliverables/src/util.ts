/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tien ich dung chung cua row ui-deliverables: nhan dang ban ghi dong, ten file, gop lop CSS
 */

import type { Any } from "./runtime.ts";

/**
 * Mot gia tri da giai ma co phai ban ghi (object thuong) khong.
 * Nhan: value — gia tri da giai ma tu JSON.
 * Tra: true khi la object khong phai mang.
 */
export function isRecord(value: unknown): value is Record<string, Any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Gop cac lop CSS lai, bo gia tri rong — ban sao rut gon cua clsx ma repo da co san.
 * Nhan: ...parts — ten lop (co the rong).
 * Tra: chuoi lop noi bang dau cach.
 */
export function cx(...parts: readonly (string | false | undefined | null)[]): string {
  return parts.filter((part): part is string => typeof part === "string" && part !== "").join(" ");
}
