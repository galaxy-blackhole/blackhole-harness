/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc Test A/B cho gói THƯ VIỆN @galaxy-blackhole/gbh-client-ui-directory-picker-browse: 2 artefact (host byte-identical 2 lát · client CHỈ đổi dòng 2 ⇒ +5 B · 6 lát) · 3 lần id stock trong bản gốc (dòng 2 loader ĐỔI, dòng 27 tagId CSS module + dòng 30 dataset.plugin GIỮ NGUYÊN) · package.json (KHÔNG gbh.row · gbh.draft · exports · dsh.client) · ghép lát === artefact · 2 cửa Bun.build
 */
import { describe, expect, test } from "bun:test";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { peerRangeProblems } from "../host/peer-range-harness.ts";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { applyBrandRename, reverseBrandRename } from "../../packages/tools/brand-rename/src/index.ts";
import { assembleBundle } from "../../packages/client/client-ui-directory-picker-browse/src/assemble.ts";
import { assembleClientBundle, readWrapper } from "../../packages/client/client-ui-directory-picker-browse/src/assemble-client.ts";
import { buildPackage } from "../../packages/client/client-ui-directory-picker-browse/build.ts";
import { CLIENT_LOADER_SHAPE, OUR_CLIENT_ID, STOCK_CLIENT_ID } from "../../packages/client/client-ui-directory-picker-browse/src/client.ts";
import {
  CLIENT_ID_REPLACEMENTS,
  HOST_PARTS_DIR_NAME,
  OUT_CLIENT_FILE_NAME,
  OUT_FILE_NAME,
  PACKAGE_NAME,
  PART_FILES,
  STOCK_BUNDLE,
  STOCK_CLIENT_BUNDLE,
  STOCK_ID,
  STOCK_PACKAGE_NAME,
} from "../../packages/client/client-ui-directory-picker-browse/src/manifest.ts";

/** Gốc repo (tests/client ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "client", "client-ui-directory-picker-browse");
/** Thư mục lib của ta (2 artefact + 2 entry Bun.build + index.d.ts + types/). */
const OURS_LIB = join(PKG, "lib");
/** Thư mục gói GỐC (CHỈ ĐỌC — nguồn đối chiếu byte). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-directory-picker-browse");
/** Thư mục lib của gói gốc. */
const STOCK_LIB = join(STOCK_PKG, "lib");
/** Id MỘT-ID của ta (54 ký tự — đo trên chính chuỗi id). */
const OUR_ID = "@galaxy-blackhole/gbh-client-ui-directory-picker-browse";
/** Id gốc của bản stock (49 ký tự) — chênh 5 byte mỗi lần quy đổi. */
const STOCK_ID_CHECK = "@deepseek-ai/dsh-client-ui-directory-picker-browse";
/** Đường dẫn tương đối của chính tệp test này (giá trị đúng cho gbh.tests). */
const TEST_REL = "tests/client/client-ui-directory-picker-browse.test.ts";
/** Sáu lát thân của nửa client, ĐÚNG thứ tự ghép (vỏ khai trong client-wrapper.browser.json). */
const CLIENT_PARTS = ["part-00.ts", "part-01.ts", "part-02.ts", "part-03.ts", "part-04.ts", "part-05.ts"];
/** Số lần id GỐC trong client.js gốc: dòng 2 (loader) + dòng 27 (tagId) + dòng 30 (dataset.plugin). */
const STOCK_ID_OCCURRENCES = 3;

/** Một mục trong exports của package.json (object điều kiện hoặc đường dẫn thẳng). */
type ExportEntry = string | Record<string, string>;

/** Hình dạng package.json mà test chạm tới (chỉ các khoá có mặt trong gói). */
interface PkgShape {
  /** Tên package. */
  name?: string;
  /** Trường main. */
  main?: string;
  /** Bản đồ exports. */
  exports?: Record<string, ExportEntry>;
  /** Khai báo plugin client của DSH. */
  dsh?: { client?: { inject?: string[]; platform?: string } };
  /** Peer dependencies. */
  peerDependencies?: Record<string, string>;
  /** Siêu dữ liệu của repo ta. */
  gbh?: {
    draft?: string;
    tests?: string[];
    peers?: string[];
    row?: unknown;
    row_unmounted_ly_do?: unknown;
  };
}

/** Số đo một artefact: văn bản + số dòng + số byte + sha256 đầy đủ. */
interface ArtefactMeasure {
  /** Nội dung UTF-8. */
  text: string;
  /** Số ký tự xuống dòng (quy ước wc -l). */
  lines: number;
  /** Kích thước tệp trên đĩa (byte). */
  bytes: number;
  /** sha256 hex 64 ký tự. */
  sha: string;
}

/** Số đo kỳ vọng của một artefact trong bảng A/B. */
interface ArtefactExpectation {
  /** Tên tệp trong lib của cả hai bên. */
  file: string;
  /** Số dòng của bản của ta. */
  lines: number;
  /** Số byte của bản của ta. */
  bytes: number;
  /** 16 ký tự đầu sha256 của bản của ta. */
  sha16: string;
  /** Số lần id ta trong artefact của ta. */
  ourIds: number;
  /** Số lần id gốc trong artefact của ta. */
  stockIds: number;
  /** Hiệu số byte (ta − gốc) kỳ vọng. */
  delta: number;
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
 * Đếm số dòng theo ký tự xuống dòng — tương đương wc -l (tệp kết thúc bằng newline).
 * Nhận: text — văn bản cần đếm.
 * Trả: số ký tự xuống dòng trong văn bản.
 */
function lineCount(text: string): number {
  return text.split("\n").length - 1;
}

/**
 * Tách văn bản thành các dòng theo ký tự xuống dòng.
 * Nhận: text — văn bản cần tách.
 * Trả: mảng dòng, giữ nguyên nội dung và khoảng trắng.
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
  return text
    .split(OUR_ID)
    .join(STOCK_ID_CHECK)
    // P3 (04/11/2026): module nen tang primitives cung doi id.
    .split("@galaxy-blackhole/gbh-client-ui-primitives")
    .join("@deepseek-ai/dsh-client-ui-primitives");
}

/**
 * Đo một artefact: nội dung, số dòng, số byte trên đĩa và sha256.
 * Nhận: path — đường dẫn tuyệt đối tới artefact.
 * Trả: số đo đầy đủ.
 */
function measureArtefact(path: string): ArtefactMeasure {
  const text = readText(path);
  return { text, lines: lineCount(text), bytes: statSync(path).size, sha: sha256(text) };
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
 * Danh sách tên export của một module, đã sắp xếp để so A/B không phụ thuộc thứ tự.
 * Nhận: mod — bề mặt module (kết quả await import()).
 * Trả: mảng tên export đã sắp xếp.
 */
function exportNames(mod: ModuleShape): string[] {
  return Object.keys(mod).sort();
}

/**
 * Nạp một module và BẮT lỗi ném ra (dùng cho bundle browser không nạp được trong Bun).
 * Nhận: path — đường dẫn tuyệt đối tới tệp .js cần nạp.
 * Trả: tên lớp lỗi + thông điệp; ném Error nếu module nạp THÀNH CÔNG.
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

/**
 * Canh BYTE TUYỆT ĐỐI giữa artefact của ta và bản gốc: Buffer.equals + sha256 bằng nhau.
 * Nhận: file — tên tệp nằm trong lib của cả hai bên.
 * Trả: cặp số đo của ta và gốc (để ca test kiểm tiếp id/dòng/byte).
 */
function assertByteIdentical(file: string): { ours: ArtefactMeasure; stock: ArtefactMeasure } {
  const ours = measureArtefact(join(OURS_LIB, file));
  const stock = measureArtefact(join(STOCK_LIB, file));
  expect(Buffer.from(ours.text, "utf8").equals(Buffer.from(stock.text, "utf8"))).toBe(true);
  expect(ours.sha).toBe(stock.sha);
  expect(ours.bytes).toBe(stock.bytes);
  expect(ours.lines).toBe(stock.lines);
  return { ours, stock };
}

/**
 * Canh OWNERSHIP của một artefact client: chuẩn hoá id ta → id gốc rồi so TỪNG BYTE.
 * Nhận: pair — bảng số đo kỳ vọng (tệp · dòng · byte · sha · số id · hiệu byte).
 * Trả: cặp số đo của ta và gốc (để ca test kiểm tiếp).
 */
function assertOwnership(pair: ArtefactExpectation): { ours: ArtefactMeasure; stock: ArtefactMeasure } {
  const ours = measureArtefact(join(OURS_LIB, pair.file));
  const stock = measureArtefact(join(STOCK_LIB, pair.file));
  // 19/10/2026: artefact của ta đã rename token CÓ CHỦ ĐÍCH (--dsh-* → --gbh-*, HANDOVER §10)
  // ⇒ phải chuẩn hoá NGƯỢC cả brand token lẫn id rồi mới so từng byte với bản gốc.
  const normalized = reverseBrandRename(normalizeId(ours.text));
  expect(Buffer.from(normalized, "utf8").equals(Buffer.from(stock.text, "utf8"))).toBe(true);
  expect(sha256(normalized)).toBe(stock.sha);
  expect(idCount(ours.text, OUR_ID)).toBe(pair.ourIds);
  expect(idCount(ours.text, STOCK_ID_CHECK)).toBe(pair.stockIds);
  expect(ours.bytes).toBe(pair.bytes);
  expect(ours.lines).toBe(pair.lines);
  expect(ours.sha.slice(0, 16)).toBe(pair.sha16);
  expect(ours.bytes - stock.bytes).toBe(pair.delta);
  // P3 (04/11/2026): cong 5 B cua id MOI module nen tang primitives.
  expect(pair.delta).toBe(pair.ourIds * (OUR_ID.length - STOCK_ID_CHECK.length) + 5);
  return { ours, stock };
}

/** Số đo nửa host: 2 lát ghép ⇒ BYTE-IDENTICAL bản gốc (0 id ta · 0 id gói này: host chỉ nhắc gói host-directory-picker-browse). */
const HOST_PAIR: ArtefactExpectation = {
  file: "index.js",
  lines: 12,
  bytes: 523,
  sha16: "a9e0d72e305698b9",
  ourIds: 0,
  stockIds: 0,
  delta: 0,
};

/** Số đo nửa client: 19/10/2026 chốt (b) — đổi 3 chỗ (loader + tagId CSS + dataset.plugin) ⇒ 3 id ta · 0 id gốc · +15 B. */
const CLIENT_PAIR: ArtefactExpectation = {
  file: "client.js",
  lines: 1044,
  bytes: 49_695,
  // 19/10/2026: sha đổi vì brand token --dsh-* → --gbh-* (rename CÓ CHỦ ĐÍCH, HANDOVER §10).
  sha16: "73c803b4678fd6a0",
  ourIds: 3,
  stockIds: 0,
  // P3 (04/11/2026): them 5 B do id MOI cua module nen tang ui-primitives.
  delta: 20,
};

/** Bốn tệp .d.ts chép nguyên từ gốc (byte · dòng · sha16). */
const TYPE_FILES: { file: string; bytes: number; lines: number; sha16: string }[] = [
  { file: "index.d.ts", bytes: 523, lines: 9, sha16: "3ebead8a660898c0" },
  { file: "client/DirectoryBrowser.d.ts", bytes: 1776, lines: 34, sha16: "a8577d24414d2a09" },
  { file: "client/flow.d.ts", bytes: 1453, lines: 23, sha16: "464c986849c40302" },
  { file: "client/index.d.ts", bytes: 1115, lines: 20, sha16: "fd5775ae63e2e61e" },
];

describe("A · hai artefact: dòng · byte · sha256 · quan hệ với bản gốc", () => {
  test("A1 · lib/index.js: 12 dòng · 523 B · sha a9e0d72e… · BYTE-IDENTICAL bản gốc (0 id ta / 1 id gốc)", () => {
    const { ours } = assertByteIdentical("index.js");
    expect(ours.bytes).toBe(HOST_PAIR.bytes);
    expect(ours.lines).toBe(HOST_PAIR.lines);
    expect(ours.sha.slice(0, 16)).toBe(HOST_PAIR.sha16);
    expect(idCount(ours.text, OUR_ID)).toBe(HOST_PAIR.ourIds);
    expect(idCount(ours.text, STOCK_ID_CHECK)).toBe(HOST_PAIR.stockIds);
    expect(ours.text).toContain("export { apply };");
    expect(ours.text).toContain("@deepseek-ai/dsh-host-directory-picker-browse");
  });

  test("A2 · lib/client.js: 1044 dòng · 49.695 B · 3 id ta / 0 id gốc · +20 B · chuẩn hoá ⇒ byte-identical (19/10/2026: Lead chốt (b))", () => {
    const { ours, stock } = assertOwnership(CLIENT_PAIR);
    expect(stock.bytes).toBe(49_675);
    expect(stock.sha.slice(0, 16)).toBe("55af354b2c4ace0c");
    expect(OUR_ID.length - STOCK_ID_CHECK.length).toBe(5);
    // P3 (04/11/2026): +5 B do id MOI cua module nen tang primitives.
    expect(byteLength(ours.text) - byteLength(stock.text)).toBe(20);
    expect(idCount(stock.text, STOCK_ID_CHECK)).toBe(STOCK_ID_OCCURRENCES);
    expect(idCount(stock.text, OUR_ID)).toBe(0);
    expect(ours.text).toContain('id: "' + OUR_ID + '"');
    // 19/10/2026: chuẩn hoá NGƯỢC brand token trước khi so chuỗi với bản gốc.
    expect(reverseBrandRename(normalizeId(ours.text))).toBe(stock.text);
  });

  test("A3 · CA RIÊNG: 5 dòng khác stock (2 = loader · 9 = require primitives · 26 = brand token CSS · 27 = tagId CSS · 30 = dataset.plugin) — sai lệch CÓ CHỦ ĐÍCH (HANDOVER §10)", () => {
    const ourLines = linesOf(readText(join(OURS_LIB, CLIENT_PAIR.file)));
    const stockLines = linesOf(readText(join(STOCK_LIB, CLIENT_PAIR.file)));
    // 19/10/2026 — dòng 26 là sai lệch CÓ CHỦ ĐÍCH: brand token (HANDOVER §10), không phải lỗi ownership.
    expect(differingLineNumbers(readText(join(OURS_LIB, CLIENT_PAIR.file)), readText(join(STOCK_LIB, CLIENT_PAIR.file)))).toEqual([2, 9, 26, 27, 30]);
    expect(differingLineNumbers(reverseBrandRename(normalizeId(readText(join(OURS_LIB, CLIENT_PAIR.file)))), readText(join(STOCK_LIB, CLIENT_PAIR.file)))).toEqual([]);
    // Dòng 2 — id module do loader tự khai: ĐỔI thành id của ta.
    expect((ourLines[1] ?? "").trim()).toBe('id: "' + OUR_ID + '",');
    expect((stockLines[1] ?? "").trim()).toBe('id: "' + STOCK_ID_CHECK + '",');
    // Dòng 27 — tagId của CSS module: DỮ LIỆU DOM ⇒ phải mang id CỦA TA (0 tham chiếu DSH).
    expect(ourLines[26]).toContain(OUR_ID + "/DirectoryBrowser.module.css");
    expect(ourLines[26] ?? "").not.toContain(STOCK_ID_CHECK);
    // Dòng 30 — dataset.plugin: DỮ LIỆU DOM ⇒ mang id CỦA TA.
    expect((ourLines[29] ?? "").trim()).toBe('tag.dataset.plugin = "' + OUR_ID + '";');
    expect(ourLines[29] ?? "").not.toContain(STOCK_ID_CHECK);
    // Đúng 3 dòng mang id ta: 2 (loader) · 27 (tagId) · 30 (dataset.plugin). Không dòng nào khác.
    expect(ourLines.map((line, index) => (line.includes(OUR_ID) ? index : -1)).filter((index) => index >= 0)).toEqual([1, 26, 29]);
    // Và 0 dòng nào mang id stock.
    expect(ourLines.filter((line) => line.includes(STOCK_ID_CHECK)).length).toBe(0);
  });

  test("A4 · client.js là script classic: ĐÚNG 1 window.__ModuleLoader__.load({ · đuôi sourceMappingURL · hai bên cùng ném ReferenceError", async () => {
    const ours = readText(join(OURS_LIB, CLIENT_PAIR.file));
    const stock = readText(join(STOCK_LIB, CLIENT_PAIR.file));
    expect(idCount(ours, "window.__ModuleLoader__.load({")).toBe(1);
    expect(idCount(stock, "window.__ModuleLoader__.load({")).toBe(1);
    expect(ours.startsWith("window.__ModuleLoader__.load({")).toBe(true);
    // Tệp KHÔNG có newline cuối: dòng cuối là chú thích sourceMappingURL, trước nó là dòng trống.
    expect(linesOf(ours).at(-1)).toBe("//# sourceMappingURL=client.js.map");
    expect(linesOf(ours).at(-2)).toBe("");
    expect(ours.endsWith("client.js.map")).toBe(true);
    expect(ours.trimEnd()).not.toContain("export {");
    // 20/10/2026: khi chạy CẢ bộ test trong một tiến trình, tệp khác có thể để lại `globalThis.window` /
    // `__ModuleLoader__` ⇒ script classic nạp THÀNH CÔNG thay vì ném ReferenceError. Cách ly tạm thời
    // rồi khôi phục, giữ nguyên phép so (cả hai bên phải cùng ném).
    const g = globalThis as Record<string, unknown>;
    const savedWindow = g.window;
    const savedLoader = g.__ModuleLoader__;
    delete g.window;
    delete g.__ModuleLoader__;
    let oursErr: { name: string; message: string };
    let stockErr: { name: string; message: string };
    try {
      [oursErr, stockErr] = await Promise.all([
        captureImportError(join(OURS_LIB, CLIENT_PAIR.file)),
        captureImportError(join(STOCK_LIB, CLIENT_PAIR.file)),
      ]);
    } finally {
      if (savedWindow !== undefined) g.window = savedWindow;
      if (savedLoader !== undefined) g.__ModuleLoader__ = savedLoader;
    }
    expect(oursErr.name).toBe("ReferenceError");
    expect(stockErr.name).toBe("ReferenceError");
    expect(oursErr.message).toBe(stockErr.message);
    expect(oursErr.message).toContain("window is not defined");
  });

  test("A5 · lib/types/ đủ 4 tệp .d.ts chép NGUYÊN từ gốc (byte · dòng · sha16) + index.d.ts do build sinh", () => {
    const names = walkFiles(join(OURS_LIB, "types")).map((path) => relative(join(OURS_LIB, "types"), path)).sort();
    expect(names).toEqual(["client/DirectoryBrowser.d.ts", "client/flow.d.ts", "client/index.d.ts", "index.d.ts"]);
    for (const entry of TYPE_FILES) {
      const ours = measureArtefact(join(OURS_LIB, "types", entry.file));
      const stock = measureArtefact(join(STOCK_LIB, "types", entry.file));
      expect(Buffer.from(ours.text, "utf8").equals(Buffer.from(stock.text, "utf8"))).toBe(true);
      expect(ours.bytes).toBe(entry.bytes);
      expect(ours.lines).toBe(entry.lines);
      expect(ours.sha.slice(0, 16)).toBe(entry.sha16);
    }
    const generated = measureArtefact(join(OURS_LIB, "index.d.ts"));
    expect(generated.bytes).toBe(34);
    expect(generated.text).toBe('export * from "./types/index.js";' + "\n");
    // Bản gốc KHÔNG có lib/index.d.ts — tệp này do build của ta sinh ra (re-export types/).
    expect(existsSync(join(STOCK_LIB, "index.d.ts"))).toBe(false);
  });
});

describe("B · bề mặt package.json: dsh.client · exports · gbh (gói THƯ VIỆN)", () => {
  test("B1 · dsh.client KHỚP TUYỆT ĐỐI bản gốc (4 inject · platform web) + name là id ta", () => {
    const ours = readPkg(join(PKG, "package.json"));
    const stock = readPkg(join(STOCK_PKG, "package.json"));
    expect(ours.name).toBe(OUR_ID);
    expect(sameAfterIdMap(ours.dsh, stock.dsh)).toBe(true);
    // 20/10/2026 — hướng "đổi thương hiệu + rewrite id": inject/external của ta dùng id GBH CÓ CHỦ ĐÍCH
    // ⇒ so bằng sameAfterIdMap (quy id ta → id stock) thay vì deep-equal thô, vẫn giữ nguyên thứ tự + platform.
    expect(sameAfterIdMap(ours.dsh?.client, {
      inject: [
        "@deepseek-ai/dsh-api-remotes",
        "@deepseek-ai/dsh-client-ui-renderer",
        "@deepseek-ai/dsh-client-ui-workspace",
        "@deepseek-ai/dsh-client-locale",
      ],
      platform: "web",
    })).toBe(true);
    expect(sameAfterIdMap(ours.dsh?.client?.inject, stock.dsh?.client?.inject)).toBe(true);
    expect(ours.dsh?.client?.platform).toBe(stock.dsh?.client?.platform);
    expect(Object.keys(ours.dsh?.client ?? {}).sort()).toEqual(["inject", "platform"]);
  });

  test("B2 · exports KHỚP bản gốc ở MỌI khoá (5 khoá) + mọi đường dẫn không sao tồn tại thật", () => {
    const ours = readPkg(join(PKG, "package.json")).exports ?? {};
    const stock = readPkg(join(STOCK_PKG, "package.json")).exports ?? {};
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours)).toHaveLength(5);
    for (const key of Object.keys(stock)) expect(ours[key]).toEqual(stock[key]);
    expect(ours["./client"]).toEqual({ types: "./lib/types/client/index.d.ts", default: "./lib/client.js" });
    expect(ours["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    for (const key of Object.keys(ours)) {
      const entry = ours[key];
      if (entry === undefined) continue;
      const paths = typeof entry === "string" ? [entry] : Object.values(entry);
      for (const path of paths) {
        if (path.includes("*")) continue;
        expect(existsSync(join(PKG, path))).toBe(true);
      }
    }
  });

  test("B3 · KHÔNG gbh.row + KHÔNG gbh.row_unmounted_ly_do (gói THƯ VIỆN) · có gbh.draft · gbh.tests trỏ tệp này", () => {
    const ours = readPkg(join(PKG, "package.json"));
    const gbh = ours.gbh ?? {};
    // Quyết định Lead 19/10/2026: gói THƯ VIỆN (web-app khai ở dependencies) KHÔNG có row trong dump oracle.
    expect("row" in gbh).toBe(false);
    expect("row_unmounted_ly_do" in gbh).toBe(false);
    expect(gbh.row).toBeUndefined();
    expect(gbh.row_unmounted_ly_do).toBeUndefined();
    expect(typeof gbh.draft).toBe("string");
    const draft = gbh.draft ?? "";
    expect(draft).toContain("THƯ VIỆN");
    expect(draft).toContain("CHỈ dòng 2");
    expect(draft).toContain("DỮ LIỆU");
    // 01/11/2026 — dải peer nay ĐỒNG BỘ THEO MANIFEST STOCK (trước đây gói thư viện khai "*"): dùng đúng
    // phép kiểm chuẩn của repo (dải == stock + phủ bản kernel đang chạy) thay cho literal cũ.
    expect(peerRangeProblems(PKG)).toEqual([]);
    expect(gbh.peers).toEqual(["@deepseek-ai/cordis"]);
  });

  test("B4 · gbh.tests: MỌI mục phải === tệp test này (hiện chưa khai ⇒ rỗng) + tệp tồn tại", () => {
    const declared = readPkg(join(PKG, "package.json")).gbh?.tests ?? [];
    expect(Array.isArray(declared)).toBe(true);
    for (const path of declared) expect(path).toBe(TEST_REL);
    // 19/10/2026 — Lead điền gbh.tests SAU khi bộ test hạ cánh; rỗng = "chưa khai", khai là phải ĐÚNG tệp này.
    expect(declared.length === 0 || (declared.length === 1 && declared[0] === TEST_REL)).toBe(true);
    expect(existsSync(join(REPO, TEST_REL))).toBe(true);
    expect(statSync(join(REPO, TEST_REL)).size).toBeGreaterThan(0);
  });
});

describe("C · ghép lát === artefact (dùng chính assemble.ts / assemble-client.ts của gói)", () => {
  test("C1 · assembleBundle(parts-host) === lib/index.js (2 lát) + danh mục lát ĐÚNG thứ tự", () => {
    const ours = readText(join(OURS_LIB, HOST_PAIR.file));
    const assembled = assembleBundle(join(PKG, "src", HOST_PARTS_DIR_NAME));
    expect(assembled).toBe(ours);
    expect(Buffer.from(assembled, "utf8").equals(Buffer.from(ours, "utf8"))).toBe(true);
    expect(PART_FILES).toEqual(["part-00-index.ts", "part-01-tail.ts"]);
    expect(readdirSync(join(PKG, "src", HOST_PARTS_DIR_NAME)).filter((name) => name.endsWith(".ts")).sort()).toEqual([...PART_FILES].sort());
    for (const file of PART_FILES) expect(statSync(join(PKG, "src", HOST_PARTS_DIR_NAME, file)).size).toBeGreaterThan(0);
    expect(HOST_PARTS_DIR_NAME).toBe("parts-host");
  });

  test("C2 · assembleClientBundle() === lib/client.js (6 lát) · id ta CHỈ nằm ở vỏ, KHÔNG rò vào lát", () => {
    const ours = readText(join(OURS_LIB, CLIENT_PAIR.file));
    const assembled = assembleClientBundle();
    // 19/10/2026: lát giữ NGUYÊN VĂN bundle gốc; artefact cuối đã rename brand token CÓ CHỦ ĐÍCH.
    expect(applyBrandRename(assembled)).toBe(ours);
    expect(applyBrandRename(assembleClientBundle(join(PKG, "src", "client-parts", "browser")))).toBe(ours);
    const wrapper = readWrapper();
    expect(wrapper.parts).toEqual(CLIENT_PARTS);
    expect(readdirSync(join(PKG, "src", "client-parts", "browser")).filter((name) => name.endsWith(".ts")).sort()).toEqual([...CLIENT_PARTS].sort());
    expect(wrapper.head[0]).toBe("window.__ModuleLoader__.load({");
    expect(wrapper.head[1]).toBe('\tid: "' + OUR_ID + '",');
    expect(wrapper.head.join("")).not.toContain(STOCK_ID_CHECK);
    expect(wrapper.tail.at(-1)).toBe("//# sourceMappingURL=client.js.map");
    for (const file of CLIENT_PARTS) {
      const slice = readText(join(PKG, "src", "client-parts", "browser", file));
      expect(slice).not.toContain(OUR_ID);
      expect(slice.startsWith("/**")).toBe(true);
      expect(slice).toContain("// @ts-nocheck");
    }
    // Lát part-02 giữ nguyên DỮ LIỆU id gốc: tagId (CSS module) và dataset.plugin.
    const part02 = readText(join(PKG, "src", "client-parts", "browser", "part-02.ts"));
    expect(part02).toContain('const tagId = "' + STOCK_ID_CHECK + "/DirectoryBrowser.module.css" + '";');
    expect(part02).toContain('tag.dataset.plugin = "' + STOCK_ID_CHECK + '";');
    expect(part02).toContain('tag.dataset.pluginCss = tagId;');
  });

  test("C3 · buildPackage(mkdtemp) tái tạo ĐÚNG hai artefact + 2 entry Bun.build, dọn thư mục trong finally", async () => {
    const temp = mkdtempSync(join(tmpdir(), "gbh-directory-picker-browse-"));
    try {
      const indexPath = await buildPackage(temp);
      expect(indexPath).toBe(join(temp, OUT_FILE_NAME));
      expect(readFileSync(join(temp, OUT_FILE_NAME)).equals(readFileSync(join(OURS_LIB, OUT_FILE_NAME)))).toBe(true);
      // 19/10/2026: bản build trong mkdtemp có brand token của ta; so với lib/client.js sau khi áp rename.
      expect(applyBrandRename(readFileSync(join(temp, OUT_CLIENT_FILE_NAME), "utf8"))).toBe(readFileSync(join(OURS_LIB, OUT_CLIENT_FILE_NAME), "utf8"));
      const built = walkFiles(temp).map((path) => relative(temp, path)).sort();
      expect(built).toContain(OUT_FILE_NAME);
      expect(built).toContain(OUT_CLIENT_FILE_NAME);
      expect(built).toContain("index-entry.js");
      expect(built).toContain("client-entry.js");
      expect(built).toContain("index.d.ts");
      expect(built).toContain(join("types", "index.d.ts"));
      expect(built).toContain(join("types", "client", "index.d.ts"));
      expect(statSync(join(temp, OUT_CLIENT_FILE_NAME)).size).toBe(CLIENT_PAIR.bytes);
      expect(statSync(join(temp, OUT_FILE_NAME)).size).toBe(HOST_PAIR.bytes);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
    expect(existsSync(temp)).toBe(false);
  }, 30_000);
});

describe("D · entry: CLIENT_LOADER_SHAPE · 2 cửa Bun.build · bề mặt ESM", () => {
  test("D1 · src/client.ts: CLIENT_LOADER_SHAPE chứa ĐÚNG id ta + 3 hằng số MỘT-ID", () => {
    expect(CLIENT_LOADER_SHAPE).toBe('window.__ModuleLoader__.load({ id: "' + OUR_ID + '", factory: (require) => {');
    expect(CLIENT_LOADER_SHAPE).toContain(OUR_ID);
    expect(CLIENT_LOADER_SHAPE).not.toContain(STOCK_ID_CHECK);
    expect(OUR_CLIENT_ID).toBe(OUR_ID);
    expect(STOCK_CLIENT_ID).toBe(STOCK_ID_CHECK);
    expect(PACKAGE_NAME).toBe(OUR_ID);
    expect(STOCK_PACKAGE_NAME).toBe(STOCK_ID_CHECK);
    // Dòng loader của artefact phải suy ra được từ CLIENT_LOADER_SHAPE đang ship.
    const head = linesOf(CLIENT_LOADER_SHAPE)[0] ?? "";
    expect(head.startsWith("window.__ModuleLoader__.load({")).toBe(true);
    expect(head).toContain('id: "' + OUR_ID + '"');
  });

  test("D2 · lib/client-entry.js + lib/index-entry.js TỒN TẠI (2 Bun.build tách rời) · export đúng hợp hai nửa", async () => {
    const clientEntryPath = join(OURS_LIB, "client-entry.js");
    const indexEntryPath = join(OURS_LIB, "index-entry.js");
    expect(existsSync(clientEntryPath)).toBe(true);
    expect(existsSync(indexEntryPath)).toBe(true);
    expect(statSync(clientEntryPath).size).toBeGreaterThan(0);
    expect(statSync(indexEntryPath).size).toBeGreaterThan(0);
    const [clientEntry, indexEntry] = await Promise.all([importModule(clientEntryPath), importModule(indexEntryPath)]);
    expect(exportNames(clientEntry)).toEqual([
      "CLIENT_LOADER_SHAPE",
      "OUR_CLIENT_ID",
      "STOCK_CLIENT_ID",
      "assembleClientBundle",
      "readWrapper",
    ]);
    expect(exportNames(indexEntry)).toEqual([
      "CLIENT_LOADER_SHAPE",
      "OUR_CLIENT_ID",
      "STOCK_CLIENT_ID",
      "apply",
      "assembleClientBundle",
      "readWrapper",
    ]);
    expect(clientEntry["CLIENT_LOADER_SHAPE"]).toBe(CLIENT_LOADER_SHAPE);
    expect(indexEntry["CLIENT_LOADER_SHAPE"]).toBe(CLIENT_LOADER_SHAPE);
    expect(clientEntry["OUR_CLIENT_ID"]).toBe(OUR_ID);
    expect(indexEntry["STOCK_CLIENT_ID"]).toBe(STOCK_ID_CHECK);
    const clientText = readText(clientEntryPath);
    const indexText = readText(indexEntryPath);
    expect(clientText).toContain(CLIENT_LOADER_SHAPE);
    expect(indexText).toContain(CLIENT_LOADER_SHAPE);
    expect(clientText).toContain(OUR_ID);
    expect(indexText).toContain(OUR_ID);
    expect(indexText.startsWith("// @bun")).toBe(true);
    expect(clientText).not.toContain("// @bun");
    // Hai cửa Bun.build TÁCH RỜI: hai tệp độc lập, khác nội dung, không tệp nào nhúng tệp kia.
    expect(clientEntryPath).not.toBe(indexEntryPath);
    expect(clientText).not.toBe(indexText);
  });

  test("D3 · bề mặt ESM: lib/index.js TRÙNG bản gốc (apply) + gọi apply() vô hại như stock", async () => {
    const [ours, stock] = await Promise.all([
      importModule(join(OURS_LIB, HOST_PAIR.file)),
      importModule(join(STOCK_LIB, HOST_PAIR.file)),
    ]);
    expect(exportNames(ours)).toEqual(exportNames(stock));
    expect(exportNames(ours)).toEqual(["apply"]);
    expect(typeof ours["apply"]).toBe("function");
    expect(typeof stock["apply"]).toBe("function");
    const call = ours["apply"] as () => unknown;
    const stockCall = stock["apply"] as () => unknown;
    expect(call()).toBeUndefined();
    expect(stockCall()).toBeUndefined();
    expect(call.length).toBe(stockCall.length);
    expect(call.length).toBe(0);
  });
});

describe("E · manifest: nguồn DUY NHẤT của danh mục lát + số chỗ đổi id", () => {
  test("E1 · CLIENT_ID_REPLACEMENTS = 3 · tên artefact · 2 đường dẫn stock TỒN TẠI thật", () => {
    expect(CLIENT_ID_REPLACEMENTS).toBe(3);
    expect(CLIENT_ID_REPLACEMENTS).toBe(idCount(readText(join(OURS_LIB, CLIENT_PAIR.file)), OUR_ID));
    expect(CLIENT_ID_REPLACEMENTS).toBe(STOCK_ID_OCCURRENCES - idCount(readText(join(OURS_LIB, CLIENT_PAIR.file)), STOCK_ID_CHECK));
    expect(OUT_FILE_NAME).toBe("index.js");
    expect(OUT_CLIENT_FILE_NAME).toBe("client.js");
    expect(STOCK_ID).toBe(STOCK_ID_CHECK);
    expect(existsSync(join(REPO, STOCK_BUNDLE))).toBe(true);
    expect(existsSync(join(REPO, STOCK_CLIENT_BUNDLE))).toBe(true);
    expect(statSync(join(REPO, STOCK_BUNDLE)).size).toBe(HOST_PAIR.bytes);
    expect(statSync(join(REPO, STOCK_CLIENT_BUNDLE)).size).toBe(49_675);
    // Gói THƯ VIỆN: artefact của ta KHÔNG tự khai bất kỳ row/slot nào (host chỉ có apply rỗng).
    expect(readText(join(OURS_LIB, HOST_PAIR.file))).not.toContain("gbh.row");
    expect(readText(join(OURS_LIB, CLIENT_PAIR.file))).not.toContain("gbh.row");
  });
});