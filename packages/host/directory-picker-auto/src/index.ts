/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Điểm vào của package directory-picker-auto: xuất ĐÚNG bề mặt bản gốc (không có default export).
 */
export { BACKEND_PACKAGES, SURFACE_PACKAGES, apply, inject, name } from "./plugin.ts";
export { canExecute, hasLinuxChooserBinary } from "./probe.ts";
export { resolveDirectoryPickerBackend } from "./resolve.ts";
export type { DirectoryPickerBackendKind, DirectoryPickerEnv, DirectoryPickerHostFacts } from "./resolve.ts";
