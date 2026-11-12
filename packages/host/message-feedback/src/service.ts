/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Feedback: service Remote `messageFeedback`
 *      ghi/đọc phản hồi canonical trên LOG PHIÊN cho tin nhắn assistant đã chốt — ba thao tác
 *      list · put · delete với so-sánh-và-đặt theo phiên bản, trần byte cho ghi chú, hàng đợi tuần tự
 *      theo phiên, và event `feedback/committed` cho lượt ghi LẠNH. Thao tác lạnh KHÔNG dựng Session/Agent.
 */

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";

import type { Context } from "@deepseek-ai/cordis";
import { Service } from "@deepseek-ai/cordis";
import s from "@deepseek-ai/schemastery";
import { SessionSeq } from "@deepseek-ai/dsh-session/types";
import { deriveEventMessage, isAppendSurfaceEvent } from "@deepseek-ai/dsh-session/surface";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

import { currentItems, rejected, snapshotItem, success } from "./schema.ts";
import type {
  MessageFeedbackDeleteRequest,
  MessageFeedbackDeleteResult,
  MessageFeedbackEvent,
  MessageFeedbackItem,
  MessageFeedbackListRequest,
  MessageFeedbackListResult,
  MessageFeedbackLogEvent,
  MessageFeedbackNoteBlank,
  MessageFeedbackNoteTooLarge,
  MessageFeedbackPutRequest,
  MessageFeedbackPutResult,
  MessageFeedbackRejected,
  MessageFeedbackSessionNotFound,
  MessageFeedbackSuccess,
  MessageFeedbackVersionConflict,
  SessionHeaderView,
  SessionId,
  SessionInspection,
} from "./types.ts";

/** Cấu hình bắt buộc của triển khai: chính sách kích thước ghi chú. */
export interface Config {
  /** Độ dài byte UTF-8 tối đa nhận cho MỘT ghi chú. */
  readonly maxNoteBytes: number;
}

/**
 * Hàm ghi MỘT event phản hồi qua đường đang giữ quyền ghi.
 * Gọi KHÔNG tham số là "không ghi gì" nhưng vẫn chạm hàng rào bền vững (dùng cho lượt không-đổi).
 */
type AppendFeedback = (event?: MessageFeedbackEvent) => Promise<void>;

/** Hình dạng tối thiểu của một handle lưu trữ mà row này chạm tới. */
interface SessionHandleLike {
  /** Header của phiên đã mở. */
  readonly header: SessionHeaderView;
  /** Số event thừa kế từ phiên cha của fork. */
  readonly inheritedEventCount: number;
  /** Đọc một lát event: `offset` là seq bắt đầu, `length` là số event (bỏ trống = đọc cả log). */
  read(offset?: number, length?: number): Promise<{ readonly events: readonly MessageFeedbackLogEvent[] }>;
  /** Ghi thêm các event vào log của handle. */
  append(events: readonly MessageFeedbackLogEvent[]): Promise<void>;
  /** Chạm hàng rào bền vững của handle. */
  flush(): Promise<void>;
  /** Nhả quyền sở hữu handle. */
  close(): Promise<void>;
}

/** Hình dạng tối thiểu của seam lưu trữ phiên (`ctx.sessionPersistence`). */
interface SessionPersistenceLike {
  /** Cho biết phiên có tồn tại; chỉ dùng phép so với `undefined`. */
  stat(id: SessionId): Promise<unknown>;
  /** Mở handle đọc/ghi của một phiên đã tồn tại. */
  open(id: SessionId, access: "read" | "write"): Promise<SessionHandleLike>;
}

/** Hình dạng tối thiểu của một phiên ĐANG SỐNG (`ctx.sessions.get(id)`). */
interface LiveSessionLike {
  /** Header của phiên sống. */
  readonly header: SessionHeaderView;
  /** Ảnh chụp tiền tố event hiện tại của phiên sống. */
  snapshotEvents(): readonly MessageFeedbackLogEvent[];
  /** Ghi thêm một event vào phiên sống. */
  append(type: string, data: unknown): void;
}

/** Hình dạng tối thiểu của sổ phiên (`ctx.sessions`). */
interface SessionsLike {
  /** Tra phiên đang sống theo id. */
  get(id: SessionId): LiveSessionLike | undefined;
  /** Ép một hàng rào bền vững cho phiên sống; `true` khi có listener bền vững tham gia. */
  flush(session: LiveSessionLike): Promise<boolean>;
}

/**
 * Context của Host đã hẹp hoá kiểu: cordis cấp event/effect/logger, hai seam kia do row khác cấp.
 *
 * Vì sao khai theo CẤU TRÚC thay vì mượn khai báo của `dsh-session`/`dsh-session-persistence`: row này
 * chỉ chạm đúng những thành viên dưới đây; khai hẹp bằng hoặc hẹp hơn module thật nên một Context giả
 * trong test vẫn đúng hình dạng, còn bản thật thì luôn thoả (kiểu rộng gán được cho kiểu hẹp).
 */
type HostContext = Omit<Context, "parallel"> & {
  /** Sổ phiên đang sống. */
  readonly sessions: SessionsLike;
  /** Kho lưu phiên canonical. */
  readonly sessionPersistence: SessionPersistenceLike;
  /**
   * Phát `feedback/committed` tới người quan sát (chế độ `parallel` của cordis).
   *
   * Vì sao khai HẸP ngay tại đây thay vì mở rộng `Events` toàn cục: gói gốc vẫn nằm trong chương
   * trình `tsc` (qua `import type {}` của `host/session-telemetry-otel`) và khai cùng tên event;
   * hai khai khác nhau làm `inspection.meta.id` của HỌ thành `string | SessionId` ⇒ đỏ typecheck ở
   * file không phải của ta. Khai tại chỗ giữ nguyên không gian kiểu dùng chung.
   */
  parallel(name: "feedback/committed", inspection: SessionInspection): Promise<void>;
};

/** Service ghi log phản hồi; thao tác LẠNH không bao giờ dựng một Session hay Agent. */
export class MessageFeedbackService extends TypertRemoteService {
  /** Seam bắt buộc: kho lưu phiên canonical và các chủ sở hữu phiên đang sống. */
  static inject = ["sessionPersistence", "sessions"];

  /** Kiểm cấu hình của loader cho chính sách kích thước ghi chú bắt buộc. */
  static Config = s.object({ maxNoteBytes: s.number().step(1).min(1).required() });

  /** Trần byte UTF-8 nhận cho một ghi chú. */
  private readonly maxNoteBytes: number;

  /** Đuôi hàng đợi theo phiên: mọi thao tác của MỘT phiên chạy tuần tự. */
  private readonly operationTails = new Map<SessionId, Promise<void>>();

  /** Cổng nhận đột biến; đóng khi service bắt đầu dọn để không nhận thao tác mới. */
  private mutationAdmissionOpen = true;

  /**
   * @param ctx - Context của Host, mang kho lưu phiên và các chủ sở hữu phiên sống.
   * @param config - Chính sách kích thước ghi chú bắt buộc.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, "messageFeedback");
    if (!Number.isSafeInteger(config.maxNoteBytes) || config.maxNoteBytes < 1) {
      throw new TypeError("message-feedback: maxNoteBytes must be a positive safe integer");
    }
    this.maxNoteBytes = config.maxNoteBytes;
  }

  /** Đăng ký hiệu ứng dọn: đóng cổng nhận đột biến rồi chờ mọi đuôi hàng đợi còn sống. */
  protected [Service.init](): void {
    this.ctx.effect(
      () => async () => {
        this.mutationAdmissionOpen = false;
        await Promise.all(this.operationTails.values());
      },
      "message-feedback.drain",
    );
  }

  /**
   * Đọc phản hồi hiện tại từ log canonical.
   * Nhận: yêu cầu mang id phiên cần soi.
   * Trả: các mục bất biến, hoặc lỗi `session-not-found` khi phiên không tồn tại.
   */
  @Remote("list")
  list(request: MessageFeedbackListRequest): Promise<MessageFeedbackListResult> {
    return this.enqueue(request.sessionId, () =>
      this.withSession(request.sessionId, false, (events) =>
        success(
          Object.freeze({
            items: Object.freeze(currentItems(request.sessionId, events).map(snapshotItem)),
          }),
        ),
      ),
    );
  }

  /**
   * Tạo hoặc thay phản hồi sau khi kiểm phiên bản hiện tại của mục.
   * Lượt không-đổi giữ nguyên phiên bản và KHÔNG ghi event nào.
   * Nhận: đích, giá trị mong muốn và phiên bản mục đã quan sát.
   * Trả: mục đã bền vững, hoặc một lỗi nghiệp vụ tường minh.
   */
  @Remote("put")
  put(request: MessageFeedbackPutRequest): Promise<MessageFeedbackPutResult> {
    const note = this.resolveNote(request.note);
    if (!note.ok) return Promise.resolve(note);
    return this.enqueue(request.sessionId, () =>
      this.withSession(request.sessionId, true, async (events, append) => {
        const items = currentItems(request.sessionId, events);
        if (
          !events.some(
            (event) =>
              event.type === "assistant/message" &&
              isAppendSurfaceEvent(event) &&
              deriveEventMessage(event)?.id === request.messageId,
          )
        ) {
          return rejected({
            code: "target-not-found",
            sessionId: request.sessionId,
            messageId: request.messageId,
          });
        }
        const existing = items.find((item) => item.messageId === request.messageId);
        if (request.ifVersion !== (existing?.version ?? null)) {
          return rejected(this.versionConflict(existing ?? null));
        }
        if (
          existing !== undefined &&
          existing.rating === request.rating &&
          existing.note === note.value &&
          existing.category === request.category
        ) {
          await append();
          return success(snapshotItem(existing));
        }
        const now = Date.now();
        const item: MessageFeedbackItem = {
          messageId: request.messageId,
          rating: request.rating,
          ...(note.value === undefined ? {} : { note: note.value }),
          ...(request.category === undefined ? {} : { category: request.category }),
          version: randomUUID(),
          createdAt: existing?.createdAt ?? now,
          updatedAt: existing === undefined ? now : Math.max(now, existing.updatedAt),
        };
        await append({
          type: "feedback/message-put",
          data: { sessionId: request.sessionId, item },
        });
        return success(snapshotItem(item));
      }),
    );
  }

  /**
   * Xoá một mục sau khi kiểm phiên bản; mục vắng sẵn thì THÀNH CÔNG mà không ghi event.
   * Nhận: phiên, tin nhắn và phiên bản mục đã quan sát.
   * Trả: hậu điều kiện "vắng mặt" ổn định, hoặc một lỗi nghiệp vụ tường minh.
   */
  @Remote("delete")
  delete(request: MessageFeedbackDeleteRequest): Promise<MessageFeedbackDeleteResult> {
    return this.enqueue(request.sessionId, () =>
      this.withSession(request.sessionId, true, async (events, append) => {
        const existing = currentItems(request.sessionId, events).find(
          (item) => item.messageId === request.messageId,
        );
        if (existing !== undefined) {
          if (request.ifVersion !== existing.version) return rejected(this.versionConflict(existing));
          await append({
            type: "feedback/message-delete",
            data: { sessionId: request.sessionId, messageId: request.messageId },
          });
        } else {
          await append();
        }
        return success(Object.freeze({ absent: true as const }));
      }),
    );
  }

  /**
   * Giữ quyền ghi LẠNH suốt lượt đọc–so–ghi; phiên đang sống thì đi thẳng qua chủ sở hữu sống.
   * Nhận: id phiên, cờ cần quyền ghi, và phép toán nhận (event của tiền tố, hàm ghi).
   * Trả: kết quả của phép toán, hoặc lỗi `session-not-found` khi phiên không tồn tại.
   */
  private async withSession<T>(
    sessionId: SessionId,
    write: boolean,
    operation: (events: readonly MessageFeedbackLogEvent[], append: AppendFeedback) => T | Promise<T>,
  ): Promise<T | MessageFeedbackRejected<MessageFeedbackSessionNotFound>> {
    const host = this.host();
    // Hai lượt tra sống bao quanh phép tra lưu trữ: giữa hai lượt, phiên có thể vừa được công bố.
    if (
      host.sessions.get(sessionId) === undefined &&
      (await host.sessionPersistence.stat(sessionId)) === undefined &&
      host.sessions.get(sessionId) === undefined
    ) {
      return rejected({ code: "session-not-found", sessionId });
    }
    const live = host.sessions.get(sessionId);
    if (live !== undefined) {
      return operation(live.snapshotEvents(), async (event) => {
        if (event !== undefined) live.append(event.type, event.data);
        const last = live.snapshotEvents().at(-1);
        if (!(await host.sessions.flush(live))) {
          throw new Error(`message-feedback: no durability listener participated for live session '${sessionId}'`);
        }
        // Việc tham gia của listener KHÔNG tự chứng minh phiên này có người ghi lưu trữ.
        const handle = await host.sessionPersistence.open(sessionId, "read");
        try {
          const { events: stored } = await handle.read(last?.seq ?? 0, 1);
          if (
            !isDeepStrictEqual(
              [handle.header.id, handle.header.createdAt, handle.header.cwd],
              [live.header.id, live.header.createdAt, live.header.cwd],
            ) ||
            (last !== undefined && !isDeepStrictEqual(stored[0], last))
          ) {
            throw new Error(`message-feedback: feedback prefix is not durable for live session '${sessionId}'`);
          }
        } finally {
          await handle.close();
        }
      });
    }
    const handle = await host.sessionPersistence.open(sessionId, write ? "write" : "read");
    try {
      const { events } = await handle.read();
      return await operation(events, async (event) => {
        const entry: MessageFeedbackLogEvent | undefined =
          event === undefined ? undefined : { ...event, seq: SessionSeq(events.length), time: Date.now() };
        if (entry !== undefined) await handle.append([entry]);
        await handle.flush();
        if (entry !== undefined) {
          try {
            await host.parallel("feedback/committed", {
              meta: handle.header,
              inheritedEventCount: handle.inheritedEventCount,
              events: [...events, entry],
            });
          } catch (error) {
            host.logger.warn("message-feedback: committed feedback observer failed", error);
          }
        }
      });
    } finally {
      await handle.close();
    }
  }

  /**
   * Kiểm một ghi chú trước khi vào hàng đợi: rỗng-sau-cắt và trần byte UTF-8.
   * Nhận: ghi chú tuỳ chọn từ yêu cầu.
   * Trả: ghi chú đã chấp nhận (hoặc `undefined`), hay lỗi `note-blank`/`note-too-large`.
   */
  private resolveNote(
    note: string | undefined,
  ): MessageFeedbackSuccess<string | undefined> | MessageFeedbackRejected<MessageFeedbackNoteBlank | MessageFeedbackNoteTooLarge> {
    if (note === undefined) return success(undefined);
    if (note.trim().length === 0) return rejected({ code: "note-blank" });
    const actualBytes = Buffer.byteLength(note, "utf8");
    if (actualBytes > this.maxNoteBytes) {
      return rejected({ code: "note-too-large", maxBytes: this.maxNoteBytes, actualBytes });
    }
    return success(note);
  }

  /**
   * Dựng lỗi xung đột phiên bản kèm mục hiện tại.
   * Nhận: mục hiện tại, hoặc `null` khi nó không tồn tại.
   * Trả: lỗi `version-conflict` với ảnh chụp tách khỏi log.
   */
  private versionConflict(current: MessageFeedbackItem | null): MessageFeedbackVersionConflict {
    return { code: "version-conflict", current: current === null ? null : snapshotItem(current) };
  }

  /**
   * Xếp một phép toán vào đuôi hàng đợi của phiên và dọn đuôi khi xong.
   * Nhận: id phiên và phép toán cần chạy tuần tự.
   * Trả: promise của phép toán; từ chối ngay khi service đang dọn.
   */
  private enqueue<T>(sessionId: SessionId, operation: () => Promise<T>): Promise<T> {
    if (!this.mutationAdmissionOpen) return Promise.reject(new Error("message-feedback: service is disposing"));
    const previous = this.operationTails.get(sessionId) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.operationTails.set(sessionId, tail);
    return result.finally(() => {
      if (this.operationTails.get(sessionId) === tail) this.operationTails.delete(sessionId);
    });
  }

  /**
   * Context đã hẹp hoá kiểu cho hai seam mà cordis không khai sẵn.
   * Nhận: không.
   * Trả: Context dùng trong các phương thức ở trên.
   */
  private host(): HostContext {
    return this.ctx as unknown as HostContext;
  }
}

export default MessageFeedbackService;
