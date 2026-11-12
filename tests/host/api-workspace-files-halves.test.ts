/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 01/11/2026
 * desc A/B 4 artefact MỚI của @galaxy-blackhole/gbh-api-workspace-files (host byte-identical 4 lát · client +297 B
 *      = 5 B id + 292 B sai khác CÓ CHỦ Ý gbh-resource:// · typert.host +105 B · typert.remote-client +100 B) so bản gốc; dsh.client so bằng sameAfterIdMap (inject đã rewrite CÓ CHỦ ĐÍCH); package.json; 2 cửa Bun.build; typert import HAI BÊN; canh src-handwritten/
 */
import { describe, expect, test } from "bun:test";
import { normalizeIdsInText, sameAfterIdMap } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEVIATION } from "../../packages/host/api-workspace-files/build.ts";
import { assembleBundle } from "../../packages/host/api-workspace-files/src/assemble.ts";
import { PART_FILES } from "../../packages/host/api-workspace-files/src/manifest.ts";

/** Gốc repo (tests/host ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "api-workspace-files");
/** Thư mục lib của ta (4 artefact + 2 entry Bun.build + 2 .d.ts). */
const OURS_LIB = join(PKG, "lib");
/** Thư mục gói GỐC (CHỈ ĐỌC — nguồn đối chiếu byte). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-workspace-files");
/** Thư mục lib của gói gốc. */
const STOCK_LIB = join(STOCK_PKG, "lib");
/** Id MỘT-ID của ta (41 ký tự). */
const OUR_ID = "@galaxy-blackhole/gbh-api-workspace-files";
/** Id gốc của bản stock (36 ký tự) — chênh 5 byte mỗi lần quy đổi. */
const STOCK_ID = "@deepseek-ai/dsh-api-workspace-files";

/** Một mục trong `exports` của package.json (object điều kiện hoặc đường dẫn thẳng). */
type ExportEntry = string | Record<string, string>;

/** Hình dạng package.json mà test chạm tới (chỉ các khoá có mặt trong gói). */
interface PkgShape {
  name?: string;
  exports?: Record<string, ExportEntry>;
  dsh?: { client?: { inject?: string[]; external?: string[]; platform?: string } };
  gbh?: {
    tests?: string[];
    row?: unknown;
    row_unmounted_ly_do?: {
      ly_do?: string;
      row?: { id?: string; aliases?: string[]; moduleIds?: string[]; tests?: string[] };
    };
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
  /** 16 ký tự đầu SHA-256 của bản gốc. */
  stockSha16: string;
  /** Số lần id ta xuất hiện trong artefact của ta. */
  ourIds: number;
  /** Hiệu số byte (ta − gốc) kỳ vọng. */
  delta: number;
  /** Chênh byte do THỤT ĐẦU DÒNG mà cổng nội dung bỏ qua (bộ ghép thụt lại theo vùng); mặc định 0. */
  indentBytes?: number;
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
 * Đếm số lần một id xuất hiện trong văn bản (đếm theo lần xuất hiện, không theo dòng).
 * Nhận: text — văn bản cần đếm; id — chuỗi id cần tìm.
 * Trả: số lần xuất hiện (0 khi không có).
 */
function idCount(text: string, id: string): number {
  return text.split(id).length - 1;
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
 * Serialize ổn định một giá trị thành JSON, quy BigInt về chuỗi để không ném.
 * Nhận: value — giá trị cần serialize (TYPERT của typert.remote-client có BigInt).
 * Trả: chuỗi JSON ổn định.
 */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key: string, item: unknown) => (typeof item === "bigint" ? String(item) + "n" : item));
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
 * Cổng BYTE TUYỆT ĐỐI cho nửa host: 4 lát ghép phải ra ĐÚNG văn bản gốc, không chuẩn hoá id.
 * Nhận: không. Trả: không (ném khi lệch bất kỳ chiều nào).
 */
function assertHostIdentical(): void {
  const ours = readText(join(OURS_LIB, PAIR_HOST.file));
  const stock = readText(join(STOCK_LIB, PAIR_HOST.file));
  expect(Buffer.from(ours, "utf8").equals(Buffer.from(stock, "utf8"))).toBe(true);
  expect(sha256(ours)).toBe(sha256(stock));
  expect(idCount(ours, OUR_ID)).toBe(0);
  expect(idCount(ours, STOCK_ID)).toBe(1);
  expect(byteLength(ours)).toBe(PAIR_HOST.bytes);
  expect(lineCount(ours)).toBe(PAIR_HOST.lines);
  expect(sha256(ours).slice(0, 16)).toBe(PAIR_HOST.sha16);
  expect(sha256(stock).slice(0, 16)).toBe(PAIR_HOST.stockSha16);
  expect(PART_FILES.length).toBe(4);
  expect(PART_FILES).toEqual(["part-00-head.ts", "part-01-changes.ts", "part-02-index.ts", "part-03-tail.ts"]);
  expect(assembleBundle(join(PKG, "src", "parts-host"))).toBe(ours);
}

/**
 * Đảo ĐÚNG những sai khác CÓ CHỦ Ý mà build.ts áp lên artefact (01/11/2026: phát `gbh-resource://file/`
 * nhưng vẫn nhận scheme cũ). Nhờ vậy cổng byte vẫn so được TỪNG BYTE với bundle gốc, và ai thêm một phép
 * thay thế thứ ba vào `DEVIATION` thì test này cũng đỏ theo.
 * Nhận: text — nội dung artefact của ta. Trả: nội dung đã đảo sai khác có chủ ý (rỗng sai khác ⇒ nguyên văn).
 */
function reverseDeviation(text: string): string {
  let out = text;
  for (const pair of DEVIATION.pairs) out = out.split(pair.ours).join(pair.stock);
  return out;
}

/**
 * Bỏ THỤT ĐẦU DÒNG — bộ ghép thụt lại từng vùng theo độ sâu brace, nên chèn thêm dòng trong một vùng làm
 * các dòng phía sau lệch một mức thụt dù nội dung y hệt (cùng phép chuẩn hoá mà `gateOwnership` của
 * build.ts dùng trước khi so byte với bundle gốc).
 * Nhận: text — nội dung cần chuẩn hoá. Trả: nội dung đã bỏ thụt đầu dòng.
 */
function flattenIndent(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^[ \t]+/u, ""))
    .join("\n");
}

/**
 * Số byte CHÊNH CÓ CHỦ Ý của một artefact: tổng chênh của các phép thay thế THẬT SỰ có mặt trong nó.
 * Nhận: text — nội dung artefact của ta. Trả: số byte chênh (0 khi artefact không mang phép thay thế nào).
 */
function deviationBytes(text: string): number {
  return DEVIATION.pairs.reduce(
    (sum, pair) => sum + (text.includes(pair.ours) ? Buffer.byteLength(pair.ours, "utf8") - Buffer.byteLength(pair.stock, "utf8") : 0),
    0,
  );
}

/**
 * Cổng OWNERSHIP cho MỘT artefact: quy MỌI id ta → id gốc (`normalizeIdsInText`) và ĐẢO sai khác có chủ ý,
 * rồi so TỪNG BYTE với bản gốc; đếm id hai bên và đo hiệu số byte (5 B/id module · 13 B/id gateway).
 * Nhận: pair — cặp artefact cần canh (tên tệp + số dòng/byte/sha + số id + hiệu byte kỳ vọng).
 * Trả: không (ném khi lệch bất kỳ chiều nào).
 */
function assertOwnership(pair: ArtefactPair): void {
  const ours = readText(join(OURS_LIB, pair.file));
  const stock = readText(join(STOCK_LIB, pair.file));
  // 20/10/2026 — quy id CẢ HAI VẾ bằng bản đồ 566 id của helper chung (id ta trong bundle có thể > 1).
  // 01/11/2026 — đảo sai khác CÓ CHỦ Ý (gbh-resource://) trước khi so byte; xem DEVIATION ở build.ts.
  const normalized = flattenIndent(normalizeIdsInText(reverseDeviation(ours)));
  const stockNormalized = flattenIndent(normalizeIdsInText(stock));
  expect(Buffer.from(normalized, "utf8").equals(Buffer.from(stockNormalized, "utf8"))).toBe(true);
  expect(sha256(normalized)).toBe(sha256(stockNormalized));
  expect(idCount(ours, OUR_ID)).toBe(pair.ourIds);
  expect(idCount(ours, STOCK_ID)).toBe(0);
  expect(byteLength(ours)).toBe(pair.bytes);
  expect(lineCount(ours)).toBe(pair.lines);
  expect(sha256(ours).slice(0, 16)).toBe(pair.sha16);
  expect(sha256(stock).slice(0, 16)).toBe(pair.stockSha16);
  expect(byteLength(ours) - byteLength(stock)).toBe(pair.delta);
  // Gói này KHÔNG mang require gateway ⇒ delta = 5 B/id module + số byte sai khác CÓ CHỦ Ý của artefact đó
  // + chênh thụt đầu dòng còn lại (cổng nội dung ở trên đã chứng minh phần còn lại y hệt bản gốc).
  expect(pair.delta).toBe(pair.ourIds * (OUR_ID.length - STOCK_ID.length) + deviationBytes(ours) + (pair.indentBytes ?? 0) + (ours.split("@galaxy-blackhole/gbh-typert-generator").length - 1) * 5);
}

/**
 * Chép MỘT artefact typert của ta sang thư mục tạm có `node_modules` trỏ về apps/host,
 * nạp CẢ HAI bản bằng `await import()`, chạy phép so, rồi DỌN thư mục tạm.
 * Lý do phải chép: `zod` chỉ có trong apps/host/node_modules, không nằm trên đường phân giải của gói ta.
 * Nhận: file — tên artefact typert; run — phép so nhận module của ta và module gốc.
 * Trả: Promise hoàn tất khi phép so xong (luôn dọn thư mục tạm, kể cả khi phép so ném).
 */
async function withTypertPair(file: string, run: (ours: ModuleShape, stock: ModuleShape) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "gbh-workspace-files-halves-"));
  try {
    symlinkSync(join(REPO, "apps", "host", "node_modules"), join(dir, "node_modules"), "dir");
    copyFileSync(join(OURS_LIB, file), join(dir, file));
    expect(readFileSync(join(dir, file)).equals(readFileSync(join(OURS_LIB, file)))).toBe(true);
    const [ours, stock] = await Promise.all([importModule(join(dir, file)), importModule(join(STOCK_LIB, file))]);
    await run(ours, stock);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Cặp artefact nửa host: 4 lát ghép ⇒ BYTE-IDENTICAL (0 id ta, 1 id gốc). */
const PAIR_HOST: ArtefactPair = {
  file: "index.js",
  lines: 637,
  bytes: 25087,
  sha16: "1d633aaf12df42e4",
  stockSha16: "1d633aaf12df42e4",
  ourIds: 0,
  delta: 0,
};

/** Cặp artefact nửa client: 1 id ta, +297 byte (5 B id + 292 B sai khác CÓ CHỦ Ý `gbh-resource://file/`). */
const PAIR_CLIENT: ArtefactPair = {
  file: "client.js",
  lines: 482,
  bytes: 16183,
  sha16: "71015f162594b641",
  stockSha16: "de67777d792d3a5d",
  ourIds: 1,
  delta: 297,
  // Bộ ghép thụt lại theo vùng: ĐÚNG MỘT dòng (chú thích `isDriveSegment`) sâu hơn 2 tab ⇒ +2 B.
  indentBytes: 2,
};

/** Cặp artefact typert host: 21 id ta, +105 byte. */
const PAIR_TYPERT_HOST: ArtefactPair = {
  file: "typert.host.js",
  lines: 571,
  bytes: 43387,
  sha16: "987ec8749edc4ec0",
  stockSha16: "ffb407b64b813e4e",
  ourIds: 21,
  delta: 110,
};

/** Cặp artefact typert remote-client: 20 id ta, +100 byte. */
const PAIR_TYPERT_REMOTE: ArtefactPair = {
  file: "typert.remote-client.js",
  lines: 460,
  bytes: 35353,
  sha16: "b51da3374d3a16c4",
  stockSha16: "b2f318688b5f8878",
  ourIds: 20,
  delta: 105,
};

describe("A · artefact: chuẩn hoá id ta → id gốc rồi so TỪNG BYTE với bản gốc", () => {
  test("A1 · lib/index.js: 4 lát ghép ⇒ BYTE-IDENTICAL bản gốc (0 id ta / 1 id gốc · 637 dòng · 25.087 B)", () => {
    assertHostIdentical();
  });

  test("A2 · lib/client.js: 1 id ta / 0 id gốc · +297 B (5 B id + 292 B gbh-resource://) · chuẩn hoá + đảo sai khác ⇒ byte-identical", () => {
    assertOwnership(PAIR_CLIENT);
    const ours = readText(join(OURS_LIB, PAIR_CLIENT.file));
    expect(ours.startsWith("window.__ModuleLoader__.load({")).toBe(true);
    expect(ours).toContain('id: "' + OUR_ID + '"');
  });

  test("A3 · lib/typert.host.js: 21 id ta / 0 id gốc · +105 B · chuẩn hoá ⇒ byte-identical", () => {
    assertOwnership(PAIR_TYPERT_HOST);
  });

  test("A4 · lib/typert.remote-client.js: 20 id ta / 0 id gốc · +100 B · chuẩn hoá ⇒ byte-identical", () => {
    assertOwnership(PAIR_TYPERT_REMOTE);
  });
});

describe("B · bề mặt package.json: dsh.client · exports · gbh", () => {
  test("B1 · dsh.client KHỚP bản gốc (inject 2 mục · platform web)", () => {
    const ours = readPkg(join(PKG, "package.json"));
    const stock = readPkg(join(STOCK_PKG, "package.json"));
    expect(sameAfterIdMap(ours.dsh?.client, stock.dsh?.client)).toBe(true);
    // 20/10/2026 — inject của ta đã rewrite sang id GBH CÓ CHỦ ĐÍCH ⇒ so SAU bản đồ id với ĐÚNG literal
    // stock (giữ literal stock làm chuẩn, không sửa literal thành id ta).
    expect(sameAfterIdMap(ours.dsh?.client?.inject, ["@deepseek-ai/dsh-api-gateway", "@deepseek-ai/dsh-client-resources"])).toBe(true);
    expect(ours.dsh?.client?.platform).toBe("web");
  });

  test("B2 · exports KHỚP bản gốc ở MỌI mục (8 khoá)", () => {
    const ours = readPkg(join(PKG, "package.json")).exports ?? {};
    const stock = readPkg(join(STOCK_PKG, "package.json")).exports ?? {};
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).length).toBe(8);
    for (const key of Object.keys(stock)) expect(ours[key]).toEqual(stock[key]);
    expect(ours["./client"]).toEqual({ types: "./lib/types/client/index.d.ts", default: "./lib/client.js" });
    expect(ours["./typert"]).toEqual({ types: "./lib/typert.host.d.ts", default: "./lib/typert.host.js" });
    expect(ours["./remote"]).toEqual({ types: "./lib/typert.remote-client.d.ts", default: "./lib/typert.remote-client.js" });
  });

  test("B3 · row khai ĐÚNG MỘT khoá (flip hoặc park) + id = 'workspace-files' (aliases/moduleIds/tests)", () => {
    const gbh = readPkg(join(PKG, "package.json")).gbh ?? {};
    // 19/10/2026 — BẤT BIẾN MỚI (thay 'KHÔNG khai row' đã stale sau khi row được khai/mount): đúng MỘT khoá, cấm cả hai.
    const daFlip = "row" in gbh;
    const dangPark = "row_unmounted_ly_do" in gbh;
    expect(daFlip || dangPark).toBe(true);
    expect(daFlip && dangPark).toBe(false);
    const row = (daFlip ? gbh.row : gbh.row_unmounted_ly_do?.row) as
      | { id?: string; aliases?: string[]; moduleIds?: string[]; tests?: string[] }
      | undefined;
    if (dangPark) expect(typeof gbh.row_unmounted_ly_do?.ly_do).toBe("string");
    expect(row?.id).toBe("workspace-files");
    expect(row?.aliases).toEqual([STOCK_ID]);
    expect(row?.moduleIds).toEqual([OUR_ID]);
    expect(row?.tests).toEqual(["tests/host/api-workspace-files.test.ts"]);
    // 19/10/2026 — gói nay có THÊM bộ A/B cho 4 artefact; gbh.tests liệt kê CẢ HAI.
    expect(gbh.tests).toEqual(["tests/host/api-workspace-files.test.ts", "tests/host/api-workspace-files-halves.test.ts"]);
  });
});

describe("C · entry: src/client.ts + lib/client-entry.js · lib/index-entry.js", () => {
  test("C1 · src/client.ts CLIENT_LOADER_SHAPE mang ĐÚNG id ta + lib/client-entry.js (Bun.build) tồn tại", async () => {
    const source = (await import(join(PKG, "src", "client.ts"))) as ModuleShape;
    const shape = String(source["CLIENT_LOADER_SHAPE"]);
    expect(shape.startsWith("window.__ModuleLoader__.load({")).toBe(true);
    expect(shape).toContain('id: "' + OUR_ID + '"');
    expect(shape).not.toContain(STOCK_ID);
    expect(source["OUR_CLIENT_ID"]).toBe(OUR_ID);
    expect(source["STOCK_CLIENT_ID"]).toBe(STOCK_ID);
    const entryPath = join(OURS_LIB, "client-entry.js");
    expect(existsSync(entryPath)).toBe(true);
    expect(statSync(entryPath).size).toBeGreaterThan(0);
    const entryText = readText(entryPath);
    expect(entryText).toContain(shape);
    expect(entryText).toContain("CLIENT_LOADER_SHAPE");
    expect(entryText).toContain(OUR_ID);
    const built = await importModule(entryPath);
    expect(exportNames(built)).toEqual(exportNames(source));
    expect(built["CLIENT_LOADER_SHAPE"]).toBe(shape);
  });

  test("C2 · lib/index-entry.js (Bun.build thứ nhất) xuất HỢP export host + nửa client", async () => {
    const entryPath = join(OURS_LIB, "index-entry.js");
    expect(existsSync(entryPath)).toBe(true);
    expect(statSync(entryPath).size).toBeGreaterThan(0);
    const [entry, host, client] = await Promise.all([
      importModule(entryPath),
      importModule(join(OURS_LIB, "index.js")),
      importModule(join(PKG, "src", "client.ts")),
    ]);
    expect(exportNames(entry)).toEqual([...new Set([...exportNames(host), ...exportNames(client)])].sort());
    expect(exportNames(entry)).toEqual([
      "CLIENT_LOADER_SHAPE",
      "OUR_CLIENT_ID",
      "STOCK_CLIENT_ID",
      "WorkspaceFiles",
      "assembleClientBundle",
      "default",
      "readWrapper",
    ]);
    expect(entry["OUR_CLIENT_ID"]).toBe(OUR_ID);
    expect(readText(entryPath)).toContain("WorkspaceFiles");
  });
});

describe("D · typert: export A/B bằng await import() + serialize BigInt-safe + .d.ts", () => {
  test("D1 · lib/typert.host.js: danh sách export TRÙNG bản gốc (cả hai = ['TYPERT'])", async () => {
    await withTypertPair("typert.host.js", async (ours, stock) => {
      expect(exportNames(ours)).toEqual(exportNames(stock));
      expect(exportNames(ours)).toEqual(["TYPERT"]);
      expect(Object.keys(ours["TYPERT"] as ModuleShape).sort()).toEqual(Object.keys(stock["TYPERT"] as ModuleShape).sort());
      expect(Object.keys(ours["TYPERT"] as ModuleShape).sort()).toEqual(["face", "invocations", "model", "package", "schemas"]);
    });
  });

  test("D2 · TYPERT host: serialize BigInt-safe rồi chuẩn hoá id ⇒ JSON TRÙNG gốc (25 id · +125 B)", async () => {
    await withTypertPair("typert.host.js", async (ours, stock) => {
      const oursJson = stableJson(ours["TYPERT"]);
      const stockJson = stableJson(stock["TYPERT"]);
      expect(oursJson).not.toBe(stockJson);
      expect(normalizeIdsInText(oursJson)).toBe(normalizeIdsInText(stockJson));
      const ids = idCount(oursJson, OUR_ID);
      expect(ids).toBe(25);
      expect(idCount(oursJson, STOCK_ID)).toBe(0);
      expect(byteLength(oursJson) - byteLength(stockJson)).toBe(125);
      expect(125).toBe(ids * (OUR_ID.length - STOCK_ID.length));
    });
  });

  test("D3 · TYPERT_REMOTE: default === TYPERT_REMOTE + serialize chuẩn hoá ⇒ JSON TRÙNG gốc (20 id · +100 B)", async () => {
    await withTypertPair("typert.remote-client.js", async (ours, stock) => {
      expect(exportNames(ours)).toEqual(exportNames(stock));
      expect(exportNames(ours)).toEqual(["TYPERT_REMOTE", "default"]);
      expect(ours["default"]).toBe(ours["TYPERT_REMOTE"]);
      expect(stock["default"]).toBe(stock["TYPERT_REMOTE"]);
      const oursJson = stableJson(ours["TYPERT_REMOTE"]);
      const stockJson = stableJson(stock["TYPERT_REMOTE"]);
      expect(oursJson).not.toBe(stockJson);
      expect(normalizeIdsInText(oursJson)).toBe(normalizeIdsInText(stockJson));
      const ids = idCount(oursJson, OUR_ID);
      expect(ids).toBe(20);
      expect(idCount(oursJson, STOCK_ID)).toBe(0);
      expect(byteLength(oursJson) - byteLength(stockJson)).toBe(100);
      expect(100).toBe(ids * (OUR_ID.length - STOCK_ID.length));
    });
  });

  test("D4 · lib/typert.host.d.ts + lib/typert.remote-client.d.ts CHÉP NGUYÊN từ gốc (so từng byte)", () => {
    const expected = [
      { file: "typert.host.d.ts", bytes: 123, sha16: "5e2d26ee86d0fe17" },
      { file: "typert.remote-client.d.ts", bytes: 3371, sha16: "27c53171556300fa" },
    ];
    for (const entry of expected) {
      const ours = readFileSync(join(OURS_LIB, entry.file));
      const stock = readFileSync(join(STOCK_LIB, entry.file));
      expect(ours.equals(stock)).toBe(true);
      expect(ours.length).toBe(entry.bytes);
      expect(sha256(ours.toString("utf8")).slice(0, 16)).toBe(entry.sha16);
    }
  });
});

describe("E · canh src-handwritten/ (chỉ tham chiếu, KHÔNG vào build)", () => {
  test("E1 · src-handwritten/ còn nguyên 6 tệp + KHÔNG được import từ build (chỉ tham chiếu)", () => {
    const dir = join(PKG, "src-handwritten");
    const expected = ["changes.ts", "index.ts", "page.ts", "seams.ts", "service.ts", "types.ts"];
    expect(existsSync(dir)).toBe(true);
    expect(readdirSync(dir).filter((name) => !name.startsWith(".")).sort()).toEqual(expected);
    for (const file of expected) expect(statSync(join(dir, file)).size).toBeGreaterThan(0);
    const buildFiles = [
      join(PKG, "build.ts"),
      ...listFiles(join(PKG, "src")).filter((file) => file.endsWith(".ts") || file.endsWith(".json")),
    ];
    for (const file of buildFiles) expect(readText(file)).not.toContain("src-handwritten");
    for (const file of ["index.js", "client.js", "typert.host.js", "typert.remote-client.js", "index-entry.js", "client-entry.js"]) {
      expect(readText(join(OURS_LIB, file))).not.toContain("src-handwritten");
    }
  });
});
