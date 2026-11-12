/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 11/11/2026
 * desc Test cho @galaxy-blackhole/gbh-config-editor: đo trên ARTIFACT, đối chứng TRỰC TIẾP với chính bundle gốc
 *      (tập export · bề mặt lớp · bộ lọc `entries()` · `configuration()` trên profile THẬT · ba đường lỗi +
 *      nhánh HMR của `edit()` · C6 danh tính), phép sửa tệp patch của profile, quy ước
 *      `gbh.peers ⊆ peerDependencies` kèm ĐỐI CHỨNG ÂM, và TEST CANH chống khai `gbh.row` sớm.
 *   11/11/2026 — thêm ca "có hmr.applyPatches ⇒ lượt ghi đi qua SEAM, không chết ở WeakMap của kernel"
 *      (sự cố thật: mọi `settings/mutate` bị `settings/rejected: dsh: profile reload requires the root
 *      Include entry` ⇒ công tắc trong Cài đặt không lưu được).
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { renderRewriteBlock } from "../../apps/cli/src/rewrite-metadata.ts";
import { buildPackage } from "../../packages/host/config-editor/build.ts";
import {
  parsePatchDocument,
  patchListOf,
  restoreJsExpressions,
  writeConfigRow,
} from "../../packages/host/config-editor/src/patch.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "config-editor");
/** Gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-config-editor");
/** Bundle GỐC đã build. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis mà CHÍNH package ta nạp (symlink tới kernel) — cùng một tệp thật với bản gốc. */
const CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer lúc nạp. */
// ⚠️ 18/10/2026 (task-28) — đặt dưới `lib/` (thư mục ĐÃ được mọi cổng lint miễn trừ, xem EXEMPT_DIRS).
//   Trước đây là `<pkg>/.test-lib`: nếu một lượt chạy test SONG SONG với `gate` thì cổng `header` quét
//   trúng artifact chưa có header 5 dòng ⇒ gate ĐỎ OAN (đo được 22:5x). Dưới `lib/` thì artifact vẫn
//   cạnh package (phân giải peer y nguyên) nhưng không bao giờ lọt vào phép quét nguồn.
const OUT = join(PKG, "lib", ".test-build");
/** Cây cài THẬT của kernel — nguồn peer mà artifact phải phân giải (pattern tests/host/shell.test.ts). */
const KERNEL_AI = join(REPO, "apps", "host", "node_modules", "@deepseek-ai");
/** Artifact của ta (dựng trong `beforeAll`). */
const ARTIFACT = join(OUT, "index.js");

/** Hạn chờ tối đa của một phép chờ có trần (ms) — KHÔNG dùng `setTimeout(0)` làm phép đồng bộ. */
const WAIT_MS = 5000;

/** Một fiber giả: đúng ba thứ mà `edit()` chạm tới. */
interface FakeFiber {
  /** Trạng thái vòng đời (2 = ACTIVE). */
  state: number;
  /** Runtime plugin (chỉ cần khác `undefined`). */
  runtime: unknown;
  /** Context của fiber — nơi chạy waterfall `internal/config`. */
  ctx: { waterfall(...args: unknown[]): unknown };
}

/** Một entry Loader giả: đúng hình dạng mà `entries()`/`edit()` đọc. */
interface FakeEntry {
  /** Options của entry (id, specifier, config thô). */
  options: { id: string; name: string; config?: Record<string, unknown> };
  /** Nhóm cha — `parent.tree.ctx.fiber.entry.id` quyết định entry có thuộc Include gốc không. */
  parent: { tree: { ctx: { fiber: { entry?: { id?: string } } } } };
  /** Fiber của entry, khi entry đã activate. */
  fiber?: FakeFiber;
}

/** Dịch vụ nhìn qua góc hẹp — đủ để so hai bản mà không cần kiểu nội bộ của kernel. */
interface EditorLike {
  /** Tên dịch vụ đã đăng ký. */
  readonly name: string;
  /** Tệp patch của profile. */
  readonly documentPath: string;
  /** Các row cấu hình địa chỉ được. */
  entries(): FakeEntry[];
  /** Giá trị thừa kế + ghi đè của từng row. */
  configuration(): Array<{ entry: FakeEntry; inherited: Record<string, unknown>; override: Record<string, unknown> }>;
  /** Ghi cấu hình kế tiếp của một plugin. */
  edit(
    entry: FakeEntry,
    change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>,
  ): Promise<void>;
}

/** Hình dạng LỚP dịch vụ: khởi tạo, seam tĩnh, và prototype để đo bề mặt. */
interface EditorCtor {
  /** Đăng ký dịch vụ trong context. */
  new (ctx: FakeContext): EditorLike;
  /** Các seam phải sẵn sàng trước khi dịch vụ được dùng. */
  inject: string[];
  /** Prototype của lớp — nơi đo tên + độ dài tham số. */
  prototype: { edit(entry: FakeEntry, change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>): Promise<void> };
}

/** Hình dạng module của cả hai bản: đúng hai export runtime. */
interface EditorModule {
  /** Lớp dịch vụ. */
  ConfigEditor: EditorCtor;
  /** Chính lớp đó, ở dạng default. */
  default: EditorCtor;
}

/** Context cordis nhìn qua góc hẹp. */
interface FakeContext {
  /** Cấp một dịch vụ cho context này. */
  provide(name: string, value: unknown): void;
  /** Đọc lại dịch vụ đã cấp. */
  get(name: string): unknown;
}

/** Seam HMR giả: đếm lượt và đánh dấu đã settle. */
interface FakeHmr {
  /** Số lượt `runExclusive` đã được gọi. */
  calls: number;
  /** `true` khi lượt chạy bên trong đã kết thúc (kể cả khi ném). */
  settled: boolean;
  /** Chạy `run` và ghi lại lượt. */
  runExclusive<T>(run: () => Promise<T>): Promise<T>;
  /** Bề mặt áp patch SỐNG (tuỳ chọn — chỉ ca 11/11/2026 cấp). */
  applyPatches?(patches: readonly unknown[], requiredIds?: readonly string[]): Promise<{ warnings: readonly string[] } | undefined>;
}

/** Manifest nhìn qua góc hẹp — chỉ ba trường mà phép kiểm peer/row đọc. */
interface Manifest {
  /** Tên package. */
  name: string;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc cứng (KHÔNG được chứa peer). */
  dependencies?: Record<string, string>;
  /** Metadata của repo: `peers` (và `row` nếu đã khai). */
  gbh?: { peers?: string[]; row?: unknown };
}

/** Bundle gốc nạp động — hai export đúng như kernel cấp. */
const stockMod = (await import(STOCK)) as unknown as EditorModule;
/** Context cordis THẬT, dùng chung cho cả hai bản. */
const { Context } = (await import(CORDIS)) as unknown as { Context: new () => FakeContext };
/** Module của TA đã build (điền trong `beforeAll`). */
let ourMod: EditorModule;

/** Thư mục profile tạm dựng trong `beforeAll` (dọn trong `afterAll`). */
const tempDirs: string[] = [];

/**
 * Chờ có TRẦN tới khi một điều kiện thành thật.
 * @param condition - điều kiện cần đợi.
 * @param label - nhãn để báo lỗi.
 * @param timeoutMs - trần thời gian (mặc định {@link WAIT_MS}).
 * @returns không; ném khi quá trần (test đỏ với lý do rõ, không treo).
 */
async function waitFor(condition: () => boolean, label: string, timeoutMs: number = WAIT_MS): Promise<void> {
  const started = Date.now();
  while (!condition()) {
    if (Date.now() - started > timeoutMs) throw new Error("quá hạn chờ: " + label);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
}

/**
 * Chạy một lượt gọi và trả mô tả lỗi thay vì ném — để so hai bên mà không làm đỏ test giữa đường.
 * @param run - hàm cần chạy.
 * @returns chuỗi `{name, message}` hoặc `(khong nem)`.
 */
async function errorOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(khong nem)";
  } catch (error) {
    const subject = error as { name?: string; message?: string };
    return JSON.stringify({ name: subject.name, message: subject.message });
  }
}

/**
 * Tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng).
 * @param text - nội dung file đã build.
 * @returns danh sách tên export đã sắp xếp.
 */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/**
 * Dựng một entry Loader giả.
 * @param id - id row.
 * @param ownerId - id của entry sở hữu cây (mặc định `include`).
 * @returns entry đúng hình dạng mà dịch vụ đọc.
 */
function makeEntry(id: string, ownerId = "include"): FakeEntry {
  return { options: { id, name: "@deepseek-ai/dsh-" + id }, parent: { tree: { ctx: { fiber: { entry: { id: ownerId } } } } } };
}

/**
 * Dựng một rig: context thật + loader giả + profileContext trỏ vào profile tạm + seam HMR giả.
 * @param mod - module (bản của ta hoặc bản gốc).
 * @param rows - danh sách entry mà loader giả trả về.
 * @param dir - thư mục profile.
 * @returns context, dịch vụ và seam HMR của rig.
 */
function rig(mod: EditorModule, rows: FakeEntry[], dir: string, extra?: Pick<FakeHmr, "applyPatches">): { ctx: FakeContext; editor: EditorLike; hmr: FakeHmr } {
  const ctx = new Context();
  ctx.provide("loader", {
    *entries(): Generator<FakeEntry> {
      yield* rows;
    },
  });
  ctx.provide("profileContext", {
    name: "lab",
    dir,
    patchPath: join(dir, "cordis.patch.yml"),
    installAnchor: join(REPO, "apps", "host", "package.json"),
    home: dir,
    cwd: dir,
    startedBundles: [],
    overlays: [],
    telemetryDisabledEnv: undefined,
  });
  const hmr: FakeHmr = {
    calls: 0,
    settled: false,
    async runExclusive<T>(run: () => Promise<T>): Promise<T> {
      hmr.calls += 1;
      try {
        return await run();
      } finally {
        hmr.settled = true;
      }
    },
    ...(extra?.applyPatches === undefined ? {} : { applyPatches: extra.applyPatches }),
  };
  ctx.provide("hmr", hmr);
  return { ctx, editor: new mod.ConfigEditor(ctx), hmr };
}

/**
 * Tạo một thư mục profile tạm mang ĐÚNG danh sách bundle của profile thật.
 * @param layer - nội dung `cordis.patch.yml` của lớp người dùng.
 * @returns đường dẫn thư mục (đã ghi vào {@link tempDirs}).
 */
async function makeProfile(layer: string): Promise<string> {
  const repoProfile = JSON.parse(readFileSync(join(REPO, "profiles", "blackhole", "package.json"), "utf8")) as {
    dsh: { profile: { bundles: string[] } };
  };
  const dir = await mkdtemp(join(tmpdir(), "gbh-config-editor-"));
  tempDirs.push(dir);
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({ name: "gbh-config-editor-lab", private: true, dsh: { profile: { bundles: repoProfile.dsh.profile.bundles } } }, null, 2),
  );
  await writeFile(join(dir, "cordis.patch.yml"), layer);
  return dir;
}

/** Nội dung tệp patch dùng cho các ca sửa tài liệu. */
const PATCH_TEXT = [
  "- id: alpha",
  "  name: '@deepseek-ai/dsh-alpha'",
  "  config:",
  "    mode: strict",
  "- id: beta",
  "  name: '@deepseek-ai/dsh-beta'",
  "- id: gamma",
  "  name: '@deepseek-ai/dsh-gamma'",
  "  config:",
  "    expr: !!js ctx.get('profileContext')?.name",
  "- id: delta",
  "  name: '@deepseek-ai/dsh-delta'",
  "  disabled: true",
  "  config:",
  "    keep: 1",
  "",
].join("\n");

/** Thư mục profile GIÀU (12 lớp bundle thật) dùng cho các ca A/B. */
let richDir = "";
/** Thư mục profile RỖNG (không lớp bundle) dùng cho ca `edit()`. */
let thinDir = "";

beforeAll(async () => {
  await buildPackage(OUT);
  // Artifact import bare specifier ⇒ phân giải peer TỪ THƯ MỤC CỦA NÓ. Trỏ `@deepseek-ai` sang cây kernel để
  // artifact nạp ĐÚNG cordis của kernel như lúc chạy thật: hai cây cài để hai tệp riêng (nội dung y hệt) nên
  // thiếu bước này hai lớp `ConfigEditor` cùng mã vẫn có hai lớp cha `Service` KHÁC NHAU về danh tính.
  mkdirSync(join(OUT, "node_modules"), { recursive: true });
  symlinkSync(KERNEL_AI, join(OUT, "node_modules", "@deepseek-ai"), "dir");
  // P2 (03/11/2026): goi cua ta nhap @galaxy-blackhole/gbh-* nen thu muc tam cung phai thay scope do,
  // neu khong test se bao "Cannot find module" hoac nap HAI the hien kernel.
  symlinkSync(join(KERNEL_AI, "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");
  ourMod = (await import(ARTIFACT)) as unknown as EditorModule;
  richDir = await makeProfile(
    ["- id: settings", "  config:", "    labOnly: true", "- id: deepseek-account", "  config:", "    desktopPlatform: !!js ctx.get('profileContext')?.name", ""].join("\n"),
  );
  thinDir = await makeProfile("- id: alpha\n  name: '@deepseek-ai/dsh-alpha'\n  config:\n    mode: strict\n");
});

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
  for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
});

describe("row config-editor — ba phép BƯỚC 0 đo lại trên đĩa", () => {
  test("gói gốc KHÔNG có nửa client: không `dsh.client`, không `lib/client.js`, `lib/index.js` > 0 dòng", () => {
    const manifest = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as { dsh?: { client?: unknown } };
    expect(manifest.dsh?.client).toBe(undefined);
    expect(existsSync(join(STOCK_DIR, "lib", "client.js"))).toBe(false);
    const lines = readFileSync(STOCK, "utf8").split("\n").length;
    expect(lines).toBeGreaterThan(0);
    expect(lines).toBe(139);
  });
});

describe("row config-editor — ARTIFACT: tập export = gốc, bề mặt lớp = gốc", () => {
  test("tập export đo trên ARTIFACT bằng gốc (0 thiếu · 0 thừa) và không có id stock nào", () => {
    const ours = exportNames(readFileSync(ARTIFACT, "utf8"));
    const theirs = exportNames(readFileSync(STOCK, "utf8"));
    expect(ours).toEqual(theirs);
    expect(ours).toEqual(["ConfigEditor", "default"]);
    expect(Object.keys(ourMod).sort()).toEqual(Object.keys(stockMod).sort());
    expect(readFileSync(ARTIFACT, "utf8").match(/id: @deepseek-ai/g)?.length ?? 0).toBe(0);
  });

  test("bề mặt lớp: prototype · static inject · cùng MỘT lớp cha Service của kernel", () => {
    expect(Object.getOwnPropertyNames(ourMod.ConfigEditor.prototype)).toEqual(
      Object.getOwnPropertyNames(stockMod.ConfigEditor.prototype),
    );
    expect(ourMod.ConfigEditor.inject).toEqual(stockMod.ConfigEditor.inject);
    expect(ourMod.ConfigEditor.inject).toEqual(["loader", "profileContext"]);
    expect(Object.getPrototypeOf(ourMod.ConfigEditor)).toBe(Object.getPrototypeOf(stockMod.ConfigEditor));
    expect(ourMod.default).toBe(ourMod.ConfigEditor);
  });

  test("hợp đồng liên gói: tên dịch vụ `configEditor` + `edit(entry, change)` đúng hai tham số", () => {
    const rigged = rig(ourMod, [], richDir);
    expect(rigged.editor.name).toBe("configEditor");
    expect(ourMod.ConfigEditor.prototype.edit.length).toBe(2);
    expect(rigged.editor.documentPath).toBe(join(richDir, "cordis.patch.yml"));
  });
});

describe("row config-editor — A/B với chính bundle gốc trên cùng một rig", () => {
  test("`entries()`: chỉ row thuộc Include gốc và id DUY NHẤT", () => {
    const rows = [
      makeEntry("alpha"),
      makeEntry("beta"),
      makeEntry("dup"),
      makeEntry("dup"),
      makeEntry("nested", "some-other-group"),
    ];
    const mine = rig(ourMod, rows, thinDir).editor.entries();
    const theirs = rig(stockMod, rows, thinDir).editor.entries();
    expect(mine).toEqual(theirs);
    expect(mine.map((row) => row.options.id)).toEqual(["alpha", "beta"]);
  });

  test("`configuration()` trên profile THẬT 12 lớp bundle + lớp người dùng: thừa kế + ghi đè khớp từng bước", () => {
    const rows = ["config-editor", "settings", "deepseek-account", "timer", "hmr"].map((id) => makeEntry(id));
    const mine = rig(ourMod, rows, richDir).editor.configuration();
    const theirs = rig(stockMod, rows, richDir).editor.configuration();
    const pick = (list: ReturnType<EditorLike["configuration"]>): unknown =>
      list.map((row) => ({ id: row.entry.options.id, inherited: row.inherited, override: row.override }));
    expect(pick(mine)).toEqual(pick(theirs));
    // `deepseek-account` có config ghi đè ⇒ đi qua nhánh `inherited()`; `hmr` chỉ có lớp bundle ⇒ đi qua nhánh soạn lớp.
    expect(mine[2]?.inherited).toEqual({
      desktopPlatform: {
        __jsExpr: "ctx.get('profileContext')?.name === 'desktop' && ['darwin', 'win32'].includes(process.platform) ? process.platform : null",
      },
    });
    expect(mine[1]?.override).toEqual({ labOnly: true });
    expect(mine[4]?.inherited).toEqual({ root: [] });
  });

  test("`edit()` — ba đường lỗi + nhánh HMR khớp nguyên văn, và tệp patch KHÔNG bị chạm", async () => {
    const before = await readFile(join(thinDir, "cordis.patch.yml"), "utf8");
    const stranger = makeEntry("zzz");
    const bare = makeEntry("alpha");
    const active: FakeEntry = {
      ...makeEntry("alpha"),
      fiber: { state: 2, runtime: null, ctx: { waterfall: () => ({}) } },
    };
    const cases: Array<{ rows: FakeEntry[]; target: FakeEntry; message: string }> = [
      { rows: [bare], target: stranger, message: "Configuration entry is no longer available" },
      { rows: [bare], target: bare, message: "Configuration entry is no longer available" },
      { rows: [active], target: active, message: "profile reload requires the root Include entry" },
    ];
    for (const item of cases) {
      const mine = rig(ourMod, item.rows, thinDir);
      const theirs = rig(stockMod, item.rows, thinDir);
      const mineError = await errorOf(() => mine.editor.edit(item.target, () => ({ mode: "next" })));
      const theirsError = await errorOf(() => theirs.editor.edit(item.target, () => ({ mode: "next" })));
      expect(mineError).toBe(theirsError);
      expect(mineError).toContain(item.message);
      expect(mine.hmr.calls).toBe(1);
    }
    expect(await readFile(join(thinDir, "cordis.patch.yml"), "utf8")).toBe(before);
  });

  test("nhánh HMR: `runExclusive` được gọi ĐÚNG MỘT lần ở cả hai bản (chờ có TRẦN)", async () => {
    const active: FakeEntry = { ...makeEntry("alpha"), fiber: { state: 2, runtime: null, ctx: { waterfall: () => ({}) } } };
    const mine = rig(ourMod, [active], thinDir);
    const theirs = rig(stockMod, [active], thinDir);
    // Bắt NGAY kết cục của mỗi lượt: một promise bị từ chối mà chưa có handler sẽ làm đỏ test kế tiếp.
    const pendingMine = errorOf(() => mine.editor.edit(active, () => ({ mode: "next" })));
    const pendingTheirs = errorOf(() => theirs.editor.edit(active, () => ({ mode: "next" })));
    // ⚠️ 18/10/2026 (task-28) — BỎ phép CHỜ THEO NHỊP (trần 500ms) đã flake dưới tải typecheck/agent khác.
    //   Hai seam HMR giả settle ĐỒNG BỘ trong `finally`, nên await CHÍNH hai promise là tất định:
    //   vẫn chờ 'lượt ghi kết thúc ở cả hai bản' nhưng không phụ thuộc tốc độ CPU. Bun có trần 5s/ca
    //   nên nếu một bên treo thật thì ca vẫn ĐỎ (không treo vô hạn).
    const [mineError, theirsError] = await Promise.all([pendingMine, pendingTheirs]);
    expect(mine.hmr.settled).toBe(true);
    expect(theirs.hmr.settled).toBe(true);
    expect(mine.hmr.calls).toBe(1);
    expect(theirs.hmr.calls).toBe(1);
    expect(mineError).toBe(theirsError);
    expect(mineError).toContain("profile reload requires the root Include entry");
  });

  test("11/11/2026 — có hmr.applyPatches ⇒ lượt ghi đi qua SEAM, KHÔNG chết ở WeakMap của kernel", async () => {
    // Sự cố thật (đo trên app 5439): settings/mutate bị `settings/rejected: dsh: profile reload requires the
    // root Include entry` ⇒ công tắc "Công cụ lập trình" (và mọi công tắc trong Cài đặt) không lưu được.
    // Ca này khoá ĐÚNG đường sửa: khi seam hmr có `applyPatches` thì lượt ghi phải gọi nó, và thông điệp lỗi
    // của kernel (WeakMap bootstrapIncludes) KHÔNG được xuất hiện nữa.
    const dir = await makeProfile("- id: alpha\n  name: '@deepseek-ai/dsh-alpha'\n  config:\n    mode: strict\n");
    const active: FakeEntry = { ...makeEntry("alpha"), fiber: { state: 2, runtime: null, ctx: { waterfall: () => ({}) } } };
    const seen: Array<{ patches: number; requiredIds: readonly string[] }> = [];
    const mine = rig(ourMod, [active], dir, {
      applyPatches: async (patches: readonly unknown[], requiredIds: readonly string[] = []) => {
        seen.push({ patches: patches.length, requiredIds });
        return { warnings: [] };
      },
    });
    const message = await errorOf(() => mine.editor.edit(active, () => ({ mode: "next" })));
    expect(seen.length, "phải gọi hmr.applyPatches ít nhất một lượt (reconcile TRƯỚC khi ghi)").toBeGreaterThanOrEqual(1);
    expect(seen[0]?.patches, "danh sách patch phải là danh sách THẬT của profile, không rỗng").toBeGreaterThan(0);
    expect(message).not.toContain("profile reload requires the root Include entry");
    // Đối chứng: KHÔNG có seam ⇒ giữ nguyên hành vi kernel (test A/B cũ đã khoá nguyên văn thông điệp đó).
    const bare = rig(ourMod, [active], dir);
    expect(await errorOf(() => bare.editor.edit(active, () => ({ mode: "next" })))).toContain("profile reload requires the root Include entry");
  });

  test("C6 — DANH TÍNH: mỗi lượt `configuration()` trả vật thể MỚI (so sâu ĐẠT, `toBe` KHÁC) ở CẢ HAI bản", () => {
    const rows = ["config-editor", "deepseek-account", "hmr"].map((id) => makeEntry(id));
    for (const mod of [ourMod, stockMod]) {
      const editor = rig(mod, rows, richDir).editor;
      const first = editor.configuration();
      const second = editor.configuration();
      expect(first).toEqual(second);
      expect(first[2]?.inherited).not.toBe(second[2]?.inherited);
      expect(first[0]?.override).not.toBe(second[0]?.override);
      (first[2]?.inherited as { root: string[] }).root = ["mutated"];
      expect((second[2]?.inherited as { root: string[] }).root).toEqual([]);
    }
  });
});

describe("row config-editor — phép sửa tệp patch của profile (kỳ vọng viết tay từ bản gốc)", () => {
  test("thêm row khi chưa có, và giữ nguyên định dạng của các row cũ", () => {
    const patch = parsePatchDocument(PATCH_TEXT);
    writeConfigRow(patch, { id: "omega", name: "@deepseek-ai/dsh-omega" }, { fresh: 1 }, {});
    restoreJsExpressions(patch.document);
    expect(String(patch.document)).toBe(
      PATCH_TEXT +
        '- id: omega\n  name: "@deepseek-ai/dsh-omega"\n  config:\n    fresh: 1\n',
    );
  });

  test("thay config TẠI CHỖ khi row đã có", () => {
    const patch = parsePatchDocument(PATCH_TEXT);
    writeConfigRow(patch, { id: "alpha", name: "@deepseek-ai/dsh-alpha" }, { mode: "loose", nested: { deep: true } }, {});
    restoreJsExpressions(patch.document);
    expect(String(patch.document)).toBe(
      [
        "- id: alpha",
        "  name: '@deepseek-ai/dsh-alpha'",
        "  config:",
        "    mode: loose",
        "    nested:",
        "      deep: true",
        "- id: beta",
        "  name: '@deepseek-ai/dsh-beta'",
        "- id: gamma",
        "  name: '@deepseek-ai/dsh-gamma'",
        "  config:",
        "    expr: !!js ctx.get('profileContext')?.name",
        "- id: delta",
        "  name: '@deepseek-ai/dsh-delta'",
        "  disabled: true",
        "  config:",
        "    keep: 1",
        "",
      ].join("\n"),
    );
  });

  test("trùng lớp thừa kế ⇒ xoá config, và xoá CẢ row khi chỉ còn id + name", () => {
    const removed = parsePatchDocument(PATCH_TEXT);
    writeConfigRow(removed, { id: "beta", name: "@deepseek-ai/dsh-beta" }, {}, {});
    restoreJsExpressions(removed.document);
    expect(String(removed.document)).not.toContain("id: beta");

    const kept = parsePatchDocument(PATCH_TEXT);
    writeConfigRow(kept, { id: "delta", name: "@deepseek-ai/dsh-delta" }, {}, {});
    restoreJsExpressions(kept.document);
    expect(String(kept.document)).toContain("- id: delta\n  name: '@deepseek-ai/dsh-delta'\n  disabled: true\n");
    expect(String(kept.document)).not.toContain("keep: 1");
  });

  test("`!!js` đi vòng NGUYÊN VẸN: scalar ⇒ `{__jsExpr}` đúng phương ngữ entry-list của Loader", () => {
    const patch = parsePatchDocument(PATCH_TEXT);
    restoreJsExpressions(patch.document);
    expect(patchListOf(patch.document)).toEqual([
      { id: "alpha", name: "@deepseek-ai/dsh-alpha", config: { mode: "strict" } },
      { id: "beta", name: "@deepseek-ai/dsh-beta" },
      { id: "gamma", name: "@deepseek-ai/dsh-gamma", config: { expr: { __jsExpr: "ctx.get('profileContext')?.name" } } },
      { id: "delta", name: "@deepseek-ai/dsh-delta", disabled: true, config: { keep: 1 } },
    ]);
  });
});

describe("row config-editor — quy ước metadata (đo trên package.json)", () => {
  test("`gbh.peers ⊆ peerDependencies` so PHẦN TỬ + ĐỐI CHỨNG ÂM", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Manifest;
    const peers = manifest.gbh?.peers ?? [];
    const declared = Object.keys(manifest.peerDependencies ?? {});
    expect(peers.filter((name) => !declared.includes(name))).toEqual([]);
    expect(peers.length).toBe(7);
    // ĐỐI CHỨNG ÂM 1: xoá MỘT tên ⇒ phép kiểm phải bắt ĐÚNG tên đó.
    const firstPeer = peers[0] ?? "";
    const lastPeer = peers[peers.length - 1] ?? "";
    const trimmed = declared.filter((name) => name !== firstPeer);
    expect(peers.filter((name) => !trimmed.includes(name))).toEqual([firstPeer]);
    // ĐỐI CHỨNG ÂM 2: CÙNG số lượng mà lệch phần tử ⇒ vẫn ĐỎ (so số lượng là verdict RỖNG).
    const swapped = [...declared.slice(0, -1), "@deepseek-ai/dsh-khong-co-that"];
    expect(swapped.length).toBe(declared.length);
    expect(peers.filter((name) => !swapped.includes(name))).toEqual([lastPeer]);
    // ĐỐI CHỨNG ÂM 3: peer thừa trong peerDependencies vẫn ĐẠT (quan hệ một chiều).
    expect(peers.filter((name) => ![...declared, "@deepseek-ai/dsh-thua"].includes(name))).toEqual([]);
    // Peer KHÔNG được nằm trong `dependencies` (một thể hiện do kernel cấp).
    expect(Object.keys(manifest.dependencies ?? {})).toEqual([]);
  });

  // 18/10/2026 (task-15) — SỬA LỖI MOUNT: bản cũ khai `disabled: {js: "!ctx.get('profileContext')"}` cho row
  //   STOCK rồi chèn bản ta KHÔNG disabled ⇒ khi profileContext CÓ, cả hai cùng active ⇒ service
  //   "configEditor" đăng ký HAI LẦN (log host 21:56: 'config-editor-ours: Error: service "configEditor" has
  //   been registered at <ConfigEditor>'). Hợp đồng ĐÚNG = mirror oracle theo TẦNG: stock TẮT VÔ ĐIỀU KIỆN,
  //   row CHÈN giữ biểu thức `!!js` của stock.
  test("gbh.row MIRROR oracle: stock tắt VÔ ĐIỀU KIỆN + row chèn giữ disabled !!js (profileContext)", () => {
    const manifest = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Manifest;
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-config-editor");
    expect(manifest.gbh?.row).toEqual({
      id: "config-editor",
      disabled: true,
      insertDisabled: { js: "!ctx.get('profileContext')" },
      tests: ["tests/host/config-editor.test.ts"],
    });
  });

  test("renderRewriteBlock: stock `disabled: true` + row CHÈN mang `!!js` đúng SAU dòng name", () => {
    const row = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Manifest;
    const spec = row.gbh?.row as { id: string; disabled: boolean; insertDisabled: { js: string }; tests: string[] };
    const block = renderRewriteBlock("@galaxy-blackhole/gbh-config-editor", spec);
    const lines = block.split("\n");
    expect(lines[0]).toBe("- id: config-editor");
    expect(lines[1]).toBe("  disabled: true");
    const insertIndex = lines.findIndex((line) => line.trim() === "- id: config-editor-ours");
    expect(insertIndex).toBeGreaterThanOrEqual(0);
    expect(lines[insertIndex + 1]?.trim()).toBe("name: '@galaxy-blackhole/gbh-config-editor'");
    expect(lines[insertIndex + 2]?.trim()).toBe("disabled: !!js \"!ctx.get('profileContext')\"".replace('\\"', '"'));
    // Đúng HAI dòng disabled: stock (2 space) + row chèn (6 space); biểu thức chỉ nằm ở row CHÈN.
    expect(lines.filter((line) => line.includes("disabled:")).length).toBe(2);
    expect(lines.filter((line) => line.includes("!!js")).length).toBe(1);
  });

  test("ca chờ có TRẦN kết thúc đúng hạn khi điều kiện KHÔNG BAO GIỜ đạt", async () => {
    await expect(waitFor(() => false, "điều kiện cố tình sai", 30)).rejects.toThrow("quá hạn chờ");
  });
});
