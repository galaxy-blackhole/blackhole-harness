/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Đọc nhanh header + toàn bộ event log của một Session thành viên đã lưu qua read-handle ngắn hạn: readPersistedSession — port 1:1 lib/types/persisted.js.
 */
import type { SessionEvent, SessionHeader, SessionId } from "@deepseek-ai/dsh-session";

/** Một handle đọc ngắn hạn của kho phiên bền. */
export interface PersistenceHandle {
  /** Header đã lưu của Session. */
  readonly header: SessionHeader;
  /** Số sự kiện kế thừa từ Session cha. */
  readonly inheritedEventCount: number;
  /** Đọc một khoảng sự kiện. */
  read(start: number, end?: number, options?: { readonly signal?: AbortSignal }): Promise<{ readonly events: readonly SessionEvent[] }>;
  /** Đóng handle. */
  close(): Promise<void>;
}

/** Kho phiên bền nhìn qua phần Team dùng. */
export interface TeamPersistence {
  /** Mở handle đọc cho một Session. */
  open(id: SessionId, mode: "read", options: { readonly signal?: AbortSignal }): Promise<PersistenceHandle>;
}

/**
 * Đọc header + toàn bộ event log của một Session đã lưu, đóng handle trước khi trả.
 * Nhận: persistence — kho phiên bền; id — Session cần đọc; signal — huỷ quan sát bởi open/read.
 * Trả: header, inheritedEventCount và mọi sự kiện đã commit.
 */
export async function readPersistedSession(
  persistence: TeamPersistence,
  id: SessionId,
  signal: AbortSignal,
): Promise<{ readonly header: SessionHeader; readonly inheritedEventCount: number; readonly events: readonly SessionEvent[] }> {
  const handle = await persistence.open(id, "read", { signal });
  try {
    const { events } = await handle.read(0, undefined, { signal });
    return { header: handle.header, inheritedEventCount: handle.inheritedEventCount, events };
  } finally {
    await handle.close();
  }
}