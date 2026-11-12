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
import type { Context } from "@deepseek-ai/cordis";
import type { SessionTitleProviderId, SessionTitleProviderRequest } from "@galaxy-blackhole/gbh-session-title";
import type { ResolvedSessionTitleLlmConfig, SessionTitleLlmConfig, SessionTitleLlmPreparedRequest, SessionTitleLlmResponse } from "./types.ts";
/** Mã lý do hết hạn do năng lực sở hữu, dùng cho các request tiêu đề phụ. */
export declare const SESSION_TITLE_TIMEOUT_CODE = "SESSION_TITLE_TIMEOUT";
/**
 * Kiểm và TÁCH RỜI các điều khiển thi hành bắt buộc.
 * Nhận: cấu hình thi hành chưa được tin.
 * Trả: điều khiển bất biến, giữ nguyên việc VẮNG mặt của cặp tuyến tuỳ chọn.
 */
export declare function resolveSessionTitleLlmConfig(config: SessionTitleLlmConfig): ResolvedSessionTitleLlmConfig;
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
export declare function executeSessionTitleLlm(ctx: Context, config: ResolvedSessionTitleLlmConfig, request: SessionTitleProviderRequest, titleProvider: SessionTitleProviderId, prepared: SessionTitleLlmPreparedRequest): Promise<SessionTitleLlmResponse>;
