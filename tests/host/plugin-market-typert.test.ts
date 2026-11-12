/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho HAI manifest typert của @galaxy-blackhole/gbh-plugin-market: chờ nguồn typert ổn định,
 *      build gói ta ra mkdtemp rồi nạp lib/typert.host.js + lib/typert.remote-client.js của ta và bản stock
 *      @deepseek-ai/dsh-plugin-market; so sâu dữ liệu JSON, schema zod và exports. KHÔNG gọi mạng.
 */
import { afterAll, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "plugin-market");
/** node_modules của kernel — nơi cả hai bản phân giải peer. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Thư mục package stock (CHỈ ĐỌC) — oracle. */
const STOCK_DIR = join(APP_MODULES, "@deepseek-ai", "dsh-plugin-market");
/** Thư mục artifact tạm; dọn ở afterAll. */
const OUT = mkdtempSync(join(tmpdir(), "gbh-plugin-market-typert-ab-"));
/** Nơi build tạm đặt lib/typert.host.js + lib/typert.remote-client.js. */
const ARTIFACT = join(OUT, "lib");
/** Hạn chót chờ nguồn ổn định + build xong, tính bằng ms. */
const DEADLINE = Date.now() + 240_000;
/** Tệp nguồn phải ỔN ĐỊNH trước khi build; build.ts sinh entry typert. */
const SOURCES = ["build.ts", "src/typert-host.ts", "src/typert-remote-client.ts"];

/** package.json của ta (JSON thuần). */
const OUR_PKG = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as PackageJson;
/** package.json của stock (JSON thuần). */
const STOCK_PKG = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as PackageJson;

/** Hình dạng tối thiểu của package.json mà test đọc. */
interface PackageJson {
  name?: string;
  exports?: Record<string, unknown>;
}

/** Namespace của typert.host.js. */
interface HostModule {
  TYPERT: HostManifest;
}

/** Namespace của typert.remote-client.js. */
interface RemoteModule {
  TYPERT_REMOTE: RemoteInfo;
  default: RemoteInfo;
}

/** Manifest host: dữ liệu JSON + invocations mang codec lazy. */
interface HostManifest {
  package: string;
  face: string;
  schemas: unknown[];
  invocations: RemoteMethod[];
  model: {
    services: { types: unknown[] }[];
    events: unknown[];
    objects: unknown[];
  };
}

/** Codec generated: create là hàm lazy trả schema zod; jsonSchema là dữ liệu JSON. */
interface Codec {
  mode?: string;
  typeSymbol?: string;
  create?: () => unknown;
  jsonSchema?: unknown;
}

/** Một parameter remote. */
interface RemoteParameter {
  name?: string;
  wire?: string;
  description?: string;
  source?: string;
  codec?: Codec;
  strictCodec?: Codec;
}

/** Một result remote: có create trực tiếp (setIndexes) hoặc bọc trong spec (listIndexes/search). */
interface RemoteResult {
  mode?: string;
  typeSymbol?: string;
  create?: () => unknown;
  spec?: { create?: () => unknown; jsonSchema?: unknown; jsonSchemaError?: string };
  projection?: unknown;
  jsonSchema?: unknown;
  jsonSchemaError?: string;
}

/** Một method remote (descriptor runtime có thêm id/input/invoke; spec chỉ có dữ liệu). */
interface RemoteMethod {
  service?: string;
  description?: string;
  implementation?: string;
  invocation?: unknown;
  scope?: { context?: string; wire?: string };
  parameters?: RemoteParameter[];
  cancellation?: unknown;
  result?: RemoteResult;
  sourceLocation?: unknown;
}

/** RemoteInfo do createTypertRemoteInfo() trả: có getter package/methods + spec gốc. */
interface RemoteInfo {
  package: string;
  methods: Record<string, RemoteMethod>;
  events?: unknown;
  objects?: unknown;
  spec: {
    package?: string;
    methods?: Record<string, RemoteMethod>;
    events?: unknown;
    objects?: unknown;
  };
}

/** Kết quả build tạm của ta. */
interface Built {
  host: string;
  remote: string;
}

/** Ngủ ms mili giây. */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Chữ ký kích thước + mtime của ba tệp nguồn; -1 khi tệp chưa có.
 * Nhận: không.
 * Trả: chuỗi chữ ký để phát hiện nguồn còn đang được ghi.
 */
function sourceSignature(): string {
  return SOURCES.map((file) => {
    try {
      const stat = statSync(join(PKG, file));
      return file + ":" + stat.size + ":" + stat.mtimeMs;
    } catch {
      return file + ":-1";
    }
  }).join("|");
}

/**
 * Chờ ba tệp nguồn tồn tại và KHÔNG đổi qua hai lần đo cách 300ms (hạn: DEADLINE).
 * Nhận: không.
 * Trả: Promise hoàn tất khi nguồn ổn định; ném lỗi khi quá hạn.
 */
async function waitForSources(): Promise<void> {
  let signature = sourceSignature();
  while (Date.now() < DEADLINE) {
    await sleep(300);
    const next = sourceSignature();
    if (!next.includes(":-1") && next === signature) return;
    signature = next;
  }
  throw new Error("nguồn " + PKG + " không ổn định sau 240s (" + sourceSignature() + ")");
}

/** build.ts của gói ta. */
interface BuildModule {
  buildPackage?(outDir?: string): Promise<unknown>;
}

/**
 * Tìm artifact trong cây build, tối đa ba tầng và bỏ node_modules; undefined khi không thấy.
 * Nhận: root — thư mục gốc; name — tên tệp cần tìm.
 * Trả: đường dẫn tuyệt đối hoặc undefined.
 */
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

/**
 * Chờ nguồn ổn định rồi build gói ta vào mkdtemp, symlink node_modules về kernel.
 * Nhận: không.
 * Trả: đường dẫn typert.host.js + typert.remote-client.js đã build.
 */
async function buildOurs(): Promise<Built> {
  await waitForSources();
  const module = (await import(pathToFileURL(join(PKG, "build.ts")).href)) as BuildModule;
  if (typeof module.buildPackage !== "function") throw new Error("build.ts không export buildPackage");
  const buildPackage = module.buildPackage;
  let host: string | undefined;
  let remote: string | undefined;
  for (;;) {
    try {
      await buildPackage(ARTIFACT);
      host = findArtifact(OUT, "typert.host.js");
      remote = findArtifact(OUT, "typert.remote-client.js");
      if (host !== undefined && remote !== undefined) break;
      if (Date.now() > DEADLINE) {
        throw new Error("build.ts chưa sinh typert.host.js + typert.remote-client.js trong " + ARTIFACT);
      }
    } catch (error) {
      if (Date.now() > DEADLINE) throw error;
    }
    await sleep(500);
  }
  if (!existsSync(join(OUT, "node_modules"))) symlinkSync(APP_MODULES, join(OUT, "node_modules"), "dir");
  return { host, remote };
}

/** Artifact typert của ta (build tạm, dọn ở afterAll). */
const OURS = await buildOurs();
/** Bản host của ta. */
const oursHost = (await import(pathToFileURL(OURS.host).href)) as HostModule;
/** Bản host stock (oracle). */
const stockHost = (await import(pathToFileURL(join(STOCK_DIR, "lib", "typert.host.js")).href)) as HostModule;
/** Bản remote của ta. */
const oursRemote = (await import(pathToFileURL(OURS.remote).href)) as RemoteModule;
/** Bản remote stock (oracle). */
const stockRemote = (await import(pathToFileURL(join(STOCK_DIR, "lib", "typert.remote-client.js")).href)) as RemoteModule;

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/**
 * Chuyển một giá trị manifest thành dữ liệu JSON thuần.
 * Nhận: value — object có thể chứa hàm lazy create hoặc getter.
 * Trả: bản JSON đã bỏ hàm/undefined, đúng phần dữ liệu thuần JSON cần so.
 */
function jsonData(value: unknown): unknown {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as unknown;
}

/**
 * Text JSON của dữ liệu manifest để so id; bỏ hàm và chuẩn hoá BigInt (namespace zod của RemoteInfo).
 * Nhận: value — dữ liệu manifest.
 * Trả: chuỗi JSON an toàn với BigInt.
 */
function manifestText(value: unknown): string {
  return JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? item.toString() : item)) ?? "";
}

/** Đổi id gói stock sang id của ta trong dữ liệu JSON: manifest TYPERT phải OWNED bởi gói export nó (luật typert-loader), nên A/B so phần còn lại sau khi align id. */
function alignStock<T>(value: T): T {
  return JSON.parse(JSON.stringify(value).split(STOCK_PKG.name as string).join(OUR_PKG.name as string)) as T;
}

/**
 * Lấy đích thực của một entry exports (string hoặc object có default).
 * Nhận: entry — giá trị trong package.json exports.
 * Trả: đường dẫn tương đối, hoặc undefined nếu không nhận dạng được.
 */
function exportTarget(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (entry !== null && typeof entry === "object") {
    const fallback = (entry as { default?: unknown }).default;
    if (typeof fallback === "string") return fallback;
  }
  return undefined;
}

/**
 * Lấy một method theo key, đòi có mặt ở cả hai bên.
 * Nhận: info — TYPERT_REMOTE; key — tên method; side — nhãn để báo lỗi.
 * Trả: descriptor method.
 */
function pickMethod(info: RemoteInfo, key: string, side: string): RemoteMethod {
  const method = info.methods[key];
  assert.ok(method, side + ": thiếu method " + key);
  return method;
}

/**
 * Lấy một parameter theo tên, đòi có mặt.
 * Nhận: method — descriptor method; name — tên parameter; side — nhãn để báo lỗi.
 * Trả: descriptor parameter.
 */
function pickParameter(method: RemoteMethod, name: string, side: string): RemoteParameter {
  const parameter = (method.parameters ?? []).find((item) => item.name === name);
  assert.ok(parameter, side + ": thiếu parameter " + name);
  return parameter;
}

/**
 * Lấy owner chứa create() của result: ưu tiên result trực tiếp, lùi về result.spec.
 * Nhận: result — descriptor result; side — nhãn để báo lỗi.
 * Trả: object có create().
 */
function resultCodec(result: RemoteResult | undefined, side: string): { create?: () => unknown } {
  assert.ok(result !== undefined, side + ": thiếu result");
  const owner = typeof result.create === "function" ? result : result.spec;
  assert.ok(owner !== undefined, side + ": thiếu result.create()");
  return owner as { create?: () => unknown };
}

/** Schema zod tối thiểu mà test gọi. */
interface ParseSchema {
  safeParse(value: unknown): { success: boolean; data?: unknown; error?: { issues?: unknown } };
}

/**
 * Gọi create() của codec/result để lấy schema zod, đòi hàm tồn tại.
 * Nhận: owner — codec hoặc result; label — nhãn để báo lỗi.
 * Trả: schema zod.
 */
function createSchema(owner: { create?: () => unknown } | undefined, label: string): ParseSchema {
  assert.ok(owner !== undefined && typeof owner.create === "function", label + ": thiếu create()");
  const schema = (owner as { create: () => unknown }).create();
  assert.ok(
    schema !== null && typeof schema === "object" && typeof (schema as ParseSchema).safeParse === "function",
    label + ": create() không trả schema zod",
  );
  return schema as ParseSchema;
}

/** Kết quả safeParse đã chuẩn hoá để so A/B. */
type ParseOutcome = { ok: true; value: unknown } | { ok: false; issues: unknown };

/**
 * Chạy safeParse và giữ đúng success/value hoặc error/issues.
 * Nhận: schema — schema zod; input — dữ liệu thử.
 * Trả: outcome chuẩn hoá.
 */
function parseSchema(schema: ParseSchema, input: unknown): ParseOutcome {
  const result = schema.safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, issues: result.error?.issues };
}

/**
 * So hành vi safeParse của schema ta với stock trên CÙNG input.
 * Nhận: label — tên ca; oursSchema/stockSchema — schema hai bên; input — dữ liệu thử.
 * Trả: không; ném assertion nếu success/value/issues khác.
 */
function assertSameParse(label: string, oursSchema: ParseSchema, stockSchema: ParseSchema, input: unknown): void {
  const ours = parseSchema(oursSchema, input);
  const stock = parseSchema(stockSchema, input);
  assert.strictEqual(ours.ok, stock.ok, label + ": success phải khớp");
  if (ours.ok && stock.ok) assert.deepStrictEqual(ours.value, stock.value, label + ": data");
  else if (!ours.ok && !stock.ok) assert.deepStrictEqual(ours.issues, stock.issues, label + ": issues");
}

test("(a) TYPERT host: dữ liệu JSON thuần DEEP EQUAL stock sau align id + ownership", () => {
  assert.deepStrictEqual(jsonData(oursHost.TYPERT), alignStock(jsonData(stockHost.TYPERT)));
  // Ownership: manifest của ta phải mang id CỦA TA (typert-loader từ chối id stock).
  assert.strictEqual(oursHost.TYPERT.package, OUR_PKG.name);
  assert.strictEqual(stockHost.TYPERT.package, STOCK_PKG.name);
  // Không còn id stock ở bất kỳ đâu trong manifest ta (kể cả typeSymbol/sourceLocation).
  expect(manifestText(oursHost.TYPERT).includes(STOCK_PKG.name as string)).toBe(false);
  assert.strictEqual(oursHost.TYPERT.face, "host");
  // Chốt thêm dữ liệu thuần JSON: không còn hàm nào sau chuẩn hoá.
  assert.deepStrictEqual(jsonData(jsonData(oursHost.TYPERT)), jsonData(oursHost.TYPERT));
});

test("(b) TYPERT_REMOTE: package id ta, methods keys khớp, trường method + parameters name/wire khớp stock", () => {
  const ours = oursRemote.TYPERT_REMOTE;
  const stock = stockRemote.TYPERT_REMOTE;

  assert.deepStrictEqual(ours.package, OUR_PKG.name);
  assert.deepStrictEqual(stock.package, STOCK_PKG.name);
  assert.deepStrictEqual(Object.keys(ours.methods).sort(), Object.keys(stock.methods).sort());
  expect(Object.keys(ours.methods).length).toBeGreaterThan(0);
  // RemoteInfo mang thêm namespace zod (BigInt) ⇒ chỉ so phần manifest methods/spec.
  expect(manifestText({ methods: ours.methods, spec: ours.spec }).includes(STOCK_PKG.name as string)).toBe(false);

  for (const key of Object.keys(stock.methods).sort()) {
    const oursMethod = pickMethod(ours, key, "ours");
    const stockMethod = pickMethod(stock, key, "stock");
    assert.deepStrictEqual(oursMethod.service, stockMethod.service, key + ": service");
    assert.deepStrictEqual(oursMethod.description, stockMethod.description, key + ": description");
    assert.deepStrictEqual(oursMethod.implementation, stockMethod.implementation, key + ": implementation");
    assert.deepStrictEqual(oursMethod.invocation, stockMethod.invocation, key + ": invocation");
    assert.deepStrictEqual(oursMethod.scope?.context, stockMethod.scope?.context, key + ": scope.context");
    assert.deepStrictEqual(oursMethod.scope?.wire, stockMethod.scope?.wire, key + ": scope.wire");
    assert.deepStrictEqual(
      (oursMethod.parameters ?? []).map((item) => ({ name: item.name, wire: item.wire })),
      (stockMethod.parameters ?? []).map((item) => ({ name: item.name, wire: item.wire })),
      key + ": parameters name+wire",
    );
    assert.deepStrictEqual(oursMethod.cancellation, stockMethod.cancellation, key + ": cancellation");
    assert.deepStrictEqual(oursMethod.sourceLocation, stockMethod.sourceLocation, key + ": sourceLocation");
  }

  // Stock hiện không khai events/objects ở RemoteInfo lẫn spec; parity là cùng VẮNG MẶT.
  assert.deepStrictEqual(Object.keys(ours.spec).sort(), Object.keys(stock.spec).sort());
  assert.deepStrictEqual(ours.events ?? ours.spec.events, stock.events ?? stock.spec.events, "events");
  assert.deepStrictEqual(ours.objects ?? ours.spec.objects, stock.objects ?? stock.spec.objects, "objects");
});

test("(b) TYPERT_REMOTE: jsonSchema + toàn bộ codec/result EQUAL stock sau align id", () => {
  const ours = oursRemote.TYPERT_REMOTE;
  const stock = stockRemote.TYPERT_REMOTE;

  for (const key of Object.keys(stock.methods).sort()) {
    const oursMethod = pickMethod(ours, key, "ours");
    const stockMethod = pickMethod(stock, key, "stock");
    const oursParameters = oursMethod.parameters ?? [];
    const stockParameters = stockMethod.parameters ?? [];
    assert.deepStrictEqual(oursParameters.length, stockParameters.length, key + ": số parameter");

    for (let index = 0; index < stockParameters.length; index += 1) {
      const oursParameter = oursParameters[index];
      const stockParameter = stockParameters[index];
      assert.ok(oursParameter !== undefined, key + ": thiếu parameter ta[" + index + "]");
      assert.ok(stockParameter !== undefined, key + ": thiếu parameter stock[" + index + "]");
      assert.deepStrictEqual(
        oursParameter.codec?.jsonSchema,
        stockParameter.codec?.jsonSchema,
        key + ": parameter[" + index + "].codec.jsonSchema",
      );
      assert.deepStrictEqual(
        oursParameter.strictCodec?.jsonSchema,
        stockParameter.strictCodec?.jsonSchema,
        key + ": parameter[" + index + "].strictCodec.jsonSchema",
      );
      assert.deepStrictEqual(
        jsonData(oursParameter.codec),
        alignStock(jsonData(stockParameter.codec)),
        key + ": parameter[" + index + "] toàn bộ codec",
      );
      assert.deepStrictEqual(
        jsonData(oursParameter.strictCodec),
        alignStock(jsonData(stockParameter.strictCodec)),
        key + ": parameter[" + index + "] toàn bộ strictCodec",
      );
    }

    assert.deepStrictEqual(oursMethod.result?.jsonSchema, stockMethod.result?.jsonSchema, key + ": result.jsonSchema");
    assert.deepStrictEqual(
      oursMethod.result?.spec?.jsonSchema,
      stockMethod.result?.spec?.jsonSchema,
      key + ": result.spec.jsonSchema",
    );
    assert.deepStrictEqual(jsonData(oursMethod.result), alignStock(jsonData(stockMethod.result)), key + ": toàn bộ result");
  }
});

test("(c) zod safeParse parameter 'query': valid/invalid khớp stock", () => {
  const key = "pluginMarket/search";
  const oursQuery = pickParameter(pickMethod(oursRemote.TYPERT_REMOTE, key, "ours"), "query", "ours");
  const stockQuery = pickParameter(pickMethod(stockRemote.TYPERT_REMOTE, key, "stock"), "query", "stock");
  const oursSchema = createSchema(oursQuery.codec, "ours.query.codec");
  const stockSchema = createSchema(stockQuery.codec, "stock.query.codec");

  const valid = { text: "linter", sort: { kind: "published", direction: "desc" }, offset: 0, limit: 5 };
  const invalid = { labels: "not-an-array", sort: { kind: "unknown" }, offset: -1, limit: 0 };
  assertSameParse("query hợp lệ", oursSchema, stockSchema, valid);
  assertSameParse("query không hợp lệ", oursSchema, stockSchema, invalid);
  assertSameParse("query thiếu trường bắt buộc", oursSchema, stockSchema, {});
});

test("(c) zod safeParse result 'pluginMarket/listIndexes': valid/invalid khớp stock", () => {
  const key = "pluginMarket/listIndexes";
  const oursResult = pickMethod(oursRemote.TYPERT_REMOTE, key, "ours").result;
  const stockResult = pickMethod(stockRemote.TYPERT_REMOTE, key, "stock").result;
  const oursSchema = createSchema(resultCodec(oursResult, "ours.result"), "ours.result");
  const stockSchema = createSchema(resultCodec(stockResult, "stock.result"), "stock.result");

  const valid = [{ url: "https://market.test/index.json", title: { en: "Market" }, error: "last read failed" }];
  const invalid = [{ url: 7, title: 3 }];
  assertSameParse("result hợp lệ", oursSchema, stockSchema, valid);
  assertSameParse("result không hợp lệ", oursSchema, stockSchema, invalid);
  assertSameParse("result sai kiểu mảng", oursSchema, stockSchema, { url: "https://market.test/index.json" });
});

test("(d) default === named TYPERT_REMOTE; typert.host KHÔNG có default", () => {
  expect(oursRemote.default).toBe(oursRemote.TYPERT_REMOTE);
  expect(stockRemote.default).toBe(stockRemote.TYPERT_REMOTE);
  expect("default" in oursHost).toBe(false);
  expect("default" in stockHost).toBe(false);
  assert.deepStrictEqual(Object.keys(oursHost).sort(), Object.keys(stockHost).sort());
});

test("(d) exports './typert' + './remote' đúng artifact và khớp stock", () => {
  const oursExports = OUR_PKG.exports ?? {};
  const stockExports = STOCK_PKG.exports ?? {};
  assert.strictEqual(exportTarget(oursExports["./typert"]), "./lib/typert.host.js");
  assert.strictEqual(exportTarget(oursExports["./remote"]), "./lib/typert.remote-client.js");
  assert.deepStrictEqual(exportTarget(oursExports["./typert"]), exportTarget(stockExports["./typert"]));
  assert.deepStrictEqual(exportTarget(oursExports["./remote"]), exportTarget(stockExports["./remote"]));
  expect(existsSync(OURS.host)).toBe(true);
  expect(existsSync(OURS.remote)).toBe(true);
  assert.strictEqual(OURS.host.endsWith("typert.host.js"), true);
  assert.strictEqual(OURS.remote.endsWith("typert.remote-client.js"), true);
});
