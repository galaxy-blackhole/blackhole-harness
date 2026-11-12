/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Runtime PTC chạy trên node — port 1:1 vùng `lib/types/index.js` (bundle @deepseek-ai/dsh-ptc-runtime-node,
 *      dòng 1396–1820): class NodePtcRuntime (per-call + persistent-in-memory), giữ nguyên tên export, chuỗi lỗi,
 *      hằng số và thứ tự tham số; named export + `export default` cho row nạp qua default export.
 */

/* Node PTC execution with configurable per-call processes or retained in-memory REPL state. */

import { AsyncLocalStorage } from "node:async_hooks";
import { stripTypeScriptTypes } from "node:module";
import { isAbsolute } from "node:path";

import type { Context } from "@deepseek-ai/cordis";
import { PtcRuntime } from "@deepseek-ai/dsh-ptc-runtime";
import type {
  PtcBindingNamespace,
  PtcJsonValue,
  PtcRunFailure,
  PtcRunRequest,
  PtcRunResult,
  PtcRunSpec,
  PtcRunSandbox,
} from "@deepseek-ai/dsh-ptc-runtime";
import {
  SandboxUnavailableError,
  classifyRunnerFailure,
  isRunnerSpawnFailure,
} from "@deepseek-ai/dsh-sandbox";
import type {
  ConfinedArgv,
  SandboxExecutionPolicy,
  SandboxMode,
} from "@deepseek-ai/dsh-sandbox";
import type { SubprocessHandle, SubprocessOutcome } from "@deepseek-ai/dsh-subprocess";
import { clampTimeout } from "@deepseek-ai/dsh-timeout";
// Hai import RỖNG dưới đây chỉ để nạp khai báo module của peer, nhờ đó `Context` có `fs` và `sandboxPolicy`
// (bản gốc nhận chúng qua augmentation của chính hai gói ấy). Không có giá trị runtime nào được kéo vào.
import type {} from "@deepseek-ai/dsh-fs";
import type {} from "@deepseek-ai/dsh-sandbox-policy";

import { replyToBinding, validateBindings } from "./bindings.ts";
import { JsonChannel } from "./channel.ts";
import { NodeConfig, validateConfig } from "./config.ts";
import type { Config, ResolvedConfig } from "./config.ts";
import { STARTUP_ENVIRONMENT_NAMES } from "./environment.ts";
import { decodePtcJsonWire } from "./json-wire.ts";
import { bootstrapArgs, resolveLaunch } from "./launch.ts";
import { OutputLedger } from "./output-ledger.ts";
import { terminateProcess } from "./output-stream.ts";
import { InMemoryExecution } from "./persistent.ts";
import { PolicyProcesses } from "./policy-processes.ts";
// Kiểu protocol dùng chung với tiến trình con (bản gốc: `./protocol.ts`); CHỈ là kiểu nên không kéo mã vào.
import type { ProgramBootData } from "./process-protocol.ts";

/**
 * Một lần chạy đang sống, để lúc dispose có thể huỷ và chờ.
 * Nhận: không (kiểu).
 * Trả: không (kiểu) — chỉ là hình dạng phần tử của `live`.
 */
interface LiveRun {
  /** Bộ điều khiển huỷ riêng của lần chạy. */
  controller: AbortController;
  /** Promise hoàn tất của lần chạy (resolve sau khi dọn xong). */
  finished: Promise<void>;
}

/** Tiền tố wrapper mà `stripTypeScriptTypes` cần để nhận thân hàm async (NGUYÊN VĂN bản gốc). */
const STRIP_PREFIX = "async function __dsh_program__() {\n";

/** Hậu tố wrapper tương ứng (NGUYÊN VĂN bản gốc). */
const STRIP_SUFFIX = "\n}";

/**
 * Lấy câu mô tả của một giá trị bị ném.
 * Nhận: error — giá trị bất kỳ bị ném.
 * Trả: chuỗi `message` khi là Error, ngược lại `String(error)`.
 */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Thu hẹp một giá trị về object thường (không null, không mảng).
 * Nhận: value — giá trị chưa tin.
 * Trả: true khi là object không phải mảng (dùng làm type guard).
 */
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Node execution under file policy, with optional owner-scoped retained memory.
 * Nhận: ctx — context cordis của provider (fs · subprocess · sandbox · sandboxPolicy);
 *   config — config đã qua Loader default (launch · executionMode · các trần tài nguyên).
 * Trả: không (lớp) — thực thể `ctx.ptcRuntime`, chạy mỗi lượt một tiến trình hoặc REPL giữ theo chủ sở hữu.
 */
export class NodePtcRuntime extends PtcRuntime {
  /** Service cordis mà provider này cần trước khi khởi động (NGUYÊN VĂN bản gốc). */
  static inject = ["fs", "subprocess", "sandbox", "sandboxPolicy"];

  /** Schema config của provider (Loader áp default qua `NodeConfig`). */
  static Config = NodeConfig;

  /** Ngôn ngữ nguồn mà `run` nhận. */
  readonly language = "typescript";

  /** Cơ chất thực thi. */
  readonly isolation = "process";

  /** Bộ thực thi REPL giữ trạng thái theo chủ sở hữu; vắng mặt ở chế độ per-call. */
  private readonly inMemory?: InMemoryExecution;

  /** Chủ sở hữu việc vô hiệu hoá tiến trình khi phiên đổi chính sách tệp. */
  private readonly processes: PolicyProcesses;

  /** Hình dạng chương trình mà provider này nhận. */
  override get programFormat(): "function-body" | "repl" {
    return this.inMemory ? "repl" : "function-body";
  }

  /** Hướng dẫn dùng chương trình để consumer đặt cạnh ngôn ngữ nguồn. */
  override get executionInstructions(): string {
    if (this.inMemory) return this.inMemory.executionInstructions;
    return "The program is the body of an async TypeScript function; only erasable syntax is accepted, with no enum or namespaces. Type annotations are advisory. Top-level await and return are supported. Emit output with console.log(...) or return a lossless JSON value. Only printed values and the returned value become program output. Each call runs in a fresh Node process. Node APIs are available through await import(...). Relative paths use the supplied working directory; process.env starts empty. Direct filesystem access follows this execution's sandbox policy.";
  }

  /** Config đã chốt (Loader default + executable đã chọn). */
  private readonly config: ResolvedConfig;

  /** Các lần chạy đang sống, để dispose huỷ và chờ hết. */
  private readonly live = new Set<LiveRun>();

  /** Đã dispose chưa — sau đó `resolve`/`run` từ chối. */
  private disposed = false;

  /**
   * Dựng provider: chốt config, xác thực, dựng bộ dọn theo chính sách và (tuỳ chế độ) REPL trong bộ nhớ.
   * Nhận: ctx — context cordis của provider; config — config thô do Loader áp default.
   * Trả: không.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx);
    // Loader (schemastery qua NodeConfig) đã áp default nên mọi trường bắt buộc đều có mặt tại đây.
    this.config = { ...config, launch: resolveLaunch(config.launch) } as ResolvedConfig;
    validateConfig(this.config);
    // `PolicyProcesses` khai Context TỐI THIỂU với `on(event: string, …)`; cordis thật khoá `on` theo bảng
    // `Events` nên hai hình dạng không gán được cho nhau dù cùng một giá trị runtime ⇒ ép qua `unknown`
    // đúng tại ranh giới này (không đổi hành vi: vẫn truyền chính `ctx`).
    this.processes = new PolicyProcesses(ctx as unknown as ConstructorParameters<typeof PolicyProcesses>[0]);
    if (this.config.executionMode === "persistent-in-memory") this.inMemory = new InMemoryExecution(ctx, this.config, this.processes);
    ctx.effect(() => async () => {
      this.disposed = true;
      const active = [...this.live];
      for (const run of active) run.controller.abort("runtime disposed");
      await Promise.all(active.map((run) => run.finished));
    }, "Node ptc-runtime cleanup");
  }

  /** Chế độ chính sách tệp mặc định của deployment, hoặc undefined khi provider không có. */
  override get sandboxMode(): SandboxMode | undefined {
    return this.ctx.sandboxPolicy.defaultMode;
  }

  /**
   * Giải phóng trạng thái giữ lại của một chủ sở hữu và chờ tài nguyên chạy xong.
   * Nhận: owner — đúng object đã đưa vào request dưới dạng `stateOwner`.
   * Trả: Promise hoàn tất sau khi mọi tài nguyên của chủ sở hữu được giải phóng.
   */
  override release(owner: object): Promise<void> {
    return this.inMemory ? this.inMemory.release(owner) : super.release(owner);
  }

  /** Ngân sách thời gian mặc định và trần của provider. */
  override get timeout(): {
    defaultMs: number;
    maxMs: number;
  } {
    return {
      defaultMs: Math.min(this.config.timeoutMs, this.config.maxTimeoutMs),
      maxMs: this.config.maxTimeoutMs,
    };
  }

  /**
   * Resolve directory, deadline and file policy for the selected execution mode.
   * Nhận: request — chương trình, binding, cwd/deadline tuỳ chọn và thẩm quyền đã giải.
   * Trả: đầu vào thực thi đầy đủ, với ngân sách đã cắt hoặc deadline `null` tường minh.
   */
  resolve(request: PtcRunRequest): PtcRunSpec {
    // Ép kiểu CHỈ ở ranh giới này: kiểu cục bộ của `persistent.ts` khai `sessionId?: string`, còn peer
    // khai `SessionId` có brand; cùng một giá trị runtime, khác nhau đúng ở nhãn kiểu.
    if (this.inMemory) return this.inMemory.resolve(request) as PtcRunSpec;
    if (this.disposed) throw new Error("ptc-runtime-node: resolve after disposal");
    const sandboxPolicy = request.sandboxPolicy ?? this.ctx.sandboxPolicy.resolve();
    const cwd = request.cwd ?? sandboxPolicy.workspaceRoot;
    if (!isAbsolute(cwd)) throw new Error("ptc-runtime-node: cwd must be absolute");
    return {
      ...request,
      cwd,
      timeoutMs: request.timeoutMs === null ? null : clampTimeout(request.timeoutMs, this.config.timeoutMs, this.config.maxTimeoutMs, "ptc-runtime-node: timeoutMs"),
      sandboxPolicy,
    };
  }

  /**
   * Run a resolved program under the configured execution mode.
   * Session mode changes cancel admitted calls before process launch as well as active programs.
   * Nhận: spec — đầu vào do `resolve` trả cho chế độ đang cấu hình.
   * Trả: log + JSON hoàn tất hoặc lỗi; tiến trình giữ lại sống tới khi release hoặc bị vô hiệu hoá.
   */
  async run(spec: PtcRunSpec): Promise<PtcRunResult> {
    if (this.disposed) throw new Error("ptc-runtime-node: run after disposal");
    const controller = new AbortController();
    const completion = Promise.withResolvers<void>();
    const unregister = spec.sandboxPolicy === void 0 ? void 0 : this.processes.register(spec.sandboxPolicy, async () => {
      controller.abort(new Error("sandbox mode changed"));
      await completion.promise;
    });
    const live: LiveRun = {
      controller,
      finished: completion.promise,
    };
    this.live.add(live);
    try {
      await this.processes.wait(spec.sandboxPolicy?.sessionId);
      if (this.inMemory) {
        const signal = spec.signal === void 0 ? controller.signal : AbortSignal.any([spec.signal, controller.signal]);
        return await this.inMemory.run({
          ...spec,
          signal,
        });
      }
      if (spec.sandboxPolicy === void 0) throw new Error("ptc-runtime-node: run requires a resolved sandbox policy");
      if (!isAbsolute(spec.cwd) || (spec.timeoutMs !== null && (!Number.isFinite(spec.timeoutMs) || spec.timeoutMs <= 0 || spec.timeoutMs > this.config.maxTimeoutMs))) throw new Error("ptc-runtime-node: run requires resolved cwd and timeout");
      const bindings = validateBindings(spec);
      return await this.execute(spec, spec.sandboxPolicy, bindings, controller);
    } finally {
      unregister?.();
      this.live.delete(live);
      completion.resolve();
    }
  }

  /**
   * Chạy một chương trình đã giải trong tiến trình con mới, nói chuyện qua kênh điều khiển có biên.
   * Nhận: spec — đầu vào đã giải; policy — chính sách tệp của lượt chạy; bindings — namespace đã xác thực,
   *   khoá theo global; controller — bộ huỷ riêng của lượt chạy.
   * Trả: `PtcRunResult` — log, giá trị JSON hoặc lỗi có phân loại, kèm chính sách tệp đã áp.
   */
  private async execute(
    spec: PtcRunSpec,
    policy: SandboxExecutionPolicy,
    bindings: Map<string, PtcBindingNamespace>,
    controller: AbortController,
  ): Promise<PtcRunResult> {
    const replyBinding = AsyncLocalStorage.bind(replyToBinding);
    const output = new OutputLedger(this.config.maxOutputBytes);
    const logs: string[] = [];
    const sandbox: PtcRunSandbox = {
      mode: policy.mode,
      denied: false,
    };
    const result = Promise.withResolvers<PtcRunResult>();
    const signal = spec.signal === void 0 ? controller.signal : AbortSignal.any([spec.signal, controller.signal]);
    let handle: SubprocessHandle | undefined;
    let channel: JsonChannel | undefined;
    let confined: ConfinedArgv | undefined;
    let settled = false;
    let timedOut = false;
    let outputOverflow = false;
    let overflowResult: PtcRunResult | undefined;
    let stderr = "";
    let parsing = true;
    const wallTimer = spec.timeoutMs === null ? void 0 : setTimeout(() => {
      timedOut = true;
      controller.abort("execution deadline reached");
    }, spec.timeoutMs);
    let stopping: Promise<boolean> | undefined;
    const stop = (): Promise<boolean> => {
      if (stopping !== void 0) return stopping;
      stopping = (handle === void 0 ? Promise.resolve(true) : terminateProcess(handle, this.config.graceMs)).then((drained) => {
        unregister();
        return drained;
      }, (error) => {
        stopping = void 0;
        throw error;
      });
      return stopping;
    };
    // `onAbort` khai báo TRƯỚC `finish` (bản gốc khai báo ngược lại) chỉ để tsc không báo dùng-trước-khai-báo:
    // hai hàm chỉ thật sự chạy khi cả hai đã có mặt, nên hành vi y nguyên.
    const onAbort = (): void => {
      finish(timedOut ? {
        kind: "timeout",
        message: `execution deadline reached (${spec.timeoutMs}ms)`,
      } : {
        kind: "abort",
        message: messageOf(signal.reason),
      });
    };
    const finish = (failure?: PtcRunFailure, value?: PtcJsonValue): void => {
      if (settled) return;
      settled = true;
      clearTimeout(wallTimer);
      signal.removeEventListener("abort", onAbort);
      channel?.close();
      (async () => {
        try {
          if (!await stop() && failure === void 0) failure = {
            kind: "worker-exit",
            message: "Node process output did not close cleanly",
          };
        } catch (error) {
          failure = {
            kind: "worker-exit",
            message: `managed process cleanup failed: ${messageOf(error)}`,
          };
        }
        const outcome = outputOverflow ? overflowResult ?? output.limit(logs) : failure === void 0 ? output.success(logs, value) : output.failure(logs, failure);
        result.resolve({
          ...outcome,
          sandbox: { ...sandbox },
        });
      })();
    };
    const unregister = this.processes.register(policy, async () => {
      controller.abort(new Error("sandbox mode changed"));
      await stop();
    });
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) onAbort();
    try {
      if (settled) return await result.promise;
      const stripped = stripTypeScriptTypes(STRIP_PREFIX + spec.program + STRIP_SUFFIX);
      parsing = false;
      const data: ProgramBootData = {
        code: stripped.slice(35, stripped.length - 2),
        namespaces: [...bindings.values()].map((binding) => ({
          global: binding.global,
          names: Object.keys(binding.functions),
          ...binding.errorClass ? { errorClass: binding.errorClass } : {},
        })),
        maxOutputBytes: this.config.maxOutputBytes,
      };
      const executable = await this.ctx.subprocess.resolveExecutable(this.config.launch.executable, void 0, signal);
      if (settled) return await result.promise;
      const packaged = this.config.launch.kind === "embedded";
      const heapFlag = `--max-old-space-size=${this.config.maxOldGenerationSizeMb}`;
      const argv = [
        executable,
        ...packaged ? [] : [heapFlag],
        ...bootstrapArgs(this.ctx.fs, this.config.launch, this.config.maxMessageBytes),
      ];
      confined = policy.mode === "danger-full-access" ? void 0 : await this.ctx.sandbox.confine(argv, {
        ...policy,
        mode: policy.mode,
      }, signal);
      if (settled) return await result.promise;
      if (confined !== void 0) sandbox.enforcement = confined.enforcement;
      const env: Record<string, string | undefined> = Object.fromEntries(Object.keys(process.env).filter((key) => !STARTUP_ENVIRONMENT_NAMES.has(key.toUpperCase()) && key.toUpperCase() !== "ELECTRON_RUN_AS_NODE").map((key): [string, undefined] => [key, void 0]));
      if (packaged) {
        env.DSH_PTC_RUNTIME_NODE = "1";
        env.NODE_OPTIONS = heapFlag;
      }
      handle = this.ctx.subprocess.spawn({
        argv: confined?.argv ?? argv,
        cwd: spec.cwd,
        env,
        stdio: {
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          control: "pipe",
        },
        graceMs: this.config.graceMs,
        signal,
      });
      const launched = handle;
      if (launched.control === void 0 || launched.stdout === void 0 || launched.stderr === void 0) throw new Error("subprocess provider did not supply the requested control and output pipes");
      const admit = (text: string): void => {
        if (outputOverflow) return;
        if (!output.admit(text, logs)) {
          outputOverflow = true;
          overflowResult = output.limit([...logs, text]);
          finish({
            kind: "output-limit",
            message: `outer output exceeded ${this.config.maxOutputBytes} bytes`,
          });
        }
      };
      const stdoutDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
      const stderrDecoder = new TextDecoder("utf-8", { ignoreBOM: true });
      handle.stdout?.on("data", (chunk) => {
        const text = stdoutDecoder.decode(chunk, { stream: true });
        if (text.length > 0) admit(text);
      });
      handle.stdout?.on("end", () => {
        const text = stdoutDecoder.decode();
        if (text.length > 0) admit(text);
      });
      handle.stdout?.on("error", (error) => {
        finish({
          kind: "worker-exit",
          message: messageOf(error),
        });
      });
      handle.stderr?.on("data", (chunk) => {
        const text = stderrDecoder.decode(chunk, { stream: true });
        stderr = (stderr + text).slice(-this.config.maxOutputBytes);
        if (text.length > 0) admit(text);
      });
      handle.stderr?.on("end", () => {
        const text = stderrDecoder.decode();
        if (text.length > 0) admit(text);
      });
      handle.stderr?.on("error", (error) => {
        finish({
          kind: "worker-exit",
          message: messageOf(error),
        });
      });
      let ready = false;
      let nextId = 1;
      let pending = 0;
      let pendingBytes = 0;
      const protocolFailure = (message: string): void => {
        finish({
          kind: "protocol",
          message,
        });
      };
      const processFinished = (outcome: SubprocessOutcome): void => {
        if (settled) return;
        finish(confined !== void 0 && classifyRunnerFailure(outcome.exitCode, stderr, confined.runnerFailureRules) !== void 0 ? {
          kind: "sandbox-unavailable",
          message: stderr,
        } : {
          kind: "worker-exit",
          message: `Node process exited before completing (${String(outcome.exitCode)})${stderr ? `: ${stderr}` : ""}`,
        });
      };
      const transport = new JsonChannel(launched.control, this.config.maxMessageBytes, (raw, bytes) => {
        if (!record(raw)) {
          protocolFailure("invalid control frame");
          return;
        }
        if (!ready) {
          if (raw.type !== "ready") {
            protocolFailure("program frame arrived before bootstrap readiness");
            return;
          }
          ready = true;
          transport.send({
            type: "boot",
            data,
          }).catch((error) => {
            protocolFailure(messageOf(error));
          });
          return;
        }
        switch (raw.type) {
          case "log":
            if (typeof raw.text !== "string") {
              protocolFailure("invalid log frame");
              return;
            }
            admit(raw.text);
            return;
          case "output-limit":
            outputOverflow = true;
            finish();
            return;
          case "done": {
            if (raw.error !== void 0) {
              // Đọc một lần vào biến cục bộ: cùng giá trị, chỉ để tsc thu hẹp kiểu qua chuỗi điều kiện.
              const error = raw.error;
              if (!record(error) || typeof error.message !== "string" || (error.kind !== "exception" && error.kind !== "invalid-output" && error.kind !== "output-limit")) {
                protocolFailure("invalid terminal error");
                return;
              }
              const failure: PtcRunFailure = {
                kind: error.kind,
                message: error.message,
              };
              if (confined !== void 0) sandbox.denied = confined.denialSignatures.some((signature) => failure.message.toLowerCase().includes(signature.toLowerCase()));
              if (failure.kind === "output-limit") outputOverflow = true;
              finish(failure);
              return;
            }
            const value = raw.value === void 0 ? void 0 : decodePtcJsonWire(raw.value);
            if (raw.value !== void 0 && value === void 0) finish({
              kind: "invalid-output",
              message: "program completion must be lossless JSON",
            });
            else finish(void 0, value);
            return;
          }
          case "call": {
            const id = raw.id as number;
            if (!Number.isSafeInteger(id) || id !== nextId || typeof raw.global !== "string" || typeof raw.name !== "string") {
              protocolFailure("invalid binding call identity");
              return;
            }
            nextId += 1;
            const functions = bindings.get(raw.global)?.functions;
            const fn = functions !== void 0 && Object.hasOwn(functions, raw.name) ? functions[raw.name] : void 0;
            if (typeof fn !== "function") {
              protocolFailure("program requested an undeclared binding");
              return;
            }
            const args = decodePtcJsonWire(raw.args);
            if (args === void 0) {
              protocolFailure("binding arguments must be lossless JSON");
              return;
            }
            if (++pending > this.config.maxPendingCalls || (pendingBytes += bytes) > this.config.maxMessageBytes) {
              protocolFailure("pending binding calls exceed configured limits");
              return;
            }
            (async () => {
              const reply = await replyBinding(id, fn, args).finally(() => {
                pending -= 1;
                pendingBytes -= bytes;
              });
              if (!settled) await transport.send(reply);
            })().catch((error) => {
              protocolFailure(messageOf(error));
            });
            return;
          }
          default: protocolFailure("unknown control message");
        }
      }, (error, kind) => {
        if (kind === "protocol") protocolFailure(messageOf(error));
        else if (ready) finish({
          kind: "worker-exit",
          message: messageOf(error),
        });
        else launched.done.then(processFinished, (failure) => {
          finish({
            kind: "worker-exit",
            message: messageOf(failure),
          });
        });
      });
      channel = transport;
      launched.done.then((outcome) => {
        setImmediate(() => {
          processFinished(outcome);
        });
      }, (error) => {
        finish({
          kind: confined !== void 0 && isRunnerSpawnFailure(error, confined.argv[0], spec.cwd) ? "sandbox-unavailable" : "worker-exit",
          message: messageOf(error),
        });
      });
    } catch (error) {
      finish({
        kind: error instanceof SandboxUnavailableError ? "sandbox-unavailable" : parsing ? "exception" : "worker-exit",
        message: messageOf(error),
      });
    }
    return await result.promise;
  }
}

export type { Config } from "./config.ts";
export type { LaunchConfig } from "./launch.ts";

export default NodePtcRuntime;
