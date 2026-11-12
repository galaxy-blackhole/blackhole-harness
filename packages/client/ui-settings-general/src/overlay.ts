/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Loi nhac doi phien ban Host cho ghe shell.overlay — tu HostReleasePrompt.js 879-963, CO CONG chan
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

/** Bang lop cua loi nhac doi phien ban (hash ban goc). */
const CLASS = {
  "dialog": "_64N1GW_dialog",
  "done": "_64N1GW_done",
  "faded": "_64N1GW_faded",
  "label": "_64N1GW_label",
  "line": "_64N1GW_line",
  "pending": "_64N1GW_pending",
  "release": "_64N1GW_release",
  "solid": "_64N1GW_solid",
  "transitions": "_64N1GW_transitions"
} as const;

/** CSS loi nhac doi phien ban — nguyen van ban goc. */
const PROMPT_CSS = "._64N1GW_dialog{width:min(480px,100%)}\n._64N1GW_transitions{grid-template-columns:max-content minmax(0,max-content) 56px minmax(0,max-content);justify-content:start;align-items:center;gap:8px 12px;font-size:13px;line-height:20px;display:grid}\n._64N1GW_label{color:var(--dsw-alias-label-secondary)}\n._64N1GW_release{font-family:var(--ds-font-family-code);overflow-wrap:anywhere}\n._64N1GW_solid{color:var(--dsw-alias-label-primary)}\n._64N1GW_faded{color:var(--dsw-alias-label-tertiary)}\n._64N1GW_line{border-top-width:1px;height:0;position:relative}\n._64N1GW_line:after{content:\"\";border-top:3px solid #0000;border-bottom:3px solid #0000;border-left:5px solid;position:absolute;top:-3.5px;right:-1px}\n._64N1GW_done{border-top-style:solid;border-top-color:var(--dsw-alias-state-success-primary);color:var(--dsw-alias-state-success-primary)}\n._64N1GW_pending{border-top-style:dashed;border-top-color:var(--dsw-alias-label-tertiary);color:var(--dsw-alias-label-tertiary)}\n";

/** Mot dau phien ban (phien ban hoac commit) ma Host cong bo. */
export interface ReleaseLike {
  /** Phien ban phat hanh. */
  version?: string;
  /** Commit cua ban phat hanh. */
  commit?: string;
}

/** Lan doi phien ban dang duoc thong bao (Host vua chuyen sang ban khac). */
export interface ReleaseChange {
  /** Phien ban Host dang o TRUOC khi doi. */
  previous?: ReleaseLike;
  /** Phien ban Host dang chay BAY GIO. */
  host?: ReleaseLike;
  /** Phien ban ma TRANG nay duoc nap. */
  page?: ReleaseLike;
}

/** Ham dich cua renderer (nhan khoa, tra chuoi). */
type Translate = (key: string) => string;

/**
 * Doc ham dich tu props, thieu thi lay tu deps.
 * Nhan: deps va props cua renderer.
 * Tra: ham dich.
 */
function translate(deps: GeneralDeps, props: Record<string, unknown>): Translate {
  return typeof props.t === "function" ? (props.t as Translate) : deps.locale;
}

/**
 * Doc lan doi phien ban dang thong bao.
 *
 * BAN GOC: ghe shell.overlay duoc dang ky kem inject tra hooks.releaseChange; khung slot bien hook do
 * thanh prop useReleaseChange, va component doc bang useReleaseChange((value) => value).
 *
 * Nhan: props cua renderer.
 * Tra: lan doi phien ban, hoac undefined khi CHUA co lan doi nao.
 */
function readChange(props: Record<string, unknown>): ReleaseChange | undefined {
  const hook = props.useReleaseChange;
  const value = typeof hook === "function"
    ? (hook as (select: (input: ReleaseChange | undefined) => ReleaseChange | undefined) => unknown)((input) => input)
    : props.releaseChange;
  return typeof value === "object" && value !== null ? (value as ReleaseChange) : undefined;
}

/**
 * Ten hai dau cua mot lan chuyen: phien ban khi khac nhau, nguoc lai la commit.
 * Nhan: dau di, dau den, chu thay the.
 * Tra: cap [dau di, dau den] da co chu.
 */
function transitionText(from: ReleaseLike | undefined, to: ReleaseLike | undefined, unknown: string): [string, string] {
  const field = from?.version !== to?.version ? "version" : "commit";
  return [from?.[field] ?? unknown, to?.[field] ?? unknown];
}

/**
 * Mot dong chuyen tiep: nhan + hai dau + vach noi. Chuyen DA XONG thi lam mo dau di.
 * Nhan: deps, nhan dong, hai dau, va trang thai hoan tat.
 * Tra: bon o cua luoi chuyen tiep.
 */
function transitionCells(deps: GeneralDeps, label: string, from: string, to: string, done: boolean): unknown {
  // DI BIET CO CHU DICH (17/10/2026): tra MANG co key thay vi runtime.Fragment (namespace do loader cap
  // co the khong co Fragment ⇒ jsxs(undefined, …) = React #130 va ca slot chet).
  return [
    deps.runtime.jsx("span", { key: "label", className: CLASS.label, children: label }),
    deps.runtime.jsx("span", { key: "from", className: CLASS.release + " " + (done ? CLASS.faded : CLASS.solid), children: from }),
    deps.runtime.jsx("span", { key: "line", "aria-hidden": "true", className: CLASS.line + " " + (done ? CLASS.done : CLASS.pending) }),
    deps.runtime.jsx("span", { key: "to", className: CLASS.release + " " + (done ? CLASS.solid : CLASS.faded), children: to }),
  ];
}

/**
 * Loi nhac doi phien ban Host: hoi nguoi dung co tai lai trang khong.
 *
 * ⚠️ CONG CHAN — dong 926 ban goc: neu lan doi phien ban la undefined thi tra null.
 * Khong co lan doi phien ban nao dang thong bao thi ghe nay KHONG ve gi ca. Ban cu cua file nay
 * (<= 17/10/2026) ve thang lop Settings (VOzbGW_overlay/VOzbGW_mask) ⇒ mot panel trang khong lo
 * phu 55% man hinh ngay luc tai trang (do duoc: anh A/B 67,739% px khac).
 *
 * Nhan: deps va props cua renderer (useReleaseChange/t/dismissRelease/reloadPage).
 * Tra: phan tu React, hoac null khi khong co lan doi nao.
 */
function promptComponent(deps: GeneralDeps, props: Record<string, unknown>): unknown {
  const change = readChange(props);
  if (change === undefined) return null;
  ensureStyle("@galaxy-blackhole/gbh-client-ui-settings-general/HostReleasePrompt.module.css", PROMPT_CSS);
  const t = translate(deps, props);
  const unknown = t("hostRelease.unknown");
  const [serviceFrom, serviceTo] = transitionText(change.previous, change.host, unknown);
  const [pageFrom, pageTo] = transitionText(change.page, change.host, unknown);
  const grid = deps.runtime.jsx("div", {
    className: CLASS.transitions,
    children: [
      transitionCells(deps, t("hostRelease.service"), serviceFrom, serviceTo, true),
      transitionCells(deps, t("hostRelease.page"), pageFrom, pageTo, false),
    ],
  });
  const primitives = deps.primitives as Record<string, unknown>;
  const Modal = primitives.Modal;
  const Button = primitives.Button;
  const dismiss = typeof props.dismissRelease === "function" ? (props.dismissRelease as () => void) : () => undefined;
  const reload = typeof props.reloadPage === "function" ? (props.reloadPage as () => void) : () => undefined;
  if (typeof Modal !== "function") {
    // DI BIET CO CHU DICH (18/10/2026): thieu primitive Modal thi CHI ve bang chuyen tiep trong khung
    // _64N1GW_dialog. KHONG tu dung mask/panel: do dung la loi da gay ra panel trang phu man hinh.
    return deps.runtime.jsx("div", { className: CLASS.dialog, children: grid });
  }
  const footer = typeof Button === "function"
    ? [
      deps.runtime.jsx(Button, { key: "later", variant: "outline", "data-modal-autofocus": true, onClick: dismiss, children: t("hostRelease.later") }),
      deps.runtime.jsx(Button, { key: "reload", variant: "primary", onClick: reload, children: t("hostRelease.reload") }),
    ]
    : null;
  return deps.runtime.jsx(Modal, {
    open: true,
    title: t("hostRelease.title"),
    description: t("hostRelease.description"),
    closeLabel: t("hostRelease.later"),
    onClose: dismiss,
    className: CLASS.dialog,
    footer,
    children: grid,
  });
}

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

/**
 * Dung loi nhac doi phien ban Host (ghe shell.overlay, id host-release-change).
 * Nhan: deps do plugin.ts cap.
 * Tra: component hop le cho slots.register.
 */
export const createOverlay: ComponentFactory = (deps: GeneralDeps): unknown =>
  (props: Record<string, unknown>): unknown => safeRender(() => promptComponent(deps, props ?? {}));
