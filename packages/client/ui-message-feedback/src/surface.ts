/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Be mat phan hoi cua MOT phien — tang doi tuong tin nhan + hop thoai, va dinh tuyen giua hai tang
 */

import { MessageFeedbackController, type Carried, type FeedbackCategory, type MessageFeedbackActionResult, type MessageFeedbackRemote, type Settled } from "./controller";
import { FeedbackDialogController, type FeedbackDraft, type FeedbackDialogTarget } from "./dialog";

/** Mat Remote `sessionFeedback` ma tang nay can (loi phan hoi cap phien). */
export interface SessionFeedbackRemote {
  /**
   * Ghi mot loi phan hoi cap phien vao log phien.
   * Nhan: request — id phien, van ban va phan loai tuy chon.
   * Tra: ket qua mang boc ket qua nghiep vu.
   */
  record(request: {
    readonly sessionId: string;
    readonly text?: string;
    readonly category?: FeedbackCategory;
  }): Promise<Carried<Settled<{ readonly recorded: true }>>>;
}

/**
 * Be mat phan hoi cua mot phien: tang doi tuong tin nhan, hop thoai, va dinh tuyen giua chung.
 * Ban viet lai trung thanh cua `FeedbackSurface` trong ban goc.
 */
export class FeedbackSurface {
  /** Tang doi tuong tin nhan, dung chung cho moi nut phan hoi cua phien. */
  readonly feedback: MessageFeedbackController;
  /** Trang thai hop thoai va toast, dung chung cho muc overlay va cac nut phan hoi. */
  readonly dialog: FeedbackDialogController;
  /** Mat Remote `sessionFeedback` (chi dung cho dich cap phien). */
  private readonly sessionFeedback: SessionFeedbackRemote;
  /** Phien so huu transcript va loi phan hoi. */
  private readonly sessionId: string;

  /**
   * Nhan: messageFeedback — mat Remote tung tin nhan; sessionFeedback — mat Remote cap phien;
   * sessionId — phien so huu.
   * Tra: doi tuong be mat.
   */
  constructor(messageFeedback: MessageFeedbackRemote, sessionFeedback: SessionFeedbackRemote, sessionId: string) {
    this.sessionId = sessionId;
    this.sessionFeedback = sessionFeedback;
    this.feedback = new MessageFeedbackController(messageFeedback, sessionId);
    this.dialog = new FeedbackDialogController((target: FeedbackDialogTarget, entry: FeedbackDraft) =>
      target.kind === "message"
        ? this.feedback.rate(target.messageId, target.rating, entry)
        : this.recordSession(entry),
    );
  }

  /**
   * Ghi mot loi phan hoi cap phien qua mat Remote `sessionFeedback`.
   * Nhan: entry — van ban va phan loai tuy chon.
   * Tra: ket qua nghiep vu.
   */
  private async recordSession(entry: FeedbackDraft): Promise<MessageFeedbackActionResult> {
    const carried = await this.sessionFeedback.record({ sessionId: this.sessionId, ...entry });
    if (!carried.ok) return { ok: false, error: { code: carried.error.code, message: carried.error.message } };
    if (carried.value.ok) return { ok: true };
    return {
      ok: false,
      error: { code: carried.value.error.code, message: describeFailure(carried.value.error.code) },
    };
  }

  /**
   * Bo ca hai tang khi fiber so huu go xuong.
   * Nhan: khong co.
   * Tra: khong co.
   */
  dispose(): void {
    this.feedback.dispose();
    this.dialog.dispose();
  }
}

/**
 * Doc mot ma that bai cap phien (ban goc dung chung ham mo ta cua tang tin nhan).
 * Nhan: code — ma Host tra ve.
 * Tra: mo ta cho nguoi phat trien.
 */
function describeFailure(code: string): string {
  return code === "session-not-found" ? "this session is no longer persisted" : code;
}
