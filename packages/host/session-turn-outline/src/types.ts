/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng của miền "dàn bài lượt" — vật thể của phép gộp và các seam mà row này chạm, khai
 *      theo CẤU TRÚC (không import gói seam nào): seam `sessionProjections` do
 *      @deepseek-ai/dsh-session-projection cấp, sự kiện phiên do @deepseek-ai/dsh-session cấp.
 */

import type { SessionSeq } from "./brand.ts";

/** Một khối nội dung của tin — khai theo CẤU TRÚC: chỉ khối `text` mang văn bản. */
export interface ContentBlock {
  /** Loại khối; mọi loại khác `text` bị bỏ qua khi dựng bản xem trước. */
  readonly type: string;
  /** Văn bản của khối — chỉ đọc SAU khi đã xác nhận `type === "text"`. */
  readonly text: string;
}

/** Một sự kiện phiên đã cam kết, khai theo CẤU TRÚC: chỉ phần phép gộp này đọc. */
export interface SessionEvent {
  /** Loại sự kiện (`turn/start` · `user/message` · `assistant/message` · `turn/end` · …). */
  readonly type: string;
  /** Vị trí của sự kiện trong log phiên — mốc nạp-lùi của một lần nhảy lượt. */
  readonly seq: SessionSeq;
  /** Dữ liệu sự kiện; từng nhánh `switch` tự khai hình dạng nó đọc. */
  readonly data: unknown;
}

/** Dữ liệu của `turn/start`: số lượt do chủ log cấp. */
export interface TurnStartData {
  /** Số lượt (tăng dần theo log). */
  readonly turn: number;
}

/** Dữ liệu của `user/message`: nguồn phát và các khối nội dung. */
export interface UserMessageData {
  /** Nguồn phát tin; chỉ `kind === "user"` là prompt người dùng. */
  readonly source: {
    /** Loại nguồn (`user` · `agent` · …). */
    readonly kind: string;
  };
  /** Các khối nội dung của tin. */
  readonly content: readonly ContentBlock[];
}

/** Dữ liệu của `assistant/message`: tin của mô hình. */
export interface AssistantMessageData {
  /** Tin đã cam kết. */
  readonly message: {
    /** Các khối nội dung của tin. */
    readonly content: readonly ContentBlock[];
  };
}

/** Sự thật dàn bài của MỘT lượt đã bắt đầu, độc lập với phần client đã nạp. */
export interface TurnOutlineEntry {
  /** Số lượt do host cấp (payload của `turn/start`). */
  readonly turn: number;
  /** Seq của `turn/start` của lượt — nạp một cửa sổ lùi qua seq này là nạp TRỌN lượt. */
  readonly seq: SessionSeq;
  /** Bản xem trước prompt người dùng đầu tiên (một dòng thẻ ray); `""` tới khi có prompt hợp lệ. */
  readonly prompt: string;
  /** Bản xem trước phản hồi cuối (tối đa ba dòng thẻ ray); `""` tới khi lượt kết thúc bằng chữ của mô hình. */
  readonly response: string;
}

/**
 * Trạng thái phép gộp: các mục đã phục vụ + bản nháp phản hồi của lượt đang mở. Bản nháp đệm tin
 * trợ lý MỚI NHẤT có chữ cho tới khi `turn/end` cam kết nó, và khung nhìn trên dây chỉ chiếu
 * `turns` — nhánh chỉ-đổi-nháp giữ NGUYÊN danh tính mảng đó nên kênh thay đổi im giữa hai mốc lượt.
 */
export interface TurnOutlineState {
  /** Các lượt đã bắt đầu, tăng dần theo số lượt. */
  readonly turns: readonly TurnOutlineEntry[];
  /** Bản xem trước chữ của tin trợ lý mới nhất trong lượt đang mở; `""` khi ngoài lượt. */
  readonly draft: string;
}

/** Schema của seam: seam thật CHỈ gọi `parse` trước khi mồi phép gộp và trước khi phát khung nhìn. */
export interface OutlineSchema<T> {
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
  readonly viewSchema: OutlineSchema<View>;
  /**
   * Chiếu trạng thái phép gộp thành khung nhìn trên dây.
   * Nhận: trạng thái đã gộp.
   * Trả: khung nhìn sẽ phát; giữ NGUYÊN danh tính mảng khi chỉ bản nháp đổi.
   */
  view(state: State): View;
}

/** Một đơn vị chiếu host-only mà seam `sessionProjections` nhận. */
export interface ProjectionDefinition<State, View> {
  /** Khoá chiếu; bản gốc dùng `turnOutline`. */
  readonly key: string;
  /** Phiên bản trạng thái lưu; bản gốc dùng `2`. */
  readonly stateVersion: number;
  /** Schema kiểm trạng thái đã lưu trước khi mồi phép gộp. */
  readonly stateSchema: OutlineSchema<State>;
  /**
   * Trạng thái cho log rỗng.
   * Nhận: không.
   * Trả: trạng thái rỗng — bản gốc dùng CHUNG một vật thể cho mọi phiên.
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
  /** Đăng ký một đơn vị chiếu; seam thật ném khi `stateVersion` không phải số nguyên ≥ 0. */
  register(definition: ProjectionDefinition<TurnOutlineState, readonly TurnOutlineEntry[]>): unknown;
}

/** Context cordis mà plugin này dùng, khai theo CẤU TRÚC: một seam, không import gói seam nào. */
export interface TurnOutlineContext {
  /** Sổ chiếu phiên — mục đích DUY NHẤT của plugin này. */
  readonly sessionProjections: SessionProjectionsSeam;
}
