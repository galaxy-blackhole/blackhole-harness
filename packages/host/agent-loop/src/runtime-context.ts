/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Trạng thái chiếu bền cho HAI tin nhắn bề mặt do vòng lặp sở hữu mà plugin system-prompt dựng:
 *      lời nhắc hệ thống (nút bề mặt 0 và mọi bản thay thế trong lịch sử) và ảnh chụp runtime-context
 *      động. Port 1:1 vùng `lib/types/runtime-context.js` dòng 211–351 của `@deepseek-ai/dsh-agent-loop`.
 */

/**
 * Trạng thái chiếu bền cho hai tin nhắn bề mặt do vòng lặp sở hữu mà plugin system-prompt dựng:
 * lời nhắc hệ thống (nút bề mặt 0 và mọi bản thay thế trong lịch sử) và ảnh chụp runtime-context động.
 * @module @galaxy-blackhole/gbh-host-agent-loop/runtime-context
 */

import type { Context } from "@deepseek-ai/cordis";
import { createSystemMessage, createUserMessage } from "@deepseek-ai/dsh-llm";
import type { ContentBlock, ContextFormed, ContextSnapshotSection } from "@deepseek-ai/dsh-llm";
import { isReplacementSurfaceEvent } from "@deepseek-ai/dsh-session";
import type {
  Session,
  SessionEvent,
  SessionSeq,
  SurfaceIntent,
  SystemMessage,
  UserMessage,
} from "@deepseek-ai/dsh-session";

/**
 * Khoá nguồn của mọi tin nhắn runtime-context do vòng lặp sở hữu.
 * Trả: nguyên văn chuỗi `"runtime-context"` của bản gốc.
 */
export const SOURCE = "runtime-context";

/**
 * Câu thay thế khi ngữ cảnh động rỗng: mọi ảnh chụp runtime-context trước đó không còn hiệu lực.
 * Trả: nguyên văn câu tiếng Anh của bản gốc.
 */
export const CLEARED = "Current runtime context: none. Earlier runtime-context snapshots no longer apply.";

/**
 * Hình dạng TỐI THIỂU của một tin nhắn mà tầng này đọc: chỉ `source.kind` và `content`.
 * Khai theo CẤU TRÚC để `UserMessage`/`SystemMessage` của kernel dùng lại được mà không cần
 * phép ép kiểu ở mỗi lời gọi.
 */
interface RuntimeContextMessage {
  /** Nguồn của tin nhắn; tầng này chỉ phân biệt `kind`. */
  readonly source: { readonly kind: string };
  /** Các khối nội dung model nhìn thấy, nguyên văn. */
  readonly content: readonly ContentBlock[];
}

/**
 * Nguồn của MỘT tin nhắn runtime-context, khai theo CẤU TRÚC.
 *
 * Bản gốc mở rộng `MessageSourceMap` của kernel với đúng hình dạng này (augment module); bản viết lại
 * KHÔNG augment module (ADR 000d) nên khai thành bí danh kiểu dùng được ở chỗ cần nguồn tin nhắn.
 * `form` thiếu nghĩa là ngữ cảnh không khai báo hình thức — đúng mặc định của kernel.
 */
export type RuntimeContextSource = { readonly kind: typeof SOURCE } & ContextFormed;

/**
 * Tin nhắn này có do runtime-context sở hữu không.
 * Nhận: một tin nhắn có `source` (thường là `UserMessage`).
 * Trả: `true` khi `source.kind` đúng bằng `SOURCE`.
 */
export function isOwned(message: RuntimeContextMessage): boolean {
  return message.source.kind === SOURCE;
}

/**
 * Văn bản của tin nhắn khi nó chỉ có ĐÚNG MỘT khối văn bản.
 * Nhận: một tin nhắn có `content`.
 * Trả: văn bản của khối duy nhất, hoặc `undefined` khi số khối khác 1 hay khối không phải văn bản.
 */
export function textOf(message: RuntimeContextMessage): string | undefined {
  const [block] = message.content;
  return message.content.length === 1 && block?.type === "text" ? block.text : undefined;
}

/**
 * Sự kiện đã commit, xét từ MỚI nhất lùi về trước; các phép quét khôi phục dừng ở kết quả khớp đầu tiên.
 * Nhận: phiên có log bền (`session.snapshotEvents()`).
 * Trả: bản sao ĐẢO NGƯỢC của ảnh chụp sự kiện hiện tại (mảng mới, sự kiện vẫn bất biến).
 */
export function eventsNewestFirst(session: Session): readonly SessionEvent[] {
  return session.snapshotEvents().toReversed();
}

/** Một nút `system/message` còn sống trên bề mặt: số thứ tự sự kiện + văn bản hiệu lực của nó. */
interface SystemPromptNode {
  /** Số thứ tự sự kiện của nút trên log bền. */
  readonly seq: SessionSeq;
  /** Văn bản của nút; `undefined` khi nội dung không phải đúng một khối văn bản. */
  readonly text: string | undefined;
}

/** Một phép toán bề mặt system-prompt CHƯA commit, dùng cho việc nhận yêu cầu hoặc hoà giải. */
export interface SystemPromptCommit {
  /** Lời nhắc đã render, hoặc nội dung rỗng: đầu rỗng nghĩa là không ghi lời nhắc; đuôi rỗng là nút ngủ. */
  message: SystemMessage;
  /** `append` cho nút hệ thống mới, ngược lại là thay thế đúng một nút hệ thống còn sống. */
  intent: SurfaceIntent<"system/message">;
}

/** Các dữ kiện chuỗi yêu cầu mà một quyết định về lời nhắc được đưa ra trong đó. */
export interface SystemPromptDecisionInput {
  /** Tuyến đã chuẩn bị cho lần thử này có đọc một `system` message MUỘN HƠN như lời nhắc hiệu lực không. */
  inHistory: boolean;
  /**
   * Việc nhận lời nhắc có phải hợp nhất không: một listener trước bước đã khai chuỗi mới, bề mặt đã đổi
   * kể từ yêu cầu trước, hoặc bộ tool đã lắp đổi trên tuyến không hỗ trợ cập nhật tool.
   */
  startsSeries: boolean;
}

/**
 * Quyết định cách một lời nhắc hệ thống đã render chạm bề mặt mà KHÔNG sở hữu việc commit.
 * Lời nhắc đầu tiên, kể cả rỗng, giữ chỗ nút bề mặt 0.
 * Một chuỗi tiếp diễn đủ năng lực thì NỐI văn bản khác rỗng đã đổi vào sau lịch sử đã cache.
 * Tuyến không đủ năng lực, chuỗi bị gãy, hoặc lời nhắc bị xoá thì thay vào đó chuẩn hoá nút hệ thống
 * đầu tiên và làm RỖNG các nút đang hoạt động phía sau. Các đuôi rỗng ngủ đông không cấp văn bản hiệu
 * lực và không đòi hỏi thay thế lặp lại.
 */
export class SystemPromptProjection {
  /** Phiên nhận các tin nhắn được chiếu. */
  private readonly session: Session;

  /**
   * Giữ phiên để đọc bề mặt và log của nó.
   * Nhận: `session` — phiên mà lời nhắc hệ thống được chiếu vào.
   * Trả: không (đây là constructor).
   */
  constructor(session: Session) {
    this.session = session;
  }

  /**
   * Các nút `system/message` còn sống, theo thứ tự bề mặt.
   * Nhận: không (đọc `session.surface.nodes` và `session.eventAt`).
   * Trả: danh sách nút kèm văn bản hiệu lực của từng nút.
   */
  private systemNodes(): SystemPromptNode[] {
    const nodes: SystemPromptNode[] = [];
    for (const seq of this.session.surface.nodes) {
      const event = this.session.eventAt(seq);
      if (event?.type !== "system/message") continue;
      // Nút rỗng không cấp văn bản hiệu lực; nút có nội dung thì đọc đúng khối văn bản duy nhất.
      const text = event.data.message.content.length === 0 ? "" : textOf(event.data.message);
      nodes.push({ seq, text });
    }
    return nodes;
  }

  /**
   * Hoà giải văn bản hiệu lực và các nút còn giữ với tuyến đã chuẩn bị và chuỗi yêu cầu.
   * Nhận: `rendered` — lời nhắc hệ thống đã render đầy đủ (`''` khi không có lời nhắc nào đang bật);
   * `input` — năng lực tuyến và dữ kiện chuỗi của bước này.
   * Trả: các cập nhật theo từng nút, đã xếp thứ tự; danh sách rỗng nghĩa là không cần cập nhật.
   */
  project(rendered: string, input: SystemPromptDecisionInput): SystemPromptCommit[] {
    const nodes = this.systemNodes();
    const head = nodes[0];
    if (head === undefined) {
      return [{ message: createSystemMessage(rendered), intent: { surfaceOp: "append" } }];
    }
    // Nút CUỐI còn văn bản là văn bản hiệu lực; không có nút nào như vậy thì lấy chính nút đầu.
    const latest = nodes.findLast((node) => node.text !== "") ?? head;
    if (!input.inHistory || input.startsSeries || rendered.length === 0) {
      const updates = nodes
        .slice(1)
        .filter((node) => node.text !== "")
        .map((node) => this.replace(node.seq, ""));
      if (head.text !== rendered) updates.push(this.replace(head.seq, rendered));
      return updates;
    }
    if (latest.text === rendered) return [];
    return [{ message: createSystemMessage(rendered), intent: { surfaceOp: "append" } }];
  }

  /**
   * Dựng một phép THAY THẾ đúng một nút hệ thống.
   * Nhận: `seq` — số thứ tự sự kiện của nút bị thay; `text` — văn bản mới của nút.
   * Trả: một cập nhật chưa commit, khai cả sự kiện nguồn bị thay.
   */
  private replace(seq: SessionSeq, text: string): SystemPromptCommit {
    return {
      message: createSystemMessage(text),
      intent: {
        surfaceOp: {
          op: "replace",
          startSeq: seq,
          endSeq: seq,
        },
        sourceEventSeqs: [seq],
      },
    };
  }
}

/** Theo dõi ảnh chụp runtime-context còn giữ gần nhất mà không sở hữu việc commit. */
export class RuntimeContextProjection {
  /** `undefined` nghĩa là chưa từng có ảnh chụp nào; `null` nghĩa là không giữ ảnh chụp nào. */
  private retained: { seq: SessionSeq; text: string | undefined } | null | undefined;

  /**
   * Khôi phục trạng thái chiếu MỘT lần, rồi theo các sự kiện phiên có thẩm quyền.
   * Nhận: `ctx` — context sự kiện phạm vi agent; `session` — phiên nhận các tin nhắn được chiếu.
   * Trả: không (đây là constructor).
   */
  constructor(ctx: Context, session: Session) {
    const surface = new Set(session.surface.nodes);
    for (const event of eventsNewestFirst(session)) {
      if (event.type !== "user/message" || !isOwned(event.data)) continue;
      // Có ít nhất một tin nhắn runtime-context đã commit ⇒ từ đây trạng thái không còn "chưa từng có".
      this.retained ??= null;
      if (surface.has(event.seq)) {
        this.retained = {
          seq: event.seq,
          text: textOf(event.data),
        };
        break;
      }
    }
    ctx.on("session/event", (subject: Session, event: SessionEvent) => {
      if (subject !== session) return;
      if (event.type === "user/message" && isOwned(event.data)) {
        this.retained = {
          seq: event.seq,
          text: textOf(event.data),
        };
      } else if (
        this.retained
        && isReplacementSurfaceEvent(event)
        && event.sourceEventSeqs?.includes(this.retained.seq) === true
      ) {
        this.retained = null;
      }
    });
  }

  /**
   * Chỉ dựng ảnh chụp CHƯA commit khi giá trị còn giữ khác với ảnh chụp mới.
   * Nhận: `current` — ngữ cảnh động đã render đầy đủ; `sections` — các đóng góp có tên đã tạo nên ảnh chụp hiện tại.
   * Trả: một tin nhắn user ứng viên, hoặc `undefined` khi không cần cập nhật.
   */
  project(current: string, sections: readonly ContextSnapshotSection[]): UserMessage | undefined {
    if (this.retained === undefined && current.length === 0) return;
    const snapshot = current.length === 0 ? CLEARED : current;
    if (this.retained?.text === snapshot) return;
    const source: RuntimeContextSource = sections.length === 0
      ? { kind: SOURCE }
      : { kind: SOURCE, form: "snapshot", sections };
    const content: readonly ContentBlock[] = [{ type: "text", text: snapshot }];
    // `MessageSourceMap` của dsh-llm đã cài KHÔNG khai khoá `runtime-context` (bản gốc augment module;
    // bản viết lại không augment — ADR 000d), nên giữ NGUYÊN hành vi bằng MỘT phép ép kiểu tại đúng
    // trường nguồn, để phần `content` vẫn được kiểm kiểu đầy đủ.
    return createUserMessage({
      content,
      source: source as unknown as UserMessage["source"],
    });
  }
}
