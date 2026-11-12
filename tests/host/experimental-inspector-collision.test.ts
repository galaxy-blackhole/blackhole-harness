/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test CHỐNG TRÙNG của row experimental-inspector: `inspector` là provider DUY NHẤT (mount lần hai bị
 *      cordis từ chối 'has been registered'), `dynamicCordisRunner`/`cordisInspect` của cordis-host-runner
 *      còn NGUYÊN sau mount, 0 event `inspector/*` trùng, và require.resolve 3 dependency từ profile THẬT
 *      (chưa mount ⇒ SKIP có lý do + ca dự phòng assert từ package repo).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  copyFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
} from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, isAbsolute, join, sep } from "node:path";
import { pathToFileURL } from "node:url";

import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "../../packages/host/experimental-inspector/src/ids.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "experimental-inspector");
/** Artefact host của ta (do build sinh ra). */
const OUR_ARTIFACT = join(PKG, "lib", "index.js");
/** Cordis THẬT mà package ta nạp (symlink về kernel). */
const CORDIS_ENTRY = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** node_modules của kernel — nguồn symlink peer. */
const KERNEL_MODULES = join(REPO, "apps", "host", "node_modules");
/** Kho node_modules của WORKSPACE (bun hoist `.bun/<pkg>@<v>` vào đây) — gốc hợp lệ thứ hai khi resolve. */
const WORKSPACE_MODULES = join(REPO, "node_modules");
/** Home của app. */
const HOME = process.env.HOME ?? homedir();
/** node_modules của profile THẬT đang chạy. */
const PROFILE_MODULES = join(HOME, ".galaxy", "blackhole", "profiles", "node_modules");
/** Package CỦA TA trong profile (chỉ có sau khi mount). */
const PROFILE_PACKAGE = join(PROFILE_MODULES, ...PACKAGE_NAME.split("/"));
/** Manifest của bản mount trong profile. */
const PROFILE_MANIFEST = join(PROFILE_PACKAGE, "package.json");
/** Gói ta đã được mount vào profile thật chưa. */
const PROFILE_MOUNTED = existsSync(PROFILE_MANIFEST);
/** Ba dependency runtime bắt buộc phải resolve được. */
const DEPENDENCIES = ["open", "serve-static", "ws"] as const;
/** Tên plugin Cordis của row (KHÔNG phải tên package). */
const PLUGIN_NAME = "experimental-inspector";
/** Cấu hình mount: TẮT capture fetch toàn cục, cổng 0 (ephemeral), dọn worker nhanh. */
const MOUNT_CONFIG = { captureFetch: false, port: 0, startupTimeoutMs: 8_000, stopTimeoutMs: 500 } as const;
/** Peer runtime khai trong gbh.peers — stage phải symlink đủ thì artefact mới mount được. */
const PEER_PACKAGES: readonly string[] =
  (JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
    readonly gbh?: { readonly peers?: readonly string[] };
  }).gbh?.peers ?? [];
/** Đủ artefact + cordis để dựng ca mount thật. */
const CAN_MOUNT = existsSync(OUR_ARTIFACT) && existsSync(CORDIS_ENTRY);

/** Một listener Cordis tối thiểu cần đếm. */
interface HookRow {
  /** Context sở hữu listener. */
  readonly ctx?: unknown;
}

/** Bảng hook nội bộ của Cordis (đọc để đếm event trùng). */
interface CordisEvents {
  /** Tên event → danh sách listener. */
  readonly _hooks: Record<string, readonly HookRow[] | undefined>;
}

/** Một runtime trong sổ Cordis. */
interface RuntimeEntry {
  /** Tên plugin/fiber. */
  readonly name?: string;
  /** Các fiber thuộc runtime. */
  readonly fibers?: readonly unknown[];
}

/** Fiber trả về từ ctx.plugin. */
interface FiberHandle {
  /** Chờ plugin apply xong (hoặc ném lỗi). */
  await(): Promise<void>;
  /** Dọn fiber. */
  dispose(): Promise<void>;
}

/** Context Cordis THẬT, khai tối thiểu phần test dùng. */
interface RealContext {
  /** Bảng event nội bộ. */
  readonly events: CordisEvents;
  /** Sổ runtime plugin. */
  readonly registry: Map<string, RuntimeEntry>;
  /** Fiber gốc. */
  readonly fiber: FiberHandle;
  /** Đọc service theo tên. */
  get(name: string): unknown;
  /** Đăng ký service theo tên. */
  provide(name: string, value: unknown): () => void;
  /** Mount một plugin. */
  plugin(plugin: unknown, config?: unknown): FiberHandle;
}

/** Bề mặt module host tối thiểu cần đo. */
interface PluginModule {
  /** Tên plugin Cordis. */
  readonly name?: string;
  /** Service phụ thuộc. */
  readonly inject?: readonly string[];
  /** Hàm apply. */
  readonly apply?: unknown;
  /** Schema cấu hình. */
  readonly Config?: unknown;
}

/** Service giả của cordis-host-runner: phải còn NGUYÊN identity sau mount inspector. */
const RUNNER_SENTINEL = { service: "dynamicCordisRunner", owner: "cordis-host-runner" };
/** Service giả của cordis-host-runner: phải còn NGUYÊN identity sau mount inspector. */
const INSPECT_SENTINEL = { service: "cordisInspect", owner: "cordis-host-runner" };

/** Context đã mount (undefined khi gói chưa build). */
let live: RealContext | undefined;
/** Module host của ta (undefined khi gói chưa build). */
let pluginModule: PluginModule | undefined;
/** Service inspector của lượt mount ĐẦU. */
let firstInspector: unknown;
/** Bản stage tạm của package ta trong lượt chạy này. */
let staged: StagedPackage | undefined;

/**
 * Đường dẫn hiển thị: tương đối khi nằm trong repo, tuyệt đối khi nằm ngoài (profile).
 * Nhận: path — đường dẫn tuyệt đối. Trả: chuỗi đọc được trong thông báo SKIP/lỗi.
 */
function displayPath(path: string): string {
  return path.startsWith(REPO + sep) ? path.slice(REPO.length + 1) : path;
}

/**
 * Ghi chú SKIP kèm đường dẫn thiếu — lý do phải ĐO ĐƯỢC.
 * Nhận: các đường dẫn bắt buộc. Trả: chuỗi rỗng khi đủ, hoặc " — SKIP: thiếu …".
 */
function missingNote(...paths: readonly string[]): string {
  const missing = paths.filter((path) => !existsSync(path)).map(displayPath);
  return missing.length === 0 ? "" : " — SKIP: thiếu " + missing.join(", ");
}

/**
 * Ghi chú SKIP khi package chưa mount vào profile THẬT.
 * Nhận: không. Trả: chuỗi rỗng khi đã mount, hoặc lý do kèm đường dẫn manifest.
 */
function profileSkipNote(): string {
  return PROFILE_MOUNTED ? "" : " — SKIP: chưa mount (thiếu " + displayPath(PROFILE_MANIFEST) + ")";
}

/**
 * Lấy context đã mount, ném lỗi rõ ràng nếu chưa có.
 * Nhận: không. Trả: Context Cordis THẬT đã mount inspector.
 */
function contextOrThrow(): RealContext {
  if (live === undefined) throw new Error("chưa mount experimental-inspector — " + missingNote(OUR_ARTIFACT, CORDIS_ENTRY));
  return live;
}

/**
 * Lấy module host đã nạp, ném lỗi rõ ràng nếu chưa có.
 * Nhận: không. Trả: module artefact host của ta.
 */
function pluginOrThrow(): PluginModule {
  if (pluginModule === undefined) throw new Error("chưa nạp " + displayPath(OUR_ARTIFACT));
  return pluginModule;
}

/**
 * Chạy một lượt và trả message thay vì ném.
 * Nhận: run — hàm cần chạy. Trả: message lỗi, hoặc "KHÔNG NÉM".
 */
async function rejectionOf(run: () => PromiseLike<unknown>): Promise<string> {
  try {
    await run();
    return "KHÔNG NÉM";
  } catch (error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}

/**
 * Đếm số lần một regexp (global) khớp.
 * Nhận: text — chuỗi nguồn; pattern — regexp có cờ g. Trả: số lần khớp.
 */
function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

/**
 * Gom các tên event đăng ký dưới tiền tố inspector/.
 * Nhận: text — mã nguồn một mặt. Trả: danh sách tên event (có thể lặp).
 */
function inspectorEventNames(text: string): string[] {
  const names: string[] = [];
  for (const match of text.matchAll(/\bon\s*\(\s*["'](inspector\/[^"']+)["']/g)) {
    const name = match[1];
    if (name !== undefined) names.push(name);
  }
  return names;
}

/**
 * Tìm tên bị đăng ký nhiều hơn một lần.
 * Nhận: names — danh sách tên (có thể lặp). Trả: mô tả "tên×số lần" cho các tên trùng.
 */
function duplicateNames(names: readonly string[]): string[] {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([name, count]) => name + "×" + String(count));
}

/**
 * Assert một dependency resolve được về file thật.
 * Nhận: name — tên gói; resolved — kết quả require.resolve; roots — thư mục node_modules hợp lệ.
 * Trả: không (ném assertion khi sai).
 */
function assertResolvable(name: string, resolved: string, roots: readonly string[]): void {
  if (!isAbsolute(resolved)) {
    // Bun coi "ws" là builtin ⇒ resolve("ws") trả về CHÍNH tên gói. Ca package.json bên dưới
    // mới là bằng chứng file thật; ở đây chỉ chấp nhận đúng giá trị bare đó.
    expect(resolved).toBe(name);
    return;
  }
  expect(existsSync(resolved)).toBe(true);
  const real = realpathSync(resolved);
  // LƯỢT ĐO 01/11/2026: bun cài dependency của workspace vào KHO CHUNG `<repo>/node_modules/.bun/<pkg>@<v>`
  // (không nằm dưới `apps/host/node_modules`) ⇒ phép kiểm nhận MỌI gốc node_modules THẬT của repo
  // (kernel hoặc kho workspace); điều phải chứng minh là resolve ra TỆP THẬT đúng tên gói, không phải stub.
  const inside = roots.some((root) => real.startsWith(realpathSync(root) + sep));
  expect(inside).toBe(true);
}

/**
 * Bản stage tạm của package: package.json + lib/ + node_modules giả.
 * Nhận: không. Trả: thư mục stage, artefact staged, và hàm dọn.
 */
interface StagedPackage {
  /** Gốc stage (chứa pkg/ + node_modules/). */
  readonly root: string;
  /** Artefact lib/index.js đã stage. */
  readonly artifact: string;
  /** Gỡ mọi symlink rồi xoá cây stage. */
  close(): void;
}

/**
 * Stage package.json + lib/ vào thư mục tạm và dựng node_modules giả: symlink peer về node_modules
 * của gói ta, alias CẢ tên stock lẫn tên ta về package staged. Alias stock là BẮT BUỘC vì mặt host
 * byte-identical stock còn giữ `import.meta.resolve("@deepseek-ai/…/package.json")` để tìm devtools.
 * Nhận: không. Trả: bản stage kèm hàm dọn.
 */
function stagePackage(): StagedPackage {
  const root = mkdtempSync(join(tmpdir(), "gbh-inspector-collision-"));
  const pkgDir = join(root, "pkg");
  mkdirSync(join(pkgDir, "lib"), { recursive: true });
  copyFileSync(join(PKG, "package.json"), join(pkgDir, "package.json"));
  cpSync(join(PKG, "lib"), join(pkgDir, "lib"), { recursive: true });
  const modules = join(root, "node_modules");
  const links: string[] = [];
  for (const peer of PEER_PACKAGES) {
    const link = join(modules, peer);
    if (existsSync(link)) continue;
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(join(PKG, "node_modules", peer), link, "dir");
    links.push(link);
  }
  for (const name of [STOCK_PACKAGE_NAME, PACKAGE_NAME]) {
    const link = join(modules, name);
    if (existsSync(link)) continue;
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(pkgDir, link, "dir");
    links.push(link);
  }
  return {
    root,
    artifact: join(pkgDir, "lib", "index.js"),
    close: (): void => {
      for (const link of links) {
        try {
          unlinkSync(link);
        } catch {
          // Symlink đã biến mất hoặc chưa được tạo — không sao.
        }
      }
      rmSync(root, { recursive: true, force: true });
    },
  };
}

beforeAll(async () => {
  if (!CAN_MOUNT) return;
  staged = stagePackage();
  const cordis = (await import(CORDIS_ENTRY)) as unknown as { Context: new () => RealContext };
  const module = (await import(pathToFileURL(staged.artifact).href)) as unknown as PluginModule;
  pluginModule = module;
  const ctx = new cordis.Context();
  ctx.provide("logger", {
    warn: (): void => {},
    info: (): void => {},
    error: (): void => {},
  });
  ctx.provide("connection", {
    fetch: { register: (): (() => void) => () => {} },
    authorizeIndex: (): boolean => true,
    requestRejection: (): number | undefined => undefined,
  });
  ctx.provide("webServer", {
    register: (): (() => void) => () => {},
    registerUpgrade: (): (() => void) => () => {},
  });
  // Hai service giả mang ĐÚNG tên của cordis-host-runner, đặt TRƯỚC khi mount inspector.
  ctx.provide("dynamicCordisRunner", RUNNER_SENTINEL);
  ctx.provide("cordisInspect", INSPECT_SENTINEL);
  live = ctx;
  await ctx.plugin(module, MOUNT_CONFIG).await();
  firstInspector = ctx.get("inspector");
}, 30_000);

afterAll(async () => {
  if (live !== undefined) {
    try {
      await live.fiber.dispose();
    } catch {
      // Fiber đã đóng ở ca trước — dọn lần hai vô hại.
    }
  }
  staged?.close();
  staged = undefined;
}, 30_000);

describe("experimental-inspector — chống trùng service inspector", () => {
  test.skipIf(!CAN_MOUNT)(
    "inspector chỉ 1 provider: mount lần hai → cordis ném 'has been registered'" + missingNote(OUR_ARTIFACT, CORDIS_ENTRY),
    async () => {
      const ctx = contextOrThrow();
      const plugin = pluginOrThrow();
      expect(plugin.name).toBe(PLUGIN_NAME);
      expect(firstInspector).toBeDefined();
      expect(ctx.get("inspector")).toBe(firstInspector);
      const before = [...ctx.registry.values()].filter((runtime) => runtime.name === PLUGIN_NAME);
      expect(before.length).toBe(1);
      const message = await rejectionOf(() => ctx.plugin(plugin, MOUNT_CONFIG).await());
      expect(message).toContain('service "inspector" has been registered');
      expect(message).toContain("<" + PLUGIN_NAME + ">");
      // Provider cũ vẫn là nơi DUY NHẤT giữ service; lượt mount hỏng đã rollback.
      expect(ctx.get("inspector")).toBe(firstInspector);
      const after = [...ctx.registry.values()].filter((runtime) => runtime.name === PLUGIN_NAME);
      expect(after.length).toBe(1);
    },
    30_000,
  );

  test.skipIf(!CAN_MOUNT)(
    "dynamicCordisRunner/cordisInspect của cordis-host-runner còn NGUYÊN sau mount" + missingNote(OUR_ARTIFACT, CORDIS_ENTRY),
    () => {
      const ctx = contextOrThrow();
      expect(ctx.get("dynamicCordisRunner")).toBe(RUNNER_SENTINEL);
      expect(ctx.get("cordisInspect")).toBe(INSPECT_SENTINEL);
      expect(ctx.get("dynamicCordisRunner")).not.toBe(firstInspector);
      expect(ctx.get("cordisInspect")).not.toBe(firstInspector);
      // Bằng chứng tĩnh trên artefact: CHỈ một provide("inspector"), KHÔNG provide 2 tên kia.
      const text = readFileSync(OUR_ARTIFACT, "utf8");
      expect(countMatches(text, /provide\s*\(\s*["']inspector["']/g)).toBe(1);
      expect(countMatches(text, /provide\s*\(\s*["'](?:dynamicCordisRunner|cordisInspect)["']/g)).toBe(0);
    },
  );

  test.skipIf(!CAN_MOUNT)(
    "0 event inspector/* trùng + mount lần hai không để lại listener" + missingNote(OUR_ARTIFACT, CORDIS_ENTRY),
    () => {
      const ctx = contextOrThrow();
      const hooks = ctx.events._hooks;
      const duplicates = Object.entries(hooks)
        .filter(([name, rows]) => name.startsWith("inspector/") && (rows?.length ?? 0) > 1)
        .map(([name, rows]) => name + "×" + String(rows?.length ?? 0));
      expect(duplicates).toEqual([]);
      const inspectorHooks = Object.keys(hooks).filter((name) => name.startsWith("inspector/"));
      expect(inspectorHooks).toEqual([]);
      // Lượt mount ĐẦU đăng ký đúng MỘT listener index-inject; lượt hai đã rollback.
      expect((hooks["webserver/index-inject"] ?? []).length).toBe(1);
      // Quét cả hai mặt: không có 2 lời đăng ký cùng một event inspector/*.
      for (const path of [OUR_ARTIFACT, join(PKG, "lib", "client.js")]) {
        if (!existsSync(path)) continue;
        expect(duplicateNames(inspectorEventNames(readFileSync(path, "utf8")))).toEqual([]);
      }
    },
  );
});

describe("experimental-inspector — dependency runtime từ package repo", () => {
  test("package.json khai đủ open/serve-static/ws + createRequire của gói ta resolve CẢ BA", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      readonly dependencies?: Readonly<Record<string, string>>;
      readonly peerDependencies?: Readonly<Record<string, string>>;
    };
    const declared: Record<string, string> = { ...manifest.dependencies, ...manifest.peerDependencies };
    // Anchor đúng vị trí module runtime của gói ta; file chưa build vẫn resolve được node_modules.
    const requireFromRepo = createRequire(join(PKG, "lib", "index.js"));
    for (const dependency of DEPENDENCIES) {
      expect(declared[dependency]).toBeDefined();
      expect(existsSync(join(PKG, "node_modules", dependency))).toBe(true);
      const resolved = requireFromRepo.resolve(dependency);
      assertResolvable(dependency, resolved, [KERNEL_MODULES, WORKSPACE_MODULES]);
      // Bun trả bare "ws" cho resolve("ws"); resolve package.json mới chứng minh file thật.
      const manifestPath = requireFromRepo.resolve(dependency + "/package.json");
      expect(isAbsolute(manifestPath)).toBe(true);
      expect(existsSync(manifestPath)).toBe(true);
      const pkg = JSON.parse(readFileSync(manifestPath, "utf8")) as { readonly name?: string };
      expect(pkg.name).toBe(dependency);
      const realManifest = realpathSync(manifestPath);
      const roots = [KERNEL_MODULES, WORKSPACE_MODULES].map((root) => realpathSync(root) + sep);
      expect(roots.some((root) => realManifest.startsWith(root))).toBe(true);
    }
  });
});

describe("experimental-inspector — dependency runtime từ PROFILE THẬT", () => {
  test.skipIf(!PROFILE_MOUNTED)(
    "require.resolve open/serve-static/ws TỪ PROFILE THẬT (~/.galaxy/blackhole/profiles)" + profileSkipNote(),
    () => {
      const requireFromProfile = createRequire(join(PROFILE_PACKAGE, "lib", "index.js"));
      const manifest = JSON.parse(readFileSync(PROFILE_MANIFEST, "utf8")) as {
        readonly dependencies?: Readonly<Record<string, string>>;
        readonly peerDependencies?: Readonly<Record<string, string>>;
      };
      const declared: Record<string, string> = { ...manifest.dependencies, ...manifest.peerDependencies };
      for (const dependency of DEPENDENCIES) {
        expect(declared[dependency]).toBeDefined();
        // Mount tầng profile tạo symlink peer ở profile/node_modules → kernel (ADR 0004).
        const link = join(PROFILE_MODULES, dependency);
        expect(existsSync(link)).toBe(true);
        expect(realpathSync(link)).toBe(realpathSync(join(KERNEL_MODULES, dependency)));
        const resolved = requireFromProfile.resolve(dependency);
        assertResolvable(dependency, resolved, [KERNEL_MODULES, PROFILE_MODULES]);
        const manifestPath = requireFromProfile.resolve(dependency + "/package.json");
        expect(isAbsolute(manifestPath)).toBe(true);
        expect(existsSync(manifestPath)).toBe(true);
        const pkg = JSON.parse(readFileSync(manifestPath, "utf8")) as { readonly name?: string };
        expect(pkg.name).toBe(dependency);
        expect(realpathSync(manifestPath).startsWith(realpathSync(KERNEL_MODULES) + sep)).toBe(true);
      }
    },
  );
});
