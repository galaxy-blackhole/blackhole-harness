/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test HAI MẶT của row subagent: CỔNG BYTE 2 artefact typert so với stock.replaceAll(ownership),
 *      CỔNG OWNERSHIP (2/1 trường package của ta, 0 của stock), phân loại typeSymbol còn lại
 *      (ownership = 0) và bề mặt export runtime lib/index.js so với bundle gốc.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { buildPackage } from "../../packages/host/subagent/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "subagent");
/** Thư mục lib của ta (đã build). */
const OUR_LIB = join(PKG, "lib");
/** Thư mục lib stock (CHỈ ĐỌC). */
const STOCK_LIB = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-subagent", "lib");
/** Id package của TA. */
const OURS = "@galaxy-blackhole/gbh-subagent";
/** Tên gói GỐC trong kernel. */
const STOCK = "@deepseek-ai/dsh-subagent";
/** Trường ownership gốc (nguyên văn, kèm dấu phẩy). */
const OWNERSHIP_STOCK = "package: '" + STOCK + "',";
/** Trường ownership của TA (nguyên văn, kèm dấu phẩy). */
const OWNERSHIP_OURS = "package: '" + OURS + "',";

/** Dạng typeSymbol hợp lệ: id + #symbol, hoặc id + /face + #symbol. */
const TYPE_SYMBOL_SUFFIX = /^(?:\/(?:client|types))?#[A-Za-z][A-Za-z0-9_./:-]*$/;

/** Ngữ cảnh 6 chuỗi stock còn lại trong TỪNG artefact (kỳ vọng: chỉ typeSymbol). */
const EXPECTED_TYPE_SYMBOL_CONTEXTS: readonly string[] = [
  "111: typeSymbol: '@deepseek-ai/dsh-subagent#subagents/interruptByParent:mode',",
  "117: typeSymbol: '@deepseek-ai/dsh-subagent#subagents/interruptByParent:mode',",
  "125: typeSymbol: '@deepseek-ai/dsh-subagent/client#SubagentInterruptReceipt',",
  "143: typeSymbol: '@deepseek-ai/dsh-subagent/client#SubagentPromptRequest',",
  "149: typeSymbol: '@deepseek-ai/dsh-subagent/client#SubagentPromptRequest',",
  "158: typeSymbol: '@deepseek-ai/dsh-subagent/client#SubagentPromptReceipt',",
];

/** Bề mặt export runtime của stock 0.2.1-alpha.4 — chốt cứng để hai bên cùng đối chiếu. */
const EXPECTED_EXPORTS: readonly string[] = [
  "AssistantOutputFold",
  "NO_START_CAPABILITIES",
  "STRUCTURED_OUTPUT_TOOL",
  "SUBAGENT_DESCRIPTOR_VERSION",
  "SubagentDepthError",
  "SubagentError",
  "SubagentRunId",
  "SubagentRuntime",
  "appendDelegatedPolicyOverrides",
  "applyChildComposition",
  "assertPositiveFinite",
  "assertSubagentMaxDepth",
  "assertUsableCwd",
  "captureDelegatedPolicyOverrides",
  "childSessionMeta",
  "default",
  "delegationDepthOf",
  "finalAssistantOutput",
  "foldSubagentDescriptor",
  "parentAgentOptionsForDelegation",
  "resolveChildAgentOptions",
  "resolveChildDepth",
  "settleRunResult",
  "snapshotSubagentDescriptor",
  "subprocessRunHandle",
];

/** 3 event name của row (chuỗi, không phải hằng export ở bản gốc). */
const EVENT_NAMES: readonly string[] = ["subagent/start", "subagent/end", "subagent/provider-added"];

/** Một lần xuất hiện chuỗi id stock trong artefact. */
interface Occurrence {
  /** Số dòng 1-based. */
  readonly line: number;
  /** Dòng đã trim. */
  readonly text: string;
  /** Phần sau id: #symbol, /client#symbol, /types#symbol... */
  readonly suffix: string;
}

/** Một dòng khác nhau giữa bản stock và bản của ta. */
interface ChangedLine {
  /** Số dòng 1-based. */
  readonly line: number;
  /** Nội dung dòng bên stock. */
  readonly stock: string;
  /** Nội dung dòng bên ta. */
  readonly ours: string;
}

/** Nút schema schemastery tối thiểu cần so (bỏ uid/refs — bộ đếm toàn cục khác nhau). */
interface SchemaNode {
  /** Kiểu schema. */
  readonly type?: string;
  /** Bảng field của schema object. */
  readonly dict?: Readonly<Record<string, SchemaNode>>;
  /** Metadata (default/min/max/step...). */
  readonly meta?: Readonly<Record<string, unknown>>;
}

/** Lớp runtime tối thiểu cần đo (default export). */
interface RuntimeClass {
  /** Tên lớp. */
  readonly name: string;
  /** Danh sách service inject. */
  readonly inject?: readonly string[];
  /** Schema Config tĩnh. */
  readonly Config?: SchemaNode;
  /** Prototype của lớp. */
  readonly prototype: object;
}

/** Bề mặt module ESM: mọi tên export + default. */
interface ModuleSurface {
  /** Default export. */
  readonly default?: unknown;
  /** Lớp service chính. */
  readonly SubagentRuntime?: unknown;
  /** Các tên export còn lại. */
  readonly [name: string]: unknown;
}

/** Manifest host tối thiểu. */
interface HostFace {
  /** Tên package sở hữu manifest. */
  readonly package: string;
  /** Mặt của manifest. */
  readonly face: string;
  /** Model khai trong manifest. */
  readonly model: { readonly services: readonly { readonly key: string }[] };
}

/** Manifest remote tối thiểu. */
interface RemoteFace {
  /** Tên package sở hữu manifest (getter tiện dụng của bản gốc). */
  readonly package: string;
  /** Spec khai trong manifest. */
  readonly spec: { readonly package: string; readonly methods: Readonly<Record<string, unknown>> };
}

/** Thư mục lib đang được đo (lib thật, hoặc bản build tạm khi lib chưa có). */
let libDir = OUR_LIB;
/** Thư mục build tạm cần dọn (null khi đo lib thật). */
let tempDir: string | null = null;
/** Toàn văn artefact host của stock. */
let stockHost = "";
/** Toàn văn artefact host của ta. */
let ourHost = "";
/** Toàn văn artefact remote của stock. */
let stockRemote = "";
/** Toàn văn artefact remote của ta. */
let ourRemote = "";
/** Toàn văn bundle runtime của stock. */
let stockIndex = "";
/** Toàn văn bundle runtime của ta. */
let ourIndex = "";
/** Bề mặt export runtime của stock. */
let stockModule: ModuleSurface = {};
/** Bề mặt export runtime của ta. */
let ourModule: ModuleSurface = {};
/** Manifest host của stock. */
let stockHostFace: HostFace | null = null;
/** Manifest host của ta. */
let ourHostFace: HostFace | null = null;
/** Manifest remote của stock. */
let stockRemoteFace: RemoteFace | null = null;
/** Manifest remote của ta. */
let ourRemoteFace: RemoteFace | null = null;

/**
 * Băm sha256 một chuỗi UTF-8.
 * Nhận: text — chuỗi cần băm. Trả: hex sha256 (64 ký tự).
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Đếm số lần một chuỗi con xuất hiện.
 * Nhận: text — chuỗi nguồn; needle — chuỗi con. Trả: số lần xuất hiện (0 khi không có).
 */
function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

/**
 * Liệt kê mọi lần xuất hiện của một chuỗi id kèm ngữ cảnh dòng.
 * Nhận: text — toàn văn artefact; needle — chuỗi id cần tìm. Trả: danh sách occurrence theo thứ tự dòng.
 */
function occurrencesOf(text: string, needle: string): readonly Occurrence[] {
  const found: Occurrence[] = [];
  text.split("\n").forEach((raw, index) => {
    let from = 0;
    for (;;) {
      const at = raw.indexOf(needle, from);
      if (at < 0) break;
      const close = raw.indexOf("'", at + needle.length);
      found.push({
        line: index + 1,
        text: raw.trim(),
        suffix: close < 0 ? raw.slice(at + needle.length) : raw.slice(at + needle.length, close),
      });
      from = at + needle.length;
    }
  });
  return found;
}

/**
 * Định dạng một occurrence thành chuỗi (số dòng + nội dung dòng).
 * Nhận: occurrence — lần xuất hiện cần in. Trả: chuỗi để so với kỳ vọng.
 */
function formatOccurrence(occurrence: Occurrence): string {
  return String(occurrence.line) + ": " + occurrence.text;
}

/**
 * Gom các dòng khác nhau giữa hai văn bản.
 * Nhận: stockText — bản gốc; ourText — bản của ta. Trả: các dòng lệch (số dòng 1-based).
 */
function changedLines(stockText: string, ourText: string): readonly ChangedLine[] {
  const stockLines = stockText.split("\n");
  const ourLines = ourText.split("\n");
  const changed: ChangedLine[] = [];
  const total = Math.max(stockLines.length, ourLines.length);
  for (let index = 0; index < total; index += 1) {
    const stockLine = stockLines[index] ?? "";
    const ourLine = ourLines[index] ?? "";
    if (stockLine !== ourLine) changed.push({ line: index + 1, stock: stockLine, ours: ourLine });
  }
  return changed;
}

/**
 * Ép một giá trị chưa biết về lớp runtime tối thiểu.
 * Nhận: value — default export. Trả: cùng giá trị dưới kiểu RuntimeClass.
 */
function asClass(value: unknown): RuntimeClass {
  return value as RuntimeClass;
}

/**
 * Ép một namespace module về bề mặt export tối thiểu.
 * Nhận: value — kết quả import(). Trả: cùng giá trị dưới kiểu ModuleSurface.
 */
function asModule(value: unknown): ModuleSurface {
  return value as ModuleSurface;
}

/**
 * Chuẩn hoá schema schemastery thành mô tả so sánh được (bỏ uid/refs toàn cục).
 * Nhận: node — nút schema. Trả: object { type, text, meta, dict } đệ quy.
 */
function describeSchema(node: SchemaNode | undefined): unknown {
  if (node === undefined) return null;
  const dict: Record<string, unknown> = {};
  for (const key of Object.keys(node.dict ?? {}).sort()) dict[key] = describeSchema(node.dict?.[key]);
  return { type: node.type ?? null, text: String(node), meta: node.meta ?? null, dict };
}

/**
 * Lọc các export có giá trị là chuỗi sự kiện subagent/* (hằng tên sự kiện nếu có).
 * Nhận: surface — bề mặt module. Trả: bảng tên export → chuỗi sự kiện.
 */
function exportedEventStrings(surface: ModuleSurface): Readonly<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const key of Object.keys(surface).sort()) {
    const value = surface[key];
    if (typeof value === "string" && value.startsWith("subagent/")) found[key] = value;
  }
  return found;
}

/**
 * Import manifest host từ một thư mục lib.
 * Nhận: dir — thư mục lib. Trả: manifest TYPERT hoặc null khi không export.
 */
async function importHostFace(dir: string): Promise<HostFace | null> {
  const module = (await import(pathToFileURL(join(dir, "typert.host.js")).href)) as unknown as {
    readonly TYPERT?: HostFace;
  };
  return module.TYPERT ?? null;
}

/**
 * Import manifest remote từ một thư mục lib.
 * Nhận: dir — thư mục lib. Trả: manifest TYPERT_REMOTE (hoặc default) hay null.
 */
async function importRemoteFace(dir: string): Promise<RemoteFace | null> {
  const module = (await import(pathToFileURL(join(dir, "typert.remote-client.js")).href)) as unknown as {
    readonly TYPERT_REMOTE?: RemoteFace;
    readonly default?: RemoteFace;
  };
  return module.TYPERT_REMOTE ?? module.default ?? null;
}

/**
 * Chọn thư mục lib để đo: lib đã build, hoặc bản build tạm khi thiếu.
 * Nhận: không. Trả: đường dẫn thư mục chứa index.js + 2 artefact typert.
 */
async function ensureLib(): Promise<string> {
  const required = ["index.js", "typert.host.js", "typert.remote-client.js"];
  if (required.every((name) => existsSync(join(OUR_LIB, name)))) return OUR_LIB;
  tempDir = mkdtempSync(join(tmpdir(), "gbh-subagent-faces-"));
  await buildPackage(tempDir);
  return tempDir;
}

beforeAll(async () => {
  libDir = await ensureLib();
  stockHost = readFileSync(join(STOCK_LIB, "typert.host.js"), "utf8");
  ourHost = readFileSync(join(libDir, "typert.host.js"), "utf8");
  stockRemote = readFileSync(join(STOCK_LIB, "typert.remote-client.js"), "utf8");
  ourRemote = readFileSync(join(libDir, "typert.remote-client.js"), "utf8");
  stockIndex = readFileSync(join(STOCK_LIB, "index.js"), "utf8");
  ourIndex = readFileSync(join(libDir, "index.js"), "utf8");
  stockModule = asModule(await import(pathToFileURL(join(STOCK_LIB, "index.js")).href));
  ourModule = asModule(await import(pathToFileURL(join(libDir, "index.js")).href));
  stockHostFace = await importHostFace(STOCK_LIB);
  ourHostFace = await importHostFace(libDir);
  stockRemoteFace = await importRemoteFace(STOCK_LIB);
  ourRemoteFace = await importRemoteFace(libDir);
});

afterAll(() => {
  if (tempDir !== null) rmSync(tempDir, { recursive: true, force: true });
});

describe("subagent — CỔNG BYTE 2 artefact typert", () => {
  test("typert.host.js: đúng 2 lần thay ownership, bằng NGUYÊN VĂN từng byte + sha256", () => {
    const swaps = countOf(stockHost, OWNERSHIP_STOCK);
    expect(swaps).toBe(2);
    // P3 (04/11/2026): lat typert mang id MOI cua typert-generator trong header.
    const expected = stockHost
      .replaceAll(OWNERSHIP_STOCK, OWNERSHIP_OURS)
      .replaceAll("@deepseek-ai/dsh-typert-generator", "@galaxy-blackhole/gbh-typert-generator");
    expect(countOf(expected, OWNERSHIP_OURS)).toBe(2);
    expect(ourHost).toBe(expected);
    expect(sha256(ourHost)).toBe(sha256(expected));
    expect(sha256(ourHost)).toHaveLength(64);
    expect(sha256(ourHost)).not.toBe(sha256(stockHost));
    expect(statSync(join(libDir, "typert.host.js")).size).toBe(Buffer.byteLength(expected, "utf8"));
    expect(statSync(join(STOCK_LIB, "typert.host.js")).size).toBe(Buffer.byteLength(stockHost, "utf8"));
    expect(Buffer.byteLength(ourHost, "utf8")).toBe(
      Buffer.byteLength(stockHost, "utf8") +
        swaps * (OURS.length - STOCK.length) +
        (expected.split("@galaxy-blackhole/gbh-typert-generator").length - 1) *
          ("@galaxy-blackhole/gbh-typert-generator".length - "@deepseek-ai/dsh-typert-generator".length),
    );
  });

  test("typert.remote-client.js: đúng 1 lần thay ownership, bằng NGUYÊN VĂN từng byte + sha256", () => {
    const swaps = countOf(stockRemote, OWNERSHIP_STOCK);
    expect(swaps).toBe(1);
    const expected = stockRemote
      .replaceAll(OWNERSHIP_STOCK, OWNERSHIP_OURS)
      .replaceAll("@deepseek-ai/dsh-typert-generator", "@galaxy-blackhole/gbh-typert-generator");
    expect(countOf(expected, OWNERSHIP_OURS)).toBe(1);
    expect(ourRemote).toBe(expected);
    expect(sha256(ourRemote)).toBe(sha256(expected));
    expect(sha256(ourRemote)).toHaveLength(64);
    expect(sha256(ourRemote)).not.toBe(sha256(stockRemote));
    expect(statSync(join(libDir, "typert.remote-client.js")).size).toBe(Buffer.byteLength(expected, "utf8"));
    expect(Buffer.byteLength(ourRemote, "utf8")).toBe(
      Buffer.byteLength(stockRemote, "utf8") +
        swaps * (OURS.length - STOCK.length) +
        (expected.split("@galaxy-blackhole/gbh-typert-generator").length - 1) *
          ("@galaxy-blackhole/gbh-typert-generator".length - "@deepseek-ai/dsh-typert-generator".length),
    );
  });

  test("chỉ đúng các dòng trường package đổi: host 2 dòng (64, 169), remote 1 dòng (64)", () => {
    const hostChanged = changedLines(stockHost, ourHost);
    // P3 (04/11/2026): them dong 1 (header Generated by doi id typert-generator).
    expect(hostChanged.map((change) => change.line)).toEqual([1, 64, 169]);
    // P3: dong 1 la header `Generated by <id>` — gia tri GOC cua no la id typert-generator stock.
    expect(
      hostChanged.every(
        (change) =>
          change.stock.trim() === OWNERSHIP_STOCK ||
          change.stock.includes("@deepseek-ai/dsh-typert-generator"),
      ),
    ).toBe(true);
    expect(
      hostChanged.every(
        (change) =>
          change.ours.trim() === OWNERSHIP_OURS ||
          change.ours.includes("@galaxy-blackhole/gbh-typert-generator"),
      ),
    ).toBe(true);

    const remoteChanged = changedLines(stockRemote, ourRemote);
    // P3 (04/11/2026): them dong 1 (header Generated by doi id typert-generator).
    expect(remoteChanged.map((change) => change.line)).toEqual([1, 64]);
    expect(remoteChanged[1]?.stock.trim()).toBe(OWNERSHIP_STOCK);
    expect(remoteChanged[1]?.ours.trim()).toBe(OWNERSHIP_OURS);
  });
});

describe("subagent — CỔNG OWNERSHIP", () => {
  test("typert.host.js: ĐÚNG 2 trường package của gbh-subagent và 0 của stock", () => {
    expect(countOf(ourHost, "package: '" + OURS + "'")).toBe(2);
    expect(countOf(ourHost, OWNERSHIP_OURS)).toBe(2);
    expect(countOf(ourHost, "package: '" + STOCK + "'")).toBe(0);
    expect(countOf(ourHost, OWNERSHIP_STOCK)).toBe(0);
    expect(countOf(ourHost, OURS)).toBe(2);
    expect(countOf(ourHost, STOCK)).toBe(countOf(stockHost, STOCK) - 2);
  });

  test("typert.remote-client.js: ĐÚNG 1 trường package của gbh-subagent và 0 của stock", () => {
    expect(countOf(ourRemote, "package: '" + OURS + "'")).toBe(1);
    expect(countOf(ourRemote, OWNERSHIP_OURS)).toBe(1);
    expect(countOf(ourRemote, "package: '" + STOCK + "'")).toBe(0);
    expect(countOf(ourRemote, OWNERSHIP_STOCK)).toBe(0);
    expect(countOf(ourRemote, OURS)).toBe(1);
    expect(countOf(ourRemote, STOCK)).toBe(countOf(stockRemote, STOCK) - 1);
  });

  test("manifest runtime đọc ra id của TA: host TYPERT.package + remote spec.package", () => {
    expect(ourHostFace?.package).toBe(OURS);
    expect(stockHostFace?.package).toBe(STOCK);
    expect(ourHostFace?.face).toBe("host");
    expect(ourHostFace?.face).toBe(stockHostFace?.face);
    expect(ourRemoteFace?.spec.package).toBe(OURS);
    expect(stockRemoteFace?.spec.package).toBe(STOCK);
    expect((ourHostFace?.model.services ?? []).map((service) => service.key)).toEqual(
      (stockHostFace?.model.services ?? []).map((service) => service.key),
    );
    expect(Object.keys(ourRemoteFace?.spec.methods ?? {}).sort()).toEqual(
      Object.keys(stockRemoteFace?.spec.methods ?? {}).sort(),
    );
  });
});

describe("subagent — phân loại typeSymbol còn lại (ownership = 0)", () => {
  test("typert.host.js: 6 chuỗi stock còn lại đều là typeSymbol, ngữ cảnh khớp TỪNG DÒNG với stock", () => {
    const found = occurrencesOf(ourHost, STOCK);
    expect(found).toHaveLength(6);
    expect(countOf(ourHost, OWNERSHIP_STOCK)).toBe(0);
    expect(found.every((occurrence) => occurrence.text.startsWith("typeSymbol: '"))).toBe(true);
    expect(found.every((occurrence) => !occurrence.text.includes("package:"))).toBe(true);
    expect(found.map(formatOccurrence)).toEqual([...EXPECTED_TYPE_SYMBOL_CONTEXTS]);
    expect(found.every((occurrence) => TYPE_SYMBOL_SUFFIX.test(occurrence.suffix))).toBe(true);
    const stockTypeSymbols = occurrencesOf(stockHost, STOCK).filter((occurrence) =>
      occurrence.text.startsWith("typeSymbol: '"),
    );
    expect(stockTypeSymbols).toHaveLength(6);
    expect(stockTypeSymbols.map(formatOccurrence)).toEqual(found.map(formatOccurrence));
  });

  test("typert.remote-client.js: 6 chuỗi stock còn lại đều là typeSymbol, ngữ cảnh khớp TỪNG DÒNG với stock", () => {
    const found = occurrencesOf(ourRemote, STOCK);
    expect(found).toHaveLength(6);
    expect(countOf(ourRemote, OWNERSHIP_STOCK)).toBe(0);
    expect(found.every((occurrence) => occurrence.text.startsWith("typeSymbol: '"))).toBe(true);
    expect(found.every((occurrence) => !occurrence.text.includes("package:"))).toBe(true);
    expect(found.map(formatOccurrence)).toEqual([...EXPECTED_TYPE_SYMBOL_CONTEXTS]);
    expect(found.every((occurrence) => TYPE_SYMBOL_SUFFIX.test(occurrence.suffix))).toBe(true);
    const stockTypeSymbols = occurrencesOf(stockRemote, STOCK).filter((occurrence) =>
      occurrence.text.startsWith("typeSymbol: '"),
    );
    expect(stockTypeSymbols).toHaveLength(6);
    expect(stockTypeSymbols.map(formatOccurrence)).toEqual(found.map(formatOccurrence));
  });

  test("cả 2 artefact: 12 chuỗi stock còn lại chỉ là typeSymbol dạng /types# hoặc subagent#", () => {
    const all = [...occurrencesOf(ourHost, STOCK), ...occurrencesOf(ourRemote, STOCK)];
    expect(all).toHaveLength(12);
    expect(all.every((occurrence) => TYPE_SYMBOL_SUFFIX.test(occurrence.suffix))).toBe(true);
    expect(all.every((occurrence) => occurrence.text.startsWith("typeSymbol: '"))).toBe(true);
    expect(countOf(ourHost, OWNERSHIP_STOCK) + countOf(ourRemote, OWNERSHIP_STOCK)).toBe(0);
  });
});

describe("subagent — bề mặt export lib/index.js", () => {
  test("tập tên export của TA TRÙNG stock và trùng danh sách chốt 25 tên", () => {
    const stockKeys = Object.keys(stockModule).sort();
    const ourKeys = Object.keys(ourModule).sort();
    expect(stockKeys).toEqual([...EXPECTED_EXPORTS]);
    expect(ourKeys).toEqual(stockKeys);
    expect(ourKeys).toHaveLength(25);
    for (const key of stockKeys) expect(typeof ourModule[key]).toBe(typeof stockModule[key]);
  });

  test("default === SubagentRuntime, cùng tên lớp, cùng static + method prototype", () => {
    expect(ourModule.default).toBe(ourModule.SubagentRuntime);
    expect(stockModule.default).toBe(stockModule.SubagentRuntime);
    expect(typeof ourModule.default).toBe("function");
    const ours = asClass(ourModule.default);
    const stock = asClass(stockModule.default);
    expect(ours.name).toBe("SubagentRuntime");
    expect(ours.name).toBe(stock.name);
    expect(Object.getOwnPropertyNames(ours).sort()).toEqual(Object.getOwnPropertyNames(stock).sort());
    expect(Object.getOwnPropertyNames(ours.prototype).sort()).toEqual(
      Object.getOwnPropertyNames(stock.prototype).sort(),
    );
  });

  test("static Config (schema) + inject khớp stock từng thành phần", () => {
    const ours = asClass(ourModule.default);
    const stock = asClass(stockModule.default);
    expect(ours.inject).toEqual(stock.inject);
    expect([...(ours.inject ?? [])]).toEqual(["workingDirectory"]);
    expect(ours.Config?.type).toBe(stock.Config?.type);
    expect(ours.Config?.type).toBe("object");
    expect(Object.keys(ours.Config?.dict ?? {}).sort()).toEqual(Object.keys(stock.Config?.dict ?? {}).sort());
    expect(String(ours.Config)).toBe(String(stock.Config));
    expect(describeSchema(ours.Config)).toEqual(describeSchema(stock.Config));
  });

  test("3 event name: không export hằng sự kiện; mỗi chuỗi subagent/* có mặt đúng 1 lần trong bundle", () => {
    const stockEvents = exportedEventStrings(stockModule);
    const ourEvents = exportedEventStrings(ourModule);
    expect(ourEvents).toEqual(stockEvents);
    expect(Object.keys(ourEvents)).toHaveLength(Object.keys(stockEvents).length);
    for (const name of EVENT_NAMES) {
      expect(countOf(ourIndex, '"' + name + '"')).toBe(1);
      expect(countOf(stockIndex, '"' + name + '"')).toBe(1);
    }
    expect(ourIndex).toContain('emit("subagent/start", identity, parent)');
    expect(ourIndex).toContain('emit("subagent/end", {');
    expect(ourIndex).toContain('emit("subagent/provider-added", provider)');
  });
});
