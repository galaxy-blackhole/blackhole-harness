/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng dữ liệu CÔNG KHAI của row agent: danh tính agent/phiên, tuỳ chọn tạo/resume,
 *      hợp đồng factory, từ vựng sự kiện agent, ba bề mặt seam (dispatch · model-selection ·
 *      archive-admission) và phép gấp "công việc đã tiêu thụ". Bản gốc lấy các kiểu này từ
 *      dsh-session · dsh-llm · dsh-system-prompt · dsh-typert-protocol · dsh-session-projection —
 *      đều NGOÀI bảng seam §3b — nên ở đây khai lại theo CẤU TRÚC, đúng phần row này chạm tới.
 */

import type { Context } from "@deepseek-ai/cordis";
import type {
  SessionEvent as KernelSessionEvent,
  SessionHeader,
  SessionId as KernelSessionId,
  SessionLogOffset,
} from "@galaxy-blackhole/gbh-session";
import type { ScopeKey, Scoped } from "@deepseek-ai/dsh-scope";

/**
 * Danh tính chia sẻ giữa sổ agent và nhật ký phiên.
 *
 * Bản gốc brand kiểu này bằng dấu của `@deepseek-ai/dsh-session` (ngoài bảng §3b). Ta khai
 * `string`: dấu là tầng kiểu thuần, còn một brand LẠ sẽ làm id do kernel cấp KHÔNG gán được vào
 * tham số của row này — đánh đổi có ý, ghi ở README gói.
 */
export type SessionId = KernelSessionId;

/** Nguyên nhân huỷ một hoạt động của agent — bản gốc khai trong `dsh-session`. */
export type AgentCancelCause =
  | { readonly kind: "user" }
  | { readonly kind: "parent" }
  | { readonly kind: "hook"; readonly reason: string }
  | { readonly kind: "disposed" };

/** Trạng thái vòng đời của agent, phát trên mọi chuyển tiếp qua `agent/status`. */
export type AgentStatus = "idle" | "running";

/** Một trong hai danh sách thư chờ có thứ tự của agent. */
export type InboxTarget = "next-turn" | "next-step";

/** Một khối nội dung hướng model; row này chỉ ĐỌC hình dạng, không dựng khối nào ngoài khối chữ. */
export interface AgentContentBlock {
  /** Loại khối (`text` là loại duy nhất row này tự dựng). */
  readonly type: string;
  /** Chữ của khối, khi là khối chữ. */
  readonly text?: string;
  /** Trường khác của khối — giữ nguyên, không diễn giải. */
  readonly [field: string]: unknown;
}

/** Nguồn của một thông điệp người-dùng, trong từ vựng của chính harness. */
export interface AgentMessageSource {
  /** Loại nguồn (`user` · `model-selection` · …); các loại lạ được người đọc bỏ qua. */
  readonly kind: string;
  /** Trường khác của nguồn — giữ nguyên, không diễn giải. */
  readonly [field: string]: unknown;
}

/** Một thông điệp người-dùng ĐÃ ĐÓNG BĂNG (có danh tính bền) — bản gốc khai ở `dsh-llm`. */
export interface AgentUserMessage {
  /** Danh tính bền, giữ nguyên qua mọi biên biểu diễn. */
  readonly id: string;
  /** Vai trò luôn là `user`. */
  readonly role: "user";
  /** Các khối nội dung hướng model. */
  readonly content: readonly AgentContentBlock[];
  /** Nguồn đã khai của thông điệp. */
  readonly source: AgentMessageSource;
}

/** Tuỳ chọn của một agent, hợp nhất được từ nhiều tầng. */
export interface AgentOptions {
  /** Tuyến provider (phải có adapter đã đăng ký tại thời điểm gọi). */
  provider?: string;
  /** Id model do provider diễn giải. */
  model?: string;
  /** Mức suy luận do adapter sở hữu. */
  reasoningEffort?: string;
  /** Trần token đầu ra cho mỗi request hội thoại. */
  maxTokens?: number;
}

/** Tuỳ chọn của `agent.cancel`. */
export interface CancelOptions {
  /** Giữ thư chờ thay vì xoá: lượt đang chạy vẫn bị huỷ, việc chưa chạy sống cho lượt sau. */
  keepInbox?: boolean | undefined;
}

/** Giá trị thư chờ đã dựng lại đầy đủ từ các lần cắt bền. */
export interface InboxState {
  /** Thư chờ mở lượt kế tiếp. */
  readonly "next-turn": readonly AgentUserMessage[];
  /** Thư chờ mở bước kế tiếp. */
  readonly "next-step": readonly AgentUserMessage[];
}

/** Truy cập thư chờ do agent sở hữu; kho thật thuộc bộ điều khiển vòng chạy. */
export interface Inbox {
  /** Thư chờ từng lượt. */
  readonly nextTurn: readonly AgentUserMessage[];
  /** Đầu vào chờ ranh giới bước kế tiếp. */
  readonly nextStep: readonly AgentUserMessage[];
  /** Huỷ BỀN mọi đầu vào đang chờ, xoá `next-step` trước `next-turn`. */
  clear(): void;
  /**
   * Nối một thông điệp vào một danh sách chờ.
   * Nhận: `target` — danh sách cần nối; `message` — thông điệp cần nối.
   * Trả: không.
   */
  append(target: InboxTarget, message: AgentUserMessage): void;
  /**
   * Chèn một thông điệp vào ĐẦU một danh sách chờ.
   * Nhận: `target` — danh sách cần chèn; `message` — thông điệp cần chèn.
   * Trả: không.
   */
  prepend(target: InboxTarget, message: AgentUserMessage): void;
  /**
   * Thay một thông điệp đang chờ tại chỗ.
   * Nhận: `messageId` — danh tính thông điệp cần thay; `newMessage` — thông điệp thay thế.
   * Trả: `true` khi thông điệp đó vẫn còn chờ.
   */
  replace(messageId: string, newMessage: AgentUserMessage): boolean;
  /**
   * Bỏ một thông điệp đang chờ.
   * Nhận: `messageId` — danh tính thông điệp cần bỏ.
   * Trả: `true` khi thông điệp đó vẫn còn chờ.
   */
  remove(messageId: string): boolean;
  /**
   * Áp ngữ nghĩa splice chuẩn và ghi BỀN kết quả đã chuẩn hoá.
   * Nhận: `target` — danh sách cần sửa; `start` — vị trí; `deleteCount` — số tối đa cần bỏ;
   * `inserted` — thông điệp chèn tại vị trí đã giải.
   * Trả: các thông điệp đã bị bỏ.
   */
  splice(target: InboxTarget, start: number, deleteCount: number, inserted: AgentUserMessage[]): AgentUserMessage[];
}

/** Cấu hình của một request model — bề mặt mà waterfall `agent/request` thay được. */
export interface LlmCallConfig {
  /** Tuyến provider. */
  readonly provider: string;
  /** Id model. */
  readonly model: string;
  /** Mức suy luận; vắng nghĩa là hành vi mặc định của provider/model. */
  readonly reasoningEffort?: string;
  /** Trường khác của cấu hình — giữ nguyên khi row này chỉ thay tuyến. */
  readonly [field: string]: unknown;
}

/** Đầu mục request đang hiệu lực trong nhật ký phiên. */
export interface EpochHeader {
  /** Cấu hình đã cam kết của request gần nhất. */
  readonly config: LlmCallConfig;
}

/** Phiên mà một agent điều khiển — chỉ phần row này chạm tới. */
export interface AgentSession {
  /** Danh tính chia sẻ với agent. */
  readonly id: SessionId;
  /**
   * Đầu mục phiên bền (id · cwd · parentSession · delegationDepth · origin).
   * 08/11/2026 (dev-1, Lead mở đóng băng R5): bản port thiếu thành viên này so với stock, khiến các gói
   * tiêu thụ phải ép kiểu rải rác (24 lỗi typecheck ở cụm subagent) ⇒ bổ sung tại GỐC.
   */
  readonly header: SessionHeader;
  /**
   * Số thứ tự sự kiện hiện tại của phiên (log offset) — dùng để chụp "từ mốc này" và so tiến độ.
   * Bổ sung tại gốc cùng lý do với `header`.
   */
  readonly seq: SessionLogOffset;
  /**
   * Ảnh chụp sự kiện của log phiên từ một mốc (mặc định từ đầu).
   * Bổ sung tại gốc cùng lý do với `header`.
   */
  snapshotEvents(from?: SessionLogOffset): readonly KernelSessionEvent[];
  /** Đầu mục request hiệu lực sau sự kiện header cuối, hoặc `undefined` trước header đầu. */
  requestHeader(): EpochHeader | undefined;
}

/** Một sự kiện phiên đã cam kết — row này đọc nó như dữ liệu thuần. */
export interface SessionEvent {
  /** Loại sự kiện phiên. */
  readonly type: string;
  /** Dữ liệu mang theo; hình dạng tuỳ loại, nên kiểu ở đây là `unknown` và người đọc tự hẹp. */
  readonly data: unknown;
}

/**
 * Lý do một lượt đóng. Bản gốc dùng map hợp nhất được (`TurnEndReasonMap`), nên trường `kind`
 * ở đây là chuỗi MỞ; các giá trị đã biết: `completed` · `blocked` · `aborted` · `interrupted` ·
 * `error` · `max-tokens` · `forked`.
 */
export interface TurnEndReason {
  /** Loại kết thúc của lượt. */
  readonly kind: string;
  /** Trường khác của lý do — giữ nguyên, không diễn giải. */
  readonly [field: string]: unknown;
}

/** Một lượt đã đóng có tính công việc đã tiêu thụ, và việc bị bỏ KHÔNG chạy sau lượt đó. */
export interface ConsumedWork {
  /** Sự kiện `turn/end` của lượt tính công việc, hoặc vắng khi không lượt nào đóng trên việc gì. */
  readonly end?: SessionEvent;
  /** Việc đã nhận bị huỷ khỏi thư chờ mà KHÔNG chạy, sau lượt đó. */
  readonly droppedUnrun: boolean;
}

/** Quyết định bước đề xuất: từ chối, hoặc vào bước với danh sách thông điệp (có thể đã thay). */
export type PreStepDecision =
  | { readonly kind: "reject" }
  | {
      /** Vào bước với các thông điệp đã chọn. */
      readonly kind: "enter";
      /** Thông điệp vào bước này. */
      readonly messages: readonly AgentUserMessage[];
      /** Mở một chuỗi thông điệp model RIÊNG trước loạt đã nhận của bước này. */
      readonly startsRequestSeries?: true;
    };

/** Hành động của người nghe sở hữu phục hồi request; `undefined` để hỏng hóc thành kết cục cuối. */
export type RequestErrorAction = { readonly kind: "retry" } | undefined;

/** Vì sao một vòng đời phiên bắt đầu; bản ghi mồi là `startup`, bản nạp lại là `resume`. */
export type SessionStartSource = "startup" | "resume" | "clear" | "compact";

/** Agent đang sống: danh tính, tuỳ chọn, phiên, thư chờ, trạng thái và context theo scope. */
export interface Agent {
  /** Danh tính do phiên chống lưng. */
  readonly id: SessionId;
  /** Tuyến và model mà request của agent này dùng. */
  readonly options: AgentOptions;
  /** Phiên đang sống; nhật ký của nó là nguồn sự thật bền. */
  readonly session: AgentSession;
  /** Truy cập thư chờ do agent sở hữu. */
  readonly inbox: Inbox;
  /** Trạng thái vòng đời hiện tại. */
  readonly status: AgentStatus;
  /** Context theo scope của agent; đóng góp của nó được gỡ khi agent bị bỏ. */
  readonly ctx: Context;
  /**
   * Xoá việc đang chờ — trừ `keepInbox` — và huỷ lượt đang chạy.
   * Nhận: `cause` — ý định người gọi; `options` — tuỳ chọn huỷ.
   * Trả: không.
   */
  cancel(cause: AgentCancelCause, options?: CancelOptions): void;
  /** Chờ tới khi hoạt động hiện tại của cả agent lặng hẳn; trả promise kết thúc khi lặng. */
  whenIdle(): Promise<void>;
  /**
   * Chạy một việc bảo trì KHÔNG phải lượt từ pha rảnh thật.
   * Nhận: `task` — việc nhận tín hiệu huỷ của agent.
   * Trả: promise của chính việc đó, giữ nguyên kết cục.
   */
  runMaintenance<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>;
  /**
   * Định tuyến đầu vào đã có danh tính vào một ranh giới thư chờ, và tuỳ chọn đánh thức bộ điều khiển.
   * Nhận: `message`; `target`; `wakeup` — có được đánh thức hay không.
   * Trả: không.
   */
  send(message: AgentUserMessage, target: InboxTarget, wakeup: boolean): void;
  /**
   * Xếp một lượt tiếp nối thường và đánh thức bộ điều khiển.
   * Nhận: `message` — thông điệp của lượt đó.
   * Trả: không.
   */
  followup(message: AgentUserMessage): void;
  /**
   * Gửi chỉ đạo cho bước gần nhất.
   * Nhận: `message` — thông điệp chỉ đạo.
   * Trả: không.
   */
  steer(message: AgentUserMessage): void;
  /**
   * Xếp ngữ cảnh hướng model cho bước kế tiếp mà KHÔNG đánh thức bộ điều khiển.
   * Nhận: `message` — ngữ cảnh cần chèn.
   * Trả: không.
   */
  inject(message: AgentUserMessage): void;
}

/** Bộ chốt đồng bộ mà setup chưa công bố trả về để kiểm ngay tại điểm công bố. */
export interface AgentSetupCommit {
  /**
   * Kiểm và chốt setup đã dựng ngay TRƯỚC khi công bố.
   * Nhận: không.
   * Trả: không; ném khi phải cuộn ngược agent chưa công bố.
   */
  commit(): void;
}

/** Thành phần hoá một scope agent CHƯA công bố, và tuỳ chọn trả bộ chốt công bố của nó. */
export type AgentSetup = (agentCtx: Context, agent: Agent) => AgentSetupCommit | Promise<AgentSetupCommit | void> | void;

/** Tuỳ chọn tạo agent theo chương trình qua factory của sổ đăng ký. */
export interface CreateAgentOptions {
  /** Danh tính agent/phiên đang sống. */
  readonly sessionId: SessionId;
  /** Agent cha đang sống cho quyền sở hữu lúc chạy; vắng khi là agent gốc. */
  readonly parentAgent?: Agent;
  /** Metadata tạo phiên: cwd đã kiểm, dòng fork, dấu mồi, phân loại nguồn, ngân sách đệ quy. */
  readonly meta?: {
    /** Thư mục làm việc tuyệt đối đã kiểm. */
    readonly cwd?: string;
    /** Danh tính phiên cha khi là fork. */
    readonly parentSession?: SessionId;
    /** Dấu "phiên được mồi" của fork. */
    readonly isSeeded?: boolean;
    /** Phân loại nguồn thô. */
    readonly origin?: "subagent";
    /** Ngân sách đệ quy. */
    readonly delegationDepth?: number;
    /** Tên preset agent đã áp. */
    readonly agentPreset?: string;
  };
  /** Độ dài tiền tố kế thừa của fork, khi metadata đặt `isSeeded`. */
  readonly inheritedEventCount?: number;
  /** Lịch sử phát lại/fork ban đầu, liền mạch từ seq 0 với dữ liệu JSON không mất mát. */
  readonly seed?: readonly SessionEvent[];
  /** Tuỳ chọn theo từng agent (model, …). */
  readonly agentOptions?: AgentOptions;
  /** Tín hiệu huỷ chỉ dùng lúc tạo; được tách ra trước khi handle trở nên nhìn thấy. */
  readonly signal?: AbortSignal;
  /** Thành phần hoá thế giới theo scope của agent, chạy TRƯỚC khi công bố. */
  readonly setup?: AgentSetup;
}

/** Tuỳ chọn resume một agent trên phiên đã lưu. */
export interface ResumeAgentOptions {
  /** Danh tính phiên đã lưu, dùng làm danh tính agent/phiên đang sống. */
  readonly resumeSessionId: SessionId;
  /** Agent cha đang sống cho quyền sở hữu lúc chạy. */
  readonly parentAgent?: Agent;
  /** Tuỳ chọn theo từng agent. */
  readonly agentOptions?: AgentOptions;
  /** Tín hiệu huỷ chỉ dùng lúc nạp lại/tạo; được tách ra trước khi trả về. */
  readonly signal?: AbortSignal;
  /** Thành phần hoá thế giới theo scope mới của agent, chạy TRƯỚC khi công bố. */
  readonly setup?: AgentSetup;
}

/** Một agent được sở hữu kèm hàm dọn, do `create`/`resume` trả về. */
export interface AgentHandle {
  /** Agent đang sống. */
  agent: Agent;
  /** Dừng vòng chạy, chờ nó thoát, gỡ đăng ký, bỏ phiên, rồi cuộn ngược thế giới scope. */
  dispose(): Promise<void>;
}

/** Factory tạo agent do bộ điều khiển vòng chạy cấp cho sổ đăng ký qua `setFactory`. */
export interface AgentFactory {
  /**
   * Tạo một agent trên danh tính phiên do bên gọi cấp.
   * Nhận: `ownerCtx` — context ràng buộc bên gọi; `options` — danh tính, cấu hình, cha, setup.
   * Trả: handle đã sở hữu sau setup và hai lần công bố tạo.
   */
  createAgent(ownerCtx: Context, options: CreateAgentOptions): Promise<AgentHandle>;
  /**
   * Resume một agent trên phiên đã lưu.
   * Nhận: `ownerCtx` — context ràng buộc bên gọi; `options` — danh tính đã lưu, cấu hình, cha, setup.
   * Trả: handle đã sở hữu sau setup, hai lần công bố và vòng chạy đã bắt đầu.
   */
  resume(ownerCtx: Context, options: ResumeAgentOptions): Promise<AgentHandle>;
}

/** Tuyến provider/model đã chọn cho MỘT agent đang sống, kèm mức suy luận tuỳ chọn. */
export interface ModelSelection {
  /** Tuyến provider đã đăng ký. */
  provider: string;
  /** Id model do provider sở hữu. */
  model: string;
  /** Mức suy luận do adapter sở hữu; vắng nghĩa là hành vi mặc định của provider/model. */
  reasoningEffort?: string;
}

/** Lựa chọn model thay đổi được, kèm giá trị đã chụp cho bước hiện tại. */
export interface ModelSelectionRef {
  /** Model đã chọn cho bước kế tiếp đi vào lắp prompt. */
  current: ModelSelection | undefined;
  /** Lựa chọn đã chụp khi bước hiện tại đi vào lắp prompt. */
  assembled: ModelSelection | undefined;
}

/** Prompt đã lắp cho một bước — row này chỉ thay `variables` của nó. */
export interface PromptAssembly {
  /** Biến nội suy của prompt, theo tên. */
  variables: Record<string, string | undefined>;
  /** Phần khác của phép lắp (mục, ngữ cảnh, tool) — giữ nguyên. */
  readonly [field: string]: unknown;
}

/** Agent mà bộ chọn model đọc phiên của nó. */
export interface ModelSelectionAgent {
  /** Phiên có đầu mục request để so tuyến. */
  readonly session: AgentSession;
}

/** Payload của waterfall `agent/pre-step` mà bộ chọn model chen vào. */
export interface PreStepPayload {
  /** Agent đang đề xuất bước. */
  readonly agent: ModelSelectionAgent;
  /** Thông điệp đã bỏ khỏi thư chờ cho bước này. */
  readonly messages: readonly AgentUserMessage[];
  /** Lượt sẽ sở hữu bước. */
  readonly turn: number;
  /** Số bước do bộ điều khiển đề xuất. */
  readonly step: number;
  /** Tín hiệu huỷ của lượt hiện tại. */
  readonly signal: AbortSignal;
}

/** Ba mối nối sự kiện mà `installModelSelection` đăng ký trên context theo scope của agent. */
export interface ModelSelectionContext {
  on(
    event: "system-prompt/assemble",
    listener: (assembly: PromptAssembly, context: unknown, next: () => Promise<PromptAssembly>) => Promise<PromptAssembly>,
  ): () => void;
  on(
    event: "agent/request",
    listener: (payload: unknown, next: () => Promise<LlmCallConfig>) => Promise<LlmCallConfig>,
  ): () => void;
  on(
    event: "agent/pre-step",
    listener: (payload: PreStepPayload, next: () => Promise<PreStepDecision>) => Promise<PreStepDecision>,
    options: { prepend: true },
  ): () => void;
}

/** Context mà bộ phân phát sự kiện của agent THỰC SỰ dùng, khai theo CẤU TRÚC. */
export interface DispatchContext {
  /** Kho sự kiện của kernel: trả các callback đã lọc, đã ràng buộc vào `thisArg`, và TIÊU THỤ hai phần tử đầu của `args`. */
  readonly events: {
    dispatch(mode: "emit", args: unknown[]): ((...args: unknown[]) => unknown)[];
  };
  /** Log của kernel, để bao lỗi của từng người nghe. */
  readonly logger: {
    warn(message: string, ...args: unknown[]): void;
  };
  /** Điều phối serial của cordis (đã ràng buộc `this`, nên tách ra gọi được như bản gốc). */
  serial(thisArg: unknown, name: string, payload: unknown): Promise<unknown>;
  /** Điều phối waterfall của cordis (đã ràng buộc `this`, nên tách ra gọi được như bản gốc). */
  waterfall(thisArg: unknown, name: string, payload: unknown, ...rest: unknown[]): unknown;
}

/** Bộ phân phát hợp nhất mà `agentEvents` trả về: mỗi phương thức tự chèn `agent` vào payload. */
export interface AgentEventDispatch {
  /**
   * Phát "bắn-và-quên" trong scope của agent.
   * Nhận: `name` — tên sự kiện; `payload` — các trường payload (agent được chèn).
   * Trả: không; lỗi của từng người nghe được ghi log và bao lại.
   */
  emit(name: string, payload: Record<string, unknown>): void;
  /**
   * Phát serial theo thứ tự trong scope của agent.
   * Nhận: `name` — tên sự kiện; `payload` — các trường payload (agent được chèn).
   * Trả: kết quả chuỗi serial (giá trị bail đầu tiên, nếu có).
   */
  serial(name: string, payload: Record<string, unknown>): Promise<unknown>;
  /**
   * Phát waterfall trong scope của agent.
   * Nhận: `name` — tên sự kiện; `payload` — các trường payload (agent được chèn); `rest` —
   * các tham số sau payload, phần tử cuối là `next` trong cùng.
   * Trả: kết quả đã hợp của waterfall.
   */
  waterfall(name: string, payload: Record<string, unknown>, ...rest: unknown[]): unknown;
}

/** Một họ hoạt động phiên mà sổ workspace đọc để quyết định lưu trữ. */
export interface SessionActivityKind {
  /** Tên họ hoạt động (`turn` là họ row này trả lời). */
  readonly kind: string;
}

/** Payload của waterfall `workspace/session-activity`. */
export interface SessionActivityPayload {
  /** Phiên đang được hỏi. */
  readonly sessionId: SessionId;
}

/** Payload của sự kiện `workspace/session-stop`. */
export interface SessionStopPayload {
  /** Phiên sắp bị lưu trữ cùng công việc của nó. */
  readonly sessionId: SessionId;
}

/** Hai mối nối sự kiện mà `installTurnArchiveAdmission` đăng ký trên context của sổ đăng ký. */
export interface ArchiveAdmissionContext {
  on(
    event: "workspace/session-activity",
    listener: (
      payload: SessionActivityPayload,
      next: () => Promise<readonly SessionActivityKind[]>,
    ) => Promise<readonly SessionActivityKind[]>,
  ): unknown;
  on(event: "workspace/session-stop", listener: (payload: SessionStopPayload) => void): unknown;
}

/** Carrier phạm vi của một agent — vật định tuyến BẤT BIẾN mà mọi lần phát đi qua. */
export type AgentCarrier = Scoped<Agent>;

/**
 * Context truyền cho `assemble()` của sổ lắp prompt: agent và scope đặt CÙNG nhau, để đóng góp
 * prompt/tool theo agent không bị bỏ sót một cách âm thầm. Bản gốc khai kiểu này ở
 * `dsh-system-prompt`, nơi `agent` là trường hợp BẤT BUỘC tuỳ chọn của phép chẩn đoán.
 */
export interface AssembleContext {
  /** Agent của phép lắp này; vắng trên đường chẩn đoán. */
  readonly agent?: Agent;
  /** Khoá phạm vi của cùng agent đó — phải TRÙNG vật với `agent` khi có mặt. */
  readonly scope?: ScopeKey;
  /** Tín hiệu kiểm soát của lượt hiện tại, khi phép lắp thuộc một lượt. */
  readonly signal?: AbortSignal;
}
