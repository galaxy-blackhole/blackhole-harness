/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng LỖI của dạng dữ liệu miền (`ctx.storage.domain`): `DomainError` mang mã ổn định để
 *      người dùng switch, cộng vị trí bản ghi hỏng schema (bản gốc: lib/types/error.d.ts).
 */

/** Mã phân biệt của mọi {@link DomainError}; đây là hợp đồng ỔN ĐỊNH mà người dùng được switch. */
export type DomainErrorCode = "already-open" | "facet-unsupported" | "invalid-record" | "missing-key" | "closed";

/** Vị trí bản ghi hỏng schema ở ranh giới bền. */
export interface InvalidRecordDetail {
  /** Bảng chứa bản ghi bị từ chối; `''` là ô singleton toàn cục. */
  readonly table: string;
  /** Khoá của bản ghi bị từ chối; `''` là ô singleton toàn cục. */
  readonly key: string;
}

/** Tham số dựng: `cause` chuẩn cộng vị trí của ca `invalid-record`. */
export interface DomainErrorOptions extends ErrorOptions {
  /** Có mặt ĐÚNG KHI `code` là `invalid-record`. */
  readonly detail?: InvalidRecordDetail;
}

/**
 * Lỗi do tầng miền ném. `code` là hợp đồng ổn định để người dùng switch; `message` là câu chẩn đoán.
 * Lỗi của backend (`backend-not-found`, `version-mismatch`, …) đi xuyên qua NGUYÊN VẸN dưới dạng
 * `StorageError` — tầng miền không bọc lại.
 */
export class DomainError extends Error {
  /** Mã phân biệt, ổn định. */
  readonly code: DomainErrorCode;

  /** Tên lớp — giữ nguyên văn `DomainError` như bản gốc. */
  override readonly name = "DomainError";

  /** Có mặt ĐÚNG KHI `code` là `invalid-record`. */
  readonly detail?: InvalidRecordDetail;

  /**
   * Dựng lỗi miền.
   * Nhận: mã phân biệt (`code`), câu chẩn đoán (`message`), và tuỳ chọn chuẩn (`options` — `cause` +
   * `detail` của ca `invalid-record`).
   * Trả: thể hiện lỗi mới; `detail` chỉ được đặt khi `options.detail` có mặt.
   */
  constructor(code: DomainErrorCode, message: string, options?: DomainErrorOptions) {
    super(message, options);
    this.code = code;
    if (options?.detail) this.detail = options.detail;
  }
}
