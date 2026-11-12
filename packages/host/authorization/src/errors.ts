/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hai lớp lỗi của seam uỷ quyền: AuthorizationError (mã ổn định cho mọi thất bại) và
 *      AuthorizationDeclinedError (người dùng TỪ CHỐI, không phải bề mặt hỏng).
 */

import { HarnessError } from "@deepseek-ai/dsh-llm";

/** Phân loại lỗi ổn định cho các thất bại của uỷ quyền. */
export class AuthorizationError extends HarnessError {
  /**
   * Dựng một lỗi uỷ quyền có MÃ ổn định (định tuyến theo `code`, đừng bóc `message`).
   * Nhận: `message` — chữ cho người đọc; `code` — mã ổn định (NO_FLOW · UNKNOWN_METHOD ·
   * ALREADY_IN_FLIGHT · DUPLICATE_FLOW · NOT_COMMITTED · CANCELLED · DECLINED); `options` — tuỳ chọn
   * của `Error` (ví dụ `cause`).
   * Trả: thực thể lỗi đã đăng ký tên `AuthorizationError`.
   */
  constructor(message: string, code: string, options?: ErrorOptions) {
    super(message, code, options);
    this.name = "AuthorizationError";
  }
}

/**
 * Lỗi mà {@link AuthorizationInteraction.prompt} dùng để nói NGƯỜI DÙNG đã từ chối — đóng câu hỏi,
 * chọn không trả lời — chứ không phải bề mặt hỏng. Một lượt có luồng thất bại SAU khi một câu hỏi
 * bị từ chối sẽ kết thúc là `cancelled`, cùng kết cục với tín hiệu bị rút, vì người dùng nói không
 * là một sự từ chối, không phải sự cố. Chỉ chữ "không" của NGƯỜI mới được ném lớp này: một câu hỏi
 * bị chính `signal` của nó rút (luồng dẹp câu hỏi thua trong một cuộc đua) phải ném thứ khác, nếu
 * không một thất bại thật về sau sẽ bị đọc nhầm thành từ chối.
 */
export class AuthorizationDeclinedError extends AuthorizationError {
  /**
   * Dựng lỗi "người dùng từ chối" với mã cố định `DECLINED`.
   * Nhận: `message` — chữ cho người đọc (mặc định: "the authorization prompt was declined").
   * Trả: thực thể lỗi đã đăng ký tên `AuthorizationDeclinedError`.
   */
  constructor(message = "the authorization prompt was declined") {
    super(message, "DECLINED");
    this.name = "AuthorizationDeclinedError";
  }
}
