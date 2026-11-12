/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua browser cua row ui-workflow-run: dang ky Definition su kien ben + tu dien + renderer node Chat
 */

import { CHAT_NODE_KEY, NS, PACKAGE_NAME } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { STYLES, STYLE_TAG_SUFFIX } from "./styles.ts";
import { createViews, type JsxRuntime, type PrimitivesModule, type ReactHooks, type ViewRuntime } from "./view.ts";
import { workflowRunDefinition } from "./workflow-definition.ts";
import { vi } from "./locales-vi.ts";

/** `require` do bảng module cấp cho factory (lazy-CJS, hợp đồng C2). */
export type RequireFn = (specifier: string) => unknown;

/** Service phía browser mà nửa client cần — giữ ĐÚNG 5 tên của bản gốc. */
export const inject: string[] = ["uiConversation", "uiWorkspace", "slots", "sessions", "locale"];

/** Bề mặt plugin mà Loader cần ở mỗi entry. */
export interface PluginFace {
  /** Điểm vào phía browser. */
  apply(ctx: ClientContext): void;
  /** Seam service mà plugin cần. */
  inject: string[];
}

/** Context plugin phía browser (chỉ seam mà row này dùng). */
export interface ClientContext {
  /**
   * Gắn một hiệu ứng vào vòng đời plugin.
   * Nhận: hàm hiệu ứng (có thể trả hàm dọn dẹp) và nhãn chẩn đoán.
   * Trả: không.
   */
  effect(callback: () => unknown, label: string): void;
  /** Seam từ điển. */
  locale: {
    /** Đăng ký từ điển cho một namespace; trả hàm gỡ. */
    register(namespace: string, copy: Record<string, Record<string, string>>): () => void;
  };
  /** Seam sổ occupant của các slot. */
  slots: {
    /** Đăng ký vào một slot ngay khi slot đó sống. */
    inject(slot: string, register: () => unknown): void;
    /** Chiếm một chỗ trong slot; trả hàm gỡ. */
    register(definition: Record<string, unknown>, component: unknown): () => void;
  };
  /** Seam hội thoại (Definitions sự kiện bền). */
  uiConversation: {
    /** Sổ Definition; trả hàm gỡ (nếu seam có). */
    events: { register(definition: unknown): unknown };
  };
  /** Seam workspace (điều hướng phiên). */
  uiWorkspace: {
    /**
     * Mở một phiên ở chế độ đã biết.
     * Nhận: `{ parentSessionId, childSessionId, mode }`.
     * Trả: không.
     */
    openSession(target: { parentSessionId: string; childSessionId: string; mode: string }): void;
  };
}

/**
 * Chèn stylesheet của panel vào `<head>` đúng một lần (idempotent theo `data-plugin-css`).
 * Nhận: không.
 * Trả: không.
 */
function injectStyles(): void {
  if (typeof document === "undefined") return;
  const tagId = PACKAGE_NAME + STYLE_TAG_SUFFIX;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.plugin = PACKAGE_NAME;
  tag.dataset.pluginCss = tagId;
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

/**
 * Cờ CHỐNG CÀI HAI LẦN — phải ở phạm vi MODULE: row khai hai id module thì loader gọi factory hai lần,
 * `apply` chạy lần hai và đăng ký lại slot `conversation.chat.node` ⇒ ném lỗi ⇒ row kẹt `loading`.
 */
// CONG PHAI LA BOOLEAN PHAM VI MODULE, KHONG khoa theo ctx (bai hoc 17/10/2026): ca that la
// HAI ENTRY ⇒ HAI ctx (loader.create moi entry ⇒ parent.extend({fiber}) ⇒ ctx MOI) ⇒ cong
// khoa-theo-ctx KHONG BAO GIO kich hoat ⇒ apply chay hai lan ⇒ service has been registered.
// Do duoc: 12 goi con lastCtx trong artifact. Gia phai tra: boolean dinh giua cac ca test
// cung file ⇒ nap module TUOI moi ca.
let workflowRunInstalled = false;

/**
 * Tạo plugin phía browser của row `ui-workflow-run`.
 * Nhận: `requireFn` — hàm require do bảng module cấp.
 * Trả: bề mặt plugin `{ apply, inject }`.
 */
export function createPlugin(requireFn: RequireFn): PluginFace {
  const runtime: ViewRuntime = {
    hooks: requireFn("react") as ReactHooks,
    jsx: requireFn("react/jsx-runtime") as JsxRuntime,
    primitives: requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesModule,
    shallowEqual: (requireFn("@galaxy-blackhole/gbh-client-store") as { shallowEqual(left: unknown, right: unknown): boolean })
      .shallowEqual,
  };
  injectStyles();
  const views = createViews(runtime);

  /**
   * Đăng ký Definition sự kiện bền, từ điển và renderer node Chat cho lượt chạy workflow.
   * Nhận: `ctx` — context plugin phía browser.
   * Trả: không.
   */
  function apply(ctx: ClientContext): void {
    if (workflowRunInstalled) return;
    try {
      applyInner(ctx);
    } catch (error) {
      console.error("gbh-client-ui-workflow-run: apply nem loi", error);
      throw error;
    }
    // CO CHI BAT SAU KHI DANG KY THANH CONG (bai hoc 18/10/2026, React #130): neu apply nem giua
    // duong (vi du service slots chua san sang o entry thu nhat) thi co PHAI con false — de entry thu
    // hai con co hoi dang ky. Bat co ngay dau apply ⇒ entry thu hai thoat som ⇒ slot RONG ⇒ renderer
    // gap element type undefined ⇒ React #130.
    workflowRunInstalled = true;
  }

  function applyInner(ctx: ClientContext): void {
    ctx.uiConversation.events.register(workflowRunDefinition);
    ctx.effect(() => ctx.locale.register(NS, { vi, zh, en }), "ui-workflow-run: dictionaries");
    ctx.slots.inject("conversation.chat.node", () =>
      ctx.slots.register(
        {
          name: "conversation.chat.node",
          key: CHAT_NODE_KEY,
          locale: NS,
          inject: () => ({
            openSession: (target: { parentSessionId: string; childSessionId: string; mode: string }) => {
              ctx.uiWorkspace.openSession(target);
            },
          }),
        },
        views.WorkflowRunPanel,
      ),
    );
  }

  return { apply, inject };
}
