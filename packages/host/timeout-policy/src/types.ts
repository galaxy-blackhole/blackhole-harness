/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt cắt SEAM mà chính sách timeout dùng, khai theo CẤU TRÚC (không import gói seam nào): sổ tool
 *      (`ctx.tools.get` đọc `timeoutMs`), waterfall `tools/execute`, và vật thể kết quả canonical.
 */

/**
 * Ngân sách mà một ĐỊNH NGHĨA TOOL tự khai. Chính sách chỉ đọc đúng một trường này; phần còn lại của
 * định nghĩa tool không thuộc phạm vi nó.
 */
export interface TimeoutToolDefinition {
  /**
   * Hạn chót hợp tác, tính bằng mili-giây. Vắng mặt nghĩa là tool KHÔNG có hạn chót — chính sách
   * chuyển tiếp lời gọi nguyên vẹn. Trường này KHÔNG bao giờ được gửi cho model.
   */
  readonly timeoutMs?: number;
}

/** Sổ tool mà chính sách đọc (`ctx.tools`): tra định nghĩa tool theo tên trong phạm vi người gọi. */
export interface ToolRegistrySeam {
  /**
   * Tra định nghĩa tool như một phạm vi nhìn thấy nó.
   * Nhận: tên tool đã đăng ký + phạm vi nhìn (agent của lượt gọi; vắng mặt = phạm vi toàn cục).
   * Trả: định nghĩa tool mà phạm vi phân giải được, hoặc `undefined` khi không thấy định nghĩa nào.
   */
  get(name: string, scope?: unknown): TimeoutToolDefinition | undefined;
}

/** Một khối nội dung model nhìn thấy — chính sách chỉ tạo khối chữ. */
export interface ContentBlock {
  /** Loại khối; bản gốc chỉ dùng `text`. */
  readonly type: "text";
  /** Chữ hiển thị cho model. */
  readonly text: string;
}

/** Thông tin lỗi cấu trúc đi kèm một kết quả tool hỏng. */
export interface ToolErrorInfo {
  /** Tên lớp lỗi (`ToolTimeoutError` cho ca hạn chót của chính sách). */
  readonly name: string;
  /** Mã do năng lực sở hữu (`TOOL_TIMEOUT`). */
  readonly code: string;
  /** Chi tiết tuỳ chọn — bản gốc không đặt. */
  readonly reason?: string;
}

/** Kết quả tool THÀNH CÔNG canonical — chính sách chỉ chuyển tiếp, không đọc. */
export interface ToolExecutionSuccess {
  /** Luôn `false`: lượt gọi thành công. */
  readonly isError: false;
  /** Giá trị canonical cục bộ của lượt gọi (không đi vào sự kiện bền). */
  readonly value?: unknown;
  /** Nội dung model nhìn thấy. */
  readonly content: ContentBlock[];
}

/** Kết quả tool HỎNG canonical — dạng duy nhất mà chính sách tự dựng ra. */
export interface ToolExecutionFailure {
  /** Luôn `true`: lượt gọi hỏng. */
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

/** Kết quả một lần gọi tool của tầng dưới — chính sách chuyển tiếp nguyên văn, trừ ca hạn chót của nó. */
export type ToolExecutionResult = ToolExecutionSuccess | ToolExecutionFailure;

/** Lượt gọi tool đang đi qua waterfall `tools/execute` — mặt cắt chính sách đọc và ĐỔI tín hiệu. */
export interface ToolDispatchExecution {
  /** Tên tool được dispatch (dùng để tra `timeoutMs` trong sổ tool). */
  readonly name: string;
  /** Agent đại diện lượt gọi; vắng mặt ở lời gọi không thuộc agent nào. */
  readonly agent?: unknown;
  /**
   * Tín hiệu huỷ nhìn thấy bởi bộ bọc kế tiếp / thân tool. Chính sách THAY tạm thời bằng tín hiệu
   * hợp nhất (caller + đồng hồ của nó) rồi HOÀN LẠI trong `finally`.
   */
  signal: AbortSignal;
}

/** Hàm gọi tiếp của waterfall `tools/execute`: chạy bộ bọc / thân tool của tầng dưới. */
export type ToolNext = () => Promise<ToolExecutionResult>;

/** Listener waterfall `tools/execute`: nhận lượt gọi + hàm gọi tiếp, trả kết quả canonical. */
export type ToolExecuteListener = (exec: ToolDispatchExecution, next: ToolNext) => Promise<ToolExecutionResult>;

/** Context cordis mà plugin này dùng, khai theo CẤU TRÚC: một seam + một điểm mở rộng. */
export interface TimeoutContext {
  /** Sổ tool: nguồn duy nhất của ngân sách `timeoutMs` từng tool. */
  readonly tools: ToolRegistrySeam;

  /**
   * Đăng ký listener cho waterfall `tools/execute`.
   * Nhận: tên sự kiện và listener nhận lượt gọi + hàm gọi tiếp.
   * Trả: hàm gỡ đăng ký; gọi nó trả `true` khi listener còn đăng ký.
   */
  on(event: "tools/execute", listener: ToolExecuteListener): () => boolean;
}
