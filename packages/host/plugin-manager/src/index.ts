/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mặt vào của gói plugin-manager: export ĐÚNG năm tên như bản gốc
 *      (InvalidInstallSpecError · PluginManager · default · classifyInstallFailure · parseInstallSpec)
 */

export { classifyInstallFailure } from "./install-failure.ts";
export { InvalidInstallSpecError, parseInstallSpec } from "./install-spec.ts";
export { PluginManager } from "./manager.ts";
export { default } from "./manager.ts";
export type * from "./types.ts";
export type { InstallFailureFacts } from "./install-failure.ts";
export type { ParsedInstallSpec } from "./install-spec.ts";
export type { Config } from "./manager-support.ts";
