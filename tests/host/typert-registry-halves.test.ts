/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho gói BA ARTEFACT @galaxy-blackhole/gbh-typert-registry (client KÉP browser/node):
 *      đo dòng/byte/sha ba artefact theo bảng chuẩn, bề mặt package.json (dsh.client · exports 3 nhánh
 *      ./client · gbh park), hai cửa Bun.build, export ESM của client.node/index, và src-handwritten ngoài build.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/typert-registry/build.ts";

/** Gốc repo (tests/host ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "typert-registry");
/** Thư mục lib của ta (3 artefact + 2 entry Bun.build). */
const OUR_LIB = join(PKG, "lib");
/** Thư mục gói GỐC (CHỈ ĐỌC — nguồn đối chiếu byte). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-typert-registry");
/** Thư mục lib của gói gốc. */
const STOCK_LIB = join(STOCK_PKG, "lib");
/** Id MỘT-ID của ta (37 ký tự — đo trên chính chuỗi id). */
const OUR_ID = "@galaxy-blackhole/gbh-typert-registry";
/** Id gốc của bản stock (32 ký tự) — chênh 5 byte mỗi lần id ta xuất hiện. */
const STOCK_ID = "@deepseek-ai/dsh-typert-registry";
/** Tên artefact nửa host. */
const HOST_FILE = "index.js";
/** Tên artefact client BROWSER (script classic, có loader). */
const CLIENT_BROWSER_FILE = "client.browser.js";
/** Tên artefact client NODE (ESM thuần, KHÔNG có loader). */
const CLIENT_NODE_FILE = "client.node.js";

/** Bộ export ESM của lib/index.js — ĐÚNG 5 tên như bản gốc, đã sắp xếp. */
const INDEX_EXPORTS = ["TypertRegistry", "default", "typertEndpoint", "typertKey", "typertPackageKey"];
/** Bộ export ESM của lib/client.node.js — plugin cordis tối thiểu, đã sắp xếp. */
const CLIENT_EXPORTS = ["apply", "inject"];
/** Bộ export của lib/index-entry.js (artefact host + API nửa client browser), đã sắp xếp. */
const ENTRY_EXPORTS = [
  "CLIENT_LOADER_SHAPE",
  "OUR_CLIENT_ID",
  "STOCK_CLIENT_ID",
  "TypertRegistry",
  "assembleClientBundle",
  "default",
  "readWrapper",
  "typertEndpoint",
  "typertKey",
  "typertPackageKey",
];

/** Một mục trong exports của package.json (object điều kiện hoặc đường dẫn thẳng). */
type ExportEntry = string | Record<string, string>;

/** Hình dạng package.json mà test chạm tới (chỉ các khoá có mặt trong gói). */
interface PkgShape {
  name?: string;
  exports?: Record<string, ExportEntry>;
  dsh?: { client?: { inject?: string[]; platform?: string; immediately?: boolean } };
  gbh?: {
    draft?: string;
    tests?: string[];
    row?: unknown;
    row_unmounted_ly_do?: {
      ly_do?: string;
      row?: {
        id?: string;
        stockId?: string;
        moduleIds?: string[];
        aliases?: string[];
        tests?: string[];
      };
    };
  };
}

/** Số đo một artefact: văn bản + số dòng + số byte + sha256 đầy đủ. */
interface ArtefactMeasure {
  /** Nội dung UTF-8. */
  text: string;
  /** Số ký tự xuống dòng (quy ước wc -l, khớp cột "dòng" của bảng đo). */
  lines: number;
  /** Kích thước tệp trên đĩa (byte). */
  bytes: number;
  /** sha256 hex 64 ký tự. */
  sha: string;
}

/** Bề mặt module ESM nạp bằng await import(). */
type ModuleShape = Record<string, unknown>;

/**
 * Đọc một tệp văn bản UTF-8.
 * Nhận: path — đường dẫn tuyệt đối tới tệp.
 * Trả: nội dung tệp dạng chuỗi.
 */
function readText(path: string): string {
  return readFileSync(path, "utf8");
}

/**
 * Đọc và parse một tệp package.json.
 * Nhận: path — đường dẫn tuyệt đối tới package.json.
 * Trả: object đã parse, thu hẹp về các khoá test dùng.
 */
function readPkg(path: string): PkgShape {
  return JSON.parse(readText(path)) as PkgShape;
}

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Đo độ dài BYTE UTF-8 của một chuỗi.
 * Nhận: text — chuỗi cần đo.
 * Trả: số byte khi mã hoá UTF-8.
 */
function byteLength(text: string): number {
  return Buffer.byteLength(text, "utf8");
}

/**
 * Đếm số ký tự xuống dòng của một văn bản (quy ước wc -l, khớp cột "dòng" của bảng đo).
 * Nhận: text — văn bản cần đếm.
 * Trả: số ký tự \n (tệp không có newline cuối vẫn đếm đúng như wc -l).
 */
function countLines(text: string): number {
  return text.split("\n").length - 1;
}

/**
 * Tách văn bản thành các dòng theo ký tự xuống dòng.
 * Nhận: text — văn bản cần tách.
 * Trả: mảng dòng (giữ nguyên nội dung, không cắt khoảng trắng).
 */
function linesOf(text: string): string[] {
  return text.split("\n");
}

/**
 * Liệt kê số hiệu dòng (1-based) mà hai văn bản KHÁC nhau.
 * Nhận: left — văn bản thứ nhất; right — văn bản thứ hai.
 * Trả: mảng số hiệu dòng tăng dần; rỗng khi hai bên trùng từng dòng.
 */
function differingLineNumbers(left: string, right: string): number[] {
  const a = linesOf(left);
  const b = linesOf(right);
  const out: number[] = [];
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) out.push(index + 1);
  }
  return out;
}

/**
 * Đếm số lần một id xuất hiện trong văn bản (đếm theo lần xuất hiện, không theo dòng).
 * Nhận: text — văn bản cần đếm; id — chuỗi id cần tìm.
 * Trả: số lần xuất hiện (0 khi không có).
 */
function idCount(text: string, id: string): number {
  return text.split(id).length - 1;
}

/**
 * Chuẩn hoá id của ta về id gốc — phép quy đổi DUY NHẤT được phép giữa hai bản.
 * Nhận: text — văn bản của ta (có thể chứa id ta).
 * Trả: văn bản đã thay mọi id ta bằng id gốc.
 */
function normalizeId(text: string): string {
  return text.split(OUR_ID).join(STOCK_ID);
}

/**
 * Đo một artefact: nội dung, số dòng, số byte trên đĩa và sha256.
 * Nhận: path — đường dẫn tuyệt đối tới artefact.
 * Trả: số đo đầy đủ.
 */
function measureArtefact(path: string): ArtefactMeasure {
  const text = readText(path);
  return { text, lines: countLines(text), bytes: statSync(path).size, sha: sha256(text) };
}

/**
 * Nạp một module ESM bằng await import().
 * Nhận: path — đường dẫn tuyệt đối tới tệp .js/.ts cần nạp.
 * Trả: bề mặt module.
 */
async function importModule(path: string): Promise<ModuleShape> {
  return (await import(path)) as ModuleShape;
}

/**
 * Danh sách tên export của một module ESM, đã sắp xếp để so A/B không phụ thuộc thứ tự.
 * Nhận: mod — bề mặt module (kết quả await import()).
 * Trả: mảng tên export đã sắp xếp.
 */
function exportNames(mod: ModuleShape): string[] {
  return Object.keys(mod).sort();
}

/**
 * Nạp một module và BẮT lỗi ném ra (dùng cho artefact browser không nạp được trong Bun).
 * Nhận: path — đường dẫn tuyệt đối tới tệp .js cần nạp.
 * Trả: tên lớp lỗi + thông điệp; ném Error nếu module nạp THÀNH CÔNG (ca test cần cả hai bên cùng ném).
 */
async function captureImportError(path: string): Promise<{ name: string; message: string }> {
  try {
    await import(path);
  } catch (error) {
    const caught = error as { name?: string; message?: string };
    return { name: String(caught.name), message: String(caught.message) };
  }
  throw new Error("module nạp THÀNH CÔNG (ca test này cần cả hai bên cùng ném): " + path);
}

/**
 * Liệt kê ĐỆ QUY mọi tệp dưới một thư mục.
 * Nhận: dir — thư mục gốc.
 * Trả: mảng đường dẫn tuyệt đối của các tệp (bỏ qua thư mục).
 */
function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(path));
    else out.push(path);
  }
  return out;
}

describe("A · ba artefact: dòng · byte · sha256 · quan hệ với bản gốc", () => {
  test("A1 · lib/index.js: 632 dòng · 24.195 B · sha ea5e3beb… · byte-identical bản gốc (3 lát)", () => {
    const ours = measureArtefact(join(OUR_LIB, HOST_FILE));
    const stock = measureArtefact(join(STOCK_LIB, HOST_FILE));
    expect(ours.lines).toBe(632);
    expect(ours.bytes).toBe(24_195);
    expect(ours.sha.slice(0, 16)).toBe("ea5e3beb6ddd09a7");
    expect(Buffer.from(ours.text, "utf8").equals(Buffer.from(stock.text, "utf8"))).toBe(true);
    expect(ours.sha).toBe(stock.sha);
    expect(idCount(ours.text, OUR_ID)).toBe(0);
    expect(idCount(ours.text, STOCK_ID)).toBe(1);
    expect(readdirSync(join(PKG, "src", "parts-host")).sort()).toEqual([
      "part-00-head.ts",
      "part-01-service.ts",
      "part-02-tail.ts",
    ]);
  });

  test("A2 · lib/client.browser.js: 655 dòng · 26.137 B · sha 294ceb5f… · 1 id ta / 1 id stock (JSDoc) · +5 B", () => {
    const ours = measureArtefact(join(OUR_LIB, CLIENT_BROWSER_FILE));
    const stock = measureArtefact(join(STOCK_LIB, CLIENT_BROWSER_FILE));
    expect(ours.lines).toBe(655);
    expect(ours.bytes).toBe(26_137);
    expect(ours.sha.slice(0, 16)).toBe("294ceb5f9664505b");
    expect(stock.bytes).toBe(26_132);
    expect(OUR_ID.length).toBe(37);
    expect(STOCK_ID.length).toBe(32);
    expect(ours.bytes - stock.bytes).toBe(OUR_ID.length - STOCK_ID.length);
    expect(byteLength(ours.text) - byteLength(stock.text)).toBe(5);
    expect(idCount(ours.text, OUR_ID)).toBe(1);
    expect(idCount(ours.text, STOCK_ID)).toBe(1);
    expect(normalizeId(ours.text)).toBe(stock.text);
    expect(sha256(normalizeId(ours.text))).toBe(stock.sha);
  });

  test("A3 · lib/client.node.js: 645 dòng · 24.515 B · sha b56ea1a4… · byte-identical bản gốc (4 lát, ESM thuần)", () => {
    const ours = measureArtefact(join(OUR_LIB, CLIENT_NODE_FILE));
    const stock = measureArtefact(join(STOCK_LIB, CLIENT_NODE_FILE));
    expect(ours.lines).toBe(645);
    expect(ours.bytes).toBe(24_515);
    expect(ours.sha.slice(0, 16)).toBe("b56ea1a47ddacdae");
    expect(Buffer.from(ours.text, "utf8").equals(Buffer.from(stock.text, "utf8"))).toBe(true);
    expect(ours.sha).toBe(stock.sha);
    expect(idCount(ours.text, OUR_ID)).toBe(0);
    expect(idCount(ours.text, STOCK_ID)).toBe(1);
    expect(readdirSync(join(PKG, "src", "parts-client-node")).sort()).toEqual([
      "part-00-head.ts",
      "part-01-service.ts",
      "part-02-client-index.ts",
      "part-03-tail.ts",
    ]);
  });

  test("A4 · browser CHỈ khác dòng 2 (loader) · node byte-identical + KHÔNG có window.__ModuleLoader__", () => {
    const ourBrowser = readText(join(OUR_LIB, CLIENT_BROWSER_FILE));
    const stockBrowser = readText(join(STOCK_LIB, CLIENT_BROWSER_FILE));
    expect(differingLineNumbers(ourBrowser, stockBrowser)).toEqual([2]);
    expect(differingLineNumbers(normalizeId(ourBrowser), stockBrowser)).toEqual([]);
    expect(linesOf(ourBrowser)[1]?.trim()).toBe('id: "' + OUR_ID + '",');
    expect(linesOf(stockBrowser)[1]?.trim()).toBe('id: "' + STOCK_ID + '",');
    expect(linesOf(ourBrowser)[13]?.trim()).toBe("* @module " + STOCK_ID);
    expect(linesOf(stockBrowser)[13]?.trim()).toBe("* @module " + STOCK_ID);
    const ourNode = readText(join(OUR_LIB, CLIENT_NODE_FILE));
    const stockNode = readText(join(STOCK_LIB, CLIENT_NODE_FILE));
    expect(ourNode).toBe(stockNode);
    expect(differingLineNumbers(ourNode, stockNode)).toEqual([]);
    expect(ourNode.includes("window.__ModuleLoader__")).toBe(false);
    expect(ourBrowser.includes("window.__ModuleLoader__")).toBe(true);
  });

  test("A5 · CÙNG NÉM (lý do: bundle browser là script classic cần window.__ModuleLoader__, Bun KHÔNG có window) — hai bên ném y hệt", async () => {
    const [oursErr, stockErr] = await Promise.all([
      captureImportError(join(OUR_LIB, CLIENT_BROWSER_FILE)),
      captureImportError(join(STOCK_LIB, CLIENT_BROWSER_FILE)),
    ]);
    expect(oursErr.name).toBe("ReferenceError");
    expect(stockErr.name).toBe("ReferenceError");
    expect(oursErr.message).toBe(stockErr.message);
    expect(oursErr.message).toContain("window is not defined");
  });
});

describe("B · bề mặt package.json: dsh.client · exports · gbh", () => {
  test("B1 · dsh.client KHỚP bản gốc (inject rỗng · platform web · immediately true)", () => {
    const ours = readPkg(join(PKG, "package.json"));
    const stock = readPkg(join(STOCK_PKG, "package.json"));
    expect(ours.name).toBe(OUR_ID);
    expect(ours.dsh).toEqual(stock.dsh);
    expect(ours.dsh?.client).toEqual({ inject: [], platform: "web", immediately: true });
  });

  test("B2 · exports KHỚP bản gốc ở MỌI khoá + ./client đủ 3 nhánh node/browser/default (KHÔNG rút gọn)", () => {
    const ours = readPkg(join(PKG, "package.json")).exports ?? {};
    const stock = readPkg(join(STOCK_PKG, "package.json")).exports ?? {};
    expect(Object.keys(ours)).toEqual(Object.keys(stock));
    expect(Object.keys(ours)).toHaveLength(6);
    for (const key of Object.keys(stock)) expect(ours[key]).toEqual(stock[key]);
    expect(ours["./client"]).toEqual(stock["./client"]);
    const client = ours["./client"] as Record<string, string>;
    expect(Object.keys(client)).toEqual(["types", "node", "browser", "default"]);
    expect(client["node"]).toBe("./lib/client.node.js");
    expect(client["browser"]).toBe("./lib/client.browser.js");
    expect(client["default"]).toBe("./lib/client.browser.js");
    expect(client["node"]).not.toBe(client["browser"]);
    for (const path of [client["types"], client["node"], client["browser"], client["default"]]) {
      // noUncheckedIndexedAccess ⇒ phần tử có thể undefined; khẳng định tường minh trước khi dùng.
      expect(typeof path).toBe("string");
      if (typeof path !== "string") continue;
      expect(existsSync(join(PKG, path))).toBe(true);
    }
  });

  test("B3 · row khai ĐÚNG MỘT khoá (flip hoặc park) + id = 'typert' (stockId · moduleIds · aliases)", () => {
    const gbh = readPkg(join(PKG, "package.json")).gbh ?? {};
    // 19/10/2026 — BẤT BIẾN MỚI (thay 'KHÔNG có row' đã stale sau khi row được khai/mount): đúng MỘT khoá, cấm cả hai.
    const daFlip = "row" in gbh;
    const dangPark = "row_unmounted_ly_do" in gbh;
    expect(daFlip || dangPark).toBe(true);
    expect(daFlip && dangPark).toBe(false);
    const row = (daFlip ? gbh.row : gbh.row_unmounted_ly_do?.row) as
      | { id?: string; stockId?: string; moduleIds?: string[]; aliases?: string[]; tests?: string[] }
      | undefined;
    if (dangPark) expect(typeof gbh.row_unmounted_ly_do?.ly_do).toBe("string");
    expect(row?.id).toBe("typert");
    expect(row?.stockId).toBe(STOCK_ID);
    expect(row?.moduleIds).toEqual([OUR_ID]);
    expect(row?.aliases).toEqual([STOCK_ID]);
    expect(row?.tests).toEqual(["tests/host/typert-registry.test.ts"]);
  });
});

describe("C · hai cửa Bun.build", () => {
  test("C1 · CLIENT_LOADER_SHAPE mang ĐÚNG id ta + lib/client-entry.js xuất hằng đó + dòng 2 artefact browser khớp", async () => {
    const source = await importModule(join(PKG, "src", "client.ts"));
    const shape = String(source["CLIENT_LOADER_SHAPE"]);
    expect(shape).toBe('window.__ModuleLoader__.load({ id: "' + OUR_ID + '", factory: (require) => {');
    expect(shape).not.toContain(STOCK_ID);
    expect(source["OUR_CLIENT_ID"]).toBe(OUR_ID);
    expect(source["STOCK_CLIENT_ID"]).toBe(STOCK_ID);
    const entryPath = join(OUR_LIB, "client-entry.js");
    expect(existsSync(entryPath)).toBe(true);
    const entry = readText(entryPath);
    expect(entry).toContain("CLIENT_LOADER_SHAPE");
    expect(entry).toContain(shape);
    expect(entry).toContain(OUR_ID);
    expect(linesOf(readText(join(OUR_LIB, CLIENT_BROWSER_FILE)))[1]?.trim()).toBe('id: "' + OUR_ID + '",');
  });

  test("C2 · lib/index-entry.js (Bun.build entry nguồn): ESM đánh dấu @bun + export TRÙNG src/index.ts", async () => {
    const entryPath = join(OUR_LIB, "index-entry.js");
    expect(existsSync(entryPath)).toBe(true);
    const text = readText(entryPath);
    expect(text.startsWith("// @bun")).toBe(true);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain(OUR_ID);
    expect(text).not.toContain("src-handwritten");
    const [entry, source] = await Promise.all([
      importModule(entryPath),
      importModule(join(PKG, "src", "index.ts")),
    ]);
    expect(exportNames(entry)).toEqual(exportNames(source));
    expect(exportNames(entry)).toEqual(ENTRY_EXPORTS);
    expect(entry["default"]).toBe(entry["TypertRegistry"]);
  });
});

describe("D · ngữ nghĩa ESM: client.node + index nạp trực tiếp", () => {
  test("D1 · client.node.js (ESM thuần) nạp trực tiếp: export TRÙNG bản gốc (apply · inject)", async () => {
    const [ours, stock] = await Promise.all([
      importModule(join(OUR_LIB, CLIENT_NODE_FILE)),
      importModule(join(STOCK_LIB, CLIENT_NODE_FILE)),
    ]);
    expect(exportNames(ours)).toEqual(exportNames(stock));
    expect(exportNames(ours)).toEqual(CLIENT_EXPORTS);
    expect(typeof ours["apply"]).toBe("function");
    expect(typeof stock["apply"]).toBe("function");
    expect(ours["inject"]).toEqual(stock["inject"]);
    expect(ours["inject"]).toEqual([]);
  });

  test("D2 · index.js: export TRÙNG bản gốc (5 tên) + default === TypertRegistry + ba hàm khoá cùng kết quả", async () => {
    const [ours, stock] = await Promise.all([
      importModule(join(OUR_LIB, HOST_FILE)),
      importModule(join(STOCK_LIB, HOST_FILE)),
    ]);
    expect(exportNames(ours)).toEqual(exportNames(stock));
    expect(exportNames(ours)).toEqual(INDEX_EXPORTS);
    expect(ours["default"]).toBe(ours["TypertRegistry"]);
    expect(stock["default"]).toBe(stock["TypertRegistry"]);
    const keyOf = ours["typertKey"] as (packageName: string, name: string) => string;
    const packageKeyOf = ours["typertPackageKey"] as (packageName: string, face: string) => string;
    const endpointOf = ours["typertEndpoint"] as (descriptor: { namespace: string; method: string }) => string;
    const stockKeyOf = stock["typertKey"] as typeof keyOf;
    const stockPackageKeyOf = stock["typertPackageKey"] as typeof packageKeyOf;
    const stockEndpointOf = stock["typertEndpoint"] as typeof endpointOf;
    expect(keyOf("pkg", "Config")).toBe("pkg#Config");
    expect(keyOf("pkg", "Config")).toBe(stockKeyOf("pkg", "Config"));
    expect(packageKeyOf("pkg", "host")).toBe("pkg#host");
    expect(packageKeyOf("pkg", "host")).toBe(stockPackageKeyOf("pkg", "host"));
    expect(endpointOf({ namespace: "ns", method: "m" })).toBe("ns/m");
    expect(endpointOf({ namespace: "ns", method: "m" })).toBe(stockEndpointOf({ namespace: "ns", method: "m" }));
  });
});

describe("E · nguồn viết tay ngoài build", () => {
  test("E1 · src-handwritten/ đủ 4 tệp + build/artefact KHÔNG chứa chuỗi src-handwritten", async () => {
    const handwritten = join(PKG, "src-handwritten");
    expect(readdirSync(handwritten).sort()).toEqual(["index.ts", "service.ts", "stores.ts", "types.ts"]);
    for (const name of readdirSync(handwritten)) {
      expect(statSync(join(handwritten, name)).size).toBeGreaterThan(0);
    }
    const shipped = [
      join(PKG, "build.ts"),
      join(OUR_LIB, HOST_FILE),
      join(OUR_LIB, CLIENT_BROWSER_FILE),
      join(OUR_LIB, CLIENT_NODE_FILE),
      join(OUR_LIB, "client-entry.js"),
      join(OUR_LIB, "index-entry.js"),
    ];
    for (const path of shipped) expect(readText(path)).not.toContain("src-handwritten");
    const temp = mkdtempSync(join(tmpdir(), "gbh-typert-halves-"));
    try {
      await buildPackage(temp);
      expect(existsSync(join(temp, HOST_FILE))).toBe(true);
      const built = walkFiles(temp);
      expect(built.length).toBeGreaterThan(0);
      for (const path of built) expect(readText(path)).not.toContain("src-handwritten");
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
    expect(existsSync(temp)).toBe(false);
  }, 30_000);
});
