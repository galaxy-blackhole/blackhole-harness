/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hop dong mien cau hoi (1:1 lib/types/client/contract/slots.js): planReviewOf, waterfall, the PendingQuestion va props cua composer
 */

import { deferred } from "./deferred.ts";
import type { QuestionDraftBoundActions, QuestionDraftState } from "./draft-store.ts";
import type { SessionId, ToolCallId, Translate, UserQuestionAnswer, UserQuestionAnswerItem, UserQuestionItem, UserQuestionOption, UserQuestionState } from "./types.ts";

/** Một lô câu trả lời có cấu trúc phủ mọi câu hỏi của yêu cầu. */
export type QuestionAnswer = UserQuestionAnswer;

/** Một câu hỏi của yêu cầu. */
type QuestionItem = UserQuestionItem;

/** Một lựa chọn mà người hỏi đưa ra. */
type QuestionOption = UserQuestionOption;

/**
 * Một yêu cầu đã được thu hẹp về ý định trình bày `plan-review`: mọi thứ thẻ quyết định render và trả lời,
 * để panel không phải đọc lại trường của yêu cầu. `approve` và `decline` là lựa chọn của chính người hỏi —
 * câu trả lời phải mang đúng nhãn đó nguyên văn — và `plan` là thân markdown đang được duyệt.
 */
export interface PlanReview {
  /** Định danh câu hỏi đang duyệt, được lặp lại trong câu trả lời. */
  id: string;
  /** Nội dung câu hỏi, giữ làm tên trợ năng của thẻ. */
  question: string;
  /** Markdown của kế hoạch đang duyệt. */
  plan: string;
  /** Lời gọi công cụ đã ghi, dùng để mở lại kế hoạch. */
  callId?: ToolCallId;
  /** Lựa chọn DUYỆT kế hoạch. */
  approve: QuestionOption;
  /** Lựa chọn TỪ CHỐI; vắng mặt khi người hỏi không đưa lựa chọn nào khác. */
  decline?: QuestionOption;
}

/**
 * Thu hẹp một yêu cầu về bản duyệt kế hoạch render được, hoặc trả `undefined` để nhường cho luồng câu hỏi
 * thường.
 *
 * Thẻ đưa ra phê duyệt và một đường quay lại composer để yêu cầu sửa. Nó nhận đúng một câu hỏi mang kế
 * hoạch ở `detail` và lựa chọn duyệt có tên trong `intent`, tối đa một lựa chọn thay thế và không chọn
 * nhiều. Lựa chọn lớn hơn ở lại luồng câu hỏi thường.
 *
 * Nhận: questions — toàn bộ lô câu hỏi của yêu cầu.
 * Trả: bản duyệt đã thu hẹp, hoặc undefined khi luồng thường sở hữu yêu cầu.
 */
export function planReviewOf(questions: readonly QuestionItem[]): PlanReview | undefined {
  if (questions.length !== 1) return void 0;
  const question = questions[0];
  if (question === void 0) return void 0;
  const intent = question.intent;
  if (intent?.kind !== "plan-review" || question.detail === void 0) return void 0;
  if (question.multiSelect === true) return void 0;
  const options = question.options ?? [];
  if (options.length > 2) return void 0;
  const approve = options.find((option) => option.label === intent.approve);
  if (approve === void 0) return void 0;
  const decline = options.find((option) => option.label !== intent.approve);
  return {
    id: question.id,
    question: question.question,
    plan: question.detail,
    ...(intent.callId === void 0 ? {} : { callId: intent.callId }),
    approve,
    ...(decline === void 0 ? {} : { decline }),
  };
}

/** Tiền tố duy nhất theo lần nạp lại, để thẻ cũ không có tên không dùng lại được nháp đã lưu. */
const unnamedQuestionPrefix = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Số thứ tự của thẻ không có lời gọi công cụ. */
let nextQuestionKey = 0;

/** Thông điệp của ba mã từ chối (giữ nguyên chuỗi của bản gốc — dây chuyền giữ `name` và `code`). */
export const rejectionMessages = {
  ASK_ABORTED: "ask_user_question was aborted before the user answered",
  ASK_CANCELLED: "the user cancelled ask_user_question",
  ASK_TIMED_OUT: "ask_user_question timed out before the user answered",
} as const;

/** Mã từ chối mà Client trả qua waterfall. */
export type QuestionRejectionCode = keyof typeof rejectionMessages;

/** Lỗi mang mã từ chối được dây chuyền giữ lại. */
export interface QuestionError extends Error {
  /** Mã từ chối. */
  code: QuestionRejectionCode;
}

/**
 * Tạo một lỗi từ chối được dây chuyền giữ nguyên.
 * Nhận: code — mã từ chối.
 * Trả: lỗi có `name` = "UserQuestionError" và `code` đúng mã.
 */
function questionError(code: QuestionRejectionCode): QuestionError {
  const error = new Error(rejectionMessages[code]) as QuestionError;
  error.name = "UserQuestionError";
  error.code = code;
  return error;
}

/** Một kênh waterfall đang sống gắn vào thẻ; nó kết thúc đúng một lần rồi tự gỡ. */
export interface QuestionWaterfallChannel {
  /** Hạn chót theo đồng hồ Client, tính bằng mili giây epoch; vắng mặt với câu hỏi chặn. */
  readonly deadline: number | undefined;
  /** Kết thúc waterfall của Host bằng cả lô câu trả lời. */
  resolve(answer: QuestionAnswer): void;
  /** Từ chối waterfall của Host bằng một mã được dây chuyền giữ. */
  reject(code: Exclude<QuestionRejectionCode, "ASK_ABORTED">): void;
  /** Giao yêu cầu cho listener waterfall kế tiếp. */
  delegate(): void;
}

/** Đường trả lời Remote của một câu hỏi đã được "continued". */
export interface QuestionRpcChannel {
  /** Đưa câu trả lời vào agent; false khi câu hỏi không còn "continued". Từ chối khi đã có trả lời xếp hàng. */
  answer(answer: QuestionAnswer): Promise<boolean>;
}

/** Ghế composer mà thẻ chiếm khi đang hiển thị. */
export interface QuestionSeat {
  /** Rút thẻ khỏi sổ "pending interaction" mà không kết thúc yêu cầu. */
  hide(): void;
}

/** Một yêu cầu waterfall như listener Remote Event chờ nó. */
export interface QuestionWaterfallRequest {
  /** Kênh của yêu cầu. */
  readonly channel: QuestionWaterfallChannel;
  /** Kết quả trả về Host: câu trả lời, hoặc một lần từ chối được dây chuyền giữ. */
  readonly result: Promise<QuestionAnswer>;
  /**
   * Kiểm tra một lần từ chối có yêu cầu listener gọi `next()` không.
   * Nhận: reason — lý do từ chối nhận từ `result`.
   * Trả: có phải do `delegate` của kênh tạo ra không.
   */
  isDelegation(reason: unknown): boolean;
}

/**
 * Tạo waterfall Remote Event một lần mà listener kết thúc qua một thẻ.
 * Tín hiệu của yêu cầu kết thúc kênh bằng `ASK_ABORTED`; Host bỏ qua kết quả đó với sự kiện đã xong, nên
 * một khung huỷ không mất gì.
 *
 * Nhận: deadline — hạn chót theo đồng hồ Client (mili giây epoch) lấy từ thời lượng còn lại của chỗ chờ;
 * signal — vòng đời của yêu cầu được chuyển tiếp; onSettle — gọi một lần với kênh khi nó kết thúc hoặc bị huỷ.
 * Trả: kênh để gắn vào thẻ và lời hứa mà listener chờ.
 */
export function createWaterfallRequest(
  deadline: number | undefined,
  signal: AbortSignal | undefined,
  onSettle: (channel: QuestionWaterfallChannel) => void,
): QuestionWaterfallRequest {
  const completion = deferred<QuestionAnswer>();
  const delegated = Symbol("pending question delegated");
  let settled = false;
  const finish = (settle: () => void): void => {
    if (settled) return;
    settled = true;
    signal?.removeEventListener("abort", onAbort);
    settle();
    onSettle(channel);
  };
  const onAbort = (): void => {
    finish(() => {
      completion.reject(questionError("ASK_ABORTED"));
    });
  };
  const channel: QuestionWaterfallChannel = {
    deadline,
    resolve: (answer) => {
      finish(() => {
        completion.resolve(answer);
      });
    },
    reject: (code) => {
      finish(() => {
        completion.reject(questionError(code));
      });
    },
    delegate: () => {
      finish(() => {
        completion.reject(delegated);
      });
    },
  };
  if (signal !== undefined) {
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
  }
  return {
    channel,
    result: completion.promise,
    isDelegation: (reason) => reason === delegated,
  };
}

/** Trạng thái thẻ phản ứng mà mọi presentation đang mount của một câu hỏi cùng đọc. */
export interface QuestionCardSnapshot {
  /** Soi gương dòng mặt chiếu; `open` cho tới khi mặt chiếu nói khác. */
  readonly state: UserQuestionState;
  /** Cách trình bày chỗ chờ ở foreground. */
  readonly waitState: "counting" | "focused" | "editing" | "waiting" | "continued";
  /**
   * Cách trình bày đếm ngược, vắng mặt khi yêu cầu không mang hạn chót. Thẻ tự lo phần đếm, nên panel bị
   * ẩn vẫn đếm và vẫn hết hạn; `running` là false khi bị giữ hoặc đang sửa.
   */
  readonly countdown: {
    /** Thời gian còn lại. */
    readonly remainingMs: number;
    /** Đồng hồ có đang chạy không. */
    readonly running: boolean;
  } | undefined;
  /** Kênh mà một lần gửi sẽ dùng ngay bây giờ. */
  readonly channel: "waterfall" | "rpc" | "none";
  /** Đặt khi thẻ đã rời sổ; composer đang mount xoá nháp của nó trên cờ này. */
  readonly closed: boolean;
}

/**
 * Gói một lần kết thúc vào một lời hứa, đổi lỗi đồng bộ thành lời hứa bị từ chối.
 * Nhận: settle — thao tác kết thúc; failureMessage — thông điệp cho lỗi không phải `Error`.
 * Trả: lời hứa hoàn thành khi `settle` chạy xong.
 */
export function settlePendingComposer(settle: () => void, failureMessage: string): Promise<void> {
  try {
    settle();
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(failureMessage, { cause: error }));
  }
}

/**
 * Một thẻ Client trả lời được. Thẻ khoá theo lời gọi công cụ do nguồn nào đến trước tạo ra — waterfall được
 * chuyển tiếp hay mặt chiếu của phiên — và chỉ bị gỡ khi mặt chiếu không còn liệt kê lời gọi đó.
 */
export class PendingQuestion {
  /** Bộ phân biệt presentation mà consumer "pending interaction" của phiên dùng. */
  readonly kind: "question" | "plan-review";
  /** Danh tính render và khoá yêu cầu cho kho nháp theo phiên. */
  readonly key: string;
  /** Danh tính Agent/phiên sở hữu yêu cầu. */
  readonly sessionId: SessionId;
  /** Danh sách câu hỏi của yêu cầu. */
  readonly questions: readonly UserQuestionItem[];
  /** Danh tính lời gọi công cụ; vắng mặt với yêu cầu chặn không mang `wait`. */
  readonly callId: ToolCallId | undefined;
  /**
   * Câu trả lời đã ghi của một lời gọi đã xong. Chỉ có trên thẻ đọc-lại, do dòng lời gọi công cụ dựng từ
   * transcript của chính nó để câu hỏi đã xong đọc lại được trong panel đã hỏi. Thẻ như vậy không có kênh
   * trả lời và không đếm ngược.
   */
  readonly review: readonly UserQuestionAnswerItem[] | undefined;
  /**
   * Đóng panel thì làm gì. Thẻ khoá theo lời gọi công cụ vẫn mở lại được từ dòng của nó, nên đóng chỉ rút
   * panel (`hide`) và không lưu gì. Thẻ Host không đặt tên không có đường về, nên đóng là kết thúc yêu cầu
   * (`cancel`).
   */
  readonly dismissal: "hide" | "cancel";
  /** Trạng thái dòng đã chiếu. */
  #state: UserQuestionState = "open";
  /** Kênh waterfall đang sống. */
  #waterfall: QuestionWaterfallChannel | undefined;
  /** Đường trả lời Remote một khi câu hỏi đã "continued". */
  #rpc: QuestionRpcChannel | undefined;
  /** Ghế composer đã công bố thẻ. */
  #seat: QuestionSeat | undefined;
  /** Yêu cầu có hạn chót (đang đếm ngược). */
  #timedWait = false;
  /** Đồng hồ đếm ngược do thẻ tự sở hữu. */
  #timer: ReturnType<typeof setInterval> | undefined;
  /** Hạn chót đang chạy (mili giây epoch). */
  #deadline: number | undefined;
  /** Thời gian còn lại đã đóng băng. */
  #remainingMs: number | undefined;
  /** Bề mặt trả lời đang giữ focus. */
  #focused = false;
  /** Người dùng đã sửa nháp (không còn hạn foreground). */
  #engaged = false;
  /** Người dùng chọn "cứ từ từ". */
  #held = false;
  /** Thẻ đã rời sổ. */
  #closed = false;
  /** Khoá của mọi thẻ đang đăng ký cho phiên (để cắt nháp). */
  #siblings: (() => readonly string[]) | undefined;
  /** Người nghe thay đổi trạng thái. */
  #listeners = new Set<() => void>();
  /** Ảnh chụp ổn định hiện tại. */
  #snapshot: QuestionCardSnapshot;

  /**
   * Nhận: sessionId — danh tính Agent/phiên sở hữu yêu cầu; questions — cả lô câu hỏi; callId — danh tính
   * lời gọi công cụ khi Host đặt tên; siblings — khoá của mọi thẻ đang đăng ký cho phiên, để cắt nháp;
   * review — câu trả lời đã ghi của một lời gọi đã xong, biến thẻ thành bản đọc-lại.
   * Trả: không (khởi tạo thẻ).
   */
  constructor(
    sessionId: SessionId,
    questions: readonly UserQuestionItem[],
    callId?: ToolCallId,
    siblings?: () => readonly string[],
    review?: readonly UserQuestionAnswerItem[],
  ) {
    this.sessionId = sessionId;
    this.questions = questions;
    this.kind = planReviewOf(questions) === void 0 ? "question" : "plan-review";
    this.callId = callId;
    this.review = review;
    this.dismissal = callId === void 0 ? "cancel" : "hide";
    this.#siblings = siblings;
    if (callId === void 0) nextQuestionKey += 1;
    this.key = callId === void 0 ? `question:${unnamedQuestionPrefix}:${String(nextQuestionKey)}` : PendingQuestion.keyOf(sessionId, callId);
    this.#snapshot = this.createSnapshot();
  }

  /**
   * Khoá thẻ của một lời gọi công cụ, dùng chung cho mọi nguồn đặt tên nó. Yêu cầu của Host và mặt chiếu
   * của phiên mang `ToolCallId` đã brand; dòng transcript mang cùng giá trị dây chuyền dưới dạng chuỗi thường.
   * Nhận: sessionId — phiên sở hữu; callId — danh tính lời gọi công cụ, đã brand hoặc như transcript viết.
   * Trả: danh tính render và khoá nháp.
   */
  static keyOf(sessionId: SessionId, callId: string): string {
    return `question:${String(sessionId)}:${callId}`;
  }

  /**
   * Khoá nháp còn sống trong phiên này, kể cả thẻ này.
   * Nhận: không.
   * Trả: các khoá kho nháp phải giữ; mọi khoá khác là cũ.
   */
  liveKeys(): readonly string[] {
    return this.#siblings?.() ?? [this.key];
  }

  /**
   * Nghe thay đổi trạng thái của thẻ.
   * Nhận: listener — hàm gọi mỗi lần trạng thái đổi.
   * Trả: hàm gỡ đăng ký.
   */
  readonly subscribe: (listener: () => void) => () => void = (listener) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /**
   * Đọc trạng thái thẻ ổn định hiện tại.
   * Nhận: không.
   * Trả: ảnh chụp trạng thái.
   */
  readonly snapshot: () => QuestionCardSnapshot = () => this.#snapshot;

  /** Ảnh chụp quan sát được mà keyed Hook của renderer đọc (cùng một hàm với `snapshot`). */
  readonly getSnapshot: () => QuestionCardSnapshot = this.snapshot;

  /**
   * Dựng ảnh chụp từ các trường riêng.
   * Nhận: không.
   * Trả: ảnh chụp trạng thái thẻ.
   */
  createSnapshot(): QuestionCardSnapshot {
    const channel = this.#waterfall !== undefined ? "waterfall" : this.#state === "continued" && this.#rpc !== undefined ? "rpc" : "none";
    const waitState = this.#state === "continued" ? "continued" : this.#held ? "waiting" : this.#engaged ? "editing" : this.#focused ? "focused" : "counting";
    return {
      state: this.#state,
      waitState,
      countdown: this.#timedWait
        ? {
            remainingMs: this.#deadline === void 0 ? this.#remainingMs ?? 0 : Math.max(0, this.#deadline - Date.now()),
            running: this.#deadline !== void 0,
          }
        : void 0,
      channel,
      closed: this.#closed,
    };
  }

  /**
   * Công bố ảnh chụp mới cho người nghe và canh lại đồng hồ.
   * Nhận: không.
   * Trả: không.
   */
  publish(): void {
    this.#snapshot = this.createSnapshot();
    this.#reschedule();
    for (const listener of this.#listeners) listener();
  }

  /**
   * Tự sở hữu phần đếm ngược thay vì để component mount lo: panel có thể bị ẩn rồi mount lại trong khi yêu
   * cầu vẫn đứng, và một đồng hồ chết theo component sẽ để lời gọi công cụ chờ quá hạn.
   * Nhận: không.
   * Trả: không.
   */
  #reschedule(): void {
    const wanted = this.#deadline !== void 0 && !this.#closed;
    if (wanted === (this.#timer !== void 0)) return;
    if (!wanted) {
      clearInterval(this.#timer);
      this.#timer = void 0;
      return;
    }
    this.#timer = setInterval(() => {
      this.#tick();
    }, 1e3);
  }

  /**
   * Một nhịp đếm: hết hạn thì kết thúc waterfall, chưa thì công bố lại.
   * Nhận: không.
   * Trả: không.
   */
  #tick(): void {
    const deadline = this.#deadline;
    if (deadline === void 0) return;
    if (Date.now() >= deadline) {
      this.timeout();
      return;
    }
    this.publish();
  }

  /**
   * Gắn waterfall đang sống của một yêu cầu được chuyển tiếp.
   * Nhận: channel — kênh do `createWaterfallRequest` tạo.
   * Trả: không.
   */
  attachWaterfall(channel: QuestionWaterfallChannel): void {
    this.#waterfall = channel;
    this.#timedWait = channel.deadline !== void 0;
    if (!this.#held && !this.#engaged) {
      this.#deadline = channel.deadline;
      if (this.#focused && channel.deadline !== void 0) {
        this.#remainingMs = Math.max(0, channel.deadline - Date.now());
        this.#deadline = void 0;
      }
    }
    this.publish();
  }

  /**
   * Gỡ một kênh waterfall đã kết thúc hoặc bị huỷ; thẻ vẫn ở lại.
   * Nhận: channel — kênh vừa kết thúc.
   * Trả: không.
   */
  detachWaterfall(channel: QuestionWaterfallChannel): void {
    if (this.#waterfall !== channel) return;
    this.#waterfall = void 0;
    this.#timedWait = false;
    this.#deadline = void 0;
    this.publish();
  }

  /**
   * Có waterfall đang sống gắn vào thẻ không.
   * Nhận: không.
   * Trả: yêu cầu đang chờ của Host còn nhận kết thúc được không.
   */
  hasWaterfall(): boolean {
    return this.#waterfall !== void 0;
  }

  /**
   * Gắn đường trả lời Remote dùng khi câu hỏi đã "continued".
   * Nhận: channel — lời gọi Remote đã buộc vào phiên và lời gọi này.
   * Trả: không.
   */
  attachRpc(channel: QuestionRpcChannel): void {
    this.#rpc = channel;
    this.publish();
  }

  /**
   * Gắn ghế composer mà thẻ được công bố vào.
   * Nhận: seat — cách rút panel đã công bố, do sổ thẻ sở hữu.
   * Trả: không.
   */
  attachSeat(seat: QuestionSeat): void {
    this.#seat = seat;
  }

  /**
   * Chép trạng thái của dòng mặt chiếu.
   * Nhận: state — `open` hoặc `continued`.
   * Trả: không.
   */
  setState(state: UserQuestionState): void {
    if (this.#state === state) return;
    this.#state = state;
    this.publish();
  }

  /**
   * Dừng đồng hồ của Client vô thời hạn; waterfall sau đó chờ như câu hỏi chặn.
   * Nhận: không.
   * Trả: không.
   */
  takeTime(): void {
    if (this.#held) return;
    this.#held = true;
    this.#focused = false;
    this.#remainingMs = void 0;
    this.#deadline = void 0;
    this.publish();
  }

  /**
   * Ghi nhận focus kể cả trước khi yêu cầu tới, đóng băng đồng hồ còn nguyên vẹn khi nó được gắn.
   * Nhận: now — thời gian epoch hiện tại của Client.
   * Trả: không.
   */
  holdFocus(now = Date.now()): void {
    if (this.#held || this.#engaged || this.#focused) return;
    this.#remainingMs = this.#deadline === void 0 ? void 0 : Math.max(0, this.#deadline - now);
    this.#deadline = void 0;
    this.#focused = true;
    this.publish();
  }

  /**
   * Chạy tiếp đồng hồ còn nguyên vẹn sau khi bề mặt trả lời mất focus.
   * Nhận: now — thời gian epoch hiện tại của Client.
   * Trả: không.
   */
  releaseFocus(now = Date.now()): void {
    if (!this.#focused) return;
    this.#focused = false;
    this.#deadline = this.#timedWait && this.#remainingMs !== void 0 ? now + this.#remainingMs : void 0;
    this.#remainingMs = void 0;
    this.publish();
  }

  /**
   * Giữ nháp đã sửa đầu tiên trả lời được mà không có hạn foreground.
   * Nhận: now — thời gian epoch hiện tại của Client, dùng để giữ lại thời lượng còn lại.
   * Trả: không.
   */
  engage(now = Date.now()): void {
    if (this.#held || this.#engaged) return;
    if (this.#remainingMs === void 0 && this.#deadline !== void 0) this.#remainingMs = Math.max(0, this.#deadline - now);
    this.#engaged = true;
    this.#focused = false;
    this.#deadline = void 0;
    this.publish();
  }

  /**
   * Đồng hồ cục bộ về 0: kết thúc waterfall bằng `ASK_TIMED_OUT`, giữ thẻ lại.
   * Nhận: không.
   * Trả: không.
   */
  timeout(): void {
    if (this.#held || this.#engaged || this.#focused) return;
    const channel = this.#waterfall;
    if (channel === void 0) return;
    this.#waterfall = void 0;
    this.#timedWait = false;
    this.#deadline = void 0;
    channel.reject("ASK_TIMED_OUT");
    this.publish();
  }

  /**
   * Trao waterfall đang sống cho listener kế tiếp khi miền trình bày này gỡ.
   * Nhận: không.
   * Trả: không.
   */
  delegate(): void {
    this.#waterfall?.delegate();
  }

  /**
   * Đánh dấu thẻ đã rời sổ; composer đang mount xoá nháp của nó.
   * Nhận: không.
   * Trả: không.
   */
  close(): void {
    if (this.#closed) return;
    this.#closed = true;
    this.publish();
  }

  /**
   * Gửi cả lô câu trả lời qua waterfall đang sống, hoặc qua đường Remote khi câu hỏi đã "continued".
   * Nhận: answer — cả lô câu trả lời có cấu trúc.
   * Trả: lời hứa hoàn thành khi câu trả lời được nhận.
   */
  answer(answer: QuestionAnswer): Promise<void> {
    const waterfall = this.#waterfall;
    if (waterfall !== void 0)
      return settlePendingComposer(() => {
        waterfall.resolve(answer);
      }, "pending question settlement failed");
    const rpc = this.#rpc;
    if (this.#state === "continued" && rpc !== void 0)
      return rpc.answer(answer).then((accepted) => {
        if (!accepted) throw new Error("this question is no longer answerable");
      });
    return Promise.reject(new Error("no channel accepts an answer yet"));
  }

  /**
   * Đóng panel. Thẻ khoá theo lời gọi công cụ chỉ rời ghế composer: yêu cầu vẫn đứng, đồng hồ vẫn chạy ở
   * đây, và dòng lời gọi công cụ mở lại được. Thẻ Host không đặt tên thì kết thúc yêu cầu, vì không gì mang
   * nó về được.
   * Nhận: không.
   * Trả: lời hứa hoàn thành khi thao tác đóng xong.
   */
  dismiss(): Promise<void> {
    if (this.dismissal === "hide")
      return settlePendingComposer(() => {
        this.#seat?.hide();
      }, "pending question hide failed");
    const waterfall = this.#waterfall;
    if (waterfall === void 0) return Promise.reject(new Error("no channel accepts a cancellation yet"));
    return settlePendingComposer(() => {
      waterfall.reject("ASK_CANCELLED");
    }, "pending question cancellation failed");
  }
}

/** Giá trị đang chờ mà selector của chuỗi composer trả về. */
export type QuestionWait = PendingQuestion;

/**
 * Props đầy đủ của component: phần runtime chuẩn của framework (tiền tệ của chuỗi + bộ chuẩn phiên/toàn cục)
 * cộng phần `matched` của chuỗi — kết quả selector của entry, đã thu hẹp về carrier câu hỏi — cộng ghế copy
 * chuẩn; carrier và bề mặt miền ở trên mang toàn bộ bề mặt hành vi.
 */
export interface QuestionComposerProps {
  /** Yêu cầu đã khớp (carrier). */
  readonly matched: QuestionWait;
  /** Bộ dịch của namespace `question`. */
  readonly t: Translate;
  /** Hook đọc kho nháp của phiên qua selector. */
  readonly useStore: <T>(selector: (state: QuestionDraftState) => T) => T;
  /** Keyed Hook đọc ảnh chụp thẻ theo khoá (framework chuyển carrier thành ảnh chụp quan sát được). */
  readonly useQuestionCard: <T>(key: string, select: (snapshot: QuestionCardSnapshot | undefined) => T) => T;
  /** Bề mặt ghi của kho nháp, đã buộc sẵn khoá yêu cầu. */
  readonly actions: QuestionDraftBoundActions;
  /** Render một slot con theo tên. */
  readonly renderSlot: (name: string, owner: Record<string, unknown>) => unknown;
}
