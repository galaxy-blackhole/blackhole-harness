/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Trình điều khiển Agent mặc định trên các lượt xếp hàng và đầu vào ở ranh giới bước: mọi
 *      request đều suy ra từ nhật ký phiên. Viết lại 1:1 theo vùng lib/types/agent.js của
 *      @deepseek-ai/dsh-agent-loop (dòng 709–1291); mọi thông điệp lỗi giữ nguyên tiếng Anh.
 */

import type { Context } from "@deepseek-ai/cordis";
import { agentEvents, assembleContextFor } from "@deepseek-ai/dsh-agent";
import type {
  Agent,
  AgentCancelCause,
  AgentOptions,
  AgentStatus,
  CancelOptions,
  InboxTarget,
  PreStepDecision,
  RequestErrorAction,
} from "@deepseek-ai/dsh-agent";
import {
  LlmError,
  createAssistantMessage,
  createDeveloperMessage,
  errorChain,
  markAgentLoopRequest,
} from "@deepseek-ai/dsh-llm";
import type { GenerateOptions, LlmCallConfig, Message, PreparedLlmCall, StreamChunk, ToolSchema } from "@deepseek-ai/dsh-llm";
import { createScope } from "@deepseek-ai/dsh-scope";
import type { Scope } from "@deepseek-ai/dsh-scope";
import { ToolCallRecovery, canonicalHeader, headerEquals } from "@deepseek-ai/dsh-session";
import type { EpochHeader, RequestContext, Session, SessionId, SessionSeq, TurnEndReason, UserMessage } from "@deepseek-ai/dsh-session";
import { joinContextSections, renderContextSections, renderPrompt } from "@deepseek-ai/dsh-system-prompt";
import type { AssembleContext, PromptAssembly } from "@deepseek-ai/dsh-system-prompt";
import { assertNever, deepFreeze } from "@deepseek-ai/dsh-util-values";
import { ReactLoopInbox } from "./inbox.ts";
import { AssistantStreamAttempt } from "./assistant-stream.ts";
import { RuntimeContextProjection, SystemPromptProjection } from "./runtime-context.ts";
import { executeToolCalls } from "./tool-calls.ts";

/* ============================================================================
 * Hình dạng theo CẤU TRÚC của bốn service vòng chạy trên Context cordis.
 * ADR 000d: KHÔNG augment module, nên mỗi service chỉ khai đúng phần được gọi.
 * ========================================================================== */

/**
 * Trạng thái đơn vị chiếu turnBoundary mà vòng chạy đọc — chỉ trường lastTurn.
 */
interface TurnBoundaryState {
  /** Lượt cuối đã đóng (hoặc đang mở) trong nhật ký phiên. */
  readonly lastTurn: number;
}

/** Seam sổ chiếu phiên (ctx.sessionProjections) — chỉ phương thức vòng chạy dùng. */
interface SessionProjectionsSeam {
  /**
   * Đọc trạng thái đã gộp của một đơn vị chiếu tại một phiên.
   * Nhận: session — phiên cần đọc; key — khoá đơn vị chiếu.
   * Trả: trạng thái đã gộp, hoặc undefined khi đơn vị chiếu không hoạt động.
   */
  stateOf(session: Session, key: string): TurnBoundaryState | undefined;
}

/** Seam sổ lắp prompt (ctx.systemPrompt) — chỉ hai phương thức vòng chạy dùng. */
interface SystemPromptSeam {
  /**
   * Lắp prompt cho một bước model.
   * Nhận: context — ngữ cảnh lắp (scope và tín hiệu của lượt).
   * Trả: bản lắp sau waterfall.
   */
  assemble(context: AssembleContext): Promise<PromptAssembly>;
  /**
   * Làm mới các dòng runtime context của một bản lắp đã nhận.
   * Nhận: assembly — bản lắp đã nhận; context — ngữ cảnh hiện hành.
   * Trả: bản lắp có chữ ngữ cảnh runtime do provider hiện hành cấp.
   */
  refreshContext(assembly: PromptAssembly, context?: AssembleContext): PromptAssembly;
}

/** Seam sổ LLM (ctx.llm) — chỉ hai phương thức vòng chạy dùng. */
interface LlmServiceSeam {
  /**
   * Giải một cấu hình request và gắn nó với adapter đã đăng ký.
   * Nhận: config — cấu hình đề xuất; signal — tín hiệu huỷ.
   * Trả: call đã chuẩn bị (cấu hình, chính sách thử lại, năng lực tuyến).
   */
  prepareCall(config: LlmCallConfig, signal?: AbortSignal): Promise<PreparedLlmCall>;
  /**
   * Phát một request model thành luồng chunk.
   * Nhận: options — request đã lắp đầy đủ.
   * Trả: luồng chunk của adapter.
   */
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}

/** Seam sổ agent (ctx.agents) — chỉ phép chạy dưới một initiator. */
interface AgentRegistrySeam {
  /**
   * Chạy một phép dưới đúng Agent làm initiator của tiến trình.
   * Nhận: agent — initiator; operation — phép cần chạy.
   * Trả: đúng giá trị (hoặc Promise) mà operation trả.
   */
  withInitiator<T>(agent: Agent, operation: () => T): T;
}

/** Bốn service mà vòng chạy gọi trên Context, khai theo CẤU TRÚC. */
interface AgentLoopServices {
  /** Sổ chiếu phiên. */
  readonly sessionProjections: SessionProjectionsSeam;
  /** Sổ lắp prompt. */
  readonly systemPrompt: SystemPromptSeam;
  /** Sổ LLM. */
  readonly llm: LlmServiceSeam;
  /** Sổ agent. */
  readonly agents: AgentRegistrySeam;
}

/**
 * Bộ phát hợp nhất của vòng chạy, khai theo CẤU TRÚC: các sự kiện agent/pre-step,
 * agent/request, agent/request-error, agent/turn-stopping và agent/assistant-stream do
 * vùng ./plugin.ts khai báo, nên ở đây chỉ ràng buộc tên chuỗi + payload record (ADR 000d).
 */
interface AgentLoopDispatch {
  /**
   * Phát bắn-và-quên trong scope agent.
   * Nhận: name — tên sự kiện; payload — các trường payload (agent được chèn).
   * Trả: không.
   */
  emit(name: string, payload: Record<string, unknown>): void;
  /**
   * Phát serial theo thứ tự trong scope agent.
   * Nhận: name — tên sự kiện; payload — các trường payload.
   * Trả: kết quả chuỗi serial.
   */
  serial(name: string, payload: Record<string, unknown>): Promise<unknown>;
  /**
   * Phát waterfall trong scope agent.
   * Nhận: name — tên sự kiện; payload — các trường payload; rest — các tham số sau payload
   * (phần tử cuối là next).
   * Trả: kết quả đã hợp của waterfall.
   */
  waterfall(name: string, payload: Record<string, unknown>, ...rest: unknown[]): unknown;
}

/** Pha RẢNH: không có driver hay việc bảo trì nào đang chạy. */
interface IdlePhase {
  readonly kind: "idle";
  /** Lượt cuối đã biết, để lượt kế tiếp đánh số đúng. */
  readonly lastTurn: number;
}

/** Pha BẢO TRÌ: một việc không phải lượt đang giữ agent. */
interface MaintenancePhase {
  readonly kind: "maintenance";
  /** Tín hiệu huỷ do cancel() điều khiển. */
  readonly abort: AbortController;
  /** Lượt cuối đã biết. */
  readonly lastTurn: number;
  /** Có lời đánh thức bị chặn lại chờ việc bảo trì xong hay không. */
  wakeRequested: boolean;
}

/** Pha CHẠY: driver đang sở hữu một lượt/bước. */
interface RunningPhase {
  readonly kind: "running";
  /** Tín hiệu huỷ của lượt hiện tại; đổi mới giữa các lượt. */
  abort: AbortController;
  /** Số lượt đang mở. */
  turn: number;
  /** Số bước đã mở trong lượt. */
  step: number;
  /** Có lời đánh thức bị chặn lại chờ lượt hiện tại đóng hay không. */
  wakeRequested: boolean;
}

/** Ba pha vòng đời mà driver chuyển qua; chỉ pha rảnh mới được mở việc mới. */
type AgentPhase = IdlePhase | MaintenancePhase | RunningPhase;

/** Quyết định từ chối bước của waterfall agent/pre-step. */
interface PreStepReject {
  readonly kind: "reject";
}

/** Quyết định vào bước, kèm bản lắp prompt đã nhận cho bước đó. */
interface EnterStepDecision {
  readonly kind: "enter";
  /** Thông điệp vào bước này (đã chọn từ thư chờ). */
  readonly messages: readonly UserMessage[];
  /** Mở một chuỗi model RIÊNG trước loạt đã nhận của bước này. */
  readonly startsRequestSeries?: true;
  /** Bản lắp prompt của bước — dùng lại cho mọi lần thử request. */
  readonly assembly: PromptAssembly;
}

/** Kết cục của một bước khi nó tự đóng lượt; null nghĩa là lượt còn chạy tiếp. */
type StepEnd = { readonly kind: "completed" } | { readonly kind: "max-tokens" };

/** Cặp cấu hình/call đã chuẩn bị mà một lần thử request dùng. */
interface PreparedRequest {
  /** Cấu hình đã cam kết cho lần thử này. */
  readonly config: LlmCallConfig;
  /** Call đã gắn adapter; vắng khi tuyến chưa có adapter (NO_ADAPTER). */
  readonly preparedCall?: PreparedLlmCall;
}

/** Vị trí lượt/bước trong nhật ký phiên. */
interface StepPosition {
  /** Lượt sở hữu. */
  readonly turn: number;
  /** Bước trong lượt. */
  readonly step: number;
}

/**
 * Bỏ các giá trị do adapter sinh ra trước khi plugin đề xuất cấu hình request kế tiếp.
 * Nhận: header — đầu mục request đang hiệu lực trong nhật ký.
 * Trả: cấu hình của đầu mục, đã bỏ reasoningEffort/maxTokens nếu chúng do adapter điền.
 */
export function requestProposal(header: EpochHeader): LlmCallConfig {
  if (header.adapterDefaults === undefined) return header.config;
  const proposal: LlmCallConfig = { ...header.config };
  if (header.adapterDefaults.reasoningEffort === true) delete proposal.reasoningEffort;
  if (header.adapterDefaults.maxTokens === true) delete proposal.maxTokens;
  return proposal;
}

/**
 * Đọc nguyên nhân mà cancel() đã truyền khi huỷ một tín hiệu do vòng chạy sở hữu, chỉ
 * sao các trường mà turn/end ghi lại. Lý do SỐNG vẫn là vật của bên gọi, và fetch của
 * Node gán một stack lên nó mà Session.append sẽ ghi log hoặc từ chối vì JSON không chứa được.
 * Nhận: signal — tín hiệu lượt hoặc bảo trì do vòng chạy này sở hữu.
 * Trả: nguyên nhân đã sao, hoặc undefined khi tín hiệu còn sống.
 */
export function abortedCancelCause(signal: AbortSignal): AgentCancelCause | undefined {
  if (!signal.aborted) return undefined;
  const cause: AgentCancelCause = signal.reason;
  switch (cause.kind) {
    case "user":
    case "parent":
    case "disposed":
      return { kind: cause.kind };
    case "hook":
      return {
        kind: "hook",
        reason: cause.reason,
      };
    /* v8 ignore next -- cancel accepts the closed AgentCancelCause union */
    default:
      return assertNever(cause);
  }
}

/**
 * Điều khiển MỘT phiên qua các ranh giới lượt và bước.
 * Driver này không giữ lịch sử hội thoại: mọi request được dựng lại từ nhật ký phiên, nên
 * phép nối thêm và biên dịch lại của plugin không thể lệch với thứ model đã thấy.
 * Nhận: (constructor) loopCtx · id · options · session — xem JSDoc của constructor.
 * Trả: thực thể điều khiển phiên, thoả hợp đồng Agent của kernel.
 */
export class ReactLoopAgent implements Agent {
  /** Context vòng chạy (dịch vụ kernel nhìn qua seam CẤU TRÚC). */
  private readonly loopCtx: Context;
  /** Danh tính phiên do agent điều khiển. */
  readonly id: SessionId;
  /** Tuyến và model mà request của agent này dùng. */
  readonly options: AgentOptions;
  /** Phiên đang sống; nhật ký của nó là nguồn sự thật bền. */
  readonly session: Session;
  /** Thư chờ do driver sở hữu, đọc/ghi qua projection bền. */
  readonly inbox: ReactLoopInbox;
  /** Pha vòng đời hiện tại. */
  private phase: AgentPhase;
  /** Hoạt động hiện tại của cả agent (driver hoặc việc bảo trì). */
  private activityDone: Promise<void> = Promise.resolve();
  /** Ranh giới đăng ký theo scope agent; chủ sở hữu vòng đời gỡ nó sau khi driver thoát. */
  readonly scope: Scope;
  /** Context theo scope agent — nơi mọi đăng ký của agent sống và được gỡ cùng agent. */
  readonly ctx: Context;
  /** Bộ phát hợp nhất, dựng MỘT lần trong constructor để đường nóng không cấp phát. */
  private readonly dispatch: AgentLoopDispatch;
  /** Vòng lặp này đã ghi mốc request đầu tiên / nạp lại của nó chưa. */
  private requestHeaderLogged: boolean = false;
  /** Thế hệ surface tại lúc gắn, hoặc tại request đã dựng trước đó. */
  private requestSurfaceGeneration: number;
  /** Ảnh chụp runtime context của phiên này. */
  private readonly runtimeContext: RuntimeContextProjection;
  /** Phiên bản cục bộ tiến trình của các frame assistant cho phiên đang gắn. */
  private assistantStreamRevision: number = 0;
  /** Bộ đếm lần thử assistant trong cùng vòng đời Agent. */
  private assistantAttemptCounter: number = 0;
  /** Quyết định prompt nào vào surface và vào lúc nào. */
  private readonly systemPrompt: SystemPromptProjection;
  /** Các danh tính ĐÃ đóng băng bởi vòng chạy này; weak reference không giữ lịch sử đã bị thay. */
  private readonly frozenMessages: WeakSet<Message> = new WeakSet<Message>();
  /**
   * Dựng driver cho MỘT phiên và đăng ký scope agent của nó.
   * Nhận: loopCtx — context của plugin vòng chạy; id — danh tính phiên; options — tuyến/model;
   * session — phiên đang sống.
   * Trả: thực thể đã sẵn sàng nhận đầu vào.
   */
  constructor(loopCtx: Context, id: SessionId, options: AgentOptions, session: Session) {
    this.loopCtx = loopCtx;
    this.id = id;
    this.options = options;
    this.session = session;
    this.requestSurfaceGeneration = session.surface.contentGeneration;
    this.dispatch = agentEvents(loopCtx, this) as unknown as AgentLoopDispatch;
    this.scope = createScope(loopCtx, this);
    this.ctx = this.scope.ctx;
    // Thư chờ dùng projection của context THEO SCOPE (bản gốc truyền this.ctx.sessionProjections).
    const scopedServices = this.ctx as unknown as AgentLoopServices;
    this.inbox = new ReactLoopInbox(
      scopedServices.sessionProjections as unknown as ConstructorParameters<typeof ReactLoopInbox>[0],
      session,
      this.dispatch as unknown as ConstructorParameters<typeof ReactLoopInbox>[2],
    );
    /* v8 ignore next -- the loop registers its own turnBoundary unit, so the key is always present */
    const lastTurn = this.services.sessionProjections.stateOf(session, "turnBoundary")?.lastTurn ?? 0;
    this.phase = {
      kind: "idle",
      lastTurn,
    };
    this.runtimeContext = new RuntimeContextProjection(this.ctx, session);
    this.systemPrompt = new SystemPromptProjection(session);
  }

  /** Context vòng chạy nhìn qua ĐÚNG bốn service mà driver gọi (ADR 000d: khai theo CẤU TRÚC). */
  private get services(): AgentLoopServices {
    return this.loopCtx as unknown as AgentLoopServices;
  }

  /**
   * Trạng thái vòng đời công khai: bảo trì vẫn tính là idle, chỉ driver mới là running.
   * Nhận: không.
   * Trả: trạng thái công khai hiện tại.
   */
  get status(): AgentStatus {
    return this.phase.kind === "idle" || this.phase.kind === "maintenance" ? "idle" : "running";
  }

  /**
   * Cam kết một pha và phát chuyển tiếp trạng thái nhìn thấy được của nó.
   * Nhận: next — pha kế tiếp.
   * Trả: không; chỉ phát agent/status khi trạng thái công khai ĐỔI.
   */
  private setPhase(next: AgentPhase): void {
    const previousStatus = this.status;
    this.phase = next;
    const status = this.status;
    if (status !== previousStatus) this.dispatch.emit("agent/status", { status });
  }

  /**
   * Định tuyến đầu vào đã có danh tính vào một ranh giới thư chờ, tuỳ chọn đánh thức driver.
   * Đầu vào đánh thức gửi SAU khi đã huỷ được xếp cho lượt kế tiếp: lượt đang bị huỷ không
   * được nhận thêm việc, nhưng việc đó chạy khi hoạt động đã huỷ lặng xuống.
   * Nhận: message — thông điệp; target — ranh giới ưu tiên; wakeup — có được đánh thức.
   * Trả: không.
   */
  send(message: UserMessage, target: InboxTarget, wakeup: boolean): void {
    const wakingAfterAbort = wakeup && this.phase.kind !== "idle" && this.phase.abort.signal.aborted;
    const resolvedTarget: InboxTarget = wakingAfterAbort ? "next-turn" : target;
    this.inbox.splice(resolvedTarget, Infinity, 0, [message]);
    if (wakeup) this.wakeDriver(wakingAfterAbort);
  }

  /**
   * Xếp một lượt tiếp nối thường và đánh thức driver.
   * Nhận: input — thông điệp của lượt đó.
   * Trả: không.
   */
  followup(input: UserMessage): void {
    this.send(input, "next-turn", true);
  }

  /**
   * Gửi chỉ đạo cho bước gần nhất.
   * Nhận: input — thông điệp chỉ đạo.
   * Trả: không.
   */
  steer(input: UserMessage): void {
    this.send(input, "next-step", true);
  }

  /**
   * Xếp ngữ cảnh hướng model cho bước kế tiếp mà KHÔNG đánh thức driver.
   * Nhận: input — ngữ cảnh cần chèn.
   * Trả: không.
   */
  inject(input: UserMessage): void {
    this.send(input, "next-step", false);
  }

  /**
   * Xoá việc đang chờ — trừ khi keepInbox — và huỷ lượt đang chạy.
   * Nhận: cause — ý định của bên gọi; options — tuỳ chọn huỷ.
   * Trả: không; ở pha rảnh thì huỷ là no-op và không trang bị cho việc sau.
   */
  cancel(cause: AgentCancelCause, options: CancelOptions = {}): void {
    if (!options.keepInbox) {
      this.inbox.clear();
      if (this.phase.kind !== "idle") this.phase.wakeRequested = false;
    }
    if (this.phase.kind !== "idle") this.phase.abort.abort(cause);
  }

  /**
   * Chạy một việc bảo trì KHÔNG phải lượt từ pha rảnh thật.
   * Nhận: job — việc nhận tín hiệu huỷ của agent.
   * Trả: promise của chính việc đó, giữ nguyên kết cục.
   * @throws khi đã có việc đang hoạt động (lượt hoặc bảo trì khác).
   */
  runMaintenance<T>(job: (signal: AbortSignal) => Promise<T>): Promise<T> {
    if (this.phase.kind !== "idle") throw new Error(`agent "${this.id}" already has active work`);
    const done = Promise.withResolvers<void>();
    const maintenance: MaintenancePhase = {
      kind: "maintenance",
      abort: new AbortController(),
      lastTurn: this.phase.lastTurn,
      wakeRequested: false,
    };
    this.setPhase(maintenance);
    this.activityDone = done.promise;
    return (async () => {
      try {
        return await job(maintenance.abort.signal);
      } finally {
        this.setPhase({
          kind: "idle",
          lastTurn: maintenance.lastTurn,
        });
        if (abortedCancelCause(maintenance.abort.signal)?.kind !== "disposed" && maintenance.wakeRequested && this.inbox.hasPending) this.wakeDriver();
        done.resolve();
      }
    })();
  }

  /**
   * Mở một driver, hoặc chặn lời đánh thức lại sau việc bảo trì / một hoạt động đã bị huỷ.
   * Lời đánh thức gửi lúc rảnh LUÔN mở ranh giới lượt của nó, kể cả khi thông điệp đã bị xoá;
   * chỉ lời đánh thức đã chặn rồi phát lại mới bị bỏ khi hàng đợi không còn giữ nó.
   * Nhận: wakeAfterAbort — phân loại của send(), chụp TRƯỚC khi chèn vào thư chờ để một
   * lần cancel() tái nhập không thể phân loại lại.
   * Trả: không.
   */
  private wakeDriver(wakeAfterAbort: boolean = false): void {
    if (this.phase.kind !== "idle") {
      if (abortedCancelCause(this.phase.abort.signal)?.kind !== "disposed" && (this.phase.kind === "maintenance" || wakeAfterAbort)) this.phase.wakeRequested = true;
      return;
    }
    const driver = Promise.withResolvers<void>();
    this.activityDone = driver.promise;
    this.setPhase({
      kind: "running",
      abort: new AbortController(),
      turn: this.phase.lastTurn,
      step: 0,
      wakeRequested: false,
    });
    this.services.agents.withInitiator(this, () => this.kick()).then(driver.resolve, driver.reject);
  }

  /**
   * Chờ tới khi hoạt động hiện tại của cả agent lặng hẳn.
   * Nhận: không.
   * Trả: promise kết thúc khi không còn driver hay việc bảo trì nào; nó theo cả công việc thay thế
   * được mở trước khi driver đang quan sát nghỉ.
   */
  async whenIdle(): Promise<void> {
    let activity: Promise<void>;
    do await (activity = this.activityDone);
    while (activity !== this.activityDone);
  }

  /**
   * Báo MỘT hỏng hóc tại ranh giới sống của nó, rồi giữ lại để driver bao lỗi.
   * Nhận: error — lỗi cần báo.
   * Trả: không trả — luôn ném lại error.
   * @throws luôn ném lại đúng error sau khi đã phát agent/error.
   */
  private throwError(error: unknown): never {
    const turn = this.phase.kind === "running" ? this.phase.turn : this.phase.lastTurn;
    const step = this.phase.kind === "running" ? this.phase.step : 0;
    this.dispatch.emit("agent/error", { turn, step, error });
    throw error;
  }

  /**
   * Vòng driver: chạy các lượt liên tiếp cho tới khi không còn việc đang chờ. Nhận: không. Trả: promise kết thúc khi driver đóng; lỗi của lượt đã được báo và bao lại.
   */
  private async kick(): Promise<void> {
    try {
      while (await this.turn());
    } catch (_error) {} finally {
      /* v8 ignore next -- kick owns a running phase until this driver boundary */
      if (this.phase.kind === "running") {
        const { turn, wakeRequested } = this.phase;
        this.setPhase({
          kind: "idle",
          lastTurn: turn,
        });
        if (wakeRequested && this.inbox.hasPending) this.wakeDriver();
      }
    }
  }

  /**
   * Lắp prompt và xin quyết định cho MỘT bước trước khi claim thông điệp của nó.
   * Nhận: target — ranh giới thư chờ sẽ claim; position — lượt/bước sẽ sở hữu.
   * Trả: quyết định từ chối, hoặc quyết định vào bước kèm bản lắp prompt đã nhận.
   * @throws khi gọi ngoài pha chạy, hoặc khi tín hiệu của lượt đã bị huỷ.
   */
  private async preStep(target: InboxTarget, position: StepPosition): Promise<PreStepReject | EnterStepDecision> {
    /* v8 ignore next -- private callers establish the running phase before proposing a step */
    if (this.phase.kind !== "running") throw new Error(`agent "${this.id}": pre-step outside running phase`);
    const signal = this.phase.abort.signal;
    const claimed = this.inbox.claim(target, position.turn);
    const assembly = await this.services.systemPrompt.assemble(assembleContextFor(this, signal));
    signal.throwIfAborted();
    const decision = (await this.dispatch.waterfall(
      "agent/pre-step",
      {
        messages: claimed,
        ...position,
        signal,
      },
      () => {
        const sections = renderContextSections(assembly);
        const context = this.runtimeContext.project(joinContextSections(sections), sections);
        return Promise.resolve({
          kind: "enter",
          messages: context === undefined ? claimed : [...claimed, context],
        });
      },
    )) as PreStepDecision;
    signal.throwIfAborted();
    if (decision.kind === "reject") return decision;
    return { ...decision, assembly };
  }

  /**
   * Kiểm xem bộ schema tool đã lắp có KHÁC với đầu mục request đã ghi log hay không.
   * Nhận: tools — schema tool của bản lắp hiện tại.
   * Trả: true khi đã có đầu mục nền và schema khác nó; false khi chưa có đầu mục nào.
   */
  private toolsChanged(tools: readonly ToolSchema[]): boolean {
    const baseline = this.session.requestHeader();
    if (baseline === undefined) return false;
    return !headerEquals(
      baseline,
      canonicalHeader({
        ...baseline,
        tools: [...tools],
      }),
    );
  }

  /**
   * Mở MỘT lượt trước khi claim bước đầu tiên của nó được đề xuất.
   * Nhận: không.
   * Trả: true khi còn việc đang chờ để mở lượt kế tiếp, false khi driver nên đóng.
   * @throws khi gọi ngoài pha chạy, khi nhật ký phiên từ chối append, hoặc khi bước hỏng.
   */
  private async turn(): Promise<boolean> {
    if (this.phase.kind !== "running") this.throwError(new Error(`agent "${this.id}": turn without driver reservation`));
    const phase: RunningPhase = this.phase;
    const { signal } = phase.abort;
    signal.throwIfAborted();
    const turn = phase.turn + 1;
    try {
      this.session.append("turn/start", { turn });
    } catch (error) {
      this.throwError(error);
    }
    phase.turn = turn;
    let turnEnds: TurnEndReason | null = null;
    let target: InboxTarget = "next-turn";
    try {
      while (true) {
        signal.throwIfAborted();
        const step = phase.step + 1;
        const decision = await this.preStep(target, { turn, step });
        if (decision.kind === "reject") {
          turnEnds = { kind: "blocked" };
          return false;
        }
        if (turnEnds && decision.messages.length === 0) break;
        if (phase.step === 0 && decision.messages.length === 0) {
          turnEnds = { kind: "completed" };
          return false;
        }
        signal.throwIfAborted();
        this.session.append("step/start", { turn, step });
        phase.step = step;
        const toolRecovery = new ToolCallRecovery();
        const stopRecovery = this.ctx.on("session/event", (session, event) => {
          if (session === this.session) toolRecovery.observe(event);
        });
        try {
          const stepEnd = await this.step(decision);
          if (turnEnds === null || turnEnds.kind !== "max-tokens") turnEnds = stepEnd;
        } catch (error) {
          try {
            for (const event of toolRecovery.results())
              this.session.append("tool/result", event.data, {
                surfaceOp: "append",
                ...(event.sourceEventSeqs === undefined ? {} : { sourceEventSeqs: event.sourceEventSeqs }),
              });
          } catch (recoveryError) {
            throw new AggregateError([error, recoveryError], "Step failed and its pending tool results could not be recorded", { cause: error });
          }
          throw error;
        } finally {
          stopRecovery();
          this.session.append("step/end", { turn, step });
        }
        signal.throwIfAborted();
        if (turnEnds && this.inbox.nextStep.length === 0) {
          await this.dispatch.serial("agent/turn-stopping", { turn, signal });
          signal.throwIfAborted();
        }
        if (turnEnds && this.inbox.nextStep.length === 0) break;
        target = "next-step";
      }
    } catch (error) {
      const cause = abortedCancelCause(signal);
      if (cause !== undefined) {
        turnEnds = {
          kind: "aborted",
          reason: cause,
        };
        throw error;
      }
      turnEnds = {
        kind: "error",
        error:
          error instanceof LlmError
            ? error.failure
            : {
                message: errorChain(error),
                code: "UNKNOWN",
              },
      };
      this.throwError(error);
    } finally {
      try {
        // Mọi nhánh thoát (break/return/throw) đều đã gán turnEnds trước khi tới đây.
        this.session.append("turn/end", { turn, reason: turnEnds as TurnEndReason });
      } catch (error) {
        this.throwError(error);
      }
    }
    if (!this.inbox.hasPending) return false;
    phase.abort = new AbortController();
    phase.wakeRequested = false;
    phase.step = 0;
    return true;
  }

  /**
   * Chạy MỘT bước: lắp request, phát luồng model, cam kết kết quả, rồi thi hành tool call.
   * Việc thử lại đi qua waterfall agent/request-error, nên lần thử mới lặp lại toàn bộ phần
   * dựng request của vòng while này.
   * Nhận: decision — quyết định vào bước kèm bản lắp prompt.
   * Trả: kết cục đóng lượt (completed/max-tokens), hoặc null khi lượt còn chạy tiếp.
   * @throws khi gọi ngoài pha chạy, khi luồng/nhật ký hỏng, hoặc khi kết thúc không thử lại được.
   */
  private async step(decision: EnterStepDecision): Promise<StepEnd | null> {
    /* v8 ignore next -- private callers establish the running phase before executing a step */
    if (this.phase.kind !== "running") throw new Error(`agent "${this.id}": step outside running phase`);
    const {
      turn,
      step,
      abort: { signal },
    } = this.phase;
    signal.throwIfAborted();
    const { assembly } = decision;
    const renderedPrompt = renderPrompt(assembly);
    let firstAttempt = true;
    while (true) {
      const { config, preparedCall } = await this.prepareRequest(turn, step, signal);
      const sections = renderContextSections(this.services.systemPrompt.refreshContext(assembly, assembleContextFor(this, signal)));
      const context = this.runtimeContext.project(joinContextSections(sections), sections);
      signal.throwIfAborted();
      const startsRequestSeries = firstAttempt && decision.startsRequestSeries === true;
      const commits = this.systemPrompt.project(renderedPrompt, {
        inHistory: preparedCall?.systemPromptUpdate === "in-history",
        startsSeries: startsRequestSeries || this.requestSurfaceGeneration !== this.session.surface.contentGeneration || (preparedCall?.toolUpdate === undefined && this.toolsChanged(assembly.tools)),
      });
      for (const { message, intent } of commits)
        this.session.append("system/message", { turn, step, message }, intent);
      let contextAdmitted = false;
      if (firstAttempt) {
        for (const message of decision.messages) {
          // source.kind của runtime-context do vùng ./runtime-context.ts khai; ở đây chỉ đọc chuỗi
          // (ADR 000d: không augment MessageSourceMap).
          if ((message.source as { readonly kind: string }).kind === "runtime-context") {
            if (context !== undefined && !contextAdmitted) {
              this.session.append("user/message", context, { surfaceOp: "append" });
              contextAdmitted = true;
            }
          } else this.session.append("user/message", message, { surfaceOp: "append" });
        }
      }
      if (context !== undefined && !contextAdmitted) this.session.append("user/message", context, { surfaceOp: "append" });
      firstAttempt = false;
      const request = this.buildRequest(
        config,
        preparedCall,
        assembly.tools,
        { turn, step },
        startsRequestSeries,
        signal,
      );
      const live = new AssistantStreamAttempt(
        this.session.id,
        ++this.assistantAttemptCounter,
        () => ++this.assistantStreamRevision,
        turn,
        step,
        (frame) => {
          this.dispatch.emit("agent/assistant-stream", { frame });
        },
      );
      let started = false;
      try {
        const stream = preparedCall?.stream(request) ?? this.services.llm.stream(request);
        signal.throwIfAborted();
        live.start();
        started = true;
        for await (const chunk of stream) {
          signal.throwIfAborted();
          live.push(chunk);
        }
        signal.throwIfAborted();
      } catch (error) {
        if (!started) throw error;
        try {
          if (signal.aborted) {
            const content = live.interruptedBlocks();
            if (content.length > 0)
              live.settle(
                "assistant/message",
                () =>
                  this.session.append(
                    "assistant/message",
                    {
                      turn,
                      step,
                      message: createAssistantMessage({
                        content,
                        source: {
                          provider: request.provider,
                          model: request.model,
                          ...(live.replayState === undefined ? {} : { replayState: live.replayState }),
                        },
                      }),
                      interrupted: true,
                      ...(live.usage === undefined ? {} : { usage: live.usage }),
                      stream: live.stream,
                    },
                    { surfaceOp: "append" },
                  ).seq,
              );
            else
              live.settle(
                "assistant/attempt",
                () =>
                  this.session.append("assistant/attempt", {
                    turn,
                    step,
                    stream: live.stream,
                  }).seq,
              );
          } else
            live.settle(
              "assistant/attempt",
              () =>
                this.session.append("assistant/attempt", {
                  turn,
                  step,
                  stream: live.stream,
                }).seq,
            );
        } catch (settlementError) {
          throw new AggregateError([error, settlementError], "Assistant stream failed and its durable settlement was rejected", { cause: error });
        }
        throw error;
      }
      try {
        const finish = live.finish;
        if (finish.kind === "error" || finish.kind === "aborted") {
          live.settle(
            "assistant/attempt",
            () =>
              this.session.append("assistant/attempt", {
                turn,
                step,
                stream: live.stream,
              }).seq,
          );
          const action = (await this.dispatch.waterfall(
            "agent/request-error",
            {
              turn,
              step,
              provider: request.provider,
              failure: finish.failure,
              retryPolicy: preparedCall?.retryPolicy,
              signal,
            },
            () => Promise.resolve(void 0),
          )) as RequestErrorAction;
          signal.throwIfAborted();
          if (action?.kind !== "retry") throw new LlmError(finish.failure.message, finish.failure.code, finish.failure);
          continue;
        }
        const message = createAssistantMessage({
          content: live.blocks(),
          source: {
            provider: request.provider,
            model: request.model,
            ...(live.replayState === undefined ? {} : { replayState: live.replayState }),
          },
        });
        live.settle(
          "assistant/message",
          () =>
            this.session.append(
              "assistant/message",
              {
                turn,
                step,
                message,
                ...(live.usage === undefined ? {} : { usage: live.usage }),
                stream: live.stream,
              },
              { surfaceOp: "append" },
            ).seq,
        );
        if (finish.kind === "max-tokens") return { kind: "max-tokens" };
        const toolCalls = message.content.filter((block) => block.type === "tool-call");
        if (toolCalls.length === 0) return { kind: "completed" };
        const { concluded } = await executeToolCalls(this.loopCtx as unknown as Parameters<typeof executeToolCalls>[0], turn, step, toolCalls, signal, (context) => this.inbox.splice("next-step", this.inbox.nextStep.length, 0, [context]));
        return concluded ? { kind: "completed" } : null;
      } catch (error) {
        if (!live.ended) live.abandon();
        throw error;
      }
    }
  }

  /**
   * Giải cấu hình request và gắn adapter của nó TRƯỚC khi nhận đầu vào model thấy được.
   * Nhận: turn/step — vị trí đang mở; signal — tín hiệu huỷ của lượt.
   * Trả: cấu hình đã cam kết và call đã chuẩn bị (nếu tuyến có adapter).
   * @throws khi tuyến không có provider/model, hoặc khi tín hiệu đã bị huỷ.
   */
  private async prepareRequest(turn: number, step: number, signal: AbortSignal): Promise<PreparedRequest> {
    const { session } = this;
    const persistedHeader = session.requestHeader();
    const persistedConfig = persistedHeader?.config;
    const route = {
      provider: this.options.provider ?? "",
      model: this.options.model ?? "",
    };
    // Chỉ kế thừa mức suy luận của đầu mục khi CÙNG tuyến và nó không do adapter điền.
    const persistedReasoningEffort =
      persistedConfig !== undefined && persistedConfig.provider === route.provider && persistedConfig.model === route.model && persistedHeader?.adapterDefaults?.reasoningEffort !== true ? persistedConfig.reasoningEffort : undefined;
    const reasoningEffort = this.options.reasoningEffort ?? persistedReasoningEffort;
    const maxTokens = this.options.maxTokens;
    const seedConfig = deepFreeze(
      structuredClone(
        this.requestHeaderLogged
          ? requestProposal(persistedHeader as EpochHeader)
          : {
              ...route,
              ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
              ...(maxTokens === undefined ? {} : { maxTokens }),
            },
      ),
    );
    const proposedConfig = (await this.dispatch.waterfall(
      "agent/request",
      {
        turn,
        step,
        signal,
      },
      () => Promise.resolve(seedConfig),
    )) as LlmCallConfig;
    signal.throwIfAborted();
    if (!proposedConfig.provider || !proposedConfig.model) throw new Error(`agent "${this.id}" has no provider/model: set AgentOptions.provider and AgentOptions.model or supply both via the agent/request waterfall`);
    let config: LlmCallConfig;
    let preparedCall: PreparedLlmCall | undefined;
    try {
      preparedCall = await this.services.llm.prepareCall(proposedConfig, signal);
      config = preparedCall.config;
    } catch (error) {
      if (!(error instanceof LlmError) || error.code !== "NO_ADAPTER") throw error;
      config = proposedConfig;
    }
    signal.throwIfAborted();
    return { config, ...(preparedCall === undefined ? {} : { preparedCall }) };
  }

  /**
   * Ghi log phong bì đã giải và suy ra request ĐÓNG BĂNG từ surface đã nhận.
   * Nhận: config — cấu hình đã cam kết; preparedCall — call đã chuẩn bị; tools — schema tool;
   * position — lượt/bước; startsRequestSeries — bước này mở chuỗi model riêng; signal — tín hiệu huỷ.
   * Trả: request đóng băng, đánh dấu bằng markAgentLoopRequest.
   * @throws khi tín hiệu đã huỷ, hoặc khi nhật ký phiên từ chối một append.
   */
  private buildRequest(config: LlmCallConfig, preparedCall: PreparedLlmCall | undefined, tools: ToolSchema[], position: StepPosition, startsRequestSeries: boolean, signal: AbortSignal): GenerateOptions {
    const { session } = this;
    const surfaceGeneration = session.surface.contentGeneration;
    const header = canonicalHeader({
      config,
      ...(preparedCall === undefined ? {} : { adapterDefaults: preparedCall.adapterDefaults }),
      ...(tools.length > 0 ? { tools } : {}),
    });
    const baseline = this.session.requestHeader();
    const startsSeries = startsRequestSeries || this.requestSurfaceGeneration !== surfaceGeneration;
    let headerSeq: SessionSeq | undefined;
    if (!this.requestHeaderLogged) {
      headerSeq = this.session.append("request/header", { header, reason: baseline === undefined ? "initial" : "resume", ...(startsSeries ? { startsSeries: true } : {}) }).seq;
      this.requestHeaderLogged = true;
    } else if (baseline === undefined || !headerEquals(baseline, header))
      headerSeq = this.session.append("request/header", { header, reason: "change", ...(startsSeries ? { startsSeries: true } : {}) }).seq;
    else if (startsSeries)
      this.session.append("request/header", { header, reason: "series" });
    if (baseline !== undefined && headerSeq !== undefined) {
      const previousNames = new Set(baseline.tools?.map((tool) => tool.name));
      const currentNames = new Set(tools.map((tool) => tool.name));
      const additions = tools
        .filter((tool) => !previousNames.has(tool.name))
        .map((tool) => ({ type: "tool-addition" as const, toolName: tool.name }));
      const removals = (baseline.tools ?? [])
        .filter((tool) => !currentNames.has(tool.name))
        .map((tool) => ({ type: "tool-removal" as const, toolName: tool.name }));
      if (additions.length > 0 || removals.length > 0)
        session.append(
          "developer/message",
          {
            ...position,
            message: createDeveloperMessage({
              source: { kind: "tool-registry" },
              content: [...additions, ...removals],
            }),
            ...(additions.length > 0 ? { headerSeq } : {}),
          },
          { surfaceOp: "append" },
        );
    }
    this.requestSurfaceGeneration = surfaceGeneration;
    const contextWindow = preparedCall?.context?.contextWindow;
    const systemPromptUpdate = preparedCall?.systemPromptUpdate;
    const requestContext: RequestContext = {
      provider: config.provider,
      model: config.model,
      ...(contextWindow === undefined ? {} : { contextWindow }),
      ...(systemPromptUpdate === undefined ? {} : { systemPromptUpdate }),
    };
    const previousContext = session.requestContext();
    if (
      previousContext === undefined ||
      previousContext.provider !== requestContext.provider ||
      previousContext.model !== requestContext.model ||
      previousContext.contextWindow !== requestContext.contextWindow ||
      previousContext.systemPromptUpdate !== requestContext.systemPromptUpdate
    )
      session.append("request/context", requestContext);
    signal.throwIfAborted();
    deepFreeze(header);
    const boundaryMessages = session.deriveMessages();
    for (const message of boundaryMessages) {
      if (this.frozenMessages.has(message)) continue;
      deepFreeze(message);
      this.frozenMessages.add(message);
    }
    Object.freeze(boundaryMessages);
    return markAgentLoopRequest(
      Object.freeze({
        ...header.config,
        messages: boundaryMessages,
        toolHistory: session.toolHistory(),
        ...(header.tools !== undefined ? { tools: header.tools } : {}),
        sessionId: this.session.id,
        signal,
      }),
    );
  }
}
