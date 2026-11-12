/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Phép gộp BẤT BIẾN của tiêu đề: `foldSessionTitle` đọc log và trả ảnh chụp ĐÓNG BĂNG mới nhất
 *      mà KHÔNG tra metadata khả biến; cộng các helper đóng băng/lấy bản sao phòng vệ và lớp
 *      `SessionTitleInvalidError` — lỗi DUY NHẤT của `rename` quy cho ĐẦU VÀO. Bản viết lại của
 *      Galaxy Blackhole cho row session-title — nguồn đối chiếu: README.md (G4).
 */

import { assertNever } from "./never.ts";
import type {
  SessionEvent,
  SessionTitleEventData,
  SessionTitleModelIdentity,
  SessionTitleSnapshot,
  SessionTitleSource,
} from "./types.ts";
import type { SessionSeq } from "./brand.ts";

/**
 * Đóng băng SÂU một vật thể (nguyên thuật của `deepFreeze` ở @deepseek-ai/dsh-util-values).
 * Nhận: giá trị bất kỳ — đi vòng, giữ tập đã thăm, BỎ QUA `AbortSignal`.
 * Trả: CHÍNH giá trị đó, với mọi vật thể con đã `Object.freeze`.
 */
export function deepFreeze<T>(value: T): T {
  const seen = new WeakSet<object>();
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === null || typeof node !== "object") continue;
    if (node instanceof AbortSignal) continue;
    if (seen.has(node)) continue;
    seen.add(node);
    Object.freeze(node);
    for (const key of Object.keys(node)) pending.push((node as Record<string, unknown>)[key]);
  }
  return value;
}

/**
 * Bản sao PHÒNG VỆ của một nguồn tiêu đề đã ghi (ảnh chụp KHÔNG được tham chiếu vật thể của log).
 * Nhận: nguồn tiêu đề đã ghi.
 * Trả: nguồn tiêu đề MỚI — `messageSeqs`/`model` được sao, nên sửa log về sau không lan vào ảnh chụp.
 */
function copySessionTitleSource(source: SessionTitleSource): SessionTitleSource {
  switch (source.kind) {
    case "fallback":
      return { kind: "fallback" };
    case "provider":
      return {
        kind: "provider",
        provider: source.provider,
        ...(source.model === undefined ? {} : { model: { ...source.model } }),
      };
    case "user":
      return { kind: "user" };
    default:
      return assertNever(source, "SessionTitleSource");
  }
}

/**
 * Chuyển trạng thái phép gộp tiêu đề thành ảnh chụp BẤT BIẾN.
 * Nhận: trạng thái của hai đơn vị chiếu `title`/`titleInput` đã gộp tới mốc cần chụp.
 * Trả: ảnh chụp đã đóng băng sâu — mảng `messageSeqs` và nguồn đều là BẢN SAO.
 */
export function titleSnapshotFromState(state: SessionTitleEventData & {
  /** Seq của sự kiện tiêu đề. */
  readonly eventSeq: SessionSeq;
  /** Thời điểm của sự kiện tiêu đề. */
  readonly updatedAt: number;
}): SessionTitleSnapshot {
  return deepFreeze({
    title: state.title,
    messageSeqs: [...state.messageSeqs],
    source: copySessionTitleSource(state.source),
    eventSeq: state.eventSeq,
    updatedAt: state.updatedAt,
  });
}

/**
 * Gộp tiêu đề ĐÃ GHI mới nhất mà không tra metadata khả biến.
 * Nhận: log phiên đang sống hoặc đã nạp lại.
 * Trả: ảnh chụp tiêu đề bất biến mới nhất, hoặc `undefined` trước khi có sự kiện `session/title`.
 */
export function foldSessionTitle(events: readonly SessionEvent[]): SessionTitleSnapshot | undefined {
  const event = events.findLast((item) => item.type === "session/title");
  if (event === undefined) return undefined;
  const data = event.data as SessionTitleEventData;
  return titleSnapshotFromState({
    title: data.title,
    messageSeqs: data.messageSeqs,
    source: data.source,
    eventSeq: event.seq,
    updatedAt: event.time,
  });
}

/**
 * Từ chối MỘT tiêu đề người dùng tường minh có văn bản chuẩn hoá thành rỗng — lỗi DUY NHẤT của
 * `SessionTitleService.rename` quy cho ĐẦU VÀO. Caller dịch lỗi rename lên dây (`title-invalid`)
 * phân biệt bằng CHÍNH lớp này; lỗi sống-chết và lỗi gỡ nạp vẫn là `Error` trần.
 */
export class SessionTitleInvalidError extends Error {
  /** Tên lớp lỗi — nguyên văn của bản gốc (`override` vì `Error` đã khai `name`). */
  override readonly name = "SessionTitleInvalidError";
}

/**
 * Đóng dấu một tuyến mô hình đã ghi thành bản ghi bất biến.
 * Nhận: cấu hình lời gọi đã ghi trong log phiên.
 * Trả: bản ghi tuyến MỚI (không tham chiếu vật thể của log).
 */
export function modelIdentityOf(config: SessionTitleModelIdentity): SessionTitleModelIdentity {
  return { provider: config.provider, model: config.model };
}
