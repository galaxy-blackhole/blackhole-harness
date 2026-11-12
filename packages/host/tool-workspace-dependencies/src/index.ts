/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bề mặt xuất khẩu của @galaxy-blackhole/gbh-tool-workspace-dependencies, đúng 11 tên như bản gốc
 *      (bundle chỉ có MỘT vùng #region lib/types/index.js nên tách module theo trách nhiệm: config · metadata · payload · runtime · plugin).
 */

// Vùng #region lib/types/index.js của bundle gốc — hằng số + schema cấu hình.
export { Config, inject, name } from "./config.ts";
// Cùng vùng — hàm đọc/chuẩn hoá runtime.json.
export { parsePrimaryRuntime, readPrimaryRuntime } from "./metadata.ts";
// Cùng vùng — alias trình thông dịch, sao chép payload, đường dẫn nền tảng, kiểm điểm vào.
export { copyPrimaryRuntime, primaryRuntimePythonAliases, workspaceDependencyPaths } from "./payload.ts";
// Cùng vùng — dùng tại chỗ + cài payload.
export { installPrimaryRuntime, resolvePrimaryRuntime } from "./runtime.ts";
// Cùng vùng — đăng ký tool load_workspace_dependencies.
export { apply } from "./plugin.ts";
// Kiểu công khai của bản gốc (PrimaryRuntimeManifest · WorkspaceDependencies); interface Config đi kèm const Config.
export type { PrimaryRuntimeManifest, WorkspaceDependencies } from "./types.ts";
