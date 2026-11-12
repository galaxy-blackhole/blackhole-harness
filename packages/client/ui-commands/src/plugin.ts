/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ruot nua client cua row ui-commands: service commandUi, tu dien, va cho ngoi lop phu cua hop soan tin
 */

import { EFFECT, INJECT, LOCALE_NS, PACKAGE_NAME, SLOT_INJECT } from "./ids.ts";
import { createCommandUiRuntimeClass, hostFacesOf } from "./service.ts";
import { en, zh } from "./locales.ts";
import type {
  ClientContextLike,
  JsxRuntimeLike,
  PrimitivesLike,
  ReactHooksLike,
  RequireFn,
  ServiceCtorLike,
  StoreSeamLike,
  UiCommandsPlugin,
} from "./types.ts";
import { installCss } from "./view/css.ts";
import { createPopupSelectView } from "./view/shell.ts";
import { vi } from "./locales-vi.ts";

// ⚠️ CONG CHONG CAI HAI LAN — PHAM VI MODULE, dat TRUOC JSDoc cua ham (xem muc 4 cua recipe).
// KHONG khoa theo ctx: ca that la HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber})
//   ⇒ ctx MOI) nen cong khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service 'commandUi'
//   da dang ky ⇒ row ket 'loading'. Boolean o pham vi module khong quan tam ctx nao.
let uiCommandsInstalled = false;

/** Luoi trong: ghi nho ctx da cai xong, de mot lan goi lai voi ctx cu cung bi chan (pham vi MODULE). */
const uiCommandsSeenContexts = new WeakSet<object>();

/**
 * Dung nua client cua row ui-commands.
 * Nhan: requireFn — ham nap module cua bang module trang.
 * Tra: plugin { name, inject, apply } ma tang nap goi apply tren do.
 */
export function createPlugin(requireFn: RequireFn): UiCommandsPlugin {
  /**
   * Cong vao cua tang nap: chong cai hai lan roi chay than plugin.
   * Nhan: ctx — context goc phia client.
   * Tra: khong co.
   */
  const apply = (ctx: ClientContextLike): void => {
    if (uiCommandsInstalled || uiCommandsSeenContexts.has(ctx as unknown as object)) {
      console.warn("gbh-client-ui-commands: bundle da duoc cai, bo qua lan thu hai");
      return;
    }
    try {
      applyInner(ctx);
      // CO CHI BAT SAU KHI applyInner CHAY XONG: bat som ma dang ky nem giua duong thi lan cai thu hai
      // thoat som ⇒ cho ngoi lop phu khong bao gio duoc dang ky lai ⇒ renderer gap undefined ⇒ React #130.
      uiCommandsInstalled = true;
      uiCommandsSeenContexts.add(ctx as unknown as object);
    } catch (error) {
      console.error("gbh-client-ui-commands: apply nem loi — " + (error instanceof Error ? error.message : String(error)));
      throw error;
    }
  };

  /**
   * Than plugin: tu dien, service commandUi, va cho ngoi lop phu cua hop soan tin.
   * Nhan: ctx — context goc phia client.
   * Tra: khong co.
   */
  const applyInner = (ctx: ClientContextLike): void => {
    const runtime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
    const react = requireFn("react") as ReactHooksLike;
    const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesLike;
    const store = requireFn("@galaxy-blackhole/gbh-client-store") as StoreSeamLike;
    const Service = (requireFn("@deepseek-ai/cordis") as { Service: ServiceCtorLike }).Service;
    installCss();
    const PopupSelectView = createPopupSelectView(runtime, react, primitives);
    const CommandUiRuntime = createCommandUiRuntimeClass(Service, {
      store,
      rankByName: primitives.rankByName,
      faces: hostFacesOf(primitives),
    });
    ctx.effect(() => {
      ctx.locale.register(LOCALE_NS, { vi, zh, en });
    }, EFFECT.dictionaries);
    ctx.plugin(CommandUiRuntime);
    ctx.inject([...SLOT_INJECT], (scope: ClientContextLike) => {
      const commandUi = scope.get("commandUi");
      const sessions = scope.get("sessions");
      // ⚠️ TEN SLOT PHAI LA CHUOI LITERAL NGAY TAI CHO DANG KY. Cong check:rows rut tap slot bang regex
      // tren MA NGUON, nen mot hang so hoa ten slot lam cong bao "thieu dang ky slot" => row bi CHAN mount
      // (bai hoc cua ui-plan). Hang so trong ids.ts chi de doc va de test doi chieu.
      scope.slots.inject("conversation.input.overlay", () =>
        scope.slots.register({
          name: "conversation.input.overlay",
          id: "command-popup",
          order: 1,
          locale: LOCALE_NS,
          inject: (sessionId: string) => {
            const actx = sessions.scope(sessionId);
            if (actx === undefined) throw new Error('ui-commands: session "' + String(sessionId) + '" resolved no scope');
            return { popup: commandUi.popupFor(actx) };
          },
        }, PopupSelectView),
      );
    });
  };

  return { name: PACKAGE_NAME, inject: [...INJECT], apply };
}

export type { ClientContextLike } from "./types.ts";
