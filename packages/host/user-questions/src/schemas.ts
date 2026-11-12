/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Đọc dữ liệu ĐÃ GHI trong log phiên: tham số tool `ask_user_question`, lô câu trả lời, và
 *      dấu "còn treo". Schema ở đây đối chiếu từng bước với bản gốc (cùng zod v4 như bản gốc).
 */
import { ToolCallId } from "@deepseek-ai/dsh-llm";
import { z } from "zod/v4";

import type { AskUserQuestionAnswerItem, AskUserQuestionItem, ContentBlock } from "./types.ts";

/**
 * Tham số chỉ schema tool có hẹn giờ mới khai.
 *
 * Sự CÓ MẶT của nó trong header yêu cầu đã ghi log là thứ cho phép phép gấp biết rằng các lời gọi
 * `ask_user_question` theo sau có thể được tiếp tục sau khi hết hạn; schema cũ (chặn) không bao
 * giờ khai tham số này.
 */
export const TIMED_WAIT_PARAMETER = "timeout";

/** Một lựa chọn trong tham số tool: chỉ cần nhãn, ngữ cảnh là tuỳ chọn. */
const toolOptionSchema = z.object({ label: z.string(), description: z.string().optional() }).loose();

/** Một câu hỏi trong tham số tool (khoá `multi_select` theo lối snake_case của mô hình). */
const toolQuestionSchema = z
  .object({
    id: z.string(),
    question: z.string(),
    header: z.string().optional(),
    options: z.array(toolOptionSchema).optional(),
    multi_select: z.boolean().optional(),
  })
  .loose();

/** Tham số tool `ask_user_question`: ít nhất một câu hỏi. */
const toolArgumentsSchema = z.object({ questions: z.array(toolQuestionSchema).min(1) }).loose();

/** Một lựa chọn trong từ vựng của dịch vụ: chặt, và bỏ hẳn khoá vắng mặt. */
const optionSchema = z
  .object({ label: z.string(), description: z.string().optional() })
  .strict()
  .transform((option) => ({
    label: option.label,
    ...(option.description === undefined ? {} : { description: option.description }),
  }));

/** Một câu hỏi trong từ vựng của dịch vụ: chặt, và bỏ hẳn khoá vắng mặt. */
export const questionSchema = z
  .object({
    id: z.string(),
    question: z.string(),
    detail: z.string().optional(),
    header: z.string().optional(),
    options: z.array(optionSchema).optional(),
    multiSelect: z.boolean().optional(),
  })
  .strict()
  .transform((question) => ({
    id: question.id,
    question: question.question,
    ...(question.detail === undefined ? {} : { detail: question.detail }),
    ...(question.header === undefined ? {} : { header: question.header }),
    ...(question.options === undefined ? {} : { options: question.options }),
    ...(question.multiSelect === undefined ? {} : { multiSelect: question.multiSelect }),
  }));

/** Các lời gọi còn trả lời được: danh tính lời gọi phải là duy nhất. */
export const pendingQuestionsSchema = z
  .array(
    z
      .object({
        callId: z.string().min(1).transform(ToolCallId),
        questions: z.array(questionSchema).min(1),
        state: z.enum(["open", "continued"]),
      })
      .strict(),
  )
  .superRefine((active, context) => {
    if (new Set(active.map((question) => question.callId)).size !== active.length) {
      context.addIssue({ code: "custom", message: "callIds must be unique" });
    }
  });

/** Một câu trả lời trong từ vựng của dịch vụ: chặt, và bỏ hẳn khoá vắng mặt. */
export const answerSchema = z
  .object({ id: z.string(), selected: z.array(z.string()), custom: z.string().optional() })
  .strict()
  .transform((answer) => ({
    id: answer.id,
    selected: answer.selected,
    ...(answer.custom === undefined ? {} : { custom: answer.custom }),
  }));

/** Các lời gọi đã được chốt, kèm lô câu trả lời đã chốt chúng. */
export const settledQuestionsSchema = z.array(
  z.object({ callId: z.string().min(1).transform(ToolCallId), answers: z.array(answerSchema) }).strict(),
);

/** Hai nửa trạng thái mà mọi Client đọc: còn trả lời được và đã chốt. */
export const projectionViewSchema = z.object({ active: pendingQuestionsSchema, settled: settledQuestionsSchema }).strict();

/** Lô câu trả lời, đúng như kết quả tool trong hạn và lời đáp muộn cùng viết. */
const answerBatchSchema = z.object({ answers: z.array(answerSchema) }).loose();

/**
 * Kiểm một schema tool đã ghi log có phải của tool `ask_user_question` CÓ HẸN GIỜ hay không.
 * Nhận: `tool` — một mục trong danh sách schema tool đã lắp của header yêu cầu.
 * Trả: true chỉ khi tên là `ask_user_question` và tham số khai {@link TIMED_WAIT_PARAMETER}.
 */
export function isTimedAskUserQuestionSchema(tool: { name: string; parameters: Record<string, unknown> }): boolean {
  if (tool.name !== "ask_user_question") return false;
  const properties = tool.parameters["properties"];
  return isRecordValue(properties) && TIMED_WAIT_PARAMETER in properties;
}

/**
 * Đọc lô câu hỏi ra khỏi tham số `ask_user_question` đã ghi log.
 * Nhận: `argumentsText` — JSON thô ghi trên sự kiện `tool/call`.
 * Trả: các câu hỏi trong từ vựng của dịch vụ, hoặc null khi tham số không đọc được.
 */
export function questionsOf(argumentsText: string): AskUserQuestionItem[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsText);
  } catch {
    return null;
  }
  const result = toolArgumentsSchema.safeParse(parsed);
  if (!result.success) return null;
  return result.data.questions.map((question) => ({
    id: question.id,
    question: question.question,
    ...(question.header === undefined ? {} : { header: question.header }),
    ...(question.options === undefined
      ? {}
      : {
          options: question.options.map((option) => ({
            label: option.label,
            ...(option.description === undefined ? {} : { description: option.description }),
          })),
        }),
    ...(question.multi_select === undefined ? {} : { multiSelect: question.multi_select }),
  }));
}

/**
 * Nhận diện thân kết quả "còn treo" của một lời gọi có hẹn giờ.
 * Nhận: `content` — các khối nội dung của tin nhắn đã ghi.
 * Trả: true khi khối chữ đầu tiên là JSON có `pending === true`.
 */
export function isPendingResult(content: readonly ContentBlock[]): boolean {
  const text = content.find((block) => block.type === "text");
  if (text?.text === undefined) return false;
  try {
    const parsed: unknown = JSON.parse(text.text);
    return typeof parsed === "object" && parsed !== null && (parsed as { pending?: unknown }).pending === true;
  } catch {
    return false;
  }
}

/**
 * Đọc lô câu trả lời ra khỏi một đoạn chữ đã ghi: kết quả tool hoặc lời đáp muộn.
 * Nhận: `content` — các khối nội dung của tin nhắn đã ghi.
 * Trả: lô câu trả lời, hoặc null khi đoạn chữ không mang lô nào dùng được.
 */
export function answerBatchOf(content: readonly ContentBlock[]): AskUserQuestionAnswerItem[] | null {
  const text = content.find((block) => block.type === "text");
  if (text?.text === undefined) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.text);
  } catch {
    return null;
  }
  const result = answerBatchSchema.safeParse(parsed);
  return result.success ? result.data.answers : null;
}

/**
 * Kiểm một giá trị có phải bản ghi (object không phải mảng) hay không.
 * Nhận: `value` — giá trị bất kỳ.
 * Trả: true khi là object không null và không phải mảng.
 */
function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
