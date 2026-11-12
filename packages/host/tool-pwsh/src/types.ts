/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Seam CẤU TRÚC (ADR 000d) cho tool-pwsh: hình dạng shell · jobs · sandbox-policy · agent · exec
 *      mà bundle gốc @deepseek-ai/dsh-tool-pwsh chạm tới. Chỉ là KIỂU lúc biên dịch — không có mã chạy,
 *      không augment module, không đổi một byte hành vi nào của vùng logic.
 */

import type { SandboxMode } from "@deepseek-ai/dsh-sandbox";

/** Một chế độ sandbox của kernel ("read-only" · "workspace-write" · "danger-full-access") — NGUYÊN VĂN `SandboxMode` của @deepseek-ai/dsh-sandbox. */
export type { SandboxMode };

/** Sự kiện sandbox của MỘT lần chạy — hình dạng NGUYÊN VĂN `ShellSandboxInfo` của @deepseek-ai/dsh-shell. */
export interface SandboxFacts {
  /** Chế độ lệnh THỰC SỰ chạy dưới. */
  readonly mode: SandboxMode;
  /** Sandbox có chặn một thao tác tệp hay không. */
  readonly denied: boolean;
  /** Mức thi hành đã đạt được, khi runner báo. */
  readonly enforcement?: string;
  /** Runner sandbox tự hỏng TRƯỚC khi lệnh chạy. */
  readonly runnerFailed?: boolean;
}

/** Một luồng đã thu của lần chạy — hình dạng NGUYÊN VĂN `CollectedOutput` của seam subprocess. */
export interface CollectedOutput {
  /** Chữ đã thu (đã cắt về đuôi khi vượt trần). */
  readonly text: string;
  /** Chữ đã bị cắt bớt hay không. */
  readonly truncated: boolean;
  /** Đường dẫn tệp chứa toàn bộ luồng, khi có. */
  readonly spillPath?: string;
}

/** Kết quả MỘT lần chạy tiền cảnh — hình dạng NGUYÊN VĂN `ShellRunResult` của @deepseek-ai/dsh-shell. */
export interface ShellRunResult {
  /** Mã thoát; null khi hết hạn lúc chuẩn bị hoặc chết vì tín hiệu. */
  readonly exitCode: number | null;
  /** Tín hiệu kết thúc, hoặc null khi không có. */
  readonly signal: string | null;
  /** Hạn chót của executor là nguyên nhân ĐẦU TIÊN cắt lệnh. */
  readonly timedOut: boolean;
  /** Tín hiệu của bên gọi là nguyên nhân ĐẦU TIÊN giết lệnh. */
  readonly aborted: boolean;
  /** Hạn chót hiệu lực của lần chạy (ms). */
  readonly timeoutMs: number;
  /** Toàn văn stdout đã thu. */
  readonly stdout: CollectedOutput;
  /** Toàn văn stderr đã thu. */
  readonly stderr: CollectedOutput;
  /** Sự kiện sandbox, vắng mặt với executor không giam. */
  readonly sandbox?: SandboxFacts;
}

/** Một lần đọc không tiêu thụ trên luồng đã thu — hình dạng `SubprocessOutputRead`. */
export interface SubprocessOutputRead {
  /** Chữ của lần đọc này. */
  readonly text: string;
  /** Offset tuyệt đối cho lần đọc kế tiếp. */
  readonly nextOffset: number;
  /** Có byte nào bị mất giữa chừng hay không. */
  readonly lossy: boolean;
}

/** Đầu đọc offset không tiêu thụ — hình dạng `SubprocessOutputReader`. */
export interface SubprocessOutputReader {
  /**
   * Đọc từ một offset tuyệt đối.
   * Nhận: fromByte — offset bắt đầu (0 = đầu vùng còn giữ).
   * Trả: chữ của lần đọc, offset kế tiếp và cờ mất dữ liệu.
   */
  readFrom(fromByte: number): SubprocessOutputRead;
}

/**
 * Handle tiến trình nền mà `ctx.shell.execute()` trả — hình dạng NGUYÊN VĂN `ShellProcess`
 * (bundle gốc chỉ dùng đúng những thành viên dưới đây).
 */
export interface ProcessHandle {
  /** Trạng thái vòng đời (chốt đúng một lần). */
  readonly status: "running" | "completed" | "killed";
  /** Mã thoát khi đã xong (null = bị giết bởi tín hiệu / còn chạy). */
  readonly exitCode: number | null;
  /** Tên tín hiệu giết, khi bị giết bởi tín hiệu. */
  readonly signal: string | null;
  /** Xong khi tiến trình chốt (không bao giờ reject). */
  readonly done: Promise<void>;
  /** Sự kiện sandbox, đóng dấu khi tiến trình bị giam đã chốt. */
  readonly sandbox?: SandboxFacts;
  /** Hai đầu đọc offset KHÔNG tiêu thụ trên cùng hai luồng đã thu. */
  readonly observed: {
    /** Đầu đọc stdout. */
    readonly stdout: SubprocessOutputReader;
    /** Đầu đọc stderr (kèm câu lỗi spawn khi spawn bị từ chối). */
    readonly stderr: SubprocessOutputReader;
  };
  /**
   * Giết tiến trình.
   * Nhận: không.
   * Trả: true khi tín hiệu đã được gửi.
   */
  kill(): boolean;
  /**
   * Chờ kết quả cuối của tiến trình.
   * Nhận: không.
   * Trả: kết quả một lần chạy đã chốt.
   */
  result(): Promise<ShellRunResult>;
}

/** Chính sách sandbox đã phân giải cho MỘT lời gọi — hình dạng `SandboxExecutionPolicy`. */
export interface SandboxExecutionPolicy {
  /** Chế độ hiệu lực của lời gọi này. */
  readonly mode: SandboxMode;
  /** Các trường khác của policy (do kernel sở hữu). */
  readonly [key: string]: unknown;
}

/** Yêu cầu chạy lệnh của consumer — hình dạng NGUYÊN VĂN `ShellExecRequest`. */
export interface ShellExecRequest {
  /** Chữ lệnh. */
  readonly command: string;
  /** Thư mục làm việc ghi đè. */
  readonly workdir?: string | undefined;
  /** Hạn chót ghi đè (ms). */
  readonly timeoutMs?: number | undefined;
  /** Chính sách khi hết hạn chót. */
  readonly onExpiry?: "kill" | "none" | undefined;
  /** Snapshot `DSH_*` đã quản lý. */
  readonly dshEnv?: Record<string, string> | undefined;
  /** Chính sách sandbox đã phân giải cho lời gọi. */
  readonly sandboxPolicy?: SandboxExecutionPolicy | undefined;
  /** Tín hiệu huỷ của bên gọi. */
  readonly signal?: AbortSignal | undefined;
}

/** Spec đã phân giải mà `ctx.shell.resolve()` trả — hình dạng NGUYÊN VĂN `ShellExecSpec`. */
export interface ShellExecSpec {
  /** Chữ lệnh. */
  readonly command: string;
  /** Thư mục làm việc đã phân giải (luôn có). */
  readonly workdir: string;
  /** Hạn chót đã áp (ms). */
  readonly timeoutMs: number;
  /** Chính sách khi hết hạn chót. */
  readonly onExpiry: "kill" | "none";
  /** Snapshot `DSH_*` đã quản lý. */
  readonly dshEnv?: Record<string, string> | undefined;
  /** Chính sách sandbox đã phân giải. */
  readonly sandboxPolicy?: SandboxExecutionPolicy | undefined;
  /** Tín hiệu huỷ của bên gọi. */
  readonly signal?: AbortSignal | undefined;
}

/** Seam CẤU TRÚC của service `shell` — chỉ ba phép mà plugin này dùng. */
export interface ShellService {
  /** Chế độ sandbox mặc định của executor, undefined khi executor không giam. */
  readonly sandboxMode: SandboxMode | undefined;
  /**
   * Phủ mặc định/trần của implementation lên yêu cầu.
   * Nhận: request — yêu cầu của consumer.
   * Trả: spec đầy đủ để đưa cho execute().
   */
  resolve(request: ShellExecRequest): ShellExecSpec;
  /**
   * Chuẩn bị và spawn lệnh dưới hạn chót đã phân giải.
   * Nhận: spec — spec đã qua resolve().
   * Trả: handle tiến trình (đã chốt sẵn nếu hết hạn lúc chuẩn bị).
   */
  execute(spec: ShellExecSpec): Promise<ProcessHandle>;
}

/** Seam CẤU TRÚC của service `sandboxPolicy` — chỉ phép phân giải chính sách đứng. */
export interface SandboxPolicyService {
  /**
   * Phân giải chính sách đứng cho MỘT lời gọi.
   * Nhận: exec — chủ thể (`{}` khi lời gọi không có agent, ngược lại `{ session }`).
   * Trả: policy đã phân giải, hoặc undefined khi không có gì để phân giải.
   */
  resolve(exec: { session?: unknown }): SandboxExecutionPolicy | undefined;
}

/** Kết cục terminal của một job — hình dạng NGUYÊN VĂN `JobOutcome`. */
export interface JobOutcome {
  /** Trạng thái chốt của job. */
  readonly status: "completed" | "killed" | "failed";
  /** Câu mô tả một dòng cho roster/status. */
  readonly detail: string;
}

/** Một lần đọc nguồn pull của job — hình dạng `JobSourceRead`. */
export interface JobSourceRead {
  /** Chữ đọc được. */
  readonly text: string;
  /** Offset tuyệt đối của lần đọc kế tiếp. */
  readonly nextOffset: number;
  /** Có byte nào bị mất hay không. */
  readonly lossy: boolean;
}

/** Nguồn pull mà job đăng ký — hình dạng NGUYÊN VĂN `JobOutputSource`. */
export interface JobOutputSource {
  /** Luồng nguồn. */
  readonly channel: "stdout" | "stderr";
  /**
   * Đọc từ offset tuyệt đối.
   * Nhận: fromByte — offset bắt đầu.
   * Trả: chữ, offset kế tiếp và cờ mất dữ liệu.
   */
  read(fromByte: number): JobSourceRead;
}

/** Hook đồng bộ mà starter của job trả — hình dạng NGUYÊN VĂN `JobHooks`. */
export interface JobHooks {
  /** Chốt khi cả chuẩn bị lẫn tiến trình đã xong. */
  readonly done: Promise<JobOutcome>;
  /**
   * Huỷ job.
   * Nhận: reason — lý do huỷ, chuyển nguyên văn cho producer.
   * Trả: không.
   */
  cancel(reason: string): void;
}

/** Một mẩu vòng ring của job — hình dạng `JobChunk`. */
export interface JobChunk {
  /** Luồng của mẩu. */
  readonly channel: "stdout" | "stderr";
  /** Chữ của mẩu. */
  readonly text: string;
  /** Offset tuyệt đối của mẩu. */
  readonly at: number;
}

/** Hình chiếu MỘT job — hình dạng NGUYÊN VĂN `JobView`. */
export interface JobView {
  /** Trạng thái hiện tại. */
  readonly status: "running" | "stopping" | "completed" | "failed" | "killed";
  /** Câu mô tả terminal, khi đã chốt. */
  readonly detail?: string;
  /** Đầu ra mà job đang quảng cáo (đường dẫn spill). */
  readonly output: { readonly spillPaths?: readonly string[] };
}

/** Một lần đọc tiêu thụ của model — hình dạng NGUYÊN VĂN `JobRead`. */
export interface JobRead {
  /** Các mẩu kể từ con trỏ model. */
  readonly chunks: JobChunk[];
  /** Có byte nào bị đẩy khỏi ring trước khi đọc hay không. */
  readonly lossy: boolean;
  /** Hình chiếu job sau lần đọc. */
  readonly job: JobView;
}

/** Đặc tả đăng ký MỘT job — hình dạng NGUYÊN VĂN `JobSpec` (phần bundle gốc dùng). */
export interface JobSpec {
  /** Loại job. */
  readonly kind: string;
  /** Nhãn người đọc thấy. */
  readonly label: string;
  /** Danh tính lời gọi tool đã sinh ra job. */
  readonly toolCall: { readonly callId: string; readonly rootCallId: string };
  /** Chủ sở hữu (id phiên agent), khi có. */
  readonly owner?: string;
  /** Nguồn pull của job. */
  readonly output: JobOutputSource[];
  /**
   * Starter ĐỒNG BỘ: đăng ký xong mới spawn.
   * Nhận: không.
   * Trả: hook done/cancel của producer.
   */
  run(): JobHooks;
}

/** Seam CẤU TRÚC của service `jobs` — chỉ năm phép mà plugin này dùng. */
export interface JobRegistry {
  /**
   * Đăng ký một job.
   * Nhận: spec — đặc tả job.
   * Trả: id do registry cấp.
   */
  start(spec: JobSpec): string;
  /**
   * Yêu cầu huỷ một job.
   * Nhận: id — job; caller — id phiên đọc; reason — lý do.
   * Trả: 'requested' khi còn sống, 'already-finished' khi đã chốt.
   */
  kill(id: string, caller?: string, reason?: string): "requested" | "already-finished";
  /**
   * Chờ job chốt hoặc hết hạn chờ (KHÔNG huỷ job).
   * Nhận: id — job; timeoutMs — chờ tối đa; caller — id phiên; signal — tín hiệu huỷ.
   * Trả: hình chiếu job tại lúc trả.
   */
  wait(id: string, timeoutMs: number, caller?: string, signal?: AbortSignal): Promise<JobView>;
  /**
   * Đọc tiêu thụ vòng ring từ con trỏ model.
   * Nhận: id — job; caller — id phiên.
   * Trả: các mẩu, cờ mất dữ liệu và hình chiếu job.
   */
  read(id: string, caller?: string): JobRead;
  /**
   * Bỏ một bản ghi đã chốt khỏi sổ.
   * Nhận: id — job; caller — id phiên.
   * Trả: không.
   */
  remove(id: string, caller?: string): void;
}

/** Seam CẤU TRÚC của service `systemPrompt` — chỉ mục + thứ tự mục. */
export interface SystemPromptService {
  /**
   * Đăng ký một mục prompt hệ thống.
   * Nhận: section — tên, thứ tự và chữ của mục.
   * Trả: không.
   */
  section(section: { readonly name: string; readonly order: number; readonly text: string }): void;
  /**
   * Tra thứ tự chuẩn của một mục đã đặt tên.
   * Nhận: name — tên mục (ví dụ "TOOL_PWSH").
   * Trả: số thứ tự của mục.
   */
  getSectionOrder(name: string): number;
}

/** Seam CẤU TRÚC của service `shellEnv` — chỉ phép thu snapshot `DSH_*`. */
export interface ShellEnvService {
  /**
   * Thu snapshot biến `DSH_*` cho MỘT lời gọi.
   * Nhận: exec — ngữ cảnh thi hành.
   * Trả: bản đồ tên → giá trị.
   */
  collect(exec: unknown): Record<string, string>;
}

/** Seam CẤU TRÚC của service `workingDirectory` — chỉ phép bảo đảm thư mục. */
export interface WorkingDirectoryService {
  /**
   * Bảo đảm agent có thư mục làm việc và trả đường dẫn tuyệt đối.
   * Nhận: agent — agent đang gọi; signal — tín hiệu huỷ.
   * Trả: đường dẫn tuyệt đối của thư mục làm việc.
   */
  ensure(agent: AgentLike, signal: AbortSignal): Promise<string>;
}

/** Agent gọi tool — chỉ hai trường mà plugin này đọc. */
export interface AgentLike {
  /** Id agent (cũng là id phiên sở hữu job). */
  readonly id: string;
  /** Phiên của agent (đi cùng chính sách sandbox). */
  readonly session: unknown;
}

/** Ngữ cảnh MỘT lời gọi tool — hình dạng NGUYÊN VĂN `ToolRunContext` (phần bundle gốc dùng). */
export interface ToolExec {
  /** Id lời gọi. */
  readonly callId: string;
  /** Id lời gọi gốc (khi lồng). */
  readonly rootCallId: string;
  /** Agent gọi, undefined khi lời gọi không có phiên. */
  readonly agent?: AgentLike;
  /** Tín hiệu huỷ của lời gọi. */
  readonly signal: AbortSignal;
}

/** Logger của cordis — chỉ mức warn mà plugin này dùng. */
export interface LoggerService {
  /**
   * Ghi cảnh báo.
   * Nhận: message — chữ cảnh báo.
   * Trả: không.
   */
  warn(message: string): void;
}

/** Fiber của plugin — chỉ trạng thái số mà bản gốc so với 2. */
export interface FiberLike {
  /** Mã trạng thái fiber (2 = disposed/UNLOADING theo bản gốc). */
  readonly state: number;
}

/** Ngữ cảnh con sau `ctx.inject(["jobs"], …)` — thêm service jobs và effect. */
export interface JobContext extends PwshContext {
  /** Service jobs vừa xuất hiện. */
  readonly jobs: JobRegistry;
  /**
   * Đăng ký dọn dẹp gắn với fiber của context con.
   * Nhận: callback — trả hàm dọn.
   * Trả: không.
   */
  effect(callback: () => () => void): unknown;
}

/** Ngữ cảnh cordis mà `apply` nhận — seam CẤU TRÚC của những service plugin này chạm. */
export interface PwshContext {
  /** Sổ công cụ. */
  readonly tools: { register(tool: unknown): () => void };
  /** Seam shell. */
  readonly shell: ShellService;
  /** Prompt hệ thống. */
  readonly systemPrompt: SystemPromptService;
  /** Sổ biến môi trường `DSH_*`. */
  readonly shellEnv: ShellEnvService;
  /** Thư mục làm việc của phiên. */
  readonly workingDirectory: WorkingDirectoryService;
  /** Logger. */
  readonly logger: LoggerService;
  /** Fiber của plugin. */
  readonly fiber: FiberLike;
  /**
   * Tra một service TUỲ CHỌN theo tên.
   * Nhận: name — tên service ("jobs" · "sandboxPolicy" · "approval").
   * Trả: service khi có, undefined khi vắng.
   */
  get(name: string): unknown;
  /**
   * Chạy callback khi các service phụ thuộc xuất hiện.
   * Nhận: deps — tên service cần; callback — nhận context con.
   * Trả: không.
   */
  inject(deps: readonly string[], callback: (ctx: JobContext) => void): void;
}

/** Tham số model gửi cho tool `pwsh` — hình dạng NGUYÊN VĂN của `parameters` trong bundle gốc. */
export interface PwshArgs {
  /** Mô tả ngắn việc lệnh làm (bắt buộc). */
  readonly description: string;
  /** Chữ lệnh PowerShell (bắt buộc). */
  readonly command: string;
  /** Hạn chót (ms) của riêng lời gọi. */
  readonly timeoutMs?: number;
  /** Thư mục làm việc ghi đè. */
  readonly workdir?: string;
  /** Chạy nền và trả id job ngay. */
  readonly run_in_background?: boolean;
  /** Chế độ sandbox xin escalate cho đúng lệnh này. */
  readonly sandbox_permissions?: string;
  /** Một câu giải thích vì sao cần quyền rộng hơn. */
  readonly justification?: string;
}

/** Giá trị canonical của một lời gọi TIỀN CẢNH — chiếu NGUYÊN VĂN `canonicalPwshResult`. */
export interface PwshForegroundResult extends ShellRunResult {
  /** Loại kết quả. */
  readonly kind: "foreground";
  /** Thư mục làm việc của lần chạy. */
  readonly cwd: string;
  /** Lý do lời gọi dừng job của chính nó, khi có. */
  readonly stopped?: string;
}

/** Giá trị canonical của một lời gọi ĐÃ CHUYỂN NỀN sau hạn chót — chiếu NGUYÊN VĂN trong bundle gốc. */
export interface PwshPromotedResult {
  /** Loại kết quả. */
  readonly kind: "promoted";
  /** Thư mục làm việc của lần chạy. */
  readonly cwd: string;
  /** Id job đã nhận lệnh. */
  readonly jobId: string;
  /** Hạn chót đã trôi qua (ms). */
  readonly timeoutMs: number;
  /** Chữ đã đọc được tính tới lúc chuyển nền. */
  readonly output: string;
}

/** Giá trị canonical của một lời gọi CHẠY NỀN — chiếu NGUYÊN VĂN trong bundle gốc. */
export interface PwshBackgroundResult {
  /** Loại kết quả. */
  readonly kind: "background";
  /** Id job đã nhận lệnh. */
  readonly jobId: string;
  /** Thư mục làm việc của lần chạy. */
  readonly cwd: string;
}

/** Hợp ba giá trị canonical mà `output.schema` của tool `pwsh` khai. */
export type PwshOutput = PwshForegroundResult | PwshPromotedResult | PwshBackgroundResult;