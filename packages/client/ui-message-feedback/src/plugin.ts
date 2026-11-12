/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mat plugin cua row ui-message-feedback — hai slot nguyen van, service feedbackUi, trang tri /feedback
 */

import { createFeedbackComponents, type FeedbackComponents } from "./components";
import type { MessageFeedbackRating, MessageFeedbackRemote } from "./controller";
import type { FeedbackDialogState } from "./dialog";
import { ACTION_ORDER, INJECT, NS, OVERLAY_ORDER, PACKAGE_NAME, SLOT_ACTIONS, SLOT_OVERLAY } from "./ids";
import { en, zh } from "./locales";
import { injectFeedbackStyles } from "./styles";
import { FeedbackSurface, type SessionFeedbackRemote } from "./surface";
import { vi } from "./locales-vi.ts";

/** Ham nap module cua bang module trang (do tang nap dua vao factory). */
type RequireFn = (specifier: string) => unknown;

/** Scope con sinh ra boi `ctx.inject([...], scope => ...)`. */
type InjectedScope = {
  /** Hieu ung song theo scope. */
  effect: (callback: () => unknown, label?: string) => unknown;
  /** Dich vu dan lenh cua phien. */
  commandUi: {
    /** Treo mot trang tri len mot lenh host. */
    decorate: (decoration: {
      name: string;
      available: () => boolean;
      ui: { kind: "action"; run: (session: { sessionId: string }) => void };
    }) => unknown;
  };
};

/** Kieu toi thieu cua context ma apply nhan (chi phan duoc dung o file nay). */
type ClientContext = {
  /** So dang ky slot cua tang khung. */
  slots: {
    /** Cho mot slot xuat hien roi moi dung occupant cua no. */
    inject: (name: string, generator: () => unknown) => unknown;
    /** Dang ky mot occupant: spec truoc, component la THAM SO THU HAI. */
    register: (spec: Record<string, unknown>, component: unknown) => unknown;
  };
  /** Hieu ung song theo fiber cua plugin. */
  effect: (callback: () => unknown, label?: string) => unknown;
  /** So tu dien cua tang khung. */
  locale: { register: (ns: string, dictionaries: { zh: unknown; en: unknown; vi?: unknown }) => unknown };
  /** Cung cap mot dich vu cho plugin khac. */
  provide: (name: string, value: unknown) => void;
  /** Nghe su kien cua tang khung. */
  on: (event: string, listener: (...args: never[]) => void) => unknown;
  /** Hai mat Remote ma ban goc dung. */
  remote: { messageFeedback: MessageFeedbackRemote; sessionFeedback: SessionFeedbackRemote };
  /** Cho mot dich vu xuat hien roi moi chay phan phu thuoc no. */
  inject: (deps: readonly string[], callback: (scope: InjectedScope) => void) => unknown;
};

/** Be mat plugin ma tang nap goi apply tren do. */
type ClientPlugin = { name: string; inject: readonly string[]; apply: (ctx: ClientContext) => void };

/** Dich vu ma row nay cung cap cho plugin khac (ban goc cung ten). */
type FeedbackUi = { openSession: (sessionId: string) => void };

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (xem muc 2 cua recipe).
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service da dang ky.
let bundleInstalled = false;

/**
 * Dung mat plugin cua row ui-message-feedback.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: mat plugin ma Loader goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): ClientPlugin {
  const jsxRuntime = requireFn("react/jsx-runtime") as Parameters<typeof createFeedbackComponents>[0]["jsx"];
  const react = requireFn("react") as Parameters<typeof createFeedbackComponents>[0]["react"];
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as Parameters<typeof createFeedbackComponents>[0]["primitives"];
  injectFeedbackStyles();
  const components: FeedbackComponents = createFeedbackComponents({ jsx: jsxRuntime, react, primitives });

  /**
   * Than plugin: hai slot nguyen van, service `feedbackUi`, va trang tri `/feedback`.
   * Nhan: ctx — context goc phia client.
   * Tra: khong co — dang ky roi tra quyen cho tang nap.
   */
  const applyInner = (ctx: ClientContext): void => {
    ctx.effect(
      () =>
        ctx.locale.register(NS, { vi,
          zh,
          en,
        }),
      "ui-message-feedback: dictionaries",
    );
    /** Be mat cua tung phien, dung chung cho moi muc cua phien do. */
    const surfaces = new Map<string, FeedbackSurface>();
    /**
     * Lay (hoac dung) be mat cua mot phien.
     * Nhan: sessionId — phien can be mat.
     * Tra: be mat cua phien.
     */
    const surfaceFor = (sessionId: string): FeedbackSurface => {
      let surface = surfaces.get(sessionId);
      if (surface === undefined) {
        surface = new FeedbackSurface(ctx.remote.messageFeedback, ctx.remote.sessionFeedback, sessionId);
        surfaces.set(sessionId, surface);
      }
      return surface;
    };
    ctx.effect(
      () => () => {
        for (const surface of surfaces.values()) surface.dispose();
        surfaces.clear();
      },
      "ui-message-feedback: per-session surfaces",
    );
    /** Dich vu ma plugin khac (vi du session-log-export) goi de mo hop thoai cua mot phien. */
    const feedbackUi: FeedbackUi = {
      openSession: (sessionId: string): void => {
        surfaceFor(sessionId).dialog.open({ kind: "session" });
      },
    };
    ctx.provide("feedbackUi", feedbackUi);
    ctx.on("connection/reset", () => {
      for (const { feedback } of surfaces.values()) {
        if (feedback.getSnapshot().status !== "cold") feedback.resync();
      }
    });
    // ⚠️ TEN SLOT PHAI LA LITERAL trong register({ name: "..." }): check:rows chi nhan dang duoc khuon do
    //   (da tra gia: truu tuong hoa ten slot lam co bao THIEU ca 9 slot). Hang so chi dung cho inject.
    // ⚠️ Id muc cung PHAI NGUYEN VAN tu bundle goc: "feedback" · "feedback-dialog" · order 10 · order 2.
    // ⚠️ Component la THAM SO THU HAI cua register(spec, Component) — khong nhet vao spec.
    ctx.slots.inject(SLOT_ACTIONS, () =>
      ctx.slots.register(
        {
          name: "conversation.chat.assistant-actions",
          id: "feedback",
          order: ACTION_ORDER,
          locale: NS,
          /**
           * Dung mat nghiep vu cho tung tin nhan cua mot phien.
           * Nhan: sessionId — phien so huu tin nhan.
           * Tra: hook anh chup va bon dong tu ma component dung.
           */
          inject: (sessionId: string): Record<string, unknown> => {
            const { feedback, dialog } = surfaceFor(sessionId);
            return {
              hooks: { feedback },
              ensure: () => feedback.ensure(),
              current: (messageId: string) => feedback.getSnapshot().items.get(messageId),
              retract: (messageId: string, rating: MessageFeedbackRating) => feedback.retract(messageId, rating),
              openDialog: (messageId: string, rating: MessageFeedbackRating): void => {
                dialog.open({ kind: "message", messageId, rating });
              },
            };
          },
        },
        components.MessageFeedbackActions,
      ),
    );
    ctx.slots.inject(SLOT_OVERLAY, () =>
      ctx.slots.register(
        {
          name: "conversation.input.overlay",
          id: "feedback-dialog",
          order: OVERLAY_ORDER,
          locale: NS,
          /**
           * Dung mat nghiep vu cua hop thoai cho mot phien.
           * Nhan: sessionId — phien so huu hop thoai.
           * Tra: hook anh chup va nam dong tu ban nhap ma component dung.
           */
          inject: (sessionId: string): Record<string, unknown> => {
            const { dialog } = surfaceFor(sessionId);
            return {
              hooks: { dialog: dialog.state },
              edit: (draft: Partial<Pick<FeedbackDialogState, "category" | "text">>): void => {
                dialog.edit(draft);
              },
              submit: () => dialog.submitDraft(),
              dismiss: (): void => {
                dialog.dismiss();
              },
              dismissFailure: (): void => {
                dialog.dismissFailure();
              },
              dismissToast: (seq: number): void => {
                dialog.dismissToast(seq);
              },
            };
          },
        },
        components.FeedbackDialog,
      ),
    );
    ctx.inject(["commandUi"], (scope) => {
      scope.effect(
        () =>
          scope.commandUi.decorate({
            name: "feedback",
            available: () => true,
            ui: {
              kind: "action",
              run: (session: { sessionId: string }): void => {
                feedbackUi.openSession(session.sessionId);
              },
            },
          }),
        "ui-message-feedback: /feedback decoration",
      );
    });
  };

  return {
    name: PACKAGE_NAME,
    inject: INJECT,
    /**
     * Dang ky hai slot cua be mat phan hoi thanh MOT tap khai bao, kem cong chong cai hai lan.
     * Nhan: ctx — context goc phia client.
     * Tra: khong co.
     */
    apply(ctx: ClientContext): void {
      if (bundleInstalled) {
        console.warn("gbh-client-ui-message-feedback: bundle da duoc cai, bo qua lan thu hai");
        return;
      }
      try {
        applyInner(ctx);
        // ⚠️ 18/10/2026: CO CHI BAT SAU KHI applyInner CHAY XONG. Bat som ⇒ neu dang ky nem giua duong thi co
        //   da = true ⇒ lan cai thu hai thoat som ⇒ hai slot KHONG BAO GIO duoc dang ky lai ⇒ renderer gap
        //   undefined ⇒ React #130 (ca that: ui-settings-general, 18/10/2026).
        bundleInstalled = true;
      } catch (error) {
        console.error(
          "gbh-client-ui-message-feedback: apply nem loi — " +
            (error instanceof Error ? error.message : String(error)),
        );
        throw error;
      }
    },
  };
}
