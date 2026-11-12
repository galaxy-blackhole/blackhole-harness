/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ruot nua client cua row ui-sidebar-browser: kieu tab, phim tat, hai cho ngoi o sidebar phai
 */

import { createBrowserControllers, type BrowserInjected } from "./controllers.ts";
import { browserDefinition, type BrowserGuidePrimitivesLike } from "./definition.ts";
import { BROWSER_KIND, INJECT, LOCALE_NS, PACKAGE_NAME, SHORTCUT_ID } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { createIframePage } from "./pages.ts";
import type { BrowserPageFactory } from "./page.ts";
import { createBrowserStore } from "./store.ts";
import type { BrowserActionsLike, ClientContextLike, JsxRuntimeLike, ReactLike, RequireFn, StoreModuleLike } from "./types.ts";
import { installBrowserCss } from "./view/css.ts";
import { createBrowserBody, type BrowserBodyPrimitivesLike } from "./view/body.ts";
import { createBrowserTitle, type BrowserTitlePrimitivesLike } from "./view/title.ts";
import { vi } from "./locales-vi.ts";

/** Plugin phia browser do factory dung ra. */
export interface SidebarBrowserPlugin {
  /** Ten plugin. */
  name: string;
  /** Dich vu bat buoc (cordis fiber inject). */
  inject: string[];
  /** Gan tab trinh duyet vao sidebar phai. */
  apply(ctx: ClientContextLike): void;
}

/** Phan cua ui-primitives ma row nay require. */
interface BrowserPrimitivesLike extends BrowserBodyPrimitivesLike, BrowserTitlePrimitivesLike, BrowserGuidePrimitivesLike {}

// CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (xem muc 4 cua recipe).
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service da dang ky.
let browserInstalled = false;

/**
 * Dung nua client cua row ui-sidebar-browser.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: plugin { name, inject, apply } ma tang nap goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): SidebarBrowserPlugin {
  /**
  * Cong vao cua tang nap: chong cai hai lan roi chay than plugin.
  * Nhan: ctx — context goc phia client.
  * Tra: khong co.
  */
  const apply = (ctx: ClientContextLike): void => {
    if (browserInstalled) {
      console.warn("gbh-client-ui-sidebar-browser: bundle da duoc cai, bo qua lan thu hai");
      return;
    }
    try {
      applyInner(ctx);
      // CO CHI BAT SAU KHI applyInner CHAY XONG: bat som ma dang ky nem giua duong thi lan cai thu hai
      // thoat som ⇒ hai slot khong bao gio duoc dang ky lai ⇒ renderer gap undefined ⇒ React #130.
      browserInstalled = true;
    } catch (error) {
      console.error("gbh-client-ui-sidebar-browser: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  };

  /**
  * Than plugin: kieu tab, tu dien, phim tat va hai cho ngoi theo tab.
  * Nhan: ctx — context goc phia client.
  * Tra: khong co.
  */
  const applyInner = (ctx: ClientContextLike): void => {
    const runtime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
    const react = requireFn("react") as ReactLike;
    const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as BrowserPrimitivesLike;
    const storeModule = requireFn("@galaxy-blackhole/gbh-client-store") as StoreModuleLike;
    installBrowserCss();
    const namespace = LOCALE_NS;
    const t = ctx.locale.bind(namespace);
    ctx.inject(["shortcuts"], (scope: ClientContextLike) => {
      ctx.effect(() => scope.shortcuts.register({
        id: SHORTCUT_ID,
        label: (): string => t("guide.title"),
        aliases: ["browser", "new browser tab"],
        defaults: {
          "desktop:macos": { code: "KeyT", modifiers: ["primary"] },
          "desktop:windows": { code: "KeyT", modifiers: ["primary"] },
          "desktop:linux": { code: "KeyT", modifiers: ["primary"] },
          "web:macos": { code: "KeyT", modifiers: ["primary", "alt"] },
          "web:windows": { code: "KeyT", modifiers: ["primary", "alt"] },
        },
        regions: ["page", "editable", "terminal"],
        modals: [],
        resolve: ({ target: element }: { target: unknown }) => {
          const found = ctx.sidebarRight.commandTarget(element);
          if (found === undefined) return { status: "blocked", reason: t("shortcut.noSession") };
          return {
            status: "handled",
            run: (): void => {
              ctx.sidebarRight.openTabFromTarget(BROWSER_KIND, found);
            },
          };
        },
      }), "ui-sidebar-browser: shortcut");
    });
    const store = createBrowserStore(storeModule.defineStore);
    const openTabs = ctx.sidebarRight.openTabs;
    const pageFactory: BrowserPageFactory = (options) => createIframePage(options, storeModule.createSnapshotStore);
    const BrowserBody = createBrowserBody(runtime, react, primitives);
    const BrowserTitle = createBrowserTitle(runtime, primitives);
    ctx.effect(() => ctx.locale.register(namespace, { vi, zh, en }), "ui-sidebar-browser.copy");
    ctx.effect(() => ctx.sidebarRightTabs.register({
      ...browserDefinition(t, primitives),
      // Carrier Tauri khong co cau trinh duyet desktop (khong co `dshDesktop.browser`), nen than tab
      // la iframe va khong can giu mounted — dung nhu nhanh web cua ban goc.
      keepMounted: false,
    }), "ui-sidebar-browser.type");
    /**
    * Gan hai cho ngoi theo tab cua trinh duyet vao mot pham vi.
    * Nhan: scope — context so huu dang ky; factory — ham tra nha cung cap trang theo phien.
    * Tra: khong co.
    */
    const installFrames = (scope: ClientContextLike, factory: (sessionId: string) => BrowserPageFactory): void => {
      const controllers = new Map<string, BrowserInjected>();
      scope.effect(() => async () => {
        const pending = [...controllers.values()].map((controller) => controller.dispose());
        controllers.clear();
        await Promise.all(pending);
      }, "ui-sidebar-browser.frames");
      scope.effect(() => scope.slots.inject("sidebar.right.pane.tab", () => scope.slots.register({
        name: "sidebar.right.pane.tab",
        key: PACKAGE_NAME,
        locale: namespace,
        store,
        inject: (sessionId: string, actions: BrowserActionsLike): BrowserInjected => {
          const existing = controllers.get(sessionId);
          if (existing !== undefined) {
            existing.rebind(actions);
            return existing;
          }
          const controller = createBrowserControllers(
            actions,
            factory(sessionId),
            (tabId: string) => openTabs.getSnapshot().some((tab) => tab.sessionId === sessionId && tab.tabId === tabId),
            storeModule.createSnapshotStore,
          );
          controllers.set(sessionId, controller);
          return controller;
        },
      }, BrowserBody)), "ui-sidebar-browser.body");
    };
    installFrames(ctx, () => pageFactory);
    ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
      name: "sidebar.right.pane.tab.title",
      key: PACKAGE_NAME,
      store,
    }, BrowserTitle)), "ui-sidebar-browser.title");
  };

  return { name: PACKAGE_NAME, inject: [...INJECT], apply };
}
