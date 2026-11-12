/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Mat plugin cua row ui-layout: ghe store, provide ctx.layout, dang ky o root + phim tat + theme
 */
import { createAppFrame, type AppFrameProps, type FrameReact } from "./app-frame.ts";
import { createDocumentTitle } from "./document-title.ts";
import { EFFECT, INJECT, PACKAGE_NAME, PRODUCT_TITLE, ROOT_CHILDREN, ROOT_LOCALE_NS, SHORTCUT_NS, STYLE_TAG, THEME_CHANGE_EVENT, TOGGLE_SHORTCUT_ID } from "./ids.ts";
import { en, zh } from "./shortcut-locales.ts";
import { LayoutController, type PanelActions, type PanelInfo } from "./service.ts";
import { createLayoutStore, type DefineStore, type LayoutState } from "./stores.ts";
import { ThemePresenter, type ThemeSnapshot } from "./theme-presenter.ts";
import { vi } from "./locales-vi.ts";

/** Hàm `require` do bảng module của loader cấp cho factory (gọi lúc vạt chất hoá). */
export type RequireFn = (specifier: string) => unknown;

/**
 * Cổng NGOÀI (phạm vi MODULE): ctx của lần cài trước. Bundle HAI id ⇒ factory gọi hai lần trên CÙNG
 * một ctx ⇒ so identity là đủ chặn chắc; ctx mới (ca test khác) vẫn được cài bình thường.
 */
let bundleInstalled = false;

/** Cổng TRONG: tập ctx đã cài — chặn lần hai trên CÙNG ctx mà không dính giữa các ca test. */


/** CSS của khung, do `build.ts` nhúng bằng `define`; chạy từ nguồn (test) thì tra biến toàn cục. */
declare const __GBH_LAYOUT_CSS__: string;

/** Runtime JSX do bảng module cấp (`react/jsx-runtime`). */
interface JsxRuntime {
  /** Dựng element một con. */
  jsx: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Dựng element nhiều con. */
  jsxs: (type: unknown, props: Record<string, unknown>, key?: unknown) => unknown;
  /** Bao nhiều con không cần node bọc. */
  Fragment: unknown;
}

/** Module `react`: hook. KHÔNG có `jsx`/`jsxs` — chúng ở `react/jsx-runtime`. */
interface ReactHooks {
  /** Trạng thái cục bộ. */
  useState: FrameReact["useState"];
  /** Ô nhớ. */
  useRef: FrameReact["useRef"];
  /** Hiệu ứng sau khi vẽ. */
  useEffect: FrameReact["useEffect"];
  /** Hiệu ứng trước khi vẽ. */
  useLayoutEffect: FrameReact["useLayoutEffect"];
  /** Gói hàm nhớ. */
  useCallback: FrameReact["useCallback"];
  /** Nhớ giá trị. */
  useMemo: FrameReact["useMemo"];
}

/** Tập action đã ràng buộc của store khung (đủ tám action, đúng như spec của store). */
interface BoundLayoutActions extends PanelActions {
  /** Chọn panel giữa. */
  selectPanel: (panelId: string | null) => void;
  /** Bỏ chọn panel giữa vừa bị gỡ khỏi sổ `main`. */
  retainMainPanels: (panelIds: readonly string[]) => void;
  /** Ghi bề rộng thanh bên. */
  setSidebar: (px: number) => void;
  /** Ghi bề rộng khung. */
  setViewportWidth: (width: number) => void;
  /** Ghi bề rộng cột phải. */
  setRightbar: (px: number) => void;
}

/** Instance store mà framework cấp. */
interface StoreInstance {
  /** Action đã ràng buộc. */
  readonly actions: BoundLayoutActions;
  /** Ảnh chụp trạng thái. */
  getSnapshot: () => LayoutState;
  /** Đăng ký người nghe. */
  subscribe: (listener: () => void) => () => void;
}

/** Handle store: spec + factory. */
interface StoreHandle {
  /** Tạo (hoặc trả) instance dùng chung. */
  create: () => StoreInstance;
}

/** Một mục trong sổ một ô. */
interface SlotEntry {
  /** Tuỳ chọn đăng ký của mục. */
  readonly options: { readonly key?: string } & Record<string, unknown>;
}

/** Ngữ cảnh gốc phía client; chỉ khai những gì row này thật sự dùng. */
interface LayoutCtx {
  /** Đăng ký hiệu ứng vòng đời. */
  effect: (callback: () => void | (() => void), label: string) => void;
  /** Nghe sự kiện của ctx (trả hàm gỡ). */
  on: (event: string, listener: (snapshot: ThemeSnapshot) => void) => () => void;
  /** Từ điển giao diện. */
  locale: {
    /** Đăng ký một namespace. */
    register: (ns: string, dictionaries: { zh: unknown; en: unknown; vi?: unknown }) => () => void;
    /** Ràng buộc một namespace thành hàm đọc. */
    bind: (ns: string) => (key: string) => string;
  };
  /** Sổ slot. */
  slots: {
    /** Các mục đang có trong một ô. */
    entries: (name: string) => SlotEntry[];
    /** Ghế hook dùng chung ở gốc. */
    provideRoot: (share: { hooks: { panelInfo: unknown } }) => () => void;
    /** Đăng ký người chiếm một ô. */
    register: (options: { name: string } & Record<string, unknown>, component: unknown) => () => void;
    /** Nghe một ô đổi. */
    subscribe: (name: string, listener: () => void) => () => void;
  };
  /** Bảng dịch vụ liên plugin. */
  reflect: { provide: (name: string, value: unknown) => () => void };
  /** Sổ phím tắt. */
  shortcuts: { register: (spec: { id: string } & Record<string, unknown>) => () => void };
  /** Nguồn theme. */
  theme: { getTheme: () => ThemeSnapshot };
}

/** Mặt plugin mà Loader nhận. */
export interface ClientPlugin {
  /** Tên package. */
  readonly name: string;
  /** Seam cần có. */
  readonly inject: readonly string[];
  /** Thân plugin. */
  apply: (ctx: LayoutCtx) => void;
}

/**
 * Chèn thẻ style của khung nếu chưa có.
 * Nhận: không có (đọc `__GBH_LAYOUT_CSS__`).
 * Trả: không có.
 */
function injectStyles(): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(STYLE_TAG) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = STYLE_TAG;
  tag.textContent = typeof __GBH_LAYOUT_CSS__ === "string" ? __GBH_LAYOUT_CSS__ : "";
  document.head.appendChild(tag);
}

/**
 * Dựng mặt plugin của khung vỏ.
 * Nhận: hàm `require` của bảng module trang.
 * Trả: mặt plugin mà Loader gọi `apply` trên đó — lần cài thứ hai là no-op (hàng rào idempotent).
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const { jsx, jsxs, Fragment } = requireFn("react/jsx-runtime") as JsxRuntime;
  const react = requireFn("react") as ReactHooks;
  const storeModule = requireFn("@galaxy-blackhole/gbh-client-store") as { defineStore: DefineStore };
  injectStyles();
  const DocumentTitle = createDocumentTitle({ useEffect: react.useEffect });
  const AppFrame = createAppFrame({
    react: {
      jsx,
      jsxs,
      Fragment,
      useState: react.useState,
      useRef: react.useRef,
      useEffect: react.useEffect,
      useLayoutEffect: react.useLayoutEffect,
      useCallback: react.useCallback,
      useMemo: react.useMemo,
    },
    DocumentTitle: DocumentTitle as unknown as (props: { productTitle: string; useSessions: unknown; usePanelInfo: unknown }) => unknown,
  }) as (props: AppFrameProps) => unknown;

  /**
   * Than plugin that: tach khoi `apply` de boc hang rao idempotent + ghi loi bi cordis nuot.
   * Nhan: ngu canh plugin phia browser.
   * Tra: khong co.
   */
  function applyInner(ctx: LayoutCtx): void {
      ctx.effect(
        () =>
          ctx.locale.register(SHORTCUT_NS, { vi,
            zh,
            en,
          }),
        EFFECT.commandLabels,
      );
      const t = ctx.locale.bind(SHORTCUT_NS);
      ctx.effect(
        () => {
          const handle = createLayoutStore(storeModule.defineStore) as StoreHandle;
          const instance = handle.create();
          const store = { ...handle, create: () => instance };
          /** Bỏ chọn panel giữa nếu khoá của nó vừa bị gỡ khỏi sổ `main`. */
          const retainMainPanels = () => {
            instance.actions.retainMainPanels(
              ctx.slots
                .entries("main")
                .flatMap((entry) => (entry.options.key === undefined ? [] : [entry.options.key])),
            );
          };
          const layout = new LayoutController(
            instance.actions,
            (id) => ctx.slots.entries("main").some((entry) => entry.options.key === id),
            {
              getSnapshot: (): PanelInfo => instance.getSnapshot().panelInfo,
              subscribe: (listener) => instance.subscribe(listener),
            },
          );
          const disposePanelInfo = ctx.slots.provideRoot({ hooks: { panelInfo: layout.panelInfo } });
          const disposeService = ctx.reflect.provide("layout", layout);
          const disposeRegistration = ctx.slots.register(
            {
              name: "root",
              locale: ROOT_LOCALE_NS,
              children: ROOT_CHILDREN,
              store,
            },
            AppFrame,
          );
          const disposeShortcut = ctx.shortcuts.register({
            id: TOGGLE_SHORTCUT_ID,
            label: () => t("toggle"),
            aliases: ["sidebar", "toggle left sidebar"],
            defaults: {
              "desktop:macos": { code: "KeyB", modifiers: ["primary"] },
              "desktop:windows": { code: "KeyB", modifiers: ["primary"] },
              "desktop:linux": { code: "KeyB", modifiers: ["primary"] },
              "web:macos": { code: "KeyB", modifiers: ["primary", "alt"] },
              "web:windows": { code: "KeyB", modifiers: ["primary", "alt"] },
            },
            regions: ["page", "editable"],
            modals: [],
            resolve: () => ({
              status: "handled",
              run: () => {
                layout.toggleSidebar();
              },
            }),
          });
          const disposePanels = ctx.slots.subscribe("main", retainMainPanels);
          retainMainPanels();
          return () => {
            disposeShortcut();
            layout.dispose();
            disposePanels();
            disposeRegistration();
            disposePanelInfo();
            disposeService();
          };
        },
        EFFECT.service,
      );
      ctx.effect(
        () => {
          const presenter = new ThemePresenter();
          presenter.apply(ctx.theme.getTheme());
          const off = ctx.on(THEME_CHANGE_EVENT, (snapshot) => {
            presenter.apply(snapshot);
          });
          return () => {
            off();
            presenter.dispose();
          };
        },
        EFFECT.themePresenter,
      );
  }

  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Mat `apply` ma Loader goi.
     * Nhan: ngu canh plugin phia browser.
     * Tra: khong co — lan cai thu hai la no-op, va loi duoc IN RA roi moi nem tiep.
     */
    apply(ctx: LayoutCtx): void {
      // Cổng NGOÀI (boolean phạm vi module): chặn CHẮC lần nạp thứ hai, kể cả khi ctx khác.
      // Cổng: boolean PHẠM VI MODULE (17/10/2026) — hai entry ⇒ hai ctx, nên khoá-theo-ctx KHÔNG bao giờ kích hoạt.
      if (bundleInstalled) {
        console.warn("gbh-client-ui-layout: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
      // CO CHI BAT SAU khi cai xong (18/10/2026): neu applyInner nem giua duong (vi du slots chua san sang)
      // thi lan cai sau VAN phai chay lai — bat co som khien slot khong bao gio duoc dang ky lai ⇒ renderer
      // gap undefined ⇒ React #130. Day la loi that da lam app trang.
      bundleInstalled = true;
      } catch (error) {
        console.error(PACKAGE_NAME + ": apply nem loi", error);
        throw error;
      }
    },
  };
}
