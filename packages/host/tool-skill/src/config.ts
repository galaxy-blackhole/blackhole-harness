/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Schema cấu hình `Config` của tool-skill — NGUYÊN VĂN
 *      `const Config = z.object({ catalogDescriptionMaxLength: z.number().default(DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH) })`
 *      của bundle gốc, dựng bằng schemastery THẬT: cùng lớp Schema, cùng thứ tự trường, cùng default
 *      500, cùng String(Config) và mọi thông điệp lỗi.
 */

import z from "@deepseek-ai/schemastery";

/** Độ dài mô tả mặc định mà catalog phơi cho mô hình — NGUYÊN VĂN bản gốc. Nhận: không. Trả: 500. */
export const DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Cấu hình hướng mô hình của catalog kỹ năng — NGUYÊN VĂN `interface Config` trong
 * lib/types/index.d.ts của bản gốc (hợp nhất khai báo với schema cùng tên).
 * Nhận: — (kiểu chỉ tồn tại lúc biên dịch, không có giá trị chạy).
 * Trả: — (kiểu chỉ tồn tại lúc biên dịch, không có giá trị chạy).
 */
export interface Config {
  /**
   * Độ dài TỐI ĐA của mô tả đã chuẩn hoá khi render catalog phiên; tối thiểu 3.
   * Vắng mặt ⇒ 500 (giá trị mặc định của schema).
   */
  catalogDescriptionMaxLength?: number;
}

/**
 * Schema cấu hình của tool-skill — NGUYÊN VĂN `const Config = z.object({...})` của bản gốc:
 * cùng thứ tự trường, cùng `z.number()` và cùng default 500. Loader/config-editor của kernel đọc
 * chính schema này để điền mặc định trước khi gọi `apply`.
 * Nhận: value — cấu hình thô (có thể thiếu, null hoặc sai kiểu).
 * Trả: cấu hình đã điền `catalogDescriptionMaxLength`, giữ nguyên khoá lạ như bản gốc.
 * @throws {ValidationError} khi gốc không phải object hoặc trường sai kiểu.
 */
export const Config = z.object({ catalogDescriptionMaxLength: z.number().default(DEFAULT_CATALOG_DESCRIPTION_MAX_LENGTH) });
