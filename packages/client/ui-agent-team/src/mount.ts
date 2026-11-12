/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đăng ký nửa browser của row agent-team: từ điển locale + occupant slot
 *      conversation.session.header.actions (id agent-team, order 9 — ĐỔI từ -20, xem ADR 0014)
 *      (@deepseek-ai/dsh-experimental-client-ui-agent-team, dòng 454-498)
 */

import { INJECT, NS } from "./ids.ts";
import { en, zh } from "./locales.ts";

/** Service mà nửa browser cần (NGUYÊN VĂN bản gốc: 4 id, đúng thứ tự). */
export const inject: string[] = [...INJECT];

/** Ảnh chụp của MỘT phiên mà phần điều hướng đọc. */
interface SessionBindingSnapshot {
  /** Quan hệ cha của subagent, nếu có. */
  readonly subagent?: {
    /** Địa chỉ quan hệ cha. */
    readonly address?: {
      /** Phiên cha (lead). */
      readonly parentSessionId?: string;
    };
  };
}

/** Ngữ cảnh client mà row này dùng (chỉ khai seam thật sự chạm). */
export interface AgentTeamClientCtx {
  /** Đăng ký hiệu ứng vòng đời; hàm dọn dẹp được gọi khi gỡ. */
  effect(run: () => () => void, label: string): void;
  /** Từ điển giao diện. */
  locale: {
    /** Đăng ký một namespace; trả hàm gỡ. */
    register(namespace: string, dictionaries: { readonly zh: unknown; readonly en: unknown }): () => void;
  };
  /** Sổ phiên của client. */
  sessions: {
    /** Mối nối của một phiên, nếu đang mở. */
    binding(sessionId: string): { readonly session: { getSnapshot(): SessionBindingSnapshot } } | undefined;
    /** Thông tin giữ tham chiếu của phiên. */
    retainInfo(sessionId: string): { getSnapshot(): { readonly retainedBy: { readonly mainView?: number } } };
  };
  /** Không gian làm việc: điều hướng mở phiên. */
  uiWorkspace: {
    /** Mở một phiên (theo id, hoặc theo cặp cha/con dạng continuable). */
    openSession(target: string | { readonly parentSessionId: string; readonly childSessionId: string; readonly mode: "continuable" }): void;
  };
  /** Sổ slot của giao diện. */
  slots: {
    /** Chèn một nhóm đăng ký theo tên slot; hàm chạy khi slot sống, trả hàm gỡ. */
    inject(name: string, run: () => () => void): void;
    /**
     * Đăng ký một occupant vào slot đã khai.
     * Hai hình dạng: occupant thường (`id` + `order` + `inject`) như bản gốc, và KEYED occupant
     * (`key` = tên tool) cho slot con `tool.call.toolview` — hàng keyed THAY hàng generic.
     */
    register(occupant: {
      /** Tên slot. */
      readonly name: string;
      /** Id occupant (hình dạng occupant thường). */
      readonly id?: string;
      /** Thứ tự trong slot (hình dạng occupant thường). */
      readonly order?: number;
      /** Khoá keyed occupant — với `tool.call.toolview` là TÊN TOOL. */
      readonly key?: string;
      /** Namespace từ điển của occupant. */
      readonly locale: string;
      /** Hàm bơm hành động nghiệp vụ cho component (hình dạng occupant thường). */
      readonly inject?: () => unknown;
    }, component: unknown): () => void;
  };
}

/**
 * Đăng ký từ điển Agent Teams và action trên header phiên hội thoại.
 * Bảng đọc projection agentTeam của phiên LEAD từ store phiên dùng chung; lần đăng ký này KHÔNG gọi RPC Team.
 * Nhận: ctx — Context client đã có đủ 4 service trong {@link inject}; TeamAction — component đã dựng.
 * Trả: không.
 */
export function registerAgentTeamUi(ctx: AgentTeamClientCtx, TeamAction: unknown, SetTeamLimitsRow?: unknown): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "client-ui-agent-team: dictionaries");
  const sessions = ctx.sessions;
  /**
   * Phiên LEAD của một phiên: nếu là subagent thì về phiên cha, không thì chính nó.
   * Nhận: sessionId — phiên đang xét.
   * Trả: id phiên lead.
   */
  const leadSessionId = (sessionId: string): string => {
    return sessions.binding(sessionId)?.session.getSnapshot().subagent?.address?.parentSessionId ?? sessionId;
  };
  const actions = {
    /**
     * Mở phiên của một thành viên từ hội thoại hiện tại (bản gốc dòng 478-490).
     * Nhận: sessionId — phiên đang mở; childSessionId — thành viên được chọn.
     * Trả: không (điều hướng qua uiWorkspace).
     */
    openTeammate(sessionId: string, childSessionId: string): void {
      const parentSessionId = leadSessionId(sessionId);
      if ((sessions.retainInfo(sessionId).getSnapshot().retainedBy.mainView ?? 0) === 0) return;
      if (childSessionId === parentSessionId) {
        ctx.uiWorkspace.openSession(parentSessionId);
        return;
      }
      ctx.uiWorkspace.openSession({ parentSessionId, childSessionId, mode: "continuable" });
    },
  };
  // Dùng CHUỖI LITERAL như bản gốc (dòng 491-497) — cổng check:rows đọc tên slot từ literal trong lời gọi;
  // hằng SLOT_CONVERSATION_HEADER_ACTIONS ở ids.ts giữ cho bên ngoài, test khẳng định hai bên BẰNG nhau.
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
    name: "conversation.session.header.actions",
    id: "agent-team",
    order: 9,
    locale: NS,
    inject: () => actions,
  }, TeamAction));
  // 23/10/2026 — ADR 0013: hàng toolview RIÊNG cho tool BỔ SUNG `set_team_limits`. Slot keyed
  // `tool.call.toolview` do row ui-tool khai; một keyed hit THAY hàng generic (cơ chế của `list_agents`),
  // nên hàng này có tiêu đề + icon + tóm tắt riêng mà KHÔNG phải sửa gói port nguyên văn.
  // ⚠️ Slot con `tool.call.toolview` do row ui-tool khai trong bảng `children` của node hội thoại, nên
  // ĐĂNG KÝ TRỰC TIẾP lúc apply sẽ ném "slot ... is not declared" khi gói ta được nạp trước ui-tool
  // (đo thật 23/10/2026: `#root` còn 354 ký tự, UI trắng). Dùng `slots.inject` — cùng cơ chế đang dùng
  // cho `conversation.session.header.actions` — để lượt đăng ký chạy khi slot đã sống.
  if (SetTeamLimitsRow !== undefined) {
    ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
      name: "tool.call.toolview",
      key: "set_team_limits",
      locale: NS,
    }, SetTeamLimitsRow));
  }
}
