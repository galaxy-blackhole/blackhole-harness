/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Noi dung chrome cua shell: nut mo Settings (icon + nhan) — tu chrome.js 582-616
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

/** Nhan CSS cua chrome (hash ban goc). */
const TRIGGER_LABEL = "UQsH_q_triggerLabel";

/** CSS chrome — nguyen van ban goc. */
const CHROME_CSS = ".UQsH_q_triggerLabel{white-space:nowrap;overflow:hidden}\n";

/**
 * Noi dung nut mo Settings: icon, nhan chi hien o cot rong.
 * Nhan: deps va props cua renderer (wide).
 * Tra: phan tu React hop le.
 */
function triggerComponent(deps: GeneralDeps, props: Record<string, unknown>): unknown {
  ensureStyle("@galaxy-blackhole/gbh-client-ui-settings-general/chrome.module.css", CHROME_CSS);
  const wide = props.wide === true;
  const t = deps.locale;
  const primitives = deps.primitives as Record<string, unknown>;
  // DI BIET CO CHU DICH (17/10/2026): primitive co the KHONG co mat (nua wiring khac phien ban).
  // Ban goc jsx() thang vao icon ⇒ gap undefined thi React nem #130 va ca slot chet. O day BO icon khi thieu
  // (KHONG dung 'span' thay the: span rong lam lech chieu cao vung sidebar 21px so voi stock).
  const icon = typeof primitives.IconSettingsOutlineMedium === "function"
    ? deps.runtime.jsx(primitives.IconSettingsOutlineMedium, { size: wide ? 16 : 18 })
    : null;
  // DI BIET CO CHU DICH (17/10/2026): KHONG dung runtime.Fragment — namespace do loader cap co the
  // khong co Fragment ⇒ jsxs(undefined, …) = React #130 va ca slot chet. Tra MANG co key la hop le.
  const label = wide ? deps.runtime.jsx("span", { key: "label", className: TRIGGER_LABEL, children: t("trigger") }) : null;
  // KHONG boc icon trong span: ban goc tra Fragment (khong phan tu bao) ⇒ giu dung cay DOM cua stock.
  return [icon, label];
}

/**
 * Dung noi dung chrome cho cac ghe trigger/header/close cua shell.
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

export const createTrigger: ComponentFactory = (deps: GeneralDeps): unknown =>
  (props: Record<string, unknown>): unknown => safeRender(() => triggerComponent(deps, props ?? {}));
