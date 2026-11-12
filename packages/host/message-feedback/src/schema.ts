/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Khuôn dữ liệu và phép gấp trạng thái của row message-feedback: hai schema zod kiểm THÂN event
 *      đã lưu trước khi suy ra phản hồi hiện tại, phép gấp `currentItems` (đọc theo thứ tự tạo lần đầu),
 *      và hai hàm dựng kết quả bất biến `success`/`rejected`. Không chạm seam nào — test được riêng.
 */

import { FEEDBACK_CATEGORIES } from "@galaxy-blackhole/gbh-command-feedback";
import { z } from "zod/v4";

import type {
  MessageFeedbackFailure,
  MessageFeedbackItem,
  MessageFeedbackLogEvent,
  MessageFeedbackPut,
  MessageFeedbackPutEvent,
  MessageFeedbackRejected,
  MessageFeedbackSuccess,
  SessionId,
} from "./types.ts";

/** Mốc thời gian mili-giây: số nguyên, không âm, trong miền số nguyên an toàn. */
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

/** Một mục phản hồi đã lưu: đủ trường, và `updatedAt` không được đi trước `createdAt`. */
export const itemSchema = z
  .object({
    messageId: z.string().min(1),
    rating: z.enum(["positive", "negative"]),
    note: z
      .string()
      .refine((note) => note.trim().length > 0)
      .optional(),
    category: z.enum(FEEDBACK_CATEGORIES).optional(),
    version: z.uuid(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .refine((item) => item.updatedAt >= item.createdAt);

/** Thân của một event `feedback/message-put` đã lưu. */
export const putSchema = z.object({ sessionId: z.string().min(1), item: itemSchema });

/** Thân của một event `feedback/message-delete` đã lưu. */
export const deleteSchema = z.object({ sessionId: z.string().min(1), messageId: z.string().min(1) });

/**
 * Trả một giá trị BẤT BIẾN thuộc quyền bên gọi, tách khỏi log.
 * Nhận: mục phản hồi (có thể là vật đang nằm trong event).
 * Trả: ảnh chụp đông cứng MỚI — sửa nó không chạm bản trong log.
 */
export function snapshotItem(item: MessageFeedbackItem): MessageFeedbackItem {
  return Object.freeze({ ...item });
}

/**
 * Dựng kết quả thành công bất biến.
 * Nhận: giá trị trả về.
 * Trả: object `{ ok: true, value }` đã đông cứng.
 */
export function success<T>(value: T): MessageFeedbackSuccess<T> {
  return Object.freeze({ ok: true, value });
}

/**
 * Dựng kết quả bị từ chối bất biến.
 * Nhận: lỗi nghiệp vụ cụ thể.
 * Trả: object `{ ok: false, error }` đã đông cứng (lỗi cũng đông cứng).
 */
export function rejected<E extends MessageFeedbackFailure>(error: E): MessageFeedbackRejected<E> {
  return Object.freeze({ ok: false, error: Object.freeze(error) });
}

/**
 * Kiểm thân MỌI event phản hồi đã lưu rồi suy ra các mục hiện tại của MỘT phiên.
 *
 * Thân event hỏng ⇒ `parse` NÉM (fail-closed: không suy ra trạng thái từ log không đọc được).
 * Giá trị được lưu là CHÍNH vật trong event (đã kiểm), không phải bản `parse` trả về — giữ nguyên
 * danh tính như bản gốc. Thứ tự là thứ tự TẠO LẦN ĐẦU (Map giữ chỗ của khoá đã có).
 * Nhận: id phiên cần lọc + toàn bộ event của log.
 * Trả: mảng mục phản hồi hiện tại (rỗng khi chưa có gì).
 */
export function currentItems(sessionId: SessionId, events: readonly MessageFeedbackLogEvent[]): MessageFeedbackItem[] {
  const items = new Map<string, MessageFeedbackItem>();
  for (const event of events) {
    switch (event.type) {
      case "feedback/message-put": {
        // Kiểm rồi dùng CHÍNH vật thô trong event (không dùng bản `parse` trả về) — như bản gốc,
        // để danh tính của mục trong log không bị thay bằng một bản sao.
        putSchema.parse(event.data);
        const raw = event.data as MessageFeedbackPut;
        if (raw.sessionId === sessionId) items.set(raw.item.messageId, raw.item);
        break;
      }
      case "feedback/message-delete": {
        deleteSchema.parse(event.data);
        if (event.data.sessionId === sessionId) items.delete(event.data.messageId);
        break;
      }
      default:
        // Event của plugin khác không đổi phản hồi trên thông điệp.
        break;
    }
  }
  return [...items.values()];
}
