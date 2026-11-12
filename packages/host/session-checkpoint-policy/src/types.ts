/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt cắt SEAM mà chính sách checkpoint phiên dùng, khai theo CẤU TRÚC (không import gói seam nào):
 *      sổ phiên (`sessions`), ba điểm mở rộng cordis (`llm/stream` · `tools/execute` · `agent/pre-step`).
 */

/** Mã phiên: thương hiệu `SessionId` của kernel chỉ tồn tại lúc biên dịch, lúc chạy là chuỗi. */
export type SessionId = string;

/** Phiên đang sống — chính sách chỉ chuyển DANH TÍNH của nó cho sổ phiên, không đọc trạng thái nào. */
export type LiveSession = object;

/** Sổ phiên mà chính sách gọi vào: tra phiên đang sống và ép ghi bền phần đã cam kết. */
export interface SessionStoreSeam {
  /**
   * Tra một phiên đang sống theo mã.
   * Nhận: mã phiên của request model.
   * Trả: phiên đang sống, hoặc `undefined` khi không có phiên nào mang mã đó.
   */
  get(id: SessionId): LiveSession | undefined;

  /**
   * Ép mọi sự kiện đã cam kết của phiên xuống kho bền (checkpoint).
   * Nhận: phiên cần ghi bền.
   * Trả: promise hoàn tất khi mọi listener ghi bền đã xong; NÉM lỗi listener đầu tiên,
   *       và cờ boolean của kernel ("có listener nào tham gia không") KHÔNG phải điều kiện thành công.
   */
  flush(session: LiveSession): Promise<boolean>;
}

/** Tuỳ chọn một request model — chính sách chỉ đọc `sessionId`, phần còn lại giữ nguyên văn. */
export interface StreamRequestOptions {
  /** Phiên sở hữu request; vắng mặt nghĩa là request không thuộc phiên nào nên không có gì để checkpoint. */
  readonly sessionId?: SessionId;
}

/** Một khối của luồng model — chính sách KHÔNG đọc, chỉ chuyển tiếp nguyên văn. */
export type StreamChunk = unknown;

/** Hàm gọi tiếp của waterfall `llm/stream`: dựng luồng của tầng dưới (adapter). */
export type StreamNext = () => AsyncIterable<StreamChunk>;

/** Nội dung model nhìn thấy của một kết quả tool (nhánh chính sách tạo ra chỉ dùng khối chữ). */
export interface ContentBlock {
  /** Loại khối; bản gốc chỉ dùng `text`. */
  readonly type: "text";
  /** Chữ hiển thị cho model. */
  readonly text: string;
}

/** Thông tin lỗi cấu trúc đi kèm kết quả tool hỏng. */
export interface ToolErrorInfo {
  /** Tên lớp lỗi (`AbortError` cho ca huỷ trước khi vào thân tool). */
  readonly name: string;
  /** Mã lỗi canonical của kernel (`ABORTED_BEFORE_DISPATCH`). */
  readonly code: string;
  /** Chi tiết tuỳ chọn — bản gốc không đặt. */
  readonly reason?: string;
}

/** Kết quả tool HỎNG canonical — nhánh duy nhất mà chính sách tự tạo ra. */
export interface ToolExecutionFailure {
  /** Luôn `true`: kết quả hỏng. */
  readonly isError: true;
  /** Lỗi cấu trúc được định tuyến theo mã. */
  readonly error: {
    /** Thông điệp không kèm vỏ `Error: `. */
    readonly message: string;
    /** Danh tính lỗi cho tầng chính sách. */
    readonly info: ToolErrorInfo;
  };
  /** Nội dung model nhìn thấy. */
  readonly content: ContentBlock[];
}

/** Kết quả một lần gọi tool của tầng dưới — chính sách KHÔNG đọc, chỉ chuyển tiếp nguyên văn. */
export type ToolDispatchResult = unknown;

/** Lượt gọi tool đang đi qua waterfall `tools/execute` — mặt cắt chính sách đọc. */
export interface ToolDispatchExecution {
  /** Agent chịu trách nhiệm lượt gọi (vòng agent đặt); vắng mặt ở lời gọi không thuộc agent nào. */
  readonly agent?: {
    /** Phiên của agent đó — nơi sự kiện `tool/call` đã được cam kết. */
    readonly session: LiveSession;
  };
  /** Token của lượt vận chuyển bao ngoài (PTC) — có mặt nghĩa là lời gọi LỒNG NHAU, dùng lại checkpoint ngoài. */
  readonly parent?: unknown;
  /** Tín hiệu huỷ của lượt gọi. */
  readonly signal: AbortSignal;
}

/** Thân sự kiện `agent/pre-step` — chính sách chỉ đọc agent, phần còn lại giữ nguyên văn. */
export interface AgentStepEvent {
  /** Agent sắp bước vào lượt kế tiếp. */
  readonly agent: {
    /** Phiên của agent đó — nơi batch response/result vừa cam kết. */
    readonly session: LiveSession;
  };
}

/** Listener waterfall `llm/stream`: nhận tuỳ chọn request + hàm dựng luồng, trả luồng (đã bọc checkpoint). */
export type StreamListener = (options: StreamRequestOptions, next: StreamNext) => AsyncIterable<StreamChunk>;

/** Listener waterfall `tools/execute`: nhận lượt gọi + hàm gọi tiếp, trả kết quả canonical. */
export type ToolExecuteListener = (
  exec: ToolDispatchExecution,
  next: () => Promise<ToolDispatchResult>,
) => Promise<ToolDispatchResult>;

/** Listener waterfall `agent/pre-step`: nhận thân sự kiện + hàm gọi tiếp, trả quyết định của tầng dưới. */
export type PreStepListener = (event: AgentStepEvent, next: () => Promise<unknown>) => Promise<unknown>;

/** Context cordis mà plugin này dùng, khai theo CẤU TRÚC: một seam + ba điểm mở rộng, không import gói seam nào. */
export interface CheckpointContext {
  /** Sổ phiên: nguồn duy nhất của rào ghi bền. */
  readonly sessions: SessionStoreSeam;

  /**
   * Đăng ký listener cho waterfall `llm/stream`.
   * Nhận: tên sự kiện và listener nhận tuỳ chọn request + hàm dựng luồng.
   * Trả: hàm gỡ đăng ký.
   */
  on(event: "llm/stream", listener: StreamListener): () => void;

  /**
   * Đăng ký listener cho waterfall `tools/execute`.
   * Nhận: tên sự kiện và listener nhận lượt gọi + hàm gọi tiếp.
   * Trả: hàm gỡ đăng ký.
   */
  on(event: "tools/execute", listener: ToolExecuteListener): () => void;

  /**
   * Đăng ký listener cho waterfall `agent/pre-step`.
   * Nhận: tên sự kiện và listener nhận thân sự kiện + hàm gọi tiếp.
   * Trả: hàm gỡ đăng ký.
   */
  on(event: "agent/pre-step", listener: PreStepListener): () => void;
}
