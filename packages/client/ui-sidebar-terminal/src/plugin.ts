/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ruột nửa client của row ui-sidebar-terminal: kiểu tab, phím tắt, hai chỗ ngồi ở sidebar phải
 */

import { NS, en, zh } from "./locales.ts";
import { PACKAGE_NAME } from "./ids.ts";
import { createLazyTerminalBody } from "./lazy-body.ts";
import { createTerminalGuide, type GuidePrimitivesLike } from "./terminal-guide.ts";
import { createTerminalTitle } from "./terminal-title.ts";
import { GUIDE_CSS } from "./guide-css.ts";
import type { JsxRuntimeLike, ReactLike } from "./types.ts";
import { vi } from "./locales-vi.ts";

/** require do bảng module cấp cho factory. */
export type RequireFn = ((id: string) => unknown) & { async?: (path: string) => Promise<Record<string, unknown>> };

/** Một ảnh chụp có thể theo dõi được. */
export interface ObservableLike<T> {
  /** Ảnh chụp hiện tại. */
  getSnapshot(): T;
  /** Theo dõi thay đổi; trả hàm huỷ. */
  subscribe(listener: () => void): () => void;
}

/** Khe cắm của trang. */
export interface SlotsSeamLike {
  /** Đăng ký một occupant; trả giá trị do seam quyết định. */
  register(definition: Record<string, unknown>, component: unknown): unknown;
  /** Đăng ký occupant vào slot, có thể hoãn. */
  inject(slot: string, register: () => unknown): void;
}

/** Seam từ điển. */
export interface LocaleSeamLike {
  /** Bind một namespace thành hàm t(key, params). */
  bind(namespace: string): (key: string, params?: Record<string, string>) => string;
  /** Đăng ký từ điển. */
  register(namespace: string, copy: Record<string, Record<string, string>>): unknown;
}

/** Context phía browser (chỉ khai phần row này dùng). */
export interface ClientContextLike {
  /** Đăng ký hiệu ứng có thể huỷ; callback trả hàm dọn dẹp hoặc giá trị bất kỳ. */
  effect(callback: () => unknown, label?: string): unknown;
  /** Khe cắm. */
  slots: SlotsSeamLike;
  /** Từ điển. */
  locale: LocaleSeamLike;
  /** Sidebar phải. */
  sidebarRight: {
    /** Các tab đang mở. */
    openTabs: ObservableLike<{ id: string; kind: string; contentId: string }[]>;
    /** Miền tab của một phiên. */
    tabDomain: {
      /** Một lần xuất hiện tab trong phiên. */
      occurrence(sessionId: string, key: { id: string }): {
        navigation: { getSnapshot(): { params?: Record<string, unknown>; address: string } };
      };
    };
    /** Đích lệnh từ một phần tử. */
    commandTarget(element: unknown): { sessionId: string } | undefined;
    /** Mở tab từ một đích. */
    openTabFromTarget(kind: string, target: unknown): void;
    /** Đăng ký hàm đóng tab. */
    registerCloseHandler(kind: string, handler: (sessionId: string, tab: { id: string; contentId: string }) => void): unknown;
  };
  /** Kiểu tab của sidebar phải. */
  sidebarRightTabs: {
    /** Đăng ký một kiểu tab. */
    register(definition: Record<string, unknown>): unknown;
  };
  /** Terminal của trang (dịch vụ của gói host). */
  webTerminals: {
    /** Giữ lại đúng các tab còn mở. */
    retainTabs(tabs: { id: string; kind: string }[]): void;
    /** Dò các shell có thể chạy. */
    launchShells(sessionId: string, signal: AbortSignal): Promise<{ shells: { path: string; name: string }[]; selectedShell?: string }>;
    /** Ghi nhớ shell đã chọn. */
    selectShell(path: string): void;
    /** View điều khiển một terminal. */
    view(sessionId: string, key: string, contentId: string, terminalId?: string, shellPath?: unknown): unknown;
    /** Đóng một terminal. */
    close(sessionId: string, key: string, contentId: string, terminalId?: string): void;
  };
  /** Theme đang dùng. */
  theme: {
    /** Ảnh chụp theme. */
    getTheme(): unknown;
  };
  /** Sự kiện của app. */
  on(event: string, listener: () => void): () => void;
  /** Bảng phím tắt. */
  shortcuts: {
    /** Bảng phím tắt đã đăng ký. */
    catalog: unknown;
    /** Đăng ký một phím tắt. */
    register(definition: Record<string, unknown>): unknown;
  };
}

/** Plugin phía browser do factory dựng ra. */
export interface SidebarTerminalPlugin {
  /** Gắn tab terminal vào sidebar phải. */
  apply(ctx: ClientContextLike): void;
  /** Dịch vụ bắt buộc (cordis fiber inject). */
  inject: string[];
}

/** Bảy dịch vụ mà hai chỗ ngồi của terminal cần. */
export const INJECT = [
  "slots",
  "locale",
  "sidebarRight",
  "sidebarRightTabs",
  "webTerminals",
  "theme",
  "shortcuts",
];

/**
 * Cờ chặn cài hai lần ở PHẠM VI MODULE — **LUẬT CHUNG chốt 17/10/2026**, đặt TRƯỚC JSDoc của createPlugin
 * (không chen giữa JSDoc và hàm — cổng jsdoc bắt lỗi đó).
 *
 * Vì sao KHÔNG khoá theo `ctx` (WeakSet/`lastCtx`): ca thật là **HAI ENTRY ⇒ HAI CTX**
 * (`parent.extend({fiber})`), nên khoá theo ctx KHÔNG chặn được — `shortcuts` dùng `lastCtx` vẫn lỗi cho
 * tới khi đổi sang boolean. Giá phải trả: cờ dính giữa các ca test trong cùng file ⇒ mỗi ca nạp MODULE TƯƠI.
 */
let installed = false;

/**
 * Dựng nửa client của row từ require do bảng module cấp.
 * Nhận: require của bảng module (lấy react, react/jsx-runtime và ui-primitives; có thêm .async cho chunk).
 * Trả: plugin { apply, inject }.
 */

/**
 * Chèn CSS của thẻ hướng dẫn vào <head> đúng MỘT lần (mỗi tài liệu).
 * Nhận: không. Trả: không.
 *
 * Vì sao cần: CSS nằm ở `guide-css.ts` nhưng trước 22/10/2026 KHÔNG được chèn vào artefact ⇒ thẻ
 * Terminal trong khung “Bắt đầu” mất hết kiểu (tiêu đề và mô tả nằm cùng dòng). Bản de-bundle của gốc
 * có sẵn khối chèn này; bản viết tay làm rơi mất.
 */
function injectGuideCss(): void {
  if (typeof document === "undefined") return;
  const dau = "style[data-gbh-guide=\"ui-sidebar-terminal\"]";
  if (document.querySelector(dau) !== null) return;
  const tag = document.createElement("style");
  tag.dataset.gbhGuide = "ui-sidebar-terminal";
  tag.textContent = GUIDE_CSS;
  document.head.appendChild(tag);
}
/**
 * Tạo plugin nửa client của row `ui-sidebar-terminal`.
 * Nhận: requireFn — hàm require do bảng module cấp (để nạp primitives + chunk terminal).
 * Trả: plugin { apply, inject } theo đúng khuôn của bản gốc.
 */
export function createPlugin(requireFn: RequireFn): SidebarTerminalPlugin {
  const apply = (ctx: ClientContextLike): void => {
    // CỜ CHỈ BẬT SAU KHI applyInner CHẠY XONG: bật sớm ⇒ lần cài sau thoát sớm ⇒ slot không được đăng ký lại.
    if (installed) return;
    try {
      injectGuideCss();
      applyInner(ctx);
      installed = true;
    } catch (error) {
      console.error("gbh-client-ui-sidebar-terminal: apply nem loi", error);
      throw error;
    }
  };

  const applyInner = (ctx: ClientContextLike): void => {
    const runtime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
    const react = requireFn("react") as ReactLike;
    const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as GuidePrimitivesLike;
    const requireAsync = requireFn.async;
    if (requireAsync === undefined) throw new Error("ui-sidebar-terminal: bộ nạp không cấp require.async nên không nạp được chunk terminal");
    const TerminalGuide = createTerminalGuide(runtime, react, primitives);
    const TerminalTitle = createTerminalTitle(runtime, react);
    const LazyTerminalBody = createLazyTerminalBody(runtime, react, (path) => requireAsync(path));
    ctx.effect(() => {
      const sync = (): void => {
        ctx.webTerminals.retainTabs(
          ctx.sidebarRight.openTabs.getSnapshot().filter((tab) => tab.kind === "terminal"),
        );
      };
      const unsubscribe = ctx.sidebarRight.openTabs.subscribe(sync);
      sync();
      return () => {
        unsubscribe();
        ctx.webTerminals.retainTabs([]);
      };
    }, "ui-sidebar-terminal.window-holds");
    const target = (sessionId: string, key: string): Record<string, unknown> | undefined =>
      ctx.sidebarRight.tabDomain.occurrence(sessionId, { id: key }).navigation.getSnapshot().params;
    const terminalId = (sessionId: string, key: string): string | undefined => {
      const params = target(sessionId, key);
      return params !== undefined && "terminalId" in params ? (params.terminalId as string) : undefined;
    };
    const view = (sessionId: string, key: string): unknown => {
      const params = target(sessionId, key);
      const contentId = ctx.sidebarRight.tabDomain.occurrence(sessionId, { id: key }).navigation.getSnapshot().address;
      const shellPath = params !== undefined && "shellPath" in params ? params.shellPath : undefined;
      return ctx.webTerminals.view(sessionId, key, contentId, terminalId(sessionId, key), shellPath);
    };
    const t = ctx.locale.bind(NS);
    ctx.effect(() => ctx.shortcuts.register({
      id: "terminal.new",
      label: () => t("new"),
      aliases: ["new terminal", "shell"],
      defaults: {
        "desktop:macos": { code: "Backquote", modifiers: ["control"] },
        "desktop:windows": { code: "Backquote", modifiers: ["control"] },
        "desktop:linux": { code: "Backquote", modifiers: ["control"] },
        "web:macos": { code: "Backquote", modifiers: ["control"] },
        "web:windows": { code: "Backquote", modifiers: ["control"] },
      },
      regions: ["page", "editable", "terminal"],
      modals: [],
      resolve: ({ target: element }: { target: unknown }) => {
        const found = ctx.sidebarRight.commandTarget(element);
        if (found === undefined) return { status: "blocked", reason: t("shortcut.noSession") };
        return {
          status: "handled",
          run: () => {
            ctx.sidebarRight.openTabFromTarget("terminal", found);
          },
        };
      },
    }), "ui-sidebar-terminal: shortcut");
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-sidebar-terminal.copy");
    ctx.effect(() => ctx.sidebarRightTabs.register({
      id: PACKAGE_NAME,
      kind: "terminal",
      multiple: true,
      priority: "builtin",
      title: () => t("title"),
      guide: [{
        id: "new",
        order: 20,
        title: () => t("new"),
        description: () => t("description"),
        icon: primitives.PluginArtworkTerminal,
      }],
    }), "ui-sidebar-terminal.type");
    ctx.effect(() => ctx.sidebarRight.registerCloseHandler("terminal", (sessionId, tab) => {
      ctx.webTerminals.close(sessionId, tab.id, tab.contentId, terminalId(sessionId, tab.id));
    }), "ui-sidebar-terminal.close");
    /** Mặt inject của hai chỗ ngồi theo tab. */
    const injectFace = (sessionId: string): Record<string, unknown> => ({
      view: (key: string) => view(sessionId, key),
      keyedHooks: { terminal: (key: string) => (view(sessionId, key) as { state: unknown }).state },
    });
    /** Theme dưới dạng ảnh chụp có thể theo dõi. */
    const theme = {
      getSnapshot: (): unknown => ctx.theme.getTheme(),
      subscribe: (listener: () => void): (() => void) => ctx.on("theme/change", listener),
    };
    ctx.effect(() => ctx.slots.inject("sidebar.right.tab.guide.entry", () => ctx.slots.register({
      name: "sidebar.right.tab.guide.entry",
      key: PACKAGE_NAME,
      locale: NS,
      inject: (sessionId: string) => ({
        hooks: { shortcuts: ctx.shortcuts.catalog },
        loadShells: (signal: AbortSignal) => ctx.webTerminals.launchShells(sessionId, signal),
        selectShell: (path: string) => {
          ctx.webTerminals.selectShell(path);
        },
      }),
    }, TerminalGuide)), "ui-sidebar-terminal.guide");
    ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
      name: "sidebar.right.pane.tab",
      key: PACKAGE_NAME,
      locale: NS,
      inject: (sessionId: string) => ({ ...injectFace(sessionId), hooks: { theme } }),
    }, LazyTerminalBody)), "ui-sidebar-terminal.body");
    ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
      name: "sidebar.right.pane.tab.title",
      key: PACKAGE_NAME,
      locale: NS,
      inject: injectFace,
    }, TerminalTitle)), "ui-sidebar-terminal.title");
  };
  return { apply, inject: [...INJECT] };
}
