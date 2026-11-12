/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ruột nửa client của row ui-session: dựng adapter từ các module do bảng module cấp
 */

import { createSessionAdapter, INJECT, type ClientContextLike } from "./ui-session.ts";
import type { ClientStoreLike, JsxRuntimeLike, ServiceCtorLike, SlotsSeamLike } from "./types.ts";

/** require do bảng module cấp cho factory. */
export type RequireFn = (id: string) => unknown;

/**
 * Cờ chống CÀI HAI LẦN ở PHẠM VI MODULE — **LUẬT CHUNG chốt 17/10/2026**.
 *
 * Bundle này tự khai HAI id, và bộ nạp gọi factory MỘT LẦN CHO MỖI id ⇒ hai plugin instance trong cùng
 * một lần thực thi script. Không chặn thì `apply` chạy lần hai, đăng ký lại service/slot và ném lỗi
 * ⇒ row kẹt `loading` ⇒ mọi row stock inject nó cũng kẹt (sự cố 20:1x).
 *
 * Vì sao KHÔNG khoá theo `ctx` (WeakSet/`lastCtx`): ca thật là **HAI ENTRY ⇒ HAI CTX**
 * (`parent.extend({fiber})`), nên khoá theo ctx KHÔNG chặn được — `shortcuts` dùng `lastCtx` vẫn lỗi
 * cho tới khi đổi sang boolean. Giá phải trả: cờ dính giữa các ca test trong cùng file ⇒ mỗi ca test
 * phải nạp **MODULE TƯƠI** (`import("…/plugin.ts?caseN")`).
 */
let installed = false;

/** Plugin phía browser do factory dựng ra — ĐÚNG bề mặt bundle gốc. */
export interface UiSessionPlugin {
  /** Lớp adapter Session (bản gốc cũng export lớp này cho bundle khác dùng). */
  UiSession: unknown;
  /** Cài nguồn gốc Session và adapter theo phạm vi. */
  apply(ctx: ClientContextLike): void;
  /** Dịch vụ bắt buộc (cordis fiber inject). */
  inject: string[];
}

/**
 * Dựng nửa client của row từ require do bảng module cấp.
 * Nhận: require của bảng module (react/jsx-runtime, store, slots, cordis).
 * Trả: plugin { apply, inject } — giống hệt bề mặt bundle gốc.
 */
export function createPlugin(requireFn: RequireFn): UiSessionPlugin {
  const runtime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
  const store = requireFn("@galaxy-blackhole/gbh-client-store") as ClientStoreLike;
  const slots = requireFn("@galaxy-blackhole/gbh-client-ui-slots") as SlotsSeamLike;
  const cordis = requireFn("@deepseek-ai/cordis") as { Service: ServiceCtorLike };
  const adapter = createSessionAdapter(runtime, store, slots, cordis.Service);
  return {
    UiSession: adapter.UiSession,
    apply: (ctx: ClientContextLike): void => {
      if (installed) return;
      installed = true;
      try {
        adapter.install(ctx);
      } catch (error) {
        // Không nuốt lỗi: in ra rồi NÉM TIẾP — cordis nuốt lỗi là lý do nhóm mất mấy tiếng hôm nay.
        console.error("@galaxy-blackhole/gbh-client-ui-session: apply ném lỗi", error);
        throw error;
      }
    },
    inject: [...INJECT],
  };
}
