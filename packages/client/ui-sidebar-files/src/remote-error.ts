/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Lỗi Remote: một Error thật mang mã ổn định, để §throw result.error§ giữ nguyên ngữ nghĩa.
 */

/**
 * Một lần gọi Remote thất bại.
 *
 * Chủ sở hữu ném nó tại chỗ hỏng, Host Gateway mã hoá nguyên trạng lên đường truyền, và mặt Client dựng lại
 * một instance cho nhánh lỗi của §RemoteResult§. Phân biệt LUÔN theo §code§, không bao giờ theo §instanceof§.
 */
export class RemoteFailure extends Error {
  /** Mã lỗi ổn định (§gateway/internal§ · §workspace-file/not-found§…). */
  readonly code: string;

  /** Dấu hiệu cấu trúc: nhận dạng qua bundle/ realm khác không bao giờ dùng §instanceof§. */
  readonly isDSHRemoteError = true;

  /**
   * Dựng một lỗi Remote.
   * Nhận: code — mã lỗi ổn định; message — thông điệp cho người đọc.
   * Trả: instance mang đủ §code§ và §message§ mà tầng vẽ đọc.
   */
  constructor(code: string, message: string) {
    super(message);
    this.name = "RemoteError";
    this.code = code;
  }
}
