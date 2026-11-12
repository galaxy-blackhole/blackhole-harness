/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-subagent: tu dien, chu tai nguyen tab chat va NAM slot nguyen van cua ban goc
 */

import { createHeaderLineageComponents, type JsxRuntime, type LineagePrimitives, type SubagentAddress, type SubagentCatalogInjected } from "./header-lineage.ts";
import { createReadOnlyComposer, selectReadOnlySubagent } from "./read-only-composer.ts";
import { createSidebarChatParts, subagentChatAddress, type SidebarChatContext } from "./sidebar-chat.ts";
import { en, NS, zh } from "./locales.ts";
import {
  CATALOG_OCCUPANT_ID,
  CATALOG_ORDER,
  CHAT_PROTOCOL,
  COMPOSER_PRIORITY,
  EFFECT,
  PACKAGE_NAME,
  SLOT_COMPOSER,
  SLOT_HEADER_ACTIONS,
  SLOT_HEADER_LINEAGE,
  STYLE_TAGS,
} from "./ids.ts";
import type { Translator } from "./duration.ts";
import { vi } from "./locales-vi.ts";

/** Ham require do bang module cua loader cap cho factory. */
export type RequireFn = (specifier: string) => unknown;

/** CSS cua ba module, do build.ts nhung bang define; chay tu nguon (test) thi tra bien toan cuc. */
declare const __GBH_UI_SUBAGENT_LINEAGE_CSS__: string;
declare const __GBH_UI_SUBAGENT_COMPOSER_CSS__: string;
declare const __GBH_UI_SUBAGENT_CHAT_CSS__: string;

/** Module react: chi hook, KHONG co jsx/jsxs (hai ham do nam o react/jsx-runtime). */
interface ReactModule {
  /** Trang thai cuc bo. */
  useState: <T>(initial: T | (() => T)) => [T, (next: T | ((current: T) => T)) => void];
  /** O nho. */
  useRef: <T>(initial: T) => { current: T };
  /** Hieu ung vong doi. */
  useEffect: (run: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Ghi nho gia tri dan xuat. */
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
}

/** Module react-dom: menu danh muc duoc render qua portal. */
interface ReactDomModule {
  /** Render mot cay con vao mot nut ngoai cay hien tai. */
  createPortal: (children: unknown, container: unknown) => unknown;
}

/** Ngung context goc phia client; chi khai nhung gi row nay that su dung. */
export interface ClientCtx {
  /** Dang ky hieu ung vong doi. */
  effect: (run: () => void, label: string) => void;
  /** Tiem them dich vu roi chay than callback voi pham vi da co du dich vu. */
  inject: (names: readonly string[], run: (scope: SidebarChatContext) => void) => void;
  /** So slot. */
  slots: {
    /** Tiem vao mot slot. */
    inject: (name: string, register: () => unknown) => unknown;
    /** Dang ky mot nguoi ngoi (component la THAM SO THU HAI). */
    register: (spec: Record<string, unknown>, component: unknown) => unknown;
  };
  /** Tu dien cua giao dien. */
  locale: {
    /** Dang ky mot namespace tu dien. */
    register: (ns: string, dictionaries: { zh: unknown; en: unknown; vi?: unknown }) => void;
    /** Khoa ham dich vao mot namespace. */
    bind: (ns: string) => Translator;
  };
  /** Bang phien: phan row nay dung de lam moi chieu danh muc. */
  sessions: { refreshProjections: (sessionId: string) => void };
  /** Khong gian lam viec: mo mot phien. */
  uiWorkspace: { openSession: (address: SubagentAddress) => void };
  /** Thanh ben phai: mo mot tai nguyen thanh tab. */
  sidebarRight: { openResource: (address: string, options: { readonly kind: string; readonly preferNewPane: boolean }) => void };
}

/** Mat plugin ma Loader nhan. */
export interface ClientPlugin {
  /** Ten package. */
  readonly name: string;
  /** Seam can co. */
  readonly inject: readonly string[];
  /** Than plugin. */
  apply: (ctx: ClientCtx) => void;
}

/** Seam ma ban goc khai — nguyen van, khong bot mot muc nao. */
const INJECT: readonly string[] = ["sessions", "uiWorkspace", "slots", "locale", "sidebarRight"];

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (xem muc 2 cua recipe).
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service da dang ky.
let uiSubagentInstalled = false;

/**
 * Chen mot the style neu chua co.
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
 * Chen CSS cua ca ba module, dung thu tu nhu ban goc.
 * Nhan: khong co.
 * Tra: khong co.
 */
function injectStyles(): void {
  injectStyle(STYLE_TAGS.lineage, typeof __GBH_UI_SUBAGENT_LINEAGE_CSS__ === "string" ? __GBH_UI_SUBAGENT_LINEAGE_CSS__ : "");
  injectStyle(STYLE_TAGS.composer, typeof __GBH_UI_SUBAGENT_COMPOSER_CSS__ === "string" ? __GBH_UI_SUBAGENT_COMPOSER_CSS__ : "");
  injectStyle(STYLE_TAGS.chat, typeof __GBH_UI_SUBAGENT_CHAT_CSS__ === "string" ? __GBH_UI_SUBAGENT_CHAT_CSS__ : "");
}

/**
 * Dung mat plugin cua row ui-subagent.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntime;
  const react = requireFn("react") as ReactModule;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as LineagePrimitives;
  const createPortal = (requireFn("react-dom") as ReactDomModule).createPortal;
  injectStyles();
  const { SubagentHeaderLineage, SubagentCatalogAction } = createHeaderLineageComponents({
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    Fragment: jsxRuntime.Fragment,
    react: { useState: react.useState, useRef: react.useRef, useEffect: react.useEffect, useMemo: react.useMemo },
    createPortal,
    primitives,
  });
  const { SubagentReadOnlyComposer } = createReadOnlyComposer({ jsx: jsxRuntime.jsx, jsxs: jsxRuntime.jsxs });
  const { registerSidebarChat } = createSidebarChatParts({
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    Fragment: jsxRuntime.Fragment,
  });

  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Than plugin: tu dien, chu tai nguyen tab chat va nam slot cua ban goc (idempotent).
     * Nhan: ctx — context goc phia client.
     * Tra: khong co.
     */
    apply(ctx: ClientCtx): void {
      if (uiSubagentInstalled) {
        console.warn("gbh-client-ui-subagent: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
        // ⚠️ 18/10/2026: CO CHI BAT SAU KHI applyInner CHAY XONG. Bat som ⇒ neu dang ky nem giua duong thi
        //   co da = true ⇒ lan cai thu hai thoat som ⇒ slot KHONG BAO GIO duoc dang ky lai ⇒ renderer gap
        //   undefined ⇒ React #130 (ca that: ui-settings-general, 18/10/2026).
        uiSubagentInstalled = true;
      } catch (error) {
        console.error("gbh-client-ui-subagent: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
    },
  };

  /**
   * Than cua apply: dang ky tu dien, tab chat cua thanh ben phai va nam slot cua ban goc.
   * Nhan: ctx — context goc phia client.
   * Tra: khong co.
   */
  function applyInner(ctx: ClientCtx): void {
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), EFFECT.dictionaries);
    ctx.inject(["resources", "sidebarRightTabs"], (scope) => {
      registerSidebarChat(scope, ctx.locale.bind(NS));
    });
    /**
     * Nghiep vu danh muc ma slot tiem vao component (ban goc goi la catalogActions).
     * Nhan: parentSessionId — id phien so huu slot (ban goc khong dung, giu chu ky nguyen van).
     * Tra: ba nghiep vu mo phien va lam moi chieu.
     */
    const catalogActions = (_parentSessionId: string): SubagentCatalogInjected => ({
      openChild(address: SubagentAddress): void {
        ctx.uiWorkspace.openSession(address);
      },
      openChildAside(address: SubagentAddress): void {
        ctx.sidebarRight.openResource(subagentChatAddress(address), { kind: CHAT_PROTOCOL, preferNewPane: true });
      },
      refreshProjection(parentSessionId: string): void {
        ctx.sessions.refreshProjections(parentSessionId);
      },
    });
    // ⚠️ TEN SLOT PHAI LA LITERAL trong register({ name: "..." }): check:rows chi nhan dang duoc khuon do
    //   (da tra gia: truu tuong hoa ten slot lam co bao THIEU ca 9 slot).
    ctx.slots.inject(SLOT_HEADER_LINEAGE, () =>
      ctx.slots.register(
        { name: "conversation.session.header.lineage", locale: NS, inject: catalogActions },
        SubagentHeaderLineage,
      ),
    );
    ctx.slots.inject(SLOT_HEADER_ACTIONS, () =>
      ctx.slots.register(
        { name: "conversation.session.header.actions", id: CATALOG_OCCUPANT_ID, order: CATALOG_ORDER, locale: NS, inject: catalogActions },
        SubagentCatalogAction,
      ),
    );
    ctx.slots.inject(SLOT_COMPOSER, () =>
      ctx.slots.register(
        { name: "conversation.composer", priority: COMPOSER_PRIORITY, locale: NS, select: selectReadOnlySubagent },
        SubagentReadOnlyComposer,
      ),
    );
    // Hai slot cua tab chat nam trong registerSidebarChat (goi qua ctx.inject o tren) — dung nhu ban goc:
    // sidebar.right.pane.tab va sidebar.chat.conversation.
  }
}
