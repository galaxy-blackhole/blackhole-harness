/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểm quyền lúc THỰC THI cho ba tool goal hướng model — port 1:1 vùng
 *      stock lib/index.js dòng 5–81 (region lib/types/authority.js): xác thực agent gọi
 *      đúng là agent sống trong driver đang mở, rồi suy quyền từ tin nhắn người thật
 *      hoặc từ đúng vòng goal hiện tại.
 */

import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@galaxy-blackhole/gbh-agent";
import type { GoalView } from "@galaxy-blackhole/gbh-goal";
// Nạp augmentation `ctx.sessionProjections` + khoá projection `turnBoundary` (kernel chỉ khai kiểu).
import type {} from "@galaxy-blackhole/gbh-session-projection";
import type { SessionEvent, SessionSeq } from "@galaxy-blackhole/gbh-session";
import { HarnessError } from "@deepseek-ai/dsh-llm";
import type { ToolRunContext } from "@galaxy-blackhole/gbh-host-tools";
import { agentsOf, asGoalAgent, goalsOf, sessionProjectionsOf, toolsOf, type TurnBoundaryStateLike } from "./seams.ts";

/** Một lần gọi tool đã được xác thực: agent gọi + mốc sự kiện BẤT BIẾN + seq mở lượt. */
export interface GoalToolExecution {
  /** Agent sống đã xác thực (đúng thể hiện trong sổ, đang chạy, là initiator hiện tại). */
  readonly agent: Agent;
  /** Bản chụp sự kiện của phiên tại thời điểm gọi (không cắt, không sao chép đuôi). */
  readonly events: readonly SessionEvent[];
  /** Seq của `turn/start` đang mở — mọi kiểm quyền chỉ đọc sự kiện SAU mốc này. */
  readonly openTurnStartSeq: SessionSeq;
}

/** Quyền cứng cấp cho MỘT lời gọi đổi trạng thái. */
export type GoalToolAuthority =
  | {
      /** Tin nhắn người thật (nguồn `user`) trong lượt đang mở của agent gốc. */
      readonly kind: "direct-human";
    }
  | {
      /** Đúng vòng goal hiện tại đã được chấp nhận. */
      readonly kind: "goal-round";
      /** Goal đang mở của agent gọi. */
      readonly goal: GoalView;
    };

/**
 * Ném một thất bại chính sách tool có mã ổn định.
 * Nhận: message — thông điệp cho model; code — mã lỗi (mặc định `GOAL_TOOL_AUTHORITY_REQUIRED`).
 * Trả: không trả về — luôn ném `HarnessError` (kiểu `never` để TypeScript thu hẹp sau lời gọi).
 */
function reject(message: string, code = "GOAL_TOOL_AUTHORITY_REQUIRED"): never {
  throw new HarnessError(message, code);
}

/**
 * Giải mốc cắt sự kiện BẤT BIẾN và ranh giới lượt đang mở (không sao chép đuôi lượt).
 * Nhận: ctx — context có sổ projection; agent — agent cần đọc phiên.
 * Trả: bản chụp sự kiện của phiên + seq `turn/start` đang mở.
 * Ném: `GOAL_TOOL_DRIVER_REQUIRED` khi chưa có lượt model nào đang mở (hoặc thiếu projection).
 */
function openTurnEvents(
  ctx: Context,
  agent: Agent,
): { events: readonly SessionEvent[]; openTurnStartSeq: SessionSeq } {
  const events = agent.session.snapshotEvents();
  const boundary = sessionProjectionsOf(ctx).stateOf(agent.session, "turnBoundary") as TurnBoundaryStateLike | null | undefined;
  if (boundary === undefined || boundary === null || boundary.openTurnStartSeq === null) {
    reject("goal tools require an open model turn", "GOAL_TOOL_DRIVER_REQUIRED");
  }
  return {
    events,
    openTurnStartSeq: boundary.openTurnStartSeq as SessionSeq,
  };
}

/**
 * Xác thực agent gọi và ranh giới driver của nó.
 * Nhận: ctx — context mang sổ agent sống; exec — siêu dữ liệu thực thi do sổ tool cấp.
 * Trả: agent đã xác thực, mốc cắt sự kiện bất biến và ranh giới lượt đang mở.
 * Ném: `GOAL_TOOL_AGENT_REQUIRED` khi lời gọi không có agent; `GOAL_TOOL_DRIVER_REQUIRED`
 *       khi agent không phải đúng thể hiện sống / không đang chạy / không phải initiator hiện tại.
 */
export function goalToolExecution(ctx: Context, exec: ToolRunContext): GoalToolExecution {
  const agent = exec.agent;
  if (agent === undefined) return reject("goal tools require a calling agent", "GOAL_TOOL_AGENT_REQUIRED");
  if ((agentsOf(ctx).get(agent.id) as unknown as Agent | undefined) !== agent || agent.status !== "running" || (agentsOf(ctx).currentInitiator() as unknown as Agent | undefined) !== agent) {
    return reject("goal tools require the exact live calling agent inside its active driver", "GOAL_TOOL_DRIVER_REQUIRED");
  }
  return {
    agent,
    ...openTurnEvents(ctx, agent),
  };
}

/**
 * Cho biết lượt đang mở có chứa sự kiện thoả `predicate` hay không.
 * Nhận: execution — lần gọi đã xác thực; predicate — điều kiện trên một sự kiện.
 * Trả: true khi có ít nhất một sự kiện sau ranh giới lượt thoả điều kiện.
 */
function someOpenTurnEvent(execution: GoalToolExecution, predicate: (event: SessionEvent) => boolean): boolean {
  for (let seq = execution.openTurnStartSeq + 1; seq < execution.events.length; seq += 1) {
    const event = execution.events[seq];
    if (event !== undefined && predicate(event)) return true;
  }
  return false;
}

/**
 * Cho biết có dữ liệu NGƯỜI THẬT do host chứng thực trong lượt hiện tại của agent gốc hay không.
 * Nguồn `user` bị bỏ trống của `Agent.followup()` / `steer()` cũng được quy về `user`, nên nhà sản xuất
 * không phải người phải tự khai nguồn riêng thay vì thừa hưởng quyền này.
 * Nhận: ctx — context có sổ agent; execution — lần gọi đã xác thực.
 * Trả: true khi agent là agent gốc và lượt đang mở có tin nhắn nguồn `user`.
 */
function hasDirectHumanInput(ctx: Context, execution: GoalToolExecution): boolean {
  if (!(agentsOf(ctx).roots() as readonly Agent[]).includes(execution.agent)) return false;
  return someOpenTurnEvent(execution, (event) => event.type === "user/message" && event.data.source.kind === "user");
}

/**
 * Cho biết lượt này có đúng là vòng đã được chấp nhận của goal hiện tại hay không.
 * Nhận: execution — lần gọi đã xác thực; goal — goal đang mở của agent.
 * Trả: true khi có tin nhắn nguồn `goal` khớp id + revision + số vòng.
 */
function isMatchingGoalRound(execution: GoalToolExecution, goal: GoalView): boolean {
  return someOpenTurnEvent(
    execution,
    (event) =>
      event.type === "user/message" &&
      // Bien the nguon 'goal' do goi goal khai bang augmentation; ban port doc qua mat CAU TRUC (ADR 000d).
      (event.data as { readonly source?: { readonly kind?: string; readonly goalId?: unknown; readonly revision?: unknown; readonly round?: unknown } }).source?.kind === "goal" &&
      (event.data as { readonly source?: { readonly goalId?: unknown } }).source?.goalId === goal.id &&
      (event.data as { readonly source?: { readonly revision?: unknown } }).source?.revision === goal.revision &&
      (event.data as { readonly source?: { readonly round?: unknown } }).source?.round === goal.roundsStarted,
  );
}

/**
 * Đòi quyền bắt nguồn từ tin nhắn người thật mà một agent gốc của runtime đã chấp nhận.
 * Nhận: ctx — context có đồ thị agent sống; execution — lần gọi đã xác thực.
 * Trả: không; ném `GOAL_TOOL_AUTHORITY_REQUIRED` khi lượt đang mở không có tin nhắn người thật.
 */
export function requireDirectHuman(ctx: Context, execution: GoalToolExecution): void {
  if (hasDirectHumanInput(ctx, execution)) return;
  reject("this goal operation requires a direct human turn on a top-level agent");
}

/**
 * Giải quyền hoàn tất từ tin nhắn người thật HOẶC từ đúng vòng goal hiện tại.
 * Nhận: ctx — context có agent sống và trạng thái goal; execution — lần gọi đã xác thực.
 * Trả: quyền `direct-human` hoặc `goal-round` (kèm goal khớp).
 * Ném: `GOAL_TOOL_AUTHORITY_REQUIRED` khi không có nguồn quyền nào.
 */
export function completionAuthority(ctx: Context, execution: GoalToolExecution): GoalToolAuthority {
  if (hasDirectHumanInput(ctx, execution)) return { kind: "direct-human" };
  const goal = goalsOf(ctx).get(asGoalAgent(execution.agent));
  if (goal !== undefined && isMatchingGoalRound(execution, goal)) {
    return {
      kind: "goal-round",
      goal,
    };
  }
  return reject("complete and blocked require a direct human turn or the current goal round");
}
