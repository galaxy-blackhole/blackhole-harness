/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dấu kiểu (brand) cho vị trí sự kiện và độ lệch log phiên — bản ĐỊA PHƯƠNG của
 *      `SessionSeq`/`SessionLogOffset` mà bản gốc import từ @deepseek-ai/dsh-session. Vì sao không khai
 *      peer đó: nó NGOÀI bảng peer §3b của docs/recipes/HOST-ROW-REWRITE.md, còn hành vi đo được thì
 *      Y HỆT — `brandNumber` của kernel là hàm ĐỒNG NHẤT (`return value`), nên chỉ còn phải giữ ĐÚNG
 *      phép kiểm và ĐÚNG câu lỗi. Test A/B với chính kernel chứng minh (cùng 5 dạng sai × 2 hàm).
 */

/** Dấu kiểu của vị trí sự kiện phiên — chỉ tồn tại lúc biên dịch, KHÔNG có mặt lúc chạy. */
declare const SESSION_SEQ_BRAND: unique symbol;

/** Dấu kiểu của độ lệch/độ dài log phiên — chỉ tồn tại lúc biên dịch. */
declare const SESSION_LOG_OFFSET_BRAND: unique symbol;

/** Vị trí (seq) của một sự kiện ĐÃ CÓ trong log phiên — cùng hình dạng `SessionSeq` của kernel. */
export type SessionSeq = number & { readonly [SESSION_SEQ_BRAND]: "SessionSeq" };

/** Con trỏ "ngay TRƯỚC sự kiện đầu tiên": seq của sự kiện cuối, hoặc `-1` với log rỗng. */
export type SessionSeqCursor = SessionSeq | -1;

/** Độ lệch/độ dài log phiên (số sự kiện đã cam kết) — cùng hình dạng `SessionLogOffset` của kernel. */
export type SessionLogOffset = number & { readonly [SESSION_LOG_OFFSET_BRAND]: "SessionLogOffset" };

/**
 * Nhận một giá trị số là vị trí sự kiện phiên đã có (nguyên văn phép kiểm của kernel).
 * Nhận: số nguyên an toàn, không âm, và không phải `-0`.
 * Trả: CHÍNH số đó mang dấu `SessionSeq`; ném `TypeError` cùng câu với kernel khi không hợp lệ.
 */
export function SessionSeq(value: number): SessionSeq {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`SessionSeq must be a non-negative safe integer, got ${String(value)}`);
  }
  return value as SessionSeq;
}

/**
 * Nhận một giá trị số là độ lệch/độ dài log phiên (nguyên văn phép kiểm của kernel).
 * Nhận: số nguyên an toàn, không âm, và không phải `-0`.
 * Trả: CHÍNH số đó mang dấu `SessionLogOffset`; ném `TypeError` cùng câu với kernel khi không hợp lệ.
 */
export function SessionLogOffset(value: number): SessionLogOffset {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new TypeError(`SessionLogOffset must be a non-negative safe integer, got ${String(value)}`);
  }
  return value as SessionLogOffset;
}
