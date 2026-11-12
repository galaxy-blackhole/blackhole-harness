/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Trích "tin người dùng HỢP LỆ" từ log phiên — định nghĩa DUY NHẤT mà cả ba nơi dùng: đơn vị
 *      chiếu `titleInput` khi gộp, dịch vụ khi lên lịch, và provider khi nhận ảnh chụp tin nhắn.
 *      Bản viết lại của Galaxy Blackhole cho row session-title — nguồn đối chiếu: README.md (G4).
 */

import { normalizeSessionTitle } from "./normalize.ts";
import type { SessionEvent, SessionTitleUserMessage, UserMessageData } from "./types.ts";
import type { SessionSeq } from "./brand.ts";

/**
 * Trích MỘT tin người dùng hợp lệ từ một sự kiện phiên.
 * Nhận: một sự kiện đã cam kết.
 * Trả: tin hợp lệ (seq + văn bản đã nối bằng xuống dòng) hoặc `undefined` khi sự kiện không phải
 * `user/message` từ nguồn `user`, hoặc khi văn bản RỖNG sau khi chuẩn hoá không biên.
 */
export function sessionTitleUserMessageOf(event: SessionEvent): SessionTitleUserMessage | undefined {
  if (event.type !== "user/message") return undefined;
  const data = event.data as UserMessageData;
  if (data.source.kind !== "user") return undefined;
  const text = data.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
  // Ngân sách KHÔNG BIÊN ở đây là CÓ Ý: phép kiểm chỉ hỏi "có ký tự nhìn thấy được không", còn
  // trần thật do `fallbackMaxBytes`/`maxTitleBytes` áp SAU (nguyên văn bản gốc).
  if (normalizeSessionTitle(text, Number.MAX_SAFE_INTEGER).length === 0) return undefined;
  return { seq: event.seq, text };
}

/**
 * Gom MỌI tin người dùng hợp lệ của một log, theo thứ tự seq.
 * Toàn bộ tiền tố hợp lệ chỉ được vật chất hoá cho MỘT lần sinh của provider, nên nó được QUÉT TỪ LOG
 * lúc thi hành thay vì giữ lại trong đơn vị chiếu O(1) `titleInput`.
 * Nhận: log sự kiện của phiên và trần seq bao gồm (tuỳ chọn).
 * Trả: các tin hợp lệ kèm seq nguồn chính xác.
 */
export function collectSessionTitleMessages(
  events: readonly SessionEvent[],
  throughSeq?: SessionSeq,
): SessionTitleUserMessage[] {
  const messages: SessionTitleUserMessage[] = [];
  for (const event of events) {
    if (throughSeq !== undefined && event.seq > throughSeq) break;
    const message = sessionTitleUserMessageOf(event);
    if (message !== undefined) messages.push(message);
  }
  return messages;
}
