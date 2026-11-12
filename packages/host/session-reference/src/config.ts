/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hằng số cấu hình và lỗi có mã ổn định của tham chiếu phiên — port 1:1 vùng config.js (stock lib/index.js dòng 91–109).
 */

/** Số tham chiếu TỐI ĐA mà MỘT tin nhắn được nhận. */
export const MAX_REFERENCES = 3;

/** Số ứng viên khám phá mặc định trả cho host. */
export const DEFAULT_CANDIDATE_LIMIT = 50;

/** Ngân sách UTF-8 TỐI THIỂU cho MỘT đối tượng JSON tham chiếu đã dựng. */
export const DEFAULT_MAX_REFERENCE_BYTES = 65_536;

/** Cấu hình dịch vụ tham chiếu phiên (nguyên văn bản gốc). */
export interface Config {
  /** Số phiên nguồn PHÂN BIỆT tối đa mà một tin nhắn được tham chiếu, từ một đến ba. */
  maxReferences?: number;
  /** Giới hạn danh sách ứng viên mặc định của host. */
  candidateLimit?: number;
  /** Số byte UTF-8 tối đa cho mỗi nguồn đã dựng; vắng mặt thì dùng ngân sách theo mô hình với sàn 64 KiB. */
  maxReferenceBytes?: number;
  /** Tỉ lệ cửa sổ ngữ cảnh của mô hình cho mỗi nguồn, ước lượng bốn byte một token; trong khoảng 0..1. */
  referenceContextFraction?: number;
}

/** Mã thất bại ổn định phơi ra cho adapter host. */
export type SessionReferenceErrorCode =
  | "SESSION_REFERENCE_INVALID_CONFIG"
  | "SESSION_REFERENCE_INVALID_REFERENCE"
  | "SESSION_REFERENCE_SELF_REFERENCE"
  | "SESSION_REFERENCE_TOO_MANY"
  | "SESSION_REFERENCE_READ_FAILED"
  | "SESSION_REFERENCE_BUDGET_EXCEEDED"
  | "SESSION_REFERENCE_CANCELLED";

/** Lỗi tham chiếu phiên có KIỂU, phù hợp để ánh xạ sang lỗi giao thức host. */
export class SessionReferenceError extends Error {
  /** Mã định tuyến ổn định đi kèm mọi lần ném. */
  readonly code: SessionReferenceErrorCode;

  /**
   * Nhận: `message` — chẩn đoán người đọc hiểu; `code` — mã định tuyến ổn định; `options` — nguyên nhân tuỳ chọn.
   * Trả: đối tượng lỗi đã đặt `name` = `SessionReferenceError` và `code` đã cho.
   */
  constructor(message: string, code: SessionReferenceErrorCode, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = "SessionReferenceError";
  }
}
