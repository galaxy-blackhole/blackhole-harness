/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Đăng ký nửa browser của row ui-session-delete: mount spec Remote \`sessionDelete\`, dựng bộ điều
 *      khiển hộp xác nhận ở React root tách rời, rồi cắm MỘT occupant vào slot KEYED
 *      sidebar.workspaces.session.menu.item (id delete-session, order 500).
 */

import { createDeleteDialog } from "./dialog.ts";
import type { DialogRuntime, RequestDelete } from "./dialog.ts";
import { NS, OCCUPANT_ID, OCCUPANT_ORDER, SLOT_SESSION_MENU_ITEM } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { createDeleteSessionMenuItem } from "./menu-item.ts";
import type { SessionDeleteMenuItem } from "./menu-item.ts";
import { TYPERT_REMOTE } from "./remote.ts";

/** Một lượt gọi Remote của namespace sessionDelete (chỉ khai đúng phần dùng). */
interface SessionDeleteRemote {
  /** Xoá vĩnh viễn một phiên đã lưu. */
  delete(request: { readonly sessionId: string }): Promise<{ readonly deleted: true; readonly path: string }>;
}

/** Context CON của lần mount — đã có seam Remote của ta. */
export interface SessionDeleteBoundCtx {
  /** Kênh Remote (đã có namespace sessionDelete). */
  readonly remote: { readonly sessionDelete: SessionDeleteRemote };
  /** Sổ phiên của client — gọi refresh sau khi xoá để danh sách cập nhật. */
  readonly sessions: { refresh?(): unknown };
  /**
   * Service điều hướng workspace của kernel (H1, Lead duyệt 08/11/2026): biết phiên nào đang giữ khung nhìn
   * chính và mở/tạo phiên. Dùng ĐÚNG API đã có — không mở rộng seam `sessions`, không đụng gói de-bundle
   * `ui-session` (seam đó không phơi hàm nhả main binding: ui-session.ts:88-96).
   */
  readonly uiWorkspace: {
    /** Tham chiếu phiên đang giữ khung nhìn chính (undefined = đang ở màn Phiên mới). */
    readonly mainReference?: { readonly sessionId?: string };
    /**
     * Xoá main reference ⇒ khung nhìn rơi về màn "Phiên mới" — ĐÚNG cơ chế của flow "Lưu trữ phiên"
     * (`ui-workspace/src/service.ts:286` gọi `clearMain()`; method public khai ở `:462`).
     */
    clearMain(): void;
  };
  /** Sổ slot của giao diện. */
  readonly slots: {
    /** Chờ slot xuất hiện rồi đăng ký. */
    inject(name: string, run: () => () => void): void;
    /** Đăng ký một occupant vào slot đã khai. */
    register(occupant: Record<string, unknown>, component: unknown): () => void;
  };
}

/** Context client gốc mà row này dùng. */
export interface SessionDeleteClientCtx {
  /** Đăng ký hiệu ứng vòng đời. */
  effect(run: () => () => void, label: string): void;
  /** Từ điển giao diện. */
  locale: {
    /** Đăng ký một namespace; trả hàm gỡ. */
    register(namespace: string, dictionaries: { readonly zh: unknown; readonly en: unknown }): () => void;
  };
  /** Tầng Remote: mount spec + chờ seam con. */
  remote: {
    /** Mount contribution Remote đã sinh; trả hàm gỡ. */
    $mount(contribution: unknown): Promise<() => Promise<void>>;
  };
  /** Chờ seam con rồi chạy callback. */
  inject(names: string[], callback: (child: SessionDeleteBoundCtx) => unknown): Promise<unknown> & { dispose(): Promise<void> };
}

/**
 * Đăng ký từ điển, mount Remote, dựng hộp thoại tách rời và cắm mục menu "Xoá phiên".
 * Nhận: ctx — Context client gốc; runtime — react/jsx/primitives/createRoot do loader cấp.
 * Trả: Promise hoàn tất khi spec Remote đã mount và occupant đã đăng ký.
 */
export async function registerSessionDeleteUi(ctx: SessionDeleteClientCtx, runtime: DialogRuntime): Promise<void> {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "client-ui-session-delete: dictionaries");
  const unmountRemote = await ctx.remote.$mount(TYPERT_REMOTE);
  ctx.effect(() => () => {
    void unmountRemote();
  }, "client-ui-session-delete: remote contribution");
  await ctx.inject(["remote.sessionDelete", "slots", "sessions", "uiWorkspace"], (child) => {
    /**
     * Xoá một phiên rồi nạp lại danh sách phiên của sidebar.
     * Nhận: sessionId — phiên cần xoá.
     * Trả: Promise hoàn tất khi host đã gỡ nhật ký và danh sách đã được nạp lại.
     */
    const requestDelete: RequestDelete = async (sessionId: string): Promise<void> => {
      // Remote của DSH có thể trả PHONG BÌ { ok, value | error } thay vì ném lỗi. Chỉ coi là xong khi
      // kết quả THẬT SỰ nói đã xoá; mọi hình dạng khác đều ném để hộp thoại hiện lỗi thay vì đóng im lặng
      // (đo thật 24/10/2026: hộp thoại đóng, không có gì bị xoá, không có lỗi nào hiện ra).
      const answer = await child.remote.sessionDelete.delete({ sessionId }) as unknown;
      const envelope = answer as { ok?: boolean; value?: unknown; error?: { code?: string; message?: string } } | undefined;
      if (envelope !== undefined && typeof envelope === "object" && envelope.ok === false) {
        throw Object.assign(new Error(envelope.error?.message ?? "session delete failed"), { code: envelope.error?.code });
      }
      const payload = (envelope !== undefined && typeof envelope === "object" && "value" in envelope ? envelope.value : answer) as
        | { deleted?: boolean }
        | undefined;
      if (payload?.deleted !== true) throw new Error("session delete returned no confirmation");
      await Promise.resolve(child.sessions.refresh?.());
      // 08/11/2026 (H1, đổi sang cơ chế CỦA LƯU TRỮ theo duyệt của Lead): CHỈ khi phiên vừa xoá đang là phiên MỞ
      //   thì mới đưa UI về màn "Phiên mới", bằng ĐÚNG API mà flow "Lưu trữ phiên" dùng:
      //   ui-workspace/src/service.ts:286 — `if (this.mainReference?.sessionId === sessionId) this.clearMain();`
      //   (clearMain public tại service.ts:462). Main reference bị xoá ⇒ adapter ui-session tự tính lại nextId
      //   (dsh-client-ui-session/lib/client.js:916-917) ⇒ view rơi về màn Phiên mới. Xoá phiên KHÔNG mở ⇒ không đụng gì.
      if (child.uiWorkspace.mainReference?.sessionId === sessionId) child.uiWorkspace.clearMain();
    };
    const dialog = createDeleteDialog(runtime, requestDelete);
    ctx.effect(() => () => dialog.destroy(), "client-ui-session-delete: dialog root");
    const MenuItem: SessionDeleteMenuItem = createDeleteSessionMenuItem(runtime, dialog.open);
    child.slots.inject(SLOT_SESSION_MENU_ITEM, () => child.slots.register({
      name: SLOT_SESSION_MENU_ITEM,
      id: OCCUPANT_ID,
      order: OCCUPANT_ORDER,
      locale: NS,
      inject: () => ({}),
    }, MenuItem));
  });
}
