/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Dọn tiến trình PTC BẤT ĐỒNG BỘ khi phiên đổi chính sách tệp, không làm chậm setter quyền — port 1:1
 *      vùng policy-processes của @deepseek-ai/dsh-ptc-runtime-node (index.js 726–794)
 */

/* Node PTC process invalidation after a committed Session file-policy change. */

/* Ba kiểu dưới đây là bản TỐI THIỂU của peer KHÔNG được cài thật trong gói (`node_modules` chỉ là
   symlink chưa commit, import thật sẽ là TS2307): SessionId (@deepseek-ai/dsh-session) · SandboxMode +
   SandboxExecutionPolicy (@deepseek-ai/dsh-sandbox). Kèm theo là hình dạng tối thiểu của Context
   (cordis), sessions service và sự kiện 'sandbox/mode'. */

/** Id phiên (bản gốc là `SessionId` có brand của @deepseek-ai/dsh-session). */
type SessionId = string;

/** Chế độ hiệu ứng tệp (bản gốc: `SandboxMode` của @deepseek-ai/dsh-sandbox). */
type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

/** Phiên tối thiểu mà policy cần: chỉ danh tính (bản gốc: `Session`). */
interface SessionLike {
  /** Danh tính phiên. */
  readonly id: SessionId;
}

/** Chính sách thực thi tệp đã chốt cho một lần gọi (bản gốc: `SandboxExecutionPolicy`). */
interface SandboxExecutionPolicy {
  /** Chế độ hiệu ứng tệp của lần chạy này. */
  readonly mode: SandboxMode;
  /** Thư mục gốc tuyệt đối mà `workspace-write` được ghi trong đó. */
  readonly workspaceRoot: string;
  /** Danh tính phiên gọi; vắng mặt với lần gọi không thuộc phiên nào. */
  readonly sessionId?: SessionId;
}

/** Sự kiện phiên tối thiểu: chỉ nhánh `sandbox/mode` được đọc ở đây. */
interface SessionEventLike {
  /** Loại sự kiện; chỉ `sandbox/mode` mới hành động. */
  readonly type: string;
  /** Dữ liệu sự kiện; nhánh `sandbox/mode` mang `mode`. */
  readonly data: { readonly mode?: SandboxMode } & Record<string, unknown>;
}

/** Dịch vụ `sessions` tối thiểu: tra phiên theo id (bản gốc: `ctx.sessions`). */
interface SessionsLike {
  /** Trả phiên theo id, hoặc `undefined` khi không có. */
  get(id: SessionId): SessionLike | undefined;
}

/** Một tiến trình/lời gọi đang được theo dõi cho tới khi chủ sở hữu xác nhận đã dọn. */
interface TrackedProcess {
  /** Phiên sở hữu tiến trình. */
  sessionId: SessionId;
  /** Chế độ tệp tại thời điểm nhận vào (để so với sự kiện sau đó). */
  mode: SandboxMode;
  /** Huỷ idempotent + chờ dọn xong. */
  release: () => Promise<void>;
  /** Đã bị đánh dấu vô hiệu bởi một lần đổi chính sách. */
  invalidated: boolean;
  /** Lần dọn đang chạy (dùng lại khi gọi lặp). */
  cleanup?: Promise<void>;
}

/** Context tối thiểu của cordis mà lớp này dùng (on · effect · get · sandboxPolicy · logger). */
interface ProviderContext {
  /** Đăng ký listener sự kiện; `global` bỏ qua bộ lọc context. */
  on(event: string, listener: (session: SessionLike, event: SessionEventLike) => void, options?: { readonly global?: boolean }): unknown;
  /** Đăng ký hiệu ứng dọn dẹp theo vòng đời plugin. */
  effect(execute: () => () => Promise<void>, label?: string): unknown;
  /** Lấy service theo tên. */
  get(name: "sessions"): SessionsLike | undefined;
  /** Dịch vụ chính sách sandbox của deployment. */
  readonly sandboxPolicy: { resolve(request?: { readonly session?: SessionLike }): SandboxExecutionPolicy };
  /** Logger của context. */
  readonly logger: { warn(error: unknown): unknown };
}

/**
 * Owns asynchronous process cleanup without delaying permission setters.
 * Nhận: không (lớp).
 * Trả: không (lớp).
 */
export class PolicyProcesses {
  private readonly ctx: ProviderContext;
  private readonly processes = new Set<TrackedProcess>();

  /**
   * Begin cleanup on policy changes, even when no subsequent program runs.
   * Nhận: ctx — vòng đời provider Node + các service phiên.
   * Trả: không.
   */
  constructor(ctx: ProviderContext) {
    this.ctx = ctx;
    ctx.on("session/event", (session, event) => {
      if (event.type !== "sandbox/mode") return;
      for (const process of this.processes) {
        if (process.sessionId !== session.id || process.mode === event.data.mode) continue;
        process.invalidated = true;
        this.release(process).catch((error) => {
          ctx.logger.warn(error);
        });
      }
    }, { global: true });
    ctx.effect(() => async () => {
      await this.settle([...this.processes]);
    }, "Node PTC policy cleanup");
  }

  /**
   * Track an admitted call or retained process until its owner confirms cleanup.
   * Nhận: policy — chính sách tiến trình đã chốt (kèm danh tính phiên tùy chọn); release — huỷ
   *   idempotent + chờ dọn xong.
   * Trả: () => void — hàm gỡ theo dõi sau khi dọn xong; không theo dõi gì khi policy không có phiên.
   */
  register(policy: SandboxExecutionPolicy, release: () => Promise<void>): () => void {
    if (policy.sessionId === undefined) return () => {};
    const session = this.ctx.get("sessions")?.get(policy.sessionId);
    const process: TrackedProcess = {
      sessionId: policy.sessionId,
      mode: session === undefined ? policy.mode : this.ctx.sandboxPolicy.resolve({ session }).mode,
      release,
      invalidated: false
    };
    this.processes.add(process);
    return () => {
      this.processes.delete(process);
    };
  }

  /**
   * Wait for invalidated processes before admitting another program.
   * Nhận: sessionId — phiên mà policy đã chốt mang theo.
   * Trả: Promise<void> — xong khi các lần dọn TRƯỚC hoàn tất; lỗi thì reject và vẫn gọi lại được.
   */
  async wait(sessionId: SessionId | undefined): Promise<void> {
    await this.settle([...this.processes].filter((process) => process.sessionId === sessionId && process.invalidated));
  }

  /**
   * Dọn một tiến trình, dùng lại lần dọn đang chạy nếu có (idempotent).
   * Nhận: process — bản ghi đang theo dõi.
   * Trả: Promise<void> — xong khi `release` của chủ sở hữu hoàn tất và bản ghi đã được gỡ.
   */
  private release(process: TrackedProcess): Promise<void> {
    if (process.cleanup !== undefined) return process.cleanup;
    process.cleanup = process.release().then(() => {
      this.processes.delete(process);
    }, (error) => {
      delete process.cleanup;
      throw error;
    });
    return process.cleanup;
  }

  /**
   * Chờ mọi lần dọn của một tập tiến trình; ném lỗi ĐẦU TIÊN bị reject.
   * Nhận: processes — các bản ghi cần dọn.
   * Trả: Promise<void> — xong khi tất cả settled; reject theo lỗi đầu tiên.
   */
  private async settle(processes: TrackedProcess[]): Promise<void> {
    const failed = (await Promise.allSettled(processes.map((process) => this.release(process)))).find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }
}
