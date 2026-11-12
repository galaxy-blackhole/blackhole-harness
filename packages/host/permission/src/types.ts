/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Từ vựng của miền "preset quyền" — vật thể cấu hình, catalog tiến trình, trạng thái núm của
 *      đơn vị chiếu `permissions`, và các seam row này chạm, khai theo CẤU TRÚC (không import gói
 *      seam nào). Nguồn đối chiếu: lib/types/index.d.ts + lib/types/types.d.ts (bản gốc 0.2.1-alpha.4).
 */

import type { Volatile } from "@deepseek-ai/cordis";
import type { Context } from "@deepseek-ai/cordis";
import type { PermissionPresetService } from "./service.ts";

/** Ba chế độ sandbox mà một preset gộp vào — NGUYÊN VĂN từ vựng của `dsh-sandbox`. */
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

/** Hai chính sách duyệt mà một preset gộp vào — NGUYÊN VĂN từ vựng của `dsh-user-approval`. */
export type ApprovalPolicy = "ask" | "never";

/** Một preset: bộ hai núm mà nó ghi qua, cộng phần trình bày tuỳ chọn cho client. */
export interface PresetSpec {
  /** Giá trị `sandbox/mode` mà preset này ghi qua. */
  sandbox: SandboxMode;
  /** Giá trị `approval/policy` mà preset này ghi qua. */
  approval: ApprovalPolicy;
  /** Nhãn hiển thị của client; bỏ trống thì dùng chính khoá bảng. */
  name?: string;
  /** Một câu giải thích nghĩa của preset; bỏ trống khi không cấu hình. */
  description?: string;
}

/** Phần trình bày cho một preset chọn được, hoặc cho giá trị dẫn xuất `custom`. */
export interface PresetOption {
  /** Giá trị ổn định của lựa chọn: khoá preset đã cấu hình, `auto` đang sống, hoặc `custom` dẫn xuất. */
  value: string;
  /** Nhãn hiển thị. */
  name: string;
  /** Một câu giải thích nghĩa của giá trị; bỏ trống khi không cấu hình. */
  description?: string;
}

/** Catalog quyền cấp TIẾN TRÌNH: đổi theo đóng góp đang sống, tách khỏi lịch sử phiên. */
export interface PermissionCatalog {
  /** Mọi preset chọn được ngay lúc này, theo thứ tự đóng góp. */
  options: PresetOption[];
  /** Các preset đã cấu hình, đủ tư cách làm mặc định cho phiên tương lai. */
  defaultOptions: PresetOption[];
  /** Mặc định hiệu lực khi trường Config bị bỏ trống. */
  defaultPreset: string;
}

/** Toàn bộ khung nhìn dây của chiếu phiên `permissions`: chỉ giá trị chọn bền hiện tại. */
export interface PermissionSelection {
  /** Giá trị hiện tại: khoá preset đã cấu hình, `auto`, hoặc `custom`. */
  currentValue: string;
}

/**
 * Trạng thái núm của đơn vị chiếu: giá trị cuối của từng sự kiện núm, `null` trước lần ghi đè
 * (mặc định thành phần áp ở lúc đọc).
 */
export interface KnobState {
  /** Payload `permission/preset` cuối, hoặc null. */
  preset: string | null;
  /** Payload `sandbox/mode` cuối, hoặc null. */
  sandbox: SandboxMode | null;
  /** Payload `approval/policy` cuối, hoặc null. */
  approval: ApprovalPolicy | null;
}

/** Trạng thái chiếu của các lần ghi đè quyền, cộng dấu "log đã có ranh giới gieo hạt". */
export interface PermissionProjectionState extends KnobState {
  /** Log đã chứa ranh giới `session/end-seed` chưa. */
  seeded: boolean;
}

/** Thiết lập người dùng được giải khi một phiên mới nhận quyền khởi tạo. */
export interface PermissionSettings {
  /** Preset được ghim vào phiên mới tạo. */
  defaultPreset: string;
}

/** Cấu hình của {@link PermissionPresetService}: bảng preset và mặc định thành phần. */
export interface Config {
  /**
   * Bảng preset: tên → bộ hai núm. Bỏ trống thì dùng `workspace-write` (workspace-write + ask) và
   * `danger-full-access` (danger-full-access + never). Hai tên `custom` và `auto` là tên DÀNH RIÊNG.
   */
  presets: Record<string, PresetSpec>;
  /** Mặc định cho phiên mới; bỏ trống thì dùng preset khớp mặc định sandbox + approval đã ghép. */
  defaultPreset: Volatile<string | undefined>;
}

/** Một sự kiện phiên đã cam kết, khai theo CẤU TRÚC: chỉ hai trường mà phép gộp đọc. */
export interface PermissionSessionEvent {
  /** Loại sự kiện (`permission/preset` · `sandbox/mode` · `approval/policy` · `session/end-seed` · …). */
  type: string;
  /** Thân sự kiện; từng nhánh `switch` tự khai hình dạng nó đọc. */
  data: unknown;
}

/** Phiên mà service chạm tới, khai theo CẤU TRÚC: chỉ đường ghi sự kiện bền. */
export interface PermissionSession {
  /**
   * Ghi một sự kiện vào nhật ký phiên.
   * Nhận: loại sự kiện và thân sự kiện.
   * Trả: không.
   */
  append(type: string, data: unknown): void;
}

/** Agent mà lệnh `/permission` chạm tới, khai theo CẤU TRÚC: phiên của nó là đích ghi. */
export interface PermissionAgent {
  /** Phiên của agent. */
  session: PermissionSession;
}

/** Kết quả một lần chạy lệnh người dùng: thành công hoặc lỗi, kèm câu hiển thị NGUYÊN VĂN. */
export type CommandOutcome = { kind: "success"; text: string } | { kind: "error"; text: string };

/** Định nghĩa một lệnh người dùng mà row đăng ký vào sổ lệnh của kernel. */
export interface CommandRegistration {
  /** Danh tính ổn định do plugin sở hữu (đóng thương hiệu bằng `CommandDefinitionId` của kernel). */
  definitionId: string;
  /** Tên lệnh người dùng gõ. */
  name: string;
  /** Mô tả một dòng hiện trong danh sách lệnh. */
  description: string;
  /** Gợi ý tham số cho khung nhập. */
  input: { hint: string };
  /**
   * Thân lệnh.
   * Nhận: agent gọi lệnh và chuỗi thô người dùng gõ.
   * Trả: kết cục kèm câu hiển thị.
   */
  handler(args: { agent: PermissionAgent; rawInput: string }): CommandOutcome;
}

/** Schema kiểm dữ liệu, khai theo CẤU TRÚC: chỉ cần `parse`, đúng phần seam `sessionProjections` dùng. */
export interface ProjectionSchema<T> {
  /**
   * Kiểm một giá trị chưa biết.
   * Nhận: giá trị cần kiểm.
   * Trả: giá trị đã kiểm, đúng kiểu `T`; ném khi không hợp lệ.
   */
  parse(value: unknown): T;
}

/** Khung nhìn dây của một đơn vị chiếu: schema của khung nhìn + hàm chiếu từ trạng thái. */
export interface ProjectionWire<State, View> {
  /** Schema kiểm khung nhìn trước khi rời host. */
  viewSchema: ProjectionSchema<View>;
  /**
   * Chiếu trạng thái đã gộp thành khung nhìn trên dây.
   * Nhận: trạng thái đã gộp.
   * Trả: khung nhìn sẽ phát.
   */
  view(state: State): View;
}

/** Một đơn vị chiếu mà seam `sessionProjections` nhận. */
export interface ProjectionDefinition<State, View> {
  /** Khoá chiếu mà đơn vị này sở hữu. */
  key: string;
  /** Phiên bản trạng thái lưu; tăng khi hình dạng hoặc nghĩa của phép gộp đổi. */
  stateVersion: number;
  /** Schema kiểm trạng thái đã lưu trước khi mồi phép gộp. */
  stateSchema: ProjectionSchema<State>;
  /**
   * Trạng thái cho log rỗng.
   * Nhận: không (seam thật truyền header + số sự kiện thừa kế; bản gốc bỏ qua cả hai).
   * Trả: trạng thái ban đầu — vật thể MỚI mỗi lần gọi.
   */
  init(): State;
  /**
   * Phép gộp THUẦN: trạng thái trước + một sự kiện ⇒ trạng thái sau.
   * Nhận: trạng thái trước và một sự kiện đã cam kết.
   * Trả: trạng thái sau — GIỮ NGUYÊN tham chiếu khi sự kiện không liên quan.
   */
  apply(state: State, event: PermissionSessionEvent): State;
  /** Khung nhìn dây của đơn vị chiếu. */
  wire: ProjectionWire<State, View>;
}

/** Seam `sessionProjections`: nơi row đăng ký đơn vị chiếu và đọc trạng thái đã gộp. */
export interface SessionProjectionsSeam {
  /**
   * Đăng ký một đơn vị chiếu.
   * Nhận: định nghĩa đơn vị.
   * Trả: hàm dọn do seam cấp.
   */
  register(definition: ProjectionDefinition<PermissionProjectionState, PermissionSelection>): unknown;
  /**
   * Đọc trạng thái đã gộp của MỘT khoá cho một phiên.
   * Nhận: phiên và khoá chiếu.
   * Trả: trạng thái hiện tại, hoặc `undefined` khi khoá chưa đăng ký.
   */
  stateOf(session: PermissionSession, key: string): PermissionProjectionState | undefined;
}

/** Seam `shell`: nguồn của chế độ sandbox hiệu lực của deployment. */
export interface ShellSeam {
  /** Chế độ sandbox mà executor đã mount báo; `undefined` nghĩa là executor KHÔNG cưỡng chế. */
  sandboxMode: SandboxMode | undefined;
}

/** Seam `approval`: nguồn của chính sách duyệt mặc định và đường đổi chính sách của agent sống. */
export interface ApprovalSeam {
  /** Cấu hình của seam duyệt; `policy` là mặc định của deployment. */
  config: { policy?: ApprovalPolicy };
  /**
   * Đổi chính sách của một agent đang sống.
   * Nhận: agent và chính sách mới.
   * Trả: không.
   */
  setPolicy(agent: PermissionAgent, policy: ApprovalPolicy): void;
}

/** Seam `sessions`: sổ phiên đang sống — nguồn của lượt ghim lúc mount. */
export interface SessionsSeam {
  /**
   * Liệt kê phiên đang sống.
   * Nhận: không.
   * Trả: dãy phiên, theo thứ tự sổ.
   */
  list(): Iterable<PermissionSession>;
}

/** Seam `settings`: thiết lập người dùng, nơi row khai namespace `permission` là không-tự-động. */
export interface SettingsSeam {
  /**
   * Khai cấu hình của namespace `permission` do row sở hữu.
   * Nhận: giá trị cấu hình (ở đây: `{ auto: false }`) và fiber sở hữu.
   * Trả: disposer gỡ khai báo (cordis dùng chính hàm này làm thân effect của namespace).
   */
  configure(value: { auto: boolean }, fiber: unknown): () => void;
}

/** Seam `commands`: sổ lệnh người dùng của kernel. */
export interface CommandsSeam {
  /**
   * Đăng ký một lệnh người dùng.
   * Nhận: định nghĩa lệnh.
   * Trả: hàm dọn do seam cấp.
   */
  register(definition: CommandRegistration): unknown;
}

/** Seam kênh sự kiện cordis: phát một sự kiện và trả danh sách người nghe đã khớp. */
export interface EventsSeam {
  /**
   * Giải người nghe cho MỘT lượt phát.
   * Nhận: kiểu phát (`emit` · …) và danh sách tham số thô (tên sự kiện là phần tử đầu).
   * Trả: các callback người nghe đã lọc theo context.
   */
  dispatch(type: string, args: unknown[]): ((...args: unknown[]) => unknown)[];
}

/** Seam logger của kernel: row chỉ dùng `warn` cho người nghe hỏng. */
export interface LoggerSeam {
  /**
   * Ghi một cảnh báo.
   * Nhận: câu cảnh báo.
   * Trả: không.
   */
  warn(message: string): void;
}

/** Mọi seam mà row này chạm, gom về MỘT hình dạng để đọc từ context cordis. */
export interface PermissionSeams {
  /** Nguồn chế độ sandbox của deployment. */
  shell: ShellSeam;
  /** Nguồn chính sách duyệt + đường đổi chính sách agent. */
  approval: ApprovalSeam;
  /** Sổ phiên đang sống. */
  sessions: SessionsSeam;
  /** Sổ chiếu phiên. */
  sessionProjections: SessionProjectionsSeam;
  /** Kênh sự kiện cordis. */
  events: EventsSeam;
  /** Logger của kernel. */
  logger: LoggerSeam;
  /**
   * Đăng ký người nghe sự kiện cordis (disposer đi theo fiber).
   * Nhận: tên sự kiện và người nghe.
   * Trả: giá trị seam trả (không dùng tới).
   */
  on(name: string, listener: (...args: unknown[]) => unknown): unknown;
}

/**
 * Đọc các seam của miền quyền từ một context cordis — CÙNG thể hiện, chỉ đổi kiểu.
 * Nhận: `ctx` — context cordis mà service đang chạy trên đó.
 * Trả: chính context ấy, mang kiểu {@link PermissionSeams}.
 */
export function seamsOf(ctx: Context): PermissionSeams {
  return ctx as unknown as PermissionSeams;
}

declare module "@deepseek-ai/cordis" {
  interface Context {
    /** Nhà preset quyền của deployment. */
    permissionPresets: PermissionPresetService;
  }

  interface Events {
    /**
     * Catalog preset chọn được đã đổi. KHÔNG payload theo thiết kế: bên tiêu thụ đăng ký trước,
     * rồi đọc lại TOÀN BỘ catalog.
     * @mode emit
     */
    "permission-presets/catalog-changed"(): void;
  }
}
