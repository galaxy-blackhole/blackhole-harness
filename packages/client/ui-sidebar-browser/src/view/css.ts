/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc CSS nguyen van cua ban goc (Browser.module.css) + bang ten lop + the style tu dang ky
 */

import { CSS_TAG_ID, PACKAGE_NAME } from "../ids.ts";

/** CSS da thu nho, nguyen van tung byte tu bundle goc (lop giu nguyen hash `SB_kFW_*`). */
const CSS = [
  ".SB_kFW_root{height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base)",
  ";flex-direction:column;flex:auto;display:flex}",
  ".SB_kFW_toolbar{box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l3);flex:none;align-item",
  "s:center;gap:4px;height:38px;padding:5px 6px;display:flex}",
  ".SB_kFW_tool{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);",
  "cursor:pointer;background:0 0;border:0;flex:none;justify-content:center;align-items:center;padding:0;display:i",
  "nline-flex}",
  ".SB_kFW_tool:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-",
  "bg-hover)}.SB_kFW_tool:disabled{color:var(--dsw-alias-label-quaternary);cursor:default}",
  ".SB_kFW_sandboxOff{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-st",
  "ate-error-primary) 10%, transparent)}.SB_kFW_addressBox{flex:auto;min-width:0;position:relative}",
  ".SB_kFW_address{box-sizing:border-box;width:100%;height:28px;color:var(--dsw-alias-label-primary);font:var(--d",
  "sw-font-xxs-12);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-rad",
  "ius:var(--dsw-radius-sm);padding:0 34px 0 9px}",
  ".SB_kFW_addressGo{visibility:hidden;opacity:0;position:absolute;top:0;right:0}",
  ".SB_kFW_addressBox:focus-within .SB_kFW_addressGo{visibility:visible;opacity:1}",
  ".SB_kFW_addressUnknown{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(",
  "--dsw-alias-scrollbar-hover-l2);color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2)}",
  ".SB_kFW_addressUnknown:focus{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}",
  ".SB_kFW_addressChanged{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);pointer-events:none;",
  "background:var(--dsw-alias-bg-layer-2);padding-left:8px;line-height:16px;position:absolute;top:6px;right:8px}",
  ".SB_kFW_addressBox:focus-within .SB_kFW_addressChanged{visibility:hidden;opacity:0}",
  ".SB_kFW_address:focus{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:-1px}",
  ".SB_kFW_frame{background:var(--dsw-alias-bg-base);border:0;flex:auto;width:100%;min-height:0;display:flex}",
  ".SB_kFW_content{flex:auto;min-width:0;min-height:0;display:flex;position:relative}",
  ".SB_kFW_viewport{flex:auto;min-width:0;min-height:0;display:flex}",
  ".SB_kFW_placeholder{pointer-events:none;display:flex;position:absolute;inset:0}",
  ".SB_kFW_restore{text-align:center;flex-direction:column;align-items:center;gap:10px;padding:24px;display:flex;",
  "position:absolute;inset:0;overflow:auto}",
  ".SB_kFW_restoreLabel{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);margin:auto 0 0}",
  ".SB_kFW_restoreTitle{overflow-wrap:anywhere;max-width:100%;font:var(--dsw-font-xs-13);margin:0;font-weight:500}",
  ".SB_kFW_restoreUrl{overflow-wrap:anywhere;max-width:100%;color:var(--dsw-alias-label-secondary);font:var(--dsw",
  "-font-xxs-12);margin:0}.SB_kFW_restore>:last-child{flex-shrink:0;margin-bottom:auto}",
  ".SB_kFW_webview{-webkit-app-region:no-drag;border:0;flex:auto;width:100%;min-width:0;height:100%;min-height:0;",
  "display:flex}html:has([data-dockkit-pointer]) .SB_kFW_webview{pointer-events:none}",
  ".SB_kFW_start{min-height:0;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xs-13);text-align:center;",
  "flex:auto;justify-content:center;align-items:center;padding:24px;display:flex}",
  ".SB_kFW_failure{color:var(--dsw-alias-state-error-primary);font:var(--dsw-font-xxxs-11);background:color-mix(i",
  "n srgb, var(--dsw-alias-state-error-primary) 8%, transparent);flex:none;padding:6px 12px}",
  ".SB_kFW_sandboxWarning{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-11);background:var(--ds",
  "w-alias-state-warn-tertiary);flex:none;padding:6px 12px}",
  ".SB_kFW_limit{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);text-overflow:ellipsis;white-",
  "space:nowrap;border-top:.5px solid var(--dsw-alias-border-l3);flex:none;margin:0;padding:4px 10px;overflow:hid",
  "den}.SB_kFW_titleIcon{flex:none;margin-right:4px}",
].join("");

/** Bang ten lop ma CSS module cua ban goc phoi ra. */
export const CLASS = {
  address: "SB_kFW_address",
  addressBox: "SB_kFW_addressBox",
  addressChanged: "SB_kFW_addressChanged",
  addressGo: "SB_kFW_addressGo",
  addressUnknown: "SB_kFW_addressUnknown",
  content: "SB_kFW_content",
  failure: "SB_kFW_failure",
  frame: "SB_kFW_frame",
  limit: "SB_kFW_limit",
  placeholder: "SB_kFW_placeholder",
  restore: "SB_kFW_restore",
  restoreLabel: "SB_kFW_restoreLabel",
  restoreTitle: "SB_kFW_restoreTitle",
  restoreUrl: "SB_kFW_restoreUrl",
  root: "SB_kFW_root",
  sandboxOff: "SB_kFW_sandboxOff",
  sandboxWarning: "SB_kFW_sandboxWarning",
  start: "SB_kFW_start",
  titleIcon: "SB_kFW_titleIcon",
  tool: "SB_kFW_tool",
  toolbar: "SB_kFW_toolbar",
  viewport: "SB_kFW_viewport",
  webview: "SB_kFW_webview",
} as const;

/**
 * Chen the style cua row vao head dung MOT lan (khuon cua ban goc: khoa theo data-plugin-css).
 * Nhan: khong co.
 * Tra: khong co — the da co thi thoi.
 */
export function installBrowserCss(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG_ID) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = CSS_TAG_ID;
  tag.textContent = CSS;
  document.head.appendChild(tag);
}
