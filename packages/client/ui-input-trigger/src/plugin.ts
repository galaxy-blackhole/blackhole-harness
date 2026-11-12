/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng lib/types/client/index.js của bản gốc — mặt plugin: cài InputTriggerService, đăng ký từ điển, chiếm slot overlay
 */

import { createControllerClass, type InputTriggerControllerInstance } from "./controller.ts";
import { MENU_DICTIONARIES_EFFECT, MENU_NS, MENU_SLOT_ID, MENU_SLOT_NAME, MENU_SLOT_ORDER } from "./ids.ts";
import { en, zh } from "./locales.ts";
import { makeMenuView } from "./menu-view.ts";
import { createServiceClass } from "./service.ts";
import type {
  ClientContextLike,
  CreateSnapshotStore,
  InputTriggerPlugin,
  JsxRuntimeLike,
  PrimitivesLike,
  ReactLike,
  RequireFn,
  ServiceCtorLike,
} from "./types.ts";

/**
 * Dịch vụ bắt buộc của plugin client — NGUYÊN VĂN danh sách inject của bản gốc, đúng thứ tự.
 * Nhận: không có.
 * Trả: mảng tên dịch vụ.
 */
export const INJECT = ["sessions", "locale"];

/**
 * Dựng mặt plugin client của row ui-input-trigger từ bảng module của trang.
 *
 * Năm specifier được require theo ĐÚNG thứ tự bản gốc tại thời điểm factory chạy:
 * @deepseek-ai/cordis, @galaxy-blackhole/gbh-client-store, react/jsx-runtime,
 * @galaxy-blackhole/gbh-client-ui-primitives, react.
 * Nhận: requireFn - hàm require của bảng module trang.
 * Trả: plugin { InputTriggerController, InputTriggerService, apply, inject } — giống hệt bề mặt gốc.
 */
export function createPlugin(requireFn: RequireFn): InputTriggerPlugin {
  const cordis = requireFn("@deepseek-ai/cordis") as { Service: ServiceCtorLike };
  const store = requireFn("@galaxy-blackhole/gbh-client-store") as { createSnapshotStore: CreateSnapshotStore };
  const jsxRuntime = requireFn("react/jsx-runtime") as JsxRuntimeLike;
  const primitives = requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesLike;
  const react = requireFn("react") as ReactLike;

  const InputTriggerController = createControllerClass(store.createSnapshotStore);
  const InputTriggerService = createServiceClass(cordis.Service, InputTriggerController);
  const MenuView = makeMenuView(jsxRuntime, react, primitives);

  /**
   * Thân plugin: cài service, rồi đăng ký MenuView vào overlay ô nhập khi slot đã khai báo.
   * Nhận: ctx - context gốc phía client.
   * Trả: không có.
   */
  function apply(ctx: ClientContextLike): void {
    ctx.plugin(InputTriggerService);
    ctx.effect(() => ctx.locale.register(MENU_NS, { zh, en }), MENU_DICTIONARIES_EFFECT);
    ctx.inject(["slots", "inputTriggers", "sessions"], (scope) => {
      const inputTriggers = scope.inputTriggers;
      const sessions = scope.sessions;
      // LUẬT GATE (19/10/2026): "check:rows" quét VĂN BẢN src ⇒ dùng CHUỖI LITERAL cho slot
      // (hằng số làm cổng báo "thieu dang ky slot conversation.input.overlay").
      scope.slots.inject("conversation.input.overlay", () =>
        scope.slots.register(
          {
            name: "conversation.input.overlay",
            id: MENU_SLOT_ID,
            order: MENU_SLOT_ORDER,
            locale: MENU_NS,
            inject: (sessionId: unknown) => {
              const actx = sessions.scope(sessionId);
              if (actx === undefined) {
                throw new Error(`ui-input-trigger: session "${String(sessionId)}" resolved no scope`);
              }
              const controller = inputTriggers.sessionOf(actx) as InputTriggerControllerInstance;
              return {
                menu: controller.menu,
                headers: controller.headers,
                onPick: (source: string, index: number, action?: "pick" | "drill") => {
                  controller.pick(source, index, action);
                },
                onCrumb: (source: string, index: number) => {
                  controller.pickCrumb(source, index);
                },
                onHover: (source: string, index: number) => {
                  controller.hover(source, index);
                },
                onDismiss: () => {
                  controller.dismiss();
                },
              };
            },
          },
          MenuView,
        ),
      );
    });
  }

  return {
    InputTriggerController,
    InputTriggerService,
    apply,
    inject: [...INJECT],
  };
}