/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Sổ đăng ký plugin động trong PHẠM VI TIẾN TRÌNH: giữ các Plugin cùng phiên bản Package bất biến, mint danh tính đục (plugin, gói, lượt chạy, phê duyệt) và chỉ mục yêu cầu phê duyệt đang chờ.
 */

import type { Fiber } from "@deepseek-ai/cordis";
import type { SessionId } from "@galaxy-blackhole/gbh-session/types";
import type {
  ApprovalRequestId,
  CordisDynamicPackageId,
  CordisDynamicPluginId,
  CordisDynamicPluginRunId,
  CordisDynamicRunMode,
  DynamicCordisRenderFailure,
  DynamicCordisRunAttempt,
} from "./types.ts";

/**
 * Nhận: tham số JSON do nửa Client của chính package này gửi qua dây.
 * Trả: lời hứa với kết quả JSON mà runner chuyển tiếp nguyên vẹn.
 */
export type DynamicCordisHandler = (args: unknown) => Promise<unknown>;

/**
 * Nhận: một lượt kích hoạt đang sống cùng mọi thứ mà việc dọn dẹp của nó sở hữu.
 * Trả: khối gồm danh tính lượt chạy, package, Fiber Host, bảng handler, hàm dọn, lỗi đã báo và phê duyệt khởi nguồn.
 */
export interface DynamicCordisRun {
  /** Danh tính ĐÚNG lượt kích hoạt. */
  pluginRunId: CordisDynamicPluginRunId;
  /** Phiên bản package bất biến đang chạy. */
  packageId: CordisDynamicPackageId;
  /** Fiber nửa Host; vắng với package chỉ có Client. */
  fiber?: Fiber;
  /** Các method Host đang hoạt động. */
  handlers: Map<string, DynamicCordisHandler>;
  /** Hàm dọn của từng lượt đăng ký method. */
  handlerDisposers: (() => void)[];
  /** Lỗi lúc chạy đã gửi tới Agent sở hữu trong lượt kích hoạt này. */
  reportedRuntimeErrors: Set<string>;
  /** Lỗi render cuối cùng quan sát được cho lượt chạy hiện tại của phiên bản này. */
  renderFailure?: DynamicCordisRenderFailure;
  /** Phê duyệt đã khởi đầu lượt chạy này, khi do model điều khiển. */
  startedForRequest?: ApprovalRequestId;
}

/**
 * Nhận: một phiên bản package bất biến do model định nghĩa.
 * Trả: khối metadata cùng hai thân mã nguồn Host/Client (mỗi thân có thể vắng).
 */
export interface DynamicCordisDefinition {
  /** Danh tính package. */
  packageId: CordisDynamicPackageId;
  /** Nhãn của package. */
  name: string;
  /** Mục đích hướng tới người dùng. */
  purpose: string;
  /** Mã nguồn Host. */
  hostCode?: string;
  /** Mã nguồn Client. */
  clientCode?: string;
}

/**
 * Nhận: một thể hiện plugin ổn định chứa các phiên bản package bất biến.
 * Trả: khối gồm danh tính, phiên sở hữu, các phiên bản theo thứ tự define, phê duyệt Client và các con trỏ vòng đời.
 */
export interface DynamicCordisPlugin {
  /** Danh tính ổn định. */
  pluginId: CordisDynamicPluginId;
  /** Phiên sở hữu. */
  sessionId: SessionId;
  /** Các phiên bản theo thứ tự define. */
  packages: Map<CordisDynamicPackageId, DynamicCordisDefinition>;
  /** Các package có nửa Client được người dùng phê duyệt RIÊNG LẺ. */
  approvedClientPackages: Set<CordisDynamicPackageId>;
  /** Một quyết định của người dùng có phê duyệt các phiên bản package TƯƠNG LAI của plugin này hay không. */
  clientVersionUpdatesApproved: boolean;
  /** Phiên bản cuối cùng đã kích hoạt thành công. */
  currentPackageId?: CordisDynamicPackageId;
  /** Phiên bản đích đang hỏng hoặc đang chuyển đổi. */
  nextPackageId?: CordisDynamicPackageId;
  /** Lượt kích hoạt hiện tại. */
  run?: DynamicCordisRun;
  /** Lần thử kích hoạt mới nhất, kể cả phê duyệt và trạng thái hỏng bất đồng bộ. */
  latestRun?: DynamicCordisRunAttempt;
}

/**
 * Nhận: một lượt kích hoạt do model điều khiển đang bị treo.
 * Trả: khối gồm phiên yêu cầu, plugin, package, lượt chạy, chế độ và cờ cần phê duyệt.
 */
export interface DynamicCordisPendingRequest {
  /** Phiên có model yêu cầu lượt kích hoạt này. */
  agentId: SessionId;
  pluginId: CordisDynamicPluginId;
  packageId: CordisDynamicPackageId;
  pluginRunId: CordisDynamicPluginRunId;
  mode: CordisDynamicRunMode;
  /** Yêu cầu này có phải chờ quyết định tường minh của người dùng hay không. */
  requiresApproval: boolean;
}

/**
 * Nhận: yêu cầu mà "define" chấp nhận; nó KHÔNG bao giờ đi qua vận chuyển Remote.
 * Trả: khối gồm phiên sở hữu, lựa chọn plugin (mới hoặc đã có), nhãn, mục đích và mã nguồn của ít nhất một nửa.
 */
export interface DynamicCordisDefineRequest {
  /** Phiên sở hữu plugin. */
  sessionId: SessionId;
  /** Tạo plugin mới hoặc nối vào plugin đã có. */
  plugin:
    | {
        kind: "new";
        idPrefix: string;
      }
    | {
        kind: "existing";
        pluginId: CordisDynamicPluginId;
      };
  /** Nhãn của package. */
  name: string;
  /** Mục đích hướng tới người dùng. */
  purpose: string;
  /** Ít nhất một nửa mã nguồn. */
  code: {
    host?: string;
    client?: string;
  };
}

/**
 * Nhận: kết quả THÀNH CÔNG của "define".
 * Trả: khối biên nhận gồm danh tính plugin, package, nhãn, mục đích và hai cờ có nửa Host/Client.
 */
export interface DynamicCordisDefineReceipt {
  pluginId: CordisDynamicPluginId;
  packageId: CordisDynamicPackageId;
  name: string;
  purpose: string;
  hasHostHalf: boolean;
  hasClientHalf: boolean;
}

/**
 * Nhận: một tham chiếu "@pluginId" tường minh của người dùng.
 * Trả: ngữ cảnh sửa KHÔNG kèm mã nguồn: danh tính, nhãn, mục đích, các con trỏ phiên bản và lần thử mới nhất.
 */
export interface DynamicCordisReference {
  pluginId: CordisDynamicPluginId;
  packageId: CordisDynamicPackageId;
  name: string;
  purpose: string;
  currentPackageId?: CordisDynamicPackageId;
  nextPackageId?: CordisDynamicPackageId;
  activeRun?: {
    pluginRunId: CordisDynamicPluginRunId;
    packageId: CordisDynamicPackageId;
  };
  latestRun?: DynamicCordisRunAttempt;
}

/**
 * Nhận: một plugin cần tự kiểm tra theo lớp.
 * Trả: bản tóm tắt KHÔNG kèm mã nguồn, kèm danh sách tóm tắt các package bất biến theo thứ tự define.
 */
export interface DynamicCordisPluginInspection extends DynamicCordisReference {
  /** Tóm tắt các package bất biến theo thứ tự define. */
  packages: Array<{
    packageId: CordisDynamicPackageId;
    name: string;
    purpose: string;
    hasHostHalf: boolean;
    hasClientHalf: boolean;
  }>;
}

/**
 * Nhận: một package bất biến cần kiểm tra tường minh.
 * Trả: metadata chính xác cùng mã nguồn Host/Client đã lưu cho package đó, và các con trỏ vòng đời của plugin.
 */
export interface DynamicCordisPackageInspection extends DynamicCordisReference {
  /** Thân hàm Host và Client đã lưu cho package này. */
  code: {
    host?: string;
    client?: string;
  };
}

/**
 * Nhận: không — lớp tự giữ sổ Plugin, sổ yêu cầu phê duyệt đang chờ và bốn bộ đếm danh tính.
 * Trả: một sổ đăng ký dùng chung trong tiến trình, biết mint danh tính đục và tra cứu Plugin/yêu cầu.
 */
export class DynamicCordisRegistry {
  /** Sổ Plugin theo danh tính ổn định, giữ thứ tự tạo. */
  private readonly plugins = new Map<CordisDynamicPluginId, DynamicCordisPlugin>();
  /** Yêu cầu phê duyệt đang chờ, theo danh tính yêu cầu. */
  private readonly pendingRequests = new Map<ApprovalRequestId, DynamicCordisPendingRequest>();
  /** Hậu tố kế tiếp cho Plugin ID; chỉ tăng, không tái dùng. */
  private nextPlugin = 1;
  /** Hậu tố kế tiếp cho Package ID. */
  private nextPackage = 1;
  /** Hậu tố kế tiếp cho lượt chạy. */
  private nextRun = 1;
  /** Hậu tố kế tiếp cho yêu cầu phê duyệt. */
  private nextApproval = 1;

  /**
   * Mint một Plugin ID ngữ nghĩa mà không tái dùng hậu tố đã cấp.
   * Nhận: "prefix" — tiền tố ngữ nghĩa chữ thường đã được kiểm, do model đề xuất.
   * Trả: Plugin ID duy nhất trong tiến trình.
   */
  mintPluginId(prefix: string): CordisDynamicPluginId {
    let id: CordisDynamicPluginId;
    do
      id = `${prefix}-${this.nextPlugin++}` as CordisDynamicPluginId;
    while (this.plugins.has(id));
    return id;
  }

  /**
   * Mint một Package ID bất biến.
   * Nhận: không.
   * Trả: Package ID duy nhất trong tiến trình.
   */
  mintPackageId(): CordisDynamicPackageId {
    return `pkg-${this.nextPackage++}` as CordisDynamicPackageId;
  }

  /**
   * Mint một danh tính lượt kích hoạt.
   * Nhận: không.
   * Trả: Plugin Run ID duy nhất trong tiến trình.
   */
  mintPluginRunId(): CordisDynamicPluginRunId {
    return `run-${this.nextRun++}` as CordisDynamicPluginRunId;
  }

  /**
   * Mint một danh tính yêu cầu phê duyệt.
   * Nhận: không.
   * Trả: ID yêu cầu phê duyệt duy nhất trong tiến trình.
   */
  mintApprovalRequestId(): ApprovalRequestId {
    return `approval-${this.nextApproval++}` as ApprovalRequestId;
  }

  /**
   * Thêm một plugin ổn định.
   * Nhận: "plugin" — bản ghi Plugin cần giữ dưới danh tính ổn định của nó.
   * Trả: không.
   */
  add(plugin: DynamicCordisPlugin): void {
    this.plugins.set(plugin.pluginId, plugin);
  }

  /**
   * Đọc một plugin.
   * Nhận: "id" — Plugin ID ổn định.
   * Trả: bản ghi Plugin, hoặc undefined khi không có.
   */
  get(id: CordisDynamicPluginId): DynamicCordisPlugin | undefined {
    return this.plugins.get(id);
  }

  /**
   * Xoá một plugin cùng mọi phiên bản package.
   * Nhận: "id" — Plugin ID ổn định cần gỡ.
   * Trả: có gỡ được một bản ghi Plugin hay không.
   */
  delete(id: CordisDynamicPluginId): boolean {
    return this.plugins.delete(id);
  }

  /**
   * Đọc mọi plugin theo thứ tự tạo.
   * Nhận: không.
   * Trả: ảnh chụp của toàn bộ bản ghi Plugin.
   */
  all(): DynamicCordisPlugin[] {
    return [...this.plugins.values()];
  }

  /**
   * Đọc các plugin của ĐÚNG một phiên theo thứ tự tạo.
   * Nhận: "sessionId" — phiên sở hữu cần lọc.
   * Trả: ảnh chụp các bản ghi Plugin khớp phiên.
   */
  ofSession(sessionId: SessionId): DynamicCordisPlugin[] {
    return this.all().filter(plugin => plugin.sessionId === sessionId);
  }

  /**
   * Công bố một yêu cầu phê duyệt đang chờ.
   * Nhận: "id" — ID yêu cầu phê duyệt; "pending" — bộ giải và metadata Plugin được giữ tới khi kết thúc.
   * Trả: không.
   */
  armRequest(id: ApprovalRequestId, pending: DynamicCordisPendingRequest): void {
    this.pendingRequests.set(id, pending);
  }

  /**
   * Đọc một yêu cầu phê duyệt đang chờ mà KHÔNG chiếm nó.
   * Nhận: "id" — ID yêu cầu phê duyệt.
   * Trả: yêu cầu đang chờ, hoặc undefined khi không có.
   */
  peekRequest(id: ApprovalRequestId): DynamicCordisPendingRequest | undefined {
    return this.pendingRequests.get(id);
  }

  /**
   * Chiếm một yêu cầu phê duyệt đang chờ; câu trả lời ĐẦU TIÊN thắng.
   * Nhận: "id" — ID yêu cầu phê duyệt.
   * Trả: yêu cầu đã chiếm, hoặc undefined khi đã được kết thúc trước đó.
   */
  claimRequest(id: ApprovalRequestId): DynamicCordisPendingRequest | undefined {
    const pending = this.pendingRequests.get(id);
    if (pending !== undefined)
      this.pendingRequests.delete(id);
    return pending;
  }

  /**
   * Huỷ một yêu cầu phê duyệt đang chờ.
   * Nhận: "id" — ID yêu cầu phê duyệt cần gỡ.
   * Trả: không.
   */
  disarmRequest(id: ApprovalRequestId): void {
    this.pendingRequests.delete(id);
  }

  /**
   * Tìm yêu cầu phê duyệt đang chờ của MỘT plugin.
   * Nhận: "pluginId" — Plugin ID ổn định.
   * Trả: ID yêu cầu phê duyệt của nó, hoặc undefined khi không có yêu cầu nào đang chờ.
   */
  pendingRequestFor(pluginId: CordisDynamicPluginId): ApprovalRequestId | undefined {
    for (const [requestId, request] of this.pendingRequests) {
      if (request.pluginId === pluginId)
        return requestId;
    }
    return undefined;
  }
}
