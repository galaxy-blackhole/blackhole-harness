/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Kiểu dữ liệu của row cot-translation — NGUYÊN VĂN lib/types/types.d.ts của bản gốc
 */

import type { TranslationProvider } from "@galaxy-blackhole/gbh-host-experimental-translator";

/** Lựa chọn dịch; auto nhắm tới ngôn ngữ UI đang hoạt động. */
export interface CotTranslationPreferences {
  /** Provider tường minh; request KHÔNG bao giờ tự rơi sang provider khác. */
  provider: TranslationProvider;
  /** Mã ngôn ngữ BCP 47, hoặc auto để theo ngôn ngữ UI. */
  targetLanguage: string;
}

/** Metadata do Host cấp, đọc TRƯỚC khi gửi bất kỳ đoạn suy luận nào. */
export interface CotTranslationSnapshot {
  /** Độ dài UTF-16 tối đa mà một request dịch nhận. */
  maxTextChars: number;
  /** Provider + ngôn ngữ đích đang được chấp nhận. */
  preferences: CotTranslationPreferences;
  /** Endpoint ẩn danh và route trả phí đang đủ điều kiện dịch. */
  availableProviders: readonly TranslationProvider[];
}

declare module "@deepseek-ai/dsh-typert-protocol" {
  /** Khe chi tiết lỗi Remote của seam typert — thêm mã lỗi của row này (nguyên văn bản gốc). */
  interface RemoteErrorDetailsMap {
    /** Lỗi provider hoặc đầu vào, KHÔNG kèm văn bản gốc lẫn nội dung phản hồi. */
    "cotTranslation/failed": Record<string, never>;
  }
}
