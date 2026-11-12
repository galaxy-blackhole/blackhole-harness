/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Plugin `agentLoop`: dựng các ReactLoopAgent theo scope, công bố chúng qua sổ agent/phiên và
 *      sở hữu chuỗi dọn CÓ THỨ TỰ của chúng — port 1:1 vùng lib/types/index.js (dòng 1299–2022)
 *      của @deepseek-ai/dsh-agent-loop. Từ 11/11/2026 có thêm biến prompt `model_label` (nhãn hiển thị route).
 */

import { randomUUID } from "node:crypto";

import { Service, type Context, type Fiber } from "@deepseek-ai/cordis";
import type { AgentOptions, TurnBoundaryProjection } from "@deepseek-ai/dsh-agent";
import { brandString } from "@deepseek-ai/dsh-brand";
import { errorChain } from "@deepseek-ai/dsh-llm";
import {
  interruptedTurnClosers,
  SessionLogOffset,
  SessionPreparation,
  SessionSeq,
  type Session,
  type SessionEvent,
  type SessionHeader,
  type SessionId,
  type SessionSeedEventState,
} from "@deepseek-ai/dsh-session";
import { SessionPersistenceNotFoundError } from "@deepseek-ai/dsh-session-persistence";
import z from "@deepseek-ai/schemastery";
import { z as zod } from "zod";

import { ReactLoopAgent } from "./agent.ts";
import { DEFAULT_MAX_PARALLEL_TOOL_CALLS } from "./constants.ts";
import { inboxProjectionDefinition } from "./inbox.ts";
import { registerPromptVariables } from "./prompt-variables.ts";
import { persistenceOf, servicesOf } from "./services.ts";

/* ============================================================================
 * Seam CẤU TRÚC của các service kernel (ADR 000d: KHÔNG augment module).
 * Bản gốc lấy các mặt này từ dsh-agent · dsh-session · dsh-session-persistence ·
 * dsh-session-projection · dsh-system-prompt; ở đây chỉ khai đúng phần được gọi.
 * ========================================================================== */

type SessionStartSource = "startup" | "resume" | "clear" | "compact";

interface AgentLike {
  readonly id: string;
}

interface AgentSetupCommitLike {
  commit(): void;
}

type AgentSetupLike = (
  agentCtx: Context,
  agent: AgentLike,
) => AgentSetupCommitLike | Promise<AgentSetupCommitLike | void> | void;

interface CreateAgentOptionsLike {
  readonly sessionId: SessionId;
  readonly parentAgent?: AgentLike;
  readonly meta?: {
    readonly cwd?: string;
    readonly parentSession?: SessionId;
    readonly isSeeded?: boolean;
    readonly origin?: "subagent";
    readonly delegationDepth?: number;
    readonly agentPreset?: string;
  };
  readonly inheritedEventCount?: SessionLogOffset;
  readonly seed?: readonly SessionEvent[];
  readonly agentOptions?: AgentOptions;
  readonly signal?: AbortSignal;
  readonly setup?: AgentSetupLike;
}

interface ResumeAgentOptionsLike {
  readonly resumeSessionId: SessionId;
  readonly parentAgent?: AgentLike;
  readonly agentOptions?: AgentOptions;
  readonly signal?: AbortSignal;
  readonly setup?: AgentSetupLike;
}

interface AgentHandleLike {
  agent: ReactLoopAgent;
  dispose(): Promise<void>;
}

interface AgentFactoryLike {
  createAgent(ownerCtx: Context, options: CreateAgentOptionsLike): Promise<AgentHandleLike>;
  resume(ownerCtx: Context, options: ResumeAgentOptionsLike): Promise<AgentHandleLike>;
}

export interface AgentRegistryLike {
  setFactory(factory: AgentFactoryLike): () => void;
  get(id: SessionId): AgentLike | undefined;
  enter(agent: AgentLike, owner: AgentLike | undefined): () => void;
  announce(agent: AgentLike, source: SessionStartSource, signal?: AbortSignal): Promise<void>;
}

interface PrepareSessionOptionsLike {
  readonly seed?: readonly SessionEvent[];
  readonly meta?: Partial<SessionHeader>;
  readonly inheritedEventCount?: SessionLogOffset;
  readonly eventState?: SessionSeedEventState;
}

export interface SessionStoreLike {
  prepare(id: SessionId, options?: PrepareSessionOptionsLike): Session;
  get(id: SessionId): Session | undefined;
  enter(session: Session): () => void;
  announce(session: Session): void;
}

interface SessionHandleReadResultLike {
  readonly events: readonly SessionEvent[];
  readonly eventState: SessionSeedEventState;
}

interface SessionHandleLike {
  readonly header: SessionHeader;
  readonly inheritedEventCount: SessionLogOffset;
  read(offset?: number, length?: number, options?: { readonly signal?: AbortSignal }): Promise<SessionHandleReadResultLike>;
  append(events: readonly SessionEvent[], options?: { readonly signal?: AbortSignal }): Promise<void>;
  close(): Promise<void>;
}

export interface SessionPersistenceLike {
  create(
    header: SessionHeader,
    options?: { readonly inheritedEventCount?: SessionLogOffset; readonly signal?: AbortSignal },
  ): Promise<SessionHandleLike>;
  open(id: SessionId, access: "read" | "write", options?: { readonly signal?: AbortSignal }): Promise<SessionHandleLike>;
}

interface StoredSession {
  handle: SessionHandleLike;
  storedCount: number;
}

export interface SystemPromptLike {
  variable(
    name: string,
    provider: (context: { readonly agent?: { readonly options: AgentOptions } }) => string | undefined,
  ): () => void;
}

interface SessionProjectionDefinitionLike {
  readonly key: string;
  readonly stateVersion: number;
  readonly stateSchema: unknown;
  readonly init: (...args: never[]) => unknown;
  readonly apply: (state: never, event: never) => unknown;
  readonly wire?: unknown;
}

export interface SessionProjectionsLike {
  register(definition: SessionProjectionDefinitionLike): () => void;
}

type EffectDisposer = () => Promise<void>;
/** Bộ ba promise/định-vị (lib ES2023 của Bun chưa khai kiểu này). */
interface PromiseWithResolvers<T> { readonly promise: Promise<T>; readonly resolve: (value: T) => void; readonly reject: (reason?: unknown) => void; }

interface PreparedAgent {
  readonly agent: ReactLoopAgent;
  readonly signal: AbortSignal;
  publish(source: SessionStartSource): Promise<AgentHandleLike>;
  dispose(): Promise<void>;
}

const INACTIVE_STATES: ReadonlySet<number> = new Set([5, 4, 3]);

/**
 * Hình chiếu HOST của ranh giới lượt/bước agent (NGUYÊN VĂN `turnBoundary`, `stateVersion` 2).
 * Nhận: không (hằng dựng một lần lúc nạp module).
 * Trả: đơn vị chiếu gồm schema trạng thái, `init`, và phép gộp `apply` bốn sự kiện ranh giới.
 */
export const turnBoundaryProjectionDefinition = {
  key: "turnBoundary",
  stateVersion: 2,
  stateSchema: zod.object({
    openTurnStartSeq: zod.number().int().nonnegative().transform(SessionSeq).nullable(),
    lastStepStartSeq: zod.number().int().nonnegative().transform(SessionSeq).nullable(),
    lastStepBoundary: zod
      .object({
        kind: zod.union([zod.literal("start"), zod.literal("end")]),
        seq: zod.number().int().nonnegative().transform(SessionSeq),
      })
      .nullable(),
    lastTurn: zod.number().int().nonnegative(),
  }),
  init: (): TurnBoundaryProjection => ({
    openTurnStartSeq: null,
    lastStepStartSeq: null,
    lastStepBoundary: null,
    lastTurn: 0,
  }),
  apply: (state: TurnBoundaryProjection, event: SessionEvent): TurnBoundaryProjection => {
    switch (event.type) {
      case "turn/start":
        return { ...state, openTurnStartSeq: event.seq, lastTurn: event.data.turn };
      case "turn/end":
        return { ...state, openTurnStartSeq: null };
      case "step/start":
        return { ...state, lastStepStartSeq: event.seq, lastStepBoundary: { kind: "start", seq: event.seq } };
      case "step/end":
        return { ...state, lastStepBoundary: { kind: "end", seq: event.seq } };
      default:
        return state;
    }
  },
};

/**
 * Ném lại MỘT lỗi đã gom như chính nó, hoặc nhiều lỗi thành một `AggregateError`.
 * Nhận: failures — lỗi đã gom; message — thông điệp gộp. Trả: không (luôn ném khi có lỗi).
 * @throws chính lỗi duy nhất, hoặc `AggregateError` khi có từ hai lỗi.
 */
function throwCollectedFailures(failures: readonly unknown[], message: string): void {
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1) throw new AggregateError(failures, message);
}

class FactoryOwnership {
  private readonly fiber: Fiber;
  private accepting: boolean = true;
  private readonly teardown: AbortController = new AbortController();
  private readonly inactive: PromiseWithResolvers<void> = Promise.withResolvers();
  private readonly liveAgents: Set<() => Promise<void>> = new Set();
  private readonly startupTasks: Set<Promise<unknown>> = new Set();

  constructor(fiber: Fiber) {
    this.fiber = fiber;
  }

  get signal(): AbortSignal {
    return this.teardown.signal;
  }

  isActive(): boolean {
    return this.accepting && !INACTIVE_STATES.has(this.fiber.state);
  }

  track(dispose: () => Promise<void>): () => void {
    this.liveAgents.add(dispose);
    return () => {
      this.liveAgents.delete(dispose);
    };
  }

  trackStartup(job: Promise<unknown>): void {
    this.startupTasks.add(job);
    const forget = (): void => {
      this.startupTasks.delete(job);
    };
    job.then(forget, forget);
  }

  trackWrapper(job: Promise<unknown>): void {
    this.trackStartup(job.then(() => void 0, () => void 0));
  }

  async waitWhileActive(job: Promise<unknown>): Promise<void> {
    await Promise.race([job, this.inactive.promise]);
  }

  /**
   * Dọn toàn bộ quyền sở hữu. Nhận: không. Trả: promise khi mọi thứ đã lặng.
   * @throws lỗi duy nhất đã gom, hoặc `AggregateError` `agent loop disposal failed`.
   */
  async dispose(): Promise<void> {
    this.accepting = false;
    this.teardown.abort(new Error("agent loop is not active"));
    this.inactive.resolve();
    const settlements = await Promise.allSettled([...[...this.liveAgents].map((dispose) => dispose()), ...this.startupTasks]);
    const failures: unknown[] = [];
    for (const result of settlements) if (result.status === "rejected") failures.push(result.reason);
    throwCollectedFailures(failures, "agent loop disposal failed");
  }
}

/**
 * Chờ `operation`, hoặc ném lý do của tín hiệu ngay khi nó bị huỷ.
 * Nhận: operation; signal; id. Trả: kết quả của `operation`.
 * @throws lý do của tín hiệu, hoặc `agent "<id>" creation aborted` khi lý do không phải Error.
 */
async function raceAbort<T>(operation: T | Promise<T>, signal: AbortSignal, id: SessionId): Promise<T> {
  const toAbortError = (): Error =>
    signal.reason instanceof Error ? signal.reason : new Error(`agent "${id}" creation aborted`, { cause: signal.reason });
  if (signal.aborted) throw toAbortError();
  const aborted = Promise.withResolvers<never>();
  const listener = (): void => {
    aborted.reject(toAbortError());
  };
  signal.addEventListener("abort", listener, { once: true });
  try {
    return await Promise.race([Promise.resolve(operation), aborted.promise]);
  } finally {
    signal.removeEventListener("abort", listener);
  }
}

/**
 * Bắt đầu một việc huỷ được và nhả giá trị về SAU khi đã huỷ.
 * Nhận: operation; signal; id; releaseAbandoned (tuỳ chọn). Trả: kết quả của `operation`.
 * @throws lý do của tín hiệu, hoặc `agent "<id>" creation aborted` khi lý do không phải Error.
 */
async function raceAbortCall<T>(
  operation: () => Promise<T>,
  signal: AbortSignal,
  id: SessionId,
  releaseAbandoned?: (value: T) => void,
): Promise<T> {
  if (signal.aborted)
    throw signal.reason instanceof Error ? signal.reason : new Error(`agent "${id}" creation aborted`, { cause: signal.reason });
  const pending = Promise.resolve().then(operation);
  try {
    return await raceAbort<T>(pending, signal, id);
  } catch (error) {
    if (signal.aborted && releaseAbandoned !== void 0) pending.then(releaseAbandoned, () => void 0);
    throw error;
  }
}

/**
 * Từ chối một trần token đầu ra không biểu diễn CHÍNH XÁC được trên dây request.
 * Nhận: options. Trả: không. @throws `TypeError` `agent maxTokens must be a positive safe integer`.
 */
function assertAgentOptions(options: AgentOptions): void {
  if (options.maxTokens !== void 0 && (!Number.isSafeInteger(options.maxTokens) || options.maxTokens <= 0))
    throw new TypeError("agent maxTokens must be a positive safe integer");
}

/**
 * Khoá context mà launcher đặt TRƯỚC khi mọi mục Loader mount
 * (`ctx.provide(CONFIGURED_AGENT_IDENTITIES_KEY, identities)`) để chốt danh tính phiên của các
 * agent cấu hình mà không cần khoá config, nhờ vậy overlay đổi tuyến model của row không làm rơi chúng.
 * Nhận: không. Trả: chuỗi khoá `"configuredAgentIdentities"`.
 */
export const CONFIGURED_AGENT_IDENTITIES_KEY = "configuredAgentIdentities";

/**
 * Một danh tính phiên do launcher chọn cho một agent cấu hình. `resume` phân biệt nạp lại lịch sử
 * đã lưu với tạo mới phiên dưới đúng id đó (hai khoá config: `resumeSessionId` và `sessionId`).
 * Nhận: không (kiểu thuần). Trả: không (kiểu thuần).
 */
export interface LauncherAgentIdentity {
  id: SessionId;
  resume: boolean;
}

/**
 * Danh tính do launcher chọn, khoá theo `id` cấu hình của agent.
 * Nhận: không (kiểu thuần). Trả: không (kiểu thuần).
 */
export interface ConfiguredAgentIdentities extends Readonly<Record<string, LauncherAgentIdentity>> {}

/**
 * Áp danh tính do launcher sở hữu lên các agent cấu hình, THAY CẢ HAI khoá danh tính cho mọi mục
 * được launcher nêu tên, để danh tính do config cấp không thể sống cạnh danh tính do launcher cấp.
 * Nhận: agents — các mục agent cấu hình; identities — danh tính theo `id`, hoặc `undefined`.
 * Trả: các mục đã áp danh tính launcher (mảng mới).
 */
function applyLauncherIdentities(
  agents: Config["agents"],
  identities: ConfiguredAgentIdentities | undefined,
): Config["agents"] {
  if (identities === void 0) return agents;
  return agents.map((agent) => {
    const identity = identities[agent.id];
    if (identity === void 0) return agent;
    const { sessionId: _sessionId, resumeSessionId: _resumeSessionId, ...rest } = agent;
    return identity.resume ? { ...rest, resumeSessionId: identity.id } : { ...rest, sessionId: identity.id };
  });
}

/**
 * Từ chối xung đột danh tính TỰ CHỨA trước khi bất kỳ agent cấu hình nào khởi động.
 * Nhận: agents — các mục agent cấu hình. Trả: không.
 * @throws `agent "<id>": sessionId and resumeSessionId are mutually exclusive`, hoặc
 *   `agents "<first>" and "<id>" use duplicate exact session identity "<identity>"`.
 */
function validateConfiguredAgents(agents: readonly Config["agents"][number][]): void {
  const exactIdentities = new Map<SessionId, string>();
  for (const { id, sessionId, resumeSessionId } of agents) {
    const hasResumeId = resumeSessionId !== void 0 && resumeSessionId !== "";
    if (sessionId !== void 0 && hasResumeId)
      throw new Error(`agent "${id}": sessionId and resumeSessionId are mutually exclusive`);
    const exactIdentity = hasResumeId ? resumeSessionId : sessionId;
    if (exactIdentity === void 0) continue;
    const firstId = exactIdentities.get(exactIdentity);
    if (firstId !== void 0)
      throw new Error(`agents "${firstId}" and "${id}" use duplicate exact session identity "${exactIdentity}"`);
    exactIdentities.set(exactIdentity, id);
  }
}

/**
 * Cấu hình plugin agent-loop.
 * Nhận: không (kiểu thuần). Trả: không (kiểu thuần).
 */
export interface Config {
  /**
   * Số lời gọi song song an toàn tối đa đang chạy trong một bước. `1` là tuần tự; bỏ trống thì
   * mặc định {@link DEFAULT_MAX_PARALLEL_TOOL_CALLS}. Bản gốc khai `Volatile<number>` của cosmokit;
   * ở đây khai đúng hình dạng tham chiếu đó theo CẤU TRÚC (không kéo cosmokit vào phụ thuộc).
   */
  maxParallelToolCalls: { get(): number };
  agents: (AgentOptions & {
    id: string;
    sessionId?: SessionId;
    cwd?: string;
    resumeSessionId?: SessionId;
  })[];
}

/**
 * Bộ điều khiển vòng chạy cụ thể kiêm dịch vụ driver.
 * Nhận: không (khai báo lớp). Trả: không (khai báo lớp).
 */
export class AgentLoop extends Service implements AgentFactoryLike {
  static inject: string[] = ["agents", "sessions", "llm", "tools", "systemPrompt", "sessionProjections"];

  static Config = z.object({
    maxParallelToolCalls: z.number().step(1).min(1).default(DEFAULT_MAX_PARALLEL_TOOL_CALLS).volatile(),
    agents: z
      .array(
        z.object({
          id: z.string().required(),
          sessionId: z.string().min(1),
          provider: z.string(),
          model: z.string(),
          reasoningEffort: z.string().min(1),
          maxTokens: z.number().step(1).min(1).max(Number.MAX_SAFE_INTEGER),
          cwd: z.string(),
          resumeSessionId: z.string(),
        }),
      )
      .default([]),
  });

  readonly config: Config;
  private readonly ownership: FactoryOwnership;
  private readonly runtime: { readonly ctx: Context };
  /** Đã cảnh báo thiếu lưu trữ phiên chưa (một lần mỗi tiến trình). */ private warnedNoPersistence = false;

  /**
   * Dựng dịch vụ và đăng ký nó dưới tên `agentLoop`.
   * Nhận: ctx — context cordis sở hữu; config — cấu hình đã kiểm.
   * Trả: thực thể; đồng thời đăng ký hai hình chiếu, cài factory, và khởi động các agent cấu hình.
   * @throws xung đột danh tính cấu hình từ `validateConfiguredAgents`.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "agentLoop");
    this.config = {
      agents: applyLauncherIdentities(
        config.agents,
        ctx.get(CONFIGURED_AGENT_IDENTITIES_KEY) as ConfiguredAgentIdentities | undefined,
      ),
      maxParallelToolCalls: config.maxParallelToolCalls,
    };
    validateConfiguredAgents(this.config.agents);
    // 08/11/2026 (dev-1, theo đề nghị của dev-3): lưu trữ phiên là TUỲ CHỌN nên thiếu nó KHÔNG được chặn boot,
    // nhưng cũng KHÔNG được im lặng — mất lưu bền mà không ai biết là lớp lỗi khó lần.
    // ⚠️ 08/11/2026: KHÔNG kiểm ở ĐÂY. Cordis mount theo thứ tự nên lúc dựng agent-loop, row lưu trữ có thể
    // CHƯA lên ⇒ cảnh báo ở constructor là TÍN HIỆU GIẢ (đã làm tester khoanh nhầm defect). Chỉ cảnh báo ở
    // nơi THẬT SỰ dùng lưu trữ (xem `notePersistenceAbsent`), nơi mà vắng mặt là mất dữ liệu thật.
    const ownership = (this.ownership = new FactoryOwnership(ctx.fiber));
    this.runtime = { ctx };
    ctx.effect(function* () {
      const unregisterTurnBoundary = servicesOf(ctx).sessionProjections.register(turnBoundaryProjectionDefinition);
      yield unregisterTurnBoundary;
      const unregisterInbox = servicesOf(ctx).sessionProjections.register(inboxProjectionDefinition);
      yield unregisterInbox;
      yield () =>
        ownership.dispose().finally(() => {
          unregisterInbox();
          unregisterTurnBoundary();
        });
    }, "agentLoop.transactions()");
    ctx.effect(() => servicesOf(ctx).agents.setFactory(this), "agentLoop.setFactory()");
    registerPromptVariables(servicesOf(ctx).systemPrompt);
    for (const { id, sessionId, cwd, resumeSessionId, ...options } of this.config.agents) {
      const meta = cwd === void 0 ? {} : { cwd };
      if (resumeSessionId === void 0 || resumeSessionId === "") {
        const configuredId = sessionId ?? brandString<SessionId>(`${id}-session-${randomUUID()}`);
        const persistence = ctx.get("sessionPersistence") as SessionPersistenceLike | undefined;
        if (persistence === void 0) {
          const startup = this.create(configuredId, options, meta).then(
            () => void 0,
            (error) => {
              this.reportConfiguredStartupFailure(id, "restore", configuredId, error);
            },
          );
          this.ownership.trackStartup(startup);
        } else {
          const startup = this.restoreOrCreateConfigured(ctx, persistence, configuredId, options, meta).catch((error) => {
            this.reportConfiguredStartupFailure(id, "restore", configuredId, error);
          });
          this.ownership.trackStartup(startup);
        }
        continue;
      }
      ctx.effect(() => {
        return ctx.inject(["sessionPersistence"], (childCtx) => {
          this.resumeWith(ctx, persistenceOf(childCtx), {
            resumeSessionId,
            agentOptions: options,
          }).catch((error) => {
            this.reportConfiguredStartupFailure(id, "resume", resumeSessionId, error);
          });
        }).dispose;
      }, `agentLoop.resume(${id})`);
    }
  }

  /**
   * Báo một lỗi khởi động khai báo ĐÃ ĐƯỢC CHỨA cho các bên tiêu thụ gắn danh tính.
   * Nhận: configId; action — `restore`/`resume`; sessionId; error. Trả: không.
   */
  private reportConfiguredStartupFailure(
    configId: string,
    action: "restore" | "resume",
    sessionId: SessionId,
    error: unknown,
  ): void {
    if (!this.ownership.isActive()) return;
    this.ctx.logger.warn(`agent "${configId}": config-driven ${action} of "${sessionId}" failed: ${errorChain(error)}`);
    const args = ["agent-loop/config-start-failed", { sessionId, error }];
    for (const callback of this.ctx.events.dispatch("emit", args))
      try {
        const returned = callback(...args);
        Promise.resolve(returned).catch((listenerError) => {
          this.ctx.logger.warn(`agent "${configId}": config-start-failed listener rejected: ${errorChain(listenerError)}`);
        });
      } catch (listenerError) {
        this.ctx.logger.warn(`agent "${configId}": config-start-failed listener threw: ${errorChain(listenerError)}`);
      }
  }

  /**
   * Nạp lại danh tính config CHÍNH XÁC đã hiện thực hoá khi remount, hoặc tạo mới ở lần dùng đầu.
   * Nhận: ownerCtx; persistence; sessionId; agentOptions; meta. Trả: promise khi agent đã công bố.
   * @throws lỗi nạp lại không phải `SessionPersistenceNotFoundError`, hoặc lỗi tạo mới.
   */
  private async restoreOrCreateConfigured(
    ownerCtx: Context,
    persistence: SessionPersistenceLike,
    sessionId: SessionId,
    agentOptions: AgentOptions,
    meta: Pick<SessionHeader, "cwd">,
  ): Promise<void> {
    await this.waitForDrainingConfiguredIdentity(ownerCtx, sessionId);
    if (!this.ownership.isActive()) return;
    try {
      await this.resumeWith(ownerCtx, persistence, { resumeSessionId: sessionId, agentOptions });
      return;
    } catch (error) {
      if (!this.ownership.isActive()) return;
      if (!(error instanceof SessionPersistenceNotFoundError)) throw error;
    }
    await this.create(sessionId, agentOptions, meta);
  }

  /**
   * Chờ một vòng đời CÙNG id đang rút xong việc gỡ khỏi sổ.
   * Nhận: ownerCtx; sessionId. Trả: promise khi id đã rời hai sổ, hoặc factory ngừng hoạt động.
   */
  private async waitForDrainingConfiguredIdentity(ownerCtx: Context, sessionId: SessionId): Promise<void> {
    if (servicesOf(ownerCtx).agents.get(sessionId) === void 0 && servicesOf(ownerCtx).sessions.get(sessionId) === void 0)
      return;
    const released = Promise.withResolvers<void>();
    const checkReleased = (): void => {
      if (servicesOf(ownerCtx).agents.get(sessionId) === void 0 && servicesOf(ownerCtx).sessions.get(sessionId) === void 0)
        released.resolve();
    };
    const disposeAgentListener = ownerCtx.on("agent/disposed", () => {
      checkReleased();
    });
    const disposeSessionListener = ownerCtx.on("session/disposed", checkReleased);
    try {
      checkReleased();
      await this.ownership.waitWhileActive(released.promise);
    } finally {
      disposeAgentListener();
      disposeSessionListener();
    }
  }

  /**
   * Dựng driver, scope, và MỘT teardown ngược được memoized cho agent mới; teardown đăng ký với
   * factory và fiber chủ SỚM HƠN công bố, nên unload giữa chừng cuộn ngược mọi thứ.
   * Nhận: ownerCtx; id; options; session; callerSignal; handle; parentAgent.
   * Trả: capability `PreparedAgent` chưa công bố.
   * @throws `agent maxTokens must be a positive safe integer`, `agent loop is not active`, lý do huỷ
   *   của bên gọi, hoặc lỗi dựng driver/teardown.
   */
  private prepare(
    ownerCtx: Context,
    id: SessionId,
    options: AgentOptions,
    session: Session,
    callerSignal: AbortSignal | undefined,
    handle: SessionHandleLike | undefined,
    parentAgent: AgentLike | undefined,
  ): PreparedAgent {
    assertAgentOptions(options);
    ownerCtx.fiber.assertActive();
    if (!this.ownership.isActive()) throw new Error("agent loop is not active");
    if (callerSignal?.aborted)
      throw callerSignal.reason instanceof Error
        ? callerSignal.reason
        : new Error(`agent "${id}" creation aborted`, { cause: callerSignal.reason });
    const loopCtx = this.runtime.ctx;
    const abort = new AbortController();
    const onCallerAbort = (): void => {
      abort.abort(
        callerSignal?.reason instanceof Error
          ? callerSignal.reason
          : new Error(`agent "${id}" creation aborted`, { cause: callerSignal?.reason }),
      );
    };
    const onFactoryTeardown = (): void => {
      abort.abort(this.ownership.signal.reason);
    };
    callerSignal?.addEventListener("abort", onCallerAbort, { once: true });
    this.ownership.signal.addEventListener("abort", onFactoryTeardown, { once: true });
    let machine: ReactLoopAgent | undefined;
    let detachSession: (() => void) | undefined;
    let detachAgent: (() => void) | undefined;
    let disposing: Promise<void> | undefined;
    let publication: PromiseWithResolvers<void> | undefined;
    const machineReady = Promise.withResolvers<void>();
    const teardown = (): Promise<void> =>
      (disposing ??= (async (): Promise<void> => {
        abort.abort(new Error(this.ownership.isActive() ? `agent "${id}" lifecycle disposed` : "agent loop is not active"));
        callerSignal?.removeEventListener("abort", onCallerAbort);
        this.ownership.signal.removeEventListener("abort", onFactoryTeardown);
        const failures: unknown[] = [];
        try {
          if (publication !== void 0) await publication.promise;
          if (machine === void 0) await machineReady.promise;
          if (machine !== void 0) {
            machine.cancel({ kind: "disposed" });
            await machine.whenIdle();
          }
        } catch (error) {
          failures.push(error);
        }
        try {
          await machine?.scope.dispose();
        } catch (error) {
          failures.push(error);
        }
        try {
          await handle?.close();
        } catch (error) {
          failures.push(error);
        }
        try {
          detachAgent?.();
          detachSession?.();
        } finally {
          untrack();
        }
        throwCollectedFailures(failures, `agent "${id}" disposal failed`);
      })());
    let unfollowScope: EffectDisposer | undefined;
    let unfollowOwner: EffectDisposer | undefined;
    const dispose = async (): Promise<void> => {
      try {
        await teardown();
      } finally {
        await Promise.all([unfollowOwner?.(), unfollowScope?.()]);
      }
    };
    const untrack = this.ownership.track(dispose);
    try {
      unfollowOwner = ownerCtx.effect(function* () {
        const created = (machine = new ReactLoopAgent(loopCtx, id, options, session));
        machineReady.resolve();
        if (!INACTIVE_STATES.has(loopCtx.fiber.state))
          unfollowScope = loopCtx.effect(function* () {
            yield created.scope.rawDispose;
            yield () => teardown();
          }, `agentLoop.scope(${id})`);
        yield async () => {
          abort.abort(new Error(`agent "${id}" setup aborted: owner disposed during setup`));
          try {
            await teardown();
          } finally {
            await unfollowScope?.();
          }
        };
      }, `agentLoop.lifecycle(${id})`);
    } catch (error) {
      machineReady.resolve();
      untrack();
      callerSignal?.removeEventListener("abort", onCallerAbort);
      this.ownership.signal.removeEventListener("abort", onFactoryTeardown);
      throw error;
    }
    const assertLive = (): void => {
      if (!abort.signal.aborted) return;
      throw abort.signal.reason instanceof Error ? abort.signal.reason : new Error(String(abort.signal.reason));
    };
    try {
      if (machine === void 0) throw new Error(`agent "${id}" lifecycle did not construct its driver`);
      const agent = machine;
      assertLive();
      return {
        agent,
        signal: abort.signal,
        publish: async (source: SessionStartSource): Promise<AgentHandleLike> => {
          publication = Promise.withResolvers<void>();
          try {
            assertLive();
            detachSession = servicesOf(agent.ctx).sessions.enter(session);
            detachAgent = servicesOf(loopCtx).agents.enter(agent, parentAgent);
            servicesOf(agent.ctx).sessions.announce(session);
            assertLive();
            await servicesOf(loopCtx).agents.announce(agent, source, abort.signal);
            assertLive();
            return { agent, dispose };
          } finally {
            publication.resolve();
            publication = void 0;
          }
        },
        dispose,
      };
    } catch (error) {
      machineReady.resolve();
      dispose().catch(() => {});
      throw error;
    }
  }

  /**
   * Tạo agent và phiên dưới MỘT danh tính do bên gọi cấp, thuộc fiber đang truy cập. Khi có backend
   * lưu trữ, danh tính bền của phiên và mọi seed được lưu TRƯỚC khi công bố.
   * Nhận: id; options; meta — thư mục làm việc phiên mới. Trả: agent đang chạy đã công bố.
   * @throws lỗi tạo phiên/lưu trữ/setup/công bố.
   */
  async create(
    id: SessionId,
    options: AgentOptions = {},
    meta: Pick<SessionHeader, "cwd"> = {},
  ): Promise<ReactLoopAgent> {
    using preparation = SessionPreparation.create(servicesOf(this.runtime.ctx).sessions.prepare(id, { meta }));
    const stored = await this.createStoredSession(preparation.session);
    let prepared: PreparedAgent;
    try {
      prepared = this.prepare(this.ctx, id, options, preparation.session, void 0, stored?.handle, void 0);
    } catch (error) {
      await stored?.handle.close().catch(() => {});
      throw error;
    }
    return (
      await this.initializeAgent(prepared, async () => {
        await this.appendUnstoredSuffix(stored, preparation.session);
        return await prepared.publish("startup");
      })
    ).agent;
  }

  /**
   * Nhận quyền ghi của một phiên mới tinh khi có lưu trữ. KHÔNG nối gì ở đây: seed của constructor
   * (không bao giờ phát lại qua `session/event`) được `appendUnstoredSuffix` ghi tại điểm chốt công
   * bố, nên một bước kiểm/setup lỗi hay bị huỷ chỉ đóng handle chưa hiện thực hoá, không để lại dấu
   * vết trong kho — cùng id có thể được tạo lại.
   * Nhận: session; signal. Trả: handle đã sở hữu và con trỏ, hoặc `undefined` khi không có backend.
   */
  private async createStoredSession(session: Session, signal?: AbortSignal): Promise<StoredSession | undefined> {
    const persistence = this.runtime.ctx.get("sessionPersistence") as SessionPersistenceLike | undefined;
    // 08/11/2026 (dev-1): cảnh báo Ở ĐÂY mới đúng nghĩa — đây là lúc THẬT SỰ cần lưu trữ; vắng mặt nghĩa là phiên
    // này sẽ KHÔNG được ghi ra đĩa. Một lần cho cả tiến trình để không làm ngập log.
    if (persistence === void 0) {
      if (!this.warnedNoPersistence) {
        this.warnedNoPersistence = true;
        console.warn(
          "[agent-loop] khong co service 'sessionPersistence' — phien se KHONG duoc luu ben"
            + " (kiem tra row session-persistence trong composition)",
        );
      }
      return void 0;
    }
    return {
      handle: await persistence.create(session.header, {
        inheritedEventCount: session.inheritedEventCount,
        ...(signal === void 0 ? {} : { signal }),
      }),
      storedCount: 0,
    };
  }

  /**
   * Ghi BỀN các sự kiện phiên đã nối kể từ con trỏ đã lưu cuối. Các lần nối trước công bố (dấu seed
   * của constructor, sự kiện trong cửa sổ setup) không bao giờ phát lại qua `session/event`, nên
   * công bố phải xả chúng qua handle trước khi sự kiện sống chảy vào đó.
   * Nhận: stored; session. Trả: không.
   */
  private async appendUnstoredSuffix(stored: StoredSession | undefined, session: Session): Promise<void> {
    if (stored === void 0) return;
    const suffix = session.snapshotEvents(SessionLogOffset(stored.storedCount));
    if (suffix.length > 0) await stored.handle.append(suffix);
    stored.storedCount += suffix.length;
  }

  /**
   * Tạo một agent thuộc sở hữu trên id phiên do bên gọi cấp.
   * Nhận: ownerCtx; options — danh tính, cha, seed/metadata, tuỳ chọn, setup, huỷ. Trả: handle đã công bố.
   * @throws lỗi dựng phiên/lưu trữ/setup/công bố.
   */
  async createAgent(ownerCtx: Context, options: CreateAgentOptionsLike): Promise<AgentHandleLike> {
    const preparation = SessionPreparation.create(
      servicesOf(this.runtime.ctx).sessions.prepare(options.sessionId, {
        ...(options.seed === void 0 ? {} : { seed: options.seed }),
        ...(options.meta === void 0 ? {} : { meta: options.meta }),
        ...(options.inheritedEventCount === void 0 ? {} : { inheritedEventCount: options.inheritedEventCount }),
      }),
    );
    const published = (async (): Promise<AgentHandleLike> => {
      let stored: StoredSession | undefined;
      try {
        stored =
          options.signal === void 0
            ? await this.createStoredSession(preparation.session)
            : await raceAbortCall(
                () => this.createStoredSession(preparation.session, options.signal),
                options.signal,
                options.sessionId,
                (abandoned) => {
                  abandoned?.handle.close().catch(() => {});
                },
              );
      } catch (error) {
        preparation[Symbol.dispose]();
        throw error;
      }
      return this.setupAndPublish(
        ownerCtx,
        options.sessionId,
        preparation,
        options.agentOptions ?? {},
        options.setup,
        options.signal,
        "startup",
        stored,
        options.parentAgent,
      );
    })();
    this.ownership.trackWrapper(published);
    return published;
  }

  /**
   * Chuẩn bị một Agent quanh một Session đã nhận, chạy setup, rồi công bố nó.
   * Nhận: ownerCtx; id; preparation; agentOptions; setup; signal; source; stored; parentAgent.
   * Trả: handle đã công bố. @throws lỗi setup/công bố.
   */
  private async setupAndPublish(
    ownerCtx: Context,
    id: SessionId,
    preparation: SessionPreparation,
    agentOptions: AgentOptions,
    setup: AgentSetupLike | undefined,
    signal: AbortSignal | undefined,
    source: SessionStartSource,
    stored: StoredSession | undefined,
    parentAgent: AgentLike | undefined,
  ): Promise<AgentHandleLike> {
    using preparationLifetime = preparation;
    const session = preparationLifetime.session;
    let prepared: PreparedAgent;
    try {
      prepared = this.prepare(ownerCtx, id, agentOptions, session, signal, stored?.handle, parentAgent);
    } catch (error) {
      await stored?.handle.close().catch(() => {});
      throw error;
    }
    return await this.initializeAgent(prepared, async () => {
      (await raceAbort<AgentSetupCommitLike | void>(setup?.(prepared.agent.ctx, prepared.agent), prepared.signal, id))?.commit();
      await this.appendUnstoredSuffix(stored, session);
      return await prepared.publish(source);
    });
  }

  /**
   * Chạy phần khởi tạo trong một việc bảo trì của agent, và cuộn ngược khi nó lỗi.
   * Nhận: prepared; initialize. Trả: handle do `initialize` trả về. @throws lỗi của `initialize`.
   */
  private async initializeAgent(
    prepared: PreparedAgent,
    initialize: () => Promise<AgentHandleLike>,
  ): Promise<AgentHandleLike> {
    try {
      return await prepared.agent.runMaintenance(async () => {
        try {
          return await initialize();
        } catch (error) {
          prepared.agent.cancel({ kind: "disposed" }, { keepInbox: true });
          throw error;
        }
      });
    } catch (error) {
      await prepared.dispose().catch(() => {});
      throw error;
    }
  }

  /**
   * Nạp lại một agent thuộc sở hữu từ dịch vụ lưu trữ đã cấu hình.
   * Nhận: ownerCtx; options — danh tính đã lưu, cha, tuỳ chọn, setup, huỷ. Trả: handle đã công bố.
   * @throws `cannot resume: session persistence is not configured (load a dsh-session-persistence backend)`
   *   khi chưa có backend, hoặc lỗi nạp/setup/công bố.
   */
  async resume(ownerCtx: Context, options: ResumeAgentOptionsLike): Promise<AgentHandleLike> {
    const persistence = this.runtime.ctx.get("sessionPersistence") as SessionPersistenceLike | undefined;
    if (persistence === void 0)
      throw new Error("cannot resume: session persistence is not configured (load a dsh-session-persistence backend)");
    return this.resumeWith(ownerCtx, persistence, options);
  }

  /**
   * Nạp lại qua một handle lưu trữ TƯỜNG MINH, dùng cho nhánh cấu hình trì hoãn.
   * Nhận: ownerCtx; persistence; options. Trả: handle đã công bố.
   * @throws lỗi mở/đọc/nạp/setup/công bố, hoặc `agent loop is not active`.
   */
  private resumeWith(
    ownerCtx: Context,
    persistence: SessionPersistenceLike,
    options: ResumeAgentOptionsLike,
  ): Promise<AgentHandleLike> {
    const id = options.resumeSessionId;
    const published = (async (): Promise<AgentHandleLike> => {
      const ownerAbort = new AbortController();
      const unfollowOwner = ownerCtx.effect(
        () => () => {
          ownerAbort.abort(new Error(`agent "${id}" setup aborted: owner disposed during setup`));
        },
        `agentLoop.resume-load(${id})`,
      );
      const fused = AbortSignal.any([
        ...(options.signal === void 0 ? [] : [options.signal]),
        ownerAbort.signal,
        this.ownership.signal,
      ]);
      let handle: SessionHandleLike | undefined;
      let stored: StoredSession | undefined;
      let preparation: SessionPreparation | undefined;
      try {
        try {
          handle = await raceAbortCall(() => persistence.open(id, "write", { signal: fused }), fused, id, (abandoned) => {
            abandoned.close();
          });
          const coldRead = await handle.read(0, void 0, { signal: fused });
          fused.throwIfAborted();
          const persisted = coldRead.events;
          const closers = interruptedTurnClosers(persisted);
          if (closers.length > 0) await handle.append(closers);
          preparation = SessionPreparation.create(
            servicesOf(this.runtime.ctx).sessions.prepare(id, {
              seed: [...persisted, ...closers],
              meta: structuredClone(handle.header),
              inheritedEventCount: handle.inheritedEventCount,
              eventState: coldRead.eventState,
            }),
          );
          stored = { handle, storedCount: persisted.length + closers.length };
          await this.appendUnstoredSuffix(stored, preparation.session);
        } finally {
          await unfollowOwner();
        }
        ownerCtx.fiber.assertActive();
        if (!this.ownership.isActive()) throw new Error("agent loop is not active");
        const owned = stored;
        handle = void 0;
        return await this.setupAndPublish(
          ownerCtx,
          id,
          preparation,
          options.agentOptions ?? {},
          options.setup,
          options.signal,
          "resume",
          owned,
          options.parentAgent,
        );
      } finally {
        preparation?.[Symbol.dispose]();
        await handle?.close().catch(() => {});
      }
    })();
    this.ownership.trackWrapper(published);
    return published;
  }
}