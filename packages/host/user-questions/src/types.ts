/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hợp đồng dây (wire contract) của row user-questions: câu hỏi, câu trả lời, trạng thái
 *      chiếu phiên, và hình dạng THẤU KÍNH của các dịch vụ kernel mà row này chạm tới
 *      (agent · session · inbox · vòng đua). Kiểu ở đây là CỦA TA — không import gói DSH
 *      nào ngoài bảng seam (xem README gói, mục "Peer").
 */
import type { ToolCallId } from "@deepseek-ai/dsh-llm";

import type { SessionLogOffset } from "./brand.ts";

/** Một lựa chọn trả lời được đưa cho người dùng. */
export interface AskUserQuestionOption {
  /** Nhãn hiển thị cho người dùng. */
  label: string;
  /** Ngữ cảnh thêm, chỉ UI đủ khả năng mới render. */
  description?: string;
}

/**
 * Ý ĐỊNH TRÌNH BÀY do bên hỏi khai: câu hỏi NÀY LÀ một loại quyết định, nên UI nhận ra thẻ
 * có thể trình bày đúng loại đó thay vì một danh sách lựa chọn chung. Cách mã hoá câu trả lời
 * giống hệt nhau ở cả hai đường — ý định chỉ đổi cách TRÌNH BÀY, không đổi giao thức.
 */
export type AskUserQuestionIntent = {
  /** Một kế hoạch được đưa ra duyệt: `detail` là markdown của kế hoạch, quyết định là duyệt hoặc từ chối. */
  kind: "plan-review";
  /** Nhãn lựa chọn ĐỒNG Ý kế hoạch; mọi nhãn khác là từ chối. */
  approve: string;
  /** Lời gọi tool đã ghi log, chứa kế hoạch được duyệt. */
  callId?: ToolCallId;
};

/** Một câu hỏi trong một yêu cầu hỏi người dùng. */
export interface AskUserQuestionItem {
  /** Id do bên hỏi đặt, được trả lại nguyên vẹn trong câu trả lời. */
  id: string;
  /** Câu hỏi cần hiển thị. */
  question: string;
  /** Chi tiết kèm theo, render cùng câu hỏi nhưng không nằm trong nhãn lựa chọn. */
  detail?: string;
  /** Tiêu đề ngắn / nhãn nhóm. */
  header?: string;
  /** Các lựa chọn UI có thể render thành menu. */
  options?: AskUserQuestionOption[];
  /** Cho phép chọn nhiều hơn một lựa chọn; mặc định là chọn một. */
  multiSelect?: boolean;
  /** Ý định trình bày cho UI đủ khả năng; vắng mặt nghĩa là danh sách lựa chọn chung. */
  intent?: AskUserQuestionIntent;
}

/** Câu trả lời cho một câu hỏi. */
export interface AskUserQuestionAnswerItem {
  /** Id của câu hỏi đã được trả lời. */
  id: string;
  /** Nhãn các lựa chọn đã chọn; có thể đi kèm chữ tự nhập ở câu hỏi nhiều lựa chọn. */
  selected: string[];
  /** Chữ tự nhập cho lựa chọn "Khác". */
  custom?: string;
}

/** Câu trả lời của người dùng. */
export interface AskUserQuestionAnswer {
  /** Câu trả lời có cấu trúc, khoá theo id câu hỏi. */
  answers: AskUserQuestionAnswerItem[];
}

/** `open` khi lời gọi tool còn có thể trả câu trả lời; `continued` khi câu trả lời chỉ có thể tới ở lượt mới. */
export type UserQuestionState = "open" | "continued";

/** Một lời gọi `ask_user_question` có hẹn giờ, chưa được trả lời, dựng lại từ log phiên. */
export interface PendingUserQuestion {
  /** Lời gọi đang chờ. */
  readonly callId: ToolCallId;
  /** Các câu hỏi của lời gọi đó. */
  readonly questions: readonly AskUserQuestionItem[];
  /** Trạng thái còn trả lời được hay đã chuyển sang lượt sau. */
  readonly state: UserQuestionState;
}

/**
 * Một lời gọi `ask_user_question` có hẹn giờ và lô câu trả lời đã chốt nó: lô do chính kết quả
 * của lời gọi mang tới khi người dùng trả lời trong hạn, ngược lại là lô do lời đáp muộn mang tới.
 */
export interface SettledUserQuestion {
  /** Lời gọi đã chốt. */
  readonly callId: ToolCallId;
  /** Lô đã ghi, mỗi câu hỏi một mục; rỗng khi lời đáp muộn không mang lô nào. */
  readonly answers: readonly AskUserQuestionAnswerItem[];
}

/** Hai nửa trạng thái câu hỏi có hẹn giờ của một phiên, đúng như mọi Client đọc. */
export interface UserQuestionProjectionView {
  /** Các lời gọi còn nhận được câu trả lời, theo thứ tự hỏi. */
  readonly active: readonly PendingUserQuestion[];
  /** Các lời gọi đã được một câu trả lời chốt, theo thứ tự chốt. */
  readonly settled: readonly SettledUserQuestion[];
}

/** Trạng thái đầy đủ của đơn vị chiếu `userQuestions` (phần dây chỉ thấy {@link UserQuestionProjectionView}). */
export interface UserQuestionProjectionState {
  /** Độ dài tiền tố sự kiện thừa hưởng khi fork; sự kiện trước mốc này không được gấp lại. */
  readonly inheritedEventCount: SessionLogOffset;
  /** Các lời gọi theo sau có dùng schema có hẹn giờ hay không. */
  readonly timed: boolean;
  /** Hai nửa trạng thái câu hỏi. */
  readonly questions: UserQuestionProjectionView;
}

/** Phần trạng thái mà phép gấp đọc và ghi (không gồm mốc thừa hưởng). */
export interface UserQuestionFold {
  /** Các lời gọi theo sau có dùng schema có hẹn giờ hay không. */
  timed: boolean;
  /** Hai nửa trạng thái câu hỏi. */
  questions: UserQuestionProjectionView;
}

/** Một khối nội dung của tin nhắn (chỉ trường `text` là row này đọc). */
export interface ContentBlock {
  /** Loại khối (`text`, `image`, …). */
  readonly type: string;
  /** Chữ của khối, khi là khối văn bản. */
  readonly text?: string;
}

/** Một mục trong hộp thư đến của agent, đủ để row này nhận diện lời đáp câu hỏi. */
export interface InboxMessage {
  /** Danh tính bền của tin nhắn. */
  readonly id: string;
  /** Nguồn sinh ra tin nhắn. */
  readonly source: { readonly kind: string; readonly callId?: ToolCallId };
}

/** Hộp thư đến của agent: hai hàng đợi mà row này phải soát trước khi xếp một lời đáp. */
export interface AgentInbox {
  /** Tin nhắn sẽ được nhận ở lượt kế tiếp. */
  readonly nextTurn: readonly InboxMessage[];
  /** Tin nhắn sẽ được nhận ở bước kế tiếp. */
  readonly nextStep: readonly InboxMessage[];
}

/** Phiên (chỉ dùng làm khoá WeakMap — row này không đọc trường nào của nó). */
export type Session = object;

/** Tin nhắn đã dựng để đẩy vào agent. */
export interface UserMessage {
  /** Danh tính bền của tin nhắn. */
  readonly id: string;
  /** Vai trò trong hội thoại. */
  readonly role: "user";
  /** Nguồn sinh ra tin nhắn. */
  readonly source: { readonly kind: string; readonly callId?: ToolCallId; readonly outcome?: string };
  /** Các khối nội dung. */
  readonly content: readonly ContentBlock[];
}

/** Agent đang sống: đúng những gì seam câu hỏi cần để xác thực người gọi và xếp lời đáp. */
export interface Agent {
  /** Danh tính phiên của agent. */
  readonly id: string;
  /** Phiên mà agent này sở hữu. */
  readonly session: Session;
  /** Hộp thư đến của agent. */
  readonly inbox: AgentInbox;
  /**
   * Đẩy một tin nhắn vào lượt đang chạy của agent.
   * Nhận: `message` — tin nhắn đã dựng và đã đóng băng.
   * Trả: không.
   */
  steer(message: UserMessage): void;
}

/** Sổ đăng ký agent của kernel: row này chỉ dùng hai truy vấn để xác thực người gọi. */
export interface AgentsRegistry {
  /**
   * Tra agent đang sống theo danh tính phiên.
   * Nhận: `id` — danh tính phiên.
   * Trả: đúng thể hiện đang sống, hoặc `undefined`.
   */
  get(id: string): Agent | undefined;
  /**
   * Liệt kê các agent gốc đang sống (không bị agent khác sở hữu).
   * Trả: mảng agent gốc, theo thứ tự sổ đăng ký.
   */
  roots(): readonly Agent[];
}

/** Sự kiện phiên ở dạng row này đọc (chỉ các trường mà phép gấp chạm tới). */
export interface SessionEvent {
  /** Vị trí sự kiện trong log. */
  readonly seq: number;
  /** Loại sự kiện. */
  readonly type: string;
  /** Thân sự kiện. */
  readonly data: SessionEventData;
}

/** Thân sự kiện phiên: hợp của các trường mà phép gấp đọc, tuỳ theo `type`. */
export interface SessionEventData {
  /** `request/header`: header yêu cầu, có danh sách schema tool đã lắp. */
  readonly header?: { readonly tools?: unknown };
  /** `tool/call` · `tool/ptc-dispatch`: tên tool. */
  readonly name?: string;
  /** `tool/call`: tham số thô dạng JSON. */
  readonly arguments?: unknown;
  /** `tool/call`: danh tính lời gọi. */
  readonly callId?: ToolCallId;
  /** `tool/ptc-dispatch`: danh tính lời gọi con. */
  readonly subCallId?: ToolCallId;
  /** `tool/ptc-dispatch`: lời gọi con đã lỗi hay chưa. */
  readonly isError?: boolean;
  /** `tool/ptc-dispatch`: các khối nội dung của kết quả con. */
  readonly content?: readonly ContentBlock[];
  /** `tool/result`: tin nhắn kết quả. */
  readonly message?: {
    readonly toolCallId?: ToolCallId;
    readonly content?: readonly ContentBlock[];
    readonly isError?: boolean;
  };
  /** `tool/result`: lỗi của lời gọi. */
  readonly error?: { readonly code?: string };
  /** `user/message`: nguồn tin nhắn. */
  readonly source?: { readonly kind?: string; readonly callId?: ToolCallId };
  /** `user/message`: danh tính tin nhắn. */
  readonly id?: string;
  /** `turn/end`: lượt vừa kết thúc. */
  readonly turn?: number;
}

/** Yêu cầu hỏi người dùng, đúng như bản gốc phát vào vòng đua `user-questions/request`. */
export interface AskUserQuestionRequestEvent {
  /** Các câu hỏi cần hiển thị. */
  questions: AskUserQuestionItem[];
  /** Agent sở hữu câu hỏi; vắng mặt nghĩa là hỏi không theo phạm vi agent. */
  agent?: Agent;
  /** Vòng đời huỷ của yêu cầu đang chờ. */
  signal?: AbortSignal;
  /** Lời gọi tool mà thẻ phía Client được khoá theo. */
  wait?: {
    /** Lời gọi tool mà thẻ phía Client được khoá theo. */
    callId: ToolCallId;
    /** true cho lượt chờ nền cần một Client nhận; vắng mặt cho lượt chờ vô hạn. */
    timed?: boolean;
  };
}

/** Yêu cầu hỏi người dùng (bí danh của sự kiện, đúng như bản gốc). */
export interface AskUserQuestionRequest extends AskUserQuestionRequestEvent {}

/** Kết quả của một lượt hỏi có hẹn giờ: câu trả lời, hoặc dấu "còn treo" khi cửa sổ đã đóng. */
export type TimedUserQuestionResult = AskUserQuestionAnswer | { pending: true; callId: ToolCallId };

/** Lời đáp đã xếp hàng nhưng agent chưa nhận. */
export interface QueuedReply {
  /** Tin nhắn đang chờ agent nhận. */
  messageId: string;
  /** Lượt đã nhận nó (có sau khi hộp thư đến nhận), dùng để dọn khi lượt kết thúc. */
  claimedTurn?: number;
}

declare module "@deepseek-ai/dsh-llm" {
  /** Nguồn tin nhắn: lời đáp muộn cho một câu hỏi đã chuyển sang trạng thái `continued`. */
  interface MessageSourceMap {
    /**
     * Lời đáp muộn cho một lời gọi `ask_user_question` đã chuyển lượt, được row này đẩy vào
     * agent dưới dạng một lô câu trả lời. Đóng bảng câu hỏi thì KHÔNG ghi lời đáp nào.
     */
    "user-question-reply": {
      kind: "user-question-reply";
      callId: ToolCallId;
      outcome: "answered";
    };
  }
}
