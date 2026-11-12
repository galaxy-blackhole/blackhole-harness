/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test gói subprocess-local: artefact BYTE-IDENTICAL bundle gốc + bề mặt export + A/B HÀNH VI THẬT trên
 *      tiến trình CỤC BỘ (/bin/echo, /bin/sh, /bin/sleep, /bin/cat — KHÔNG gọi mạng), Context cordis THẬT, tệp
 *      tạm trong mkdtemp. Mỗi bên đo trong một tiến trình bun CON: bun 1.3.14 THIẾU node:util.getSystemErrorMessage
 *      và bỏ qua mock.module cho module đã nạp, nên chạy chung tiến trình cha sẽ hỏng tuỳ thứ tự tệp test.
 */
import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Readable, Writable } from "node:stream";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Chính tệp này — dùng lại làm harness cho tiến trình con. */
const SELF = join(import.meta.dir, "subprocess-local.test.ts");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "subprocess-local");
/** lib của bundle GỐC (CHỈ ĐỌC). */
const STOCK_LIB = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-subprocess-local", "lib");
/** cordis THẬT của kernel. */
const CORDIS_ENTRY = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Ba tệp artefact phải trùng từng byte với bundle gốc. */
const ARTEFACT_FILES = ["index.js", "output.js", "runner-launch-B2zsQ1Dz.js"] as const;
/** Biến môi trường chọn bên cho tiến trình con. */
const SIDE_ENV = "GBH_SUBPROCESS_SIDE";
/** Biến môi trường đưa thư mục tạm gốc cho tiến trình con. */
const ROOT_ENV = "GBH_SUBPROCESS_ROOT";
/** Nhãn dòng JSON kết quả harness. */
const RESULT_MARKER = "GBH_SUBPROCESS_RESULT:";
/** Bên đo khi chạy ở chế độ harness — undefined ở tiến trình CHA. */
const HARNESS_SIDE = process.env[SIDE_ENV];
/** Thư mục tạm gốc của tiến trình CHA; tiến trình con nhận ROOT_ENV nên KHÔNG tạo thêm. */
const ROOT = HARNESS_SIDE === "ours" || HARNESS_SIDE === "stock" ? "" : mkdtempSync(join(tmpdir(), "gbh-subprocess-local-"));

/** Bên được đo. */
type Side = "ours" | "stock";
/** Bề mặt module (của ta hoặc gốc). */
type Api = Record<string, unknown>;

/** Mặt Context cordis mà test dùng. */
interface ContextLike {
  /** Fiber gốc: dispose() chạy các hiệu ứng dọn dẹp của service. */
  fiber: { dispose(): Promise<void> };
  /** Service do constructor của runtime đăng ký (kỳ vọng: object). */
  subprocess?: unknown;
}

/** Một luồng stdio đã gom. */
interface StreamFacts {
  /** Văn bản đã gom (đuôi khi bị cắt). */
  text: string;
  /** True khi đầu luồng đã rơi khỏi cửa sổ trong bộ nhớ. */
  lossy: boolean;
  /** Tên tệp spill đã chuẩn hoá, null khi không có spill. */
  spill: string | null;
}

/** Lỗi đã chuẩn hoá về ba trường so sánh được. */
interface ErrorFacts {
  /** Tên lớp lỗi. */
  name: string;
  /** Mã lỗi hệ thống (ENOENT…), null khi không có. */
  code: string | null;
  /** Thông điệp đã bỏ đường dẫn thư mục tạm. */
  message: string;
}

/** Kết cục tiến trình (từ vựng Node close). */
interface Outcome {
  /** Mã thoát, null khi chết vì tín hiệu. */
  exitCode: number | null;
  /** Tín hiệu kết liễu, null khi thoát thường. */
  signal: string | null;
}

/** Quan sát một lần spawn thông thường. */
interface CaseFacts {
  /** Đường đi của kết quả: done · ném đồng bộ từ spawn · reject từ done. */
  via: "done" | "spawn-throw" | "done-reject";
  /** Kết cục khi thành công. */
  outcome: Outcome | null;
  /** stdout đã gom. */
  stdout: StreamFacts | null;
  /** stderr đã gom. */
  stderr: StreamFacts | null;
  /** waitForExit() sau khi done. */
  waitForExit: boolean | null;
  /** Lỗi đã chuẩn hoá khi thất bại. */
  error: ErrorFacts | null;
}

/** Quan sát ca huỷ bằng AbortSignal: kết cục, waitForExit, pid in ra, còn sống. */
interface AbortFacts { outcome: Outcome; waitForExit: boolean; pidPrinted: boolean; aliveAfter: boolean }

/** Quan sát ca vòng đời dispose: pid in ra, còn sống trước/sau, ps, handle còn lại, lần dispose hai. */
interface LifecycleFacts {
  pidPrinted: boolean;
  aliveBefore: boolean;
  aliveAfter: boolean;
  psStatus: number | null;
  liveAfter: number;
  secondDispose: ErrorFacts | null;
}

/** Quan sát ca spill toàn luồng: đuôi trong bộ nhớ + tên spill + toàn văn. */
interface SpillFacts { text: string; lossy: boolean; name: string | null; insideBase: boolean; content: string | null }

/** Quan sát ca stdout thô ("pipe"): kết cục + văn bản + waitForExit. */
interface PipeFacts { outcome: Outcome; text: string; waitForExit: boolean }

/** Quan sát một static của lớp runtime: có khai báo không + kiểu giá trị. */
interface StaticFacts { present: boolean; kind: string }

/** Quan sát bề mặt module: export, default, static, nguyên mẫu, đăng ký service. */
interface SurfaceFacts {
  exports: string[];
  defaultIsRuntime: boolean;
  namedIsClass: boolean;
  configStatic: StaticFacts;
  injectStatic: StaticFacts;
  prototype: string[];
  registered: string;
}

/** Quan sát nhánh terminal: môi trường + lỗi argv rỗng. */
interface TerminalFacts { environment: { platform: string; defaultShell?: string }; emptyArgvError: ErrorFacts }

/** Toàn bộ kết quả một bên in ra cho tiến trình cha. */
interface HarnessResult {
  side: Side;
  surface: SurfaceFacts;
  cases: Record<string, CaseFacts>;
  abort: AbortFacts;
  lifecycle: LifecycleFacts;
  spill: SpillFacts;
  pipe: PipeFacts;
  terminal: TerminalFacts;
}

/** Một reader đã gom của seam. */
interface Reader {
  /**
   * Đọc từ offset byte.
   * Nhận: offset (0 = từ đầu).
   * Trả: văn bản, offset kế, cờ mất đầu, đường dẫn spill.
   */
  readFrom(fromByte: number): { text: string; nextOffset: number; lossy: boolean; spillPath?: string };
}

/** Mặt handle mà test dùng. */
interface Handle {
  /** stdin khi spawn với stdin: 'pipe'. */
  readonly stdin?: Writable | null;
  /** stdout thô khi spawn với stdout: 'pipe'. */
  readonly stdout?: Readable | null;
  /** stderr thô khi spawn với stderr: 'pipe'. */
  readonly stderr?: Readable | null;
  /** Hai reader đã gom. */
  readonly collected: { stdout?: Reader; stderr?: Reader };
  /** Kết cục; reject khi spawn lỗi. */
  readonly done: Promise<Outcome>;
  /** Bắt đầu quy trình kết liễu. */
  terminate(): void;
  /**
   * Chờ dải tiến trình rỗng.
   * Nhận: signal giới hạn (tuỳ chọn).
   * Trả: true khi đã rỗng.
   */
  waitForExit(signal?: AbortSignal): Promise<boolean>;
}

/** Mặt runtime mà test dùng. */
interface Runtime {
  /** Hook test: thư mục spill do test sở hữu. */
  internals: { spillDir?: string };
  /** Handle còn sống. */
  readonly live: Set<unknown>;
  /**
   * Spawn một tiến trình theo spec.
   * Nhận: spec đầy đủ.
   * Trả: handle sống.
   */
  spawn(spec: SpawnSpec): Handle;
  /**
   * Hỏi môi trường terminal.
   * Nhận: signal (tuỳ chọn).
   * Trả: platform + shell mặc định.
   */
  terminalEnvironment(signal?: AbortSignal): Promise<{ platform: string; defaultShell?: string }>;
  /**
   * Mở một terminal (nhánh PTY).
   * Nhận: spec terminal.
   * Trả: handle terminal.
   */
  spawnTerminal(spec: Record<string, unknown>): Promise<{ pid: number; terminate(): Promise<void> }>;
}

/** Hàm dựng runtime từ bề mặt module. */
type RuntimeCtor = new (ctx: ContextLike) => Runtime;

/** Ba chế độ stdio dùng trong test. */
interface Stdio {
  /** stdin: bỏ qua, pipe, hoặc ghi một lần rồi đóng. */
  stdin: "ignore" | "pipe" | { data: string };
  /** stdout: pipe thô, inherit, hoặc gom có giới hạn. */
  stdout: "pipe" | "inherit" | { maxBytes: number; spill?: { maxBytes: number } };
  /** stderr: pipe thô, inherit, hoặc gom có giới hạn. */
  stderr: "pipe" | "inherit" | { maxBytes: number; spill?: { maxBytes: number } };
  /** Kênh điều khiển phụ (không dùng trong test). */
  control?: "pipe";
}

/** Một spawn spec; argv/cwd để unknown vì nhóm D cố tình truyền sai kiểu. */
interface SpawnSpec {
  /** Lệnh + tham số. */
  argv: unknown;
  /** Thư mục làm việc. */
  cwd: unknown;
  /** Ba chế độ stdio. */
  stdio: Stdio;
  /** Thời gian gia hạn TERM→KILL. */
  graceMs: number;
  /** Tín hiệu huỷ. */
  signal?: AbortSignal;
  /** Biến môi trường ghi đè. */
  env?: Record<string, string | undefined>;
}

/** Thế giới của một bên đo trong tiến trình con. */
interface World {
  /** Bên đang đo. */
  side: Side;
  /** Bề mặt module. */
  api: Api;
  /** Hàm dựng Context cordis thật. */
  Context: new () => ContextLike;
  /** Thư mục tạm gốc của bên này. */
  base: string;
}

/** Cặp quan sát của một ca sau khi đã so Y HỆT. */
interface Pair<T> { ours: T; stock: T }

/** Thư mục tạm gốc của bên đang đo (rỗng ở tiến trình cha). */
let harnessBase = "";

/** Kết quả harness của bên ta. */
let mineResult: HarnessResult | undefined;
/** Kết quả harness của bundle gốc. */
let stockResult: HarnessResult | undefined;

/**
 * Cài shim cho node:util TRƯỚC khi nạp artefact.
 * bun 1.3.14 (tương thích Node 24.3.0) THIẾU getSystemErrorMessage, trong khi chunk runner-launch import
 * tên này ở cấp module — không có shim thì CẢ HAI bản đều không nạp được. Shim lấy NGUYÊN module thật qua
 * createRequire (không import tĩnh node:util, vì bun bỏ qua mock cho module đã nạp) rồi chỉ THÊM hàm thiếu.
 * Hàm thiếu chỉ được nhánh execve Linux (koffi) gọi — không chạy trên darwin; CÙNG một shim cho CẢ HAI bên.
 * Nhận: không.
 * Trả: không.
 */
function installUtilShim(): void {
  mock.module("node:util", () => {
    const utilRequire = createRequire(import.meta.url);
    const real = utilRequire("node:util") as Record<string, unknown> & { getSystemErrorName(code: number): string };
    return {
      ...real,
      getSystemErrorMessage: (errno: number): string => {
        try {
          return real.getSystemErrorName(errno);
        } catch {
          return "unknown";
        }
      },
    };
  });
}

/**
 * Đổi đường dẫn tuyệt đối của thư mục tạm thành <base> để hai bên so được với nhau.
 * Nhận: chuỗi bất kỳ.
 * Trả: chuỗi đã thay (hoặc nguyên văn khi chưa có base).
 */
function scrub(text: string): string {
  return harnessBase === "" ? text : text.replaceAll(harnessBase, "<base>");
}

/**
 * Chuẩn hoá một lỗi về đúng ba trường so sánh được.
 * Nhận: giá trị bị ném.
 * Trả: { name, code, message }.
 */
function errorFacts(error: unknown): ErrorFacts {
  const value = error as { name?: unknown; code?: unknown; message?: unknown } | null;
  return {
    name: typeof value?.name === "string" ? value.name : "unknown",
    code: typeof value?.code === "string" ? value.code : null,
    message: scrub(typeof value?.message === "string" ? value.message : String(error)),
  };
}

/**
 * Kiểm tra một pid còn sống (kill 0).
 * Nhận: pid.
 * Trả: true khi tiến trình còn tồn tại.
 */
function isAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Tạo thư mục (đệ quy) và trả lại chính đường dẫn đó.
 * Nhận: đường dẫn tuyệt đối.
 * Trả: đường dẫn đã tạo.
 */
function ensureDir(path: string): string {
  mkdirSync(path, { recursive: true });
  return path;
}

/**
 * Đổi tên tệp spill (pid + bộ đếm + 12 hex ngẫu nhiên) thành nhãn ổn định.
 * Nhận: đường dẫn tệp spill.
 * Trả: tên tệp đã chuẩn hoá.
 */
function normaliseSpillName(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/^dsh-subprocess-\d+-\d+-[0-9a-f]{12}-/u, "dsh-subprocess-<pid>-<n>-<hex>-");
}

/**
 * Chờ tới khi một reader đã gom có chữ (tiến trình con in pid…).
 * Nhận: reader (có thể undefined) + hạn chờ.
 * Trả: văn bản đọc được (rỗng khi hết hạn).
 */
async function waitForText(reader: Reader | undefined, timeoutMs = 3000): Promise<string> {
  const startedAt = Date.now();
  let text = reader?.readFrom(0).text ?? "";
  while (text === "" && Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    text = reader?.readFrom(0).text ?? "";
  }
  return text;
}

/**
 * Gom một luồng đã đọc từ offset 0.
 * Nhận: reader của handle.
 * Trả: văn bản/đuôi + cờ mất đầu + tên spill, null khi luồng không ở chế độ gom.
 */
function streamFacts(reader: Reader | undefined): StreamFacts | null {
  if (reader === undefined) return null;
  const read = reader.readFrom(0);
  return {
    text: scrub(read.text),
    lossy: read.lossy,
    spill: read.spillPath === undefined ? null : normaliseSpillName(read.spillPath),
  };
}

/**
 * Tạo spec nền: stdin 'ignore', gom hai luồng 64 KiB, grace 5 s.
 * Nhận: argv + cwd + ghi đè tuỳ chọn.
 * Trả: spec đầy đủ.
 */
function baseSpec(argv: unknown, cwd: unknown, overrides: Partial<SpawnSpec> = {}): SpawnSpec {
  return {
    argv,
    cwd,
    stdio: { stdin: "ignore", stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } },
    graceMs: 5000,
    ...overrides,
  };
}

/**
 * Dựng một runtime MỚI trên Context cordis MỚI rồi dispose trong finally.
 * Nhận: thế giới của bên đo + thân kịch bản.
 * Trả: giá trị thân kịch bản trả về.
 */
async function withRuntime<T>(world: World, body: (runtime: Runtime) => Promise<T>): Promise<T> {
  const ctx = new world.Context();
  const runtime = new (world.api["LocalSubprocessRuntime"] as RuntimeCtor)(ctx);
  runtime.internals = { spillDir: ensureDir(join(world.base, "spill")) };
  try {
    return await body(runtime);
  } finally {
    await ctx.fiber.dispose();
  }
}

/**
 * Chạy một spec rồi gom mọi thứ quan sát được (bắt CẢ ném đồng bộ lẫn reject).
 * Nhận: thế giới + spec.
 * Trả: quan sát của ca.
 */
async function runSpec(world: World, spec: SpawnSpec): Promise<CaseFacts> {
  return withRuntime(world, async (runtime) => {
    let handle: Handle;
    try {
      handle = runtime.spawn(spec);
    } catch (error) {
      return { via: "spawn-throw", outcome: null, stdout: null, stderr: null, waitForExit: null, error: errorFacts(error) };
    }
    try {
      const outcome = await handle.done;
      return {
        via: "done",
        outcome,
        stdout: streamFacts(handle.collected.stdout),
        stderr: streamFacts(handle.collected.stderr),
        waitForExit: await handle.waitForExit(),
        error: null,
      };
    } catch (error) {
      return {
        via: "done-reject",
        outcome: null,
        stdout: streamFacts(handle.collected.stdout),
        stderr: streamFacts(handle.collected.stderr),
        waitForExit: null,
        error: errorFacts(error),
      };
    }
  });
}

/**
 * Ca huỷ: shell IGNORE SIGTERM rồi exec sleep ⇒ buộc phải leo thang KILL, nên kết cục TẤT ĐỊNH.
 * Nhận: thế giới.
 * Trả: kết cục + waitForExit + pid in ra + còn sống không.
 */
async function abortFacts(world: World): Promise<AbortFacts> {
  const cwd = ensureDir(join(world.base, "abort"));
  return withRuntime(world, async (runtime) => {
    const controller = new AbortController();
    const handle = runtime.spawn(
      baseSpec(["/bin/sh", "-c", "printf '%s' $$; trap '' TERM; exec sleep 30"], cwd, { signal: controller.signal, graceMs: 400 }),
    );
    const printed = await waitForText(handle.collected.stdout);
    controller.abort(new Error("huy-bo-trong-test"));
    const outcome = await handle.done;
    const waitForExit = await handle.waitForExit();
    const pid = Number(printed);
    return { outcome, waitForExit, pidPrinted: Number.isInteger(pid) && pid > 0, aliveAfter: isAlive(pid) };
  });
}

/**
 * Ca vòng đời: con in pid rồi exec sleep; dispose Context ⇒ con phải bị dọn (kill 0 + ps).
 * Nhận: thế giới.
 * Trả: các cờ vòng đời, kể cả lần dispose thứ hai.
 */
async function lifecycleFacts(world: World): Promise<LifecycleFacts> {
  const cwd = ensureDir(join(world.base, "lifecycle"));
  const ctx = new world.Context();
  const runtime = new (world.api["LocalSubprocessRuntime"] as RuntimeCtor)(ctx);
  runtime.internals = { spillDir: ensureDir(join(world.base, "spill")) };
  try {
    const handle = runtime.spawn(baseSpec(["/bin/sh", "-c", "printf '%s' $$; exec sleep 30"], cwd, { graceMs: 500 }));
    const printed = await waitForText(handle.collected.stdout);
    const pid = Number(printed);
    const aliveBefore = isAlive(pid);
    await ctx.fiber.dispose();
    const aliveAfter = isAlive(pid);
    const psStatus = spawnSync("/bin/ps", ["-p", String(pid)]).status ?? null;
    const liveAfter = runtime.live.size;
    let secondDispose: ErrorFacts | null = null;
    try {
      await ctx.fiber.dispose();
    } catch (error) {
      secondDispose = errorFacts(error);
    }
    return { pidPrinted: Number.isInteger(pid) && pid > 0, aliveBefore, aliveAfter, psStatus, liveAfter, secondDispose };
  } finally {
    await ctx.fiber.dispose();
  }
}

/**
 * Ca spill: đầu luồng rơi khỏi bộ nhớ nhưng tệp spill giữ TOÀN VĂN trong thư mục tạm của test.
 * Nhận: thế giới.
 * Trả: đuôi trong bộ nhớ + tên spill chuẩn hoá + toàn văn.
 */
async function spillFacts(world: World): Promise<SpillFacts> {
  const cwd = ensureDir(join(world.base, "spill"));
  return withRuntime(world, async (runtime) => {
    const handle = runtime.spawn(
      baseSpec(["/bin/sh", "-c", "printf 0123456789"], cwd, {
        stdio: { stdin: "ignore", stdout: { maxBytes: 4, spill: { maxBytes: 65536 } }, stderr: { maxBytes: 64 } },
      }),
    );
    await handle.done;
    const read = handle.collected.stdout?.readFrom(0);
    const path = read?.spillPath;
    return {
      text: scrub(read?.text ?? ""),
      lossy: read?.lossy ?? false,
      name: path === undefined ? null : normaliseSpillName(path),
      insideBase: path !== undefined && path.startsWith(world.base),
      content: path === undefined ? null : readFileSync(path, "utf8"),
    };
  });
}

/**
 * Ca stdout thô: chế độ 'pipe' tra Readable cho người gọi.
 * Nhận: thế giới.
 * Trả: kết cục + văn bản thô.
 */
async function pipeFacts(world: World): Promise<PipeFacts> {
  const cwd = ensureDir(join(world.base, "pipe"));
  return withRuntime(world, async (runtime) => {
    const handle = runtime.spawn(
      baseSpec(["/bin/sh", "-c", "printf raw"], cwd, {
        stdio: { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
      }),
    );
    let text = "";
    handle.stdout?.on("data", (chunk: Buffer) => {
      text += chunk.toString("utf8");
    });
    const outcome = await handle.done;
    await new Promise((resolve) => setTimeout(resolve, 50));
    return { outcome, text, waitForExit: await handle.waitForExit() };
  });
}

/**
 * Ca terminal: hỏi môi trường + nhánh chặn tham số của spawnTerminal (KHÔNG mở PTY).
 * PTY THẬT (node-pty) đo được ở cả hai bên nhưng tốn ~9 s/bên nên KHÔNG đưa vào cổng; ở đây chỉ đo
 * nhánh chặn tham số — vẫn là A/B "cùng ném cùng thông điệp", không bịa hành vi.
 * Nhận: thế giới.
 * Trả: môi trường terminal + lỗi argv rỗng.
 */
async function terminalFacts(world: World): Promise<TerminalFacts> {
  const cwd = ensureDir(join(world.base, "terminal"));
  return withRuntime(world, async (runtime) => {
    const environment = await runtime.terminalEnvironment();
    let emptyArgvError: ErrorFacts;
    try {
      await runtime.spawnTerminal({ argv: [], cwd, rows: 24, cols: 80, terminalType: "xterm-256color", graceMs: 500 });
      emptyArgvError = { name: "KHONG-NEM", code: null, message: "spawnTerminal khong nem voi argv rong" };
    } catch (error) {
      emptyArgvError = errorFacts(error);
    }
    return {
      environment: {
        platform: environment.platform,
        ...(environment.defaultShell === undefined ? {} : { defaultShell: environment.defaultShell }),
      },
      emptyArgvError,
    };
  });
}

/**
 * Đọc một static của lớp runtime.
 * Nhận: lớp + tên static.
 * Trả: { present, kind } để hai bên so được.
 */
function staticFacts(ctor: RuntimeCtor, key: "Config" | "inject"): StaticFacts {
  const value = (ctor as unknown as Record<string, unknown>)[key];
  return { present: value !== undefined, kind: typeof value };
}

/**
 * Đo bề mặt module trên Context cordis THẬT: export, default, static, nguyên mẫu, đăng ký service.
 * Nhận: bề mặt module + hàm dựng Context.
 * Trả: quan sát bề mặt.
 */
async function surfacts(api: Api, Context: new () => ContextLike): Promise<SurfaceFacts> {
  const Runtime = api["LocalSubprocessRuntime"] as RuntimeCtor;
  const ctx = new Context();
  // api-gateway: ctx.plugin(Lop) KHÔNG làm service hiện ra; cách ĐÚNG là gọi constructor với ctx thật.
  new Runtime(ctx);
  const registered = typeof ctx.subprocess;
  await ctx.fiber.dispose();
  return {
    exports: Object.keys(api).sort(),
    defaultIsRuntime: api["default"] === api["LocalSubprocessRuntime"],
    namedIsClass: typeof api["LocalSubprocessRuntime"] === "function",
    configStatic: staticFacts(Runtime, "Config"),
    injectStatic: staticFacts(Runtime, "inject"),
    prototype: Object.getOwnPropertyNames(Runtime.prototype).sort(),
    registered,
  };
}

/**
 * Chạy TOÀN BỘ ca đo của một bên trong tiến trình hiện tại.
 * Nhận: thế giới của bên đó.
 * Trả: kết quả harness đầy đủ.
 */
async function collectAll(world: World): Promise<HarnessResult> {
  harnessBase = world.base;
  const dir = (name: string): string => ensureDir(join(world.base, name));
  const cases: Record<string, CaseFacts> = {};

  cases["echo"] = await runSpec(world, baseSpec(["/bin/echo", "hello"], dir("echo")));
  cases["exit-7"] = await runSpec(world, baseSpec(["/bin/sh", "-c", "exit 7"], dir("exit-7")));
  cases["stdout-stderr"] = await runSpec(world, baseSpec(["/bin/sh", "-c", "printf A; printf B >&2"], dir("stdout-stderr")));
  cases["env-explicit"] = await runSpec(
    world,
    baseSpec(["/bin/sh", "-c", "printf '%s|%s' \"$GBH_TEST\" \"$DEEPSEEK_API_KEY\""], dir("env"), {
      env: { GBH_TEST: "viet", DEEPSEEK_API_KEY: "bi-mat" },
    }),
  );
  cases["stdin-batch"] = await runSpec(
    world,
    baseSpec(["/bin/cat"], dir("stdin"), {
      stdio: { stdin: { data: "ping" }, stdout: { maxBytes: 65536 }, stderr: { maxBytes: 65536 } },
    }),
  );
  cases["missing-executable"] = await runSpec(world, baseSpec(["/nonexistent-gbh-probe"], dir("missing-executable")));
  cases["missing-cwd"] = await runSpec(world, baseSpec(["/bin/echo", "x"], join(world.base, "khong-ton-tai")));
  cases["truncate-tail"] = await runSpec(
    world,
    baseSpec(["/bin/sh", "-c", "printf 0123456789"], dir("truncate"), {
      stdio: { stdin: "ignore", stdout: { maxBytes: 4 }, stderr: { maxBytes: 64 } },
    }),
  );
  cases["wait-for-exit"] = await runSpec(world, baseSpec(["/usr/bin/true"], dir("wait-for-exit")));
  cases["grace-zero"] = await runSpec(world, baseSpec(["/bin/echo", "x"], dir("grace-zero"), { graceMs: 0 }));
  cases["grace-negative"] = await runSpec(world, baseSpec(["/bin/echo", "x"], dir("grace-negative"), { graceMs: -1 }));
  cases["argv-empty"] = await runSpec(world, baseSpec([], dir("argv-empty")));
  cases["argv-not-array"] = await runSpec(world, { ...baseSpec(["/bin/echo"], dir("argv-not-array")), argv: "echo" });
  cases["cwd-not-string"] = await runSpec(world, { ...baseSpec(["/bin/echo"], dir("cwd-not-string")), cwd: 7 });
  const preAborted = new AbortController();
  preAborted.abort("pre");
  cases["pre-aborted"] = await runSpec(world, baseSpec(["/bin/echo"], dir("pre-aborted"), { signal: preAborted.signal }));

  return {
    side: world.side,
    surface: await surfacts(world.api, world.Context),
    cases,
    abort: await abortFacts(world),
    lifecycle: await lifecycleFacts(world),
    spill: await spillFacts(world),
    pipe: await pipeFacts(world),
    terminal: await terminalFacts(world),
  };
}

/**
 * Thân của tiến trình CON: nạp shim, nạp artefact của bên mình, chạy mọi ca rồi in JSON.
 * Nhận: bên cần đo.
 * Trả: không — in một dòng RESULT_MARKER + JSON.
 */
async function harnessMain(side: Side): Promise<void> {
  installUtilShim();
  const libDir = side === "ours" ? join(PKG, "lib") : STOCK_LIB;
  const api = (await import(join(libDir, "index.js"))) as Api;
  const Context = ((await import(CORDIS_ENTRY)) as { Context: new () => ContextLike }).Context;
  const owned = process.env[ROOT_ENV] === undefined;
  const base = process.env[ROOT_ENV] ?? mkdtempSync(join(tmpdir(), "gbh-subprocess-" + side + "-"));
  ensureDir(base);
  const results = await collectAll({ side, api, Context, base });
  process.stdout.write("\n" + RESULT_MARKER + JSON.stringify(results) + "\n");
  // Chỉ thư mục do CHÍNH tiến trình con tạo mới bị xoá; thư mục của tiến trình cha do afterAll dọn.
  if (owned) rmSync(base, { recursive: true, force: true });
}

/**
 * Chạy harness của MỘT bên trong tiến trình bun CON (tệp này chạy lại ở chế độ harness).
 * Nhận: bên + thư mục tạm của bên đó.
 * Trả: kết quả harness đã parse.
 */
async function runHarnessChild(side: Side, base: string): Promise<HarnessResult> {
  ensureDir(base);
  const child = spawn(process.execPath, ["test", SELF], {
    cwd: REPO,
    env: { ...process.env, [SIDE_ENV]: side, [ROOT_ENV]: base },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  const code = await new Promise<number | null>((resolve) => child.once("close", resolve));
  const line = stdout.split("\n").find((entry) => entry.startsWith(RESULT_MARKER));
  if (line === undefined) throw new Error("harness " + side + " không in kết quả (exit " + String(code) + "):\n" + stdout + "\n" + stderr);
  return JSON.parse(line.slice(RESULT_MARKER.length)) as HarnessResult;
}

/**
 * Kết quả harness của hai bên (ném khi beforeAll chưa xong).
 * Nhận: không.
 * Trả: { ours, stock }.
 */
function results(): { ours: HarnessResult; stock: HarnessResult } {
  if (mineResult === undefined || stockResult === undefined) throw new Error("chưa có kết quả harness");
  return { ours: mineResult, stock: stockResult };
}

/**
 * So Y HỆT một ca spawn giữa hai bên.
 * Nhận: id ca.
 * Trả: { ours, stock } đã qua expect(...).toEqual.
 */
function pairCase(caseId: string): Pair<CaseFacts> {
  const { ours, stock } = results();
  const mine = ours.cases[caseId];
  const theirs = stock.cases[caseId];
  if (mine === undefined || theirs === undefined) throw new Error("thiếu ca " + caseId + " trong kết quả harness");
  expect(mine).toEqual(theirs);
  return { ours: mine, stock: theirs };
}

/**
 * Băm SHA-256 một buffer.
 * Nhận: buffer.
 * Trả: chuỗi hex.
 */
function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Đăng ký toàn bộ ca test của tiến trình CHA: artefact, bề mặt, A/B hành vi, lỗi tham số, vòng đời.
 * Nhận: không.
 * Trả: không.
 */
function registerTests(): void {
  beforeAll(async () => {
    const [ours, stock] = await Promise.all([
      runHarnessChild("ours", join(ROOT, "ours")),
      runHarnessChild("stock", join(ROOT, "stock")),
    ]);
    mineResult = ours;
    stockResult = stock;
  }, 180_000);

  afterAll(() => {
    rmSync(ROOT, { recursive: true, force: true });
  });

  describe("A. artefact BYTE-IDENTICAL bundle gốc (3 tệp)", () => {
    for (const file of ARTEFACT_FILES) {
      test(file + ": cùng byte length · cùng văn bản · cùng sha256", () => {
        const builtPath = join(PKG, "lib", file);
        const stockPath = join(STOCK_LIB, file);
        const built = readFileSync(builtPath);
        const stock = readFileSync(stockPath);
        expect(built.byteLength).toBe(stock.byteLength);
        expect(statSync(builtPath).size).toBe(stock.byteLength);
        expect(built.equals(stock)).toBe(true);
        expect(built.toString("utf8")).toBe(stock.toString("utf8"));
        expect(sha256(built)).toBe(sha256(stock));
      });
    }
  });

  describe("B. bề mặt export trên artifact", () => {
    test("cùng hai tên export { LocalSubprocessRuntime, default }", () => {
      const { ours, stock } = results();
      expect(ours.surface.exports).toEqual(["LocalSubprocessRuntime", "default"]);
      expect(ours.surface).toEqual(stock.surface);
      expect(ours.surface.namedIsClass).toBe(true);
    });

    test("default === LocalSubprocessRuntime ở CẢ HAI bên", () => {
      const { ours, stock } = results();
      expect(ours.surface.defaultIsRuntime).toBe(true);
      expect(stock.surface.defaultIsRuntime).toBe(true);
    });

    test("static Config/inject + bộ phương thức nguyên mẫu trùng nhau", () => {
      const { ours, stock } = results();
      expect(ours.surface.configStatic).toEqual({ present: false, kind: "undefined" });
      expect(ours.surface.injectStatic).toEqual({ present: false, kind: "undefined" });
      expect(ours.surface.prototype).toEqual(stock.surface.prototype);
      expect(ours.surface.prototype).toContain("spawn");
      expect(ours.surface.prototype).toContain("spawnTerminal");
      expect(ours.surface.registered).toBe("object");
      expect(stock.surface.registered).toBe("object");
    });
  });

  describe("C. A/B HÀNH VI THẬT với tiến trình cục bộ (không mạng)", () => {
    test("/bin/echo hello ⇒ cùng stdout 'hello\\n' + exit 0", () => {
      const { ours } = pairCase("echo");
      expect(ours.via).toBe("done");
      expect(ours.outcome).toEqual({ exitCode: 0, signal: null });
      expect(ours.stdout?.text).toBe("hello\n");
      expect(ours.stderr?.text).toBe("");
      expect(ours.waitForExit).toBe(true);
    });

    test("/bin/sh -c 'exit 7' ⇒ cùng exit code 7", () => {
      const { ours } = pairCase("exit-7");
      expect(ours.outcome).toEqual({ exitCode: 7, signal: null });
      expect(ours.stdout?.text).toBe("");
      expect(ours.stderr?.text).toBe("");
    });

    test("/bin/sh -c 'printf A; printf B >&2' ⇒ cùng stdout A + stderr B", () => {
      const { ours } = pairCase("stdout-stderr");
      expect(ours.stdout?.text).toBe("A");
      expect(ours.stderr?.text).toBe("B");
    });

    test("biến môi trường truyền vào ⇒ cùng stdout (kể cả tên dạng credential)", () => {
      const { ours } = pairCase("env-explicit");
      expect(ours.stdout?.text).toBe("viet|bi-mat");
      expect(ours.stderr?.text).toBe("");
    });

    test("stdin ghi vào /bin/cat ⇒ cùng stdout 'ping'", () => {
      const { ours } = pairCase("stdin-batch");
      expect(ours.stdout?.text).toBe("ping");
      expect(ours.outcome).toEqual({ exitCode: 0, signal: null });
    });

    test("lệnh KHÔNG tồn tại ⇒ cùng mã lỗi ENOENT + thông điệp", () => {
      const { ours } = pairCase("missing-executable");
      expect(ours.via).toBe("done-reject");
      expect(ours.error?.code).toBe("ENOENT");
      expect(ours.error?.message).toContain("posix_spawn '/nonexistent-gbh-probe'");
    });

    test("thư mục làm việc KHÔNG tồn tại ⇒ cùng lỗi ENOENT", () => {
      const { ours } = pairCase("missing-cwd");
      expect(ours.via).toBe("done-reject");
      expect(ours.error?.code).toBe("ENOENT");
      expect(ours.error?.message).toContain("posix_spawn '/bin/echo'");
    });

    test("gom có giới hạn 4 byte ⇒ cùng ĐUÔI '6789' + lossy", () => {
      const { ours } = pairCase("truncate-tail");
      expect(ours.stdout).toEqual({ text: "6789", lossy: true, spill: null });
      expect(ours.stderr?.text).toBe("");
    });

    test("spill toàn luồng ⇒ cùng đuôi, cùng toàn văn, tệp nằm trong thư mục tạm", () => {
      const { ours, stock } = results();
      expect(ours.spill).toEqual(stock.spill);
      expect(ours.spill.text).toBe("6789");
      expect(ours.spill.lossy).toBe(true);
      expect(ours.spill.name).toBe("dsh-subprocess-<pid>-<n>-<hex>-stdout.log");
      expect(ours.spill.insideBase).toBe(true);
      expect(ours.spill.content).toBe("0123456789");
    });

    test("stdout 'pipe' thô ⇒ cùng văn bản 'raw'", () => {
      const { ours, stock } = results();
      expect(ours.pipe).toEqual(stock.pipe);
      expect(ours.pipe.text).toBe("raw");
      expect(ours.pipe.outcome).toEqual({ exitCode: 0, signal: null });
      expect(ours.pipe.waitForExit).toBe(true);
    });

    test("/usr/bin/true ⇒ cùng exit 0 + waitForExit() true", () => {
      const { ours } = pairCase("wait-for-exit");
      expect(ours.outcome).toEqual({ exitCode: 0, signal: null });
      expect(ours.waitForExit).toBe(true);
    });

    test("tiến trình ngủ rồi bị huỷ bằng AbortSignal ⇒ cùng SIGKILL + không còn tiến trình", () => {
      const { ours, stock } = results();
      expect(ours.abort).toEqual(stock.abort);
      expect(ours.abort.outcome).toEqual({ exitCode: null, signal: "SIGKILL" });
      expect(ours.abort.waitForExit).toBe(true);
      expect(ours.abort.pidPrinted).toBe(true);
      expect(ours.abort.aliveAfter).toBe(false);
    });

    test("terminalEnvironment() ⇒ cùng platform posix + shell mặc định", () => {
      const { ours, stock } = results();
      expect(ours.terminal.environment).toEqual(stock.terminal.environment);
      expect(ours.terminal.environment.platform).toBe("posix");
    });

    test("spawnTerminal argv rỗng ⇒ CÙNG NÉM (chặn tham số, KHÔNG mở PTY)", () => {
      const { ours, stock } = results();
      expect(ours.terminal.emptyArgvError).toEqual(stock.terminal.emptyArgvError);
      expect(ours.terminal.emptyArgvError).toEqual({
        name: "Error",
        code: null,
        message: "subprocess-local: terminal argv must contain a program",
      });
    });
  });

  describe("D. nhánh lỗi tham số (cùng name|code|message)", () => {
    test("argv RỖNG ⇒ cùng 'invalid argv: expected a non-empty program name at argv[0]'", () => {
      const { ours } = pairCase("argv-empty");
      expect(ours.via).toBe("spawn-throw");
      expect(ours.error?.name).toBe("Error");
      expect(ours.error?.message).toBe("invalid argv: expected a non-empty program name at argv[0]");
    });

    test("argv KHÔNG phải mảng ⇒ cùng TypeError + thông điệp", () => {
      const { ours } = pairCase("argv-not-array");
      expect(ours.via).toBe("spawn-throw");
      expect(ours.error?.name).toBe("TypeError");
      expect(ours.error?.message).toContain("spec.argv.forEach is not a function");
    });

    test("cwd KHÔNG phải chuỗi ⇒ cùng TypeError + thông điệp", () => {
      const { ours } = pairCase("cwd-not-string");
      expect(ours.via).toBe("spawn-throw");
      expect(ours.error?.name).toBe("TypeError");
      expect(ours.error?.message).toContain("value.includes is not a function");
    });

    test("graceMs = 0 ⇒ cùng lỗi biên grace", () => {
      const { ours } = pairCase("grace-zero");
      expect(ours.via).toBe("spawn-throw");
      expect(ours.error?.message).toBe("subprocess graceMs must be a positive finite number no greater than 2147483647");
    });

    test("graceMs ÂM ⇒ cùng lỗi biên grace", () => {
      const { ours } = pairCase("grace-negative");
      expect(ours.via).toBe("spawn-throw");
      expect(ours.error?.message).toBe("subprocess graceMs must be a positive finite number no greater than 2147483647");
    });

    test("signal ĐÃ abort trước spawn ⇒ cùng 'aborted before spawn: pre'", () => {
      const { ours } = pairCase("pre-aborted");
      expect(ours.via).toBe("spawn-throw");
      expect(ours.error?.message).toBe("aborted before spawn: pre");
    });
  });

  describe("E. vòng đời Context ⇒ dọn tiến trình con", () => {
    test("dispose Context ⇒ con bị dọn (kill 0 thất bại + ps không còn pid)", () => {
      const { ours, stock } = results();
      expect(ours.lifecycle).toEqual(stock.lifecycle);
      expect(ours.lifecycle.pidPrinted).toBe(true);
      expect(ours.lifecycle.aliveBefore).toBe(true);
      expect(ours.lifecycle.aliveAfter).toBe(false);
      expect(ours.lifecycle.psStatus).toBe(1);
      expect(ours.lifecycle.liveAfter).toBe(0);
    });

    test("dispose HAI LẦN ⇒ cùng hành vi: lần hai không ném, không còn handle", () => {
      const { ours, stock } = results();
      expect(ours.lifecycle).toEqual(stock.lifecycle);
      expect(ours.lifecycle.secondDispose).toBeNull();
      expect(stock.lifecycle.secondDispose).toBeNull();
      expect(ours.lifecycle.liveAfter).toBe(0);
      expect(ours.lifecycle.aliveAfter).toBe(false);
    });
  });
}

if (HARNESS_SIDE === "ours" || HARNESS_SIDE === "stock") {
  test("harness " + HARNESS_SIDE, async () => {
    await harnessMain(HARNESS_SIDE);
  }, 120_000);
} else {
  registerTests();
}