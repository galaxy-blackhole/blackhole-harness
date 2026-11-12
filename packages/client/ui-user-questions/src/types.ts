/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Be mat seam (cau truc) ma nua client doc: React runtime, ui-primitives, client-store, ctx cua vo, node hoi thoai va AskUserQuestion*
 */

// Bản gốc import các kiểu này từ gói @deepseek-ai/*. Bản viết lại khai lại ĐÚNG hình dạng mà nửa client
// dùng (cấu trúc), để bán kính typecheck hẹp không phải kéo cả node_modules của DSH; tên trường và ngữ
// nghĩa giữ nguyên 1:1 với lib/types/*.d.ts của bản gốc.

import type { PendingQuestion } from "./contract.ts";

/** Hàm `require` do bảng module của Loader cấp cho factory (gọi lúc vạt chất hoá). */
export type RequireFn = (specifier: string) => unknown;

/** Hàm dựng element của React runtime. */
export type JsxFn = (type: unknown, props: Record<string, unknown> | null, key?: unknown) => unknown;

/** Runtime JSX do bảng module cấp (`react/jsx-runtime`). */
export interface JsxRuntime {
  /** Dựng element một con. */
  jsx: JsxFn;
  /** Dựng element nhiều con. */
  jsxs: JsxFn;
  /** Mảnh không bọc element. */
  Fragment: unknown;
}

/** React runtime (hooks + memo) do bảng module cấp (`react`). */
export interface ReactRuntime {
  /** Hook trạng thái cục bộ. */
  useState: <T>(initial: T) => [T, (next: T | ((previous: T) => T)) => void];
  /** Hook giữ một giá trị qua các lần render. */
  useRef: <T>(initial: T) => { current: T };
  /** Hook vòng đời. */
  useEffect: (callback: () => void | (() => void), deps?: readonly unknown[]) => void;
  /** Hook ghi nhớ giá trị dẫn xuất. */
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => T;
  /** Hook ghi nhớ hàm. */
  useCallback: <T>(callback: T, deps: readonly unknown[]) => T;
  /** Bọc component để chỉ render lại khi props đổi. */
  memo: <T>(component: T) => T;
}

/** Tuỳ chọn của `extractMarkdownPlainText` mà panel duyệt kế hoạch dùng. */
export interface MarkdownPlainTextOptions {
  /** Lấy dòng đầu hay đoạn đầu của markdown. */
  readonly mode: "first-line" | "first-paragraph";
}

/** Bề mặt ui-primitives mà nửa client dùng (tên export giữ nguyên của bản gốc). */
export interface PrimitivesSeam {
  /** Nút dùng chung. */
  Button: unknown;
  /** Chấm trạng thái. */
  StateDot: unknown;
  /** Khối markdown. */
  MarkdownText: unknown;
  /** Chú thích nổi. */
  Tooltip: unknown;
  /** Mũi tên lên. */
  IconChevronUpOutlineRegular: unknown;
  /** Mũi tên xuống. */
  IconChevronDownOutlineRegular: unknown;
  /** Mũi tên trái. */
  IconChevronLeftOutlineRegular: unknown;
  /** Mũi tên phải. */
  IconChevronRightOutlineRegular: unknown;
  /** Dấu đóng. */
  IconCloseOutlineRegular: unknown;
  /** Dấu kiểm. */
  IconCheckOutlineRegular: unknown;
  /** Bút sửa. */
  IconEditOutlineRegular: unknown;
  /** Sao chép. */
  IconCopyOutlineRegular: unknown;
  /** Rút văn bản thuần từ markdown. */
  extractMarkdownPlainText: (text: string, options: MarkdownPlainTextOptions) => string;
  /** Ghi văn bản vào clipboard; trả `false` khi trình duyệt từ chối. */
  writeClipboard: (text: string) => Promise<boolean>;
}

declare const toolCallIdBrand: unique symbol;
declare const sessionIdBrand: unique symbol;

/** Định danh lời gọi công cụ (brand lúc biên dịch, chuỗi lúc chạy). */
export type ToolCallId = string & { readonly [toolCallIdBrand]: true };

/** Định danh phiên/agent (brand lúc biên dịch, chuỗi lúc chạy). */
export type SessionId = string & { readonly [sessionIdBrand]: true };

/** Một lựa chọn mà người hỏi đưa ra. */
export interface UserQuestionOption {
  /** Nhãn trả về nguyên văn khi được chọn. */
  readonly label: string;
  /** Mô tả phụ. */
  readonly description?: string;
}

/** Ý định trình bày `plan-review` của một câu hỏi. */
export interface UserQuestionIntent {
  /** Loại ý định — nửa client này chỉ xử lý `plan-review`. */
  readonly kind: "plan-review";
  /** Nhãn lựa chọn DUYỆT kế hoạch; mọi nhãn khác là từ chối. */
  readonly approve: string;
  /** Lời gọi công cụ đã ghi, dùng để mở lại kế hoạch. */
  readonly callId?: ToolCallId;
}

/** Một câu hỏi của yêu cầu. */
export interface UserQuestionItem {
  /** Định danh do người hỏi cấp, được lặp lại trong câu trả lời. */
  readonly id: string;
  /** Nội dung câu hỏi. */
  readonly question: string;
  /** Chi tiết phụ (với `plan-review`: chính là markdown của kế hoạch). */
  readonly detail?: string;
  /** Tiêu đề ngắn / nhãn nhóm. */
  readonly header?: string;
  /** Các lựa chọn. */
  readonly options?: readonly UserQuestionOption[];
  /** Cho phép chọn nhiều lựa chọn. */
  readonly multiSelect?: boolean;
  /** Ý định trình bày mà UI có năng lực có thể dùng. */
  readonly intent?: UserQuestionIntent;
}

/** Câu trả lời cho một câu hỏi. */
export interface UserQuestionAnswerItem {
  /** Định danh câu hỏi được trả lời. */
  readonly id: string;
  /** Nhãn các lựa chọn đã chọn. */
  readonly selected: readonly string[];
  /** Câu trả lời tự nhập. */
  readonly custom?: string;
}

/** Câu trả lời của người dùng cho cả yêu cầu. */
export interface UserQuestionAnswer {
  /** Câu trả lời theo từng câu hỏi. */
  readonly answers: readonly UserQuestionAnswerItem[];
}

/** `open` khi lời gọi công cụ còn nhận câu trả lời; `continued` khi câu trả lời chỉ còn đến được ở lượt sau. */
export type UserQuestionState = "open" | "continued";

/** Hàm dịch của một namespace. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Seam copy của vỏ. */
export interface LocaleSeam {
  /** Đăng ký bản dịch cho một namespace; trả hàm gỡ. */
  register: (namespace: string, copy: Record<string, Record<string, string>>) => () => void;
  /** Buộc khoá đọc vào một namespace. */
  bind: (namespace: string) => Translate;
}

/** Sổ đăng ký slot của vỏ. */
export interface SlotRegistrySeam {
  /** Đăng ký một occupant; trả hàm gỡ. */
  register: (definition: Record<string, unknown>, component: unknown) => () => void;
  /** Chỉ đăng ký khi slot đã có người phục vụ. */
  inject: (slot: string, register: () => unknown) => void;
}

/** Sổ "pending interaction" của phiên: nơi thẻ câu hỏi được công bố vào ghế composer. */
export interface PendingInteractionSeam {
  /** Đăng ký bộ công bố; tham số là điểm ưu tiên của thẻ. Trả hàm dùng để công bố một thẻ. */
  registerPendingInteraction: (
    priority: (pending: PendingQuestion) => number,
  ) => (pending: PendingQuestion, onDelegate: () => Promise<void>) => () => void;
}

/** Một mục trong ảnh chụp danh sách phiên. */
export interface SessionSummary {
  /** Định danh phiên. */
  readonly id: SessionId;
}

/** Ảnh chụp danh sách phiên đã bind. */
export interface SessionsSnapshot {
  /** Phiên theo id. */
  readonly byId: Record<string, SessionSummary>;
}

/** Một mặt chiếu (projection) đọc được của một phiên. */
export interface ProjectionHandle<T> {
  /** Nghe thay đổi; trả hàm gỡ. */
  subscribe: (listener: () => void) => () => void;
  /** Ảnh chụp hiện tại. */
  getSnapshot: () => T;
}

/** Một dòng câu hỏi đang hoạt động trong mặt chiếu `userQuestions`. */
export interface QuestionProjectionRow {
  /** Lời gọi công cụ sở hữu câu hỏi. */
  readonly callId: string;
  /** Trạng thái của dòng. */
  readonly state: UserQuestionState;
  /** Danh sách câu hỏi. */
  readonly questions: readonly UserQuestionItem[];
}

/** Mặt chiếu `userQuestions` của một phiên. */
export interface UserQuestionsProjection {
  /** Các dòng đang hoạt động. */
  readonly active?: readonly QuestionProjectionRow[];
}

/** Mặt chiếu `inbox` của một phiên (chỉ đọc hai hàng đợi mà nửa này cần). */
export interface InboxProjection {
  /** Tin nhắn chờ bước kế tiếp. */
  readonly "next-step"?: readonly unknown[];
  /** Tin nhắn chờ lượt kế tiếp. */
  readonly "next-turn"?: readonly unknown[];
}

/** Phiên đã bind của một id. */
export interface SessionBinding {
  /** Phiên với các mặt chiếu đọc được. */
  readonly session: {
    /** Các mặt chiếu của phiên. */
    readonly projections: {
      /** Lấy mặt chiếu theo tên. */
      faceOf: <T>(name: string) => ProjectionHandle<T>;
    };
  };
}

/** Seam phiên/agent của vỏ. */
export interface SessionsSeam {
  /** Chủ sở hữu phạm vi của một listener (`undefined` khi listener không thuộc phiên nào). */
  scopeOf: (owner: unknown) => SessionId | undefined;
  /** Danh sách phiên đã bind. */
  list: {
    /** Ảnh chụp danh sách. */
    getSnapshot: () => SessionsSnapshot;
    /** Nghe thay đổi danh sách; trả hàm gỡ. */
    subscribe: (listener: () => void) => () => void;
  };
  /** Phiên đã bind của một id. */
  binding: (sessionId: SessionId) => SessionBinding | undefined;
}

/** Một yêu cầu hỏi như listener waterfall nhận. */
export interface QuestionRequest {
  /** Danh sách câu hỏi. */
  readonly questions: readonly UserQuestionItem[];
  /** Vòng đời của yêu cầu được chuyển tiếp. */
  readonly signal?: AbortSignal;
  /** Chỗ chờ mà Host đã cấp (vắng mặt với câu hỏi chặn). */
  readonly wait?: {
    /** Lời gọi công cụ sở hữu chỗ chờ. */
    readonly callId?: string;
    /** Chỗ chờ có hạn hay chặn. */
    readonly timed?: boolean;
  };
}

/** Một mẩu của chỗ chờ có hạn (giữ chỗ foreground). */
export interface QuestionWaitClaimChunk {
  /** Thời gian còn lại của chỗ chờ, tính bằng mili giây. */
  readonly remainingMs: number;
}

/** Chỗ chờ có hạn mà Host cấp; duyệt được và giải phóng được. */
export interface QuestionWaitClaim extends AsyncIterable<QuestionWaitClaimChunk> {
  /** Giải phóng chỗ chờ. */
  dispose: () => void;
}

/** Lỗi do Remote trả về. */
export interface RemoteCallError {
  /** Thông điệp của lỗi. */
  readonly message: string;
}

/** Kết quả một lời gọi Remote: hoặc giá trị, hoặc lỗi. */
export type RemoteResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: RemoteCallError };

/** Seam Remote Event + lời gọi `userQuestions` của vỏ. */
export interface RemoteSeam {
  /** Nghe một sự kiện; listener nhận `this` là chủ sở hữu phạm vi và `next` để chuyển tiếp. */
  $on: (event: string, listener: (this: unknown, request: QuestionRequest, next: () => unknown) => unknown) => void;
  /** Lời gọi Remote của miền câu hỏi. */
  userQuestions: {
    /** Giữ chỗ chờ của một lời gọi công cụ. */
    attachWait: (sessionId: SessionId, callId: string, signal: AbortSignal) => QuestionWaitClaim;
    /** Trả lời một câu hỏi đã được "continued". */
    answer: (sessionId: SessionId, callId: string, answer: UserQuestionAnswer) => Promise<RemoteResult<unknown>>;
  };
}

/** Một mẩu nội dung tin nhắn. */
export interface UserMessageContentPart {
  /** Loại mẩu. */
  readonly type: string;
  /** Văn bản của mẩu (khi là `text`). */
  readonly text?: string;
}

/** Dữ liệu của tin nhắn `user/message` mà nửa này đọc. */
export interface UserMessageData {
  /** Định danh tin nhắn. */
  readonly id?: unknown;
  /** Nội dung tin nhắn. */
  readonly content: readonly UserMessageContentPart[];
  /** Nguồn của tin nhắn (dùng để nhận ra câu trả lời muộn). */
  readonly source?: unknown;
}

/**
 * Một sự kiện của surface hội thoại. Hình dạng `data` ở đây là hình dạng mà nửa này đọc
 * (tin nhắn người dùng) — sự kiện khác không đi qua nhánh này.
 */
export interface SurfaceEvent {
  /** Loại sự kiện. */
  readonly type: string;
  /** Số thứ tự trong log. */
  readonly seq: number;
  /** Thời điểm của sự kiện. */
  readonly time: number;
  /** Thao tác surface (`append` hoặc thay thế). */
  readonly surfaceOp?: string;
  /** Dữ liệu của sự kiện. */
  readonly data: UserMessageData;
}

/** Một mục khớp do Definition nhận ra. */
export interface ConversationNodeMatch {
  /** Sự kiện gốc. */
  readonly event: SurfaceEvent;
  /** Khoá của mục. */
  readonly id: string;
  /** Vai trò của mục (chỉ `start`). */
  readonly role: "start";
  /** Mục này chiếm riêng tin nhắn. */
  readonly exclusive: boolean;
}

/** Ngữ cảnh khi dựng node hiển thị. */
export interface BuildViewContext<S> {
  /** Khoá của mục. */
  readonly key: string;
  /** Định danh của mục. */
  readonly id: string;
  /** Trạng thái đã chiếu (vắng mặt khi chưa dựng xong). */
  readonly state: S | undefined;
  /** Mục đã bắt đầu, kèm vị trí neo. */
  readonly start?: { readonly location?: unknown };
}

/** Node hiển thị mà renderer của hội thoại nhận. */
export interface ConversationViewNode {
  /** Khoá của node. */
  readonly key: string;
  /** Loại node. */
  readonly kind: string;
  /** Định danh của node. */
  readonly id: string;
  /** Đích hiển thị. */
  readonly target: "chat";
  /** Số thứ tự neo. */
  readonly anchorSeq: number;
  /** Vị trí neo. */
  readonly location: unknown;
  /** Mức hiển thị. */
  readonly visibility: "visible";
  /** Dữ liệu của node. */
  readonly data: unknown;
}

/** Định nghĩa node hội thoại mà nửa này đăng ký vào `uiConversation.events`. */
export interface ConversationNodeDefinition<S> {
  /** Loại node. */
  readonly kind: string;
  /** Đích hiển thị. */
  readonly target: "chat";
  /** Nhận ra sự kiện thuộc node này. */
  match: (event: SurfaceEvent) => { readonly id: string; readonly role: "start"; readonly exclusive: boolean } | null;
  /** Dựng trạng thái ban đầu của node. */
  start: (context: unknown, match: ConversationNodeMatch) => S;
  /** Cập nhật trạng thái của node. */
  update: (context: { readonly state: S | undefined }) => S | undefined;
  /** Dựng node hiển thị. */
  buildViewNode: (context: BuildViewContext<S>) => ConversationViewNode | null;
}

/** Seam hội thoại của vỏ. */
export interface ConversationSeam {
  /** Sổ sự kiện của hội thoại. */
  events: {
    /** Đăng ký một Definition node (trạng thái node do Definition quyết định). */
    register: <S>(definition: ConversationNodeDefinition<S>) => void;
  };
}

/** Seam `reflect` của cordis (nơi `provide` một service). */
export interface ReflectSeam {
  /** Cung cấp một service; trả hàm gỡ. */
  provide: (name: string, service: unknown) => () => void;
}

/** Bề mặt context gốc của client mà nửa này dùng. */
export interface ClientContext {
  /** Đăng ký hiệu ứng vòng đời; trả hàm gỡ. */
  effect: (callback: () => (() => void | Promise<void>) | void, label?: string) => () => void;
  /** Phạm vi Agent/phiên. */
  sessions: SessionsSeam;
  /** Remote Event + lời gọi miền câu hỏi. */
  remote: RemoteSeam;
  /** Sổ "pending interaction" của phiên. */
  uiSession: PendingInteractionSeam;
  /** Sổ đăng ký slot. */
  slots: SlotRegistrySeam;
  /** Copy. */
  locale: LocaleSeam;
  /** Node hội thoại. */
  uiConversation: ConversationSeam;
  /** Cung cấp service cho row khác. */
  reflect: ReflectSeam;
}
