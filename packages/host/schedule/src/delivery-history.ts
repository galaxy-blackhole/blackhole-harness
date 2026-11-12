/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 lib/types/delivery-history.js (@deepseek-ai/dsh-schedule): đọc lịch sử giao đã lưu,
 *      nối một biên nhận THẬT vào cùng lượt ghi với trạng thái/đích, và phân trang theo danh tính
 *      message (mới nhất trước) mà không đọc Session.
 */

import type { ScheduleTask } from "./storage.ts";
import type {
  DeliveryRetentionBounds,
  ScheduleDeliveryHistoryRequest,
  ScheduleDeliveryHistoryResult,
  ScheduleDeliveryReceipt,
} from "./types.ts";

/** Số mili giây của một ngày — đơn vị mà cửa sổ lưu giữ được phát biểu. */
const DAY_MS = 86_400_000;

/** Lịch sử đã lưu của MỘT tác vụ, đã chắc chắn có mặt (hết optional). */
type StoredDeliveryHistory = NonNullable<ScheduleTask["deliveryHistory"]>;

/**
 * Đọc lịch sử còn giữ; lịch sử thiếu chỉ phơi ra biên nhận legacy THẬT.
 * @param task - Tác vụ bền bất biến.
 * @returns Các lần giao còn giữ, cũ nhất trước, không sửa lưu trữ.
 */
function deliveryHistoryOf(task: ScheduleTask): StoredDeliveryHistory {
  return task.deliveryHistory ?? {
    records: task.lastDelivery === undefined ? [] : [task.lastDelivery],
    earlierRecordsUnavailable: true,
  };
}

/**
 * Chuẩn bị MỘT biên nhận hộp thư THẬT cho đúng lượt ghi tác vụ với trạng thái và đích của nó.
 * Cắt theo cửa sổ và trần bản ghi đã cấu hình NGAY TẠI ĐÂY, trên đường ghi duy nhất: miền công bố
 * một tài liệu nguyên-đơn-vị mỗi lượt ghi, nên mảng không chặn sẽ phình tài liệu ấy theo từng biên
 * nhận. Đường đọc không tự đặt chặn, vì tài liệu nguyên-đơn-vị vượt giới hạn schema sẽ từ chối mở.
 * @param task - Tác vụ cung cấp câu nhắc bất biến đã gửi và lịch sử còn giữ.
 * @param receipt - Biên nhận lấy được SAU khi Session flush thành công.
 * @param bounds - Cửa sổ lưu giữ và trần bản ghi đã cấu hình cho lịch sử được nối.
 * @returns Biên nhận và lịch sử còn giữ; bên gọi chỉ công bố chúng sau khi tác vụ đã bền.
 */
export function appendDelivery(
  task: ScheduleTask,
  receipt: ScheduleDeliveryReceipt,
  bounds: DeliveryRetentionBounds,
): Required<Pick<ScheduleTask, "lastDelivery" | "deliveryHistory">> {
  const history = deliveryHistoryOf(task);
  const appended = [...history.records, { ...receipt, prompt: task.record.prompt }];
  const floor = Date.parse(receipt.deliveredAt) - bounds.days * DAY_MS;
  const retained = appended
    .filter(record => Date.parse(record.deliveredAt) >= floor)
    .slice(-bounds.records);
  return {
    lastDelivery: receipt,
    deliveryHistory: {
      records: retained,
      earlierRecordsUnavailable: history.earlierRecordsUnavailable || retained.length !== appended.length,
      earlierRecordsPruned: history.earlierRecordsPruned === true || retained.length !== appended.length,
    },
  };
}

/**
 * Đọc MỘT trang mới-nhất-trước theo thứ tự ghi, độc lập với thứ tự đồng hồ tường.
 * @param task - Tác vụ đã được kiểm khớp ràng buộc Session được yêu cầu.
 * @param request - Cỡ trang tường minh đã kiểm và con trỏ message loại trừ tuỳ chọn.
 * @param retention - Giới hạn cấu hình hiện tại, dùng chung với bộ ghi giao.
 * @returns Bản sao các bản ghi giao, hoặc kết quả không tìm thấy con trỏ.
 */
export function deliveryHistoryPage(
  task: ScheduleTask,
  request: ScheduleDeliveryHistoryRequest,
  retention: DeliveryRetentionBounds,
): ScheduleDeliveryHistoryResult {
  const history = deliveryHistoryOf(task);
  const end = request.before === undefined
    ? history.records.length
    : history.records.findIndex(record => record.messageId === request.before);
  if (end === -1) return { id: request.id, code: "delivery_cursor_not_found" };
  const start = Math.max(0, end - request.limit);
  const records = history.records.slice(start, end).reverse().map(({ prompt, ...receipt }) => ({
    ...receipt, ...(prompt === undefined ? {} : { prompt }),
  }));
  const oldest = records.at(-1);
  return {
    id: request.id, records, earlierRecordsUnavailable: history.earlierRecordsUnavailable,
    earlierRecordsPruned: history.earlierRecordsPruned === true, retention: { ...retention },
    ...(oldest !== undefined && start > 0 ? { nextBefore: oldest.messageId } : {}),
  };
}
