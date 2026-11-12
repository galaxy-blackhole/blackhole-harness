/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho slice SERVICE của @galaxy-blackhole/gbh-plugin-market: chờ nguồn ổn định, build gói ta
 *      (lib/index.js + lib/worker.js) ra mkdtemp, rồi chạy CẢ HAI bản trên Context cordis THẬT với seam giả
 *      pluginManager/settings — so từng method, mã RemoteError + details, cache, loader/volatile-update, dispose.
 *      Mọi ca stub globalThis.fetch: KHÔNG gọi mạng.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "plugin-market");
/** node_modules của kernel: dep external của cả hai bản phân giải về đây. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Bundle GỐC đã build trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(APP_MODULES, "@deepseek-ai", "dsh-plugin-market", "lib", "index.js");
/** Worker CJS của bản gốc. */
const STOCK_WORKER = join(APP_MODULES, "@deepseek-ai", "dsh-plugin-market", "lib", "worker.cjs");
/** cordis của kernel — Context THẬT dùng chung cho hai bên. */
const CORDIS = join(APP_MODULES, "@deepseek-ai", "cordis", "lib", "index.js");
/** typert-protocol của kernel — đọc marker @Remote. */
const TYPERT = join(APP_MODULES, "@deepseek-ai", "dsh-typert-protocol", "lib", "index.js");
/** cosmokit của kernel — ghi trường volatile của config như Loader. */
const COSMOKIT = join(APP_MODULES, "@deepseek-ai", "cosmokit", "lib", "index.js");
/** URL của index fixture. */
const MARKET_URL = "https://market.test/index.json";
/** Nguồn thứ hai của fixture. */
const OTHER_URL = "https://other.test/i.json";
/** Hạn mỗi ca: Worker Thread + build không bị coi là treo. */
const TIMEOUT = 30_000;
/** Tệp nguồn phải ỔN ĐỊNH trước khi build; service.ts + build.ts là hai tệp bắt buộc của slice này. */
const SOURCES = [
  "build.ts",
  "src/service.ts",
  "src/index-url.ts",
  "src/parse-thread.ts",
  "src/search.ts",
  "src/types.ts",
  "src/parse.ts",
  "src/worker.ts",
];

/** Ngủ ms mili giây. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Chữ ký kích thước của mọi tệp nguồn; -1 khi tệp chưa có. */
function sourceSignature(): string {
  return SOURCES.map((file) => {
    try {
      return String(statSync(join(PKG, file)).size);
    } catch {
      return "-1";
    }
  }).join(":");
}

/** Chờ mọi tệp nguồn tồn tại và kích thước KHÔNG đổi qua hai lần đo cách 300ms (hạn: deadline). */
async function waitForSources(deadline: number): Promise<void> {
  let signature = sourceSignature();
  while (Date.now() < deadline) {
    await sleep(300);
    const next = sourceSignature();
    if (!next.includes("-1") && next === signature) return;
    signature = next;
  }
  throw new Error("nguồn " + PKG + " không ổn định sau 180s (" + sourceSignature() + ")");
}

/** build.ts của gói ta — ưu tiên buildPackage (hai entry), lùi buildWorker. */
interface BuildModule {
  buildPackage?(outDir?: string): Promise<unknown>;
  buildWorker?(outDir?: string): Promise<unknown>;
}

/** Tìm artifact trong cây build, tối đa ba tầng và bỏ node_modules. */
function findArtifact(root: string, name: string): string {
  const queue: { dir: string; depth: number }[] = [{ dir: root, depth: 0 }];
  while (queue.length > 0) {
    const next = queue.shift() as { dir: string; depth: number };
    const candidate = join(next.dir, name);
    if (existsSync(candidate)) return candidate;
    if (next.depth >= 3) continue;
    for (const entry of readdirSync(next.dir, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== "node_modules") {
        queue.push({ dir: join(next.dir, entry.name), depth: next.depth + 1 });
      }
    }
  }
  throw new Error("không thấy " + name + " trong " + root);
}

/** Symlink node_modules: ưu tiên node_modules của package, lùi apps/host (dep external của lib/index.js). */
function linkModules(out: string, libDir: string): void {
  const pkgModules = join(PKG, "node_modules");
  if (out !== libDir && existsSync(pkgModules) && !existsSync(join(libDir, "node_modules"))) {
    symlinkSync(pkgModules, join(libDir, "node_modules"), "dir");
  }
  if (!existsSync(join(out, "node_modules"))) symlinkSync(APP_MODULES, join(out, "node_modules"), "dir");
}

/** Thư mục build tạm (dọn ở afterAll). */
let TEMP = "";

/** Build gói ta vào mkdtemp rồi trả hai artifact — KHÔNG nạp src trực tiếp. */
async function buildOurs(): Promise<{ index: string; worker: string }> {
  const out = mkdtempSync(join(tmpdir(), "gbh-plugin-market-"));
  TEMP = out;
  const deadline = Date.now() + 180_000;
  await waitForSources(deadline);
  const module = (await import(pathToFileURL(join(PKG, "build.ts")).href)) as BuildModule;
  const build = module.buildPackage ?? module.buildWorker;
  if (build === undefined) throw new Error("build.ts không export buildPackage/buildWorker");
  for (;;) {
    try {
      await build(out);
      break;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await sleep(500);
    }
  }
  const index = findArtifact(out, "index.js");
  const worker = findArtifact(out, "worker.js");
  linkModules(out, dirname(index));
  return { index, worker };
}

/** Hai artifact của bản ta. */
const ARTIFACTS = await buildOurs();
/** Service của ta, nạp từ ARTIFACT đã build. */
const oursModule = (await import(pathToFileURL(ARTIFACTS.index).href)) as PluginModule;
/** Bundle gốc — oracle. */
const stockModule = (await import(pathToFileURL(STOCK).href)) as PluginModule;
/** Context cordis THẬT của kernel. */
const { Context } = (await import(pathToFileURL(CORDIS).href)) as { Context: new () => unknown };
/** Trình đọc marker @Remote. */
const { remoteMethods } = (await import(pathToFileURL(TYPERT).href)) as {
  remoteMethods(service: object): readonly { method: string; mode?: string; invocation: { kind: string } }[];
};
/** Ghi trường volatile của config như Loader. */
const cosmokit = (await import(pathToFileURL(COSMOKIT).href)) as {
  createVolatile<T>(value: T): VolatileLike;
  updateVolatile(target: unknown, source: unknown): void;
};

afterAll(() => {
  if (TEMP !== "") rmSync(TEMP, { recursive: true, force: true });
});

/** Service của một bên, chỉ khai mặt test gọi tới. */
interface Service {
  listIndexes(): unknown;
  setIndexes(urls: string[]): Promise<void>;
  search(url: string, query: Record<string, unknown>): Promise<unknown>;
  entry(url: string, name: string): Promise<unknown>;
  readonly lifetime: { readonly signal: AbortSignal };
}

/** Lớp PluginMarket của một bên. */
interface PluginCtor {
  new (ctx: unknown, config: unknown): Service;
  readonly inject: readonly string[];
  readonly Config: ((raw: Record<string, unknown>) => Record<string, unknown>) & { toString(): string };
}

/** Module một bên. */
interface PluginModule {
  readonly default: PluginCtor;
}

/** Tham chiếu volatile: service đọc qua get(). */
interface VolatileLike {
  get(): readonly string[];
}

/** Context cordis thật, nhìn qua thành viên test dùng. */
interface CordisLike {
  readonly fiber: { entry?: { options: { id?: string } } };
  provide(name: string, value: unknown): unknown;
  on(event: string, listener: () => void): unknown;
  emit(event: string): void;
  effect(callback: () => unknown, label?: string): () => unknown;
  get(name: string): unknown;
}

/** Một bundle của hồ sơ, đúng các trường phép chú thích đọc. */
interface Bundle {
  readonly name: string;
  readonly installed: boolean;
  readonly version?: string;
  readonly availability?: "installation" | "profile" | "missing";
}

/** Tuỳ chọn của một giàn. */
interface RigOptions {
  readonly indexes?: readonly string[];
  /** Id mục profile; null = không có entry. */
  readonly entryId?: string | null;
  readonly settings?: boolean;
  readonly raw?: Record<string, unknown>;
  readonly bundles?: readonly Bundle[];
  readonly exemptions?: Readonly<Record<string, readonly string[]>>;
}

/** Giàn một bên: Context thật + seam giả + service + quan sát. */
interface Rig {
  readonly service: Service;
  readonly ctx: CordisLike;
  readonly base: CordisLike;
  readonly config: { indexes: VolatileLike };
  readonly effects: (() => unknown)[];
  readonly events: string[];
  readonly updates: { id: string; patch: unknown }[];
}

/** Dựng một giàn MỚI cho một bên: Context thật, seam pluginManager + settings, id entry trên fiber. */
function makeRig(plugin: PluginModule, options: RigOptions = {}): Rig {
  const base = new Context() as unknown as CordisLike;
  if (options.entryId !== null) base.fiber.entry = { options: { id: options.entryId ?? "plugin-market" } };
  const events: string[] = [];
  const updates: { id: string; patch: unknown }[] = [];
  const effects: (() => unknown)[] = [];
  base.on("plugin-market/changed", () => {
    events.push("changed");
  });
  if (options.settings !== false) {
    base.provide("settings", {
      update: async (id: string, patch: unknown): Promise<void> => {
        updates.push({ id, patch });
      },
    });
  }
  base.provide("pluginManager", {
    listBundles: async (): Promise<readonly Bundle[]> => (options.bundles ?? []).map((bundle) => ({ ...bundle })),
    listVersionExemptions: (): { exemptions: Readonly<Record<string, readonly string[]>> } => ({
      exemptions: { ...(options.exemptions ?? {}) },
    }),
  });
  const ctx = new Proxy(base, {
    get(target, property, receiver) {
      if (property === "effect") {
        return (callback: () => unknown, label?: string): (() => unknown) => {
          const dispose = target.effect(callback, label);
          effects.push(dispose);
          return dispose;
        };
      }
      return Reflect.get(target, property, receiver) as unknown;
    },
  }) as unknown as CordisLike;
  const config = {
    ...plugin.default.Config(options.raw ?? {}),
    indexes: cosmokit.createVolatile(options.indexes ?? []),
  };
  const service = new plugin.default(ctx, config);
  return { service, ctx, base, config: config as { indexes: VolatileLike }, effects, events, updates };
}

/** Kết quả một lần gọi: giá trị hoặc lỗi Remote đã lược về mã/thông điệp/details. */
type Outcome = { readonly value: unknown } | { readonly error: { code?: string; message?: string; details?: unknown } };

/** Gọi một phép đo, bắt RemoteError thành dữ liệu so được. */
async function attempt(run: () => unknown): Promise<Outcome> {
  try {
    return { value: await run() };
  } catch (error) {
    const typed = error as { code?: unknown; message?: unknown; details?: unknown };
    return {
      error: {
        code: typeof typed.code === "string" ? typed.code : undefined,
        message: typeof typed.message === "string" ? typed.message : undefined,
        details: typed.details,
      },
    };
  }
}

/** Bỏ mốc thời gian khỏi kết quả (mỗi bên fetch ở mili giây khác nhau); fetchedAt ⇒ "FETCHED". */
function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => scrub(item));
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, key === "fetchedAt" ? "FETCHED" : scrub(item)]),
  );
}

/** Chạy CÙNG kịch bản trên bản gốc rồi bản ta và so sâu (sau scrub). */
async function compare(prepare: (plugin: PluginModule) => Promise<unknown>): Promise<{ stock: unknown; ours: unknown }> {
  const stock = await prepare(stockModule);
  const ours = await prepare(oursModule);
  expect(scrub(ours)).toEqual(scrub(stock));
  return { stock, ours };
}

/** Stub fetch kèm nhật ký lời gọi. */
interface FetchStub {
  readonly calls: { readonly url: string; readonly init: RequestInit }[];
  fetch(url: string, init: RequestInit): Promise<Response>;
}

/** Dựng stub fetch đếm được. */
function fetchStub(handler: (url: string, init: RequestInit) => Promise<Response>): FetchStub {
  const calls: { url: string; init: RequestInit }[] = [];
  return {
    calls,
    async fetch(url: string, init: RequestInit): Promise<Response> {
      calls.push({ url, init });
      return await handler(url, init);
    },
  };
}

/** Gắn stub vào globalThis.fetch trong đúng một lần chạy rồi khôi phục. */
async function withFetch<T>(stub: FetchStub, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = stub.fetch as unknown as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

/** Response JSON của fixture. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** Index format 1 của fixture: 3 plugin, versions lệch thứ tự, category/labels/sortKeys/engines để đo (h)/(i). */
function marketIndex(): Record<string, unknown> {
  return {
    format: 1,
    title: { en: "Galaxy Market" },
    description: { en: "Market fixture" },
    metadata: {
      categories: { tools: { title: { en: "Tools" } } },
      labels: { official: { title: { en: "Official" } } },
      sortKeys: { stars: { title: { en: "Stars" }, order: "desc" } },
    },
    plugins: [
      {
        name: "@galaxy-blackhole/gbh-alpha",
        title: { en: "Alpha" },
        description: { en: "Alpha plugin" },
        author: "Galaxy",
        homepage: "https://galaxy.test/alpha",
        metadata: { category: "tools", labels: ["official"], keywords: ["alpha", "market"], sortKeys: { stars: 10 } },
        versions: [
          { version: "1.0.0", publishTimestamp: 1_700_000_000, source: { type: "npm" } },
          { version: "2.0.0-beta.1", publishTimestamp: 1_700_000_100, source: { type: "npm" } },
          {
            version: "1.2.0",
            publishTimestamp: 1_700_000_200,
            source: { type: "npm" },
            engines: { dsh: "^0.2.1-alpha.4" },
          },
        ],
      },
      {
        name: "@galaxy-blackhole/gbh-beta",
        title: "Beta",
        metadata: { category: "tools", keywords: ["beta"], sortKeys: { stars: 3 } },
        versions: [
          {
            version: "0.3.0",
            publishTimestamp: 1_700_000_300,
            source: { type: "git", url: "https://git.test/galaxy/beta", commit: "0123456789abcdef0123456789abcdef01234567" },
            engines: { dsh: ">=99.0.0" },
          },
        ],
      },
      {
        name: "@galaxy-blackhole/gbh-gamma",
        metadata: { keywords: ["gamma"] },
        versions: [
          { version: "0.1.0", publishTimestamp: 1_700_000_400, source: { type: "npm", registry: "https://npm.test/" } },
        ],
      },
    ],
  };
}

/** Truy vấn một trang toàn bộ, thứ tự chỉ mục. */
const PAGE: Record<string, unknown> = { sort: { kind: "index" }, offset: 0, limit: 100 };

describe("chuẩn bị: build ARTIFACT của ta, so với bundle gốc nạp động", () => {
  test("build ra lib/index.js + lib/worker.js; index trỏ worker.js của gói, stock trỏ worker.cjs", () => {
    expect(existsSync(ARTIFACTS.index)).toBe(true);
    expect(existsSync(ARTIFACTS.worker)).toBe(true);
    expect(existsSync(STOCK_WORKER)).toBe(true);
    const oursText = readFileSync(ARTIFACTS.index, "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(oursText).toContain('"./worker.js"');
    expect(oursText).not.toContain("worker.cjs");
    expect(stockText).toContain('"./worker.cjs"');
    expect(Object.keys(oursModule).sort()).toEqual([...Object.keys(stockModule), "PluginMarket"].sort()); // src/index.ts mới hơn lib 05:46: export default + named PluginMarket
    expect(oursModule.default.inject).toEqual(stockModule.default.inject);
    expect(oursModule.default.inject).toEqual(["pluginManager"]);
    expect(String(oursModule.default.Config)).toBe(String(stockModule.default.Config));
    const resolved = (plugin: PluginModule): Record<string, unknown> => {
      const config = plugin.default.Config({});
      return { ...config, indexes: (config["indexes"] as VolatileLike).get() };
    };
    expect(resolved(oursModule)).toEqual(resolved(stockModule));
    const failure = (plugin: PluginModule, raw: Record<string, unknown>): string => {
      try {
        plugin.default.Config(raw);
        return "KHONG NEM";
      } catch (error) {
        return (error as Error).message;
      }
    };
    for (const raw of [{ fetchTimeoutMs: 0 }, { maxBytes: 0 }, { cacheTtlMs: -1 }, { indexes: ["ftp://x/y"] }]) {
      expect(failure(oursModule, raw)).toBe(failure(stockModule, raw));
      expect(failure(oursModule, raw)).not.toBe("KHONG NEM");
    }
    const markers = (plugin: PluginModule): unknown => {
      const rig = makeRig(plugin);
      return remoteMethods(rig.service).map((marker) => ({ method: marker.method, kind: marker.invocation.kind, mode: marker.mode }));
    };
    const oursMarkers = markers(oursModule);
    expect(oursMarkers).toEqual(markers(stockModule));
    expect((oursMarkers as { method: string }[]).map((marker) => marker.method)).toEqual(["listIndexes", "setIndexes", "search"]);
  });
});
describe("(a) listIndexes — nguồn đã cấu hình, KHÔNG tải", () => {
  test("rỗng ⇒ [] (cả hai)", async () => {
    const { stock, ours } = await compare(async (plugin) => makeRig(plugin).service.listIndexes());
    expect(ours).toEqual([]);
    expect(stock).toEqual([]);
  }, TIMEOUT);

  test("URL không canonical bị báo, URL trùng chỉ tính MỘT", async () => {
    const { ours } = await compare(async (plugin) =>
      makeRig(plugin, { indexes: ["https://market.test", "https://market.test", MARKET_URL] }).service.listIndexes(),
    );
    expect(ours).toEqual([
      { url: "https://market.test", error: "Index URL is not in canonical form; use https://market.test/" },
      { url: MARKET_URL },
    ]);
  }, TIMEOUT);

  test("URL hỏng scheme / credentials / fragment ⇒ mỗi nguồn một lỗi đúng luật", async () => {
    const { ours } = await compare(async (plugin) =>
      makeRig(plugin, {
        indexes: ["ftp://market.test/i.json", "https://user:secret@market.test/i.json", "https://market.test/i.json#frag", MARKET_URL],
      }).service.listIndexes(),
    );
    expect(ours).toEqual([
      { url: "ftp://market.test/i.json", error: "Index URLs use http or https: ftp://market.test/i.json" },
      {
        url: "https://user:secret@market.test/i.json",
        error: "Index URLs carry no credentials or fragment: https://user:secret@market.test/i.json",
      },
      {
        url: "https://market.test/i.json#frag",
        error: "Index URLs carry no credentials or fragment: https://market.test/i.json#frag",
      },
      { url: MARKET_URL },
    ]);
  }, TIMEOUT);

  test("sau search: title/description của lần đọc cuối, lỗi của nguồn hỏng", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL, OTHER_URL] });
      await withFetch(fetchStub(async () => jsonResponse(marketIndex())), () => attempt(() => rig.service.search(MARKET_URL, PAGE)));
      await withFetch(
        fetchStub(async () => {
          throw new Error("down");
        }),
        () => attempt(() => rig.service.search(OTHER_URL, PAGE)),
      );
      return rig.service.listIndexes();
    });
    expect(ours).toEqual([
      { url: MARKET_URL, title: { en: "Galaxy Market" }, description: { en: "Market fixture" } },
      { url: OTHER_URL, error: "Could not fetch " + OTHER_URL + ": down" },
    ]);
  }, TIMEOUT);
});
describe("(b) setIndexes — ghi qua Settings, giữ nguyên chữ đã cấu hình", () => {
  test("hợp lệ ⇒ settings.update đúng entryId + patch indexes đã chuẩn hoá", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin);
      const outcome = await attempt(() => rig.service.setIndexes(["https://market.test", OTHER_URL]));
      return { outcome, updates: rig.updates, events: rig.events };
    });
    expect(ours).toEqual({
      outcome: { value: undefined },
      updates: [{ id: "plugin-market", patch: { indexes: ["https://market.test/", OTHER_URL] } }],
      events: [],
    });
  }, TIMEOUT);

  test("URL đã cấu hình được giữ NGUYÊN như đã viết", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: ["https://market.test"] });
      const outcome = await attempt(() => rig.service.setIndexes(["https://market.test", "https://a.test/x.json"]));
      return { outcome, updates: rig.updates };
    });
    expect((ours as { updates: unknown }).updates).toEqual([
      { id: "plugin-market", patch: { indexes: ["https://market.test", "https://a.test/x.json"] } },
    ]);
  }, TIMEOUT);

  test("URL trùng ⇒ invalid-index-url reason duplicate (trùng sau chuẩn hoá cũng bắt)", async () => {
    const { ours } = await compare(async (plugin) => {
      const same = await attempt(() => makeRig(plugin).service.setIndexes([OTHER_URL, OTHER_URL]));
      const normalized = await attempt(() => makeRig(plugin).service.setIndexes(["https://a.test", "https://a.test/"]));
      return { same, normalized };
    });
    expect(ours).toEqual({
      same: {
        error: {
          code: "plugin-market/invalid-index-url",
          message: "Index source listed twice: " + OTHER_URL,
          details: { url: OTHER_URL, reason: "duplicate" },
        },
      },
      normalized: {
        error: {
          code: "plugin-market/invalid-index-url",
          message: "Index source listed twice: https://a.test/",
          details: { url: "https://a.test/", reason: "duplicate" },
        },
      },
    });
  }, TIMEOUT);

  test("thiếu settings service / thiếu entryId ⇒ settings-unavailable, KHÔNG gọi update", async () => {
    const { ours } = await compare(async (plugin) => {
      const noSettings = makeRig(plugin, { settings: false });
      const noEntry = makeRig(plugin, { entryId: null });
      return {
        noSettings: { outcome: await attempt(() => noSettings.service.setIndexes([OTHER_URL])), updates: noSettings.updates },
        noEntry: { outcome: await attempt(() => noEntry.service.setIndexes([OTHER_URL])), updates: noEntry.updates },
      };
    });
    const expected = {
      error: {
        code: "plugin-market/settings-unavailable",
        message: "Index sources require the settings service and a profile entry",
        details: {},
      },
    };
    expect(ours).toEqual({ noSettings: { outcome: expected, updates: [] }, noEntry: { outcome: expected, updates: [] } });
  }, TIMEOUT);
});
describe("(c) search — kiểm truy vấn và nguồn trước khi tải", () => {
  test("offset âm hoặc không nguyên ⇒ invalid-query field offset", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL] });
      return {
        negative: await attempt(() => rig.service.search(MARKET_URL, { ...PAGE, offset: -1 })),
        fractional: await attempt(() => rig.service.search(MARKET_URL, { ...PAGE, offset: 1.5 })),
      };
    });
    for (const outcome of Object.values(ours as Record<string, Outcome>)) {
      expect(outcome).toEqual({
        error: {
          code: "plugin-market/invalid-query",
          message: "offset must be a non-negative integer",
          details: { field: "offset", reason: "range" },
        },
      });
    }
  }, TIMEOUT);

  test("limit 0 / 101 / không nguyên ⇒ invalid-query field limit", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL] });
      return {
        zero: await attempt(() => rig.service.search(MARKET_URL, { ...PAGE, limit: 0 })),
        over: await attempt(() => rig.service.search(MARKET_URL, { ...PAGE, limit: 101 })),
        fractional: await attempt(() => rig.service.search(MARKET_URL, { ...PAGE, limit: 1.5 })),
      };
    });
    for (const outcome of Object.values(ours as Record<string, Outcome>)) {
      expect(outcome).toEqual({
        error: {
          code: "plugin-market/invalid-query",
          message: "limit must be an integer from 1 to 100",
          details: { field: "limit", reason: "range" },
        },
      });
    }
  }, TIMEOUT);

  test("URL chưa cấu hình ⇒ unknown-index; URL cấu hình nhưng hỏng ⇒ invalid-index-url configured", async () => {
    const { ours } = await compare(async (plugin) => {
      const unknown = await attempt(() => makeRig(plugin, { indexes: [MARKET_URL] }).service.search(OTHER_URL, PAGE));
      const rig = makeRig(plugin, { indexes: ["https://market.test"] });
      const stub = fetchStub(async () => jsonResponse(marketIndex()));
      const broken = await withFetch(stub, () => attempt(() => rig.service.search("https://market.test", PAGE)));
      return { unknown, broken, calls: stub.calls.length };
    });
    expect(ours).toEqual({
      unknown: {
        error: {
          code: "plugin-market/unknown-index",
          message: "Not a configured index source: " + OTHER_URL,
          details: { url: OTHER_URL },
        },
      },
      broken: {
        error: {
          code: "plugin-market/invalid-index-url",
          message: "Index URL is not in canonical form; use https://market.test/",
          details: { url: "https://market.test", reason: "configured" },
        },
      },
      calls: 0,
    });
  }, TIMEOUT);
});
describe("(d) fetch-failed — cùng mã, cùng details.url/reason", () => {
  test("fetch ném lỗi ⇒ reason là chính thông điệp; options redirect=error + accept JSON", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL] });
      const stub = fetchStub(async () => {
        throw new Error("boom");
      });
      const outcome = await withFetch(stub, () => attempt(() => rig.service.search(MARKET_URL, PAGE)));
      return {
        outcome,
        redirect: stub.calls[0]?.init.redirect,
        accept: (stub.calls[0]?.init.headers as Record<string, string> | undefined)?.accept,
      };
    });
    expect(ours).toEqual({
      outcome: {
        error: {
          code: "plugin-market/fetch-failed",
          message: "Could not fetch " + MARKET_URL + ": boom",
          details: { url: MARKET_URL, reason: "boom" },
        },
      },
      redirect: "error",
      accept: "application/json",
    });
  }, TIMEOUT);

  test("redirect:error (TypeError kèm cause) và HTTP 500 ⇒ đúng reason", async () => {
    const { ours } = await compare(async (plugin) => {
      const redirected = makeRig(plugin, { indexes: [MARKET_URL] });
      const redirectStub = fetchStub(async () => {
        throw new TypeError("fetch failed", { cause: new Error("unexpected redirect") });
      });
      const redirect = await withFetch(redirectStub, () => attempt(() => redirected.service.search(MARKET_URL, PAGE)));
      const failed = makeRig(plugin, { indexes: [MARKET_URL] });
      const httpStub = fetchStub(async () => new Response("", { status: 500 }));
      const http = await withFetch(httpStub, () => attempt(() => failed.service.search(MARKET_URL, PAGE)));
      return { redirect, http };
    });
    expect(ours).toEqual({
      redirect: {
        error: {
          code: "plugin-market/fetch-failed",
          message: "Could not fetch " + MARKET_URL + ": fetch failed: unexpected redirect",
          details: { url: MARKET_URL, reason: "fetch failed: unexpected redirect" },
        },
      },
      http: {
        error: {
          code: "plugin-market/fetch-failed",
          message: "Could not fetch " + MARKET_URL + ": HTTP 500",
          details: { url: MARKET_URL, reason: "HTTP 500" },
        },
      },
    });
  }, TIMEOUT);

  test("content-length hoặc LUỒNG vượt maxBytes ⇒ fetch-failed body exceeds", async () => {
    const { ours } = await compare(async (plugin) => {
      const byHeader = makeRig(plugin, { indexes: [MARKET_URL], raw: { maxBytes: 10 } });
      const headerStub = fetchStub(async () => new Response("{}", { status: 200, headers: { "content-length": "1000" } }));
      const header = await withFetch(headerStub, () => attempt(() => byHeader.service.search(MARKET_URL, PAGE)));
      const byStream = makeRig(plugin, { indexes: [MARKET_URL], raw: { maxBytes: 10 } });
      const streamStub = fetchStub(async () => new Response(new Uint8Array(100), { status: 200 }));
      const stream = await withFetch(streamStub, () => attempt(() => byStream.service.search(MARKET_URL, PAGE)));
      return { header, stream };
    });
    const expected = {
      error: {
        code: "plugin-market/fetch-failed",
        message: "Could not fetch " + MARKET_URL + ": body exceeds 10 bytes",
        details: { url: MARKET_URL, reason: "body exceeds 10 bytes" },
      },
    };
    expect(ours).toEqual({ header: expected, stream: expected });
  }, TIMEOUT);
});
describe("(e) invalid-index — parse trong Worker THẬT của ta vs worker.cjs", () => {
  test("body không UTF-8 / JSON hỏng / sai format ⇒ invalid-index kèm path + reason", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL] });
      const bodies = [
        new Uint8Array([0xff, 0xfe]),
        new TextEncoder().encode("{not json"),
        new TextEncoder().encode(JSON.stringify({})),
      ];
      const outcomes: Outcome[] = [];
      for (const body of bodies) {
        const stub = fetchStub(async () => new Response(body, { status: 200 }));
        outcomes.push(await withFetch(stub, () => attempt(() => rig.service.search(MARKET_URL, PAGE))));
      }
      return outcomes;
    });
    const [utf8, json, format] = ours as Outcome[];
    expect(utf8).toEqual({
      error: {
        code: "plugin-market/invalid-index",
        message: MARKET_URL + ": must be UTF-8",
        details: { url: MARKET_URL, path: "$", reason: "must be UTF-8" },
      },
    });
    const jsonError = (json as { error?: { code?: string; details?: { path?: string; reason?: string } } }).error;
    expect(jsonError?.code).toBe("plugin-market/invalid-index");
    expect(jsonError?.details?.path).toBe("$");
    expect(jsonError?.details?.reason).toMatch(/^must be JSON: /);
    expect(format).toEqual({
      error: {
        code: "plugin-market/invalid-index",
        message: MARKET_URL + ": $.format must be 1",
        details: { url: MARKET_URL, path: "$.format", reason: "must be 1" },
      },
    });
  }, TIMEOUT);
});
describe("(f) cache — tài liệu dùng lại theo cacheTtlMs, fetchedAt nối trang", () => {
  test("2 lần search cùng URL chỉ fetch MỘT lần; refresh:true fetch lại", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL] });
      const stub = fetchStub(async () => jsonResponse(marketIndex()));
      return await withFetch(stub, async () => {
        const first = (await rig.service.search(MARKET_URL, PAGE)) as { fetchedAt: number };
        const countAfterFirst = stub.calls.length;
        const second = (await rig.service.search(MARKET_URL, PAGE)) as { fetchedAt: number };
        const refreshed = (await rig.service.search(MARKET_URL, { ...PAGE, refresh: true })) as { fetchedAt: number };
        return {
          first,
          second,
          refreshed,
          countAfterFirst,
          count: stub.calls.length,
          sameDocument: first.fetchedAt === second.fetchedAt,
          refreshIsNew: refreshed.fetchedAt !== first.fetchedAt,
        };
      });
    });
    expect((ours as { countAfterFirst: number }).countAfterFirst).toBe(1);
    expect((ours as { count: number }).count).toBe(2);
    expect((ours as { sameDocument: boolean }).sameDocument).toBe(true);
    expect((ours as { refreshIsNew: boolean }).refreshIsNew).toBe(true);
  }, TIMEOUT);

  test("cacheTtlMs=0 ⇒ fetch lại; fetchedAt của tài liệu đang nhớ ⇒ KHÔNG fetch lại", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL], raw: { cacheTtlMs: 0 } });
      const stub = fetchStub(async () => jsonResponse(marketIndex()));
      return await withFetch(stub, async () => {
        const first = (await rig.service.search(MARKET_URL, PAGE)) as { fetchedAt: number };
        await sleep(3);
        const second = (await rig.service.search(MARKET_URL, PAGE)) as { fetchedAt: number };
        const afterSecond = stub.calls.length;
        const replayed = (await rig.service.search(MARKET_URL, { ...PAGE, fetchedAt: second.fetchedAt })) as { fetchedAt: number };
        const afterReplay = stub.calls.length;
        const stale = (await rig.service.search(MARKET_URL, { ...PAGE, fetchedAt: second.fetchedAt - 1 })) as { fetchedAt: number };
        return {
          firstDiffers: second.fetchedAt !== first.fetchedAt,
          afterSecond,
          replayIsSame: replayed.fetchedAt === second.fetchedAt,
          afterReplay,
          staleIsNew: stale.fetchedAt !== second.fetchedAt,
          total: stub.calls.length,
        };
      });
    });
    expect(ours).toEqual({
      firstDiffers: true,
      afterSecond: 2,
      replayIsSame: true,
      afterReplay: 2,
      staleIsNew: true,
      total: 3,
    });
  }, TIMEOUT);
});
describe("(g) concurrent — hai search song song cùng URL dùng chung MỘT lần tải", () => {
  test("fetch 1 lần, hai kết quả cùng một tài liệu", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL] });
      const stub = fetchStub(async () => {
        await sleep(30);
        return jsonResponse(marketIndex());
      });
      return await withFetch(stub, async () => {
        const [left, right] = (await Promise.all([
          rig.service.search(MARKET_URL, PAGE),
          rig.service.search(MARKET_URL, PAGE),
        ])) as { fetchedAt: number }[];
        return { calls: stub.calls.length, same: left?.fetchedAt === right?.fetchedAt, left, right };
      });
    });
    expect((ours as { calls: number }).calls).toBe(1);
    expect((ours as { same: boolean }).same).toBe(true);
  }, TIMEOUT);
});
describe("(h) entry — listing đầy đủ hoặc undefined", () => {
  test("tên có trong index ⇒ installation/compatibility/install/defaultVersion đầy đủ", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, {
        indexes: [MARKET_URL],
        bundles: [{ name: "@galaxy-blackhole/gbh-alpha", installed: true, version: "1.2.0", availability: "profile" }],
      });
      const stub = fetchStub(async () => jsonResponse(marketIndex()));
      return { entry: await withFetch(stub, () => rig.service.entry(MARKET_URL, "@galaxy-blackhole/gbh-alpha")), calls: stub.calls.length };
    });
    const entry = (ours as { entry: Record<string, unknown> }).entry;
    expect((ours as { calls: number }).calls).toBe(1);
    expect(entry["defaultVersion"]).toBe("1.2.0");
    expect(entry["installation"]).toEqual({ status: "installed", installedVersion: "1.2.0" });
    const versions = entry["versions"] as Record<string, unknown>[];
    expect(versions.map((version) => version["version"])).toEqual(["2.0.0-beta.1", "1.2.0", "1.0.0"]);
    expect(versions.map((version) => (version["install"] as { spec: string }).spec)).toEqual([
      "@galaxy-blackhole/gbh-alpha@2.0.0-beta.1",
      "@galaxy-blackhole/gbh-alpha@1.2.0",
      "@galaxy-blackhole/gbh-alpha@1.0.0",
    ]);
    expect(versions.map((version) => (version["compatibility"] as { compatible: boolean }).compatible)).toEqual([true, true, true]);
    expect(entry["metadata"]).toEqual({
      category: "tools",
      keywords: ["alpha", "market"],
      labels: ["official"],
      sortKeys: { stars: 10 },
    });
  }, TIMEOUT);

  test("tên KHÔNG có trong index ⇒ undefined", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL] });
      const stub = fetchStub(async () => jsonResponse(marketIndex()));
      const entry = await withFetch(stub, () => rig.service.entry(MARKET_URL, "@galaxy-blackhole/gbh-khong-co"));
      return { entry, defined: entry !== undefined };
    });
    expect((ours as { defined: boolean }).defined).toBe(false);
  }, TIMEOUT);
});
describe("(i) listingOf qua entry — trạng thái cài đặt và tương thích", () => {
  test("installed / update-available / different-version / provided / not-installed", async () => {
    const cases: { label: string; bundle?: Bundle; status: string }[] = [
      { label: "installed", bundle: { name: "@galaxy-blackhole/gbh-alpha", installed: true, version: "1.2.0" }, status: "installed" },
      { label: "update", bundle: { name: "@galaxy-blackhole/gbh-alpha", installed: true, version: "1.0.0" }, status: "update-available" },
      { label: "lower", bundle: { name: "@galaxy-blackhole/gbh-alpha", installed: true, version: "9.0.0" }, status: "different-version" },
      { label: "bad", bundle: { name: "@galaxy-blackhole/gbh-alpha", installed: true, version: "not-semver" }, status: "different-version" },
      {
        label: "provided",
        bundle: { name: "@galaxy-blackhole/gbh-alpha", installed: false, availability: "installation", version: "0.1.0" },
        status: "provided",
      },
      { label: "none", status: "not-installed" },
    ];
    for (const item of cases) {
      const { ours } = await compare(async (plugin) => {
        const rig = makeRig(plugin, { indexes: [MARKET_URL], bundles: item.bundle === undefined ? [] : [item.bundle] });
        const stub = fetchStub(async () => jsonResponse(marketIndex()));
        return await withFetch(stub, () => rig.service.entry(MARKET_URL, "@galaxy-blackhole/gbh-alpha"));
      });
      const installation = (ours as { installation: { status: string; installedVersion?: string } }).installation;
      expect(installation.status).toBe(item.status);
      if (item.status === "provided") expect(installation.installedVersion).toBe("0.1.0");
    }
  }, 60_000);

  test("engines.dsh không thoả ⇒ compatible:false + runtimeVersion/requirements/exempted (kèm miễn trừ)", async () => {
    for (const exemptions of [undefined, { "@galaxy-blackhole/gbh-beta@0.3.0": ["0.2.1-alpha.4"] }]) {
      const { ours } = await compare(async (plugin) => {
        const rig = makeRig(plugin, { indexes: [MARKET_URL], exemptions });
        const stub = fetchStub(async () => jsonResponse(marketIndex()));
        return await withFetch(stub, () => rig.service.entry(MARKET_URL, "@galaxy-blackhole/gbh-beta"));
      });
      const entry = ours as { versions: { compatibility: unknown }[]; defaultVersion?: string; installation: unknown };
      expect(entry.versions[0]?.compatibility).toEqual({
        compatible: false,
        runtimeVersion: "0.2.1-alpha.4",
        requirements: { "engines.dsh": ">=99.0.0" },
        exempted: exemptions !== undefined,
      });
      expect(entry.defaultVersion).toBeUndefined();
      expect(entry.installation).toEqual({ status: "not-installed" });
    }
  }, 60_000);
});
describe("(j) loader/volatile-update — dọn cache/errors của URL bị bỏ + emit changed", () => {
  test("bỏ URL khỏi config.indexes rồi emit ⇒ nguồn biến mất, cache/errors bị dọn, changed phát", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL, OTHER_URL] });
      const stub = fetchStub(async (url) => {
        if (url === OTHER_URL) throw new Error("down");
        return jsonResponse(marketIndex());
      });
      return await withFetch(stub, async () => {
        await attempt(() => rig.service.search(MARKET_URL, PAGE));
        await attempt(() => rig.service.search(OTHER_URL, PAGE));
        const before = rig.service.listIndexes();
        const write = (indexes: string[]): void => {
          cosmokit.updateVolatile(rig.config.indexes, cosmokit.createVolatile(indexes));
          rig.base.emit("loader/volatile-update");
        };
        write([OTHER_URL]);
        const afterDropMarket = rig.service.listIndexes();
        write([MARKET_URL]);
        const afterDropOther = rig.service.listIndexes();
        write([MARKET_URL, OTHER_URL]);
        const afterRestore = rig.service.listIndexes();
        await attempt(() => rig.service.search(MARKET_URL, PAGE));
        await attempt(() => rig.service.search(OTHER_URL, PAGE));
        return {
          before,
          afterDropMarket,
          afterDropOther,
          afterRestore,
          marketCalls: stub.calls.filter((call) => call.url === MARKET_URL).length,
          otherCalls: stub.calls.filter((call) => call.url === OTHER_URL).length,
          events: rig.events,
        };
      });
    });
    const measured = ours as {
      before: unknown;
      afterDropMarket: unknown;
      afterDropOther: unknown;
      afterRestore: unknown;
      marketCalls: number;
      otherCalls: number;
      events: string[];
    };
    expect(measured.before).toEqual([
      { url: MARKET_URL, title: { en: "Galaxy Market" }, description: { en: "Market fixture" } },
      { url: OTHER_URL, error: "Could not fetch " + OTHER_URL + ": down" },
    ]);
    expect(measured.afterDropMarket).toEqual([{ url: OTHER_URL, error: "Could not fetch " + OTHER_URL + ": down" }]);
    // Cache của MARKET bị dọn ở lượt đầu; lỗi của OTHER bị dọn ở lượt hai ⇒ cả hai đều KHÔNG còn dữ kiện.
    expect(measured.afterDropOther).toEqual([{ url: MARKET_URL }]);
    expect(measured.afterRestore).toEqual([{ url: MARKET_URL }, { url: OTHER_URL }]);
    // Đọc lại phải TẢI LẠI (2 lần mỗi URL): cache và errors đã bị dọn.
    expect(measured.marketCalls).toBe(2);
    expect(measured.otherCalls).toBe(2);
    expect(measured.events).toEqual(["changed", "changed", "changed"]);
  }, 60_000);
});
describe("(k) dispose — ctx.effect cleanup huỷ lifetime và settle pending", () => {
  test("abort lifetime, search đang chờ reject fetch-failed và KHÔNG treo", async () => {
    const { ours } = await compare(async (plugin) => {
      const rig = makeRig(plugin, { indexes: [MARKET_URL] });
      let aborted = false;
      const stub = fetchStub(
        async (_url, init) =>
          await new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(new Error("aborted"));
              },
              { once: true },
            );
          }),
      );
      return await withFetch(stub, async () => {
        const pending = attempt(() => rig.service.search(MARKET_URL, PAGE));
        await sleep(20);
        const disposers = rig.effects.length;
        await Promise.all(rig.effects.map((dispose) => dispose()));
        const settled = await Promise.race([pending, sleep(5_000).then(() => "TREO" as const)]);
        return {
          disposers,
          aborted,
          lifetimeAborted: rig.service.lifetime.signal.aborted,
          settled: settled === "TREO" ? "TREO" : scrub(settled),
          list: rig.service.listIndexes(),
        };
      });
    });
    const measured = ours as { disposers: number; lifetimeAborted: boolean; settled: unknown; aborted: boolean };
    expect(measured.disposers).toBe(1);
    expect(measured.lifetimeAborted).toBe(true);
    expect(measured.aborted).toBe(true);
    expect(measured.settled).not.toBe("TREO");
    expect((measured.settled as { error?: { code?: string } }).error?.code).toBe("plugin-market/fetch-failed");
  }, TIMEOUT);
});