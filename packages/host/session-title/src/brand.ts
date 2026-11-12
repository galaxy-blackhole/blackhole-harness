/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hai dấu kiểu (brand) của miền tiêu đề phiên — bản ĐỊA PHƯƠNG của `SessionSeq`
 *      (@deepseek-ai/dsh-session) và `Branded<'SessionTitleProviderId'>` (@deepseek-ai/dsh-brand).
 *      Vì sao không khai hai peer đó: chúng NGOÀI bảng peer §3b của docs/recipes/HOST-ROW-REWRITE.md,
 *      còn hành vi đo được thì Y HỆT — `brandNumber` của dsh-brand là hàm ĐỒNG NHẤT và gói đó tự ghi
 *      *"keeps no runtime identity … independently installed copies produce interchangeable values"*.
 *      Hai hàm dưới đây là hàm đồng nhất lúc chạy, nên giá trị của ta TRÁO ĐƯỢC với giá trị kernel.
 */

/** Dấu kiểu của vị trí sự kiện phiên — chỉ tồn tại lúc biên dịch, KHÔNG có mặt lúc chạy. */
declare const SESSION_SEQ_BRAND: unique symbol;

/** Vị trí (seq) của một sự kiện ĐÃ CÓ trong log phiên — cùng hình dạng `SessionSeq` của kernel. */
export type SessionSeq = number & { readonly [SESSION_SEQ_BRAND]: "SessionSeq" };

/** Dấu kiểu của một lần đăng ký provider tiêu đề — cùng hình dạng `Branded<'SessionTitleProviderId'>`. */
declare const PROVIDER_ID_BRAND: unique symbol;

/** Định danh MỘT lần đăng ký provider tiêu đề (dấu kiểu chỉ tồn tại lúc biên dịch). */
export type SessionTitleProviderId = string & { readonly [PROVIDER_ID_BRAND]: "SessionTitleProviderId" };

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
 * Đóng dấu một chuỗi thô thành định danh provider (bản gốc: `Branded` của dsh-brand — hàm đồng nhất).
 * Nhận: định danh ổn định, không rỗng, do plugin cấp.
 * Trả: CHÍNH chuỗi đó mang dấu `SessionTitleProviderId`.
 */
export function SessionTitleProviderId(id: string): SessionTitleProviderId {
  return id as SessionTitleProviderId;
}
