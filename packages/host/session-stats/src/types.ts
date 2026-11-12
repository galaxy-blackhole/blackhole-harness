/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng của miền "thống kê phiên" — vật thể của phép gộp và các seam mà row này chạm: seam
 *      `sessionProjections` do @deepseek-ai/dsh-session-projection cấp, sự kiện phiên do
 *      @deepseek-ai/dsh-session cấp (khai theo CẤU TRÚC), và dòng gói model do @deepseek-ai/dsh-llm cấp
 *      (import KIỂU thật — peer nằm trong bảng §3b, xem README của gói).
 */

import type { AssistantStreamRecord } from "@deepseek-ai/dsh-llm";

/**
 * Số liệu toàn log của một phiên, độc lập với lượng lịch sử client đã nạp: đây là KHUNG NHÌN DÂY
 * (wire) mà seam phát cho mọi vật mang chiếu. Mọi trường bằng 0 cho tới khi sự kiện đóng góp đầu tiên
 * rơi vào log; tên trường phản chiếu phép gộp cửa sổ của client (client dùng nó làm đường nạp lại
 * toàn phần khi không có đơn vị này).
 */
export interface SessionStatsProjection {
  /** Các lượt PHÂN BIỆT có ít nhất một bước đã đóng (`step/end`); lượt bị từ chối hoặc rỗng không đếm. */
  turns: number;
  /** Các bước đã đóng (`step/end`) — bước xong, hỏng và bị huỷ đều đếm. */
  steps: number;
  /** Tổng thời gian tường của mô hình (`step/start` → `assistant/message`) trên các bước đã lắp tin. */
  llmMs: number;
  /** Tổng thời gian tường của công cụ theo cặp `tool/call` → `tool/result` khớp bằng callId. */
  toolMs: number;
  /** Tổng độ trễ token đầu (`step/start` → mẩu delta không rỗng đầu tiên) trên `ttftSteps`. */
  ttftMs: number;
  /** Số bước có ghi nhận token đầu. */
  ttftSteps: number;
  /** Tổng thời gian giải mã (token đầu → `assistant/message`) trên các bước có báo cáo token ra. */
  decodeMs: number;
  /** Tổng token ra do nhà cung cấp báo, trên đúng những bước được tính `decodeMs`. */
  decodeTokens: number;
}

/**
 * Ranh giới của BƯỚC đang mở: mốc `step/start` và token đầu tiên đã thấy (nếu có). Đóng bởi
 * `assistant/message` của đúng bước đó; `step/end` cũng xoá nó (bước bị huỷ không lắp tin nào).
 */
export interface OpenStep {
  /** Số lượt của bước đang mở. */
  readonly turn: number;
  /** Số bước trong lượt. */
  readonly step: number;
  /** Mốc thời gian của `step/start` — gốc của cả `llmMs` lẫn `ttftMs`. */
  readonly startTime: number;
  /** Mốc thời gian của token đầu tiên, hoặc `null` khi bước chưa có token nào. */
  readonly firstTokenTime: number | null;
}

/**
 * Trạng thái phép gộp: tám tổng của khung nhìn dây + các ranh giới đang bay. Đây là hình dạng được
 * schema kiểm trên dòng cache đã lưu (sau cổng `ver`), nên nó là `SessionStatsProjection` mở rộng
 * thêm ba trường ranh giới — y như bản gốc.
 */
export interface SessionStatsState extends SessionStatsProjection {
  /** Số lượt của `step/end` được đếm gần nhất; `null` khi chưa đóng bước nào. */
  lastTurn: number | null;
  /** Bước đang mở (đã `step/start`, chưa `assistant/message`), hoặc `null`. */
  openStep: OpenStep | null;
  /** Mốc phát lệnh gọi công cụ theo callId — nửa mở của mọi cặp `toolMs`. */
  pendingCalls: Record<string, number>;
}

/** Dữ liệu của hai mốc biên bước (`step/start` · `step/end`): lượt và bước mà chúng nói tới. */
export interface StepBoundaryData {
  /** Số lượt. */
  readonly turn: number;
  /** Số bước trong lượt. */
  readonly step: number;
}

/** Dữ liệu của `assistant/attempt`: một lần gọi mô hình đã tất toán mà KHÔNG lắp tin nào. */
export interface AssistantAttemptData extends StepBoundaryData {
  /** Dòng gói đã nén của lần gọi — nguồn của mốc token đầu tiên. */
  readonly stream: readonly AssistantStreamRecord[];
}

/** Dữ liệu của `assistant/message`: tin của mô hình đã cam kết vào bề mặt. */
export interface AssistantMessageData extends StepBoundaryData {
  /** Dòng gói đã nén của lần gọi đã lắp tin này. */
  readonly stream: readonly AssistantStreamRecord[];
  /** Báo cáo token của nhà cung cấp (có thể vắng); phép gộp tự phòng dữ liệu hỏng. */
  readonly usage?: unknown;
}

/** Dữ liệu của `tool/call`: lệnh gọi công cụ vừa phát, khoá theo callId do nhà cung cấp cấp. */
export interface ToolCallData {
  /** Mã của lệnh gọi, dùng để ghép với kết quả. */
  readonly callId: string;
}

/** Dữ liệu của `tool/result`: kết quả công cụ, mang callId của lệnh gọi đã phát. */
export interface ToolResultData {
  /** Tin kết quả công cụ. */
  readonly message: {
    /** Nguồn của tin — nơi mang callId. */
    readonly source: {
      /** Mã của lệnh gọi mà kết quả này trả lời. */
      readonly callId: string;
    };
  };
}

/** Một sự kiện phiên đã cam kết, khai theo CẤU TRÚC: chỉ phần phép gộp này đọc. */
export interface SessionEvent {
  /** Loại sự kiện (`step/start` · `assistant/message` · `tool/call` · …). */
  readonly type: string;
  /** Mốc thời gian Unix (ms) của sự kiện — gốc của mọi phép đo thời gian tường. */
  readonly time: number;
  /** Dữ liệu sự kiện; từng nhánh `switch` tự khai hình dạng nó đọc. */
  readonly data: unknown;
}

/** Schema mà seam dùng: seam thật CHỈ gọi `parse` trước khi mồi phép gộp và trước khi phát khung nhìn. */
export interface ProjectionSchema<T> {
  /**
   * Kiểm và chuẩn hoá một giá trị đã lưu.
   * Nhận: giá trị chưa biết (đã đọc từ log hoặc từ dây).
   * Trả: giá trị đúng kiểu; ném khi không hợp lệ.
   */
  parse(value: unknown): T;
}

/** Khung nhìn dây của một đơn vị chiếu: schema của khung nhìn + hàm chiếu từ trạng thái. */
export interface ProjectionWire<State, View> {
  /** Schema của khung nhìn trên dây (đúng schema bản gốc khai). */
  readonly viewSchema: ProjectionSchema<View>;
  /**
   * Chiếu trạng thái phép gộp thành khung nhìn trên dây.
   * Nhận: trạng thái đã gộp.
   * Trả: khung nhìn sẽ phát — bản gốc dựng vật thể MỚI mỗi lần gọi (giữ nguyên như vậy).
   */
  view(state: State): View;
}

/** Một đơn vị chiếu host-only mà seam `sessionProjections` nhận. */
export interface ProjectionDefinition<State, View> {
  /** Khoá chiếu; bản gốc dùng `sessionStats`. */
  readonly key: string;
  /** Phiên bản trạng thái lưu; bản gốc dùng `1`. */
  readonly stateVersion: number;
  /** Schema kiểm trạng thái đã lưu trước khi mồi phép gộp. */
  readonly stateSchema: ProjectionSchema<State>;
  /**
   * Trạng thái cho log rỗng.
   * Nhận: không (seam thật truyền header + số sự kiện thừa kế; bản gốc bỏ qua cả hai).
   * Trả: trạng thái rỗng — vật thể MỚI mỗi lần gọi như bản gốc.
   */
  init(): State;
  /**
   * Phép gộp THUẦN: trạng thái trước + một sự kiện ⇒ trạng thái sau.
   * Nhận: trạng thái trước và sự kiện đã cam kết.
   * Trả: trạng thái sau — GIỮ NGUYÊN tham chiếu khi sự kiện không đổi gì.
   */
  apply(state: State, event: SessionEvent): State;
  /** Khung nhìn dây của đơn vị chiếu. */
  readonly wire: ProjectionWire<State, View>;
}

/** Seam `sessionProjections`: nơi row đăng ký đơn vị chiếu. */
export interface SessionProjectionsSeam {
  /** Đăng ký một đơn vị chiếu; seam thật trả hàm dọn và ném khi `stateVersion` không hợp lệ. */
  register(definition: ProjectionDefinition<SessionStatsState, SessionStatsProjection>): unknown;
}

/** Context cordis mà plugin này dùng, khai theo CẤU TRÚC: một seam, không import gói seam nào. */
export interface SessionStatsContext {
  /** Sổ chiếu phiên — mục đích DUY NHẤT của plugin này. */
  readonly sessionProjections: SessionProjectionsSeam;
}
