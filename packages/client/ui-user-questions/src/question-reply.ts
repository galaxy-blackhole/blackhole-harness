/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Chieu va doc cau tra loi muon (1:1 lib/types/client/question-reply.js): boc payload, gia tri dap an, text clipboard va Definition node
 */

import { CHAT_NODE_KEY } from "./ids.ts";
import { isAppendSurfaceEvent } from "./session-surface.ts";
import type { ConversationNodeDefinition, ConversationViewNode, SurfaceEvent, Translate } from "./types.ts";

/** Một câu hỏi đã hỏi, như được lặp lại trong payload trả lời. */
export interface QuestionReplyQuestion {
  /** Định danh câu hỏi. */
  readonly id: string;
  /** Nội dung câu hỏi. */
  readonly question: string;
  /** Chi tiết phụ. */
  readonly detail?: string;
  /** Tiêu đề ngắn. */
  readonly header?: string;
  /** Các lựa chọn đã đưa ra. */
  readonly options?: readonly { readonly label: string; readonly description?: string }[];
  /** Câu hỏi cho chọn nhiều. */
  readonly multiSelect?: boolean;
}

/** Một câu trả lời có cấu trúc, như được lặp lại trong payload trả lời. */
export interface QuestionReplyAnswer {
  /** Định danh câu hỏi được trả lời. */
  readonly id: string;
  /** Nhãn các lựa chọn đã chọn. */
  readonly selected: readonly string[];
  /** Câu trả lời tự nhập. */
  readonly custom?: string;
}

/** Dữ liệu trình bày của một lần trả lời muộn. */
export interface QuestionReplyData {
  /** Lời gọi công cụ đã hỏi. */
  readonly callId: string;
  /** Một câu trả lời muộn cho các câu hỏi đang chờ. */
  readonly outcome: "answered";
  /** Các câu hỏi đã hỏi. */
  readonly questions: readonly QuestionReplyQuestion[];
  /** Các câu trả lời đã ghi. */
  readonly answers: readonly QuestionReplyAnswer[];
  /** Văn bản hướng mô hình, hiện khi payload không đọc được. */
  readonly text: string;
  /** Thời điểm của tin nhắn. */
  readonly time: number;
}

/** Trạng thái đã chiếu của node trả lời muộn. */
export interface QuestionReplyState extends QuestionReplyData {
  /** Số thứ tự của tin nhắn trong log. */
  readonly seq: number;
}

/**
 * Kiểm tra một giá trị có phải bản ghi thường (không mảng, không null).
 * Nhận: value — giá trị cần xét.
 * Trả: true khi là bản ghi.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Đọc cặp câu hỏi và câu trả lời ra khỏi văn bản trả lời ở ranh giới hội thoại.
 * Nhận: text — payload JSON hướng mô hình của tin nhắn được lái.
 * Trả: các cặp đã đọc, hoặc hai danh sách rỗng khi payload không đọc được.
 */
export function replyPairsOf(text: string): Pick<QuestionReplyData, "questions" | "answers"> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { questions: [], answers: [] };
  }
  if (!isRecord(value) || !Array.isArray(value.questions)) return { questions: [], answers: [] };
  const questions: QuestionReplyQuestion[] = [];
  for (const question of value.questions as unknown[]) {
    if (!isRecord(question) || typeof question.id !== "string" || typeof question.question !== "string") continue;
    questions.push({
      id: question.id,
      question: question.question,
      ...(typeof question.detail === "string" ? { detail: question.detail } : {}),
      ...(typeof question.header === "string" ? { header: question.header } : {}),
      ...(Array.isArray(question.options)
        ? {
            options: (question.options as unknown[]).flatMap((option) => {
              if (!isRecord(option) || typeof option.label !== "string") return [];
              return [
                {
                  label: option.label,
                  ...(typeof option.description === "string" ? { description: option.description } : {}),
                },
              ];
            }),
          }
        : {}),
      ...(typeof question.multiSelect === "boolean" ? { multiSelect: question.multiSelect } : {}),
    });
  }
  const answers: QuestionReplyAnswer[] = [];
  for (const answer of Array.isArray(value.answers) ? (value.answers as unknown[]) : []) {
    if (!isRecord(answer) || typeof answer.id !== "string" || !Array.isArray(answer.selected)) continue;
    answers.push({
      id: answer.id,
      selected: (answer.selected as unknown[]).filter((item): item is string => typeof item === "string"),
      ...(typeof answer.custom === "string" ? { custom: answer.custom } : {}),
    });
  }
  return { questions, answers };
}

/**
 * Giá trị câu trả lời của một câu hỏi theo thứ tự hiển thị: nhãn các lựa chọn đã chọn, rồi câu trả lời tự
 * nhập nếu không rỗng.
 * Nhận: data — bản trả lời đã chiếu, giữ câu trả lời đã ghi; id — câu hỏi cần đọc.
 * Trả: các giá trị; rỗng khi người dùng bỏ qua câu hỏi đó.
 */
export function replyAnswerValues(data: QuestionReplyData, id: string): string[] {
  const answer = data.answers.find((item) => item.id === id);
  const custom = answer?.custom?.trim() ?? "";
  return [...(answer?.selected ?? []), ...(custom === "" ? [] : [custom])];
}

/**
 * Văn bản clipboard của một lần trả lời muộn: mọi câu hỏi kèm câu trả lời người dùng đã đưa, theo đúng bố
 * cục bong bóng đang mở, không kèm lựa chọn không ai chọn. Văn bản không phụ thuộc bong bóng mở hay đóng.
 * Nhận: data — bản trả lời đã chiếu; t — bộ dịch namespace `question` đã buộc, sở hữu nhãn câu trả lời.
 * Trả: một khối cho mỗi câu hỏi, hoặc văn bản hướng mô hình khi payload không đọc được.
 */
export function replyClipboardText(data: QuestionReplyData, t: Translate): string {
  if (data.questions.length === 0) return data.text;
  return data.questions
    .map((question) => {
      const values = replyAnswerValues(data, question.id);
      const heading = question.header && question.header !== question.question ? `${question.header} — ${question.question}` : question.question;
      return `${heading}\n${values.length === 0 ? t("reply.skipped") : `${t("reply.answerLabel")}${values.join(", ")}`}`;
    })
    .join("\n\n");
}

/**
 * Kiểm tra nguồn của một tin nhắn trả lời muộn ở ranh giới hội thoại đã lưu.
 * Nhận: event — tin nhắn người dùng cần xét.
 * Trả: nguồn đã chuẩn hoá, hoặc null khi không phải trả lời muộn đọc được.
 */
function replySource(event: SurfaceEvent): { callId: string; outcome: "answered" } | null {
  const source = event.data.source;
  return isRecord(source) && source.kind === "user-question-reply" && typeof source.callId === "string" && source.outcome === "answered"
    ? { callId: source.callId, outcome: "answered" }
    : null;
}

/** Phép chiếu trả lời muộn do UI câu hỏi sở hữu. Nó nhận tin nhắn trả lời trên đích Chat, nên Definition tin nhắn chung không bao giờ trình bày nó. */
export const questionReplyDefinition: ConversationNodeDefinition<QuestionReplyState> = {
  kind: "user-question-reply",
  target: "chat",
  match: (event) => {
    if (event.type !== "user/message" || !isAppendSurfaceEvent(event)) return null;
    return replySource(event) === null
      ? null
      : {
          id: String(event.data.id),
          role: "start",
          exclusive: true,
        };
  },
  start: (_context, match) => {
    if (match.event.type !== "user/message") throw new Error("user-question-reply start requires user/message");
    const event = match.event;
    const text = event.data.content.find((item) => item.type === "text")?.text ?? "";
    const source = replySource(event);
    if (source === null) throw new Error("user-question-reply start requires a reply source");
    return {
      seq: event.seq,
      time: event.time,
      callId: source.callId,
      outcome: source.outcome,
      text,
      ...replyPairsOf(text),
    };
  },
  update: (context) => context.state,
  buildViewNode: (context): ConversationViewNode | null => {
    if (context.state === undefined) return null;
    const { seq, ...data } = context.state;
    return {
      key: context.key,
      kind: CHAT_NODE_KEY,
      id: context.id,
      target: "chat",
      anchorSeq: seq,
      location: context.start?.location ?? { kind: "unresolved" },
      visibility: "visible",
      data,
    };
  },
};
