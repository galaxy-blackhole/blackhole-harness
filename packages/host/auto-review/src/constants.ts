/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hằng số của row auto-review — NGUYÊN VĂN từ gói gốc @deepseek-ai/dsh-experimental-auto-review
 *      (chỉ đọc). Hai hằng của gói khác (`auto` của dsh-permission-presets, `run_code` của dsh-tools)
 *      được khai lại TẠI CHỖ vì cả hai là giá trị chuỗi của giao thức, không phải seam cần thể hiện
 *      duy nhất — xem README gói §2.
 */

/** Tên plugin cordis mà tầng nạp dùng cho chẩn đoán — nguyên văn bản gốc. */
export const PLUGIN_NAME = "experimental-auto-review";

/** Tên lỗi có cấu trúc được ghi bền cho MỌI lời từ chối cuối cùng của bộ duyệt. */
export const AUTO_REVIEW_DENIED_ERROR_NAME = "AutoReviewDeniedError";

/** Mã lỗi có cấu trúc được ghi bền cho MỌI lời từ chối cuối cùng của bộ duyệt. */
export const AUTO_REVIEW_DENIED_CODE = "AUTO_REVIEW_DENIED";

/** Preset quyền chỉ-sống-theo-tích-hợp mà cổng duyệt phục vụ — nguyên văn `AUTO_PRESET` của `dsh-permission-presets`. */
export const AUTO_PRESET = "auto";

/** Tên tool vận chuyển ngoài cùng được MIỄN duyệt — nguyên văn `RUN_CODE_NAME` của `dsh-tools`. */
export const RUN_CODE_NAME = "run_code";

/** Preset mà phiên Auto đang sống được CHUYỂN VỀ khi gỡ tích hợp — nguyên văn bản gốc. */
export const DANGER_FULL_ACCESS = "danger-full-access";
