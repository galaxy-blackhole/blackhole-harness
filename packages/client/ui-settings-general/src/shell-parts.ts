/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bốn component nhỏ của vỏ Settings — port TRUNG THÀNH bản gốc (dsh-client-ui-settings-general):
 *   HeaderContent (chữ tiêu đề), CloseLabel (nhãn ẩn cho nút X), SettingsDocumentAction
 *   (nút "Mở tệp cấu hình"). Trước đây cả ba slot đều đăng ký `createPanel` nên THIẾU nút hành động.
 */

import type { DocumentSnapshot, SettingsDocumentStore } from "./document-store.ts";
import { DOCUMENT_ACTION_CLASS, DOCUMENT_ACTION_CSS } from "./settings-css.ts";
import type { GeneralDeps } from "./types.ts";

/** Id tag style của CSS module nút mở tệp — giữ tên bản gốc để không đè style của module khác. */
const DOCUMENT_STYLE_TAG = "@galaxy-blackhole/gbh-client-ui-settings-general/SettingsDocumentAction.module.css";

/**
 * Chèn stylesheet của nút mở tệp vào `<head>` đúng một lần (idempotent theo `data-plugin-css`).
 * Nhận: không.
 * Trả: không.
 */
function ensureDocumentStyle(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(DOCUMENT_STYLE_TAG) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-settings-general";
  tag.dataset.pluginCss = DOCUMENT_STYLE_TAG;
  tag.textContent = DOCUMENT_ACTION_CSS;
  document.head.appendChild(tag);
}

/**
 * Chữ tiêu đề của modal Settings — bản gốc `HeaderContent({ t })` trả `t("title")`.
 * @param props - props do renderer ghép; `t` là hàm dịch của namespace.
 * @returns phần tử jsx chỉ chứa chữ.
 */
export function createHeaderContent(deps: GeneralDeps): (props: Record<string, unknown>) => unknown {
  return (props: Record<string, unknown>): unknown => {
    const t = typeof props.t === "function" ? (props.t as (key: string) => string) : deps.locale;
    return deps.runtime.jsx(deps.runtime.Fragment, { children: t("title") });
  };
}

/**
 * Nhãn ẩn cho nút đóng — bản gốc `CloseLabel({ t })` trả `t("close")`.
 * @param props - props do renderer ghép.
 * @returns phần tử jsx chỉ chứa chữ.
 */
export function createCloseLabel(deps: GeneralDeps): (props: Record<string, unknown>) => unknown {
  return (props: Record<string, unknown>): unknown => {
    const t = typeof props.t === "function" ? (props.t as (key: string) => string) : deps.locale;
    return deps.runtime.jsx(deps.runtime.Fragment, { children: t("close") });
  };
}

/**
 * Dựng component ĐÃ CÓ đủ hai thứ nút cần (`controller` + hook `useSnapshot`).
 *
 * ⚠️ TÁCH HAI TẦNG LÀ LUẬT, KHÔNG PHẢI THẨM MỸ: tầng ngoài trả `null` khi thiếu props (renderer
 * chưa cấp hook) — tầng trong mới gọi `useSnapshot`, nên số hook mỗi lần render KHÔNG đổi (React #310).
 * Bản gốc gọi hook ngay trong một component vì `inject` của nó LUÔN có controller; ở đây tầng ngoài
 * phải chịu được ca `props.controller` vắng (môi trường rút gọn, test wiring).
 * @param deps - deps do plugin.ts cấp (runtime, primitives, locale).
 * @returns component nhận `{ controller, useSnapshot, t }`.
 */
function createLoadedDocumentAction(deps: GeneralDeps): (props: Record<string, unknown>) => unknown {
  return (props: Record<string, unknown>): unknown => {
    const controller = props.controller as SettingsDocumentStore;
    const useSnapshot = props.useSnapshot as (select: (snapshot: DocumentSnapshot) => DocumentSnapshot) => DocumentSnapshot;
    const t = props.t as (key: string) => string;
    const state = useSnapshot((snapshot) => snapshot);
    if (state.status !== "ready") return null;
    const open = (): void => {
      void controller.open();
    };
    const primitives = deps.primitives as Record<string, unknown>;
    const Button = primitives.Button;
    // ⚠️ 18/10/2026 — CHẤP NHẬN CẢ `memo`/`forwardRef`: shell cấp `Button` dưới dạng ĐỐI TƯỢNG
    //   (React.memo), nên phép thử cũ `typeof === "function"` LUÔN trượt ⇒ rơi về nút trần (đo được:
    //   DOM sau boot có class `me01iq_action` thay vì class của primitive). React nhận đối tượng memo
    //   làm kiểu phần tử, nên chỉ cần KHÁC undefined là dùng được.
    const isComponent = typeof Button === "function" || (typeof Button === "object" && Button !== null);
    const button = isComponent
      ? deps.runtime.jsx(Button, { variant: "outline", size: "sm", disabled: state.opening, onClick: open, children: t("openDocument") })
      // DI BIẾT CÓ CHỦ ĐÍCH: thiếu primitive Button thì vẫn là một nút thật, cùng lớp CSS bản gốc.
      : deps.runtime.jsx("button", { type: "button", className: DOCUMENT_ACTION_CLASS.action, disabled: state.opening, onClick: open, children: t("openDocument") });
    const error = state.error === null
      ? null
      : deps.runtime.jsx("span", { className: DOCUMENT_ACTION_CLASS.error, role: "alert", children: t("openDocument.error") });
    return deps.runtime.jsxs("div", { className: DOCUMENT_ACTION_CLASS.action, children: [error, button] });
  };
}

/**
 * Nút "Mở tệp cấu hình" — bản gốc `SettingsDocumentAction`, đăng ký vào slot `settings.action`
 * với id `open-document`, order 0, kèm `inject: documentInjected` (controller + hooks.snapshot).
 *
 * Nhận: deps do plugin.ts cấp.
 * Trả: component nhận props của ghế; trả null khi chưa đủ `controller`/`useSnapshot` hoặc khi Host
 *   không có tài liệu cục bộ (state.status !== "ready").
 */
export function createDocumentAction(deps: GeneralDeps): (props: Record<string, unknown>) => unknown {
  ensureDocumentStyle();
  const loaded = createLoadedDocumentAction(deps);
  return (props: Record<string, unknown>): unknown => {
    const controller = props.controller as SettingsDocumentStore | undefined;
    if (controller === undefined || typeof props.useSnapshot !== "function") return null;
    const t = typeof props.t === "function" ? (props.t as (key: string) => string) : deps.locale;
    return deps.runtime.jsx(loaded, { controller, useSnapshot: props.useSnapshot, t });
  };
}
