/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hai component cua row ui-sidebar: vo cot sidebar (SidebarRoot) va ghe window-chrome (HeaderLeadingControls)
 */

import {
  COLLAPSE_SETTLE_MS,
  LOCAL_BUILD_TAG,
  NEW_SESSION_SHORTCUT_ID,
  SCROLLBAR_LINGER_MS,
  SLOTS,
  TOGGLE_SHORTCUT_ID,
} from "./ids.ts";
import { HEADER_CLASS, SIDEBAR_CLASS, clsx } from "./class-names.ts";

/** Hàm dựng element của React runtime. */
type JsxFn = (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;

/**
 * Hook của module react (namespace React KHÔNG có jsx/jsxs — hai hàm đó ở react/jsx-runtime).
 */
export interface ShellReact {
  /** Trạng thái "cột đã thu hẳn" và "con trỏ trong cột". */
  useState: <T>(initial: T) => [T, (next: T) => void];
  /** Ô nhớ giữa các lần render. */
  useRef: <T>(initial: T) => { current: T };
  /** Hiệu ứng vòng đời. */
  useEffect: (callback: () => void | (() => void), deps: unknown[]) => void;
}

/** Bề mặt ui-primitives mà hai component dùng. */
export interface ShellPrimitives {
  /** Tooltip dùng chung. */
  Tooltip: unknown;
  /** Biểu tượng mở/đóng panel. */
  IconPanelLeftOutlineRegular: unknown;
  /** Biểu tượng phiên mới cỡ thường. */
  IconNewChatOutlineRegular: unknown;
  /** Biểu tượng phiên mới cỡ vừa. */
  IconNewChatOutlineMedium: unknown;
  /** Biểu tượng cá của DSH (phương án dự phòng cho ô thương hiệu). */
  FishLogo: unknown;
  /** Chuỗi phím tắt. */
  ShortcutKeys: unknown;
  /** true khi đang chạy bản desktop macOS. */
  isDarwinDesktop: () => boolean;
}

/** Một dòng trong danh sách panel toàn cục (do plugin.ts dựng từ đăng ký slot). */
export interface PanelMetadata {
  /** Id panel, cũng là khoá panel ở cột chính. */
  id: string;
  /** Thứ tự tăng dần. */
  order: number;
  /** Nhãn đã phân giải. */
  label: string;
}

/** Một dòng trong danh mục phím tắt của shell. */
export interface ShortcutEntry {
  /** Id phím tắt. */
  id: string;
  /** Tổ hợp phím để hiện trong tooltip. */
  keys?: string[];
  /** Chuỗi `aria-keyshortcuts`. */
  aria?: string;
}

/** Hàm render một slot con: nhận owner share và tuỳ chọn (dự phòng, chỉ một id). */
export type RenderSlot = (name: string, owner: Record<string, unknown>, options?: Record<string, unknown>) => unknown;

/** Hàm đọc từ điển của namespace `sidebar` (bản gốc còn dùng khoá ngoài tập công bố). */
export type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Props của `HeaderLeadingControls`. */
export interface HeaderLeadingProps {
  /** Đóng/mở cột sidebar. */
  toggleSidebar: () => void;
  /** Bắt đầu phiên mới. */
  startSession: (workspaceId?: string) => void;
  /** Hook đọc danh mục phím tắt. */
  useShortcuts: (select: (rows: readonly ShortcutEntry[]) => unknown) => ShortcutEntry | undefined;
  /** Đọc từ điển. */
  t: Translate;
}

/** Props của `SidebarRoot`. */
export interface SidebarRootProps {
  /** Cột đang thu hẳn hay không (trạng thái của layout). */
  collapsed: boolean;
  /** Bề rộng cột do layout cấp. */
  width: number;
  /** Bắt đầu phiên mới (có thể kèm workspace). */
  startSession: (workspaceId?: string) => void;
  /** Đóng/mở cột. */
  toggleSidebar: () => void;
  /** Chọn panel toàn cục. */
  selectPanel: (id: string) => void;
  /** Hook đọc danh sách panel đã đăng ký. */
  usePanels: (select: (panels: readonly PanelMetadata[]) => readonly PanelMetadata[]) => readonly PanelMetadata[];
  /** Hook đọc danh mục phím tắt. */
  useShortcuts: (select: (rows: readonly ShortcutEntry[]) => unknown) => ShortcutEntry | undefined;
  /** Hook cho biết panel nào đang được chọn ở cột chính. */
  usePanelInfo: (select: (info: { activePanelId?: string }) => unknown) => boolean;
  /** Đọc từ điển. */
  t: Translate;
  /** Render các slot con. */
  renderSlot: RenderSlot;
}

/** Phụ thuộc chung của hai component. */
export interface ShellDeps {
  /** Hàm dựng element một con — LẤY TỪ react/jsx-runtime. */
  jsx: JsxFn;
  /** Hàm dựng element nhiều con — LẤY TỪ react/jsx-runtime. */
  jsxs: JsxFn;
  /** Hook của react. */
  react: ShellReact;
  /** Bề mặt ui-primitives. */
  primitives: ShellPrimitives;
}

/**
 * Dựng chuỗi phiên bản in ở nhịp thương hiệu cục bộ.
 * Nhận: không.
 * Trả: `<phiên bản>-<commit>` (kèm `-dirty` khi bản build đánh dấu bẩn).
 */
export function localBuildVersion(): string {
  const dirty = (globalThis as { DSH_CLIENT_GIT_DIRTY?: string }).DSH_CLIENT_GIT_DIRTY === "true";
  return LOCAL_BUILD_TAG + (dirty ? "-dirty" : "");
}

/**
 * Dựng hai nút ở ghế window-chrome (mở sidebar + phiên mới).
 * Nhận: phụ thuộc React/ui-primitives.
 * Trả: component nhận props của renderer.
 */
export function createHeaderLeadingControls({ jsx, jsxs, primitives }: ShellDeps): (props: HeaderLeadingProps) => unknown {
  /**
   * Hai nút điều khiển cạnh đèn giao thông của cửa sổ macOS khi cột đã thu hẳn.
   * Nhận: hành động đã inject và ghế từ điển.
   * Trả: element của hàng nút.
   */
  return function HeaderLeadingControls(props: HeaderLeadingProps): unknown {
    const { toggleSidebar, startSession, useShortcuts, t } = props;
    const shortcut = useShortcuts((rows) => rows.find((row) => row.id === TOGGLE_SHORTCUT_ID));
    const newShortcut = useShortcuts((rows) => rows.find((row) => row.id === NEW_SESSION_SHORTCUT_ID));
    return jsxs("div", {
      className: HEADER_CLASS.controls,
      children: [
        jsx(primitives.Tooltip, {
          label: t("toggle.open"),
          shortcutKeys: shortcut?.keys,
          delayMs: 500,
          children: jsx("button", {
            type: "button",
            className: HEADER_CLASS.iconButton,
            "aria-label": t("toggle.open"),
            "aria-keyshortcuts": shortcut?.aria,
            onClick: () => {
              toggleSidebar();
            },
            children: jsx(primitives.IconPanelLeftOutlineRegular, { size: 16 }),
          }),
        }),
        jsx(primitives.Tooltip, {
          label: t("session.new.label"),
          shortcutKeys: newShortcut?.keys,
          delayMs: 500,
          children: jsx("button", {
            type: "button",
            className: HEADER_CLASS.iconButton,
            "aria-label": t("session.new.label"),
            "aria-keyshortcuts": newShortcut?.aria,
            onClick: () => {
              startSession();
            },
            children: jsx(primitives.IconNewChatOutlineRegular, { size: 16 }),
          }),
        }),
      ],
    });
  };
}

/**
 * Dựng vỏ cột sidebar (kèm component con `PanelRow`).
 * Nhận: phụ thuộc React/ui-primitives.
 * Trả: component nhận props của renderer.
 */
export function createSidebarRoot({ jsx, jsxs, react, primitives }: ShellDeps): (props: SidebarRootProps) => unknown {
  /**
   * Một dòng panel toàn cục: tự đăng ký theo dõi ĐÚNG trạng thái chọn của mình.
   * Nhận: id, nhãn, cờ cột rộng, hook trạng thái, hàm chọn panel, hàm render slot.
   * Trả: element của dòng panel.
   */
  function PanelRow(props: {
    id: string;
    label: string;
    wide: boolean;
    usePanelInfo: SidebarRootProps["usePanelInfo"];
    selectPanel: (id: string) => void;
    renderSlot: RenderSlot;
  }): unknown {
    const { id, label, wide, usePanelInfo, selectPanel, renderSlot } = props;
    const active = usePanelInfo((info) => info.activePanelId === id);
    return jsx(primitives.Tooltip, {
      label,
      delayMs: 500,
      disabled: wide,
      children: jsxs("button", {
        type: "button",
        className: clsx(SIDEBAR_CLASS.panelRow, active && SIDEBAR_CLASS.panelActive),
        "aria-label": label,
        "aria-current": active ? "page" : undefined,
        onClick: () => {
          selectPanel(id);
        },
        children: [
          jsx("span", {
            className: SIDEBAR_CLASS.panelGlyph,
            "aria-hidden": "true",
            children: renderSlot(SLOTS.panellist, { size: wide ? 16 : 18, active }, { only: id }),
          }),
          wide &&
            jsx("span", {
              className: clsx(SIDEBAR_CLASS.panelTitle, SIDEBAR_CLASS.wide),
              children: label,
            }),
        ],
      }),
    });
  }

  /**
   * Vỏ cột sidebar: hình học cột và điều hướng panel toàn cục.
   *
   * Thu gọn là một cú trượt kèm mờ chéo: nội dung đóng băng ở bề rộng đang mở (style nội tuyến) rồi mờ
   * tại chỗ trong khi cột trượt (do lưới của AppFrame cắt) — không có gì dồn lại giữa cú trượt. Khi đã
   * yên, nội dung chỉ-hiện-khi-rộng tháo ra và các nút trên vào ray 56px từ đúng độ lệch ngang cũ.
   * Vùng duyệt workspace/phiên giữa danh sách panel và chân cột thuộc về nơi đăng ký
   * `sidebar.workspaces`; chân cột giữ `sidebar.settings` và `sidebar.footer.action`.
   * Nhận: props của renderer (trạng thái layout + hành động đã inject + ghế từ điển).
   * Trả: element của cột sidebar.
   */
  return function SidebarRoot(props: SidebarRootProps): unknown {
    const { collapsed, width, startSession, toggleSidebar, selectPanel, usePanels, useShortcuts, usePanelInfo, t, renderSlot } = props;
    const panels = usePanels((snapshot) => snapshot);
    const shortcut = useShortcuts((rows) => rows.find((row) => row.id === TOGGLE_SHORTCUT_ID));
    const newShortcut = useShortcuts((rows) => rows.find((row) => row.id === NEW_SESSION_SHORTCUT_ID));
    const toggleLabel = collapsed ? t("toggle.open") : t("toggle.collapse");
    const [settled, setSettled] = react.useState(collapsed);
    react.useEffect(() => {
      if (!collapsed) {
        setSettled(false);
        return;
      }
      const timer = window.setTimeout(() => {
        setSettled(true);
      }, COLLAPSE_SETTLE_MS);
      return () => {
        window.clearTimeout(timer);
      };
    }, [collapsed]);
    const windowsTitlebar = document.documentElement.hasAttribute("data-windows-titlebar");
    const wide = windowsTitlebar ? !collapsed : !collapsed || !settled;
    const captionTooltipSide = windowsTitlebar ? "bottom" : "right";
    const lastWideWidth = react.useRef(width);
    if (!collapsed) lastWideWidth.current = width;
    const everWide = react.useRef(!collapsed);
    if (!collapsed) everWide.current = true;
    const column = react.useRef<{ getBoundingClientRect(): { left: number; right: number; top: number; bottom: number } } | null>(null);
    const [pointerInside, setPointerInside] = react.useState(false);
    const lingerTimer = react.useRef<number | undefined>(undefined);

    /** Hẹn giờ tắt cờ "con trỏ trong cột" sau quãng nán lại (chỉ hẹn một lần). */
    const armLinger = (): void => {
      if (lingerTimer.current !== undefined) return;
      lingerTimer.current = window.setTimeout(() => {
        lingerTimer.current = undefined;
        setPointerInside(false);
      }, SCROLLBAR_LINGER_MS);
    };
    /** Huỷ hẹn giờ nán lại (con trỏ đã quay lại trong cột). */
    const cancelLinger = (): void => {
      window.clearTimeout(lingerTimer.current);
      lingerTimer.current = undefined;
    };
    react.useEffect(() => {
      if (!pointerInside) return;
      const onMove = (event: PointerEvent): void => {
        const rect = column.current?.getBoundingClientRect();
        if (rect === undefined) return;
        if (event.clientX >= rect.left && event.clientX < rect.right && event.clientY >= rect.top && event.clientY < rect.bottom) cancelLinger();
        else armLinger();
      };
      document.addEventListener("pointermove", onMove);
      return () => {
        document.removeEventListener("pointermove", onMove);
        cancelLinger();
      };
    }, [pointerInside]);

    const buildVersion: string | undefined = localBuildVersion();
    const darwinDesktop = primitives.isDarwinDesktop();
    const toggle = jsx(primitives.Tooltip, {
      label: toggleLabel,
      shortcutKeys: shortcut?.keys,
      delayMs: 500,
      side: captionTooltipSide,
      children: jsxs("button", {
        type: "button",
        className: clsx(SIDEBAR_CLASS.iconButton, SIDEBAR_CLASS.toggle),
        "aria-label": toggleLabel,
        "aria-keyshortcuts": shortcut?.aria,
        onClick: () => {
          toggleSidebar();
        },
        children: [
          !wide &&
            !windowsTitlebar &&
            jsx("span", {
              className: SIDEBAR_CLASS.railMark,
              "aria-hidden": "true",
              children: renderSlot(SLOTS.brandMark, { size: 24 }, { fallback: jsx(primitives.FishLogo, { size: 24 }) }),
            }),
          jsx(primitives.IconPanelLeftOutlineRegular, {
            className: SIDEBAR_CLASS.panelIcon,
            size: wide || windowsTitlebar ? 16 : 18,
          }),
          !wide && renderSlot(SLOTS.toggleBadge, {}),
        ],
      }),
    });

    /** Khối danh tính thương hiệu: dấu + tên, kèm phương án dự phòng khi chưa ai chiếm ô. */
    const brandIdentity = (): unknown =>
      jsxs("span", {
        className: SIDEBAR_CLASS.brandIdentity,
        "aria-hidden": "true",
        children: [
          jsx("span", {
            className: SIDEBAR_CLASS.brandMark,
            children: renderSlot(SLOTS.brandMark, { size: 24 }, { fallback: jsx(primitives.FishLogo, { size: 24 }) }),
          }),
          jsx("span", {
            className: SIDEBAR_CLASS.brandName,
            children: renderSlot(
              SLOTS.brandName,
              {},
              {
                fallback:
                  buildVersion === undefined
                    ? jsx("span", { className: SIDEBAR_CLASS.fallbackBrandName, children: t("brand.localBuild") })
                    : jsxs("span", {
                        className: SIDEBAR_CLASS.localBuildBrand,
                        children: [
                          jsx("span", { className: SIDEBAR_CLASS.localBuildTitle, children: t("brand.localBuild") }),
                          jsx("span", { className: SIDEBAR_CLASS.buildVersion, children: buildVersion }),
                        ],
                      }),
              },
            ),
          }),
        ],
      });

    return jsxs("div", {
      ref: column,
      className: clsx(
        SIDEBAR_CLASS.root,
        !wide && SIDEBAR_CLASS.collapsed,
        !wide && everWide.current && SIDEBAR_CLASS.railIn,
        collapsed && wide && SIDEBAR_CLASS.fading,
        !pointerInside && SIDEBAR_CLASS.quietBars,
      ),
      style: wide ? { width: collapsed ? lastWideWidth.current : width } : undefined,
      onPointerEnter: () => {
        cancelLinger();
        setPointerInside(true);
      },
      onPointerLeave: () => {
        armLinger();
      },
      children: [
        darwinDesktop &&
          jsx("div", {
            className: SIDEBAR_CLASS.topStrip,
            "data-window-drag": true,
            children: toggle,
          }),
        jsxs("div", {
          className: SIDEBAR_CLASS.logoRow,
          "data-window-drag": true,
          children: [
            wide &&
              (darwinDesktop
                ? jsx("span", { className: clsx(SIDEBAR_CLASS.brand, SIDEBAR_CLASS.wide), children: brandIdentity() })
                : jsx("button", {
                    type: "button",
                    className: clsx(SIDEBAR_CLASS.brand, SIDEBAR_CLASS.wide),
                    "aria-label": t("session.new.label"),
                    "aria-keyshortcuts": newShortcut?.aria,
                    onClick: () => {
                      startSession();
                    },
                    children: brandIdentity(),
                  })),
            !darwinDesktop && toggle,
          ],
        }),
        jsx(primitives.Tooltip, {
          label: t("session.new.label"),
          shortcutKeys: newShortcut?.keys,
          delayMs: 500,
          side: captionTooltipSide,
          disabled: wide,
          children: jsxs("button", {
            type: "button",
            className: SIDEBAR_CLASS.newSession,
            "aria-label": t("session.new.label"),
            "aria-keyshortcuts": newShortcut?.aria,
            onClick: () => {
              startSession();
            },
            children: [
              jsx("span", {
                className: SIDEBAR_CLASS.newSessionLabelMask,
                children: jsxs("span", {
                  className: SIDEBAR_CLASS.newSessionContent,
                  children: [
                    wide
                      ? jsx(primitives.IconNewChatOutlineMedium, { size: 14 })
                      : jsx(primitives.IconNewChatOutlineRegular, { size: windowsTitlebar ? 16 : 18 }),
                    wide &&
                      jsx("span", {
                        className: clsx(SIDEBAR_CLASS.newSessionLabel, SIDEBAR_CLASS.wide),
                        children: t("session.new"),
                      }),
                  ],
                }),
              }),
              wide &&
                newShortcut !== undefined &&
                newShortcut.keys !== undefined &&
                newShortcut.keys.length > 0 &&
                jsx("span", {
                  className: SIDEBAR_CLASS.newSessionShortcut,
                  "aria-hidden": "true",
                  children: jsx(primitives.ShortcutKeys, { keys: newShortcut.keys }),
                }),
            ],
          }),
        }),
        panels.length > 0 &&
          jsx("nav", {
            className: SIDEBAR_CLASS.panelList,
            "aria-label": t("panels.label"),
            children: panels.map(({ id, label }) =>
              jsx(PanelRow, { id, label, wide, usePanelInfo, selectPanel, renderSlot }, id),
            ),
          }),
        jsx("div", {
          className: SIDEBAR_CLASS.regionArea,
          children: renderSlot(SLOTS.workspaces, {
            wide,
            expandSidebar: () => {
              if (collapsed) toggleSidebar();
            },
          }),
        }),
        jsxs("div", {
          className: SIDEBAR_CLASS.footArea,
          children: [
            jsx("div", {
              className: SIDEBAR_CLASS.footerActions,
              children: renderSlot(SLOTS.footerAction, { wide }),
            }),
            jsx("div", {
              className: SIDEBAR_CLASS.settingsArea,
              children: renderSlot(SLOTS.settings, { wide }),
            }),
          ],
        }),
      ],
    });
  };
}
