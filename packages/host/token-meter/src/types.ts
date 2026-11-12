/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Từ vựng CÔNG KHAI của đo token khi phát lại phiên — bản viết lại 1:1 lib/types/types.d.ts của
 *      `@deepseek-ai/dsh-token-meter`.
 */

import type { TokenUsage } from "@deepseek-ai/dsh-llm";
import type { SessionLogOffset, SessionSeq } from "@galaxy-blackhole/gbh-session/types";

/** Cấu hình plugin token-meter; bộ ước lượng cố định KHÔNG có thiết lập nào. */
export type TokenMeterConfig = Record<string, never>;

/** Mốc neo mà một delta bề mặt CÓ DẤU tạo ra áp lực hiện tại. */
export type TokenMeasurementBaseline =
  | { readonly kind: "none"; readonly tokens: 0 }
  | { readonly kind: "estimated"; readonly tokens: number }
  | { readonly kind: "usage"; readonly tokens: number; readonly usage: Readonly<TokenUsage> };

/** Ảnh chụp BẤT BIẾN, tách rời của áp lực yêu cầu và bề mặt tại MỘT revision log đã tiêu thụ. */
export interface TokenMeasurement {
  /** Số sự kiện bền đã tiêu thụ; bằng seq sự kiện kế tiếp chưa đọc. */
  readonly logRevision: SessionLogOffset;
  /** Mốc neo (provider hoặc ước lượng) dùng cho lần đo này. */
  readonly baseline: TokenMeasurementBaseline;
  /** Định giá LẠI CÓ DẤU của nội dung bề mặt hiện tại so với mốc neo. */
  readonly surfaceDeltaTokens: number;
  /** Áp lực yêu cầu-và-phản hồi hiện tại, KHÔNG âm. */
  readonly totalTokens: number;
  /** Tổng token yêu cầu đã định giá theo tuyến trên bề mặt hiện tại; bằng tổng giá các node. */
  readonly surfaceTokens: number;
  /** Các node bề mặt hiện tại theo thứ tự vị trí đầu→cuối. */
  readonly nodes: readonly TokenSurfaceNode[];
}

/** MỘT node đã định giá token trong bề mặt phiên có thứ tự hiện tại. */
export interface TokenSurfaceNode {
  /** Số thứ tự bền của sự kiện bề mặt. */
  readonly seq: SessionSeq;
  /** Token áp lực yêu cầu cho đúng tin nhắn mà node này phóng chiếu, dưới tuyến đã đo. */
  readonly tokens: number;
  /** Token theo ước lượng CỐ ĐỊNH cho cùng tin nhắn, độc lập tuyến. */
  readonly heuristicTokens: number;
}
