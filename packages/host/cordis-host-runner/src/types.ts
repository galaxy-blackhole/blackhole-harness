/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Từ vựng KIỂU an toàn cho client của runner cordis động: danh tính có thương hiệu, manifest inspect, yêu cầu và kết quả chạy plugin, trạng thái hai nửa, kho, phản hồi và lỗi.
 */

/**
 * Bản gốc "types.js" chỉ có "export {}" — toàn bộ từ vựng nằm trong "types.d.ts" (363 dòng).
 * Đây là bản port 1:1 phần KIỂU đó, nên module vẫn KHÔNG có export lúc chạy.
 * Khối "declare module '@deepseek-ai/cordis' { interface Events … }" của bản gốc KHÔNG được port
 * (luật 000d: cấm augment module): thay bằng interface "CordisDynamicEvents" khai theo CẤU TRÚC,
 * giữ nguyên tên sự kiện và payload.
 */

import type { Branded } from "@deepseek-ai/dsh-brand";
import type { SessionId } from "@galaxy-blackhole/gbh-session/types";
import type { JsonValue } from "@deepseek-ai/dsh-util-values";

/**
 * Nhận: chuỗi định danh do Host mint cho một thể hiện plugin động.
 * Trả: kiểu danh tính Plugin động đã đóng dấu thương hiệu (lúc chạy vẫn là chuỗi thuần).
 */
export type CordisDynamicPluginId = Branded<"CordisDynamicPluginId">;

/**
 * Nhận: chuỗi định danh do Host mint cho một phiên bản gói bất biến.
 * Trả: kiểu danh tính Package đã đóng dấu thương hiệu.
 */
export type CordisDynamicPackageId = Branded<"CordisDynamicPackageId">;

/**
 * Nhận: chuỗi định danh do Host mint cho một lượt kích hoạt.
 * Trả: kiểu danh tính lượt chạy Plugin đã đóng dấu thương hiệu.
 */
export type CordisDynamicPluginRunId = Branded<"CordisDynamicPluginRunId">;

/**
 * Nhận: chuỗi định danh cho một yêu cầu phê duyệt của con người.
 * Trả: kiểu danh tính yêu cầu phê duyệt đã đóng dấu thương hiệu.
 */
export type ApprovalRequestId = Branded<"ApprovalRequestId">;

/**
 * Nhận: chuỗi định danh cho một truy vấn inspect xuyên trang.
 * Trả: kiểu danh tính truy vấn inspect đã đóng dấu thương hiệu.
 */
export type CordisInspectRequestId = Branded<"CordisInspectRequestId">;

/**
 * Nhận: một trong hai mặt runtime sở hữu provider inspect.
 * Trả: kiểu mặt runtime, "host" hoặc "client".
 */
export type CordisInspectPlatform = "host" | "client";

/**
 * Nhận: phần khai báo của một truy vấn chỉ-đọc mà model gọi được, do provider inspect cung cấp.
 * Trả: khối mô tả method gồm tên, mô tả, JSON Schema đầu vào và JSON Schema đầu ra.
 */
export interface CordisInspectMethodManifest {
  /** Tên method, duy nhất trong provider của nó. */
  name: string;
  /** Truy vấn trả gì và dùng khi nào. */
  description: string;
  /** JSON Schema mà truy vấn nhận. */
  inputSchema: JsonValue;
  /** JSON Schema mà truy vấn sinh ra. */
  outputSchema: JsonValue;
}

/**
 * Nhận: phần khai báo của một provider inspect (danh mục phương thức của nó).
 * Trả: khối manifest tuần tự hoá được: danh tính provider, mô tả năng lực, các method chỉ-đọc.
 */
export interface CordisInspectProviderManifest {
  /** Danh tính provider, duy nhất trong một platform. */
  id: string;
  /** Năng lực mà provider này mô tả. */
  description: string;
  /** Các truy vấn chỉ-đọc được khai tường minh. */
  methods: readonly CordisInspectMethodManifest[];
}

/**
 * Nhận: một manifest provider inspect đã biết.
 * Trả: dòng danh mục provider kèm mặt runtime thực thi các method của nó.
 */
export interface CordisInspectProviderView extends CordisInspectProviderManifest {
  /** Mặt runtime thực thi các method này. */
  platform: CordisInspectPlatform;
}

/**
 * Nhận: yêu cầu của model cho một truy vấn inspect sống ở phía Client.
 * Trả: khối quảng bá của Host gồm danh tính tương quan, phiên, provider, method và đầu vào JSON.
 */
export interface CordisInspectQueryRequest {
  /** Danh tính tương quan. */
  requestId: CordisInspectRequestId;
  /** Phiên có model yêu cầu truy vấn. */
  agentId: SessionId;
  /** Provider được chọn từ manifest của Client. */
  provider: string;
  /** Method được chọn từ manifest của provider. */
  method: string;
  /** Đầu vào JSON của truy vấn; vắng khi method không có trường. */
  input?: JsonValue;
}

/**
 * Nhận: kết quả hoặc từ chối có cấu trúc do provider inspect phía Client gửi về.
 * Trả: kiểu hợp của nhánh thành công (dữ liệu JSON) và nhánh thất bại (lý do + thông điệp).
 */
export type CordisInspectQueryResolution =
  | {
      ok: true;
      data: JsonValue;
    }
  | {
      ok: false;
      reason: "provider-missing" | "method-missing" | "invalid-input" | "provider-error" | "cancelled";
      message: string;
    };

/**
 * Nhận: một truy vấn inspect phía Client vừa rời trạng thái chờ.
 * Trả: khối thông báo gồm danh tính truy vấn không còn trả lời được nữa.
 */
export interface CordisInspectQueryResolved {
  /** Truy vấn đã rời trạng thái chờ. */
  requestId: CordisInspectRequestId;
}

/**
 * Nhận: câu trả lời của Client cho một truy vấn vẫn đang chờ.
 * Trả: khối xác nhận cho biết câu trả lời có chiếm được truy vấn hay không.
 */
export interface CordisInspectResolveAck {
  /**
   * Chỉ true với một thành công hợp lệ làm kết thúc truy vấn;
   * false với thất bại được giữ lại và với câu trả lời lạ, quá hạn, đã huỷ hoặc đến muộn.
   */
  accepted: boolean;
}

/**
 * Nhận: ý định vòng đời do model hoặc bảng điều khiển chọn.
 * Trả: kiểu chế độ chạy, "run" (chạy phiên bản hiện tại) hoặc "update" (thay phiên bản).
 */
export type CordisDynamicRunMode = "run" | "update";

/**
 * Nhận: một yêu cầu kích hoạt phía Client do model điều khiển.
 * Trả: kiểu kết cục khi yêu cầu rời trạng thái chờ: approved, completed, rejected, cancelled hoặc failed.
 */
export type RequestRunOutcome = "approved" | "completed" | "rejected" | "cancelled" | "failed";

/**
 * Nhận: lỗi đã được chuẩn hoá ở ranh giới Host/Client.
 * Trả: các trường lỗi được giữ nguyên qua vận chuyển: thông điệp và stack (nếu có).
 */
export interface CordisErrorDetails {
  /** Thông điệp lỗi gốc. */
  message: string;
  /** Stack gốc khi giá trị bị ném có cung cấp. */
  stack?: string;
}

/**
 * Nhận: trạng thái của lượt kích hoạt mới nhất.
 * Trả: kiểu trạng thái bền: từ chờ phê duyệt, đang khởi động, đang chạy tới bị từ chối, hỏng, huỷ hoặc dừng.
 */
export type CordisRunStatus =
  | "awaiting-approval"
  | "starting-host"
  | "client-pending"
  | "running"
  | "waiting"
  | "rejected"
  | "failed"
  | "cancelled"
  | "stopped";

/**
 * Nhận: trạng thái của MỘT nửa (Host hoặc Client) trong một lượt kích hoạt.
 * Trả: khối gồm trạng thái vòng đời, các service còn thiếu và văn bản lỗi của nửa đó.
 */
export interface CordisHalfState {
  /** Trạng thái vòng đời của nửa này. */
  status: "absent" | "pending" | "stopped" | "running" | "waiting" | "failed";
  /** Các service mà một Fiber đã tạo thành công vẫn còn cần. */
  waitingFor: readonly string[];
  /** Văn bản lỗi của nửa này. */
  error?: string;
}

/**
 * Nhận: một lần hỏng có cấu trúc gắn với ĐÚNG một lượt kích hoạt.
 * Trả: khối chẩn đoán gồm pha hỏng, thông điệp, stack và ba danh tính plugin/gói/lượt chạy.
 */
export interface CordisRunDiagnostic {
  /** Pha đã hỏng. */
  phase: "approval" | "host-load" | "host-apply" | "client-load" | "client-apply" | "client-render";
  /** Văn bản lỗi gốc. */
  message: string;
  /** Stack lỗi gốc khi có. */
  stack?: string;
  /** Danh tính Plugin ổn định. */
  pluginId: CordisDynamicPluginId;
  /** Danh tính Package bất biến. */
  packageId: CordisDynamicPackageId;
  /** Danh tính ĐÚNG lượt chạy. */
  pluginRunId: CordisDynamicPluginRunId;
}

/**
 * Nhận: trạng thái của lượt kích hoạt mới nhất, giữ độc lập với lượt chạy vật lý.
 * Trả: khối đầy đủ của lần thử: danh tính, gói đích, chế độ, trạng thái, phê duyệt, hai nửa và lỗi.
 */
export interface DynamicCordisRunAttempt {
  /** Danh tính ĐÚNG lượt chạy. */
  pluginRunId: CordisDynamicPluginRunId;
  /** Package đích. */
  packageId: CordisDynamicPackageId;
  /** Ý định run/update tường minh. */
  mode: CordisDynamicRunMode;
  /** Trạng thái hiện tại của lần thử. */
  status: CordisRunStatus;
  /** Yêu cầu kích hoạt Client đang chờ; nó chỉ đại diện phê duyệt khi requiresApproval là true. */
  approvalRequestId?: ApprovalRequestId;
  /** Yêu cầu kích hoạt Client đang chờ có cần quyết định của người dùng hay không. */
  requiresApproval?: boolean;
  /** Trạng thái nửa Host. */
  host: CordisHalfState;
  /** Trạng thái nửa Client. */
  client: CordisHalfState;
  /** Lần hỏng gần nhất. */
  error?: CordisRunDiagnostic;
}

/**
 * Nhận: một gói đang chạy cần công bố cho các trang trình duyệt.
 * Trả: khối nhận diện gói gồm plugin, package, lượt chạy và nhãn.
 */
export interface DynamicCordisPackage {
  /** Thể hiện plugin ổn định. */
  pluginId: CordisDynamicPluginId;
  /** Phiên bản package bất biến đang hoạt động. */
  packageId: CordisDynamicPackageId;
  /** Danh tính của lượt kích hoạt này. */
  pluginRunId: CordisDynamicPluginRunId;
  /** Nhãn của package. */
  name: string;
}

/**
 * Nhận: một yêu cầu kích hoạt Client do model điều khiển đang chờ, cần chuyển tiếp cho các trang.
 * Trả: khối yêu cầu gồm danh tính tương quan, phiên, plugin, package, chế độ, nhãn, mục đích và cờ phê duyệt.
 */
export interface DynamicCordisRunRequest {
  /** Danh tính tương quan của yêu cầu kích hoạt. */
  requestId: ApprovalRequestId;
  /** Phiên sở hữu plugin và lượt gọi công cụ của yêu cầu. */
  agentId: SessionId;
  /** Thể hiện plugin ổn định đang được tác động. */
  pluginId: CordisDynamicPluginId;
  /** Phiên bản package mà yêu cầu sẽ kích hoạt. */
  packageId: CordisDynamicPackageId;
  /** Ý định vòng đời tường minh. */
  mode: CordisDynamicRunMode;
  /** Nhãn của package. */
  name: string;
  /** Lý do hướng tới người dùng, do lúc define cung cấp. */
  purpose: string;
  /** Trang có phải chờ quyết định tường minh của người dùng trước khi kích hoạt hay không. */
  requiresApproval: boolean;
}

/**
 * Nhận: một yêu cầu kích hoạt Client do model điều khiển vừa được giải quyết.
 * Trả: khối quảng bá cho mọi trang gồm danh tính yêu cầu và kết cục.
 */
export interface DynamicCordisRequestResolved {
  /** Yêu cầu đã rời trạng thái chờ. */
  requestId: ApprovalRequestId;
  /** Cách yêu cầu được giải quyết. */
  outcome: RequestRunOutcome;
}

/**
 * Nhận: một lượt kích hoạt bị rút khỏi mọi trang.
 * Trả: khối gồm plugin, package và ĐÚNG lượt chạy đang bị rút.
 */
export interface DynamicCordisRetracted {
  /** Thể hiện plugin ổn định. */
  pluginId: CordisDynamicPluginId;
  /** Phiên bản package từng hoạt động. */
  packageId: CordisDynamicPackageId;
  /** ĐÚNG lượt kích hoạt đang bị rút. */
  pluginRunId: CordisDynamicPluginRunId;
}

/**
 * Nhận: một package bất biến trong kho, không kèm mã nguồn.
 * Trả: khối metadata gồm danh tính gói, nhãn, mục đích và hai cờ có/không nửa Host/Client.
 */
export interface DynamicCordisInventoryPackage {
  /** Phiên bản package bất biến. */
  packageId: CordisDynamicPackageId;
  /** Nhãn của package. */
  name: string;
  /** Mục đích hướng tới người dùng. */
  purpose: string;
  /** Phiên bản này có mã Host hay không. */
  hasHostHalf: boolean;
  /** Phiên bản này có mã Client hay không. */
  hasClientHalf: boolean;
}

/**
 * Nhận: một thể hiện plugin ổn định cùng các phiên bản package của nó.
 * Trả: dòng kho toàn khung gồm phiên sở hữu, danh sách package, các con trỏ phiên bản và lần thử mới nhất.
 */
export interface DynamicCordisInventoryRow {
  /** Thể hiện plugin ổn định. */
  pluginId: CordisDynamicPluginId;
  /** Phiên sở hữu plugin này. */
  agentId: SessionId;
  /** Các phiên bản bất biến theo thứ tự define. */
  packages: readonly DynamicCordisInventoryPackage[];
  /** Package cuối cùng đã kích hoạt thành công. */
  currentPackageId?: CordisDynamicPackageId;
  /** Package được chọn cho một chuyển đổi đang hỏng hoặc đang diễn ra. */
  nextPackageId?: CordisDynamicPackageId;
  /** Lượt kích hoạt hiện tại; vắng khi đã dừng. */
  activeRun?: {
    pluginRunId: CordisDynamicPluginRunId;
    packageId: CordisDynamicPackageId;
  };
  /** Lần thử kích hoạt mới nhất, kể cả phê duyệt đang chờ và chẩn đoán. */
  latestRun?: DynamicCordisRunAttempt;
}

/**
 * Nhận: kết quả của việc gỡ một plugin cùng mọi phiên bản package.
 * Trả: kiểu hợp của nhánh thành công (có/không dừng lượt chạy) và nhánh thiếu plugin kèm thông điệp.
 */
export type DynamicCordisUndefineReceipt =
  | {
      ok: true;
      wasRunning: boolean;
    }
  | {
      ok: false;
      reason: "plugin-missing";
      message: string;
    };

/**
 * Nhận: một lần hỏng khi render, quan sát sau khi nửa Client đã nạp.
 * Trả: khối gồm slot hỏng, thông điệp, stack và cờ cho biết phần đóng góp đã nhường slot hay chưa.
 */
export interface DynamicCordisRenderFailure {
  /** Slot có component bị hỏng. */
  slot: string;
  /** Văn bản lỗi render. */
  message: string;
  /** Stack lỗi render gốc khi có. */
  stack?: string;
  /** Phần đóng góp bị hỏng có nhường slot của nó hay không. */
  abdicated: boolean;
}

/**
 * Nhận: kết quả của một lần kích hoạt do model hoặc bảng điều khiển điều khiển.
 * Trả: kiểu hợp của nhánh thành công (trạng thái, ba danh tính, service còn thiếu, con trỏ phiên bản, chế độ)
 *   và nhánh thất bại (lý do, thông điệp, stack).
 */
export type DynamicCordisRunResponse =
  | {
      ok: true;
      /** Kích hoạt đã xong đồng bộ, đang khởi động trong Client, hay đang chờ người dùng phê duyệt. */
      status: "awaiting-approval" | "starting" | "running";
      pluginId: CordisDynamicPluginId;
      packageId: CordisDynamicPackageId;
      pluginRunId: CordisDynamicPluginRunId;
      /** Service Host còn thiếu; một Fiber bị treo vẫn là kích hoạt thành công. */
      waitingFor: readonly string[];
      /** Service Client còn thiếu do trang phê duyệt báo về. */
      clientWaitingFor?: readonly string[];
      /** Package thành công đầy đủ gần nhất. */
      currentPackageId?: CordisDynamicPackageId;
      /** Đích chuyển đổi đã chọn. */
      nextPackageId?: CordisDynamicPackageId;
      /** Ý định vòng đời tường minh. */
      mode: CordisDynamicRunMode;
    }
  | {
      ok: false;
      reason:
        | "plugin-missing"
        | "package-missing"
        | "invalid-mode"
        | "transition-in-flight"
        | "host-half-failed"
        | "client-half-failed"
        | "rejected"
        | "cancelled"
        | "not-running";
      message: string;
      /** Stack lỗi gốc khi có. */
      stack?: string;
    };

/**
 * Nhận: kết quả của việc dừng một Plugin mà KHÔNG xoá các Package của nó.
 * Trả: kiểu hợp của nhánh thành công và nhánh thất bại (thiếu plugin hoặc không có lượt chạy).
 */
export type DynamicCordisStopResponse =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: "plugin-missing" | "not-running";
      message: string;
    };

/**
 * Nhận: kết quả của việc dựng nửa Host trước khi nạp nửa Client.
 * Trả: kiểu hợp của nhánh thành công (ba danh tính, service còn thiếu, cờ startedHere)
 *   và nhánh thất bại (ok false + chi tiết lỗi).
 */
export type DynamicCordisHostHalfResult =
  | {
      ok: true;
      pluginId: CordisDynamicPluginId;
      packageId: CordisDynamicPackageId;
      pluginRunId: CordisDynamicPluginRunId;
      waitingFor: readonly string[];
      /** False khi một bảng điều khiển chỉ gắn trang này vào một lượt chạy đã hoạt động. */
      startedHere: boolean;
    }
  | ({
      ok: false;
    } & CordisErrorDetails);

/**
 * Nhận: mã nguồn nửa Client của ĐÚNG một lượt kích hoạt.
 * Trả: khối gồm thân JavaScript chạy trong trình duyệt, nhãn package và ba danh tính.
 */
export interface DynamicCordisClientSource {
  /** Thân JavaScript chạy trong trình duyệt. */
  code: string;
  /** Nhãn của package. */
  name: string;
  /** Thể hiện plugin ổn định. */
  pluginId: CordisDynamicPluginId;
  /** Phiên bản nguồn bất biến. */
  packageId: CordisDynamicPackageId;
  /** ĐÚNG lượt kích hoạt mà nguồn thuộc về. */
  pluginRunId: CordisDynamicPluginRunId;
}

/**
 * Nhận: phán quyết của trình duyệt cho cả lượt chạy công cụ đã phê duyệt lẫn lượt chạy từ bảng điều khiển.
 * Trả: kiểu hợp của nhánh thành công (lượt chạy, service còn thiếu) và nhánh thất bại (lý do, danh tính, cờ, lỗi).
 */
export type DynamicCordisRunResolution =
  | {
      ok: true;
      pluginRunId: CordisDynamicPluginRunId;
      waitingFor?: readonly string[];
    }
  | {
      ok: false;
      reason: "rejected" | "host-half-failed" | "client-half-failed";
      /** Lượt kích hoạt đã hỏng; vắng khi bị từ chối TRƯỚC khi kích hoạt. */
      pluginRunId?: CordisDynamicPluginRunId;
      /** Trang này có tạo ra lượt kích hoạt hỏng thay vì gắn vào nó hay không. */
      startedHere?: boolean;
      message?: string;
      stack?: string;
    };

/**
 * Nhận: một kết quả kích hoạt phía Client gửi tới yêu cầu vẫn đang chờ.
 * Trả: khối xác nhận cho biết câu trả lời có tới được yêu cầu hay không.
 */
export interface DynamicCordisResolveAck {
  /** False với câu trả lời đến muộn, lạ hoặc cũ. */
  accepted: boolean;
}

/**
 * Nhận: kết quả định tuyến MỘT lượt gọi Client tới nửa Host đang hoạt động.
 * Trả: kiểu hợp của nhánh thành công (giá trị JSON) và nhánh thất bại (mã lỗi + chi tiết lỗi).
 */
export type DynamicCordisInvokeResult =
  | {
      ok: true;
      value: JsonValue;
    }
  | ({
      ok: false;
      code: "plugin-not-running" | "stale-run" | "method-not-found" | "handler-error";
    } & CordisErrorDetails);

/**
 * Nhận: tên một trong sáu sự kiện của runner, giữ đúng tên của bản gốc.
 * Trả: chữ ký payload mà người nghe nhận được; thay cho khối augment "Events" bị luật 000d cấm.
 */
export interface CordisDynamicEvents {
  /** Nhận: yêu cầu kích hoạt Client cần một trang và có thể cần quyết định của người dùng. Trả: không. */
  "cordis/request-run"(request: DynamicCordisRunRequest): void;
  /** Nhận: yêu cầu kích hoạt Client đang chờ vừa rời trạng thái trả lời được. Trả: không. */
  "cordis/request-run-resolved"(resolved: DynamicCordisRequestResolved): void;
  /** Nhận: một lượt kích hoạt Plugin/Package vừa sống trong Host. Trả: không. */
  "cordis/dynamic-package"(pkg: DynamicCordisPackage): void;
  /** Nhận: một lượt kích hoạt vừa bị rút. Trả: không. */
  "cordis/dynamic-retract"(retracted: DynamicCordisRetracted): void;
  /** Nhận: yêu cầu truy vấn chỉ-đọc sống từ sổ inspect phía Client. Trả: không. */
  "cordis/inspect-query"(request: CordisInspectQueryRequest): void;
  /** Nhận: một truy vấn inspect vừa kết thúc hoặc bị huỷ. Trả: không. */
  "cordis/inspect-query-resolved"(resolved: CordisInspectQueryResolved): void;
}
