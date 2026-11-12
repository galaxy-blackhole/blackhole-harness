/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Port 1:1 'lib/types/types.d.ts' của @deepseek-ai/dsh-plugin-manager (253 dòng; tệp .js tương ứng chỉ
 *      là 'export {}' — toàn bộ nội dung là KIỂU): bản ghi công khai của quản lý plugin, dùng chung với
 *      client. Khối 'declare module @deepseek-ai/cordis' của bản gốc KHÔNG port (luật repo CẤM augment module)
 *      ⇒ ba sự kiện plugin-manager/* giữ NGUYÊN payload, khai thành interface thường; PluginEntryId và
 *      PluginInstallRequestId giữ 'string' đúng giá trị wire (brand của bản gốc chỉ có nghĩa lúc biên dịch).
 *      11/11/2026: thêm cờ `origin` (`user` | `core`) trên BundleInfo — trang Plugins đang đẩy gói lõi stock
 *      `@deepseek-ai/dsh-terminal` vào nhóm "Plugin đã cài" kèm badge đỏ "Trục trặc"; client cần cờ để tách nhóm.
 */

import type { BundleOrigin } from "./origin.ts";

export type { BundleOrigin };

/** Chữ hiển thị: một chuỗi literal, hoặc bản dịch theo mã ngôn ngữ với khoá `en` bắt buộc. */
export type LocalizedText = string | { readonly en: string; readonly [locale: string]: string };

/**
 * Trường hiển thị đã kiểm của một plugin cùng chẩn đoán metadata.
 * Hình dạng địa phương của `PluginLocalizedMeta` bên `@deepseek-ai/dsh-package-manifest` (cùng khuôn,
 * KHÔNG thêm dependency).
 */
export interface PluginLocalizedMeta {
  /** Tiêu đề hiển thị; thiếu thì bên dùng rơi về tên kỹ thuật. */
  readonly title?: LocalizedText;
  /** Lời giới thiệu hiển thị sau khi rơi về locale và trường của package. */
  readonly description?: LocalizedText;
  /** Data URL ảnh base64 lấy từ icon của manifest hoặc `<specifier>/icon` đã xuất; hiển thị như ảnh, không phải markup. */
  readonly icon?: string;
  /** Chẩn đoán metadata địa phương chưa sửa; plugin vẫn quản lý được. */
  readonly error?: string;
}

/**
 * Id ổn định của một entry trong cây Loader.
 * Bản gốc là `Branded<'PluginEntryId'>` (dsh-brand); brand chỉ có nghĩa lúc biên dịch nên ở đây giữ nguyên
 * chuỗi — đúng giá trị wire mà client đọc.
 */
export type PluginEntryId = string;

/** Pha của fiber gốc của một entry, hoặc null khi entry không có fiber gốc sống. */
export type PluginFiberPhase = "pending" | "loading" | "active" | "failed" | "unloading" | null;

/**
 * Một entry không phải group của cây Loader, phơi cho client tin cậy.
 * Hình dạng địa phương của `PluginInventoryEntry` bên `@deepseek-ai/dsh-host-plugin-inventory`.
 */
export interface PluginInventoryEntry {
  /** Id ổn định của entry. */
  readonly entryId: PluginEntryId;
  /** Specifier module mà entry import. */
  readonly moduleName: string;
  /** Metadata hiển thị địa phương, độc lập với việc entry có bật hay không. */
  readonly meta?: PluginLocalizedMeta;
  /** Enable của entry (đã tính cả group cha bị tắt). */
  readonly enabled: boolean;
  /** Pha của fiber gốc. */
  readonly fiberPhase: PluginFiberPhase;
}

/** Vì sao một điều khiển profile không thể sửa đích của nó. */
export type ReadOnlyReason = "management-required" | "unaddressable";

/** Một package mà yêu cầu DSH khai báo từ chối phiên bản DSH đang chạy, khi chưa có miễn trừ cho đúng cặp đó. */
export interface IncompatiblePlugin {
  /** Tên package. */
  name: string;
  /** Phiên bản package. */
  version: string;
  /** Phiên bản DSH đang chạy. */
  runtimeVersion: string;
  /** Chỉ những yêu cầu mà phiên bản đang chạy không thoả, khoá `engines.dsh` hoặc theo tên package peer của DSH. */
  requirements: Record<string, string>;
}

/** Lỗi quản lý bản địa hoá được và chẩn đoán ngoài tuỳ chọn. */
export interface ManagementError {
  /** Mã lỗi đóng: hai lý do chỉ-đọc, mười một mã thao tác. */
  code: ReadOnlyReason | "unknown-plugin" | "invalid-spec" | "already-installed" | "ambiguous-install" | "not-bundle" | "not-removable" | "stop-profile" | "bundle-in-use" | "stale-approval" | "incompatible-version" | "operation-error";
  /** Chẩn đoán ngoài, thường là đầu ra của pnpm. */
  diagnostic?: string;
  /** Có cùng `incompatible-version`: các package mà phiên bản DSH đang chạy từ chối. */
  incompatible?: IncompatiblePlugin[];
}

/**
 * Vì sao một thay đổi chờ lần khởi động sau: `no-hmr` — profile chỉ áp dụng thay đổi lúc khởi động;
 * `package-moved` — thay đổi ánh xạ một package đã cài sang thư mục khác mà không gỡ trước, hoặc đổi/ghi đè
 * cục bộ một package mà bản cài DSH cấp; `host-module` — thay đổi chạm module mà chính tiến trình đang chạy
 * import; `unmanaged-plugin` — thay đổi chạm một plugin chạy ngoài entry của Loader; `module-comparison` —
 * không so được module đã nạp với đĩa.
 */
export type RestartReason = "no-hmr" | "package-moved" | "host-module" | "unmanaged-plugin" | "module-comparison";

/** Một entry của profile đang chạy và khả năng điều khiển bền vững của nó. */
export type PluginInfo = PluginInventoryEntry & ({
  /** Đích patch profile của entry. */
  patchId: string;
  /** Không bao giờ có cùng `patchId`. */
  readOnlyReason?: never;
} | {
  /** Không bao giờ có cùng `readOnlyReason`. */
  patchId?: never;
  /** Vì sao entry không sửa được qua patch của profile. */
  readOnlyReason: ReadOnlyReason;
});

/** Một row mà patch của một bundle khai, kèm entry đang chạy khi bundle đóng góp row đó. */
export interface BundleRowInfo {
  /** Id row đúng như patch khai. */
  rowId: string;
  /** Module mà row nêu tên. */
  moduleName: string;
  /** Metadata hiển thị của package địa phương, kể cả row của bundle đang tắt. */
  meta?: PluginLocalizedMeta;
  /** Entry của Loader mang row này, khi đúng MỘT entry đang chạy có id đó. */
  entryId?: PluginEntryId;
}

/** Một bundle đi kèm bản cài, đã cài trong profile, hoặc tìm thấy trong danh mục tải khi cần. */
export interface BundleInfo {
  /** Tên package của bundle. */
  name: string;
  /** Bundle tuỳ chọn đi kèm dự án hoặc mục danh mục tải khi cần, độc lập với cài đặt và lựa chọn. */
  official: boolean;
  /** Gốc của gói: `user` = người dùng cài/chọn; `core` = thành phần LÕI đi kèm bản cài DSH (11/11/2026). */
  origin: BundleOrigin;
  /** Vị trí đọc được; mục danh mục tải khi cần bỏ các bản sao bắc cầu không khai, và tệp đã khai có thể thiếu. */
  availability: "installation" | "profile" | "missing";
  /** Phiên bản Host đã phát hành chính xác hoặc link phát triển cùng checkout, mời cho một mục danh mục tải khi cần. */
  installTarget?: {
    /** Spec cài đặt. */
    spec: string;
    /** Phiên bản tương ứng. */
    version: string;
  };
  /** Phiên bản đang cài, khi biết. */
  version?: string;
  /** Chữ hiển thị địa phương kèm bản dịch có sẵn hoặc rơi về literal, hoặc chẩn đoán metadata. */
  meta?: PluginLocalizedMeta;
  /** `description` chưa dịch của manifest package này. */
  description?: string;
  /** Được chọn trong manifest profile; lỗi nạp nghĩa là lớp của nó bị bỏ qua. */
  enabled: boolean;
  /** Profile có khai phụ thuộc này không; `availability` báo riêng việc tệp của nó có đọc được không. */
  installed: boolean;
  /** Có với phụ thuộc của profile mà bản cài KHÔNG cấp: spec mà `pnpm add` nhận, đường dẫn cục bộ đã tuyệt đối hoá và URL http(s) đã bỏ thông tin người dùng. */
  source?: string;
  /** Bản cài có kèm bundle để người dùng tự bật: được `OPTIONAL_BUNDLES` của launcher nêu tên, nằm trong phụ thuộc của bản cài, không template đi kèm nào chọn, và không bao giờ gỡ được. */
  optional: boolean;
  /** Gỡ được hay không. */
  removable: boolean;
  /** Vì sao không sửa được. */
  readOnlyReason?: ReadOnlyReason;
  /** Lỗi của bundle này. */
  error?: ManagementError;
  /** Các row mà patch của bundle chèn, theo thứ tự khai; rỗng khi không đọc được patch. */
  rows: BundleRowInfo[];
  /** Id các row mà patch của bundle ĐỔI mà không khai: các row dựng sẵn mà nó cấu hình hoặc tắt. */
  overrides: string[];
}

/** Một registry để cài từ đó: URL http(s), hoặc null cho cái mà chính cấu hình pnpm nêu tên. */
export type Registry = string | null;

/** Các registry mà manager hỏi: cái cấu hình đứng đầu, các dự phòng theo thứ tự, và cái mà chính cấu hình pnpm nêu tên. */
export interface PluginRegistries {
  /** Registry đứng đầu danh sách mà cấu hình nêu. */
  readonly registry: Registry;
  /** Các registry dự phòng, theo thứ tự. */
  readonly fallbackRegistries: readonly string[];
  /** URL mà chính cấu hình pnpm nêu trong profile, đọc từ pnpm; null khi không đọc được. */
  readonly resolved: string | null;
}

/** Cách một thao tác package thất bại, đọc từ cách nó kết thúc và những gì nó in ra. */
export type PluginInstallFailureKind = "pnpm-missing" | "timeout" | "not-found" | "no-matching-version" | "network" | "disk-full" | "permission" | "build-blocked" | "integrity" | "unknown";

/** Kết cục một thao tác package, kèm phép kiểm Git và đường dẫn lấy chẩn đoán đầy đủ. */
export interface PackageResult {
  /** Mã thoát của lượt chạy. */
  exitCode: number;
  /** Đầu ra đã giữ lại. */
  output: string;
  /** Đầu ra có bị cắt không. */
  truncated: boolean;
  /** Tệp chứa chẩn đoán đầy đủ. */
  logPath: string;
  /** Có khi lượt chạy thất bại: loại thất bại mà mã thoát và đầu ra mô tả. */
  kind?: PluginInstallFailureKind;
  /** Manager đã kết thúc lượt chạy sau khi nó không in gì trong giới hạn im lặng; `exitCode` vẫn báo cách nó kết thúc. */
  timedOut?: boolean;
  /** Có khi một phép kiểm tương thích từ chối lượt chạy: các package mà phiên bản DSH đang chạy từ chối. */
  incompatible?: IncompatiblePlugin[];
}

/** Thay đổi đã ghi xuống và kết cục áp dụng mà bên ngoài quan sát được. */
export interface ChangeResult {
  /** Có thay đổi nào được ghi không. */
  changed: boolean;
  /** `cancelled` là lần cài do bên gọi dừng, tệp của nó đã được khôi phục. */
  application: "applied" | "restart-required" | "overridden" | "failed" | "cancelled";
  /** Có cùng `restart-required`: vì sao thay đổi chỉ có hiệu lực ở lần khởi động sau. */
  restartReason?: RestartReason;
  /** Bước thử cuối; lần cài thành công có thể đi tiếp tới bật. */
  stage: "install" | "enable" | "remove";
  /** Đích của thay đổi. */
  target: string;
  /** Enable sau thay đổi, khi có. */
  enabled?: boolean;
  /** Lỗi khi thay đổi thất bại. */
  error?: ManagementError;
  /** Các entry không hoạt động có sẵn mà thao tác để nguyên. */
  warnings?: string[];
  /** Kết cục lượt chạy package khi có. */
  packageResult?: PackageResult;
  /** Bundle mà lần cài đã thêm, một khi pnpm và phép kiểm bundle chấp nhận nó. */
  bundle?: string;
  /** Phiên bản manifest của bundle đã cài, khi khai; `minimumReleaseAge` của pnpm có thể làm nó cũ hơn bản mới nhất. */
  version?: string;
  /** Tên package chính xác đang chờ duyệt script trong cấu hình pnpm của profile, đọc sau một lượt chạy thất bại. */
  pendingBuilds?: string[];
  /** Quyền script của package đã lưu trước lần thử cài này. */
  approvedBuilds?: string[];
  /** Các registry mà lần cài đã hỏi, theo thứ tự; `packageResult` là lượt chạy của cái cuối. */
  registries?: Registry[];
  /**
   * Lượt chạy thất bại cuối không chạm được hoặc không lấy được câu trả lời từ đâu: registry nó đã hỏi, hoặc host
   * mà spec git/tarball được tải từ đó (không registry nào thay thế được); vắng khi thất bại không do cái nào.
   */
  failedAt?: "registry" | "spec-host";
}

/** Định danh một lần cài từ lúc bắt đầu tới lúc kết thúc, kể cả các mẩu log và yêu cầu huỷ. */
export type PluginInstallRequestId = string;

/** Mặc định cài bundle là BẬT; bên gọi có mời huỷ thì cấp request id. */
export interface InstallBundleOptions {
  /** Bật bundle sau khi cài; thiếu thì mặc định true. */
  enabled?: boolean;
  /** Lưu phiên bản phụ thuộc đã giải mà không kèm range; áp dụng cho mọi lần cài bundle. */
  saveExact?: boolean;
  /** Id yêu cầu mà một lời huỷ sẽ nêu tên. */
  requestId?: PluginInstallRequestId;
  /** Cho phép tường minh script của các package đang chờ này cho profile, rồi cài; tên không còn chờ sẽ bị từ chối. */
  approvedBuilds?: string[];
  /** Registry hỏi trước; thiếu thì dùng cái đã cấu hình. Các dự phòng đã cấu hình theo sau khi registry không chạm được hoặc đã cũ. */
  registry?: Registry;
}

/** Nơi một lần kiểm hỏi. */
export interface InspectOptions {
  /** Registry hỏi trước; thiếu thì dùng cái đã cấu hình. */
  readonly registry?: Registry;
}

/** Hình thức một spec cài đặt, theo từ vựng của pnpm. */
export type InstallSpecKind = "registry" | "path" | "git" | "tarball";

/** Vì sao một spec bị từ chối trước khi cài bất cứ thứ gì. */
export type PluginInspectProblem = "invalid-spec" | "already-installed" | "not-found" | "not-a-package" | "not-a-bundle" | "network" | "unknown";

/**
 * Spec nêu tên gì, đọc trước khi cài: câu trả lời của registry cho một tên, manifest của một thư mục cho một
 * đường dẫn, và chỉ hình thức cho spec git hoặc tarball (package của chúng chỉ biết sau khi pnpm đã tải).
 */
export type PluginSpecInspection = {
  /** Spec được chấp nhận. */
  readonly status: "accepted";
  /** Hình thức của spec. */
  readonly kind: InstallSpecKind;
  /** Tên package, khi biết. */
  readonly name?: string;
  /** Phiên bản, khi biết. */
  readonly version?: string;
  /** `description` của manifest package. */
  readonly description?: string;
  /** Package có khai patch bundle không; null khi hình thức của spec không nói được. */
  readonly bundle: boolean | null;
  /** Registry đã trả lời cho một tên, và với các hình thức khác là cái mà một lần cài spec đó hỏi trước. */
  readonly registry: Registry;
  /** Host mà spec git hoặc URL tarball được tải từ đó, không registry nào thay thế được. */
  readonly host?: string;
} | {
  /** Spec bị từ chối. */
  readonly status: "refused";
  /** Vấn đề khiến spec bị từ chối. */
  readonly problem: PluginInspectProblem;
  /** Điều mà pnpm, registry, hoặc hệ tệp đã nói. */
  readonly reason: string;
  /** Các registry đã hỏi, theo thứ tự, khi lời từ chối đến từ việc hỏi chúng; `reason` là của cái cuối. */
  readonly registries?: Registry[];
};

/** Pha Host của một lần cài, trước khi lời gọi cài của nó kết thúc; `installing` được thông báo một lần cho mỗi registry được hỏi. */
export interface PluginInstallProgress {
  /** Id yêu cầu của lần cài. */
  readonly requestId: PluginInstallRequestId;
  /** Pha hiện tại. */
  readonly phase: "installing" | "cancelling" | "applying";
  /** Với `installing`: registry mà lần thử này hỏi, vị trí một-based của nó, và tổng số mà lần cài có thể hỏi. */
  readonly attempt?: {
    /** Registry của lần thử này. */
    readonly registry: Registry;
    /** Vị trí một-based của lần thử. */
    readonly index: number;
    /** Tổng số registry mà lần cài có thể hỏi. */
    readonly total: number;
  };
}

/** Huỷ chỉ được xác nhận sau khi tiến trình thoát và tệp đã được khôi phục. */
export interface PluginInstallCancellation {
  /** Kết cục của yêu cầu huỷ. */
  readonly status: "cancelled" | "too-late" | "not-running";
}

/** Một mẩu đầu ra của lượt chạy pnpm, đúng như lượt chạy sinh ra nó. */
export interface PluginInstallLogChunk {
  /** Lần cài mà lượt chạy thuộc về, khi bên gọi có cấp request id. */
  readonly requestId?: PluginInstallRequestId;
  /** Lượt chạy mà mẩu này thuộc về. */
  readonly jobId: string;
  /** Dòng lệnh mà lượt chạy thực thi: tên lệnh của pnpm, rồi các tham số. */
  readonly argv: readonly string[];
  /** Thư mục mà lượt chạy thực thi trong đó: thư mục profile. */
  readonly cwd: string;
  /** Luồng sinh ra mẩu này. */
  readonly stream: "stdout" | "stderr";
  /** Nội dung mẩu. */
  readonly text: string;
  /** Có ở mẩu CUỐI của lượt chạy: mã thoát của pnpm, null khi nó kết thúc mà không có mã. */
  readonly exitCode?: number | null;
}

/** Điều gì đã đổi trong profile, cho bên dùng hiển thị nó. */
export interface PluginChange {
  /** Thao tác đã đổi nó. */
  readonly reason: "plugin" | "bundle" | "install" | "remove";
}
