/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lỗi chuyển đổi ĐÃ PHÂN LOẠI dùng chung cho chuyển đổi và bên tiêu thụ — bản viết lại 1:1
 *      `OfficeToPdfError` của `@deepseek-ai/dsh-office-to-pdf`.
 */

import type { OfficeToPdfErrorCode } from "./types.ts";

/** Lỗi chuyển đổi đã phân loại; chi tiết engine nằm trong `cause`. */
export class OfficeToPdfError extends Error {
  /** Mã phân loại phù hợp cho bên tiêu thụ. */
  readonly code: OfficeToPdfErrorCode;

  /**
   * @param code - phân loại phù hợp cho bên tiêu thụ chuyển đổi.
   * @param message - chẩn đoán giải thích lần chuyển đổi hỏng.
   * @param options - lỗi engine hoặc filesystem gốc.
   */
  constructor(code: OfficeToPdfErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = "OfficeToPdfError";
  }
}

/**
 * Dựng `RemoteError` mã `document-render/failed` cho lần chuyển đổi hỏng. Bản gốc khai mã này bằng
 * `declare module` trên `RemoteErrorDetailsMap`; repo CẤM `declare module` (luật 000d) ⇒ ép kiểu tại ĐÚNG
 * MỘT chỗ này, giữ nguyên lớp lỗi, mã, thông điệp, chi tiết và `cause` như bản gốc.
 * Nhận: thông điệp, chi tiết (`reason` = mã phân loại), và (tuỳ chọn) nguyên nhân.
 * Trả: đối tượng `RemoteError` đã dựng.
 */
export function documentRenderFailure(
  message: string,
  details: { readonly reason: OfficeToPdfErrorCode },
  options?: { readonly cause?: unknown },
): Error {
  // Nạp muộn để `errors.ts` vẫn là module thuần kiểu+lớp lỗi khi bị import ở nơi không cần Remote.
  const { RemoteError } = require("@deepseek-ai/dsh-typert-protocol") as {
    RemoteError: new (code: never, message: string, details: never, options?: never) => Error;
  };
  return new RemoteError("document-render/failed" as never, message, details as never, options as never);
}
