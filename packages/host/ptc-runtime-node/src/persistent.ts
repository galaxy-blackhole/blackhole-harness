/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc PTC node giữ trạng thái trong bộ nhớ: mỗi chủ sở hữu một tiến trình REPL sống qua các lượt gọi, kênh
 *      JSON có biên, ngân sách đầu ra gộp và dọn dẹp khi đổi chính sách/huỷ — port 1:1 lib/types/persistent.js
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { accessSync, constants, statSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { isAbsolute } from "node:path";
import type { Duplex, Readable } from "node:stream";

import { replyToBinding, validateBindings } from "./bindings.ts";
import { JsonChannel } from "./channel.ts";
import type { ResolvedConfig } from "./config.ts";
import { STARTUP_ENVIRONMENT_NAMES } from "./environment.ts";
import { decodePtcJsonWire, type PtcJsonWire } from "./json-wire.ts";
import { bootstrapArgs } from "./launch.ts";
import { OutputLedger } from "./output-ledger.ts";
import { drainOutput, terminateProcess } from "./output-stream.ts";
import type { PolicyProcesses } from "./policy-processes.ts";
// 19/10/2026: bản gốc import từ "./protocol.ts" (module riêng, bị tree-shake khỏi bundle). Trong gói ta,
// kiểu của giao thức control nằm ở "./process-protocol.ts" (tệp tách từ lib/process.js) — cùng hình dạng,
// nên trỏ thẳng vào đó thay vì tạo thêm protocol.ts trùng lặp.
import type { ProgramBootData, ReplyMessage } from "./process-protocol.ts";

/* ----------------------------------------------------------------------------------------------------
 * KHAI BÁO TỐI THIỂU CHO PEER CHƯA CÀI ĐƯỢC TRONG WORKSPACE — KHÔNG import thật (tránh TS2307).
 * Hình dạng chép từ nguồn đối chiếu CHỈ ĐỌC:
 *   apps/host/node_modules/@deepseek-ai/dsh-ptc-runtime/lib/types/types.d.ts   (Ptc* )
 *   apps/host/node_modules/@deepseek-ai/dsh-sandbox/lib/types/index.d.ts       (Sandbox*)
 *   apps/host/node_modules/@deepseek-ai/dsh-subprocess/lib/types/types.d.ts    (Subprocess*)
 * Khi gói được cài peer (bun install) thì thay khối này bằng import type thật.
 * -------------------------------------------------------------------------------------------------- */

/** Giá trị JSON không mất mát (PtcJsonValue của dsh-ptc-runtime). */
type PtcJsonValue = null | boolean | number | string | PtcJsonValue[] | { [key: string]: PtcJsonValue };
/** Một hàm host phơi cho chương trình dưới dạng async (PtcBindingFunction). */
type PtcBindingFunction = (args: unknown) => Promise<PtcJsonValue>;
/** Một nhóm hàm host dưới một global (PtcBindingNamespace). */
interface PtcBindingNamespace { global: string; functions: Record<string, PtcBindingFunction>; errorClass?: { name: string; memberNameProperty: string } }
/** Chế độ hiệu ứng file (SandboxMode). */
type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
/** Mức đầy đủ của cưỡng chế (SandboxEnforcement). */
type SandboxEnforcement = "full" | "partial";
/** Chính sách hiệu ứng file đã giải cho một lượt gọi (SandboxExecutionPolicy). */
interface SandboxExecutionPolicy { mode: SandboxMode; workspaceRoot: string; sessionId?: string }
/** Chính sách đã thu hẹp về chế độ CÓ cưỡng chế (SandboxPolicy). */
interface SandboxPolicy extends SandboxExecutionPolicy { mode: Exclude<SandboxMode, "danger-full-access"> }
/** Một luật nhận diện runner sandbox hỏng (RunnerFailureRule). */
interface RunnerFailureRule { allowedExitCodes?: readonly number[]; fatalSignatures: readonly string[]; informationalLines?: readonly string[] }
/** Kết quả của SandboxProvider.confine (ConfinedArgv). */
interface ConfinedArgv { argv: string[]; enforcement: SandboxEnforcement; denialSignatures: readonly string[]; runnerFailureRules: readonly RunnerFailureRule[] }
/** Sự thật thoát của một tiến trình đã đóng (SubprocessOutcome). */
interface SubprocessOutcome { exitCode: number | null; signal: NodeJS.Signals | null }
/** Bố trí stdio tối thiểu mà PTC giữ trạng thái dùng (SubprocessStdio). */
interface SubprocessStdio { stdin: "ignore"; stdout: "pipe"; stderr: "pipe"; control?: "pipe" }
/** Một spawn đầy đủ tham số (tối thiểu của SubprocessSpawnSpec). */
interface SubprocessSpawnSpec { argv: readonly string[]; cwd: string; stdio: SubprocessStdio; graceMs: number; env?: NodeJS.ProcessEnv | undefined }
/** Tiến trình con do provider quản (tối thiểu của SubprocessHandle). */
interface SubprocessHandle { readonly stdout: Readable | undefined; readonly stderr: Readable | undefined; readonly control: Duplex | undefined; readonly done: Promise<SubprocessOutcome>; terminate(): void; readonly waitForExit: (signal?: AbortSignal) => Promise<boolean> }
/** Dịch vụ cordis tối thiểu mà PTC giữ trạng thái cần (Context + fs + subprocess + sandbox + sandboxPolicy). */
interface PtcContext {
  effect(execute: () => () => Promise<void>, label?: string): unknown;
  logger: { warn(message: string): void };
  fs: { processPathFromHostPath(hostPath: string): string | undefined };
  subprocess: {
    resolveExecutable(command: string, env?: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<string>;
    spawn(spec: SubprocessSpawnSpec): SubprocessHandle;
  };
  sandbox: { confine(argv: readonly string[], policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv> };
  sandboxPolicy: { resolve(): SandboxExecutionPolicy };
}
/** Yêu cầu chạy CHƯA giải (PtcRunRequest). */
interface PtcRunRequest {
  program: string;
  stateOwner?: object;
  bindings: PtcBindingNamespace[];
  cwd?: string;
  timeoutMs?: number | null;
  sandboxPolicy?: SandboxExecutionPolicy;
  signal?: AbortSignal;
}
/** Yêu cầu chạy ĐÃ giải (PtcRunSpec): cwd tuyệt đối và hạn chót đã cắt. */
interface PtcRunSpec extends PtcRunRequest { cwd: string; timeoutMs: number | null }
/** Vì sao một lượt chạy hỏng (PtcRunFailure). */
interface PtcRunFailure {
  kind: "exception" | "timeout" | "abort" | "worker-exit" | "invalid-output" | "output-limit" | "protocol" | "sandbox-unavailable";
  message: string;
}
/** Chính sách hiệu ứng file đã áp cho một lượt chạy (PtcRunSandbox). */
interface PtcRunSandbox { mode: SandboxMode; denied: boolean; enforcement?: SandboxEnforcement }
/** Kết quả một lượt chạy (PtcRunResult). */
interface PtcRunResult { sandbox?: PtcRunSandbox; value?: PtcJsonValue; logs: string[]; error?: PtcRunFailure }

/* ----------------------------------------------------------------------------------------------------
 * GIÁ TRỊ RUNTIME CỦA PEER đã chép NGUYÊN VĂN (peer chưa cài) — đối chiếu:
 *   dsh-timeout/lib/index.js   (clampTimeout)
 *   dsh-sandbox/lib/index.js   (SANDBOX_UNAVAILABLE · EXECUTABLE_SPAWN_CODES · isUsableWorkdir ·
 *                               isRunnerSpawnFailure · classifyRunnerFailure)
 * -------------------------------------------------------------------------------------------------- */

/** Mã lỗi mà peer dsh-sandbox gắn lên HarnessError khi không có backend cưỡng chế dùng được. */
const SANDBOX_UNAVAILABLE = "SANDBOX_UNAVAILABLE";

/** Mã spawn CỦA NODE đã được chứng minh là lỗi giải đường dẫn hoặc lỗi quyền. */
const EXECUTABLE_SPAWN_CODES = new Set(["EACCES", "ENOENT"]);

/**
 * Cho biết cwd do bên gọi sở hữu có VÀO ĐƯỢC không (bản sao nguyên văn của peer dsh-sandbox).
 * Nhận: path — thư mục cần kiểm.
 * Trả: true khi là thư mục và truy cập được (X_OK); false với mọi lỗi.
 */
function isUsableWorkdir(path: string): boolean {
  try {
    if (!statSync(path).isDirectory()) return false;
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Chỉ quy kết lỗi ENOENT/EACCES của Node khi đường của lỗi BẰNG argv[0], sau khi đã độc lập loại trừ cwd
 * của bên gọi (bản sao nguyên văn của peer dsh-sandbox).
 * Nhận: error — lỗi spawn gốc; runnerProgram — argv[0] của provider; workdir — cwd do bên gọi sở hữu.
 * Trả: true khi lỗi có bằng chứng ĐẶC THÙ cho chương trình runner.
 */
function isRunnerSpawnFailure(error: unknown, runnerProgram: string | undefined, workdir: string): boolean {
  if (runnerProgram === void 0 || !isUsableWorkdir(workdir)) return false;
  if (typeof error !== "object" || error === null) return false;
  const { code, path, syscall } = error as { code?: unknown; path?: unknown; syscall?: unknown };
  if (typeof code !== "string" || !EXECUTABLE_SPAWN_CODES.has(code)) return false;
  if (typeof syscall !== "string") return false;
  const exactSyscall = `spawn ${runnerProgram}`;
  if (path === void 0) return syscall === exactSyscall;
  if (typeof path !== "string" || path.length === 0 || path !== runnerProgram) return false;
  return syscall === "spawn" || syscall === exactSyscall;
}

/**
 * Phân loại MỘT tiến trình đã kết thúc theo luật runner-hỏng có cấu trúc của backend đã chọn (bản sao
 * nguyên văn của peer dsh-sandbox).
 * Nhận: exitCode — mã thoát (null = bị tín hiệu giết); stderr — toàn bộ stderr, KHÔNG đổi; rules — luật.
 * Trả: dòng chí mạng ĐẦU TIÊN khớp, hoặc undefined khi bằng chứng chưa đủ.
 */
function classifyRunnerFailure(
  exitCode: number | null,
  stderr: string,
  rules: readonly RunnerFailureRule[],
): { detail: string } | undefined {
  if (exitCode === null || exitCode === 0) return void 0;
  const lines = stderr.split(/\r?\n/);
  for (const rule of rules) {
    if (rule.allowedExitCodes !== void 0 && !rule.allowedExitCodes.includes(exitCode)) continue;
    const informationalLines = new Set((rule.informationalLines ?? []).map((line) => line.toLowerCase()));
    const fatalSignatures = rule.fatalSignatures
      .filter((signature) => signature.trim().length > 0)
      .map((signature) => signature.toLowerCase());
    for (const line of lines) {
      const lowered = line.toLowerCase();
      if (informationalLines.has(lowered)) continue;
      if (fatalSignatures.some((signature) => lowered.includes(signature))) return { detail: line };
    }
  }
  return void 0;
}

/**
 * Cho biết một lỗi có phải "không có backend sandbox dùng được" không.
 * Vì sao không dùng instanceOf: lớp SandboxUnavailableError nằm trong peer CHƯA cài; peer ném lỗi mang
 * đúng mã SANDBOX_UNAVAILABLE (HarnessError), nên kiểm mã là cách bắt tương đương và bền hơn qua biên gói.
 * Nhận: error — giá trị bắt được từ confine/spawn.
 * Trả: true khi error mang mã SANDBOX_UNAVAILABLE.
 */
function isSandboxUnavailableError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === SANDBOX_UNAVAILABLE;
}

/**
 * Kiểm hạn bên gọi, dùng mặc định của backend rồi cắt theo trần (bản sao nguyên văn của peer dsh-timeout).
 * Nhận: requested — hạn tuỳ chọn; def — mặc định; max — trần; name — tên trường trong thông điệp lỗi.
 * Trả: hạn hiệu lực, mili giây: min(requested ?? def, max).
 */
function clampTimeout(requested: number | undefined, def: number, max: number, name = "timeoutMs"): number {
  if (requested !== void 0 && (!Number.isFinite(requested) || requested <= 0)) {
    throw new Error(`${name} must be a positive finite number`);
  }
  return Math.min(requested ?? def, max);
}

/** Lấy thông điệp của một giá trị ném ra. Nhận: error — giá trị bất kỳ. Trả: chuỗi thông điệp. */
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Cho biết value có phải object thường (không null, không mảng) không. Nhận: value — giá trị cần kiểm. Trả: true/false. */
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Ledger đầu ra của một lượt giữ trạng thái.
 * Nhận: maxBytes — trần byte gộp của log + giá trị hoàn tất.
 * Trả: OutputLedger mang thông điệp tràn đặc thù của PTC giữ trạng thái.
 */
function persistentOutput(maxBytes: number): OutputLedger {
  return new OutputLedger(maxBytes, `retained variables were cleared; outer output exceeded ${maxBytes} bytes`);
}

/** Một lượt đánh giá đang sống trong một tiến trình giữ trạng thái. */
interface Evaluation {
  /** Số thứ tự do host cấp, dùng làm id khung tin. */
  id: number;
  /** Dữ liệu boot gửi tiến trình con. */
  data: ProgramBootData;
  /** Yêu cầu đã giải của lượt này. */
  spec: PtcRunSpec;
  /** Namespace binding của lượt này, khoá theo global. */
  bindings: Map<string, PtcBindingNamespace>;
  /** Cầu nối binding đã buộc ngữ cảnh AsyncLocalStorage. */
  reply: (id: number, binding: PtcBindingFunction | undefined, args: PtcJsonValue) => Promise<ReplyMessage>;
  /** Số lời gọi binding đang chờ. */
  pending: number;
  /** Byte khung lời gọi đang chờ. */
  pendingBytes: number;
  /** Nhận một mẩu văn bản vào ngân sách đầu ra. */
  admit(text: string): void;
  /** Kết thúc lượt: dựng kết quả, dọn tiến trình và giải promise của lượt. */
  finish(error?: PtcRunFailure, value?: PtcJsonValue, discard?: boolean): void;
}

/** One managed process; all mutable program state belongs to this process alone. */
class Kernel {
  /** Dịch vụ provider. */
  readonly ctx: PtcContext;
  /** Cấu hình đã giải. */
  readonly config: ResolvedConfig;
  /** Chính sách file mà tiến trình này bị ghim vào. */
  readonly policy: SandboxExecutionPolicy;
  /** Huỷ đăng ký dọn dẹp theo chính sách. */
  unregister: (() => void) | undefined;
  /** argv đã cưỡng chế, khi chế độ khác danger-full-access. */
  confined: ConfinedArgv | undefined;
  /** Tiến trình con đã spawn. */
  handle: SubprocessHandle | undefined;
  /** Kênh JSON trên fd điều khiển. */
  channel: JsonChannel | undefined;
  /** Lượt đánh giá đang sống. */
  active: Evaluation | undefined;
  /** Admission vẫn bị giữ tới khi kết quả gồm cả dọn dẹp tiến trình xong. */
  running = false;
  /** Có dọn dẹp tiến trình còn dở. */
  cleanupPending = false;
  /** Tiến trình con đã sẵn sàng nhận lệnh chạy. */
  ready = false;
  /** Số thứ tự lượt đánh giá. */
  sequence = 0;
  /** Id lời gọi binding kế tiếp mà host chấp nhận. */
  nextCall = 1;
  /** Phần đuôi stderr gần nhất, cắt theo trần đầu ra. */
  stderr = "";
  /** Dọn dẹp đã bắt đầu. */
  stopped: Promise<boolean> | undefined;
  /** Khởi động tiến trình con đang chạy. */
  starting: Promise<void> | undefined;
  /** Sự thật thoát đã quan sát. */
  exitOutcome: SubprocessOutcome | undefined;
  /** Huỷ confine/khởi động khi đóng. */
  readonly controller = new AbortController();
  /** Kernel đã đóng, không nhận thêm lượt. */
  closed = false;

  /**
   * Đăng ký một tiến trình giữ trạng thái với bộ dọn dẹp theo chính sách.
   * Nhận: ctx — dịch vụ provider; config — cấu hình đã giải; policy — chính sách file đã ghim;
   *        processes — bộ dọn dẹp theo chính sách của provider.
   * Trả: không; kernel đã đăng ký dọn dẹp.
   */
  constructor(ctx: PtcContext, config: ResolvedConfig, policy: SandboxExecutionPolicy, processes: PolicyProcesses) {
    this.ctx = ctx;
    this.config = config;
    this.policy = policy;
    this.unregister = processes.register(policy, () => this.dispose());
  }

  /**
   * Từ chối lượt chạy chồng lấn hoặc khi dọn dẹp chưa xong.
   * Nhận: không.
   * Trả: không; ném Error khi chủ sở hữu chưa được giải phóng.
   */
  assertIdle(): void {
    if (this.running) throw new Error("persistent PTC does not accept concurrent runs for one state owner");
    if (this.cleanupPending) {
      throw new Error(
        "persistent PTC environment cleanup is incomplete; release the owner before running another program",
      );
    }
  }

  /**
   * Chạy một chương trình đã biên dịch trên tiến trình này và gắn chính sách sandbox quan sát được.
   * Nhận: spec — yêu cầu đã giải; bindings — namespace binding đã kiểm; code — mã đã bỏ kiểu.
   * Trả: kết quả lượt chạy kèm khối sandbox.
   */
  async run(spec: PtcRunSpec, bindings: Map<string, PtcBindingNamespace>, code: string): Promise<PtcRunResult> {
    this.running = true;
    const sandbox: PtcRunSandbox = {
      mode: this.policy.mode,
      denied: false,
    };
    try {
      const result = await this.evaluate(spec, bindings, code);
      if (this.confined !== void 0) {
        sandbox.enforcement = this.confined.enforcement;
        sandbox.denied =
          result.error?.kind !== "sandbox-unavailable" &&
          this.confined.denialSignatures.some((signature) =>
            result.error?.message.toLowerCase().includes(signature.toLowerCase()),
          );
      }
      return {
        ...result,
        sandbox,
      };
    } finally {
      this.running = false;
    }
  }

  /**
   * Đánh giá một lượt: dựng ledger, hẹn giờ, theo dõi huỷ, gửi lệnh chạy và chờ kết quả.
   * Nhận: spec — yêu cầu đã giải; bindings — namespace binding đã kiểm; code — mã đã bỏ kiểu.
   * Trả: kết quả lượt chạy (thành công, hỏng, hoặc hết ngân sách).
   */
  async evaluate(spec: PtcRunSpec, bindings: Map<string, PtcBindingNamespace>, code: string): Promise<PtcRunResult> {
    if (this.exitOutcome !== void 0) {
      const output = persistentOutput(this.config.maxOutputBytes);
      const failure: PtcRunFailure = spec.signal?.aborted
        ? {
            kind: "abort",
            message: "execution canceled; retained variables were cleared",
          }
        : {
            kind: "worker-exit",
            message: `${this.exitMessage(this.exitOutcome)}; retained variables were cleared`,
          };
      try {
        await this.stop();
      } catch (error) {
        return output.failure([], {
          kind: "worker-exit",
          message: `managed process cleanup failed: ${messageOf(error)}`,
        });
      }
      return output.failure([], failure);
    }
    this.stderr = "";
    const output = persistentOutput(this.config.maxOutputBytes);
    const logs: string[] = [];
    const result = Promise.withResolvers<PtcRunResult>();
    const timer =
      spec.timeoutMs === null
        ? void 0
        : setTimeout(() => {
            evaluation.finish(
              {
                kind: "timeout",
                message: `execution deadline reached (${spec.timeoutMs}ms); retained variables were cleared`,
              },
              void 0,
              true,
            );
          }, spec.timeoutMs);
    const onAbort = () => {
      evaluation.finish(
        {
          kind: "abort",
          message: "execution canceled; retained variables were cleared",
        },
        void 0,
        true,
      );
    };
    const evaluation: Evaluation = {
      id: ++this.sequence,
      data: {
        code,
        maxOutputBytes: this.config.maxOutputBytes,
        namespaces: [...bindings.values()].map((binding) => ({
          global: binding.global,
          names: Object.keys(binding.functions),
          ...(binding.errorClass ? { errorClass: binding.errorClass } : {}),
        })),
      },
      spec,
      bindings,
      reply: AsyncLocalStorage.bind(replyToBinding),
      pending: 0,
      pendingBytes: 0,
      admit: (text) => {
        if (!output.admit(text, logs)) {
          logs.push(text);
          evaluation.finish(
            {
              kind: "output-limit",
              message: "output limit exceeded",
            },
            void 0,
            true,
          );
        }
      },
      finish: (error, value, discard = false) => {
        if (this.active !== evaluation) return;
        clearTimeout(timer);
        spec.signal?.removeEventListener("abort", onAbort);
        this.active = void 0;
        const outcome =
          error?.kind === "output-limit" ? output.limit(logs) : error ? output.failure(logs, error) : output.success(logs, value);
        (discard || outcome.error?.kind === "output-limit" || spec.stateOwner === void 0 ? this.stop() : Promise.resolve(true)).then(
          (drained) => {
            result.resolve(
              drained
                ? outcome
                : output.failure(logs, {
                    kind: "worker-exit",
                    message: "managed process exited but its output did not drain cleanly",
                  }),
            );
          },
          (failure: unknown) => {
            result.resolve(
              output.failure(logs, {
                kind: "worker-exit",
                message: `managed process cleanup failed: ${messageOf(failure)}`,
              }),
            );
          },
        );
      },
    };
    this.active = evaluation;
    spec.signal?.addEventListener("abort", onAbort, { once: true });
    if (spec.signal?.aborted) onAbort();
    else if (this.ready) this.dispatch(evaluation);
    else {
      this.starting = this.start(spec.cwd);
      this.starting.catch((error: unknown) => {
        this.fail(
          isSandboxUnavailableError(error) ||
            (this.confined !== void 0 && isRunnerSpawnFailure(error, this.confined.argv[0], spec.cwd))
            ? "sandbox-unavailable"
            : "worker-exit",
          messageOf(error),
        );
      });
    }
    return await result.promise;
  }

  /**
   * Huỷ lượt đang sống rồi dọn dẹp tiến trình.
   * Nhận: không.
   * Trả: hoàn tất sau khi tiến trình và các ống đã dừng.
   */
  async dispose(): Promise<void> {
    this.active?.finish(
      {
        kind: "abort",
        message: "PTC environment disposed; retained variables were cleared",
      },
      void 0,
      true,
    );
    await this.stop();
  }

  /**
   * Đóng kernel một lần và dọn tiến trình, giữ admission tới khi xong.
   * Nhận: không.
   * Trả: promise cho biết các ống đã rút sạch (false khi còn byte dở).
   */
  stop(): Promise<boolean> {
    if (this.stopped) return this.stopped;
    this.closed = true;
    this.cleanupPending = true;
    this.controller.abort();
    this.channel?.close();
    this.stopped = (async (): Promise<boolean> => {
      await this.starting?.catch(() => {});
      const handle = this.handle;
      return handle === void 0 || (await terminateProcess(handle, this.config.graceMs));
    })().then(
      (drained) => {
        this.unregister?.();
        this.cleanupPending = false;
        if (!drained) this.ctx.logger.warn("persistent Node process exited but its output did not drain cleanly");
        return drained;
      },
      (error: unknown) => {
        this.stopped = void 0;
        throw error;
      },
    );
    return this.stopped;
  }

  /**
   * Báo hỏng: kết thúc lượt đang sống, hoặc log rồi dọn dẹp khi không có lượt.
   * Nhận: kind — lớp hỏng; message — chi tiết.
   * Trả: không.
   */
  fail(kind: PtcRunFailure["kind"], message: string): void {
    if (this.active)
      this.active.finish(
        {
          kind,
          message: `${message}; retained variables were cleared`,
        },
        void 0,
        true,
      );
    else {
      if (!this.closed) this.ctx.logger.warn(message);
      this.stop().catch((error: unknown) => {
        this.ctx.logger.warn(messageOf(error));
      });
    }
  }

  /**
   * Gửi một khung lệnh chạy xuống tiến trình con.
   * Nhận: evaluation — lượt cần gửi.
   * Trả: không; lỗi gửi được báo thành hỏng giao thức.
   */
  dispatch(evaluation: Evaluation): void {
    this.channel
      ?.send({
        type: "run",
        id: evaluation.id,
        cwd: evaluation.spec.cwd,
        data: evaluation.data,
      })
      .catch((error: unknown) => {
        this.fail("protocol", messageOf(error));
      });
  }

  /**
   * Dựng thông điệp thoát của tiến trình con.
   * Nhận: outcome — sự thật thoát.
   * Trả: chuỗi "Node process exited (…)" kèm đuôi stderr nếu có.
   */
  exitMessage(outcome: SubprocessOutcome): string {
    return `Node process exited (${String(outcome.exitCode)}, signal ${String(outcome.signal)})${this.stderr ? `: ${this.stderr}` : ""}`;
  }

  /**
   * Giải tệp chạy, cưỡng chế argv, spawn tiến trình con và nối kênh + ống.
   * Nhận: cwd — thư mục làm việc của lượt.
   * Trả: hoàn tất khi kênh đã nối; ném lỗi khi provider thiếu ống điều khiển.
   */
  async start(cwd: string): Promise<void> {
    const executable = await this.ctx.subprocess.resolveExecutable(
      this.config.launch.executable,
      void 0,
      this.controller.signal,
    );
    if (this.closed) return;
    const argv = [
      executable,
      `--max-old-space-size=${this.config.maxOldGenerationSizeMb}`,
      ...bootstrapArgs(this.ctx.fs, this.config.launch, this.config.maxMessageBytes, true),
    ];
    const policy = this.policy;
    this.confined =
      policy.mode === "danger-full-access"
        ? void 0
        : await this.ctx.sandbox.confine(argv, { ...policy, mode: policy.mode }, this.controller.signal);
    if (this.closed) return;
    const env = Object.fromEntries(
      Object.keys(process.env)
        .filter((key) => !STARTUP_ENVIRONMENT_NAMES.has(key.toUpperCase()) && key.toUpperCase() !== "ELECTRON_RUN_AS_NODE")
        .map((key) => [key, void 0]),
    );
    const handle = this.ctx.subprocess.spawn({
      argv: this.confined?.argv ?? argv,
      cwd,
      env,
      stdio: {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        control: "pipe",
      },
      graceMs: this.config.graceMs,
    });
    this.handle = handle;
    const stdout = handle.stdout;
    const stderr = handle.stderr;
    const control = handle.control;
    if (!control || !stdout || !stderr) throw new Error("subprocess provider did not supply persistent PTC pipes");
    for (const stream of [stdout, stderr]) {
      stream.setEncoding("utf8");
      stream.on("data", (text: string) => {
        if (stream === stderr) this.stderr = (this.stderr + text).slice(-this.config.maxOutputBytes);
        this.active?.admit(text);
      });
      stream.on("error", (error: Error) => {
        this.fail("worker-exit", error.message);
      });
    }
    this.channel = new JsonChannel(
      control,
      this.config.maxMessageBytes,
      (raw, bytes) => {
        this.receive(raw, bytes);
      },
      (error, kind) => {
        if (kind === "protocol") this.fail("protocol", error.message);
        else
          setImmediate(() => {
            if (!this.closed && this.exitOutcome === void 0) handle.terminate();
          });
      },
    );
    handle.done.then(
      async (outcome) => {
        this.exitOutcome = outcome;
        await Promise.all([
          drainOutput(stdout, this.config.graceMs),
          drainOutput(stderr, this.config.graceMs),
        ]);
        setImmediate(() => {
          if (!this.closed)
            this.fail(
              this.confined !== void 0 &&
                classifyRunnerFailure(outcome.exitCode, this.stderr, this.confined.runnerFailureRules) !== void 0
                ? "sandbox-unavailable"
                : "worker-exit",
              this.exitMessage(outcome),
            );
        });
      },
      (error: unknown) => {
        this.fail("worker-exit", messageOf(error));
      },
    );
  }

  /**
   * Nhận MỘT khung thô từ kênh điều khiển và định tuyến theo giao thức.
   * Nhận: raw — giá trị đã parse nhưng CHƯA tin; bytes — số byte khung đã nhận.
   * Trả: không; mọi khung sai hình đều kết thúc bằng hỏng giao thức.
   */
  receive(raw: unknown, bytes: number): void {
    if (!record(raw)) {
      this.fail("protocol", "invalid persistent PTC frame");
      return;
    }
    const evaluation = this.active;
    if (!evaluation) {
      this.fail("protocol", "frame arrived without an active PTC evaluation");
      return;
    }
    if (!this.ready) {
      if (raw.type !== "ready") {
        this.fail("protocol", "expected persistent PTC readiness");
        return;
      }
      this.ready = true;
      this.dispatch(evaluation);
      return;
    }
    if (raw.id !== evaluation.id || !record(raw.payload)) {
      this.fail("protocol", "frame does not belong to the active PTC evaluation");
      return;
    }
    const payload = raw.payload;
    switch (payload.type) {
      case "log":
        if (typeof payload.text === "string") evaluation.admit(payload.text);
        else this.fail("protocol", "invalid persistent PTC log");
        return;
      case "output-limit":
        evaluation.finish(
          {
            kind: "output-limit",
            message: "output limit exceeded",
          },
          void 0,
          true,
        );
        return;
      case "done": {
        if (payload.error !== void 0) {
          const error = payload.error;
          if (
            !record(error) ||
            typeof error.message !== "string" ||
            (error.kind !== "exception" && error.kind !== "invalid-output" && error.kind !== "output-limit")
          ) {
            this.fail("protocol", "invalid persistent PTC failure");
            return;
          }
          const failure: PtcRunFailure = {
            kind: error.kind,
            message: error.message,
          };
          setImmediate(() => {
            evaluation.finish(failure, void 0, failure.kind === "output-limit");
          });
        } else {
          const value = payload.value === void 0 ? void 0 : decodePtcJsonWire(payload.value);
          const failure: PtcRunFailure | undefined =
            payload.value !== void 0 && value === void 0
              ? {
                  kind: "invalid-output",
                  message: "program completion must be lossless JSON",
                }
              : void 0;
          setImmediate(() => {
            evaluation.finish(failure, value);
          });
        }
        return;
      }
      case "call": {
        if (payload.id !== this.nextCall || typeof payload.global !== "string" || typeof payload.name !== "string") {
          this.fail("protocol", "invalid persistent PTC binding identity");
          return;
        }
        this.nextCall += 1;
        const args = decodePtcJsonWire(payload.args);
        if (args === void 0) {
          this.fail("protocol", "binding arguments must be lossless JSON");
          return;
        }
        if (
          ++evaluation.pending > this.config.maxPendingCalls ||
          (evaluation.pendingBytes += bytes) > this.config.maxMessageBytes
        ) {
          this.fail("protocol", "pending binding calls exceed configured limits");
          return;
        }
        const functions = evaluation.bindings.get(payload.global)?.functions;
        const fn = functions && Object.hasOwn(functions, payload.name) ? functions[payload.name] : void 0;
        const id = payload.id;
        (async () => {
          const reply = await evaluation
            .reply(id, fn, args)
            .finally(() => {
              evaluation.pending -= 1;
              evaluation.pendingBytes -= bytes;
            });
          if (this.active === evaluation) await this.channel?.send(reply);
        })().catch((error: unknown) => {
          this.fail("protocol", messageOf(error));
        });
        return;
      }
      default:
        this.fail("protocol", "unknown persistent PTC message");
    }
  }
}

/**
 * Trạng thái giữ lại trong bộ nhớ, có sandbox, nỗ lực tối đa; khởi động lại, dọn dẹp và lượt chạy bị ngắt đều xoá nó.
 * (Nguyên văn bản gốc: Sandboxed, best-effort retained state; restart, disposal, and interrupted execution clear it.)
 * Nhận: ctx — dịch vụ vòng đời/thực thi của provider; config — cấu hình đã giải; processes — bộ dọn dẹp theo chính sách.
 * Trả: không (lớp); mỗi lượt run trả PtcRunResult, release trả Promise<void>.
 */
export class InMemoryExecution {
  /** Dịch vụ provider sở hữu vòng đời. */
  private readonly ctx: PtcContext;
  /** Cấu hình đã giải. */
  private readonly config: ResolvedConfig;
  /** Bộ dọn dẹp theo chính sách của provider. */
  private readonly processes: PolicyProcesses;

  /**
   * Quy tắc hướng mô hình cho biến giữ lại, thẩm quyền, đầu ra và phục hồi.
   * Nhận: không.
   * Trả: hướng dẫn dùng gắn vào schema của run_code.
   */
  get executionInstructions(): string {
    return "The program contains TypeScript REPL statements; only erasable syntax is accepted, with no enum or namespaces. Type annotations are advisory. Top-level declarations and await are supported; top-level return is not supported. Emit output with console.log(...) or a final lossless JSON expression. Only printed values and that final expression become program output. Variables, functions, and imported modules remain in memory for this Agent across calls. Use await import(...) for modules. Direct filesystem access follows this execution's sandbox policy; process.env starts empty. Changing the session sandbox mode clears retained variables. An approved sandbox escalation runs in a separate temporary environment: it cannot access retained variables, and its declarations are discarded afterward. Restart, Agent disposal, cancellation, timeout, output overflow, or process failure clears the environment. If a variable is undefined, recreate it and reacquire its resources. State is not restored from the conversation, and failed evaluations can leave earlier mutations in memory. Redeclaring an existing let, const, or class name fails; assign to a mutable binding or use a new name. Await all tool calls; background callbacks cannot call tools after their evaluation ends. Await child-process completion before ending an evaluation; raw subprocess output belongs to whichever evaluation is active when it arrives.";
  }

  /** Tiến trình giữ trạng thái theo danh tính chủ sở hữu. */
  private readonly owners = new WeakMap<object, Kernel>();
  /** Mọi kernel còn sống (có hoặc không có chủ sở hữu). */
  private readonly kernels = new Set<Kernel>();
  /** Provider đã dọn dẹp. */
  private disposed = false;

  /**
   * Giữ tài nguyên thực thi có trạng thái dưới provider Node hiện có.
   * Nhận: ctx — dịch vụ vòng đời và thực thi của provider; config — giới hạn đã kiểm và tệp chạy đã chọn;
   *        processes — bộ vô hiệu hoá/dọn dẹp theo chính sách của provider.
   * Trả: không; ném Error khi launch là "embedded".
   */
  constructor(ctx: PtcContext, config: ResolvedConfig, processes: PolicyProcesses) {
    this.ctx = ctx;
    this.config = config;
    this.processes = processes;
    if (this.config.launch.kind === "embedded") throw new Error("Persistent PTC requires a node-script launch");
    ctx.effect(() => async () => {
      this.disposed = true;
      const results = await Promise.allSettled([...this.kernels].map((kernel) => kernel.dispose()));
      this.kernels.clear();
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") throw failed.reason;
    }, "Persistent PTC environments");
  }

  /**
   * Giải chính sách file, thư mục và hạn chót cho một REPL giữ trạng thái.
   * Nhận: request — chương trình, bindings, chủ sở hữu, thư mục và ngân sách đã trôi.
   * Trả: đầu vào đã giải kèm chính sách file đã chọn.
   */
  resolve(request: PtcRunRequest): PtcRunSpec {
    if (this.disposed) throw new Error("persistent PTC: resolve after disposal");
    const sandboxPolicy = request.sandboxPolicy ?? this.ctx.sandboxPolicy.resolve();
    const cwd = request.cwd ?? sandboxPolicy.workspaceRoot;
    if (!isAbsolute(cwd)) throw new Error("persistent PTC: cwd must be absolute");
    return {
      ...request,
      sandboxPolicy,
      cwd,
      timeoutMs:
        request.timeoutMs === null
          ? null
          : clampTimeout(request.timeoutMs, this.config.timeoutMs, this.config.maxTimeoutMs, "persistent PTC timeoutMs"),
    };
  }

  /**
   * Đánh giá câu lệnh trên tiến trình của chủ sở hữu này, hoặc tiến trình tạm khi không có chủ sở hữu.
   * Nhận: spec — yêu cầu đã giải; gọi chồng lấn cho một chủ sở hữu bị từ chối.
   * Trả: log, biểu thức JSON cuối, hoặc lỗi thực thi có cấu trúc.
   */
  async run(spec: PtcRunSpec): Promise<PtcRunResult> {
    if (this.disposed) throw new Error("persistent PTC: run after disposal");
    const sandboxPolicy = spec.sandboxPolicy;
    if (
      sandboxPolicy === void 0 ||
      !isAbsolute(spec.cwd) ||
      (spec.timeoutMs !== null &&
        (!Number.isFinite(spec.timeoutMs) || spec.timeoutMs <= 0 || spec.timeoutMs > this.config.maxTimeoutMs))
    ) {
      throw new Error("persistent PTC: run requires resolved inputs with a sandbox policy");
    }
    const bindings = validateBindings(spec);
    let kernel = spec.stateOwner === void 0 ? void 0 : this.owners.get(spec.stateOwner);
    kernel?.assertIdle();
    if (
      kernel &&
      !kernel.closed &&
      (kernel.policy.mode !== sandboxPolicy.mode ||
        kernel.policy.workspaceRoot !== sandboxPolicy.workspaceRoot ||
        kernel.policy.sessionId !== sandboxPolicy.sessionId)
    ) {
      throw new Error("persistent PTC: release the retained environment before changing its sandbox policy");
    }
    let code: string;
    try {
      code = stripTypeScriptTypes(spec.program);
    } catch (error) {
      const output = persistentOutput(this.config.maxOutputBytes);
      const outcome = output.failure([], {
        kind: "exception",
        message: messageOf(error),
      });
      if (outcome.error?.kind === "output-limit" && spec.stateOwner !== void 0) {
        try {
          await this.release(spec.stateOwner);
        } catch (failure) {
          return output.failure([], {
            kind: "worker-exit",
            message: `managed process cleanup failed: ${messageOf(failure)}`,
          });
        }
      }
      return outcome;
    }
    if (!kernel || kernel.closed) {
      if (kernel) this.kernels.delete(kernel);
      kernel = new Kernel(this.ctx, this.config, { ...sandboxPolicy }, this.processes);
      this.kernels.add(kernel);
      if (spec.stateOwner !== void 0) this.owners.set(spec.stateOwner, kernel);
    }
    try {
      return await kernel.run(spec, bindings, code);
    } finally {
      if (spec.stateOwner === void 0) this.kernels.delete(kernel);
    }
  }

  /**
   * Giải phóng trạng thái giữ lại và chờ dọn dẹp tiến trình.
   * Nhận: owner — đúng object đã đưa cho run.
   * Trả: hoàn tất sau khi tiến trình và các ống đầu ra đã dừng.
   */
  async release(owner: object): Promise<void> {
    const kernel = this.owners.get(owner);
    if (!kernel) return;
    await kernel.dispose();
    if (this.owners.get(owner) === kernel) this.owners.delete(owner);
    this.kernels.delete(kernel);
  }
}