/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test đối chứng cho @galaxy-blackhole/gbh-worktree: đo trên ARTIFACT đã build, và chạy CẢ HAI bản
 *      (ta + bundle gốc) trên cùng một giàn seam giả rồi so từng argv · từng biến môi trường · từng
 *      thông điệp lỗi · tính ĐỘC LẬP của vật thể cấu hình (C6)
 */

import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

import { buildPackage } from "../../packages/host/worktree/build.ts";
import { PREPARE_DIRECTORY } from "../../packages/host/worktree/src/directory.ts";
import Ours, { WorktreeService } from "../../packages/host/worktree/src/index.ts";
import { GIT_ENV, GIT_SELECTORS, WORKTREE_TIMEOUT, runCommand } from "../../packages/host/worktree/src/process.ts";

/** Thư mục gốc repo. */
const ROOT = join(import.meta.dir, "..", "..");
/** Đường dẫn package của ta. */
const PKG = join(ROOT, "packages", "host", "worktree");
/** Gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_PKG = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "dsh-experimental-worktree");
/** Bundle GỐC (CHỈ ĐỌC). */
const STOCK = join(STOCK_PKG, "lib", "index.js");
/** cordis mà bundle GỐC nạp (kernel) — nguồn lớp cơ sở `Service` của phía gốc. */
const CORDIS = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** cordis mà CHÍNH package ta nạp (workspace) — TỆP khác trên đĩa (nội dung y hệt) nên lớp `Service` khác thể hiện. */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer. */
const OUT = join(PKG, ".test-lib");
/** Cây cài THẬT của kernel — nguồn peer mà artifact phải phân giải (pattern tests/host/shell.test.ts). */
const KERNEL_AI = join(ROOT, "apps", "host", "node_modules", "@deepseek-ai");

/** Artifact của TA, build ngay khi nạp test (mọi phép đo chạy trên artifact). */
const ARTIFACT_FILE: string = await buildPackage(OUT);
// Artifact import bare specifier ⇒ nó phân giải peer TỪ THƯ MỤC CỦA NÓ. Trỏ `@deepseek-ai` sang cây kernel
// để artifact dùng ĐÚNG lớp cơ sở `Service` của kernel: hai cây cài để hai tệp riêng (nội dung y hệt) nên
// thiếu bước này hai lớp sẽ có hai lớp cha KHÁC NHAU dù cùng mã nguồn.
mkdirSync(join(OUT, "node_modules"), { recursive: true });
symlinkSync(KERNEL_AI, join(OUT, "node_modules", "@deepseek-ai"), "dir");
// P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
// neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");
/** Mã nguồn artifact của ta. */
const OUR_CODE = await readFile(ARTIFACT_FILE, "utf8");
/** Mã nguồn bundle gốc. */
const STOCK_CODE = await readFile(STOCK, "utf8");
/** Module artifact của ta. */
const OurArtifact: any = await import(ARTIFACT_FILE);
/** Module bundle GỐC. */
const Stock: any = await import(STOCK);
/** Context cordis thật, dùng chung cho cả hai bản. */
const { Context } = (await import(CORDIS)) as any;
/** Lớp cơ sở `Service` của KERNEL — lớp cha mà bundle gốc thừa hưởng. */
const { Service: KernelService } = (await import(CORDIS)) as any;
/** Lớp cơ sở `Service` mà CHÍNH package ta nạp — lớp cha của lớp nguồn phía ta. */
const { Service: OurService } = (await import(OUR_CORDIS)) as any;

/** Hạn chờ tối đa của một phép chờ có trần (ms) — KHÔNG dùng setTimeout(0) làm phép đồng bộ. */
const WAIT_MS = 500;

/**
 * Chờ có TRẦN tới khi một điều kiện thành thật.
 * Nhận: điều kiện cần đợi, nhãn để báo lỗi, và trần thời gian.
 * Trả: không; ném khi quá trần (test đỏ với lý do rõ, không treo).
 */
async function waitFor(condition: () => boolean, label: string, timeoutMs: number = WAIT_MS): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error("quá hạn chờ: " + label);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

/** Một lệnh đã spawn, ghi lại nguyên văn những gì seam nhận. */
interface SpawnCall {
  /** argv mà seam tiến trình con nhận. */
  argv: readonly string[];
  /** Thư mục làm việc. */
  cwd: string;
  /** Môi trường (giữ cả bia mộ `undefined`). */
  env: Record<string, string | undefined>;
  /** Thời gian ân hạn. */
  graceMs: number;
  /** Cách xử lý stdio. */
  stdio: any;
  /** Tín hiệu huỷ của lượt spawn. */
  signal: AbortSignal | undefined;
}

/** Câu trả lời của một lệnh trong kịch bản giả. */
interface Answer {
  /** Toàn bộ stdout. */
  stdout?: string;
  /** Toàn bộ stderr. */
  stderr?: string;
  /** Mã thoát (null = chết vì tín hiệu). */
  exitCode?: number | null;
  /** Tín hiệu kết thúc. */
  signal?: string | null;
  /** Cờ "đầu ra vượt maxOutputBytes". */
  lossy?: boolean;
}

/** Giàn seam giả + mọi vết đo được của một lượt chạy. */
interface Rig {
  /** Context cordis thật đã cấp năm seam. */
  ctx: any;
  /** Mọi lệnh đã spawn, theo thứ tự. */
  calls: SpawnCall[];
  /** Mọi lượt bọc sandbox. */
  confined: { argv: readonly string[]; policy: any }[];
  /** Mọi lượt tra tệp thi hành. */
  executables: string[];
  /** Mọi lượt `fs.resolve`. */
  resolves: { path: string; cwd: string | undefined }[];
  /** Mọi lượt `fs.lstat`. */
  lstats: { path: string; cwd: string | undefined }[];
  /** Mọi đường dẫn đã công bố qua `workingDirectory.set`. */
  published: string[];
  /** Mọi yêu cầu giải chính sách. */
  policies: any[];
  /** Số lượt `terminate` và `waitForExit` đã gọi. */
  terminations: number;
  /** Số lượt `waitForExit` đã gọi. */
  waits: number;
  /** Thả các lệnh đang bị giữ (chế độ `hold`). */
  release(): void;
}

/** Tuỳ chọn của giàn giả. */
interface RigOptions {
  /** Câu trả lời theo argv; mặc định là một repo khoẻ mạnh. */
  responder?: (argv: readonly string[]) => Answer;
  /** Thư mục làm việc mà `workingDirectory.ensure` trả. */
  cwd?: string;
  /** Chính sách mà `sandboxPolicy.resolve` trả. */
  policy?: { mode: string; workspaceRoot: string };
  /** Có coi đường dẫn checkout đã tồn tại hay không (lstat). */
  pathExists?: boolean;
  /** Giữ mọi lệnh cho tới khi `release()` được gọi. */
  hold?: boolean;
}

/**
 * Câu trả lời của một repo Git khoẻ mạnh: nhánh chưa có, không bộ lọc, mọi bước thành công.
 * Nhận: argv của lệnh.
 * Trả: câu trả lời tương ứng.
 */
function healthy(argv: readonly string[]): Answer {
  const joined = argv.join(" ");
  if (joined.includes("check-ref-format")) return {};
  if (joined.includes("--show-toplevel")) return { stdout: "/repo\n" };
  if (joined.includes("rev-parse") && joined.includes("--verify")) return { stdout: "0123456789abcdef0123456789abcdef01234567\n" };
  if (joined.includes("show-ref")) return { exitCode: 1 };
  if (joined.includes("--input-type=module")) return {};
  if (joined.includes("worktree add")) return {};
  if (joined.includes("--get-regexp")) return { exitCode: 1 };
  if (joined.includes("reset")) return {};
  return {};
}

/**
 * Dựng một giàn seam giả trên Context cordis THẬT.
 * Nhận: tuỳ chọn kịch bản.
 * Trả: giàn đã cấp đủ năm seam, kèm sổ vết.
 */
function makeRig(options: RigOptions = {}): Rig {
  const responder = options.responder ?? healthy;
  const cwd = options.cwd ?? "/du-an";
  const policy = options.policy ?? { mode: "workspace-write", workspaceRoot: "/du-an" };
  const rig: Rig = {
    ctx: new Context(),
    calls: [],
    confined: [],
    executables: [],
    resolves: [],
    lstats: [],
    published: [],
    policies: [],
    terminations: 0,
    waits: 0,
    release: () => {},
  };
  const held: (() => void)[] = [];
  rig.release = () => {
    for (const resume of held.splice(0)) resume();
  };
  rig.ctx.provide("workingDirectory", {
    ensure: async (agent: any, signal?: AbortSignal) => {
      signal?.throwIfAborted();
      return cwd;
    },
    set: async (_agent: any, path: string) => {
      rig.published.push(path);
      return path;
    },
  });
  rig.ctx.provide("fs", {
    resolve: async (path: string, opts?: { cwd?: string; signal?: AbortSignal }) => {
      rig.resolves.push({ path, cwd: opts?.cwd });
      opts?.signal?.throwIfAborted();
      // Seam thật trả đích có `processPath` TUYỆT ĐỐI; giàn giả phải giữ đúng tính chất đó.
      return { targetKey: isAbsolute(path) ? path : join(opts?.cwd ?? "/", path) };
    },
    processPath: (target: { targetKey: string }) => target.targetKey,
    lstat: async (path: string, opts?: { cwd?: string }) => {
      rig.lstats.push({ path, cwd: opts?.cwd });
      return options.pathExists === true ? { type: "directory" } : undefined;
    },
  });
  rig.ctx.provide("sandboxPolicy", {
    resolve: (request?: any) => {
      rig.policies.push(request);
      return { ...policy };
    },
  });
  rig.ctx.provide("sandbox", {
    confine: async (argv: readonly string[], given: any) => {
      rig.confined.push({ argv: [...argv], policy: given });
      return { argv: ["sandbox-runner", "--", ...argv], enforcement: "full", denialSignatures: [], runnerFailureRules: [] };
    },
  });
  rig.ctx.provide("subprocess", {
    resolveExecutable: async (command: string) => {
      rig.executables.push(command);
      return "/usr/bin/" + command;
    },
    spawn: (spec: any) => {
      rig.calls.push({
        argv: [...spec.argv],
        cwd: spec.cwd,
        env: spec.env,
        graceMs: spec.graceMs,
        stdio: spec.stdio,
        signal: spec.signal,
      });
      const answer = responder(spec.argv);
      let resume: () => void = () => {};
      const gated = new Promise<void>((resolveGated) => {
        resume = resolveGated;
        if (options.hold !== true) resolveGated();
        else held.push(resolveGated);
      });
      const read = (text: string) => ({ readFrom: () => ({ text, nextOffset: 0, lossy: answer.lossy === true }) });
      return {
        get stdin() {
          return undefined;
        },
        get stdout() {
          return undefined;
        },
        get stderr() {
          return undefined;
        },
        get control() {
          return undefined;
        },
        collected: { stdout: read(answer.stdout ?? ""), stderr: read(answer.stderr ?? "") },
        done: gated.then(() => ({ exitCode: answer.exitCode === undefined ? 0 : answer.exitCode, signal: answer.signal ?? null })),
        terminate: () => {
          rig.terminations += 1;
        },
        waitForExit: async () => {
          rig.waits += 1;
          return true;
        },
      };
    },
  });
  return rig;
}

/**
 * Chụp lại một lượt spawn ở dạng so được (giữ cả bia mộ `undefined` trong môi trường).
 * Nhận: lượt spawn đã ghi.
 * Trả: vật thể thuần để so bằng JSON.
 */
function snapshot(call: SpawnCall): unknown {
  return {
    argv: [...call.argv],
    cwd: call.cwd,
    env: Object.entries(call.env),
    graceMs: call.graceMs,
    stdio: call.stdio,
  };
}

/**
 * Nhãn BƯỚC của một lệnh, suy từ DẤU HIỆU trong argv (không neo theo chỉ số: argv của lệnh Git đã bị bọc
 * sandbox nên vị trí tuyệt đối đổi theo chế độ).
 * Nhận: một lượt spawn đã ghi.
 * Trả: nhãn bước ("check-ref-format" · "rev-parse" · "show-ref" · "node" · "worktree add" · "config" · "reset").
 */
function stepOf(call: SpawnCall): string {
  const joined = call.argv.join(" ");
  if (joined.includes("--input-type=module")) return "node";
  if (joined.includes("check-ref-format")) return "check-ref-format";
  if (joined.includes("--show-toplevel")) return "rev-parse";
  if (joined.includes("--end-of-options")) return "rev-parse";
  if (joined.includes("show-ref")) return "show-ref";
  if (joined.includes("worktree add")) return "worktree add";
  if (joined.includes("--get-regexp")) return "config";
  if (joined.includes("reset")) return "reset";
  return "?";
}

/**
 * Dựng một service trên một giàn (không qua `ctx.plugin`, để nhận cấu hình đã phân giải tường minh).
 * Nhận: lớp service, giàn, và cấu hình.
 * Trả: thực thể service.
 */
function construct(serviceClass: any, rig: Rig, config: any): any {
  return new serviceClass(rig.ctx, config);
}

/**
 * Bắt thông điệp lỗi của một lượt gọi (không để test treo khi lời gọi không ném).
 * Nhận: hàm có thể ném.
 * Trả: thông điệp lỗi, hoặc chuỗi đánh dấu khi không ném.
 */
async function messageOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(khong nem)";
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * Bắt thông điệp lỗi của một lượt dựng ĐỒNG BỘ.
 * Nhận: hàm có thể ném.
 * Trả: thông điệp lỗi, hoặc chuỗi đánh dấu khi không ném.
 */
function throwMessageOf(run: () => unknown): string {
  try {
    run();
    return "(khong nem)";
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * Rút thân một hằng chuỗi khai bằng template literal trong artifact đã build.
 * Nhận: mã artifact và tên hằng.
 * Trả: thân NGUYÊN VĂN giữa hai dấu backtick (ném khi không thấy).
 */
function templateBody(code: string, name: string): string {
  const match = new RegExp("(?:var|let|const) " + name + " = \\`([\\s\\S]*?)\\`;").exec(code);
  if (match === null || match[1] === undefined) throw new Error("không thấy hằng " + name + " trong artifact");
  return match[1];
}

/**
 * Phần tử có trong danh sách peer khai báo mà KHÔNG có trong peerDependencies.
 * So PHẦN TỬ, không so số lượng (bài học 18/10/2026: so len() cho ra verdict rỗng).
 * Nhận: danh sách peer và danh sách tên peerDependencies.
 * Trả: các tên thiếu, theo thứ tự khai báo.
 */
function missingPeers(peers: readonly string[], peerDependencies: readonly string[]): string[] {
  const declared = new Set(peerDependencies);
  return peers.filter((peer) => !declared.has(peer));
}

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row worktree — artifact và bề mặt", () => {
  test("ARTIFACT: tập export của ta = tập export của gốc, 0 đăng ký id module (row MỘT MẶT)", async () => {
    expect([...OUR_CODE.matchAll(/id: @deepseek-ai/g)].length).toBe(0);
    expect([...OUR_CODE.matchAll(/id: @galaxy-blackhole/g)].length).toBe(0);
    expect(OUR_CODE.includes("__ModuleLoader__")).toBe(false);
    // Row một mặt: gói gốc KHÔNG có lib/client.js và KHÔNG khai dsh.client.
    expect(existsSync(join(STOCK_PKG, "lib", "client.js"))).toBe(false);
    const stockManifest = JSON.parse(await readFile(join(STOCK_PKG, "package.json"), "utf8"));
    const ourManifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    expect(stockManifest.dsh).toBeUndefined();
    expect(ourManifest.dsh).toBeUndefined();
    expect(Object.keys(OurArtifact).sort()).toEqual(Object.keys(Stock).sort());
    expect(Object.keys(OurArtifact).sort()).toEqual(["WorktreeService", "default"]);
    expect(OurArtifact.default).toBe(OurArtifact.WorktreeService);
    expect(Stock.default).toBe(Stock.WorktreeService);
    expect(Ours).toBe(WorktreeService);
    expect(WorktreeService.name).toBe(Stock.WorktreeService.name);
    expect(Object.getOwnPropertyNames(WorktreeService.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(Stock.WorktreeService.prototype).sort(),
    );
    expect(Object.getOwnPropertyNames(WorktreeService.prototype).sort()).toEqual([
      "constructor",
      "create",
      "createCheckout",
      "resolve",
    ]);
    // Kế thừa lớp cha THẬT (không phải bản sao lớp): mỗi bên thừa hưởng `Service` của cordis mà CHÍNH nó
    // nạp — phía ta: cordis workspace · phía gốc: cordis kernel. Hai cây cài để hai tệp riêng (nội dung y
    // hệt) nên so chéo danh tính hai lớp là so HAI BẢN SAO, không phải phép đo "cùng lớp hay không".
    expect(Object.getPrototypeOf(WorktreeService)).toBe(OurService);
    expect(Object.getPrototypeOf(Stock.WorktreeService)).toBe(KernelService);
    // Artifact build cạnh symlink `@deepseek-ai` → kernel nên nó phân giải peer như lúc chạy thật:
    // lớp của artifact thừa hưởng ĐÚNG lớp `Service` của kernel, trùng danh tính với phía gốc.
    expect(Object.getPrototypeOf(OurArtifact.WorktreeService)).toBe(Object.getPrototypeOf(Stock.WorktreeService));
    expect([...WorktreeService.inject]).toEqual([...Stock.WorktreeService.inject]);
    expect([...WorktreeService.inject]).toEqual(["workingDirectory", "fs", "subprocess", "sandbox", "sandboxPolicy"]);
  });

  test("luật 000e: gói gốc KHÔNG có locale/ ⇒ ta cũng KHÔNG ship locale/", () => {
    expect(existsSync(join(STOCK_PKG, "locale"))).toBe(false);
    expect(existsSync(join(PKG, "locale"))).toBe(false);
  });

  test("chương trình con cấp phát thư mục: thân NGUYÊN VĂN bằng từng byte với gốc", () => {
    const theirs = templateBody(STOCK_CODE, "PREPARE_DIRECTORY");
    const ours = templateBody(OUR_CODE, "PREPARE_DIRECTORY");
    expect(ours.length).toBeGreaterThan(0);
    expect(ours).toBe(theirs);
    // Và giá trị CHẠY ĐƯỢC của module nguồn cũng đúng thân ấy (escape của template đã giải).
    expect(PREPARE_DIRECTORY.replace(/\\/g, "\\\\")).toBe(ours);
    expect(PREPARE_DIRECTORY.includes("'*\\n'")).toBe(true);
  });

  test("bộ chọn Git phải xoá: đúng 15 tên NGUYÊN VĂN của bản gốc, mọi giá trị là bia mộ", () => {
    const match = /Object\.fromEntries\(\[([\s\S]*?)\]\.map/.exec(STOCK_CODE);
    expect(match).not.toBeNull();
    const theirs = [...(match?.[1] ?? "").matchAll(/"([A-Z_]+)"/g)].map((entry) => entry[1] ?? "");
    expect(theirs.length).toBe(15);
    expect([...GIT_SELECTORS]).toEqual(theirs);
    expect(Object.keys(GIT_ENV).length).toBe(15);
    for (const key of GIT_SELECTORS) expect(GIT_ENV[key]).toBeUndefined();
    expect(WORKTREE_TIMEOUT).toBe("WORKTREE_TIMEOUT");
  });

  test("hợp đồng với row tool-worktree: tên service vẫn là worktrees ở CẢ HAI bản", () => {
    const rig = makeRig();
    expect(construct(OurArtifact.WorktreeService, rig, OurArtifact.WorktreeService.Config({})).name).toBe("worktrees");
    const stockRig = makeRig();
    expect(construct(Stock.WorktreeService, stockRig, Stock.WorktreeService.Config({})).name).toBe("worktrees");
  });
});

describe("row worktree — cấu hình: schema, mặc định, và đường lỗi", () => {
  test("bảy mặc định của schema KHỚP từng giá trị với gốc", () => {
    const ours = OurArtifact.WorktreeService.Config({});
    const theirs = Stock.WorktreeService.Config({});
    expect(JSON.stringify(ours)).toBe(JSON.stringify(theirs));
    expect(ours).toEqual({
      directory: ".agents/worktrees",
      namePrefix: "worktree-",
      gitCommand: "git",
      nodeCommand: "node",
      timeoutMs: 6e4,
      graceMs: 3e3,
      maxOutputBytes: 65536,
    });
    // HAI lượt giải ⇒ HAI vật thể (C6: danh tính, không phải giá trị).
    expect(OurArtifact.WorktreeService.Config({})).not.toBe(ours);
  });

  test("constructor từ chối cấu hình hỏng với thông điệp TRÙNG TỪNG KÝ TỰ bản gốc", () => {
    const base = OurArtifact.WorktreeService.Config({});
    const cases: Record<string, unknown>[] = [
      { directory: "" },
      { directory: "a/../b" },
      { directory: "/tuyet-doi" },
      { directory: "a//b" },
      { directory: "a\\b" },
      { directory: "a:b" },
      { namePrefix: "-x" },
      { namePrefix: "../x" },
      { gitCommand: "   " },
      { nodeCommand: "" },
      { timeoutMs: 0 },
      { timeoutMs: -1 },
      { timeoutMs: 1.5 },
      { timeoutMs: Number.MAX_SAFE_INTEGER },
      { graceMs: 0 },
      { maxOutputBytes: 0 },
      { maxOutputBytes: 2147483648 },
    ];
    for (const patch of cases) {
      const oursMessage = throwMessageOf(() => construct(OurArtifact.WorktreeService, makeRig(), { ...base, ...patch }));
      const theirsMessage = throwMessageOf(() => construct(Stock.WorktreeService, makeRig(), { ...base, ...patch }));
      expect(theirsMessage).not.toBe("(khong nem)");
      expect(oursMessage).toBe(theirsMessage);
    }
    // Đối chứng DƯƠNG: trần đồng hồ đúng bằng MAX_TIMER_DELAY_MS thì HỢP LỆ ở cả hai bản.
    expect(() => construct(OurArtifact.WorktreeService, makeRig(), { ...base, timeoutMs: 2147483647 })).not.toThrow();
    expect(() => construct(Stock.WorktreeService, makeRig(), { ...base, timeoutMs: 2147483647 })).not.toThrow();
    // Đối chứng DƯƠNG 2: namePrefix RỖNG vẫn hợp lệ (sinh tên không tiền tố) — cả hai bản đồng ý.
    expect(() => construct(OurArtifact.WorktreeService, makeRig(), { ...base, namePrefix: "" })).not.toThrow();
    expect(() => construct(Stock.WorktreeService, makeRig(), { ...base, namePrefix: "" })).not.toThrow();
  });

  test("tên nhánh và revision sai: thông điệp TRÙNG bản gốc, và KHÔNG chạm seam nào", async () => {
    const badNames = ["", "..", ".", "a/../b", "a//b", "a\\b", "a:b", "-x", "/tuyet-doi"];
    for (const name of badNames) {
      const ourRig = makeRig();
      const stockRig = makeRig();
      const agent = { session: { id: "s1" } };
      const ours = await messageOf(() => construct(OurArtifact.WorktreeService, ourRig, OurArtifact.WorktreeService.Config({})).create(agent, { name }));
      const theirs = await messageOf(() => construct(Stock.WorktreeService, stockRig, Stock.WorktreeService.Config({})).create(agent, { name }));
      expect(theirs).not.toBe("(khong nem)");
      expect(ours).toBe(theirs);
      expect(ourRig.calls.length).toBe(0);
    }
    // revision rỗng: cùng một thông điệp.
    const ourRig = makeRig();
    const stockRig = makeRig();
    const agent = { session: { id: "s1" } };
    const ours = await messageOf(() => construct(OurArtifact.WorktreeService, ourRig, OurArtifact.WorktreeService.Config({})).create(agent, { from: "" }));
    const theirs = await messageOf(() => construct(Stock.WorktreeService, stockRig, Stock.WorktreeService.Config({})).create(agent, { from: "" }));
    expect(theirs).toBe("worktree from must name a local commit, branch, or tag");
    expect(ours).toBe(theirs);
    expect(ourRig.calls.length).toBe(0);
  });
});

describe("row worktree — hành vi: CÙNG chuỗi lệnh như bản gốc", () => {
  test("create(): chuỗi 8 lệnh · argv · cwd · môi trường · stdio · kết quả KHỚP từng byte", async () => {
    const agent = { session: { id: "phien-1" } };
    const ourRig = makeRig();
    const stockRig = makeRig();
    const ours = await construct(OurArtifact.WorktreeService, ourRig, OurArtifact.WorktreeService.Config({})).create(agent, { name: "feat-x" });
    const theirs = await construct(Stock.WorktreeService, stockRig, Stock.WorktreeService.Config({})).create(agent, { name: "feat-x" });
    expect(JSON.stringify(ours)).toBe(JSON.stringify(theirs));
    expect(JSON.stringify(ourRig.calls.map(snapshot))).toBe(JSON.stringify(stockRig.calls.map(snapshot)));
    expect(ourRig.calls.length).toBe(8);
    // Thứ tự lệnh là HỢP ĐỒNG: kiểm tên bước theo argv ở cả hai bên.
    expect(ourRig.calls.map(stepOf)).toEqual([
      "check-ref-format",
      "rev-parse",
      "rev-parse",
      "show-ref",
      "node",
      "worktree add",
      "config",
      "reset",
    ]);
    // Bản GỐC phải đi đúng chuỗi bước ấy — đây là hợp đồng thứ tự của cả hai bên.
    expect(stockRig.calls.map(stepOf)).toEqual(ourRig.calls.map(stepOf));
    // Kết quả công khai: đường dẫn checkout, nhánh, commit mốc, gốc repo.
    expect(ours).toEqual({
      path: "/repo/.agents/worktrees/feat-x",
      branch: "feat-x",
      baseCommit: "0123456789abcdef0123456789abcdef01234567",
      repositoryRoot: "/repo",
    });
    expect(ourRig.published).toEqual(["/repo/.agents/worktrees/feat-x"]);
    // Chính sách của PHIÊN được giải đúng MỘT lần, với chính phiên của agent.
    expect(ourRig.policies.length).toBe(1);
    expect(ourRig.policies[0]).toEqual({ session: agent.session });
    // Mọi lệnh đều phải dọn: terminate + waitForExit cho TỪNG lệnh.
    expect(ourRig.terminations).toBe(8);
    expect(ourRig.waits).toBe(8);
  });

  test("mọi lệnh mang đủ 15 bia mộ Git + 3 cờ tất định, ở CẢ HAI bản", async () => {
    const agent = { session: { id: "phien-1" } };
    const ourRig = makeRig();
    await construct(OurArtifact.WorktreeService, ourRig, OurArtifact.WorktreeService.Config({})).create(agent, { name: "feat-x" });
    for (const call of ourRig.calls) {
      for (const key of GIT_SELECTORS) expect(Object.hasOwn(call.env, key)).toBe(true);
      expect(call.env.GIT_SELECTORS_TEST).toBeUndefined();
      expect(call.env.GIT_TERMINAL_PROMPT).toBe("0");
      expect(call.env.GIT_LFS_SKIP_SMUDGE).toBe("1");
      expect(call.env.GIT_NO_LAZY_FETCH).toBe("1");
      expect(call.graceMs).toBe(3e3);
      expect(call.stdio.stdin).toBe("ignore");
      expect(call.stdio.stdout).toEqual({ maxBytes: 65536 });
      expect(call.stdio.stderr).toEqual({ maxBytes: 65536 });
    }
    // Chế độ workspace-write: MỌI lệnh đều bị bọc qua seam sandbox, và argv đã bọc mới được spawn.
    expect(ourRig.confined.length).toBe(8);
    expect(ourRig.confined[0]?.policy).toEqual({ mode: "workspace-write", workspaceRoot: "/du-an" });
    expect(ourRig.calls[0]?.argv[0]).toBe("sandbox-runner");
    expect(ourRig.executables).toContain("git");
    expect(ourRig.executables).toContain("node");
  });

  test("chế độ danger-full-access: KHÔNG gọi sandbox, argv đi THẲNG vào spawn — y bản gốc", async () => {
    const agent = { session: { id: "phien-1" } };
    const ourRig = makeRig({ policy: { mode: "danger-full-access", workspaceRoot: "/du-an" } });
    const stockRig = makeRig({ policy: { mode: "danger-full-access", workspaceRoot: "/du-an" } });
    await construct(OurArtifact.WorktreeService, ourRig, OurArtifact.WorktreeService.Config({})).create(agent, { name: "feat-x" });
    await construct(Stock.WorktreeService, stockRig, Stock.WorktreeService.Config({})).create(agent, { name: "feat-x" });
    expect(ourRig.confined.length).toBe(0);
    expect(stockRig.confined.length).toBe(0);
    expect(ourRig.calls[0]?.argv[0]).toBe("/usr/bin/git");
    expect(JSON.stringify(ourRig.calls.map(snapshot))).toBe(JSON.stringify(stockRig.calls.map(snapshot)));
  });

  test("bộ lọc Git: BIẾN MÔI TRƯỜNG của lượt reset KHỚP gốc (thứ tự + giá trị) cho 2 driver", async () => {
    const agent = { session: { id: "phien-1" } };
    const filters = "filter.lfs.clean\0filter.lfs.smudge\0filter.lfs.process\0filter.lfs.required\0filter.foo.clean\0";
    const responder = (argv: readonly string[]): Answer => {
      if (argv.join(" ").includes("--get-regexp")) return { stdout: filters };
      return healthy(argv);
    };
    const ourRig = makeRig({ responder });
    const stockRig = makeRig({ responder });
    await construct(OurArtifact.WorktreeService, ourRig, OurArtifact.WorktreeService.Config({})).create(agent, { name: "feat-x" });
    await construct(Stock.WorktreeService, stockRig, Stock.WorktreeService.Config({})).create(agent, { name: "feat-x" });
    const resetCall = ourRig.calls.find((call) => call.argv.includes("reset"));
    expect(resetCall).toBeDefined();
    expect(resetCall?.env.GIT_CONFIG_COUNT).toBe("8");
    expect(resetCall?.env.GIT_CONFIG_KEY_0).toBe("filter.lfs.clean");
    expect(resetCall?.env.GIT_CONFIG_VALUE_0).toBe("");
    expect(resetCall?.env.GIT_CONFIG_KEY_3).toBe("filter.lfs.required");
    expect(resetCall?.env.GIT_CONFIG_VALUE_3).toBe("false");
    expect(resetCall?.env.GIT_CONFIG_KEY_4).toBe("filter.foo.clean");
    expect(JSON.stringify(ourRig.calls.map(snapshot))).toBe(JSON.stringify(stockRig.calls.map(snapshot)));
  });

  test("không có tên: nhánh sinh tự động đúng tiền tố, HAI lượt khác nhau (UUID), khớp gốc", async () => {
    const agent = { session: { id: "phien-1" } };
    const ourService = construct(OurArtifact.WorktreeService, makeRig(), OurArtifact.WorktreeService.Config({}));
    const first = await ourService.create(agent);
    const second = await ourService.create(agent);
    expect(first.branch.startsWith("worktree-")).toBe(true);
    expect(first.branch).not.toBe(second.branch);
    expect(first.branch.length).toBe("worktree-".length + 36);
    // Bản gốc cũng sinh tên cùng hình dạng (chỉ khác giá trị UUID).
    const stockService = construct(Stock.WorktreeService, makeRig(), Stock.WorktreeService.Config({}));
    const theirs = await stockService.create(agent);
    expect(theirs.branch.startsWith("worktree-")).toBe(true);
    expect(theirs.branch.length).toBe(first.branch.length);
  });
});

describe("row worktree — đường lỗi: thông điệp TRÙNG TỪNG KÝ TỰ bản gốc", () => {
  test("nhánh đã tồn tại · đường dẫn đã tồn tại · Git hỏng · chết vì tín hiệu · vượt maxOutputBytes", async () => {
    const agent = { session: { id: "phien-1" } };
    const scenarios: { label: string; responder: (argv: readonly string[]) => Answer; pathExists?: boolean }[] = [
      {
        label: "nhánh đã tồn tại",
        responder: (argv) => (argv.join(" ").includes("show-ref") ? { exitCode: 0 } : healthy(argv)),
      },
      { label: "đường dẫn đã tồn tại", responder: healthy, pathExists: true },
      {
        label: "Git trả mã 1 kèm stderr",
        responder: (argv) =>
          argv.join(" ").includes("check-ref-format") ? { exitCode: 128, stderr: "fatal: not a git repository\n" } : healthy(argv),
      },
      {
        label: "chết vì tín hiệu",
        responder: (argv) => (argv.join(" ").includes("check-ref-format") ? { exitCode: null, signal: "SIGTERM", stderr: "bi giet" } : healthy(argv)),
      },
      {
        label: "vượt maxOutputBytes",
        responder: (argv) => (argv.join(" ").includes("--show-toplevel") ? { stdout: "/repo\n", lossy: true } : healthy(argv)),
      },
    ];
    for (const scenario of scenarios) {
      const ourRig = makeRig({ responder: scenario.responder, pathExists: scenario.pathExists === true });
      const stockRig = makeRig({ responder: scenario.responder, pathExists: scenario.pathExists === true });
      const ours = await messageOf(() =>
        construct(OurArtifact.WorktreeService, ourRig, OurArtifact.WorktreeService.Config({})).create(agent, { name: "feat-x" }),
      );
      const theirs = await messageOf(() =>
        construct(Stock.WorktreeService, stockRig, Stock.WorktreeService.Config({})).create(agent, { name: "feat-x" }),
      );
      expect(theirs).not.toBe("(khong nem)");
      expect(ours).toBe(theirs);
    }
  });

  test('lỗi SAU bước cấp phát thư mục được bọc kèm nhánh + đường dẫn + "đã giữ lại" — y gốc', async () => {
    const agent = { session: { id: "phien-1" } };
    const responder = (argv: readonly string[]): Answer => {
      if (argv.join(" ").includes("worktree add")) return { exitCode: 1, stderr: "fatal: could not create" };
      return healthy(argv);
    };
    const ourRig = makeRig({ responder });
    const stockRig = makeRig({ responder });
    const ours = await messageOf(() =>
      construct(OurArtifact.WorktreeService, ourRig, OurArtifact.WorktreeService.Config({})).create(agent, { name: "feat-x" }),
    );
    const theirs = await messageOf(() =>
      construct(Stock.WorktreeService, stockRig, Stock.WorktreeService.Config({})).create(agent, { name: "feat-x" }),
    );
    expect(ours).toBe(theirs);
    expect(ours).toBe(
      "Could not finish worktree feat-x at /repo/.agents/worktrees/feat-x. Any created checkout and branch are retained. " +
        "worktree command failed (1): fatal: could not create",
    );
    // Lượt hỏng KHÔNG công bố thư mục nào cho phiên.
    expect(ourRig.published).toEqual([]);
  });
});

describe("row worktree — huỷ và vòng đời", () => {
  test("tín hiệu của BÊN GỌI hợp nhất với vòng đời: huỷ giữa lượt ⇒ lệnh đang chạy thấy huỷ", async () => {
    const agent = { session: { id: "phien-1" } };
    const rig = makeRig({ hold: true });
    const service = construct(OurArtifact.WorktreeService, rig, OurArtifact.WorktreeService.Config({}));
    const controller = new AbortController();
    const running = service.create(agent, { name: "feat-x" }, controller.signal);
    await waitFor(() => rig.calls.length > 0, "lệnh đầu tiên đã spawn");
    controller.abort();
    await waitFor(() => rig.calls[0]?.signal?.aborted === true, "tín hiệu của lượt spawn đã bị huỷ");
    rig.release();
    const message = await messageOf(() => running);
    expect(message).not.toBe("(khong nem)");
    // Đối chứng: tín hiệu ĐÃ huỷ trước khi gọi ⇒ ném NGAY, không spawn lệnh nào.
    const cleanRig = makeRig();
    const aborted = await messageOf(() =>
      construct(OurArtifact.WorktreeService, cleanRig, OurArtifact.WorktreeService.Config({})).create(agent, {}, AbortSignal.abort()),
    );
    expect(aborted).not.toBe("(khong nem)");
    expect(cleanRig.calls.length).toBe(0);
  });

  test("hàm dọn của service huỷ vòng đời và CHỜ các lượt đang chạy lặng hẳn", async () => {
    const agent = { session: { id: "phien-1" } };
    const disposers: (() => Promise<void>)[] = [];
    const rig = makeRig({ hold: true });
    rig.ctx.effect = (execute: () => () => Promise<void>) => {
      disposers.push(execute());
      return () => {};
    };
    // Lượt dựng đăng ký ĐÚNG HAI effect: một cho `provide("worktrees")` của cordis (trong `super`), một
    // cho hàm dọn vòng đời của TA (đăng ký SAU, nên là phần tử CUỐI).
    const before = disposers.length;
    const service = construct(OurArtifact.WorktreeService, rig, OurArtifact.WorktreeService.Config({}));
    expect(disposers.length).toBe(before + 2);
    expect(service.name).toBe("worktrees");
    const running = service.create(agent, { name: "feat-x" });
    running.catch(() => {});
    await waitFor(() => rig.calls.length > 0, "lượt tạo đã vào tới lệnh đầu tiên");
    let settled = false;
    const disposed = (disposers[disposers.length - 1] as () => Promise<void>)().then(() => {
      settled = true;
    });
    // Chưa thả lệnh ⇒ hàm dọn CHƯA được settle (nó đang chờ sổ pending).
    expect(settled).toBe(false);
    rig.release();
    await disposed;
    expect(settled).toBe(true);
    const message = await messageOf(() => running);
    expect(message).not.toBe("(khong nem)");
  });
});

describe("row worktree — C6: vật thể cấu hình ĐỘC LẬP giữa hai thực thể", () => {
  test("hai service ⇒ hai vòng đời + hai sổ pending RIÊNG, đo bằng DANH TÍNH", () => {
    const serviceA = construct(OurArtifact.WorktreeService, makeRig(), OurArtifact.WorktreeService.Config({}));
    const serviceB = construct(OurArtifact.WorktreeService, makeRig(), OurArtifact.WorktreeService.Config({}));
    // Hai thực thể SÂU BẰNG NHAU về cấu hình nhưng KHÁC vật thể ở mọi tầng trạng thái sống.
    expect(serviceA.config).toEqual(serviceB.config);
    expect(serviceA.config).not.toBe(serviceB.config);
    expect(serviceA.lifetime).not.toBe(serviceB.lifetime);
    expect(serviceA.pending).not.toBe(serviceB.pending);
    expect(serviceA.seams).not.toBe(serviceB.seams);
    // Sửa cấu hình của A KHÔNG lan sang B.
    serviceA.config.timeoutMs = 1;
    expect(serviceB.config.timeoutMs).toBe(6e4);
    // Huỷ vòng đời của A KHÔNG chạm tới B.
    serviceA.lifetime.abort(new Error("dong A"));
    expect(serviceA.lifetime.signal.aborted).toBe(true);
    expect(serviceB.lifetime.signal.aborted).toBe(false);
  });

  test("ĐỐI CHỨNG ÂM: chia sẻ tham chiếu thì so SÂU vẫn ĐẠT — chỉ DANH TÍNH mới bắt", () => {
    const shared = { directory: ".agents/worktrees", namePrefix: "worktree-", timeoutMs: 6e4 };
    const make = () => shared;
    const a = make();
    const b = make();
    expect(a).toEqual(b);
    expect(a).toBe(b);
    a.timeoutMs = 1;
    expect(b.timeoutMs).toBe(1);
    // Cùng nội dung nhưng KHÁC vật: so sâu ĐẠT, danh tính KHÁC — đúng chiều ngược lại của phép kiểm.
    const c = { ...shared };
    expect(c).toEqual(shared);
    expect(c).not.toBe(shared);
  });
});

describe("row worktree — runCommand: ma trận lỗi của tầng tiến trình", () => {
  test("hết hạn · huỷ · mã thoát ngoài danh sách · lossy — thông điệp như bản gốc", async () => {
    const policy = { mode: "workspace-write" as const, workspaceRoot: "/du-an" };
    const config = { timeoutMs: 6e4, graceMs: 3e3, maxOutputBytes: 65536 };
    const seamsOf = (rig: Rig) => ({
      fs: rig.ctx.fs,
      subprocess: rig.ctx.subprocess,
      sandbox: rig.ctx.sandbox,
      sandboxPolicy: rig.ctx.sandboxPolicy,
      workingDirectory: rig.ctx.workingDirectory,
    });
    const run = (rig: Rig, signal: AbortSignal, allowed: readonly number[] = [0], argv: [string, ...string[]] = ["git", "status"]) =>
      runCommand(seamsOf(rig) as any, config, policy, "/du-an", argv, signal, allowed);
    // (a) thành công: trả đúng stdout + mã thoát.
    expect(await run(makeRig() as Rig, new AbortController().signal)).toEqual({ stdout: "", exitCode: 0 });
    // (b) mã thoát ngoài danh sách ⇒ thông điệp kèm mã + stderr đã cắt.
    const failing = makeRig({ responder: () => ({ exitCode: 7, stderr: "  hong  \n" }) });
    expect(await messageOf(() => run(failing, new AbortController().signal))).toBe("worktree command failed (7): hong");
    // (c) danh sách cho phép rộng hơn ⇒ không ném.
    const allowed = makeRig({ responder: () => ({ exitCode: 1 }) });
    expect((await run(allowed, new AbortController().signal, [0, 1])).exitCode).toBe(1);
    // (d) chết vì tín hiệu ⇒ mã là TÊN tín hiệu.
    const killed = makeRig({ responder: () => ({ exitCode: null, signal: "SIGKILL", stderr: "x" }) });
    expect(await messageOf(() => run(killed, new AbortController().signal))).toBe("worktree command failed (SIGKILL): x");
    // (e) lossy ⇒ đúng một câu của bản gốc.
    const lossy = makeRig({ responder: () => ({ stdout: "rat dai", lossy: true }) });
    expect(await messageOf(() => run(lossy, new AbortController().signal))).toBe("worktree command output exceeds maxOutputBytes");
    // (f) tín hiệu đã huỷ ⇒ ném trước khi spawn lệnh nào.
    const abortedRig = makeRig();
    expect(await messageOf(() => run(abortedRig, AbortSignal.abort()))).not.toBe("(khong nem)");
    expect(abortedRig.calls.length).toBe(0);
    expect(abortedRig.executables.length).toBe(0);
  });
});

describe("row worktree — hợp đồng metadata", () => {
  test("gbh.peers là TẬP CON của peerDependencies — có ĐỐI CHỨNG ÂM", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    const peers: string[] = manifest.gbh.peers;
    const peerDependencies: string[] = Object.keys(manifest.peerDependencies);
    expect(Array.isArray(peers)).toBe(true);
    expect(peers.length).toBeGreaterThan(0);
    expect(missingPeers(peers, peerDependencies)).toEqual([]);
    expect(peers).toEqual(["@deepseek-ai/cordis", "@deepseek-ai/dsh-timeout", "@deepseek-ai/schemastery"]);
    expect(manifest.dependencies).toBeUndefined();
    // Peer phải là peerDependencies (kernel cấp MỘT thể hiện), KHÔNG nằm ở dependencies.
    for (const peer of peers) expect(Object.hasOwn(manifest.devDependencies ?? {}, peer)).toBe(true);
    expect(new Set(peers).size).toBe(peers.length);
    // ĐỐI CHỨNG ÂM 1: cùng SỐ LƯỢNG nhưng lệch phần tử — phép so số lượng sẽ cho verdict RỖNG.
    expect(missingPeers(["@a/x", "@a/y"], ["@a/x", "@a/z"])).toEqual(["@a/y"]);
    expect(["@a/x", "@a/y"].length).toBe(["@a/x", "@a/z"].length);
    // ĐỐI CHỨNG ÂM 2: xoá ĐÚNG một tên thật khỏi peerDependencies ⇒ báo đúng tên đó.
    for (const peer of peers) {
      const without = peerDependencies.filter((name) => name !== peer);
      expect(missingPeers(peers, without)).toEqual([peer]);
    }
    // ĐỐI CHỨNG ÂM 3: thừa tên trong peerDependencies KHÔNG bị coi là lỗi (luật chỉ một chiều).
    expect(missingPeers(peers, [...peerDependencies, "@a/thua"])).toEqual([]);
  });

  test("metadata: row `worktree` KHÔNG inject/config (y row gốc) và tool-worktree chờ seam worktrees", async () => {
    const manifest = JSON.parse(await readFile(join(PKG, "package.json"), "utf8"));
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-worktree");
    // Đọc CẢ HAI dạng: `gbh.row` (đang khai) và `gbh.row_unmounted_ly_do.row` (đã gỡ mount) — bài học
    // 17-18/10/2026: đọc mỗi dạng đầu làm test đỏ bằng TypeError khi Lead gỡ mount.
    const row = manifest.gbh.row ?? manifest.gbh.row_unmounted_ly_do?.row;
    expect(row).toBeDefined();
    expect(row.id).toBe("worktree");
    // Row gốc trong `ours.yml` (dump 2026-10-18T01-31-57, dòng 1475–1476) chỉ có `id` + `name`:
    // KHÔNG `config`, KHÔNG `inject` ⇒ khối patch của ta cũng KHÔNG được sinh ra chúng.
    expect(row.inject).toBeUndefined();
    expect(row.config).toBeUndefined();
    // Row MỘT MẶT ⇒ không có id module nào để khai.
    expect(row.moduleIds).toBeUndefined();
    expect(row.aliases).toBeUndefined();
    expect([...(row.tests ?? [])]).toEqual(["tests/host/worktree.test.ts"]);
    expect(existsSync(join(ROOT, "tests", "host", "worktree.test.ts"))).toBe(true);
    // Hợp đồng liên gói: row tool-worktree inject seam "worktrees" — tên service của row này KHÔNG được đổi.
    const client = await readFile(join(ROOT, "packages", "host", "tool-worktree", "src", "index.ts"), "utf8");
    expect(client.includes('"worktrees"')).toBe(true);
    expect(client.includes("worktreesOf")).toBe(true);
  });
});
