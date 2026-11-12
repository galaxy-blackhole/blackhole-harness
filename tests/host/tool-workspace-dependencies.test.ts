/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho gói tool-workspace-dependencies: export surface · provenance · parsePrimaryRuntime · đường dẫn
 *      nền tảng · alias/copy/install payload · apply (schema tool + execute) — so TRỰC TIẾP với bundle gốc
 */

import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Import từ NGUỒN (`src/index.ts`) thay vì `lib/index.js`: `lib/` không có `.d.ts` ⇒ TS7016.
import * as ours from "../../packages/host/tool-workspace-dependencies/src/index.ts";

/** Thư mục gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói của ta. */
const OURS_DIR = join(REPO, "packages", "host", "tool-workspace-dependencies");
/** Artefact đã build của ta. */
const OURS_ARTIFACT = join(OURS_DIR, "lib", "index.js");
/** Bản gốc trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-workspace-dependencies");
/** Bundle gốc. */
const STOCK = join(STOCK_DIR, "lib", "index.js");

/** Bề mặt xuất khẩu đúng của bản gốc (11 tên). */
const EXPORTS = [
  "Config",
  "apply",
  "copyPrimaryRuntime",
  "inject",
  "installPrimaryRuntime",
  "name",
  "parsePrimaryRuntime",
  "primaryRuntimePythonAliases",
  "readPrimaryRuntime",
  "resolvePrimaryRuntime",
  "workspaceDependencyPaths",
];

/** Phần bề mặt plugin (ta hoặc gốc) mà test gọi. */
interface Plugin {
  /** Tên plugin. */
  readonly name: string;
  /** Sổ tool đăng ký vào. */
  readonly inject: string[];
  /** Schema cấu hình (schemastery). */
  readonly Config: (value: unknown) => Record<string, unknown>;
  /** Chuẩn hoá metadata payload. */
  readonly parsePrimaryRuntime: (value: unknown) => Record<string, unknown>;
  /** Đọc metadata từ thư mục. */
  readonly readPrimaryRuntime: (root: string) => Promise<Record<string, unknown>>;
  /** Đường dẫn theo nền tảng. */
  readonly workspaceDependencyPaths: (root: string, manifest: Record<string, unknown>) => Record<string, unknown>;
  /** Alias trình thông dịch Python. */
  readonly primaryRuntimePythonAliases: (root: string, manifest: Record<string, unknown>) => Promise<Map<string, string>>;
  /** Sao chép payload. */
  readonly copyPrimaryRuntime: (source: string, destination: string, manifest: Record<string, unknown>) => Promise<void>;
  /** Dùng payload tại chỗ. */
  readonly resolvePrimaryRuntime: (source: string) => Promise<Record<string, unknown>>;
  /** Cài payload. */
  readonly installPrimaryRuntime: (source: string, root: string) => Promise<Record<string, unknown>>;
  /** Đăng ký tool. */
  readonly apply: (ctx: FakeContext, config: Record<string, unknown>) => void;
}

/** Tool đã đăng ký, giữ đủ trường để so A/B. */
interface CapturedTool {
  /** Tên tool. */
  readonly name: string;
  /** Mô tả gửi mô hình. */
  readonly description: string;
  /** Schema tham số đã biên dịch. */
  readonly parameters: unknown;
  /** Schema đầu ra + render. */
  readonly output: {
    /** JSON schema đầu ra. */
    readonly schema: unknown;
    /** Hàm render nội dung. */
    readonly render: (args: unknown, value: unknown) => unknown;
  };
  /** Thân thực thi (defineTool bọc kiểm tham số nên phải gọi với `{}`). */
  readonly execute: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Presenter lời gọi (cũng bị defineTool bọc kiểm tham số). */
  readonly presentCall: (args: Record<string, unknown>) => unknown;
}

/** Context giả tối thiểu: `effect` + `tools.register` như cordis thật. */
interface FakeContext {
  /** Sổ tool của context giả. */
  readonly tools: { register: (tool: CapturedTool) => void };
  /** Đăng ký effect, trả disposer rỗng. */
  readonly effect: (body: () => unknown) => () => void;
  /**
   * 08/11/2026 (PHASE B): đường đọc CẤU TRÚC `ctx.get("tools")` — bundle của TA đọc sổ tool qua đây
   * (ADR 000d), còn bundle GỐC đọc `ctx.tools` trực tiếp ⇒ giả lập CẢ HAI đường trên CÙNG một sổ.
   * Nhận: tên service. Trả: sổ tool khi tên là "tools", ngược lại undefined.
   */
  readonly get: (name: string) => unknown;
}

/** Thư mục tạm đã tạo (dọn ở afterAll). */
const TEMP_DIRS: string[] = [];

/**
 * Tạo thư mục tạm dưới `os.tmpdir()`.
 * Nhận: prefix — tiền tố tên thư mục.
 * Trả: đường dẫn tuyệt đối của thư mục vừa tạo.
 */
function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), "gbh-wsd-" + prefix));
  TEMP_DIRS.push(dir);
  return dir;
}

/**
 * Nạp bundle gốc bằng import động (đường dẫn chuỗi để tsc không kéo kiểu vào chương trình).
 * Nhận: không.
 * Trả: Promise của module gốc đã ép về `Plugin`.
 */
async function stock(): Promise<Plugin> {
  return (await import(STOCK)) as Plugin;
}

/** Bản của ta, ép về cùng bề mặt để so 1:1. */
const mine = ours as unknown as Plugin;

/**
 * Dựng manifest hợp lệ cho máy đang chạy.
 * Nhận: overrides — trường cần đè.
 * Trả: object runtime.json (chưa qua kiểm).
 */
function makeManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    desktopVersion: "0.4.2",
    platform: process.platform,
    arch: process.arch,
    python: "3.12.4",
    pythonPackages: { numpy: "2.1.3", pandas: "2.2.3" },
    ...overrides,
  };
}

/** Tuỳ chọn dựng payload giả. */
interface PayloadOptions {
  /** runtime.json đè. */
  readonly runtime?: Record<string, unknown>;
  /** Tạo alias python/python3 là liên kết tượng trưng. */
  readonly aliases?: boolean;
  /** Kèm Node.js đi kèm. */
  readonly node?: boolean;
  /** Kèm pnpm đi kèm (cần node). */
  readonly pnpm?: boolean;
  /** Tạo thư mục site-packages. */
  readonly sitePackages?: boolean;
}

/**
 * Dựng payload giả trong thư mục tạm: runtime.json + dependencies/python/... (+ node/pnpm tuỳ chọn).
 * Nhận: options — hình dạng payload cần dựng.
 * Trả: đường dẫn tuyệt đối thư mục payload.
 */
function makePayload(options: PayloadOptions = {}): string {
  const runtime = options.runtime ?? makeManifest({
    ...(options.node === true ? { node: "22.14.0" } : {}),
    ...(options.pnpm === true ? { pnpm: "10.9.0" } : {}),
  });
  const root = tempDir("payload-");
  writeFileSync(join(root, "runtime.json"), JSON.stringify(runtime));
  const version = String(runtime.python ?? "3.12.4").split(".").slice(0, 2).join(".");
  const bin = join(root, "dependencies", "python", "bin");
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, "python" + version), "#!/bin/sh\nexit 0\n");
  if (options.aliases === true) {
    symlinkSync("python" + version, join(bin, "python"));
    symlinkSync("python" + version, join(bin, "python3"));
  } else {
    writeFileSync(join(bin, "python3"), "#!/bin/sh\nexit 0\n");
  }
  if (options.sitePackages !== false) {
    mkdirSync(join(root, "dependencies", "python", "lib", "python" + version, "site-packages"), { recursive: true });
  }
  if (options.node === true) {
    mkdirSync(join(root, "dependencies", "node", "bin"), { recursive: true });
    writeFileSync(join(root, "dependencies", "node", "bin", "node"), "");
    mkdirSync(join(root, "dependencies", "node", "node_modules"), { recursive: true });
  }
  if (options.pnpm === true) {
    mkdirSync(join(root, "dependencies", "pnpm", "bin"), { recursive: true });
    writeFileSync(join(root, "dependencies", "pnpm", "bin", "pnpm.mjs"), "");
  }
  return root;
}

/**
 * Gom tên xuất khẩu từ khai báo `export { ... }` của artefact ESM.
 * Nhận: text — nội dung tệp JS.
 * Trả: mảng tên đã sắp xếp (xử lý cả dạng `x as name`).
 */
function exportedNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/gu)) {
    for (const part of (match[1] ?? "").split(",")) {
      const name = part.trim().split(/\s+as\s+/u).pop()?.trim();
      if (name !== undefined && name !== "") names.add(name);
    }
  }
  return [...names].sort();
}

/**
 * Bắt thông điệp lỗi của một phép gọi (đồng bộ hoặc bất đồng bộ).
 * Nhận: fn — phép gọi cần chạy.
 * Trả: Promise của thông điệp lỗi, hoặc "<no-error>" khi không ném.
 */
async function message(fn: () => unknown): Promise<string> {
  try {
    await fn();
    return "<no-error>";
  } catch (error) {
    return (error as Error).message;
  }
}

/**
 * Đổi mọi lần xuất hiện của một gốc đường dẫn thành nhãn cố định để so hai bên.
 * Nhận: value — giá trị bất kỳ (đã JSON-serializable); root — gốc cần thay.
 * Trả: bản sao đã thay gốc bằng "<root>".
 */
function normalize(value: unknown, root: string): unknown {
  return JSON.parse(JSON.stringify(value).split(root).join("<root>")) as unknown;
}

/**
 * Dựng context giả rồi áp plugin lên đó.
 * Nhận: plugin — bản cần áp; config — cấu hình thô.
 * Trả: tools đã đăng ký + effects đã đăng ký + lỗi apply (nếu có).
 */
function install(plugin: Plugin, config: Record<string, unknown>): { tools: CapturedTool[]; effects: unknown[]; error?: string } {
  const tools: CapturedTool[] = [];
  const effects: unknown[] = [];
  const ctx: FakeContext = {
    tools: { register: (tool) => { tools.push(tool); } },
    effect: (body) => {
      effects.push(body());
      return () => undefined;
    },
    get: (name) => (name === "tools" ? ctx.tools : undefined),
  };
  try {
    plugin.apply(ctx, config);
    return { tools, effects };
  } catch (error) {
    return { tools, effects, error: (error as Error).message };
  }
}

afterAll(() => {
  for (const dir of TEMP_DIRS) rmSync(dir, { recursive: true, force: true });
});

describe("tool-workspace-dependencies — bề mặt + provenance", () => {
  test("artefact xuất ĐÚNG 11 tên như bundle gốc", async () => {
    const artifact = exportedNames(readFileSync(OURS_ARTIFACT, "utf8"));
    expect(artifact).toEqual(exportedNames(readFileSync(STOCK, "utf8")));
    expect(artifact).toEqual([...EXPORTS].sort());
    expect(Object.keys(ours).filter((key) => typeof (ours as Record<string, unknown>)[key] !== "undefined").sort()).toEqual([...EXPORTS].sort());
    // Nạp THẬT artefact đã build (ESM node, phụ thuộc ngoài) rồi so bề mặt chạy được với bundle gốc.
    const built = (await import(OURS_ARTIFACT)) as Record<string, unknown>;
    expect(Object.keys(built).sort()).toEqual(Object.keys(await import(STOCK)).sort());
    expect(Object.keys(built).sort()).toEqual([...EXPORTS].sort());
    expect(typeof built.apply).toBe("function");
    expect(built.name).toBe("tool-workspace-dependencies");
  });

  test("gbh.provenance khớp stock (version + sha) và KHÔNG khai gbh.row", () => {
    const pkg = JSON.parse(readFileSync(join(OURS_DIR, "package.json"), "utf8")) as Record<string, unknown>;
    const stockPkg = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as Record<string, unknown>;
    const gbh = pkg.gbh as { provenance?: Record<string, string>; tests?: string[]; row?: unknown; nested?: unknown };
    const sha = createHash("sha256").update(readFileSync(STOCK)).digest("hex");
    expect(gbh.provenance).toEqual({
      stock: "@deepseek-ai/dsh-tool-workspace-dependencies",
      version: stockPkg.version as string,
      sha,
    });
    expect(stockPkg.name).toBe("@deepseek-ai/dsh-tool-workspace-dependencies");
    expect(stockPkg.version).toBe("0.2.1-alpha.4");
    expect("dsh" in stockPkg).toBe(false);
    expect(gbh.row).toBeUndefined();
    expect(gbh.nested).toBeUndefined();
    expect(gbh.tests).toEqual(["tests/host/tool-workspace-dependencies.test.ts"]);
    expect(pkg.main).toBe("lib/index.js");
    // 19/10/2026 (Lead duyệt (a)): parity TYPE với stock ⇒ exports["."] là OBJECT { types, default } như stock,
    // và có thêm ./package.json + ./types theo đúng manifest gốc.
    expect(pkg.exports).toEqual({
      ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" },
      "./package.json": "./package.json",
    });
    expect(existsSync(join(REPO, "packages", "host", "tool-workspace-dependencies", "lib", "types", "index.d.ts"))).toBe(true);
  });

  test("name · inject · String(Config) trùng từng ký tự; Config điền/kiểm y hệt", async () => {
    const theirs = await stock();
    expect(mine.name).toBe(theirs.name);
    expect(mine.name).toBe("tool-workspace-dependencies");
    expect(mine.inject).toEqual(theirs.inject);
    expect(mine.inject).toEqual(["tools"]);
    expect(String(mine.Config)).toBe(String(theirs.Config));
    expect(mine.Config({ source: "/opt/payload" })).toEqual(theirs.Config({ source: "/opt/payload" }));
    expect(mine.Config({ source: "/opt/payload", root: "/home/u/primary" })).toEqual(theirs.Config({ source: "/opt/payload", root: "/home/u/primary" }));
    for (const bad of [{}, { source: "" }, { source: 1 }, { source: "/a", root: "" }, { root: "/b" }, null]) {
      expect(await message(() => mine.Config(bad))).toBe(await message(() => theirs.Config(bad)));
      expect(await message(() => mine.Config(bad))).not.toBe("<no-error>");
    }
  });
});

describe("tool-workspace-dependencies — parsePrimaryRuntime / readPrimaryRuntime", () => {
  test("định dạng hiện tại: chuẩn hoá y hệt (có/không node · pnpm · payloadDigest)", async () => {
    const theirs = await stock();
    const digest = "a".repeat(64);
    const cases = [
      makeManifest(),
      makeManifest({ node: "22.14.0" }),
      makeManifest({ node: "22.14.0", pnpm: "10.9.0" }),
      makeManifest({ payloadDigest: digest }),
      makeManifest({ pythonPackages: {} }),
    ];
    for (const value of cases) expect(mine.parsePrimaryRuntime(value)).toEqual(theirs.parsePrimaryRuntime(value));
    expect(mine.parsePrimaryRuntime(makeManifest({ node: "22.14.0", pnpm: "10.9.0", payloadDigest: digest }))).toEqual({
      desktopVersion: "0.4.2",
      platform: process.platform,
      arch: process.arch,
      payloadDigest: digest,
      python: "3.12.4",
      node: "22.14.0",
      pnpm: "10.9.0",
      pythonPackages: { numpy: "2.1.3", pandas: "2.2.3" },
    });
  });

  test("legacy components: chuẩn hoá lên cấp cao nhất, bỏ components — y hệt", async () => {
    const theirs = await stock();
    const legacy = {
      desktopVersion: "0.2.0",
      platform: process.platform,
      arch: process.arch,
      components: { python: "3.11.9", numpy: "1.26.4", pandas: "2.2.2" },
      pythonPackages: { numpy: "1.26.4", pandas: "2.2.2" },
    };
    const result = mine.parsePrimaryRuntime(legacy);
    expect(result).toEqual(theirs.parsePrimaryRuntime(legacy));
    expect(result).toEqual({
      desktopVersion: "0.2.0",
      platform: process.platform,
      arch: process.arch,
      python: "3.11.9",
      pythonPackages: { numpy: "1.26.4", pandas: "2.2.2" },
    });
    expect("components" in result).toBe(false);
    expect(mine.parsePrimaryRuntime({ ...legacy, pythonPackages: undefined })).toEqual(theirs.parsePrimaryRuntime({ ...legacy, pythonPackages: undefined }));
  });

  test("ma trận đầu vào HỎNG: cùng thông điệp lỗi từng ca", async () => {
    const theirs = await stock();
    const digest = "a".repeat(64);
    const bad: unknown[] = [
      null,
      [],
      "payload",
      {},
      makeManifest({ desktopVersion: "" }),
      makeManifest({ platform: "freebsd" }),
      makeManifest({ arch: "ia32" }),
      makeManifest({ python: "3" }),
      makeManifest({ pnpm: "10.9.0" }),
      makeManifest({ node: "22.14.0", pnpm: "10" }),
      makeManifest({ payloadDigest: digest.toUpperCase() }),
      makeManifest({ pythonPackages: { numpy: 1 } }),
      makeManifest({ pythonPackages: { "bad name": "1.0.0" } }),
      makeManifest({ pythonPackages: { "foo-bar": "1.0.0", foo_bar: "1.0.0" } }),
      { ...makeManifest(), components: { python: "3.12.4", numpy: "2.1.3", pandas: "2.2.3" } },
      { ...makeManifest(), components: { python: "3.12.4" } },
      { desktopVersion: "0.2.0", platform: process.platform, arch: process.arch, components: { python: "3.12.4", numpy: "2.0.0", pandas: "2.2.3" }, pythonPackages: { numpy: "2.1.3" } },
    ];
    for (const value of bad) {
      const mineMessage = await message(() => mine.parsePrimaryRuntime(value));
      const theirsMessage = await message(() => theirs.parsePrimaryRuntime(value));
      expect(mineMessage).toBe(theirsMessage);
      expect(mineMessage).not.toBe("<no-error>");
    }
    const conflict = { desktopVersion: "0.2.0", platform: process.platform, arch: process.arch, components: { python: "3.12.4", numpy: "2.0.0", pandas: "2.2.3" }, pythonPackages: { numpy: "2.1.3" } };
    expect(await message(() => mine.parsePrimaryRuntime(conflict))).toBe(await message(() => theirs.parsePrimaryRuntime(conflict)));
    expect(await message(() => mine.parsePrimaryRuntime(conflict))).toContain("conflicting numpy distribution version");
  });

  test("readPrimaryRuntime: đọc runtime.json thật; thiếu tệp thì cùng lỗi ENOENT", async () => {
    const theirs = await stock();
    const payload = makePayload({ node: true });
    expect(await mine.readPrimaryRuntime(payload)).toEqual(await theirs.readPrimaryRuntime(payload));
    const empty = tempDir("empty-");
    const mineMessage = await message(() => mine.readPrimaryRuntime(empty));
    expect(mineMessage).toBe(await message(() => theirs.readPrimaryRuntime(empty)));
    expect(mineMessage).toContain("runtime.json");
    const broken = tempDir("broken-");
    writeFileSync(join(broken, "runtime.json"), "{not json");
    expect(await message(() => mine.readPrimaryRuntime(broken))).toBe(await message(() => theirs.readPrimaryRuntime(broken)));
  });
});

describe("tool-workspace-dependencies — đường dẫn + alias + sao chép", () => {
  test("workspaceDependencyPaths: win32/darwin/linux × có/không node · pnpm — y hệt", async () => {
    const theirs = await stock();
    const manifests = [
      makeManifest({ platform: "darwin" }),
      makeManifest({ platform: "darwin", node: "22.14.0" }),
      makeManifest({ platform: "darwin", node: "22.14.0", pnpm: "10.9.0" }),
      makeManifest({ platform: "linux", node: "22.14.0", pnpm: "10.9.0" }),
      makeManifest({ platform: "win32" }),
      makeManifest({ platform: "win32", node: "22.14.0", pnpm: "10.9.0" }),
    ];
    for (const manifest of manifests) expect(mine.workspaceDependencyPaths("/payload", manifest)).toEqual(theirs.workspaceDependencyPaths("/payload", manifest));
    expect(mine.workspaceDependencyPaths("/payload", makeManifest({ platform: "darwin", node: "22.14.0", pnpm: "10.9.0" }))).toEqual({
      python: "/payload/dependencies/python/bin/python3",
      node: "/payload/dependencies/node/bin/node",
      nodePackages: "/payload/dependencies/node/node_modules",
      pnpm: "/payload/dependencies/pnpm/bin/pnpm.mjs",
      pythonPackages: "/payload/dependencies/python/lib/python3.12/site-packages",
      pythonDistributions: { numpy: "2.1.3", pandas: "2.2.3" },
    });
    expect(mine.workspaceDependencyPaths("/payload", makeManifest({ platform: "win32" }))).toEqual({
      python: "/payload/dependencies/python/python.exe",
      pythonPackages: "/payload/dependencies/python/Lib/site-packages",
      pythonDistributions: { numpy: "2.1.3", pandas: "2.2.3" },
    });
  });

  test("primaryRuntimePythonAliases: alias hợp lệ giữ, alias hỏng cùng thông điệp lỗi", async () => {
    const theirs = await stock();
    const payload = makePayload({ aliases: true });
    const manifest = makeManifest();
    const mineAliases = await mine.primaryRuntimePythonAliases(payload, manifest);
    expect([...mineAliases.entries()].sort()).toEqual([...(await theirs.primaryRuntimePythonAliases(payload, manifest)).entries()].sort());
    expect([...mineAliases.entries()]).toEqual([
      ["dependencies/python/bin/python", "python3.12"],
      ["dependencies/python/bin/python3", "python3.12"],
    ]);
    const windows = await mine.primaryRuntimePythonAliases(payload, makeManifest({ platform: "win32" }));
    expect(windows.size).toBe(0);

    const broken = makePayload({ aliases: false });
    symlinkSync("python3.11", join(broken, "dependencies", "python", "bin", "python"));
    expect(await message(() => mine.primaryRuntimePythonAliases(broken, manifest))).toBe(await message(() => theirs.primaryRuntimePythonAliases(broken, manifest)));
    expect(await message(() => mine.primaryRuntimePythonAliases(broken, manifest))).toContain("primary runtime: invalid Python alias dependencies/python/bin/python");

    const missing = makePayload();
    rmSync(join(missing, "dependencies", "python", "bin", "python3"));
    expect((await mine.primaryRuntimePythonAliases(missing, manifest)).size).toBe(0);
  });

  test("copyPrimaryRuntime: chép đủ cây, giữ alias tương đối, vật chất hoá liên kết khác — y hệt", async () => {
    const theirs = await stock();
    const source = makePayload({ aliases: true, node: true });
    // Liên kết KHÔNG phải alias trình thông dịch: target tương đối theo thư mục của chính liên kết.
    symlinkSync(join("python", "bin", "python3.12"), join(source, "dependencies", "extra-link"));
    const mineDestination = join(tempDir("copy-mine-"), "payload");
    const theirsDestination = join(tempDir("copy-theirs-"), "payload");
    await mine.copyPrimaryRuntime(source, mineDestination, makeManifest({ node: "22.14.0" }));
    await theirs.copyPrimaryRuntime(source, theirsDestination, makeManifest({ node: "22.14.0" }));
    expect(readFileSync(join(mineDestination, "runtime.json"), "utf8")).toBe(readFileSync(join(theirsDestination, "runtime.json"), "utf8"));
    expect(readlinkSync(join(mineDestination, "dependencies", "python", "bin", "python"))).toBe("python3.12");
    expect(lstatSync(join(mineDestination, "dependencies", "extra-link")).isFile()).toBe(true);
    expect(readFileSync(join(mineDestination, "dependencies", "python", "bin", "python3.12"), "utf8")).toBe(readFileSync(join(theirsDestination, "dependencies", "python", "bin", "python3.12"), "utf8"));
    expect(readdirSync(join(mineDestination, "dependencies", "python", "bin")).sort()).toEqual(["python", "python3", "python3.12"]);
  });
});

describe("tool-workspace-dependencies — resolve / install", () => {
  test("resolvePrimaryRuntime: dùng tại chỗ, không chép, cùng kết quả", async () => {
    const theirs = await stock();
    const payload = makePayload({ node: true, pnpm: true, aliases: true });
    const before = readdirSync(payload).sort();
    expect(await mine.resolvePrimaryRuntime(payload)).toEqual(await theirs.resolvePrimaryRuntime(payload));
    expect(readdirSync(payload).sort()).toEqual(before);
    expect(await mine.resolvePrimaryRuntime(payload)).toEqual({
      python: join(payload, "dependencies", "python", "bin", "python3"),
      node: join(payload, "dependencies", "node", "bin", "node"),
      nodePackages: join(payload, "dependencies", "node", "node_modules"),
      pnpm: join(payload, "dependencies", "pnpm", "bin", "pnpm.mjs"),
      pythonPackages: join(payload, "dependencies", "python", "lib", "python3.12", "site-packages"),
      pythonDistributions: { numpy: "2.1.3", pandas: "2.2.3" },
    });
  });

  test("resolvePrimaryRuntime: thiếu điểm vào / sai nền tảng — cùng thông điệp lỗi", async () => {
    const theirs = await stock();
    const missing = makePayload();
    const sitePackages = join(missing, "dependencies", "python", "lib", "python3.12", "site-packages");
    rmSync(sitePackages, { recursive: true });
    writeFileSync(sitePackages, "not a directory");
    expect(await message(() => mine.resolvePrimaryRuntime(missing))).toBe(await message(() => theirs.resolvePrimaryRuntime(missing)));
    expect(await message(() => mine.resolvePrimaryRuntime(missing))).toContain("primary runtime: expected directory at");

    const gone = makePayload();
    rmSync(join(gone, "dependencies", "python", "bin", "python3"));
    expect(await message(() => mine.resolvePrimaryRuntime(gone))).toBe(await message(() => theirs.resolvePrimaryRuntime(gone)));

    const otherPlatform = process.platform === "linux" ? "darwin" : "linux";
    const incompatible = makePayload({ runtime: makeManifest({ platform: otherPlatform }) });
    expect(await message(() => mine.resolvePrimaryRuntime(incompatible))).toBe(await message(() => theirs.resolvePrimaryRuntime(incompatible)));
    expect(await message(() => mine.resolvePrimaryRuntime(incompatible))).toBe("primary runtime: incompatible platform or architecture");
  });

  test("installPrimaryRuntime: cài lần đầu rồi lần hai idempotent — cùng cây, cùng đường dẫn", async () => {
    const theirs = await stock();
    const source = makePayload({ aliases: true, node: true, pnpm: true });
    const rootMine = join(tempDir("install-mine-"), "primary");
    const rootTheirs = join(tempDir("install-theirs-"), "primary");
    const firstMine = normalize(await mine.installPrimaryRuntime(source, rootMine), rootMine);
    const firstTheirs = normalize(await theirs.installPrimaryRuntime(source, rootTheirs), rootTheirs);
    expect(firstMine).toEqual(firstTheirs);
    expect(existsSync(join(rootMine, "runtime.json"))).toBe(true);
    expect(readlinkSync(join(rootMine, "dependencies", "python", "bin", "python3"))).toBe("python3.12");
    expect(readdirSync(join(rootMine, "dependencies", "python", "bin")).sort()).toEqual(["python", "python3", "python3.12"]);
    expect(readdirSync(join(rootMine, "..")).filter((name) => name.startsWith(".primary-runtime-"))).toEqual([]);

    const secondMine = normalize(await mine.installPrimaryRuntime(source, rootMine), rootMine);
    const secondTheirs = normalize(await theirs.installPrimaryRuntime(source, rootTheirs), rootTheirs);
    expect(secondMine).toEqual(secondTheirs);
    expect(secondMine).toEqual(firstMine);
    expect(existsSync(rootMine + ".previous")).toBe(false);
    expect(readdirSync(join(rootMine, "..")).sort()).toEqual(["primary"]);
  });

  test("installPrimaryRuntime: đích là liên kết hệ thống tệp — cùng thông điệp lỗi", async () => {
    const theirs = await stock();
    const source = makePayload();
    const parent = tempDir("link-");
    const target = join(parent, "target");
    mkdirSync(target, { recursive: true });
    const root = join(parent, "primary");
    symlinkSync(target, root);
    const mineMessage = await message(() => mine.installPrimaryRuntime(source, root));
    expect(mineMessage).toBe(await message(() => theirs.installPrimaryRuntime(source, root)));
    expect(mineMessage).toBe("primary runtime: installation path is a filesystem link: " + root);
  });
});

describe("tool-workspace-dependencies — apply + tool definition", () => {
  test("apply: mô tả · schema · render · presentCall trùng nguyên văn", async () => {
    const theirs = await stock();
    const mineInstall = install(mine, { source: "/opt/payload" });
    const theirsInstall = install(theirs, { source: "/opt/payload" });
    expect(mineInstall.error).toBeUndefined();
    expect(theirsInstall.error).toBeUndefined();
    expect(mineInstall.effects.length).toBe(1);
    expect(theirsInstall.effects.length).toBe(1);
    const mineTool = mineInstall.tools[0];
    const theirsTool = theirsInstall.tools[0];
    expect(mineTool?.name).toBe(theirsTool?.name);
    expect(mineTool?.name).toBe("load_workspace_dependencies");
    expect(mineTool?.description).toBe(theirsTool?.description);
    expect(mineTool?.description.startsWith("Get absolute paths to bundled Python and library directories")).toBe(true);
    expect(mineTool?.parameters).toEqual(theirsTool?.parameters);
    expect(mineTool?.output.schema).toEqual(theirsTool?.output.schema);
    const value = { python: "/p/python", pythonPackages: "/p/site", pythonDistributions: { numpy: "2.1.3" } };
    expect(mineTool?.output.render({}, value)).toEqual(theirsTool?.output.render({}, value));
    expect(mineTool?.output.render({}, value)).toEqual([{ type: "text", text: JSON.stringify(value, void 0, 2) }]);
    expect(mineTool?.presentCall({})).toEqual(theirsTool?.presentCall({}));
    expect(mineTool?.presentCall({})).toEqual({ card: "generic", title: "Load workspace dependencies", kind: "read" });
  });

  test("apply: đường dẫn tương đối bị chặn với CÙNG thông điệp, không đăng ký tool", async () => {
    const theirs = await stock();
    for (const config of [{ source: "relative/payload" }, { source: "/opt/payload", root: "relative/root" }, { source: "/opt/payload", root: "/ok" }]) {
      const mineInstall = install(mine, config);
      const theirsInstall = install(theirs, config);
      expect(mineInstall.error).toBe(theirsInstall.error);
      if (config.root === "/ok") {
        expect(mineInstall.error).toBeUndefined();
        expect(mineInstall.tools.length).toBe(1);
      } else {
        expect(mineInstall.error).toBe("workspace dependencies: source and root must be absolute paths");
        expect(mineInstall.tools.length).toBe(0);
      }
    }
  });

  test("apply execute (không root): cùng kết quả, cache MỘT promise", async () => {
    const theirs = await stock();
    const payload = makePayload({ node: true, pnpm: true });
    const mineTool = install(mine, { source: payload }).tools[0];
    const theirsTool = install(theirs, { source: payload }).tools[0];
    if (mineTool === undefined || theirsTool === undefined) throw new Error("tool khong duoc dang ky");
    const mineFirst = mineTool.execute({});
    const theirsFirst = theirsTool.execute({});
    const mineValue = await mineFirst;
    expect(mineValue).toEqual(await theirsFirst);
    expect(mineValue.node).toBe(join(payload, "dependencies", "node", "bin", "node"));
    expect(mineValue.pythonDistributions).toEqual({ numpy: "2.1.3", pandas: "2.2.3" });
    // Cache `preparation`: xoá payload nguồn rồi gọi lần hai vẫn trả đúng kết quả đã chuẩn bị (cả hai bản).
    rmSync(payload, { recursive: true, force: true });
    expect(await mineTool.execute({})).toEqual(mineValue);
    expect(await theirsTool.execute({})).toEqual(await theirsFirst);
  });

  test("apply execute (có root): cài rồi trả đường dẫn trong root — chuẩn hoá y hệt", async () => {
    const theirs = await stock();
    const source = makePayload({ node: true });
    const rootMine = join(tempDir("apply-mine-"), "primary");
    const rootTheirs = join(tempDir("apply-theirs-"), "primary");
    const mineTool = install(mine, { source, root: rootMine }).tools[0];
    const theirsTool = install(theirs, { source, root: rootTheirs }).tools[0];
    if (mineTool === undefined || theirsTool === undefined) throw new Error("tool khong duoc dang ky");
    const mineValue = normalize(await mineTool.execute({}), rootMine);
    const theirsValue = normalize(await theirsTool.execute({}), rootTheirs);
    expect(mineValue).toEqual(theirsValue);
    expect((mineValue as { python: string }).python).toBe("<root>/dependencies/python/bin/python3");
    expect(existsSync(join(rootMine, "runtime.json"))).toBe(true);
  });

  test("apply execute: payload hỏng ⇒ cùng lỗi, và lần sau THỬ LẠI (cache bị xoá)", async () => {
    const theirs = await stock();
    const payload = makePayload();
    rmSync(join(payload, "dependencies", "python", "bin", "python3"));
    const mineTool = install(mine, { source: payload }).tools[0];
    const theirsTool = install(theirs, { source: payload }).tools[0];
    if (mineTool === undefined || theirsTool === undefined) throw new Error("tool khong duoc dang ky");
    const mineMessage = await message(() => mineTool.execute({}));
    expect(mineMessage).toBe(await message(() => theirsTool.execute({})));
    expect(mineMessage).toContain("ENOENT");
    writeFileSync(join(payload, "dependencies", "python", "bin", "python3"), "#!/bin/sh\n");
    expect(await mineTool.execute({})).toEqual(await theirsTool.execute({}));
  });

  test("locale: bản gốc KHÔNG có locale/ nên gói ta cũng KHÔNG có; mọi chuỗi hướng mô hình trùng", async () => {
    const theirs = await stock();
    expect(existsSync(join(STOCK_DIR, "locale"))).toBe(false);
    expect(existsSync(join(OURS_DIR, "locale"))).toBe(false);
    const mineTool = install(mine, { source: "/opt/payload" }).tools[0];
    const theirsTool = install(theirs, { source: "/opt/payload" }).tools[0];
    expect(mineTool?.description).toBe(theirsTool?.description);
    expect(JSON.stringify(mineTool?.output.schema)).toBe(JSON.stringify(theirsTool?.output.schema));
  });
});
