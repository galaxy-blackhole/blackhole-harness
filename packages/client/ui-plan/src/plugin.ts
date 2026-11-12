/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-plan: hai hieu ung (tu dien, dinh nghia chieu node), provider tai nguyen, kieu tab va NAM slot
 */
import { EFFECT, EXIT_PLAN_COMMAND, INJECT, NS, PACKAGE_NAME, SLOT_ENTRY_ID, STYLE_TAGS, TAB_KIND, TAB_PATTERNS, TAB_PRIORITY, TAB_TYPE_ID, TURN_DATA_KEY } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { isSubagentMode, planAddress, parsePlanAddress, type SessionAddress } from "./plan.ts";
import { planDefinition } from "./plan-definition.ts";
import { planResourceProvider, type PlanRemote } from "./plan-resource.ts";
import { createPlanViews, type PendingReview } from "./plan-views.ts";
import { isReviewPreviewAddress, mintReviewWindow, reviewPreviewAddress } from "./review-preview.ts";
import { createPlanReviewStore, type StoreSeam } from "./review-store.ts";
import type { ClientContext, ClientPlugin, JsxRuntime, PlanPrimitives, PlanShell, ReactHooks, RequireFn } from "./types.ts";
import { vi } from "./locales-vi.ts";

/** CSS cua the xem truoc, do `build.ts` nhung bang `define`; chay tu nguon (test) thi tra bien toan cuc. */
declare const __GBH_PLAN_PREVIEW_CSS__: string;
/** CSS cua chip plan mode, do `build.ts` nhung bang `define`. */
declare const __GBH_PLAN_CONTROL_CSS__: string;

/**
 * Chen mot the style neu chua co.
 * Nhan: `tagId` — id gan vao `data-plugin-css`; `cssText` — van ban CSS.
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
 * Chen CSS cua ca hai module, dung thu tu nhu ban goc (the xem truoc truoc, chip sau).
 * Nhan: khong co.
 * Tra: khong co.
 */
function injectStyles(): void {
  injectStyle(STYLE_TAGS.preview, typeof __GBH_PLAN_PREVIEW_CSS__ === "string" ? __GBH_PLAN_PREVIEW_CSS__ : "");
  injectStyle(STYLE_TAGS.control, typeof __GBH_PLAN_CONTROL_CSS__ === "string" ? __GBH_PLAN_CONTROL_CSS__ : "");
}

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (xem muc 2 cua recipe).
// KHONG khoa theo ctx (WeakSet/lastCtx): ca that la HAI ENTRY ⇒ HAI ctx (loader.create cho moi entry ⇒
//   parent.extend({fiber}) ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay lan
//   hai ⇒ service da dang ky ⇒ entry ket `loading`. Boolean khong quan tam ctx nao.
let bundleInstalled = false;

/**
 * Dung mat plugin cua row ui-plan.
 * Nhan: `requireFn` — ham nap module cua bang module trang.
 * Tra: mat plugin ma Loader goi `apply` tren do.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntime;
  const hooks = requireFn("react") as ReactHooks;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PlanPrimitives;
  const store = requireFn("@galaxy-blackhole/gbh-client-store") as StoreSeam;
  // Ban goc require them `@deepseek-ai/cordis` (khong dung ket qua). Giu lai cho dung tap phu thuoc,
  // nhung KHONG de mot module phu tro giet entry: bang module thieu no thi chi la mot lan bo qua.
  try {
    requireFn("@deepseek-ai/cordis");
  } catch {
    console.warn("gbh-client-ui-plan: bang module thieu @deepseek-ai/cordis — bo qua");
  }
  injectStyles();
  const shell: PlanShell = {
    Fragment: jsxRuntime.Fragment,
    jsx: jsxRuntime.jsx,
    jsxs: jsxRuntime.jsxs,
    useEffect: hooks.useEffect,
    useMemo: hooks.useMemo,
    useRef: hooks.useRef,
    useState: hooks.useState,
  };
  const views = createPlanViews(shell, primitives);

  /**
   * Dang ky toan bo be mat cua row: tu dien, dinh nghia chieu node, provider tai nguyen, kieu tab
   * cua sidebar phai, va NAM slot (the plan, nut review, the xem truoc, tieu de tab, chip plan mode).
   * Nhan: `ctx` — ngu canh goc phia client.
   * Tra: khong co.
   */
  function applyInner(ctx: ClientContext): void {
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), EFFECT.dictionaries);
    const t = ctx.locale.bind(NS);
    ctx.effect(() => ctx.uiConversation.events.register(planDefinition), EFFECT.conversationDefinition);
    ctx.effect(() => ctx.resources.register(planResourceProvider(ctx.remote.session as PlanRemote)), EFFECT.resources);
    ctx.effect(
      () =>
        ctx.sidebarRightTabs.register({
          id: TAB_TYPE_ID,
          kind: TAB_KIND,
          patterns: [...TAB_PATTERNS],
          priority: TAB_PRIORITY,
          canOpen: (address: string): boolean => parsePlanAddress(address) !== undefined || isReviewPreviewAddress(address),
          title: (): string => t("preview.title"),
        }),
      EFFECT.sidebarType,
    );
    const open = (sessionId: string): { openPlan: (callId: string) => void } => ({
      openPlan: (callId: string): void => {
        const child = ctx.sessions.subagentAddress(sessionId);
        const session: SessionAddress =
          child === undefined
            ? { kind: "session", sessionId }
            : {
                kind: "subagent",
                parentSessionId: child.parentSessionId,
                childSessionId: child.childSessionId,
                mode: isSubagentMode(child.mode) ? child.mode : "unknown",
              };
        ctx.sidebarRight.openResource(planAddress({ session, callId }));
      },
    });
    const reviewWindow = mintReviewWindow();
    const reviewStore = createPlanReviewStore(store);
    ctx.slots.inject("conversation.chat.turnTail", () =>
      ctx.slots.register(
        {
          name: "conversation.chat.turnTail",
          id: SLOT_ENTRY_ID,
          locale: NS,
          inject: (sessionId: string) => {
            const binding = ctx.sessions.binding(sessionId);
            if (binding === undefined) throw new Error('ui-plan: unknown session "' + sessionId + '"');
            const chat = ctx.uiConversation.binding(binding).target("chat");
            return {
              ...open(sessionId),
              keyedHooks: {
                plans: (turn: string) => {
                  const snapshot = chat.getSnapshot();
                  if (snapshot === undefined) throw new Error("ui-plan: Chat target is unavailable");
                  return snapshot.nodes.turnDataSource(Number(turn), TURN_DATA_KEY);
                },
              },
            };
          },
        },
        views.PlanCards,
      ),
    );
    ctx.slots.inject("conversation.plan-review.actions", () =>
      ctx.slots.register(
        {
          name: "conversation.plan-review.actions",
          id: SLOT_ENTRY_ID,
          locale: NS,
          store: reviewStore,
          inject: (sessionId: string) => ({
            openReview: (review: PendingReview, requestKey: string): void => {
              if (review.callId !== undefined) {
                open(sessionId).openPlan(review.callId);
                return;
              }
              ctx.sidebarRight.openResource(reviewPreviewAddress(sessionId, reviewWindow + ":" + requestKey), {
                params: {
                  planReview: {
                    markdown: review.plan,
                    title: primitives.extractMarkdownPlainText(review.plan, { mode: "first-line" }),
                  },
                },
              });
            },
            hooks: { sidebarMounted: ctx.sidebarRight.mounted },
          }),
        },
        views.PlanReviewOpen,
      ),
    );
    // ⚠️ 18/10/2026: `key` cua HAI slot keyed PHAI BANG `id` cua kieu tab o tren (TAB_TYPE_ID) — dung quy uoc
    //   cua ba row cung loai (ui-subagent · ui-sidebar-files · ui-sidebar-browser: MOT gia tri cho ca hai ve).
    //   Do la DIEU KIEN de sidebar tra duoc cho ngoi: `dsh-client-ui-sidebar-right` tinh
    //   `entryKey = definition?.id ?? tab.kind`, roi `dsh-client-ui-renderer` nhanh `kind === "keyed"` lam
    //   `entriesOfSlot(slotKey).find(e => e.options.key === opts?.entryKey)`; khong thay ⇒ render fallback
    //   `tab.unavailable` MA KHONG CO LOI CONSOLE NAO (loi im lang).
    //   Truoc 18/10/2026 hai cho nay dung SLOT_ENTRY_ID (id cua GOI GOC) trong khi kieu tab dang ky bang
    //   TAB_TYPE_ID (id CUA TA) ⇒ hai chuoi khac nhau ⇒ mo tab plan ra o "khong kha dung".
    ctx.slots.inject("sidebar.right.pane.tab", () =>
      ctx.slots.register({ name: "sidebar.right.pane.tab", key: TAB_TYPE_ID, locale: NS }, views.PlanPreview),
    );
    ctx.slots.inject("sidebar.right.pane.tab.title", () =>
      ctx.slots.register({ name: "sidebar.right.pane.tab.title", key: TAB_TYPE_ID }, views.PlanTitle),
    );
    ctx.slots.inject("conversation.input.plan", () =>
      ctx.slots.register(
        {
          name: "conversation.input.plan",
          locale: NS,
          inject: (sessionId: string) => ({
            exitPlanMode: async (): Promise<string | null> => {
              const result = await ctx.remote.commands.execute(sessionId, EXIT_PLAN_COMMAND, []);
              if (!result.ok) return result.error.message + " (" + result.error.code + ")";
              if (result.value === undefined) return "unknown command: " + EXIT_PLAN_COMMAND;
              return null;
            },
          }),
        },
        views.PlanChip,
      ),
    );
  }

  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Than plugin: dang ky be mat roi tra quyen cho tang nap.
     * Nhan: `ctx` — ngu canh goc phia client.
     * Tra: khong co.
     */
    apply(ctx: ClientContext): void {
      if (bundleInstalled) {
        console.warn("gbh-client-ui-plan: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
      } catch (error) {
        console.error("gbh-client-ui-plan: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
        throw error;
      }
      // ⚠️ 18/10/2026: CO CHI BAT SAU KHI dang ky CHAY XONG. Bat som ⇒ neu dang ky nem giua duong thi co da
      //   = true ⇒ lan cai thu hai thoat som ⇒ NAM slot KHONG BAO GIO duoc dang ky lai ⇒ renderer gap
      //   undefined ⇒ React #130 (ca that: ui-settings-general, 18/10/2026).
      bundleInstalled = true;
    },
  };
}
