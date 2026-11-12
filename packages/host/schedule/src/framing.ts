/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Khung nhìn quản lý và câu khung model-facing của nhắc hẹn: dựng khung nhìn một lần chạy
 *      (scheduleView), câu nhắc một lần (renderReminderFraming), và câu nhắc theo lô lặp
 *      (renderRecurringReminderBatchFraming). Port 1:1 từ domain.js của @deepseek-ai/dsh-schedule,
 *      dòng 1547–hết.
 */

import type { OneShotScheduleRecord, RecurringScheduleRecord, ScheduleRecord, ScheduleView } from "./types.ts";

/**
 * Dựng MỘT khung nhìn quản lý cục bộ theo lượt chạy.
 * Trạng thái thời gian chỉ là phép so mốc đồng hồ với đích đã cam kết; chế độ giao luôn là "host".
 * @param record - Bản ghi bền đang hoạt động.
 * @param now - Mốc đồng hồ tường dùng cho trạng thái thời gian của nó.
 * @returns Khung nhìn giao nhận đầy đủ của Host, đã đóng băng; giữ nguyên mọi trường của bản ghi.
 */
export function scheduleView(record: ScheduleRecord, now: number): ScheduleView {
  return Object.freeze({
    ...record,
    state: now >= Date.parse(record.scheduledAt) ? "overdue" : "scheduled",
    deliveryMode: "host",
  });
}

/** Dòng gốc cố định mà model thấy, dùng chung cho nhắc một lần và nhắc lặp. */
const SCHEDULED_MESSAGE_FRAMING = "This is a scheduled message from the user";

/**
 * Dựng câu khung cố định cho model từ MỘT nhắc đã tới hạn.
 * @param record - Bản ghi một lần đang hoạt động và đã tới hạn.
 * @returns Văn bản ổn định mà model thấy, các trường động được escape bằng JSON.
 */
export function renderReminderFraming(record: OneShotScheduleRecord): string {
  return [
    "[SCHEDULE REMINDER]",
    SCHEDULED_MESSAGE_FRAMING,
    `schedule_id_json: ${JSON.stringify(record.id)}`,
    `occurrence_at: ${record.scheduledAt}`,
    `reminder_prompt_json: ${JSON.stringify(record.prompt)}`,
  ].join("\n");
}

/**
 * Dựng câu khung cho MỘT lô nhắc lặp, theo đúng thứ tự được truyền vào.
 * @param reminders - Lô đã nhận ĐẦY ĐỦ, mỗi bản ghi đúng một lần tới hạn muộn nhất.
 * @returns Văn bản ổn định mà model thấy, phần động là JSON chuẩn tắc.
 */
export function renderRecurringReminderBatchFraming(
  reminders: readonly { readonly record: RecurringScheduleRecord; readonly occurrenceAt: string }[],
): string {
  const payload = reminders.map(({ record, occurrenceAt }) => ({
    schedule_id: record.id,
    occurrence_at: occurrenceAt,
    reminder_prompt: record.prompt,
  }));
  return [
    "[SCHEDULE REMINDER BATCH]",
    SCHEDULED_MESSAGE_FRAMING,
    `reminders_json: ${JSON.stringify(payload)}`,
  ].join("\n");
}
