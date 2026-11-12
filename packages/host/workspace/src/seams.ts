/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bốn SEAM mà sổ đăng ký gọi vào, khai theo CẤU TRÚC (không `import` gói nào ngoài bảng §3b):
 *      bảng KV của miền · facility miền (`ctx.storageDomain`) · session persistence
 *      (`ctx.sessionPersistence`) · sổ phiên SỐNG (`ctx.get("sessions")`). Mỗi khai báo chỉ chứa
 *      ĐÚNG phần mà gói này chạm tới — stub rộng hơn thật là che lỗi.
 */
import type { WorkspaceDomainState, WorkspaceRecord } from "./spec.ts";
import type { SessionActivity, SessionHeaderLike, SessionId, WorkspaceId } from "./types.ts";

/**
 * Một bảng KV của miền đã mở, ở đúng bốn phép mà sổ đăng ký dùng. `K` là kiểu khoá PHANTOM (thương
 * hiệu lúc biên dịch); trên môi trường lưu khoá là chuỗi trơn.
 */
export interface KvTableLike<K extends string, V> {
  /**
   * Đọc ĐỒNG BỘ một bản ghi từ trạng thái trong bộ nhớ của miền.
   * Nhận: khoá.
   * Trả: bản ghi, hoặc `undefined` khi vắng.
   */
  get(key: K): V | undefined;
  /**
   * Ghi một bản ghi mới.
   * Nhận: khoá và giá trị.
   * Trả: promise phân giải sau khi BỀN.
   */
  put(key: K, value: V): Promise<void>;
  /**
   * Sửa một bản ghi ĐÃ CÓ trên chuỗi ghi của miền.
   * Nhận: khoá và hàm nhận giá trị hiện tại trả giá trị kế (NÉM để huỷ lượt ghi).
   * Trả: promise của giá trị đã ghi bền.
   */
  update(key: K, fn: (current: V) => V): Promise<V>;
  /**
   * Xoá một bản ghi; vắng sẵn thì trả `false`.
   * Nhận: khoá.
   * Trả: promise của cờ "đã xoá thật".
   */
  delete(key: K): Promise<boolean>;
  /** Số bản ghi hiện có (đọc đồng bộ từ bộ nhớ của miền). */
  readonly size: number;
  /**
   * Ảnh chụp cặp khoá/giá trị.
   * Nhận: không.
   * Trả: iterator của các cặp, theo thứ tự chèn.
   */
  entries(): IterableIterator<[K, V]>;
  /**
   * Ảnh chụp khoá.
   * Nhận: không.
   * Trả: iterator của các khoá, theo thứ tự chèn.
   */
  keys(): IterableIterator<K>;
}

/** Ô singleton toàn cục của miền đã mở. */
export interface DomainGlobalLike {
  /**
   * Đọc giá trị global (đồng bộ, từ bộ nhớ của miền).
   * Nhận: không.
   * Trả: giá trị hiện tại — `initial` khi môi trường lưu chưa từng có global.
   */
  get(): WorkspaceDomainState;
  /**
   * Ghi giá trị global một cách BỀN.
   * Nhận: giá trị kế.
   * Trả: promise phân giải sau khi bền.
   */
  set(value: WorkspaceDomainState): Promise<void>;
}

/** Một miền ĐÃ MỞ, ở đúng ba bề mặt mà sổ đăng ký dùng. */
export interface WorkspaceDomainLike {
  /** Handle của bảng `workspaces`. */
  table(name: "workspaces"): KvTableLike<WorkspaceId, WorkspaceRecord>;
  /** Handle ô singleton. */
  readonly global: DomainGlobalLike;
  /**
   * Đóng miền: từ chối lượt ghi MỚI ngay, xả các lượt đã xếp hàng, rồi nhả đơn vị backend.
   * Nhận: không.
   * Trả: promise phân giải khi miền đã đóng (idempotent).
   */
  close(): Promise<void>;
}

/** Facility miền (`ctx.storageDomain`): mở một miền đã khai. */
export interface StorageDomainFacility {
  /**
   * Mở MỘT miền đã khai trên backend theo tuyến.
   * Nhận: spec của miền.
   * Trả: promise của handle miền đã mở.
   */
  open(spec: object): Promise<WorkspaceDomainLike>;
}

/** Một mục của `sessionPersistence.list()` ở đúng phần mà gói này đọc. */
export interface SessionPersistenceEntryLike {
  /** Header phiên của mục đã lưu. */
  readonly header: SessionHeaderLike;
}

/** Session persistence (`ctx.sessionPersistence`): nguồn header của các phiên ĐÃ LƯU. */
export interface SessionPersistenceFacility {
  /**
   * Liệt kê ảnh chụp mọi phiên đã lưu.
   * Nhận: không.
   * Trả: promise của các mục đã lưu.
   */
  list(): Promise<readonly SessionPersistenceEntryLike[]>;
}

/** Một phiên ĐANG SỐNG ở đúng phần mà gói này đọc. */
export interface LiveSessionLike {
  /** Header của phiên đang sống. */
  readonly header: SessionHeaderLike;
}

/** Sổ phiên ĐANG SỐNG (`ctx.get("sessions")`); VẮNG được (headless không có phiên nào). */
export interface SessionsFacility {
  /**
   * Tra một phiên đang sống.
   * Nhận: id phiên.
   * Trả: phiên, hoặc `undefined` khi không có.
   */
  get(id: SessionId): LiveSessionLike | undefined;
  /**
   * Liệt kê mọi phiên đang sống.
   * Nhận: không.
   * Trả: mảng phiên.
   */
  list(): readonly LiveSessionLike[];
}

/** Logger của kernel, ở đúng một phép mà gói này dùng. */
export interface LoggerLike {
  /**
   * Ghi một dòng CẢNH BÁO.
   * Nhận: thông điệp đã định dạng sẵn.
   * Trả: không.
   */
  warn(message: string): void;
}

/**
 * Context cordis nhìn qua ĐÚNG bề mặt mà sổ đăng ký gọi. Vì sao ép kiểu ở đúng ranh giới này thay vì
 * augment `Context`/`Events` của cordis: augment sẽ ĐÈ kiểu thật của gói khác trong cùng chương trình
 * `tsc` (TS2717 — lớp lỗi 000d), mà gói này lại không ship `.d.ts` nên augment không mang lại gì.
 */
export interface WorkspaceRegistryContext {
  /**
   * Đăng ký một hiệu ứng sống theo vòng đời fiber.
   * Nhận: hàm dựng trả hàm dọn, và nhãn chẩn đoán.
   * Trả: hàm dọn.
   */
  effect(execute: () => () => unknown, label?: string): () => void;
  /**
   * Tra một dịch vụ ĐÃ CÓ (không chờ).
   * Nhận: tên dịch vụ.
   * Trả: dịch vụ, hoặc `undefined`.
   */
  get(name: string): unknown;
  /**
   * Chạy waterfall của một sự kiện, với giá trị mặc định khi không listener nào.
   * Nhận: tên sự kiện, tham số, và hàm `next` trả giá trị mặc định.
   * Trả: promise của tập hoạt động mà các provider báo về.
   */
  waterfall(
    name: string,
    request: { readonly sessionId: SessionId },
    next: () => Promise<readonly SessionActivity[]>,
  ): Promise<readonly SessionActivity[]>;
  /**
   * Chạy song song mọi listener của một sự kiện.
   * Nhận: tên sự kiện và tham số.
   * Trả: promise phân giải khi mọi listener xong; NÉM `AggregateError` khi có listener hỏng.
   */
  parallel(name: string, request: { readonly sessionId: SessionId }): Promise<unknown>;
  /** Facility miền bắt buộc (kernel cấp đúng một thể hiện). */
  readonly storageDomain: StorageDomainFacility;
  /** Session persistence bắt buộc (kernel cấp đúng một thể hiện). */
  readonly sessionPersistence: SessionPersistenceFacility;
  /** Logger của kernel. */
  readonly logger: LoggerLike;
}
