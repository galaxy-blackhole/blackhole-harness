/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt cắt SEAM mà bộ đẩy ảnh ra khỏi ngữ cảnh dùng, khai theo CẤU TRÚC (không import gói seam
 *      nào): sổ phiên (`session.surface`/`eventAt`/`deriveEventMessage`/`append`), định nghĩa
 *      projection, và hai waterfall phục hồi (`agent/request-error` · `compaction/summary-error`).
 */

/** Số thứ tự sự kiện trong nhật ký phiên (thương hiệu `SessionSeq` của kernel chỉ tồn tại lúc biên dịch). */
export type SessionSeq = number;

/** Một khối nội dung model nhìn thấy — bộ đẩy ảnh chỉ quan tâm khối `image`. */
export interface ContentBlockLike {
  /** Loại khối; `image` là loại duy nhất được đánh dấu, mọi loại khác giữ nguyên văn. */
  readonly type: string;
  /** Dấu "đã đẩy ra khỏi ngữ cảnh": `true` nghĩa là lần chọn sau KHÔNG chọn lại khối này. */
  readonly offloaded?: boolean;
}

/** Thông điệp đã dựng từ một sự kiện sinh-thông-điệp. */
export interface MessageLike {
  /** Các khối nội dung, theo đúng thứ tự model nhìn thấy. */
  readonly content: readonly ContentBlockLike[];
}

/** Sự kiện trong nhật ký phiên — bộ đẩy ảnh chỉ đọc `type` và `data`. */
export interface SessionEventLike {
  /** Loại sự kiện; `user/message` và `tool/result` là hai loại sinh thông điệp ĐẦU VÀO. */
  readonly type: string;
  /** Thân sự kiện; hình dạng phụ thuộc `type` (xem `sourceMessage` trong `projection.ts`). */
  readonly data?: unknown;
}

/** Đích của một quyết định đẩy ảnh: một sự kiện + các chỉ số ảnh ĐÃ CHỌN trong thông điệp của nó. */
export interface ImageOffloadTarget {
  /** Sự kiện sinh-thông-điệp đang là nút mặt (surface) hiện tại. */
  readonly seq: SessionSeq;
  /** Chỉ số ảnh 0-based trong thông điệp, TĂNG NGHIÊM NGẶT; tính CẢ ảnh đã đẩy trước đó. */
  readonly imageIndexes: number[];
}

/** Thân sự kiện `image/offload` ghi vào nhật ký phiên. */
export interface ImageOffloadEventData {
  /** Các đích của quyết định; KHÔNG rỗng, mỗi `seq` xuất hiện tối đa một lần. */
  readonly targets: ImageOffloadTarget[];
}

/** Phiên đang sống — bộ đẩy ảnh đọc lịch sử, dựng thông điệp, rồi GHI một quyết định. */
export interface SessionLike {
  /** Nút mặt hiện tại, theo đúng thứ tự request model. */
  readonly surface: { readonly nodes: readonly SessionSeq[] };

  /**
   * Đọc một sự kiện theo số thứ tự.
   * Nhận: `seq` của một nút mặt.
   * Trả: sự kiện nằm tại số thứ tự đó trong nhật ký phiên.
   */
  eventAt(seq: SessionSeq): SessionEventLike;

  /**
   * Dựng thông điệp của một sự kiện sinh-thông-điệp.
   * Nhận: sự kiện `user/message` hoặc `tool/result`.
   * Trả: thông điệp bất biến mà request model nhìn thấy.
   */
  deriveEventMessage(event: SessionEventLike): MessageLike;

  /**
   * Ghi một sự kiện vào nhật ký phiên.
   * Nhận: loại sự kiện và thân sự kiện.
   * Trả: giá trị do kernel trả về (kernel tự cấp số thứ tự và tự áp projection).
   */
  append(type: "image/offload", data: ImageOffloadEventData): unknown;
}

/** Ngữ cảnh lịch sử mà kernel đưa cho một `project` — rút gọn còn đúng thứ projection đọc. */
export interface ProjectionContextLike {
  /** Nút sinh-thông-điệp hiện tại, theo thứ tự model nhìn thấy. */
  readonly nodes: readonly SessionSeq[];
  /** Cửa sổ sự kiện liên tục; phần tử từ `seq` ứng viên trở đi chưa phải đầu vào đã cam kết. */
  readonly events: readonly SessionEventLike[];
  /** Số thứ tự tuyệt đối của phần tử đầu cửa sổ. */
  readonly baseSeq: number;
  /** Thông điệp đã chiếu trước đó, khoá theo số thứ tự gốc. */
  readonly messages: ReadonlyMap<SessionSeq, MessageLike>;
}

/** Một định nghĩa projection do plugin sở hữu: một loại sự kiện + phép chiếu THUẦN. */
export interface MessageProjectionLike<T extends string = string> {
  /** Loại sự kiện mà định nghĩa này diễn giải (khai bằng `@messageProjection` trong kernel). */
  readonly type: T;

  /**
   * Kiểm và dựng lại các thông điệp bị quyết định bền này thay đổi.
   * Nhận: sự kiện ứng viên (chưa áp vào lịch sử) và ngữ cảnh lịch sử trước nó.
   * Trả: các thông điệp đã đổi, khoá theo số thứ tự gốc; NÉM khi quyết định không áp được.
   */
  project(
    event: { readonly type: T; readonly data?: unknown },
    context: ProjectionContextLike,
  ): ReadonlyMap<SessionSeq, MessageLike>;
}

/** Thân sự kiện `agent/request-error` — waterfall phục hồi của vòng agent. */
export interface AgentRequestErrorEvent {
  /** Agent có request vừa hỏng. */
  readonly agent: {
    /** Phiên của agent đó — nơi quyết định đẩy ảnh sẽ được ghi. */
    readonly session: SessionLike;
  };
  /** Sự kiện lỗi đã chuẩn hoá ở biên adapter cuối. */
  readonly failure: {
    /** Mã lỗi máy đọc được (chỉ phục hồi khi là `IMAGE_OFFLOAD_REQUIRED`). */
    readonly code?: string;
    /** Số lần xuất hiện ảnh nữa mà adapter cần bỏ khỏi request. */
    readonly offloadImages?: number;
  };
  /** Tín hiệu huỷ của lượt hiện tại. */
  readonly signal: AbortSignal;
}

/** Hành động mà waterfall `agent/request-error` trả về: `{ kind: "retry" }` hoặc `undefined`. */
export type RequestErrorAction = { readonly kind: "retry" } | undefined;

/** Thân sự kiện `compaction/summary-error` — waterfall phục hồi của bộ nén. */
export interface SummaryErrorEvent {
  /** Phiên chứa đầu vào đã chọn. */
  readonly session: SessionLike;
  /** Sự kiện sinh-thông-điệp đã chọn, theo đúng thứ tự request. */
  readonly sourceEventSeqs: readonly SessionSeq[];
  /** Lỗi do bộ tóm tắt ném ra (có thể KHÔNG phải `LlmError` — khi đó phải chuyển tiếp). */
  readonly error: unknown;
  /** Tín hiệu huỷ của lượt nén (tuỳ chọn). */
  readonly signal?: AbortSignal;
}

/** Context cordis mà plugin dùng — một seam + hai điểm mở rộng, khai theo CẤU TRÚC. */
export interface ImageOffloadContext {
  /** Sổ phiên: nơi đăng ký định nghĩa projection `image/offload`. */
  readonly sessions: {
    /**
     * Đăng ký định nghĩa projection để kernel áp mọi sự kiện `image/offload`.
     * Nhận: định nghĩa projection thuần.
     * Trả: hàm gỡ đăng ký.
     */
    registerMessageProjection(projection: MessageProjectionLike<"image/offload">): () => Promise<void>;
  };

  /**
   * Đăng ký listener cho waterfall `agent/request-error`.
   * Nhận: tên sự kiện và listener nhận thân sự kiện + hàm gọi tiếp.
   * Trả: hàm gỡ đăng ký.
   */
  on(
    event: "agent/request-error",
    listener: (payload: AgentRequestErrorEvent, next: () => Promise<RequestErrorAction>) => Promise<RequestErrorAction>,
  ): () => void;

  /**
   * Đăng ký listener cho waterfall `compaction/summary-error`.
   * Nhận: tên sự kiện và listener nhận thân sự kiện + hàm gọi tiếp.
   * Trả: hàm gỡ đăng ký.
   */
  on(
    event: "compaction/summary-error",
    listener: (payload: SummaryErrorEvent, next: () => boolean) => boolean,
  ): () => void;
}
