/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Panel Settings dạng modal body-portal + ĐỦ BA ĐƯỜNG ĐÓNG — từ SettingsRoot.js 275-342
 */

import { SETTINGS_CLASS, SETTINGS_CSS } from "./settings-css.ts";
import type { ComponentFactory, GeneralDeps } from "./types.ts";

/** Document tối thiểu (không dùng kiểu DOM của dự án). */
interface DocumentLike {
  /** Tạo thẻ style. */
  createElement(name: string): { dataset: Record<string, string>; textContent: string };
  /** The head. */
  head: { appendChild(node: unknown): void };
  /** Thân trang — đích của createPortal. */
  body?: unknown;
  /** Tìm thẻ đã có. */
  querySelector(selector: string): unknown;
  /** Nghe sự kiện (Escape cấp document). */
  addEventListener?(type: string, listener: (event: { key?: string }) => void): void;
  /** Thôi nghe sự kiện. */
  removeEventListener?(type: string, listener: (event: { key?: string }) => void): void;
}

/**
 * Lấy document nếu môi trường có (thiếu thì bỏ qua, KHÔNG ném).
 * @returns document hoặc undefined.
 */
function doc(): DocumentLike | undefined {
  const host = globalThis as unknown as { document?: DocumentLike };
  return host.document;
}

/**
 * Nhúng CSS một lần cho mỗi tag (giống bản gốc).
 * @param tagId - id tag style.
 * @param css - nội dung CSS.
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

/** Id của nút tiêu đề — bản gốc dùng `useId`; ở đây hằng số vì cửa sổ Settings là DUY NHẤT. */
const TITLE_ID = "gbh-settings-title";

/**
 * Ghép lớp theo kiểu clsx (chỉ cần phần bản gốc dùng).
 * @param values - các lớp, bỏ qua giá trị rỗng/sai.
 * @returns chuỗi lớp đã ghép.
 */
function clsx(...values: unknown[]): string {
  return values.filter((value) => typeof value === "string" && value !== "").join(" ");
}

/** Icon điều hướng theo id mục — đúng bảng của bản gốc (SettingsRoot.js 244-269). */
const NAV_ICONS: Record<string, string> = {
  "account": "IconUserOutlineMedium",
  "models": "IconDataOutlineMedium",
  "agent-presets": "IconAgentPresetOutlineMedium",
  "plugins": "IconPersonalizationOutlineMedium",
  "archived-sessions": "IconArchiveOutlineMedium",
};

/**
 * Dựng panel Settings: mask + khung giữa màn, gắn vào `document.body` bằng createPortal.
 *
 * BA ĐƯỜNG ĐÓNG (đo từ bản gốc, phải đủ cả ba):
 *   (1) nút close ở header — `onClick: onClose`;
 *   (2) bấm mask — `onClick: onClose`;
 *   (3) Escape cấp document — primitive `useModalLayer(panel, true, onClose)` khi có; KHÔNG có thì tự gắn
 *       listener `keydown` lên document qua callback ref, và GỠ khi panel rời DOM.
 * ⚠️ Listener chỉ sống khi panel MỞ, vì nó được gắn lúc panel vào DOM và gỡ lúc panel ra khỏi DOM.
 *
 * @param deps - deps do plugin.ts cấp (runtime, primitives, portal).
 * @returns component hợp lệ cho slots.register.
 */
export const createSettingsPanel: ComponentFactory = (deps: GeneralDeps): unknown => {
  let detach: (() => void) | undefined;
  let close: () => void = () => undefined;
  const panelRef: { current: unknown } = { current: null };

  /** Gắn/gỡ listener Escape theo vòng đời của chính panel (ref callback ỔN ĐỊNH danh tính). */
  const attach = (node: unknown): void => {
    if (detach !== undefined) {
      detach();
      detach = undefined;
    }
    panelRef.current = node;
    const d = doc();
    if (node === null || node === undefined || d === undefined) return;
    if (typeof d.addEventListener !== "function" || typeof d.removeEventListener !== "function") return;
    const onKey = (event: { key?: string }): void => {
      if (event?.key !== "Escape") return;
      close();
    };
    d.addEventListener("keydown", onKey);
    detach = () => {
      d.removeEventListener?.("keydown", onKey);
    };
  };

  const panelComponent = (props: Record<string, unknown>): unknown => {
    ensureStyle("@galaxy-blackhole/gbh-client-ui-settings-general/SettingsRoot.module.css", SETTINGS_CSS);
    close = typeof props.onClose === "function" ? (props.onClose as () => void) : () => undefined;
    const renderSlot = props.renderSlot;
    const slot = (name: string, params: Record<string, unknown>, options?: unknown): unknown =>
      typeof renderSlot === "function" ? (renderSlot as (n: string, p: unknown, o?: unknown) => unknown)(name, params, options) : null;
    const rows = Array.isArray(props.rows) ? (props.rows as { id?: unknown; label?: unknown; icon?: unknown }[]) : [];
    const activeId = typeof props.activeId === "string" ? props.activeId : undefined;
    const active = rows.find((row) => row?.id === activeId)?.id ?? rows[0]?.id;
    const primitives = deps.primitives as Record<string, unknown>;
    // Primitive useModalLayer là HOOK: gọi ở đúng một vị trí, cùng thứ tự mọi lần render.
    if (typeof primitives.useModalLayer === "function") {
      (primitives.useModalLayer as (ref: unknown, open: boolean, onClose: () => void) => void)(panelRef, true, () => close());
    }
    const onSelect = typeof props.onSelect === "function" ? (props.onSelect as (id: string) => void) : () => undefined;
    const IconClose = primitives.IconCloseOutlineRegular;
    const navCells = rows.map((row) => {
      const id = String(row?.id ?? "");
      // MO RONG CUA TA 18/10/2026: row.icon THANG bang cung. Ban goc chi tra bang
      // NAV_ICONS theo id roi fallback IconSettingsOutlineMedium, nen MOI section moi
      // LUON hien icon Settings mac dinh. Them truong tuy chon icon de package doc
      // lap chon duoc icon rieng; vang thi giu dung hanh vi cu.
      // Sổ icon cấp module (xem settings-about): dùng khi kernel không giữ trường lạ `icon` trong options.
      const icons = (globalThis as Record<string, unknown>).__gbhSectionIcons as Record<string, unknown> | undefined;
      const ownIcon = row?.icon ?? icons?.[id];
      const ownName = typeof ownIcon === "string" && ownIcon !== "" ? ownIcon : undefined;
      const iconName = ownName ?? NAV_ICONS[id] ?? "IconSettingsOutlineMedium";
      const Icon = typeof ownIcon === "function" ? ownIcon : primitives[iconName];
      return deps.runtime.jsxs(
        "button",
        {
          key: id,
          type: "button",
          className: clsx(SETTINGS_CLASS.navCell, id === active && SETTINGS_CLASS.active),
          "aria-current": id === active ? "true" : undefined,
          "data-modal-autofocus": id === active ? "" : undefined,
          onClick: () => onSelect(id),
          children: [
            typeof Icon === "function"
              ? deps.runtime.jsx(Icon, { key: "icon", className: SETTINGS_CLASS.navIcon, size: 16 })
              : null,
            deps.runtime.jsx("span", { key: "label", className: SETTINGS_CLASS.navLabel, children: row?.label }),
          ],
        },
      );
    });
    const mask = deps.runtime.jsx("div", {
      key: "mask",
      className: SETTINGS_CLASS.mask,
      "aria-hidden": "true",
      onClick: () => close(),
    });
    const navTitle = deps.runtime.jsx("div", {
      key: "title",
      className: SETTINGS_CLASS.navTitle,
      id: TITLE_ID,
      tabIndex: -1,
      "data-modal-autofocus": active === undefined ? "" : undefined,
      children: slot("settings.header", {}),
    });
    const closeButton = deps.runtime.jsxs("button", {
      key: "close",
      type: "button",
      className: SETTINGS_CLASS.close,
      onClick: () => close(),
      children: [
        typeof IconClose === "function" ? deps.runtime.jsx(IconClose, { key: "icon", size: 14 }) : null,
        deps.runtime.jsx("span", { key: "label", className: SETTINGS_CLASS.hiddenLabel, children: slot("settings.close", {}) }),
      ],
    });
    const nav = deps.runtime.jsxs("nav", {
      key: "nav",
      className: SETTINGS_CLASS.nav,
      children: [navTitle, deps.runtime.jsx("div", { key: "list", className: SETTINGS_CLASS.navList, children: navCells })],
    });
    const content = deps.runtime.jsxs("div", {
      key: "content",
      className: SETTINGS_CLASS.content,
      children: [
        deps.runtime.jsxs("div", {
          key: "header",
          className: SETTINGS_CLASS.header,
          children: [
            deps.runtime.jsx("div", { key: "actions", className: SETTINGS_CLASS.actions, children: slot("settings.action", {}) }),
            closeButton,
          ],
        }),
        deps.runtime.jsx("div", {
          key: "options",
          className: SETTINGS_CLASS.options,
          children: active !== undefined ? slot("settings.section", { close: () => close() }, { only: active }) : null,
        }),
      ],
    });
    const dialog = deps.runtime.jsxs("div", {
      key: "panel",
      ref: attach,
      tabIndex: -1,
      "data-shortcut-modal": "settings",
      className: SETTINGS_CLASS.panel,
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": TITLE_ID,
      children: [nav, content],
    });
    const overlay = deps.runtime.jsxs("div", {
      className: SETTINGS_CLASS.overlay,
      role: "presentation",
      children: [mask, dialog],
    });
    const d = doc();
    if (typeof deps.portal === "function" && d?.body !== undefined) return deps.portal(overlay, d.body);
    // Không có react-dom (môi trường rút gọn): vẫn VẼ panel, chỉ mất tính body-portal (ghi rõ, không im lặng).
    return overlay;
  };

  return (props: Record<string, unknown>): unknown => {
    try {
      return panelComponent(props ?? {});
    } catch (error) {
      console.warn("gbh-client-ui-settings-general: panel render nem loi, bo qua", error);
      return null;
    }
  };
};
