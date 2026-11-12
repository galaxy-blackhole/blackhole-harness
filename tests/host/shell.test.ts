/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-shell: build artifact vào thư mục tạm (symlink node_modules),
 *      so CẢ stock lẫn bản của ta trên cùng fixture — 4 export runtime, kế thừa Service thật, đăng ký
 *      ctx.shell + lỗi trùng, seam giả resolve/execute (KHÔNG spawn, KHÔNG mạng), DSH_ENV_PREFIX, toàn
 *      bộ parseExitStatus, và metadata GBH-only không có row stock để mirror.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/shell/build.ts";
import type {
  ParsedExitStatus,
  ShellExecRequest,
  ShellExecSpec,
  ShellExecution,
  ShellExecutor as ShellExecutorType,
  ShellProcessRead,
  ShellRunResult,
} from "../../packages/host/shell/src/index.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "shell");
/** Phép kiểm CHUẨN cho dải peer của row (parity với manifest stock + phủ bản kernel đang chạy). */
import { peerRangeProblems } from "./peer-range-harness.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
/** Manifest của gói — nguồn của metadata GBH-only. */
const MANIFEST = join(PKG, "package.json");
/** README của gói — header 5 dòng + mục 0..5. */
const README = join(PKG, "README.md");
/** Bundle GỐC trong kernel (CHỈ ĐỌC) — oracle cho mọi ca hành vi. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-shell", "lib", "index.js");
/** Manifest gốc — nguồn duy nhất của peer/dev. */
const STOCK_MANIFEST = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-shell", "package.json");
/** Cordis THẬT của kernel — cần Context thật thì Service mới đăng ký được dịch vụ. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục @deepseek-ai dùng chung để artifact trong thư mục tạm phân giải được peer. */
const SHARED_AI = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Dump metadata 19/10/2026 — nguồn đo "không có row shell". */
const DUMP = "/tmp/dump-now2.txt";

/** Hình dạng module shell (stock lẫn bản của ta) mà test cần. */
interface ShellModule {
  /** Tiền tố biến môi trường do harness quản lý. */
  DSH_ENV_PREFIX: string;
  /** Lớp seam trừu tượng. */
  ShellExecutor: typeof ShellExecutorType;
  /** Export mặc định — phải là chính lớp trên. */
  default: typeof ShellExecutorType;
  /** Hàm tách marker trạng thái thoát. */
  parseExitStatus: (text: string) => ParsedExitStatus;
}

/** Hình dạng cordis mà phép kiểm cần. */
interface CordisModule {
  /** Context thật (fiber gốc). */
  Context: new () => unknown;
  /** Lớp Service mà seam phải kế thừa. */
  Service: unknown;
}

/** Context tối thiểu để đọc dịch vụ đã đăng ký. */
interface ShellContext {
  /** Chỗ ngồi của seam khi đã đăng ký. */
  shell?: { name?: string };
}

/** Manifest tối thiểu để kiểm metadata. */
interface PackageManifest {
  name?: string;
  version?: string;
  private?: boolean;
  type?: string;
  main?: string;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  gbh?: {
    peers?: string[];
    tests?: string[];
    draft?: string;
    row?: unknown;
    row_unmounted_ly_do?: unknown;
  };
}

const stock = (await import(STOCK)) as ShellModule;
const cordis = (await import(CORDIS)) as CordisModule;

/** Thư mục tạm chứa artifact của ta (dọn ở afterAll). */
let outDir = "";
/** Đường dẫn artifact lib/index.js đã build trong thư mục tạm. */
let ourArtifact = "";
/** Khoá của object buildPackage trả về. */
let builtKeys: string[] = [];
/** Module artifact của ta, nạp sau khi symlink node_modules. */
let ours: ShellModule;

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "gbh-shell-"));
  const built = await buildPackage(outDir);
  builtKeys = Object.keys(built);
  ourArtifact = built.index;
  mkdirSync(join(outDir, "node_modules"), { recursive: true });
  symlinkSync(SHARED_AI, join(outDir, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(SHARED_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(outDir, "node_modules", "@galaxy-blackhole"), "dir");
  // 03/11/2026 (P2): goi cua ta nhap @galaxy-blackhole/gbh-* nen shell tam cung phai thay scope do,
  // neu khong test se nap HAI the hien kernel (stock trong @deepseek-ai + workspace trong @galaxy-blackhole).
  ours = (await import(ourArtifact)) as ShellModule;
});

afterAll(() => {
  if (outDir !== "") rmSync(outDir, { recursive: true, force: true });
});

/**
 * Liệt kê tên export của một file ESM đã build — cùng hai regex mà check:rows dùng.
 * Nhận: nội dung file đã build.
 * Trả: tên export đã sắp xếp, gồm cả default.
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  return [...names].sort();
}

/**
 * Dựng một handle giả hoàn chỉnh — KHÔNG spawn tiến trình, KHÔNG chạm mạng.
 * Nhận: spec đã phân giải (chỉ dùng timeoutMs để chứng minh spec đi qua nguyên vẹn).
 * Trả: ShellExecution giả với hai luồng đọc được và result() đã settle.
 */
function fakeExecution(spec: ShellExecSpec): ShellExecution {
  const readFrom = (fromByte: number) => ({
    text: fromByte === 0 ? "da-chay" : "",
    nextOffset: 8,
    lossy: false,
  });
  return {
    status: "completed",
    exitCode: 0,
    signal: null,
    done: Promise.resolve(),
    readOutput: (): ShellProcessRead => ({ delta: "da-chay", lossy: false }),
    observed: { stdout: { readFrom }, stderr: { readFrom } },
    kill: () => false,
    result: async (): Promise<ShellRunResult> => ({
      exitCode: 0,
      signal: null,
      timedOut: false,
      aborted: false,
      timeoutMs: spec.timeoutMs,
      stdout: { text: "da-chay", truncated: false },
      stderr: { text: "", truncated: false },
    }),
  };
}

/**
 * Cài đặt seam GIẢ cho một lớp base bất kỳ (bản của ta hoặc stock): resolve điền mặc định, execute
 * trả handle giả, cả hai ghi vết để so A/B.
 * Nhận: Base — lớp ShellExecutor cần mở rộng; mode — giá trị getter sandboxMode tuỳ chọn.
 * Trả: lớp con cụ thể, dựng được bằng new Impl(ctx).
 */
function fakeImplementation(Base: typeof ShellExecutorType, mode?: "workspace-write") {
  return class FakeShell extends Base {
    /** Yêu cầu thô đã nhận — vết để so A/B. */
    readonly calls: ShellExecRequest[] = [];
    /** Spec đã phân giải đã nhận — vết để so A/B. */
    readonly specs: ShellExecSpec[] = [];
    /** Getter mẫu để chứng minh lớp con override được như stock. */
    override get sandboxMode(): "workspace-write" | undefined {
      return mode;
    }
    /** Ghi yêu cầu, áp mặc định cố định — không spawn. */
    override resolve(request: ShellExecRequest): ShellExecSpec {
      this.calls.push(request);
      return {
        command: request.command,
        workdir: request.workdir ?? "/fixture",
        timeoutMs: request.timeoutMs ?? 4321,
        onExpiry: request.onExpiry ?? "kill",
        stdoutMaxBytes: request.stdoutMaxBytes ?? 4096,
        signal: request.signal,
        stdin: request.stdin,
        env: request.env,
        dshEnv: request.dshEnv,
        sandboxPolicy: request.sandboxPolicy,
      };
    }
    /** Ghi spec rồi trả handle giả — không spawn. */
    override async execute(spec: ShellExecSpec): Promise<ShellExecution> {
      this.specs.push(spec);
      return fakeExecution(spec);
    }
  };
}

describe("artifact + lớp ShellExecutor", () => {
  test("buildPackage trả { index }; artifact có ĐÚNG 4 export runtime như stock", () => {
    expect(builtKeys).toEqual(["index"]);
    expect(ourArtifact).toBe(join(outDir, "index.js"));
    expect(existsSync(ourArtifact)).toBe(true);
    const ourNames = exportNames(readFileSync(ourArtifact, "utf8"));
    const stockNames = exportNames(readFileSync(STOCK, "utf8"));
    expect(ourNames).toEqual(stockNames);
    expect(ourNames).toEqual(["DSH_ENV_PREFIX", "ShellExecutor", "default", "parseExitStatus"]);
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(ours.default).toBe(ours.ShellExecutor);
    expect(stock.default).toBe(stock.ShellExecutor);
    expect(ours.ShellExecutor).not.toBe(stock.ShellExecutor);
  });

  test("artifact KHÔNG spawn / KHÔNG mạng: không child_process, Bun.spawn hay fetch", () => {
    for (const text of [readFileSync(ourArtifact, "utf8"), readFileSync(STOCK, "utf8")]) {
      expect(text.includes("node:child_process")).toBe(false);
      expect(text.includes("Bun.spawn")).toBe(false);
      expect(/\bfetch\s*\(/u.test(text)).toBe(false);
    }
  });

  test("kế thừa ĐÚNG Service của kernel; tên/arity/prototype/descriptor sandboxMode khớp stock", () => {
    expect(Object.getPrototypeOf(ours.ShellExecutor)).toBe(cordis.Service);
    expect(Object.getPrototypeOf(stock.ShellExecutor)).toBe(cordis.Service);
    expect(Object.getPrototypeOf(ours.ShellExecutor)).toBe(Object.getPrototypeOf(stock.ShellExecutor));
    expect(Object.getPrototypeOf(ours.ShellExecutor.prototype)).toBe(
      Object.getPrototypeOf(stock.ShellExecutor.prototype),
    );
    expect(ours.ShellExecutor.name).toBe(stock.ShellExecutor.name);
    expect(ours.ShellExecutor.name).toBe("ShellExecutor");
    expect(ours.ShellExecutor.length).toBe(stock.ShellExecutor.length);
    expect(ours.ShellExecutor.length).toBe(1);
    expect(Object.getOwnPropertyNames(ours.ShellExecutor.prototype)).toEqual(
      Object.getOwnPropertyNames(stock.ShellExecutor.prototype),
    );
    expect(Object.getOwnPropertyNames(ours.ShellExecutor.prototype)).toEqual(["constructor", "sandboxMode"]);
    for (const Base of [ours.ShellExecutor, stock.ShellExecutor]) {
      const descriptor = Object.getOwnPropertyDescriptor(Base.prototype, "sandboxMode");
      expect(typeof descriptor?.get).toBe("function");
      expect(descriptor?.set).toBeUndefined();
      expect(descriptor?.enumerable).toBe(false);
      expect(descriptor?.configurable).toBe(true);
    }
  });

  test("sandboxMode trả undefined ở cả hai; lớp con override được y stock", () => {
    const Plain = fakeImplementation(ours.ShellExecutor);
    const StockPlain = fakeImplementation(stock.ShellExecutor);
    const plain = new Plain(new cordis.Context() as never);
    const stockPlain = new StockPlain(new cordis.Context() as never);
    expect(plain.sandboxMode).toBe(stockPlain.sandboxMode);
    expect(plain.sandboxMode).toBeUndefined();

    const WithMode = fakeImplementation(ours.ShellExecutor, "workspace-write");
    const StockWithMode = fakeImplementation(stock.ShellExecutor, "workspace-write");
    const withMode = new WithMode(new cordis.Context() as never);
    const stockWithMode = new StockWithMode(new cordis.Context() as never);
    expect(withMode.sandboxMode).toBe("workspace-write");
    expect(stockWithMode.sandboxMode).toBe("workspace-write");
  });

  test("resolve/execute là TRỪU TƯỢNG: vắng trên prototype runtime, y stock", () => {
    for (const Base of [ours.ShellExecutor, stock.ShellExecutor]) {
      expect("resolve" in Base.prototype).toBe(false);
      expect("execute" in Base.prototype).toBe(false);
      expect(Object.hasOwn(Base.prototype, "resolve")).toBe(false);
      expect(Object.hasOwn(Base.prototype, "execute")).toBe(false);
    }
  });
});

describe("seam ctx.shell trên Context cordis THẬT", () => {
  test("đăng ký tên shell; implementation thứ hai NÉM CÙNG thông điệp như stock", () => {
    const attempt = (Base: typeof ShellExecutorType) => {
      const ctx = new cordis.Context() as unknown as ShellContext;
      const Impl = fakeImplementation(Base);
      const first = new Impl(ctx as never);
      let message = "KHONG NEM";
      try {
        new Impl(ctx as never);
      } catch (error) {
        message = (error as Error).message;
      }
      return { name: first.name, registered: ctx.shell?.name, message };
    };
    const ourTrace = attempt(ours.ShellExecutor);
    const stockTrace = attempt(stock.ShellExecutor);
    expect(ourTrace).toEqual(stockTrace);
    expect(ourTrace.name).toBe("shell");
    expect(ourTrace.registered).toBe("shell");
    expect(ourTrace.message).toContain('service "shell" has been registered');
  });

  test("seam GIẢ: request → resolve → execute → handle/result đi qua NGUYÊN VẸN, không spawn", async () => {
    const run = async (Base: typeof ShellExecutorType) => {
      const ctx = new cordis.Context() as unknown as ShellContext;
      const Impl = fakeImplementation(Base);
      const instance = new Impl(ctx as never);
      const request: ShellExecRequest = { command: "echo xin-chao", workdir: "/fixture", timeoutMs: 1234 };
      const spec = instance.resolve(request);
      const execution = await instance.execute(spec);
      const result = await execution.result();
      return {
        calls: instance.calls,
        specs: instance.specs,
        requestAfter: request,
        status: execution.status,
        exitCode: execution.exitCode,
        signal: execution.signal,
        kill: execution.kill(),
        read: execution.readOutput(),
        observedStdout: execution.observed.stdout.readFrom(0),
        observedStderr: execution.observed.stderr.readFrom(0),
        result,
      };
    };
    const ourTrace = await run(ours.ShellExecutor);
    const stockTrace = await run(stock.ShellExecutor);
    expect(ourTrace).toEqual(stockTrace);
    expect(ourTrace.calls).toEqual([{ command: "echo xin-chao", workdir: "/fixture", timeoutMs: 1234 }]);
    expect(ourTrace.specs).toEqual([
      {
        command: "echo xin-chao",
        workdir: "/fixture",
        timeoutMs: 1234,
        onExpiry: "kill",
        stdoutMaxBytes: 4096,
        signal: undefined,
        stdin: undefined,
        env: undefined,
        dshEnv: undefined,
        sandboxPolicy: undefined,
      },
    ]);
    expect(ourTrace.requestAfter).toEqual({ command: "echo xin-chao", workdir: "/fixture", timeoutMs: 1234 });
    expect(ourTrace.status).toBe("completed");
    expect(ourTrace.exitCode).toBe(0);
    expect(ourTrace.signal).toBeNull();
    expect(ourTrace.kill).toBe(false);
    expect(ourTrace.read).toEqual({ delta: "da-chay", lossy: false });
    expect(ourTrace.observedStdout).toEqual({ text: "da-chay", nextOffset: 8, lossy: false });
    expect(ourTrace.result.timeoutMs).toBe(1234);
    expect(ourTrace.specs).toHaveLength(1);
  });

  test("DSH_ENV_PREFIX tái xuất NGUYÊN VĂN từ dsh-subprocess: khớp stock và bằng DSH_", () => {
    expect(ours.DSH_ENV_PREFIX).toBe(stock.DSH_ENV_PREFIX);
    expect(ours.DSH_ENV_PREFIX).toBe("DSH_");
  });
});

describe("parseExitStatus — A/B từng nhánh marker", () => {
  test("vắng marker ⇒ body nguyên vẹn + exitCode 0 (rỗng, unicode, marker giữa dòng)", () => {
    const inputs = [
      "",
      "hello",
      "tiếng Việt\nhai dòng",
      "a [exit code: 1] b",
      "x\n[killed by signal: SIGTERM] nhung khong o cuoi",
    ];
    for (const text of inputs) {
      const our = ours.parseExitStatus(text);
      expect(JSON.stringify(our)).toBe(JSON.stringify(stock.parseExitStatus(text)));
      expect(our).toEqual({ body: text, exitCode: 0 });
      expect("signal" in our).toBe(false);
    }
  });

  test("marker [exit code: N] ⇒ bỏ marker, trả exitCode (0, 7, 130)", () => {
    const cases = [
      { text: "x\n[exit code: 0]", body: "x", exitCode: 0 },
      { text: "x\n[exit code: 7]", body: "x", exitCode: 7 },
      { text: "x\n[exit code: 130]", body: "x", exitCode: 130 },
      { text: "tiếng Việt\n[exit code: 2]", body: "tiếng Việt", exitCode: 2 },
    ];
    for (const item of cases) {
      const our = ours.parseExitStatus(item.text);
      expect(our).toEqual(stock.parseExitStatus(item.text));
      expect(our).toEqual({ body: item.body, exitCode: item.exitCode });
      expect("signal" in our).toBe(false);
    }
  });

  test("marker [killed by signal: X] ⇒ signal + bỏ marker", () => {
    const cases = [
      { text: "x\n[killed by signal: SIGTERM]", body: "x", signal: "SIGTERM" },
      { text: "x\n[killed by signal: SIG RT]", body: "x", signal: "SIG RT" },
    ];
    for (const item of cases) {
      const our = ours.parseExitStatus(item.text);
      expect(our).toEqual(stock.parseExitStatus(item.text));
      expect(our).toEqual({ body: item.body, signal: item.signal });
      expect("exitCode" in our).toBe(false);
    }
  });

  test("marker phải ở DÒNG CUỐI có newline đầu — thiếu newline/đuôi thừa KHÔNG khớp", () => {
    const inputs = [
      "x[exit code: 3]",
      "x\n[exit code: 3]\n",
      "x\n[exit code: 3] ",
      "x\n[exit code: 3]\ny",
    ];
    for (const text of inputs) {
      const our = ours.parseExitStatus(text);
      expect(our).toEqual(stock.parseExitStatus(text));
      expect(our).toEqual({ body: text, exitCode: 0 });
    }
  });

  test("hai marker ⇒ marker CUỐI thắng, marker còn lại Ở LẠI body", () => {
    const cases = [
      {
        text: "x\n[killed by signal: SIGKILL]\n[exit code: 137]",
        want: { body: "x\n[killed by signal: SIGKILL]", exitCode: 137 },
      },
      {
        text: "x\n[exit code: 1]\n[killed by signal: SIGINT]",
        want: { body: "x\n[exit code: 1]", signal: "SIGINT" },
      },
    ];
    for (const item of cases) {
      const our = ours.parseExitStatus(item.text);
      expect(our).toEqual(stock.parseExitStatus(item.text));
      expect(our).toEqual(item.want);
    }
  });

  test("bảng 14 input: JSON + thứ tự khoá TRÙNG stock", () => {
    const inputs = [
      "",
      "khong-marker",
      "\n",
      "\n[exit code: 1]",
      "x\n[exit code: 0]",
      "x\n[exit code: 999]",
      "x\n[killed by signal: SIGKILL]",
      "x\n[killed by signal: KILL]",
      "x\n[exit code: 1]\n[exit code: 2]",
      "x\n[killed by signal: SIGINT]\n[killed by signal: SIGTERM]",
      "x\n[exit code: 1]\n[killed by signal: SIGINT]",
      "x\n[killed by signal: SIGINT]\n[exit code: 1]",
      "x [exit code: 1]\n",
      "x\n[killed by signal: ]",
    ];
    for (const text of inputs) {
      const our = ours.parseExitStatus(text);
      const their = stock.parseExitStatus(text);
      expect(JSON.stringify(our)).toBe(JSON.stringify(their));
      expect(Object.keys(our)).toEqual(Object.keys(their));
    }
  });
});

describe("metadata + quy ước GBH-only", () => {
  test("KHÔNG gbh.row/row_unmounted; draft nêu lý do; peer=dev ĐÚNG stock; peers ⊆ peerDependencies", () => {
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as PackageManifest;
    const stockManifest = JSON.parse(readFileSync(STOCK_MANIFEST, "utf8")) as PackageManifest;
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-shell");
    // 04/11/2026 (P1b): nang dong bo phien ban noi bo len 0.2.1-alpha.4 de khop spec cua stock.
    expect(manifest.version).toBe("0.2.1-alpha.4");
    expect(manifest.private).toBe(true);
    expect(manifest.type).toBe("module");
    expect(manifest.main).toBe("lib/index.js");
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(manifest.peerDependencies, stockManifest.peerDependencies)).toBe(true);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(manifest.devDependencies, stockManifest.devDependencies)).toBe(true);
    expect(manifest.gbh?.row).toBeUndefined();
    expect(Object.hasOwn(manifest.gbh ?? {}, "row_unmounted_ly_do")).toBe(false);

    const draft = manifest.gbh?.draft ?? "";
    expect(draft).toContain("GBH-ONLY");
    expect(draft).toContain("dump-now2.txt");
    expect(draft).toContain("KHÔNG có");
    expect(draft).toContain("shell-env");
    expect(draft).toContain("shell-identity");
    expect(draft).toContain("KHÔNG khai");
    expect(manifest.gbh?.tests).toEqual(["tests/host/shell.test.ts"]);

    const peers = manifest.gbh?.peers ?? [];
    const declared = manifest.peerDependencies ?? {};
    expect(peers.filter((peer) => !Object.hasOwn(declared, peer))).toEqual([]);
    // 01/11/2026 — đồng bộ manifest theo stock ĐỔI THỨ TỰ khai của danh sách chọn lọc; thứ tự không phải hợp
    // đồng (chính sách: `gbh.peers` là danh sách chọn lọc ⊆ peerDependencies) ⇒ so như TẬP đã sắp xếp.
    expect([...peers].sort()).toEqual([
      "@deepseek-ai/cordis",
      "@deepseek-ai/dsh-sandbox",
      "@deepseek-ai/dsh-subprocess",
    ]);
    expect(peerRangeProblems(PKG)).toEqual([]);
  });

  test("/tmp/dump-now2.txt KHÔNG có id shell — chỉ shell-env/shell-identity của gói khác", () => {
    if (!existsSync(DUMP)) {
      // Tệp đo là tạm; khi môi trường khác đã dọn nó thì bằng chứng nằm ở gbh.draft + README §3.
      return;
    }
    const dump = readFileSync(DUMP, "utf8");
    const ids = [...dump.matchAll(/^[ \t]*- id: ([^\s]+)$/gmu)].map((match) => match[1] ?? "");
    expect(ids).not.toContain("shell");
    expect(dump.includes("name: '@deepseek-ai/dsh-shell'")).toBe(false);
    const shellish = ids.filter((id) => id.includes("shell"));
    expect(shellish).toContain("shell-env");
    expect(shellish).toContain("shell-identity");
    expect(shellish).not.toContain("shell");
  });

  test("README có header 5 dòng + đủ sáu mục 0..5", () => {
    const readme = readFileSync(README, "utf8");
    expect(readme).toContain("author Bùi Trọng Hiếu");
    expect(readme).toContain("email kevinbui210191@gmail.com");
    expect(readme).toContain("create date 15/10/2026");
    expect(readme).toMatch(/modify date \d{2}\/\d{2}\/\d{4}/u);
    expect(readme).toContain("desc ");
    for (let index = 0; index <= 5; index += 1) {
      expect(readme).toContain("## " + String(index) + ".");
    }
  });
});
