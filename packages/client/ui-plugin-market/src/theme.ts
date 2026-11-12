/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc CSS của tab Discover — giữ nguyên khai báo của bản gốc, đổi tiền tố lớp dq5LxG_ thành gbhMkt_
 */

import { PACKAGE_NAME } from "./ids.ts";

/** CSS của tab Discover; chỉ dùng token --dsw-* như bản gốc, không thêm màu/số literal. */
export const DISCOVER_CSS = ".gbhMkt_section{flex-direction:column;gap:16px;display:flex}.gbhMkt_toolbar{align-items:center;gap:8px;display:flex}.gbhMkt_marketButton{max-width:240px;margin-left:-8px;font-weight:500}.gbhMkt_marketName{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.gbhMkt_search{flex:1;min-width:120px}.gbhMkt_categories{flex-wrap:wrap;align-items:center;gap:6px;display:flex}.gbhMkt_muted,.gbhMkt_meta{color:var(--dsw-alias-label-tertiary);margin:0;font-size:13px;line-height:20px}.gbhMkt_meta{overflow-wrap:anywhere;font-size:12px;line-height:18px}.gbhMkt_strong{overflow-wrap:anywhere;font-size:14px;font-weight:500;line-height:20px}.gbhMkt_error{color:var(--dsw-alias-state-error-primary);align-items:center;gap:6px;margin:0;font-size:13px;line-height:20px;display:inline-flex}.gbhMkt_failure{align-items:center;gap:10px;display:flex}.gbhMkt_notice{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-label-secondary);align-items:flex-start;gap:8px;margin:0;padding:10px 12px;font-size:12px;line-height:18px;display:flex}.gbhMkt_notice>svg{color:var(--dsw-alias-state-warn-primary);flex:none;margin-top:2px}.gbhMkt_cards{flex-direction:column;gap:2px;margin:0;padding:0;list-style:none;display:flex}.gbhMkt_card{border-radius:var(--dsw-radius-xl);align-items:center;gap:14px;margin:0 -8px;padding:8px;display:flex;position:relative}.gbhMkt_card:hover{background:var(--dsw-alias-interactive-bg-hover)}.gbhMkt_icon{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);width:48px;height:48px;color:var(--dsw-alias-label-secondary);flex:none;justify-content:center;align-items:center;display:inline-flex}.gbhMkt_image{object-fit:contain}.gbhMkt_main{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.gbhMkt_titleRow{flex-wrap:wrap;align-items:center;gap:8px;min-width:0;display:flex}.gbhMkt_cardOpen{max-width:100%;color:inherit;font:inherit;text-align:left;cursor:pointer;text-overflow:ellipsis;white-space:nowrap;background:0 0;border:0;padding:0;font-size:14px;font-weight:500;line-height:20px;overflow:hidden}.gbhMkt_cardOpen:after{content:\"\";border-radius:var(--dsw-radius-xl);position:absolute;inset:0}.gbhMkt_cardOpen:focus-visible{outline:none}.gbhMkt_cardOpen:focus-visible:after{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.gbhMkt_description{color:var(--dsw-alias-label-tertiary);-webkit-line-clamp:1;-webkit-box-orient:vertical;font-size:13px;line-height:18px;display:-webkit-box;overflow:hidden}.gbhMkt_cardEnd{z-index:1;flex:none;align-items:center;gap:8px;display:inline-flex;position:relative}.gbhMkt_blocked{opacity:.5;cursor:not-allowed}.gbhMkt_more{align-self:center}.gbhMkt_empty{text-align:center;flex-direction:column;align-items:center;gap:8px;padding:64px 0;display:flex}.gbhMkt_emptyTitle{margin:8px 0 0;font-size:14px;font-weight:500;line-height:20px}.gbhMkt_empty>button{margin-top:8px}.gbhMkt_detail{flex-direction:column;gap:16px;display:flex}.gbhMkt_crumb{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;align-self:flex-start;align-items:center;gap:6px;padding:0;font-size:12.5px;display:inline-flex}.gbhMkt_crumb:hover{color:var(--dsw-alias-label-primary)}.gbhMkt_crumb:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.gbhMkt_crumbIcon{transform:rotate(90deg)}.gbhMkt_detailHead{align-items:center;gap:14px;display:flex}.gbhMkt_detailTitle{margin:0;font-size:20px;font-weight:500;line-height:28px}.gbhMkt_detailDescription{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere;margin:0;font-size:14px;line-height:22px}.gbhMkt_detailSection{flex-direction:column;gap:12px;margin-top:16px;display:flex}.gbhMkt_sectionTitle{margin:0;font-size:14px;font-weight:500;line-height:20px}.gbhMkt_facts{margin:0}.gbhMkt_facts div{border-bottom:.5px solid var(--dsw-alias-border-l2);justify-content:space-between;align-items:center;gap:16px;min-height:44px;padding:8px 2px;display:flex}.gbhMkt_facts dt{color:var(--dsw-alias-label-secondary);flex:none;font-size:13px;line-height:20px}.gbhMkt_facts dd{text-align:end;overflow-wrap:anywhere;min-width:0;margin:0;font-size:13px;line-height:20px}.gbhMkt_facts code{background:var(--dsw-alias-bg-module-platform);box-decoration-break:clone;font-family:var(--ds-font-family-code);border-radius:4px;padding:2px 6px;font-size:12px}.gbhMkt_tags{flex-wrap:wrap;justify-content:flex-end;gap:6px;display:flex}.gbhMkt_dialog{width:min(480px,100vw - 32px)}.gbhMkt_dialogBody{flex-direction:column;gap:12px;display:flex}.gbhMkt_sourceList,.gbhMkt_versions{flex-direction:column;margin:0;padding:0;list-style:none;display:flex}.gbhMkt_sourceRow,.gbhMkt_versionRow{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:8px 0;display:flex}.gbhMkt_sourceError{color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;font-size:12px;line-height:18px}.gbhMkt_sourceForm{align-items:center;gap:8px;display:flex}.gbhMkt_grow{flex:1;min-width:0}.gbhMkt_confirmHead{align-items:center;gap:14px;display:flex}.gbhMkt_skeletonFill{background:var(--dsw-alias-bg-skeleton);animation:2s cubic-bezier(.36,0,.64,1) infinite gbhMkt_dsh-market-skeleton}.gbhMkt_icon.gbhMkt_skeletonFill{border-color:#0000}.gbhMkt_skeletonBar{border-radius:var(--dsw-radius-xs);height:12px;margin:4px 0;display:block}.gbhMkt_skeletonTitle{width:min(144px,60%)}.gbhMkt_skeletonDescription{width:min(280px,85%)}@keyframes gbhMkt_dsh-market-skeleton{0%{opacity:1}40%{opacity:.6}80%,to{opacity:1}}@media (prefers-reduced-motion:reduce){.gbhMkt_skeletonFill{animation:none}}.gbhMkt_link{color:var(--dsw-alias-link);overflow-wrap:anywhere;text-decoration:none}.gbhMkt_link:hover{text-decoration:underline}";

/** Id của thẻ style, để chỉ chèn một lần cho mỗi tài liệu. */
export const STYLE_TAG_ID = PACKAGE_NAME + "/DiscoverSection.module.css";

/** Tên lớp sau khi đổi tiền tố (khoá giữ nguyên như bản gốc). */
export const CSS: Readonly<Record<string, string>> = Object.freeze({
  "blocked": "gbhMkt_blocked",
  "card": "gbhMkt_card",
  "cardEnd": "gbhMkt_cardEnd",
  "cardOpen": "gbhMkt_cardOpen",
  "cards": "gbhMkt_cards",
  "categories": "gbhMkt_categories",
  "confirmHead": "gbhMkt_confirmHead",
  "crumb": "gbhMkt_crumb",
  "crumbIcon": "gbhMkt_crumbIcon",
  "description": "gbhMkt_description",
  "detail": "gbhMkt_detail",
  "detailDescription": "gbhMkt_detailDescription",
  "detailHead": "gbhMkt_detailHead",
  "detailSection": "gbhMkt_detailSection",
  "detailTitle": "gbhMkt_detailTitle",
  "dialog": "gbhMkt_dialog",
  "dialogBody": "gbhMkt_dialogBody",
  "empty": "gbhMkt_empty",
  "emptyTitle": "gbhMkt_emptyTitle",
  "error": "gbhMkt_error",
  "facts": "gbhMkt_facts",
  "failure": "gbhMkt_failure",
  "grow": "gbhMkt_grow",
  "icon": "gbhMkt_icon",
  "image": "gbhMkt_image",
  "link": "gbhMkt_link",
  "main": "gbhMkt_main",
  "marketButton": "gbhMkt_marketButton",
  "marketName": "gbhMkt_marketName",
  "meta": "gbhMkt_meta",
  "more": "gbhMkt_more",
  "muted": "gbhMkt_muted",
  "notice": "gbhMkt_notice",
  "search": "gbhMkt_search",
  "section": "gbhMkt_section",
  "sectionTitle": "gbhMkt_sectionTitle",
  "skeletonBar": "gbhMkt_skeletonBar",
  "skeletonDescription": "gbhMkt_skeletonDescription",
  "skeletonFill": "gbhMkt_skeletonFill",
  "skeletonTitle": "gbhMkt_skeletonTitle",
  "sourceError": "gbhMkt_sourceError",
  "sourceForm": "gbhMkt_sourceForm",
  "sourceList": "gbhMkt_sourceList",
  "sourceRow": "gbhMkt_sourceRow",
  "strong": "gbhMkt_strong",
  "tags": "gbhMkt_tags",
  "titleRow": "gbhMkt_titleRow",
  "toolbar": "gbhMkt_toolbar",
  "versionRow": "gbhMkt_versionRow",
  "versions": "gbhMkt_versions",
});

/**
 * Chèn CSS của tab vào tài liệu đúng một lần.
 * Nhận: không (đọc document của trang).
 * Trả: không — thẻ style đã có thì bỏ qua, môi trường không có document thì không làm gì.
 */
export function ensureDiscoverCss(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_TAG_ID) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = STYLE_TAG_ID;
  tag.textContent = DISCOVER_CSS;
  document.head.appendChild(tag);
}
