/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng CSS module MenuView.module.css của bản gốc — chuỗi CSS + bảng lớp NGUYÊN VĂN, chèn thẻ <style> một lần
 */

import { CSS_TAG_ID, PACKAGE_NAME } from "./ids.ts";

/**
 * Toàn văn CSS module của menu ứng viên — giữ NGUYÊN VĂN chuỗi của bản gốc (kể cả tên lớp đã băm).
 * Nhận: không có.
 * Trả: chuỗi CSS.
 */
export const MENU_CSS = "._3e4SsG_menu{z-index:100;box-sizing:border-box;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);--dsh-scrollbar-width:6px;--dsh-scrollbar-thumb-border:2px;--dsh-scrollbar-track-margin:12px;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);max-height:400px;box-shadow:var(--dsw-elevation-prominent);border:0;flex-direction:column;padding:4px;display:flex;position:absolute;bottom:calc(100% + 4px);left:0;right:0;overflow:hidden}._3e4SsG_menu[data-overflow-below]:after{content:\"\";background:linear-gradient(to bottom, transparent, var(--dsw-specific-menu));pointer-events:none;height:16px;position:absolute;bottom:4px;left:4px;right:14px}._3e4SsG_viewport{flex-direction:column;min-height:0;display:flex;overflow-y:auto}._3e4SsG_item{border-radius:var(--dsw-radius-md);cursor:pointer;width:100%;min-height:34px;color:var(--dsw-alias-label-primary);text-align:left;background:0 0;border:none;align-items:center;gap:6px;padding:6px 8px;font-size:13px;line-height:20px;display:flex}._3e4SsG_item._3e4SsG_active{background:var(--dsw-alias-interactive-bg-hover)}._3e4SsG_sectionTitle{min-height:23px;color:var(--dsw-alias-label-tertiary);flex:none;padding:5px 8px 2px;font-size:11px;font-weight:500;line-height:16px}._3e4SsG_sectionTitle:not(:first-child){margin-top:3px}._3e4SsG_itemIcon{width:14px;height:14px;color:var(--dsw-alias-menu-icon);flex:none;justify-content:center;align-items:center;display:inline-flex}._3e4SsG_itemIcon svg{width:14px;height:14px}._3e4SsG_itemName{text-overflow:ellipsis;white-space:nowrap;flex:none;max-width:40%;overflow:hidden}._3e4SsG_itemAlias{text-overflow:ellipsis;white-space:nowrap;max-width:20%;color:var(--dsw-alias-label-tertiary);flex:none;font-size:12px;line-height:18px;overflow:hidden}._3e4SsG_itemDescription{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:var(--dsw-alias-label-tertiary);flex:1;font-size:12px;line-height:18px;overflow:hidden}._3e4SsG_trailing{flex:none;align-items:center;gap:3px;margin-left:auto;display:inline-flex}._3e4SsG_drillHintText{color:var(--dsw-alias-label-caption);white-space:nowrap;font-size:10px;line-height:16px;display:none}._3e4SsG_drillHint{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-caption);padding:0 4px;font-family:inherit;font-size:10px;line-height:16px;display:none}._3e4SsG_item._3e4SsG_active ._3e4SsG_drillHintText,._3e4SsG_item._3e4SsG_active ._3e4SsG_drillHint{display:inline-flex}._3e4SsG_drill{border-radius:var(--dsw-radius-xs);width:18px;height:18px;color:var(--dsw-alias-menu-icon);flex:none;place-items:center;display:inline-grid}._3e4SsG_drill:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._3e4SsG_groupTitle{color:var(--dsw-alias-label-tertiary);padding:6px 8px;font-size:11px;line-height:15px}._3e4SsG_skeletonRow{box-sizing:border-box;align-items:center;min-height:34px;padding:6px 8px;display:flex}._3e4SsG_skeletonBar{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-skeleton);height:18px;animation:2s cubic-bezier(.36,0,.64,1) infinite _3e4SsG_dsh-menu-skeleton}@keyframes _3e4SsG_dsh-menu-skeleton{0%{opacity:1}40%{opacity:.6}80%,to{opacity:1}}._3e4SsG_crumbs{border-bottom:.5px solid var(--dsw-alias-border-l1);flex-wrap:wrap;flex:none;align-items:center;gap:2px;margin-bottom:2px;padding:3px 3px 5px;display:flex}._3e4SsG_crumb{border-radius:var(--dsw-radius-sm);max-width:40%;color:var(--dsw-alias-label-tertiary);cursor:pointer;text-overflow:ellipsis;white-space:nowrap;background:0 0;border:none;flex:0 auto;padding:2px 5px;font-family:inherit;font-size:11px;line-height:16px;overflow:hidden}._3e4SsG_crumb:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._3e4SsG_crumbCurrent,._3e4SsG_crumbCurrent:hover{color:var(--dsw-alias-label-primary);cursor:default;background:0 0}._3e4SsG_crumbSeparator{color:var(--dsw-alias-menu-icon);flex:none;display:inline-flex}";

/**
 * Bảng lớp CSS module của menu — NGUYÊN VĂN bảng của bản gốc (khóa chuỗi, giá trị tên lớp đã băm).
 * Nhận: không có.
 * Trả: đối tượng ánh xạ tên lớp → tên đã băm.
 */
export const MENU_STYLES = {
"active": "_3e4SsG_active",
"crumb": "_3e4SsG_crumb",
"crumbCurrent": "_3e4SsG_crumbCurrent",
"crumbSeparator": "_3e4SsG_crumbSeparator",
"crumbs": "_3e4SsG_crumbs",
"drill": "_3e4SsG_drill",
"drillHint": "_3e4SsG_drillHint",
"drillHintText": "_3e4SsG_drillHintText",
"dsh-menu-skeleton": "_3e4SsG_dsh-menu-skeleton",
"groupTitle": "_3e4SsG_groupTitle",
"item": "_3e4SsG_item",
"itemAlias": "_3e4SsG_itemAlias",
"itemDescription": "_3e4SsG_itemDescription",
"itemIcon": "_3e4SsG_itemIcon",
"itemName": "_3e4SsG_itemName",
"menu": "_3e4SsG_menu",
"sectionTitle": "_3e4SsG_sectionTitle",
"skeletonBar": "_3e4SsG_skeletonBar",
"skeletonRow": "_3e4SsG_skeletonRow",
"trailing": "_3e4SsG_trailing",
"viewport": "_3e4SsG_viewport"
} as const;

/**
 * Chèn stylesheet của menu vào <head> đúng một lần (khóa theo data-plugin-css = id CỦA TA).
 * Bản gốc chèn ngay lúc nạp module; hàm này được gọi ở cuối tệp để giữ đúng thời điểm đó.
 * dataset.plugin cũng phải là id CỦA TA — luật MỘT-ID tính cả tag CSS + dataset.plugin.
 * Nhận: không có.
 * Trả: không có.
 */
export function injectMenuStyles(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(CSS_TAG_ID) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = CSS_TAG_ID;
  tag.textContent = MENU_CSS;
  document.head.appendChild(tag);
}

injectMenuStyles();
