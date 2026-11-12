/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ten va nhan dang plan TAM THOI — van ban nam trong tham so dieu huong, khong ghi vao bo cuc
 */
import { REVIEW_ADDRESS_PATTERN, REVIEW_ADDRESS_PREFIX, REVIEW_WINDOW_BYTES } from "./ids.ts";

/**
 * Dat ten cho mot plan tam thoi trong vong doi cua trinh duyet va trong phien.
 * Nhan: `sessionId` — phien dang hien plan; `requestKey` — dinh danh yeu cau dang cho.
 * Tra: dia chi dung de mo lai the xem truoc do.
 */
export function reviewPreviewAddress(sessionId: string, requestKey: string): string {
  return REVIEW_ADDRESS_PREFIX + encodeURIComponent(sessionId) + "/" + encodeURIComponent(requestKey);
}

/**
 * Nhan dang dia chi cua plan TAM THOI, khong hieu nham thanh lich su da ghi.
 * Nhan: `address` — dia chi da luu hoac do nguoi goi dua vao.
 * Tra: true khi dia chi la mot the xem truoc tam thoi.
 */
export function isReviewPreviewAddress(address: string): boolean {
  return REVIEW_ADDRESS_PATTERN.test(address);
}

/**
 * Sinh chuoi ngau nhien danh ten "cua so review" cua mot lan tai trinh duyet.
 *
 * NGUYEN VAN ban goc (`@deepseek-ai/dsh-util-crypto` duoc bundle goc nhung thang vao): UUID v4 sinh tu
 * `crypto.getRandomValues`. Giu nguyen thuat toan de dia chi review khong doi hinh dang.
 * Nhan: khong co.
 * Tra: chuoi UUID v4.
 */
export function mintReviewWindow(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(REVIEW_WINDOW_BYTES));
  const hex = Array.from(bytes, (byte, index) =>
    (index === 6 ? (byte & 15) | 64 : index === 8 ? (byte & 63) | 128 : byte).toString(16).padStart(2, "0"),
  ).join("");
  return hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) + "-" + hex.slice(16, 20) + "-" + hex.slice(20);
}
