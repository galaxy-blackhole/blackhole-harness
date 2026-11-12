/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Tiện ích dựng lại header yêu cầu trên các sự kiện phiên `request/header` đầy đủ: ai giữ
 *      log phiên cũng dựng lại được {@link EpochHeader} mà một yêu cầu đã dựng dưới nó bằng cách
 *      lấy ảnh chụp chuẩn tắc mới nhất; vòng lặp dùng cùng hàm so sánh để khỏi ghi header không đổi.
 *      Port 1:1 vùng `lib/types/request-header.js` (62 dòng) của `@deepseek-ai/dsh-session`.
 */

/**
 * Tiện ích dựng lại header yêu cầu trên các sự kiện phiên `request/header` đầy đủ.
 *
 * @module @galaxy-blackhole/gbh-session/request-header
 */

import { callConfigEquals } from '@galaxy-blackhole/gbh-llm';
import type { ToolSchema } from '@galaxy-blackhole/gbh-llm';

import type { EpochHeader, SessionEvent } from './types.ts';

/**
 * Chuẩn hoá một header về dạng chuẩn tắc: danh sách công cụ rỗng trở thành trường vắng mặt, đúng
 * như cách yêu cầu được dựng. Việc ghi log, gộp và so sánh đều dùng chung một biểu diễn này.
 *
 * Nhận: header — header cần chuẩn hoá (không bị sửa tại chỗ).
 * Trả: header ở dạng chuẩn tắc.
 *
 * @param header - header cần chuẩn hoá (không bị sửa tại chỗ).
 * @returns header ở dạng chuẩn tắc.
 */
export function canonicalHeader(header: EpochHeader): EpochHeader {
  const adapterDefaults = header.adapterDefaults;
  return {
    config: header.config,
    ...(adapterDefaults?.reasoningEffort === true || adapterDefaults?.maxTokens === true
      ? { adapterDefaults }
      : {}),
    ...(header.tools !== undefined && header.tools.length > 0 ? { tools: header.tools } : {}),
  };
}

/**
 * So sánh JSON chuẩn tắc cho các schema công cụ được lắp qua cùng một đường.
 *
 * Nhận: a — một schema công cụ; b — schema kia (có thể vắng khi so theo cặp chỉ số).
 * Trả: true khi hai schema trùng nhau từng byte JSON.
 */
function sameSchema(a: ToolSchema, b: ToolSchema | undefined): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * So sánh từng trường trên các header chuẩn tắc. Schema công cụ so theo đúng thứ tự.
 *
 * Nhận: a — một header chuẩn tắc; b — header còn lại.
 * Trả: true khi config, các mặc định adapter và công cụ đều khớp.
 *
 * @param a - một header chuẩn tắc.
 * @param b - header còn lại.
 * @returns true khi config, các mặc định adapter và công cụ đều khớp.
 */
export function headerEquals(a: EpochHeader, b: EpochHeader): boolean {
  if (!callConfigEquals(a.config, b.config)
    || a.adapterDefaults?.reasoningEffort !== b.adapterDefaults?.reasoningEffort
    || a.adapterDefaults?.maxTokens !== b.adapterDefaults?.maxTokens)
    return false;
  const at = a.tools ?? [];
  const bt = b.tools ?? [];
  return at.length === bt.length && at.every((tool: ToolSchema, i: number) => sameSchema(tool, bt[i]));
}

/**
 * Gộp các sự kiện header của một log (hoặc một tiền tố bất kỳ) thành {@link EpochHeader} đang có
 * hiệu lực sau ảnh chụp cuối cùng. Các sự kiện không phải header bị bỏ qua. Đây là đường dựng lại
 * thuần offline; phiên live theo dõi đúng phép gộp đó theo kiểu tăng dần.
 *
 * Nhận: events — sự kiện phiên theo thứ tự log; from — trạng thái đã gộp trước đó để nối tiếp.
 * Trả: header chuẩn tắc mới nhất, hoặc undefined khi chưa có header nào.
 *
 * @param events - sự kiện phiên theo thứ tự log.
 * @param from - trạng thái đã gộp trước đó để nối tiếp.
 * @returns header chuẩn tắc mới nhất, hoặc undefined khi chưa có header nào.
 */
export function foldRequestHeader(events: readonly SessionEvent[], from?: EpochHeader): EpochHeader | undefined {
  let state = from;
  for (const event of events) {
    if (event.type === 'request/header')
      state = canonicalHeader(event.data.header);
  }
  return state;
}
