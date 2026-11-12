/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hợp đồng KIỂU của seam chiếu phiên: bảng kiểu hai chiều (mở rộng bằng declare-merge), đơn vị
 *      chiếu `ProjectionDefinition`, ảnh chụp `ProjectionSnapshot`, dòng checkpoint và kênh thay đổi.
 *      Phiên/sự kiện của kernel khai theo CẤU TRÚC (không import @deepseek-ai/dsh-session).
 */

import type { SessionLogOffset, SessionSeq, SessionSeqCursor } from "./brand.ts";

/** Schema của một đơn vị chiếu: seam CHỈ gọi `parse` (zod/schemastery/… đều khớp hình dạng này). */
export interface ProjectionSchema<T> {
  /**
   * Kiểm và chuẩn hoá một giá trị.
   * Nhận: giá trị chưa biết — trạng thái đã lưu hoặc khung nhìn vừa dựng.
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
   * Trả: khung nhìn sẽ phát cho Client.
   */
  view(state: State): View;
}

/** Metadata bất biến của một phiên: seam này CHỈ chuyền tay cho `init`, KHÔNG đọc trường nào. */
export type SessionHeaderLike = unknown;

/** Một sự kiện ĐÃ CAM KẾT của log phiên — chỉ hai trường mà seam này dùng. */
export interface SessionEventLike {
  /** Vị trí của sự kiện trong log. */
  readonly seq: SessionSeq;
  /** Loại sự kiện (do phép gộp của từng miền tự diễn giải). */
  readonly type: string;
}

/** Một phiên đang sống — chỉ phần mà sổ chiếu gọi tới (khai theo CẤU TRÚC). */
export interface ProjectedSession {
  /** Số sự kiện đã cam kết (con trỏ của phiên). */
  readonly seq: SessionLogOffset;
  /** Metadata bất biến của phiên. */
  readonly header: SessionHeaderLike;
  /** Độ dài tiền tố thừa kế từ phiên nguồn khi fork. */
  readonly inheritedEventCount: SessionLogOffset;
  /**
   * Cắt một đoạn log trong bộ nhớ.
   * Nhận: seq bắt đầu (mặc định 0) và seq KẾT THÚC KHÔNG TÍNH.
   * Trả: các sự kiện trong khoảng, đúng thứ tự seq.
   */
  snapshotEvents(fromSeq?: SessionLogOffset, toSeqExclusive?: SessionLogOffset): readonly SessionEventLike[];
  /**
   * Tra một sự kiện theo seq.
   * Nhận: seq cần tra.
   * Trả: sự kiện tại seq đó, hoặc `undefined` khi seq nằm ngoài log.
   */
  eventAt(seq: SessionSeq): SessionEventLike | undefined;
}

/**
 * Bảng chiếu phía Client, MỞ RỘNG ĐƯỢC: gói miền declare-merge khoá của mình vào đây.
 * Giá trị là JSON toàn phần; cách vẽ nó là việc của hệ slot, không phải của tầng này.
 */
export interface SessionProjectionMap {}

/**
 * Bảng trạng thái phép gộp phía Host, MỞ RỘNG ĐƯỢC: mỗi khoá hiện cho Client cũng có mặt ở
 * {@link SessionProjectionMap}; khoá chỉ-host chỉ có ở đây. Giá trị phải là JSON thuần.
 */
export interface SessionProjectionStateMap {}

/**
 * Một đơn vị chiếu của một miền: phép gộp ĐỒNG BỘ THUẦN + khai báo + khung nhìn tuỳ chọn.
 * Mọi hàm PHẢI đồng bộ (đơn vị bất đồng bộ sẽ xé phép cắt nhất quán của bên mang), và `state`
 * PHẢI là JSON thuần (điều kiện tiên quyết của kho checkpoint).
 */
export interface ProjectionDefinition<State, View = never> {
  /** Khoá chiếu mà đơn vị này sở hữu. */
  readonly key: string;
  /** Kiểm trạng thái đã lưu TRƯỚC khi nó mồi phép gộp. */
  readonly stateSchema: ProjectionSchema<State>;
  /**
   * Trạng thái cho log rỗng và metadata bất biến của phiên.
   * Nhận: header phiên và độ dài tiền tố thừa kế khi fork.
   * Trả: trạng thái ban đầu.
   */
  init(header: SessionHeaderLike, inheritedEventCount: SessionLogOffset): State;
  /**
   * Phép chuyển THUẦN: trạng thái trước + một sự kiện đã cam kết ⇒ trạng thái sau.
   * Đơn vị không quan tâm sự kiện PHẢI trả LẠI CHÍNH tham chiếu cũ — tham chiếu không đổi
   * (`Object.is`) nghĩa là không có việc gì phía sau.
   * Nhận: trạng thái phủ mọi sự kiện trước, và sự kiện kế tiếp.
   * Trả: trạng thái sau (cùng tham chiếu khi sự kiện không phải của đơn vị này).
   */
  apply(state: State, event: SessionEventLike): State;
  /** Khung nhìn cho Client; BỎ TRỐNG với đơn vị chỉ-host. */
  readonly wire?: ProjectionWire<State, View>;
  /** Phiên bản làm mới kho checkpoint: tăng mỗi khi trường trạng thái hoặc ngữ nghĩa gộp đổi. */
  readonly stateVersion: number;
}

/** Người nghe kênh thay đổi: một đơn vị vừa đổi khung nhìn THÔ theo `Object.is`. */
export type ProjectionChangeListener = (
  session: ProjectedSession,
  key: string,
  value: unknown,
  seq: SessionSeq,
) => void;

/** Một phép cắt nhất quán trên MỌI đơn vị hiện cho Client của MỘT phiên. */
export interface ProjectionSnapshot {
  /** Seq của sự kiện cuối mà mọi giá trị phản ánh; `-1` với log rỗng. */
  readonly asOfSeq: SessionSeqCursor;
  /** Giá trị toàn phần theo từng khoá đã đăng ký. */
  readonly values: Record<string, unknown>;
}

/** Một dòng checkpoint của MỘT đơn vị: trạng thái, seq đã gộp, và `stateVersion` đã sinh ra nó. */
export interface ProjectionCheckpointRow {
  /** `stateVersion` của đơn vị đã đăng ký LÚC gộp. */
  readonly ver: number;
  /** Seq của sự kiện cuối đã gộp vào `val`; `-1` với log rỗng. */
  readonly seq: SessionSeqCursor;
  /** Trạng thái nội bộ của đơn vị — JSON thuần theo hợp đồng đơn vị. */
  readonly val: unknown;
}

/** Các dòng checkpoint theo khoá chiếu (giá trị kho checkpoint đã lưu của MỘT phiên). */
export type ProjectionCheckpoint = Record<string, ProjectionCheckpointRow>;
