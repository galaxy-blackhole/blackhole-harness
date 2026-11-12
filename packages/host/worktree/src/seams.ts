/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hình dạng HỢP ĐỒNG của năm seam mà row worktree dùng (fs · subprocess · sandbox ·
 *      sandboxPolicy · workingDirectory) — khai theo CẤU TRÚC, KHÔNG import gói seam nào.
 */

import type { Context } from "@deepseek-ai/cordis";

/**
 * Chế độ hiệu ứng tệp mà một lần thi hành chạy dưới — nguyên văn từ điển của seam sandbox.
 * "danger-full-access" nghĩa là KHÔNG bọc; hai chế độ còn lại phải đi qua seam sandbox.
 */
export type SandboxModeLike = "read-only" | "workspace-write" | "danger-full-access";

/** Chính sách hiệu ứng tệp ĐÃ GIẢI cho một lượt gọi — phần mà row này đọc và chuyển tiếp. */
export interface SandboxExecutionPolicyLike {
  /** Chế độ hiệu ứng tệp của lần thi hành này. */
  readonly mode: SandboxModeLike;
  /** Gốc tuyệt đối mà chế độ workspace-write được ghi dưới. */
  readonly workspaceRoot: string;
  /** Danh tính (đục) của phiên gọi; vắng ở lượt gọi không có phiên. */
  readonly sessionId?: unknown;
}

/** Yêu cầu giải chính sách cho MỘT lượt gọi. */
export interface SandboxPolicyRequestLike {
  /** Phiên gọi; thư mục bất biến của nó trở thành ranh giới workspace. */
  readonly session?: SessionLike;
}

/** Seam chính sách sandbox ("ctx.sandboxPolicy") — đúng một lời gọi mà row này dùng. */
export interface SandboxPolicySeam {
  /**
   * Giải chính sách đầy đủ cho một lượt gọi.
   * Nhận: yêu cầu tuỳ chọn (phiên gọi).
   * Trả: chế độ + gốc workspace đã giải.
   */
  resolve(request?: SandboxPolicyRequestLike): SandboxExecutionPolicyLike;
}

/** Kết quả bọc một argv qua seam sandbox — row này chỉ dùng argv đã bọc. */
export interface ConfinedArgvLike {
  /** argv thay thế (runner, hồ sơ, dấu phân cách, rồi argv của bên gọi). */
  readonly argv: string[];
}

/** Seam sandbox ("ctx.sandbox") — đúng một lời gọi mà row này dùng. */
export interface SandboxSeam {
  /**
   * Bọc argv để chạy dưới chính sách đã cho trên máy này; phải TRẢ argv cưỡng chế hoặc NÉM (đóng an toàn).
   * Nhận: argv cần chạy, chính sách cưỡng chế đầy đủ, tín hiệu huỷ.
   * Trả: argv đã bọc kèm sự thật cưỡng chế.
   */
  confine(
    argv: readonly string[],
    policy: SandboxExecutionPolicyLike & { mode: Exclude<SandboxModeLike, "danger-full-access"> },
    signal?: AbortSignal,
  ): Promise<ConfinedArgvLike>;
}

/** Đích đã giải của seam fs — với row này là vật mang KHÔNG trong suốt. */
export interface FsTargetLike {
  /** Khoá đích ổn định do backend cấp; row này chỉ chuyển tiếp, không đọc. */
  readonly targetKey: string;
}

/** Siêu dữ liệu CẤP ĐƯỜNG DẪN (không đi theo symlink ở thành phần cuối). */
export interface FsPathInfoLike {
  /** Loại mục đường dẫn: tệp thường, thư mục, symlink, hay loại khác. */
  readonly type: string;
}

/** Seam hệ tệp ("ctx.fs") — đúng ba lời gọi mà row này dùng. */
export interface FsSeam {
  /**
   * Giải một đường dẫn thành đích ổn định (có thể đi theo symlink).
   * Nhận: đường dẫn + tuỳ chọn (cwd làm gốc tương đối, tín hiệu huỷ).
   * Trả: đích ổn định.
   */
  resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<FsTargetLike>;
  /**
   * Đường dẫn tuyệt đối mà một tiến trình trong thế giới thi hành này mở được.
   * Nhận: đích đã giải.
   * Trả: đường dẫn tuyệt đối.
   */
  processPath(target: FsTargetLike): string;
  /**
   * Đọc siêu dữ liệu của một đường dẫn mà KHÔNG đi theo symlink ở thành phần cuối.
   * Nhận: đường dẫn, tuỳ chọn (cwd), tín hiệu huỷ.
   * Trả: siêu dữ liệu, hoặc undefined khi đường dẫn KHÔNG tồn tại.
   */
  lstat(path: string, opts?: { cwd?: string }, signal?: AbortSignal): Promise<FsPathInfoLike | undefined>;
}

/** Một lần đọc tăng dần của một luồng đã thu. */
export interface SubprocessOutputReadLike {
  /** Chữ của luồng tính từ offset đã yêu cầu (cả đuôi giữ lại khi lossy). */
  readonly text: string;
  /** Offset toàn luồng để đọc tiếp. */
  readonly nextOffset: number;
  /** true khi offset yêu cầu đã trượt khỏi cửa sổ đuôi trong bộ nhớ. */
  readonly lossy: boolean;
  /** Đường dẫn tệp tràn giữ luồng đầy đủ, khi có. */
  readonly spillPath?: string;
}

/** Đọc tăng dần một luồng đã thu, neo theo offset do bên gọi sở hữu. */
export interface SubprocessOutputReaderLike {
  /**
   * Đọc mọi thứ đã thu từ một offset.
   * Nhận: offset toàn luồng (0 cho lần đọc đầu).
   * Trả: chữ của phần tăng thêm, offset kế tiếp, cờ lossy, và đường dẫn tệp tràn khi có.
   */
  readFrom(fromByte: number): SubprocessOutputReadLike;
}

/** Sự thật kết thúc của một tiến trình đã đóng — từ vựng sự kiện close của Node. */
export interface SubprocessOutcomeLike {
  /** Mã thoát; null khi tiến trình chết vì tín hiệu. */
  readonly exitCode: number | null;
  /** Tín hiệu kết thúc (ví dụ SIGTERM); null khi thoát bình thường. */
  readonly signal: string | null;
}

/** Tay nắm một tiến trình sống và dải tiến trình do nhà cung cấp quản lý. */
export interface SubprocessHandleLike {
  /** Bộ đọc theo offset cho các luồng ở chế độ thu (vẫn đọc được sau khi thoát). */
  readonly collected: {
    /** Có mặt khi stdout ở chế độ thu. */
    readonly stdout?: SubprocessOutputReaderLike;
    /** Có mặt khi stderr ở chế độ thu. */
    readonly stderr?: SubprocessOutputReaderLike;
  };
  /** Kết thúc bằng sự thật thoát của lệnh đã spawn; ném khi spawn/nhà cung cấp hỏng. */
  readonly done: Promise<SubprocessOutcomeLike>;
  /** Bắt đầu quy trình kết thúc của nhà cung cấp trên dải đã quản lý (bất biến, idempotent). */
  terminate(): void;
  /**
   * Chờ tới khi dải đã quản lý rỗng (không chỉ khi lệnh đã báo thoát).
   * Nhận: tín hiệu chặn chờ tuỳ chọn.
   * Trả: true khi dải rỗng, false khi tín hiệu huỷ trước.
   */
  waitForExit(signal?: AbortSignal): Promise<boolean>;
}

/** Một yêu cầu spawn đã đặc tả đầy đủ — seam này KHÔNG áp mặc định nào. */
export interface SubprocessSpawnSpecLike {
  /** Tệp thi hành và tham số; argv[0] là chương trình, không bao giờ qua shell. */
  readonly argv: readonly string[];
  /** Thư mục làm việc của tiến trình con. */
  readonly cwd: string;
  /** Cách xử lý từng luồng stdio. */
  readonly stdio: {
    /** Cách xử lý stdin ("ignore" để fd 0 trỏ /dev/null). */
    readonly stdin: "ignore" | "pipe" | { readonly data: string };
    /** Cách xử lý stdout (đối tượng thu giới hạn số byte). */
    readonly stdout: "pipe" | "inherit" | { readonly maxBytes: number };
    /** Cách xử lý stderr (đối tượng thu giới hạn số byte). */
    readonly stderr: "pipe" | "inherit" | { readonly maxBytes: number };
  };
  /** Thời gian ân hạn kết thúc (ms). */
  readonly graceMs: number;
  /** Tín hiệu huỷ — bắt đầu quy trình kết thúc dải đã quản lý khi phát. */
  readonly signal?: AbortSignal | undefined;
  /** Biến môi trường ghi đè, trộn lên nền đã khử credential của nhà cung cấp. */
  readonly env?: Record<string, string | undefined> | undefined;
}

/** Seam tiến trình con ("ctx.subprocess") — đúng hai lời gọi mà row này dùng. */
export interface SubprocessSeam {
  /**
   * Phân giải một tệp thi hành trong thế giới thi hành của nhà cung cấp.
   * Nhận: đường dẫn tuyệt đối hoặc tên trần trên PATH, biến môi trường cho lượt tra, tín hiệu huỷ.
   * Trả: đường dẫn tệp thi hành đã chuẩn hoá.
   */
  resolveExecutable(command: string, env?: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<string>;
  /**
   * Khởi động một tiến trình con được quản lý từ spec đã đặc tả đầy đủ.
   * Nhận: spec (argv, thư mục, stdio, ân hạn, huỷ, môi trường).
   * Trả: tay nắm sống của tiến trình.
   */
  spawn(spec: SubprocessSpawnSpecLike): SubprocessHandleLike;
}

/** Phiên — với row này là vật mang ĐỤC: chỉ chuyển tiếp cho seam chính sách sandbox. */
export interface SessionLike {
  /** Định danh phiên (đục với row này). */
  readonly id?: unknown;
}

/** Agent sở hữu phiên — đúng phần row này chạm tới. */
export interface AgentLike {
  /** Phiên mà agent sở hữu; thư mục hiện tại của nó chọn repo nguồn và chính sách tệp. */
  readonly session: SessionLike;
}

/** Seam thư mục làm việc của phiên ("ctx.workingDirectory") — đúng hai lời gọi mà row này dùng. */
export interface WorkingDirectorySeam {
  /**
   * Kiểm thư mục đã ghi bền còn tồn tại và khôi phục dự án gốc khi nó đã biến mất.
   * Nhận: agent sở hữu phiên, tín hiệu huỷ.
   * Trả: đường dẫn tuyệt đối đang tồn tại (đã commit trước khi trả).
   */
  ensure(agent: AgentLike, signal?: AbortSignal): Promise<string>;
  /**
   * Đổi thư mục của một phiên mà không đổi tiến trình đang chạy hay quyền ghi.
   * Nhận: agent sở hữu phiên, đường dẫn tuyệt đối, tín hiệu huỷ.
   * Trả: đường dẫn tuyệt đối đã chuẩn hoá (đã commit trước khi trả).
   */
  set(agent: AgentLike, path: string, signal?: AbortSignal): Promise<string>;
}

/** Năm seam của context mà plugin này dùng, khai trên MỘT hình dạng. */
export interface WorktreeSeams {
  /** Hệ tệp của thế giới thi hành. */
  readonly fs: FsSeam;
  /** Nhà cung cấp tiến trình con của thế giới thi hành. */
  readonly subprocess: SubprocessSeam;
  /** Nhà cung cấp cưỡng chế tiến trình. */
  readonly sandbox: SandboxSeam;
  /** Chủ sở hữu chính sách hiệu ứng tệp của deployment + của từng phiên. */
  readonly sandboxPolicy: SandboxPolicySeam;
  /** Chủ sở hữu thư mục hiệu lực của từng phiên. */
  readonly workingDirectory: WorkingDirectorySeam;
}

/**
 * Nhìn context host qua hình dạng năm seam mà row này dùng.
 * Nhận: context cordis (thật, do kernel cấp).
 * Trả: CHÍNH context đó — không tạo thể hiện mới, không đăng ký gì; chỉ thu hẹp kiểu để khỏi import
 *       gói seam, và giữ nguyên tính ĐỘNG của phép tra service (đọc lúc gọi, không chụp lúc apply).
 */
export function seamsOf(ctx: Context): WorktreeSeams {
  return ctx as unknown as WorktreeSeams;
}
