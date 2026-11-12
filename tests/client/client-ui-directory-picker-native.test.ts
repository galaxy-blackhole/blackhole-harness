/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc A/B 20 ca cho @galaxy-blackhole/gbh-client-ui-directory-picker-native: 2 artefact (index byte-identical 2 lát · client CHỈ đổi dòng 2 loader +5 B / 3 lát), package.json (KHÔNG gbh.row/row_unmounted_ly_do + gbh.draft + gbh.tests + exports), dsh.client + 2 Bun.build tách rời, ghép lát bằng src/assemble.ts, và cổng brand __GBH_DIRECTORY_PICKER__ (khôi phục tên cũ bằng reverseBrandRename rồi mới so byte)
 */
import { describe, expect, test } from "bun:test";
import { sameAfterIdMap } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

import { assembleClientBundle, readWrapper } from "../../packages/client/client-ui-directory-picker-native/src/assemble-client.ts";
import { assembleBundle } from "../../packages/client/client-ui-directory-picker-native/src/assemble.ts";
import { buildPackage } from "../../packages/client/client-ui-directory-picker-native/build.ts";
import {
  CLIENT_ID_REPLACEMENTS,
  HOST_PARTS_DIR_NAME,
  PART_FILES,
  PACKAGE_NAME,
  STOCK_BUNDLE,
  STOCK_CLIENT_BUNDLE,
  STOCK_PACKAGE_NAME,
} from "../../packages/client/client-ui-directory-picker-native/src/manifest.ts";
import { DIST_READ_NAMES, reverseBrandRename } from "../../packages/tools/brand-rename/src/index.ts";

/** Gốc repo (tests/client ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "client", "client-ui-directory-picker-native");
/** Thư mục lib của ta (2 artefact + 2 entry Bun.build + types). */
const OURS_LIB = join(PKG, "lib");
/** Thư mục gói GỐC (CHỈ ĐỌC — nguồn đối chiếu byte). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-directory-picker-native");
/** Thư mục lib của gói gốc. */
const STOCK_LIB = join(STOCK_PKG, "lib");
/** Tên global nửa client TRƯỚC task-153 lô 3 (còn trong bản gốc). */
const BRAND_OLD = "__DSH_DIRECTORY_PICKER__";
/** Tên global MỚI — artefact phát hành của ta phải mang tên này. */
const BRAND_NEW = "__GBH_DIRECTORY_PICKER__";
/** Id MỘT-ID của ta (55 ký tự). */
const OUR_ID = PACKAGE_NAME;
/** Id gốc của bản stock (50 ký tự) — mỗi lần quy đổi chênh đúng 5 byte. */
const STOCK_ID = STOCK_PACKAGE_NAME;
/** Id gói host nằm trong JSDoc của lib/index.js — DỮ LIỆU, không phải id bundle client. */
const HOST_PICKER_ID = "@deepseek-ai/dsh-host-directory-picker-native";
/** Đường dẫn tệp test này, tính từ gốc repo — đích mà gbh.tests phải trỏ tới. */
const THIS_TEST = "tests/client/client-ui-directory-picker-native.test.ts";
/** Dòng gọi loader duy nhất của bundle client browser. */
const LOADER_CALL = "window.__ModuleLoader__.load({";

/** Một mục trong `exports` của package.json (object điều kiện hoặc đường dẫn thẳng). */
type ExportEntry = string | Record<string, string>;

/** Hình dạng package.json mà test chạm tới (chỉ các khoá có mặt trong gói). */
interface PkgShape {
  name?: string;
  private?: boolean;
  type?: string;
  main?: string;
  exports?: Record<string, ExportEntry>;
  dsh?: { client?: { inject?: string[]; external?: string[]; platform?: string } };
  gbh?: {
    draft?: string;
    tests?: string[];
    peers?: string[];
    row?: unknown;
    row_unmounted_ly_do?: unknown;
  };
}

/** Một cặp artefact A/B: tên tệp + số đo kỳ vọng của CẢ HAI bên. */
interface ArtefactPair {
  /** Tên tệp nằm trong lib của CẢ HAI bên. */
  file: string;
  /** Số dòng (tương đương `wc -l`) của bản của ta. */
  lines: number;
  /** Số byte UTF-8 của bản của ta. */
  bytes: number;
  /** 16 ký tự đầu SHA-256 của bản của ta. */
  sha16: string;
  /** Số dòng của bản gốc. */
  stockLines: number;
  /** Số byte UTF-8 của bản gốc. */
  stockBytes: number;
  /** 16 ký tự đầu SHA-256 của bản gốc. */
  stockSha16: string;
  /** Số lần id ta xuất hiện trong artefact của ta. */
  ourIds: number;
  /** Số lần id gốc còn lại trong artefact của ta (client: 0; index: 0). */
  stockIds: number;
  /** Hiệu số byte (ta − gốc) kỳ vọng. */
  delta: number;
}

/** Bề mặt module ESM nạp bằng `await import()`. */
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
 * Đếm số lần một id xuất hiện trong văn bản (theo lần xuất hiện, không theo dòng).
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
 * Khôi phục TÊN BRAND cũ (__GBH_* → __DSH_*) để so với bản gốc — cổng "chỉ đổi tên".
 * Nhận: text — văn bản artefact phát hành (đã qua hook renameClientArtifact).
 * Trả: văn bản mang đúng tên global của bản stock.
 */
function unbrand(text: string): string {
  return reverseBrandRename(text);
}

/**
 * Cổng brand trên MỘT artefact: tên MỚI có mặt, tên CŨ biến mất, DIST_READ_NAMES giữ NGUYÊN số lần.
 * Nhận: text — artefact của ta; stock — artefact gốc cùng loại.
 * Trả: không (ném khi vi phạm).
 */
function assertBrand(text: string, stock: string): void {
  expect(idCount(text, BRAND_NEW)).toBeGreaterThan(0);
  expect(idCount(text, BRAND_OLD)).toBe(0);
  for (const name of DIST_READ_NAMES) expect(idCount(text, name)).toBe(idCount(stock, name));
  // Đảo ngược phải khôi phục ĐÚNG tên gốc ⇒ chứng minh chỉ đổi tên, không đổi logic.
  expect(unbrand(text)).toContain(BRAND_OLD);
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
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Đếm số dòng theo ký tự xuống dòng — tương đương `wc -l` (tệp kết thúc bằng newline).
 * Nhận: text — văn bản cần đếm.
 * Trả: số ký tự xuống dòng trong văn bản.
 */
function lineCount(text: string): number {
  return text.split("\n").length - 1;
}

/**
 * Danh sách tên export của một module ESM, đã sắp xếp để so A/B không phụ thuộc thứ tự.
 * Nhận: mod — bề mặt module (kết quả `await import()`).
 * Trả: mảng tên export đã sắp xếp.
 */
function exportNames(mod: ModuleShape): string[] {
  return Object.keys(mod).sort();
}

/**
 * Nạp một module ESM bằng `await import()`.
 * Nhận: path — đường dẫn tuyệt đối tới tệp .js/.ts cần nạp.
 * Trả: bề mặt module.
 */
async function importModule(path: string): Promise<ModuleShape> {
  return (await import(path)) as ModuleShape;
}

/**
 * Liệt kê ĐỆ QUY mọi tệp dưới một thư mục.
 * Nhận: dir — thư mục gốc.
 * Trả: mảng đường dẫn tuyệt đối của tệp (không gồm thư mục).
 */
function listFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

/**
 * Kiểm giao kèo của MỘT lát nguyên văn: header 5 dòng · dòng đánh dấu · dòng trống · đuôi export {};.
 * Nhận: path — đường dẫn tới tệp lát.
 * Trả: số dòng của lát.
 */
function assertPartScaffold(path: string): number {
  const source = readText(path);
  const lines = source.split("\n");
  expect(lines[0]).toBe("/**");
  expect(lines[1]?.trim()).toBe("* author Bùi Trọng Hiếu");
  expect(lines[2]?.trim()).toBe("* email kevinbui210191@gmail.com");
  expect(lines[3]?.trim()).toBe("* create date 15/10/2026");
  expect(lines[4]?.trim()).toMatch(/^\* modify date \d{2}\/\d{2}\/\d{4}$/);
  expect(lines[5]?.trim().startsWith("* desc ")).toBe(true);
  expect(lines[6]).toBe(" */");
  expect(lines[7]).toBe("// @ts-nocheck");
  expect(lines[8]).toBe("");
  expect(lines.at(-1)).toBe("");
  expect(lines.at(-2)).toBe("export {};");
  expect(lines.at(-3) === "" || lines.at(-4) === "").toBe(true);
  const count = lineCount(source);
  expect(count).toBeLessThanOrEqual(1000);
  return count;
}

/**
 * Cổng BYTE TUYỆT ĐỐI cho nửa host: Buffer.equals với bản gốc + sha256 + byte + dòng + đếm id.
 * Nhận: không. Trả: không (ném khi lệch bất kỳ chiều nào).
 */
function assertHostPair(): void {
  const oursBytes = readFileSync(join(OURS_LIB, "index.js"));
  const stockBytes = readFileSync(join(STOCK_LIB, "index.js"));
  expect(oursBytes.equals(stockBytes)).toBe(true);
  const ours = oursBytes.toString("utf8");
  const stock = stockBytes.toString("utf8");
  expect(sha256(ours)).toBe("2683307add970eb9b28f205c4427e1ed0dbdaaaa3f81f041773e1e86257da304");
  expect(sha256(ours)).toBe(sha256(stock));
  expect(sha256(ours).slice(0, 16)).toBe("2683307add970eb9");
  expect(sha256(stock).slice(0, 16)).toBe("2683307add970eb9");
  expect(byteLength(ours)).toBe(501);
  expect(byteLength(stock)).toBe(501);
  expect(lineCount(ours)).toBe(12);
  expect(lineCount(stock)).toBe(12);
  expect(idCount(ours, OUR_ID)).toBe(0);
  expect(idCount(ours, STOCK_ID)).toBe(0);
  expect(idCount(ours, HOST_PICKER_ID)).toBe(1);
  expect(idCount(stock, HOST_PICKER_ID)).toBe(1);
}

/**
 * Cổng OWNERSHIP cho nửa client: chuẩn hoá id ta → id gốc rồi Buffer.equals với bản gốc
 * + sha256 + byte + dòng + đếm id hai bên + hiệu byte (+5 B do mỗi id dài hơn 5 ký tự).
 * Nhận: không. Trả: không (ném khi lệch bất kỳ chiều nào).
 */
function assertClientPair(): void {
  const oursBytes = readFileSync(join(OURS_LIB, "client.js"));
  const stockBytes = readFileSync(join(STOCK_LIB, "client.js"));
  const ours = oursBytes.toString("utf8");
  const stock = stockBytes.toString("utf8");
  const normalized = normalizeId(ours);
  expect(Buffer.from(normalized, "utf8").equals(Buffer.from(stock, "utf8"))).toBe(true);
  expect(sha256(normalized)).toBe(sha256(stock));
  expect(sha256(ours)).toBe("f448c03a9f0348042da2b50995ab6ebc204231f14cd041cb69295aaa11889ca7");
  expect(sha256(stock)).toBe("c67856a5575ae00245d0a2ed1ccce81f817f88f93cec08742e72cc8d2883e71d");
  expect(sha256(ours).slice(0, 16)).toBe("f448c03a9f034804");
  expect(sha256(stock).slice(0, 16)).toBe("c67856a5575ae002");
  expect(byteLength(ours)).toBe(3035);
  expect(byteLength(stock)).toBe(3030);
  expect(byteLength(ours) - byteLength(stock)).toBe(5);
  expect(lineCount(ours)).toBe(83);
  expect(lineCount(stock)).toBe(83);
  expect(idCount(ours, OUR_ID)).toBe(1);
  expect(idCount(ours, STOCK_ID)).toBe(0);
  expect(idCount(stock, STOCK_ID)).toBe(1);
  expect(idCount(stock, OUR_ID)).toBe(0);
  expect(OUR_ID.length - STOCK_ID.length).toBe(5);
}

/**
 * Chạy buildPackage vào MỘT thư mục tạm (mkdtemp) rồi DỌN trong finally.
 * Nhận: run — phép so nhận thư mục tạm vừa build.
 * Trả: Promise hoàn tất khi phép so xong (luôn dọn, kể cả khi phép so ném).
 */
async function withFreshBuild(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "gbh-directory-picker-native-ab-"));
  try {
    const file = await buildPackage(dir);
    expect(file).toBe(join(dir, "index.js"));
    await run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("A · artefact: Buffer.equals với bản gốc (hoặc bản chuẩn hoá id) + sha256 + byte + dòng", () => {
  test("A1 · lib/index.js: 2 lát ghép ⇒ BYTE-IDENTICAL bản gốc · sha 2683307add970eb9 · 501 B · 12 dòng · 0 id ta / 0 id stock client", () => {
    assertHostPair();
  });

  test("A2 · lib/client.js: CHỈ đổi dòng 2 loader ⇒ chuẩn hoá id ⇒ BYTE-IDENTICAL · sha f448c03a9f034804 · 3.035 B · 83 dòng · +5 B", () => {
    assertClientPair();
  });

  test("A3 · lib/client.js: ĐÚNG MỘT dòng khác bản gốc (dòng 2) · id ta 1 lần / id stock 0 lần · bản gốc có id stock ở dòng 2", () => {
    const ours = readText(join(OURS_LIB, "client.js"));
    const stock = readText(join(STOCK_LIB, "client.js"));
    const oursLines = ours.split("\n");
    const stockLines = stock.split("\n");
    expect(oursLines.length).toBe(stockLines.length);
    const changed = oursLines.map((line, index) => (line === stockLines[index] ? 0 : index + 1)).filter(Boolean);
    expect(changed).toEqual([2]);
    expect(oursLines[1]?.trim()).toBe('id: "' + OUR_ID + '",');
    expect(stockLines[1]?.trim()).toBe('id: "' + STOCK_ID + '",');
    expect(oursLines.slice(2).join("\n")).toBe(stockLines.slice(2).join("\n"));
    expect(oursLines.map((line, index) => (line.includes(OUR_ID) ? index + 1 : 0)).filter(Boolean)).toEqual([2]);
    expect(oursLines.filter((line) => line.includes(STOCK_ID))).toEqual([]);
    expect(stockLines.map((line, index) => (line.includes(STOCK_ID) ? index + 1 : 0)).filter(Boolean)).toEqual([2]);
    expect(normalizeId(ours)).toBe(stock);
  });

  test("A4 · ghép 2 lát host bằng src/assemble.ts của gói === lib/index.js (PART_FILES đúng thứ tự · mỗi lát ≤1000 dòng)", () => {
    const assembled = assembleBundle(join(PKG, "src", HOST_PARTS_DIR_NAME));
    expect(assembled).toBe(readText(join(OURS_LIB, "index.js")));
    expect(assembled).toBe(readText(join(STOCK_LIB, "index.js")));
    expect(PART_FILES.length).toBe(2);
    expect(PART_FILES).toEqual(["part-00-index.ts", "part-01-tail.ts"]);
    for (const file of PART_FILES) assertPartScaffold(join(PKG, "src", HOST_PARTS_DIR_NAME, file));
    expect(assembled.endsWith("export { apply };\n")).toBe(true);
  });

  test("A5 · ghép vỏ + 3 lát client bằng src/assemble-client.ts của gói === lib/client.js (head/tail/id ta đúng)", () => {
    const ours = readText(join(OURS_LIB, "client.js"));
    expect(assembleClientBundle()).toBe(ours);
    const wrapper = readWrapper();
    expect(wrapper.parts.length).toBe(3);
    expect([...wrapper.parts]).toEqual(["part-00.ts", "part-01.ts", "part-02.ts"]);
    expect([...wrapper.head]).toEqual([LOADER_CALL, '\tid: "' + OUR_ID + '",', "\tfactory: (require) => {"]);
    expect([...wrapper.tail]).toEqual([
      "\t\texports.apply = apply;",
      "\t\texports.inject = inject;",
      "\t\treturn module.exports;",
      "\t}",
      "});",
      "",
      "//# sourceMappingURL=client.js.map",
    ]);
    expect(ours.split("\n").slice(0, 3)).toEqual([...wrapper.head]);
    expect(ours.split("\n").slice(-7)).toEqual([...wrapper.tail]);
    for (const file of wrapper.parts) assertPartScaffold(join(PKG, "src", "client-parts", "browser", file));
  });

  test("A6 · build lại vào mkdtemp ⇒ 2 artefact BYTE-IDENTICAL bản đã ký + 2 entry Bun.build tồn tại (dọn trong finally)", async () => {
    await withFreshBuild(async (dir) => {
      for (const file of ["index.js", "client.js"]) {
        const fresh = readFileSync(join(dir, file));
        const checked = readFileSync(join(OURS_LIB, file));
        expect(fresh.equals(checked)).toBe(true);
        expect(fresh.length).toBe(checked.length);
        expect(sha256(fresh.toString("utf8"))).toBe(sha256(checked.toString("utf8")));
      }
      for (const entry of ["index-entry.js", "client-entry.js"]) {
        expect(existsSync(join(dir, entry))).toBe(true);
        expect(statSync(join(dir, entry)).size).toBeGreaterThan(0);
      }
      expect(readText(join(dir, "index.d.ts"))).toBe('export * from "./types/index.js";' + String.fromCharCode(10));
    });
  });

  test("A7 · lib/types: 3 tệp .d.ts CHÉP NGUYÊN bản gốc + lib/index.d.ts đúng 34 B", () => {
    const oursRoot = join(OURS_LIB, "types");
    const stockRoot = join(STOCK_LIB, "types");
    const oursFiles = listFiles(oursRoot).map((file) => relative(oursRoot, file)).sort();
    const stockFiles = listFiles(stockRoot).map((file) => relative(stockRoot, file)).sort();
    expect(oursFiles).toEqual(["client/flow.d.ts", "client/index.d.ts", "index.d.ts"]);
    expect(oursFiles).toEqual(stockFiles);
    for (const file of oursFiles) {
      const ours = readFileSync(join(oursRoot, file));
      const stock = readFileSync(join(stockRoot, file));
      expect(ours.equals(stock)).toBe(true);
      expect(ours.length).toBeGreaterThan(0);
    }
    expect(readFileSync(join(OURS_LIB, "types", "index.d.ts")).length).toBe(501);
    expect(readFileSync(join(OURS_LIB, "types", "client", "flow.d.ts")).length).toBe(967);
    expect(readFileSync(join(OURS_LIB, "types", "client", "index.d.ts")).length).toBe(627);
    expect(readText(join(OURS_LIB, "index.d.ts"))).toBe('export * from "./types/index.js";' + String.fromCharCode(10));
    expect(readFileSync(join(OURS_LIB, "index.d.ts")).length).toBe(34);
  });
});

describe("B · package.json: THƯ VIỆN ⇒ KHÔNG row + gbh.draft/gbh.tests + exports/dsh.client khớp gốc", () => {
  test("B1 · danh tính gói: name/thư mục khớp nhau · private · type module · main lib/index.js", () => {
    const ours = readPkg(join(PKG, "package.json"));
    const stock = readPkg(join(STOCK_PKG, "package.json"));
    expect(ours.name).toBe(OUR_ID);
    expect(stock.name).toBe(STOCK_ID);
    expect(OUR_ID).toBe("@galaxy-blackhole/gbh-client-ui-directory-picker-native");
    expect(STOCK_ID).toBe("@deepseek-ai/dsh-client-ui-directory-picker-native");
    expect(ours.private).toBe(true);
    expect(ours.type).toBe("module");
    expect(ours.main).toBe("lib/index.js");
    expect(stock.main).toBe("lib/index.js");
  });

  test("B2 · dsh.client KHỚP TUYỆT ĐỐI bản gốc: inject [ui-renderer, ui-workspace] · platform web · KHÔNG external", () => {
    const ours = readPkg(join(PKG, "package.json"));
    const stock = readPkg(join(STOCK_PKG, "package.json"));
    expect(sameAfterIdMap(ours.dsh?.client, stock.dsh?.client)).toBe(true);
    // 20/10/2026 — hướng "đổi thương hiệu + rewrite id": so ĐỐI XỨNG qua sameAfterIdMap (id ta → id stock).
    expect(sameAfterIdMap(ours.dsh?.client, {
      inject: ["@deepseek-ai/dsh-client-ui-renderer", "@deepseek-ai/dsh-client-ui-workspace"],
      platform: "web",
    })).toBe(true);
    expect(ours.dsh?.client?.inject?.length).toBe(2);
    expect(ours.dsh?.client?.platform).toBe("web");
    expect("external" in (ours.dsh?.client ?? {})).toBe(false);
    expect("external" in (stock.dsh?.client ?? {})).toBe(false);
  });

  test("B3 · exports KHỚP bản gốc ở MỌI mục (5 khoá · . / ./client / ./src/* / ./package.json / ./locale/*.json)", () => {
    const ours = readPkg(join(PKG, "package.json")).exports ?? {};
    const stock = readPkg(join(STOCK_PKG, "package.json")).exports ?? {};
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).length).toBe(5);
    for (const key of Object.keys(stock)) expect(ours[key]).toEqual(stock[key]);
    expect(ours["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    expect(ours["./client"]).toEqual({ types: "./lib/types/client/index.d.ts", default: "./lib/client.js" });
    expect(ours["./src/*"]).toBe("./src/*");
    expect(ours["./package.json"]).toBe("./package.json");
    expect(ours["./locale/*.json"]).toBe("./locale/*.json");
  });

  test("B4 · KHÔNG có gbh.row và KHÔNG có gbh.row_unmounted_ly_do (gói THƯ VIỆN — quyết định Lead 19/10)", () => {
    const gbh = readPkg(join(PKG, "package.json")).gbh ?? {};
    expect("row" in gbh).toBe(false);
    expect("row_unmounted_ly_do" in gbh).toBe(false);
    expect(Object.keys(gbh)).not.toContain("row");
    expect(Object.keys(gbh)).not.toContain("row_unmounted_ly_do");
    expect(typeof gbh.draft).toBe("string");
    expect((gbh.draft ?? "").length).toBeGreaterThan(20);
    expect(gbh.draft).toContain("THƯ VIỆN");
    expect(gbh.draft).toContain("KHÔNG khai gbh.row");
    expect(gbh.peers).toEqual(["@deepseek-ai/cordis"]);
  });

  test("B5 · gbh.tests trỏ ĐÚNG tệp này (tests/client/client-ui-directory-picker-native.test.ts) và tệp tồn tại", () => {
    const gbh = readPkg(join(PKG, "package.json")).gbh ?? {};
    expect(Array.isArray(gbh.tests)).toBe(true);
    const tests = gbh.tests ?? [];
    expect(tests).toContain(THIS_TEST);
    expect(tests.length).toBeGreaterThan(0);
    for (const entry of tests) expect(entry).toMatch(/^tests\/.+\.test\.ts$/u);
    expect(existsSync(join(REPO, THIS_TEST))).toBe(true);
    expect(readFileSync(join(REPO, THIS_TEST)).length).toBeGreaterThan(0);
  });

  test("B6 · manifest.ts khớp package.json + trỏ đúng 2 bundle gốc + CLIENT_ID_REPLACEMENTS = 1", () => {
    expect(readPkg(join(PKG, "package.json")).name).toBe(PACKAGE_NAME);
    expect(readPkg(join(STOCK_PKG, "package.json")).name).toBe(STOCK_PACKAGE_NAME);
    expect(CLIENT_ID_REPLACEMENTS).toBe(1);
    expect(idCount(readText(join(OURS_LIB, "client.js")), OUR_ID)).toBe(CLIENT_ID_REPLACEMENTS);
    expect(existsSync(join(REPO, STOCK_BUNDLE))).toBe(true);
    expect(existsSync(join(REPO, STOCK_CLIENT_BUNDLE))).toBe(true);
    expect(STOCK_BUNDLE).toBe("apps/host/node_modules/" + STOCK_ID + "/lib/index.js");
    expect(STOCK_CLIENT_BUNDLE).toBe("apps/host/node_modules/" + STOCK_ID + "/lib/client.js");
    expect(HOST_PARTS_DIR_NAME).toBe("parts-host");
    expect(OUR_ID.length - STOCK_ID.length).toBe(5);
  });
});

describe("C · entry MỘT-ID: src/client.ts + lib/client-entry.js + lib/index-entry.js (2 Bun.build tách rời)", () => {
  test("C1 · CLIENT_LOADER_SHAPE mang ĐÚNG id ta (không id stock) + bằng 3 dòng vỏ của client-wrapper", async () => {
    const source = await importModule(join(PKG, "src", "client.ts"));
    const shape = String(source["CLIENT_LOADER_SHAPE"]);
    expect(shape).toBe(LOADER_CALL + ' id: "' + OUR_ID + '", factory: (require) => {');
    expect(shape).toBe([LOADER_CALL, 'id: "' + OUR_ID + '",', "factory: (require) => {"].join(" "));
    expect(idCount(shape, OUR_ID)).toBe(1);
    expect(idCount(shape, STOCK_ID)).toBe(0);
    expect(source["OUR_CLIENT_ID"]).toBe(OUR_ID);
    expect(source["STOCK_CLIENT_ID"]).toBe(STOCK_ID);
    const wrapper = readWrapper();
    expect(shape).toBe([wrapper.head[0], wrapper.head[1]?.trim(), wrapper.head[2]?.trim()].join(" "));
  });

  test("C2 · lib/client-entry.js (Bun.build thứ hai) tồn tại + xuất ĐÚNG 5 tên + CLIENT_LOADER_SHAPE khớp nguồn", async () => {
    const entryPath = join(OURS_LIB, "client-entry.js");
    expect(existsSync(entryPath)).toBe(true);
    expect(statSync(entryPath).size).toBeGreaterThan(0);
    const [built, source] = await Promise.all([importModule(entryPath), importModule(join(PKG, "src", "client.ts"))]);
    expect(exportNames(built)).toEqual(exportNames(source));
    expect(exportNames(built)).toEqual([
      "CLIENT_LOADER_SHAPE",
      "OUR_CLIENT_ID",
      "STOCK_CLIENT_ID",
      "assembleClientBundle",
      "readWrapper",
    ]);
    expect(built["CLIENT_LOADER_SHAPE"]).toBe(source["CLIENT_LOADER_SHAPE"]);
    expect(built["OUR_CLIENT_ID"]).toBe(OUR_ID);
    expect(built["STOCK_CLIENT_ID"]).toBe(STOCK_ID);
    expect(typeof built["readWrapper"]).toBe("function");
    expect(typeof built["assembleClientBundle"]).toBe("function");
    const entryText = readText(entryPath);
    expect(entryText).toContain(String(source["CLIENT_LOADER_SHAPE"]));
    expect(entryText).toContain(OUR_ID);
    expect(entryText).toContain(STOCK_ID);
  });

  test("C3 · lib/index-entry.js (Bun.build thứ nhất) tồn tại + xuất HỢP apply host + 5 tên nửa client", async () => {
    const entryPath = join(OURS_LIB, "index-entry.js");
    expect(existsSync(entryPath)).toBe(true);
    expect(statSync(entryPath).size).toBeGreaterThan(0);
    const [entry, host, client] = await Promise.all([
      importModule(entryPath),
      importModule(join(OURS_LIB, "index.js")),
      importModule(join(PKG, "src", "client.ts")),
    ]);
    expect(exportNames(host)).toEqual(["apply"]);
    expect(exportNames(entry)).toEqual([...new Set([...exportNames(host), ...exportNames(client)])].sort());
    expect(exportNames(entry)).toEqual([
      "CLIENT_LOADER_SHAPE",
      "OUR_CLIENT_ID",
      "STOCK_CLIENT_ID",
      "apply",
      "assembleClientBundle",
      "readWrapper",
    ]);
    expect(typeof entry["apply"]).toBe("function");
    expect(String(entry["apply"])).toBe(String(host["apply"]));
    expect(entry["OUR_CLIENT_ID"]).toBe(OUR_ID);
    expect(entry["STOCK_CLIENT_ID"]).toBe(STOCK_ID);
    const entryText = readText(entryPath);
    expect(entryText).toContain("CLIENT_LOADER_SHAPE");
    expect(/packages\/client\/client-ui-directory-picker-native\/lib\/index\.js|src\/index\.ts|lib\/index\.js/.test(entryText)).toBe(true);
    expect(entryText).toContain(OUR_ID);
  });

  test("C4 · lib/client.js có ĐÚNG 1 lời gọi window.__ModuleLoader__.load({ · dòng 1 · đuôi exports apply/inject", () => {
    const ours = readText(join(OURS_LIB, "client.js"));
    const stock = readText(join(STOCK_LIB, "client.js"));
    expect(idCount(ours, LOADER_CALL)).toBe(1);
    expect(idCount(stock, LOADER_CALL)).toBe(1);
    expect(ours.split("\n")[0]).toBe(LOADER_CALL);
    expect(ours.split("\n").slice(77, 80)).toEqual([
      "\t\texports.apply = apply;",
      "\t\texports.inject = inject;",
      "\t\treturn module.exports;",
    ]);
    expect(ours.trimEnd().endsWith("//# sourceMappingURL=client.js.map")).toBe(true);
    expect(idCount(readText(join(OURS_LIB, "client-entry.js")), LOADER_CALL)).toBe(1);
    expect(idCount(readText(join(OURS_LIB, "index.js")), LOADER_CALL)).toBe(0);
  });

  test("C5 · build.ts gọi Bun.build ĐÚNG 2 lần TÁCH RỜI (index-entry.js + client-entry.js), không gộp", () => {
    const source = readText(join(PKG, "build.ts"));
    expect(idCount(source, "Bun.build(")).toBe(2);
    expect(idCount(source, "await Bun.build(")).toBe(2);
    expect(source).toContain('naming: "index-entry.js"');
    expect(source).toContain('naming: "client-entry.js"');
    expect(source).toContain('target: "bun"');
    expect(source).toContain('target: "browser"');
    expect(existsSync(join(OURS_LIB, "index-entry.js"))).toBe(true);
    expect(existsSync(join(OURS_LIB, "client-entry.js"))).toBe(true);
  });
});

describe("D · bề mặt module host: apply rỗng y hệt gốc (byte-identical ⇒ hành vi identical)", () => {
  test("D1 · lib/index.js và bản gốc cùng export ['apply'] · cùng thân hàm · length 0", async () => {
    const [ours, stock] = await Promise.all([
      importModule(join(OURS_LIB, "index.js")),
      importModule(join(STOCK_LIB, "index.js")),
    ]);
    expect(exportNames(ours)).toEqual(["apply"]);
    expect(exportNames(stock)).toEqual(["apply"]);
    expect(typeof ours["apply"]).toBe("function");
    expect(typeof stock["apply"]).toBe("function");
    expect(String(ours["apply"])).toBe(String(stock["apply"]));
    expect(String(ours["apply"])).toBe("function apply() {}");
    expect((ours["apply"] as (...args: unknown[]) => unknown).length).toBe(0);
    expect((stock["apply"] as (...args: unknown[]) => unknown).length).toBe(0);
  });
});
