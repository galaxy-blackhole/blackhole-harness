/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hằng số tuỳ chọn dịch (provider + mẫu ngôn ngữ) — NGUYÊN VĂN bản gốc lib/index.js §preferences
 */

/** Mẫu ngôn ngữ đích mà cả cấu hình Host lẫn bản nháp trên trình duyệt đều chấp nhận (auto = theo UI). */
export const LANGUAGE_PREFERENCE_PATTERN = /^(?:auto|[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*)$/;

/** Danh sách provider dịch tường minh — NGUYÊN VĂN thứ tự của bản gốc. */
export const PROVIDER_PREFERENCES = ["bing", "google", "deepseek-account", "deepseek-official"] as const;

/** Một provider dịch hợp lệ. */
export type TranslationProviderPreference = (typeof PROVIDER_PREFERENCES)[number];
