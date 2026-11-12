/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vùng lib/types/client/service.js của bản gốc — InputTriggerService (ctx.inputTriggers): sổ nguồn + bảng controller theo phiên
 */

import type { InputTriggerControllerClass, InputTriggerControllerInstance, SourceRoster } from "./controller.ts";
import { SESSIONS_SERVICE, SERVICE_NAME, SESSION_CONTROLLER_EFFECT } from "./ids.ts";
import type {
  ClientContextLike,
  InputTriggerServiceContract,
  InputTriggerSource,
  ServiceCtorLike,
  ServiceLike,
  SessionsServiceLike,
  SessionBindingLike,
} from "./types.ts";
import { WeakMapWithValues } from "./values.ts";

/** Trạng thái sống của service: roster nguồn + controller theo liên kết phiên. */
interface ServiceLive {
  /** Nguồn đã đăng ký, theo thứ tự đăng ký. */
  sources: InputTriggerSource[];
  /** Controller sống theo liên kết phiên (khóa yếu, giá trị giữ mạnh). */
  controllers: WeakMapWithValues<SessionBindingLike, InputTriggerControllerInstance>;
}

/**
 * Dựng lớp InputTriggerService trên lớp Service của cordis và lớp controller đã dựng.
 * Nhận: Service - lớp Service của cordis (require("@deepseek-ai/cordis"));
 *   ControllerClass - lớp controller theo phiên do createControllerClass trả về.
 * Trả: lớp dịch vụ; thực thể đăng ký chính nó dưới tên inputTriggers.
 */
export function createServiceClass(Service: ServiceCtorLike, ControllerClass: InputTriggerControllerClass) {
  /**
   * Dịch vụ trigger (ctx.inputTriggers): nửa gốc của pipeline — sổ nguồn không trạng thái
   * cộng bảng controller theo phiên. Mọi trạng thái tương tác sống trên controller.
   */
  class InputTriggerService
    extends (Service as unknown as new (ctx: unknown, name: string) => ServiceLike)
    implements InputTriggerServiceContract
  {
    /** Dịch vụ bắt buộc của cordis (nguyên văn bản gốc). */
    static inject = [SESSIONS_SERVICE];

    /** Trạng thái sống của service. */
    readonly live: ServiceLive = {
      sources: [],
      controllers: new WeakMapWithValues<SessionBindingLike, InputTriggerControllerInstance>(),
    };

    /**
     * @param ctx - context gốc sở hữu service (service đăng ký chính nó dưới tên inputTriggers).
     */
    constructor(ctx: ClientContextLike) {
      super(ctx, SERVICE_NAME);
      ctx.on("locale/change", () => {
        for (const controller of this.live.controllers.values) controller.refreshOpenMenu();
      });
    }

    /**
     * Đăng ký một nguồn trigger. Controller phiên đang sống được báo để nguồn đến sau lúc scope
     * ra đời vẫn được mồi và vào lexicon.
     * Nhận: src - nguồn; cặp (trigger, name) phải duy nhất — trùng thì ném.
     * Trả: hàm huỷ (người gọi bọc đăng ký trong ctx.effect). Huỷ khi một controller đang hiện nhóm
     *   của nguồn thì bỏ luôn nhóm đó.
     */
    registerSource(src: InputTriggerSource): () => void {
      const { live } = this;
      if (live.sources.some((s) => s.trigger === src.trigger && s.name === src.name)) {
        throw new Error(`slash source "${src.trigger}${src.name}" is already registered`);
      }
      live.sources.push(src);
      for (const controller of live.controllers.values) {
        try {
          controller.sourceAdded(src);
        } catch (error) {
          console.error(`[ui-input-trigger] source "${src.trigger}${src.name}" late-registration setup failed:`, error);
        }
      }
      return () => {
        const at = live.sources.indexOf(src);
        if (at < 0) return;
        live.sources.splice(at, 1);
        for (const controller of live.controllers.values) controller.sourceRemoved(src);
      };
    }

    /**
     * Giải controller theo phạm vi phiên (lười; hàm huỷ của scope gỡ và huỷ nó). Dựng controller
     * mồi roster một lần — phiên luôn do agent bảo chứng, nên lúc scope ra đời là mốc prewarm duy nhất.
     * Nhận: actx - context phạm vi phiên.
     * Trả: controller thường trú.
     * Ném: khi Context không còn thuộc một thế hệ Session được giữ.
     */
    sessionOf(actx: ClientContextLike): InputTriggerControllerInstance {
      const sessions = this.sessions();
      const session = sessions.sessionOf(actx);
      const binding = session === undefined ? undefined : sessions.binding(session.sessionId);
      if (binding === undefined || binding.session !== session) {
        throw new Error("slash.sessionOf requires a retained Session scope");
      }
      const id = binding.sessionId;
      const { live } = this;
      const existing = live.controllers.get(binding);
      if (existing !== undefined) return existing;
      const roster: SourceRoster = {
        sources: (trigger) =>
          live.sources.filter((s) => s.trigger === trigger).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
        all: () => live.sources,
      };
      const controller = new ControllerClass({
        actx: binding.ctx,
        sessionId: id,
        roster,
      });
      live.controllers.set(binding, controller);
      binding.ctx.effect(
        () => () => {
          controller.dispose();
          live.controllers.delete(binding);
        },
        SESSION_CONTROLLER_EFFECT,
      );
      return controller;
    }

    /**
     * Lấy dịch vụ phiên của kernel từ context.
     * Nhận: không có.
     * Trả: dịch vụ phiên.
     * Ném: khi context chưa có dịch vụ sessions.
     */
    private sessions(): SessionsServiceLike {
      const sessions = this.ctx.get(SESSIONS_SERVICE) as SessionsServiceLike | undefined;
      if (sessions === undefined) throw new Error("ui-input-trigger: sessions service unavailable");
      return sessions;
    }
  }

  return InputTriggerService;
}

/**
 * Lớp dịch vụ do createServiceClass dựng.
 * Nhận: không có.
 * Trả: kiểu InputTriggerServiceClass.
 */
export type InputTriggerServiceClass = ReturnType<typeof createServiceClass>;
