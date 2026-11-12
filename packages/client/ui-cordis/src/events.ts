/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Từ vựng dữ liệu của Cordis động (thay cho phần re-export type của gói gốc): id, dòng inventory, lần chạy, hoạt động, gói đã nạp và lỗi — hình dạng giữ nguyên như bản gốc
 */

/** Id một Plugin động. */
export type CordisDynamicPluginId = string;

/** Id một Package bất biến của Plugin. */
export type CordisDynamicPackageId = string;

/** Id một lần chạy Package. */
export type CordisDynamicPluginRunId = string;

/** Id một yêu cầu phê duyệt. */
export type ApprovalRequestId = string;

/** Chế độ chạy: lần đầu hay cập nhật Package đang chạy. */
export type CordisDynamicRunMode = "run" | "update";

/** Id một phiên. */
export type SessionId = string;

/** Một Package BẤT BIẾN trong một dòng Plugin. */
export interface DynamicCordisPackage {
  /** Id bất biến của Package. */
  readonly packageId: CordisDynamicPackageId;
  /** Tên hiển thị. */
  readonly name: string;
  /** Câu mô tả mục đích. */
  readonly purpose: string;
  /** Có nửa client (bundle trình duyệt) hay không. */
  readonly hasClientHalf: boolean;
}

/** Một lần chạy (attempt) của Plugin như Host báo. */
export interface CordisRunAttempt {
  /** Id lần chạy. */
  readonly pluginRunId: CordisDynamicPluginRunId;
  /** Package được chạy. */
  readonly packageId: CordisDynamicPackageId;
  /** Trạng thái: `awaiting-approval`, `failed`, ... */
  readonly status: string;
  /** Lỗi của lần chạy (khi hỏng). */
  readonly error?: { readonly message: string; readonly phase: string } | undefined;
  /** Yêu cầu phê duyệt đang chờ (khi trạng thái là `awaiting-approval`). */
  readonly approvalRequestId?: ApprovalRequestId | undefined;
}

/** Một dòng inventory của Host: một Plugin cùng các Package và lần chạy của nó. */
export interface DynamicCordisInventoryRow {
  /** Id Plugin. */
  readonly pluginId: CordisDynamicPluginId;
  /** Id agent đã định nghĩa Plugin. */
  readonly agentId: string;
  /** Các Package bất biến, theo thứ tự Host gửi. */
  readonly packages: readonly DynamicCordisPackage[];
  /** Lần chạy đang hoạt động (nếu có). */
  readonly activeRun?: {
    readonly pluginRunId: CordisDynamicPluginRunId;
    readonly packageId: CordisDynamicPackageId;
  } | undefined;
  /** Package hiện hành. */
  readonly currentPackageId?: CordisDynamicPackageId | undefined;
  /** Package kế tiếp đang chờ chuyển. */
  readonly nextPackageId?: CordisDynamicPackageId | undefined;
  /** Lần chạy gần nhất. */
  readonly latestRun?: CordisRunAttempt | undefined;
}

/** Hoạt động chạy do runner phía client giữ cho một Plugin. */
export interface CordisRunActivity {
  /** Id Plugin. */
  readonly pluginId: CordisDynamicPluginId;
  /** Package đang chạy. */
  readonly packageId: CordisDynamicPackageId;
  /** Id agent sở hữu. */
  readonly agentId: string;
  /** Chế độ chạy. */
  readonly mode: CordisDynamicRunMode;
  /** Pha hiện tại: `awaiting-approval`, `orchestrating`, ... */
  readonly phase: string;
  /** Id yêu cầu phê duyệt của pha này. */
  readonly requestId: ApprovalRequestId;
  /** Tên Package (dùng khi chưa đọc được inventory). */
  readonly name: string;
  /** Mục đích Package (dùng khi chưa đọc được inventory). */
  readonly purpose: string;
}

/** Một gói client đã nạp trong TRANG NÀY. */
export interface DynamicCordisLivePackage {
  /** Id Plugin. */
  readonly pluginId: CordisDynamicPluginId;
  /** Id Package. */
  readonly packageId: CordisDynamicPackageId;
  /** Id lần chạy đã nạp. */
  readonly pluginRunId: CordisDynamicPluginRunId;
}

/** Lỗi của lần chạy gần nhất. */
export interface CordisRunFailure {
  /** Câu lỗi. */
  readonly message: string;
  /** Lý do/mã. */
  readonly reason: string;
}

/** Lỗi render của một slot do Package động chiếm. */
export interface DynamicCordisRenderFailure {
  /** Tên slot hỏng. */
  readonly slot: string;
  /** Guard đã trả slot về UI mặc định hay vẫn giữ slot của plugin. */
  readonly abdicated: boolean;
  /** Câu lỗi. */
  readonly message: string;
}

/** Yêu cầu chạy do người dùng phát. */
export interface CordisUserRunRequest {
  /** Agent sở hữu Plugin. */
  readonly agentId: string;
  /** Plugin cần chạy. */
  readonly pluginId: CordisDynamicPluginId;
  /** Package cần chạy. */
  readonly packageId: CordisDynamicPackageId;
  /** Chế độ chạy. */
  readonly mode: CordisDynamicRunMode;
  /** Package có nửa client hay không. */
  readonly hasClientHalf: boolean;
}

/** Sự kiện `cordis/request-run` mà trang nghe. */
export interface DynamicCordisRunRequest {
  /** Plugin được yêu cầu chạy. */
  readonly pluginId: CordisDynamicPluginId;
}

/** Nguồn đọc (observable) của ui-slots: giá trị chụp + đăng ký nghe. */
export interface HostObservable<T> {
  /**
   * Đọc bản chụp hiện tại.
   * Nhận: không.
   * Trả: giá trị chụp (ổn định theo tham chiếu cho tới lần phát kế tiếp).
   */
  getSnapshot(): T;
  /**
   * Nghe thay đổi.
   * Nhận: hàm được gọi mỗi lần giá trị đổi.
   * Trả: hàm gỡ đăng ký.
   */
  subscribe(listener: () => void): () => void;
}

/** Kết quả một thao tác vòng đời do panel phát. */
export type CordisActionResult = { readonly ok: true } | { readonly ok: false; readonly message: string };
