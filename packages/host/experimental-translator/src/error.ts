/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lỗi dịch an toàn của row translator: mã phân loại + thông điệp KHÔNG chứa văn bản gốc hay phản hồi provider
 */

/**
 * Mã lỗi phân loại, độc lập với câu chữ UI đã bản địa hoá — NGUYÊN VĂN tập mã của bản gốc
 * (lib/types/types.d.ts:78-79), giữ đúng thứ tự.
 */
export type TranslationErrorCode =
  | "TRANSLATION_TEXT_LIMIT"
  | "TRANSLATION_HTTP_ERROR"
  | "TRANSLATION_INVALID_RESPONSE"
  | "TRANSLATION_RESPONSE_LIMIT"
  | "TRANSLATION_REQUEST_FAILED"
  | "TRANSLATION_TIMEOUT"
  | "TRANSLATION_SESSION_REQUIRED"
  | "TRANSLATION_SESSION_INACTIVE"
  | "TRANSLATION_STORAGE_ERROR"
  | "TRANSLATION_UNAVAILABLE";

/** Lỗi provider hoặc bị từ chối bởi trần request/response đã cấu hình. */
export class TranslationError extends Error {
  /** Mã phân loại lỗi. */
  readonly code: TranslationErrorCode;

  /** Ten lop on dinh (giu nguyen 'TranslationError' nhu ban goc). */
  override name = "TranslationError";

  /**
   * @param code - mã phân loại, độc lập với câu chữ UI đã bản địa hoá.
   * @param message - chẩn đoán KHÔNG chứa văn bản gốc hay phản hồi provider.
   */
  constructor(code: TranslationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}
