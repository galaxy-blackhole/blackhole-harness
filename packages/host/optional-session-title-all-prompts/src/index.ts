/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nhà cung cấp tiêu đề phiên từ TOÀN BỘ prompt người dùng. Bản viết lại của Galaxy Blackhole
 *      cho row optional-session-title-all-prompts (@deepseek-ai/dsh-session-title-all-prompts-llm):
 *      đăng ký MỘT provider `automatic: "all-prompts"` vào seam `ctx.sessionTitle`, giữ nguyên
 *      câu lệnh hệ thống, cách đóng khung JSON, cách lấy tiêu đề từ phản hồi và ngữ nghĩa neo tiêu đề
 *      hiện tại. Nguồn đối chiếu: xem README.md của package (G4).
 */

import type { Context } from "@deepseek-ai/cordis";
import z from "@deepseek-ai/schemastery";
import { SessionTitleProviderId, normalizeSessionTitle } from "@deepseek-ai/dsh-session-title";
import type {
  SessionTitleProviderRequest,
  SessionTitleProviderResult,
  SessionTitleUserMessage,
} from "@deepseek-ai/dsh-session-title";
// 18/10/2026 (task-32): ĐƯỜNG DẪN TƯƠNG ĐỐI thay cho BARE SPECIFIER của gói thư viện tiêu đề.
// Lý do ĐO ĐƯỢC: bare specifier chỉ phân giải được nhờ SYMLINK trong node_modules (đã gitignore) do máy
// này tạo TAY ⇒ clone mới typecheck hỏng. Đường dẫn tương đối chỉ cần CÂY NGUỒN, không
// cần node_modules, không cần script setup ⇒ bền. Hệ quả artifact: KHÔNG đổi — build của consumer vốn đã
// inline thư viện (xem build.ts), nên chỉ bỏ được một điểm phụ thuộc môi trường, không đổi mã chạy.
import {
  SessionTitleLlmConfigFields,
  executeSessionTitleLlm,
  resolveSessionTitleLlmConfig,
} from "../../session-title-llm/src/index.ts";
import type {
  ResolvedSessionTitleLlmConfig,
  SessionTitleLlmConfig,
  SessionTitleLlmPreparedRequest,
  SessionTitleLlmResponse,
} from "../../session-title-llm/src/index.ts";

/** Tên plugin cordis — nguyên văn của bản gốc. */
export const name = "session-title-all-prompts-llm";

/** Service bắt buộc: sổ tiêu đề phiên, tầng LLM, và sổ phiên. */
export const inject: string[] = ["sessionTitle", "llm", "sessions"];

/** Điều khiển thi hành dùng chung cộng hai đích độ dài tiêu đề của riêng provider này; không có mặc định. */
export interface Config extends SessionTitleLlmConfig {
  /** Số từ đích cho tiêu đề không phải CJK. */
  readonly targetWords: number;
  /** Số ký tự đích cho tiêu đề tiếng Trung, Nhật hoặc Hàn. */
  readonly targetCjkCharacters: number;
}

/** Schema loader cho điều khiển thi hành bắt buộc và hai đích độ dài tiêu đề. */
export const Config: z<Config> = z.object({
  targetWords: z.number().step(1).min(1).required(),
  targetCjkCharacters: z.number().step(1).min(1).required(),
  maxInputBytes: SessionTitleLlmConfigFields.maxInputBytes,
  maxOutputTokens: SessionTitleLlmConfigFields.maxOutputTokens,
  timeoutMs: SessionTitleLlmConfigFields.timeoutMs,
  provider: SessionTitleLlmConfigFields.provider,
  model: SessionTitleLlmConfigFields.model,
}) as unknown as z<Config>;

/** Cấu hình đã kiểm: điều khiển thi hành đã đóng băng cộng hai đích độ dài đã xác thực. */
interface ResolvedConfig extends ResolvedSessionTitleLlmConfig {
  /** Số từ đích cho tiêu đề không phải CJK. */
  readonly targetWords: number;
  /** Số ký tự đích cho tiêu đề CJK. */
  readonly targetCjkCharacters: number;
}

/**
 * Kiểm một đích độ dài tiêu đề dương.
 * Nhận: tên trường và giá trị cần kiểm.
 * Trả: chính giá trị khi là số nguyên dương; ném lỗi nêu đúng tên trường khi không.
 */
function assertTarget(field: string, value: number): number {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`session-title-all-prompts-llm: ${field} must be a positive integer`);
  return value;
}

/**
 * Xác thực điều khiển thi hành dùng chung và hai đích độ dài của provider này.
 * Nhận: cấu hình plugin chưa được tin.
 * Trả: chính sách provider bất biến.
 */
function resolveConfig(config: Config): ResolvedConfig {
  const { targetWords, targetCjkCharacters, ...execution } = config;
  return {
    ...resolveSessionTitleLlmConfig(execution),
    targetWords: assertTarget("targetWords", targetWords),
    targetCjkCharacters: assertTarget("targetCjkCharacters", targetCjkCharacters),
  };
}

/** Chọn mức suy luận được hỗ trợ THẤP NHẤT của tuyến cho một lượt gọi tiêu đề. */
const selectReasoningEffort: SessionTitleLlmPreparedRequest["selectReasoningEffort"] = (model) =>
  model.reasoning?.efforts[0]?.id;

/**
 * Câu lệnh hệ thống theo ngôn ngữ, kèm luật ổn định khi có tiêu đề provider đang neo.
 * Nhận: cấu hình đã kiểm và việc có neo tiêu đề hiện tại hay không.
 * Trả: chuỗi câu lệnh hệ thống, mỗi dòng một quy tắc.
 */
function systemPrompt(config: ResolvedConfig, hasCurrentTitle: boolean): string {
  return [
    "Create a concise title for an AI coding-assistant session from the supplied human messages.",
    "Return only the title on one line, **in plain text of natural language**, with no quotes, prefix, explanation, Markdown, XML, or terminal control codes. No code is allowed.",
    "Use the language of the messages.",
    `Aim for about ${config.targetWords} words in non-CJK languages or ${config.targetCjkCharacters} CJK characters.`,
    "If the messages give little to name, still return a short best-effort title, such as Greeting, instead of explaining.",
    ...(hasCurrentTitle
      ? [
          "An existing title is supplied as currentTitle. If it still accurately describes the main topic or task, return it exactly unchanged.",
          'Follow-up questions, additional details within the same topic, acknowledgements such as "thanks", and requests to continue do not by themselves justify a title change.',
          "Do not reword, polish, shorten, or replace synonyms in an adequate title. Keeping its exact wording takes priority over the target length.",
          "Change the title only when the messages materially change or expand the main topic or task so that the existing title is no longer accurate.",
        ]
      : []),
  ].join("\n");
}

/**
 * Đóng khung tin nhắn thành JSON để chữ của người dùng không phá được dấu phân cách cấu trúc.
 * Nhận: danh sách tin nhắn người dùng và tiêu đề hiện tại (nếu có neo).
 * Trả: đầu vào một khối cho lượt gọi tiêu đề.
 */
function frameMessages(messages: readonly SessionTitleUserMessage[], currentTitle?: string): string {
  if (currentTitle !== undefined)
    return `Update the session title from this JSON object:\n${JSON.stringify({ currentTitle, messages })}`;
  return `Generate the session title from this JSON array of human messages:\n${JSON.stringify(messages)}`;
}

/** Bao nhấn mạnh bằng dấu sao cho CẢ một dòng, ví dụ `**Title**`. */
const EMPHASIS_WRAPPER = /^(?<marker>\*{1,3})(?<inner>\S(?:.*\S)?)\k<marker>$/u;

/**
 * Lấy tiêu đề từ đầu ra của model: dòng không rỗng ĐẦU TIÊN, bỏ phần nhấn mạnh bằng dấu sao nếu nó
 * bao trọn dòng đó. Model bỏ qua chỉ dẫn một dòng thì đặt tiêu đề trước và bình luận sau. Một dòng
 * toàn dấu `*` mất cặp dấu bao kể cả khi model muốn nó theo nghĩa đen; phép kiểm dấu bên trong giữ
 * phần nhấn mạnh nằm trong một dòng dài hơn, và câu lệnh hệ thống đã cấm Markdown.
 * Nhận: văn bản thô của model.
 * Trả: dòng tiêu đề đã tách khỏi phần nhấn mạnh bao ngoài (có thể rỗng).
 */
function titleFromOutput(text: string): string {
  const line = text.split(/\r?\n/u).map((item) => item.trim()).find((item) => item.length > 0) ?? "";
  const groups = EMPHASIS_WRAPPER.exec(line)?.groups;
  const marker = groups?.["marker"];
  const inner = groups?.["inner"];
  return marker === undefined || inner === undefined || inner.includes(marker) ? line : inner;
}

/**
 * Đánh dấu một nhánh union ĐÓNG không thể tới — viết lại tại chỗ của helper kernel
 * `assertNever` (bản gốc import từ `@deepseek-ai/dsh-util-values`), giữ nguyên định dạng thông điệp.
 * Nhận: giá trị không thể tới và nhãn điểm `switch` (nếu có).
 * Trả: không bao giờ trả; luôn ném lỗi.
 */
function unreachableVariant(value: never, context?: string): never {
  const rendered = JSON.stringify(value) ?? String(value);
  throw new Error(`unreachable variant${context === undefined ? "" : ` in ${context}`}: ${rendered}`);
}

/**
 * Từ chối kết cục công cụ hoặc hết token, rồi rút ĐÚNG MỘT tiêu đề không rỗng từ các khối văn bản.
 * Nhận: phản hồi đã lắp của một lượt gọi tiêu đề.
 * Trả: tiêu đề đã chuẩn hoá; ném lỗi khi kết cục không dùng được hoặc không có văn bản.
 */
function titleFromResponse(response: SessionTitleLlmResponse): string {
  switch (response.finish.kind) {
    case "stop":
      break;
    case "tool-calls":
      throw new Error("session-title-llm: title output must contain text only");
    case "max-tokens":
      throw new Error("session-title-llm: title output reached maxOutputTokens");
    default:
      return unreachableVariant(response.finish, "SessionTitleLlmFinish");
  }
  if (response.blocks.some((block) => block.type === "tool-call"))
    throw new Error("session-title-llm: title output must contain text only");
  const title = normalizeSessionTitle(
    titleFromOutput(
      response.blocks
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join(" "),
    ),
    Number.MAX_SAFE_INTEGER,
  );
  if (title.length === 0) throw new Error("session-title-llm: title model produced no text");
  return title;
}

/**
 * Đăng ký provider tiêu đề từ toàn bộ prompt.
 * Nhận: context phơi seam tiêu đề phiên, LLM và sổ phiên; cấu hình tuyến, đích độ dài, byte, token và thời hạn.
 * Trả: không; đăng ký một provider `automatic: "all-prompts"` vào `ctx.sessionTitle`.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config);
  const titleProvider = SessionTitleProviderId(name);
  ctx.sessionTitle.register({
    id: titleProvider,
    automatic: "all-prompts",
    async generate(request: SessionTitleProviderRequest): Promise<SessionTitleProviderResult> {
      const messageSeqs = request.messages.map((message) => message.seq);
      const anchor = request.currentTitle?.source.kind === "provider" ? request.currentTitle.title : undefined;
      // 08/11/2026 (seam CẤU TRÚC tại biên): `request` mang kiểu stock @deepseek-ai/dsh-session-title còn
      // `executeSessionTitleLlm` (thư viện CỦA TA) nhận kiểu GBH — hai thương hiệu SessionSeq khác nhau dù cùng
      // hình dạng lúc chạy ⇒ ép kiểu tại ĐÚNG một điểm (giữ nguyên hành vi).
      const response = await executeSessionTitleLlm(ctx, resolved, request as unknown as Parameters<typeof executeSessionTitleLlm>[2],
        // Cùng lý do: `SessionTitleProviderId` của stock và của gói GBH là hai thương hiệu khác nhau.
        titleProvider as unknown as Parameters<typeof executeSessionTitleLlm>[3], {
        system: systemPrompt(resolved, anchor !== undefined),
        input: frameMessages(request.messages, anchor),
        messageSeqs,
        selectReasoningEffort,
      });
      return {
        title: titleFromResponse(response),
        messageSeqs,
        model: response.model,
      };
    },
  });
}
