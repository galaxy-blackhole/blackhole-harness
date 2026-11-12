/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Giàn test đối chứng (A/B) cho @galaxy-blackhole/gbh-terminal-bash: Context cordis THẬT + process/handle
 *      GIẢ 100% (pid/terminate/signalForeground/onData/exitCode/timeout); KHÔNG chạy shell, KHÔNG spawn thật
 */

import { normalizePackageNames } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/terminal-bash/build.ts";

/** Gốc repo. */
export const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
export const PKG = join(REPO, "packages", "host", "terminal-bash");
/** Bundle gốc (CHỈ ĐỌC) — oracle của mọi phép so. */
export const STOCK_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-terminal-bash", "lib", "index.js");
/** Cordis THẬT của runtime app. */
export const CORDIS_FILE = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Byte + văn bản bundle gốc. */
export const STOCK_BYTES = readFileSync(STOCK_FILE);
export const STOCK_TEXT = STOCK_BYTES.toString("utf8");
/** Số byte / số dòng / sha256 chốt cứng của bundle gốc. */
export const STOCK_BYTE_LENGTH = 37846;
export const STOCK_LINE_COUNT = 1085;
export const STOCK_SHA256 = "388ce251b94a919edcfb9c13f6ffc49bcd1f4caf9ee493c65b46b454786c8c8b";
/** Sáu export runtime của gói (MỘT MẶT, không default). */
export const EXPORT_NAMES = ["BashTerminalBackend", "Config", "PWSH_PROMPT_SETUP", "apply", "inject", "name"];
/** Năm dịch vụ plugin khai trong inject, ĐÚNG thứ tự. */
export const INJECT_NAMES = ["terminals", "sandboxPolicy", "sessionProjections", "subprocess", "workingDirectory"];
/** Chuỗi Config in ra (schemastery) — so nguyên văn. */
export const CONFIG_TEXT = '{ backendType?: string, shellDialect?: "bash" | "pwsh", shellPath?: string, shellArgs?: string[], rows?: number, cols?: number, scrollbackLines?: number, scrollbackMaxBytes?: number, maxReadBytes?: number, pollIntervalMs?: number, exactProbeAfterMs?: number, idleSilenceMs?: number, handoffGraceMs?: number, promptTailGraceMs?: number, timeoutMs?: number, disposeGraceMs?: number }';
/** Prompt riêng mà bundle gốc chèn sau marker OSC. */
export const PROMPT = "dsh> ";
/** Prompt function PowerShell (nguyên văn bundle gốc). */
export const PWSH_PROMPT_SETUP = "function prompt { [Console]::Write([char]27 + ']133;D;' + [int]$LASTEXITCODE + [char]7); 'dsh> ' }";
/** Preamble encoding PowerShell (nguyên văn @deepseek-ai/dsh-pwsh-local). */
export const ENCODING_PREAMBLE = "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false); ";
/** Giá trị mặc định của Config. */
export const CONFIG_DEFAULTS: Record<string, unknown> = {
  backendType: "shell",
  shellDialect: "bash",
  shellArgs: [],
  rows: 40,
  cols: 160,
  scrollbackLines: 10000,
  scrollbackMaxBytes: 4194304,
  maxReadBytes: 262144,
  pollIntervalMs: 50,
  exactProbeAfterMs: 150,
  idleSilenceMs: 3000,
  handoffGraceMs: 500,
  promptTailGraceMs: 0,
  timeoutMs: 30000,
  disposeGraceMs: 3000,
};

/** Bề mặt Context cordis tối thiểu mà test chạm tới. */
export interface CtxLike {
  /** Cấp một dịch vụ GIẢ; trả hàm rút dịch vụ. */
  provide(name: string, value: unknown): unknown;
  /** Tra dịch vụ (cordis: undefined khi chưa có). */
  get(name: string): unknown;
  /** Đăng ký listener sự kiện (fence sandbox dùng internal/dispatch). */
  on(name: string, listener: (...args: unknown[]) => void, options?: { global?: boolean }): unknown;
  /** Logger của Context (test thay error/warn để đếm lời gọi). */
  logger: { error(...args: unknown[]): void; warn(...args: unknown[]): void };
}

/** Bề mặt module plugin (của ta hoặc bản gốc). */
export interface PluginApi {
  /** Tên plugin Loader đăng ký. */
  readonly name: string;
  /** Dịch vụ plugin yêu cầu trước khi chạy. */
  readonly inject: readonly string[];
  /** Schema cấu hình runtime của plugin. */
  readonly Config: (input?: unknown) => Record<string, unknown>;
  /** Backend PTY (constructor nhận spawnTerminal/createSession để test tiêm bản GIẢ). */
  readonly BashTerminalBackend: new (
    ctx: CtxLike,
    config: Record<string, unknown>,
    spawnTerminal?: SpawnTerminalFn,
    createSession?: CreateSessionFn,
  ) => BackendLike;
  /** Prompt function PowerShell do gói export. */
  readonly PWSH_PROMPT_SETUP: string;
  /** Thân plugin: đăng ký backend PTY qua ctx.terminals. */
  readonly apply: (ctx: CtxLike, config?: unknown) => void;
}

/** Kết quả thoát của process giả. */
export interface ExitOutcome {
  /** Mã thoát. */
  readonly exitCode: number | null;
  /** Tín hiệu giết. */
  readonly signal: string | null;
}

/** Handle terminal GIẢ — đủ trường bundle gốc đọc, KHÔNG có tiến trình thật. */
export interface FakeTerminal {
  /** PID giả. */
  readonly pid: number;
  /** Kênh output (EventEmitter). */
  readonly output: EventEmitter;
  /** Kết thúc khi process giả thoát. */
  readonly done: Promise<ExitOutcome>;
  /** Các lần ghi stdin. */
  readonly writes: string[];
  /** Các tín hiệu đã gửi foreground. */
  readonly signals: string[];
  /** Số lần terminate. */
  terminateCalls: number;
  /** Ghi stdin (không spawn). */
  write(data: string): Promise<void>;
  /** Trạng thái foreground giả. */
  inspectForeground(): Promise<Foreground | undefined>;
  /** Gửi tín hiệu tới foreground giả. */
  signalForeground(signal: string): Promise<number>;
  /** Kết thúc process giả. */
  terminate(): Promise<void>;
}

/** Foreground do terminal giả báo. */
export interface Foreground {
  /** Process group id. */
  readonly processGroupId: number;
  /** Có đang chờ stdin không. */
  readonly inputWaiting: boolean;
}

/** Hành vi của terminal giả. */
export interface TerminalBehavior {
  /** success = phát data rồi chờ; exit = thoát ngay; error = lỗi transport; never = im lặng. */
  readonly mode: "success" | "exit" | "error" | "never";
  /** Data phát sau khi session gắn listener (từng chunk). */
  readonly chunks?: readonly string[];
  /** Foreground trả cho inspectForeground. */
  readonly foreground?: Foreground;
  /** Mã thoát khi exit/terminate. */
  readonly exitCode?: number | null;
  /** Tín hiệu khi exit/terminate. */
  readonly signal?: string | null;
  /** Lỗi transport khi mode=error. */
  readonly error?: Error;
}

/** Một phiên (session) mà backend trả — bề mặt test chạm tới. */
export interface SessionLike {
  /** PID kế thừa handle. */
  readonly pid?: number;
  /** Banner đầu phiên. */
  motd: string;
  /** Trạng thái hiện tại. */
  status(): { kind: string; exitCode?: number | null; signal?: string | null };
  /** Đọc scrollback. */
  read(request: { offset?: number; count?: number }): ReadView;
  /** Gửi tín hiệu tới foreground. */
  signal(signal: string): Promise<{ delivered: boolean; targetPgid: number }>;
  /** Đóng phiên. */
  close(reason: string): Promise<void>;
  /** Bắt đầu một send. */
  startSend(request: { text: string; submit: boolean; signal?: AbortSignal }): SendOperationLike;
  /** Khởi tạo phiên bash. */
  initialize?(signal?: AbortSignal): Promise<void>;
}

/** Kết quả đọc scrollback. */
export interface ReadView {
  /** Văn bản trả về. */
  readonly text: string;
  /** Tổng số dòng. */
  readonly totalLines: number;
  /** Dòng bắt đầu (đếm từ cuối). */
  readonly lineBegin: number;
  /** Dòng kết thúc. */
  readonly lineEnd: number;
  /** Có bị cắt không. */
  readonly truncated: boolean;
}

/** Operation của một send. */
export interface SendOperationLike {
  /** Kết quả khi send xong. */
  readonly done: Promise<unknown>;
  /** Huỷ send. */
  cancel(): boolean;
}

/** Backend PTY (bề mặt test chạm tới). */
export interface BackendLike {
  /** Loại backend. */
  readonly type: string;
  /** Cấu hình đã resolve. */
  readonly config: Record<string, unknown>;
  /** Context đã dùng. */
  readonly ctx: CtxLike;
  /** Hàm spawn terminal (đã tiêm hoặc mặc định). */
  readonly spawnTerminal: SpawnTerminalFn;
  /** Hàm tạo session (đã tiêm hoặc mặc định). */
  readonly createSession: CreateSessionFn;
  /** Spawn một phiên. */
  spawn(spec: SpawnSpec): Promise<SessionLike>;
}

/** Spec spawn (bề mặt bundle gốc đọc). */
export interface SpawnSpec {
  /** Chủ sở hữu phiên. */
  readonly owner: Owner;
  /** Id phiên. */
  readonly sessionId: string;
  /** cwd yêu cầu. */
  readonly cwd?: string;
  /** Tín hiệu huỷ. */
  readonly signal?: AbortSignal;
}

/** Chủ sở hữu phiên GIẢ. */
export interface Owner {
  /** Id chủ sở hữu. */
  readonly id: string;
  /** Session DSH giả. */
  readonly session: { readonly id: string };
  /** Context THẬT. */
  readonly ctx: CtxLike;
}

/** Hàm spawn terminal GIẢ. */
export type SpawnTerminalFn = (spec: Record<string, unknown>) => Promise<FakeTerminal>;

/** Hàm tạo session GIẢ. */
export type CreateSessionFn = (terminal: FakeTerminal, config: Record<string, unknown>) => SessionLike;

/** Chính sách sandbox giả. */
export interface Policy {
  /** Chế độ. */
  readonly mode: string;
  /** Các trường khác. */
  readonly [key: string]: unknown;
}

/** Một lần confine đã gọi. */
export interface ConfineCall {
  /** argv đầu vào. */
  readonly argv: readonly string[];
  /** Chính sách. */
  readonly policy: Policy;
  /** Có signal không. */
  readonly signal: boolean;
}

/** Context + các dịch vụ GIẢ đã cấp. */
export interface CtxRig {
  /** Context cordis THẬT. */
  readonly ctx: CtxLike;
  /** Backend đã register. */
  readonly registered: BackendLike[];
  /** Lỗi logger.error đã nhận. */
  readonly logs: string[];
  /** Lời gọi sandboxPolicy.resolve. */
  readonly policyCalls: unknown[];
  /** Lời gọi sandbox.confine. */
  readonly confineCalls: ConfineCall[];
}

/** Tuỳ chọn dựng Context. */
export interface CtxOptions {
  /** Chính sách sandbox mặc định. */
  readonly policy?: Policy;
  /** Có cấp ctx.sandbox không. */
  readonly withSandbox?: boolean;
  /** argv mà confine trả. */
  readonly confinedArgv?: readonly string[];
}

/** Kết quả mount backend test. */
export interface BackendRig {
  /** Context + dịch vụ. */
  readonly rig: CtxRig;
  /** Backend đã dựng. */
  readonly backend: BackendLike;
  /** Spec spawn đã dùng. */
  readonly spec: SpawnSpec;
  /** Terminal giả đã tạo (nếu spawn đã gọi). */
  readonly terminal: () => FakeTerminal | undefined;
  /** Các spec spawnTerminal đã nhận. */
  readonly spawnCalls: Record<string, unknown>[];
  /** Session giả (khi tiêm createSession). */
  readonly fakeSession: FakeSessionRig | undefined;
}

/** Session GIẢ + vết. */
export interface FakeSessionRig {
  /** Session. */
  readonly session: SessionLike;
  /** Các send đã nhận. */
  readonly sends: { text: string; submit: boolean }[];
  /** Số lần initialize. */
  initializeCalls: number;
  /** Số lần close. */
  closeCalls: number;
  /** Lý do close. */
  closeReason: string | null;
}

/** Context cordis THẬT của runtime app. */
export const ContextCtor = ((await import(CORDIS_FILE)) as { Context: new () => unknown }).Context;

/**
 * Băm SHA-256 một khối byte.
 * Nhận: bytes — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
export function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(normalizePackageNames(new TextDecoder().decode(bytes))).digest("hex");
}

/**
 * Gói một lỗi thành chuỗi so sánh được.
 * Nhận: value — giá trị bất kỳ.
 * Trả: "Name|code|message" cho Error, hoặc String(value).
 */
export function errorText(value: unknown): string {
  if (value instanceof Error) {
    const code = (value as Error & { code?: unknown }).code;
    return value.name + "|" + (typeof code === "string" ? code : "-") + "|" + value.message;
  }
  return String(value);
}

/**
 * Chạy một lượt (sync/async) và ghi kết quả hoặc lỗi thành chuỗi so sánh được.
 * Nhận: run — hàm cần chạy.
 * Trả: "ok:<JSON>" hoặc "nem|<Name>|<code>|<message>".
 */
export async function outcome(run: () => unknown): Promise<string> {
  try {
    return "ok:" + JSON.stringify(await run());
  } catch (error) {
    return "nem|" + errorText(error);
  }
}

/**
 * Chạy một lượt ĐỒNG BỘ và ghi kết quả hoặc lỗi.
 * Nhận: run — hàm cần chạy.
 * Trả: "ok:<JSON>" hoặc "nem|<Name>|<code>|<message>".
 */
export function attempt(run: () => unknown): string {
  try {
    return "ok:" + JSON.stringify(run());
  } catch (error) {
    return "nem|" + errorText(error);
  }
}

/**
 * Giải mã chuỗi "ok:<JSON>" do outcome/attempt trả.
 * Nhận: text — chuỗi kết quả.
 * Trả: giá trị JSON đã giải mã.
 */
export function decoded(text: string): unknown {
  if (!text.startsWith("ok:")) throw new Error("khong phai ket qua ok: " + text);
  return JSON.parse(text.slice(3));
}

/**
 * Dựng Context cordis THẬT + các dịch vụ GIẢ (KHÔNG spawn gì).
 * Nhận: options — chính sách sandbox + có cấp ctx.sandbox hay không.
 * Trả: CtxRig.
 */
export function makeCtx(options: CtxOptions = {}): CtxRig {
  const ctx = new ContextCtor() as unknown as CtxLike;
  const registered: BackendLike[] = [];
  const logs: string[] = [];
  const policyCalls: unknown[] = [];
  const confineCalls: ConfineCall[] = [];
  const policy: Policy = options.policy ?? { mode: "danger-full-access" };
  ctx.logger.error = (...args: unknown[]) => {
    logs.push(args.map(errorText).join(" "));
  };
  ctx.logger.warn = () => {};
  ctx.provide("terminals", {
    registerBackend(backend: BackendLike): void {
      registered.push(backend);
    },
  });
  ctx.provide("sandboxPolicy", {
    defaultMode: policy.mode,
    resolve(input: unknown): Policy {
      policyCalls.push(input);
      return policy;
    },
  });
  ctx.provide("sessionProjections", {
    stateOf(): undefined {
      return undefined;
    },
  });
  ctx.provide("subprocess", {
    async spawnTerminal(): Promise<never> {
      throw new Error("test khong duoc spawn terminal that");
    },
  });
  ctx.provide("workingDirectory", {
    async ensure(): Promise<string> {
      return "/srv/session";
    },
  });
  if (options.withSandbox === true) {
    ctx.provide("sandbox", {
      async confine(argv: readonly string[], given: Policy, signal?: AbortSignal): Promise<{ argv: readonly string[] }> {
        confineCalls.push({ argv, policy: given, signal: signal instanceof AbortSignal });
        return { argv: options.confinedArgv ?? ["/usr/bin/sandbox-exec", ...argv] };
      },
    });
  }
  return { ctx, registered, logs, policyCalls, confineCalls };
}

/**
 * Dựng handle terminal GIẢ theo hành vi; data/exit phát SAU khi session gắn listener.
 * Nhận: behavior — hành vi mong muốn.
 * Trả: FakeTerminal (không có tiến trình thật nào).
 */
export function makeTerminal(behavior: TerminalBehavior): FakeTerminal {
  const output = new EventEmitter();
  let settleDone: (value: ExitOutcome) => void = () => {};
  const done = new Promise<ExitOutcome>((resolve) => {
    settleDone = resolve;
  });
  let ended = false;
  const end = (exitCode: number | null, signal: string | null): void => {
    if (ended) return;
    ended = true;
    output.emit("end");
    settleDone({ exitCode, signal });
  };
  const terminal: FakeTerminal = {
    pid: 4242,
    output,
    done,
    writes: [],
    signals: [],
    terminateCalls: 0,
    async write(data: string): Promise<void> {
      terminal.writes.push(data);
    },
    async inspectForeground(): Promise<Foreground | undefined> {
      return behavior.foreground;
    },
    async signalForeground(signal: string): Promise<number> {
      terminal.signals.push(signal);
      return behavior.foreground?.processGroupId ?? 0;
    },
    async terminate(): Promise<void> {
      terminal.terminateCalls += 1;
      end(behavior.exitCode ?? 0, behavior.signal ?? null);
    },
  };
  setTimeout(() => {
    if (behavior.mode === "success") {
      for (const chunk of behavior.chunks ?? []) output.emit("data", Buffer.from(chunk, "utf8"));
    } else if (behavior.mode === "exit") {
      end(behavior.exitCode ?? 0, behavior.signal ?? null);
    } else if (behavior.mode === "error") {
      output.emit("error", behavior.error ?? new Error("pty exploded"));
      settleDone({ exitCode: null, signal: null });
    }
  }, 0);
  return terminal;
}

/**
 * Tạo session GIẢ (dùng cho các nhánh spawn chỉ cần bề mặt phiên).
 * Nhận: không.
 * Trả: FakeSessionRig.
 */
export function makeFakeSession(): FakeSessionRig {
  const sends: { text: string; submit: boolean }[] = [];
  const state = { initializeCalls: 0, closeCalls: 0, closeReason: null as string | null };
  const session: SessionLike = {
    pid: 777,
    motd: "",
    status(): { kind: string } {
      return { kind: "running" };
    },
    read(): ReadView {
      return { text: "", totalLines: 0, lineBegin: 0, lineEnd: 0, truncated: false };
    },
    async signal(signal: string): Promise<{ delivered: boolean; targetPgid: number }> {
      return { delivered: signal.length > 0, targetPgid: 1 };
    },
    async close(reason: string): Promise<void> {
      state.closeCalls += 1;
      state.closeReason = reason;
    },
    startSend(request: { text: string; submit: boolean }): SendOperationLike {
      sends.push({ text: request.text, submit: request.submit });
      return {
        done: Promise.resolve({ waitReason: "stdin_read", viewport: "pwsh-ready" }),
        cancel(): boolean {
          return true;
        },
      };
    },
    async initialize(): Promise<void> {
      state.initializeCalls += 1;
    },
  };
  return {
    session,
    sends,
    get initializeCalls(): number {
      return state.initializeCalls;
    },
    get closeCalls(): number {
      return state.closeCalls;
    },
    get closeReason(): string | null {
      return state.closeReason;
    },
  };
}

/**
 * Cấu hình đầy đủ cho backend test (resolve sẵn như apply làm).
 * Nhận: api — module plugin; overrides — ghi đè.
 * Trả: object cấu hình.
 */
export function backendConfig(api: PluginApi, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...api.Config({
      timeoutMs: 500,
      pollIntervalMs: 2,
      exactProbeAfterMs: 1,
      idleSilenceMs: 1000,
      handoffGraceMs: 2,
      promptTailGraceMs: 0,
      disposeGraceMs: 100,
      rows: 24,
      cols: 80,
      scrollbackLines: 100,
      scrollbackMaxBytes: 65536,
      maxReadBytes: 65536,
    }),
    shellPath: "/bin/bash",
    shellArgs: ["--noprofile", "--norc", "-i"],
    shellDialect: "bash",
    ...overrides,
  };
}

/**
 * Dựng backend với terminal GIẢ (spawnTerminal tiêm) + session THẬT/GIẢ.
 * Nhận: api — module plugin; options — hành vi + cấu hình + session giả.
 * Trả: BackendRig.
 */
export function mountBackend(
  api: PluginApi,
  options: {
    behavior?: TerminalBehavior;
    overrides?: Record<string, unknown>;
    policy?: Policy;
    withSandbox?: boolean;
    confinedArgv?: readonly string[];
    fakeSession?: boolean;
    signal?: AbortSignal;
    cwd?: string;
    spawnError?: Error;
  } = {},
): BackendRig {
  const rig = makeCtx({ policy: options.policy, withSandbox: options.withSandbox, confinedArgv: options.confinedArgv });
  const spawnCalls: Record<string, unknown>[] = [];
  let terminal: FakeTerminal | undefined;
  const fake = options.fakeSession === true ? makeFakeSession() : undefined;
  const spawnTerminal: SpawnTerminalFn = async (spec: Record<string, unknown>): Promise<FakeTerminal> => {
    spawnCalls.push(spec);
    if (options.spawnError !== undefined) throw options.spawnError;
    terminal = makeTerminal(options.behavior ?? { mode: "never" });
    return terminal;
  };
  const createSession: CreateSessionFn | undefined = fake === undefined
    ? undefined
    : (): SessionLike => fake.session;
  const backend = new api.BashTerminalBackend(rig.ctx, backendConfig(api, options.overrides), spawnTerminal, createSession);
  const spec: SpawnSpec = {
    owner: { id: "owner-1", session: { id: "session-1" }, ctx: rig.ctx },
    sessionId: "term-1",
    cwd: options.cwd ?? "/srv/cwd",
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  };
  return { rig, backend, spec, terminal: () => terminal, spawnCalls, fakeSession: fake };
}

/**
 * Mô tả spec spawn thành object JSON-so-sánh-được (bỏ owner/ctx vòng).
 * Nhận: spec — spec spawnTerminal nhận.
 * Trả: object mô tả.
 */
export function describeSpawn(spec: Record<string, unknown> | undefined): unknown {
  if (spec === undefined) return null;
  return {
    argv: spec.argv,
    cwd: spec.cwd,
    env: spec.env,
    rows: spec.rows,
    cols: spec.cols,
    terminalType: spec.terminalType,
    graceMs: spec.graceMs,
    signal: spec.signal === undefined ? "undefined" : "AbortSignal",
  };
}

/** Bundle gốc + artefact của ta (artefact build NGAY khi nạp test). */
export const stock = (await import(STOCK_FILE)) as unknown as PluginApi;
/** Đường dẫn artefact của ta (build đồng bộ, cổng byte đã chạy). */
export const OUR_FILE = buildPackage();
/** Module của ta — nạp từ artefact vừa build. */
export const ours = (await import(pathToFileURL(OUR_FILE).href)) as unknown as PluginApi;

/**
 * Chạy CÙNG một kịch bản trên bundle gốc và artefact của ta.
 * Nhận: run — kịch bản (sync/async) nhận module plugin.
 * Trả: hai chuỗi outcome.
 */
export async function pair(run: (api: PluginApi) => unknown): Promise<{ our: string; their: string }> {
  const their = await outcome(() => run(stock));
  const our = await outcome(() => run(ours));
  return { our, their };
}
