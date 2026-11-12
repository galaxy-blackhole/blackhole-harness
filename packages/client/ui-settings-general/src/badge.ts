/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Badge cap nhat Desktop tren nut mo sidebar + chi bao trang thai — tu DesktopUpdateIndicator.js 169-226
 */

import { BUSY_PHASES, updateCopy, type UpdatePresentation } from "./desktop-update.ts";
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

/** Nhan CSS cua chi bao (hash ban goc). */
const CLASS = {
  badge: "DOUpOa_badge",
  errorDot: "DOUpOa_errorDot",
  icon: "DOUpOa_icon",
  indicator: "DOUpOa_indicator",
  spin: "DOUpOa_spin",
  spinner: "DOUpOa_spinner",
};

/** CSS chi bao — nguyen van ban goc. */
const INDICATOR_CSS = ".DOUpOa_indicator{box-sizing:border-box;border:1px solid color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 20%, transparent);border-radius:var(--dsw-radius-sm);height:28px;color:var(--dsw-alias-brand-primary-new-colorprimary-new-color);background:color-mix(in srgb, var(--dsw-alias-brand-primary-new-colorprimary-new-color) 8%, transparent);text-align:left;white-space:nowrap;cursor:pointer;flex:none;grid-template-columns:14px max-content;align-items:center;column-gap:4px;padding:0 8px;font-family:inherit;font-size:12px;font-weight:500;line-height:18px;display:inline-grid}\n.DOUpOa_icon{place-items:center;width:14px;height:14px;display:grid}\n.DOUpOa_badge{inset-inline-end:2px;corner-shape:round;background:var(--dsw-alias-brand-primary-new-colorprimary-new-color);border-radius:50%;width:6px;height:6px;position:absolute;top:2px}\n.DOUpOa_errorDot{corner-shape:round;background:currentColor;border-radius:50%;width:6px;height:6px}\n.DOUpOa_spinner{animation:1s linear infinite DOUpOa_spin}\n@keyframes DOUpOa_spin{to{transform:rotate(360deg)}}\n@media (prefers-reduced-motion:reduce){.DOUpOa_spinner{animation:none}}\n.DOUpOa_indicator[aria-disabled=true]{cursor:default}\n";

/** Anh chup nguon cap nhat ma view phoi ra. */
interface UpdateView {
  /** Trinh bay hien tai. */
  presentation?: UpdatePresentation;
  /** Lan doc/ghi gan nhat that bai. */
  failed: boolean;
  /** Dang mo tien trinh. */
  opening: boolean;
}

/**
 * Doc view cap nhat tu props (hook cua renderer) hoac tu store trong deps.
 * Nhan: deps va props.
 * Tra: view voi 3 truong ma chi bao can.
 */
function readView(deps: GeneralDeps, props: Record<string, unknown>): UpdateView {
  // Vỏ Settings truyền thẳng ảnh chụp qua `view` (đúng bản gốc: `<DesktopUpdateIndicator view={desktopUpdate}/>`).
  const direct = props.view;
  if (typeof direct === "object" && direct !== null && typeof (direct as UpdateView).failed === "boolean") {
    return direct as UpdateView;
  }
  const useDesktopUpdate = props.useDesktopUpdate;
  if (typeof useDesktopUpdate === "function") {
    const viaHook = (useDesktopUpdate as (select: (value: UpdateView) => UpdateView) => UpdateView)((value) => value);
    // ⚠️ 18/10/2026 — LOI THAT (anh console cua chu du an): hook co the tra undefined; khi do
    //   readView tra undefined => badgeComponent doc view.presentation => TypeError
    //   "Cannot read properties of undefined (reading presentation)" => slot render nem => CA GHE
    //   sidebar.settings bi bo qua => than panel Settings TRONG. Phai luon tra object hop le.
    if (typeof viaHook === "object" && viaHook !== null) return viaHook;
  }
  const source = deps.store.desktopUpdate as { getSnapshot?: () => UpdateView } | undefined;
  if (typeof source?.getSnapshot === "function") return source.getSnapshot();
  return { failed: false, opening: false };
}

/**
 * Badge khong tuong tac tren nut mo sidebar (an khi dang ket noi lai, tru khi dang cai).
 * Nhan: deps va props cua renderer.
 * Tra: phan tu React hop le (hoac null dung nhu ban goc khi phai an).
 */
function badgeComponent(deps: GeneralDeps, props: Record<string, unknown>): unknown {
  ensureStyle("@galaxy-blackhole/gbh-client-ui-settings-general/DesktopUpdateIndicator.module.css", INDICATOR_CSS);
  // ⚠️ 18/10/2026 — LUAT HOOKS. Loi THAT tu log console cua chu du an: React error #310
  //   "Rendered more hooks than during the previous render", stack useSelector -> badgeComponent.
  //   Ban cu goi readView() (ben trong la useSelector) va props.useConnectionState() QUA IF, roi
  //   con return null SOM => so luong hook DOI giua cac lan render => React nem => slot render
  //   sidebar.settings bi bo qua => than panel Settings TRONG. Nay goi MOI hook VO DIEU KIEN.
  const useDesktopUpdate = props.useDesktopUpdate;
  const useConnectionState = props.useConnectionState;
  const hookView = typeof useDesktopUpdate === "function"
    ? (useDesktopUpdate as (select: (value: UpdateView) => UpdateView) => UpdateView)((value) => value)
    : undefined;
  const hookConnection = typeof useConnectionState === "function"
    ? (useConnectionState as (select: (value: string) => string) => string)((value) => value)
    : undefined;
  const view: UpdateView = typeof hookView === "object" && hookView !== null ? hookView : readViewFromStore(deps);
  const state = view.presentation;
  const connection = typeof hookConnection === "string" ? hookConnection : "connected";
  const hide = ((connection === "disconnected" || connection === "connecting") && state?.phase !== "installing") || !view.failed;
  if (hide) return null;
  const t = deps.locale;
  const retryLabel = t("desktop.update.retry");
  const copy = state === undefined ? { label: retryLabel, detail: retryLabel } : updateCopy(state, t);
  const label = view.failed ? retryLabel : copy.label;
  const primitives = deps.primitives as Record<string, unknown>;
  const badge = deps.runtime.jsx("span", { role: "img", "aria-label": label, className: CLASS.badge });
  if (typeof primitives.Tooltip !== "function") return badge;
  return deps.runtime.jsx(primitives.Tooltip, { label: view.failed ? label : copy.detail, side: "right", children: badge });
}

/**
 * Doc view cap nhat TU STORE (khong goi hook) — dung khi shell khong truyen hook.
 * @param deps - deps do plugin.ts cap.
 * @returns anh chup hop le (khong bao gio undefined).
 */
function readViewFromStore(deps: GeneralDeps): UpdateView {
  const source = deps.store.desktopUpdate as { getSnapshot?: () => UpdateView } | undefined;
  if (typeof source?.getSnapshot === "function") {
    const snap = source.getSnapshot();
    if (typeof snap === "object" && snap !== null) return snap;
  }
  return { failed: false, opening: false };
}

/**
 * Dung badge cap nhat Desktop.
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

export const createBadge: ComponentFactory = (deps: GeneralDeps): unknown =>
  (props: Record<string, unknown>): unknown => safeRender(() => badgeComponent(deps, props ?? {}));
