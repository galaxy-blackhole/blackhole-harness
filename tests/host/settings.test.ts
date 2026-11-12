/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-settings: đo trên ARTIFACT, đối chứng TRỰC TIẾP với bundle gốc
 *      trên Context cordis THẬT; ca C6 DANH TÍNH, quy ước gbh.peers ⊆ peerDependencies, locale 000e.
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPackage } from "../../packages/host/settings/build.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của TA. */
const PKG = join(REPO, "packages", "host", "settings");
/** Gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-settings");
/** Bundle GỐC đã build. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis mà CHÍNH package ta nạp (symlink tới kernel) — cùng một tệp thật với bản gốc. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** schemastery của kernel — nguồn của mọi schema dùng trong rig. */
const SCHEMASTERY = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "schemastery", "lib", "index.mjs");
/** cosmokit của kernel — nguồn của tham chiếu volatile THẬT. */
const COSMOKIT = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cosmokit", "lib", "index.js");
/** Manifest của gói — nguồn duy nhất của cả gbh.peers lẫn peerDependencies (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");
/** Thư mục locale của TA và của bản gốc (luật 000e). */
const OURS_LOCALE = join(PKG, "locale");
const STOCK_LOCALE = join(STOCK_DIR, "locale");
/** Thư mục build tạm trong `lib/`: peer `@deepseek-ai` phân giải qua symlink → KERNEL dựng ở beforeAll. */
const OUT = join(PKG, "lib", ".test-build");
/** Artifact của ta (dựng trong `beforeAll`). */
const ARTIFACT = join(OUT, "index.js");

/** Hạn chờ tối đa của một phép chờ có trần (ms) — KHÔNG dùng `setTimeout(0)` làm phép đồng bộ. */
const WAIT_MS = 500;

/** Một mục trong sổ vị trí secret mà biểu mẫu trả về. */
interface SecretSlot {
  /** Đường dẫn tới trường bị bỏ. */
  path: string[];
  /** Trường có đang giữ giá trị hay không. */
  set: boolean;
}

/** Một biểu mẫu mà describe() trả về (nhìn qua góc hẹp, đủ để so hai bản). */
interface Descriptor {
  /** Khoá namespace (options.id của entry). */
  ns: string;
  /** Có tự sinh trang hay không. */
  autoGenerate: boolean;
  /** Bản JSON của schema biểu mẫu. */
  schema: unknown;
  /** Giá trị đã chiếu. */
  value: unknown;
  /** Revision của cấu hình thô. */
  revision: number;
  /** Lớp thừa kế đã phân giải. */
  base?: unknown;
  /** Lớp ghi đè của người dùng. */
  user?: unknown;
  /** Thời điểm áp dụng. */
  applies: string;
  /** Sổ vị trí secret. */
  secrets?: SecretSlot[];
}

/** Dịch vụ settings nhìn qua góc hẹp của test. */
interface SettingsService {
  /** Tên dịch vụ đã đăng ký trong context. */
  readonly name: string;
  /** Có cho sửa hay không. */
  readonly writable: boolean;
  /** Tệp patch của profile. */
  readonly documentPath: string;
  /** Promise của đường dẫn tệp patch. */
  prepareDocument(): Promise<string>;
  /** Đọc biểu mẫu của mọi entry đang sống. */
  describe(options?: { redactSecrets?: boolean }): Descriptor[];
  /** Gộp các trường vào cấu hình của một entry. */
  update(ns: string, patch: object, expectedRevision?: number): Promise<void>;
  /** Đặt lại toàn bộ trường sống rồi ghi các trường được cấp. */
  replace(ns: string, section: object, expectedRevision?: number): Promise<void>;
  /** Áp các phép sửa theo đường dẫn. */
  mutate(ns: string, ops: PathOp[], expectedRevision?: number): Promise<void>;
  /** Đăng ký chính sách trang cho thể hiện đang gọi. */
  configure(presentation: { auto?: boolean }, owner?: object): () => void;
}

/** Một phép sửa đường dẫn theo hình dạng mà dịch vụ nhận. */
interface PathOp {
  /** Động từ: đặt hay bỏ. */
  op: "set" | "unset";
  /** Đường dẫn bị sửa. */
  path: string[];
  /** Giá trị cho động từ set. */
  value?: unknown;
}

/** Lớp dịch vụ nhìn qua góc hẹp của test. */
interface SettingsClass {
  /** Dựng dịch vụ trong một context. */
  new (ctx: FakeContext): SettingsService;
  /** Hai seam phải sẵn sàng trước khi dùng. */
  inject: string[];
  /** Prototype — nơi đo bề mặt lớp. */
  prototype: object;
}

/** Module của cả hai bản: đúng bốn export runtime. */
interface SettingsModule {
  /** Lỗi từ chối ghi vì revision lệch. */
  SettingsConflictError: new (ns: string, expected: number, actual: number) => Error & { code: string; expected: number; actual: number };
  /** Lớp dịch vụ. */
  SettingsForms: SettingsClass;
  /** Chính lớp đó, ở dạng default. */
  default: SettingsClass;
  /** Hàm che secret theo cấu trúc. */
  redactSecrets(schema: unknown, value: unknown): { value: unknown; secrets: SecretSlot[] };
}

/** Context cordis nhìn qua đúng những gì rig dùng. */
interface FakeContext {
  /** Cấp một dịch vụ cho context này. */
  provide(name: string, value: unknown): void;
  /** Lắng nghe một sự kiện của kernel. */
  on(name: string, listener: (...args: unknown[]) => void): () => void;
  /** Phát một sự kiện ra toàn context. */
  emit(name: string, ...args: unknown[]): void;
  /** Logger của kernel — rig thay ba hàm để bắt văn bản log. */
  logger: { warn(...args: unknown[]): void; info(...args: unknown[]): void; error(...args: unknown[]): void };
  /** Fiber của chính dịch vụ. */
  fiber: { state: number };
}

/** Mô tả một row của profile giả: mọi thứ mà describe()/write() đọc. */
interface RowSpec {
  /** options.id của entry. */
  id: string;
  /** Cấu hình thô của row (lớp ghi đè). */
  config: Record<string, unknown>;
  /** Lớp thừa kế của profile (có thể mang biểu thức js). */
  inherited: unknown;
  /** Schema Config của plugin. */
  schema: unknown;
  /** Trạng thái fiber (mặc định 2 = ACTIVE). */
  state?: number;
  /** uid của fiber (mặc định theo thứ tự). */
  uid?: number;
  /** Runtime của plugin; `null` nghĩa là chưa dựng (bị loại khỏi biểu mẫu). */
  runtime?: unknown;
  /** Cấu hình ĐÃ PHÂN GIẢI (mặc định lấy cấu hình thô) — nơi đặt tham chiếu volatile. */
  resolved?: unknown;
}

/** Một tệp patch mà seam configEditor nhận: kết quả của mỗi lượt ghi. */
interface PatchEdit {
  /** Row bị ghi. */
  id: string;
  /** Cấu hình kế tiếp. */
  next: unknown;
}

/** Một rig: context thật + seam giả + dịch vụ của một bản. */
interface Rig {
  /** Context cordis thật của rig. */
  ctx: FakeContext;
  /** Dịch vụ settings của bản đang đo. */
  service: SettingsService;
  /** Các row của profile giả (sửa được giữa các bước). */
  rows: RowSpec[];
  /** Sổ các lượt ghi đã nhận. */
  edits: PatchEdit[];
  /** Sổ sự kiện settings/document-updated. */
  events: [string, number][];
  /** Văn bản log đã bắt, mỗi dòng là một lần gọi. */
  logs: string[][];
  /** Home của profile giả. */
  home: string;
  /** Các entry Loader giả (vật thể ỔN ĐỊNH — dùng để gọi configure từ đúng fiber). */
  entries: { options: { id: string }; fiber: object }[];
}

const Context = (await import(CORDIS)) as unknown as { Context: new () => FakeContext };
const z = ((await import(SCHEMASTERY)) as { default: Record<string, (...args: never[]) => unknown> }).default as unknown as {
  object(dict: Record<string, unknown>): { volatile(): unknown };
  string(): { role(role: string): { volatile(): unknown }; volatile(): unknown; default(value: unknown): unknown };
  number(): { default(value: unknown): unknown };
  array(inner: unknown): { default(value: unknown): { volatile(): unknown } };
  dict(inner: unknown): { default(value: unknown): { volatile(): unknown } };
  union(list: unknown[]): { volatile(): unknown };
};
const cosmokit = (await import(COSMOKIT)) as unknown as { createVolatile(value: unknown): unknown };
const stockModule = (await import(STOCK)) as SettingsModule;

/** Module của TA đã build (điền trong `beforeAll`). */
let ourModule: SettingsModule;

/**
 * Chờ có TRẦN tới khi một điều kiện thành thật.
 * @param condition - điều kiện cần đợi.
 * @param label - nhãn để báo lỗi.
 * @param timeoutMs - trần thời gian (mặc định WAIT_MS).
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
 * Tên export của một file ESM đã build (cùng hai regex mà check:rows dùng).
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
 * Chuẩn hoá bản JSON của schema để so được hai bản: bỏ uid (bộ đếm toàn cục) và quy refs về chỉ số.
 * Nhận: bản JSON do schema.toJSON() sinh ra.
 * Trả: vật đã chuẩn hoá — hai bên cùng hình dạng thì cho cùng vật.
 */
function canonicalSchema(node: unknown): unknown {
  const source = node as { refs?: Record<string, unknown> };
  const refs = source.refs ?? {};
  const keys = Object.keys(refs).sort((a, b) => Number(a) - Number(b));
  const index = new Map(keys.map((key, position) => [Number(key), position]));
  const walk = (current: unknown): unknown => {
    if (typeof current === "number") return { ref: index.get(current) ?? current };
    if (Array.isArray(current)) return current.map(walk);
    if (current !== null && typeof current === "object") {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(current).sort()) {
        if (key === "uid" || key === "refs") continue;
        out[key] = walk(Reflect.get(current, key));
      }
      if (source.refs !== undefined) {
        const record = current as { refs?: Record<string, unknown> };
        if (record.refs !== undefined) out.refs = keys.map((key) => walk(record.refs?.[key]));
      }
      return out;
    }
    return current;
  };
  return walk(node);
}

/**
 * Chiếu các biểu mẫu về dạng so được: schema đã chuẩn hoá, phần còn lại giữ nguyên.
 * @param list - biểu mẫu do describe() trả về.
 * @returns danh sách đã chuẩn hoá.
 */
function canon(list: Descriptor[]): unknown[] {
  return list.map((descriptor) => ({ ...descriptor, schema: canonicalSchema(descriptor.schema) }));
}

/**
 * Bản sao sâu bằng JSON (đủ cho cấu hình trong test).
 * @param value - vật cần sao.
 * @returns bản sao tách rời.
 */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Chạy một phép ghi và trả mô tả lỗi thay vì ném — để so hai bản mà không làm đỏ test giữa đường.
 * @param run - hàm cần chạy.
 * @returns chuỗi JSON của name/code/message/expected/actual, hoặc "(khong nem)".
 */
async function errorOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(khong nem)";
  } catch (error) {
    const subject = error as { name?: string; code?: string; message?: string; expected?: number; actual?: number };
    return JSON.stringify({
      name: subject.name,
      code: subject.code,
      message: subject.message,
      expected: subject.expected,
      actual: subject.actual,
    });
  }
}

/** Thư mục tạm đã dựng — dọn trong `afterAll`. */
const tempDirs: string[] = [];

/**
 * Dựng một home tạm cho profile giả.
 * @param label - nhãn ngắn để nhìn ra thư mục trong /tmp.
 * @returns đường dẫn home.
 */
function tempHome(label: string): string {
  const home = mkdtempSync(join(tmpdir(), "gbh-settings-" + label + "-"));
  tempDirs.push(home);
  return home;
}

/**
 * Dựng schema lớn dùng cho rig: trường sống, trường secret, dict/array/union, và một trường THƯỜNG.
 * @param options - không dùng; mỗi lượt gọi trả schema MỚI để hai rig không chia sẻ vật.
 * @returns schema schemastery.
 */
function bigSchema(): unknown {
  return z.object({
    endpoint: z.string().default("http://default"),
    apiKey: z.string().role("secret").volatile(),
    headers: z.dict(z.string().role("secret")).default({}).volatile(),
    list: z.array(z.string()).default([]).volatile(),
    either: z.union([z.string(), z.object({ token: z.string().role("secret") })]).volatile(),
    retry: z.object({ maxRetries: z.number().default(3) }).volatile(),
    plain: z.number().default(1),
  });
}

/**
 * Dựng một rig: context cordis THẬT + loader/profileContext/configEditor giả + dịch vụ của một bản.
 * @param mod - module (bản của ta hoặc bản gốc).
 * @param rows - các row của profile giả.
 * @param home - home của profile giả.
 * @returns rig đã sẵn sàng đo.
 */
function rig(mod: SettingsModule, rows: RowSpec[], home: string = tempHome("rig")): Rig {
  const ctx = new Context.Context();
  const events: [string, number][] = [];
  const edits: PatchEdit[] = [];
  const logs: string[][] = [];
  // Entry phải là vật thể ỔN ĐỊNH giữa các lượt (bản gốc khoá chính sách trang theo DANH TÍNH fiber);
  // options.config và fiber.config đọc qua getter để phản ánh cấu hình đang đổi của row.
  const entries = rows.map((row, position) => ({
    id: "include|" + row.id,
    options: {
      id: row.id,
      get config(): unknown {
        return row.config;
      },
    },
    fiber: {
      uid: row.uid ?? position + 1,
      state: row.state ?? 2,
      runtime: row.runtime === undefined ? { Config: row.schema } : row.runtime,
      get config(): unknown {
        return row.resolved ?? row.config;
      },
      ctx,
    },
    parent: { tree: { ctx: { fiber: { entry: { id: "include" } } } } },
  }));
  const live = (): typeof entries => entries.filter((entry) => rows.some((row) => row.id === entry.options.id));
  ctx.provide("loader", { await: () => Promise.resolve() });
  ctx.provide("profileContext", { name: "blackhole", home, dir: join(home, "profiles", "blackhole") });
  ctx.provide("configEditor", {
    documentPath: join(home, "profiles", "blackhole", "app.patch.yml"),
    entries: () => live(),
    configuration: () =>
      rows.map((row) => ({
        entry: entries.find((entry) => entry.options.id === row.id),
        inherited: clone(row.inherited),
        override: clone(row.config),
      })),
    edit: async (entry: { options: { id: string } }, change: (raw: unknown, inherited: unknown) => unknown) => {
      const row = rows.find((candidate) => candidate.id === entry.options.id);
      if (row === undefined) throw new Error("rig: row không tồn tại");
      const before = clone(row.config);
      const next = change(before, clone(row.inherited));
      edits.push({ id: row.id, next: clone(next) });
      row.config = clone(next) as Record<string, unknown>;
    },
  });
  const capture = (level: string) => (...args: unknown[]) => {
    logs.push([level, ...args.map((item) => (item instanceof Error ? item.message : String(item)))]);
  };
  ctx.logger.warn = capture("warn");
  ctx.logger.info = capture("info");
  ctx.logger.error = capture("error");
  ctx.on("settings/document-updated", (ns, revision) => {
    events.push([String(ns), Number(revision)]);
  });
  const service = new mod.SettingsForms(ctx);
  return { ctx, service, rows, edits, events, logs, home, entries };
}


/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Tên package. */
  name?: string;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc cứng (KHÔNG được chứa peer). */
  dependencies?: Record<string, string>;
  /** Phụ thuộc chỉ dùng khi phát triển/test. */
  devDependencies?: Record<string, string>;
  /** Bản đồ export của package. */
  exports?: Record<string, string>;
  /** Metadata của ta để bh host sinh khối patch. */
  gbh?: {
    peers?: string[];
    row?: { id?: string; disabled?: boolean | { js?: string }; tests?: string[] };
  };
}

/** Danh sách ĐÓNG peer của riêng gói này (đối chứng để phép ⊆ không ĐẠT VÔ NGHĨA). */
const SEAM_PEERS = ["@deepseek-ai/cordis", "@deepseek-ai/cordis-plugin-loader", "@deepseek-ai/schemastery", "yaml"];

/** Manifest của gói — đọc thẳng file vì tests/ không resolve được @deepseek-ai/*. */
const MANIFEST_JSON = JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;

/**
 * Tên còn THIẾU: phần tử của gbh.peers không có mặt trong peerDependencies.
 * So PHẦN TỬ, KHÔNG so số lượng — peerDependencies thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * @param manifest - manifest cần kiểm.
 * @returns danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * @param manifest - manifest gốc.
 * @returns bản sao tách rời.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

/**
 * SHA-256 của một tệp — dùng để khẳng định locale chép BYTE-FOR-BYTE.
 * @param path - đường dẫn tệp.
 * @returns chuỗi hex của mã băm.
 */
function sha256(path: string): string {
  return createHash("sha256").update(normalizePackageNames(readFileSync(path, "utf8"))).digest("hex");
}

/** Các row dùng chung cho nhiều ca: một row đủ loại trường, một row không có trường sống, hai row chưa sẵn sàng. */
function fixtureRows(): RowSpec[] {
  const alpha = {
    endpoint: "http://a",
    apiKey: "S1",
    headers: { x: "h1" },
    list: ["a", "b"],
    either: { token: "E" },
    retry: { maxRetries: 7 },
    plain: 5,
  };
  return [
    {
      id: "alpha",
      config: clone(alpha),
      inherited: {
        retry: { maxRetries: 5 },
        either: { __jsExpr: "ctx.get('profileContext').name" },
        endpoint: { __jsExpr: "ctx.get('profileContext').name" },
      },
      schema: bigSchema(),
      resolved: { ...clone(alpha), apiKey: cosmokit.createVolatile("S1") },
    },
    { id: "beta", config: { plain: 2 }, inherited: {}, schema: z.object({ plain: z.number().default(1) }) },
    { id: "gamma", config: { retry: { maxRetries: 1 } }, inherited: {}, schema: bigSchema(), state: 1 },
    { id: "delta", config: {}, inherited: {}, schema: bigSchema(), runtime: null },
  ];
}

beforeAll(async () => {
  await buildPackage(OUT);
  mkdirSync(join(OUT, "node_modules"), { recursive: true });
  symlinkSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), join(OUT, "node_modules", "@deepseek-ai"), "dir"); symlinkSync(join(join(REPO, "apps", "host", "node_modules", "@deepseek-ai"), "..", "..", "..", "..", "node_modules", "@galaxy-blackhole"), join(OUT, "node_modules", "@galaxy-blackhole"), "dir");
  ourModule = (await import(ARTIFACT)) as SettingsModule;
}, 30_000);

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

describe("bề mặt gói: đo trên ARTIFACT, đối chứng với chính bundle gốc", () => {
  test("tập export của ta BẰNG gốc (4 tên) và artifact KHÔNG mang id stock", () => {
    const oursText = readFileSync(ARTIFACT, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(["SettingsConflictError", "SettingsForms", "default", "redactSecrets"]);
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    // Nạp THẬT cả hai module rồi so PHẦN TỬ (không chỉ đọc văn bản của artifact).
    expect(Object.keys(ourModule).sort()).toEqual(Object.keys(stockModule).sort());
    expect(Object.keys(ourModule).sort()).toEqual([
      "SettingsConflictError",
      "SettingsForms",
      "default",
      "redactSecrets",
    ]);
    expect(ourModule.default).toBe(ourModule.SettingsForms);
    expect(stockModule.default).toBe(stockModule.SettingsForms);
  });

  test("bề mặt lớp: prototype · static inject · khoá thể hiện · CÙNG một Service của kernel", () => {
    expect(Object.getOwnPropertyNames(ourModule.SettingsForms.prototype)).toEqual(
      Object.getOwnPropertyNames(stockModule.SettingsForms.prototype),
    );
    expect(Object.getOwnPropertyNames(ourModule.SettingsForms.prototype)).toEqual([
      "constructor",
      "importLegacyDocument",
      "configure",
      "invalidate",
      "writable",
      "documentPath",
      "prepareDocument",
      "describe",
      "update",
      "replace",
      "mutate",
      "write",
      "schema",
    ]);
    expect(ourModule.SettingsForms.inject).toEqual(stockModule.SettingsForms.inject);
    expect(ourModule.SettingsForms.inject).toEqual(["configEditor", "profileContext"]);
    // Quan hệ KẾ THỪA (recipe §2b): hai lớp phải có CÙNG lớp cha — cùng một Service của kernel.
    expect(Object.getPrototypeOf(ourModule.SettingsForms)).toBe(Object.getPrototypeOf(stockModule.SettingsForms));
    const ours = rig(ourModule, fixtureRows());
    const theirs = rig(stockModule, fixtureRows());
    expect(Object.keys(ours.service)).toEqual(Object.keys(theirs.service));
    expect(Object.keys(ours.service)).toEqual([
      "ctx",
      "name",
      "ownerContext",
      "revisions",
      "closed",
      "scheduled",
      "presentations",
    ]);
    expect(ours.service.name).toBe(theirs.service.name);
    expect(ours.service.name).toBe("settings");
    expect(ours.service.writable).toBe(theirs.service.writable);
    expect(ours.service.writable).toBe(true);
  });
});

describe("hành vi describe(): đối chứng với bản gốc trên Context cordis THẬT", () => {
  test("cùng kịch bản ⇒ cùng biểu mẫu; chỉ entry có trường SỐNG và đang ACTIVE mới vào", () => {
    const ours = rig(ourModule, fixtureRows()).service.describe();
    const theirs = rig(stockModule, fixtureRows()).service.describe();
    expect(canon(ours)).toEqual(canon(theirs));
    expect(ours.map((descriptor) => descriptor.ns)).toEqual(["alpha"]);
    expect(ours.map((descriptor) => descriptor.ns)).toEqual(theirs.map((descriptor) => descriptor.ns));
    const alpha = ours[0] as Descriptor;
    expect(alpha.applies).toBe("live");
    expect(alpha.autoGenerate).toBe(true);
    // Tham chiếu volatile THẬT của cosmokit được bóc thành giá trị (không lọt vật runtime ra wire).
    expect(alpha.value).toEqual({
      apiKey: "S1",
      headers: { x: "h1" },
      list: ["a", "b"],
      either: { token: "E" },
      retry: { maxRetries: 7 },
    });
    // Lớp thừa kế: biểu thức js được phân giải bằng context của fiber, rồi schema phân giải mặc định.
    // resolveConfig của kernel điền mặc định cho headers/list (schema đầy đủ), nên lớp nền có cả hai.
    expect(alpha.base).toEqual({ either: "blackhole", headers: {}, list: [], retry: { maxRetries: 5 } });
    expect(alpha.user).toEqual({
      apiKey: "S1",
      headers: { x: "h1" },
      list: ["a", "b"],
      either: { token: "E" },
      retry: { maxRetries: 7 },
    });
  });

  test("che secret: value/base/user đã bỏ trường secret, sổ secrets khớp từng phần tử", () => {
    const ours = rig(ourModule, fixtureRows()).service.describe({ redactSecrets: true });
    const theirs = rig(stockModule, fixtureRows()).service.describe({ redactSecrets: true });
    expect(canon(ours)).toEqual(canon(theirs));
    const alpha = ours[0] as Descriptor;
    expect(alpha.value).toEqual({ headers: {}, list: ["a", "b"], either: {}, retry: { maxRetries: 7 } });
    expect(alpha.secrets).toEqual([
      { path: ["apiKey"], set: true },
      { path: ["headers", "x"], set: true },
      { path: ["either", "token"], set: true },
    ]);
    // Không che thì secret VẪN còn — chứng minh phép che là thứ DUY NHẤT bỏ nó.
    const plain = rig(ourModule, fixtureRows()).service.describe();
    expect((plain[0] as Descriptor).value).toHaveProperty("apiKey", "S1");
    expect(plain[0]?.secrets).toBe(undefined);
  });

  test("revision: ổn định khi ảnh chụp thô không đổi, +1 + sự kiện khi đổi, +1 khi entry biến mất", () => {
    const ours = rig(ourModule, fixtureRows());
    const theirs = rig(stockModule, fixtureRows());
    const snap = (side: Rig): [string, number][] =>
      side.service.describe().map((descriptor) => [descriptor.ns, descriptor.revision]);
    expect(snap(ours)).toEqual(snap(theirs));
    expect(snap(ours)).toEqual(snap(theirs));
    expect(snap(ours)).toEqual([["alpha", 0]]);
    expect(ours.events).toEqual([["alpha", 0]]);
    expect(ours.events).toEqual(theirs.events);
    for (const side of [ours, theirs]) {
      side.rows[0]!.config = { ...side.rows[0]!.config, retry: { maxRetries: 9 } };
    }
    expect(snap(ours)).toEqual(snap(theirs));
    expect(snap(ours)).toEqual([["alpha", 1]]);
    expect(ours.events).toEqual(theirs.events);
    expect(ours.events.at(-1)).toEqual(["alpha", 1]);
    for (const side of [ours, theirs]) side.rows.shift();
    expect(snap(ours)).toEqual([]);
    expect(snap(theirs)).toEqual([]);
    expect(ours.events).toEqual(theirs.events);
    expect(ours.events.at(-1)).toEqual(["alpha", 2]);
  });

  test("prepareDocument · documentPath trùng bản gốc và trỏ vào tệp patch của profile", async () => {
    const home = tempHome("doc");
    const ours = rig(ourModule, fixtureRows(), home);
    const theirs = rig(stockModule, fixtureRows(), home);
    expect(ours.service.documentPath).toBe(theirs.service.documentPath);
    expect(ours.service.documentPath).toBe(join(ours.home, "profiles", "blackhole", "app.patch.yml"));
    await expect(ours.service.prepareDocument()).resolves.toBe(ours.service.documentPath);
    await expect(theirs.service.prepareDocument()).resolves.toBe(theirs.service.documentPath);
  });
});


describe("ghi cấu hình: update · replace · mutate đối chứng với bản gốc", () => {
  /** Các row tối thiểu cho phép ghi: một row đủ loại trường + một row KHÔNG có trường sống. */
  const writeRows = (): RowSpec[] => [
    {
      id: "alpha",
      config: {
        endpoint: "http://a",
        apiKey: "S1",
        headers: { x: "h1" },
        list: ["a", "b"],
        either: { token: "E" },
        retry: { maxRetries: 7 },
        plain: 5,
      },
      inherited: { retry: { maxRetries: 5 } },
      schema: bigSchema(),
    },
    { id: "beta", config: { plain: 2 }, inherited: {}, schema: z.object({ plain: z.number().default(1) }) },
  ];

  test("update rồi replace cho CÙNG tệp patch; trường THƯỜNG của row được giữ nguyên", async () => {
    const ours = rig(ourModule, writeRows());
    const theirs = rig(stockModule, writeRows());
    for (const side of [ours, theirs]) {
      await side.service.update("alpha", { apiKey: "NEW" });
      await side.service.replace("alpha", { retry: { maxRetries: 11 } });
    }
    expect(ours.edits).toEqual(theirs.edits);
    expect(ours.edits[0]).toEqual({
      id: "alpha",
      next: {
        endpoint: "http://a",
        apiKey: "NEW",
        headers: { x: "h1" },
        list: ["a", "b"],
        either: { token: "E" },
        retry: { maxRetries: 7 },
        plain: 5,
      },
    });
    // replace: ĐẶT LẠI mọi trường sống (lớp thừa kế + đầu vào) nhưng vẫn giữ endpoint (trường thường).
    expect(ours.edits[1]).toEqual({ id: "alpha", next: { endpoint: "http://a", retry: { maxRetries: 11 }, plain: 5 } });
    expect(ours.rows[0]!.config).toEqual(theirs.rows[0]!.config);
  });

  test("task-185 · entry thật là <ns>-ours ⇒ mutate(id STOCK) PHÂN GIẢI ĐƯỢC (bản gốc thì ném)", async () => {
    // Dựng đúng hình dạng patch của ta: entry id có hậu tố `-ours`, còn UI gọi namespace theo id stock.
    const rows = writeRows().map((row) => ({ ...row, id: row.id + "-ours" }));
    const ours = rig(ourModule, rows);
    const theirs = rig(stockModule, rows);
    const ops: PathOp[] = [{ op: "set", path: ["retry", "maxRetries"], value: 2 }];
    // ĐỐI CHỨNG ÂM: bản gốc KHÔNG có bản vá ⇒ ném đúng thông điệp (chứng minh nguyên nhân thật).
    await expect(theirs.service.mutate("alpha", ops)).rejects.toThrow(/No configurable plugin entry/);
    // Bản của ta: phân giải qua `<ns>-ours` rồi ghi bình thường.
    await ours.service.mutate("alpha", ops);
    expect(ours.edits.length).toBe(theirs.edits.length + 1);
    expect(ours.edits[0]?.id).toBe("alpha-ours");
  });

  test("mutate sửa đúng đường dẫn: set lồng nhau · bỏ chỉ số mảng · bỏ khoá dict", async () => {
    const ours = rig(ourModule, writeRows());
    const theirs = rig(stockModule, writeRows());
    const ops: PathOp[] = [
      { op: "set", path: ["retry", "maxRetries"], value: 2 },
      { op: "unset", path: ["list", "0"] },
      { op: "unset", path: ["headers", "x"] },
    ];
    for (const side of [ours, theirs]) await side.service.mutate("alpha", ops);
    expect(ours.edits).toEqual(theirs.edits);
    expect(ours.edits[0]).toEqual({
      id: "alpha",
      next: {
        endpoint: "http://a",
        apiKey: "S1",
        headers: {},
        list: ["b"],
        either: { token: "E" },
        retry: { maxRetries: 2 },
        plain: 5,
      },
    });
  });

  test("ma trận 9 đường lỗi TRÙNG NGUYÊN VĂN giữa hai bản; tệp patch KHÔNG bị chạm", async () => {
    const ours = rig(ourModule, writeRows());
    const theirs = rig(stockModule, writeRows());
    const circular: Record<string, unknown> = { apiKey: "x" };
    circular.self = circular;
    const cases: Array<(service: SettingsService) => Promise<unknown>> = [
      (service) => service.update("alpha", { plain: 9 }),
      (service) => service.update("nope", {}),
      (service) => service.update("beta", {}),
      (service) => service.mutate("alpha", [{ op: "set", path: ["plain"], value: 1 }]),
      (service) => service.mutate("alpha", [{ op: "unset", path: ["list", "9"] }]),
      (service) => service.mutate("alpha", [{ op: "unset", path: ["list", "aa"] }]),
      (service) => service.update("alpha", { apiKey: Number.NaN }),
      (service) => service.update("alpha", circular),
      (service) => service.update("alpha", [] as unknown as object),
    ];
    const oursErrors: string[] = [];
    const theirsErrors: string[] = [];
    for (const run of cases) {
      oursErrors.push(await errorOf(() => run(ours.service)));
      theirsErrors.push(await errorOf(() => run(theirs.service)));
    }
    expect(oursErrors).toEqual(theirsErrors);
    expect(oursErrors).toEqual([
      JSON.stringify({ name: "Error", message: 'Config field "plain" is not volatile' }),
      JSON.stringify({ name: "Error", message: 'No configurable plugin entry "nope"' }),
      JSON.stringify({ name: "Error", message: 'Plugin entry "beta" has no volatile fields' }),
      JSON.stringify({ name: "Error", message: 'Config field "plain" is not volatile' }),
      JSON.stringify({ name: "TypeError", message: 'Config array index "9" is out of range' }),
      JSON.stringify({ name: "TypeError", message: 'Config array index "aa" is out of range' }),
      JSON.stringify({ name: "TypeError", message: "Config $.apiKey contains a non-finite number" }),
      JSON.stringify({ name: "TypeError", message: "Config $.self contains a circular reference" }),
      JSON.stringify({ name: "TypeError", message: "Config $ contains a non-plain root" }),
    ]);
    expect(ours.edits).toEqual([]);
    expect(theirs.edits).toEqual([]);
  });

  test("revision gửi lên: ĐÚNG thì ghi, SAI thì SettingsConflictError và KHÔNG chạm tệp patch", async () => {
    const ours = rig(ourModule, writeRows());
    const theirs = rig(stockModule, writeRows());
    for (const side of [ours, theirs]) side.service.describe();
    const oursStale = await errorOf(() => ours.service.update("alpha", { apiKey: "X" }, 3));
    expect(oursStale).toBe(await errorOf(() => theirs.service.update("alpha", { apiKey: "X" }, 3)));
    expect(JSON.parse(oursStale)).toEqual({
      name: "SettingsConflictError",
      code: "SETTINGS_CONFLICT",
      message: 'settings namespace "alpha" changed since it was read (expected revision 3, now 0)',
      expected: 3,
      actual: 0,
    });
    expect(ours.edits).toEqual([]);
    expect(theirs.edits).toEqual([]);
    // ĐÚNG revision thì ghi được — đối chứng: lượt trên hỏng vì revision, không vì cấu hình sai.
    expect(await errorOf(() => ours.service.update("alpha", { apiKey: "X" }, 0))).toBe("(khong nem)");
    expect(await errorOf(() => theirs.service.update("alpha", { apiKey: "X" }, 0))).toBe("(khong nem)");
    expect(ours.edits).toEqual(theirs.edits);
    expect(ours.edits).toHaveLength(1);
  });
});

describe("C6 — vật thể cấu hình phải ĐỘC LẬP giữa các thực thể (kiểm bằng DANH TÍNH)", () => {
  test("hai lượt describe trả vật thể RIÊNG; sửa bên này không lan bên kia", () => {
    for (const mod of [ourModule, stockModule]) {
      const side = rig(mod, fixtureRows());
      const first = side.service.describe({ redactSecrets: true })[0] as Descriptor;
      const second = side.service.describe({ redactSecrets: true })[0] as Descriptor;
      // Phép so SÂU ĐẠT cả khi hai bên chia sẻ một vật ⇒ phải so DANH TÍNH.
      expect(canon([second])).toEqual(canon([first]));
      expect(canon([second])).toEqual(canon([second]));
      expect(second.secrets).not.toBe(first.secrets);
      expect(second.secrets?.[0]).not.toBe(first.secrets?.[0]);
      expect(second.schema).not.toBe(first.schema);
      (first.value as Record<string, unknown>).apiKey = "bi sua";
      (first.secrets as SecretSlot[]).push({ path: ["bia"], set: true });
      expect((second.value as Record<string, unknown>).apiKey).toBe(undefined);
      expect(second.secrets).toHaveLength(3);
      expect(second.secrets?.some((slot) => slot.path[0] === "bia")).toBe(false);
      // redactSecrets là hàm THUẦN tách rời: hai lượt gọi cho hai sổ khác nhau.
      const schema = bigSchema();
      const a = mod.redactSecrets(schema, { apiKey: "S" });
      const b = mod.redactSecrets(schema, { apiKey: "S" });
      expect(b).toEqual(a);
      expect(b.secrets).not.toBe(a.secrets);
      expect(b.value).not.toBe(a.value);
    }
  });

  test("hai thể hiện dịch vụ có sổ revision + chính sách trang RIÊNG", () => {
    for (const mod of [ourModule, stockModule]) {
      const one = rig(mod, fixtureRows());
      const two = rig(mod, fixtureRows());
      expect(one.service.describe()[0]!.revision).toBe(0);
      expect(two.service.describe()[0]!.revision).toBe(0);
      // Plugin thật gọi configure từ CHÍNH fiber của nó (khoá là DANH TÍNH fiber, không theo ctx).
      const dispose = one.service.configure({ auto: false }, one.entries[0]!.fiber);
      // Chính sách trang của bên MỘT không lan sang bên HAI.
      expect(one.service.describe()[0]!.autoGenerate).toBe(false);
      expect(two.service.describe()[0]!.autoGenerate).toBe(true);
      expect(Reflect.get(one.service, "revisions")).not.toBe(Reflect.get(two.service, "revisions"));
      expect(Reflect.get(one.service, "presentations")).not.toBe(Reflect.get(two.service, "presentations"));
      // Hàm dọn gỡ ĐÚNG chính sách của mình; gọi hai lần không phá trạng thái của bên khác.
      dispose();
      expect(one.service.describe()[0]!.autoGenerate).toBe(true);
      expect(two.service.describe()[0]!.autoGenerate).toBe(true);
      // ĐỐI CHỨNG: configure hai lần trên CÙNG fiber vẫn bị chặn ⇒ tính độc lập không đến từ việc tắt kiểm.
      one.service.configure({ auto: false }, one.entries[0]!.fiber);
      expect(() => one.service.configure({ auto: true }, one.entries[0]!.fiber)).toThrow(
        "Settings presentation is already configured for this plugin instance",
      );
    }
  });
});


describe("nhập settings.yaml cũ + làm mới theo sự kiện (waitFor CÓ TRẦN)", () => {
  /** Row tối thiểu cho lượt nhập tài liệu cũ. */
  const legacyRows = (): RowSpec[] => [
    {
      id: "alpha",
      config: { apiKey: "S1", retry: { maxRetries: 7 } },
      inherited: {},
      schema: bigSchema(),
    },
  ];

  test("settings.yaml cũ được ĐỔI TÊN rồi nhập vào profile; mục lạ bị ghi log — hai bản TRÙNG kết quả", async () => {
    const traces: unknown[] = [];
    for (const mod of [ourModule, stockModule]) {
      const home = tempHome("legacy");
      writeFileSync(join(home, "settings.yaml"), ["alpha:", "  apiKey: TU-YAML", "la:", "  field: 1", ""].join("\n"));
      const side = rig(mod, legacyRows(), home);
      await waitFor(() => side.logs.some((line) => line[0] === "info"), "nhập settings.yaml cũ");
      traces.push({
        edits: side.edits,
        // Đường dẫn tuyệt đối khác nhau giữa hai home ⇒ chuẩn hoá trước khi so.
        logs: side.logs.map((line) => line.map((text) => text.split(home).join("<home>"))),
        renamed: existsSync(join(home, "settings.yaml.imported")),
        original: existsSync(join(home, "settings.yaml")),
        config: side.rows[0]!.config,
      });
    }
    expect(traces[0]).toEqual(traces[1]);
    const trace = traces[0] as {
      edits: PatchEdit[];
      logs: string[][];
      renamed: boolean;
      original: boolean;
      config: Record<string, unknown>;
    };
    // Tệp được ĐỔI TÊN trước lượt ghi đầu tiên ⇒ lượt nhập dở KHÔNG BAO GIỜ lặp.
    expect(trace.renamed).toBe(true);
    expect(trace.original).toBe(false);
    expect(trace.edits.map((edit) => edit.id)).toEqual(["alpha"]);
    expect(trace.config).toEqual({ apiKey: "TU-YAML", retry: { maxRetries: 7 } });
    const warns = trace.logs.filter((line) => line[0] === "warn");
    expect(warns).toHaveLength(2);
    expect(warns[0]![1]).toBe("settings: section %s of %s was not imported into entry %s");
    expect(warns[0]!.slice(2)).toEqual(["la", "<home>/settings.yaml.imported", "la"]);
    expect(warns[1]![1]).toBe('No configurable plugin entry "la"');
    const info = trace.logs.filter((line) => line[0] === "info");
    expect(info).toHaveLength(1);
    expect(info[0]!.slice(1)).toEqual(["settings: imported %s into profile %s", "<home>/settings.yaml.imported", "blackhole"]);
  });

  test("waitFor kết thúc ĐÚNG TRẦN khi điều kiện không bao giờ đạt (chứng minh phép chờ KHÔNG treo)", async () => {
    const started = Date.now();
    await expect(waitFor(() => false, "không bao giờ đạt", 40)).rejects.toThrow("quá hạn chờ: không bao giờ đạt");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test("sự kiện app-boot/config-reload làm mới biểu mẫu trong MICROTASK — waitFor CÓ TRẦN", async () => {
    const rows = (): RowSpec[] => [
      { id: "alpha", config: { apiKey: "S1", retry: { maxRetries: 7 } }, inherited: {}, schema: bigSchema() },
    ];
    const ours = rig(ourModule, rows());
    const theirs = rig(stockModule, rows());
    for (const side of [ours, theirs]) side.service.describe();
    for (const side of [ours, theirs]) {
      side.rows[0]!.config = { ...side.rows[0]!.config, retry: { maxRetries: 42 } };
      side.ctx.emit("app-boot/config-reload");
    }
    await waitFor(() => ours.events.some(([, revision]) => revision === 1), "làm mới của bản ta");
    await waitFor(() => theirs.events.some(([, revision]) => revision === 1), "làm mới của bản gốc");
    expect(ours.events).toEqual(theirs.events);
    expect(ours.service.describe()[0]!.value).toEqual({ apiKey: "S1", retry: { maxRetries: 42 } });
    expect(theirs.service.describe()[0]!.value).toEqual(ours.service.describe()[0]!.value);
  });
});

describe("quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có mặt trong peerDependencies (so PHẦN TỬ) và có THẬT trong kernel", () => {
    const peers = MANIFEST_JSON.gbh?.peers ?? [];
    // Chống verdict RỖNG: nếu ai xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    expect(missingPeers(MANIFEST_JSON)).toEqual([]);
    for (const peer of peers) {
      expect(existsSync(join(REPO, "apps", "host", "node_modules", peer, "package.json"))).toBe(true);
      expect(MANIFEST_JSON.peerDependencies?.[peer]).toBeDefined();
    }
  });

  test("ĐỐI CHỨNG ÂM 1: xoá MỘT peer khỏi peerDependencies ⇒ phép kiểm báo ĐÚNG tên đó", () => {
    const peers = MANIFEST_JSON.gbh?.peers ?? [];
    expect(peers.length).toBeGreaterThan(0);
    for (const peer of peers) {
      const mutated = cloneManifest(MANIFEST_JSON);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      expect(missingPeers(mutated)).toEqual([peer]);
    }
  });

  test("ĐỐI CHỨNG ÂM 2+3: bỏ SẠCH ⇒ báo ĐỦ mọi tên; THỪA tên ⇒ vẫn ĐẠT; cùng SỐ LƯỢNG khác PHẦN TỬ ⇒ bị bắt", () => {
    const peers = MANIFEST_JSON.gbh?.peers ?? [];
    expect(missingPeers({ ...MANIFEST_JSON, peerDependencies: {} })).toEqual([...peers].sort());
    const extra = cloneManifest(MANIFEST_JSON);
    extra.peerDependencies = { ...(extra.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(extra)).toEqual([]);
    // Bẫy verdict rỗng của M6-MOUNT-PLAN §1d: peers vẫn ĐỦ SỐ nhưng đổi một PHẦN TỬ.
    const swapped = cloneManifest(MANIFEST_JSON);
    const renamed = [...peers];
    renamed[renamed.length - 1] = "@deepseek-ai/ten-khac";
    swapped.gbh = { ...(swapped.gbh ?? {}), peers: renamed };
    expect(renamed).toHaveLength(peers.length);
    expect(missingPeers(swapped)).toEqual(["@deepseek-ai/ten-khac"]);
  });

  test("peer KHÔNG được khai trong dependencies (tránh thể hiện thứ hai)", () => {
    const deps = new Set(Object.keys(MANIFEST_JSON.dependencies ?? {}));
    expect((MANIFEST_JSON.gbh?.peers ?? []).filter((peer) => deps.has(peer))).toEqual([]);
    expect(MANIFEST_JSON.dependencies).toBe(undefined);
  });
});

describe("luật 000e + metadata: locale byte-for-byte và gbh.row do LEAD khai", () => {
  test("locale/{en,zh}.json TRÙNG BYTE-FOR-BYTE với bản gốc và có trong exports", () => {
    for (const file of ["en.json", "zh.json"]) {
      expect(sha256(join(OURS_LOCALE, file))).toBe(sha256(join(STOCK_LOCALE, file)));
      expect(JSON.parse(readFileSync(join(OURS_LOCALE, file), "utf8"))).toEqual(
        JSON.parse(readFileSync(join(STOCK_LOCALE, file), "utf8")),
      );
    }
    expect(MANIFEST_JSON.exports?.["./locale/*.json"]).toBe("./locale/*.json");
  });

  // 18/10/2026 — CẬP NHẬT theo trạng thái hiện tại (dọn test cũ của task-7): row settings đã được GỠ MOUNT
  //   để CÁCH LY lỗi popup Settings mất nội dung (xem docs/HANDOVER.md §1/§5 và git log 18/10/2026).
  //   Lead ghi lý do + hình dạng row vào `gbh.row_unmounted_ly_do`; ca "bước 0" cũ kỳ vọng gbh.row đang
  //   khai nên đỏ từ HEAD — không phải hồi quy.
  test("metadata: row settings ĐÃ MOUNT — disabled:true + insertDisabled:{js} + insertAs:settings-ours", () => {
    expect(MANIFEST_JSON.name).toBe("@galaxy-blackhole/gbh-settings");
    const gbh = MANIFEST_JSON.gbh as unknown as {
      row?: { id?: string; disabled?: unknown; insertAs?: string; insertDisabled?: { js?: string }; moduleIds?: string[]; aliases?: string[] };
      row_unmounted_ly_do?: unknown;
    };
    // 19/10/2026 (luật mới sau sự cố mount): row stock tắt VÔ ĐIỀU KIỆN, điều kiện gốc chuyển sang row INSERT.
    expect(gbh.row_unmounted_ly_do).toBeUndefined();
    expect(gbh.row?.id).toBe("settings");
    expect(gbh.row?.disabled).toBe(true);
    expect(gbh.row?.insertAs).toBe("settings-ours");
    expect(gbh.row?.insertDisabled).toEqual({ js: "!ctx.get('profileContext')" });
    expect(gbh.row?.moduleIds).toEqual(["@galaxy-blackhole/gbh-settings"]);
    expect(Array.isArray(gbh.row?.aliases)).toBe(true);
  });


});
