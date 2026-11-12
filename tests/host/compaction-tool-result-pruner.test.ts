/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B cho @galaxy-blackhole/gbh-compaction-tool-result-pruner (row LỒNG trong GROUP 'compaction'):
 *      artefact TRÙNG TỪNG BYTE bundle gốc, bề mặt export runtime, String(Config) + 5 đầu vào Config,
 *      resolveConfig + helper thuần, mount lớp Service trên Context cordis THẬT với tokenMeter GIẢ (đọc
 *      'inject' từ bundle), A/B pruneContent + pruneSession (kể cả nhánh append ném lỗi), và giao kèo
 *      package.json/locale/symlink. KHÔNG mạng, KHÔNG spawn tiến trình.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

// 05/11/2026 (P1b): chuẩn hoá id GBH → id gốc trước khi so byte với bundle stock.
import { chuanHoaHost } from "../lib/artefact-normalize.ts";
import { buildPackage } from "../../packages/host/compaction-tool-result-pruner/build.ts";
import { assembleBundle, stripSliceScaffold } from "../../packages/host/compaction-tool-result-pruner/src/assemble.ts";
import { MODULE_TAIL, PART_FILES, SLICE_MARKER } from "../../packages/host/compaction-tool-result-pruner/src/manifest.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "compaction-tool-result-pruner");
/** Artefact của ta. */
const LIB = join(PKG, "lib", "index.js");
/** Thư mục gói GỐC (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-compaction-tool-result-pruner");
/** Bundle GỐC. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis THẬT của kernel. */
const CORDIS = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Nội dung bundle gốc. */
const STOCK_TEXT = readFileSync(STOCK, "utf8");
/** Nội dung artefact của ta. */
const LIB_TEXT = readFileSync(LIB, "utf8");
/** Ngân sách test: marker 39 code point + 10 + 10 = 59 ≤ 100. */
const BUDGET: Record<string, number> = { thresholdChars: 100, headChars: 10, tailChars: 10 };
/** Bộ export runtime ĐÚNG của gói (thứ tự đã sắp). */
const EXPORT_NAMES = ["DEFAULTS", "PRUNE_MARKER", "ToolResultPruner", "codePointLength", "default", "resolveConfig"];
/** Marker nguyên văn của stock. */
const MARKER = "\n\n[... tool result middle pruned ...]\n\n";
/** Bảy dịch vụ mà gói khai (peer + dependency) — mọi tên đều nằm dưới @deepseek-ai. */
const DEP_NAMES = [
  "@deepseek-ai/cordis",
  "@deepseek-ai/dsh-compaction",
  "@deepseek-ai/dsh-llm",
  "@deepseek-ai/dsh-session",
  "@deepseek-ai/dsh-token-meter",
  "@deepseek-ai/dsh-util-values",
  "@deepseek-ai/schemastery",
];
/** Bộ resolve theo gói của ta (kiểm symlink node_modules). */
const requireFromPackage = createRequire(join(PKG, "package.json"));

/**
 * Đọc `version` trong package.json GẦN NHẤT của một đường dẫn đã phân giải.
 * Nhận: entryPath — đường dẫn tuyệt đối tới tệp entry đã require.resolve.
 * Trả: chuỗi version của gói chứa tệp đó.
 */
function versionOfResolved(entryPath: string): string {
  let dir = dirname(entryPath);
  for (;;) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) {
      return (JSON.parse(readFileSync(candidate, "utf8")) as { version: string }).version;
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error("khong tim thay package.json cho " + entryPath);
    dir = parent;
  }
}

/** Bề mặt module (của ta hoặc gốc). */
type Api = Record<string, any>;

/** Schema Config (Standard Schema của schemastery). */
interface ConfigLike {
  /** Cổng validate chuẩn. */
  "~standard": { validate(value: unknown): { value?: unknown; issues?: unknown } };
  /** Chuỗi mô tả schema. */
  toString(): string;
}

/** Một block nội dung tool-result. */
interface BlockLike {
  /** Loại block (text/image/...). */
  type: string;
  /** Văn bản của block text. */
  text?: string;
  /** Trường khác của block. */
  [key: string]: unknown;
}

/** Một dòng kết quả prune. */
interface PruneEntryLike {
  /** Seq gốc bị che. */
  originalSeq: number;
  /** Seq của bản thay thế. */
  replacementSeq: number;
  /** callId của lời gọi tool. */
  callId: string;
  /** Code point trước khi cắt. */
  charsBefore: number;
  /** Code point sau khi cắt. */
  charsAfter: number;
}

/** Kết quả pruneSession. */
interface PruneResultLike {
  /** Các bản thay thế đã đáp. */
  pruned: PruneEntryLike[];
  /** Tổng code point tiết kiệm. */
  charsRemoved: number;
}

/** Lớp service ToolResultPruner. */
interface PrunerClass {
  /** Dựng service và đăng ký lên Context. */
  new (ctx: unknown, config?: Record<string, unknown>): PrunerLike;
  /** Dịch vụ bắt buộc của plugin. */
  inject: string[];
  /** Schema cấu hình. */
  Config: ConfigLike;
}

/** Thân service mà test chạm tới. */
interface PrunerLike {
  /** Tên dịch vụ đã đăng ký. */
  name: string;
  /** Ngân sách đã resolve (đóng băng). */
  config: Record<string, number>;
  /** Đo code point của các block. */
  measureContent(blocks: readonly BlockLike[]): number;
  /** Cắt phần giữa quá ngân sách. */
  pruneContent(blocks: readonly BlockLike[]): BlockLike[] | null;
  /** Cắt mọi tool-result quá ngân sách của một surface. */
  pruneSession(session: SessionLike): PruneResultLike;
}

/** Thông điệp tool-result GIẢ. */
interface MessageLike {
  /** Vai trò. */
  role: string;
  /** Nguồn sinh (callId). */
  source: { callId: string };
  /** Nội dung. */
  content: BlockLike[];
  /** Trường khác (details...). */
  [key: string]: unknown;
}

/** Một event GIẢ của phiên. */
interface EventLike {
  /** Số thứ tự. */
  seq: number;
  /** Loại event. */
  type: string;
  /** Dữ liệu event. */
  data: any;
}

/** Một lượt append đã bắt. */
interface AppendCall {
  /** Seq cấp cho event. */
  seq: number;
  /** Loại event. */
  type: string;
  /** Dữ liệu event. */
  data: any;
  /** Tuỳ chọn surface. */
  options?: any;
}

/** Phiên GIẢ tối thiểu đúng hợp đồng pruneSession gọi. */
interface SessionLike {
  /** Surface hiện tại. */
  surface: { nodes: number[] };
  /** Vết append. */
  appended: AppendCall[];
  /** Tra event theo seq. */
  eventAt(seq: number): EventLike | undefined;
  /** Dựng thông điệp từ event. */
  deriveEventMessage(event: EventLike): MessageLike;
  /** Ghi event mới. */
  append(type: string, data: any, options?: any): { seq: number };
}

/** Fiber cordis (chỉ đọc trạng thái). */
interface FiberLike {
  /** 0 = chờ inject, 2 = đã chạy. */
  state?: number;
  /** Chờ fiber ổn định. */
  await(): Promise<unknown>;
}

/** Context cordis tối thiểu mà test chạm tới. */
interface CtxLike {
  /** Cấp một dịch vụ. */
  provide(name: string, value: unknown): void;
  /** Đăng ký plugin theo vòng đời cordis THẬT. */
  plugin(plugin: unknown, config?: Record<string, unknown>): FiberLike;
  /** Tra dịch vụ đã cấp. */
  get(name: string): unknown;
  /** Trường khác của Context. */
  [key: string]: unknown;
}

/** tokenMeter GIẢ + vết gọi. */
interface Meter {
  /** Dịch vụ cấp cho Context. */
  service: { estimateMessage(message: MessageLike): number };
  /** Các thông điệp đã ước lượng. */
  calls: MessageLike[];
}

/** Một lượt mount service. */
interface Mount {
  /** Context vừa dựng. */
  ctx: CtxLike;
  /** Fiber của plugin. */
  fiber: FiberLike;
  /** Service đã đăng ký. */
  service: PrunerLike;
  /** tokenMeter giả của lượt này. */
  meter: Meter;
}

/** Một lượt chạy pruneSession. */
interface SessionRun {
  /** Kết quả hoặc lỗi đã chuẩn hoá. */
  result: Outcome<PruneResultLike>;
  /** Vết append. */
  appended: AppendCall[];
  /** Số lượt estimateMessage. */
  estimates: number;
  /** Surface sau lượt chạy. */
  nodes: number[];
}

/** Kết quả một phép chạy có thể ném. */
type Outcome<T> = { ok: true; value: T } | { ok: false; name: string; message: string };

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Nạp cordis THẬT từ runtime của app.
 * Nhận: không.
 * Trả: lớp Context.
 */
async function loadCordis(): Promise<new () => unknown> {
  const mod = (await import(CORDIS)) as { Context: new () => unknown };
  return mod.Context;
}

/** Lớp Context cordis THẬT. */
const ContextCtor = await loadCordis();
/** Nạp artefact của ta. */
const ours = (await import(LIB)) as Api;
/** Nạp bundle gốc. */
const stock = (await import(STOCK)) as Api;

/**
 * Lấy lớp service của một bên.
 * Nhận: api — bề mặt module.
 * Trả: PrunerClass.
 */
function prunerOf(api: Api): PrunerClass {
  return api["ToolResultPruner"] as PrunerClass;
}

/**
 * Dựng tokenMeter GIẢ đếm số lượt ước lượng.
 * Nhận: tokenCount — số token giả trả về (mặc định 123).
 * Trả: Meter.
 */
function makeMeter(tokenCount = 123): Meter {
  const calls: MessageLike[] = [];
  return {
    calls,
    service: {
      estimateMessage: (message: MessageLike): number => {
        calls.push(message);
        return tokenCount;
      },
    },
  };
}

/**
 * Dựng dịch vụ GIẢ cho MỘT tên trong static inject của bundle.
 * Nhận: name — tên dịch vụ; meter — tokenMeter giả.
 * Trả: dịch vụ cấp cho Context; ném khi gặp tên chưa có bản giả.
 */
function serviceFor(name: string, meter: Meter): unknown {
  if (name === "tokenMeter") return meter.service;
  throw new Error("dich vu inject la: " + name);
}

/**
 * Dựng Context cordis THẬT + dịch vụ GIẢ theo ĐÚNG inject đọc từ bundle rồi mount lớp service.
 * Nhận: api — bề mặt module; config — cấu hình truyền cho plugin.
 * Trả: Mount khi service đã ACTIVE.
 */
async function mount(api: Api, config: Record<string, unknown> = BUDGET): Promise<Mount> {
  const ctx = new ContextCtor() as unknown as CtxLike;
  const meter = makeMeter();
  for (const name of prunerOf(api).inject) ctx.provide(name, serviceFor(name, meter));
  const fiber = ctx.plugin(prunerOf(api), config);
  await fiber.await();
  const service = ctx.get("toolResultPruner") as PrunerLike | undefined;
  if (service === undefined) throw new Error("ctx.toolResultPruner chua duoc dang ky");
  return { ctx, fiber, service, meter };
}

/**
 * Chạy một phép có thể ném rồi chuẩn hoá kết quả.
 * Nhận: run — hàm cần chạy.
 * Trả: Outcome<T>.
 */
function outcomeOf<T>(run: () => T): Outcome<T> {
  try {
    return { ok: true, value: run() };
  } catch (error) {
    const caught = error as Error;
    return { ok: false, name: caught.name, message: caught.message };
  }
}

/**
 * Dựng event tool/result GIẢ.
 * Nhận: seq — số thứ tự; text — văn bản duy nhất của block text.
 * Trả: EventLike.
 */
function toolEvent(seq: number, text: string): EventLike {
  return {
    seq,
    type: "tool/result",
    data: {
      message: {
        role: "tool",
        source: { callId: "call-" + String(seq) },
        content: [{ type: "text", text }],
        details: { k: seq },
      },
    },
  };
}

/**
 * Dựng phiên GIẢ: 5 node surface (2 tool-result quá ngân sách + 1 tool-result ngắn + 1 non-tool + 2 tool-result quá ngân sách).
 * Nhận: failCallId — callId mà append("tool/result") phải ném (tuỳ chọn).
 * Trả: SessionLike.
 */
function makeSession(failCallId?: string): SessionLike {
  const events = new Map<number, EventLike>();
  events.set(1, toolEvent(1, "A".repeat(160)));
  events.set(2, toolEvent(2, "short"));
  events.set(3, { seq: 3, type: "user/message", data: { message: { role: "user", content: [] } } });
  events.set(4, toolEvent(4, "😀".repeat(120)));
  events.set(5, toolEvent(5, "Z".repeat(200)));
  const appended: AppendCall[] = [];
  let next = 100;
  return {
    surface: { nodes: [1, 2, 3, 4, 5] },
    appended,
    eventAt: (seq: number): EventLike | undefined => events.get(seq),
    deriveEventMessage: (event: EventLike): MessageLike => event.data.message as MessageLike,
    append: (type: string, data: any, options?: any): { seq: number } => {
      const message = (data as { message?: MessageLike }).message;
      if (type === "tool/result" && message !== undefined && message.source.callId === failCallId) {
        throw new Error("session tu choi " + String(failCallId));
      }
      const event: AppendCall = { seq: next, type, data, options };
      next += 1;
      appended.push(event);
      return event;
    },
  };
}

/**
 * Mount một bên rồi chạy pruneSession trên phiên GIẢ.
 * Nhận: api — bề mặt module; failCallId — callId mà append phải ném (tuỳ chọn).
 * Trả: SessionRun đã chuẩn hoá.
 */
async function runSession(api: Api, failCallId?: string): Promise<SessionRun> {
  const mounted = await mount(api);
  const session = makeSession(failCallId);
  const result = outcomeOf(() => mounted.service.pruneSession(session));
  return { result, appended: session.appended, estimates: mounted.meter.calls.length, nodes: session.surface.nodes };
}

/**
 * Chụp bề mặt mount (trạng thái, tên, config, phương thức) để so A/B.
 * Nhận: mounted — lượt mount.
 * Trả: object JSON-so-sánh-được.
 */
function mountShape(mounted: Mount): Record<string, unknown> {
  const service = mounted.service as unknown as Record<string, unknown>;
  return {
    state: mounted.fiber.state ?? -1,
    name: mounted.service.name,
    config: mounted.service.config,
    frozen: Object.isFrozen(mounted.service.config),
    methods: ["measureContent", "pruneContent", "pruneSession"].map((key) => typeof service[key]),
    // cordis bọc service trong tracker nên so DANH TÍNH là sai — chỉ so dịch vụ HIỆN RA qua get().
    viaGet: (mounted.ctx.get("toolResultPruner") as PrunerLike | undefined)?.name ?? null,
  };
}

/**
 * Mount service KHI CHƯA cấp dịch vụ inject, rồi cấp tokenMeter để fiber chạy.
 * Nhận: api — bề mặt module.
 * Trả: object trạng thái trước/sau + tên dịch vụ + inject đọc từ bundle.
 */
async function mountLate(api: Api): Promise<Record<string, unknown>> {
  const ctx = new ContextCtor() as unknown as CtxLike;
  const fiber = ctx.plugin(prunerOf(api), BUDGET);
  const before = fiber.state ?? -1;
  const meter = makeMeter();
  ctx.provide("tokenMeter", meter.service);
  await fiber.await();
  const service = ctx.get("toolResultPruner") as PrunerLike | undefined;
  return { before, after: fiber.state ?? -1, name: service === undefined ? null : service.name, inject: prunerOf(api).inject };
}

/**
 * Chụp kết quả resolveConfig của một bên.
 * Nhận: api — bề mặt module; input — cấu hình thô.
 * Trả: Outcome chứa config đã resolve.
 */
function resolveOutcome(api: Api, input: Record<string, unknown>): Outcome<Record<string, number>> {
  return outcomeOf(() => (api["resolveConfig"] as (config: Record<string, unknown>) => Record<string, number>)(input));
}

describe("artefact: bundle NGUYÊN VĂN TỪNG BYTE + giao kèo gói", () => {
  test("lib/index.js TRÙNG TỪNG BYTE bundle gốc (bytes/sha/newline cuối)", () => {
    // 05/11/2026 (P1b): artefact mang id GBH ⇒ quy id về dạng gốc rồi mới so byte/độ dài/sha với stock.
    const LIB_CHUAN = chuanHoaHost(LIB_TEXT);
    expect(Buffer.byteLength(LIB_CHUAN, "utf8")).toBe(7570);
    expect(Buffer.byteLength(LIB_CHUAN, "utf8")).toBe(Buffer.byteLength(STOCK_TEXT, "utf8"));
    expect(LIB_CHUAN).toBe(STOCK_TEXT);
    expect(sha256(LIB_CHUAN)).toBe(sha256(STOCK_TEXT));
    expect(sha256(LIB_CHUAN)).toBe("e86442e9a2403c392482b9035916e5610c251d62f3581892866404d69c064254");
    expect(LIB_TEXT.endsWith("\n")).toBe(true);
  });

  test("ghép lát = đúng văn bản gốc; manifest khớp thư mục; lát ≤ 1000 dòng", () => {
    expect(assembleBundle()).toBe(STOCK_TEXT);
    const partsDir = join(PKG, "src", "parts");
    expect(readdirSync(partsDir).sort()).toEqual([...PART_FILES].sort());
    expect(PART_FILES).toHaveLength(1);
    for (const fileName of PART_FILES) {
      const source = readFileSync(join(partsDir, fileName), "utf8");
      expect(source.split("\n").length).toBeLessThanOrEqual(1000);
      expect(source).toContain(SLICE_MARKER);
      expect(source.trimEnd().endsWith(MODULE_TAIL)).toBe(true);
      const body = stripSliceScaffold(source, fileName);
      // 194 dòng stock + MỘT dòng rỗng cuối (giữ đúng ký tự xuống dòng cuối của bundle gốc).
      expect(body).toHaveLength(195);
      expect(body[194]).toBe("");
      expect(body.join("\n")).toBe(STOCK_TEXT);
      expect(body.join("\n")).not.toContain(SLICE_MARKER);
      expect(body[0]).toBe('import { Service } from "@deepseek-ai/cordis";');
    }
  });

  test("buildPackage ghi outDir/index.js và giữ cổng byte delta 0", () => {
    const dir = mkdtempSync(join(tmpdir(), "gbh-compaction-pruner-"));
    try {
      const file = buildPackage(dir);
      expect(file).toBe(join(dir, "index.js"));
      // 05/11/2026 (P1b): buildPackage ghi bản ĐÃ đổi id ⇒ chuẩn hoá lại trước khi so với stock.
      expect(chuanHoaHost(readFileSync(file, "utf8"))).toBe(STOCK_TEXT);
      expect(Buffer.byteLength(chuanHoaHost(readFileSync(file, "utf8")), "utf8")).toBe(statSync(STOCK).size);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("package.json + locale + symlink node_modules đúng giao kèo (KHÔNG gbh.row)", () => {
    const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Record<string, any>;
    const stockPkg = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as Record<string, any>;
    expect(pkg["name"]).toBe("@galaxy-blackhole/gbh-compaction-tool-result-pruner");
    expect(pkg["private"]).toBe(true);
    expect(pkg["type"]).toBe("module");
    expect(pkg["main"]).toBe("lib/index.js");
    // 08/11/2026 (dev-1): chính sách types của Lead — gói CÓ lib/types/index.d.ts thì exports["."] phải khai
    // CẢ 'types' + 'default' (đúng hình dạng stock).
    expect(pkg["exports"]).toEqual({
      ".": { types: "./lib/types/index.d.ts", default: "./lib/index.js" },
      "./locale/*.json": "./locale/*.json",
      "./package.json": "./package.json",
    });
    expect(pkg["peerDependencies"]).toEqual(stockPkg["peerDependencies"]);
    expect(pkg["dependencies"]).toEqual(stockPkg["dependencies"]);
    expect(pkg["gbh"]).toEqual({
      peers: DEP_NAMES,
      tests: ["tests/host/compaction-tool-result-pruner.test.ts"],
      nested: {
        kind: "group",
        pluginId: "tool-result-pruner",
        stockId: "@deepseek-ai/dsh-compaction-tool-result-pruner",
        presets: ["preset-standard", "preset-ptc", "preset-cordis"],
      },
      // 20/10/2026 (task-162): `provenance` là khai báo CÓ CHỦ ĐÍCH của lô chuyển giao (nguồn stock +
      // version + sha bundle gốc). Canh ĐÚNG nội dung, không chỉ thêm khoá cho khớp hình dạng.
      provenance: {
        stock: stockPkg["name"],
        version: stockPkg["version"],
        sha: createHash("sha256").update(STOCK_TEXT, "utf8").digest("hex"),
      },
    });
    expect(pkg["gbh"]["row"]).toBeUndefined();
    for (const name of DEP_NAMES) {
      expect(existsSync(join(PKG, "node_modules", name))).toBe(true);
      // BỀN QUA `bun install`: KHÔNG đòi đường dẫn vật lý (install luôn trỏ symlink về .bun của workspace),
      // mà đòi ĐÚNG VERSION mà kernel cấp — bản bundle byte-identical phải chạy trên đúng bản peer của kernel.
      expect(versionOfResolved(requireFromPackage.resolve(name))).toBe(
        (JSON.parse(readFileSync(join(REPO, "apps", "host", "node_modules", name, "package.json"), "utf8")) as {
          version: string;
        }).version,
      );
    }
    for (const locale of ["en.json", "zh.json"]) {
      expect(readFileSync(join(PKG, "locale", locale), "utf8")).toBe(readFileSync(join(STOCK_DIR, "locale", locale), "utf8"));
    }
  });
});

describe("bề mặt module + Config + helper thuần (A stock / B của ta)", () => {
  test("tập export runtime TRÙNG nhau; default là chính lớp ToolResultPruner", () => {
    const keysA = Object.keys(stock).sort();
    const keysB = Object.keys(ours).sort();
    expect(keysB).toEqual(keysA);
    expect(keysA).toEqual([...EXPORT_NAMES].sort());
    for (const name of EXPORT_NAMES) expect(typeof ours[name]).toBe(typeof stock[name]);
    expect(ours["default"]).toBe(ours["ToolResultPruner"]);
    expect(stock["default"]).toBe(stock["ToolResultPruner"]);
    expect(ours["default"]).not.toBe(stock["default"]);
    expect(prunerOf(stock).inject).toEqual(["tokenMeter"]);
    expect(prunerOf(ours).inject).toEqual(prunerOf(stock).inject);
  });

  test("String(Config) trùng + 5 đầu vào Config cho CÙNG value/issues", () => {
    const configA = prunerOf(stock).Config;
    const configB = prunerOf(ours).Config;
    expect(String(configA)).toBe(String(configB));
    expect(String(configA)).toBe("{ thresholdChars?: number, headChars?: number, tailChars?: number }");
    const cases: Record<string, unknown>[] = [
      {},
      { thresholdChars: 120, headChars: 10, tailChars: 5 },
      { unknown: 1 },
      { headChars: -1 },
      { thresholdChars: 10.5 },
    ];
    const outcomes = cases.map((input) => configA["~standard"].validate(input));
    expect(JSON.stringify(outcomes)).toBe(JSON.stringify(cases.map((input) => configB["~standard"].validate(input))));
    expect(outcomes[0]).toEqual({ value: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 } });
    expect(outcomes[1]).toEqual({ value: { thresholdChars: 120, headChars: 10, tailChars: 5 } });
    expect(outcomes[2]).toEqual({ value: { thresholdChars: 8192, headChars: 4096, tailChars: 1024, unknown: 1 } });
    expect(outcomes[3]).toEqual({ issues: [{ message: "$.headChars expected number >= 0 but got -1", path: ["headChars"] }] });
    expect(outcomes[4]).toEqual({ issues: [{ message: "$.thresholdChars expected number multiple of 1 but got 10.5", path: ["thresholdChars"] }] });
  });

  test("resolveConfig: 6 đầu vào cho CÙNG kết quả + config đóng băng sâu", () => {
    const cases: Record<string, unknown>[] = [
      {},
      { thresholdChars: 100, headChars: 10, tailChars: 5 },
      { nope: 1 },
      { thresholdChars: 0 },
      { thresholdChars: 10, headChars: 10, tailChars: 10 },
      { thresholdChars: 50, headChars: 0, tailChars: 0 },
    ];
    for (const input of cases) {
      expect(JSON.stringify(resolveOutcome(ours, input))).toBe(JSON.stringify(resolveOutcome(stock, input)));
    }
    const defaults = resolveOutcome(ours, {});
    const defaultsAgain = resolveOutcome(ours, {});
    expect(defaults).toEqual({ ok: true, value: { thresholdChars: 8192, headChars: 4096, tailChars: 1024 } });
    if (defaults.ok && defaultsAgain.ok) {
      expect(Object.isFrozen(defaults.value)).toBe(true);
      expect(defaults.value).not.toBe(defaultsAgain.value);
    }
    const unknown = resolveOutcome(ours, { nope: 1 });
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.message).toBe('ToolResultPruneConfig: unknown key "nope" (allowed: thresholdChars, headChars, tailChars)');
    const over = resolveOutcome(ours, { thresholdChars: 10, headChars: 10, tailChars: 10 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.message).toBe("ToolResultPruneConfig: headChars + marker + tailChars (59) must be at most thresholdChars (10)");
    expect(resolveOutcome(ours, { thresholdChars: 50, headChars: 0, tailChars: 0 })).toEqual({
      ok: true,
      value: { thresholdChars: 50, headChars: 0, tailChars: 0 },
    });
  });

  test("helper thuần: codePointLength + PRUNE_MARKER + DEFAULTS A/B", () => {
    const samples = ["", "abc", "a😀b", "😀😀", "é", "a\uD83D"];
    const expected = [0, 3, 3, 2, 1, 2];
    const lengthsA = samples.map((text) => (stock["codePointLength"] as (value: string) => number)(text));
    const lengthsB = samples.map((text) => (ours["codePointLength"] as (value: string) => number)(text));
    expect([lengthsA, lengthsB]).toEqual([expected, expected]);
    expect((stock["codePointLength"] as (value: string) => number)(samples[0] ?? "")).toBe(0);
    expect(stock["PRUNE_MARKER"]).toBe(MARKER);
    expect(ours["PRUNE_MARKER"]).toBe(MARKER);
    expect(stock["DEFAULTS"]).toEqual({ thresholdChars: 8192, headChars: 4096, tailChars: 1024 });
    expect(ours["DEFAULTS"]).toEqual(stock["DEFAULTS"]);
    expect(Object.isFrozen(stock["DEFAULTS"])).toBe(true);
    expect(Object.isFrozen(ours["DEFAULTS"])).toBe(true);
  });
});

describe("mount trên Context cordis THẬT: đăng ký service toolResultPruner", () => {
  test("plugin(ToolResultPruner) ⇒ service ACTIVE, tên/config/phương thức trùng stock", async () => {
    const a = await mount(stock);
    const b = await mount(ours);
    expect(mountShape(b)).toEqual(mountShape(a));
    expect(mountShape(a)).toEqual({
      state: 2,
      name: "toolResultPruner",
      config: BUDGET,
      frozen: true,
      methods: ["function", "function", "function"],
      viaGet: "toolResultPruner",
    });
  });

  test("inject đọc từ bundle: thiếu tokenMeter ⇒ fiber CHỜ (0), cấp sau ⇒ ACTIVE (2)", async () => {
    expect(prunerOf(stock).inject).toEqual(["tokenMeter"]);
    expect(() => serviceFor("khongCo", makeMeter())).toThrow("dich vu inject la: khongCo");
    const a = await mountLate(stock);
    const b = await mountLate(ours);
    expect(b).toEqual(a);
    expect(a).toEqual({ before: 0, after: 2, name: "toolResultPruner", inject: ["tokenMeter"] });
  });
});

describe("A/B pruneContent + measureContent (thuần, không chạm phiên)", () => {
  test("chưa vượt / ĐÚNG ngưỡng ⇒ null; measureContent đếm code point", async () => {
    const a = await mount(stock);
    const b = await mount(ours);
    const mixed: BlockLike[] = [{ type: "text", text: "abc" }, { type: "image", attachmentId: "i" }, { type: "text", text: "😀😀" }];
    expect(a.service.measureContent(mixed)).toBe(5);
    expect(b.service.measureContent(mixed)).toBe(5);
    expect(a.service.pruneContent([{ type: "text", text: "short" }])).toBeNull();
    expect(b.service.pruneContent([{ type: "text", text: "short" }])).toBeNull();
    const exact: BlockLike[] = [{ type: "text", text: "C".repeat(100) }];
    expect(a.service.measureContent(exact)).toBe(100);
    expect(a.service.pruneContent(exact)).toBeNull();
    expect(b.service.pruneContent(exact)).toBeNull();
  });

  test("quá ngân sách: giữ đầu/đuôi + marker, block giàu giữ nguyên thứ tự, không tách surrogate", async () => {
    const a = await mount(stock);
    const b = await mount(ours);
    const rich = (): BlockLike[] => [{ type: "text", text: "A".repeat(80) }, { type: "image", attachmentId: "x" }, { type: "text", text: "B".repeat(80) }];
    const astral = (): BlockLike[] => [{ type: "text", text: "😀".repeat(120) }];
    const multi = (): BlockLike[] => [
      { type: "text", text: "a".repeat(60) },
      { type: "image", attachmentId: "y" },
      { type: "text", text: "b".repeat(60) },
      { type: "text", text: "c".repeat(60) },
    ];
    const snapshot = (service: PrunerLike): unknown => ({
      rich: service.pruneContent(rich()),
      astral: service.pruneContent(astral()),
      multi: service.pruneContent(multi()),
    });
    expect(JSON.stringify(snapshot(b.service))).toBe(JSON.stringify(snapshot(a.service)));
    const richOut = a.service.pruneContent(rich()) ?? [];
    expect(richOut).toEqual([
      { type: "text", text: "A".repeat(10) + MARKER },
      { type: "image", attachmentId: "x" },
      { type: "text", text: "B".repeat(10) },
    ]);
    expect(a.service.measureContent(richOut)).toBe(59);
    expect(richOut).toHaveLength(3);
    expect(a.service.pruneContent(astral())).toEqual([{ type: "text", text: "😀".repeat(10) + MARKER + "😀".repeat(10) }]);
    expect(Array.from((a.service.pruneContent(astral())?.[0]?.text as string) ?? "").length).toBe(59);
    const multiOut = a.service.pruneContent(multi()) ?? [];
    expect(multiOut).toHaveLength(3);
    expect(multiOut[0]).toEqual({ type: "text", text: "a".repeat(10) + MARKER });
    expect(multiOut[1]).toEqual({ type: "image", attachmentId: "y" });
    expect(multiOut[2]).toEqual({ type: "text", text: "c".repeat(10) });
    expect(rich()[0]?.text).toHaveLength(80);
    expect(JSON.stringify(b.service.pruneContent(rich()))).toBe(JSON.stringify(a.service.pruneContent(rich())));
  });
});

describe("A/B pruneSession: thay thế surface + shadow-price + nhánh lỗi", () => {
  test("3 tool-result quá ngân sách ⇒ 3 cặp compaction/prune + tool/result, tokenMeter gọi 3 lần", async () => {
    const a = await runSession(stock);
    const b = await runSession(ours);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.result.ok).toBe(true);
    if (!a.result.ok) throw new Error("pruneSession nem loi: " + a.result.message);
    expect(a.result.value.pruned.map((entry) => [entry.originalSeq, entry.replacementSeq, entry.callId])).toEqual([
      [1, 101, "call-1"],
      [4, 103, "call-4"],
      [5, 105, "call-5"],
    ]);
    expect(a.result.value.pruned.map((entry) => [entry.charsBefore, entry.charsAfter])).toEqual([[160, 59], [120, 59], [200, 59]]);
    expect(a.result.value.charsRemoved).toBe(303);
    expect(a.appended).toHaveLength(6);
    expect(a.appended.map((call) => call.type)).toEqual([
      "compaction/prune",
      "tool/result",
      "compaction/prune",
      "tool/result",
      "compaction/prune",
      "tool/result",
    ]);
    expect(a.appended[0]?.data).toEqual({ shadowedRange: { start: 1, end: 1 }, shadowedSeqs: [1], shadowedTokenCount: 123 });
    expect(a.appended[1]?.options).toEqual({ surfaceOp: { op: "replace", startSeq: 1, endSeq: 1 }, sourceEventSeqs: [1] });
    const message = a.appended[1]?.data.message as MessageLike;
    expect(message.content).toEqual([{ type: "text", text: "A".repeat(10) + MARKER + "A".repeat(10) }]);
    expect(message.source.callId).toBe("call-1");
    expect(message["details"]).toEqual({ k: 1 });
    expect(Object.isFrozen(message)).toBe(true);
    expect(a.estimates).toBe(3);
    expect(a.nodes).toEqual([1, 2, 3, 4, 5]);
  });

  test("append('tool/result') ném ⇒ lỗi nguyên văn, thay thế TRƯỚC còn durable (A/B)", async () => {
    const a = await runSession(stock, "call-4");
    const b = await runSession(ours, "call-4");
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.result.ok).toBe(false);
    if (a.result.ok) throw new Error("pruneSession phai nem");
    expect(a.result.name).toBe("Error");
    expect(a.result.message).toBe("session tu choi call-4");
    expect(a.appended.map((call) => call.type)).toEqual(["compaction/prune", "tool/result", "compaction/prune"]);
    expect(a.appended[1]?.data.message.source.callId).toBe("call-1");
    expect(a.estimates).toBe(2);
  });
});
