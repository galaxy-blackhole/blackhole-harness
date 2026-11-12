/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chen TAM the style cua row — nguyen van tung byte, dung id the y ban goc de khong chen hai lan
 */

import { PACKAGE_NAME, STYLE_TAGS } from "./ids.ts";

/** CSS cua tung module, do build.ts nhung bang define; chay tu nguon (test) thi tra bien toan cuc. */
declare const __GBH_UI_SETTINGS_ACCOUNT_SIGN_IN_DIALOG_CSS__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_PLATFORM_OVERLAY_CSS__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_AVATAR_CSS__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_NOTICE_CSS__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_MENU_CSS__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_SECTION_CSS__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_ONBOARDING_SURFACE_CSS__: string;
declare const __GBH_UI_SETTINGS_ACCOUNT_DESKTOP_ONBOARDING_CSS__: string;

/**
 * Doc mot hang CSS da nhung, chiu duoc truong hop chay tu nguon (khong co define).
 * Nhan: value — gia tri da nhung; global — ham doc bien toan cuc.
 * Tra: van ban CSS, hoac chuoi rong.
 */
function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Chen mot the style neu chua co.
 * Nhan: tagId — id gan vao data-plugin-css; cssText — van ban CSS.
 * Tra: khong co.
 */
export function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * Chen CSS cua ca TAM module, dung thu tu nhu ban goc.
 * Nhan: khong co.
 * Tra: khong co.
 */
export function injectStyles(): void {
  injectStyle(STYLE_TAGS.signInDialog, text(typeof __GBH_UI_SETTINGS_ACCOUNT_SIGN_IN_DIALOG_CSS__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_SIGN_IN_DIALOG_CSS__ : ""));
  injectStyle(STYLE_TAGS.platformOverlay, text(typeof __GBH_UI_SETTINGS_ACCOUNT_PLATFORM_OVERLAY_CSS__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_PLATFORM_OVERLAY_CSS__ : ""));
  injectStyle(STYLE_TAGS.accountAvatar, text(typeof __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_AVATAR_CSS__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_AVATAR_CSS__ : ""));
  injectStyle(STYLE_TAGS.accountNotice, text(typeof __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_NOTICE_CSS__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_NOTICE_CSS__ : ""));
  injectStyle(STYLE_TAGS.accountMenu, text(typeof __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_MENU_CSS__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_MENU_CSS__ : ""));
  injectStyle(STYLE_TAGS.accountSection, text(typeof __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_SECTION_CSS__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ACCOUNT_SECTION_CSS__ : ""));
  injectStyle(STYLE_TAGS.onboardingSurface, text(typeof __GBH_UI_SETTINGS_ACCOUNT_ONBOARDING_SURFACE_CSS__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_ONBOARDING_SURFACE_CSS__ : ""));
  injectStyle(STYLE_TAGS.desktopOnboarding, text(typeof __GBH_UI_SETTINGS_ACCOUNT_DESKTOP_ONBOARDING_CSS__ === "string" ? __GBH_UI_SETTINGS_ACCOUNT_DESKTOP_ONBOARDING_CSS__ : ""));
}
