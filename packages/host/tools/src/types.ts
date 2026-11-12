/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 types.js/.d.ts (bản gốc 6 dòng mã chạy): từ vựng EVENT Tool BỀN, chia sẻ với nơi chỉ
 *      tiêu thụ kiểu. Tệp CHỈ có kiểu ⇒ bản build ra là một module rỗng, đúng như `lib/types/types.js`
 *      của bản gốc. Khối khai cộng gộp `@deepseek-ai/dsh-session/types` (`SessionEventMap`) của bản
 *      gốc KHÔNG port (ADR 000d: cấm augment module) — seam được khai theo CẤU TRÚC ở cuối tệp.
 */

import type { ToolCallId } from "@deepseek-ai/dsh-llm/brand";
import type { ContentBlock } from "@deepseek-ai/dsh-llm/types";
import type { JsonValue } from "@deepseek-ai/dsh-util-values";

/**
 * Thân dữ liệu ghi lại khi MỘT lượt điều phối Tool ở chế độ PTC lồng nhau BẮT ĐẦU.
 * Nhận: `rootCallId`, `parentCallId`, `subCallId` — ba định danh lời gọi; `name` — tên tool;
 *        `arguments` — tham số đã chuẩn hoá JSON trước khi điều phối.
 * Trả: hình dạng dữ liệu của event `tool/ptc-dispatch-start`; không có giá trị lúc chạy.
 */
export interface PtcDispatchStartEventData {
  /** Định danh lời gọi gốc (lời gọi `run_code` ngoài cùng). */
  rootCallId: ToolCallId;
  /** Định danh lời gọi cha đã phát sinh lượt điều phối này. */
  parentCallId: ToolCallId;
  /** Định danh lời gọi con, do lõi cấp (các lời gọi mới dùng `<parent>:ptc:<n>`). */
  subCallId: ToolCallId;
  /** Tên tool được điều phối. */
  name: string;
  /** Tham số JSON đã chuẩn hoá, đúng giá trị đã điều phối. */
  arguments: unknown;
}

/**
 * Thân dữ liệu ghi lại khi MỘT lượt điều phối Tool ở chế độ PTC lồng nhau KẾT THÚC.
 * Nhận: mọi trường của {@link PtcDispatchStartEventData} cộng `isError`, `content`, `meta` (tuỳ
 *        chọn) và `error` (tuỳ chọn) — kết quả bền của lời gọi con.
 * Trả: hình dạng dữ liệu của event `tool/ptc-dispatch`; không có giá trị lúc chạy.
 */
export interface PtcDispatchEventData extends PtcDispatchStartEventData {
  /** True khi lời gọi con kết thúc ở trạng thái lỗi (kể cả bị huỷ). */
  isError: boolean;
  /** Content phía model của lời gọi con, đúng từ vựng `tool/result`. */
  content: ContentBlock[];
  /** Metadata trình bày do tool sở hữu, phát lại được, tách khỏi content phía model. */
  meta?: JsonValue;
  /** Danh tính lỗi tuỳ chọn và chi tiết thô cho người dùng, nằm ngoài content phía model. */
  error?: {
    /** Tên lớp lỗi. */
    name: string;
    /** Mã lỗi ổn định. */
    code: string;
    /** Lý do người đọc được, khi có. */
    reason?: string;
  };
}

// ADR 000d — KHÔNG khai cộng gộp `@deepseek-ai/dsh-session/types` (`interface SessionEventMap`) ở đây:
// bản gốc khai trong .d.ts của CHÍNH nó, còn gói viết lại chỉ cần seam theo CẤU TRÚC. Hai khoá event mà
// module này đóng góp là `tool/ptc-dispatch-start` (thân PtcDispatchStartEventData, ghi khi scheduler
// THẬT SỰ bắt đầu lời gọi) và `tool/ptc-dispatch` (thân PtcDispatchEventData, ghi khi lời gọi con kết
// thúc); nơi tiêu thụ tự khai bảng tên→thân khi cần, không chiếm không gian kiểu toàn cục.
