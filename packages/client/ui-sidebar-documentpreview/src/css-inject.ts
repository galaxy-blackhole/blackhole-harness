/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chen muoi module CSS NGUYEN VAN cua ban goc vao document, moi module mot the style
 */

import { CSS_TAGS } from "./css-registry.ts";
import { PACKAGE_NAME } from "./ids.ts";

/** CSS cua LoadingIndicator.module.css — build.ts nhung bang define; chay tu nguon (test) thi la chuoi rong. */
declare const __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_LoadingIndicator__: string;
/** CSS cua TextPreview.module.css — build.ts nhung bang define. */
declare const __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_TextPreview__: string;
/** CSS cua MarkdownBody.module.css — build.ts nhung bang define. */
declare const __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_MarkdownBody__: string;
/** CSS cua HtmlBody.module.css — build.ts nhung bang define. */
declare const __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_HtmlBody__: string;
/** CSS cua ZoomControls.module.css — build.ts nhung bang define. */
declare const __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_ZoomControls__: string;
/** CSS cua ZoomViewport.module.css — build.ts nhung bang define. */
declare const __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_ZoomViewport__: string;
/** CSS cua ImageBody.module.css — build.ts nhung bang define. */
declare const __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_ImageBody__: string;
/** CSS cua CodeBody.module.css — build.ts nhung bang define. */
declare const __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_CodeBody__: string;
/** CSS cua OfficeBody.module.css — build.ts nhung bang define. */
declare const __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_OfficeBody__: string;
/** CSS cua FontNotice.module.css — build.ts nhung bang define. */
declare const __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_FontNotice__: string;

/**
 * Doc mot hang CSS do build.ts nhung, chiu duoc ca truong hop chay tu nguon (test).
 * Nhan: value — gia tri da nhung, co the la undefined khi chay khong qua build.
 * Tra: van ban CSS, hoac chuoi rong.
 */
function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Van ban CSS cua tung module, theo dung thu tu ban goc chen. */
const CSS_TEXT: Readonly<Record<string, string>> = {
  LoadingIndicator: textOf(typeof __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_LoadingIndicator__ === "string" ? __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_LoadingIndicator__ : ""),
  TextPreview: textOf(typeof __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_TextPreview__ === "string" ? __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_TextPreview__ : ""),
  MarkdownBody: textOf(typeof __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_MarkdownBody__ === "string" ? __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_MarkdownBody__ : ""),
  HtmlBody: textOf(typeof __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_HtmlBody__ === "string" ? __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_HtmlBody__ : ""),
  ZoomControls: textOf(typeof __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_ZoomControls__ === "string" ? __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_ZoomControls__ : ""),
  ZoomViewport: textOf(typeof __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_ZoomViewport__ === "string" ? __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_ZoomViewport__ : ""),
  ImageBody: textOf(typeof __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_ImageBody__ === "string" ? __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_ImageBody__ : ""),
  CodeBody: textOf(typeof __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_CodeBody__ === "string" ? __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_CodeBody__ : ""),
  OfficeBody: textOf(typeof __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_OfficeBody__ === "string" ? __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_OfficeBody__ : ""),
  FontNotice: textOf(typeof __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_FontNotice__ === "string" ? __GBH_UI_SIDEBAR_DOCUMENTPREVIEW_CSS_FontNotice__ : ""),
};

/**
 * Chen mot the style neu chua co.
 * Nhan: tagId — id gan vao data-plugin-css; cssText — van ban CSS.
 * Tra: khong.
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
 * Chen CSS cua ca muoi module, dung id the NGUYEN VAN cua ban goc (nen bang goc va bang ta dung
 * chung mot the, khong bao gio chen hai lan).
 * Nhan: khong.
 * Tra: khong.
 */
export function injectStyles(): void {
  for (const [name, cssText] of Object.entries(CSS_TEXT)) {
    const tagId = (CSS_TAGS as Record<string, string>)[name];
    if (tagId === undefined) continue;
    injectStyle(tagId, cssText);
  }
}

/** Van ban CSS da nhung theo ten module — dung cho test doi chieu byte. */
export const INJECTED_CSS: Readonly<Record<string, string>> = CSS_TEXT;
