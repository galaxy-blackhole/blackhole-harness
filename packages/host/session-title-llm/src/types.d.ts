/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kiểu công khai của chính sách thi hành tiêu đề phiên dựa trên model: điều khiển thi hành, yêu
 *      cầu do provider chuẩn bị, phản hồi đã lắp, và bản ghi `session/title-llm-request` — bản viết
 *      lại 1:1 khối kiểu của `@deepseek-ai/dsh-session-title-llm`.
 */
import type { ContentBlock, FinishReason, LlmResolvedModelInfo, Message, ReasoningEffortId } from "@deepseek-ai/dsh-llm";
import type { SessionSeq } from "@galaxy-blackhole/gbh-session";
import type { SessionTitleModelIdentity, SessionTitleProviderId } from "@galaxy-blackhole/gbh-session-title";
/** Điều khiển thi hành BẮT BUỘC cho một lượt gọi tiêu đề dựa trên model. */
export interface SessionTitleLlmConfig {
    /** Số byte UTF-8 tối đa trong đầu vào do provider chuẩn bị. */
    readonly maxInputBytes: number;
    /** Trần token đầu ra cho lượt gọi tiêu đề, ĐỘC LẬP với request hội thoại. */
    readonly maxOutputTokens: number;
    /** Hạn chót đầu-cuối của lượt gọi phụ, tính bằng mili giây. */
    readonly timeoutMs: number;
    /** Tuyến provider tường minh (tuỳ chọn); phải đi CẶP với `model`. */
    readonly provider?: string;
    /** Id model tường minh (tuỳ chọn); phải đi CẶP với `provider`. */
    readonly model?: string;
}
/** Điều khiển thi hành đã kiểm và bất biến. */
export interface ResolvedSessionTitleLlmConfig extends SessionTitleLlmConfig {
}
/**
 * Đầu vào model do provider chuẩn bị, phần quy nguồn tin nhắn, và bộ chọn mức suy luận do provider
 * sở hữu — được chuyển tiếp cho `ctx.llm.prepareCall`.
 */
export interface SessionTitleLlmPreparedRequest {
    /** Câu lệnh hệ thống chính xác do provider cấp. */
    readonly system: string;
    /** Chữ tin nhắn người dùng chính xác do provider cấp, kể cả phần đóng khung. */
    readonly input: string;
    /** Seq của các `user/message` được `input` đại diện, theo thứ tự log. */
    readonly messageSeqs: readonly SessionSeq[];
    /**
     * Bộ chọn mức suy luận do provider sở hữu cho tuyến đã chụp.
     * Nhận: metadata model đã tách rời và đóng băng sâu từ thế hệ adapter đã chụp.
     * Trả: id mức suy luận được hỗ trợ, hoặc `undefined` để dùng mặc định của tuyến.
     */
    readonly selectReasoningEffort: (model: Readonly<LlmResolvedModelInfo>) => ReasoningEffortId | undefined;
}
/** Các kết cục cuối được chuyển tiếp cho provider tự diễn giải. */
export type SessionTitleLlmFinish = Extract<FinishReason, {
    kind: "stop" | "tool-calls" | "max-tokens";
}>;
/** Phản hồi model phụ đã lắp, để provider diễn giải. */
export interface SessionTitleLlmResponse {
    /** Các khối nội dung đã lắp theo thứ tự stream; provider tự từ chối loại khối không mong muốn. */
    readonly blocks: readonly ContentBlock[];
    /** Kết cục cuối được chuyển tiếp NGUYÊN VĂN, chưa diễn giải thành tiêu đề. */
    readonly finish: SessionTitleLlmFinish;
    /** Tuyến model phụ chính xác đã sinh ra phản hồi. */
    readonly model: SessionTitleModelIdentity;
}
/** Yêu cầu model-phụ đã ghi TRƯỚC khi dispatch, chỉ nằm trong log. */
export interface SessionTitleLlmRequestEventData {
    /** Danh tính provider tiêu đề đã đăng ký, chịu trách nhiệm cho request. */
    readonly titleProvider: SessionTitleProviderId;
    /** Seq CHÍNH XÁC của các `user/message` được đại diện trong `messages`. */
    readonly messageSeqs: SessionSeq[];
    /** Tuyến LLM phụ chính xác. */
    readonly route: SessionTitleModelIdentity;
    /** Câu lệnh hệ thống phụ chính xác. */
    readonly system: string;
    /** Danh sách tin nhắn phụ chính xác. */
    readonly messages: Message[];
    /** Trần token đầu ra phụ chính xác. */
    readonly maxTokens: number;
    /** Mức suy luận đã phân giải khi được ghi; request cũ có thể vắng trường này. */
    readonly reasoningEffort?: ReasoningEffortId;
}
/**
 * Đường GHI bản ghi request vào log phiên — khai theo CẤU TRÚC, không `declare module` (luật 000d):
 * khoá sự kiện `session/title-llm-request` do CHÍNH gói này sở hữu.
 */
export interface TitleRequestSink {
    /**
     * Ghi một bản ghi request vào log canonical của phiên.
     * Nhận: loại sự kiện `session/title-llm-request` và thân sự kiện.
     * Trả: sự kiện vừa ghi (kernel tự cấp số thứ tự và tự áp projection).
     */
    append(type: "session/title-llm-request", data: SessionTitleLlmRequestEventData): unknown;
}
