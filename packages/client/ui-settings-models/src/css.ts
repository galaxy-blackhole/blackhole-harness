/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nhúng bốn thẻ style của row, đúng thứ tự bản gốc, CSS nguyên văn từng byte
 */

import { PACKAGE_NAME, STYLE_TAGS } from "./ids.ts";

/** CSS của ModelsSection.module.css, do build.ts nhúng bằng define. */
declare const __GBH_UI_SETTINGS_MODELS_SECTION_CSS__: string;
/** CSS của OnboardingModal.module.css, do build.ts nhúng bằng define. */
declare const __GBH_UI_SETTINGS_MODELS_ONBOARDING_CSS__: string;
/** CSS của DeepSeekOnboardingDialog.module.css, do build.ts nhúng bằng define. */
declare const __GBH_UI_SETTINGS_MODELS_SIGN_IN_CSS__: string;
/** CSS của WelcomeNotice.module.css, do build.ts nhúng bằng define. */
declare const __GBH_UI_SETTINGS_MODELS_WELCOME_CSS__: string;

/**
 * Đọc văn bản CSS đã nhúng, chịu được cả khi chạy từ nguồn (test) — khi đó define không tồn tại.
 * @param value - giá trị define (có thể chưa được thay).
 * @returns văn bản CSS, hoặc chuỗi rỗng khi chạy từ nguồn.
 */
function cssOf(value: string): string {
  return typeof value === "string" ? value : "";
}

/**
 * Chèn một thẻ style nếu chưa có.
 * @param tagId - id gắn vào data-plugin-css.
 * @param cssText - văn bản CSS.
 * @returns không.
 */
function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * Chèn CSS của cả bốn module, đúng thứ tự bản gốc.
 * @returns không.
 */
export function injectStyles(): void {
  injectStyle(STYLE_TAGS.section, cssOf(__GBH_UI_SETTINGS_MODELS_SECTION_CSS__));
  injectStyle(STYLE_TAGS.onboarding, cssOf(__GBH_UI_SETTINGS_MODELS_ONBOARDING_CSS__));
  injectStyle(STYLE_TAGS.signIn, cssOf(__GBH_UI_SETTINGS_MODELS_SIGN_IN_CSS__));
  injectStyle(STYLE_TAGS.welcome, cssOf(__GBH_UI_SETTINGS_MODELS_WELCOME_CSS__));
}
