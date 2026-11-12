/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng lỗi của kho lưu trữ: bảy mã ổn định mà kho và mọi backend dùng chung, kèm lớp
 *      StorageError mang mã + câu chẩn đoán (bản gốc: lib/types/error.d.ts)
 */

/** Mã phân loại ổn định mà mọi {@link StorageError} mang — đúng BẢY mã của bản gốc, không thêm không bớt. */
export type StorageErrorCode =
  | "backend-not-found"
  | "form-not-mounted"
  | "duplicate-backend"
  | "duplicate-mount"
  | "version-mismatch"
  | "malformed-medium"
  | "closed";

/**
 * Lỗi do kho lưu trữ và do các backend ném ra. `code` là hợp đồng ổn định để người dùng
 * `switch` trên đó; `message` chỉ là câu chẩn đoán cho người đọc.
 */
export class StorageError extends Error {
  /** Mã phân loại của lần hỏng này — giá trị do nơi ném quyết định, không suy từ `message`. */
  readonly code: StorageErrorCode;

  /** Tên lớp cố định `StorageError` (bản gốc đặt tên trên thể hiện, không chỉ trên prototype). */
  override readonly name = "StorageError";

  /**
   * Dựng một lỗi mang mã ổn định.
   * Nhận: mã lỗi, câu chẩn đoán cho người đọc, và tuỳ chọn lỗi chuẩn (`cause`).
   * Trả: thể hiện lỗi đã gắn `code` (thông điệp và `cause` do `Error` giữ).
   */
  constructor(code: StorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}
