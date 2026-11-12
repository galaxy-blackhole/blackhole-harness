/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa host của row ui-plugin-manager: export DUY NHẤT là default (PluginRegistryProbe) như bản gốc
 *
 * ⚠️ TRƯỚC 18/10/2026 file này export apply() rỗng — SAI với bản gốc: lib/index.js của
 *    @deepseek-ai/dsh-client-ui-plugin-manager chỉ export default (PluginRegistryProbe) và KHÔNG có apply.
 *    Reviewer bắt đúng lỗi này; đã port 1:1 lớp dò registry (xem src/probe.ts).
 */

export { default } from "./probe.ts";
export type { Config } from "./probe.ts";
