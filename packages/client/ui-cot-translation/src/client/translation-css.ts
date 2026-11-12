/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc CSS của row cot-translation — NGUYÊN VĂN vùng \0dsh-css:...Translation.module.css.mjs
 *      trong bundle gốc lib/client.js (vùng 4); chỉ đổi id thẻ style/dataset.plugin sang id CỦA TA
 */

import { CSS_TAG_ID, PACKAGE_NAME } from "./ids.ts";

/** Toàn bộ CSS của row (nguyên văn bản gốc, kể cả hash lớp egK6ha_). */
export const TRANSLATION_CSS = ".egK6ha_toolbar{flex-wrap:wrap;align-items:center;gap:4px;min-height:28px;margin-bottom:4px;display:flex}.egK6ha_toolbar>.egK6ha_viewToggle{color:var(--dsw-alias-label-tertiary);margin-inline-start:-10px}.egK6ha_toolbar>.egK6ha_viewToggle:hover:not(:disabled),.egK6ha_toolbar>.egK6ha_viewToggle:active:not(:disabled),.egK6ha_toolbar>.egK6ha_viewToggle:focus-visible:not(:disabled){color:var(--dsw-alias-label-secondary)}.egK6ha_failure{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px)}.egK6ha_field{flex-direction:column;gap:8px;display:flex}.egK6ha_field label{color:var(--dsw-alias-label-primary);font-size:13px}.egK6ha_field select{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);min-height:32px;color:var(--dsw-alias-label-primary);font:inherit;padding:0 8px}.egK6ha_notice{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:20px}.egK6ha_spinner{animation:1s linear infinite egK6ha_cot-translation-spin}@keyframes egK6ha_cot-translation-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.egK6ha_spinner{animation:none}}";

/** Định danh thẻ <style> (id CỦA TA + tên tệp gốc). */
export const TRANSLATION_CSS_TAG_ID = CSS_TAG_ID;

if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(TRANSLATION_CSS_TAG_ID) + "]") === null) {
	const tag = document.createElement("style");
	tag.dataset.plugin = PACKAGE_NAME;
	tag.dataset.pluginCss = TRANSLATION_CSS_TAG_ID;
	tag.textContent = TRANSLATION_CSS;
	document.head.appendChild(tag);
}

/** Bảng lớp CSS mà hai component dùng (nguyên văn khoá + hash của bản gốc). */
export const TranslationStyles = {
	"cot-translation-spin": "egK6ha_cot-translation-spin",
	failure: "egK6ha_failure",
	field: "egK6ha_field",
	notice: "egK6ha_notice",
	spinner: "egK6ha_spinner",
	toolbar: "egK6ha_toolbar",
	viewToggle: "egK6ha_viewToggle",
};
