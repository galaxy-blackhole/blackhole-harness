/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Mat plugin cua row ui-sidebar-right: tu dien, hai mat dich vu, nam slot nguyen van cua ban goc, cong chan cai hai lan
 */

import { closeWithPaneFocus, openWithPaneFocus } from "./close-focus.ts";
import { EXPAND_BUTTON_CSS, GUIDE_BODY_CSS, SIDEBAR_RIGHT_CSS } from "./css.ts";
import { ExpandButton } from "./expand-button.ts";
import { observeSidebarFocus } from "./focus.ts";
import { GuideBody } from "./guide-body.ts";
import { guideDefinition } from "./guide-definition.ts";
import { GuideTitle } from "./guide-title.ts";
import { GUIDE_ID, INJECT, NS, PACKAGE_NAME, STYLE_TAGS } from "./ids.ts";
import { en, zh } from "./locales.ts";
import type { ClientPlugin, RequireFn } from "./plugin-types.ts";
import { RightbarRoot } from "./rightbar-root.ts";
import { defaultSeed } from "./seed.ts";
import { SidebarSessionViews } from "./session-views.ts";
import { createSidebarRightController } from "./service.ts";
import { RightbarSeat } from "./sidebar-right-shell.ts";
import { registerSidebarShortcuts } from "./shortcuts.ts";
import { guideTabInfoFactory, tabInfoFactory } from "./tab-info.ts";
import { SidebarRightTabRegistry } from "./tab-registry.ts";
import { createSidebarRightStore } from "./stores.ts";
import { vi } from "./locales-vi.ts";

/** Kieu dong cho context goc phia client (ban goc khong co kieu o tang chay). */
type Ctx = any;

// 01/11/2026 — BO CONG "DA CAI" O PHAM VI MODULE de khop BAN GOC (do tu artefact stock):
//   ban goc KHONG latch, moi `apply(ctx)` dang ky doc lap. Cong module lam lan cai thu ba (ctx khac)
//   dang ky 0 slot ⇒ sidebar phai trang im lang khi HMR / cai lai sau loi / context thu hai.
//   Chong cai trung van con o tang THAT: trung id/kind trong CUNG mot registry thi `register` nem.

/**
 * Chen mot the style neu chua co (id the giu NGUYEN duong dan module cua ban goc de khong chen hai lan).
 * Nhan: tagId — id gan vao data-plugin-css; cssText — van ban CSS.
 * Tra: khong co.
 */
function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * Chen CSS cua ca ba module, dung thu tu nhu ban goc (GuideBody · ExpandButton · SidebarRight).
 * Nhan: khong co.
 * Tra: khong co.
 */
function injectStyles(): void {
  injectStyle(STYLE_TAGS.guideBody, GUIDE_BODY_CSS);
  injectStyle(STYLE_TAGS.expandButton, EXPAND_BUTTON_CSS);
  injectStyle(STYLE_TAGS.sidebarRight, SIDEBAR_RIGHT_CSS);
}

/**
 * Dung mat plugin cua row ui-sidebar-right.
 *
 * ⚠️ Tham so require cua bang module KHONG dung o day: ban goc require sau module ngoai o DAU bundle
 * (react · react/jsx-runtime · react-dom · zod · dsh-client-store · dsh-client-ui-primitives ·
 * dsh-client-ui-dockkit) va ban port giu dung khuon do — moi module tu require thu no dung, nen
 * bindRuntime la khong can thiet. Tham so van nhan de khop khuon goi cua build.ts
 * (module.exports.createPlugin(require)).
 * Nhan: _requireFn — ham require cua bang module (khong dung).
 * Tra: mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(_requireFn?: RequireFn): ClientPlugin {
  injectStyles();
  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Than plugin: tu dien, hai mat dich vu, nam slot va loai tab huong dan (idempotent).
     * Nhan: ctx — context goc phia client.
     * Tra: khong co.
     */
    apply(ctx: Ctx): void {
      try {
        applyInner(ctx);
      } catch (error: any) {
        console.error("gbh-client-ui-sidebar-right: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
    },
  };

  /**
   * Than cua apply: dung so dang ky, kho, bo dieu khien, tu dien, phim tat, bo quan sat tieu diem va nam slot.
   * Nhan: ctx — context goc phia client.
   * Tra: khong co.
   */
  function applyInner(ctx: Ctx): void {
    const t = ctx.locale.bind(NS);
    const tabs = new SidebarRightTabRegistry(ctx);
    const views = new SidebarSessionViews(ctx.sessions);
    ctx.effect(() => {
      const current = ctx.uiSession.adapter.current;
      const sync = (): void => {
        views.select(current.getSnapshot().key);
      };
      const unsubscribe = current.subscribe(sync);
      sync();
      return () => {
        unsubscribe();
        views.dispose();
      };
    }, "ui-sidebar-right: retained Session views");
    const layout = ctx.layout;
    let autoFullscreen = false;
    const { controller, adopt, forget, show, measure } = createSidebarRightController(tabs, (address: Ctx, signal: Ctx) => {
      ctx.resources.pin(address, signal);
    }, {
      autoFullscreen: () => autoFullscreen,
      openWithFocus: (sessionId: Ctx, open: Ctx) => {
        openWithPaneFocus(document, sessionId, open);
      },
      closeWithFocus: (sessionId: Ctx, paneId: Ctx, close: Ctx) => {
        closeWithPaneFocus(document, sessionId, paneId, close);
      },
    });
    ctx.effect(() => {
      const sync = (): void => {
        const selected = views.source.getSnapshot().find((view: Ctx) => view.selected);
        show(layout.panelInfo.getSnapshot().activePanelId === null ? selected?.sessionId : void 0);
      };
      const unsubscribeViews = views.source.subscribe(sync);
      const unsubscribePanel = layout.panelInfo.subscribe(sync);
      sync();
      return () => {
        unsubscribeViews();
        unsubscribePanel();
        show(void 0);
      };
    }, "ui-sidebar-right: on-screen Session");
    // Hai mat dich vu ma cac row khac inject (ui-subagent: sidebarRightTabs + sidebarRight) — nguyen van ban goc.
    const disposeRegistry = ctx.reflect.provide("sidebarRightTabs", tabs);
    const disposeService = ctx.reflect.provide("sidebarRight", controller);
    ctx.effect(() => () => {
      controller.tabDomain.dispose();
      disposeService();
      disposeRegistry();
    }, "ui-sidebar-right: service faces");
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-sidebar-right: dictionaries");
    ctx.effect(() => registerSidebarShortcuts(ctx.shortcuts, controller, t, () => {
      ctx.shortcuts.closeWindow().catch((error: Ctx) => {
        console.error("Window close failed", error);
      });
    }), "ui-sidebar-right: shortcuts");
    if (typeof document !== "undefined") ctx.effect(() => observeSidebarFocus(document), "ui-sidebar-right: focus");
    ctx.effect(() => {
      const handle = createSidebarRightStore(() => defaultSeed(tabs));
      const adoptions = new Map();
      // ⚠️ LUAT 8 — HOP DONG KHO CHO SLOT CUA GOI KHAC: "store" duoi day duoc khung slot dung cho MOI
      //   khung nhin phien. create() PHAI tra ve the hien DAY DU cua defineStore
      //   (getSnapshot + subscribe + actions + clearPersisted), khong duoc tra thieu: thieu ⇒
      //   "TypeError: w.getSnapshot is not a function" ⇒ CA thanh ben khong render (ca that ui-workspace).
      //   Vi vay o day spread nguyen the hien roi moi them clearPersisted — dung y ban goc.
      const store = {
        ...handle,
        create: (scopeKey: Ctx) => {
          const instance = handle.create(scopeKey);
          if (scopeKey !== void 0) {
            const sessionId = scopeKey;
            adoptions.get(sessionId)?.();
            adoptions.set(sessionId, adopt(sessionId, instance));
          }
          return {
            ...instance,
            clearPersisted(): void {
              instance.clearPersisted();
              if (scopeKey !== void 0) forget(scopeKey);
            },
          };
        },
      };
      const injected = {
        syncPresentation({ shown, track, fullscreen }: Ctx) {
          if (shown) layout.openRightbar(track, fullscreen);
          else layout.closeRightbar();
        },
        reportAutoFullscreen: (value: Ctx) => {
          autoFullscreen = value;
        },
        splitPane: (paneId: Ctx) => {
          controller.split(paneId);
        },
        toggleFullscreen: () => {
          const target = controller.commandTarget();
          if (target !== void 0) controller.toggleFullscreen(target);
        },
        openTab: (kind: Ctx, options: Ctx) => {
          controller.openTab(kind, options);
        },
        hooks: {
          shortcuts: ctx.shortcuts.catalog,
          tabTypes: {
            subscribe: (listener: Ctx) => tabs.subscribe(listener),
            getSnapshot: () => tabs.entries(),
          },
        },
      };
      const disposeTypes = [tabs.register(guideDefinition(t))];
      // ⚠️ TEN SLOT PHAI LA LITERAL trong register({ name: "..." }) / inject("..."): check:rows chi nhan
      //   dang duoc khuon do (da tra gia: truu tuong hoa ten slot lam phep kiem bao THIEU ca 5 slot).
      const disposeSeat = ctx.slots.inject("rightbar", function* () {
        yield ctx.slots.register({
          name: "rightbar",
          children: { "rightbar.session": { kind: "single", scope: "session" } },
          inject: () => ({
            hooks: { views: views.source },
            mountView: (reference: Ctx) => views.mount(reference),
          }),
        }, RightbarRoot);
        yield ctx.slots.register({
          name: "rightbar.session",
          locale: NS,
          children: {
            "sidebar.right.pane.tab": { kind: "keyed", scope: "session", inject: { hooks: { tabInfo: tabInfoFactory } } },
            "sidebar.right.pane.tab.title": { kind: "keyed", scope: "session", inject: { hooks: { tabInfo: tabInfoFactory } } },
            "sidebar.right.tab.menu.item": { kind: "list", scope: "session" },
          },
          store,
          inject: (sessionId: Ctx) => ({
            ...injected,
            measureRoom: (canSplitPane: Ctx) => {
              measure(sessionId, canSplitPane);
            },
            closeTab: (tabId: Ctx) => {
              try {
                controller.closeIn(sessionId, tabId);
              } catch (error: any) {
                console.error("Sidebar tab close failed:", error);
              }
            },
            keyedHooks: { tabNavigation: (key: Ctx) => controller.tabDomain.occurrence(sessionId, { id: key }).navigation },
            occurrence: (tab: Ctx) => controller.tabDomain.occurrence(sessionId, tab),
          }),
        }, RightbarSeat);
      });
      const disposeExpand = ctx.slots.inject("conversation.session.header.corner", () => ctx.slots.register({
        name: "conversation.session.header.corner",
        locale: NS,
        store,
        inject: () => ({ hooks: { shortcuts: ctx.shortcuts.catalog } }),
      }, ExpandButton));
      const guideInjected = { hooks: {
        shortcuts: ctx.shortcuts.catalog,
        guideEntries: {
          subscribe: (listener: Ctx) => tabs.subscribe(listener),
          getSnapshot: () => tabs.guide(),
        },
      } };
      // ⚠️ LUAT 7 — SLOT KEYED: "key" PHAI BANG "id" cua dinh nghia loai tab. Ca hai cho dung CUNG mot
      //   hang so GUIDE_ID (guide-definition.ts tra id: GUIDE_ID). Lech ⇒ renderer roi vao fallback
      //   (<p data-sidebar-right-unavailable>) ⇒ tab hien "khong kha dung" MA KHONG CO LOI CONSOLE.
      const disposeGuide = ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
        name: "sidebar.right.pane.tab",
        key: GUIDE_ID,
        children: {
          "sidebar.right.tab.guide.entry": { kind: "keyed", scope: "session", inject: { hooks: { tabInfo: guideTabInfoFactory } } },
          "sidebar.right.tab.guide": { kind: "chain", scope: "session", inject: { hooks: { tabInfo: guideTabInfoFactory } } },
        },
        inject: () => guideInjected,
      }, GuideBody));
      const disposeGuideTitle = ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
        name: "sidebar.right.pane.tab.title",
        key: GUIDE_ID,
      }, GuideTitle));
      return () => {
        disposeGuideTitle();
        disposeGuide();
        disposeExpand();
        disposeSeat();
        for (const dispose of disposeTypes.reverse()) dispose();
        for (const release of adoptions.values()) release();
        adoptions.clear();
      };
    }, "ui-sidebar-right: seats and shipped tab type");
  }
}
