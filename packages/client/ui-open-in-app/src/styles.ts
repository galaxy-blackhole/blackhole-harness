/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang lop CSS + stylesheet cua nut mo bang ung dung — giu NGUYEN ten lop va khai bao cua ban goc
 */

/**
 * Ten lop CSS cua module OpenTargetButton.module.css — GIU NGUYEN hash cua ban goc de be mat DOM khong lech.
 * Nhan: khong co.
 * Tra: doi tuong ten lop.
 */
export const CLASS = {
  appIcon: "OMoRSG_appIcon",
  chevron: "OMoRSG_chevron",
  main: "OMoRSG_main",
  menuAnchor: "OMoRSG_menuAnchor",
  skeleton: "OMoRSG_skeleton",
  split: "OMoRSG_split",
} as const;

/**
 * Stylesheet cua nut, nguyen van tung khai bao cua ban goc (chi dung token --dsw-*).
 * Nhan: khong co.
 * Tra: chuoi CSS.
 */
export const STYLES: string =
  ".OMoRSG_menuAnchor{flex:none;align-self:center;display:inline-flex}" +
  ".OMoRSG_split{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);height:24px;font-family:var(--dsw-font-family);align-items:stretch;display:inline-flex;overflow:hidden}" +
  ".OMoRSG_main,.OMoRSG_chevron{color:var(--dsw-alias-label-primary);white-space:nowrap;cursor:pointer;background:0 0;border:0;justify-content:center;align-items:center;font-size:11px;line-height:16px;display:inline-flex}" +
  ".OMoRSG_main{gap:4px;padding:3px 5px}" +
  ".OMoRSG_chevron{border-left:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-secondary);padding:3px 4px 3px 3px}" +
  ".OMoRSG_main:hover:not(:disabled),.OMoRSG_main:focus-visible,.OMoRSG_chevron:hover:not(:disabled),.OMoRSG_chevron:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}" +
  ".OMoRSG_main:disabled,.OMoRSG_chevron:disabled{cursor:default}" +
  ".OMoRSG_appIcon{object-fit:contain}" +
  ".OMoRSG_split[data-size=large]{border-radius:var(--dsw-radius-md);border-color:var(--dsw-alias-border-l2);height:36px}" +
  ".OMoRSG_split[data-size=large] .OMoRSG_main{gap:6px;padding:6px 14px;font-size:14px}" +
  ".OMoRSG_split[data-size=large] .OMoRSG_chevron{padding:6px 10px}" +
  ".OMoRSG_skeleton{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-interactive-bg-hover);flex:none;display:inline-block}";
