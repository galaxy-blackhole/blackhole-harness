/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Bề mặt công khai của @galaxy-blackhole/gbh-host-skill-filesystem — tái xuất ĐÚNG 5 tên của
 *      bundle gốc @galaxy-blackhole/gbh-skill-filesystem (Config, FileSystemSkillProvider, apply, inject,
 *      name), không thêm không bớt.
 */

/**
 * Tên plugin provider.
 * Nhận: không.
 * Trả: chuỗi `"skill-filesystem"` y bản gốc.
 */
export { name } from "./config.ts";

/**
 * Service bắt buộc của plugin.
 * Nhận: không.
 * Trả: mảng `["skills"]` y bản gốc.
 */
export { inject } from "./config.ts";

/**
 * Schema cấu hình (schemastery) kèm interface `Config` cùng tên.
 * Nhận: object cấu hình thô (mọi field tuỳ chọn).
 * Trả: object đã kiểm/điền mặc định; ném ValidationError khi sai kiểu.
 */
export { Config } from "./config.ts";

/**
 * Hàm đăng ký provider trên `ctx.skills`.
 * Nhận: ctx — context cordis; config — cấu hình provider.
 * Trả: không trả gì.
 * @throws {TypeError} khi context thiếu service `skills`.
 */
export { apply } from "./provider.ts";

/**
 * Provider kỹ năng cục bộ.
 * Nhận: ctx — context cordis; control — vòng đời registration; config — cấu hình provider.
 * Trả: instance provider dùng `list`/`get`.
 */
export { FileSystemSkillProvider } from "./provider.ts";
