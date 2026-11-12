/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu theo CẤU TRÚC cho row auto-review: bề mặt phiên/agent mà bộ duyệt ĐỌC, payload sự kiện
 *      đã ghi, quyết định trước khi chạy tool, và sáu seam mà cổng duyệt gọi. Không import gói seam nào
 *      ngoài bảng §3b (luật 000d: không `declare module` toàn cục).
 */

import type { GenerateOptions, StreamChunk } from "@deepseek-ai/dsh-llm";

/** Một vị trí (lượt, bước) trong nhật ký phiên. */
export interface StepIdentity {
  /** Số thứ tự lượt. */
  readonly turn: number;
  /** Số thứ tự bước trong lượt. */
  readonly step: number;
}

/** Một trường tool mà bộ duyệt đọc: tên, mô tả, JSON Schema tham số. */
export interface ToolSchemaLike {
  /** Tên tool như model gọi. */
  readonly name: string;
  /** Mô tả tool mà yêu cầu duyệt gửi cho model. */
  readonly description: string;
  /** Schema tham số (vật thể JSON Schema). */
  readonly parameters: Record<string, unknown>;
}

/** Một khối nội dung model-facing, theo đúng phần bộ duyệt ĐỌC (khối lạ giữ nguyên tham chiếu). */
export interface ReviewContentBlock {
  /** Nhãn loại khối; bộ duyệt chia khối `text` và đọc khối `tool-call`. */
  readonly type: string;
  /** Thân chữ của khối `text`. */
  readonly text?: string;
  /** Danh tính lời gọi của khối `tool-call`. */
  readonly id?: string;
  /** Tên tool của khối `tool-call`. */
  readonly name?: string;
  /** Chuỗi JSON tham số THÔ của khối `tool-call`. */
  readonly arguments?: string;
}

/** Một khối tool-call đã đóng: đủ ba trường mà nhật ký phiên bảo đảm. */
export interface ToolCallBlock extends ReviewContentBlock {
  /** Luôn là `tool-call` với khối đã đóng. */
  readonly type: "tool-call";
  /** Danh tính lời gọi do nhà cung cấp cấp. */
  readonly id: string;
  /** Tên tool. */
  readonly name: string;
  /** Chuỗi JSON tham số thô. */
  readonly arguments: string;
}

/** Nguồn của một message user-role: phần bộ duyệt phân vai. */
export interface MessageSourceLike {
  /** Loại nguồn (`user` · `agent-instructions` · `compact-checkpoint` · `agent-message` · `tool` …). */
  readonly kind: string;
  /** Danh tính RPC của chỉ thị người THẬT do Web gửi; vắng mặt ở prompt tổng hợp. */
  readonly rpcId?: string;
  /** Phiên gửi, khi nguồn là message của agent khác. */
  readonly senderSessionId?: string;
}

/** Thân sự kiện `user/message`. */
export interface UserMessageData {
  /** Nguồn của message. */
  readonly source: MessageSourceLike;
  /** Các khối nội dung nguyên văn. */
  readonly content: readonly ReviewContentBlock[];
}

/** Thân sự kiện `assistant/message`. */
export interface AssistantMessageData extends StepIdentity {
  /** Message của assistant trong bước đó. */
  readonly message: { readonly content: readonly ReviewContentBlock[] };
}

/** Thân sự kiện `tool/call` — lời gọi THẬT do model phát ra, tham số còn là chuỗi thô. */
export interface ToolCallData extends StepIdentity {
  /** Danh tính lời gọi, ghép với `tool/result`. */
  readonly callId: string;
  /** Tên tool. */
  readonly name: string;
  /** Chuỗi JSON tham số thô. */
  readonly arguments: string;
}

/** Thân sự kiện `tool/ptc-dispatch-start` — một lời gọi con BẮT ĐẦU trong chương trình `run_code`. */
export interface PtcDispatchStartData {
  /** Lời gọi `run_code` gốc của cây. */
  readonly rootCallId: string;
  /** Lời gọi cha trực tiếp (có thể là một lời gọi con khác). */
  readonly parentCallId: string;
  /** Danh tính lời gọi con. */
  readonly subCallId: string;
  /** Tên tool được dispatch. */
  readonly name: string;
  /** Tham số đã chuẩn hoá JSON. */
  readonly arguments: unknown;
}

/** Sự kiện mở/đóng lượt. */
export interface TurnBoundaryEvent {
  /** Thứ tự trong nhật ký. */
  readonly seq: number;
  /** Hai đầu mút của lượt. */
  readonly type: "turn/start" | "turn/end";
  /** Thân sự kiện không được bộ duyệt đọc. */
  readonly data: unknown;
}

/** Sự kiện mở/đóng bước. */
export interface StepBoundaryEvent {
  /** Thứ tự trong nhật ký. */
  readonly seq: number;
  /** Hai đầu mút của bước. */
  readonly type: "step/start" | "step/end";
  /** Vị trí (lượt, bước). */
  readonly data: StepIdentity;
}

/** Sự kiện message user-role trên bề mặt model thấy. */
export interface UserMessageEvent {
  /** Thứ tự trong nhật ký. */
  readonly seq: number;
  /** Nhãn sự kiện. */
  readonly type: "user/message";
  /** Nguồn + nội dung message. */
  readonly data: UserMessageData;
}

/** Sự kiện message assistant đã lắp ráp cho một bước. */
export interface AssistantMessageEvent {
  /** Thứ tự trong nhật ký. */
  readonly seq: number;
  /** Nhãn sự kiện. */
  readonly type: "assistant/message";
  /** Vị trí + nội dung message. */
  readonly data: AssistantMessageData;
}

/** Sự kiện một lời gọi tool THẬT do model phát ra. */
export interface ToolCallEvent {
  /** Thứ tự trong nhật ký. */
  readonly seq: number;
  /** Nhãn sự kiện. */
  readonly type: "tool/call";
  /** Danh tính + tham số thô của lời gọi. */
  readonly data: ToolCallData;
}

/** Sự kiện một lời gọi con PTC bắt đầu. */
export interface PtcDispatchStartEvent {
  /** Thứ tự trong nhật ký. */
  readonly seq: number;
  /** Nhãn sự kiện. */
  readonly type: "tool/ptc-dispatch-start";
  /** Danh tính cây + tham số đã chuẩn hoá. */
  readonly data: PtcDispatchStartData;
}

/** Mốc tạo agent con trong nhật ký (`subagent/descriptor`). */
export interface SubagentDescriptorEvent {
  /** Thứ tự trong nhật ký. */
  readonly seq: number;
  /** Nhãn sự kiện. */
  readonly type: "subagent/descriptor";
  /** Thân sự kiện không được bộ duyệt đọc. */
  readonly data: unknown;
}

/**
 * Một sự kiện trong tập mà bộ duyệt ĐỌC. Nhật ký thật còn nhiều loại khác; vòng duyệt bỏ qua chúng
 * bằng so `type` trước khi chạm `data`, đúng như bản gốc.
 */
export type AutoReviewEvent =
  | TurnBoundaryEvent
  | StepBoundaryEvent
  | UserMessageEvent
  | AssistantMessageEvent
  | ToolCallEvent
  | PtcDispatchStartEvent
  | SubagentDescriptorEvent;

/** Header yêu cầu LLM gần nhất: tuyến (provider, model) và danh sách schema tool đã lắp. */
export interface RequestHeaderLike {
  /** Cấu hình tuyến của yêu cầu. */
  readonly config: { readonly provider: string; readonly model: string };
  /** Schema tool của yêu cầu đó (có thể vắng khi yêu cầu không có tool). */
  readonly tools?: readonly unknown[];
}

/** Siêu dữ liệu bất biến của phiên mà bộ duyệt đọc. */
export interface SessionHeaderLike {
  /** Nguồn gốc phiên (`subagent` cho agent con trong tiến trình). */
  readonly origin?: string;
  /** Danh tính phiên cha, khi đây là agent con. */
  readonly parentSession?: string;
}

/** Bề mặt model thấy của phiên: dãy `seq` theo đúng thứ tự lịch sử. */
export interface SessionSurfaceLike {
  /** Danh sách `seq` đang nằm trên bề mặt. */
  readonly nodes: readonly number[];
}

/** Phiên mà bộ duyệt đọc: nhật ký, bề mặt, header yêu cầu và phạm vi `seq` của chính nó. */
export interface AutoReviewSession {
  /** Siêu dữ liệu bất biến. */
  readonly header: SessionHeaderLike;
  /** Bề mặt model thấy. */
  readonly surface: SessionSurfaceLike;
  /** Ảnh chụp nhật ký sự kiện (đọc đồng bộ — nguyên văn cách bản gốc dùng). */
  snapshotEvents(): readonly AutoReviewEvent[];
  /** Header yêu cầu LLM gần nhất, nếu đã có. */
  requestHeader(): RequestHeaderLike | undefined;
  /** Sự kiện này có thuộc phiên hiện tại không (bỏ qua phần được kế thừa qua fork). */
  isOwnSeq(seq: number): boolean;
}

/** Agent đang gọi tool: chỉ cần phiên của nó. */
export interface AutoReviewAgent {
  /** Phiên sở hữu lời gọi. */
  readonly session: AutoReviewSession;
}

/** Một lời gọi tool ĐANG CHỜ, đúng hình dạng `tools/pre-execute` đưa cho listener. */
export interface PendingExecution {
  /** Tên tool. */
  readonly name: string;
  /** Tham số đã bóc (unknown của pipeline tool). */
  readonly arguments: unknown;
  /** Tín hiệu huỷ của chính lời gọi. */
  readonly signal: AbortSignal;
  /** Agent gọi; vắng ở lời gọi do tầng khác phát. */
  readonly agent?: AutoReviewAgent;
  /** Token của lời gọi `run_code` bao ngoài, khi đây là dispatch con PTC. */
  readonly parent?: unknown;
  /** Lời gọi `run_code` gốc của cây. */
  readonly rootCallId: string;
  /** Danh tính của chính lời gọi này. */
  readonly callId: string;
  /** Schema ràng buộc lúc bind của lời gọi con PTC. */
  readonly schema?: ToolSchemaLike;
}

/** Danh tính lỗi có cấu trúc mà lời từ chối cuối cùng mang theo. */
export interface ToolErrorInfo {
  /** Tên lỗi (`AutoReviewDeniedError`). */
  readonly name: string;
  /** Mã lỗi (`AUTO_REVIEW_DENIED`). */
  readonly code: string;
  /** Lý do thô của bộ duyệt, khi nó có nêu. */
  readonly reason?: string;
}

/** Quyết định trước khi chạy tool — đúng union mà pipeline tool nhận. */
export type PreToolDecision =
  | { readonly kind: "allow" }
  | { readonly kind: "deny"; readonly reason: string; readonly info?: ToolErrorInfo }
  | { readonly kind: "cancel" }
  | {
      readonly kind: "ask";
      readonly reason?: string;
      readonly displayReason?: { readonly en: string; readonly [locale: string]: string };
    };

/** Gọi tầng listener phía sau của waterfall `tools/pre-execute`. */
export type NextDecision = () => Promise<PreToolDecision>;

/** Seam `permissionPresets`: preset hiện tại, đường ghi preset, và đăng ký preset Auto. */
export interface PermissionPresetSeam {
  /** Preset hiệu lực của một phiên. */
  current(session: unknown): string;
  /** Đổi preset của một phiên qua setter chuẩn tắc của chủ sở hữu. */
  set(session: unknown, preset: string): void;
  /** Công bố preset Auto cho vòng đời effect của integration; trả hàm dọn BẤT ĐỒNG BỘ. */
  registerAuto(admit: () => void): () => Promise<void>;
}

/** Seam `approval`: chính sách duyệt ĐÃ GHIM của một phiên, không áp mặc định deployment. */
export interface ApprovalSeam {
  /** Chính sách ghi bền gần nhất, hoặc `undefined` khi phiên chưa ghim. */
  overrideOf(session: unknown): string | undefined;
}

/** Seam `sessions`: sổ phiên đang sống. */
export interface SessionsSeam {
  /** Liệt kê phiên đang sống. */
  list(): Iterable<unknown>;
}

/** Seam `llm`: nơi bộ duyệt gửi yêu cầu phân loại và đọc dòng chunk. */
export interface LlmSeam {
  /** Mở một lượt stream theo tuyến trong options. */
  stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
}

/** Seam `workingDirectory`: thư mục làm việc hiện tại của agent. */
export interface WorkingDirectorySeam {
  /** Bảo đảm và trả thư mục làm việc tuyệt đối cho agent. */
  ensure(agent: AutoReviewAgent, signal?: AbortSignal): Promise<string>;
}

/** Context cordis mà gói này dùng, khai theo CẤU TRÚC: sáu seam + hai hàm vòng đời. */
export interface AutoReviewContext {
  /** Sổ preset quyền (chủ sở hữu: row `permission`). */
  readonly permissionPresets: PermissionPresetSeam;
  /** Chính sách duyệt đã ghim theo phiên (chủ sở hữu: row `approval`). */
  readonly approval: ApprovalSeam;
  /** Sổ phiên đang sống. */
  readonly sessions: SessionsSeam;
  /** Tầng LLM của kernel. */
  readonly llm: LlmSeam;
  /** Thư mục làm việc của agent. */
  readonly workingDirectory: WorkingDirectorySeam;
  /** Đăng ký listener waterfall `tools/pre-execute`; trả hàm gỡ. */
  on(
    event: "tools/pre-execute",
    listener: (exec: PendingExecution, next: NextDecision) => Promise<PreToolDecision>,
    options: { readonly prepend: boolean },
  ): () => void;
  /** Chạy một hiệu ứng vòng đời; cordis gom các disposer do generator nhả ra và chạy NGƯỢC thứ tự. */
  effect(execute: () => Generator<unknown, void, unknown>, label?: string): unknown;
}

/** Vai của một khối chữ được giữ lại trong phần lịch sử đã lọc. */
export type ReviewRole =
  | "human-instruction"
  | "direct-parent-instruction"
  | "constraint"
  | "checkpoint"
  | "fact";

/** Một message user-role đã chia vai, giữ NGUYÊN nguồn và khối gốc. */
export interface ReviewUserEntry {
  /** Nhãn mục lịch sử. */
  readonly kind: "user-message";
  /** Vai của khối chữ trong mục này. */
  readonly role: ReviewRole;
  /** Nguồn gốc của message. */
  readonly source: MessageSourceLike;
  /** Đúng một khối nội dung. */
  readonly content: readonly ReviewContentBlock[];
}

/** Một sự thật dạng lời gọi tool đã xảy ra (native hoặc con PTC). */
export interface ReviewToolCallEntry {
  /** Nhãn mục lịch sử. */
  readonly kind: "tool-call";
  /** Lời gọi đã xảy ra chỉ là SỰ THẬT. */
  readonly role: "fact";
  /** Tầng phát lời gọi. */
  readonly mode: ReviewMode;
  /** Tên tool. */
  readonly name: string;
  /** Tham số đã chuẩn hoá JSON. */
  readonly arguments: string;
}

/** Một mục của lịch sử đã lọc. */
export type ReviewEntry = ReviewUserEntry | ReviewToolCallEntry;

/** Tầng phát một lời gọi tool. */
export type ReviewMode = "native" | "ptc-inner";

/** Hành động đang chờ duyệt, đóng băng, đúng năm trường gửi cho model. */
export interface ReviewAction {
  /** Tầng phát lời gọi. */
  readonly mode: ReviewMode;
  /** Tên tool. */
  readonly name: string;
  /** JSON Schema tham số của tool. */
  readonly parameters: Record<string, unknown>;
  /** Mô tả tool từ schema. */
  readonly description: string;
  /** Tham số đã bóc của lời gọi đang chờ. */
  readonly arguments: unknown;
}

/** Năm phần dữ liệu của một yêu cầu duyệt (phần thứ sáu là {@link ReviewPolicy} cố định). */
export interface ReviewSnapshot {
  /** Provider của tuyến yêu cầu gần nhất. */
  readonly provider: string;
  /** Model của tuyến yêu cầu gần nhất. */
  readonly model: string;
  /** Thư mục làm việc hiện tại của agent. */
  readonly cwd: string;
  /** Chỉ thị dự án đã lọc (vai `constraint`). */
  readonly projectInstructions: readonly ReviewEntry[];
  /** Lịch sử đã lọc, giữ nguồn gốc. */
  readonly history: readonly ReviewEntry[];
  /** Hành động đang chờ duyệt. */
  readonly action: ReviewAction;
}

/** Mức rủi ro của giao thức duyệt. */
export type ReviewRisk = "low" | "medium" | "high";

/** Kết luận của bộ duyệt. */
export type ReviewVerdict = "allow" | "deny";

/** Một kết luận hợp lệ của giao thức risk/decision. */
export interface ReviewDecision {
  /** Mức rủi ro. */
  readonly risk: ReviewRisk;
  /** Cho chạy hay từ chối. */
  readonly decision: ReviewVerdict;
  /** Lý do thô, chỉ có khi từ chối. */
  readonly reason?: string;
}

/** Một lời gọi con PTC đã bắt đầu, gắn với bước đang mở lúc nó được ghi. */
export interface PtcStart {
  /** Sự kiện `tool/ptc-dispatch-start`. */
  readonly event: PtcDispatchStartEvent;
  /** Bước sở hữu lời gọi con. */
  readonly step: StepIdentity;
}
