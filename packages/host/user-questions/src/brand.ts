/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dấu tầng kiểu cho vị trí trong log phiên. Bản gốc lấy `SessionLogOffset` từ
 *      @deepseek-ai/dsh-session — gói NGOÀI bảng seam §3b — nên ở đây tái hiện ĐÚNG khuôn
 *      `number & { [BRAND]: B }` và ĐÚNG phép kiểm của nó (đo từ dsh-session/lib/index.js).
 */

/** Khoá dấu chỉ tồn tại ở tầng kiểu; không có giá trị nào lúc chạy. */
declare const SESSION_LOG_OFFSET_BRAND: unique symbol;

/** Vị trí trong log phiên: số nguyên an toàn, không âm. */
export type SessionLogOffset = number & { readonly [SESSION_LOG_OFFSET_BRAND]: "SessionLogOffset" };

/**
 * Nhận một giá trị số làm vị trí log phiên.
 * Nhận: `value` — số nguyên an toàn không âm (độ dài tiền tố, mốc seq).
 * Trả: chính số đó, đã mang dấu tầng kiểu.
 * @throws {TypeError} khi giá trị không phải số nguyên an toàn không âm, kể cả `-0`.
 */
export function SessionLogOffset(value: number): SessionLogOffset {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`SessionLogOffset must be a non-negative safe integer, got ${String(value)}`);
  }
  return value as SessionLogOffset;
}
