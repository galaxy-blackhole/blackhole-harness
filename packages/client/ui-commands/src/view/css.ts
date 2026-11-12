/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc CSS cua the chon popupSelect — NGUYEN VAN TUNG BYTE tu bundle goc (giu nguyen hash lop mufS8W_*)
 */

import { PACKAGE_NAME, STYLE_TAG_SUFFIX } from "../ids.ts";

/**
 * Van ban CSS nguyen van cua module PopupSelectView.module.css trong bundle goc.
 * Nhan: khong co.
 * Tra: chuoi CSS (giu nguyen tien to hash mufS8W_ cua ban goc).
 */
export const CSS_TEXT = ".mufS8W_card{box-sizing:border-box;z-index:100;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);min-width:min(220px,100%);max-width:100%;max-height:320px;box-shadow:var(--dsw-elevation-prominent);border:0;outline:none;flex-direction:column;padding:4px;display:flex;position:absolute;bottom:calc(100% + 4px);left:0;right:0;overflow:hidden}.mufS8W_viewport{flex-direction:column;min-height:0;display:flex;overflow-y:auto}.mufS8W_row{border-radius:var(--dsw-radius-md);cursor:pointer;color:var(--dsw-alias-label-primary);align-items:center;gap:6px;padding:5px 7px;font-size:12px;display:flex}.mufS8W_rowActive{background:var(--dsw-alias-interactive-bg-hover)}.mufS8W_label{flex:0 auto;align-items:baseline;gap:4px;min-width:0;display:flex}.mufS8W_labelText{white-space:nowrap;text-overflow:ellipsis;min-width:0;overflow:hidden}.mufS8W_badge{color:var(--dsw-alias-label-tertiary);letter-spacing:.2px;flex:none;align-self:flex-start;margin-top:-1px;font-size:8px;font-weight:600;line-height:10px}.mufS8W_detail{min-width:0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;flex:1;font-size:11px;overflow:hidden}.mufS8W_check{color:var(--dsw-alias-label-primary);flex:none;margin-left:auto;display:inline-flex}.mufS8W_check svg{width:14px;height:14px}.mufS8W_status{color:var(--dsw-alias-label-tertiary);padding:7px 8px;font-size:12px}.mufS8W_search{border-radius:var(--dsw-radius-md);color:var(--dsw-alias-label-primary);background:0 0;border:.5px solid #0000;outline:none;margin:2px 2px 3px;padding:5px 7px;font-size:12px}.mufS8W_error{color:var(--dsw-alias-state-error-primary);align-items:center;gap:6px;padding:5px 7px;font-size:11px;display:flex}.mufS8W_errorText{text-overflow:ellipsis;flex:1;overflow:hidden}.mufS8W_retry{border:.5px solid var(--dsw-alias-border-inverted);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;padding:2px 7px;font-size:11px}";

/**
 * Bang ten lop da bam (nguyen van tu ban goc) — dung truc tiep trong cay render.
 * Nhan: khong co.
 * Tra: doi tuong ten lop -> ten that.
 */
export const CLASS = {
  badge: "mufS8W_badge",
  card: "mufS8W_card",
  check: "mufS8W_check",
  detail: "mufS8W_detail",
  error: "mufS8W_error",
  errorText: "mufS8W_errorText",
  label: "mufS8W_label",
  labelText: "mufS8W_labelText",
  retry: "mufS8W_retry",
  row: "mufS8W_row",
  rowActive: "mufS8W_rowActive",
  search: "mufS8W_search",
  status: "mufS8W_status",
  viewport: "mufS8W_viewport",
} as const;

/**
 * Chen the style cua module vao head dung MOT lan (idempotent theo data-plugin-css) — nguyen van cach lam cua ban goc.
 * Nhan: khong co.
 * Tra: khong co.
 */
export function installCss(): void {
  if (typeof document === "undefined") return;
  const tagId = PACKAGE_NAME + STYLE_TAG_SUFFIX;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = CSS_TEXT;
  document.head.appendChild(tag);
}
