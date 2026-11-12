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
import type { SessionTitleLlmConfig } from "./types.ts";
/** Năm trường schema Loader dùng chung, KHÔNG có mặc định thư viện. */
export declare const SessionTitleLlmConfigFields: {
    maxInputBytes: z<number, number, "defined">;
    maxOutputTokens: z<number, number, "defined">;
    timeoutMs: z<number, number, "defined">;
    provider: z<string, string, "plain">;
    model: z<string, string, "plain">;
};
/** Schema Loader dùng chung, KHÔNG có mặc định thư viện. */
export declare const SessionTitleLlmConfigSchema: z<SessionTitleLlmConfig>;
export { SESSION_TITLE_TIMEOUT_CODE, executeSessionTitleLlm, resolveSessionTitleLlmConfig } from "./execute.ts";
export type { ResolvedSessionTitleLlmConfig, SessionTitleLlmConfig, SessionTitleLlmFinish, SessionTitleLlmPreparedRequest, SessionTitleLlmRequestEventData, SessionTitleLlmResponse, } from "./types.ts";
