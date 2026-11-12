/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bộ điều khiển vòng goal CÙNG PHIÊN: tự nhận MỘT vòng kế tiếp khi agent rảnh, và dựng hàng rào
 *      chống tranh chấp cho đúng bản goal/revision đã đặt chỗ. Bản viết lại của Galaxy Blackhole cho row
 *      goal-round-driver (@deepseek-ai/dsh-goal-round-driver) — bảng nguồn đối chiếu ở README.md (G4).
 */

import { isDeepStrictEqual } from "node:util";

import type { Context } from "@deepseek-ai/cordis";
import type { Agent } from "@deepseek-ai/dsh-agent";
import type { GoalService, GoalView } from "@galaxy-blackhole/gbh-goal";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, MessageId, MessageSource, UserMessage } from "@deepseek-ai/dsh-llm";

import { renderGoalRoundPrompt } from "./prompt.ts";
import type { AgentState, GoalAttempt, GoalRoundMessage, GoalRoundSource, SubagentSeam } from "./types.ts";

/**
 * Mặt cấu trúc của seam `goals` — LẤY NGUYÊN từ lớp dịch vụ của gói GBH (không tự đoán chữ ký):
 * bản port không tái khai augmentation `Context.goals` của bản gốc nên ta đọc seam qua `ctx.get()` (ADR 000d).
 */
type GoalsSeamLike = GoalService;

/**
 * Kiểu 'agent' mà dịch vụ goal của GÓI GBH nhận (khác danh tính với 'Agent' của kernel nhưng CÙNG hình dạng
 * runtime) — lấy từ chính chữ ký của dịch vụ, ép MỘT chỗ tại biên (ADR 000d).
 */
type GoalAgentArg = Parameters<GoalService["get"]>[0];

/**
 * Ép 'Agent' của kernel sang kiểu agent mà seam goal nhận (thuần kiểu, không đổi runtime).
 * Nhận: 'agent' — agent do kernel cấp. Trả: cùng vật thể dưới kiểu của gói GBH.
 */
function asGoalAgent(agent: Agent): GoalAgentArg {
  return agent as unknown as GoalAgentArg;
}

/**
 * Lấy seam `goals`, thiếu là lỗi cấu hình nên ném NGAY.
 * Nhận: `ctx` — context Host. Trả: mặt cấu trúc của dịch vụ goal.
 */
function goalsOf(ctx: Context): GoalsSeamLike {
  // Kernel công bố service theo HAI đường cùng nghĩa: `ctx.get(name)` và thuộc tính `ctx.<name>`.
  const viaGet = typeof ctx.get === "function" ? (ctx.get("goals") as GoalsSeamLike | undefined) : undefined;
  const viaProperty = (ctx as unknown as { readonly goals?: GoalsSeamLike }).goals;
  const seam = viaGet ?? viaProperty;
  if (seam === undefined) {
    throw new TypeError('goal-round-driver requires the goals seam (ctx.get("goals"))');
  }
  return seam;
}

/** Payload của sự kiện `goal/changed` mà driver nghe — chỉ phần dùng (operation của bản thay đổi). */
interface GoalChangedSeamLike {
  /** Thao tác vừa xảy ra trên goal (`clear`/`pause`/…). */
  readonly operation?: string;
}

/** Mặt cấu trúc của kênh sự kiện `goal/changed` (bản gốc khai bằng augmentation `Events`). */
interface GoalEventsSeamLike {
  /** Đăng ký nghe sự kiện goal; trả hàm gỡ. */
  on(event: "goal/changed", listener: (payload: { agent: Agent; change: GoalChangedSeamLike }) => void): () => void;
}

/** Câu lệnh vòng goal — bản gốc để nó ở CÙNG module với driver nên ta xuất lại y như vậy. */
export { renderGoalRoundPrompt } from "./prompt.ts";

/** Tên plugin cordis — nguyên văn của bản gốc (Loader dùng cho chẩn đoán). */
export const name = "goal-round-driver";

/**
 * Ba seam driver chờ trước khi chạy — nguyên văn và ĐÚNG thứ tự bản gốc:
 * `agents` (sổ agent sống) · `goals` (sổ goal) · `sessions` (ép ghi bền).
 */
export const inject: string[] = ["agents", "goals", "sessions"];

/**
 * `FiberState.ACTIVE` của cordis, so bằng SỐ như bản gốc: `FiberState` là `const enum` khai trong `.d.ts`
 * nên KHÔNG có mặt lúc chạy — import nó sẽ làm bundle ném ReferenceError khi nạp.
 */
const FIBER_ACTIVE = 2;

/**
 * Nguồn này có phải MỘT vòng goal TỰ ĐỘNG không.
 * Nhận: nguồn message bất kỳ. Trả: true khi `kind` là `goal` VÀ `round` dương
 * (vòng 0 là message của người tạo goal, không phải vòng tự động).
 */
function isGoalRoundSource(source: unknown): source is GoalRoundSource {
  // ADR 000d (08/11/2026 dev-1): thu hẹp từ unknown vì kernel KHÔNG có biến thể goal trong hợp MessageSource.
  const candidate = source as { readonly kind?: unknown; readonly round?: unknown };
  return candidate.kind === "goal" && typeof candidate.round === "number" && candidate.round > 0;
}

/**
 * Thu hẹp nguồn về dạng vòng goal, hoặc `undefined`.
 * Nhận: nguồn message bất kỳ. Trả: chính nguồn đó khi là vòng goal — hàm THUẦN, không đổi thứ tự đánh giá
 * của chuỗi điều kiện mà {@link validReservationOf} dựng lại từ bản gốc.
 */
function goalRoundFields(source: unknown): GoalRoundSource | undefined {
  return isGoalRoundSource(source) ? source : undefined;
}

/**
 * So một nguồn vòng goal với ĐÚNG một danh tính đã đặt chỗ.
 * Nhận: nguồn đã thu hẹp + lượt đặt chỗ. Trả: true khi trùng cả `goalId`, `revision` và `round`.
 */
function sameRound(source: GoalRoundSource, round: GoalAttempt): boolean {
  return source.goalId === round.goalId && source.revision === round.revision && source.round === round.round;
}

/**
 * So BẢN GHI đã xếp hàng đầy đủ với đặt chỗ của driver.
 * Nhận: nội dung message, nguồn của nó, và lượt đặt chỗ. Trả: true khi nguồn là vòng goal, trùng danh tính,
 * và nội dung BẰNG SÂU từng phần tử với nội dung đã đặt chỗ.
 */
/** Nguồn này là vòng 0 (message của người tạo goal) — kernel không có biến thể goal trong hợp nên đọc CẤU TRÚC.
 * Nhận: nguồn message bất kỳ. Trả: true khi nguồn là vòng 0 của driver.
 */
function isRoundZeroSource(source: unknown): boolean {
  const candidate = source as { readonly kind?: unknown; readonly round?: unknown };
  return candidate.kind === "goal" && candidate.round === 0;
}

function sameQueued(content: readonly ContentBlock[], source: unknown, attempt: GoalAttempt): boolean {
  // ADR 000d (08/11/2026 dev-1): nhận `unknown` vì nguồn có thể là `MessageSource` của kernel (không có biến thể
  // `goal`) hoặc `GoalRoundSource` khai cục bộ; phép thu hẹp bên trong lo phần kiểu.
  return isGoalRoundSource(source) && sameRound(source, attempt) && isDeepStrictEqual(content, attempt.content);
}

/**
 * Tham chiếu revision ĐANG HIỆN của một goal.
 * Nhận: bản goal đọc từ sổ. Trả: cặp `{ id, revision }` để lệnh so-sánh-và-đặt của sổ goal dùng làm tiền đề.
 */
function goalRef(goal: GoalView): { readonly id: GoalView["id"]; readonly revision: number } {
  return { id: goal.id, revision: goal.revision };
}

/**
 * Đổi giá trị bất ngờ thành chữ đọc được cho log.
 * Nhận: giá trị bất kỳ (thường là lỗi bắt được). Trả: `message` của Error, hoặc `String(value)` cho mọi thứ khác.
 */
function renderThrown(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

/**
 * Cài chế độ tiếp tục tự động cùng phiên và các hàng rào chống tranh chấp của nó.
 * Nhận: `ctx` — context cordis đã có ba seam `agents`/`goals`/`sessions` (khai ở {@link inject}).
 * Trả: không; đăng ký chín listener sự kiện + hàng rào waterfall `agent/pre-step`, và một disposer
 *       dỡ mọi vòng đang chạy. Không ném lỗi ra ngoài: mọi đường lỗi đều log rồi tự gỡ quyền tự động.
 */
export function apply(ctx: Context): void {
  /** Trạng thái sống, khoá theo ĐÚNG danh tính agent (không theo id). */
  const states = new Map<Agent, AgentState>();
  /** Tín hiệu dỡ plugin — cắt mọi lượt chờ subagent. */
  const unloading = Promise.withResolvers<void>();

  /**
  * Tạo trạng thái cho một agent ĐANG sống (trả lại bản đã có nếu trùng danh tính).
  * Nhận: agent cần trạng thái. Trả: trạng thái đã đăng ký trong sổ của driver.
  */
  function stateFor(agent: Agent): AgentState {
    const existing = states.get(agent);
    if (existing !== undefined) return existing;
    const state: AgentState = {
      agent,
      attempt: undefined,
      competingQueued: false,
      needsCheckpoint: false,
      requested: false,
      run: undefined,
      stopping: false,
    };
    states.set(agent, state);
    return state;
  }

  /**
  * Đọc goal CHỈ KHI đúng thể hiện Agent còn sống.
  * Nhận: trạng thái của agent. Trả: bản goal hiện tại, hoặc `undefined` khi agent đã bị thay/tháo khỏi sổ.
  */
  function currentGoal(state: AgentState): GoalView | undefined {
    if (ctx.agents.get(state.agent.id) !== state.agent) return undefined;
    return goalsOf(ctx).get(asGoalAgent(state.agent));
  }

  /**
  * Goal này có được nhận vòng TỰ ĐỘNG không.
  * Nhận: bản goal (có thể `undefined`). Trả: true khi đang `active` VÀ đã `armed` (quyền tự động là phạm vi tiến trình).
  */
  function drivable(goal: GoalView | undefined): goal is GoalView {
    return goal !== undefined && goal.phase === "active" && goal.activation === "armed";
  }

  /**
  * Vòng đời này đã YÊN và không có prompt tranh chấp nào.
  * Nhận: trạng thái của agent. Trả: true khi fiber đang ACTIVE, không dỡ, đúng agent còn sống, agent `idle`,
  *       và không có prompt lạ đang chờ ở ranh giới lượt.
  */
  function readyToDrive(state: AgentState): boolean {
    return (
      ctx.fiber.state === FIBER_ACTIVE &&
      !state.stopping &&
      ctx.agents.get(state.agent.id) === state.agent &&
      state.agent.status === "idle" &&
      !state.competingQueued
    );
  }

  /**
  * Kiểm lại MỌI điều kiện mà một điểm chờ (await) có thể đã đổi.
  * Nhận: trạng thái của agent. Trả: true khi vẫn lái được VÀ không còn checkpoint treo.
  */
  function readyAfterCheckpoint(state: AgentState): boolean {
    return readyToDrive(state) && !state.needsCheckpoint;
  }

  /**
  * Gỡ quyền tự động nhưng GIỮ NGUYÊN pha bền của goal.
  * Nhận: trạng thái của agent. Trả: không; lỗi của sổ goal chỉ được log (không bao giờ ném ra vòng sự kiện).
  */
  function disarm(state: AgentState): void {
    try {
      if (currentGoal(state)?.activation === "armed") goalsOf(ctx).disarm(asGoalAgent(state.agent));
    } catch (error) {
      ctx.logger.warn(`goal-round-driver: could not disarm agent "${state.agent.id}": ${renderThrown(error)}`);
    }
  }

  /**
  * Giữ lại ngữ cảnh bước ĐÃ NHẬN khi driver chỉ bỏ vòng CỦA MÌNH.
  * Nhận: agent, danh sách message đã bị gỡ khỏi inbox cho bước này, và id message của vòng driver.
  * Trả: không; mọi message KHÁC (trừ message vòng 0 của goal) được đặt lại vào ranh giới `next-step`
  *       theo đúng thứ tự ngược, bỏ qua message đã còn trong inbox.
  */
  function restoreOtherClaimed(agent: Agent, messages: readonly UserMessage[], messageId: MessageId): void {
    const retained = messages.filter(
      (message) => message.id !== messageId && !isRoundZeroSource(message.source),
    );
    for (const message of retained.toReversed()) {
      if (
        agent.inbox.nextStep.some((candidate) => candidate.id === message.id) ||
        agent.inbox.nextTurn.some((candidate) => candidate.id === message.id)
      ) {
        continue;
      }
      agent.inbox.prepend("next-step", message);
    }
  }

  /**
  * Xử lý việc ĐÃ NHẬN khi yên, rồi đặt chỗ TỐI ĐA MỘT vòng kế tiếp.
  * Nhận: trạng thái của agent. Trả: promise hoàn tất khi lượt lái này khép lại; không ném — lỗi ghi bền thì
  *       gỡ quyền tự động, lỗi xếp hàng thì đánh dấu goal `blocked` với mã `queue-failed`.
  */
  async function drive(state: AgentState): Promise<void> {
    const { agent } = state;
    if (!readyToDrive(state)) return;
    if (state.needsCheckpoint) {
      state.needsCheckpoint = false;
      try {
        await ctx.sessions.flush(agent.session);
      } catch (error) {
        ctx.logger.warn(`goal-round-driver: durability checkpoint failed for agent "${agent.id}": ${renderThrown(error)}`);
        disarm(state);
        return;
      }
      if (!readyAfterCheckpoint(state)) return;
    }
    if (state.attempt !== undefined) {
      state.attempt = undefined;
      state.needsCheckpoint = true;
      state.requested = true;
      return;
    }
    const goal = currentGoal(state);
    if (!drivable(goal)) return;
    const subagents = ctx.get("subagents") as SubagentSeam | undefined;
    if (subagents !== undefined) {
      await Promise.race([subagents.waitForChildren(agent), unloading.promise]);
      if (!readyAfterCheckpoint(state)) return;
    }
    if (goal.roundsStarted >= goal.maxGoalRounds) {
      goalsOf(ctx).block(asGoalAgent(agent), goalRef(goal), {
        code: "round-limit",
        message: `Goal reached its configured limit of ${goal.maxGoalRounds} rounds.`,
      });
      return;
    }
    const round = goal.roundsStarted + 1;
    const content = renderGoalRoundPrompt(goal, round);
    const message = createUserMessage({
      content,
      // Kernel chỉ biết bốn loại nguồn của nó; biến thể goal do TA khai cục bộ ⇒ ép tại BIÊN (cùng hình dạng runtime).
      source: { kind: "goal", goalId: goal.id, revision: goal.revision, round } as unknown as MessageSource,
    });
    state.attempt = {
      goalId: goal.id,
      revision: goal.revision,
      round,
      messageId: message.id,
      content,
      phase: "queued",
      cancelled: false,
      stale: false,
    };
    try {
      agent.followup(message);
    } catch (error) {
      state.attempt = undefined;
      ctx.logger.warn(`goal-round-driver: could not queue round ${round} for agent "${agent.id}": ${renderThrown(error)}`);
      const latest = currentGoal(state);
      if (
        latest !== undefined &&
        latest.id === goal.id &&
        latest.revision === goal.revision &&
        latest.phase === "active" &&
        latest.activation === "armed"
      ) {
        goalsOf(ctx).block(asGoalAgent(agent), goalRef(latest), {
          code: "queue-failed",
          message: `Could not queue goal round ${round}: ${renderThrown(error)}`,
        });
      }
    }
  }

  /**
  * Hợp nhất mọi kích thích về MỘT vòng lái tuần tự của riêng agent.
  * Nhận: trạng thái của agent. Trả: không; vòng lặp chạy dưới `ctx.agents.withoutInitiator` (prompt tự động
  *       không được coi là do agent khởi phát), và tự hẹn lại nếu có yêu cầu mới tới trong lúc chạy.
  */
  function requestDrive(state: AgentState): void {
    // Dỡ plugin có thể đua với một kích thích cuối, sau khi hàng rào bước đã đóng ĐỒNG BỘ.
    if (state.stopping) return;
    state.requested = true;
    if (state.run !== undefined) return;
    let run: Promise<void>;
    try {
      run = ctx.agents.withoutInitiator(async () => {
        while (state.requested && !state.stopping) {
          state.requested = false;
          try {
            await drive(state);
          } catch (error) {
            ctx.logger.warn(`goal-round-driver: driver failed for agent "${state.agent.id}": ${renderThrown(error)}`);
            disarm(state);
          }
        }
      });
    } catch (error) {
      ctx.logger.warn(`goal-round-driver: could not start driver for agent "${state.agent.id}": ${renderThrown(error)}`);
      disarm(state);
      return;
    }
    state.run = run;
    const retire = (): void => {
      state.run = undefined;
      if (state.requested && !state.stopping) requestDrive(state);
    };
    run.then(retire, (error: unknown) => {
      ctx.logger.warn(`goal-round-driver: driver task rejected for agent "${state.agent.id}": ${renderThrown(error)}`);
      disarm(state);
      retire();
    });
  }

  ctx.effect(function* () {
    ctx.on("agent/error", ({ agent }) => {
      disarm(stateFor(agent));
    });
    ctx.on("agent/disposed", ({ agent }) => {
      states.delete(agent);
    });
    ctx.on("agent/created", ({ agent }) => {
      const state = stateFor(agent);
      state.attempt = undefined;
      state.competingQueued = false;
      state.needsCheckpoint = false;
      // Kernel khai kiểu trả `undefined` cho sự kiện serial này (KHÔNG phải `void`) — trả đúng như vậy.
      return undefined;
    });
    ctx.on("agent/status", ({ agent, status }) => {
      const state = stateFor(agent);
      if (status !== "idle") return;
      state.competingQueued = false;
      const attempt = state.attempt;
      const goal = currentGoal(state);
      const pause =
        attempt !== undefined &&
        (attempt.phase === "queued" || attempt.phase === "claimed" || attempt.cancelled) &&
        goal !== undefined &&
        goal.phase === "active" &&
        goal.activation === "armed" &&
        attempt.goalId === goal.id &&
        attempt.revision === goal.revision;
      if (pause || attempt?.phase === "queued") {
        // Cả hai vế đều đã ngụ ý `attempt` tồn tại; TypeScript không tự suy ra qua biến boolean `pause`.
        if (attempt !== undefined) {
          state.attempt = undefined;
          try {
            if (attempt.phase === "queued") agent.inbox.remove(attempt.messageId);
            if (pause) goalsOf(ctx).pause(asGoalAgent(agent), goalRef(goal));
          } catch (error) {
            ctx.logger.warn(`goal-round-driver: could not settle cancelled goal round for agent "${agent.id}": ${renderThrown(error)}`);
            disarm(state);
          }
        }
      }
      requestDrive(state);
    });
    (ctx as unknown as GoalEventsSeamLike).on("goal/changed", ({ agent, change }) => {
      const state = stateFor(agent);
      state.needsCheckpoint = true;
      if (change.operation === "pause" && agent.status === "running" && ctx.agents.currentInitiator() !== agent) {
        agent.cancel({ kind: "user" }, { keepInbox: true });
      }
      requestDrive(state);
    });
    ctx.on("agent/inbox/inserted", ({ agent, message }) => {
      if (!agent.inbox.nextTurn.some((candidate) => candidate.id === message.id)) return;
      const state = stateFor(agent);
      const attempt = state.attempt;
      if (attempt !== undefined && sameQueued(message.content, message.source, attempt)) return;
      state.competingQueued = true;
      if (attempt !== undefined && attempt.phase === "queued") attempt.stale = true;
    });
    ctx.on("agent/inbox/claimed", ({ agent, message }) => {
      const attempt = stateFor(agent).attempt;
      if (attempt !== undefined && sameQueued(message.content, message.source, attempt)) attempt.phase = "claimed";
    });
    ctx.on("agent/inbox/discarded", ({ agent, message }) => {
      const attempt = stateFor(agent).attempt;
      if (attempt !== undefined && sameQueued(message.content, message.source, attempt)) attempt.cancelled = true;
    });
    ctx.on("session/event", (session, event) => {
      const agent = ctx.agents.get(session.id);
      if (agent === undefined || agent.session !== session) return;
      const state = stateFor(agent);
      switch (event.type) {
        case "user/message": {
          if (state.attempt !== undefined && event.data.id === state.attempt.messageId) state.attempt.phase = "admitted";
          return;
        }
        case "turn/end": {
          if (event.data.reason.kind === "max-tokens") {
            disarm(state);
            return;
          }
          if (event.data.reason.kind !== "aborted") return;
          const attempt = state.attempt;
          if (attempt !== undefined && (attempt.phase === "claimed" || attempt.phase === "admitted")) attempt.cancelled = true;
          else disarm(state);
          return;
        }
        default: {
          return;
        }
      }
    });

    /**
    * Đóng đường CHẶT TRƯỚC: prompt đã xếp hàng phải vẫn sở hữu ĐÚNG revision còn sống.
    * Nhận: trạng thái agent, nội dung + nguồn của message đang vào bước.
    * Trả: true chỉ khi fiber ACTIVE, không dỡ, đặt chỗ đang ở pha `claimed` và không cũ, bản ghi trùng đầy đủ,
    *       goal còn đúng danh tính + `active` + `armed`, và đây đúng là vòng kế tiếp của `roundsStarted`.
    */
    // ADR 000d (08/11/2026 dev-1): nhận `unknown` — nguồn có thể là `MessageSource` của kernel (KHÔNG có biến thể
    // `goal`) hoặc `GoalRoundSource` khai cục bộ; `goalRoundFields` thu hẹp bên trong.
    function validReservation(state: AgentState, content: readonly ContentBlock[], source: unknown): boolean {
      const attempt = state.attempt;
      const goal = currentGoal(state);
      const round = goalRoundFields(source);
      return (
        ctx.fiber.state === FIBER_ACTIVE &&
        !state.stopping &&
        attempt !== undefined &&
        attempt.phase === "claimed" &&
        !attempt.stale &&
        sameQueued(content, source, attempt) &&
        goal !== undefined &&
        round !== undefined &&
        round.goalId === goal.id &&
        round.revision === goal.revision &&
        goal.phase === "active" &&
        goal.activation === "armed" &&
        round.round === goal.roundsStarted + 1
      );
    }

    ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
      // ADR 000d (08/11/2026 dev-1): `GoalRoundMessage` KHÔNG assignable vào `UserMessage` (kernel không có biến thể
      // `goal` trong hợp nguồn) nên không dùng được type-predicate ở `find`; tìm theo cấu trúc rồi ép MỘT lần tại biên.
      const submitted = messages.find((message) => isGoalRoundSource(message.source)) as GoalRoundMessage | undefined;
      if (submitted === undefined) return next();
      const { content, source } = submitted;
      const state = stateFor(agent);
      let valid = false;
      try {
        valid = validReservation(state, content, source);
      } catch (error) {
        ctx.logger.warn(`goal-round-driver: pre-step check failed for agent "${agent.id}": ${renderThrown(error)}`);
        disarm(state);
      }
      if (!valid) {
        const attempt = state.attempt;
        if (attempt !== undefined && sameRound(source, attempt)) {
          attempt.stale = true;
          state.attempt = undefined;
        }
        restoreOtherClaimed(agent, messages, submitted.id);
        requestDrive(state);
        return { kind: "reject" };
      }
      let decision;
      try {
        decision = await next();
      } catch (error) {
        if (signal.aborted) throw error;
        state.attempt = undefined;
        requestDrive(state);
        throw error;
      }
      if (signal.aborted) {
        if (decision.kind === "enter") restoreOtherClaimed(agent, decision.messages, submitted.id);
        return decision;
      }
      if (decision.kind === "reject") {
        state.attempt = undefined;
        const goal = currentGoal(state);
        if (
          goal !== undefined &&
          goal.id === source.goalId &&
          goal.revision === source.revision &&
          goal.phase === "active" &&
          goal.activation === "armed"
        ) {
          goalsOf(ctx).block(asGoalAgent(agent), goalRef(goal), {
            code: "prompt-rejected",
            message: "Goal round was rejected before entering its step.",
          });
        }
        return decision;
      }
      try {
        valid = validReservation(state, content, source);
      } catch (error) {
        ctx.logger.warn(`goal-round-driver: post-decision check failed for agent "${agent.id}": ${renderThrown(error)}`);
        disarm(state);
        valid = false;
      }
      if (!valid) {
        state.attempt = undefined;
        restoreOtherClaimed(agent, decision.messages, submitted.id);
        requestDrive(state);
        return { kind: "reject" };
      }
      return {
        ...decision,
        startsRequestSeries: true,
      };
    });
    for (const agent of ctx.agents.list()) disarm(stateFor(agent));
    yield async () => {
      unloading.resolve();
      const waits: Promise<unknown>[] = [];
      for (const state of states.values()) {
        state.stopping = true;
        disarm(state);
        const attempt = state.attempt;
        if (attempt !== undefined) {
          attempt.stale = true;
          // `followup` đã giữ đúng agent sống trước khi công bố lượt đã xếp hàng.
          if (state.agent.status === "running") {
            state.agent.cancel({ kind: "parent" });
            waits.push(state.agent.whenIdle());
          }
        }
        if (state.run !== undefined) waits.push(state.run);
      }
      await Promise.allSettled(waits);
      states.clear();
    };
  }, "goal-round-driver lifecycle");
}
