/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng dữ liệu của row llm-retry: sự thật hỏng request, chính sách thử lại đã chốt,
 *      payload hai sự kiện phiên `llm/retry` · `llm/retry-started`, và bốn seam mà plugin dùng.
 *      Bản gốc lấy các kiểu này từ dsh-llm · dsh-agent · dsh-session · dsh-session-projection —
 *      đều NGOÀI bảng seam §3b — nên ở đây khai lại theo cấu trúc, đúng phần row này chạm tới.
 */

import type { RetryId } from "./brand.ts";

/** Sự thật của một lần hỏng request; chính sách của provider quyết định có thử lại hay không. */
export interface LlmFailure {
  /** Mô tả hỏng hóc của provider hoặc tầng vận chuyển. */
  readonly message: string;
  /** Mã định tuyến máy đọc được, trung lập với provider. */
  readonly code: string;
  /** Mã HTTP provider trả về, nếu có. */
  readonly status?: number;
  /** Độ trễ provider yêu cầu (ms), khi có và hợp lệ. */
  readonly providerRetryAfterMs?: number;
  /** Mã request do provider cấp, dùng cho chẩn đoán. */
  readonly requestId?: string;
  /** Với mã IMAGE_OFFLOAD_REQUIRED: còn bao nhiêu ảnh cũ phải gỡ trước khi request vừa ngân sách byte. */
  readonly offloadImages?: number;
}

/** Backoff đã chốt, dùng chung cho cả hai chế độ. */
export interface ResolvedRetryBackoff {
  /** Độ trễ cơ sở của backoff cục bộ (ms). */
  readonly initialDelayMs: number;
  /** Trần của độ trễ cục bộ và của độ trễ provider được nhận (ms). */
  readonly maxDelayMs: number;
  /** Biên dao động ngẫu nhiên đối xứng quanh 1 (tỉ lệ, ví dụ 0.1). */
  readonly jitterRatio: number;
}

/** Chính sách thử lại hữu hạn đã chốt cho một tuyến provider. */
export interface ResolvedNormalRetryPolicy extends ResolvedRetryBackoff {
  /** Chế độ có ngân sách đếm được. */
  readonly mode: "normal";
  /** Số lần thử lại tối đa sau request đầu tiên. */
  readonly maxRetries: number;
  /** Các mã hỏng đủ điều kiện thử lại. */
  readonly retryableCodes: readonly string[];
}

/** Chính sách thử lại không giới hạn đã chốt cho một tuyến provider. */
export interface ResolvedAlwaysRetryPolicy extends ResolvedRetryBackoff {
  /** Chế độ thử lại mọi lần hỏng cho tới khi thành công, bị huỷ, hoặc plugin bị gỡ. */
  readonly mode: "always";
}

/** Chính sách thử lại đã chốt mà bộ điều phối này thi hành. */
export type ResolvedRetryPolicy = ResolvedNormalRetryPolicy | ResolvedAlwaysRetryPolicy;

/** Payload bền ghi TRƯỚC một lần chờ thử lại do chính sách provider định tuyến. */
export type LlmRetryEventData =
  | {
      /** Danh tính chuỗi thử lại. */
      retryId: RetryId;
      /** Lượt đang mở. */
      turn: number;
      /** Bước đang mở. */
      step: number;
      /** Provider đã phục vụ request hỏng. */
      provider: string;
      /** Chế độ có ngân sách: payload mang thêm `maxRetries`. */
      mode: "normal";
      /** Khoá chính sách — hai lần chạy cùng chính sách cho cùng khoá. */
      policyKey: string;
      /** Số thứ tự lần thử lại, bắt đầu từ 1. */
      retry: number;
      /** Ngân sách thử lại của chính sách. */
      maxRetries: number;
      /** Độ trễ đã lên lịch (ms). */
      delayMs: number;
      /** Sự thật hỏng hóc dẫn tới lần thử lại này. */
      failure: LlmFailure;
    }
  | {
      /** Danh tính chuỗi thử lại. */
      retryId: RetryId;
      /** Lượt đang mở. */
      turn: number;
      /** Bước đang mở. */
      step: number;
      /** Provider đã phục vụ request hỏng. */
      provider: string;
      /** Chế độ không giới hạn. */
      mode: "always";
      /** Khoá chính sách. */
      policyKey: string;
      /** Số thứ tự lần thử lại, bắt đầu từ 1. */
      retry: number;
      /** Độ trễ đã lên lịch (ms). */
      delayMs: number;
      /** Sự thật hỏng hóc dẫn tới lần thử lại này. */
      failure: LlmFailure;
    };

/** Bản ghi chuyển tiếp bền, ghi SAU khi chờ xong và TRƯỚC khi request kế tiếp bắt đầu. */
export interface LlmRetryStartedEventData {
  /** Danh tính chuỗi thử lại, khớp với bản ghi `llm/retry` đã ghi trước đó. */
  retryId: RetryId;
  /** Lượt đang mở. */
  turn: number;
  /** Bước đang mở. */
  step: number;
  /** Số thứ tự lần thử lại. */
  retry: number;
}

/** Hành động mà listener waterfall trả về; `undefined` nghĩa là để hỏng hóc thành kết cục cuối. */
export type RequestErrorAction = { kind: "retry" } | undefined;

/** Gọi tiếp tầng dưới của waterfall `agent/request-error`. */
export type RequestErrorNext = () => Promise<RequestErrorAction>;

/** Session của agent — chỉ phần bộ điều phối này chạm tới. */
export interface RetrySession {
  /** Ghi một sự kiện bền vào log phiên. */
  append(type: string, data: unknown): void;
}

/** Agent đang chạy — chỉ phần bộ điều phối này chạm tới. */
export interface RetryAgent {
  /** Phiên của agent. */
  readonly session: RetrySession;
}

/** Payload của waterfall \`agent/request-error\` — một lần hỏng request đã được định tuyến provider. */
export interface RequestErrorPayload {
  /** Agent có request hỏng. */
  readonly agent: RetryAgent;
  /** Lượt chứa request hỏng. */
  readonly turn: number;
  /** Bước chứa lần thử request đã hỏng. */
  readonly step: number;
  /** Provider được chọn cho request đã hỏng. */
  readonly provider: string;
  /** Sự thật đã chuẩn hoá ở ranh giới adapter cuối. */
  readonly failure: LlmFailure;
  /** Chính sách của lượt đăng ký adapter đã phục vụ request hỏng; vắng khi chưa chọn adapter cuối. */
  readonly retryPolicy: ResolvedRetryPolicy | undefined;
  /** Tín hiệu huỷ của lượt. */
  readonly signal: AbortSignal;
}

/** Một sự kiện phiên đã cam kết — chỉ phần bộ chiếu này chạm tới. */
export interface LlmRetrySessionEvent {
  /** Loại sự kiện phiên. */
  readonly type: string;
  /** Dữ liệu mang theo; chỉ được ĐỌC khi `type` là `llm/retry`, nên kiểu ở đây là payload của chính loại đó. */
  readonly data: LlmRetryEventData;
}
