/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Kiểm nhận tin nhắn bền trong hộp thư Session của thành viên: messageAccepted (gộp inbox sau khi splice) — port 1:1 lib/types/session-message.js.
 */
import type { SessionEvent } from "@deepseek-ai/dsh-session";
import type { UserMessage } from "@deepseek-ai/dsh-llm";

/** Một sự kiện Session nhìn theo cấu trúc. */
interface SessionEventLike {
  /** Loại sự kiện. */
  readonly type: string;
  /** Payload tương ứng. */
  readonly data: unknown;
}

/** Một tin nhắn model thấy được hoặc đang chờ nhận. */

/** Một tin nhắn model thấy được hoặc đang chờ nhận. */
export type MessagePredicate = (message: UserMessage) => boolean;

/**
 * Gộp phần đuôi hộp thư bền thành các tin nhắn còn chờ nhận.
 * Nhận: events — đuôi sự kiện KHÔNG kế thừa của một Session. Trả: tin nhắn còn chờ.
 */
function pendingInboxMessages(events: readonly SessionEvent[]): readonly unknown[] {
  const inbox: Record<string, unknown[]> = { "next-turn": [], "next-step": [] };
  for (const raw of events) {
    const event = raw as SessionEventLike;
    if (event.type !== "agent/inbox/spliced") continue;
    const data = event.data as { readonly target: string; readonly start: number; readonly removedCount?: number; readonly inserted: readonly unknown[] };
    const pending = inbox[data.target] ?? [];
    pending.splice(data.start, data.removedCount ?? 0, ...data.inserted);
    inbox[data.target] = pending;
  }
  return [...(inbox["next-turn"] ?? []), ...(inbox["next-step"] ?? [])];
}

/**
 * Kiểm một tin nhắn đã model thấy hoặc còn chờ nhận bền.
 * Nhận: events — đuôi sự kiện KHÔNG kế thừa; predicate — kiểm danh tính tin nhắn đã nhận.
 * Trả: lịch sử hoặc hộp thư hiện tại có khớp.
 */
export function messageAccepted(events: readonly SessionEvent[], predicate: MessagePredicate): boolean {
  const accepted = events.some((raw) => {
    const event = raw as SessionEventLike;
    return event.type === "user/message" && predicate(event.data as UserMessage);
  });
  return accepted || pendingInboxMessages(events).some((message) => predicate(message as UserMessage));
}
