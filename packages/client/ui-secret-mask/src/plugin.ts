/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ruột nửa client của row ui-secret-mask: đăng ký từ điển, luật credential và renderer node secret
 */

import { NS, en, zh } from "./locales.ts";
import { createSecretRule } from "./secret-rule.ts";
import { type JsxRuntimeLike, type ReactLike, createSecretText, ensureSecretTextCss } from "./SecretText.ts";
import { vi } from "./locales-vi.ts";

/** require do bảng module cấp cho factory. */
export type RequireFn = (id: string) => unknown;

/** Khe cắm của trang (seam slots). */
export interface SlotsSeamLike {
  /** Đăng ký một occupant vào slot; trả giá trị do seam quyết định. */
  register(definition: Record<string, unknown>, component: unknown): unknown;
  /** Đăng ký occupant vào slot, có thể hoãn bằng cách trả hàm đăng ký. */
  inject(slot: string, register: () => unknown): void;
}

/** Seam từ điển. */
export interface LocaleSeamLike {
  /** Đăng ký từ điển của một namespace. */
  register(namespace: string, copy: Record<string, Record<string, string>>): unknown;
}

/** Seam khung hội thoại: nơi đăng ký luật UserText. */
export interface UiConversationSeamLike {
  /** Registry luật nhận diện đoạn chữ của người dùng. */
  userText: { register(rule: unknown): unknown };
}

/** Context phía browser (chỉ khai phần row này dùng). */
export interface ClientContextLike {
  /** Đăng ký một hiệu ứng có thể huỷ; tham số hai là nhãn để debug. */
  effect(callback: () => unknown, label?: string): unknown;
  /** Seam từ điển. */
  locale: LocaleSeamLike;
  /** Seam khe cắm. */
  slots: SlotsSeamLike;
  /** Seam khung hội thoại. */
  uiConversation: UiConversationSeamLike;
}

/** Plugin phía browser do factory dựng ra. */
export interface SecretMaskPlugin {
  /** Gắn việc che credential vào app. */
  apply(ctx: ClientContextLike): void;
  /** Dịch vụ bắt buộc (cordis fiber inject). */
  inject: string[];
}

/** Slot mà renderer của row này chiếm. */
export const SLOT_NAME = "conversation.user.text.node";

/**
 * Cờ chặn cài hai lần ở PHẠM VI MODULE (hai entry ⇒ hai ctx nên khoá theo ctx không chặn được).
 * Bật SAU khi phần đăng ký chạy xong; bật sớm mà đăng ký ném giữa đường ⇒ slot không bao giờ được đăng ký lại.
 */
let installed = false;

/**
 * Dựng nửa client của row từ require do bảng module cấp.
 * Nhận: require của bảng module (lấy react, react/jsx-runtime).
 * Trả: plugin { apply, inject } — hành vi giống bản gốc: một từ điển, một luật credential, một renderer node.
 */
export function createPlugin(requireFn: RequireFn): SecretMaskPlugin {
  const inject = ["locale", "slots", "uiConversation"];
  /**
   * Thân của apply — tách ra để cờ chỉ bật sau khi TOÀN BỘ phần đăng ký chạy xong.
   * Nhận: ctx — context phía browser.
   * Trả: không.
   */
  const applyInner = (ctx: ClientContextLike): void => {
    ensureSecretTextCss();
    const runtime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
    const react = requireFn("react") as ReactLike;
    const SecretText = createSecretText(runtime, react);
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-secret-mask: dictionaries");
    ctx.uiConversation.userText.register(createSecretRule());
    ctx.slots.inject(SLOT_NAME, () =>
      ctx.slots.register(
        // Tên slot phải là LITERAL: bun run check:rows đọc literal để đối chiếu danh sách slot với bản gốc.
        { name: "conversation.user.text.node", key: "secret", priority: 100, locale: NS },
        SecretText,
      ),
    );
  };
  /**
   * Cài wiring của row, chặn cài lần hai.
   * Nhận: ctx — context phía browser.
   * Trả: không.
   */
  const apply = (ctx: ClientContextLike): void => {
    if (installed) return;
    try {
      applyInner(ctx);
      installed = true;
    } catch (error) {
      console.error("gbh-client-ui-secret-mask: apply ném lỗi", error);
      throw error;
    }
  };
  return { apply, inject };
}
