/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Contract `PendingApproval`: mot yeu cau duyet dang cho nguoi tra loi, tra ket qua ve waterfall cua Host
 */

/** Quyết định mà phần trình bày trên client có thể trả về cho waterfall của Host. */
export type ApprovalDecision = "allowed-once" | "rejected";

/** Bản dịch do bên hỏi (Tool) cung cấp: tiếng Anh làm mặc định, các ngôn ngữ khác tra theo khoá. */
export interface ApprovalDisplayReason {
  /** Bản tiếng Anh, dùng khi ngôn ngữ đang chọn không có bản dịch. */
  readonly en: string;
  /** Các bản dịch khác theo mã ngôn ngữ. */
  readonly [locale: string]: string;
}

/** Các trường mà client nhìn thấy của một yêu cầu duyệt (chiếu qua Remote Event). */
export interface ApprovalPresentationRequest {
  /** Tool đang xin quyết định. */
  readonly toolName: string;
  /** Lời gọi Tool tương ứng, nếu bên hỏi có cung cấp. */
  readonly callId?: string;
  /** Lý do người đọc được, do bên hỏi cung cấp. */
  readonly reason?: string;
  /** Bản dịch của lý do; lý do gốc dùng cho audit vẫn giữ nguyên. */
  readonly displayReason?: ApprovalDisplayReason;
  /** Tín hiệu huỷ chiếu từ waterfall của Host. */
  readonly signal?: AbortSignal;
}

/** Dấu hiệu nội bộ cho biết một lần từ chối nghĩa là "chuyển tiếp cho listener kế tiếp". */
const DELEGATED = Symbol("pending approval delegated");

/**
 * Chạy một bước kết thúc và chuyển kết quả thành promise.
 * Nhận: hàm kết thúc (có thể ném lỗi) và câu mô tả lỗi dùng khi lỗi không phải `Error`.
 * Trả: promise đã settle — `answer()` của contract là bất đồng bộ dù bước kết thúc chạy ngay.
 */
export function settlePendingComposer(settle: () => void, failureMessage: string): Promise<void> {
  try {
    settle();
    return Promise.resolve();
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(failureMessage, { cause: error }));
  }
}

/** Số thứ tự dùng cho `key` — mỗi lần trình bày một yêu cầu mới thì tăng, để React remount đúng một lần. */
let approvalSequence = 0;

/**
 * Một yêu cầu duyệt đang chờ, do client trình bày và người dùng trả lời.
 *
 * Vòng đời: `answer` (người dùng quyết) · `delegate` (trả lại waterfall cho listener kế tiếp) ·
 * `abort` (transport/scope/plugin hết vòng đời). Ba đường này đều đi qua {@link PendingApproval.finish},
 * nên chỉ MỘT trong số chúng thắng; gọi lần thứ hai sẽ ném lỗi.
 */
export class PendingApproval {
  /** Phiên (Agent) sở hữu yêu cầu có phạm vi này. */
  readonly sessionId: string;
  /** Phân loại miền, dùng cho các consumer "pending interaction" của Session. */
  readonly kind = "approval";
  /** Danh tính để render và là trục remount một lần. */
  readonly key: string;
  /** Tool đang xin quyết định. */
  readonly toolName: string;
  /** Lời gọi Tool tương ứng, khi bên hỏi có cung cấp. */
  readonly callId: string | undefined;
  /** Lý do người đọc được, khi bên hỏi có cung cấp. */
  readonly reason: string | undefined;
  /** Bản dịch của lý do, khi bên hỏi có cung cấp. */
  readonly displayReason: ApprovalDisplayReason | undefined;
  /** Kết quả mà listener Remote Event trả về cho waterfall của Host. */
  readonly result: Promise<ApprovalDecision>;
  private resolveResult: (outcome: ApprovalDecision) => void;
  private rejectResult: (reason: unknown) => void;
  private readonly signal: AbortSignal | undefined;
  private readonly onAbort: (() => void) | undefined;
  private settled = false;

  /**
   * Dựng một lần trình bày.
   * Nhận: `sessionId` — phiên sở hữu yêu cầu; `request` — yêu cầu đã chiếu qua Remote Event.
   * Trả: thực thể đang chờ, sẵn sàng được slot chọn để render.
   */
  constructor(sessionId: string, request: ApprovalPresentationRequest) {
    this.sessionId = sessionId;
    approvalSequence += 1;
    this.key = "approval:" + String(approvalSequence);
    this.toolName = request.toolName;
    this.callId = request.callId;
    this.reason = request.reason;
    this.displayReason = request.displayReason;
    let resolveResult!: (outcome: ApprovalDecision) => void;
    let rejectResult!: (reason: unknown) => void;
    this.result = new Promise<ApprovalDecision>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    this.resolveResult = resolveResult;
    this.rejectResult = rejectResult;
    this.signal = request.signal;
    if (request.signal === undefined) {
      this.onAbort = undefined;
      return;
    }
    const onAbort = (): void => {
      this.abort(request.signal?.reason ?? new Error("approval request was aborted"));
    };
    this.onAbort = onAbort;
    request.signal.addEventListener("abort", onAbort, { once: true });
    // Tín hiệu đã huỷ TRƯỚC khi gắn listener thì không bao giờ phát nữa ⇒ phải tự kết thúc ngay.
    if (request.signal.aborted) onAbort();
  }

  /**
   * Yêu cầu này còn nhận được quyết định hay không.
   * Nhận: không.
   * Trả: false sau khi đã trả lời, chuyển tiếp hoặc bị huỷ.
   */
  get answerable(): boolean {
    return !this.settled;
  }

  /**
   * Trả lời waterfall của Host bằng quyết định của người dùng.
   * Nhận: quyết định hợp lệ (`allowed-once` | `rejected`).
   * Trả: promise đã settle sau khi ghi kết quả; ném lỗi nếu yêu cầu đã kết thúc trước đó.
   */
  answer(outcome: ApprovalDecision): Promise<void> {
    return settlePendingComposer(() => {
      this.finish(() => {
        this.resolveResult(outcome);
      });
    }, "pending approval settlement failed");
  }

  /**
   * Chuyển tiếp một yêu cầu chưa trả lời cho listener kế tiếp của waterfall.
   * Nhận: không.
   * Trả: không; `result` từ chối bằng dấu hiệu nội bộ mà {@link PendingApproval.isDelegation} nhận ra.
   */
  delegate(): void {
    if (this.settled) return;
    this.finish(() => {
      this.rejectResult(DELEGATED);
    });
  }

  /**
   * Kiểm tra xem một lần từ chối có phải do {@link PendingApproval.delegate} sinh ra không.
   * Nhận: giá trị bắt được từ `result`.
   * Trả: true khi đó là dấu hiệu chuyển tiếp của CHÍNH yêu cầu này.
   */
  isDelegation(reason: unknown): boolean {
    return reason === DELEGATED;
  }

  /**
   * Kết thúc một trình bày chưa trả lời khi transport, phạm vi hoặc plugin hết vòng đời.
   * Nhận: lý do từ chối mà listener Remote Event đang chờ sẽ nhận.
   * Trả: không; yêu cầu đã kết thúc thì bỏ qua.
   */
  abort(reason: unknown): void {
    if (this.settled) return;
    this.finish(() => {
      this.rejectResult(reason);
    });
  }

  /**
   * Cửa duy nhất để kết thúc một yêu cầu: đánh dấu đã settle, gỡ listener huỷ, rồi ghi kết quả.
   * Nhận: hàm ghi kết quả (resolve hoặc reject).
   * Trả: không.
   * @throws khi yêu cầu đã được kết thúc trước đó — mọi đường khác đều phải kiểm `settled` trước.
   */
  private finish(settle: () => void): void {
    if (this.settled) throw new Error("pending approval " + this.key + " is already settled");
    this.settled = true;
    if (this.signal !== undefined && this.onAbort !== undefined) this.signal.removeEventListener("abort", this.onAbort);
    settle();
  }
}
