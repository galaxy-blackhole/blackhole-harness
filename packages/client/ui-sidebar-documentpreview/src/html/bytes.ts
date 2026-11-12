/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Giai ma UTF-8 cho byte cua tep va ma hoa chi cho payload script cua iframe
 */

/** Kich thuoc mot lo khi ma hoa base64 — nguyen van ban goc. */
export const BASE64_CHUNK_BYTES = 32768;

/**
 * Giai ma van ban UTF-8 day du, tu choi chuoi byte khong hop le.
 * Nhan: data — byte UTF-8 day du.
 * Tra: van ban da giai ma; UTF-8 khong hop le thi nem.
 */
export function decodeText(data: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(data);
}

/**
 * Ma hoa van ban Unicode cho payload base64 cua iframe.
 * Nhan: text — van ban Unicode.
 * Tra: base64 cua byte UTF-8 cua no.
 */
export function encodeText(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES)));
  return btoa(chunks.join(""));
}
