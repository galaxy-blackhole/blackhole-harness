/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Điểm vào của package permission: hai tên dành riêng + lớp service (cũng là default như bản gốc),
 *      kèm toàn bộ từ vựng kiểu mà bản gốc phơi qua `export type *`.
 */

export { AUTO_PRESET, CUSTOM_PRESET } from "./presets.ts";
export { PermissionPresetService, PermissionPresetService as default } from "./service.ts";
export type * from "./types.ts";
