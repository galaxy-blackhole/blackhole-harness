/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Service `ctx.goals`: trạng thái goal CÙNG PHIÊN hướng sự kiện, so-sánh-và-đặt theo revision, và
 *      quyền tự động chạy tiếp (phạm vi tiến trình). Mọi thay đổi đi vào log phiên sở hữu qua ĐÚNG MỘT
 *      sự kiện `goal/change` toàn ảnh chụp; lượt đọc lấy từ phép chiếu `goal` của sổ chiếu phiên.
 *      Viết lại theo hành vi của lib/index.js trong @deepseek-ai/dsh-goal (G4: bảng nguồn ở README.md).
 */

import { randomUUID } from "node:crypto";

import type { Context } from "@deepseek-ai/cordis";
import { HarnessError } from "@deepseek-ai/dsh-llm";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import z from "@deepseek-ai/schemastery";

import { emitAgentEvent } from "./dispatch.ts";
import { goalChangeRef } from "./fold.ts";
import { goalProjectionDefinition } from "./projection.ts";
import { GoalError, GoalId } from "./runtime.ts";
import type {
  Config,
  CreateGoalRequest,
  CreateGoalResult,
  EditGoalRequest,
  GoalActivation,
  GoalActivationChanged,
  GoalAgentLike,
  GoalBlockReason,
  GoalChangeMeta,
  GoalChanged,
  GoalContextSeam,
  GoalPhase,
  GoalProjection,
  GoalRef,
  GoalRuntimeState,
  GoalSessionLike,
  GoalSnapshot,
  GoalView,
  ResolvedConfig,
} from "./types.ts";

/** Ngữ nghĩa `SessionSeq` của `@deepseek-ai/dsh-session`: dấu KIỂU thuần, không có hiệu ứng lúc chạy. */
const SESSION_SEQ = (value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError(`SessionSeq must be a non-negative safe integer, got ${String(value)}`);
  return value;
};

/**
 * Nhìn Context cordis qua chân trời CẤU TRÚC mà service thật sự gọi tới.
 * Nhận: `ctx` — Context của plugin.
 * Trả: cùng thể hiện đó, khai hẹp còn đúng các seam cần dùng.
 */
function seamOf(ctx: Context): GoalContextSeam {
  return ctx as unknown as GoalContextSeam;
}

/**
 * Kiểm một trần vòng do người gọi nhìn thấy.
 * Nhận: `value` — trần cần kiểm.
 * Trả: chính trần đó khi là số nguyên an toàn DƯƠNG.
 */
function resolveMaxGoalRounds(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new GoalError("maxGoalRounds must be a positive safe integer", "GOAL_INVALID_MAX_ROUNDS");
  return value;
}

/**
 * Kiểm và chuẩn hoá mục tiêu tại ranh giới miền.
 * Nhận: `value` — mục tiêu thô.
 * Trả: mục tiêu đã cắt khoảng trắng hai đầu.
 */
function resolveObjective(value: string): string {
  if (typeof value !== "string" || value.trim().length === 0) throw new GoalError("goal objective must be a non-empty string", "GOAL_INVALID_OBJECTIVE");
  return value.trim();
}

/**
 * Vật chất hoá mặc định triển khai rồi kiểm MỘT yêu cầu tạo goal.
 * Nhận: `request` — yêu cầu tạo; `defaultMaxGoalRounds` — trần mặc định của deployment.
 * Trả: `{ objective, maxGoalRounds }` đã kiểm.
 */
function resolveCreateGoal(request: CreateGoalRequest, defaultMaxGoalRounds: number): { objective: string; maxGoalRounds: number } {
  return {
    objective: resolveObjective(request.objective),
    maxGoalRounds: resolveMaxGoalRounds(request.maxGoalRounds ?? defaultMaxGoalRounds),
  };
}

/**
 * Kiểm và TÁCH một lý do chặn do chính sách sở hữu.
 * Nhận: `reason` — lý do thô.
 * Trả: `{ code, message }` mới (message đã cắt khoảng trắng hai đầu).
 */
function resolveBlockReason(reason: GoalBlockReason): GoalBlockReason {
  const record = typeof reason === "object" && reason !== null && !Array.isArray(reason) ? (reason as unknown as Record<string, unknown>) : undefined;
  const code = record?.["code"];
  const message = record?.["message"];
  if (typeof code !== "string" || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(code) || typeof message !== "string" || message.trim().length === 0) throw new GoalError("goal block reason requires a lower-kebab-case code and a non-empty message", "GOAL_INVALID_BLOCK_REASON");
  return {
    code,
    message: message.trim(),
  };
}

/** Service goal (`ctx.goals`) chỉ dựa vào log phiên sở hữu. */
export class GoalService extends TypertRemoteService {
  /** Hai seam phải có trước khi service thức dậy: sổ agent sống + sổ chiếu phiên. */
  static inject = ["agents", "sessionProjections"];

  /** Cấu hình plugin: mặc định trần vòng cho lần tạo bỏ trống trần (nguyên văn bản gốc). */
  static Config = z.object({ defaultMaxGoalRounds: z.number().default(256) });

  /** Mặc định đã phân giải của deployment. */
  private readonly resolved: ResolvedConfig;

  /** Trạng thái phạm vi tiến trình theo từng phiên (không bao giờ ghi bền). */
  private readonly runtimeStates = new WeakMap<object, GoalRuntimeState>();

  /**
   * Đăng ký service `goals`, đơn vị chiếu `goal`, và hai lượt nghe sự kiện của bản gốc.
   * Nhận: `ctx` — Context sở hữu plugin; `config` — cấu hình triển khai (có thể rỗng).
   * Trả: thể hiện service đã cài (cordis dùng ngay sau khi dựng).
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, "goals");
    this.resolved = { defaultMaxGoalRounds: resolveMaxGoalRounds(config.defaultMaxGoalRounds ?? 256) };
    const seam = seamOf(ctx);
    seam.on("agent/created", ({ agent }: { agent: GoalAgentLike }) => {
      this.setActivation(agent.session, "disarmed");
    });
    seam.sessionProjections.register(goalProjectionDefinition);
    seam.on("session/event", (session: GoalSessionLike, event: { readonly type: string; readonly seq: number }) => {
      if (event.type !== "goal/change") return;
      const runtime = this.runtimeState(session);
      const activation = runtime.pendingActivation !== undefined && SESSION_SEQ(runtime.pendingActivation.offset) === event.seq ? runtime.pendingActivation.activation : "disarmed";
      this.setActivation(session, activation);
    });
  }

  /**
   * Đọc goal hiện tại cho ĐÚNG một agent đang sống.
   * Nhận: `agent` — agent sở hữu.
   * Trả: khung nhìn MỚI, hoặc `undefined` khi chưa có goal hiện tại.
   */
  @Remote("get")
  get(agent: GoalAgentLike): GoalView | undefined {
    this.assertLive(agent);
    return this.view(this.state(agent.session), this.runtimeState(agent.session));
  }

  /**
   * Gỡ quyền tự động chạy tiếp (phạm vi tiến trình) mà KHÔNG đổi pha hay revision bền.
   * Nhận: `agent` — agent sở hữu.
   * Trả: khung nhìn MỚI đã disarmed, hoặc `undefined` khi chưa có goal hiện tại.
   */
  disarm(agent: GoalAgentLike): GoalView | undefined {
    this.assertLive(agent);
    this.setActivation(agent.session, "disarmed");
    const runtime = this.runtimeState(agent.session);
    return this.view(this.state(agent.session), runtime);
  }

  /**
   * Tạo VÀ arm một goal. Goal đã `complete` được thay; mọi pha khác phải clear hoặc resume.
   * Nhận: `agent` — agent sở hữu; `request` — mục tiêu và trần vòng tuỳ chọn.
   * Trả: khung nhìn sống của goal vừa tạo.
   */
  create(agent: GoalAgentLike, request: CreateGoalRequest): GoalView {
    const spec = resolveCreateGoal(request, this.resolved.defaultMaxGoalRounds);
    const [state, runtime] = this.prepareMutation(agent);
    const current = state?.goal;
    if (current !== undefined && current.phase !== "complete") throw new GoalError(`goal "${current.id}" already exists with phase "${current.phase}"`, "GOAL_ALREADY_EXISTS");
    const now = Date.now();
    const goal: GoalSnapshot = {
      id: GoalId(`goal-${randomUUID()}`),
      revision: 1,
      objective: spec.objective,
      phase: "active",
      maxGoalRounds: spec.maxGoalRounds,
    };
    return this.commitSnapshot(agent, runtime, "create", goal, 0, now, now, "armed");
  }

  /**
   * Sửa mục tiêu và/hoặc trần vòng mà KHÔNG đổi pha.
   * Nhận: `agent` — agent sở hữu; `ref` — revision hiện tại mong đợi; `request` — ít nhất một trường thay thế.
   * Trả: khung nhìn đã sửa.
   */
  @Remote("edit")
  edit(agent: GoalAgentLike, ref: GoalRef, request: EditGoalRequest): GoalView {
    const [state, runtime] = this.prepareMutation(agent);
    const currentState = this.expectCurrent(state, ref);
    const current = currentState.goal;
    if (request.objective === undefined && request.maxGoalRounds === undefined) throw new GoalError("goal edit requires objective and/or maxGoalRounds", "GOAL_INVALID_EDIT");
    const goal: GoalSnapshot = {
      ...current,
      revision: current.revision + 1,
      ...(request.objective === undefined ? {} : { objective: resolveObjective(request.objective) }),
      ...(request.maxGoalRounds === undefined ? {} : { maxGoalRounds: resolveMaxGoalRounds(request.maxGoalRounds) }),
    };
    return this.commitCurrent(agent, currentState, runtime, "edit", goal, runtime.activation);
  }

  /**
   * Tạm dừng một goal đang `active` và gỡ quyền tự động chạy tiếp.
   * Nhận: `agent` — agent sở hữu; `ref` — revision hiện tại mong đợi.
   * Trả: khung nhìn đã tạm dừng.
   */
  @Remote("pause")
  pause(agent: GoalAgentLike, ref: GoalRef): GoalView {
    return this.transition(agent, ref, "pause", ["active"], "paused", "disarmed");
  }

  /**
   * Chạy tiếp VÀ arm một goal đã dừng, hoặc arm lại goal `active` sau một mốc khởi động phiên,
   * khi ngân sách vòng còn chỗ.
   * Nhận: `agent` — agent sở hữu; `ref` — revision hiện tại mong đợi.
   * Trả: khung nhìn đang `active` và đã arm.
   */
  @Remote("resume")
  resume(agent: GoalAgentLike, ref: GoalRef): GoalView {
    const [state, runtime] = this.prepareMutation(agent);
    const currentState = this.expectCurrent(state, ref);
    const current = currentState.goal;
    const resumable: readonly GoalPhase[] = ["active", "paused", "blocked"];
    if (!resumable.includes(current.phase)) throw this.transitionError(current, "resume", resumable);
    if (current.phase === "active" && runtime.activation === "armed") throw new GoalError(`goal "${current.id}" is already active and armed`, "GOAL_INVALID_TRANSITION");
    if (currentState.roundsStarted >= current.maxGoalRounds) throw new GoalError(`goal "${current.id}" exhausted ${current.maxGoalRounds} goal rounds; increase maxGoalRounds before resuming`, "GOAL_INVALID_TRANSITION");
    return this.commitCurrent(agent, currentState, runtime, "resume", this.withPhase(current, "active"), "armed");
  }

  /**
   * Đánh dấu một goal hiện tại (chưa complete) là complete và gỡ quyền tự động.
   * Nhận: `agent` — agent sở hữu; `ref` — revision hiện tại mong đợi.
   * Trả: khung nhìn đã complete.
   */
  @Remote("complete")
  complete(agent: GoalAgentLike, ref: GoalRef): GoalView {
    return this.transition(agent, ref, "complete", ["active", "paused", "blocked"], "complete", "disarmed");
  }

  /**
   * Đánh dấu một goal đang `active` là `blocked` và gỡ quyền tự động.
   * Nhận: `agent` — agent sở hữu; `ref` — revision hiện tại mong đợi; `reason` — mã ổn định + câu giải thích.
   * Trả: khung nhìn `blocked` kèm lý do bền.
   */
  block(agent: GoalAgentLike, ref: GoalRef, reason: GoalBlockReason): GoalView {
    const [state, runtime] = this.prepareMutation(agent);
    const currentState = this.expectCurrent(state, ref);
    const current = currentState.goal;
    if (current.phase !== "active") throw this.transitionError(current, "block", ["active"]);
    return this.commitCurrent(
      agent,
      currentState,
      runtime,
      "block",
      {
        ...this.withPhase(current, "blocked"),
        blockedReason: resolveBlockReason(reason),
      },
      "disarmed",
    );
  }

  /**
   * Xoá goal hiện tại nhưng GIỮ tombstone bền và lịch sử.
   * Nhận: `agent` — agent sở hữu; `ref` — revision hiện tại mong đợi.
   * Trả: tham chiếu tombstone có revision hơn ảnh chụp bị xoá đúng một.
   */
  @Remote("clear")
  clear(agent: GoalAgentLike, ref: GoalRef): GoalRef {
    const [state, runtime] = this.prepareMutation(agent);
    const currentState = this.expectCurrent(state, ref);
    const current = currentState.goal;
    const tombstone: GoalRef = {
      id: current.id,
      revision: current.revision + 1,
    };
    const change: GoalChangeMeta = {
      kind: "goal/change",
      version: 1,
      operation: "clear",
      cleared: tombstone,
      clearedAt: this.nextMutationTime(currentState),
    };
    this.commit(agent, runtime, change, "disarmed");
    return { ...tombstone };
  }

  /**
   * Phân giải trạng thái bền và trạng thái phạm vi tiến trình cho MỘT lượt thay đổi.
   * Nhận: `agent` — agent sở hữu.
   * Trả: cặp `[phép chiếu hiện tại, trạng thái phạm vi tiến trình]`.
   */
  private prepareMutation(agent: GoalAgentLike): readonly [GoalProjection | null, GoalRuntimeState] {
    this.assertLive(agent);
    return [this.state(agent.session), this.runtimeState(agent.session)];
  }

  /**
   * Từ chối tham chiếu cũ hoặc thiếu.
   * Nhận: `state` — phép chiếu hiện tại (có thể `null`); `ref` — tham chiếu người gọi gửi.
   * Trả: chính `state` khi tham chiếu khớp ĐÚNG goal/revision hiện tại.
   */
  private expectCurrent(state: GoalProjection | null, ref: GoalRef): GoalProjection {
    if (state === null) throw new GoalError("no current goal", "GOAL_NOT_FOUND");
    const current = state.goal;
    if (ref.id !== current.id || ref.revision !== current.revision) throw new GoalError(`stale goal ref "${ref.id}" revision ${ref.revision}; current is "${current.id}" revision ${current.revision}`, "GOAL_STALE_REVISION");
    return state;
  }

  /**
   * Bắt buộc ĐÚNG thể hiện agent đang sống, không tin một id trùng.
   * Nhận: `agent` — agent cần xác nhận.
   * Trả: không; ném khi sổ agent không trả về chính thể hiện đó.
   */
  private assertLive(agent: GoalAgentLike): void {
    if (seamOf(this.ctx).agents.get(agent.id) !== agent) throw new GoalError(`agent "${agent.id}" is not live in this registry`, "GOAL_AGENT_NOT_LIVE");
  }

  /**
   * Đọc phép chiếu bền hiện tại do sổ chiếu phiên duy trì.
   * Nhận: `session` — phiên sở hữu.
   * Trả: goal hiện tại, hoặc `null` khi chưa tạo / sau clear.
   */
  private state(session: GoalSessionLike): GoalProjection | null {
    const state = seamOf(this.ctx).sessionProjections.stateOf(session, "goal");
    if (state === undefined) throw new Error("goal projection is not registered");
    if (state.failure !== null) throw new Error(state.failure);
    return state.current;
  }

  /**
   * Đọc trạng thái phạm vi tiến trình của MỘT phiên (khởi tạo là `disarmed`).
   * Nhận: `session` — phiên sở hữu.
   * Trả: bản ghi trạng thái của phiên đó.
   */
  private runtimeState(session: GoalSessionLike): GoalRuntimeState {
    let runtime = this.runtimeStates.get(session);
    if (runtime !== undefined) return runtime;
    runtime = {
      activation: "disarmed",
      pendingActivation: undefined,
    };
    this.runtimeStates.set(session, runtime);
    return runtime;
  }

  /**
   * Công bố MỘT mốc quyền tự động (phạm vi tiến trình) khi nó THẬT SỰ đổi.
   * Nhận: `session` — phiên vừa đổi; `activation` — quyền mới.
   * Trả: không; lỗi người nghe LAN ra người gọi (đúng `ctx.emit` của kernel).
   */
  private setActivation(session: GoalSessionLike, activation: GoalActivation): void {
    const runtime = this.runtimeState(session);
    if (runtime.activation === activation) return;
    runtime.activation = activation;
    const state = seamOf(this.ctx).sessionProjections.stateOf(session, "goal");
    if (state === undefined) return;
    if (state.failure !== null) return;
    const goal = this.view(state.current, runtime);
    const payload: GoalActivationChanged = {
      sessionId: session.id,
      ...(goal === undefined
        ? {}
        : {
            goal: {
              id: goal.id,
              revision: goal.revision,
              activation: goal.activation,
            },
          }),
    };
    seamOf(this.ctx).emit("goal/activation-changed", payload);
  }

  /**
   * Dựng một revision mới với MỘT pha thay thế.
   * Nhận: `current` — ảnh chụp hiện tại; `phase` — pha kế.
   * Trả: ảnh chụp MỚI (revision +1, bỏ `blockedReason` như bản gốc).
   */
  private withPhase(current: GoalSnapshot, phase: GoalPhase): GoalSnapshot {
    return {
      id: current.id,
      revision: current.revision + 1,
      objective: current.objective,
      phase,
      maxGoalRounds: current.maxGoalRounds,
    };
  }

  /**
   * Chuyển pha dùng chung, đã kiểm hợp lệ.
   * Nhận: agent, tham chiếu mong đợi, động từ, các pha được phép, pha kế, và quyền tự động kế.
   * Trả: khung nhìn sau chuyển.
   */
  private transition(agent: GoalAgentLike, ref: GoalRef, operation: "pause" | "resume" | "complete", allowed: readonly GoalPhase[], phase: GoalPhase, activation: GoalActivation): GoalView {
    const [state, runtime] = this.prepareMutation(agent);
    const currentState = this.expectCurrent(state, ref);
    const current = currentState.goal;
    if (!allowed.includes(current.phase)) throw this.transitionError(current, operation, allowed);
    return this.commitCurrent(agent, currentState, runtime, operation, this.withPhase(current, phase), activation);
  }

  /**
   * Dựng lỗi chuyển pha ổn định.
   * Nhận: ảnh chụp hiện tại, động từ, các pha được phép.
   * Trả: lỗi `GOAL_INVALID_TRANSITION` với thông điệp nguyên văn bản gốc.
   */
  private transitionError(current: GoalSnapshot, operation: string, allowed: readonly GoalPhase[]): HarnessError {
    return new GoalError(`cannot ${operation} goal "${current.id}" from phase "${current.phase}"; expected ${allowed.join(" or ")}`, "GOAL_INVALID_TRANSITION");
  }

  /**
   * Cam kết một thay đổi GIỮ bộ đếm/mốc thời gian dẫn xuất của goal hiện tại.
   * Nhận: agent, phép chiếu hiện tại, trạng thái phạm vi tiến trình, động từ, ảnh chụp kế, quyền tự động kế.
   * Trả: khung nhìn sau cam kết.
   */
  private commitCurrent(agent: GoalAgentLike, state: GoalProjection, runtime: GoalRuntimeState, operation: "edit" | "pause" | "resume" | "complete" | "block", goal: GoalSnapshot, activation: GoalActivation): GoalView {
    return this.commitSnapshot(agent, runtime, operation, goal, state.roundsStarted, state.createdAt, this.nextMutationTime(state), activation);
  }

  /**
   * Kẹp mốc thời gian kế của goal hiện tại khi đồng hồ tường chạy lùi.
   * Nhận: `state` — phép chiếu hiện tại.
   * Trả: `max(now, updatedAt)`.
   */
  private nextMutationTime(state: GoalProjection): number {
    return Math.max(Date.now(), state.updatedAt);
  }

  /**
   * Dựng và cam kết MỘT thay đổi toàn ảnh chụp.
   * Nhận: agent, trạng thái phạm vi tiến trình, động từ, ảnh chụp, bộ đếm vòng, mốc tạo/sửa, quyền tự động kế.
   * Trả: khung nhìn đã ghép các giá trị dẫn xuất.
   */
  private commitSnapshot(agent: GoalAgentLike, runtime: GoalRuntimeState, operation: Exclude<GoalChangeMeta["operation"], "clear">, goal: GoalSnapshot, roundsStarted: number, createdAt: number, updatedAt: number, activation: GoalActivation): GoalView {
    const change: GoalChangeMeta = {
      kind: "goal/change",
      version: 1,
      operation,
      goal,
      roundsStarted,
      createdAt,
      updatedAt,
    };
    this.commit(agent, runtime, change, activation);
    return {
      ...goal,
      roundsStarted,
      createdAt,
      updatedAt,
      activation: runtime.activation,
    };
  }

  /**
   * Cam kết MỘT thay đổi vào log goal và dòng sự kiện sống.
   * Nhận: agent, trạng thái phạm vi tiến trình, thay đổi đã dựng, và quyền tự động kế.
   * Trả: không; phát `goal/changed` phạm vi agent sau khi log đã cam kết.
   */
  private commit(agent: GoalAgentLike, runtime: GoalRuntimeState, change: GoalChangeMeta, activation: GoalActivation): void {
    const ref = goalChangeRef(change);
    const pending = {
      offset: agent.session.seq,
      activation,
    };
    runtime.pendingActivation = pending;
    try {
      const event = agent.session.append("goal/change", change);
      if (SESSION_SEQ(pending.offset) === event.seq) runtime.activation = activation;
    } finally {
      runtime.pendingActivation = undefined;
    }
    const goal = this.view(this.state(agent.session), runtime);
    const notification: GoalChanged = {
      operation: change.operation,
      ref: { ...ref },
      ...(goal === undefined ? {} : { goal }),
    };
    emitAgentEvent(seamOf(this.ctx), agent, "goal/changed", { change: notification });
  }

  /**
   * Dựng một khung nhìn hiện tại ĐÃ TÁCH khỏi trạng thái bền.
   * Nhận: `state` — goal hiện tại (có thể `null`); `runtime` — trạng thái phạm vi tiến trình.
   * Trả: khung nhìn MỚI, hoặc `undefined` khi không có goal hiện tại.
   */
  private view(state: GoalProjection | null, runtime: GoalRuntimeState): GoalView | undefined {
    if (state === null) return undefined;
    return {
      ...state.goal,
      roundsStarted: state.roundsStarted,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt,
      activation: runtime.activation,
    };
  }

  /**
   * Tạo MỘT goal qua ranh giới remote.
   * Nhận: `agent` — agent đang sống phân giải từ danh tính trên dây; `request` — mục tiêu và trần vòng.
   * Trả: `{ ref }` của goal vừa tạo (đúng hình dạng bản gốc).
   */
  @Remote("create")
  remoteExportCreate(agent: GoalAgentLike, request: CreateGoalRequest): CreateGoalResult {
    const view = this.create(agent, request);
    return {
      ref: {
        id: view.id,
        revision: view.revision,
      },
    };
  }
}
