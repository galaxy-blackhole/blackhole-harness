/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc CSS cua hai module (nguyen van ban goc) + ham tiem the <style> mot lan cho moi phien trang
 */

import { PACKAGE_NAME } from "./ids";

/** CSS cua `FeedbackDialog.module.css` — nguyen van tu bundle goc, chi dung token `--dsw-*`. */
export const DIALOG_CSS = "._6_jNJa_dialog._6_jNJa_dialog{border-radius:var(--dsw-radius-panel);gap:38px;width:min(488px,100%)}._6_jNJa_categories{flex-wrap:wrap;gap:8px;margin-top:-14px;display:flex}._6_jNJa_chip{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);height:28px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;padding:0 12px;font-size:13px;line-height:18px;transition:background-color .12s,border-color .12s,color .12s}._6_jNJa_chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._6_jNJa_chip:disabled{cursor:default;opacity:.4}._6_jNJa_chip:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}._6_jNJa_chipActive,._6_jNJa_chipActive:hover:not(:disabled){border-color:var(--dsw-alias-button-primary-fill);background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}._6_jNJa_detail{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);width:100%;min-height:116px;max-height:280px;color:var(--dsw-alias-label-primary);font:inherit;field-sizing:content;resize:none;margin-top:18px;padding:12px 14px;font-size:14px;line-height:22px;transition:border-color .12s,box-shadow .12s;display:block}._6_jNJa_detail::placeholder{color:var(--dsw-alias-label-caption)}._6_jNJa_detail:focus{border-color:var(--dsw-alias-border-l3);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary);outline:none}._6_jNJa_submit{border-radius:var(--dsw-radius-lg);width:100%;height:44px;font-size:14px;font-weight:500}@media (prefers-reduced-motion:reduce){._6_jNJa_chip,._6_jNJa_detail{transition:none}}";

/** CSS cua `MessageFeedbackActions.module.css` — nguyen van tu bundle goc, chi dung token `--dsw-*`. */
export const ACTIONS_CSS = "._8_XoUG_action{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}._8_XoUG_action svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}._8_XoUG_action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}._8_XoUG_action:disabled{cursor:default;opacity:.4}._8_XoUG_action[data-active]{color:var(--dsw-alias-label-tertiary)}._8_XoUG_failure{color:var(--dsw-alias-label-tertiary);padding-left:4px;font-size:13px;line-height:20px}";

/**
 * Tiem mot the <style> mot lan duy nhat cho ca trang.
 * Nhan: file — ten file CSS (dung lam khoa trong `data-plugin-css`); css — noi dung CSS.
 * Tra: khong co.
 */
function installStyle(file: string, css: string): void {
  if (typeof document === "undefined") return;
  const tagId = PACKAGE_NAME + "/" + file;
  const selector = "style[data-plugin-css=" + JSON.stringify(tagId) + "]";
  if (document.querySelector(selector) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  document.head.appendChild(tag);
}

/**
 * Tiem CSS cua ca hai module cua row nay (goi mot lan luc dung mat plugin).
 * Nhan: khong co.
 * Tra: khong co.
 */
export function injectFeedbackStyles(): void {
  installStyle("FeedbackDialog.module.css", DIALOG_CSS);
  installStyle("MessageFeedbackActions.module.css", ACTIONS_CSS);
}
