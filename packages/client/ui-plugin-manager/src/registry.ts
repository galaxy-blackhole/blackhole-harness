/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Tiện ích registry dùng chung nửa browser: UUID v4 + chuẩn hoá URL registry — port 1:1 vùng
 *      util/crypto của bundle gốc (@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js dòng 539-570)
 */

/** Registry công khai npmmirror — NGUYÊN VĂN bản gốc (dùng cho cấu hình dự phòng + so registry công khai). */
export const NPMMIRROR_REGISTRY = "https://registry.npmmirror.com/";

/** Một URL http(s), đúng như pnpm nhận cho cờ `--registry`. */
export const REGISTRY_URL = /^https?:\/\/\S+$/;

/**
 * Sinh UUID v4 từ `crypto.getRandomValues` (NGUYÊN VĂN bản gốc).
 * Nhận: không.
 * Trả: chuỗi UUID.
 */
export function randomUUID(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const hex = Array.from(bytes, (byte, index) => {
    return (index === 6 ? (byte & 15) | 64 : index === 8 ? (byte & 63) | 128 : byte).toString(16).padStart(2, "0");
  }).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
}

/**
 * Chuẩn hoá URL registry về dạng pnpm so sánh: host chữ thường, có dấu "/" cuối (1:1 bản gốc).
 * Nhận: url — registry theo cấu hình hoặc theo yêu cầu.
 * Trả: URL đã chuẩn hoá; NÉM Error nếu không phải URL http(s).
 */
export function normalizeRegistry(url: string): string {
  let parsed: URL | undefined;
  try {
    parsed = new URL(url);
  } catch {
    parsed = undefined;
  }
  if (parsed === undefined || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) throw new Error("a registry must be an http(s) URL: " + url);
  if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
  return parsed.href;
}
