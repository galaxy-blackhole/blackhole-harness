/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Schema cấu hình của tool-jobs — NGUYÊN VĂN `const Config = z.object({...})` của bundle gốc @deepseek-ai/dsh-tool-jobs, dựng bằng schemastery THẬT (đúng thứ tự trường, default, union): cùng lớp Schema, cùng String(Config), cùng giá trị mặc định và mọi thông điệp lỗi.
 */

import z from "@deepseek-ai/schemastery";

/** Cách một hoàn tất không được thu thập đến chủ sở hữu đang rảnh — NGUYÊN VĂN bản gốc. Nhận: không. Trả: hai giá trị hợp lệ quiet | wakeup. */
export type CompletionDelivery = "quiet" | "wakeup";

/** Cấu hình của plugin — NGUYÊN VĂN Config trong lib/types/index.d.ts của bản gốc. Nhận: không. Trả: hình dạng cấu hình đã chuẩn hoá. */
export interface Config {
  /** Thời gian chờ mặc định khi job_output đặt wait mà không có timeout_ms (mặc định 30 giây). */
  waitTimeoutMs?: number;
  /** Trần cứng cho mọi lượt chờ; timeout_ms lớn hơn bị kẹp xuống (mặc định 10 phút). */
  maxWaitTimeoutMs?: number;
  /** Có mở lượt cho chủ sở hữu rảnh hay không (mặc định wakeup). */
  completionDelivery?: CompletionDelivery;
  /**
   * Số lượt một chủ sở hữu được mở bởi hoàn tất trước khi thông báo kế tiếp hạ xuống inject,
   * đặt lại bởi mọi đầu vào do người dùng viết. Vắng mặc định: mọi hoàn tất đều đánh thức.
   */
  maxConsecutiveWakes?: number;
}

/**
 * Schema cấu hình của tool-jobs — NGUYÊN VĂN `const Config = z.object({...})` của bản gốc:
 * cùng thứ tự trường, cùng `min(1)`, cùng default (wait 30 giây · cap 10 phút · delivery wakeup)
 * và cùng union miền giá trị. Loader/config-editor của kernel đọc chính schema này để điền mặc định.
 * Nhận: value — cấu hình thô (có thể thiếu, null hoặc sai kiểu).
 * Trả: cấu hình đã điền đủ ba trường có mặc định, giữ nguyên khoá lạ như bản gốc.
 * @throws {ValidationError} khi gốc không phải object hoặc một trường sai kiểu/giới hạn.
 */
export const Config = z.object({
  waitTimeoutMs: z.number().min(1).default(3e4),
  maxWaitTimeoutMs: z.number().min(1).default(6e5),
  completionDelivery: z.union(["quiet", "wakeup"]).default("wakeup"),
  maxConsecutiveWakes: z.number().min(1),
});
