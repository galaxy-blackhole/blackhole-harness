/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hợp đồng KIỂU của cache chiếu phiên, khai theo CẤU TRÚC: phiên/sự kiện/header của kernel,
 *      bề mặt sổ chiếu (`ctx.sessionProjections`), sổ phiên (`ctx.sessions`), miền lưu trữ
 *      (`ctx.storageDomain`) và bảng checkpoint. KHÔNG import gói seam nào ⇒ không có khai báo ambient
 *      nào (luật 000d) và không cần peer ngoài bảng §3b cho ba bề mặt này.
 */

import type { SessionSeqCursor } from "./brand.ts";

/** Metadata BẤT BIẾN của một phiên: phần mà cache dùng làm nhân dạng vòng đời. */
export interface SessionHeader {
  /** Id phiên — một id đặt tên một CHỖ, không đặt tên một vòng đời. */
  readonly id: string;
  /** Thế hệ định dạng log phiên (`SessionHeader.version` của kernel). */
  readonly version: number;
  /** Mốc tạo phiên (ms) — bất biến suốt vòng đời. */
  readonly createdAt: number;
  /** Thư mục làm việc lúc tạo phiên (vắng khi phiên không ghi). */
  readonly cwd?: string;
  /** Phiên có mang tiền tố log thừa kế từ phiên nguồn hay không (fork). */
  readonly isSeeded: boolean;
}

/** Một sự kiện ĐÃ CAM KẾT của log phiên — chỉ hai trường mà cache đọc. */
export interface SessionEvent {
  /** Loại sự kiện (cache chỉ so với `turn/end`). */
  readonly type: string;
  /** Vị trí của sự kiện trong log. */
  readonly seq: number;
}

/** Một phiên ĐANG SỐNG — chỉ phần mà cache đọc và chuyền tay cho sổ chiếu. */
export interface SessionLike {
  /** Id phiên. */
  readonly id: string;
  /** Metadata bất biến của phiên. */
  readonly header: SessionHeader;
  /** Độ dài tiền tố thừa kế từ phiên nguồn khi fork. */
  readonly inheritedEventCount: number;
}

/** Một phép cắt nhất quán trên MỌI đơn vị chiếu hiện cho Client của MỘT phiên. */
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

/**
 * Bề mặt sổ chiếu mà cache gọi (`ctx.sessionProjections` của kernel). Khai ĐÚNG bốn phương thức mà
 * bản gốc gọi, theo hình dạng của seam `dsh-session-projection`.
 */
export interface SessionProjectionsFacade {
  /**
   * Checkpoint MỨC TRẠNG THÁI của mọi đơn vị được lưu cho một phiên.
   * Nhận: phiên đang sống.
   * Trả: một dòng cho mỗi khoá đã đăng ký (kèm `ver`/`seq`).
   */
  checkpoint(session: SessionLike): ProjectionCheckpoint;
  /**
   * Xem các dòng checkpoint mà KHÔNG đọc log.
   * Nhận: các dòng đã lưu và danh sách khoá dây cần xem (vắng = mọi khoá hiện cho Client).
   * Trả: giá trị toàn phần theo khoá có dòng dùng được; khoá lệch/hỏng/vắng thì VẮNG.
   */
  viewCheckpoint(checkpoint: ProjectionCheckpoint, keys?: readonly string[]): Record<string, unknown>;
  /**
   * Khôi phục ĐÚNG một phép cắt và cài trạng thái của nó lên phiên đã chuẩn bị.
   * Nhận: phiên, các dòng đã lưu, ĐÚNG các sự kiện ở phép cắt, và seq của sự kiện đầu tiên.
   * Trả: mọi giá trị chiếu ở phép cắt được cấp.
   */
  hydrate(
    session: SessionLike,
    checkpoint: ProjectionCheckpoint,
    events: readonly SessionEvent[],
    baseSeq: number,
  ): ProjectionSnapshot;
  /**
   * Đọc LẠNH trên một hậu tố log, mồi mỗi đơn vị từ dòng checkpoint của nó khi dùng được.
   * Nhận: các dòng đã lưu, sự kiện đã lưu từ `baseSeq`, seq bắt đầu, header phiên và độ dài tiền tố.
   * Trả: phép cắt tại điểm cuối log + các dòng checkpoint ĐÃ LÀM MỚI.
   */
  restore(
    checkpoint: ProjectionCheckpoint,
    events: readonly SessionEvent[],
    baseSeq: number,
    header: SessionHeader,
    inheritedEventCount: number,
  ): { snapshot: ProjectionSnapshot; checkpoint: ProjectionCheckpoint };
}

/** Sổ phiên của kernel (`ctx.sessions`) — chỉ hai phương thức mà cache gọi. */
export interface SessionsFacility {
  /**
   * Tra phiên đang sống theo id.
   * Nhận: id phiên.
   * Trả: thể hiện phiên, hoặc `undefined` khi phiên đã đóng.
   */
  get(id: string): unknown;
  /**
   * Ép log của phiên xuống bền TRƯỚC khi dòng cache được ghi (log dẫn, cache theo).
   * Nhận: phiên cần flush.
   * Trả: promise hoàn tất khi dữ liệu đã bền.
   */
  flush(session: SessionLike): Promise<void>;
}

/** Một bảng KV của miền lưu trữ — bản ghi đã kiểm bằng schema của miền. */
export interface StorageTable<Key extends string, Value> {
  /**
   * Đọc một bản ghi từ TRẠNG THÁI TRONG BỘ NHỚ của miền (đồng bộ, không I/O).
   * Nhận: khoá bản ghi.
   * Trả: bản ghi, hoặc `undefined` khi chưa có.
   */
  get(key: Key): Value | undefined;
  /**
   * Ghi bản ghi lên chuỗi ghi của miền (bền trước, bộ nhớ sau).
   * Nhận: khoá và giá trị bản ghi.
   * Trả: promise hoàn tất sau khi bền và phát sự kiện.
   */
  put(key: Key, value: Value): Promise<void>;
}

/** Một miền lưu trữ đã mở. */
export interface StorageDomain {
  /** Đóng miền (giải phóng tay nắm của backend). */
  close(): unknown;
  /**
   * Lấy bảng theo tên đã khai trong spec.
   * Nhận: tên bảng.
   * Trả: tay nắm bảng (đọc đồng bộ + ghi theo chuỗi).
   */
  table<Key extends string, Value>(name: string): StorageTable<Key, Value>;
}

/** Khai báo một bảng của miền: schema kiểm mọi bản ghi ở ranh giới bền. */
export interface DomainTableSpecLike {
  /** Schema (zod) kiểm bản ghi khi đọc/ghi. */
  readonly valueSchema: unknown;
}

/** Khai báo TĨNH của một miền: danh tính, phiên bản, và bố cục bản ghi. */
export interface DomainSpecLike {
  /** Tên miền (đồng thời là tên đơn vị của backend); phải khớp `UNIT_NAME_RE`. */
  readonly name: string;
  /** Phiên bản định dạng hiện tại của miền. */
  readonly version: number;
  /** Phiên bản cũ hơn mà schema bản ghi HIỆN TẠI vẫn đọc được. */
  readonly compatibleVersions?: readonly number[];
  /** Thái độ với bản ghi hỏng schema: chỉ `backup-and-skip` được phép. */
  readonly invalidRecords?: "backup-and-skip";
  /** Bố cục của đơn vị trên medium: `single` (mặc định) hay `per-record`. */
  readonly layout?: "single" | "per-record";
  /** Các bảng đã khai. */
  readonly tables: Record<string, DomainTableSpecLike>;
}

/** Cơ sở lưu trữ miền của kernel (`ctx.storageDomain`). */
export interface StorageDomainFacility {
  /**
   * Mở một miền theo spec (kiểm phiên bản, bố cục, và bản ghi hỏng).
   * Nhận: spec của miền.
   * Trả: promise của miền đã mở.
   */
  open(spec: DomainSpecLike): Promise<StorageDomain>;
}

/** Ghi cảnh báo của kernel (`ctx.logger`). */
export interface LoggerLike {
  /**
   * Ghi một dòng cảnh báo (đường fail-soft của cache dùng chỗ này).
   * Nhận: thông điệp.
   * Trả: không.
   */
  warn(message: string): void;
}

/**
 * Context cordis nhìn qua ĐÚNG phần bề mặt mà dịch vụ này gọi. Vì sao khai theo cấu trúc thay vì
 * augment `Context` của cordis: augment `sessions`/`sessionProjections` bằng kiểu của TA sẽ
 * ĐÈ kiểu thật của `dsh-session`/`dsh-session-projection` trong cùng chương trình `tsc`
 * (TS2717) — đúng lớp lỗi 000d. Một phép ép kiểu ở ĐÚNG MỘT ranh giới thì không lan sang gói nào.
 */
export interface CacheContext {
  /**
   * Đăng ký một hiệu ứng sống theo vòng đời fiber.
   * Nhận: hàm dựng trả hàm dọn, và nhãn.
   * Trả: hàm dọn.
   */
  effect(execute: () => () => void, label?: string): () => void;
  /**
   * Nghe một sự kiện của kernel.
   * Nhận: tên sự kiện và handler.
   * Trả: hàm gỡ listener.
   */
  on(event: string, handler: (...args: never[]) => void): () => void;
  /** Cơ sở lưu trữ miền. */
  readonly storageDomain: StorageDomainFacility;
  /** Sổ chiếu phiên. */
  readonly sessionProjections: SessionProjectionsFacade;
  /** Sổ phiên. */
  readonly sessions: SessionsFacility;
  /** Logger. */
  readonly logger: LoggerLike;
}
