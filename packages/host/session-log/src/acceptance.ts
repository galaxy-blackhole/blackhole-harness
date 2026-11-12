/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Gộp các mốc "đã nhận" trong log canonical để biết hậu tố nào còn phải tải lên — bản viết lại
 *      1:1 `acceptedThrough` của `@deepseek-ai/dsh-session-log-deepseek`, gồm cả bộ nhớ đệm quét
 *      TĂNG DẦN theo phiên (mỗi phiên quét mỗi sự kiện đúng MỘT lần trong đời module).
 */

import { SessionLogOffset, SessionSeq } from "@deepseek-ai/dsh-session";
import type { Session, SessionSeqCursor } from "@deepseek-ai/dsh-session";

import type { DeliveryAcceptedData } from "./types.ts";

/** Loại sự kiện ghi mốc đã-nhận; bản gốc khai nó trong `SessionEventMap` của chính gói. */
const LEGACY_ACCEPTED_EVENT_TYPE = "session-log-deepseek/delivery-accepted";
/** Loại sự kiện MỚI (từ 08/11/2026, sau khi đổi tên row/namespace) — mọi bản ghi mới dùng loại này. */
export const NEW_EVENT_TYPE = "session-log-gbh/delivery-accepted";
/** Hai loại sự kiện được ĐỌC khi tính mốc: loại cũ (log lịch sử) + loại mới. */
const ACCEPTED_EVENT_TYPES: readonly string[] = [LEGACY_ACCEPTED_EVENT_TYPE, NEW_EVENT_TYPE];

/** Bộ nhớ đệm quét TĂNG DẦN theo phiên: số sự kiện đã quét + mốc đã-nhận lớn nhất tới lúc đó. */
const acceptanceFolds = new WeakMap<Session, { scannedEvents: number; throughSeq: SessionSeqCursor }>();

/**
 * Số thứ tự cao nhất đã xác nhận cho ĐÚNG thế hệ định dạng của phiên này.
 * Nhận: phiên canonical mà các sự kiện `delivery-accepted` khớp định dạng sẽ được gộp.
 * Trả: số thứ tự đã nhận lớn nhất, hoặc `-1` trước lượt request nào được nhận.
 */
export function acceptedThrough(session: Session): SessionSeqCursor {
  const previous = acceptanceFolds.get(session);
  let throughSeq: SessionSeqCursor = previous?.throughSeq ?? -1;
  const length = session.seq;
  const start = previous?.scannedEvents ?? SessionLogOffset(0);
  for (let index = start; index < length; index++) {
    const event = session.eventAt(SessionSeq(index));
    if (event === undefined) {
      throw new Error(`session-log-deepseek: missing event ${String(index)} below captured length ${String(length)}`);
    }
    if (!ACCEPTED_EVENT_TYPES.includes(event.type as string)) continue;
    const data = event.data as unknown as DeliveryAcceptedData;
    const acceptedFormatVersion = data.sessionFormatVersion ?? 0;
    if (
      !Number.isSafeInteger(acceptedFormatVersion) ||
      acceptedFormatVersion < 0 ||
      Object.is(acceptedFormatVersion, -0)
    ) {
      throw new Error(`session-log-deepseek: malformed acceptance format version at seq ${event.seq}`);
    }
    if (acceptedFormatVersion !== session.header.version) continue;
    let acceptedSeq: SessionSeqCursor;
    try {
      acceptedSeq = SessionSeq(data.throughSeq);
    } catch {
      throw new Error(`session-log-deepseek: malformed acceptance watermark at seq ${event.seq}`);
    }
    if (typeof data.sessionId !== "string" || data.sessionId.length === 0 || acceptedSeq >= event.seq) {
      throw new Error(`session-log-deepseek: malformed acceptance watermark at seq ${event.seq}`);
    }
    if (data.sessionId !== session.id) continue;
    if (acceptedSeq > throughSeq) throughSeq = acceptedSeq;
  }
  acceptanceFolds.set(session, { scannedEvents: length, throughSeq });
  return throughSeq;
}
