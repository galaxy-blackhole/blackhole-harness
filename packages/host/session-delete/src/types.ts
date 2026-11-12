/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Mã lỗi Remote của tính năng xoá phiên (ADR 0016) — khai vào RemoteErrorDetailsMap để
 *      RemoteError giữ được kiểu chi tiết khi qua Gateway.
 */

declare module "@galaxy-blackhole/gbh-typert-protocol" {
  interface RemoteErrorDetailsMap {
    /** Id phiên không an toàn để dùng làm một đoạn đường dẫn. */
    "session/delete-invalid": {
      /** Giá trị thô client gửi lên. */
      readonly sessionId: string;
    };
    /** Phiên còn sống trong tiến trình hiện tại nên chưa xoá được. */
    "session/delete-live": {
      /** Id phiên đang sống. */
      readonly sessionId: string;
    };
    /** Thiếu seam lưu trữ phiên (hoặc thiếu gốc lưu trữ) — không thể xoá. */
    "session/delete-unavailable": {
      /** Id phiên cần xoá. */
      readonly sessionId: string;
    };
    /** Không tìm thấy phiên đã lưu (hoặc thư mục nhật ký của nó). */
    "session/delete-not-found": {
      /** Id phiên cần xoá. */
      readonly sessionId: string;
    };
    /** Nhiều thư mục nhật ký cùng khớp id — từ chối thay vì đoán. */
    "session/delete-ambiguous": {
      /** Id phiên cần xoá. */
      readonly sessionId: string;
      /** Số thư mục khớp. */
      readonly count: number;
    };
    /** Đường dẫn đích nằm ngoài gốc lưu trữ hoặc không giống thư mục nhật ký. */
    "session/delete-unsafe": {
      /** Đường dẫn thật đã giải symlink. */
      readonly path: string;
    };
    /** Gỡ thư mục thất bại (quyền truy cập, tệp đang mở…). */
    "session/delete-failed": {
      /** Id phiên cần xoá. */
      readonly sessionId: string;
    };
  }
}

/** Đánh dấu tệp là module để khai báo trên có hiệu lực. */
export {};
