/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Mặt kiểu của service dịch máy `translator`: yêu cầu/đặc tả/định danh bản dịch và hai bản ghi
 *      request/result bền — port 1:1 'lib/types/types.d.ts' của @deepseek-ai/dsh-experimental-translator.
 *      Khối 'declare module "@deepseek-ai/dsh-session/types"' của bản gốc KHÔNG port (repo CẤM
 *      declare module cộng gộp — ADR 000d); các kiểu còn lại giữ nguyên tên, thứ tự và hình dạng.
 */

import type { SessionId, SessionSeq } from "@deepseek-ai/dsh-session/types";

/**
 * Endpoint trình duyệt ẩn danh được chọn cho một lần dịch.
 * Nhận: không (kiểu chỉ mô tả một giá trị).
 * Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type AnonymousTranslationProvider = "google" | "bing";

/**
 * Route trả phí dùng credential native DeepSeek, được chọn tường minh cho một lần dịch.
 * Nhận: không (kiểu chỉ mô tả một giá trị).
 * Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type PaidTranslationProvider = "deepseek-account" | "deepseek-official";

/**
 * Endpoint ẩn danh hoặc route mô hình native trả phí, được chọn tường minh.
 * Nhận: không (kiểu chỉ mô tả một giá trị).
 * Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type TranslationProvider = AnonymousTranslationProvider | PaidTranslationProvider;

/**
 * Văn bản và thẻ ngôn ngữ do nhà cung cấp hỗ trợ, do bên gọi cung cấp.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng).
 * Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface TranslationRequest {
  /** Văn bản đầy đủ gửi tới nhà cung cấp đã chọn. */
  readonly text: string;
  /** Ngôn ngữ đích; các thẻ locale tiếng Trung phổ biến được chuẩn hoá theo từng nhà cung cấp. */
  readonly targetLanguage: string;
  /** Ngôn ngữ nguồn; bỏ trống thì dùng tự động nhận diện. */
  readonly sourceLanguage?: string;
  /** Chọn endpoint; bỏ trống thì dùng provider đã cấu hình của service. */
  readonly provider?: TranslationProvider;
  /** Session đã tồn tại cho kết quả bền; cache trượt thì Session phải đang sống. Bỏ trống giữ lời gọi không trạng thái. */
  readonly sessionId?: SessionId;
}

/**
 * Các trường văn bản và ngôn ngữ đã phân giải đầy đủ, dùng chung cho mọi provider
 * (NGUYÊN VĂN bản gốc: interface không export).
 */
interface TranslationSpecFields {
  /** Văn bản đầy đủ gửi tới nhà cung cấp đã chọn. */
  readonly text: string;
  /** Thẻ ngôn ngữ đích. */
  readonly targetLanguage: string;
  /** Thẻ ngôn ngữ nguồn, hoặc `auto` cho tự động nhận diện. */
  readonly sourceLanguage: string;
  /** Session đã tồn tại cho các bản ghi dịch bền. */
  readonly sessionId?: SessionId;
}

/**
 * Yêu cầu endpoint ẩn danh đã phân giải đầy đủ.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng).
 * Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface AnonymousTranslationSpec extends TranslationSpecFields {
  readonly provider: AnonymousTranslationProvider;
}

/**
 * Yêu cầu native đã phân giải đầy đủ kèm danh tính Session bền bắt buộc.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng).
 * Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface PaidTranslationSpec extends TranslationSpecFields {
  readonly provider: PaidTranslationProvider;
  /** Session bền đã tồn tại; bắt buộc trước khi nhận yêu cầu trả phí. */
  readonly sessionId: SessionId;
}

/**
 * Định tuyến và lựa chọn ngôn ngữ đã phân giải đầy đủ cho một yêu cầu provider.
 * Nhận: không (kiểu chỉ mô tả một giá trị).
 * Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type TranslationSpec = AnonymousTranslationSpec | PaidTranslationSpec;

/**
 * Danh tính độc lập provider của một bản dịch tái dùng được.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng).
 * Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface TranslationIdentity {
  /** Route provider tường minh; kết quả từ các provider khác nhau luôn tách biệt. */
  readonly provider: string;
  /** Đoạn văn bản nguồn đã gửi, chính xác. */
  readonly text: string;
  /** Ngôn ngữ nguồn được yêu cầu, kể cả tự động nhận diện. */
  readonly sourceLanguage: string;
  /** Ngôn ngữ đích được yêu cầu. */
  readonly targetLanguage: string;
  /** Giao thức, endpoint hoặc thiết lập mô hình/prompt ảnh hưởng ngữ nghĩa bản dịch. */
  readonly recipe: string;
}

/**
 * Một lần thử dịch, được cam kết bền trước khi gửi ra ngoài.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng).
 * Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface TranslationRequestRecord extends TranslationIdentity {
  /** Chi tiết request tuỳ chọn do provider sở hữu; không chứa giá trị credential. */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Văn bản dịch thành công, liên kết tới lần thử request bền của nó.
 * Nhận: không (kiểu chỉ mô tả hình dạng đối tượng).
 * Trả: không (kiểu chỉ mô tả hình dạng đối tượng).
 */
export interface TranslationResultRecord {
  /** Seq của request translator đứng trước trong cùng Session. */
  readonly requestSeq: SessionSeq;
  /** Bản dịch đầy đủ đã được kiểm. */
  readonly text: string;
}

/*
 * Bản gốc cộng gộp hai khoá 'plugin:translator/request' và 'plugin:translator/result' vào
 * PluginRecordMap của '@deepseek-ai/dsh-session/types' bằng declare module. Repo CẤM
 * declare module (ADR 000d) nên khối đó KHÔNG port; hai kiểu bản ghi ở trên vẫn giữ nguyên.
 */

/**
 * Lỗi tách biệt với huỷ của bên gọi và việc service bị gỡ.
 * Nhận: không (kiểu chỉ mô tả một giá trị).
 * Trả: không (kiểu chỉ mô tả một giá trị).
 */
export type TranslationErrorCode =
  | "TRANSLATION_TEXT_LIMIT"
  | "TRANSLATION_HTTP_ERROR"
  | "TRANSLATION_INVALID_RESPONSE"
  | "TRANSLATION_RESPONSE_LIMIT"
  | "TRANSLATION_REQUEST_FAILED"
  | "TRANSLATION_TIMEOUT"
  | "TRANSLATION_SESSION_REQUIRED"
  | "TRANSLATION_SESSION_INACTIVE"
  | "TRANSLATION_STORAGE_ERROR"
  | "TRANSLATION_UNAVAILABLE";
