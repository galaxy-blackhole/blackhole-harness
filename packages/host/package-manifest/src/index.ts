/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Khai báo KIỂU dùng chung cho các trường package.json.dsh — chép nguyên bộ .d.ts của @deepseek-ai/dsh-package-manifest (gói gốc lib/index.js chỉ là export {})
 */
/**
 * Public package manifest and plugin display types, with no runtime exports.
 * @module @deepseek-ai/dsh-package-manifest
 */
export type { DshBundleManifest, DshClientManifest, DshEnginesManifest, DshManifest, DshPackageManifest, DshProfileManifest, LocalizedText, PluginLocalizedMeta, } from './types.ts';
