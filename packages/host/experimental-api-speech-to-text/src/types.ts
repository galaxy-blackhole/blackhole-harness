/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểu JSON-safe của namespace Remote `speech` — port 1:1 từ lib/types/types.d.ts của
 *      @deepseek-ai/dsh-experimental-api-speech-to-text: TranscriptionRequest, SpeechCatalog và
 *      augmentation hai mã lỗi `speech/invalid-audio` · `speech/transcription-failed`.
 */

import type { SpeechProviderId, SpeechSnapshot } from "@galaxy-blackhole/gbh-experimental-speech-to-text/types";

/** Mã lỗi Remote mà namespace `speech` có thể ném (bổ sung vào bảng của typert-protocol). */
declare module "@deepseek-ai/dsh-typert-protocol" {
  interface RemoteErrorDetailsMap {
    /** Mã hoá audio hoặc giới hạn đầu vào đã chặn việc transcribe. */
    "speech/invalid-audio": {
      readonly reason: string;
    };
    /** Provider đã chọn từ chối transcribe. */
    "speech/transcription-failed": {
      readonly reason: string;
    };
  }
}

/** Bản ghi hoàn chỉnh gửi đi transcribe, tách khỏi việc nhận vào Session. */
export interface TranscriptionRequest {
  /** WAV chuẩn (16 kHz mono PCM16) mã hoá base64 chuẩn. */
  readonly audioBase64: string;
  /** Recognizer được chọn; bỏ trống thì dùng lựa chọn mặc định của Host. */
  readonly providerId?: SpeechProviderId;
  /** Gợi ý ngôn ngữ; bỏ trống thì dùng lựa chọn đã lưu. */
  readonly language?: string;
}

/** Lựa chọn provider hiện tại và giới hạn đầu vào audio. */
export interface SpeechCatalog extends SpeechSnapshot {
  /** Số byte WAV đã giải mã tối đa cho mỗi request. */
  readonly maxAudioBytes: number;
  /** Thời lượng PCM tối đa của bản ghi, tính bằng giây. */
  readonly maxDurationSeconds: number;
}
