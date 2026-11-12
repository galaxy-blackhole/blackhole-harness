/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Plugin `workspace-changes`: chụp git đầu/cuối lượt + capture toàn tệp quanh mỗi lần tool sửa tệp,
 *      công bố sự kiện `workspace/changes` và phục vụ summary/diff qua service `workspaceChanges`
 *      — port 1:1 lib/types/index.js của @deepseek-ai/dsh-workspace-changes.
 */

import { homedir, tmpdir } from "node:os";
import z from "@deepseek-ai/schemastery";
import { GitRunner, type SubprocessRuntimeLike } from "./git.ts";
import { TurnRecorder } from "./recorder.ts";
import type { WorkspaceChanges, WorkspaceChangesSummary, WorkspaceFileDiff } from "./types.ts";

/**
 * Tên danh tính ổn định của bộ nạp — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: chuỗi `"workspace-changes"`.
 */
export const name = "workspace-changes";

/**
 * Các service dùng để chạy git, phân giải đích sửa, và quan sát lượt — NGUYÊN VĂN bản gốc.
 * Nhận: không.
 * Trả: mảng tên service theo đúng thứ tự phụ thuộc `["subprocess", "fs"]`.
 */
export const inject: string[] = ["subprocess", "fs"];

/** Cấu hình plugin: các trần của snapshot, capture, và so sánh. Giá trị không hợp lệ làm hỏng lúc nạp plugin. */
export interface Config {
  /** Số mili giây một lệnh git được chạy trước khi bản ghi của lượt bị bỏ. */
  timeoutMs: number;
  /** Số byte đầu ra git giữ lại mỗi lệnh; một danh sách diff lớn hơn sẽ bỏ bản ghi. */
  outputMaxBytes: number;
  /** Số tệp tối đa mang trong một bản tóm tắt; `total` vẫn báo con số đầy đủ. */
  maxFiles: number;
  /**
   * Số byte một tệp được phép có để được capture quanh một lần tool sửa tệp, hoặc để được đọc từ
   * snapshot cho phép so sánh của nó. Tệp lớn hơn không có phép so sánh; tệp được capture quanh một
   * lần tool sửa cũng chỉ được liệt kê mà không có số đếm.
   */
  maxFileBytes: number;
  /** Số mili giây một phép so sánh dòng được chạy trước khi hạ xuống thay-thế-toàn-tệp. */
  diffTimeoutMs: number;
}

/**
 * Schema Schemastery cho {@link Config} — NGUYÊN VĂN năm trường và giá trị mặc định của bản gốc.
 * Nhận: không (schema dựng một lần lúc nạp module).
 * Trả: schema xác thực cấu hình, mặc định 30000 · 8 MiB · 500 · 2 MiB · 100.
 */
export const Config: z<Config> = z.object({
  timeoutMs: z.number().default(30_000),
  outputMaxBytes: z.number().default(8 * 1024 * 1024),
  maxFiles: z.number().default(500),
  maxFileBytes: z.number().default(2 * 1024 * 1024),
  diffTimeoutMs: z.number().default(100),
}) as unknown as z<Config>;

/**
 * Định danh phiên — cùng hình dạng với mặt `./types` (thương hiệu TUỲ CHỌN, khai theo CẤU TRÚC
 * thay vì import `@deepseek-ai/dsh-session`).
 */
type SessionId = string & { readonly __sessionId?: "SessionId" };

/** Phần header phiên mà {@link eligible} đọc. */
interface SessionHeaderLike {
  /** Thư mục làm việc tuyệt đối của phiên, nếu có. */
  readonly cwd?: string;
  /** Dấu hiệu phiên được tạo như con của một uỷ nhiệm. */
  readonly origin?: "subagent";
  /** Độ sâu uỷ nhiệm: vắng (0) với phiên cấp cao nhất, độ sâu của cha + 1 với phiên con. */
  readonly delegationDepth?: number;
}

/** Phiên đang sống, chỉ phần plugin này đọc: danh tính, header, và đường ghi sự kiện bền cho recorder. */
interface WorkspaceChangesSession {
  /** Định danh phiên; khoá của bảng `byId`. */
  readonly id: SessionId;
  /** Header bền của phiên. */
  readonly header: SessionHeaderLike;
  /**
   * Nối MỘT sự kiện vào nhật ký phiên (recorder ghi `workspace/changes` qua đường này).
   * Nhận: loại sự kiện và thân sự kiện.
   * Trả: sự kiện đã cam kết, mang số thứ tự `seq`.
   */
  append(type: string, data: unknown): { readonly seq: number };
}

/** Một sự kiện đã cam kết của phiên, chỉ phần plugin này đọc. */
interface SessionEventLike {
  /** Loại sự kiện (`turn/start`, `turn/end`, `tool/result`, …). */
  readonly type: string;
  /** Số thứ tự của sự kiện trong nhật ký phiên. */
  readonly seq: number;
  /** Thân sự kiện; ba loại plugin quan tâm đều mang số lượt. */
  readonly data: { readonly turn: number };
}

/** Agent sở hữu phiên — chỉ phần plugin này đọc. */
interface AgentLike {
  /** Phiên mà agent sở hữu. */
  readonly session: WorkspaceChangesSession;
}

/** Payload waterfall `agent/turn-stopping` — chỉ hai trường plugin này đọc. */
interface TurnStoppingPayloadLike {
  /** Agent có lượt sắp dừng. */
  readonly agent: AgentLike;
  /** Số lượt sắp dừng. */
  readonly turn: number;
}

/** Một lời gọi tool đang chạy — chỉ phần `tools/pre-execute` mà plugin này đọc. */
interface ToolExecutionLike {
  /** Agent đại diện cho lời gọi, nếu có. */
  readonly agent?: AgentLike;
}

/** Đích đã phân giải của seam fs — vật mang ĐỤC với plugin này. */
interface FsTargetLike {
  /** Khoá đích ổn định do backend cấp; plugin chỉ chuyển tiếp, không đọc. */
  readonly targetKey: string;
}

/** Seam hệ tệp (`ctx.fs`) — đúng MỘT lời gọi mà plugin này dùng. */
interface FsSeam {
  /**
   * Đường dẫn tuyệt đối mà một tiến trình trong thế giới thi hành này mở được.
   * Nhận: đích đã phân giải.
   * Trả: đường dẫn tuyệt đối.
   */
  processPath(target: FsTargetLike): string;
}

/** Sự thật kết thúc của một tiến trình đã đóng — từ vựng sự kiện `close` của Node. */
interface SubprocessOutcomeLike {
  /** Mã thoát; null khi tiến trình chết vì tín hiệu. */
  readonly exitCode: number | null;
}

/** Một yêu cầu spawn đã đặc tả đầy đủ — seam này KHÔNG áp mặc định nào. */
interface SubprocessSpawnSpecLike {
  /** Tệp thi hành và tham số; argv[0] là chương trình, không bao giờ qua shell. */
  readonly argv: readonly string[];
  /** Thư mục làm việc của tiến trình con. */
  readonly cwd: string;
  /** Cách xử lý từng luồng stdio. */
  readonly stdio: {
    /** Cách xử lý stdin (`"ignore"` để fd 0 trỏ /dev/null). */
    readonly stdin: "ignore";
    /** Cách xử lý stdout (thu, giới hạn số byte). */
    readonly stdout: { readonly maxBytes: number };
    /** Cách xử lý stderr (thu, giới hạn số byte). */
    readonly stderr: { readonly maxBytes: number };
  };
  /** Thời gian ân hạn kết thúc (ms). */
  readonly graceMs: number;
  /** Tín hiệu huỷ — bắt đầu quy trình kết thúc dải đã quản lý khi phát. */
  readonly signal: AbortSignal;
}

/** Tay nắm một tiến trình sống — plugin chỉ chờ kết cục của nó. */
interface SubprocessHandleLike {
  /** Kết thúc bằng sự thật thoát của lệnh đã spawn; ném khi spawn/nhà cung cấp hỏng. */
  readonly done: Promise<SubprocessOutcomeLike>;
}

/** Seam tiến trình con (`ctx.subprocess`) — đúng HAI lời gọi mà plugin này dùng. */
interface SubprocessSeam {
  /**
   * Phân giải một tệp thi hành trong thế giới thi hành của nhà cung cấp.
   * Nhận: đường dẫn tuyệt đối hoặc tên trần trên PATH, biến môi trường cho lượt tra, tín hiệu huỷ.
   * Trả: đường dẫn tệp thi hành đã chuẩn hoá.
   */
  resolveExecutable(command: string, env?: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<string>;
  /**
   * Khởi động một tiến trình con được quản lý từ spec đã đặc tả đầy đủ.
   * Nhận: spec (argv, thư mục, stdio, ân hạn, huỷ).
   * Trả: tay nắm sống của tiến trình.
   */
  spawn(spec: SubprocessSpawnSpecLike): SubprocessHandleLike;
}

/** Facade log của cordis — chỉ hai mức mà plugin này dùng. */
interface LoggerLike {
  /**
   * Ghi một dòng thông tin.
   * Nhận: thông điệp.
   * Trả: không.
   */
  info(message: string): void;
  /**
   * Ghi một dòng cảnh báo.
   * Nhận: thông điệp.
   * Trả: không.
   */
  warn(message: string): void;
}

/** Tuỳ chọn đăng ký listener của cordis — chỉ cờ mà plugin này dùng. */
interface EventOptionsLike {
  /** Đăng listener lên ĐẦU chuỗi để nó chạy trước các listener đã có. */
  readonly prepend?: boolean;
}

/** Gọi tiếp tầng dưới của waterfall `fs/*-intent`; kết quả là vật mang ĐỤC với plugin này. */
type FsIntentNext = () => Promise<unknown>;

/** Listener waterfall `fs/write-intent` / `fs/edit-intent`: chuyển tiếp ý định SAU khi capture đã xếp hàng. */
type FsIntentListener = (
  target: FsTargetLike,
  actor: object | undefined,
  next: FsIntentNext,
) => Promise<unknown>;

/** Gọi tiếp tầng dưới của waterfall `tools/pre-execute`; quyết định là vật mang ĐỤC với plugin này. */
type ToolPreExecuteNext = () => Promise<unknown>;

/** Listener waterfall `tools/pre-execute`: chờ capture đang xếp hàng rồi mới cho tool chạy. */
type ToolPreExecuteListener = (exec: ToolExecutionLike, next: ToolPreExecuteNext) => Promise<unknown>;

/**
 * Context host nhìn qua ĐÚNG những gì plugin này gọi (luật 000d: khai theo CẤU TRÚC, không
 * `declare module` nào ở tệp này).
 */
interface WorkspaceChangesContext {
  /** Nhà cung cấp tiến trình con của thế giới thi hành. */
  readonly subprocess: SubprocessSeam;
  /** Hệ tệp của thế giới thi hành. */
  readonly fs: FsSeam;
  /** Facade log của plugin. */
  readonly logger: LoggerLike;
  /**
   * Đăng ký một hiệu ứng có hàm dọn theo vòng đời fiber.
   * Nhận: hàm dựng trả về hàm dọn (đồng bộ hoặc bất đồng bộ).
   * Trả: bộ dọn của hiệu ứng (không dùng).
   */
  effect(execute: () => () => Promise<void> | void): unknown;
  /**
   * Cung cấp một service cho context con.
   * Nhận: tên service và giá trị.
   * Trả: hàm rút service (không dùng).
   */
  provide(name: string, value: unknown): unknown;
  /**
   * Nghe sự kiện đã cam kết của MỌI phiên.
   * Nhận: tên sự kiện và hàm xử lý nhận (phiên, sự kiện).
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  on(event: "session/event", listener: (session: WorkspaceChangesSession, event: SessionEventLike) => void): unknown;
  /**
   * Nghe lúc một phiên rời kho.
   * Nhận: tên sự kiện và hàm xử lý nhận phiên đã rời.
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  on(event: "session/disposed", listener: (session: WorkspaceChangesSession) => void): unknown;
  /**
   * Nghe lúc một lượt agent sắp dừng.
   * Nhận: tên sự kiện và hàm xử lý nhận (agent, lượt).
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  on(
    event: "agent/turn-stopping",
    listener: (payload: TurnStoppingPayloadLike) => Promise<void> | void,
  ): unknown;
  /**
   * Nghe waterfall ghi tệp.
   * Nhận: tên sự kiện, listener waterfall, và tuỳ chọn đăng ký.
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  on(event: "fs/write-intent", listener: FsIntentListener, options?: EventOptionsLike): unknown;
  /**
   * Nghe waterfall sửa tệp.
   * Nhận: tên sự kiện, listener waterfall, và tuỳ chọn đăng ký.
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  on(event: "fs/edit-intent", listener: FsIntentListener, options?: EventOptionsLike): unknown;
  /**
   * Nghe waterfall trước khi một lời gọi tool chạy.
   * Nhận: tên sự kiện và listener waterfall.
   * Trả: giá trị của hiệu ứng đã đăng ký (không dùng).
   */
  on(event: "tools/pre-execute", listener: ToolPreExecuteListener): unknown;
}

/**
 * Thư mục làm việc mà một phiên đủ tư cách được ghi nhận, hoặc undefined khi phiên là con uỷ nhiệm.
 * Nhận: phiên đang sống.
 * Trả: `cwd` của phiên cấp cao nhất, hoặc undefined với phiên con (`origin === 'subagent'` hoặc
 *   `delegationDepth > 0`) — NGUYÊN VĂN điều kiện của bản gốc.
 */
function eligible(session: WorkspaceChangesSession): string | undefined {
  const { cwd, origin, delegationDepth } = session.header;
  return origin === "subagent" || (delegationDepth ?? 0) > 0 ? undefined : cwd;
}

/**
 * Phân giải tệp thi hành git đúng MỘT lần. Trên macOS, stub Xcode ở `/usr/bin/git` mở hộp thoại
 * cài đặt thay vì chạy, nên nó bị coi là KHÔNG có cho tới khi developer tools được chọn.
 * Nhận: `ctx` — năng lực subprocess; `signal` — vòng đời plugin.
 * Trả: đường dẫn tệp thi hành, hoặc null khi git không dùng được.
 */
async function resolveGit(ctx: WorkspaceChangesContext, signal: AbortSignal): Promise<string | null> {
  let executable: string;
  try {
    executable = await ctx.subprocess.resolveExecutable("git", undefined, signal);
  } catch {
    return null;
  }
  if (process.platform !== "darwin" || executable !== "/usr/bin/git") return executable;
  const probe = ctx.subprocess.spawn({
    argv: ["/usr/bin/xcode-select", "-p"],
    cwd: homedir(),
    stdio: { stdin: "ignore", stdout: { maxBytes: 4096 }, stderr: { maxBytes: 4096 } },
    graceMs: 1_000,
    signal,
  });
  const outcome = await probe.done.catch(() => ({ exitCode: null }));
  return outcome.exitCode === 0 ? executable : null;
}

/**
 * Quan sát các lượt cấp cao nhất của mọi phiên có thư mục làm việc, capture các lần tool sửa tệp,
 * công bố bản tóm tắt thay đổi, và phục vụ chúng cùng các phép so sánh qua `workspaceChanges`.
 * Nhận: `ctx` — context host có `subprocess` và `fs`; `config` — các trần đã được schema xác thực.
 * Trả: không.
 * @throws {Error} khi một trường cấu hình không phải số nguyên an toàn dương — thông điệp NGUYÊN VĂN
 *   `workspace-changes requires a positive integer <field>`.
 */
export function apply(ctx: WorkspaceChangesContext, config: Config): void {
  for (const [field, value] of [
    ["timeoutMs", config.timeoutMs],
    ["outputMaxBytes", config.outputMaxBytes],
    ["maxFiles", config.maxFiles],
    ["maxFileBytes", config.maxFileBytes],
    ["diffTimeoutMs", config.diffTimeoutMs],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error(`workspace-changes requires a positive integer ${field}`);
  }
  const lifetime = new AbortController();
  const recorders = new Map<WorkspaceChangesSession, TurnRecorder>();
  const mutations = new WeakMap<object, TurnRecorder>();
  const byId = new Map<SessionId, TurnRecorder>();
  /**
   * Quên MỘT phiên: bỏ recorder khỏi hai bảng rồi dispose nó.
   * Nhận: phiên cần quên.
   * Trả: phân giải khi thư mục tạm của recorder đã biến mất (ngay lập tức khi chưa có recorder).
   */
  const forget = (session: WorkspaceChangesSession): Promise<void> => {
    const recorder = recorders.get(session);
    recorders.delete(session);
    byId.delete(session.id);
    return recorder?.dispose() ?? Promise.resolve();
  };
  ctx.effect(() => async () => {
    lifetime.abort();
    await Promise.all([...recorders.keys()].map(forget));
  });
  const service: WorkspaceChanges = {
    summary: (sessionId: SessionId, seq: number): WorkspaceChangesSummary | undefined =>
      byId.get(sessionId)?.summary(seq),
    diff: (
      sessionId: SessionId,
      seq: number,
      index: number,
      signal: AbortSignal,
    ): Promise<WorkspaceFileDiff | undefined> =>
      byId.get(sessionId)?.diff(seq, index, signal) ?? Promise.resolve(undefined),
  };
  ctx.provide("workspaceChanges", service);
  let runner: Promise<GitRunner | null> | undefined;
  /**
   * Bộ chạy git dùng chung, phân giải LƯỜI đúng một lần cho cả thể hiện plugin.
   * Nhận: không.
   * Trả: promise của bộ chạy, hoặc null khi git không dùng được (chỉ tóm tắt các lần tool sửa tệp).
   */
  const gitRunner = (): Promise<GitRunner | null> => {
    runner ??= resolveGit(ctx, lifetime.signal).then((executable) => {
      if (executable === null) {
        ctx.logger.info("workspace-changes: git is unavailable; only file-tool edits are summarized");
        return null;
      }
      // ctx.subprocess là seam THẬT của kernel (có `collected`); plugin chỉ khai phần nó gọi, nên ép về
      // đúng bề mặt mà GitRunner cần — thuần kiểu, runtime không đổi (ADR 000d: khai seam theo cấu trúc).
      return new GitRunner(ctx.subprocess as unknown as SubprocessRuntimeLike, executable, {
        timeoutMs: config.timeoutMs,
        outputMaxBytes: config.outputMaxBytes,
      });
    });
    return runner;
  };
  /**
   * Recorder của MỘT phiên, tạo ở lần chạm đầu và nhớ tới khi phiên bị dispose.
   * Nhận: phiên, và thư mục làm việc đã đủ tư cách.
   * Trả: recorder đang phục vụ phiên đó.
   */
  const recorderFor = (session: WorkspaceChangesSession, cwd: string): TurnRecorder => {
    let recorder = recorders.get(session);
    if (recorder === undefined) {
      recorder = new TurnRecorder(session, cwd, {
        git: gitRunner(),
        tempRoot: tmpdir(),
        maxFiles: config.maxFiles,
        maxFileBytes: config.maxFileBytes,
        diffTimeoutMs: config.diffTimeoutMs,
        warn: (message: string): void => {
          ctx.logger.warn(message);
        },
      });
      recorders.set(session, recorder);
      byId.set(session.id, recorder);
    }
    return recorder;
  };
  ctx.on("session/event", (session, event) => {
    if (event.type === "turn/start") {
      const cwd = eligible(session);
      if (cwd !== undefined) recorderFor(session, cwd).start(event.data.turn);
      return;
    }
    if (event.type === "tool/result") recorders.get(session)?.observe(event);
    else if (event.type === "turn/end") recorders.get(session)?.end(event.data.turn);
  });
  ctx.on("session/disposed", (session) => {
    void forget(session);
  });
  ctx.on("agent/turn-stopping", async ({ agent, turn }) => {
    await recorders.get(agent.session)?.stopping(turn);
  });
  /**
   * Capture toàn tệp của đích sắp bị một tool sửa, nếu lời gọi thuộc một phiên đang được ghi nhận,
   * rồi chờ capture chốt xong.
   * Nhận: `target` — đích đã phân giải; `actor` — context lời gọi tool (không trong suốt).
   * Trả: không.
   */
  const capture = async (target: FsTargetLike, actor: object | undefined): Promise<void> => {
    const recorder = actor === undefined ? undefined : mutations.get(actor);
    if (recorder === undefined) return;
    recorder.capture(ctx.fs.processPath(target));
    await recorder.settled();
  };
  ctx.on(
    "fs/write-intent",
    async (target, actor, next) => {
      const intent = await next();
      await capture(target, actor);
      return intent;
    },
    { prepend: true },
  );
  ctx.on(
    "fs/edit-intent",
    async (target, actor, next) => {
      const intent = await next();
      await capture(target, actor);
      return intent;
    },
    { prepend: true },
  );
  ctx.on("tools/pre-execute", async (exec, next) => {
    const session = exec.agent?.session;
    const recorder = session === undefined ? undefined : recorders.get(session);
    if (recorder !== undefined) {
      mutations.set(exec, recorder);
      await recorder.settled();
    }
    return next();
  });
}
