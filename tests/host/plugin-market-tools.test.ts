/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho slice TOOLS (plugin thứ hai, tool 'plugin_market') của @galaxy-blackhole/gbh-plugin-market:
 *      chờ nguồn ổn định, build gói ta ra mkdtemp rồi so lib/tools.js với bản gốc
 *      @deepseek-ai/dsh-plugin-market/lib/types/tools.js trên CÙNG fake ctx/pluginMarket — inject/register,
 *      definition, ba action, pageOf, untilAborted. KHÔNG gọi mạng.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "plugin-market");
/** node_modules của kernel: đích dự phòng cho dep external của cả hai bản. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Bundle GỐC tools.js (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK = join(APP_MODULES, "@deepseek-ai", "dsh-plugin-market", "lib", "types", "tools.js");
/** URL chỉ mục fixture. */
const INDEX_URL = "https://market.test/index.json";
/** Câu lỗi CHUNG của pageOf cho cả list_plugins và list_versions. */
const PAGE_ERROR = "offset must be a non-negative integer and limit must be an integer from 1 to 100";
/** Ngưỡng cắt text của tool, tính bằng UTF-16 code unit. */
const MAX_TEXT = 300;
/** Chuỗi dài hơn ngưỡng để kiểm cắt + dấu ba chấm. */
const LONG = "x".repeat(MAX_TEXT + 50);
/** Tệp nguồn phải ỔN ĐỊNH trước khi build; build.ts sinh ba entry (index/worker/tools). */
const SOURCES = ["build.ts", "src/tools.ts"];

/** Ngủ ms mili giây. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Chữ ký kích thước của hai tệp nguồn; -1 khi tệp chưa có. */
function sourceSignature(): string {
  return SOURCES.map((file) => {
    try {
      return String(statSync(join(PKG, file)).size);
    } catch {
      return "-1";
    }
  }).join(":");
}

/** Chờ hai tệp nguồn tồn tại và kích thước KHÔNG đổi qua hai lần đo cách 300ms (hạn: deadline). */
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

/** build.ts của gói ta — ưu tiên buildPackage (ba entry), lùi buildTools. */
interface BuildModule {
  buildPackage?(outDir?: string): Promise<unknown>;
  buildTools?(outDir?: string): Promise<unknown>;
}

/** Tìm artifact trong cây build, tối đa ba tầng và bỏ node_modules; undefined khi không thấy. */
function findArtifact(root: string, name: string): string | undefined {
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
  return undefined;
}

/** Symlink node_modules: của PACKAGE vào thư mục artifact, lùi node_modules kernel ở gốc build. */
function linkModules(root: string, libDir: string): void {
  const pkgModules = join(PKG, "node_modules");
  if (libDir !== root && existsSync(pkgModules) && !existsSync(join(libDir, "node_modules"))) {
    symlinkSync(pkgModules, join(libDir, "node_modules"), "dir");
  }
  if (!existsSync(join(root, "node_modules"))) symlinkSync(APP_MODULES, join(root, "node_modules"), "dir");
}

/** Thư mục build tạm (dọn ở afterAll). */
let TEMP = "";

/** Build gói ta vào mkdtemp rồi trả artifact tools.js — KHÔNG nạp src trực tiếp. */
async function buildOurs(): Promise<string> {
  TEMP = mkdtempSync(join(tmpdir(), "gbh-plugin-market-tools-"));
  const out = join(TEMP, "lib");
  mkdirSync(out, { recursive: true });
  const deadline = Date.now() + 180_000;
  await waitForSources(deadline);
  const module = (await import(pathToFileURL(join(PKG, "build.ts")).href)) as BuildModule;
  const build = module.buildPackage ?? module.buildTools;
  if (build === undefined) throw new Error("build.ts không export buildPackage/buildTools");
  for (;;) {
    try {
      await build(out);
      break;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await sleep(500);
    }
  }
  let tools = findArtifact(TEMP, "tools.js");
  if (tools === undefined && module.buildTools !== undefined) tools = await module.buildTools(out) as string;
  if (tools === undefined) throw new Error("build.ts không build tools.js trong " + out);
  linkModules(TEMP, dirname(tools));
  return tools;
}

/** Artifact tools.js của ta. */
const OURS_ARTIFACT = await buildOurs();

afterAll(() => {
  if (TEMP !== "") rmSync(TEMP, { recursive: true, force: true });
});

/** Lệnh exec tối thiểu mà execute cần. */
interface ToolExec {
  /** Tín hiệu huỷ của lượt gọi. */
  signal: AbortSignal;
}

/** Definition đã đăng ký; chỉ khai báo trường test chạm tới. */
interface ToolDefinition {
  /** Tên tool. */
  name: string;
  /** Mô tả cho model. */
  description: string;
  /** JSON Schema tham số đã biên dịch. */
  parameters: {
    type?: string;
    properties?: Record<string, Record<string, unknown>>;
    required?: string[];
  };
  /** Output schema + renderer. */
  output: {
    schema: unknown;
    render(args: Record<string, unknown>, value: string): unknown;
  };
  /** Thân execute đã bọc validate. */
  execute(args: Record<string, unknown>, exec: ToolExec): Promise<string>;
  /** Presenter của lượt gọi (đã bọc validate). */
  presentCall?(args: Record<string, unknown>): unknown;
  /** Các khoá khác của definition. */
  [key: string]: unknown;
}

/** Plugin entry của ta và bản gốc. */
interface ToolModule {
  /** Service phụ thuộc khai báo ở module. */
  inject: readonly string[];
  /** Đăng ký tool trong scope có pluginMarket. */
  apply(ctx: unknown): void;
}

/** Seam pluginMarket tối thiểu mà tool gọi. */
interface FakeMarket {
  listIndexes(): readonly Record<string, unknown>[];
  search(url: string, query: Record<string, unknown>): Promise<Record<string, unknown>>;
  entry(url: string, name: string): Promise<Record<string, unknown> | undefined>;
}

/** Nhật ký gọi của một phía. */
interface MarketCalls {
  search: { url: string; query: Record<string, unknown> }[];
  entry: { url: string; name: string }[];
}

/** Một phía: seam giả + nhật ký gọi. */
interface MarketFixture {
  market: FakeMarket;
  calls: MarketCalls;
}

/** Kết quả một lượt execute: giá trị JSON hoặc lỗi đã chuẩn hoá. */
type Outcome =
  | { ok: true; value: string }
  | { ok: false; name: string; message: string };

/** Dựng một trang search result đúng hình dạng MarketSearchResult (chỉ trường tool đọc). */
function searchResult(entries: readonly Record<string, unknown>[], total: number, nextOffset: number | null): Record<string, unknown> {
  return { url: INDEX_URL, title: { en: "Main Index" }, metadata: {}, fetchedAt: 1, entries, total, nextOffset };
}

/** Dựng một seam giả; parts thay handler search/entry/listIndexes, calls ghi lại tham số. */
function marketOf(parts: Partial<FakeMarket> = {}): MarketFixture {
  const calls: MarketCalls = { search: [], entry: [] };
  const market: FakeMarket = {
    listIndexes: () => (parts.listIndexes === undefined ? [] : parts.listIndexes()),
    search: async (url, query) => {
      calls.search.push({ url, query: structuredClone(query) });
      return parts.search === undefined ? searchResult([], 0, null) : parts.search(url, query);
    },
    entry: async (url, name) => {
      calls.entry.push({ url, name });
      return parts.entry === undefined ? undefined : parts.entry(url, name);
    },
  };
  return { market, calls };
}

/** Fake ctx: register gom definition, inject gọi callback NGAY với scope có pluginMarket. */
function capture(module: ToolModule, market: FakeMarket): { def: ToolDefinition; injectCalls: string[][]; events: string[] } {
  const defs: ToolDefinition[] = [];
  const injectCalls: string[][] = [];
  const events: string[] = [];
  const tools = {
    register(def: ToolDefinition): void {
      defs.push(def);
      events.push("register:" + def.name);
    },
  };
  // 08/11/2026 (PHASE B): bundle của TA đọc sổ tool qua đường CẤU TRÚC `ctx.get("tools")` (ADR 000d),
  // còn bundle GỐC đọc `ctx.tools` trực tiếp ⇒ giả lập CẢ HAI đường trên CÙNG một sổ tool.
  const scopeCtx = { tools, pluginMarket: market, get: (name: string) => (name === "tools" ? tools : undefined) };
  const ctx = {
    tools,
    get: (name: string) => (name === "tools" ? tools : undefined),
    inject(names: string[], callback: (scope: unknown) => void): void {
      injectCalls.push([...names]);
      events.push("inject:" + names.join(","));
      callback(scopeCtx);
    },
  };
  module.apply(ctx);
  expect(injectCalls).toEqual([["pluginMarket"]]);
  expect(defs).toHaveLength(1);
  return { def: defs[0] as ToolDefinition, injectCalls, events };
}

/** Thay MỌI hàm bằng marker để so sâu toàn bộ definition (kể cả khoá hàm có mặt hay không). */
function mask(value: unknown): unknown {
  if (typeof value === "function") return "[function]";
  if (Array.isArray(value)) return value.map(mask);
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      result[key] = mask((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
}

/** Exec tươi: mỗi phía một signal riêng, chưa huỷ. */
function freshExec(): ToolExec {
  return { signal: new AbortController().signal };
}

/** Chạy một definition và chuẩn hoá kết quả/lỗi thành Outcome. */
async function invoke(def: ToolDefinition, args: Record<string, unknown>, exec: ToolExec): Promise<Outcome> {
  try {
    return { ok: true, value: await def.execute(args, exec) };
  } catch (error) {
    return error instanceof Error
      ? { ok: false, name: error.name, message: error.message }
      : { ok: false, name: typeof error, message: String(error) };
  }
}

/** Chạy CÙNG args trên stock rồi ours với hai fixture độc lập; so outcome + nhật ký gọi. */
async function executeBoth(
  args: Record<string, unknown>,
  makeMarket: () => MarketFixture,
): Promise<{ outcome: Outcome; calls: MarketCalls }> {
  const stockFixture = makeMarket();
  const stockSide = capture(STOCK_MODULE, stockFixture.market);
  const oursFixture = makeMarket();
  const oursSide = capture(OURS_MODULE, oursFixture.market);
  const stockOutcome = await invoke(stockSide.def, args, freshExec());
  const oursOutcome = await invoke(oursSide.def, args, freshExec());
  expect(oursOutcome).toEqual(stockOutcome);
  expect(oursFixture.calls).toEqual(stockFixture.calls);
  return { outcome: oursOutcome, calls: oursFixture.calls };
}

/** Khẳng định outcome thành công rồi parse JSON. */
function parsed(outcome: Outcome): unknown {
  expect(outcome.ok).toBe(true);
  if (!outcome.ok) throw new Error("unreachable");
  return JSON.parse(outcome.value);
}

/** Khẳng định outcome thất bại rồi trả message. */
function errorText(outcome: Outcome): string {
  expect(outcome.ok).toBe(false);
  return outcome.ok ? "" : outcome.message;
}

/** Khẳng định outcome thất bại rồi trả tên lỗi. */
function errorName(outcome: Outcome): string {
  expect(outcome.ok).toBe(false);
  return outcome.ok ? "" : outcome.name;
}

/** Promise hoãn để mô phỏng fetch dùng chung còn treo. */
interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

/** Tạo một Deferred. */
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

/** Một phiên bản đúng hình dạng MarketListingVersion (chỉ trường tool đọc). */
function versionOf(version: string, publishTimestamp: number, registry?: string): Record<string, unknown> {
  return {
    version,
    publishTimestamp,
    compatibility: { compatible: true },
    install: { spec: "npm:alpha@" + version, ...(registry === undefined ? {} : { registry }) },
  };
}

/** Plugin đầy đủ trường: defaultVersion chọn được, mọi text bản địa hoá lấy .en. */
const ALPHA: Record<string, unknown> = {
  name: "alpha",
  title: { en: "Alpha Tools", vi: "Công cụ Alpha" },
  description: { en: "Alpha description" },
  author: { en: "Ann Author" },
  homepage: "https://alpha.test",
  repository: "https://github.com/alpha/alpha",
  metadata: { category: "tools", labels: ["cli", "search"], sortKeys: { featured: 1 } },
  versions: [versionOf("2.0.0", 1_700_000_000), versionOf("1.0.0", 1_690_000_000)],
  defaultVersion: "2.0.0",
  installation: { status: "not-installed" },
};

/** Plugin title quá dài, không description/author/category, không defaultVersion. */
const BETA: Record<string, unknown> = {
  name: "beta",
  title: { en: LONG },
  metadata: { labels: [], sortKeys: {} },
  versions: [versionOf("0.1.0", 1_680_000_000)],
  installation: { status: "installed", installedVersion: "0.1.0" },
};

/** Plugin KHÔNG có title (fallback name) và defaultVersion trỏ version không tồn tại (null). */
const GAMMA: Record<string, unknown> = {
  name: "gamma",
  metadata: { labels: ["x"], sortKeys: { rank: 2 } },
  versions: [versionOf("0.0.1", 1_670_000_000)],
  defaultVersion: "9.9.9",
  installation: { status: "provided" },
};

/** Một entry đủ ba phiên bản để kiểm paging + registry của install. */
const VERSIONED: Record<string, unknown> = {
  name: "alpha",
  defaultVersion: "2.0.0",
  versions: [versionOf("3.0.0", 1_710_000_000), versionOf("2.0.0", 1_700_000_000, "https://registry.test"), versionOf("1.0.0", 1_690_000_000)],
};

/** ISO của một mốc publish (giây) — cùng công thức hợp đồng. */
const published = (seconds: number): string => new Date(seconds * 1000).toISOString();

/** Kết quả mong đợi của một version theo hợp đồng. */
function versionResultOf(version: string, publishTimestamp: number, registry?: string): Record<string, unknown> {
  return {
    version,
    published: published(publishTimestamp),
    compatibility: { compatible: true },
    install: { target: "npm:alpha@" + version, ...(registry === undefined ? {} : { registry }) },
  };
}

/** Bản ta, nạp từ ARTIFACT đã build. */
const OURS_MODULE = (await import(pathToFileURL(OURS_ARTIFACT).href)) as ToolModule;
/** Bản gốc — oracle. */
const STOCK_MODULE = (await import(pathToFileURL(STOCK).href)) as ToolModule;

/** Một lượt abort A/B trên market.search treo; chứng minh fetch CHIA SẺ vẫn resolve sau khi tool đã reject. */
async function abortBoth(reason?: () => unknown): Promise<{
  stockOutcome: Outcome;
  oursOutcome: Outcome;
  stockSignal: AbortSignal;
  oursSignal: AbortSignal;
  stockCalls: MarketCalls;
  oursCalls: MarketCalls;
}> {
  const stockShared = deferred<Record<string, unknown>>();
  const oursShared = deferred<Record<string, unknown>>();
  const stockFixture = marketOf({ search: () => stockShared.promise });
  const oursFixture = marketOf({ search: () => oursShared.promise });
  const stockSide = capture(STOCK_MODULE, stockFixture.market);
  const oursSide = capture(OURS_MODULE, oursFixture.market);
  const stockAbort = new AbortController();
  const oursAbort = new AbortController();
  const stockPending = invoke(stockSide.def, { action: "list_plugins", target: INDEX_URL }, { signal: stockAbort.signal });
  const oursPending = invoke(oursSide.def, { action: "list_plugins", target: INDEX_URL }, { signal: oursAbort.signal });
  await Promise.resolve();
  expect(stockFixture.calls.search).toHaveLength(1);
  expect(oursFixture.calls.search).toHaveLength(1);
  if (reason === undefined) {
    stockAbort.abort();
    oursAbort.abort();
  } else {
    stockAbort.abort(reason());
    oursAbort.abort(reason());
  }
  const [stockOutcome, oursOutcome] = await Promise.all([stockPending, oursPending]);
  expect(oursOutcome).toEqual(stockOutcome);
  expect(oursFixture.calls).toEqual(stockFixture.calls);

  const sharedResult = searchResult([ALPHA], 1, null);
  stockShared.resolve(sharedResult);
  oursShared.resolve(sharedResult);
  await expect(stockShared.promise).resolves.toBe(sharedResult);
  await expect(oursShared.promise).resolves.toBe(sharedResult);
  expect(stockFixture.calls.search[0]?.query).not.toHaveProperty("signal");
  expect(oursFixture.calls.search[0]?.query).not.toHaveProperty("signal");
  return {
    stockOutcome, oursOutcome,
    stockSignal: stockAbort.signal, oursSignal: oursAbort.signal,
    stockCalls: stockFixture.calls, oursCalls: oursFixture.calls,
  };
}

describe("plugin_market — A/B với @deepseek-ai/dsh-plugin-market tools", () => {
  test("(a) đăng ký: inject ['tools'], inject(['pluginMarket']) một lần, một register, definition đầy đủ", () => {
    expect(OURS_MODULE.inject).toEqual(STOCK_MODULE.inject);
    expect(OURS_MODULE.inject).toEqual(["tools"]);
    expect(Object.keys(OURS_MODULE).sort()).toEqual(Object.keys(STOCK_MODULE).sort());

    const stock = capture(STOCK_MODULE, marketOf().market);
    const ours = capture(OURS_MODULE, marketOf().market);
    expect(ours.injectCalls).toEqual(stock.injectCalls);
    expect(ours.injectCalls).toEqual([["pluginMarket"]]);
    expect(ours.events).toEqual(stock.events);
    expect(ours.events).toEqual(["inject:pluginMarket", "register:plugin_market"]);
    expect(ours.def.name).toBe("plugin_market");
    expect(mask(ours.def)).toEqual(mask(stock.def));
    expect(typeof ours.def.execute).toBe("function");
    expect(typeof ours.def.output.render).toBe("function");
    expect(typeof ours.def.presentCall).toBe("function");

    const params = ours.def.parameters;
    expect(params).toEqual(stock.def.parameters);
    expect(params.type).toBe("object");
    expect(params.required).toEqual(["action"]);
    expect(params.properties?.action?.enum).toEqual(["list_indexes", "list_plugins", "list_versions"]);
    expect(params.properties?.action?.type).toBe("string");
    expect(params.properties?.offset?.type).toBe("number");
    expect(params.properties?.limit?.type).toBe("number");
    expect(params.properties?.offset?.description).toBe("For list_plugins and list_versions: zero-based offset; defaults to 0.");
    expect(params.properties?.limit?.description).toBe("For list_plugins and list_versions: page size, from 1 to 100; defaults to 25.");
    expect(Object.hasOwn(params.properties?.target ?? {}, "required")).toBe(false);
    expect(Object.hasOwn(params.properties?.name ?? {}, "required")).toBe(false);
    expect(ours.def.output.schema).toEqual(stock.def.output.schema);
    expect(ours.def.output.schema).toEqual({ type: "string" });

    const renderArgs = { action: "list_indexes" };
    expect(ours.def.output.render(renderArgs, "hello")).toEqual(stock.def.output.render(renderArgs, "hello"));
    expect(ours.def.output.render(renderArgs, "hello")).toEqual([{ type: "text", text: "hello" }]);

    const presentArgs = { action: "list_plugins", target: INDEX_URL, offset: 1, limit: 2 };
    expect(ours.def.presentCall?.(presentArgs)).toEqual(stock.def.presentCall?.(presentArgs));
    expect(ours.def.presentCall?.(presentArgs)).toEqual({
      card: "generic", title: "Browse plugin market", kind: "read", rawInput: presentArgs,
    });
    expect(ours.def.presentCall?.({ action: "bogus" })).toEqual(stock.def.presentCall?.({ action: "bogus" }));
    expect(ours.def.presentCall?.({ action: "bogus" })).toBeUndefined();
  });

  test("(b) list_indexes: url/title english/error, title thiếu ⇒ null, >300 ký tự ⇒ cắt + '…'", async () => {
    const indexes = [
      { url: "https://one.test/index.json", title: { en: "One Market", vi: "Chợ Một" }, description: { en: "ignored" } },
      { url: "https://two.test/index.json", title: "Plain Two" },
      { url: "https://three.test/index.json" },
      { url: "https://four.test/index.json", title: { en: LONG }, error: "fetch failed" },
    ];
    const { outcome, calls } = await executeBoth({ action: "list_indexes" }, () => marketOf({ listIndexes: () => indexes }));
    expect(parsed(outcome)).toEqual({
      indexes: [
        { url: "https://one.test/index.json", title: "One Market" },
        { url: "https://two.test/index.json", title: "Plain Two" },
        { url: "https://three.test/index.json", title: null },
        { url: "https://four.test/index.json", title: LONG.slice(0, MAX_TEXT) + "…", error: "fetch failed" },
      ],
    });
    expect(calls.search).toEqual([]);
    expect(calls.entry).toEqual([]);
  });

  test("(c) list_plugins thiếu target ⇒ 'target index URL is required', không gọi market", async () => {
    const { outcome, calls } = await executeBoth({ action: "list_plugins" }, () => marketOf());
    expect(errorText(outcome)).toBe("target index URL is required");
    expect(errorName(outcome)).toBe("Error");
    expect(calls.search).toEqual([]);
  });

  test("(c) list_plugins: query rỗng ⇒ sort index, entries map đủ, total/nextOffset/trang", async () => {
    const { outcome, calls } = await executeBoth({ action: "list_plugins", target: INDEX_URL }, () => marketOf({
      search: async () => searchResult([ALPHA, BETA, GAMMA], 9, 2),
    }));
    expect(calls.search).toEqual([{
      url: INDEX_URL,
      query: { text: "", sort: { kind: "index" }, offset: 0, limit: 25 },
    }]);
    expect(parsed(outcome)).toEqual({
      index: "Main Index",
      entries: [
        {
          name: "alpha",
          title: "Alpha Tools",
          description: "Alpha description",
          author: "Ann Author",
          homepage: "https://alpha.test",
          repository: "https://github.com/alpha/alpha",
          category: "tools",
          labels: ["cli", "search"],
          sortKeys: { featured: 1 },
          installation: { status: "not-installed" },
          defaultVersion: versionResultOf("2.0.0", 1_700_000_000),
          versionCount: 2,
        },
        {
          name: "beta",
          title: LONG.slice(0, MAX_TEXT) + "…",
          labels: [],
          sortKeys: {},
          installation: { status: "installed", installedVersion: "0.1.0" },
          defaultVersion: null,
          versionCount: 1,
        },
        {
          name: "gamma",
          title: "gamma",
          labels: ["x"],
          sortKeys: { rank: 2 },
          installation: { status: "provided" },
          defaultVersion: null,
          versionCount: 1,
        },
      ],
      total: 9,
      nextOffset: 2,
    });
  });

  test("(c) list_plugins: query có chữ ⇒ sort relevance, whitespace ⇒ index; offset/limit đi qua", async () => {
    const relevance = await executeBoth(
      { action: "list_plugins", target: INDEX_URL, query: "alpha", offset: 2, limit: 1 },
      () => marketOf({ search: async () => searchResult([ALPHA], 3, 3) }),
    );
    expect(relevance.calls.search).toEqual([{
      url: INDEX_URL,
      query: { text: "alpha", sort: { kind: "relevance" }, offset: 2, limit: 1 },
    }]);
    expect(parsed(relevance.outcome)).toMatchObject({ total: 3, nextOffset: 3 });
    expect(relevance.calls.search[0]?.query).not.toHaveProperty("refresh");

    const whitespace = await executeBoth(
      { action: "list_plugins", target: INDEX_URL, query: "   " },
      () => marketOf({ search: async () => searchResult([], 0, null) }),
    );
    expect(whitespace.calls.search).toEqual([{
      url: INDEX_URL,
      query: { text: "   ", sort: { kind: "index" }, offset: 0, limit: 25 },
    }]);

    const lastPage = await executeBoth(
      { action: "list_plugins", target: INDEX_URL, offset: 3, limit: 25 },
      () => marketOf({ search: async () => searchResult([], 3, null) }),
    );
    expect(parsed(lastPage.outcome)).toEqual({ index: "Main Index", entries: [], total: 3, nextOffset: null });
  });

  test("(d) list_versions thiếu target/name ⇒ đúng câu, không gọi market.entry", async () => {
    const missingTarget = await executeBoth({ action: "list_versions", name: "alpha" }, () => marketOf());
    expect(errorText(missingTarget.outcome)).toBe("target index URL is required");
    expect(missingTarget.calls.entry).toEqual([]);

    const missingName = await executeBoth({ action: "list_versions", target: INDEX_URL }, () => marketOf());
    expect(errorText(missingName.outcome)).toBe("name is required");
    expect(missingName.calls.entry).toEqual([]);
  });

  test("(d) list_versions: entry undefined ⇒ '<name> is not listed in <url>'", async () => {
    const { outcome, calls } = await executeBoth(
      { action: "list_versions", target: INDEX_URL, name: "ghost" },
      () => marketOf({ entry: async () => undefined }),
    );
    expect(calls.entry).toEqual([{ url: INDEX_URL, name: "ghost" }]);
    expect(errorText(outcome)).toBe("ghost is not listed in " + INDEX_URL);
    expect(errorName(outcome)).toBe("Error");
  });

  test("(d) list_versions: paged versions + nextOffset + defaultVersion + registry của install", async () => {
    const paged = await executeBoth(
      { action: "list_versions", target: INDEX_URL, name: "alpha", offset: 1, limit: 1 },
      () => marketOf({ entry: async () => VERSIONED }),
    );
    expect(paged.calls.entry).toEqual([{ url: INDEX_URL, name: "alpha" }]);
    expect(parsed(paged.outcome)).toEqual({
      name: "alpha",
      defaultVersion: "2.0.0",
      versions: [versionResultOf("2.0.0", 1_700_000_000, "https://registry.test")],
      total: 3,
      nextOffset: 2,
    });

    const noDefault = await executeBoth(
      { action: "list_versions", target: INDEX_URL, name: "beta" },
      () => marketOf({ entry: async () => ({ name: "beta", versions: [versionOf("0.1.0", 1_680_000_000)] }) }),
    );
    expect(parsed(noDefault.outcome)).toEqual({
      name: "beta",
      defaultVersion: null,
      versions: [versionResultOf("0.1.0", 1_680_000_000)],
      total: 1,
      nextOffset: null,
    });
  });

  test("(e) pageOf list_plugins: offset âm/không nguyên, limit 0/101 ⇒ lỗi chung, không gọi search", async () => {
    const badPages = [{ offset: -1 }, { offset: 1.5 }, { offset: 2.5 }, { limit: 0 }, { limit: 101 }, { limit: -2 }, { limit: 2.5 }];
    for (const page of badPages) {
      const { outcome, calls } = await executeBoth({ action: "list_plugins", target: INDEX_URL, ...page }, () => marketOf());
      expect(errorText(outcome)).toBe(PAGE_ERROR);
      expect(calls.search).toEqual([]);
    }
  });

  test("(e) pageOf list_versions: offset âm/không nguyên, limit 0/101 ⇒ CÙNG câu lỗi, không gọi entry", async () => {
    const badPages = [{ offset: -1 }, { offset: 1.5 }, { offset: 2.5 }, { limit: 0 }, { limit: 101 }, { limit: -2 }, { limit: 2.5 }];
    for (const page of badPages) {
      const { outcome, calls } = await executeBoth(
        { action: "list_versions", target: INDEX_URL, name: "alpha", ...page },
        () => marketOf(),
      );
      expect(errorText(outcome)).toBe(PAGE_ERROR);
      expect(calls.entry).toEqual([]);
    }
  });

  test("(f) untilAborted: abort mặc định khi market.search treo ⇒ reject reason, fetch CHIA SẺ vẫn resolve", async () => {
    const run = await abortBoth();
    const reason = run.stockSignal.reason;
    expect(errorName(run.oursOutcome)).toBe(reason instanceof Error ? reason.name : "Error");
    expect(errorText(run.oursOutcome)).toBe(reason instanceof Error ? reason.message : "Aborted");
    expect(run.oursCalls.search[0]?.query).toEqual({ text: "", sort: { kind: "index" }, offset: 0, limit: 25 });
  });

  test("(f) untilAborted: signal.reason là Error ⇒ reject đúng reason đó", async () => {
    const run = await abortBoth(() => new Error("market read cancelled"));
    expect(errorName(run.oursOutcome)).toBe("Error");
    expect(errorText(run.oursOutcome)).toBe("market read cancelled");
  });

  test("(f) untilAborted: reason KHÔNG phải Error ⇒ Error('Aborted'), fetch chia sẻ vẫn resolve", async () => {
    const run = await abortBoth(() => "stop");
    expect(errorName(run.oursOutcome)).toBe("Error");
    expect(errorText(run.oursOutcome)).toBe("Aborted");
  });
});
