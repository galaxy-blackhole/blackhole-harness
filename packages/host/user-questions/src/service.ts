/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc `ctx.userQuestions`: seam hỏi người dùng — kiểm tra đầu vào, vòng đua người trả lời theo
 *      phạm vi agent, lượt chờ nền có hẹn giờ, và lời đáp muộn (bản gốc: `lib/types/index.js`).
 */
import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { scopeTarget } from "@deepseek-ai/dsh-scope";
import { createUserMessage, type ToolCallId } from "@deepseek-ai/dsh-llm";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

import { abortedQuestion, restoreUserQuestionError, UserQuestionError } from "./errors.ts";
import { userQuestionProjectionDefinition, type SessionProjectionDefinition } from "./projection.ts";
import { TimedQuestionWait } from "./timed-wait.ts";
import type {
  Agent,
  AgentsRegistry,
  AskUserQuestionAnswer,
  AskUserQuestionRequest,
  InboxMessage,
  PendingUserQuestion,
  QueuedReply,
  Session,
  TimedUserQuestionResult,
  UserMessage,
  UserQuestionProjectionState,
} from "./types.ts";

/** Sổ chiếu phiên của kernel — chỉ phần mà row này gọi tới. */
interface SessionProjectionRegistry {
  /**
   * Đăng ký một đơn vị chiếu; đăng ký là một hiệu ứng thuộc vòng đời plugin gọi nó.
   * Nhận: `definition` — định nghĩa đơn vị chiếu.
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  register(definition: SessionProjectionDefinition): unknown;
  /**
   * Đọc trạng thái đã gấp của một phiên.
   * Nhận: `session` — phiên cần đọc; `key` — khoá đơn vị chiếu.
   * Trả: trạng thái của đơn vị đó, hoặc undefined khi chưa sẵn sàng.
   */
  stateOf(session: Session, key: string): UserQuestionProjectionState | undefined;
}

/** Context con đã áp inject của sổ chiếu phiên. */
interface ProjectionContext {
  /** Sổ chiếu phiên của kernel. */
  readonly sessionProjections: SessionProjectionRegistry;
}

/**
 * Context của Host: API tra service, API event, và vòng đua của cordis.
 *
 * Vì sao tra service bằng `ctx.get` thay vì đọc thẳng thuộc tính: khi Gateway gọi một phương thức
 * Remote, nó chạy trên context của BÊN GỌI — nơi danh sách inject của row không áp — nên truy cập
 * kiểu thuộc tính sẽ ném lỗi (đo được ở row `account-controller`, lab 5461).
 */
interface HostContext {
  /**
   * Tra một service theo tên, không cần khai inject.
   * Nhận: `name` — tên service.
   * Trả: service, hoặc undefined khi chưa sẵn sàng.
   */
  get(name: string): unknown;
  /**
   * Chờ một tập service sẵn sàng rồi chạy callback trong context đã áp inject.
   * Nhận: `deps` — tên các service; `callback` — thân chạy khi đã đủ.
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  inject(deps: readonly string[], callback: (ctx: ProjectionContext) => void): unknown;
  /**
   * Đăng ký một hiệu ứng dọn dẹp theo vòng đời plugin.
   * Nhận: `callback` — hàm trả về hàm dọn; `label` — nhãn chẩn đoán.
   * Trả: giá trị của hiệu ứng (không dùng).
   */
  effect(callback: () => () => void, label?: string): unknown;
  /**
   * Đăng ký nghe một event.
   * Nhận: `name` — tên event; `listener` — thân nghe; `options` — `global` để nghe cả event ngoài phạm vi.
   * Trả: hàm huỷ đăng ký.
   */
  on(name: string, listener: (...args: never[]) => void, options?: { global?: boolean }): () => void;
  /**
   * Chạy vòng đua của cordis; tham số đầu có thể là `this` của lượt phát.
   * Nhận: `args` — `this` tuỳ chọn, tên event, các tham số, rồi hàm cuối.
   * Trả: promise của giá trị mà mắt xích cuối trả về.
   */
  waterfall(...args: unknown[]): Promise<unknown>;
}

/** Thân event `agent/inbox/claimed`. */
interface InboxClaimedPayload {
  /** Agent vừa nhận tin nhắn. */
  readonly agent: Agent;
  /** Tin nhắn được nhận. */
  readonly message: InboxMessage;
  /** Lượt đã nhận nó. */
  readonly turn: number;
}

/** Thân event `agent/inbox/discarded`. */
interface InboxDiscardedPayload {
  /** Agent bỏ tin nhắn. */
  readonly agent: Agent;
  /** Tin nhắn bị bỏ. */
  readonly message: InboxMessage;
}

/** Thân event `session/event` (chỉ hai loại mà row này đọc). */
type SessionEventListener = (session: Session, event: { type: string; data: { source?: { kind?: string; callId?: ToolCallId }; id?: string; turn?: number } }) => void;

/**
 * `ctx.userQuestions`: kiểm tra đầu vào cộng vòng đua người trả lời theo phạm vi.
 *
 * Peer `@deepseek-ai/dsh-typert-protocol` thuộc seam RPC của kernel (bảng §3b của packages/README.md):
 * lớp này PHẢI kế thừa đúng base class đó để Gateway discovery được. Peer `@deepseek-ai/dsh-scope`
 * và `@deepseek-ai/dsh-llm` nằm NGOÀI bảng §3b — lý do đo được ghi ở README gói, mục "Peer".
 */
export class UserQuestionService extends TypertRemoteService {
  /** Bản gốc cũng không có tham số cấu hình nào. */
  static Config = z.object({});

  /** Các lượt chờ nền đang sống, theo agent rồi theo lời gọi. */
  private readonly waits = new Map<Agent, Map<ToolCallId, TimedQuestionWait>>();

  /** Lời đáp đã xếp hàng nhưng agent chưa nhận, theo phiên rồi theo lời gọi. */
  private readonly queuedReplies = new WeakMap<Session, Map<ToolCallId, QueuedReply>>();

  /**
   * Đăng ký service `userQuestions`, đơn vị chiếu của nó, và ba tuyến event giữ sổ lời đáp đã xếp.
   * Nhận: `ctx` — context của plugin.
   * Trả: thể hiện service đã đăng ký dưới khoá `userQuestions`.
   */
  constructor(ctx: Context) {
    super(ctx, "userQuestions");
    const host = this.host();
    host.inject(["sessionProjections"], (projectionCtx) => {
      projectionCtx.sessionProjections.register(userQuestionProjectionDefinition);
    });
    host.effect(() => () => {
      for (const calls of this.waits.values()) for (const wait of calls.values()) wait.close(abortedQuestion());
      this.waits.clear();
    }, "userQuestions: foreground waits");
    host.on(
      "agent/inbox/claimed",
      ({ agent, message, turn }: InboxClaimedPayload) => {
        const source = message.source;
        if (source.kind !== "user-question-reply" || source.callId === undefined) return;
        const calls = this.queuedReplies.get(agent.session) ?? new Map<ToolCallId, QueuedReply>();
        const reply = calls.get(source.callId);
        if (reply === undefined) {
          calls.set(source.callId, { messageId: message.id, claimedTurn: turn });
          this.queuedReplies.set(agent.session, calls);
        } else if (reply.messageId === message.id) reply.claimedTurn = turn;
      },
      { global: true },
    );
    host.on(
      "agent/inbox/discarded",
      ({ agent, message }: InboxDiscardedPayload) => {
        const source = message.source;
        if (source.kind === "user-question-reply" && source.callId !== undefined) {
          this.releaseReply(agent.session, source.callId, message.id);
        }
      },
      { global: true },
    );
    const onSessionEvent: SessionEventListener = (session, event) => {
      if (event.type === "user/message") {
        const source = event.data.source;
        if (source?.kind === "user-question-reply" && source.callId !== undefined && event.data.id !== undefined) {
          this.releaseReply(session, source.callId, event.data.id);
        }
      } else if (event.type === "turn/end") {
        const calls = this.queuedReplies.get(session);
        if (calls === undefined) return;
        for (const [callId, reply] of calls) if (reply.claimedTurn === event.data.turn) calls.delete(callId);
      }
    };
    host.on("session/event", onSessionEvent, { global: true });
  }

  /**
   * Context của Host đã hẹp hoá kiểu (API tra service + event + vòng đua).
   * Trả: context dùng cho các phương thức bên dưới.
   */
  private host(): HostContext {
    return this.ctx as unknown as HostContext;
  }

  /**
   * Bỏ dấu một lời đáp chỉ khi tin nhắn bị bỏ đúng là lời đáp đang chờ.
   * Nhận: `session` — phiên sở hữu; `callId` — lời gọi; `messageId` — tin nhắn đang chờ.
   * Trả: không.
   */
  private releaseReply(session: Session, callId: ToolCallId, messageId: string): void {
    const calls = this.queuedReplies.get(session);
    if (calls?.get(callId)?.messageId !== messageId) return;
    calls.delete(callId);
  }

  /**
   * Xác thực người gọi là ĐÚNG agent gốc đang sống.
   * Nhận: `agent` — agent mà bên gọi đưa vào.
   * Trả: không.
   * @throws {UserQuestionError} `CALLER_NOT_LIVE` khi agent không phải thể hiện đang sống của sổ,
   *   `DELEGATED_CALLER` khi agent đó bị một agent đang sống khác sở hữu.
   */
  private assertLiveRoot(agent: Agent): void {
    const agents = this.host().get("agents") as AgentsRegistry | undefined;
    if (agents === undefined || agents.get(agent.id) !== agent) {
      throw new UserQuestionError("human interaction requires the exact live calling agent when an agent is supplied", "CALLER_NOT_LIVE");
    }
    if (!agents.roots().includes(agent)) {
      throw new UserQuestionError(
        "human interaction is unavailable while the calling agent is owned by another live agent; include the unresolved question or decision in the child agent's final result",
        "DELEGATED_CALLER",
      );
    }
  }

  /**
   * Đọc các câu hỏi đã chuyển lượt của một agent.
   * Nhận: `agent` — agent sở hữu phiên.
   * Trả: các câu hỏi ở trạng thái `continued`, theo thứ tự hỏi.
   */
  private continued(agent: Agent): readonly PendingUserQuestion[] {
    const registry = this.host().get("sessionProjections") as SessionProjectionRegistry | undefined;
    return (registry?.stateOf(agent.session, "userQuestions")?.questions.active ?? []).filter(
      (question) => question.state === "continued",
    );
  }

  /**
   * Trả lời một câu hỏi đã chuyển lượt. Lời đáp được đẩy vào agent dưới dạng một tin nhắn người dùng
   * mà nguồn của nó nêu tên lời gọi; chính tin nhắn đó cũng là bản ghi chốt câu hỏi trong chiếu.
   * @param agent - Agent gốc đang sống sở hữu phiên.
   * @param callId - Danh tính câu hỏi đã chuyển lượt.
   * @param answer - Lô câu trả lời đầy đủ, mỗi câu hỏi của lời gọi đúng một mục.
   * @returns Câu hỏi còn ở trạng thái đã chuyển lượt hay không; lời đáp được nhận sẽ nằm chờ tới khi
   *   agent nhận tin nhắn người dùng của nó.
   * @throws {UserQuestionError} `BAD_ANSWER` khi lô không nêu mỗi câu hỏi đúng một lần, hoặc
   *   `REPLY_QUEUED` khi đã có một lời đáp đang chờ được nhận.
   */
  @Remote
  answer(agent: Agent, callId: ToolCallId, answer: AskUserQuestionAnswer): boolean {
    this.assertLiveRoot(agent);
    const question = this.continued(agent).find((item) => item.callId === callId);
    if (question === undefined) return false;
    const queued = this.queuedReplies.get(agent.session);
    const matches = (message: InboxMessage): boolean =>
      message.source.kind === "user-question-reply" && message.source.callId === callId;
    if (queued?.has(callId) === true || agent.inbox.nextTurn.some(matches) || agent.inbox.nextStep.some(matches)) {
      throw new UserQuestionError("a reply is already queued for this question", "REPLY_QUEUED");
    }
    // Gateway đã kiểm hình dạng của lô từ kiểu; hợp đồng với mô hình còn hứa mỗi câu hỏi đúng một mục,
    // và chỉ kẻ đã hỏi mới kiểm được điều đó trước khi lô tới tay mô hình.
    const answered = new Set(answer.answers.map((item) => item.id));
    if (
      answered.size !== answer.answers.length ||
      question.questions.length !== answer.answers.length ||
      !question.questions.every((item) => answered.has(item.id))
    ) {
      throw new UserQuestionError(
        `the answer batch for ${callId} must name each of its ${String(question.questions.length)} questions exactly once`,
        "BAD_ANSWER",
      );
    }
    const message = createUserMessage({
      source: { kind: "user-question-reply", callId, outcome: "answered" },
      content: [
        {
          type: "text",
          text: JSON.stringify({
            kind: "answer_to_pending_question",
            tool: "ask_user_question",
            callId,
            questions: question.questions,
            answers: answer.answers,
          }),
        },
      ],
    });
    const calls = queued ?? new Map<ToolCallId, QueuedReply>();
    calls.set(callId, { messageId: message.id });
    this.queuedReplies.set(agent.session, calls);
    try {
      agent.steer(message as unknown as UserMessage);
    } catch (error) {
      this.releaseReply(agent.session, callId, message.id);
      throw error;
    }
    return true;
  }

  /**
   * Cho một UI trả lời giữ một lượt chờ nền đang sống. Đóng luồng là nhả claim của nó.
   * @param agent - Agent gốc đang sống sở hữu câu hỏi.
   * @param callId - Lời gọi nền cần gắn vào.
   * @param signal - Vòng đời huỷ của luồng Remote, kể cả khi Client ngắt kết nối.
   * @returns Một thời lượng còn lại do Host tính, hoặc không khung nào khi lượt chờ đã kết thúc.
   */
  @Remote({ mode: "stream" })
  async *attachWait(agent: Agent, callId: ToolCallId, signal: AbortSignal): AsyncGenerator<{ remainingMs: number }> {
    this.assertLiveRoot(agent);
    const wait = this.waits.get(agent)?.get(callId);
    if (wait !== undefined) yield* wait.attach(signal);
  }

  /**
   * Lượt chờ nền mà kết cục ĐẦU TIÊN do Client quyết: Client từ chối với `ASK_TIMED_OUT` khi hết đếm
   * ngược của nó, và phương thức này ánh xạ mã đó thành kết quả "còn treo".
   * @param request - Câu hỏi, agent sở hữu đang sống, và tín hiệu huỷ.
   * @param callId - Danh tính lời gọi tool mà thẻ phía Client được khoá theo.
   * @param timeoutMs - Thời lượng chờ nền, tính bằng mili giây, phải dương.
   * @returns Câu trả lời khi nó tới trong cửa sổ, ngược lại là kết quả "còn treo" — kể cả khi không
   *   Client nào đang kết nối nhận yêu cầu trước hạn chót.
   * @throws {UserQuestionError} `BAD_TIMEOUT` khi thời lượng không phải số nguyên, không dương,
   *   hoặc vượt sức chứa của bộ đếm nền tảng.
   */
  async askTimed(request: AskUserQuestionRequest & { agent: Agent }, callId: ToolCallId, timeoutMs: number): Promise<TimedUserQuestionResult> {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2147483647) {
      throw new UserQuestionError("timeout must fit a positive platform timer", "BAD_TIMEOUT");
    }
    this.assertLiveRoot(request.agent);
    const calls = this.waits.get(request.agent) ?? new Map<ToolCallId, TimedQuestionWait>();
    if (calls.has(callId)) throw new UserQuestionError("the question call already has a foreground wait", "DUPLICATE_WAIT");
    const wait = new TimedQuestionWait(
      Date.now() + timeoutMs,
      request.signal,
      new UserQuestionError("ask_user_question timed out before the user answered", "ASK_TIMED_OUT"),
    );
    calls.set(callId, wait);
    this.waits.set(request.agent, calls);
    try {
      try {
        return await this.ask({ ...request, signal: wait.signal, wait: { callId, timed: true } });
      } catch (error) {
        if (wait.signal.aborted) throw wait.signal.reason;
        if (error instanceof UserQuestionError && error.code === "NO_PROVIDER") {
          await wait.done;
          throw wait.signal.reason;
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof UserQuestionError && error.code === "ASK_TIMED_OUT") return { pending: true, callId };
      if (wait.signal.aborted) throw abortedQuestion(error);
      throw error;
    } finally {
      wait.close(abortedQuestion());
      calls.delete(callId);
      if (calls.size === 0) this.waits.delete(request.agent);
    }
  }

  /**
   * Hỏi vòng đua người trả lời theo phạm vi và chờ câu trả lời của người dùng.
   *
   * Khi bên gọi đưa một agent, tương tác người chỉ hợp lệ với ĐÚNG agent gốc đang sống: quyền sở hữu
   * lúc chạy — không phải dòng dõi phiên bền — quyết định ranh giới này, vì agent con bị sở hữu không
   * có người trả lời và sẽ chờ mãi.
   *
   * @param request - Câu hỏi, agent sở hữu, và tín hiệu huỷ.
   * @returns Câu trả lời do người dùng chọn hoặc tự nhập.
   * @throws {UserQuestionError} mã `ASK_ABORTED` khi tín hiệu đã hoặc trở nên bị huỷ,
   *   `CALLER_NOT_LIVE` khi agent đưa vào không phải thể hiện đang sống của sổ,
   *   `DELEGATED_CALLER` khi agent đó bị một agent khác sở hữu, `EMPTY_QUESTIONS` khi không có
   *   câu hỏi nào, hoặc `BAD_INTENT` khi một ý định trình bày không khớp câu hỏi của chính nó.
   */
  async ask(request: AskUserQuestionRequest): Promise<AskUserQuestionAnswer> {
    if (request.signal?.aborted) throw abortedQuestion();
    if (request.questions.length === 0) {
      throw new UserQuestionError("ask_user_question requires at least one question", "EMPTY_QUESTIONS");
    }
    const agent = request.agent;
    if (agent !== undefined) this.assertLiveRoot(agent);
    // Một ý định trình bày khẳng định hai điều mà kiểu không nói được: nhãn đồng ý nêu tên phải là
    // MỘT trong các lựa chọn của chính câu hỏi đó, và một lượt duyệt kế hoạch phải mang kế hoạch nó
    // duyệt. Một UI tôn trọng ý định sẽ trả lời bằng đúng nhãn đó và hiện đúng chi tiết đó, nên thiếu
    // một trong hai là đưa ra trước mặt người dùng một lựa chọn bên hỏi chưa từng đưa — hay một lượt
    // duyệt cho thứ vô hình. Bắt tại bên hỏi, nơi có lỗi, thay vì ở từng UI.
    for (const question of request.questions) {
      const intent = question.intent;
      if (intent === undefined) continue;
      if (!(question.options ?? []).some((option) => option.label === intent.approve)) {
        throw new UserQuestionError(
          `question ${question.id} declares intent ${intent.kind} whose approve label ${JSON.stringify(intent.approve)} names none of its options`,
          "BAD_INTENT",
        );
      }
      if (question.detail === undefined) {
        throw new UserQuestionError(`question ${question.id} declares intent ${intent.kind} without the detail it reviews`, "BAD_INTENT");
      }
    }
    const noAnswerer = (): Promise<AskUserQuestionAnswer> =>
      Promise.reject(new UserQuestionError("no user-questions answerer accepted the request", "NO_PROVIDER"));
    try {
      return (await (agent === undefined
        ? this.host().waterfall("user-questions/request", request, noAnswerer)
        : this.host().waterfall(scopeTarget(agent, agent), "user-questions/request", { ...request, agent }, noAnswerer))) as AskUserQuestionAnswer;
    } catch (error) {
      const restored = restoreUserQuestionError(error);
      if (restored instanceof UserQuestionError) throw restored;
      if (request.signal?.aborted) throw abortedQuestion(error);
      throw restored;
    }
  }
}

export default UserQuestionService;
