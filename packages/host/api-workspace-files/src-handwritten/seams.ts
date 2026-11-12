/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mặt cắt SEAM của dịch vụ tệp workspace, khai theo CẤU TRÚC (không `declare module` nào — luật
 *      000d): filesystem của kernel (`ctx.fs`), chính sách sandbox (`ctx.sandboxPolicy`), sổ phiên
 *      (`ctx.sessions`), sổ tra cứu Typert (`ctx.typert.lookups`), cùng `inject`/`on`/`effect`/`logger`/`get`.
 */

import type { RemoteError } from "@deepseek-ai/dsh-typert-protocol";

/** Đích đã giải của filesystem (khoá dùng làm danh tính, không đọc trường nào). */
export interface FsTarget {
  /** Khoá đích do backend cấp. */
  readonly targetKey: string;
}

/** Thông tin MỘT mục của filesystem. */
export interface FsInfo {
  /** Loại của đích. */
  readonly type: "file" | "directory" | "symlink" | "other";
  /** Dấu độ tươi KHÔNG trong suốt. */
  readonly version: string;
  /** Cỡ byte, khi backend báo. */
  readonly size?: number;
}

/** MỘT mục của thư mục do backend trả. */
export interface FsDirEntry {
  /** Tên (basename). */
  readonly name: string;
  /** Loại của ĐÍCH (symlink báo loại đích). */
  readonly type: "file" | "directory" | "other";
  /** Cỡ byte, khi backend báo. */
  readonly size?: number;
}

/** Tham số giải đường dẫn. */
export interface ResolveOptions {
  /** Thư mục gốc để giải đường dẫn tương đối. */
  readonly cwd?: string;
  /** Tín hiệu huỷ. */
  readonly signal?: AbortSignal;
}

/** Seam filesystem của kernel — chỉ những phương thức dịch vụ này chạm tới. */
export interface FsSeam {
  /**
   * Giải một đường dẫn thành đích.
   * Nhận: đường dẫn và tham số giải.
   * Trả: đích đã giải.
   */
  resolve(path: string, opts?: ResolveOptions): Promise<FsTarget>;
  /**
   * Thống kê KHÔNG theo symlink.
   * Nhận: đường dẫn, tham số giải (cwd), tín hiệu.
   * Trả: thông tin, hoặc `undefined` khi không có mục.
   */
  lstat(path: string, opts?: ResolveOptions, signal?: AbortSignal): Promise<FsInfo | undefined>;
  /**
   * Thống kê ĐÍCH (theo symlink).
   * Nhận: đích và tín hiệu.
   * Trả: thông tin, hoặc `undefined` khi không có mục.
   */
  stat(target: FsTarget, signal?: AbortSignal): Promise<FsInfo | undefined>;
  /**
   * Liệt kê con trực tiếp của MỘT thư mục.
   * Nhận: đích thư mục và tín hiệu.
   * Trả: các mục theo thứ tự tên ổn định của backend.
   */
  listDir(target: FsTarget, signal?: AbortSignal): Promise<FsDirEntry[]>;
  /**
   * Đọc cả tệp thành byte, có trần.
   * Nhận: đích, tín hiệu, trần byte.
   * Trả: byte gốc.
   */
  readBytes(target: FsTarget, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array>;
  /**
   * Đọc MỘT cửa sổ byte.
   * Nhận: đích, cửa sổ, tín hiệu.
   * Trả: byte của cửa sổ.
   */
  readByteRange(
    target: FsTarget,
    range: { readonly offset: number; readonly length: number },
    signal?: AbortSignal,
  ): Promise<Uint8Array>;
  /**
   * Mở luồng VĂN BẢN (giải mã và từ chối byte không phải UTF-8 khi đi).
   * Nhận: đích và tín hiệu.
   * Trả: luồng mẩu văn bản.
   */
  streamText(target: FsTarget, signal?: AbortSignal): Promise<AsyncIterable<string>>;
  /**
   * Theo dõi MỘT đích.
   * Nhận: đích, callback thay đổi (kèm lỗi nếu có), tín hiệu.
   * Trả: hàm bỏ theo dõi.
   */
  watch(target: FsTarget, changed: (error?: Error) => void, signal: AbortSignal): Promise<() => Promise<void>>;
  /**
   * Đích `parent` có CHỨA `child` hay không.
   * Nhận: hai đích.
   * Trả: true khi chứa.
   */
  contains(parent: FsTarget, child: FsTarget): boolean;
  /**
   * URL `file:` của một đích.
   * Nhận: đích.
   * Trả: URL dạng chuỗi.
   */
  fileUrl(target: FsTarget): string;
  /**
   * Đường dẫn hiển thị của một đích trong thế giới thi hành.
   * Nhận: đích.
   * Trả: đường dẫn tuyệt đối.
   */
  processPath(target: FsTarget): string;
}

/** Seam chính sách sandbox — chỉ gốc workspace. */
export interface SandboxPolicySeam {
  /** Gốc workspace đã cấu hình. */
  readonly workspaceRoot: string;
}

/** Đầu mục phiên cần cho tra cứu gốc workspace. */
export interface SessionHeaderLike {
  /** Thư mục làm việc đã cam kết của phiên (nếu có). */
  readonly cwd?: string;
}

/** MỘT phiên sống trong sổ phiên. */
export interface SessionLike {
  /** Đầu mục của phiên. */
  readonly header: SessionHeaderLike;
}

/** Seam sổ phiên của kernel. */
export interface SessionsSeam {
  /**
   * Lấy MỘT phiên theo id.
   * Nhận: id phiên (chuỗi đã thương hiệu).
   * Trả: phiên, hoặc `undefined`.
   */
  get(id: string): SessionLike | undefined;
}

/** Tham số đăng ký MỘT bộ tra cứu Typert. */
export interface LookupRegistration<Scope> {
  /** Tên tham số nguồn trong chữ ký Remote. */
  readonly parameter: string;
  /** Tên tham số DÂY. */
  readonly wire: string;
  /** Loại tài nguyên mà bộ tra cứu phục vụ. */
  readonly resource: string;
  /** Ký hiệu kiểu Host. */
  readonly hostTypeSymbol: string;
  /** Ký hiệu kiểu dây. */
  readonly wireTypeSymbol: string;
  /**
   * Giải id trên dây thành phạm vi.
   * Nhận: id phiên.
   * Trả: phạm vi, hoặc `undefined` khi không giải được.
   */
  resolve(id: never): Promise<Scope | undefined>;
}

/** Seam sổ tra cứu Typert. */
export interface TypertLookupsSeam {
  /**
   * Đăng ký MỘT bộ tra cứu.
   * Nhận: tên bộ tra cứu và mô tả đăng ký.
   * Trả: hàm dọn (hoặc giá trị do kernel trả).
   */
  register<Scope>(name: string, registration: LookupRegistration<Scope>): unknown;
}

/** Seam Typert của kernel. */
export interface TypertSeam {
  /** Sổ tra cứu. */
  readonly lookups: TypertLookupsSeam;
}

/** Context CON do `inject` cấp. */
export interface InjectedScope {
  /** Sổ phiên. */
  readonly sessions: SessionsSeam;
  /** Sổ tra cứu Typert. */
  readonly typert: TypertSeam;
  /** Chính sách sandbox. */
  readonly sandboxPolicy: SandboxPolicySeam;
  /**
   * Lấy MỘT service tuỳ chọn theo khoá.
   * Nhận: khoá service.
   * Trả: service, hoặc `undefined` khi vắng.
   */
  get(key: string): { stat(id: string): Promise<{ header: SessionHeaderLike } | undefined> } | undefined;
}

/** Context của plugin mà dịch vụ này chạm tới. */
export interface WorkspaceFilesContext {
  /** Seam filesystem. */
  readonly fs: FsSeam;
  /** Seam chính sách sandbox. */
  readonly sandboxPolicy: SandboxPolicySeam;
  /** Log của kernel. */
  readonly logger: {
    /**
     * Ghi MỘT lỗi.
     * Nhận: lỗi.
     * Trả: không.
     */
    error(error: unknown): void;
  };
  /**
   * Nghe MỘT sự kiện của kernel.
   * Nhận: tên sự kiện `fs/observed` và listener.
   * Trả: hàm dọn.
   */
  on(event: "fs/observed", listener: (target: FsTarget, observation: unknown) => void): unknown;
  /**
   * Đăng ký MỘT hiệu ứng dọn thuộc fiber này.
   * Nhận: hàm dựng callback dọn, và nhãn.
   * Trả: hàm dọn của đăng ký.
   */
  effect(callback: () => () => Promise<void> | void, label: string): () => void;
  /**
   * Tiêm phụ thuộc: chờ service có mặt rồi chạy callback trên context con.
   * Nhận: danh sách khoá service, và callback nhận context con.
   * Trả: giá trị do kernel trả về.
   */
  inject(deps: string[], callback: (scope: InjectedScope) => void): unknown;
}

/** Kiểu lỗi Remote dùng lại cho chữ ký (tránh import giá trị ở file chỉ-khai-báo). */
export type RemoteErrorLike = RemoteError;
