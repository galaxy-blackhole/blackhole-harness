/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-deliverables: tu dien, the ban giao o duoi luot, hang tool present va tab so sanh
 */

import { ChangesDiffStore } from "./changes-diff.ts";
import { ChangesSummaryStore } from "./changes-summary.ts";
import { CHANGED_FILES_PATH, CHANGES_DIFF_PATH, CHANGES_OPEN_PATH, changesReviewAddress } from "./changes.ts";
import { DeliverablesTail } from "./deliverables.ts";
import { en, zh } from "./locales.ts";
import { PresentedOpenController } from "./present-open.ts";
import { PRESENT_HOST_PATH, PRESENT_OPEN_PATH, presentedFileUrl } from "./presented.ts";
import { PresentRow } from "./present-row.ts";
import { ReviewTab } from "./review-tab.ts";
import { changesReviewDefinition } from "./review-definition.ts";
import { createReviewStore } from "./review-store.ts";
import { deliverablesDefinition, presentedForClosing, producedFileMentions, selectProducedFiles } from "./turn-deliverables.ts";
import { setRuntime, type Any } from "./runtime.ts";
import {
  CHILDREN_FILE_ACTIONS,
  CHILDREN_REVIEW_FILE_ACTIONS,
  CHANGES_REVIEW_ID,
  CHANGES_REVIEW_KIND,
  EFFECT,
  INJECT,
  NS,
  PACKAGE_NAME,
  PRESENT_TOOL_KEY,
  SERVICE_FILE_MENTIONS,
  SLOT_SIDEBAR_PANE_TAB,
  SLOT_TOOL_VIEW,
  SLOT_TURN_TAIL,
  STOCK_PACKAGE_NAME,
  STYLE_TAGS,
} from "./ids.ts";
import type { Translations } from "./translate.ts";
import { vi } from "./locales-vi.ts";

/** Ham require do bang module cua loader cap cho factory. */
export type RequireFn = (specifier: string) => unknown;

/** CSS cua nam module, do build.ts nhung bang define; chay tu nguon (test) thi tra bien toan cuc. */
declare const __GBH_UI_DELIVERABLES_PRESENT_ROW_CSS__: string;
declare const __GBH_UI_DELIVERABLES_FILE_DIFF_CSS__: string;
declare const __GBH_UI_DELIVERABLES_CHANGED_FILES_CSS__: string;
declare const __GBH_UI_DELIVERABLES_DELIVERABLES_CSS__: string;
declare const __GBH_UI_DELIVERABLES_REVIEW_TAB_CSS__: string;

/** Ngung context goc phia client; chi khai nhung gi row nay that su dung. */
export interface ClientCtx {
  /** Dang ky hieu ung vong doi (ban goc truyen nhan hieu o tham so thu hai). */
  effect: (run: () => unknown, label?: string) => void;
  /** Nghe su kien cua context (vi du "connection/reset"). */
  on: (event: string, run: () => void) => void;
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
    bind: (ns: string) => Translations;
  };
  /** Hoi thoai: noi dang ky dinh nghia su kien ban giao. */
  uiConversation: { events: { register: (definition: unknown) => unknown } };
  /** Loai tab cua thanh ben phai. */
  sidebarRightTabs: { register: (definition: Record<string, unknown>) => unknown };
  /** Thanh ben phai: mo mot tai nguyen thanh tab. */
  sidebarRight: { openResource: (address: string, options?: Record<string, unknown>) => unknown };
  /** Cau hinh: cong cu danh cho nguoi phat trien. */
  configForms: { developerTools: { enabled: boolean } };
  /** Cung cap mot dich vu cho cac row khac. */
  provide: (name: string, value: unknown) => unknown;
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

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham.
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service da dang ky.
let uiDeliverablesInstalled = false;

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
 * Chen CSS cua ca nam module, dung thu tu nhu ban goc.
 * Nhan: khong co.
 * Tra: khong co.
 */
function injectStyles(): void {
  const tags = [
    [STYLE_TAGS.presentRow, typeof __GBH_UI_DELIVERABLES_PRESENT_ROW_CSS__ === "string" ? __GBH_UI_DELIVERABLES_PRESENT_ROW_CSS__ : ""],
    [STYLE_TAGS.fileDiff, typeof __GBH_UI_DELIVERABLES_FILE_DIFF_CSS__ === "string" ? __GBH_UI_DELIVERABLES_FILE_DIFF_CSS__ : ""],
    [STYLE_TAGS.changedFiles, typeof __GBH_UI_DELIVERABLES_CHANGED_FILES_CSS__ === "string" ? __GBH_UI_DELIVERABLES_CHANGED_FILES_CSS__ : ""],
    [STYLE_TAGS.deliverables, typeof __GBH_UI_DELIVERABLES_DELIVERABLES_CSS__ === "string" ? __GBH_UI_DELIVERABLES_DELIVERABLES_CSS__ : ""],
    [STYLE_TAGS.reviewTab, typeof __GBH_UI_DELIVERABLES_REVIEW_TAB_CSS__ === "string" ? __GBH_UI_DELIVERABLES_REVIEW_TAB_CSS__ : ""],
  ] as const;
  for (const [tagId, css] of tags) injectStyle(tagId, css);
}

/** Cac tuyen ma nua host phuc vu — ghi lai de chan doan, nguyen van ban goc. */
export const ROUTES: readonly string[] = [PRESENT_HOST_PATH, PRESENT_OPEN_PATH, CHANGED_FILES_PATH, CHANGES_DIFF_PATH, CHANGES_OPEN_PATH];

/**
 * Dung mat plugin cua row ui-deliverables.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const jsxRuntime = requireFn("react/jsx-runtime") as { jsx: Any; jsxs: Any; Fragment: Any };
  const react = requireFn("react") as Any;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as Any;
  const store = requireFn("@galaxy-blackhole/gbh-client-store") as Any;
  setRuntime({
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    Fragment: jsxRuntime.Fragment,
    react: {
      useState: react.useState,
      useRef: react.useRef,
      useEffect: react.useEffect,
      useId: react.useId,
      useMemo: react.useMemo,
    },
    store: { createSnapshotStore: store.createSnapshotStore, defineStore: store.defineStore },
    primitives,
  });
  injectStyles();

  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Than plugin: tu dien, dinh nghia su kien ban giao, ba slot cua ban goc, loai tab so sanh va
     * dich vu mo neo file (idempotent).
     * Nhan: ctx — context goc phia client.
     * Tra: khong co.
     */
    apply(ctx: ClientCtx): void {
      if (uiDeliverablesInstalled) {
        console.warn("gbh-client-ui-deliverables: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
        // ⚠️ 18/10/2026: CO CHI BAT SAU KHI applyInner CHAY XONG. Bat som ⇒ neu dang ky nem giua duong thi
        //   co da = true ⇒ lan cai thu hai thoat som ⇒ slot KHONG BAO GIO duoc dang ky lai ⇒ renderer gap
        //   undefined ⇒ React #130 (ca that: ui-settings-general, 18/10/2026).
        uiDeliverablesInstalled = true;
      } catch (error) {
        console.error("gbh-client-ui-deliverables: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
    },
  };

  /**
   * Than cua apply: dung ba store, dang ky tu dien, ba slot nguyen van cua ban goc, loai tab va dich vu neo file.
   * Nhan: ctx — context goc phia client.
   * Tra: khong co.
   */
  function applyInner(ctx: ClientCtx): void {
    const opener = new PresentedOpenController();
    const summaries = new ChangesSummaryStore();
    const diffs = new ChangesDiffStore();
    ctx.effect(() => () => Promise.all([opener.dispose(), summaries.dispose(), diffs.dispose()]), EFFECT.dispose);
    ctx.on("connection/reset", () => {
      opener.resetHost();
      summaries.reset();
      diffs.reset();
    });
    ctx.uiConversation.events.register(deliverablesDefinition);
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), EFFECT.dictionaries);
    // ⚠️ TEN SLOT PHAI LA LITERAL trong register({ name: "..." }) va trong inject("..."): check:rows chi nhan
    //   dang duoc khuon do (da tra gia: truu tuong hoa ten slot lam cong bao THIEU slot).
    ctx.slots.inject(SLOT_TURN_TAIL, () =>
      ctx.slots.register(
        {
          name: "conversation.chat.turnTail",
          id: STOCK_PACKAGE_NAME,
          locale: NS,
          children: { [CHILDREN_FILE_ACTIONS]: { kind: "list", scope: "session" } },
          inject: () => ({
            hooks: {
              changesDiff: diffs.state,
              presentedOpen: opener.state,
              presentedHost: opener.host,
              changesSummary: summaries.state,
              showCodeDiff: ctx.configForms.developerTools.enabled,
            },
            loadChangesDiff: (sessionId: string, seq: number, index: number) => diffs.load(sessionId, seq, index),
            reloadPresentedHost: () => opener.loadHost(),
            loadChangesSummary: (sessionId: string, seq: number) => summaries.load(sessionId, seq),
            openPresented: (sessionId: string, seq: number, index: number, action: "open" | "reveal", application?: string) =>
              opener.open(sessionId, seq, index, action, application),
            openChanged: (sessionId: string, seq: number, index: number, action: "open" | "reveal", application?: string) =>
              opener.openChanged(sessionId, seq, index, action, application),
            openChangesReview: (coordinates: { sessionId: string; seq: number; turn: number }, index: number) => {
              ctx.sidebarRight.openResource(changesReviewAddress(coordinates), { params: { index } });
            },
          }),
        },
        DeliverablesTail,
      ),
    );
    ctx.slots.inject(SLOT_TOOL_VIEW, () =>
      ctx.slots.register({ name: "tool.call.toolview", key: PRESENT_TOOL_KEY, locale: NS }, PresentRow),
    );
    const t = ctx.locale.bind(NS);
    ctx.effect(() => ctx.sidebarRightTabs.register(changesReviewDefinition(t)), EFFECT.reviewType);
    ctx.effect(() => ctx.slots.inject(SLOT_SIDEBAR_PANE_TAB, () =>
      ctx.slots.register(
        {
          name: "sidebar.right.pane.tab",
          key: CHANGES_REVIEW_ID,
          locale: NS,
          store: createReviewStore(),
          children: { [CHILDREN_REVIEW_FILE_ACTIONS]: { kind: "list", scope: "session" } },
          inject: () => ({
            hooks: {
              changesSummary: summaries.state,
              changesDiff: diffs.state,
              presentedOpen: opener.state,
              presentedHost: opener.host,
            },
            loadChangesSummary: (sessionId: string, seq: number) => summaries.load(sessionId, seq),
            loadChangesDiff: (sessionId: string, seq: number, index: number) => diffs.load(sessionId, seq, index),
            reloadPresentedHost: () => opener.loadHost(),
            openChanged: (sessionId: string, seq: number, index: number, action: "open" | "reveal", application?: string) =>
              opener.openChanged(sessionId, seq, index, action, application),
          }),
        },
        ReviewTab,
      ),
    ), EFFECT.reviewBody);
    ctx.provide(SERVICE_FILE_MENTIONS, {
      /**
       * Neo file ma mot phien da san xuat hoac ban giao, cho cau tra loi cuoi.
       * Nhan: owner — phien so huu luot dang dong.
       * Tra: mo ta neo file, hoac undefined khi khong co gi de neo.
       */
      forClosing(owner: Any): Any {
        const paths = selectProducedFiles(owner);
        const presented = presentedForClosing(owner);
        if (paths === null && presented.length === 0) return undefined;
        return producedFileMentions(
          [...new Set([...(paths ?? []), ...presented.map((file: Any) => file.path as string)])],
          owner.openFile,
          (path: string) => t("presented.previewButton", { name: path }),
          owner.turn.data.get("deliverables")?.produced.filter((operation: Any) => operation.seq <= owner.seq),
        );
      },
    });
  }
}
