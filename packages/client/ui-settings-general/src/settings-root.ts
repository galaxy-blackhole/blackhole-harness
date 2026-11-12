/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Vỏ Settings ở ghế sidebar.settings: hàng trigger (VOzbGW_triggerRow) + panel khi MỞ — SettingsRoot.js 348-498
 */

import { createBadge } from "./badge.ts";
import { createSettingsPanel } from "./settings-panel.ts";
import { SETTINGS_CLASS, SETTINGS_CSS } from "./settings-css.ts";
import type { SettingsShellActions, SettingsShellState } from "./settings-store.ts";
import type { ComponentFactory, GeneralDeps } from "./types.ts";

/** Document tối thiểu (không dùng kiểu DOM của dự án). */
interface DocumentLike {
  /** Tạo thẻ style. */
  createElement(name: string): { dataset: Record<string, string>; textContent: string };
  /** The head. */
  head: { appendChild(node: unknown): void };
  /** Tìm thẻ đã có. */
  querySelector(selector: string): unknown;
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

/**
 * Ghép lớp theo kiểu clsx.
 * @param values - các lớp, bỏ qua giá trị rỗng.
 * @returns chuỗi lớp đã ghép.
 */
function clsx(...values: unknown[]): string {
  return values.filter((value) => typeof value === "string" && value !== "").join(" ");
}

/**
 * Gọi một hook chọn của tầng slots nếu có, KHÔNG có thì trả giá trị dự phòng.
 * Hook luôn được gọi ở cùng một vị trí nên thứ tự hook không đổi giữa các lần render.
 * @param hook - hook do renderer cấp (có thể vắng ở môi trường rút gọn).
 * @param select - hàm chọn.
 * @param fallback - giá trị dùng khi hook vắng hoặc ném.
 * @returns giá trị đã chọn.
 */
function pick(hook: unknown, select: (value: unknown) => unknown, fallback: unknown): unknown {
  if (typeof hook !== "function") return fallback;
  try {
    return (hook as (s: (value: unknown) => unknown) => unknown)(select);
  } catch (error) {
    console.warn("gbh-client-ui-settings-general: hook chon nem loi, dung gia tri du phong", error);
    return fallback;
  }
}

/** Nhãn trạng thái kết nối mà hàng trigger phơi cho ConnectionIndicator. */
function connectionPill(state: unknown): string | undefined {
  if (state === "connecting") return "connecting";
  if (state === "disconnected") return "disconnected";
  if (state === "recovered") return "recovered";
  return undefined;
}

/**
 * Dựng vỏ Settings cho ghế `sidebar.settings`.
 *
 * ⚠️ ĐÂY LÀ CHỖ TỪNG MẤT CHỨC NĂNG (đo 18/10/2026): bản cũ đăng ký thẳng component [icon, label] vào ghế này
 * nên hàng trigger KHÔNG có nút, không có `onClick`, và panel không bao giờ được vẽ — hỏng chỉ lộ ra khi
 * người dùng BẤM. Bản này trả ĐÚNG cây của bản gốc: hàng `VOzbGW_triggerRow` + `open && <SettingsPanel/>`.
 * Cổng chặn nằm ở PHÍA COMPONENT (`open &&`), KHÔNG phải ở layout — `shell.overlay` mới là ghế layout vẽ
 * vô điều kiện, còn ghế này do chính component quyết định.
 *
 * @param deps - deps do plugin.ts cấp (runtime, primitives, store, locale).
 * @returns component hợp lệ cho slots.register.
 */
export const createSettingsRoot: ComponentFactory = (deps: GeneralDeps): unknown => {
  const panel = createSettingsPanel(deps) as (props: Record<string, unknown>) => unknown;
  const updateIndicator = createBadge(deps) as (props: Record<string, unknown>) => unknown;

  const rootComponent = (props: Record<string, unknown>): unknown => {
    ensureStyle("@galaxy-blackhole/gbh-client-ui-settings-general/SettingsRoot.module.css", SETTINGS_CSS);
    const store = deps.settingsStore;
    const t = typeof props.t === "function" ? (props.t as (key: string) => string) : deps.locale;
    const renderSlot = props.renderSlot;
    // ⚠️ 18/10/2026 — INSTRUMENT tam thoi de DO (khong phai sua): ban goc nhan renderSlot qua props
    //   va do la duong DUY NHAT de ve than section. Neu prop nay khong duoc truyen thi than panel
    //   trong => can biet chinh xac props co gi thay vi doan.
    if (typeof renderSlot !== "function") console.warn("[gbh-settings-root] renderSlot KHONG duoc truyen; props =", Object.keys(props ?? {}).join(","));
    const slot = (name: string, params: Record<string, unknown>, options?: unknown): unknown =>
      typeof renderSlot === "function" ? (renderSlot as (n: string, p: unknown, o?: unknown) => unknown)(name, params, options) : null;
    const state = pick(props.useStore, (value) => value, store.getSnapshot()) as SettingsShellState;
    const actions = (typeof props.actions === "object" && props.actions !== null ? props.actions : store.actions) as SettingsShellActions;
    const open = state?.open === true;
    const activeId = state?.activeId;
    const wide = props.wide === true;
    const rows = (pick(props.useSections, (value) => value, []) as { id?: unknown; label?: unknown }[]) ?? [];
    const desktopUpdate = pick(props.useDesktopUpdate, (value) => value, deps.store.desktopUpdate) as
      | { presentation?: { phase?: string } }
      | undefined;
    const connectionState = pick(props.useConnectionState, (value) => value, "connected");
    const shortcut = pick(
      props.useShortcuts,
      (value) => (Array.isArray(value) ? value.find((row) => (row as { id?: unknown })?.id === "settings.open") : undefined),
      undefined,
    ) as { keys?: unknown[]; aria?: string; keys2?: unknown } | undefined;
    const keys = Array.isArray(shortcut?.keys) ? shortcut.keys : [];
    const primitives = deps.primitives as Record<string, unknown>;
    const phase = desktopUpdate?.presentation?.phase;
    const pill = connectionPill(connectionState);
    // Nút mở Settings: nằm trong FALLBACK của settings.launcher (đúng bản gốc) — gói nào chiếm ghế launcher
    // thì thay cả cụm, còn không có ai thì hàng này vẫn có nút của ta.
    const openButton = deps.runtime.jsx("button", {
      type: "button",
      className: clsx(SETTINGS_CLASS.trigger, !wide && SETTINGS_CLASS.rail),
      "aria-label": t("trigger"),
      "aria-keyshortcuts": shortcut?.aria,
      "aria-haspopup": "dialog",
      "aria-expanded": open,
      onClick: () => actions.open(),
      children: slot("settings.trigger", { wide }),
    });
    const Tooltip = primitives.Tooltip;
    const fallback = typeof Tooltip === "function"
      ? deps.runtime.jsx(Tooltip, { disabled: open, label: t("trigger"), shortcutKeys: shortcut?.keys, children: openButton })
      : openButton;
    const launcher = slot(
      "settings.launcher",
      {
        wide,
        settingsOpen: open,
        openSettings: actions.open,
        ...(keys.length > 0 ? { settingsShortcut: { keys: shortcut?.keys, aria: shortcut?.aria } } : {}),
        openOnboarding: () => actions.close(),
      },
      { fallback },
    );
    const ConnectionIndicator = primitives.ConnectionIndicator;
    const indicator = typeof ConnectionIndicator === "function"
      ? deps.runtime.jsx(ConnectionIndicator, {
        key: "connection",
        state: wide && phase !== "installing" ? pill : undefined,
        disconnectedLabel: t("connection.error"),
        connectingLabel: t("connection.connecting"),
        recoveredLabel: t("connection.connected"),
        reconnectActionLabel: t("connection.reconnect"),
        restartActionLabel: t("connection.restart"),
        onReconnect: typeof props.reconnect === "function" ? props.reconnect : () => undefined,
      })
      : null;
    const update = deps.runtime.jsx(updateIndicator, {
      key: "update",
      wide,
      hidden: pill !== undefined && phase !== "installing",
      t,
      view: desktopUpdate,
      onOpen: typeof props.openDesktopUpdate === "function" ? props.openDesktopUpdate : () => undefined,
    });
    const triggerRow = deps.runtime.jsxs("div", {
      key: "trigger-row",
      className: clsx(SETTINGS_CLASS.triggerRow, !wide && SETTINGS_CLASS.railRow),
      children: [launcher, indicator, update],
    });
    // ⚠️ CỔNG CHẶN: chỉ vẽ panel khi store nói MỞ. Panel tự gắn/gỡ listener Escape theo vòng đời DOM.
    const modal = open
      ? deps.runtime.jsx(panel, {
        key: "panel",
        rows,
        renderSlot,
        activeId,
        onSelect: actions.select,
        onClose: actions.close,
      })
      : null;
    return [triggerRow, modal];
  };

  return (props: Record<string, unknown>): unknown => {
    try {
      return rootComponent(props ?? {});
    } catch (error) {
      // Ghế này là NỬA thanh bên: ném ở đây làm cả sidebar trắng (đã xảy ra). Nuốt và ghi rõ.
      console.warn("gbh-client-ui-settings-general: root render nem loi, bo qua ghe nay", error);
      return null;
    }
  };
};
