/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Cot noi dung muc General trong man Settings — tu GeneralSection.js 629-641
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

/** Nhan CSS cua muc General (hash ban goc). */
const SECTION = "_WvWnq_section";

/** CSS muc General — nguyen van ban goc. */
const SECTION_CSS = "._WvWnq_section{flex-direction:column;width:100%;display:flex}\n._WvWnq_section>[data-slot=\"settings.general.item\"]>:last-child{border-bottom:none}\n";

/**
 * Cot noi dung muc General: de renderer tu rot cac hang vao.
 * Nhan: deps va props cua renderer (renderSlot).
 * Tra: phan tu React hop le.
 */
function sectionComponent(deps: GeneralDeps, props: Record<string, unknown>): unknown {
  ensureStyle("@galaxy-blackhole/gbh-client-ui-settings-general/GeneralSection.module.css", SECTION_CSS);
  const renderSlot = props.renderSlot;
  const children = typeof renderSlot === "function"
    ? (renderSlot as (name: string, params: Record<string, unknown>) => unknown)("settings.general.item", {})
    : null;
  return deps.runtime.jsx("div", { className: SECTION, children });
}

/**
 * Dung cot noi dung muc General.
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

export const createSections: ComponentFactory = (deps: GeneralDeps): unknown =>
  (props: Record<string, unknown>): unknown => safeRender(() => sectionComponent(deps, props ?? {}));
