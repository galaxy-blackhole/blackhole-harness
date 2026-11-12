/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc CSS của thẻ hướng dẫn terminal ở sidebar phải
 */

/** CSS của thẻ hướng dẫn terminal (giữ nguyên khai báo, đổi tiền tố lớp). */
export const GUIDE_CSS = ".gbhTermzju_entry{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsl-guide-entry-radius);background:var(--dsw-alias-bg-layer-1);align-items:center;gap:14px;width:100%;min-height:56px;padding:14px 20px;display:flex;position:relative;overflow:hidden}.gbhTermzju_main{border-radius:0;width:100%;height:100%;position:absolute;inset:0}.gbhTermzju_main:focus-visible{outline-offset:-2px}.gbhTermzju_icon{width:26px;height:26px;color:var(--dsw-alias-label-secondary);pointer-events:none;flex:none;justify-content:center;align-items:center;display:flex;position:relative}.gbhTermzju_text{pointer-events:none;flex-direction:column;flex:1;gap:3px;min-width:0;display:flex;position:relative}.gbhTermzju_titleRow{align-items:center;gap:4px;min-width:0;display:flex}.gbhTermzju_title{color:var(--dsw-alias-label-primary);white-space:nowrap;text-overflow:ellipsis;font-size:14px;line-height:1.4;overflow:hidden}.gbhTermzju_description{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;font-size:11px;line-height:1.4;overflow:hidden}.gbhTermzju_trigger{border-radius:4px;flex:none;width:20px;height:20px;padding:0}.gbhTermzju_trigger svg{width:14px;height:14px;color:var(--dsw-alias-label-tertiary)}.gbhTermzju_menu{pointer-events:auto;flex:none;display:flex}.gbhTermzju_shortcut{pointer-events:none;position:relative}";

/** Tên lớp sau khi đổi tiền tố. */
export const GUIDE_CLASS = Object.freeze({
  "description": "gbhTermzju_description",
  "entry": "gbhTermzju_entry",
  "icon": "gbhTermzju_icon",
  "main": "gbhTermzju_main",
  "menu": "gbhTermzju_menu",
  "shortcut": "gbhTermzju_shortcut",
  "text": "gbhTermzju_text",
  "title": "gbhTermzju_title",
  "titleRow": "gbhTermzju_titleRow",
  "trigger": "gbhTermzju_trigger",
});
