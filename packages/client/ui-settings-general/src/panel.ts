/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Khung panel Settings: tieu de + nhan dong + hang action — tu SettingsRoot.js 227-499, giu bang lop goc
 */

import type { ComponentFactory, GeneralDeps } from "./types.ts";

/** Document toi thieu (khong dung kieu DOM cua du an). */
interface DocumentLike {
  /** Tao the style. */
  createElement(name: string): { dataset: Record<string, string>; textContent: string };
  /** The head. */
  head: { appendChild(node: unknown): void };
  /** Tim the da co. */
  querySelector(selector: string): unknown;
}

/**
 * Lay document neu moi truong co (thieu thi bo qua, KHONG nem).
 * Tra: document hoac undefined.
 */
function doc(): DocumentLike | undefined {
  const host = globalThis as unknown as { document?: DocumentLike };
  return host.document;
}

/**
 * Nhung CSS mot lan cho moi tag (giong ban goc).
 * Nhan: id tag + noi dung CSS.
 */
function ensureStyle(tagId: string, css: string): void {
  const d = doc();
  if (d === undefined) return;
  if (d.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = d.createElement("style");
  tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-settings-general";
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  d.head.appendChild(tag);
}

/**
 * Doc ten ghe tu props de chon manh chrome can ve.
 * Nhan: props cua renderer.
 * Tra: chuoi ghe (header/close/action) hoac rong.
 */
function seatOf(props: Record<string, unknown>): string {
  const raw = [props.name, props.slot, props.seat].find((value) => typeof value === "string");
  return typeof raw === "string" ? raw : "";
}

/** Bang lop cua khung panel (hash ban goc). */
const CLASS = {
  "actions": "VOzbGW_actions",
  "active": "VOzbGW_active",
  "close": "VOzbGW_close",
  "content": "VOzbGW_content",
  "header": "VOzbGW_header",
  "hiddenLabel": "VOzbGW_hiddenLabel",
  "mask": "VOzbGW_mask",
  "nav": "VOzbGW_nav",
  "navCell": "VOzbGW_navCell",
  "navIcon": "VOzbGW_navIcon",
  "navLabel": "VOzbGW_navLabel",
  "navList": "VOzbGW_navList",
  "navTitle": "VOzbGW_navTitle",
  "options": "VOzbGW_options",
  "overlay": "VOzbGW_overlay",
  "panel": "VOzbGW_panel",
  "rail": "VOzbGW_rail",
  "railRow": "VOzbGW_railRow",
  "trigger": "VOzbGW_trigger",
  "triggerLabel": "VOzbGW_triggerLabel",
  "triggerRow": "VOzbGW_triggerRow"
} as const;

/** CSS khung panel — nguyen van ban goc. */
const PANEL_CSS = ".VOzbGW_triggerRow{flex:none;align-items:center;gap:8px;width:calc(100% + 4px);margin:4px -2px;display:flex;position:relative}\n.VOzbGW_triggerRow.VOzbGW_railRow{width:36px;margin:8px 0 10px}\n.VOzbGW_trigger{box-sizing:border-box;border-radius:var(--dsw-radius-md);cursor:pointer;width:auto;min-width:0;height:42px;color:var(--dsw-alias-label-primary);background:0 0;border:none;flex:1;align-items:center;gap:8px;margin:0;padding:0 10px 0 8px;font-family:inherit;font-size:14px;line-height:22px;display:flex;overflow:hidden}\n.VOzbGW_trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.VOzbGW_trigger.VOzbGW_rail{flex:none;justify-content:center;gap:0;width:36px;height:36px;margin:0;padding:0}\n.VOzbGW_triggerLabel{white-space:nowrap;overflow:hidden}\n.VOzbGW_overlay{z-index:1000;justify-content:center;align-items:center;display:flex;position:fixed;inset:0}\n.VOzbGW_mask{inset:var(--dsh-frame-chrome-top,0px) 0 0;background:var(--dsw-alias-bg-mask-1);backdrop-filter:var(--dsw-mask-blur);position:absolute}\n.VOzbGW_panel{z-index:1;width:800px;height:min(800px, calc(100vh - 2 * max(24px, var(--dsh-frame-overlay-top,24px))));border-radius:var(--dsw-radius-panel);background:var(--dsw-alias-bg-layer-2);max-width:calc(100vw - 48px);box-shadow:var(--dsw-elevation-prominent);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);display:flex;position:relative;overflow:hidden}\n.VOzbGW_panel:focus{outline:none}\n.VOzbGW_nav{box-sizing:border-box;flex-direction:column;flex:none;gap:18px;width:188px;padding:22px 12px 0;display:flex}\n.VOzbGW_navTitle{color:var(--dsw-alias-label-primary);padding:0 12px;font-size:16px;font-weight:500;line-height:24px}\n.VOzbGW_navList{flex-direction:column;gap:4px;display:flex;overflow-y:auto}\n.VOzbGW_navCell{box-sizing:border-box;border-radius:var(--dsw-radius-md);cursor:pointer;height:40px;color:var(--dsw-alias-label-primary);text-align:left;background:0 0;border:none;align-items:center;gap:8px;padding:9px 16px 9px 12px;font-family:inherit;font-size:14px;font-weight:400;line-height:22px;display:flex}\n.VOzbGW_navCell:hover{background:var(--dsw-specific-sidebar-nav-item-hover)}\n.VOzbGW_navCell.VOzbGW_active{background:var(--dsw-specific-sidebar-nav-item-active)}\n.VOzbGW_navIcon{flex:none}\n.VOzbGW_navLabel{white-space:nowrap;text-overflow:ellipsis;flex:1;min-width:0;overflow:hidden}\n.VOzbGW_content{flex-direction:column;flex:1;min-width:0;display:flex}\n.VOzbGW_header{box-sizing:border-box;flex:none;justify-content:space-between;align-items:flex-start;gap:8px;height:54px;padding:20px 14px 8px 10px;display:flex}\n.VOzbGW_actions{justify-content:flex-end;align-items:center;gap:8px;min-width:0;margin-left:auto;display:flex}\n.VOzbGW_close{border-radius:var(--dsw-radius-sm);cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-primary);background:0 0;border:none;justify-content:center;align-items:center;padding:0;display:inline-flex}\n.VOzbGW_close:hover{background:var(--dsw-alias-interactive-bg-hover)}\n.VOzbGW_options{flex:1;min-height:0;padding:0 24px 24px;overflow-y:auto}\n.VOzbGW_hiddenLabel{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}\n";

/**
 * Ve mot manh chrome cua panel theo ghe ma renderer bao.
 * Nhan: deps va props cua renderer (name/slot + t).
 * Tra: phan tu React hop le.
 */
function panelComponent(deps: GeneralDeps, props: Record<string, unknown>): unknown {
  ensureStyle("@galaxy-blackhole/gbh-client-ui-settings-general/SettingsRoot.module.css", PANEL_CSS);
  const t = typeof props.t === "function" ? (props.t as (key: string) => string) : deps.locale;
  const seat = seatOf(props);
  if (seat.includes("close")) {
    return deps.runtime.jsx("span", { className: CLASS.hiddenLabel, children: t("close") });
  }
  if (seat.includes("action")) {
    return deps.runtime.jsx("div", { className: CLASS.actions });
  }
  return deps.runtime.jsxs("div", {
    className: CLASS.header,
    children: [deps.runtime.jsx("span", { children: t("title") })],
  });
}

/**
 * Dung khung panel Settings (ghe header/close/action).
 * Nhan: deps do plugin.ts cap.
 * Tra: component hop le cho slots.register.
 */

/**
 * Boc an toan cho mot ghe slot: mot tinh nang phu KHONG duoc giet ca cay (luat #5).
 * Nhan: ham render.
 * Tra: ket qua render, hoac null neu render nem.
 */
function safeRender<T>(render: () => T): T | null {
  try {
    return render();
  } catch (error) {
    console.warn('gbh-client-ui-settings-general: slot render nem loi, bo qua ghe nay', error);
    return null;
  }
}

export const createPanel: ComponentFactory = (deps: GeneralDeps): unknown =>
  (props: Record<string, unknown>): unknown => safeRender(() => panelComponent(deps, props ?? {}));
