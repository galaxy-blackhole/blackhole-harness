/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Hộp thư bền của agent do driver sở hữu: phép chiếu `inbox` dựng lại hai danh sách thông điệp đang chờ từ các splice bền, và lớp ReactLoopInbox thao tác trên chúng. Viết lại 1:1 vùng lib/types/inbox.js của @deepseek-ai/dsh-agent-loop.
 */

/**
 * Giao diện lệnh và phép chiếu hộp thư bền của agent do driver sở hữu.
 *
 * @module @galaxy-blackhole/gbh-host-agent-loop/inbox
 */

import { z } from "zod";
import type { ZodType } from "zod";
import type { AgentEventDispatch, Inbox as InboxContract, InboxState, InboxTarget, InboxWireState } from "@deepseek-ai/dsh-agent";
import type { MessageId } from "@deepseek-ai/dsh-llm";
import type { Session, SessionEvent, UserMessage } from "@deepseek-ai/dsh-session";
import type SessionProjectionRegistry from "@deepseek-ai/dsh-session-projection";
import type { ProjectionDefinition } from "@deepseek-ai/dsh-session-projection";

/**
 * Kiểu schema mà SEAM yêu cầu, lấy NGUYÊN từ khai báo của seam thay vì tự viết.
 * Vì sao (01/11/2026): zod của ta (workspace) và zod trong d.ts của kernel là HAI bản cài khác thể hiện,
 * nên `ZodType` của ta KHÔNG gán được vào `ZodType` của seam dù hình dạng y hệt. Quy về đúng kiểu của
 * seam là cách duy nhất còn giữ được phép kiểm kiểu mà không sửa node_modules/package.json.
 */
type SeamStateSchema = ProjectionDefinition<"inbox", InboxState>["stateSchema"];
/** Kiểu schema KHUNG NHÌN DÂY mà seam yêu cầu (cùng lý do trên). */
type SeamViewSchema = NonNullable<ProjectionDefinition<"inbox", InboxState>["wire"]>["viewSchema"];

/**
 * Kiểm tra DÂY cho đầu vào agent đang chờ, dựng lại từ các splice bền.
 *
 * Bản gốc để `z.custom<UserMessage>()` vì thông điệp đã được tầng phiên kiểm khi ghi log; schema
 * này chỉ ràng buộc hình dạng hai MẢNG chờ, đúng chỗ ranh giới phép gộp chạm tới.
 * Nhận: không (là schema, không phải hàm).
 * Trả: schema zod đọc trạng thái chờ và khung nhìn dây của khoá `inbox`.
 * @throws khi `parse` gặp giá trị sai hình dạng (ném `ZodError` của zod).
 */
export const inboxProjectionSchema = z.object({
  "next-turn": z.array(z.custom<UserMessage>()).readonly(),
  "next-step": z.array(z.custom<UserMessage>()).readonly(),
}).readonly();

/**
 * Phép gộp chuẩn dựng lại đầu vào đang chờ và từ chối lịch sử splice bền không hợp lệ.
 *
 * Bốn bước giữ NGUYÊN thứ tự bản gốc: (1) bỏ qua sự kiện không thuộc hộp thư bằng CÙNG tham chiếu
 * trạng thái, (2) kiểm biên splice, (3) áp `toSpliced` để không sửa mảng đã đóng băng, (4) đòi
 * danh tính thông điệp duy nhất trên CẢ HAI danh sách. Mọi hỏng hóc bên trong được bọc lại kèm
 * seq của sự kiện để log phiên chỉ ra đúng bản ghi hỏng.
 * Nhận: không (đơn vị chiếu do sổ `sessionProjections` lái; `apply` nhận trạng thái và sự kiện).
 * Trả: đơn vị chiếu khoá `inbox`, `stateVersion` 1, có khung nhìn dây cho Client.
 * @throws khi `apply` gặp splice bền không hợp lệ — lỗi gốc được bọc với câu
 * `invalid persisted inbox splice at session seq <seq>`.
 */
export const inboxProjectionDefinition = {
  key: "inbox",
  stateSchema: inboxProjectionSchema as unknown as SeamStateSchema,
  init: (): InboxState => ({
    "next-turn": [],
    "next-step": [],
  }),
  apply(state: InboxState, event: SessionEvent): InboxState {
    if (event.type !== "agent/inbox/spliced") return state;
    const splice = event.data;
    try {
      const inbox = state[splice.target];
      const removedCount = splice.removedCount ?? 0;
      // Thứ tự kiểm là hợp đồng của bản gốc: biên dưới của start, biên trên của start, rồi mới tới
      // removedCount và tổng của chúng — đổi thứ tự sẽ đổi câu lỗi nào được ném trước.
      if (!Number.isSafeInteger(splice.start) || splice.start < 0 || splice.start > inbox.length || !Number.isSafeInteger(removedCount) || removedCount < 0 || splice.start + removedCount > inbox.length) throw new Error("invalid inbox splice");
      // `toSpliced` trả MẢNG MỚI nên trạng thái trước vẫn nguyên vẹn (điều kiện của phép gộp thuần).
      const next = inbox.toSpliced(splice.start, removedCount, ...splice.inserted);
      const ids = new Set<MessageId>();
      // Danh tính phải duy nhất trên cả hai danh sách: xét danh sách vừa đổi TRƯỚC, danh sách kia sau.
      for (const message of splice.target === "next-turn" ? [...next, ...state["next-step"]] : [...state["next-turn"], ...next]) {
        if (ids.has(message.id)) throw new Error(`message "${message.id}" is already pending`);
        ids.add(message.id);
      }
      return splice.target === "next-turn" ? {
        "next-turn": next,
        "next-step": state["next-step"],
      } : {
        "next-turn": state["next-turn"],
        "next-step": next,
      };
    } catch (error) {
      throw new Error(`invalid persisted inbox splice at session seq ${event.seq}`, { cause: error });
    }
  },
  wire: {
    // Trạng thái mang `UserMessage` đã đi qua log phiên nên JSON trọn vẹn, còn khung nhìn dây chỉ
    // khai phần JSON thuần (`InboxWireState`) cho ranh giới Remote — bản gốc ép kiểu đúng như vậy.
    viewSchema: inboxProjectionSchema as unknown as SeamViewSchema,
    view: (state: InboxState): InboxWireState => state as unknown as InboxWireState,
  },
  stateVersion: 1,
} satisfies ProjectionDefinition<"inbox", InboxState>;

/**
 * Cài đặt hộp thư bền do driver sở hữu, dùng bởi ReactLoopAgent và test provider tập trung.
 * Nhận: `projections` — sổ chiếu đã đăng ký đơn vị `inbox` (do AgentLoop đăng ký); `session` — phiên
 * có log bền lưu đầu vào đang chờ; `dispatch` — thông báo theo phạm vi agent cho vòng đời hộp thư.
 * Trả: thực thể hộp thư (lớp, không phải hàm).
 */
export class ReactLoopInbox implements InboxContract {
  private readonly projections: SessionProjectionRegistry;
  private readonly session: Session;
  private readonly dispatch: AgentEventDispatch;

  /**
   * Dựng facade trên sổ chiếu và phiên đã cho.
   * Nhận: `projections` — sổ chiếu phiên; `session` — phiên giữ log bền; `dispatch` — bộ phát sự kiện
   * theo phạm vi agent.
   * Trả: không (constructor).
   */
  constructor(projections: SessionProjectionRegistry, session: Session, dispatch: AgentEventDispatch) {
    this.projections = projections;
    this.session = session;
    this.dispatch = dispatch;
  }

  /**
   * Các prompt đang chờ từng lượt riêng.
   * Nhận: không.
   * Trả: mảng chỉ-đọc các thông điệp của danh sách `next-turn`.
   * @throws khi phiên chưa đăng ký phép chiếu `inbox`.
   */
  get nextTurn(): readonly UserMessage[] {
    return this.current()["next-turn"];
  }

  /**
   * Đầu vào đang chờ ranh giới bước kế tiếp.
   * Nhận: không.
   * Trả: mảng chỉ-đọc các thông điệp của danh sách `next-step`.
   * @throws khi phiên chưa đăng ký phép chiếu `inbox`.
   */
  get nextStep(): readonly UserMessage[] {
    return this.current()["next-step"];
  }

  /**
   * Cho biết một trong hai danh sách chờ còn việc hay không.
   * Nhận: không.
   * Trả: `true` khi `next-turn` hoặc `next-step` còn ít nhất một thông điệp.
   * @throws khi phiên chưa đăng ký phép chiếu `inbox`.
   */
  get hasPending(): boolean {
    const state = this.current();
    return state["next-turn"].length > 0 || state["next-step"].length > 0;
  }

  /**
   * Huỷ BỀN toàn bộ đầu vào đang chờ, xoá `next-step` trước rồi mới tới `next-turn`.
   * Nhận: không.
   * Trả: không.
   * @throws khi phiên chưa đăng ký phép chiếu `inbox`, hoặc khi `Session.append` từ chối bản ghi.
   */
  clear(): void {
    this.splice("next-step", 0, this.nextStep.length, []);
    this.splice("next-turn", 0, this.nextTurn.length, []);
  }

  /**
   * Rút ra và trả về trọn lô được đề xuất cho MỘT bước.
   * Nhận: `target` — ranh giới này có tiêu thụ thêm một lượt đang xếp hàng hay không; `turn` — lượt
   * sẽ sở hữu lô vừa rút.
   * Trả: đầu vào `next-step` trước, nối sau là lượt đang xếp hàng khi được yêu cầu.
   * @throws khi phiên chưa đăng ký phép chiếu `inbox`, hoặc khi `Session.append` từ chối bản ghi.
   */
  claim(target: InboxTarget, turn: number): UserMessage[] {
    const claimed = this.mutate("next-step", 0, this.nextStep.length, [], false);
    if (target === "next-turn") claimed.push(...this.mutate("next-turn", 0, 1, [], false));
    for (const message of claimed) this.dispatch.emit("agent/inbox/claimed", {
      message,
      turn,
    });
    return claimed;
  }

  /**
   * Nối MỘT thông điệp vào cuối một danh sách chờ.
   * Nhận: `target` — danh sách cần nối dài; `message` — thông điệp cần nối.
   * Trả: không.
   * @throws khi thông điệp trùng danh tính với thông điệp đang chờ (`message "<id>" is already pending`),
   * hoặc khi phiên chưa đăng ký phép chiếu `inbox`, hoặc khi `Session.append` từ chối bản ghi.
   */
  append(target: InboxTarget, message: UserMessage): void {
    this.splice(target, this.current()[target].length, 0, [message]);
  }

  /**
   * Chèn MỘT thông điệp vào ĐẦU một danh sách chờ.
   * Nhận: `target` — danh sách cần nối dài; `message` — thông điệp cần chèn trước.
   * Trả: không.
   * @throws khi thông điệp trùng danh tính với thông điệp đang chờ (`message "<id>" is already pending`),
   * hoặc khi phiên chưa đăng ký phép chiếu `inbox`, hoặc khi `Session.append` từ chối bản ghi.
   */
  prepend(target: InboxTarget, message: UserMessage): void {
    this.splice(target, 0, 0, [message]);
  }

  /**
   * Thay MỘT thông điệp đang chờ tại đúng vị trí của nó.
   * Nhận: `messageId` — danh tính thông điệp đang chờ cần thay; `newMessage` — thông điệp thay thế.
   * Trả: `true` khi thông điệp vẫn còn đang chờ và đã được thay, `false` khi không còn.
   * @throws khi thông điệp thay thế trùng danh tính với thông điệp đang chờ (`message "<id>" is already pending`),
   * hoặc khi phiên chưa đăng ký phép chiếu `inbox`, hoặc khi `Session.append` từ chối bản ghi.
   */
  replace(messageId: MessageId, newMessage: UserMessage): boolean {
    const location = this.locate(messageId);
    if (location === undefined) return false;
    this.splice(location.target, location.index, 1, [newMessage]);
    return true;
  }

  /**
   * Gỡ MỘT thông điệp đang chờ.
   * Nhận: `messageId` — danh tính thông điệp đang chờ cần gỡ.
   * Trả: `true` khi thông điệp vẫn còn đang chờ và đã bị gỡ, `false` khi không còn.
   * @throws khi phiên chưa đăng ký phép chiếu `inbox`, hoặc khi `Session.append` từ chối bản ghi.
   */
  remove(messageId: MessageId): boolean {
    const location = this.locate(messageId);
    if (location === undefined) return false;
    this.splice(location.target, location.index, 1, []);
    return true;
  }

  /**
   * Áp ngữ nghĩa splice chuẩn rồi ghi BỀN kết quả đã chuẩn hoá.
   * Nhận: `target` — danh sách cần thay đổi; `start` — vị trí splice; `deleteCount` — số thông điệp
   * tối đa cần gỡ; `inserted` — thông điệp chèn tại vị trí đã giải.
   * Trả: các thông điệp bị splice gỡ ra.
   * @throws khi thông điệp chèn trùng danh tính với thông điệp đang chờ (`message "<id>" is already pending`),
   * hoặc khi phiên chưa đăng ký phép chiếu `inbox`, hoặc khi `Session.append` từ chối bản ghi.
   */
  splice(target: InboxTarget, start: number, deleteCount: number, inserted: UserMessage[]): UserMessage[] {
    return this.mutate(target, start, deleteCount, inserted, true);
  }

  /**
   * Định vị MỘT danh tính đang chờ trên cả hai danh sách thuộc quyền.
   * Nhận: `messageId` — danh tính cần tìm.
   * Trả: cặp (danh sách, chỉ số) của lần gặp ĐẦU TIÊN theo thứ tự `next-turn` rồi `next-step`, hoặc
   * `undefined` khi không còn chờ.
   * @throws khi phiên chưa đăng ký phép chiếu `inbox`.
   */
  private locate(messageId: MessageId): { readonly target: InboxTarget; readonly index: number } | undefined {
    const state = this.current();
    for (const target of ["next-turn", "next-step"] as const) {
      const index = state[target].findIndex((message) => message.id === messageId);
      if (index >= 0) return {
        target,
        index,
      };
    }
    return undefined;
  }

  /**
   * Đọc trạng thái phép chiếu bền hiện tại.
   * Nhận: không.
   * Trả: trạng thái `inbox` của phiên.
   * @throws khi phiên chưa đăng ký phép chiếu `inbox` — `agent "<sessionId>" cannot read inbox state:
   * its projection registration is not active`.
   */
  private current(): InboxState {
    const state = this.projections.stateOf(this.session, "inbox");
    if (state === undefined) throw new Error(`agent "${this.session.id}" cannot read inbox state: its projection registration is not active`);
    return state;
  }

  /**
   * Cam kết MỘT thay đổi đã chuẩn hoá rồi phát các sự kiện sống của nó.
   *
   * Chuẩn hoá `start`/`deleteCount` sao chép đúng ngữ nghĩa `Array.prototype.splice`: cắt phần lẻ,
   * NaN thành 0, vị trí âm tính ngược từ cuối, rồi kẹp vào `[0, length]`. Khi không gỡ và không chèn
   * thì KHÔNG ghi sự kiện nào (trả mảng rỗng) — đây là đường no-op duy nhất của bản gốc.
   * Nhận: `target` — danh sách cần thay đổi; `start` — vị trí splice thô; `deleteCount` — số cần gỡ thô;
   * `inserted` — thông điệp chèn; `discardRemoved` — có phát `agent/inbox/discarded` cho phần bị gỡ
   * hay không (nhánh `claim` không phát vì thông điệp đã được `agent/inbox/claimed` nhận).
   * Trả: các thông điệp bị gỡ khỏi trạng thái trước.
   * @throws khi thông điệp chèn trùng danh tính với thông điệp đang chờ (`message "<id>" is already pending`),
   * hoặc khi phiên chưa đăng ký phép chiếu `inbox`, hoặc khi `Session.append` từ chối bản ghi.
   */
  private mutate(target: InboxTarget, start: number, deleteCount: number, inserted: UserMessage[], discardRemoved: boolean): UserMessage[] {
    const state = this.current();
    const inbox = state[target];
    const truncatedStart = Math.trunc(start);
    const offset = Number.isNaN(truncatedStart) ? 0 : truncatedStart;
    const actualStart = offset < 0 ? Math.max(inbox.length + offset, 0) : Math.min(offset, inbox.length);
    const truncatedDeleteCount = Math.trunc(deleteCount);
    const actualDeleteCount = Math.min(Math.max(Number.isNaN(truncatedDeleteCount) ? 0 : truncatedDeleteCount, 0), inbox.length - actualStart);
    if (actualDeleteCount === 0 && inserted.length === 0) return [];
    const candidate = inbox.toSpliced(actualStart, actualDeleteCount, ...inserted);
    const ids = new Set<MessageId>();
    for (const message of target === "next-turn" ? [...candidate, ...state["next-step"]] : [...state["next-turn"], ...candidate]) {
      if (ids.has(message.id)) throw new Error(`message "${message.id}" is already pending`);
      ids.add(message.id);
    }
    // `outcome` chỉ có mặt khi thật sự gỡ được gì đó — trường tuỳ chọn này đi vào payload sự kiện.
    const outcome: "canceled" | undefined = discardRemoved && actualDeleteCount > 0 ? "canceled" : undefined;
    const splice = {
      target,
      start: actualStart,
      ...(actualDeleteCount === 0 ? {} : { removedCount: actualDeleteCount }),
      inserted,
      ...(outcome === undefined ? {} : { outcome }),
    };
    // Đọc phần bị gỡ TRƯỚC khi append: append là ranh giới đồng bộ nhưng trạng thái sau đó là mới.
    const removed = inbox.slice(actualStart, actualStart + actualDeleteCount);
    const event = this.session.append("agent/inbox/spliced", splice);
    if (discardRemoved) for (const message of removed) this.dispatch.emit("agent/inbox/discarded", { message });
    // Phát từ `event.data.inserted` (bản sao ĐÃ chuẩn hoá mà log giữ), không phải mảng tham số.
    for (const message of event.data.inserted) this.dispatch.emit("agent/inbox/inserted", { message });
    return removed;
  }
}
