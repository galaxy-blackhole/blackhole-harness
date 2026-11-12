/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test hành vi cho @galaxy-blackhole/gbh-bash-sandbox: đo trên ARTIFACT (lib/index.js) và
 *      đối chứng TỪNG CA với chính bundle gốc — bọc argv, sự thật sandbox, phân loại từ chối,
 *      runner hỏng, sổ sự thật theo từng tiến trình, và luật FAIL-CLOSED của tầng cưỡng chế
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Gốc repo (tests/host → ../..). */
const ROOT = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(ROOT, "packages", "host", "bash-sandbox");
/** ARTIFACT của ta — thứ được đo, không phải src/. */
const OURS_PATH = join(PKG, "lib", "index.js");
/** ARTIFACT gốc trong kernel (CHỈ ĐỌC) — bên đối chứng. */
const STOCK_PATH = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-bash-sandbox", "lib", "index.js");

// lib/ nằm trong .gitignore nên bản sao mới không có sẵn: build ngay để phép đo luôn chạy trên artifact.
if (!existsSync(OURS_PATH)) {
  const build = (await import(join(PKG, "build.ts"))) as { buildPackage: (outDir?: string) => Promise<string> };
  await build.buildPackage();
}

// Bề mặt ĐO phải phân giải peer về ĐÚNG instance kernel: dựng thêm một bản trong thư mục tạm rồi symlink
// @deepseek-ai của kernel vào (pattern tests/host/shell.test.ts). Nạp thẳng lib/ trong workspace thì peer
// trỏ về bản .bun của workspace ⇒ lớp cha khác realpath ⇒ phép so "chung lớp cha" đỏ oan.
const SURFACE_DIR = mkdtempSync(join(tmpdir(), "gbh-bash-sandbox-"));
const { buildPackage: buildSurface } = (await import(join(PKG, "build.ts"))) as {
  buildPackage: (outDir?: string) => Promise<string>;
};
// Thứ tự quan trọng: build.ts xoá sạch outDir, nên symlink kernel phải dựng SAU khi build xong.
const SURFACE_ARTIFACT = await buildSurface(SURFACE_DIR);
mkdirSync(join(SURFACE_DIR, "node_modules"), { recursive: true });
symlinkSync(
  join(ROOT, "apps", "host", "node_modules", "@deepseek-ai"),
  join(SURFACE_DIR, "node_modules", "@deepseek-ai"),
  "dir",
);
/** Hai bên: artifact của ta (peer = kernel) và artifact gốc. */
const ours = (await import(SURFACE_ARTIFACT)) as { SandboxBashExecutor: any; default: any };

/** Dọn thư mục dựng tạm của bề mặt. Nhận: không. Trả: không. */
afterAll(() => {
  rmSync(SURFACE_DIR, { recursive: true, force: true });
});
/** Bản gốc đã build trong kernel. */
const stock = (await import(STOCK_PATH)) as { SandboxBashExecutor: any; default: any };

/** Đọc một luồng đã gom: trả phần text còn lại kể từ offset byte. */
function readerOf(text: string): { readFrom: (from?: number) => { text: string; lossy: boolean; nextOffset: number } } {
  return { readFrom: (from = 0) => ({ text: text.slice(from), lossy: false, nextOffset: text.length }) };
}

/** Cấu hình cục bộ tối thiểu, đúng hình dạng Volatile mà `dsh-bash-local` đọc bằng `.get()`. */
function localConfig(): any {
  const volatile = (value: number | undefined): { get: () => number | undefined } => ({ get: () => value });
  return {
    cwd: volatile(undefined),
    timeoutMs: volatile(60000),
    maxTimeoutMs: volatile(600000),
    maxOutputBytes: volatile(64000),
    maxSpillBytes: volatile(67108864),
    graceMs: volatile(3000),
  };
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
  runnerFailureRules: unknown[];
}

/** Tuỳ chọn dựng "gia" ba seam giả. */
interface HarnessOptions {
  /** Chế độ mặc định của chính sách triển khai. */
  mode?: string;
  /** Chính sách mà `sandboxPolicy.resolve()` trả về. */
  policy?: Record<string, unknown>;
  /** Thay thế hành vi `sandbox.confine` (mặc định: bọc thành runner giả). */
  confine?: (argv: string[], policy: any, signal?: AbortSignal) => Promise<ConfinedFacts>;
  /** Kết cục tiến trình mà `subprocess.spawn` báo về. */
  outcome?: { exitCode: number | null; signal?: string | null; stdout?: string; stderr?: string };
  /** Nếu có: `done` của tiến trình reject bằng giá trị này (nhà cung cấp từ chối). */
  spawnError?: unknown;
}

/** Dựng context giả đủ cho `Service` đăng ký + ba seam mà row này tiêu thụ. */
function harness(options: HarnessOptions = {}): {
  ctx: never;
  confinements: Array<{ argv: string[]; policy: any }>;
  spawned: any[];
  signals: Array<AbortSignal | undefined>;
} {
  const confinements: Array<{ argv: string[]; policy: any }> = [];
  const spawned: any[] = [];
  const signals: Array<AbortSignal | undefined> = [];
  const ctx = {
    reflect: { provide: (): void => {} },
    sandboxPolicy: {
      defaultMode: options.mode ?? "workspace-write",
      resolve: (): Record<string, unknown> => options.policy ?? { mode: "workspace-write", workspaceRoot: "/workspace" },
    },
    sandbox: {
      confine: async (argv: string[], policy: any, signal?: AbortSignal): Promise<ConfinedFacts> => {
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
      spawn: (spec: any): unknown => {
        spawned.push(spec);
        const outcome = options.outcome ?? { exitCode: 0, signal: null };
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
  return { ctx: ctx as never, confinements, spawned, signals };
}

/** Dựng executor của một trong hai bên trên CÙNG một context giả (A/B cô lập đúng một biến). */
function executor(side: "ours" | "stock", ctx: never, config: any = localConfig()): any {
  const Ctor = side === "ours" ? ours.SandboxBashExecutor : stock.SandboxBashExecutor;
  return new Ctor(ctx, config);
}

/** Spec đã giải, mặc định chạy dưới `workspace-write` trong thư mục tạm có thật. */
function specOf(command: string, patch: Record<string, unknown> = {}): any {
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

/** Liệt kê tên export của một artifact ESM (đo trên VĂN BẢN artifact gốc). */
function exportNamesOf(code: string): string[] {
  const names = new Set<string>();
  for (const match of code.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") names.add(name);
    }
  }
  if (/export\s+default/u.test(code)) names.add("default");
  return [...names].sort();
}

describe("bề mặt artifact: tập export của ta = tập export bản gốc", () => {
  test("export của lib/index.js khớp bản gốc và đúng hai tên", () => {
    const stockNames = exportNamesOf(readFileSync(STOCK_PATH, "utf8"));
    expect(Object.keys(ours).sort()).toEqual(stockNames);
    expect(Object.keys(ours).sort()).toEqual(["SandboxBashExecutor", "default"]);
    expect(ours.default).toBe(ours.SandboxBashExecutor);
    expect(stock.default).toBe(stock.SandboxBashExecutor);
  });

  test("inject tĩnh, bề mặt prototype/static và LỚP CHA khớp bản gốc", () => {
    expect(ours.SandboxBashExecutor.inject).toEqual(stock.SandboxBashExecutor.inject);
    expect(ours.SandboxBashExecutor.inject).toEqual(["subprocess", "sandbox", "sandboxPolicy"]);
    expect(Object.getOwnPropertyNames(ours.SandboxBashExecutor.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.SandboxBashExecutor.prototype).sort(),
    );
    expect(Object.getOwnPropertyNames(ours.SandboxBashExecutor).sort()).toEqual(
      Object.getOwnPropertyNames(stock.SandboxBashExecutor).sort(),
    );
    // CÙNG một lớp cha ⇒ peer trỏ về ĐÚNG instance của kernel (một `ctx.shell` duy nhất trong tiến trình).
    expect(Object.getPrototypeOf(ours.SandboxBashExecutor)).toBe(Object.getPrototypeOf(stock.SandboxBashExecutor));
  });
});

describe("hành vi chính: đối chứng từng ca với bản gốc", () => {
  test("sandboxMode đọc từ chính sách triển khai, và resolve() ra spec Y HỆT", () => {
    const a = harness({ mode: "read-only" });
    const b = harness({ mode: "read-only" });
    const mine = executor("ours", a.ctx);
    const theirs = executor("stock", b.ctx);
    expect(mine.sandboxMode).toBe("read-only");
    expect(mine.sandboxMode).toBe(theirs.sandboxMode);

    const requests: any[] = [
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
  });

  test("danger-full-access: chạy THẲNG argv cục bộ, KHÔNG gọi nhà cung cấp, sandbox {denied:false}", async () => {
    const fullAccess = { sandboxPolicy: { mode: "danger-full-access", workspaceRoot: "/workspace" } };
    const h = harness();
    const mine = executor("ours", h.ctx);
    const result = await (await mine.execute(specOf("echo hi", fullAccess))).result();
    expect(h.confinements.length).toBe(0);
    expect(h.spawned[0]?.argv).toEqual(["bash", "-c", "echo hi"]);
    expect(result.sandbox).toEqual({ mode: "danger-full-access", denied: false });

    const h2 = harness();
    const theirs = await (await executor("stock", h2.ctx).execute(specOf("echo hi", fullAccess))).result();
    expect(h2.confinements.length).toBe(0);
    expect(theirs).toEqual(result);
  });

  test("chế độ bị cưỡng chế: argv bọc đi qua confine, argv spawn = argv nhà cung cấp, facts đủ ba trường", async () => {
    const h = harness({ outcome: { exitCode: 0, signal: null, stdout: "hi\n" } });
    const mine = executor("ours", h.ctx);
    const handle = await mine.execute(specOf("echo hi"));
    const result = await handle.result();
    // Lệnh tới nhà cung cấp ĐÚNG dạng argv shell-shaped mà seam yêu cầu:
    expect(h.confinements[0]?.argv).toEqual(["bash", "-c", "echo hi"]);
    expect(h.confinements[0]?.policy).toEqual({ mode: "workspace-write", workspaceRoot: "/workspace" });
    // ...và thứ được spawn là argv CỦA NHÀ CUNG CẤP, không phải argv gốc:
    expect(h.spawned[0]?.argv).toEqual(["/opt/sandbox-runner", "bash", "-c", "echo hi"]);
    expect(h.spawned[0]?.cwd).toBe(tmpdir());
    expect(result.stdout.text).toBe("hi\n");
    expect(result.sandbox).toEqual({ mode: "workspace-write", denied: false, enforcement: "full" });

    // A/B: cùng dữ kiện ⇒ cùng kết quả quan sát được, kể cả spec spawn (môi trường model-friendly).
    const h2 = harness({ outcome: { exitCode: 0, signal: null, stdout: "hi\n" } });
    const theirs = executor("stock", h2.ctx);
    const stockResult = await (await theirs.execute(specOf("echo hi"))).result();
    expect(stockResult).toEqual(result);
    expect(h2.spawned[0]).toEqual(h.spawned[0]);
  });

  test("bị TỪ CHỐI: exit != 0 + stderr khớp phương ngữ ⇒ denied true (phân biệt hoa/thường)", async () => {
    const h = harness({ outcome: { exitCode: 1, signal: null, stderr: "bash: /w/x: Read-Only File System\n" } });
    const mine = executor("ours", h.ctx);
    const result = await (await mine.execute(specOf("touch /w/x"))).result();
    expect(result.exitCode).toBe(1);
    expect(result.sandbox).toEqual({ mode: "workspace-write", denied: true, enforcement: "full" });
    const h2 = harness({ outcome: { exitCode: 1, signal: null, stderr: "bash: /w/x: Read-Only File System\n" } });
    expect(await (await executor("stock", h2.ctx).execute(specOf("touch /w/x"))).result()).toEqual(result);

    // Exit 0 với CÙNG stderr KHÔNG phải bị từ chối (matchesSignature chặn exit 0) — hai bên y hệt.
    const h3 = harness({ outcome: { exitCode: 0, signal: null, stderr: "bash: /w/x: Read-Only File System\n" } });
    const ok = await (await executor("ours", h3.ctx).execute(specOf("true"))).result();
    expect(ok.sandbox).toEqual({ mode: "workspace-write", denied: false, enforcement: "full" });
  });
});

describe("đường lỗi", () => {
  test("bằng chứng runner hỏng ⇒ ném SANDBOX_UNAVAILABLE, foreground", async () => {
    const rules = [{ fatalSignatures: ["cannot start"] }];
    const confine = async (argv: string[]): Promise<ConfinedFacts> => ({
      argv: ["/opt/sandbox-runner", ...argv],
      enforcement: "partial",
      denialSignatures: ["operation not permitted"],
      runnerFailureRules: rules,
    });
    const h = harness({ confine, outcome: { exitCode: 1, signal: null, stderr: "sandbox-runner: cannot start\n" } });
    const mine = executor("ours", h.ctx);
    const error = await (await mine.execute(specOf("echo hi"))).result().then(
      () => undefined,
      (thrown: any) => thrown,
    );
    expect(error?.name).toBe("SandboxUnavailableError");
    expect(error?.code).toBe("SANDBOX_UNAVAILABLE");
    expect(String(error?.message)).toContain("workspace-write");
    expect(String(error?.message)).toContain("cannot start");

    // A/B: bản gốc ném CÙNG mã + CÙNG thông điệp.
    const h2 = harness({ confine, outcome: { exitCode: 1, signal: null, stderr: "sandbox-runner: cannot start\n" } });
    const theirs = await (await executor("stock", h2.ctx).execute(specOf("echo hi"))).result().then(
      () => undefined,
      (thrown: any) => thrown,
    );
    expect(theirs?.code).toBe(error?.code);
    expect(theirs?.message).toBe(error?.message);
  });

  test("FAIL-CLOSED: nhà cung cấp từ chối ⇒ lỗi đi thẳng ra, và KHÔNG có tiến trình nào được spawn", async () => {
    const refused = new Error("no sandbox backend is usable on this host");
    const h = harness({ confine: async () => { throw refused; } });
    const mine = executor("ours", h.ctx);
    await expect(mine.execute(specOf("echo hi"))).rejects.toThrow("no sandbox backend is usable on this host");
    // Đây là tính CHẤT AN NINH của row: không bao giờ có đường chạy lệnh KHÔNG bị cưỡng chế.
    expect(h.spawned.length).toBe(0);
    const h2 = harness({ confine: async () => { throw refused; } });
    await expect(executor("stock", h2.ctx).execute(specOf("echo hi"))).rejects.toThrow("no sandbox backend is usable on this host");
    expect(h2.spawned.length).toBe(0);
  });

  test("spawn hỏng vì CHÍNH runner (ENOENT + đúng argv[0]) ⇒ SANDBOX_UNAVAILABLE, không phải lỗi lệnh", async () => {
    const runner = "/opt/khong-co-sandbox-runner";
    const spawnError = Object.assign(new Error("spawn " + runner + " ENOENT"), {
      code: "ENOENT",
      path: runner,
      syscall: "spawn " + runner,
    });
    const confine = async (argv: string[]): Promise<ConfinedFacts> => ({
      argv: [runner, ...argv],
      enforcement: "full",
      denialSignatures: [],
      runnerFailureRules: [],
    });
    for (const side of ["ours", "stock"] as const) {
      const h = harness({ confine, spawnError });
      const error = await (await executor(side, h.ctx).execute(specOf("echo hi"))).result().then(
        () => undefined,
        (thrown: any) => thrown,
      );
      expect(error?.code).toBe("SANDBOX_UNAVAILABLE");
      expect(String(error?.message)).toContain("Runner failure");
    }
  });

  test("huỷ trong lúc chờ: tín hiệu đã abort ⇒ ném lại lý do huỷ, KHÔNG bọc thành lỗi runner", async () => {
    const abort = new Error("nguoi dung huy");
    const h = harness({ confine: async () => { throw abort; } });
    const controller = new AbortController();
    controller.abort(abort);
    const mine = executor("ours", h.ctx);
    const error = await mine.execute(specOf("echo hi", { signal: controller.signal })).then(
      () => undefined,
      (thrown: any) => thrown,
    );
    expect(error).toBe(abort);
    expect(h.spawned.length).toBe(0);
  });
});

describe("sổ sự thật theo TỪNG tiến trình (lý do tồn tại của Map)", () => {
  test("hai lời gọi chồng lấn với hai phương ngữ khác nhau ⇒ mỗi bên phân loại bằng sự thật CỦA MÌNH", async () => {
    let call = 0;
    const factsOf = (argv: string[]): ConfinedFacts => {
      call += 1;
      const n = call;
      return n === 1
        ? { argv: ["/opt/runner-a", ...argv], enforcement: "full", denialSignatures: ["dialect-a"], runnerFailureRules: [] }
        : { argv: ["/opt/runner-b", ...argv], enforcement: "partial", denialSignatures: ["dialect-b"], runnerFailureRules: [] };
    };
    const outcomes = [
      { exitCode: 1, signal: null, stderr: "runner-a: DIALECT-A denied the write\n" },
      { exitCode: 1, signal: null, stderr: "runner-b: nothing to see here\n" },
    ];
    let spawned = 0;
    const h = harness({
      confine: async (argv) => factsOf(argv),
      outcome: { exitCode: 0, signal: null },
    });
    // Hai tiến trình chồng lấn: mỗi lần spawn lấy kết cục riêng theo thứ tự.
    const originalSpawn = (h.ctx as any).subprocess.spawn;
    (h.ctx as any).subprocess.spawn = (spec: any): unknown => {
      const outcome = outcomes[spawned] ?? { exitCode: 0, signal: null, stderr: "" };
      spawned += 1;
      (h.ctx as any).__last = spec;
      return {
        done: Promise.resolve({ exitCode: outcome.exitCode, signal: null }),
        collected: { stdout: readerOf(""), stderr: readerOf(outcome.stderr ?? "") },
        terminate: () => true,
      };
    };
    expect(typeof originalSpawn).toBe("function");
    const mine = executor("ours", h.ctx);
    const first = await mine.execute(specOf("touch a"));
    const second = await mine.execute(specOf("touch b"));
    const [r1, r2] = await Promise.all([first.result(), second.result()]);
    expect(r1.sandbox).toEqual({ mode: "workspace-write", denied: true, enforcement: "full" });
    expect(r2.sandbox).toEqual({ mode: "workspace-write", denied: false, enforcement: "partial" });
  });
});
