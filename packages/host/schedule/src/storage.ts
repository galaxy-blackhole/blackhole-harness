/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Port 1:1 lib/types/storage.js (@deepseek-ai/dsh-schedule): khai báo MIỀN lưu trữ bền của Host —
 *      schema tác vụ (bản ghi · trạng thái · biên nhận gần nhất · lịch sử giao) và `scheduleDomain`
 *      phiên bản 1 với đúng một bảng `tasks`; tác vụ sai hình dạng chặn mở miền.
 */

// Nạp zod qua "zod/v4" (quy ước repo): ambient shim `declare module "zod"` cho bundle trình duyệt
// che mất kiểu thật khi tsc đọc cả chương trình.
import { z } from "zod/v4";

import { MessageId } from "@deepseek-ai/dsh-llm/brand";
import { SessionId } from "@deepseek-ai/dsh-session";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";

import { decodeScheduleRecord } from "./codec.ts";
import type { ScheduleId, ScheduleTask } from "./types.ts";

/** Giá trị tác vụ bền; lịch sử thiếu chỉ giữ biên nhận legacy, không viết lại lúc đọc. */
export type { ScheduleTask };

/** Bản ghi quy tắc bền, giải mã qua ranh giới bền; hỏng thì thêm issue thay vì ném ra ngoài. */
const recordSchema = z.unknown().transform((value, context) => {
  try {
    return decodeScheduleRecord(value);
  } catch (error) {
    context.addIssue({ code: "custom", message: String(error) });
  }
  return z.NEVER;
});

/** Instant UTC bốn chữ số năm, chính xác mili giây; năm `0000` bị từ chối. */
const instantSchema = z.iso.datetime({ precision: 3 }).refine(value => !value.startsWith("0000-"), {
  message: "Expected a canonical four-digit-year UTC calendar instant",
});

/** Biên nhận giao vào hộp thư: đích, thời điểm giao, và danh tính message đã giao. */
const deliveryReceiptSchema = z.object({
  scheduledAt: instantSchema,
  deliveredAt: instantSchema,
  messageId: z.string().min(1).refine(value => value.trim() === value).transform(MessageId),
}).strict();

/** Lịch sử giao còn giữ của MỘT tác vụ, cộng hai cờ nguồn gốc; message phải duy nhất trong tác vụ. */
const deliveryHistorySchema = z.object({
  records: z.array(deliveryReceiptSchema.extend({ prompt: z.string().optional() }).strict()),
  earlierRecordsUnavailable: z.boolean(),
  earlierRecordsPruned: z.boolean().optional(),
}).strict().refine(history => new Set(history.records.map(record => record.messageId)).size === history.records.length, {
  message: "Delivery history message identities must be unique within a task",
});

/**
 * Tác vụ đã lưu gắn MỘT schedule với Session gốc của nó; `status` vắng mặt giải mã là `active`.
 * Biên nhận gần nhất phải khớp bản ghi cuối của lịch sử, nếu lịch sử có mặt.
 */
export const scheduleTaskSchema = z.object({
  sessionId: z.string().min(1).transform(SessionId),
  record: recordSchema,
  status: z.enum(["active", "inactive"]).default("active"),
  lastDelivery: deliveryReceiptSchema.optional(),
  deliveryHistory: deliveryHistorySchema.optional(),
}).strict().refine((task) => {
  if (task.deliveryHistory === undefined) return true;
  const latest = task.deliveryHistory.records.at(-1);
  if (latest === undefined) return task.lastDelivery === undefined;
  return task.lastDelivery !== undefined
    && latest.scheduledAt === task.lastDelivery.scheduledAt
    && latest.deliveredAt === task.lastDelivery.deliveredAt
    && latest.messageId === task.lastDelivery.messageId;
}, { message: "Last delivery must match the latest saved delivery receipt" });

/** Miền lưu trữ Schedule có thẩm quyền; tác vụ sai hình dạng từ chối mở miền. */
export const scheduleDomain = defineDomain({
  name: "schedule",
  version: 1,
  tables: { tasks: domainTable<ScheduleId, ScheduleTask>(scheduleTaskSchema) },
});
