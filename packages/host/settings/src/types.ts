/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Kiểu dùng chung của gói settings: góc nhìn hẹp về schema schemastery, entry Loader,
 *      hai seam (configEditor · profileContext) và mô tả biểu mẫu trả cho tầng trên.
 *      review-3 (08/11/2026): thêm 4 kiểu WIRE của chính dịch vụ (SettingsSecretView · SettingsNamespaceView ·
 *      SettingsPathOpView · SettingsDescribeValue) đúng hình dạng stock lib/types/types.d.ts để consumer
 *      (host/settings-controller) không phải khai lại cục bộ khi alias trỏ về gói ta.
 */

import type { JsonValue } from "@galaxy-blackhole/gbh-util-values";

/** Nút schema schemastery ở dạng JSON — đúng thứ tự mà toJSON() sinh ra. */
export interface SchemaLike {
  /** Loại nút (object · dict · array · union · intersect · transform · …). */
  type: string;
  /** Metadata của nút — nơi role secret, default, required và volatile nằm. */
  meta: SchemaMeta;
  /** Bản đồ trường con của nút object. */
  dict?: Record<string, SchemaLike>;
  /** Nút con của dict/array/transform. */
  inner?: SchemaLike;
  /** Các nhánh của union/intersect. */
  list?: SchemaLike[];
  /** Bản JSON của chính nút này (schemastery sinh bảng refs cho đồ thị con). */
  toJSON(): SchemaLike;
}

/** Metadata của một nút schema — chỉ bốn khoá mà gói này đọc hoặc ghi. */
export interface SchemaMeta {
  /** Vai trò khai báo, ví dụ "secret". */
  role?: string;
  /** Trường bắt buộc. */
  required?: boolean;
  /** Trường sống — sửa được mà không cần nạp lại plugin. */
  volatile?: boolean;
  /** Giá trị mặc định của trường. */
  default?: unknown;
}

/** Khoá định danh một entry plugin trong profile — trùng options.id của entry. */
export type SettingsNamespace = string;

/** Một chỗ mà schema khai role secret: đường dẫn + có đang giữ giá trị hay không. */
export interface RedactedSecret {
  /** Đường dẫn từ gốc mục tới trường bị bỏ (gồm cả khoá dict cụ thể và chỉ số mảng). */
  path: string[];
  /** Trường có đang giữ giá trị trước khi che hay không. */
  set: boolean;
}

/** Giá trị đã bỏ mọi trường role secret, kèm sổ vị trí đã bỏ. */
export interface RedactedValue {
  /** Bản sao tách rời của đầu vào, không còn trường secret. */
  value: unknown;
  /** Mọi vị trí secret tiếp cận được, theo thứ tự duyệt. */
  secrets: RedactedSecret[];
}

/** Một biểu mẫu của một entry Loader đang sống. */
export interface SettingsDescriptor {
  /** Khoá định danh entry. */
  ns: SettingsNamespace;
  /** Có được tự sinh trang khi chưa có trang riêng hay không. */
  autoGenerate: boolean;
  /** Bản JSON của schema biểu mẫu. */
  schema: unknown;
  /** Giá trị đã chiếu theo biểu mẫu. */
  value: unknown;
  /** Revision của cấu hình thô mà biểu mẫu này đọc được. */
  revision: number;
  /** Lớp thừa kế của profile (đã phân giải mặc định), khi đọc được. */
  base?: unknown;
  /** Lớp ghi đè thô của người dùng, khi có. */
  user?: unknown;
  /** Thời điểm áp dụng thay đổi — hiện luôn là live. */
  applies: "live";
  /** Sổ vị trí secret, chỉ khi người đọc yêu cầu che. */
  secrets?: RedactedSecret[];
}

/** Một khe secret do schema khai báo, nằm trong giá trị namespace ĐÃ che (wire view của stock). */
export interface SettingsSecretView {
  /** Đường dẫn từ gốc section tới trường bị bỏ. */
  path: string[];
  /** Khe hiện có giá trị hay không; bản thân giá trị KHÔNG bao giờ đi kèm. */
  set: boolean;
}

/**
 * Wire view của MỘT entry plugin trong profile, luôn đọc dưới `redactSecrets`.
 * Các trường mang JSON dùng {@link JsonValue} (không phải `unknown`) vì biên Remote không nhận dữ liệu tự do.
 */
export interface SettingsNamespaceView {
  /** Tự sinh trang khi chưa có trang riêng cho thể hiện này. */
  autoGenerate: boolean;
  /** Khoá namespace (`llm-deepseek`, …). */
  ns: string;
  /** Phong bì schema schemastery đã tuần tự hoá (`schema.toJSON()`). */
  schema: JsonValue;
  /** Giá trị đã phân giải và đã che (mặc định schema → lớp nền → lớp người dùng). */
  value: JsonValue;
  /** Lớp nền của tổ hợp, đã phân giải mặc định và đã che. */
  base?: JsonValue;
  /** Section thô của người dùng (đã che) khi có; có mặt nghĩa là người dùng ghi đè. */
  user?: JsonValue;
  /** Thời điểm chủ sở hữu áp thay đổi. */
  applies: "live";
  /** Mọi khe secret do schema khai báo kèm trạng thái đã cấu hình. */
  secrets: SettingsSecretView[];
  /** Revision của cấu hình thô tại lúc đọc view này; gửi lại làm `expectedRevision` khi ghi. */
  revision: number;
}

/** Một phép sửa theo ĐƯỜNG DẪN mà lệnh ghi settings từ xa mang theo (wire view của stock). */
export type SettingsPathOpView =
  | { op: "set"; path: string[]; value: JsonValue }
  | { op: "unset"; path: string[] };

/** Toàn bộ entry plugin của profile kèm dữ kiện triển khai mà trang cấu hình cần. */
export interface SettingsDescribeValue {
  /** Profile có nhận ghi hay không; `false` tắt mọi điều khiển ghi. */
  writable: boolean;
  /** Trình biên tập cấu hình có tài liệu cục bộ hay không (không lộ đường dẫn Host). */
  hasDocument: boolean;
  /** Mỗi entry plugin một view. */
  namespaces: SettingsNamespaceView[];
}

/** Tuỳ chọn của phép đọc biểu mẫu. */
export interface SettingsDescribeOptions {
  /** Che mọi trường role secret trước khi trả — đường wire luôn bật. */
  redactSecrets?: boolean;
}

/** Một phép sửa theo ĐƯỜNG DẪN trên mục cấu hình của người dùng. */
export type SettingsPathOp =
  | { op: "set"; path: readonly string[]; value: unknown }
  | { op: "unset"; path: readonly string[] };

/** Chính sách trang tự động của một thể hiện plugin. */
export interface SettingsPresentation {
  /** Có tự sinh trang khi chưa có trang riêng hay không (mặc định true). */
  auto?: boolean;
}

/** Một entry Loader nhìn qua đúng những gì gói này đọc. */
export interface SettingsEntry {
  /** Id đầy đủ của entry (đã ghép id của tổ tiên) — khoá của sổ revision. */
  id: string;
  /** Options thô của entry: id row + cấu hình thô. */
  options: { id: string; config?: unknown };
  /** Fiber của plugin, khi entry đã activate. */
  fiber?: SettingsFiber;
}

/** Fiber của một plugin đang sống — nguồn của schema, cấu hình đã phân giải và trạng thái. */
export interface SettingsFiber {
  /** Số thứ tự của fiber trong tiến trình. */
  uid: number;
  /** Trạng thái vòng đời (2 = ACTIVE). */
  state: number;
  /** Runtime của plugin (nơi giữ Config), null khi chưa dựng. */
  runtime: { Config?: SchemaLike } | null;
  /** Cấu hình đã phân giải của plugin (có thể mang tham chiếu volatile). */
  config: unknown;
  /** Context của fiber — phạm vi để phân giải biểu thức js của lớp thừa kế. */
  ctx: unknown;
}

/** Seam configEditor — nơi gói này đọc/ghi tệp patch của profile. */
export interface ConfigEditorSeam {
  /** Đường dẫn tệp patch của profile. */
  readonly documentPath: string;
  /** Các entry cấu hình địa chỉ được. */
  entries(): SettingsEntry[];
  /** Cặp lớp thừa kế + lớp ghi đè của từng entry. */
  configuration(): Array<{ entry: SettingsEntry; inherited: unknown; override: unknown }>;
  /** Ghi cấu hình kế tiếp của một entry qua đường đối soát của Loader. */
  edit(entry: SettingsEntry, change: (raw: unknown, inherited: unknown) => unknown): Promise<void>;
}

/** Seam profileContext — profile đang chạy. */
export interface ProfileContextSeam {
  /** Tên profile (vd blackhole). */
  name: string;
  /** Home của profile — nơi tài liệu settings.yaml cũ từng nằm. */
  home: string;
}

/** Context cordis nhìn qua đúng những gì lớp dịch vụ chạm tới. */
export interface SettingsHost {
  /** Đăng ký một hiệu ứng dọn dẹp theo vòng đời plugin. */
  effect(setup: () => () => void): void;
  /** Lắng nghe một sự kiện của kernel. */
  on(name: string, listener: () => void): () => void;
  /** Phát một sự kiện ra toàn context. */
  emit(name: string, ...args: unknown[]): void;
  /** Context gốc — nơi tra loader. */
  root: { loader: { await(): Promise<unknown> } };
  /** Ghi log của kernel. */
  logger: {
    error(...args: unknown[]): void;
    warn(...args: unknown[]): void;
    info(...args: unknown[]): void;
  };
  /** Fiber của chính dịch vụ này. */
  fiber: object & { state: number };
  /** Seam ghi cấu hình. */
  configEditor: ConfigEditorSeam;
  /** Seam profile đang chạy. */
  profileContext: ProfileContextSeam;
}
