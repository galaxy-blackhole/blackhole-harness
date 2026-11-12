/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hàng tool cho lời gọi ask_user_question: đọc câu hỏi và câu trả lời từ dây, ghép cặp, chọn thẻ hội đáp và đăng ký slot tool.call.toolview
 */

import { jsxRuntime, primitives, react } from "./runtime.ts";
import { CONVERSATION_NS } from "./ids.ts";
import { QuestionToolRow } from "./components-core.ts";
import { ToolRow } from "./component-tool-row.ts";
import { singleResultText, toolRowModel } from "./model-tool-call.ts";
import type { ToolviewScope } from "./types.ts";

/** Dữ liệu thô đọc từ dây (khối gọi tool · kết quả · hàm dịch của slot) — giữ 'any' cho gọn như bản gốc không đặt kiểu. */
type Wire = any;

/** Ghế dịch của hội thoại: nhận khoá và tham số nội suy, trả chuỗi đã bản địa hoá. */
type TranslateSeat = (key: string, params?: Record<string, unknown>) => string;

/** Một lựa chọn của câu hỏi đã đọc từ tham số gọi tool. */
interface AskOption {
  /** Nhãn người dùng nhìn thấy. */
  label: string;
  /** Mô tả phụ của lựa chọn; chỉ có khi bản gốc có. */
  description?: string;
}

/** Một câu hỏi đã qua kiểm tra từ tham số gọi tool. */
interface AskQuestionEntry {
  /** Id ổn định của câu hỏi. */
  id: string;
  /** Văn bản câu hỏi. */
  question: string;
  /** Tiêu đề ngắn; chỉ có khi bản gốc có. */
  header?: string;
  /** Chi tiết dài; chỉ có khi bản gốc có. */
  detail?: string;
  /** Danh sách lựa chọn; chỉ có khi bản gốc có. */
  options?: AskOption[];
  /** Cho phép chọn nhiều; chỉ có khi bản gốc có. */
  multiSelect?: boolean;
}

/** Một câu trả lời đã ghi trong JSON kết quả. */
interface AskAnswerEntry {
  /** Id câu hỏi mà câu trả lời này thuộc về. */
  id: string;
  /** Các lựa chọn đã chọn. */
  selected: string[];
  /** Câu trả lời tự nhập; chỉ có khi bản gốc có. */
  custom?: string;
}

/** Một câu hỏi đã ghép được với câu trả lời của nó. */
interface AnsweredPair {
  /** Id câu hỏi. */
  id: string;
  /** Văn bản câu hỏi. */
  question: string;
  /** Câu trả lời đã chọn, kèm câu tự nhập khi có. */
  answers: string[];
}

/** Bản ghi đã ghép cặp để bảng trả lời đọc lại. */
interface AnsweredRecord {
  /** Câu hỏi của lời gọi. */
  questions: AskQuestionEntry[];
  /** Câu trả lời đã ghi. */
  answers: AskAnswerEntry[];
}

/** Thẻ hội đáp của hàng: hoặc đã trả lời, hoặc chưa trả lời. */
type AskTranscript =
  | {
      /** Thẻ đã trả lời. */
      kind: "answered";
      /** Câu hỏi kèm câu trả lời. */
      questions: AnsweredPair[];
      /** Nhãn hiện khi câu hỏi bị bỏ qua. */
      skippedLabel: string;
    }
  | {
      /** Thẻ chưa trả lời. */
      kind: "unanswered";
      /** Câu hỏi chưa có câu trả lời. */
      questions: AskQuestionEntry[];
      /** Kết luận của phiên hỏi. */
      verdict: string;
    };

/** Vật liệu hàng đã trả lời cần: tóm tắt · thẻ hội đáp · bản ghi cho bảng trả lời. */
interface AnsweredPresentationResult {
  /** Dòng tóm tắt đã bản địa hoá. */
  summary: string;
  /** Thẻ hội đáp, hoặc null khi không ghép được cặp. */
  transcript: AskTranscript | null;
  /** Bản ghi cho bảng trả lời, hoặc undefined khi không ghép được cặp. */
  record: AnsweredRecord | undefined;
}

/** Tham số của hàng câu hỏi do bộ đăng ký slot truyền vào. */
interface AskQuestionRowProps {
  /** Id lời gọi tool mà hàng này đại diện. */
  callId: string;
  /** Tên tool — luôn là ask_user_question. */
  toolName: string;
  /** Khối gọi tool thô đọc từ dây. */
  block: Wire;
  /** Nhảy tới lời gọi này trong khung nhìn quỹ đạo. */
  inspect?: (() => void) | undefined;
  /** Trạng thái mở rộng do hàng tự sở hữu. */
  useDisclosure: () => { expanded: boolean; toggle: () => void };
  /** Chọn dữ liệu chiếu từ view của hội thoại. */
  useProjection: (name: string, selector: (view: Wire) => Wire) => Wire;
  /** Mở bảng trả lời cho lời gọi; trả true khi đã xử lý. */
  revealPanel: (callId: string) => boolean;
  /** Mở bảng trả lời ở chế độ xem lại bản ghi; trả true khi đã xử lý. */
  reviewPanel: (callId: string, record: Wire) => boolean;
  /** Ghế dịch của hội thoại. */
  t: TranslateSeat;
}

/** Phạm vi mở rộng của toolview này: bản gốc lấy bảng trả lời qua ctx.get(name) — kiểu ToolviewScope dùng chung không khai. */
interface AskPanelHostScope extends ToolviewScope {
  /** Tra cứu một dịch vụ theo tên; thiếu thì hàng câu hỏi không mở được bảng trả lời. */
  get?: (name: string) => Wire;
}

/**
 * Kiểm một giá trị có phải bản ghi (đối tượng không phải mảng, không phải null).
 * Nhận: value — giá trị bất kỳ đọc từ dây.
 * Trả: true khi value là đối tượng không phải mảng.
 */
export function isRecord(value: unknown): value is Record<string, Wire> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Đọc JSON từ một chuỗi, nuốt lỗi cú pháp.
 * Nhận: text — chuỗi JSON đọc từ dây.
 * Trả: giá trị đã phân tích, hoặc undefined khi chuỗi không phải JSON hợp lệ.
 */
export function parseJson(text: string): Wire {
  try {
    return JSON.parse(text);
  } catch {
    return;
  }
}

/** Answer records from the result JSON; null when the result is malformed. */
export function answerEntries(text: string): AskAnswerEntry[] | null {
  const parsed = parseJson(text);
  if (!isRecord(parsed)) return null;
  const answers = parsed.answers;
  if (!Array.isArray(answers) || !answers.every(isRecord)) return null;
  const entries: AskAnswerEntry[] = [];
  for (const answer of answers) {
    if (typeof answer.id !== "string" || !Array.isArray(answer.selected) || !answer.selected.every((item) => typeof item === "string") || answer.custom !== void 0 && typeof answer.custom !== "string") return null;
    entries.push({
      id: answer.id,
      selected: answer.selected,
      ...answer.custom === void 0 ? {} : { custom: answer.custom }
    });
  }
  return entries;
}

/** Answers from a submitted steer that still awaits admission to a step. */
export function queuedAnswerEntries(message: unknown, callId: string): AskAnswerEntry[] | null {
  if (!isRecord(message) || !Array.isArray(message.content)) return null;
  const content = message.content[0];
  if (!isRecord(content) || content.type !== "text" || typeof content.text !== "string") return null;
  const parsed = parseJson(content.text);
  if (!isRecord(parsed) || parsed.kind !== "answer_to_pending_question" || parsed.callId !== callId) return null;
  return answerEntries(content.text);
}

/** One question's choices from call JSON; absent when any entry is malformed. */
export function optionEntries(value: unknown): AskOption[] | undefined {
  if (!Array.isArray(value)) return void 0;
  const options: AskOption[] = [];
  for (const option of value) {
    if (!isRecord(option) || typeof option.label !== "string") return void 0;
    options.push({
      label: option.label,
      ...typeof option.description === "string" ? { description: option.description } : {}
    });
  }
  return options;
}

/**
* Questions from call JSON; null when pairing with answers would be ambiguous.
* The optional presentation fields are carried for the read-only answer panel,
* which renders the same option lists the user chose from; a malformed one is
* dropped rather than failing the whole call, because the transcript card needs
* only the id and the question text.
*/
export function questionEntries(argsRaw: string): AskQuestionEntry[] | null {
  const parsed = parseJson(argsRaw);
  if (!isRecord(parsed) || !Array.isArray(parsed.questions) || parsed.questions.length === 0) return null;
  const questions: AskQuestionEntry[] = [];
  const ids = new Set<string>();
  for (const question of parsed.questions) {
    if (!isRecord(question) || typeof question.id !== "string" || typeof question.question !== "string" || ids.has(question.id)) return null;
    ids.add(question.id);
    const options = optionEntries(question.options);
    questions.push({
      id: question.id,
      question: question.question,
      ...typeof question.header === "string" ? { header: question.header } : {},
      ...typeof question.detail === "string" ? { detail: question.detail } : {},
      ...options === void 0 ? {} : { options },
      ...typeof question.multi_select === "boolean" ? { multiSelect: question.multi_select } : {}
    });
  }
  return questions;
}

/** Pair questions with result entries by their echoed stable ids. */
export function pairAnswers(questions: AskQuestionEntry[], answers: AskAnswerEntry[]): AnsweredPair[] | null {
  if (questions.length !== answers.length) return null;
  const byId = new Map<string, AskAnswerEntry>();
  for (const answer of answers) {
    if (byId.has(answer.id)) return null;
    byId.set(answer.id, answer);
  }
  const paired: AnsweredPair[] = [];
  for (const question of questions) {
    const answer = byId.get(question.id);
    if (answer === void 0) return null;
    paired.push({
      id: question.id,
      question: question.question,
      answers: [...answer.selected, ...answer.custom === void 0 || answer.custom === "" ? [] : [answer.custom]]
    });
  }
  return paired;
}

/**
* Answer summary, transcript content, and panel material from one recorded
* answer batch, whether the result carried it in time or a late reply did.
* @param questions - The call's questions, or null when they failed validation.
* @param answers - The recorded answer batch.
* @param t - Row translator.
* @returns What the answered row shows.
*/
export function answeredPresentation(questions: AskQuestionEntry[] | null, answers: AskAnswerEntry[], t: TranslateSeat): AnsweredPresentationResult {
  const answered = answers.filter((answer) => answer.selected.length > 0 || (answer.custom ?? "") !== "").length;
  const paired = questions === null ? null : pairAnswers(questions, answers);
  return {
    summary: t("ask.answered", {
      answered,
      total: answers.length
    }),
    transcript: paired === null ? null : {
      kind: "answered",
      questions: paired,
      skippedLabel: t("ask.skipped")
    },
    record: paired === null || questions === null ? void 0 : {
      questions,
      answers
    }
  };
}

/** Best-effort answered-count summary when strict transcript pairing fails. */
export function answeredSummary(text: string, t: TranslateSeat): string | null {
  const parsed = parseJson(text);
  if (!isRecord(parsed)) return null;
  const answers = parsed.answers;
  if (!Array.isArray(answers) || !answers.every(isRecord)) return null;
  const answered = answers.filter((a) => Array.isArray(a.selected) && a.selected.length > 0 || typeof a.custom === "string" && a.custom !== "").length;
  return t("ask.answered", {
    answered,
    total: answers.length
  });
}

/** Whether a successful tool result records a still-answerable timed question. */
export function isPendingResult(text: string): boolean {
  const parsed = parseJson(text);
  return isRecord(parsed) && parsed.pending === true && typeof parsed.callId === "string";
}

/** Summarizes a pending, answered, cancelled, or interrupted question set. */
export function AskQuestionRow({ callId, toolName, block, inspect, useDisclosure, useProjection, revealPanel, reviewPanel, t }: AskQuestionRowProps): unknown {
  const model = toolRowModel(toolName, block);
  const answerable = useProjection("userQuestions", (view) => view?.active.some((row: Wire) => row.callId === callId) ?? false);
  const settled = useProjection("userQuestions", (view) => view?.settled.find((row: Wire) => row.callId === callId));
  const queuedReply = useProjection("inbox", (view) => {
    const matches = (message: Wire): boolean => {
      const source = isRecord(message) ? message.source : void 0;
      return isRecord(source) && source.kind === "user-question-reply" && source.callId === callId;
    };
    return view?.["next-step"].find(matches) ?? view?.["next-turn"].find(matches);
  });
  const reopen = react.useCallback!(() => revealPanel(callId), [callId, revealPanel]);
  const code = "kind" in block ? block.error?.code : void 0;
  const argsRaw = model.bodyRaw ?? "";
  let summary = model.summary;
  let state: string = model.state;
  let transcript: AskTranscript | null = null;
  let rowAction: (() => boolean) | undefined;
  let rowActionLabel = t("ask.reopen");
  if (code === "ASK_CANCELLED") {
    summary = t("ask.cancelled");
    state = "ok";
    const questions = questionEntries(argsRaw);
    if (questions !== null) transcript = {
      kind: "unanswered",
      questions,
      verdict: t("ask.cancelledDetail")
    };
  } else if (code === "ASK_ABORTED") {
    summary = t("ask.interrupted");
    state = "stopped";
    const questions = questionEntries(argsRaw);
    if (questions !== null) transcript = {
      kind: "unanswered",
      questions,
      verdict: t("ask.interruptedDetail")
    };
  } else if (model.state === "running") {
    summary = t("ask.waiting");
    if (answerable) rowAction = reopen;
  } else if (code === "TOOL_OUTCOME_UNKNOWN" && (answerable || settled !== void 0)) {
    state = "ok";
    const questions = questionEntries(argsRaw);
    if (answerable) {
      summary = t("ask.pending");
      if (questions !== null) transcript = {
        kind: "unanswered",
        questions,
        verdict: t("ask.pendingDetail")
      };
      rowAction = reopen;
    } else if (settled?.answers.length === 0) {
      summary = t("ask.closed");
      if (questions !== null) transcript = {
        kind: "unanswered",
        questions,
        verdict: t("ask.closedDetail")
      };
    } else if (settled !== void 0) {
      const presentation = answeredPresentation(questions, settled.answers, t);
      summary = presentation.summary;
      transcript = presentation.transcript;
      const record = presentation.record;
      if (record !== void 0) {
        rowAction = () => reviewPanel(callId, record);
        rowActionLabel = t("ask.review");
      }
    }
  } else if ("kind" in block && model.state === "ok") {
    const text = singleResultText(block);
    if (text !== void 0) {
      const questions = questionEntries(argsRaw);
      const pending = isPendingResult(text);
      if (pending && answerable) {
        summary = t("ask.pending");
        if (questions !== null) transcript = {
          kind: "unanswered",
          questions,
          verdict: t("ask.pendingDetail")
        };
        rowAction = reopen;
      } else if (pending && (settled === void 0 || settled.answers.length === 0)) {
        summary = t("ask.closed");
        if (questions !== null) transcript = {
          kind: "unanswered",
          questions,
          verdict: t("ask.closedDetail")
        };
      } else {
        const answers = settled?.answers ?? answerEntries(text);
        const presentation = answers === null ? null : answeredPresentation(questions, answers, t);
        summary = presentation?.summary ?? answeredSummary(text, t) ?? model.summary;
        transcript = presentation?.transcript ?? null;
        const record = settled === void 0 ? void 0 : presentation?.record;
        if (record !== void 0) {
          rowAction = () => reviewPanel(callId, record);
          rowActionLabel = t("ask.review");
        }
      }
    }
  }
  if (answerable && queuedReply !== void 0 && rowAction === reopen) {
    const answers = queuedAnswerEntries(queuedReply, callId);
    const presentation = answers === null ? null : answeredPresentation(questionEntries(argsRaw), answers, t);
    if (presentation?.record !== void 0) {
      summary = presentation.summary;
      transcript = presentation.transcript;
      rowAction = () => false;
      rowActionLabel = t("ask.review");
    }
  }
  if (rowAction !== void 0) return jsxRuntime.jsx(QuestionToolRow, {
    useDisclosure,
    t,
    summary,
    bodyRaw: transcript === null ? model.bodyRaw : null,
    output: transcript === null ? model.output : null,
    askQuestion: transcript,
    state,
    inspect,
    openPanel: rowAction,
    panelLabel: rowActionLabel
  });
  return jsxRuntime.jsx(ToolRow, {
    useDisclosure,
    t,
    variant: model.variant,
    toolName,
    icon: jsxRuntime.jsx(primitives.IconQuestionOutlineRegular, {}),
    title: t(model.titleKey),
    summary,
    bodyRaw: transcript === null ? model.bodyRaw : null,
    output: transcript === null ? model.output : null,
    askQuestion: transcript,
    state,
    inspect
  });
}

/**
 * Registers the ask-user-question conversation row.
 * Nhận: ctx — phạm vi slot mà mặt plugin truyền xuống (slots, và get khi tầng nạp cấp).
 * Trả: không có — chỉ tiêm vào slot tool.call.toolview một lượt đăng ký cho key ask_user_question.
 */
export function registerAskQuestionToolview(ctx: ToolviewScope): void {
  const host = ctx as unknown as AskPanelHostScope;
  ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
    name: "tool.call.toolview",
    key: "ask_user_question",
    locale: CONVERSATION_NS,
    inject: (sessionId: string) => ({
      revealPanel: (callId: string) => host.get?.("userQuestionPanels")?.reveal(sessionId, callId) ?? false,
      reviewPanel: (callId: string, record: Wire) => host.get?.("userQuestionPanels")?.review(sessionId, callId, record) ?? false
    })
  }, AskQuestionRow));
}
