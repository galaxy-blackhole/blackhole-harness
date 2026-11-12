/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng kiểu của row file-upload: yêu cầu/biên nhận tải tệp, hình dạng Agent/Session,
 *      và các seam Host mà service đọc (agents · attachments · commands · connection).
 *      Khai theo CẤU TRÚC để không kéo .d.ts của gói khác vào chương trình tsc (luật 000d).
 */

/** Danh tính phiên — chuỗi có nhãn ở tầng kiểu của bản gốc (SessionId). */
export type SessionId = string;

/** Danh tính biên nhận do Host cấp cho MỘT lần tải trong ĐÚNG phạm vi Agent. */
export type FileUploadReceiptId = string;

/** Yêu cầu tải đã mã hoá canonical base64 (nhánh Remote của bản gốc). */
export interface EncodedFileUploadRequest {
  /** Base64 canonical của đúng các byte của tệp. */
  readonly data: string;
  /** Tên hiển thị tuỳ chọn; Host làm sạch thành tên lá của đối tượng lưu. */
  readonly name?: string;
}

/** Tham chiếu tệp bền vững (đúng hình dạng FileAttachmentRef của bản gốc). */
export interface FileAttachmentRef {
  /** Định danh lưu trữ theo nội dung; KHÔNG bao giờ là đường dẫn hay URL mang quyền. */
  readonly attachmentId: string;
  /** Tên tệp hiển thị đã làm sạch. */
  readonly name: string;
  /** Độ dài byte chính xác. */
  readonly bytes: number;
}

/** Biên nhận + tham chiếu tệp bền vững mà một lần tải trả về. */
export interface FileUploadValue {
  /** Quyền đã cấp cho MỘT lần tải, chỉ dùng được trong phạm vi Agent nhận. */
  readonly receiptId: FileUploadReceiptId;
  /** Tham chiếu tệp bền vững. */
  readonly file: FileAttachmentRef;
}

/** Header phiên — chỉ phần service này đọc (phân loại subagent). */
export interface SessionHeaderLike {
  /** Phân loại thô của phiên; 'subagent' khi phiên là con của một phiên khác. */
  readonly origin?: string;
}

/** Phiên sống — chỉ phần service này đọc. */
export interface SessionLike {
  /** Header của phiên. */
  readonly header: SessionHeaderLike;
}

/** Agent đang sống — chỉ phần service này đọc. */
export interface AgentLike {
  /** Danh tính Agent (bằng id phiên). */
  readonly id: SessionId;
  /** Phiên mà Agent này điều khiển. */
  readonly session: SessionLike;
}

/** Hàm giải/résume Agent thường cho một phiên lạnh (do row khác đăng ký). */
export type AgentResolver = (sessionId: SessionId) => Promise<AgentLike>;

/** Prompt đang giữ biên nhận; commit() giữ biên nhận, dispose khôi phục trạng thái cũ. */
export interface PromptFileBinding {
  /** Giữ biên nhận ở lại sau khi prompt được gửi thành công. */
  commit(): void;
}

/** Một biên nhận đã staged, kèm prompt đang giữ nó (nếu có). */
export interface StagedUpload {
  /** Tham chiếu tệp bền vững. */
  file: FileAttachmentRef;
  /** Prompt đã nhận biên nhận này; vắng khi chưa gắn. */
  requestId?: string;
}

/** Yêu cầu lưu byte thô theo luồng (phần kho attachment cần). */
export interface SaveFileStreamRequest {
  /** Byte theo thứ tự, dạng luồng. */
  readonly data: AsyncIterable<Uint8Array>;
  /** Huỷ của bên gọi. */
  readonly signal?: AbortSignal;
  /** Tên hiển thị tuỳ chọn. */
  readonly name?: string;
}

/** Yêu cầu lưu byte thô theo luồng cho MỘT phiên (nhánh route HTTP). */
export interface StreamUploadRequest extends SaveFileStreamRequest {
  /** Phiên sở hữu biên nhận. */
  readonly sessionId: SessionId;
}

/** Lỗi miền của kho attachment (đủ để ánh xạ sang lỗi Remote). */
export interface AttachmentFailure {
  /** Mã lỗi ổn định của kho attachment. */
  readonly code: string;
  /** Thông điệp của kho attachment. */
  readonly message: string;
}

/** Seam ctx.agents: sổ Agent đang sống. */
export interface AgentsSeam {
  /**
   * Tra Agent đang sống theo danh tính phiên.
   * @param id - danh tính phiên.
   * @returns Agent đang sống, hoặc undefined khi phiên không được attach.
   */
  get(id: SessionId): AgentLike | undefined;
}

/** Seam ctx.attachments: kho tệp bền vững. */
export interface AttachmentsSeam {
  /**
   * Nhận MỘT tệp đã mã hoá base64 và lưu bền vững.
   * @param input - base64 canonical và tên hiển thị tuỳ chọn.
   * @returns tham chiếu tệp bền vững.
   */
  admitEncodedFile(input: EncodedFileUploadRequest): Promise<FileAttachmentRef>;
  /**
   * Lưu bền vững MỘT tệp từ các khối byte theo thứ tự.
   * @param input - luồng byte, huỷ, và tên hiển thị tuỳ chọn.
   * @returns tham chiếu tệp bền vững.
   */
  saveFileStream(input: SaveFileStreamRequest): Promise<FileAttachmentRef>;
  /**
   * Nhận diện lỗi do chính kho attachment phát ra (theo mã ổn định).
   * @param error - giá trị bắt được từ một thao tác attachment.
   * @returns true khi là lỗi attachment (thu hẹp kiểu).
   */
  isAttachmentError(error: unknown): error is AttachmentFailure;
}

/** Hàm giải biên nhận tệp cho lệnh gạch chéo (do row commands gọi). */
export type CommandFileReceiptResolver = (agent: AgentLike, receiptId: FileUploadReceiptId) => FileAttachmentRef | undefined;

/** Seam ctx.commands: sổ lệnh gạch chéo. */
export interface CommandsSeam {
  /**
   * Đăng ký hàm giải biên nhận tệp cho prompt của lệnh.
   * @param resolver - hàm giải biên nhận.
   * @returns hàm dọn gỡ đăng ký.
   */
  registerFileReceiptResolver(resolver: CommandFileReceiptResolver): () => void;
}

/** Một route Fetch chính xác trên kênh API dùng chung (đúng hình dạng Connection). */
export interface ConnectionFetchRoute {
  /** Đường dẫn tuyệt đối dưới /api; query vẫn còn trên URL của request. */
  readonly path: string;
  /** Phương thức route này sở hữu. */
  readonly methods: readonly string[];
  /** Chế độ thân yêu cầu: 'streaming' cho luồng có backpressure, không trần tổng. */
  readonly requestBody: string;
  /**
   * Xử lý MỘT yêu cầu sau khi tầng vận chuyển đã áp chính sách tin cậy/xác thực.
   * @param request - request Fetch đã xác thực.
   * @returns phản hồi Fetch.
   */
  fetch(request: Request): Promise<Response>;
}

/** Seam registry route của Connection. */
export interface ConnectionFetchSeam {
  /**
   * Đăng ký MỘT route chính xác.
   * @param route - đường dẫn, phương thức, và hàm xử lý Fetch.
   * @returns hàm dọn bất đồng bộ gỡ đúng đóng góp này.
   */
  register(route: ConnectionFetchRoute): () => Promise<void>;
}

/** Seam ctx.connection: tầng vận chuyển đã xác thực. */
export interface ConnectionSeam {
  /** Registry route Fetch chính xác. */
  readonly fetch: ConnectionFetchSeam;
}

/** Một sự kiện phiên mà service này quan sát (chỉ phần được dùng). */
export interface SessionEventLike {
  /** Loại sự kiện (service chỉ quan tâm user/message). */
  readonly type: string;
  /** Thân sự kiện. */
  readonly data: {
    /** Nguồn của tin nhắn người dùng. */
    readonly source: {
      /** Loại nguồn; service chỉ quan tâm 'user'. */
      readonly kind: string;
      /** Danh tính lời gọi RPC đã sinh tin nhắn. */
      readonly rpcId?: string;
    };
  };
}

/** Toàn bộ seam Host mà service file-upload đọc (khai theo CẤU TRÚC). */
export interface FileUploadSeams {
  /** Sổ Agent đang sống. */
  readonly agents: AgentsSeam;
  /** Kho tệp bền vững. */
  readonly attachments: AttachmentsSeam;
  /** Sổ lệnh gạch chéo. */
  readonly commands: CommandsSeam;
  /** Tầng vận chuyển đã xác thực. */
  readonly connection: ConnectionSeam;
  /**
   * Nghe một sự kiện phiên.
   * @param event - tên sự kiện.
   * @param listener - hàm nhận (session, event).
   * @returns giá trị do cordis trả (không dùng).
   */
  on(event: "session/event", listener: (session: SessionLike, event: SessionEventLike) => void): unknown;
  /**
   * Nghe sự kiện phiên bị dọn.
   * @param event - tên sự kiện.
   * @param listener - hàm nhận session.
   * @returns giá trị do cordis trả (không dùng).
   */
  on(event: "session/disposed", listener: (session: SessionLike) => void): unknown;
  /**
   * Đăng ký hiệu ứng vòng đời: hàm dọn chạy khi fiber tắt.
   * @param callback - hàm trả về hàm dọn.
   * @param label - nhãn chẩn đoán.
   * @returns giá trị do cordis trả (không dùng).
   */
  effect(callback: () => () => unknown, label?: string): unknown;
}
