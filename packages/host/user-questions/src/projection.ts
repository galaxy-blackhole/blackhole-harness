/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phép gấp trạng thái câu hỏi có hẹn giờ từ log phiên + định nghĩa đơn vị chiếu
 *      `userQuestions` mà mọi Client đọc (bản gốc: `lib/types/projection.js`).
 */
import { z } from "zod/v4";

import { SessionLogOffset } from "./brand.ts";
import { isRecord } from "./errors.ts";
import { isTimedAskUserQuestionSchema, projectionViewSchema, questionsOf, answerBatchOf, isPendingResult } from "./schemas.ts";
import type {
  AskUserQuestionAnswerItem,
  PendingUserQuestion,
  SessionEvent,
  SessionEventData,
  UserQuestionFold,
  UserQuestionProjectionState,
  UserQuestionProjectionView,
} from "./types.ts";

/**
 * Mã lỗi mà tầng phiên gắn cho một lời gọi tool chưa bao giờ kết thúc (sửa lúc khôi phục phiên).
 * Sao lại hằng của `@deepseek-ai/dsh-session` (ngoài bảng seam) — giá trị là một chuỗi ổn định.
 */
const TOOL_OUTCOME_UNKNOWN = "TOOL_OUTCOME_UNKNOWN";

/** Trạng thái gấp ban đầu: chưa biết có hẹn giờ hay không, chưa có lời gọi nào. */
export const initialFold: UserQuestionFold = {
  timed: false,
  questions: { active: [], settled: [] },
};

/** Trạng thái bền của đơn vị chiếu: phần gấp cộng mốc tiền tố thừa hưởng. */
const projectionStateSchema = z
  .object({
    inheritedEventCount: z
      .number()
      .int()
      .nonnegative()
      .max(Number.MAX_SAFE_INTEGER)
      .transform((value) => SessionLogOffset(value)),
    timed: z.boolean(),
    questions: projectionViewSchema,
  })
  .strict();

/** Khuôn một định nghĩa đơn vị chiếu phiên — đúng phần mà sổ chiếu của kernel gọi tới. */
export interface SessionProjectionDefinition {
  /** Khoá đơn vị chiếu trên dây. */
  readonly key: string;
  /** Schema kiểm trạng thái bền đã ghi. */
  readonly stateSchema: { parse(value: unknown): UserQuestionProjectionState };
  /**
   * Trạng thái ban đầu của một phiên.
   * Nhận: `header` — header phiên (không dùng); `inheritedEventCount` — độ dài tiền tố thừa hưởng.
   * Trả: trạng thái gấp rỗng kèm mốc thừa hưởng.
   */
  readonly init: (header: unknown, inheritedEventCount: SessionLogOffset) => UserQuestionProjectionState;
  /**
   * Áp một sự kiện phiên lên trạng thái.
   * Nhận: `state` — trạng thái hiện tại; `event` — sự kiện kế tiếp theo thứ tự ghi.
   * Trả: chính trạng thái đó khi sự kiện không liên quan, ngược lại trạng thái mới.
   */
  readonly apply: (state: UserQuestionProjectionState, event: SessionEvent) => UserQuestionProjectionState;
  /** Phần dây: schema kiểm ảnh chụp và phép rút ảnh chụp ra khỏi trạng thái. */
  readonly wire: {
    /** Schema kiểm ảnh chụp trước khi rời Host. */
    readonly viewSchema: { parse(value: unknown): UserQuestionProjectionView };
    /**
     * Rút ảnh chụp từ trạng thái gấp.
     * Nhận: `state` — trạng thái bền.
     * Trả: hai nửa trạng thái mà Client đọc.
     */
    readonly view: (state: UserQuestionProjectionState) => UserQuestionProjectionView;
  };
  /** Phiên bản trạng thái: đổi nó là từ chối mọi hàng đã ghi ở phiên bản cũ. */
  readonly stateVersion: number;
}

/**
 * Chốt một câu hỏi còn trả lời được và giữ lô câu trả lời đã chốt nó.
 * Nhận: `view` — trạng thái hiện tại; `callId` — lời gọi mà kết quả hoặc lời đáp nêu tên; `answers` — lô đi kèm.
 * Trả: chính `view` khi lời gọi đó không còn trả lời được, ngược lại trạng thái đã cập nhật.
 */
export function settleQuestion(
  view: UserQuestionProjectionView,
  callId: PendingUserQuestion["callId"],
  answers: readonly AskUserQuestionAnswerItem[],
): UserQuestionProjectionView {
  const question = view.active.find((item) => item.callId === callId);
  if (question === undefined) return view;
  return {
    active: view.active.filter((item) => item.callId !== callId),
    settled: [...view.settled, { callId: question.callId, answers }],
  };
}

/**
 * Áp một sự kiện phiên lên phép gấp câu hỏi của phiên đó.
 *
 * `request/header` quyết định, từ danh sách schema tool nó ghi, các lời gọi `ask_user_question` theo
 * sau có hẹn giờ hay không; lời gọi dưới schema cũ (chặn) không bao giờ được theo dõi, nên phiên chỉ
 * dùng tool cũ gấp thành ảnh chụp rỗng. Một câu hỏi đã theo dõi còn trả lời được ở trạng thái
 * `continued` trong đúng hai trường hợp: kết quả tool mang thân "còn treo", hoặc bước sửa lúc khôi
 * phục phiên gắn thêm kết quả `TOOL_OUTCOME_UNKNOWN` cho lời gọi chưa bao giờ kết thúc. Lô câu trả
 * lời chốt nó với chính lô đó; mọi thất bại khác thì bỏ nó đi. Lời gọi con của PTC vào phép gấp khi
 * kết quả đã ghi của nó là "còn treo". Lời đáp muộn chỉ chốt khi agent đã nhận tin nhắn người dùng.
 * Nhận: `fold` — trạng thái gấp hiện tại; `event` — sự kiện phiên kế tiếp theo thứ tự ghi.
 * Trả: chính `fold` khi sự kiện không liên quan, ngược lại trạng thái đã cập nhật.
 */
export function applyUserQuestionEvent(fold: UserQuestionFold, event: SessionEvent): UserQuestionFold {
  const view = fold.questions;
  const data: SessionEventData = event.data;
  switch (event.type) {
    case "request/header": {
      const tools = data.header?.tools;
      const timed =
        Array.isArray(tools) &&
        tools.some(
          (tool) =>
            isRecord(tool) &&
            typeof tool["name"] === "string" &&
            isRecord(tool["parameters"]) &&
            isTimedAskUserQuestionSchema({
              name: tool["name"],
              parameters: tool["parameters"] as Record<string, unknown>,
            }),
        );
      return timed === fold.timed ? fold : { ...fold, timed };
    }
    case "tool/call": {
      if (!fold.timed || data.name !== "ask_user_question") return fold;
      // Bản gốc đưa thẳng trường đã ghi vào JSON.parse; ở đây ép về chuỗi đúng như vậy (undefined
      // và object đều trượt parse ⇒ null ⇒ sự kiện không liên quan), không "cứu" dữ liệu sai hình dạng.
      const questions = questionsOf(typeof data.arguments === "string" ? data.arguments : String(data.arguments));
      if (questions === null) return fold;
      const callId = data.callId;
      if (callId === undefined) return fold;
      return {
        ...fold,
        questions: {
          ...view,
          active: [...view.active.filter((question) => question.callId !== callId), { callId, questions, state: "open" }],
        },
      };
    }
    case "tool/result": {
      const message = data.message;
      if (message?.toolCallId === undefined) return fold;
      const callId = message.toolCallId;
      if (!view.active.some((question) => question.callId === callId)) return fold;
      const content = message.content ?? [];
      if (isPendingResult(content) || data.error?.code === TOOL_OUTCOME_UNKNOWN) {
        return {
          ...fold,
          questions: {
            ...view,
            active: view.active.map((question) =>
              question.callId === callId ? { ...question, state: "continued" } : question,
            ),
          },
        };
      }
      const answers = data.error === undefined && message.isError !== true ? answerBatchOf(content) : null;
      return {
        ...fold,
        questions:
          answers === null
            ? { ...view, active: view.active.filter((question) => question.callId !== callId) }
            : settleQuestion(view, callId, answers),
      };
    }
    case "tool/ptc-dispatch": {
      if (data.name !== "ask_user_question" || data.isError === true || !isPendingResult(data.content ?? [])) return fold;
      const questions = questionsOf(JSON.stringify(data.arguments));
      if (questions === null) return fold;
      const callId = data.subCallId;
      if (callId === undefined) return fold;
      return {
        ...fold,
        questions: {
          ...view,
          active: [...view.active.filter((question) => question.callId !== callId), { callId, questions, state: "continued" }],
        },
      };
    }
    case "user/message": {
      const source = data.source;
      if (source?.kind !== "user-question-reply" || source.callId === undefined) return fold;
      const questions = settleQuestion(view, source.callId, answerBatchOf(data.content ?? []) ?? []);
      return questions === view ? fold : { ...fold, questions };
    }
    default:
      return fold;
  }
}

/** Đơn vị chiếu phiên phơi câu hỏi có hẹn giờ (đang mở, đã chuyển lượt, đã chốt) cho mọi Client. */
export const userQuestionProjectionDefinition: SessionProjectionDefinition = {
  key: "userQuestions",
  stateSchema: projectionStateSchema,
  init: (_header, inheritedEventCount) => ({ inheritedEventCount, ...initialFold }),
  apply: (state, event) => {
    if (event.seq < state.inheritedEventCount) return state;
    const fold = applyUserQuestionEvent(state, event);
    return fold === state ? state : { ...state, ...fold };
  },
  wire: {
    viewSchema: projectionViewSchema,
    view: (state) => state.questions,
  },
  stateVersion: 2,
};
