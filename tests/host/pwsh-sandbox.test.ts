/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-pwsh-sandbox: đo trên ARTIFACT (lib/index.js) và đối chứng
 *      TỪNG CA với chính bundle gốc — argv pwsh bị bọc, sự thật sandbox, phân loại từ chối, runner hỏng,
 *      sổ sự thật theo từng tiến trình, danh tính vật thể cấu hình (C6) và luật FAIL-CLOSED
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderRewriteBlock } from "../../apps/cli/src/rewrite-metadata.ts";
import { peerRangeProblems } from "./peer-range-harness.ts";

/** Gốc repo (tests/host → ../..). */
const ROOT = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(ROOT, "packages", "host", "pwsh-sandbox");
/** ARTIFACT của ta — thứ được đo, không phải src/. */
const OURS_PATH = join(PKG, "lib", "index.js");
/** Thư mục gói gốc trong kernel (CHỈ ĐỌC). */
const STOCK_PKG = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-pwsh-sandbox");
/** ARTIFACT gốc — bên đối chứng của mọi ca. */
const STOCK_PATH = join(STOCK_PKG, "lib", "index.js");
/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");

/** Một thư mục đích dùng-một-lần cho bản build tươi (đo artifact mà không đụng lib/ của repo). */
function freshOutDir(tag: string): string {
  return mkdtempSync(join(tmpdir(), "gbh-pwsh-" + tag + "-"));
}

// lib/ nằm trong .gitignore nên bản sao mới không có sẵn: build ngay để phép đo luôn chạy trên artifact.
const build = (await import(join(PKG, "build.ts"))) as {
  buildPackage: (outDir?: string) => Promise<string>;
};
if (!existsSync(OURS_PATH)) await build.buildPackage();

/** Bản build TƯƠI của ta — dùng cho phép đo bề mặt artifact. */
const FRESH_ARTIFACT = await build.buildPackage(freshOutDir("surface"));

/** Thư mục build dùng-một-lần cho artefact ĐEM NẠP (có cầu phân giải peer). */
const OURS_BUILD_DIR = freshOutDir("artefact");
// LƯỢT ĐO 01/11/2026: artefact phải nạp `@deepseek-ai/*` từ KERNEL — đúng cách mount thật symlink peer về
// kernel. Không có cầu này, artefact nạp bản sao workspace của `@deepseek-ai/dsh-shell` (cùng nội dung nhưng
// KHÁC mô-đun) nên `Object.getPrototypeOf(SandboxPwshExecutor)` lệch lớp cha của bản gốc (1 ca đỏ).
const OURS_BUILT = await build.buildPackage(OURS_BUILD_DIR);
mkdirSync(join(OURS_BUILD_DIR, "node_modules"), { recursive: true });
symlinkSync(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), join(OURS_BUILD_DIR, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OURS_BUILD_DIR, "node_modules", "@galaxy-blackhole"), "dir");

/** Chính sách cưỡng chế đã giải cho một lời gọi (hình dạng seam `sandboxPolicy` trả về). */
interface Policy {
  /** Chế độ file-effect của lần chạy. */
  mode: string;
  /** Gốc tuyệt đối mà `workspace-write` được ghi dưới. */
  workspaceRoot: string;
}

/** Một luật nhận ra runner hỏng (hình dạng `RunnerFailureRule` của seam). */
interface Rule {
  /** Cổng mã thoát khác 0 tuỳ chọn. */
  allowedExitCodes?: readonly number[];
  /** Chuỗi con chí tử trên MỘT dòng stderr. */
  fatalSignatures: readonly string[];
  /** Dòng thông tin loại trừ bằng đúng nguyên văn (không phân biệt hoa thường). */
  informationalLines?: readonly string[];
}

/** Sự thật một lần bọc mà seam `sandbox` giả trả về. */
interface ConfinedFacts {
  /** argv thay thế mà nhà cung cấp yêu cầu spawn. */
  argv: string[];
  /** Mức cưỡng chế backend đạt được. */
  enforcement: "full" | "partial";
  /** Phương ngữ từ chối của backend. */
  denialSignatures: string[];
  /** Luật nhận ra runner hỏng. */
  runnerFailureRules: Rule[];
}

/** Sự thật sandbox mà executor đóng dấu lên kết quả / lên tiến trình. */
interface SandboxFacts {
  /** Chế độ đã chạy. */
  mode: string;
  /** Có bị sandbox chặn một thao tác tệp không. */
  denied: boolean;
  /** Mức cưỡng chế, khi executor biết. */
  enforcement?: string;
  /** Runner hỏng trước khi lệnh chạy, khi executor biết. */
  runnerFailed?: boolean;
}

/** Một luồng output đã gom (hình dạng `CollectedOutput` của seam). */
interface StreamText {
  /** Toàn văn đã gom. */
  text: string;
  /** Có bị cắt vì vượt hạn không. */
  truncated: boolean;
}

/** Kết quả foreground quan sát được (chỉ các trường test dùng). */
interface RunResult {
  /** Mã thoát; null khi chết vì tín hiệu. */
  exitCode: number | null;
  /** Tín hiệu kết liễu, nếu có. */
  signal: string | null;
  /** Hạn của chính executor cắt lệnh trước tiên. */
  timedOut: boolean;
  /** Tín hiệu của bên gọi cắt lệnh trước tiên. */
  aborted: boolean;
  /** Hạn hiệu lực đã áp. */
  timeoutMs: number;
  /** Stdout đã gom. */
  stdout: StreamText;
  /** Stderr đã gom. */
  stderr: StreamText;
  /** Sự thật sandbox, vắng với executor không cưỡng chế. */
  sandbox?: SandboxFacts;
}

/** Tay nắm tiến trình mà `execute()` trả về. */
interface Handle {
  /** Settle khi tiến trình đóng (không bao giờ reject). */
  done: Promise<void>;
  /** Sự thật sandbox, đóng dấu lúc settle. */
  sandbox?: SandboxFacts;
  /** Phép chiếu foreground. */
  result(): Promise<RunResult>;
}

/** Một yêu cầu chạy (đủ trường mà executor đọc). */
interface ShellRequest {
  /** Chuỗi lệnh PowerShell. */
  command: string;
  /** Thư mục làm việc. */
  workdir?: string;
  /** Hạn mili giây. */
  timeoutMs?: number;
  /** Chính sách khi hết hạn. */
  onExpiry?: "kill" | "none";
  /** Hạn gom stdout. */
  stdoutMaxBytes?: number;
  /** Tín hiệu huỷ của bên gọi. */
  signal?: AbortSignal;
  /** Chính sách sandbox đã giải của bên gọi. */
  sandboxPolicy?: Policy;
}

/** Spec đã giải (mọi trường bắt buộc đã điền). */
type ShellSpec = ShellRequest & { workdir: string; timeoutMs: number };

/** Spec đã giải, nhìn theo hình dạng mà test đọc. */
interface ResolvedSpec {
  /** Chuỗi lệnh. */
  command: string;
  /** Thư mục làm việc đã điền. */
  workdir: string;
  /** Hạn đã áp. */
  timeoutMs: number;
  /** Chính sách khi hết hạn. */
  onExpiry: string;
  /** Hạn gom stdout. */
  stdoutMaxBytes: number;
  /** Chính sách sandbox — KHÔNG bao giờ thiếu sau `resolve()`. */
  sandboxPolicy?: Policy;
}

/** Mặt API mà test dùng trên một executor (cả hai bên cùng hình dạng). */
interface Executor {
  /** Chế độ mặc định đã cấu hình. */
  readonly sandboxMode: string | undefined;
  /** Giải một yêu cầu thành spec đầy đủ. */
  resolve(request: ShellRequest): ResolvedSpec;
  /** Chuẩn bị + spawn lệnh. */
  execute(spec: ShellSpec): Promise<Handle>;
}

/** Hàm dựng executor (lớp của ta hoặc lớp gốc). */
interface ExecutorCtor {
  /** Ba seam mà lớp khai là phụ thuộc (`static inject`). */
  inject: string[];
  new (ctx: never, config: unknown): Executor;
}

/** Mặt module của một artifact (đúng hai export của row này). */
interface ArtifactModule {
  SandboxPwshExecutor: ExecutorCtor;
  default: ExecutorCtor;
}

/** Bản của ta và bản gốc — nạp động nên tsc không kéo kiểu của chúng vào chương trình. */
const ours = (await import(OURS_BUILT)) as ArtifactModule;
const stock = (await import(STOCK_PATH)) as ArtifactModule;

/** Đọc một luồng đã gom: trả phần text còn lại kể từ offset byte. */
function readerOf(text: string): { readFrom: (from?: number) => { text: string; lossy: boolean; nextOffset: number } } {
  return { readFrom: (from = 0) => ({ text: text.slice(from), lossy: false, nextOffset: text.length }) };
}

/** Cấu hình cục bộ tối thiểu, đúng hình dạng Volatile mà `dsh-pwsh-local` đọc bằng `.get()`. */
function localConfig(pwshPath?: string): unknown {
  const volatile = <T>(value: T): { get: () => T } => ({ get: () => value });
  return {
    cwd: volatile(undefined as string | undefined),
    timeoutMs: volatile(60000),
    maxTimeoutMs: volatile(600000),
    maxOutputBytes: volatile(64000),
    maxSpillBytes: volatile(67108864),
    graceMs: volatile(3000),
    pwshPath: volatile(pwshPath),
  };
}

/** Kết cục một lần spawn mà `subprocess.spawn` giả báo về. */
interface Outcome {
  /** Mã thoát (null = chết vì tín hiệu). */
  exitCode: number | null;
  /** Tín hiệu kết liễu. */
  signal?: string | null;
  /** Stdout đã gom. */
  stdout?: string;
  /** Stderr đã gom. */
  stderr?: string;
}

/** Một spec spawn mà executor đưa cho seam `subprocess`. */
interface SpawnSpec {
  /** argv chính xác được spawn. */
  argv: string[];
  /** cwd của tiến trình. */
  cwd: string;
  /** Môi trường model-friendly đã hợp nhất. */
  env: Record<string, string>;
  /** Hạn kill escalation. */
  graceMs: number;
  /** Hạn gom output. */
  stdio: unknown;
  /** Tín hiệu đã hợp nhất. */
  signal?: AbortSignal;
}

/** Tuỳ chọn dựng "gia" ba seam giả. */
interface HarnessOptions {
  /** Chế độ mặc định của chính sách triển khai. */
  mode?: string;
  /** Chính sách mà `sandboxPolicy.resolve()` trả về. */
  policy?: Policy;
  /** Thay thế hành vi `sandbox.confine` (mặc định: bọc thành runner giả). */
  confine?: (argv: readonly string[], policy: Policy, signal?: AbortSignal) => Promise<ConfinedFacts>;
  /** Kết cục tiến trình mà `subprocess.spawn` báo về. */
  outcome?: Outcome;
  /** Kết cục theo THỨ TỰ spawn (cho ca hai lời gọi chồng lấn). */
  outcomeAt?: (index: number) => Outcome;
  /** Nếu có: `done` của tiến trình reject bằng giá trị này (nhà cung cấp từ chối). */
  spawnError?: unknown;
}

/** Một lần gọi `confine` đã quan sát. */
interface Confinement {
  /** argv mà executor đưa cho nhà cung cấp. */
  argv: string[];
  /** Chính sách mà executor đưa cho nhà cung cấp. */
  policy: Policy;
}

/** Giàn giả ba seam + sổ quan sát. */
interface Harness {
  /** Context đưa cho executor. */
  ctx: never;
  /** Mọi lần gọi `confine`. */
  confinements: Confinement[];
  /** Mọi spec spawn. */
  spawned: SpawnSpec[];
  /** Tín hiệu huỷ mà `confine` nhận. */
  signals: Array<AbortSignal | undefined>;
  /** Chính sách triển khai (đổi `defaultMode` được để đo ảnh chụp lúc dựng). */
  deployment: { defaultMode: string; resolve(): Policy };
}

/** Dựng context giả đủ cho `Service` đăng ký + ba seam mà row này tiêu thụ. */
function harness(options: HarnessOptions = {}): Harness {
  const confinements: Confinement[] = [];
  const spawned: SpawnSpec[] = [];
  const signals: Array<AbortSignal | undefined> = [];
  let spawnCount = 0;
  const deployment = {
    defaultMode: options.mode ?? "workspace-write",
    // Trả vật thể MỚI mỗi lần: ca C6 đo danh tính giữa hai lần `resolve()`.
    resolve: (): Policy => ({ ...(options.policy ?? { mode: "workspace-write", workspaceRoot: "/workspace" }) }),
  };
  const ctx = {
    reflect: { provide: (): void => {} },
    sandboxPolicy: deployment,
    sandbox: {
      confine: async (argv: readonly string[], policy: Policy, signal?: AbortSignal): Promise<ConfinedFacts> => {
        confinements.push({ argv: [...argv], policy });
        signals.push(signal);
        if (options.confine !== undefined) return await options.confine(argv, policy, signal);
        return {
          argv: ["/opt/sandbox-runner", ...argv],
          enforcement: "full",
          denialSignatures: ["read-only file system"],
          runnerFailureRules: [],
        };
      },
    },
    subprocess: {
      spawn: (spec: SpawnSpec): unknown => {
        spawned.push(spec);
        const outcome = options.outcomeAt?.(spawnCount) ?? options.outcome ?? { exitCode: 0, signal: null };
        spawnCount += 1;
        return {
          done: options.spawnError !== undefined
            ? Promise.reject(options.spawnError)
            : Promise.resolve({ exitCode: outcome.exitCode, signal: outcome.signal ?? null }),
          collected: { stdout: readerOf(outcome.stdout ?? ""), stderr: readerOf(outcome.stderr ?? "") },
          terminate: (): boolean => true,
        };
      },
    },
  };
  return { ctx: ctx as never, confinements, spawned, signals, deployment };
}

/** Phía nào của phép A/B. */
type Side = "ours" | "stock";

/** Dựng executor của một trong hai bên trên CÙNG một context giả (A/B cô lập đúng một biến). */
function executor(side: Side, ctx: never, config: unknown = localConfig()): Executor {
  const Ctor = side === "ours" ? ours.SandboxPwshExecutor : stock.SandboxPwshExecutor;
  return new Ctor(ctx, config);
}

/** Phần vá thêm của một spec (KHÔNG chứa `command` — nó luôn là tham số đầu). */
type SpecPatch = Omit<ShellRequest, "command">;

/** Spec đã giải, mặc định chạy dưới `workspace-write` trong thư mục tạm có thật. */
function specOf(command: string, patch: SpecPatch = {}): ShellSpec {
  return {
    command,
    workdir: tmpdir(),
    timeoutMs: 5000,
    onExpiry: "kill",
    stdoutMaxBytes: 64000,
    sandboxPolicy: { mode: "workspace-write", workspaceRoot: "/workspace" },
    ...patch,
  };
}

/**
 * Chờ CÓ TRẦN cho tới khi một điều kiện đúng — dùng cho ca phụ thuộc thời điểm settle.
 * Nhận: hàm điều kiện và trần mili giây.
 * Trả: không; ném khi quá trần để test ĐỎ thay vì treo.
 */
async function waitFor(condition: () => boolean, ceilingMs = 2000): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > ceilingMs) throw new Error("waitFor quá trần " + String(ceilingMs) + "ms");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

/** Liệt kê tên export của một artifact ESM (đo trên VĂN BẢN artifact). */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") names.add(name);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/u.test(text)) names.add("default");
  return [...names].sort();
}

/** Hình chụp lỗi (để so hai bên mà không phụ thuộc danh tính lớp). */
interface ErrorShape {
  /** Tên lớp lỗi. */
  name?: string;
  /** Mã lỗi có cấu trúc. */
  code?: string;
  /** Thông điệp. */
  message?: string;
}

/** Rút hình chụp lỗi từ một giá trị bị ném. */
function errorShape(error: unknown): ErrorShape {
  if (typeof error !== "object" || error === null) return { message: String(error) };
  const { name, code, message } = error as { name?: unknown; code?: unknown; message?: unknown };
  return {
    name: typeof name === "string" ? name : undefined,
    code: typeof code === "string" ? code : undefined,
    message: typeof message === "string" ? message : String(error),
  };
}

/** Kết quả quan sát được của một lần chạy: sự thật trên tay nắm, kết quả foreground, hoặc lỗi. */
interface Observed {
  /** Sự thật sandbox đóng dấu trên tiến trình. */
  sandbox?: SandboxFacts;
  /** Kết quả foreground, khi nó resolve. */
  result?: RunResult;
  /** Lỗi, khi `result()` reject. */
  error?: ErrorShape;
}

/**
 * Chạy MỘT lời gọi trên một bên rồi gom cả ba mặt quan sát được.
 * Nhận: phía cần chạy, tuỳ chọn giàn giả, và chuỗi lệnh.
 * Trả: giàn giả (để đọc `confinements`/`spawned`) + kết quả quan sát.
 */
async function runCase(side: Side, options: HarnessOptions, command = "echo hi"): Promise<{ h: Harness; observed: Observed }> {
  const h = harness(options);
  const handle = await executor(side, h.ctx).execute(specOf(command));
  await handle.done;
  const observed: Observed = { sandbox: handle.sandbox };
  try {
    observed.result = await handle.result();
  } catch (error) {
    observed.error = errorShape(error);
  }
  return { h, observed };
}

describe("bề mặt artifact: tập export của ta = tập export bản gốc", () => {
  test("export của lib/index.js khớp bản gốc và đúng hai tên", () => {
    const oursText = readFileSync(FRESH_ARTIFACT, "utf8");
    const stockText = readFileSync(STOCK_PATH, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["SandboxPwshExecutor", "default"]);
    expect(Object.keys(ours).sort()).toEqual(exportNames(oursText));
    expect(ours.default).toBe(ours.SandboxPwshExecutor);
    expect(stock.default).toBe(stock.SandboxPwshExecutor);
  });

  test("inject tĩnh, bề mặt prototype/static và LỚP CHA khớp bản gốc", () => {
    expect(ours.SandboxPwshExecutor.inject).toEqual(stock.SandboxPwshExecutor.inject);
    expect(ours.SandboxPwshExecutor.inject).toEqual(["subprocess", "sandbox", "sandboxPolicy"]);
    expect(Object.getOwnPropertyNames(ours.SandboxPwshExecutor.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.SandboxPwshExecutor.prototype).sort(),
    );
    expect(Object.getOwnPropertyNames(ours.SandboxPwshExecutor).sort()).toEqual(
      Object.getOwnPropertyNames(stock.SandboxPwshExecutor).sort(),
    );
    // CÙNG một lớp cha ⇒ peer trỏ về ĐÚNG instance của kernel (một `ctx.shell` duy nhất trong tiến trình).
    expect(Object.getPrototypeOf(ours.SandboxPwshExecutor)).toBe(Object.getPrototypeOf(stock.SandboxPwshExecutor));
  });

  test("gói HOST thuần: KHÔNG __ModuleLoader__, KHÔNG id module; build.ts nhận argv[2]; locale byte-for-byte", () => {
    const text = readFileSync(FRESH_ARTIFACT, "utf8");
    expect(text).not.toContain("__ModuleLoader__");
    expect(text.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    expect(readFileSync(join(PKG, "build.ts"), "utf8")).toContain("process.argv[2]");
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { exports?: Record<string, string> };
    expect(manifest.exports?.["./locale/*.json"]).toBe("./locale/*.json");
    for (const name of ["en.json", "zh.json"]) {
      const own = readFileSync(join(PKG, "locale", name)).toString("hex");
      const theirs = readFileSync(join(STOCK_PKG, "locale", name)).toString("hex");
      expect(own.length).toBeGreaterThan(0);
      expect(own).toBe(theirs);
    }
  });
});

describe("hành vi chính: đối chứng từng ca với bản gốc", () => {
  test("sandboxMode đọc MỘT LẦN từ chính sách triển khai, và resolve() ra spec Y HỆT", () => {
    const a = harness({ mode: "read-only" });
    const b = harness({ mode: "read-only" });
    const mine = executor("ours", a.ctx);
    const theirs = executor("stock", b.ctx);
    expect(mine.sandboxMode).toBe("read-only");
    expect(mine.sandboxMode).toBe(theirs.sandboxMode);

    const requests: ShellRequest[] = [
      { command: "echo hi" },
      { command: "echo hi", workdir: "/tmp/x", timeoutMs: 1234 },
      { command: "echo hi", sandboxPolicy: { mode: "read-only", workspaceRoot: "/r" } },
      { command: "pwd", stdoutMaxBytes: 10, onExpiry: "none" },
    ];
    const oursSpecs = requests.map((request) => mine.resolve(request));
    expect(oursSpecs).toEqual(requests.map((request) => theirs.resolve(request)));
    // Chính sách của BÊN GỌI thắng; thiếu thì rơi về chính sách triển khai — không bao giờ thiếu.
    expect(oursSpecs[2]?.sandboxPolicy).toEqual({ mode: "read-only", workspaceRoot: "/r" });
    expect(oursSpecs[1]?.sandboxPolicy).toEqual({ mode: "workspace-write", workspaceRoot: "/workspace" });
    expect(oursSpecs[1]?.timeoutMs).toBe(1234);
    // Ảnh chụp lúc DỰNG: đổi chính sách triển khai sau đó KHÔNG đổi chế độ của thực thể đã dựng.
    a.deployment.defaultMode = "danger-full-access";
    b.deployment.defaultMode = "danger-full-access";
    expect(mine.sandboxMode).toBe("read-only");
    expect(theirs.sandboxMode).toBe("read-only");
  });

  test("danger-full-access: chạy THẲNG argv pwsh, KHÔNG gọi nhà cung cấp, sandbox {denied:false}", async () => {
    const fullAccess: Policy = { mode: "danger-full-access", workspaceRoot: "/workspace" };
    const h = harness();
    const result = await (await executor("ours", h.ctx).execute(specOf("echo hi", { sandboxPolicy: fullAccess }))).result();
    expect(h.confinements.length).toBe(0);
    const argv = h.spawned[0]?.argv ?? [];
    expect(argv[0]).toContain("pwsh");
    expect(argv.slice(1, 5)).toEqual(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]);
    expect(argv[5]?.startsWith("[Console]::OutputEncoding")).toBe(true);
    expect(argv[5]?.endsWith("echo hi")).toBe(true);
    expect(result.sandbox).toEqual({ mode: "danger-full-access", denied: false });

    const h2 = harness();
    const theirs = await (await executor("stock", h2.ctx).execute(specOf("echo hi", { sandboxPolicy: fullAccess }))).result();
    expect(h2.confinements.length).toBe(0);
    expect(theirs).toEqual(result);
    expect(h2.spawned[0]).toEqual(h.spawned[0]);
  });

  test("chế độ bị cưỡng chế: argv pwsh đi qua confine, argv spawn = argv nhà cung cấp, facts đủ ba trường", async () => {
    const h = harness({ outcome: { exitCode: 0, signal: null, stdout: "hi\n" } });
    const handle = await executor("ours", h.ctx).execute(specOf("echo hi"));
    const result = await handle.result();
    // Lệnh tới nhà cung cấp ĐÚNG dạng argv pwsh mà lớp cha dựng: pwsh nhận chuỗi lệnh như MỘT phần tử.
    const confinedArgv = h.confinements[0]?.argv ?? [];
    expect(confinedArgv.slice(1, 5)).toEqual(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command"]);
    expect(confinedArgv[5]?.endsWith("echo hi")).toBe(true);
    expect(h.confinements[0]?.policy).toEqual({ mode: "workspace-write", workspaceRoot: "/workspace" });
    // ...và thứ được spawn là argv CỦA NHÀ CUNG CẤP, không phải argv gốc:
    expect(h.spawned[0]?.argv).toEqual(["/opt/sandbox-runner", ...confinedArgv]);
    expect(h.spawned[0]?.cwd).toBe(tmpdir());
    expect(result.stdout.text).toBe("hi\n");
    expect(result.sandbox).toEqual({ mode: "workspace-write", denied: false, enforcement: "full" });

    // A/B: cùng dữ kiện ⇒ cùng kết quả quan sát được, kể cả spec spawn (môi trường model-friendly).
    const h2 = harness({ outcome: { exitCode: 0, signal: null, stdout: "hi\n" } });
    const stockResult = await (await executor("stock", h2.ctx).execute(specOf("echo hi"))).result();
    expect(stockResult).toEqual(result);
    expect(h2.confinements).toEqual(h.confinements);
    expect(h2.spawned).toEqual(h.spawned);
  });

  test("bị TỪ CHỐI: exit != 0 + stderr khớp phương ngữ ⇒ denied true (phân biệt hoa/thường)", async () => {
    const h = harness({ outcome: { exitCode: 1, signal: null, stderr: "pwsh: /w/x: Read-Only File System\n" } });
    const result = await (await executor("ours", h.ctx).execute(specOf("Set-Content /w/x 1"))).result();
    expect(result.exitCode).toBe(1);
    expect(result.sandbox).toEqual({ mode: "workspace-write", denied: true, enforcement: "full" });
    const h2 = harness({ outcome: { exitCode: 1, signal: null, stderr: "pwsh: /w/x: Read-Only File System\n" } });
    expect(await (await executor("stock", h2.ctx).execute(specOf("Set-Content /w/x 1"))).result()).toEqual(result);

    // Exit 0 với CÙNG stderr KHÔNG phải bị từ chối (matchesSignature chặn exit 0) — hai bên y hệt.
    const h3 = harness({ outcome: { exitCode: 0, signal: null, stderr: "pwsh: /w/x: Read-Only File System\n" } });
    const ok = await (await executor("ours", h3.ctx).execute(specOf("$true"))).result();
    expect(ok.sandbox).toEqual({ mode: "workspace-write", denied: false, enforcement: "full" });
  });
});

describe("đường lỗi", () => {
  test("bằng chứng runner hỏng ⇒ ném SANDBOX_UNAVAILABLE, foreground", async () => {
    const rules: Rule[] = [{ fatalSignatures: ["cannot start"] }];
    const confine = async (argv: readonly string[]): Promise<ConfinedFacts> => ({
      argv: ["/opt/sandbox-runner", ...argv],
      enforcement: "partial",
      denialSignatures: ["operation not permitted"],
      runnerFailureRules: rules,
    });
    const options: HarnessOptions = { confine, outcome: { exitCode: 1, signal: null, stderr: "sandbox-runner: cannot start\n" } };
    const { observed } = await runCase("ours", options);
    expect(observed.error?.name).toBe("SandboxUnavailableError");
    expect(observed.error?.code).toBe("SANDBOX_UNAVAILABLE");
    expect(String(observed.error?.message)).toContain("workspace-write");
    expect(String(observed.error?.message)).toContain("cannot start");

    // A/B: bản gốc ném CÙNG mã + CÙNG thông điệp.
    const theirs = await runCase("stock", options);
    expect(theirs.observed.error?.code).toBe(observed.error?.code);
    expect(theirs.observed.error?.message).toBe(observed.error?.message);
  });

  test("FAIL-CLOSED: nhà cung cấp từ chối ⇒ lỗi đi thẳng ra, KHÔNG có tiến trình nào được spawn", async () => {
    const refused = new Error("no sandbox backend is usable on this host");
    const options: HarnessOptions = { confine: async () => { throw refused; } };
    const h = harness(options);
    const error = await executor("ours", h.ctx).execute(specOf("echo hi")).then(() => undefined, (thrown: unknown) => thrown);
    expect(error as Error).toBe(refused);
    // Đây là tính CHẤT AN NINH của row: không bao giờ có đường chạy lệnh KHÔNG bị cưỡng chế.
    expect(h.spawned.length).toBe(0);
    const h2 = harness(options);
    const stockError = await executor("stock", h2.ctx).execute(specOf("echo hi")).then(() => undefined, (thrown: unknown) => thrown);
    expect(stockError as Error).toBe(refused);
    expect(h2.spawned.length).toBe(0);
  });

  test("spawn hỏng vì CHÍNH runner (ENOENT + đúng argv[0]) ⇒ SANDBOX_UNAVAILABLE + runnerFailed trên tiến trình", async () => {
    const runner = "/opt/khong-co-sandbox-runner";
    const spawnError = Object.assign(new Error("spawn " + runner + " ENOENT"), {
      code: "ENOENT",
      path: runner,
      syscall: "spawn " + runner,
    });
    const confine = async (argv: readonly string[]): Promise<ConfinedFacts> => ({
      argv: [runner, ...argv],
      enforcement: "full",
      denialSignatures: [],
      runnerFailureRules: [],
    });
    for (const side of ["ours", "stock"] as const) {
      const { observed } = await runCase(side, { confine, spawnError });
      expect(observed.error?.code).toBe("SANDBOX_UNAVAILABLE");
      expect(String(observed.error?.message)).toContain("Runner failure");
      expect(observed.sandbox).toEqual({ mode: "workspace-write", denied: false, enforcement: "full", runnerFailed: true });
    }
  });

  test("spawn ENOENT KHÔNG chỉ đích danh runner ⇒ lỗi đi nguyên vẹn, không bị bọc thành SANDBOX_UNAVAILABLE", async () => {
    const runner = "/opt/sandbox-runner";
    const spawnError = Object.assign(new Error("spawn /bin/khac ENOENT"), {
      code: "ENOENT",
      path: "/bin/khac",
      syscall: "spawn /bin/khac",
    });
    const confine = async (argv: readonly string[]): Promise<ConfinedFacts> => ({
      argv: [runner, ...argv],
      enforcement: "full",
      denialSignatures: [],
      runnerFailureRules: [],
    });
    for (const side of ["ours", "stock"] as const) {
      const { observed } = await runCase(side, { confine, spawnError });
      expect(observed.error?.name).toBe("Error");
      expect(observed.error?.code).toBe("ENOENT");
      expect(observed.error?.message).toBe("spawn /bin/khac ENOENT");
      // Không phải runner hỏng ⇒ KHÔNG có cờ runnerFailed, và cũng không phải bị từ chối.
      expect(observed.sandbox).toEqual({ mode: "workspace-write", denied: false, enforcement: "full" });
    }
  });

  test("huỷ trong lúc chờ: tín hiệu đã abort ⇒ ném lại lý do huỷ, KHÔNG bọc thành lỗi runner", async () => {
    const reason = new Error("nguoi dung huy");
    const controller = new AbortController();
    controller.abort(reason);
    for (const side of ["ours", "stock"] as const) {
      const h = harness({ confine: async () => { throw reason; } });
      const error = await executor(side, h.ctx)
        .execute(specOf("echo hi", { signal: controller.signal }))
        .then(() => undefined, (thrown: unknown) => thrown);
      expect(error as Error).toBe(reason);
      expect(h.spawned.length).toBe(0);
    }
  });
});

describe("ma trận phân loại — chạy QUA artifact, đối chứng với bản gốc", () => {
  /** Một dòng của ma trận: dữ kiện confine + kết cục + kỳ vọng tuyệt đối. */
  interface Row {
    /** Tên ca, dùng trong thông điệp lỗi của expect. */
    name: string;
    /** Phương ngữ từ chối của lần bọc. */
    denialSignatures: string[];
    /** Luật runner hỏng của lần bọc. */
    runnerFailureRules: Rule[];
    /** Kết cục tiến trình. */
    outcome: Outcome;
    /** Sự thật sandbox kỳ vọng trên tay nắm. */
    sandbox: SandboxFacts;
    /** Chi tiết chí tử kỳ vọng trong thông điệp lỗi (khi phải ném). */
    throwsWith?: string;
  }

  const rows: Row[] = [
    {
      name: "cổng allowedExitCodes chặn match",
      denialSignatures: [],
      runnerFailureRules: [{ allowedExitCodes: [2], fatalSignatures: ["fatal boom"] }],
      outcome: { exitCode: 1, stderr: "runner: fatal boom\n" },
      sandbox: { mode: "workspace-write", denied: false, enforcement: "full" },
    },
    {
      name: "dòng thông tin bị loại trừ bằng đúng nguyên văn",
      denialSignatures: [],
      runnerFailureRules: [{ fatalSignatures: ["fatal boom"], informationalLines: ["BWRAP: INFORMATIONAL"] }],
      outcome: { exitCode: 1, stderr: "bwrap: informational\nrunner: fatal boom\n" },
      sandbox: { mode: "workspace-write", denied: false, enforcement: "full", runnerFailed: true },
      throwsWith: "runner: fatal boom",
    },
    {
      name: "chữ ký chí tử ở dòng SAU + CRLF",
      denialSignatures: [],
      runnerFailureRules: [{ fatalSignatures: ["fatal boom"], allowedExitCodes: [3] }],
      outcome: { exitCode: 3, stderr: "a\r\nfatal boom\r\n" },
      sandbox: { mode: "workspace-write", denied: false, enforcement: "full", runnerFailed: true },
      throwsWith: "fatal boom",
    },
    {
      name: "exit 0 không bao giờ là runner hỏng",
      denialSignatures: ["read-only file system"],
      runnerFailureRules: [{ fatalSignatures: ["fatal boom"] }],
      outcome: { exitCode: 0, stderr: "fatal boom" },
      sandbox: { mode: "workspace-write", denied: false, enforcement: "full" },
    },
    {
      name: "chữ ký rỗng/toàn khoảng trắng bị bỏ qua",
      denialSignatures: [],
      runnerFailureRules: [{ fatalSignatures: ["", "   "] }],
      outcome: { exitCode: 1, stderr: "bat ky thu gi\n" },
      sandbox: { mode: "workspace-write", denied: false, enforcement: "full" },
    },
    {
      name: "chết vì tín hiệu (exitCode null) KHÔNG phải bị từ chối",
      denialSignatures: ["read-only file system"],
      runnerFailureRules: [],
      outcome: { exitCode: null, signal: "SIGTERM", stderr: "read-only file system\n" },
      sandbox: { mode: "workspace-write", denied: false, enforcement: "full" },
    },
    {
      name: "từ chối khớp phương ngữ backend (không phân biệt hoa thường)",
      denialSignatures: ["Read-Only File System"],
      runnerFailureRules: [],
      outcome: { exitCode: 2, stderr: "pwsh: READ-ONLY FILE SYSTEM\n" },
      sandbox: { mode: "workspace-write", denied: true, enforcement: "full" },
    },
  ];

  test("bảy hình dạng phân loại cho cùng sự thật sandbox ở CẢ HAI bên", async () => {
    for (const row of rows) {
      const confine = async (argv: readonly string[]): Promise<ConfinedFacts> => ({
        argv: ["/opt/sandbox-runner", ...argv],
        enforcement: "full",
        denialSignatures: row.denialSignatures,
        runnerFailureRules: row.runnerFailureRules,
      });
      const mine = await runCase("ours", { confine, outcome: row.outcome });
      const theirs = await runCase("stock", { confine, outcome: row.outcome });
      expect(mine.observed.sandbox, row.name).toEqual(row.sandbox);
      expect(theirs.observed.sandbox, row.name).toEqual(mine.observed.sandbox);
      if (row.throwsWith === undefined) {
        expect(mine.observed.error, row.name).toBe(undefined);
        expect(mine.observed.result?.sandbox, row.name).toEqual(row.sandbox);
      } else {
        expect(mine.observed.error?.code, row.name).toBe("SANDBOX_UNAVAILABLE");
        expect(String(mine.observed.error?.message), row.name).toContain(row.throwsWith);
        expect(theirs.observed.error?.message, row.name).toBe(mine.observed.error?.message);
      }
    }
  });

  test("tiến trình NỀN: sự thật đóng dấu lúc settle, không phải lúc execute() trả về (waitFor có trần)", async () => {
    const h = harness({ outcome: { exitCode: 1, signal: null, stderr: "pwsh: read-only file system\n" } });
    const handle = await executor("ours", h.ctx).execute(specOf("Set-Content /w/x 1"));
    await waitFor(() => handle.sandbox !== undefined);
    expect(handle.sandbox).toEqual({ mode: "workspace-write", denied: true, enforcement: "full" });

    const h2 = harness({ outcome: { exitCode: 1, signal: null, stderr: "pwsh: read-only file system\n" } });
    const stockHandle = await executor("stock", h2.ctx).execute(specOf("Set-Content /w/x 1"));
    await waitFor(() => stockHandle.sandbox !== undefined);
    expect(stockHandle.sandbox).toEqual(handle.sandbox);
  });
});

describe("sổ sự thật theo TỪNG tiến trình (lý do tồn tại của Map)", () => {
  test("hai lời gọi chồng lấn với hai phương ngữ khác nhau ⇒ mỗi bên phân loại bằng sự thật CỦA MÌNH", async () => {
    const outcomes: Outcome[] = [
      { exitCode: 1, stderr: "runner-a: DIALECT-A denied the write\n" },
      { exitCode: 1, stderr: "runner-b: nothing to see here\n" },
    ];
    for (const side of ["ours", "stock"] as const) {
      // Bộ đếm đặt LẠI cho mỗi bên: mỗi bên nhận đúng hai lần bọc như nhau.
      let call = 0;
      const factsOf = (argv: readonly string[]): ConfinedFacts => {
        call += 1;
        return call === 1
          ? { argv: ["/opt/runner-a", ...argv], enforcement: "full", denialSignatures: ["dialect-a"], runnerFailureRules: [] }
          : { argv: ["/opt/runner-b", ...argv], enforcement: "partial", denialSignatures: ["dialect-b"], runnerFailureRules: [] };
      };
      const h = harness({ confine: async (argv) => factsOf(argv), outcomeAt: (index) => outcomes[index] ?? { exitCode: 0 } });
      const mine = executor(side, h.ctx);
      const first = await mine.execute(specOf("Set-Content a 1"));
      const second = await mine.execute(specOf("Set-Content b 1"));
      const [r1, r2] = await Promise.all([first.result(), second.result()]);
      expect(r1.sandbox).toEqual({ mode: "workspace-write", denied: true, enforcement: "full" });
      expect(r2.sandbox).toEqual({ mode: "workspace-write", denied: false, enforcement: "partial" });
    }
  });
});

describe("C6 — vật thể cấu hình phải ĐỘC LẬP (so danh tính, không so sâu)", () => {
  test("hai lần resolve() cho HAI spec và HAI chính sách riêng; chính sách của bên gọi đi qua NGUYÊN danh tính", () => {
    const h = harness();
    const mine = executor("ours", h.ctx);
    const theirs = executor("stock", harness().ctx);
    const s1 = mine.resolve({ command: "echo hi" });
    const s2 = mine.resolve({ command: "echo hi" });
    // Phép so sâu ĐẠT cả khi hai lần trả CÙNG một vật thể ⇒ phải so DANH TÍNH.
    expect(s1).not.toBe(s2);
    expect(s1.sandboxPolicy).not.toBe(s2.sandboxPolicy);
    expect(s1.sandboxPolicy).toEqual(s2.sandboxPolicy);

    const t1 = theirs.resolve({ command: "echo hi" });
    const t2 = theirs.resolve({ command: "echo hi" });
    expect(t1).not.toBe(t2);
    expect(t1.sandboxPolicy).not.toBe(t2.sandboxPolicy);

    // Chính sách do BÊN GỌI cấp KHÔNG bị sao chép: đúng vật thể ấy đi vào spec (hành vi bản gốc).
    const supplied: Policy = { mode: "read-only", workspaceRoot: "/r" };
    expect(mine.resolve({ command: "x", sandboxPolicy: supplied }).sandboxPolicy).toBe(supplied);
    expect(theirs.resolve({ command: "x", sandboxPolicy: supplied }).sandboxPolicy).toBe(supplied);
  });

  test("chính sách đưa cho confine là vật thể MỚI: sửa nó KHÔNG lan sang spec", async () => {
    const h = harness();
    const spec = specOf("echo hi");
    const handle = await executor("ours", h.ctx).execute(spec);
    await handle.result();
    const received = h.confinements[0]?.policy;
    expect(received).not.toBe(spec.sandboxPolicy);
    expect(received).toEqual(spec.sandboxPolicy);
    // Sửa vật thể nhà cung cấp NHẬN được không được làm đổi chính sách của bên gọi.
    if (received !== undefined) received.workspaceRoot = "/bi-doi";
    expect(spec.sandboxPolicy?.workspaceRoot).toBe("/workspace");

    const h2 = harness();
    const stockSpec = specOf("echo hi");
    const stockHandle = await executor("stock", h2.ctx).execute(stockSpec);
    await stockHandle.result();
    const stockReceived = h2.confinements[0]?.policy;
    expect(stockReceived).not.toBe(stockSpec.sandboxPolicy);
    if (stockReceived !== undefined) stockReceived.workspaceRoot = "/bi-doi";
    expect(stockSpec.sandboxPolicy?.workspaceRoot).toBe("/workspace");
  });

  test("hai thực thể executor có chế độ RIÊNG (không chia sẻ trạng thái của chính sách triển khai)", () => {
    const h = harness({ mode: "read-only" });
    const a = executor("ours", h.ctx);
    const b = executor("ours", h.ctx);
    expect(a.sandboxMode).toBe("read-only");
    expect(b.sandboxMode).toBe("read-only");
    h.deployment.defaultMode = "danger-full-access";
    expect(a.sandboxMode).toBe("read-only");
    expect(b.sandboxMode).toBe("read-only");
    const c = executor("ours", h.ctx);
    expect(c.sandboxMode).toBe("danger-full-access");
    expect(c.sandboxMode).not.toBe(a.sandboxMode);
  });
});

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Metadata của ta để `bh host` sinh khối patch. */
  gbh?: { peers?: string[]; row?: { id?: string; disabled?: unknown; insertDisabled?: unknown; tests?: string[] } };
}

/** Peer SEAM của riêng gói này (ngoài hai tên `mount.ts` tự thêm cho mọi gói: cordis, schemastery). */
const SEAM_PEERS = [
  "@deepseek-ai/dsh-pwsh-local",
  "@deepseek-ai/dsh-sandbox",
  "@deepseek-ai/dsh-sandbox-policy",
  "@deepseek-ai/dsh-shell",
];

/** Đọc manifest của gói từ đĩa. */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/** Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật. */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

describe("quy ước khai peer: gbh.peers ⊆ peerDependencies (so PHẦN TỬ, có ĐỐI CHỨNG ÂM)", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies, đúng dải của kernel đang chạy", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    const declared = Object.keys(manifest.peerDependencies ?? {});
    // Chống verdict RỖNG: nếu ai xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
    for (const peer of [...peers, "@deepseek-ai/cordis"]) expect(declared).toContain(peer);
    // Dải: (1) PHẢI BẰNG ĐÚNG dải manifest stock của gói, (2) PHẢI phủ bản kernel đang chạy — phép kiểm
    // MẠNH trong harness (stock khai dải alpha, kernel chạy bản không-alpha; vẫn chặn drift rc.5).
    expect(peerRangeProblems(PKG)).toEqual([]);
  });

  test("ĐỐI CHỨNG ÂM: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      // Đỏ ở ĐÚNG tên vừa xoá ⇒ ca dương ở trên KHÔNG rỗng: ai xoá một peer thì test sẽ ĐỎ.
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    // Xoá SẠCH peerDependencies ⇒ phải báo ĐỦ cả danh sách (không phải một con số).
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });

  test("đối chứng âm thứ hai: THỪA tên trong peerDependencies vẫn ĐẠT; peer KHÔNG nằm trong dependencies", () => {
    const manifest = readManifest();
    const mutated = cloneManifest(manifest);
    mutated.peerDependencies = { ...(mutated.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(mutated)).toEqual([]);
    const deps = new Set(Object.keys(manifest.dependencies ?? {}));
    expect((manifest.gbh?.peers ?? []).filter((peer) => deps.has(peer))).toEqual([]);
    // 18/10/2026 (task-15) — SỬA LỖI MOUNT: bản cũ khai điều kiện NỀN TẢNG cho row STOCK rồi chèn bản ta
    //   KHÔNG disabled ⇒ trên macOS (và cả Windows nếu bash bật) hai ShellExecutor cùng đăng ký `ctx.shell`
    //   (log host 21:56: 'pwsh-sandbox-ours: Error: service "shell" has been registered at
    //   <SandboxBashExecutor>'). Hợp đồng ĐÚNG = mirror oracle theo TẦNG: stock TẮT VÔ ĐIỀU KIỆN, row CHÈN
    //   giữ đúng biểu thức nền tảng của stock.
    expect(manifest.gbh?.row).toEqual({
      id: "pwsh-sandbox",
      disabled: true,
      insertDisabled: { js: "process.platform !== 'win32'" },
      tests: ["tests/host/pwsh-sandbox.test.ts"],
    });
  });

  test("renderRewriteBlock: stock `disabled: true` + row CHÈN mang `!!js` nền tảng đúng SAU dòng name", () => {
    const manifest = readManifest();
    const row = manifest.gbh?.row as { id: string; disabled: boolean; insertDisabled: { js: string }; tests: string[] };
    const block = renderRewriteBlock("@galaxy-blackhole/gbh-pwsh-sandbox", row);
    const lines = block.split("\n");
    expect(lines[0]).toBe("- id: pwsh-sandbox");
    expect(lines[1]).toBe("  disabled: true");
    const insertIndex = lines.findIndex((line) => line.trim() === "- id: pwsh-sandbox-ours");
    expect(insertIndex).toBeGreaterThanOrEqual(0);
    expect(lines[insertIndex + 1]?.trim()).toBe("name: '@galaxy-blackhole/gbh-pwsh-sandbox'");
    expect(lines[insertIndex + 2]?.trim()).toBe("disabled: !!js process.platform !== 'win32'");
    // Đúng HAI dòng disabled (stock tắt vô điều kiện + row chèn có điều kiện); chỉ MỘT `!!js`.
    expect(lines.filter((line) => line.includes("disabled:")).length).toBe(2);
    expect(lines.filter((line) => line.includes("!!js")).length).toBe(1);
  });
});
