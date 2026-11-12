/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc A/B 4 artefact MỚI của @galaxy-blackhole/gbh-api-remote-access (host byte-identical 4 lát · client đổi 2 dòng: 2 loader + 9 require gateway, giữ 6 id stock là DỮ LIỆU · typert.host +15 B · typert.remote-client +10 B) so bản gốc; dsh.client so bằng sameAfterIdMap; package.json; 2 cửa Bun.build; typert import HAI BÊN; canh src-handwritten/
 */
import { describe, expect, test } from "bun:test";
import { normalizeIdsInText, sameAfterIdMap } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assembleBundle } from "../../packages/host/api-remote-access/src/assemble.ts";
import { assembleClientBundle, readWrapper } from "../../packages/host/api-remote-access/src/assemble-client.ts";
import { assembleTypert } from "../../packages/host/api-remote-access/src/assemble-typert.ts";
import {
  HOST_PARTS_DIR_NAME,
  PART_FILES,
  TYPERT_HOST_PARTS_DIR_NAME,
  TYPERT_HOST_PART_FILES,
  TYPERT_REMOTE_PARTS_DIR_NAME,
  TYPERT_REMOTE_PART_FILES,
} from "../../packages/host/api-remote-access/src/manifest.ts";

/** Gốc repo (tests/host ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "api-remote-access");
/** Thư mục lib của ta (4 artefact + 2 entry Bun.build + các .d.ts). */
const OURS_LIB = join(PKG, "lib");
/** Thư mục gói GỐC (CHỈ ĐỌC — nguồn đối chiếu byte). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-remote-access");
/** Thư mục lib của gói gốc. */
const STOCK_LIB = join(STOCK_PKG, "lib");
/** Id MỘT-ID của ta (39 ký tự). */
const OUR_ID = "@galaxy-blackhole/gbh-api-remote-access";
/** Id gốc của bản stock (34 ký tự) — chênh 5 byte mỗi lần quy đổi. */
const STOCK_ID = "@deepseek-ai/dsh-api-remote-access";
/** Id CỔNG của ta (41 ký tự) — bundle client.js require nó ở dòng 9 (chênh 13 byte/lần). */
const GATEWAY_ID = "@galaxy-blackhole/gbh-host-typert-gateway";
/** Id CỔNG của bản stock (28 ký tự). */
const STOCK_GATEWAY_ID = "@deepseek-ai/dsh-api-gateway";
/** Đường dẫn test cũ (đang được gbh.tests trỏ tới — test này KHÔNG sửa nó). */
const LEGACY_TEST = "tests/host/api-remote-access.test.ts";

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
    draft?: string;
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
  /** Số lần id MODULE của ta xuất hiện trong artefact của ta (mỗi lần +5 B). */
  ourIds: number;
  /** Số lần id CỔNG (gateway) của ta xuất hiện trong artefact của ta (mỗi lần +13 B). */
  gatewayIds: number;
  /** Số lần id GỐC còn lại trong artefact của ta (client: 6 lần DỮ LIỆU; typert: 0). */
  stockIds: number;
  /** Hiệu số byte (ta − gốc) kỳ vọng = ourIds × 5 + gatewayIds × 13. */
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
 * Bản gốc mang 2 id stock trong JSDoc @module (dòng 6/18) — đó là DỮ LIỆU, giữ nguyên.
 * Nhận: không. Trả: không (ném khi lệch bất kỳ chiều nào).
 */
function assertHostIdentical(): void {
  const ours = readText(join(OURS_LIB, PAIR_HOST.file));
  const stock = readText(join(STOCK_LIB, PAIR_HOST.file));
  // 20/10/2026 (lô brand cuối): nửa host nay mang `__GBH_REMOTE_ACCESS__` thay `__DSH_REMOTE_ACCESS__` — sai lệch
  // CÓ CHỦ ĐÍCH; quy cả HAI vế bằng helper chung (brand + bản đồ id) rồi mới so byte. SHA của ta vì thế KHÁC
  // stock (hằng số dưới đã cập nhật theo).
  const oursQuyDoi = normalizeIdsInText(ours);
  expect(Buffer.from(oursQuyDoi, "utf8").equals(Buffer.from(normalizeIdsInText(stock), "utf8"))).toBe(true);
  expect(sha256(oursQuyDoi)).toBe(sha256(normalizeIdsInText(stock)));
  expect(idCount(ours, OUR_ID)).toBe(0);
  expect(idCount(ours, STOCK_ID)).toBe(2);
  expect(byteLength(ours)).toBe(byteLength(stock));
  expect(lineCount(ours)).toBe(PAIR_HOST.lines);
  expect(sha256(ours).slice(0, 16)).toBe(PAIR_HOST.sha16);
  expect(sha256(stock).slice(0, 16)).toBe(PAIR_HOST.stockSha16);
  const stockLines = stock.split("\n");
  expect(stockLines.map((line, index) => (line.includes(STOCK_ID) ? index + 1 : 0)).filter(Boolean)).toEqual([6, 18]);
  expect(stockLines[5]?.trim()).toBe("* @module " + STOCK_ID + "/src/snapshot");
  expect(stockLines[17]?.trim()).toBe("* @module " + STOCK_ID);
  expect(PART_FILES.length).toBe(4);
  expect(PART_FILES).toEqual(["part-00-head.ts", "part-01-snapshot.ts", "part-02-index.ts", "part-03-tail.ts"]);
  expect(assembleBundle(join(PKG, "src", HOST_PARTS_DIR_NAME))).toBe(ours);
}

/**
 * Cổng OWNERSHIP cho MỘT artefact: chuẩn hoá brand + quy MỌI id ta → id gốc (`normalizeIdsInText`) ở
 * CẢ HAI VẾ rồi so TỪNG BYTE với bản gốc, đếm id hai bên và đo hiệu số byte (5 B/id module · 13 B/id gateway).
 * Nhận: pair — cặp artefact cần canh (tên tệp + số dòng/byte/sha + số id + hiệu byte kỳ vọng).
 * Trả: không (ném khi lệch bất kỳ chiều nào).
 */
function assertOwnership(pair: ArtefactPair): void {
  const ours = readText(join(OURS_LIB, pair.file));
  const stock = readText(join(STOCK_LIB, pair.file));
  // 20/10/2026 — nửa client nay mang NHIỀU id ta (module + require gateway) ⇒ phép quy MỘT-id không đủ.
  const normalized = normalizeIdsInText(ours);
  expect(Buffer.from(normalized, "utf8").equals(Buffer.from(normalizeIdsInText(stock), "utf8"))).toBe(true);
  expect(sha256(normalized)).toBe(sha256(normalizeIdsInText(stock)));
  expect(idCount(ours, OUR_ID)).toBe(pair.ourIds);
  expect(idCount(ours, STOCK_ID)).toBe(pair.stockIds);
  expect(byteLength(ours)).toBe(pair.bytes);
  expect(lineCount(ours)).toBe(pair.lines);
  expect(sha256(ours).slice(0, 16)).toBe(pair.sha16);
  expect(sha256(stock).slice(0, 16)).toBe(pair.stockSha16);
  expect(byteLength(ours) - byteLength(stock)).toBe(pair.delta);
  // P3 (04/11/2026): header `Generated by <id>` trong lat typert mang id MOI cua typert-generator
  // (moi lan xuat hien dai hon id stock 5 byte) => hieu so byte phai cong so hang nay.
  const typertHeaderBytes = idCount(ours, "@galaxy-blackhole/gbh-typert-generator") * 5;
  // P3 (04/11/2026): module ao store cung doi id (dai hon 5 byte moi lan xuat hien).
  const storeBytes = idCount(ours, "@galaxy-blackhole/gbh-client-store") * 5;
  expect(pair.delta).toBe(
    pair.ourIds * (OUR_ID.length - STOCK_ID.length) +
      pair.gatewayIds * (GATEWAY_ID.length - STOCK_GATEWAY_ID.length) +
      typertHeaderBytes +
      storeBytes,
  );
}

/**
 * Chép MỘT artefact typert của ta sang thư mục tạm có `node_modules` trỏ về apps/host,
 * nạp CẢ HAI bản bằng `await import()`, chạy phép so, rồi DỌN thư mục tạm.
 * Lý do phải chép: `zod` chỉ có trong apps/host/node_modules, không nằm trên đường phân giải của gói ta.
 * Nhận: file — tên artefact typert; run — phép so nhận module của ta và module gốc.
 * Trả: Promise hoàn tất khi phép so xong (luôn dọn thư mục tạm, kể cả khi phép so ném).
 */
async function withTypertPair(file: string, run: (ours: ModuleShape, stock: ModuleShape) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "gbh-remote-access-halves-"));
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

/** Cặp artefact nửa host: 4 lát ghép ⇒ BYTE-IDENTICAL (0 id ta, 2 id gốc trong JSDoc). */
const PAIR_HOST: ArtefactPair = {
  file: "index.js",
  lines: 441,
  bytes: 17165,
  // 20/10/2026: sha của TA đổi vì tên global brand (`__GBH_REMOTE_ACCESS__`) — sai lệch CÓ CHỦ ĐÍCH.
  sha16: "6b49bc8a3feb4d8a",
  stockSha16: "a912d21fcf1be495",
  ourIds: 0,
  gatewayIds: 0,
  stockIds: 2,
  delta: 0,
};

/**
 * Cặp artefact nửa client: 2 dòng mang id ta (2 = loader module, 9 = require gateway) + 6 id gốc DỮ LIỆU,
 * +18 byte. sha/byte cập nhật 20/10/2026 theo artefact SAU rewrite CÓ CHỦ ĐÍCH (id gateway dài hơn 13 B).
 */
const PAIR_CLIENT: ArtefactPair = {
  file: "client.js",
  lines: 732,
  bytes: 25193,
  sha16: "bc5395ba37653e6a",
  stockSha16: "b224860524506709",
  ourIds: 1,
  gatewayIds: 1,
  stockIds: 6,
  delta: 18,
};

/** Cặp artefact typert host: 3 id ta, +15 byte. */
const PAIR_TYPERT_HOST: ArtefactPair = {
  file: "typert.host.js",
  lines: 233,
  bytes: 17208,
  sha16: "b2bd10f1963513bc",
  stockSha16: "d5cd00d138f3c2ef",
  ourIds: 3,
  gatewayIds: 0,
  stockIds: 0,
  delta: 20,
};

/** Cặp artefact typert remote-client: 2 id ta, +10 byte. */
const PAIR_TYPERT_REMOTE: ArtefactPair = {
  file: "typert.remote-client.js",
  lines: 75,
  bytes: 5892,
  sha16: "7c1c91fa069aaf42",
  stockSha16: "ccfbf22a1c5eb8f3",
  ourIds: 2,
  gatewayIds: 0,
  stockIds: 0,
  delta: 15,
};

describe("A · artefact: chuẩn hoá id ta → id gốc rồi so TỪNG BYTE với bản gốc", () => {
  test("A1 · lib/index.js: 4 lát ghép ⇒ BYTE-IDENTICAL bản gốc (0 id ta / 2 id gốc trong JSDoc · 441 dòng · 17.165 B)", () => {
    assertHostIdentical();
  });

  test("A2 · lib/client.js: 2 dòng id ta (loader module + require gateway) / 6 id gốc DỮ LIỆU · +18 B · chuẩn hoá ⇒ byte-identical", () => {
    assertOwnership(PAIR_CLIENT);
    const ours = readText(join(OURS_LIB, PAIR_CLIENT.file));
    expect(ours.startsWith("window.__ModuleLoader__.load({")).toBe(true);
    expect(ours.split("\n")[1]?.trim()).toBe('id: "' + OUR_ID + '",');
    const wrapper = readWrapper();
    expect(wrapper.parts.length).toBe(7);
    expect(wrapper.head[1]?.trim()).toBe('id: "' + OUR_ID + '",');
    // wrapper.head là readonly ⇒ chép sang mảng thường để khớp chữ ký expect(string[]).
    expect(ours.split("\n").slice(0, 3)).toEqual([...wrapper.head]);
    // 20/10/2026 — part nguồn còn là văn bản stock, còn artefact đã rewrite require gateway sang id ta (Lead,
    // rewrite CÓ CHỦ ĐÍCH) ⇒ so SAU khi quy id ở CẢ HAI VẾ (byte-exact sau quy đổi, không nới phép so).
    expect(normalizeIdsInText(assembleClientBundle())).toBe(normalizeIdsInText(ours));
    expect(ours.split(GATEWAY_ID).join(STOCK_GATEWAY_ID)).toBe(assembleClientBundle().split(GATEWAY_ID).join(STOCK_GATEWAY_ID));
  });

  test("A3 · lib/typert.host.js: 3 id ta / 0 id gốc · +15 B · chuẩn hoá ⇒ byte-identical", () => {
    assertOwnership(PAIR_TYPERT_HOST);
    const ours = readText(join(OURS_LIB, PAIR_TYPERT_HOST.file));
    expect(assembleTypert(join(PKG, "src", TYPERT_HOST_PARTS_DIR_NAME), TYPERT_HOST_PART_FILES)).toBe(ours);
  });

  test("A4 · lib/typert.remote-client.js: 2 id ta / 0 id gốc · +10 B · chuẩn hoá ⇒ byte-identical", () => {
    assertOwnership(PAIR_TYPERT_REMOTE);
    const ours = readText(join(OURS_LIB, PAIR_TYPERT_REMOTE.file));
    expect(assembleTypert(join(PKG, "src", TYPERT_REMOTE_PARTS_DIR_NAME), TYPERT_REMOTE_PART_FILES)).toBe(ours);
  });

  test("A5 · lib/client.js giữ ĐÚNG 6 id gốc là DỮ LIỆU (package: dòng 224 · typeSymbol: dòng 234 · 4 JSDoc 440/449/634/714) — CHỈ 2 dòng đổi id (2 loader · 9 require gateway)", () => {
    const ours = readText(join(OURS_LIB, PAIR_CLIENT.file));
    const stock = readText(join(STOCK_LIB, PAIR_CLIENT.file));
    const oursLines = ours.split("\n");
    const stockLines = stock.split("\n");
    // 1) Chỉ ĐÚNG HAI dòng khác bản gốc: dòng 2 (loader id) và dòng mang tên global brand của ta.
    //    20/10/2026: nửa client đổi `__DSH_REMOTE_ACCESS__` → `__GBH_REMOTE_ACCESS__` (sai lệch CÓ CHỦ ĐÍCH).
    expect(oursLines.length).toBe(stockLines.length);
    const chuanHoaDong = (line: string): string => line.split("__GBH_REMOTE_ACCESS__").join("__DSH_REMOTE_ACCESS__");
    const changed = oursLines
      .map((line, index) => (chuanHoaDong(line) === stockLines[index] ? 0 : index + 1))
      .filter(Boolean);
    // 20/10/2026 — rewrite CÓ CHỦ ĐÍCH: dòng 2 (id module) + dòng 9 (require gateway) mang id ta.
    expect(changed).toEqual([2, 9]);
    expect(oursLines[1]?.trim()).toBe('id: "' + OUR_ID + '",');
    expect(stockLines[1]?.trim()).toBe('id: "' + STOCK_ID + '",');
    // Dòng 9: chỉ id trong require đổi; quy id hai vế ⇒ bằng nhau (phần còn lại NGUYÊN VĂN).
    expect(oursLines[8]?.trim()).toBe('let _deepseek_ai_dsh_api_gateway_client = require("' + GATEWAY_ID + '/client");');
    expect(stockLines[8]?.trim()).toBe('let _deepseek_ai_dsh_api_gateway_client = require("' + STOCK_GATEWAY_ID + '/client");');
    expect(oursLines[8] ?? "").not.toContain(STOCK_GATEWAY_ID);
    // 20/10/2026: so phần còn lại SAU khi quy brand + quy id ở CẢ HAI VẾ (đối xứng, không nới phỏng đoán).
    expect(oursLines.slice(2).map(normalizeIdsInText).join("\n")).toBe(stockLines.slice(2).map(normalizeIdsInText).join("\n"));
    // 2) Sáu id gốc còn lại là DỮ LIỆU — đúng dòng, đúng chuỗi, KHÔNG được đổi tên.
    const data = [
      { line: 224, text: 'package: "' + STOCK_ID + '",' },
      { line: 234, text: 'typeSymbol: "' + STOCK_ID + '/types#RemoteAccessFrame",' },
      { line: 440, text: "* @module " + STOCK_ID + "/src/snapshot" },
      { line: 449, text: "* @module " + STOCK_ID + "/src/client/state" },
      { line: 634, text: "* @module " + STOCK_ID + "/src/client/mount" },
      { line: 714, text: "* @module " + STOCK_ID + "/client" },
    ];
    for (const entry of data) {
      expect(oursLines[entry.line - 1]?.trim()).toBe(entry.text);
      expect(stockLines[entry.line - 1]?.trim()).toBe(entry.text);
    }
    // 3) Đếm hai bên: ta 1 id ta + 6 id gốc; gốc 7 id gốc (dòng 2 + 6 dòng dữ liệu).
    expect(idCount(ours, OUR_ID)).toBe(1);
    expect(idCount(ours, GATEWAY_ID + "/client")).toBe(1);
    expect(idCount(ours, STOCK_ID)).toBe(6);
    expect(idCount(stock, STOCK_ID)).toBe(7);
    expect(oursLines.map((line, index) => (line.includes(STOCK_ID) ? index + 1 : 0)).filter(Boolean)).toEqual([224, 234, 440, 449, 634, 714]);
    expect(stockLines.map((line, index) => (line.includes(STOCK_ID) ? index + 1 : 0)).filter(Boolean)).toEqual([2, 224, 234, 440, 449, 634, 714]);
    expect(normalizeIdsInText(ours)).toBe(normalizeIdsInText(stock));
    // +18 B = 1 id module (+5) + 1 id gateway trong require (+13).
    expect(byteLength(ours) - byteLength(stock)).toBe(18);
  });
});

describe("B · bề mặt package.json: dsh.client · exports · gbh", () => {
  test("B1 · dsh.client KHỚP bản gốc (inject api-gateway + client-ui-renderer · external api-gateway/client · platform web)", () => {
    const ours = readPkg(join(PKG, "package.json"));
    const stock = readPkg(join(STOCK_PKG, "package.json"));
    expect(sameAfterIdMap(ours.dsh?.client, stock.dsh?.client)).toBe(true);
    // 20/10/2026 — inject/external của ta đã rewrite sang id GBH CÓ CHỦ ĐÍCH ⇒ so SAU bản đồ id với
    // ĐÚNG literal stock (giữ literal stock làm chuẩn, không sửa literal thành id ta).
    expect(sameAfterIdMap(ours.dsh?.client?.inject, ["@deepseek-ai/dsh-api-gateway", "@deepseek-ai/dsh-client-ui-renderer"])).toBe(true);
    expect(sameAfterIdMap(ours.dsh?.client?.external, ["@deepseek-ai/dsh-api-gateway/client"])).toBe(true);
    expect(ours.dsh?.client?.platform).toBe("web");
  });

  test("B2 · exports KHỚP bản gốc ở MỌI mục (7 khoá · KHÔNG có ./locale)", () => {
    const ours = readPkg(join(PKG, "package.json")).exports ?? {};
    const stock = readPkg(join(STOCK_PKG, "package.json")).exports ?? {};
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(Object.keys(ours).length).toBe(7);
    expect(Object.keys(ours)).not.toContain("./locale");
    expect(Object.keys(stock)).not.toContain("./locale");
    for (const key of Object.keys(stock)) expect(ours[key]).toEqual(stock[key]);
    expect(ours["."]).toEqual({ types: "./lib/types/index.d.ts", default: "./lib/index.js" });
    expect(ours["./types"]).toEqual({ types: "./lib/types/types.d.ts", default: "./lib/types/types.js" });
    expect(ours["./client"]).toEqual({ types: "./lib/types/client/index.d.ts", default: "./lib/client.js" });
    expect(ours["./typert"]).toEqual({ types: "./lib/typert.host.d.ts", default: "./lib/typert.host.js" });
    expect(ours["./remote"]).toEqual({ types: "./lib/typert.remote-client.d.ts", default: "./lib/typert.remote-client.js" });
    expect(ours["./package.json"]).toBe("./package.json");
    expect(ours["./src/*"]).toBe("./src/*");
  });

  test("B3 · row khai ĐÚNG MỘT khoá (gbh.row hoặc row_unmounted_ly_do) + id/aliases/moduleIds/tests = 'remote-access'", () => {
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
    expect(row?.id).toBe("remote-access");
    expect(row?.aliases).toEqual([STOCK_ID]);
    expect(row?.moduleIds).toEqual([OUR_ID]);
    expect(row?.tests).toEqual([LEGACY_TEST]);
    // 19/10/2026 — gói nay có THÊM bộ A/B cho 4 artefact; gbh.tests liệt kê CẢ HAI (bộ cũ giữ nguyên).
    expect(gbh.tests).toEqual([LEGACY_TEST, "tests/host/api-remote-access-halves.test.ts"]);
  });
});

describe("C · entry: src/client.ts + lib/client-entry.js · lib/index-entry.js", () => {
  test("C1 · src/client.ts CLIENT_LOADER_SHAPE mang ĐÚNG id ta + lib/client-entry.js (Bun.build) tồn tại", async () => {
    const source = await importModule(join(PKG, "src", "client.ts"));
    const shape = String(source["CLIENT_LOADER_SHAPE"]);
    expect(shape).toBe('window.__ModuleLoader__.load({ id: "' + OUR_ID + '", factory: (require) => {');
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
    expect(exportNames(built)).toEqual(["CLIENT_LOADER_SHAPE", "OUR_CLIENT_ID", "STOCK_CLIENT_ID", "assembleClientBundle", "readWrapper"]);
    expect(built["CLIENT_LOADER_SHAPE"]).toBe(shape);
    expect(built["OUR_CLIENT_ID"]).toBe(OUR_ID);
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
    expect(exportNames(host)).toEqual(["REMOTE_ACCESS_SNAPSHOT_KEY", "RemoteAccessService", "default"]);
    expect(exportNames(entry)).toEqual([...new Set([...exportNames(host), ...exportNames(client)])].sort());
    expect(exportNames(entry)).toEqual([
      "CLIENT_LOADER_SHAPE",
      "OUR_CLIENT_ID",
      "REMOTE_ACCESS_SNAPSHOT_KEY",
      "RemoteAccessService",
      "STOCK_CLIENT_ID",
      "assembleClientBundle",
      "default",
      "readWrapper",
    ]);
    expect(entry["OUR_CLIENT_ID"]).toBe(OUR_ID);
    expect(entry["STOCK_CLIENT_ID"]).toBe(STOCK_ID);
    const entryText = readText(entryPath);
    expect(entryText).toContain("RemoteAccessService");
    expect(entryText).toContain("CLIENT_LOADER_SHAPE");
  });
});

describe("D · typert: export A/B bằng await import() + serialize BigInt-safe + .d.ts", () => {
  test("D1 · lib/typert.host.js: danh sách export TRÙNG bản gốc (cả hai = ['TYPERT'] · package = id ta/id gốc)", async () => {
    await withTypertPair("typert.host.js", async (ours, stock) => {
      expect(exportNames(ours)).toEqual(exportNames(stock));
      expect(exportNames(ours)).toEqual(["TYPERT"]);
      expect(Object.keys(ours["TYPERT"] as ModuleShape).sort()).toEqual(Object.keys(stock["TYPERT"] as ModuleShape).sort());
      expect(Object.keys(ours["TYPERT"] as ModuleShape).sort()).toEqual(["face", "invocations", "model", "package", "schemas"]);
      expect((ours["TYPERT"] as ModuleShape)["package"]).toBe(OUR_ID);
      expect((stock["TYPERT"] as ModuleShape)["package"]).toBe(STOCK_ID);
    });
  });

  test("D2 · TYPERT host: serialize BigInt-safe rồi chuẩn hoá id ⇒ JSON TRÙNG gốc (3 id · +15 B)", async () => {
    await withTypertPair("typert.host.js", async (ours, stock) => {
      const oursJson = stableJson(ours["TYPERT"]);
      const stockJson = stableJson(stock["TYPERT"]);
      expect(oursJson).not.toBe(stockJson);
      expect(normalizeIdsInText(oursJson)).toBe(normalizeIdsInText(stockJson));
      const ids = idCount(oursJson, OUR_ID);
      expect(ids).toBe(3);
      expect(idCount(oursJson, STOCK_ID)).toBe(0);
      expect(byteLength(oursJson) - byteLength(stockJson)).toBe(15);
      expect(15).toBe(ids * (OUR_ID.length - STOCK_ID.length));
    });
  });

  test("D3 · TYPERT_REMOTE: default === TYPERT_REMOTE + serialize chuẩn hoá ⇒ JSON TRÙNG gốc (2 id · +10 B)", async () => {
    await withTypertPair("typert.remote-client.js", async (ours, stock) => {
      expect(exportNames(ours)).toEqual(exportNames(stock));
      expect(exportNames(ours)).toEqual(["TYPERT_REMOTE", "default"]);
      expect(ours["default"]).toBe(ours["TYPERT_REMOTE"]);
      expect(stock["default"]).toBe(stock["TYPERT_REMOTE"]);
      expect(Object.keys(ours["TYPERT_REMOTE"] as ModuleShape).sort()).toEqual(["index", "spec", "zod"]);
      expect((ours["TYPERT_REMOTE"] as ModuleShape)["package"]).toBe(OUR_ID);
      const oursJson = stableJson(ours["TYPERT_REMOTE"]);
      const stockJson = stableJson(stock["TYPERT_REMOTE"]);
      expect(oursJson).not.toBe(stockJson);
      expect(normalizeIdsInText(oursJson)).toBe(normalizeIdsInText(stockJson));
      const ids = idCount(oursJson, OUR_ID);
      expect(ids).toBe(2);
      expect(idCount(oursJson, STOCK_ID)).toBe(0);
      expect(byteLength(oursJson) - byteLength(stockJson)).toBe(10);
      expect(10).toBe(ids * (OUR_ID.length - STOCK_ID.length));
    });
  });

  test("D4 · lib/typert.host.d.ts + lib/typert.remote-client.d.ts CHÉP NGUYÊN từ gốc (so từng byte)", () => {
    const expected = [
      { file: "typert.host.d.ts", bytes: 123, sha16: "5e2d26ee86d0fe17" },
      { file: "typert.remote-client.d.ts", bytes: 984, sha16: "e000688376f5b4c9" },
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
  test("E1 · src-handwritten/ còn nguyên 7 tệp + KHÔNG được import từ build/artefact (chỉ tham chiếu)", () => {
    const dir = join(PKG, "src-handwritten");
    const expected = ["compare.ts", "follower.ts", "index.ts", "seams.ts", "service.ts", "snapshot.ts", "types.ts"];
    expect(existsSync(dir)).toBe(true);
    expect(readdirSync(dir).filter((name) => !name.startsWith(".")).sort()).toEqual(expected);
    for (const file of expected) expect(statSync(join(dir, file)).size).toBeGreaterThan(0);
    const buildFiles = [
      join(PKG, "build.ts"),
      ...listFiles(join(PKG, "src")).filter((file) => file.endsWith(".ts") || file.endsWith(".json")),
    ];
    for (const file of buildFiles) expect(readText(file)).not.toContain("src-handwritten");
    const artefactFiles = listFiles(OURS_LIB).filter((file) => file.endsWith(".js") || file.endsWith(".d.ts"));
    expect(artefactFiles.length).toBeGreaterThan(6);
    for (const file of artefactFiles) expect(readText(file)).not.toContain("src-handwritten");
  });
});
