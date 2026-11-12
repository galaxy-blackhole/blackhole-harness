/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chính sách thi hành MỘT lượt gọi tiêu đề phụ: kiểm điều khiển thi hành, chuẩn bị tuyến qua
 *      `ctx.llm.prepareCall`, áp trần byte đầu vào + trần token đầu ra + hạn chót đầu-cuối, ghi ĐÚNG
 *      một bản ghi `session/title-llm-request`, rồi lắp stream. Bản viết lại 1:1
 *      `resolveSessionTitleLlmConfig` + `executeSessionTitleLlm` của
 *      `@deepseek-ai/dsh-session-title-llm`.
 */

import { Buffer } from "node:buffer";

import type { Context } from "@deepseek-ai/cordis";
import { BlockAssembler, createUserMessage } from "@deepseek-ai/dsh-llm";
import type { FinishReason, GenerateOptions, Message } from "@deepseek-ai/dsh-llm";
import type { SessionTitleModelIdentity, SessionTitleProviderId, SessionTitleProviderRequest } from "@galaxy-blackhole/gbh-session-title";
import { MAX_TIMER_DELAY_MS, deadline } from "@deepseek-ai/dsh-timeout";
import type { Deadline } from "@deepseek-ai/dsh-timeout";
import { assertNever, deepFreeze } from "@deepseek-ai/dsh-util-values";

import type {
  ResolvedSessionTitleLlmConfig,
  SessionTitleLlmConfig,
  SessionTitleLlmFinish,
  SessionTitleLlmPreparedRequest,
  SessionTitleLlmRequestEventData,
  SessionTitleLlmResponse,
  TitleRequestSink,
} from "./types.ts";

/** Mã lý do hết hạn do năng lực sở hữu, dùng cho các request tiêu đề phụ. */
export const SESSION_TITLE_TIMEOUT_CODE = "SESSION_TITLE_TIMEOUT";

/** Bộ khoá điều khiển thi hành đầy đủ, dùng để kiểm cấu hình dựng trực tiếp. */
const CONFIG_KEYS = new Set(["maxInputBytes", "maxOutputTokens", "timeoutMs", "provider", "model"]);

/**
 * Kiểm một trần là số nguyên dương.
 * Nhận: tên trường và giá trị cần kiểm.
 * Trả: không; ném lỗi nêu ĐÚNG tên trường khi giá trị không hợp lệ.
 */
function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`session-title-llm: ${name} must be a positive integer`);
}

/**
 * Giải phóng một deadline đã cấp (gọi `[Symbol.dispose]`) mà KHÔNG phụ thuộc việc lib chuẩn của
 * chương trình có khai báo `Symbol.dispose` hay không. Ngữ nghĩa giống hệt `using` của bản gốc.
 * Nhận: deadline cần dọn.
 * Trả: không.
 */
function disposeDeadline(d: Deadline): void {
  const key = (Symbol as unknown as { dispose?: symbol }).dispose;
  if (key === undefined) return;
  const release = (d as unknown as Record<symbol, (() => void) | undefined>)[key];
  release?.();
}

/**
 * Kiểm và TÁCH RỜI các điều khiển thi hành bắt buộc.
 * Nhận: cấu hình thi hành chưa được tin.
 * Trả: điều khiển bất biến, giữ nguyên việc VẮNG mặt của cặp tuyến tuỳ chọn.
 */
export function resolveSessionTitleLlmConfig(config: SessionTitleLlmConfig): ResolvedSessionTitleLlmConfig {
  const candidate = config as unknown;
  if (candidate === null || typeof candidate !== "object") {
    throw new Error("session-title-llm: configuration is required");
  }
  const value = candidate as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    if (!CONFIG_KEYS.has(key)) throw new Error(`session-title-llm: unknown config key "${key}"`);
  }
  assertPositiveInteger("maxInputBytes", value["maxInputBytes"] as number);
  assertPositiveInteger("maxOutputTokens", value["maxOutputTokens"] as number);
  assertPositiveInteger("timeoutMs", value["timeoutMs"] as number);
  if ((value["timeoutMs"] as number) > MAX_TIMER_DELAY_MS) {
    throw new Error(`session-title-llm: timeoutMs must not exceed ${MAX_TIMER_DELAY_MS}`);
  }
  const hasProvider = value["provider"] !== undefined;
  if (hasProvider !== (value["model"] !== undefined)) {
    throw new Error("session-title-llm: provider and model must be supplied together");
  }
  if (
    hasProvider &&
    (typeof value["provider"] !== "string" ||
      (value["provider"] as string).length === 0 ||
      typeof value["model"] !== "string" ||
      (value["model"] as string).length === 0)
  ) {
    throw new Error("session-title-llm: provider and model overrides must be non-empty strings");
  }
  return deepFreeze({ ...value }) as unknown as ResolvedSessionTitleLlmConfig;
}

/**
 * Phân giải cặp tuyến tường minh, hoặc đúng tuyến đã chụp từ `request/header`.
 * Nhận: điều khiển thi hành đã kiểm và yêu cầu của service.
 * Trả: tuyến model phụ sẽ dùng.
 * Ném: khi không có tuyến nào và cấu hình cũng không khai cặp `provider`/`model`.
 */
function resolveRoute(config: ResolvedSessionTitleLlmConfig, request: SessionTitleProviderRequest): SessionTitleModelIdentity {
  if (config.provider !== undefined && config.model !== undefined) {
    return { provider: config.provider, model: config.model };
  }
  if (request.route === undefined) {
    throw new Error("session-title-llm: no logged request route is available; configure provider and model together");
  }
  return request.route;
}

/**
 * Phân loại một kết cục cuối. Lỗi vận hành thì NÉM; mọi kết cục cuối khác được trả về để provider
 * tự chấp nhận hay từ chối.
 * Nhận: kết cục cuối của stream đã lắp.
 * Trả: kết cục theo hướng provider nhìn thấy.
 * Ném: với `error`/`aborted` (mang theo mã lỗi của bản gốc), hoặc nhánh không thể tới.
 */
function terminalFinish(finish: FinishReason): SessionTitleLlmFinish {
  switch (finish.kind) {
    case "stop":
    case "tool-calls":
    case "max-tokens":
      return finish;
    case "error":
    case "aborted": {
      const error = new Error(finish.failure.message) as Error & { code?: string };
      error.code = finish.failure.code;
      throw error;
    }
    default:
      return assertNever(finish, "FinishReason");
  }
}

/**
 * Thi hành MỘT request tiêu đề phụ đã chuẩn bị.
 *
 * Provider sở hữu câu lệnh hệ thống, đầu vào người dùng, chọn mức suy luận và diễn giải đầu ra.
 * Hàm này sở hữu: chuẩn bị tuyến, trần byte đầu vào cuối cùng, trần token đầu ra, hạn chót đầu-cuối,
 * huỷ, bản ghi `session/title-llm-request` CHÍNH XÁC, và việc lắp stream.
 * Nhận: context phơi dịch vụ LLM; điều khiển thi hành đã kiểm; yêu cầu của service (phiên, tuyến,
 *       ảnh chụp tin nhắn, tiêu đề hiện tại, huỷ); danh tính provider tiêu đề đã đăng ký; và phần
 *       provider chuẩn bị (câu lệnh hệ thống, đầu vào, seq nguồn, bộ chọn mức suy luận).
 * Trả: các khối phản hồi đã lắp, kết cục cuối, và tuyến CHÍNH XÁC đã dùng.
 * Ném: khi vượt trần đầu vào, không chuẩn bị được tuyến, hết hạn chót, bị huỷ, hoặc kết cục vận hành hỏng.
 */
export async function executeSessionTitleLlm(
  ctx: Context,
  config: ResolvedSessionTitleLlmConfig,
  request: SessionTitleProviderRequest,
  titleProvider: SessionTitleProviderId,
  prepared: SessionTitleLlmPreparedRequest,
): Promise<SessionTitleLlmResponse> {
  request.signal.throwIfAborted();
  if (prepared.messageSeqs.length === 0) {
    throw new Error("session-title-llm: at least one source message is required");
  }
  const inputBytes = Buffer.byteLength(prepared.input, "utf8");
  if (inputBytes > config.maxInputBytes) {
    throw new Error(`session-title-llm: input is ${inputBytes} bytes, exceeding maxInputBytes ${config.maxInputBytes}`);
  }
  const route = resolveRoute(config, request);
  const messages: Message[] = [
    createUserMessage({
      content: [{ type: "text", text: prepared.input }],
      // Khoá nguồn `dsh-session-title-llm` do CHÍNH gói sở hữu; kiểu của nó được khai trong d.ts của
      // bản gốc, nên ở đây chỉ cần ép kiểu tại ĐÚNG một điểm (không `declare module` — luật 000d).
      source: { kind: "dsh-session-title-llm" } as unknown as Message["source"],
    }),
  ];
  const callDeadline = deadline(request.signal, config.timeoutMs, SESSION_TITLE_TIMEOUT_CODE);
  try {
    const maxTokens = config.maxOutputTokens;
    const call = await ctx.llm.prepareCall(
      { ...route, maxTokens },
      callDeadline.signal,
      (controls, model) => {
        const effort = prepared.selectReasoningEffort(model);
        return { ...controls, ...(effort === undefined ? {} : { reasoningEffort: effort }) };
      },
    );
    const options = deepFreeze({
      ...call.config,
      messages,
      system: prepared.system,
      // 08/11/2026 (seam CẤU TRÚC tại biên): SessionId của gói ta và của `@deepseek-ai/dsh-llm` là hai THƯƠNG HIỆU
      // khác nhau dù CÙNG chuỗi lúc chạy ⇒ ép kiểu tại ĐÚNG một điểm (không đổi id kernel, không nới kiểu toàn cục).
      sessionId: request.session.id as unknown as GenerateOptions["sessionId"],
      purpose: "session-title" as const,
      signal: callDeadline.signal,
    });
    (request.session as unknown as TitleRequestSink).append("session/title-llm-request", {
      titleProvider,
      messageSeqs: [...prepared.messageSeqs],
      route,
      system: prepared.system,
      messages,
      maxTokens,
      ...(call.config.reasoningEffort === undefined ? {} : { reasoningEffort: call.config.reasoningEffort }),
    } satisfies SessionTitleLlmRequestEventData);
    callDeadline.signal.throwIfAborted();
    const assembler = new BlockAssembler();
    for await (const chunk of call.stream(options)) {
      callDeadline.signal.throwIfAborted();
      assembler.push(chunk);
    }
    callDeadline.signal.throwIfAborted();
    const finish = terminalFinish(assembler.finish);
    return { blocks: assembler.blocks(), finish, model: route };
  } finally {
    disposeDeadline(callDeadline);
  }
}
