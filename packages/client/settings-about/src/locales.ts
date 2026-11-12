/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Từ điển ba ngôn ngữ của namespace `settings.about`.
 *   ⚠️ 07/11/2026 — BỎ khoá `about.version`/`about.current` (dòng "Phiên bản gói" đã xoá khỏi panel);
 *   BỔ SUNG bản dịch vi còn thiếu cho khoá đang hiển thị (`about.zaloCard`): rơi về tiếng Anh trên app thật.
 */

/** Khoá từ điển (trùng tên namespace mà plugin bind). */
export const LOCALE_KEY = "settings.about";

/** Từ điển tiếng Anh. */
export const en: Readonly<Record<string, string>> = {
  "about.email": "Email",
  "about.zaloCard": "Zalo contact card",
  "about.nav": "About",
  "about.title": "Galaxy Blackhole",
  "about.tagline": "A desktop harness rewritten from Galaxy Blackhole",
  "about.author": "Author",
  "about.section": "This panel is an INDEPENDENT package, not a replacement for any GBH row.",
};

/** Từ điển tiếng Việt. */
export const vi: Readonly<Record<string, string>> = {
  "about.nav": "Thông tin",
  "about.title": "Galaxy Blackhole",
  "about.tagline": "Bộ khung desktop viết lại từ Galaxy Blackhole",
  "about.zaloCard": "Thẻ liên hệ Zalo",
  "about.email": "Email",
  "about.author": "Tác giả",
  "about.section": "Panel này là một package ĐỘC LẬP, không thay thế row nào của GBH.",
};

/** Từ điển tiếng Trung. */
export const zh: Readonly<Record<string, string>> = {
  "about.nav": "关于",
  "about.title": "Galaxy Blackhole",
  "about.tagline": "基于 Galaxy Blackhole 重写的桌面框架",
  "about.author": "作者",
  "about.section": "本面板是一个独立包，不替代 GBH 的任何行。",
};

