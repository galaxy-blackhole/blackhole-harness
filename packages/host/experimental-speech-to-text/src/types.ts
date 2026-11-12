/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểu dùng chung của @galaxy-blackhole/gbh-experimental-speech-to-text — port 1:1 từ
 *      @deepseek-ai/dsh-experimental-speech-to-text/lib/types/types.d.ts: đầu vào và metadata
 *      đăng ký provider phiên âm, trung lập với nhà cung cấp.
 */

/**
 * Đầu vào và metadata đăng ký provider nhận dạng giọng nói, trung lập với nhà cung cấp:
 * danh tính provider, ước lượng tài nguyên, trạng thái chuẩn bị, đầu vào/đầu ra phiên âm.
 * Module này chỉ có KIỂU — bản gốc build ra `lib/types/types.js` rỗng (`export {}`).
 *
 * @module @galaxy-blackhole/gbh-experimental-speech-to-text/types
 */

import type { Branded } from "@deepseek-ai/dsh-brand";

/** Danh tính đã cấu hình của một provider phiên âm. */
export type SpeechProviderId = Branded<"SpeechProviderId">;

/**
 * Ước lượng lập kế hoạch riêng của provider — KHÔNG phải tiến độ đo được, cũng không phải
 * hạn mức tài nguyên được bảo đảm.
 */
export interface SpeechSetupEstimate {
  readonly recommendedDiskBytes: number;
  readonly expectedMemoryBytes: number;
  readonly minimumMinutes: number;
  readonly maximumMinutes: number;
}

/** Sự thật công khai của provider; thông tin xác thực và đường dẫn tệp bị loại trừ. */
export interface SpeechProviderInfo {
  readonly id: SpeechProviderId;
  readonly name: string;
  readonly location: "host-local" | "cloud";
  /** Gợi ý ngôn ngữ được chấp nhận, kể cả tự nhận dạng khi provider hỗ trợ. */
  readonly languages: readonly string[];
  readonly setupEstimate?: SpeechSetupEstimate;
  /** Nguồn tải xuống được chào cho một lượt chuẩn bị tường minh; bỏ trống khi không có lựa chọn. */
  readonly downloadSources?: readonly string[];
}

/**
 * Các thao tác chuẩn bị tài nguyên có thứ tự mà UI giọng nói hiểu được. Provider bỏ qua
 * những thao tác nó không cần.
 */
export type SpeechPreparationStepKind = "check" | "model" | "vad" | "verify" | "load";

/** Một thao tác do Host sở hữu; chỉ trạng thái đang chạy mới có đồng hồ thời gian thực. */
export interface SpeechPreparationStep {
  readonly kind: SpeechPreparationStepKind;
  readonly status: "pending" | "running" | "complete" | "failed" | "cancelled";
  readonly startedAt?: number;
}

/**
 * Chẩn đoán tải xuống an toàn cho hướng dẫn chuẩn bị đã bản địa hoá; URL bỏ thông tin
 * xác thực và chuỗi truy vấn.
 */
export interface SpeechDownloadFailure {
  readonly resource: string;
  readonly source: string;
  readonly reason:
    | "network"
    | "dns"
    | "timeout"
    | "certificate"
    | "http"
    | "integrity"
    | "storage"
    | "unknown";
  readonly code?: string;
  readonly status?: number;
}

/**
 * Trạng thái chuẩn bị do Host sở hữu; tổng số byte mô tả TẢI XUỐNG, không bao giờ là phần
 * trăm cài đặt ước lượng.
 */
export type SpeechPreparationState = (
  | { readonly phase: "unprepared" | "ready" | "standby" | "cancelled" }
  | {
      readonly phase: "downloading";
      readonly resource: string;
      readonly completedBytes: number;
      readonly totalBytes?: number;
    }
  | { readonly phase: "checking" | "loading" | "waking" | "cancelling"; readonly startedAt: number }
  | {
      readonly phase: "failed";
      readonly message: string;
      readonly download?: SpeechDownloadFailure;
    }
) & {
  readonly step?: SpeechPreparationStepKind;
  readonly steps?: readonly SpeechPreparationStep[];
};

/** Sự thật của provider kèm mức sẵn sàng tài nguyên hiện tại; độc lập với việc plugin có bật. */
export interface SpeechProviderView extends SpeechProviderInfo {
  readonly preparation: SpeechPreparationState;
}

/** Lựa chọn mặc định do Host lưu bền, chụp lại lúc một lượt ghi âm bắt đầu. */
export interface SpeechSelection {
  readonly providerId: SpeechProviderId;
  readonly language: string;
}

/** Ý định của người dùng chỉ cập nhật đúng những trường ưu tiên đã đổi. */
export interface SpeechSelectionPatch {
  readonly providerId?: SpeechProviderId;
  readonly language?: string;
}

/** Một quan sát nhất quán về danh sách provider và lựa chọn mặc định. */
export interface SpeechSnapshot {
  readonly providers: readonly SpeechProviderView[];
  readonly selection: SpeechSelection;
}

/** Lựa chọn tải xuống cho một lượt chuẩn bị; bỏ trống thì giữ chính sách đã cấu hình của provider. */
export interface SpeechPreparationOptions {
  /** Một nguồn đã được chào; provider từ chối nguồn không có và dùng lựa chọn tay, không dự phòng. */
  readonly downloadSource?: string;
}

/** Điều khiển chuẩn bị tài nguyên tuỳ chọn. Provider không có chúng thì dùng được ngay. */
export interface SpeechPreparation {
  /** @returns trạng thái mới nhất do Host sở hữu. */
  snapshot(): SpeechPreparationState;
  /** @param listener - callback báo trạng thái đã cũ. @returns hàm huỷ đăng ký. */
  subscribe(listener: () => void): () => void;
  /**
   * Bắt đầu hoặc tham gia lượt chuẩn bị hiện tại; vòng đời trang và đường truyền không sở hữu nó.
   * @param options - lựa chọn tải xuống cục bộ của lượt; provider từ chối đổi nguồn của việc đang chạy.
   */
  prepare(options?: SpeechPreparationOptions): void;
  /** Huỷ chuẩn bị. @returns sau khi tài nguyên của nó đã ổn định. */
  cancel(): Promise<void>;
}

/** Bản ghi âm hoàn chỉnh kèm gợi ý ngôn ngữ tường minh. */
export interface SpeechInput {
  readonly audio: Uint8Array;
  readonly language: string;
}

/** Kết quả phiên âm cuối; chuỗi rỗng nghĩa là không nhận dạng được tiếng nói. */
export interface Transcript {
  readonly text: string;
  readonly audioSeconds: number;
  readonly inferenceSeconds: number;
}

/** Một bộ nhận dạng thay thế được. Nó sở hữu chuẩn bị, thực thi và huỷ. */
export interface SpeechProvider {
  readonly info: SpeechProviderInfo;
  readonly preparation?: SpeechPreparation;
  /**
   * Nhận dạng một bản ghi âm hoàn chỉnh mà không gửi thông điệp Agent nào.
   * @param input - byte WAV và ngôn ngữ, chỉ mượn tới khi ổn định.
   * @param signal - huỷ từ người gọi hoặc từ đăng ký; từ chối sau khi đã dọn tài nguyên.
   * @returns văn bản cuối và thời lượng âm thanh/suy luận đã đo.
   */
  transcribe(input: SpeechInput, signal: AbortSignal): Promise<Transcript>;
}

/** Lựa chọn của người gọi trước khi mặc định của composition được giải. */
export interface SpeechRequest {
  readonly audio: Uint8Array;
  readonly providerId?: SpeechProviderId;
  readonly language?: string;
}

/** Lựa chọn đã giải ghim đúng provider đã đăng ký, kể cả vòng đời của nó. */
export interface SpeechSpec extends SpeechInput {
  readonly provider: SpeechProvider;
}
