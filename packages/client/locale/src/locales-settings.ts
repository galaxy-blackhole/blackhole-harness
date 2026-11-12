/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Tu dien namespace \`settings.locale\` — chu cua dong Language trong Settings
 */

/** Tập khoá của `settings.locale`. */
export type SettingsLocaleKey = "language.title";

/** Bản tiếng Trung giản thể (nguồn của tập khoá). */
export const zh: Record<SettingsLocaleKey, string> = { "language.title": "语言" };

/** Bản tiếng Anh (đủ khoá như bản zh). */
export const en: Record<SettingsLocaleKey, string> = { "language.title": "Language" };
