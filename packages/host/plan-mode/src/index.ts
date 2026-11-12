/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cổng 1:1 của @deepseek-ai/dsh-plan-mode (stock lib/index.js 418 dòng + lib/types/*.d.ts,
 *      host-only): trạng thái plan theo agent được ghi log, section plan:policy, chiếu `plan`,
 *      lệnh /plan và công cụ exit_plan_mode có người dùng duyệt — giữ nguyên toàn bộ hành vi gốc.
 *      PHASE B (08/11/2026): sổ tool đọc qua SEAM CẤU TRÚC `ctx.get("tools")` thay vì `ctx.tools`
 *      (ADR 000d: gói `gbh-host-tools` cố ý KHÔNG augment `Context`).
 */

/**
 * Plan mode là trạng thái cộng tác theo từng agent được ghi vào log: khi đang bật,
 * một section hướng dẫn do deployment sở hữu được chèn vào mỗi request model, và
 * `exit_plan_mode` trình bày kế hoạch hoàn chỉnh để người dùng duyệt, trong khi
 * lệnh `/plan off` cho phép rời ngay. Chế độ sandbox và chính sách duyệt thực thi
 * ràng buộc độc lập, không đọc/ghi trạng thái plan.
 *
 * Chiếu `plan` gấp log phiên, nên resume và fork khôi phục được trạng thái. Lựa
 * chọn của người dùng vẫn pending cho tới bước pre-step được chấp nhận kế tiếp.
 * Service đưa trạng thái đã chọn vào phép lắp bước đề xuất, rồi chỉ ghi `plan/mode`
 * từ `agent/pre-step` khi bước đó được chấp nhận. Request retry cùng bước dùng lại
 * phép lắp của chúng.
 *
 * Công cụ thoát vẫn đăng ký khi plan mode không hoạt động, nên vào/rời plan mode
 * chỉ đổi section prompt, không đổi danh mục công cụ của request.
 *
 * @module @galaxy-blackhole/gbh-plan-mode
 */

import { Service, type Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import { brandString } from "@deepseek-ai/dsh-brand";
import type { CommandDefinition } from "@deepseek-ai/dsh-commands";
import type { CommandDefinitionId } from "@deepseek-ai/dsh-commands/brand";
import { createUserMessage, type ContextFormed, type UserMessage } from "@deepseek-ai/dsh-llm";
import type { Session } from "@deepseek-ai/dsh-session";
import type { ProjectionDefinition } from "@deepseek-ai/dsh-session-projection";
import { defineTool } from "@galaxy-blackhole/gbh-host-tools";
import type { ToolDefinition } from "@galaxy-blackhole/gbh-host-tools";
import { UserQuestionError } from "@deepseek-ai/dsh-user-questions";
import { z } from "zod";
import type { PlanProjection, PlanUnitState } from "./types.ts";

export type * from "./types.ts";

declare module "@deepseek-ai/dsh-llm" {
  interface MessageSourceMap {
    /** Thông báo chuyển chế độ do plan-mode tự chèn. */
    "plan-mode": {
      kind: "plan-mode";
    } & ContextFormed;
  }
}

declare module "@deepseek-ai/dsh-session/types" {
  interface SessionEventMap {
    /**
     * Plan mode có hiệu lực từ điểm này trở đi hay không: chỉ ghi log, không lên
     * surface, thay toàn bộ giá trị. `plan/mode` cuối cùng thắng; log không có
     * sự kiện nào gấp về inactive qua unit chiếu.
     */
    "plan/mode": {
      active: boolean;
    };
  }
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    planMode: PlanModeController;
  }
}

/**
 * Tên công cụ thoát phía model. Công cụ vẫn đăng ký khi plan mode không hoạt
 * động để danh mục công cụ của request ổn định qua các lần chuyển.
 */
export const EXIT_PLAN_MODE = "exit_plan_mode";

/** Id câu hỏi duyệt kế hoạch, được nhắc lại trong câu trả lời mà công cụ đọc. */
const REVIEW_ID = "plan-review";

/** Nhãn lựa chọn duyệt kế hoạch trong câu hỏi duyệt. */
const APPROVE_LABEL = "Approve";

/** Nhãn lựa chọn tiếp tục lập kế hoạch trong câu hỏi duyệt. */
const KEEP_PLANNING_LABEL = "Keep planning";

/** Mô tả phía model của công cụ `exit_plan_mode` — nguyên văn bản gốc. */
const EXIT_DESCRIPTION =
  "Use only in plan mode. Present your plan for the user's review and, on approval, leave plan mode. The user may approve (carry out the plan from your next step) or keep planning — their feedback comes back in the tool result; revise and present again.";

/**
 * Tiêu đề markdown đầu tiên (bất kỳ cấp nào) của kế hoạch, hoặc `undefined`
 * khi kế hoạch không có tiêu đề.
 *
 * @param plan Kế hoạch markdown.
 * @returns Nội dung tiêu đề đầu tiên, hoặc undefined.
 */
function firstHeading(plan: string): string | undefined {
  for (const line of plan.split("\n")) {
    const match = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (match) return match[1];
  }
}

/** Cấu hình do deployment sở hữu cho row plan-mode. */
export interface PlanModeConfig {
  /** Hướng dẫn được render thành section prompt `plan:policy` khi plan mode đang bật. */
  section: string;
}

/**
 * Kiểm tra hướng dẫn plan do deployment sở hữu. Thiếu, rỗng, không phải chuỗi,
 * hoặc có trường lạ đều hỏng ngay lúc nạp plugin thay vì bị bỏ qua.
 *
 * Nhận: `config` — cấu hình thô của plugin.
 * Trả: một cấu hình đã kiểm tra, tách rời khỏi đầu vào.
 *
 * @param config Cấu hình thô của plugin.
 * @returns Cấu hình đã kiểm tra, chỉ còn `section`.
 */
export function resolveConfig(config: PlanModeConfig): PlanModeConfig {
  const section = config.section;
  if (typeof section !== "string") throw new Error("PlanModeConfig needs a string `section`");
  if (section.trim() === "") throw new Error("PlanModeConfig needs a non-empty `section`");
  const unknown = Object.keys(config).filter((key) => key !== "section");
  if (unknown.length > 0) {
    throw new Error(`PlanModeConfig has unknown key(s) ${unknown.join(", ")} — config is { section }`);
  }
  return { section };
}

/**
 * Định nghĩa unit chiếu `plan`: gấp các lựa chọn plan đã ghi và chế độ đã chốt.
 * `stateVersion` 3 và schema NGHIÊM giữ nguyên từ bản gốc.
 */
export const planProjectionDefinition: Omit<ProjectionDefinition<"plan", PlanUnitState>, "wire"> & {
  wire: NonNullable<ProjectionDefinition<"plan", PlanUnitState>["wire"]>;
} = {
  key: "plan",
  stateVersion: 3,
  stateSchema: z
    .object({
      active: z.boolean(),
      wanted: z.boolean().nullable(),
      running: z
        .object({
          commandId: z.string(),
          wanted: z.boolean(),
        })
        .strict()
        .nullable(),
      activeAtLastHeader: z.boolean().nullable(),
    })
    .strict() as unknown as z.ZodType<PlanUnitState>,
  init: () => ({
    active: false,
    wanted: null,
    running: null,
    activeAtLastHeader: null,
  }),
  apply: (state, event) => {
    if (event.type === "command/run" && event.data.name === "plan") {
      if (event.data.args === undefined) return state;
      const wanted = event.data.args.trim() !== "off";
      return {
        ...state,
        running: {
          commandId: event.data.commandId,
          wanted,
        },
      };
    }
    if (event.type === "command/done" && state.running !== null && event.data.commandId === state.running.commandId) {
      const wanted =
        event.data.kind === "success" && state.running.wanted !== state.active ? state.running.wanted : null;
      return {
        ...state,
        wanted,
        running: null,
      };
    }
    if (event.type === "plan/mode") {
      return {
        ...state,
        active: event.data.active,
        wanted: null,
      };
    }
    if (event.type === "request/header") {
      return {
        ...state,
        activeAtLastHeader: state.active,
      };
    }
    return state;
  },
  wire: {
    viewSchema: z.object({
      active: z.boolean(),
      pending: z.boolean(),
    }) as unknown as z.ZodType<PlanProjection>,
    view: (state) => {
      const wanted = state.running?.wanted ?? state.wanted;
      return {
        active: state.active,
        pending: wanted !== null && wanted !== state.active,
      };
    },
  },
};

/**
 * Mặt cắt của SỔ TOOL (service `tools`) mà row này dùng — seam CẤU TRÚC, KHÔNG dựa vào augmentation
 * của `Context` (ADR 000d). Kiểu `ToolDefinition` lấy từ gói ta nên chỉ có MỘT nguồn kiểu.
 */
interface ToolsLike {
  /**
   * Đăng ký một định nghĩa tool vào sổ của phạm vi đang cài.
   * Nhận: định nghĩa tool (đã kiểm bởi `defineTool`).
   * Trả: hàm huỷ đăng ký (sổ tool của kernel trả về hàm này).
   */
  register(definition: ToolDefinition): () => void;
}

/**
 * `ctx.planMode`: sở hữu trạng thái plan đã ghi, áp dụng và tường thuật trạng thái
 * được chọn ở đầu bước, section `plan:policy`, lệnh `/plan`, và công cụ thoát ổn
 * định. Vật mang phía client phơi khung nhìn `{ active, pending }` đã cắt của chiếu.
 */
export class PlanModeController extends Service {
  /** Các service mà row cần trước khi khởi tạo. */
  static inject = ["tools", "systemPrompt", "sessionProjections"];

  /** Hướng dẫn do deployment sở hữu, đã kiểm tra. */
  private readonly section: string;

  /**
   * Lựa chọn mới nhất theo phiên đang chờ bước pre-step được chấp nhận kế tiếp.
   * `narrate` đúng cho lựa chọn của người dùng và sai cho công cụ thoát, vì kết
   * quả của công cụ đã tự tường thuật việc chuyển.
   */
  private readonly pendingIntents = new WeakMap<Session, { active: boolean; narrate: boolean }>();

  /**
   * Dựng service và treo mọi seam của row lên context đang nạp.
   *
   * Nhận: `ctx` — context Cordis của row; `config` — cấu hình thô (mặc định
   * `{ section: "" }` để giữ đúng hành vi ném lỗi khi thiếu section).
   * Trả: không — service được đăng ký dưới tên `planMode`.
   *
   * @param ctx Context Cordis của row.
   * @param config Cấu hình thô của plugin.
   */
  constructor(ctx: Context, config: PlanModeConfig = { section: "" }) {
    super(ctx, "planMode");
    this.section = resolveConfig(config).section;
    let disposed = false;
    ctx.on("agent/pre-step", async ({ agent, signal }, next) => {
      const decision = await next();
      const pending = this.pendingIntents.get(agent.session);
      if (decision.kind === "reject" || signal.aborted || pending === undefined) return decision;
      const narration = this.narration(agent.session, pending.active);
      try {
        this.onBoundary(agent.session);
      } catch (error) {
        ctx.logger.warn("gbh-plan-mode: failed to append selected plan mode at step start: %o", error);
        return decision;
      }
      return !pending.narrate || narration === undefined
        ? decision
        : {
            ...decision,
            messages: [...decision.messages, narration],
          };
    });
    ctx.effect(
      () => () => {
        disposed = true;
      },
      "gbh-plan-mode: close service lifetime",
    );
    ctx.systemPrompt.section({
      name: "plan:policy",
      order: ctx.systemPrompt.getSectionOrder("PLAN_POLICY"),
      text: (context) => {
        if (context.agent === undefined) return "";
        return this.pendingIntents.get(context.agent.session)?.active ?? this.loggedActive(context.agent.session)
          ? this.section
          : "";
      },
    });
    ctx.sessionProjections.register(planProjectionDefinition);
    ctx.inject(["commands"], (commandCtx) => {
      const definition: CommandDefinition = {
        definitionId: brandString<CommandDefinitionId>("@deepseek-ai/dsh-plan-mode"),
        name: "plan",
        description: "Enter or leave plan mode",
        input: {
          hint: "[off|message]",
          attachments: true,
        },
        handler: ({ agent, rawInput, attachments }) => {
          const message = rawInput.trim();
          if (message === "off" && attachments.length > 0) {
            return {
              kind: "error",
              text: "Attachments cannot accompany /plan off.",
            };
          }
          if (message === "off") {
            switch (this.set(agent, false)) {
              case "committed":
                return {
                  kind: "success",
                  text: "Plan mode off.",
                };
              case "queued":
                return {
                  kind: "success",
                  text: "Leaving plan mode (applies from the next step).",
                };
              case "cancelled":
                return {
                  kind: "success",
                  text: "Plan mode entry cancelled.",
                };
              case "noop":
                return this.loggedActive(agent.session)
                  ? {
                      kind: "success",
                      text: "Leaving plan mode (applies from the next step).",
                    }
                  : {
                      kind: "success",
                      text: "Plan mode is already inactive.",
                    };
            }
          }
          const outcome = this.set(agent, true);
          if (message !== "" || attachments.length > 0) {
            agent.steer(
              createUserMessage({
                content: [
                  ...attachments,
                  ...(message === ""
                    ? []
                    : [
                        {
                          type: "text" as const,
                          text: message,
                        },
                      ]),
                ],
                source: { kind: "user" },
              }),
            );
          }
          return {
            kind: "success",
            text:
              outcome === "committed"
                ? "Plan mode on. Use /plan off to leave."
                : "Entering plan mode (applies from the next step). Use /plan off to leave.",
          };
        },
      };
      commandCtx.commands.register(definition);
    });
    // PHASE B: sổ tool lấy qua SEAM CẤU TRÚC; thiếu seam là lỗi cấu hình ⇒ nổ NGAY (fail loud như bản gốc).
    const tools = ctx.get("tools") as ToolsLike | undefined;
    if (tools === undefined) throw new Error("plan-mode requires the tools seam (ctx.get(\"tools\"))");
    tools.register(
      defineTool({
        name: EXIT_PLAN_MODE,
        description: EXIT_DESCRIPTION,
        parameters: {
          plan: {
            type: "string",
            required: true,
            description: "The complete plan, as markdown, starting with a # heading that names it.",
          },
        },
        output: {
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              approved: {
                type: "boolean",
                required: true,
              },
            },
          },
          render: (_args, { approved }) => [
            {
              type: "text",
              text: approved
                ? "Plan approved — plan mode exited; carry out the plan starting with your next step."
                : "The user dismissed the plan review to reply in their own words; plan mode remains active.",
            },
          ],
        },
        execute: async (args, exec) => {
          // 08/11/2026 (seam CẤU TRÚC tại biên): exec.agent mang KIỂU của gói tools (GBH) còn phần còn lại
          // của tệp dùng Agent/Session của kernel stock ⇒ hai danh tính kiểu khác nhau dù CÙNG thể hiện runtime.
          // Ép kiểu MỘT chỗ, giữ nguyên hành vi (không đổi id kernel, không nới kiểu toàn cục).
          const agent = exec.agent as unknown as Agent & { readonly session: Session };
          if (agent === undefined) {
            throw new Error(`${EXIT_PLAN_MODE} requires a calling agent (no session to switch)`);
          }
          if (!this.loggedActive(agent.session)) {
            throw new Error(`${EXIT_PLAN_MODE} is only available in plan mode`);
          }
          if (!/^#\s+\S/.test(args.plan.trim())) {
            throw new Error(`${EXIT_PLAN_MODE} requires a non-empty markdown plan starting with a # heading`);
          }
          const interaction = ctx.get("userQuestions");
          if (interaction === undefined) {
            throw new Error(
              "no user-questions channel is available to review the plan; ask the user to switch the session mode instead",
            );
          }
          let answer;
          try {
            answer = await interaction.ask({
              questions: [
                {
                  id: REVIEW_ID,
                  header: "Plan review",
                  question: "Approve this plan and leave plan mode?",
                  detail: args.plan,
                  options: [
                    {
                      label: APPROVE_LABEL,
                      description: "Leave plan mode; the plan is carried out from the next step.",
                    },
                    {
                      label: KEEP_PLANNING_LABEL,
                      description: "Stay in plan mode; feedback goes back to the model.",
                    },
                  ],
                  intent: {
                    kind: "plan-review",
                    approve: APPROVE_LABEL,
                    callId: exec.callId,
                  },
                },
              ],
              agent,
              signal: exec.signal,
            });
          } catch (cause) {
            if (cause instanceof UserQuestionError && cause.code === "ASK_CANCELLED") {
              exec.concludeTurn();
              return { approved: false };
            }
            throw cause;
          }
          if (disposed) {
            throw new Error(
              "the plan-mode service was reloaded while the plan was under review; present the plan again",
            );
          }
          const reviewItems = answer.answers.filter((entry) => entry.id === REVIEW_ID);
          const item = reviewItems.length === 1 ? reviewItems[0] : undefined;
          if (
            item === undefined ||
            item.selected.length !== 1 ||
            item.selected[0] !== APPROVE_LABEL ||
            item.custom !== undefined
          ) {
            const feedback = item?.custom ?? "";
            throw new Error(
              feedback === ""
                ? "The user chose to keep planning; revise the plan and present it again."
                : `The user chose to keep planning; their feedback: ${feedback}`,
            );
          }
          this.pendingIntents.set(agent.session, {
            active: false,
            narrate: false,
          });
          return { approved: true };
        },
        presentCall: (args) => ({
          card: "generic",
          title: firstHeading(args.plan) ?? "Plan",
          kind: "other",
          content: [
            {
              type: "text",
              text: args.plan,
            },
          ],
        }),
        presentResult: (_args, result) => ({
          card: "generic",
          title: "Plan review",
          content: result.content,
        }),
      }),
    );
  }

  /**
   * Đọc trạng thái plan đã ghi của một phiên.
   *
   * Nhận: `session` — phiên cần đọc.
   * Trả: `true` khi plan mode đang bật.
   *
   * @param session Phiên cần đọc.
   * @returns Trạng thái active đã ghi.
   */
  private loggedActive(session: Session): boolean {
    return this.planState(session).active;
  }

  /**
   * Cho biết phiên có lượt đang mở hay không, dùng làm tín hiệu idle.
   *
   * Nhận: `session` — phiên cần đọc.
   * Trả: `true` khi `turnBoundary` báo một lượt đang mở.
   *
   * @param session Phiên cần đọc.
   * @returns Có lượt đang mở.
   */
  private hasOpenTurn(session: Session): boolean {
    const state = this.ctx.sessionProjections.stateOf(session, "turnBoundary");
    if (state === undefined) throw new Error("plan-mode requires the turnBoundary session projection");
    return state.openTurnStartSeq !== null;
  }

  /**
   * Trạng thái plan đã ghi tại `request/header` gần nhất, nếu có.
   *
   * Nhận: `session` — phiên cần đọc.
   * Trả: trạng thái đã ghi tại header cuối, hoặc undefined.
   *
   * @param session Phiên cần đọc.
   * @returns Trạng thái active tại header cuối.
   */
  private loggedActiveAtLastHeader(session: Session): boolean | undefined {
    return this.planState(session).activeAtLastHeader ?? undefined;
  }

  /**
   * Đọc trạng thái chiếu `plan` bắt buộc, hoặc hỏng ngay ở lần chạm service đầu tiên.
   *
   * Nhận: `session` — phiên cần đọc.
   * Trả: trạng thái `PlanUnitState` đã gấp.
   *
   * @param session Phiên cần đọc.
   * @returns Trạng thái plan đã gấp.
   */
  private planState(session: Session): PlanUnitState {
    const state = this.ctx.sessionProjections.stateOf(session, "plan");
    if (state === undefined) throw new Error("plan-mode requires the plan session projection");
    return state;
  }

  /**
   * Đọc trạng thái plan đã ghi và mọi trạng thái đã chọn đang chờ bước pre-step
   * được chấp nhận kế tiếp.
   *
   * Nhận: `agent` — agent cần đọc.
   * Trả: trạng thái đã ghi hiện tại, kèm lựa chọn đang chờ khi có.
   *
   * @param agent Agent cần đọc.
   * @returns Trạng thái đã ghi và cờ pending khi có lựa chọn đang chờ.
   */
  get(agent: Agent): { active: boolean; pending?: boolean } {
    const active = this.loggedActive(agent.session);
    const pending = this.pendingIntents.get(agent.session);
    return pending === undefined
      ? { active }
      : {
          active,
          pending: pending.active,
        };
  }

  /**
   * Chọn plan mode có nên bật hay không. Giữa các lượt, phương thức ghi thay đổi
   * ngay vì không có pre-step trong lượt nào sẽ chạy cho tới khi một prompt khác mở
   * lượt. Phép gấp lượt-đang-mở là tín hiệu idle: trạng thái agent vẫn là `running`
   * suốt quá trình checkpoint sau lượt, khi không còn pre-step trong lượt nào chạy.
   * Trong một lượt đang mở, lựa chọn vẫn pending cho tới pre-step được chấp nhận kế
   * tiếp. Chọn lặp lại trạng thái hiện tại hoặc trạng thái đã pending là no-op.
   *
   * Nhận: `agent` — agent cần chuyển; `active` — plan mode có nên bật.
   * Trả: điều đã xảy ra — `committed` (ghi ngay), `queued` (chờ pre-step được chấp
   * nhận kế tiếp), `cancelled` (một lựa chọn pending ngược chiều đã bị xoá; trạng
   * thái đã ghi vốn đã khớp), hoặc `noop` (đã ở đúng trạng thái đó).
   *
   * @param agent Agent cần chuyển.
   * @param active Plan mode có nên bật.
   * @returns Kết quả chuyển trạng thái.
   */
  set(agent: Agent, active: boolean): "committed" | "queued" | "cancelled" | "noop" {
    const session = agent.session;
    if (active === (this.pendingIntents.get(session)?.active ?? this.loggedActive(session))) return "noop";
    if (this.hasOpenTurn(session)) {
      this.pendingIntents.set(session, {
        active,
        narrate: true,
      });
      return this.loggedActive(session) === active ? "cancelled" : "queued";
    }
    if (active === this.loggedActive(session)) {
      this.pendingIntents.delete(session);
      return "cancelled";
    }
    session.append("plan/mode", { active });
    this.pendingIntents.delete(session);
    const narration = this.narration(session, active);
    if (narration !== undefined) agent.inject(narration);
    return "committed";
  }

  /**
   * Ghi một lựa chọn đang chờ trước phép lắp request kế tiếp.
   *
   * Nhận: `session` — phiên có lựa chọn đang chờ.
   * Trả: không; xoá lựa chọn sau khi ghi hoặc khi trạng thái đích đã khớp.
   *
   * @param session Phiên cần áp dụng.
   */
  private onBoundary(session: Session): void {
    const pending = this.pendingIntents.get(session);
    if (pending === undefined) return;
    const target = pending.active;
    if (target === this.loggedActive(session)) {
      this.pendingIntents.delete(session);
      return;
    }
    session.append("plan/mode", { active: target });
    this.pendingIntents.delete(session);
  }

  /**
   * Dựng thông báo chuyển chế độ của người dùng khi header đã ghi gần nhất mô tả
   * chế độ còn lại.
   *
   * Nhận: `session` — phiên cần tường thuật; `target` — chế độ đích.
   * Trả: message người dùng dạng notice, hoặc undefined khi không cần nhắc.
   *
   * @param session Phiên cần tường thuật.
   * @param target Chế độ đích.
   * @returns Thông báo chuyển chế độ, hoặc undefined.
   */
  private narration(session: Session, target: boolean): UserMessage | undefined {
    const told = this.loggedActiveAtLastHeader(session);
    if (told === undefined || told === target) return;
    const text = target
      ? "The user switched this session to plan mode."
      : "The user switched this session back to the default mode.";
    return createUserMessage({
      content: [
        {
          type: "text",
          text,
        },
      ],
      source: {
        kind: "plan-mode",
        form: "notice",
        summary: text,
      },
    });
  }
}

export default PlanModeController;
