/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểu đầu vào Office đã cấp quyền và đầu ra PDF đầy đủ cho bộ chuyển đổi Host dùng chung — bản viết lại
 *      1:1 lib/types/types.d.ts của `@deepseek-ai/dsh-office-to-pdf`.
 */

import type { OfficeSourceKey, OfficeToPdfGeneration, OfficeToPdfKey } from "./identity.ts";

export type { OfficeSourceKey, OfficeToPdfGeneration, OfficeToPdfKey } from "./identity.ts";

/** Định dạng Office nhị phân và Office Open XML mà chuyển-đổi-sang-PDF hỗ trợ. */
export type OfficeExtension = "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx";

/** Xem trước tiền cảnh và kiểm thử tường minh đứng TRƯỚC chuyển đổi nền suy đoán. */
export type OfficeToPdfPriority = "foreground" | "background";

/** Cấp quyền nguồn và tra siêu dữ liệu phải xong TRƯỚC khi nộp yêu cầu. */
export interface OfficeToPdfRequest {
  /** Định dạng nguồn. */
  readonly extension: OfficeExtension;
  /** Mức ưu tiên. */
  readonly priority: OfficeToPdfPriority;
  /** Nguồn đã cấp quyền và hàm đọc CÓ TRẦN hoãn lại tới sau khi provider nhận. */
  readonly source: {
    /** Định vị nguồn đã cấp quyền. */
    readonly key: OfficeSourceKey;
    /** Version của nguồn tại thời điểm cấp quyền. */
    readonly version: string;
    /** Cỡ đã stat và đã cấp quyền; bỏ trống nghĩa là giữ trọn hạn mức đầu vào của provider. */
    readonly bytes?: number;
    /**
     * Chỉ đọc SAU khi provider nhận; không giữ sẵn dữ liệu đã đệm trong yêu cầu đang xếp hàng.
     * Nhận: tín hiệu của vòng đời chuyển đổi (độc lập với từng bên đọc), và sức chứa đã giữ chỗ.
     * Trả: byte sở hữu + version đọc được thực tế; version đổi thì chuyển đổi bị từ chối.
     */
    read(
      signal: AbortSignal,
      maxBytes: number,
    ): Promise<{ readonly bytes: Uint8Array; readonly version: string }>;
  };
}

/** Lần chuyển đổi THÀNH CÔNG; lần hỏng/bị ngắt thì reject. */
export interface OfficeToPdfResult {
  /** PDF đầy đủ thuộc bên gọi, vẫn hợp lệ sau khi provider bị dọn. */
  readonly pdf: Uint8Array;
  /** Họ font OOXML được yêu cầu mà lần chuyển đổi này KHÔNG có; định dạng nhị phân trả danh sách rỗng. */
  readonly missingFonts: string[];
  /** Định danh nội dung của PDF này. */
  readonly cacheKey: OfficeToPdfKey;
  /** Thế hệ provider đã tạo PDF. */
  readonly generation: OfficeToPdfGeneration;
}

/** Lỗi mà bên tiêu thụ chuyển đổi có thể trình bày mà KHÔNG lộ chẩn đoán engine. */
export type OfficeToPdfErrorCode =
  | "input-too-large"
  | "output-too-large"
  | "invalid-document"
  | "unsupported-format"
  | "invalid-output"
  | "timeout"
  | "unavailable"
  | "failed"
  | "busy"
  | "source-changed";

/** PDF mang danh tính tệp Office gốc cùng byte chuyển qua multipart. */
export interface RenderedDocumentBytes {
  /** Đường dẫn tuyệt đối của nguồn. */
  readonly absolutePath: string;
  /** Version nguồn tại thời điểm đọc. */
  readonly version: string;
  /** Byte đầu của cửa sổ (luôn 0 ở đây). */
  readonly offset: number;
  /** Luôn true: đầu ra là cả tệp. */
  readonly eof: boolean;
  /** Cỡ byte của PDF. */
  readonly bytes: number;
  /** Byte PDF. */
  readonly data: Uint8Array;
  /** Họ font thiếu. */
  readonly missingFonts: string[];
  /** Thế hệ provider. */
  readonly generation: OfficeToPdfGeneration;
}
