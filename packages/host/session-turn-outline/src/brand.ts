/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dấu kiểu (brand) cho vị trí sự kiện phiên — bản ĐỊA PHƯƠNG của `SessionSeq` mà bản gốc
 *      import từ @deepseek-ai/dsh-session. Vì sao không khai peer đó: nó NGOÀI bảng peer §3b của
 *      docs/recipes/HOST-ROW-REWRITE.md, còn hành vi đo được thì Y HỆT — `brandNumber` của
 *      @deepseek-ai/dsh-brand là hàm ĐỒNG NHẤT và gói đó tự ghi *"keeps no runtime identity …
 *      independently installed copies produce interchangeable values"* ⇒ chỉ còn phải giữ ĐÚNG
 *      phép kiểm và ĐÚNG câu lỗi. Test A/B với chính kernel chứng minh (tests/host/
 *      session-turn-outline.test.ts, ca "SessionSeq").
 */

/** Dấu kiểu của vị trí sự kiện phiên — chỉ tồn tại lúc biên dịch, KHÔNG có mặt lúc chạy. */
declare const SESSION_SEQ_BRAND: unique symbol;

/** Vị trí (seq) của một sự kiện ĐÃ CÓ trong log phiên — cùng hình dạng `SessionSeq` của kernel. */
export type SessionSeq = number & { readonly [SESSION_SEQ_BRAND]: "SessionSeq" };

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
