/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chính sách thi hành dùng chung cho mọi provider tiêu đề phiên dựa trên model — bản viết lại
 *      1:1 của gói THƯ VIỆN `@deepseek-ai/dsh-session-title-llm`: route preparation, trần đầu
 *      vào/token/thời hạn, huỷ, ghi ĐÚNG một bản ghi request phụ, và lắp stream. Cách viết tiêu đề,
 *      đích độ dài, chọn mức suy luận và diễn giải đầu ra thuộc về TỪNG provider. Nguồn đối chiếu:
 *      xem README.md của package (G4).
 */

import z from "@deepseek-ai/schemastery";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";

import type { SessionTitleLlmConfig } from "./types.ts";

/** Năm trường schema Loader dùng chung, KHÔNG có mặc định thư viện. */
export const SessionTitleLlmConfigFields = {
  maxInputBytes: z.number().step(1).min(1).required(),
  maxOutputTokens: z.number().step(1).min(1).required(),
  timeoutMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).required(),
  provider: z.string(),
  model: z.string(),
};

/** Schema Loader dùng chung, KHÔNG có mặc định thư viện. */
export const SessionTitleLlmConfigSchema: z<SessionTitleLlmConfig> = z.object(
  SessionTitleLlmConfigFields,
) as unknown as z<SessionTitleLlmConfig>;

export { SESSION_TITLE_TIMEOUT_CODE, executeSessionTitleLlm, resolveSessionTitleLlmConfig } from "./execute.ts";

// 18/10/2026 (task-32): re-export ĐỦ SÁU kiểu mà `.d.ts` của gói gốc công bố, để consumer dùng trực tiếp
// gói này mà KHÔNG cần shim `declare module` nào. Bản gốc: dsh-session-title-llm/lib/types/index.d.ts
// dòng 23, 48, 61, 83, 99, 103 ⇒ sáu tên dưới đây là bề mặt KIỂU công khai (1:1).
export type {
  ResolvedSessionTitleLlmConfig,
  SessionTitleLlmConfig,
  SessionTitleLlmFinish,
  SessionTitleLlmPreparedRequest,
  SessionTitleLlmRequestEventData,
  SessionTitleLlmResponse,
} from "./types.ts";
