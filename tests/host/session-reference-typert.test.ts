/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho HAI manifest typert của @galaxy-blackhole/gbh-session-reference: build tạm ba entry
 *      (build.ts → mkdtemp), nạp lib/typert.host.js + lib/typert.remote-client.js của ta và bản stock
 *      @deepseek-ai/dsh-session-reference, rồi so sâu dữ liệu manifest + hành vi schema zod.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "session-reference");
/** node_modules của kernel — nơi cả hai bản phân giải peer. */
const APP_MODULES = join(REPO, "apps", "host", "node_modules");
/** Thư mục package stock (CHỈ ĐỌC) — oracle. */
const STOCK_DIR = join(APP_MODULES, "@deepseek-ai", "dsh-session-reference");
/** Thư mục artifact tạm; dọn ở afterAll. */
const OUT = mkdtempSync(join(tmpdir(), "gbh-session-reference-typert-ab-"));
/** Nơi build tạm đặt lib/index.js + lib/typert.host.js + lib/typert.remote-client.js. */
const ARTIFACT = join(OUT, "lib");

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
  TYPERT: Manifest;
}

/** Namespace của typert.remote-client.js. */
interface RemoteModule {
  TYPERT_REMOTE: RemoteInfo;
  default: RemoteInfo;
}

/** Manifest host: dữ liệu JSON + getter invocations trả descriptor có hàm lazy. */
interface Manifest {
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
  lookup?: string;
  codec?: Codec;
  strictCodec?: Codec;
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
  result?: { create?: () => unknown; jsonSchema?: unknown; spec?: { jsonSchema?: unknown } };
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

/** Bản của ta nạp trong beforeAll. */
let oursHost!: HostModule;
/** Bản stock (oracle) nạp trong beforeAll. */
let stockHost!: HostModule;
/** Bản remote của ta nạp trong beforeAll. */
let oursRemote!: RemoteModule;
/** Bản remote stock (oracle) nạp trong beforeAll. */
let stockRemote!: RemoteModule;

beforeAll(async () => {
  const { buildPackage } = (await import(join(PKG, "build.ts"))) as {
    buildPackage(outDir?: string): Promise<{ service: string; typertHost: string; typertRemoteClient: string }>;
  };
  await buildPackage(ARTIFACT);
  // Hai manifest import zod/@deepseek-ai/dsh-typert-protocol từ kernel; artifact nằm ngoài repo nên
  // cần node_modules trỏ ngược apps/host/node_modules để phân giải peer y như bản stock.
  symlinkSync(APP_MODULES, join(OUT, "node_modules"), "dir");
  oursHost = (await import(pathToFileURL(join(ARTIFACT, "typert.host.js")).href)) as HostModule;
  oursRemote = (await import(pathToFileURL(join(ARTIFACT, "typert.remote-client.js")).href)) as RemoteModule;
  stockHost = (await import(pathToFileURL(join(STOCK_DIR, "lib", "typert.host.js")).href)) as HostModule;
  stockRemote = (await import(pathToFileURL(join(STOCK_DIR, "lib", "typert.remote-client.js")).href)) as RemoteModule;
});

afterAll(() => {
  rmSync(OUT, { recursive: true, force: true });
});

/**
 * Chuyển một giá trị manifest thành dữ liệu JSON thuần.
 * Nhận: value — object có thể chứa hàm lazy create hoặc getter.
 * Trả: bản JSON đã bỏ hàm/undefined, đúng phần dữ liệu thuần JSON cần so.
 */
function jsonData(value: unknown): unknown {
  const text = JSON.stringify(value);
  return text === undefined ? undefined : (JSON.parse(text) as unknown);
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
 * Lấy bề mặt events/objects của RemoteInfo: ưu tiên getter runtime, lùi về spec gốc.
 * Nhận: info — TYPERT_REMOTE; key — events hoặc objects.
 * Trả: giá trị tương ứng (stock hiện không khai cả hai ⇒ undefined).
 */
function remoteSurface(info: RemoteInfo, key: "events" | "objects"): unknown {
  return info[key] ?? info.spec[key];
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
 * Gọi hàm create() của codec/result để lấy schema zod, đòi hàm tồn tại.
 * Nhận: owner — codec hoặc result; label — nhãn để báo lỗi.
 * Trả: schema zod.
 */
function createSchema(owner: { create?: () => unknown } | undefined, label: string): unknown {
  assert.ok(owner !== undefined && typeof owner.create === "function", label + ": thiếu create()");
  return (owner as { create: () => unknown }).create();
}

/**
 * Đổi id gói stock sang id của ta trong dữ liệu JSON: manifest TYPERT phải OWNED bởi gói export nó (luật typert-loader), nên A/B so phần còn lại sau khi align id.
 * test cập nhật theo identity GBH (Lead duyệt 08/11): `typeSymbol` do provider của ta đăng ký đã mang id GBH
 * (`@galaxy-blackhole/gbh-session/types#SessionId`) trong khi stock là `@deepseek-ai/dsh-session/types#…`,
 * nên phần identity của module session cũng phải align thì A/B mới so đúng PHẦN CÒN LẠI (hành vi), không so tên module.
 * Nhận: value — dữ liệu JSON thuần (manifest/codec) của bên stock.
 * Trả: bản sao đã thay id stock bằng id GBH tương ứng.
 */
function alignStock<T>(value: T): T {
  // `package.json` cho `name` là `string | undefined` ⇒ narrow MỘT lần, không `split(undefined)` (TS2769).
  const stockName = STOCK_PKG.name;
  const ourName = OUR_PKG.name;
  if (stockName === undefined || ourName === undefined) throw new Error("package.json thiếu name");
  const alignedIdentity = JSON.stringify(value)
    .split("@deepseek-ai/dsh-session/")
    .join("@galaxy-blackhole/gbh-session/");
  return JSON.parse(alignedIdentity.split(stockName).join(ourName)) as T;
}

/** Kết quả safeParse đã chuẩn hoá để so A/B. */
type ParseOutcome = { ok: true; value: unknown } | { ok: false; issues: unknown };

/**
 * Chạy safeParse và giữ đúng success/value hoặc error/issues.
 * Nhận: schema — schema zod; input — dữ liệu thử.
 * Trả: outcome chuẩn hoá.
 */
function parseSchema(schema: unknown, input: unknown): ParseOutcome {
  const result = (
    schema as {
      safeParse(value: unknown): { success: boolean; data?: unknown; error?: { issues?: unknown } };
    }
  ).safeParse(input);
  return result.success
    ? { ok: true, value: result.data }
    : { ok: false, issues: result.error?.issues };
}

/**
 * So hành vi safeParse của schema ta với stock trên CÙNG input.
 * Nhận: label — tên ca; oursSchema/stockSchema — schema hai bên; input — dữ liệu thử.
 * Trả: không; ném assertion nếu success/value/issues khác.
 */
function assertSameParse(label: string, oursSchema: unknown, stockSchema: unknown, input: unknown): void {
  const ours = parseSchema(oursSchema, input);
  const stock = parseSchema(stockSchema, input);
  assert.strictEqual(ours.ok, stock.ok, label + ": success phải khớp");
  if (ours.ok && stock.ok) assert.deepStrictEqual(ours.value, stock.value, label + ": data");
  else if (!ours.ok && !stock.ok) assert.deepStrictEqual(ours.issues, stock.issues, label + ": issues");
}

describe("session-reference typert A/B", () => {
  test("(a) TYPERT host: dữ liệu JSON thuần DEEP EQUAL stock", () => {
    assert.deepStrictEqual(jsonData(oursHost.TYPERT), alignStock(jsonData(stockHost.TYPERT)));
    // Ownership: manifest của ta phải mang id CỦA TA (typert-loader từ chối id stock).
    assert.strictEqual(oursHost.TYPERT.package, OUR_PKG.name);
    assert.strictEqual(stockHost.TYPERT.package, STOCK_PKG.name);
    // Chốt thêm dữ liệu thuần JSON: không còn hàm nào sau chuẩn hoá.
    assert.deepStrictEqual(jsonData(jsonData(oursHost.TYPERT)), jsonData(oursHost.TYPERT));
  });

  test("(b) TYPERT_REMOTE: package, methods, trường method, parameters, events/objects khớp stock", () => {
    const ours = oursRemote.TYPERT_REMOTE;
    const stock = stockRemote.TYPERT_REMOTE;

    assert.deepStrictEqual(ours.package, OUR_PKG.name);
    assert.deepStrictEqual(stock.package, STOCK_PKG.name);
    assert.deepStrictEqual(Object.keys(ours.methods).sort(), Object.keys(stock.methods).sort());

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
    assert.deepStrictEqual(remoteSurface(ours, "events"), remoteSurface(stock, "events"));
    assert.deepStrictEqual(remoteSurface(ours, "objects"), remoteSurface(stock, "objects"));
  });

  test("(b) TYPERT_REMOTE: jsonSchema parameter/result EQUAL stock (deep)", () => {
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
        // `noUncheckedIndexedAccess`: hai phần tử có thể `undefined` ⇒ narrow tường minh (không dùng `!`).
        assert.ok(oursParameter !== undefined && stockParameter !== undefined, key + ": parameter[" + index + "] thiếu");
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

      assert.deepStrictEqual(
        oursMethod.result?.jsonSchema,
        stockMethod.result?.jsonSchema,
        key + ": result.jsonSchema",
      );
      assert.deepStrictEqual(
        oursMethod.result?.spec?.jsonSchema,
        stockMethod.result?.spec?.jsonSchema,
        key + ": result.spec.jsonSchema",
      );
      assert.deepStrictEqual(jsonData(oursMethod.result), alignStock(jsonData(stockMethod.result)), key + ": toàn bộ result");
    }
  });

  describe("(b) schema zod: cùng safeParse trên cùng input", () => {
    test("query parameter — hợp lệ và không hợp lệ", () => {
      const key = "sessionReferenceResolver/candidates";
      const oursQuery = pickParameter(pickMethod(oursRemote.TYPERT_REMOTE, key, "ours"), "query", "ours");
      const stockQuery = pickParameter(pickMethod(stockRemote.TYPERT_REMOTE, key, "stock"), "query", "stock");
      const oursSchema = createSchema(oursQuery.codec, "ours.query.codec");
      const stockSchema = createSchema(stockQuery.codec, "stock.query.codec");
      assertSameParse("query hợp lệ", oursSchema, stockSchema, "session");
      assertSameParse("query không hợp lệ", oursSchema, stockSchema, 42);
    });

    test("agent parameter — hợp lệ và không hợp lệ", () => {
      const key = "sessionReferenceResolver/candidates";
      const oursAgent = pickParameter(pickMethod(oursRemote.TYPERT_REMOTE, key, "ours"), "agent", "ours");
      const stockAgent = pickParameter(pickMethod(stockRemote.TYPERT_REMOTE, key, "stock"), "agent", "stock");
      const oursSchema = createSchema(oursAgent.codec, "ours.agent.codec");
      const stockSchema = createSchema(stockAgent.codec, "stock.agent.codec");
      assertSameParse("agent hợp lệ", oursSchema, stockSchema, "agent-1");
      assertSameParse("agent không hợp lệ", oursSchema, stockSchema, null);
    });

    test("result candidates — hợp lệ và không hợp lệ", () => {
      const key = "sessionReferenceResolver/candidates";
      const oursResult = pickMethod(oursRemote.TYPERT_REMOTE, key, "ours").result;
      const stockResult = pickMethod(stockRemote.TYPERT_REMOTE, key, "stock").result;
      const oursSchema = createSchema(oursResult, "ours.result");
      const stockSchema = createSchema(stockResult, "stock.result");
      const validCandidate = {
        mention: "@[Session](dsh-session:s1)",
        sessionId: "s1",
        label: "Session",
        sameWorkspace: true,
        createdAt: 1_700_000_000_000,
      };
      const invalidCandidate = {
        mention: 42,
        sessionId: null,
        label: 7,
        sameWorkspace: "yes",
        createdAt: "now",
      };
      assertSameParse("result hợp lệ", oursSchema, stockSchema, [validCandidate]);
      assertSameParse("result không hợp lệ", oursSchema, stockSchema, [invalidCandidate]);
    });
  });

  test("(c) default export của remote-client === named TYPERT_REMOTE", () => {
    expect(oursRemote.default).toBe(oursRemote.TYPERT_REMOTE);
    expect(stockRemote.default).toBe(stockRemote.TYPERT_REMOTE);
  });

  test("(d) exports map: './typert' + './remote' đúng đường dẫn tương đối như stock", () => {
    const oursExports = OUR_PKG.exports ?? {};
    const stockExports = STOCK_PKG.exports ?? {};
    assert.deepStrictEqual(exportTarget(oursExports["./typert"]), exportTarget(stockExports["./typert"]));
    assert.deepStrictEqual(exportTarget(oursExports["./remote"]), exportTarget(stockExports["./remote"]));
    assert.strictEqual(exportTarget(oursExports["./typert"]), "./lib/typert.host.js");
    assert.strictEqual(exportTarget(oursExports["./remote"]), "./lib/typert.remote-client.js");
    expect(existsSync(join(ARTIFACT, "typert.host.js"))).toBe(true);
    expect(existsSync(join(ARTIFACT, "typert.remote-client.js"))).toBe(true);
  });

  test("(e) host: KHÔNG default export; TYPERT cùng key và 3 nhóm types/events/objects như stock", () => {
    expect("default" in oursHost).toBe(false);
    expect("default" in stockHost).toBe(false);
    assert.deepStrictEqual(Object.keys(oursHost).sort(), Object.keys(stockHost).sort());

    const oursManifest = oursHost.TYPERT;
    const stockManifest = stockHost.TYPERT;
    assert.deepStrictEqual(Object.keys(oursManifest).sort(), Object.keys(stockManifest).sort());

    // Stock sinh TYPERT với 3 nhóm dữ liệu nằm dưới model: services[*].types, events, objects.
    // Top-level stock là package/face/schemas/invocations/model — test so key với stock, không bịa khoá.
    const oursModel = oursManifest.model;
    const stockModel = stockManifest.model;
    assert.deepStrictEqual(Object.keys(oursModel).sort(), Object.keys(stockModel).sort());
    assert.deepStrictEqual(Object.keys(oursModel).sort(), ["events", "objects", "services"]);
    // test cập nhật theo identity GBH (Lead duyệt 08/11): typeSymbol của ta mang id gbh-session ⇒ align phần identity
    // của module session ở phía stock trước khi so (giữ nguyên phép so DEEP EQUAL cho toàn bộ phần còn lại).
    assert.deepStrictEqual(
      oursModel.services.map((service) => service.types),
      alignStock(stockModel.services.map((service) => service.types)),
      "types của từng service",
    );
    assert.deepStrictEqual(oursModel.events, alignStock(stockModel.events), "events");
    assert.deepStrictEqual(oursModel.objects, alignStock(stockModel.objects), "objects");
    expect(oursModel.services.every((service) => Array.isArray(service.types))).toBe(true);
    expect(Array.isArray(oursModel.events)).toBe(true);
    expect(Array.isArray(oursModel.objects)).toBe(true);
  });
});
