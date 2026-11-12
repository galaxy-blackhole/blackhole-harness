/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Ai/dsh-tool-ask-user (row LỒNG): tool ask_user_question hỏi người dùng qua seam ctx.userQuestions, giữ nguyên hai chế độ legacy/timed, mọi chuỗi tiếng Anh, thứ tự kiểm và hằng số của bundle gốc; Config là z.object THẬT của schemastery (đúng thứ tự trường + default như bản gốc).
 */

import type { Context } from "@deepseek-ai/cordis";
import { defineTool, type ToolDefinition } from "@galaxy-blackhole/gbh-host-tools";
import { TIMED_WAIT_PARAMETER } from "@deepseek-ai/dsh-user-questions";
import type {} from "@deepseek-ai/dsh-user-questions";
import type { AskUserQuestionAnswer, AskUserQuestionItem, AskUserQuestionRequest } from "@deepseek-ai/dsh-user-questions";
import z from "@deepseek-ai/schemastery";

/**
 * Ep `Agent` cua goi GBH sang kieu `Agent` ma seam `userQuestions` cua KERNEL nhan. Hai kieu KHAC danh tinh
 * nhung CUNG hinh dang runtime, nen ep MOT cho tai bien (ADR 000d, 08/11/2026 dev-1).
 * Nhan: `agent` - agent do kernel cap luc chay. Tra: cung vat the duoi kieu ma ham dich doi hoi.
 */
function asKernelAgent<T>(agent: unknown): T {
  return agent as T;
}


/**
 * Schema cấu hình của row — NGUYÊN VĂN `const Config = z.object({...})` của bundle gốc:
 * cùng thứ tự trường, cùng default (mode `legacy`, timeout `120`) và cùng union miền giá trị.
 * Settings/config-editor của kernel render được hai trường này; tầng nạp dùng chính schema để
 * điền mặc định trước khi gọi `apply`.
 * Nhận: value — cấu hình thô (có thể thiếu, null hoặc sai kiểu).
 * Trả: cấu hình đã điền đủ mode/timeout, giữ nguyên khoá lạ như bản gốc.
 * @throws {Error} ValidationError khi giá trị không phải object hoặc mode/timeout sai miền.
 */
export const Config = z.object({
  mode: z.union(["legacy", "timed"]).default("legacy"),
  timeout: z.union([-1, z.number().step(1).min(1).max(2147483)]).default(120),
});

/**
 * Giá trị cấu hình sau khi schema điền mặc định — suy ra TỪ chính `Config`, không chép tay.
 * Nhận: không (đây là kiểu).
 * Trả: kiểu `{ mode: "legacy" | "timed"; timeout: number }` mà schema sinh ra.
 */
type ConfigValues = ReturnType<typeof Config>;

/**
 * Tham số `config` của `apply`: mọi trường có thể vắng, vì loader truyền `{}` khi patch rỗng
 * và vì schema đã điền mặc định trước khi `apply` nhìn thấy giá trị.
 * Nhận: không (đây là kiểu).
 * Trả: kiểu cấu hình cho phép thiếu trường.
 */
type ConfigPatch = Partial<ConfigValues>;

/**
 * Tên plugin cordis — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: chuỗi "tool-ask-user".
 */
export const name = "tool-ask-user";

/**
 * Service bắt buộc — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: mảng tên hai seam "tools" và "userQuestions".
 */
export const inject: string[] = ["tools", "userQuestions"];

/** Mô tả công cụ gửi cho mô hình ở chế độ legacy — NGUYÊN VĂN bản gốc. */
const DESCRIPTION = "Ask the user a concise question when you need confirmation, a choice, or missing information before proceeding.";

/** Mô tả công cụ gửi cho mô hình ở chế độ timed — NGUYÊN VĂN bản gốc. */
const TIMED_DESCRIPTION = "Ask brief, direct, self-contained questions about missing information, preferences, or decisions. Use user-facing terms; assume no knowledge of background work or internal names. Use distinct stable question IDs. A submitted skipped question is an answer item with empty selected and no custom; pending instead means no answer batch arrived before the timeout and the user can still answer.";

/**
 * Thông điệp mà kết quả pending mang trong trường `message` — NGUYÊN VĂN bản gốc.
 * Đây là một trường của giá trị kết quả, không phải văn xuôi bên cạnh: phần chiếu
 * `userQuestions` đọc nó để biết lời gọi vẫn trả lời được, còn hàng câu hỏi phía
 * Client đọc nó để biết kết quả đã ghi là timeout chứ không phải lô câu trả lời.
 */
const PENDING_NOTICE = "No answer batch arrived before the timeout. This is pending, not a skipped answer. Continue useful independent work. The user can still answer; their reply will be a user message identified as answer_to_pending_question with this callId and the original questions. Do not treat this as permission.";

/**
 * Kiểm thời gian chờ: -1 hoặc số nguyên dương tới 2147483 giây.
 * Nhận: timeout — thời gian chờ tính bằng giây.
 * Trả: chính giá trị đã kiểm.
 * @throws {Error} khi giá trị khác -1 và không phải số nguyên trong [1, 2147483].
 */
function validateTimeout(timeout: number): number {
  if (timeout !== -1 && (!Number.isInteger(timeout) || timeout < 1 || timeout > 2147483)) throw new Error("timeout must be -1 or a positive integer up to 2147483 seconds");
  return timeout;
}

/**
 * Kiểm id câu hỏi là duy nhất trong MỘT lời gọi.
 * Nhận: questions — danh sách câu hỏi do mô hình cấp.
 * Trả: không.
 * @throws {Error} khi một id xuất hiện hơn một lần.
 */
function validateQuestionIds(questions: readonly { id: string }[]): void {
  const ids = new Set<string>();
  for (const question of questions) {
    if (ids.has(question.id)) throw new Error(`question id ${JSON.stringify(question.id)} must be unique within this call`);
    ids.add(question.id);
  }
}

/**
 * Chuyển schema của mô hình thành yêu cầu của service mà không đổi chủ sở hữu.
 * Nhận: questions — câu hỏi theo hình dạng schema tool; exec — ngữ cảnh thực thi sở hữu agent và tín hiệu huỷ.
 * Trả: yêu cầu tương ứng cho service hỏi người dùng.
 */
function questionRequest(questions: readonly { id: string; question: string; header?: string; options?: readonly { label: string; description?: string }[]; multi_select?: boolean }[], exec: { agent?: unknown; signal: AbortSignal }): AskUserQuestionRequest {
  return {
    questions: questions.map((question) => ({
      id: question.id,
      question: question.question,
      ...(question.header !== undefined ? { header: question.header } : {}),
      ...(question.options !== undefined ? { options: question.options.map((option) => ({ ...option })) } : {}),
      ...(question.multi_select !== undefined ? { multiSelect: question.multi_select } : {}),
    })) as AskUserQuestionItem[],
    ...(exec.agent !== undefined ? { agent: exec.agent as AskUserQuestionRequest["agent"] } : {}),
    signal: exec.signal,
  };
}

/**
 * Sao chép mảng câu trả lời do service sở hữu sang kết quả hướng mô hình.
 * Nhận: result — câu trả lời service hỏi người dùng trả về.
 * Trả: payload câu trả lời đã tách khỏi mảng của service.
 */
function answerResult(result: AskUserQuestionAnswer): { answers: { id: string; selected: string[]; custom?: string }[] } {
  return {
    answers: result.answers.map((answer) => ({
      id: answer.id,
      selected: [...answer.selected],
      ...(answer.custom !== undefined ? { custom: answer.custom } : {}),
    })),
  };
}

/**
 * Mặt cắt của SỔ TOOL (service `tools`) mà row này dùng — seam CẤU TRÚC, chỉ khai đúng phương thức cần,
 * KHÔNG dựa vào augmentation của `Context` (ADR 000d: `gbh-host-tools` cố ý không augment).
 */
interface ToolsLike {
  /**
   * Đăng ký một định nghĩa tool vào sổ của tổ hợp plugin.
   * Nhận: định nghĩa tool (đã kiểm bởi `defineTool`).
   * Trả: hàm huỷ đăng ký.
   */
  register(definition: ToolDefinition): () => void;
}

/**
 * Lấy sổ tool qua SEAM CẤU TRÚC; thiếu seam là lỗi cấu hình ⇒ nổ NGAY (fail loud như bản gốc).
 * Nhận: ctx — context cordis của row.
 * Trả: mặt cắt `ToolsLike` đã kiểm.
 * @throws {Error} khi tổ hợp plugin không cấp service `tools`.
 */
function toolsSeam(ctx: Context): ToolsLike {
  const tools = ctx.get("tools") as ToolsLike | undefined;
  if (tools === undefined) throw new Error("tool-ask-user requires the tools seam (ctx.get(\"tools\"))");
  return tools;
}

/**
 * Đăng ký định nghĩa tool có hẹn giờ (chế độ opt-in).
 * Nhận: ctx — context cấp phạm vi agent nhận tool; timeout — thời gian chờ nền mặc định tính bằng giây (mặc định 120).
 * Trả: không; tool được đăng ký vào sổ và trả pending hoặc lô câu trả lời.
 * @throws {Error} khi timeout không hợp lệ (ném TRƯỚC mọi đăng ký).
 */
function registerTimedAskUser(ctx: Context, timeout = 120): void {
  const defaultTimeout = validateTimeout(timeout);
  toolsSeam(ctx).register(defineTool({
    name: "ask_user_question",
    description: TIMED_DESCRIPTION,
    parameters: {
      questions: {
        type: "array",
        required: true,
        description: "Questions to ask the user.",
        items: {
          type: "object",
          additionalProperties: true,
          properties: {
            id: {
              type: "string",
              required: true,
              description: "Stable id for this question; echoed in the answer.",
            },
            question: {
              type: "string",
              required: true,
              description: "The specific question to ask the user.",
            },
            header: {
              type: "string",
              description: "Optional short heading for the question, such as \"Confirm\" or \"Choose Mode\".",
            },
            options: {
              type: "array",
              description: "Optional choices to show the user. If you recommend one, put it first and append \"(Recommended)\" to that label.",
              items: {
                type: "object",
                additionalProperties: true,
                properties: {
                  label: {
                    type: "string",
                    required: true,
                    description: "Short user-facing option label.",
                  },
                  description: {
                    type: "string",
                    description: "One sentence explaining the tradeoff or impact.",
                  },
                },
              },
            },
            multi_select: {
              type: "boolean",
              description: "Whether the user may select more than one option. Defaults to false.",
            },
          },
        },
      },
      [TIMED_WAIT_PARAMETER]: {
        type: "integer",
        description: `Wait seconds for the entire batch (default ${defaultTimeout}); omit unless the user specifies a duration. Use -1 only when an answer is required before proceeding.`,
      },
    },
    output: {
      schema: { oneOf: [{
        type: "object",
        additionalProperties: false,
        properties: {
          pending: {
            type: "boolean",
            enum: [true],
            required: true,
            description: "True when the foreground wait expired before the user submitted an answer batch. The questions remain answerable; this is not a skipped answer.",
          },
          callId: {
            type: "string",
            required: true,
            description: "Tool call whose unanswered questions remain pending.",
          },
          message: {
            type: "string",
            required: true,
            description: "How to continue while the questions stay answerable.",
          },
        },
      }, {
        type: "object",
        additionalProperties: false,
        properties: { answers: {
          type: "array",
          required: true,
          description: "Submitted answer batch with one item per question. A skipped question has empty selected and no custom; unlike pending, the user has completed the batch.",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: {
                type: "string",
                required: true,
                description: "Stable question id echoed from the request.",
              },
              selected: {
                type: "array",
                required: true,
                items: { type: "string" },
                description: "Selected option labels. Empty with no custom means the user explicitly skipped this question.",
              },
              custom: {
                type: "string",
                description: "Optional free-form answer; omitted for a skipped question.",
              },
            },
          },
        } },
      }] },
      render: (_args, value) => [{
        type: "text",
        text: JSON.stringify(value),
      }],
    },
    async execute(args, exec) {
      const timeout = validateTimeout(args.timeout ?? defaultTimeout);
      validateQuestionIds(args.questions);
      const request = questionRequest(args.questions, exec);
      if (timeout !== -1) {
        if (exec.agent === undefined) throw new Error("timed questions require a live agent");
        const result = await ctx.userQuestions.askTimed({
          ...request,
          agent: asKernelAgent(exec.agent),
        }, exec.callId, timeout * 1e3);
        return "pending" in result ? {
          ...result,
          message: PENDING_NOTICE,
        } : answerResult(result);
      }
      return answerResult(await ctx.userQuestions.ask({
        ...request,
        wait: { callId: exec.callId },
      }));
    },
  }));
}

/**
 * Cài row: đăng ký tool ask_user_question theo mode đã cấu hình.
 * Nhận: ctx — context cấp SEAM sổ tool (lấy qua `ctx.get("tools")`) và seam userQuestions; config — cấu hình row đã qua schema (mặc định {}).
 * Trả: không; tool được đăng ký vào sổ.
 * @throws {Error} khi mode "timed" và timeout không hợp lệ (ném TRƯỚC mọi đăng ký).
 */
export function apply(ctx: Context, config: ConfigPatch = {}): void {
  if (config.mode === "timed") {
    registerTimedAskUser(ctx, config.timeout);
    return;
  }
  toolsSeam(ctx).register(defineTool({
    name: "ask_user_question",
    description: DESCRIPTION,
    parameters: { questions: {
      type: "array",
      required: true,
      description: "Questions to ask the user before continuing.",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          id: {
            type: "string",
            required: true,
            description: "Stable id for this question; echoed in the answer.",
          },
          question: {
            type: "string",
            required: true,
            description: "The specific question to ask the user.",
          },
          header: {
            type: "string",
            description: "Optional short heading for the question, such as \"Confirm\" or \"Choose Mode\".",
          },
          options: {
            type: "array",
            description: "Optional choices to show the user. If you recommend one, put it first and append \"(Recommended)\" to that label.",
            items: {
              type: "object",
              additionalProperties: true,
              properties: {
                label: {
                  type: "string",
                  required: true,
                  description: "Short user-facing option label.",
                },
                description: {
                  type: "string",
                  description: "One sentence explaining the tradeoff or impact.",
                },
              },
            },
          },
          multi_select: {
            type: "boolean",
            description: "Whether the user may select more than one option. Defaults to false.",
          },
        },
      },
    } },
    output: {
      schema: {
        type: "object",
        additionalProperties: false,
        properties: { answers: {
          type: "array",
          required: true,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: {
                type: "string",
                required: true,
              },
              selected: {
                type: "array",
                required: true,
                items: { type: "string" },
              },
              custom: { type: "string" },
            },
          },
        } },
      },
      render: (_args, value) => [{
        type: "text",
        text: JSON.stringify(value),
      }],
    },
    async execute(args, exec) {
      return { answers: (await ctx.userQuestions.ask({
        questions: args.questions.map((question) => ({
          id: question.id,
          question: question.question,
          ...(question.header !== undefined ? { header: question.header } : {}),
          ...(question.options !== undefined ? { options: question.options } : {}),
          ...(question.multi_select !== undefined ? { multiSelect: question.multi_select } : {}),
        })),
        ...(exec.agent !== undefined ? { agent: asKernelAgent(exec.agent) } : {}),
        signal: exec.signal,
      })).answers.map((answer) => ({
        id: answer.id,
        selected: [...answer.selected],
        ...(answer.custom !== undefined ? { custom: answer.custom } : {}),
      })) };
    },
  }));
}
