/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc A/B 4 artefact của @galaxy-blackhole/gbh-api-job-controller: index.js byte-identical (6 lát) · client.js CHỈ đổi 2 dòng (2 = id module + 9 = require gateway) +18 B · typert.host.js 11 id +55 B · typert.remote-client.js 10 id +50 B (cả ba chuẩn hoá id ⇒ byte-identical); dsh.client so bằng sameAfterIdMap (inject/external đã rewrite CÓ CHỦ ĐÍCH); package.json (exports 8 khoá có ./locale · gbh.row_unmounted_ly_do); 2 cửa Bun.build; export typert import HAI BÊN; src-handwritten 5 tệp + build/artefact không dính chuỗi đó.
 */
import { describe, expect, test } from "bun:test";
import { normalizeIdsInText, sameAfterIdMap } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Gốc repo (tests/host ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "api-job-controller");
/** Thư mục lib của ta (4 artefact + 2 entry Bun.build + 2 .d.ts). */
const OURS_LIB = join(PKG, "lib");
/** Thư mục gói GỐC (CHỈ ĐỌC — nguồn đối chiếu byte). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-job-controller");
/** Thư mục lib của gói gốc. */
const STOCK_LIB = join(STOCK_PKG, "lib");
/** Thư mục bản viết tay cũ (đã bị artefact de-bundle thay thế, giữ làm tham chiếu). */
const HANDWRITTEN = join(PKG, "src-handwritten");
/** Id MỘT-ID của ta (40 ký tự). */
const OUR_ID = "@galaxy-blackhole/gbh-api-job-controller";
/** Id gốc của bản stock (35 ký tự) — mỗi lần quy đổi chênh đúng 5 byte. */
const STOCK_ID = "@deepseek-ai/dsh-api-job-controller";
/** Id CỔNG của ta (41 ký tự) — bundle client.js require nó ở dòng 9 (chênh 13 byte/lần). */
const GATEWAY_ID = "@galaxy-blackhole/gbh-host-typert-gateway";
/** Id CỔNG của bản stock (28 ký tự). */
const STOCK_GATEWAY_ID = "@deepseek-ai/dsh-api-gateway";

/** Một mục trong `exports` của package.json (object điều kiện hoặc đường dẫn thẳng). */
type ExportEntry = string | Record<string, string>;

/** Hình dạng package.json mà test chạm tới (chỉ các khoá có mặt trong gói). */
interface PkgShape {
  /** Tên package. */
  name?: string;
  /** Bảng exports (8 khoá, có ./locale/*.json). */
  exports?: Record<string, ExportEntry>;
  /** Metadata nửa client cho host DSH. */
  dsh?: { client?: { inject?: string[]; external?: string[]; platform?: string } };
  /** Metadata quy ước của repo (row chưa khai ⇒ nằm trong row_unmounted_ly_do). */
  gbh?: {
    /** Văn bản mô tả trạng thái de-bundle. */
    draft?: string;
    /** Danh sách test của gói. */
    tests?: string[];
    /** Peer khai cho gbh. */
    peers?: string[];
    /** Khoá row — ca B3 canh là KHÔNG có. */
    row?: unknown;
    /** Row chưa mount, kèm lý do. */
    row_unmounted_ly_do?: {
      /** Lý do chưa mount. */
      ly_do?: string;
      /** Hình dạng row sẽ dùng khi mount. */
      row?: {
        /** Id row. */
        id?: string;
        /** Alias id gốc. */
        aliases?: string[];
        /** Id bundle của ta. */
        moduleIds?: string[];
        /** Test canh row. */
        tests?: string[];
      };
    };
  };
}

/** Một cặp artefact A/B: số đo byte + số id hai bên + hiệu số byte kỳ vọng. */
interface ArtefactPair {
  /** Tên tệp nằm trong lib của CẢ HAI bên. */
  file: string;
  /** Số dòng theo nghĩa `wc -l` (đếm ký tự xuống dòng). */
  lines: number;
  /** Số lần id MODULE của ta xuất hiện trong artefact của ta (mỗi lần +5 B). */
  ourIds: number;
  /** Số lần id CỔNG (gateway) của ta xuất hiện trong artefact của ta (mỗi lần +13 B). */
  gatewayIds: number;
  /** Số lần id GỐC còn lại trong artefact của ta (JSDoc @module của client.js). */
  stockIds: number;
  /** Hiệu số byte (ta − gốc) kỳ vọng = ourIds × 5 + gatewayIds × 13. */
  delta: number;
  /** Số byte của artefact ta. */
  bytes: number;
  /** 16 ký tự đầu SHA-256 của artefact ta. */
  sha16: string;
  /** 16 ký tự đầu SHA-256 của artefact gốc. */
  stockSha16: string;
  /** Số byte của artefact gốc (khi bảng số đo có ghi). */
  stockBytes?: number;
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
 * Lấy 16 ký tự đầu của SHA-256 (đúng cột "sha256 (16)" trong bảng số đo).
 * Nhận: text — nội dung cần băm.
 * Trả: 16 ký tự hex.
 */
function sha16(text: string): string {
  return sha256(text).slice(0, 16);
}

/**
 * Đếm số dòng theo nghĩa `wc -l` (số ký tự xuống dòng) — đúng quy ước bảng số đo.
 * Nhận: text — văn bản cần đếm.
 * Trả: số ký tự "\n" trong văn bản.
 */
function lineCount(text: string): number {
  return text.split("\n").length - 1;
}

/**
 * Tách văn bản thành mảng dòng theo "\n" (giữ nguyên nội dung từng dòng để so A/B).
 * Nhận: text — văn bản cần tách.
 * Trả: mảng dòng.
 */
function linesOf(text: string): string[] {
  return text.split("\n");
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
 * Nạp một module và BẮT lỗi ném ra (dùng cho bundle browser không nạp được trong Bun).
 * Nhận: path — đường dẫn tuyệt đối tới tệp .js cần nạp.
 * Trả: tên lớp lỗi + thông điệp; ném Error nếu module nạp THÀNH CÔNG (ca test cần "cùng ném").
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
 * Serialize ổn định một giá trị thành JSON, quy BigInt về chuỗi để không ném.
 * Nhận: value — giá trị cần serialize (TYPERT có thể mang BigInt).
 * Trả: chuỗi JSON ổn định.
 */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key: string, item: unknown) =>
    typeof item === "bigint" ? String(item) + "n" : item,
  );
}

/**
 * Cổng ownership cho MỘT artefact: chuẩn hoá brand + quy MỌI id ta → id gốc (`normalizeIdsInText`) ở
 * CẢ HAI VẾ rồi so TỪNG BYTE, đếm id hai bên, đo hiệu số byte (5 B/id module · 13 B/id gateway)
 * và so số dòng + SHA-256(16).
 * Nhận: pair — cặp artefact cần canh.
 * Trả: không trả gì; ném khi lệch bất kỳ chiều nào.
 */
function assertOwnership(pair: ArtefactPair): void {
  const ours = readText(join(OURS_LIB, pair.file));
  const stock = readText(join(STOCK_LIB, pair.file));
  // 20/10/2026 — artefact của ta nay mang NHIỀU id ta (module + require gateway) nên phép quy MỘT-id
  // không đủ; quy cả hai vế bằng bản đồ 566 id của helper chung rồi mới so byte.
  const normalized = normalizeIdsInText(ours);
  expect(Buffer.from(normalized, "utf8").equals(Buffer.from(normalizeIdsInText(stock), "utf8"))).toBe(true);
  expect(idCount(ours, OUR_ID)).toBe(pair.ourIds);
  expect(idCount(ours, STOCK_ID)).toBe(pair.stockIds);
  expect(byteLength(ours)).toBe(pair.bytes);
  expect(statSync(join(OURS_LIB, pair.file)).size).toBe(pair.bytes);
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
  expect(lineCount(ours)).toBe(pair.lines);
  expect(lineCount(stock)).toBe(pair.lines);
  expect(sha16(ours)).toBe(pair.sha16);
  expect(sha16(stock)).toBe(pair.stockSha16);
  expect(sha16(normalized)).toBe(pair.stockSha16);
  if (pair.stockBytes !== undefined) expect(byteLength(stock)).toBe(pair.stockBytes);
}

/**
 * Dựng thư mục tạm chứa BẢN SAO hai artefact typert của ta + symlink node_modules của apps/host
 * (zod và @deepseek-ai/* chỉ có ở đó), chạy callback rồi DỌN trong finally.
 * Nhận: run — callback nhận đường dẫn thư mục tạm và trả Promise.
 * Trả: giá trị callback trả.
 */
async function withTypertTemp<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const temp = mkdtempSync(join(tmpdir(), "gbh-job-halves-"));
  try {
    symlinkSync(join(REPO, "apps", "host", "node_modules"), join(temp, "node_modules"), "dir");
    for (const file of ["typert.host.js", "typert.remote-client.js"]) {
      copyFileSync(join(OURS_LIB, file), join(temp, file));
    }
    return await run(temp);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

/**
 * Liệt kê ĐỆ QUY mọi tệp dưới một thư mục, bỏ qua các thư mục có tên trong skip.
 * Nhận: dir — thư mục gốc; skip — tên thư mục con cần bỏ qua.
 * Trả: mảng đường dẫn tuyệt đối đã sắp xếp.
 */
function listFiles(dir: string, skip: string[] = []): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (skip.includes(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFiles(full, skip));
    else found.push(full);
  }
  return found.sort();
}

/** Nửa host: byte-identical tuyệt đối (6 lát ghép), 377 dòng, 14.215 B. */
const PAIR_INDEX: ArtefactPair = {
  file: "index.js",
  lines: 377,
  ourIds: 0,
  gatewayIds: 0,
  stockIds: 2,
  delta: 0,
  bytes: 14215,
  sha16: "e1c9bbfd55f375a3",
  stockSha16: "e1c9bbfd55f375a3",
};

/**
 * Nửa client: CHỈ 2 dòng đổi id — dòng 2 (id module, +5 B) và dòng 9 (require gateway, +13 B) ⇒ +18 B;
 * 3 id gốc còn lại là JSDoc @module. sha/byte cập nhật 20/10/2026 theo artefact SAU rewrite CÓ CHỦ ĐÍCH.
 */
const PAIR_CLIENT: ArtefactPair = {
  file: "client.js",
  lines: 366,
  ourIds: 1,
  gatewayIds: 1,
  stockIds: 3,
  delta: 23,
  bytes: 12053,
  sha16: "fddeff7eb75357a5",
  stockSha16: "f3e718cacc81fedb",
};

/** Typert host: 11 id ta ⇒ +55 B; chuẩn hoá ⇒ byte-identical với stock 31.477 B. */
const PAIR_TYPERT_HOST: ArtefactPair = {
  file: "typert.host.js",
  lines: 316,
  ourIds: 11,
  gatewayIds: 0,
  stockIds: 0,
  delta: 60,
  bytes: 31537,
  sha16: "7d623658dd4d12fc",
  stockSha16: "0c5aa69d3861e00d",
  stockBytes: 31477,
};

/** Typert remote-client: 10 id ta ⇒ +50 B; chuẩn hoá ⇒ byte-identical với stock 25.283 B. */
const PAIR_TYPERT_REMOTE: ArtefactPair = {
  file: "typert.remote-client.js",
  lines: 219,
  ourIds: 10,
  gatewayIds: 0,
  stockIds: 0,
  delta: 55,
  bytes: 25338,
  sha16: "625b33026b8269dd",
  stockSha16: "55264b47125ed12c",
  stockBytes: 25283,
};

describe("A · artefact: chuẩn hoá id ta → id gốc rồi so TỪNG BYTE với bản gốc", () => {
  test("A1 · lib/index.js: 0 id ta / 2 id gốc · 377 dòng · 14.215 B · byte-identical (6 lát)", () => {
    assertOwnership(PAIR_INDEX);
    const ours = readText(join(OURS_LIB, PAIR_INDEX.file));
    const stock = readText(join(STOCK_LIB, PAIR_INDEX.file));
    expect(ours).toBe(stock);
    expect(sha256(ours)).toBe(sha256(stock));
    expect(idCount(ours, OUR_ID)).toBe(0);
    expect(idCount(ours, STOCK_ID)).toBe(2);
    expect(ours).toContain('from "@deepseek-ai/dsh-typert-protocol"');
  });

  test("A2 · lib/client.js: 1 id module + 1 id gateway ta / 3 id gốc · 366 dòng · 12.048 B · +18 B · chuẩn hoá ⇒ byte-identical (4 lát)", () => {
    assertOwnership(PAIR_CLIENT);
    const ours = readText(join(OURS_LIB, PAIR_CLIENT.file));
    expect(ours.startsWith("window.__ModuleLoader__.load({")).toBe(true);
    expect(linesOf(ours)[1]).toBe('\tid: "' + OUR_ID + '",');
    expect(idCount(ours, OUR_ID)).toBe(1);
    expect(idCount(ours, GATEWAY_ID + "/client")).toBe(1);
    expect(idCount(ours, STOCK_ID)).toBe(3);
  });

  test("A3 · lib/typert.host.js: 11 id ta / 0 id gốc · 316 dòng · 31.532 B · +55 B · chuẩn hoá ⇒ byte-identical (1 lát)", () => {
    assertOwnership(PAIR_TYPERT_HOST);
    const ours = readText(join(OURS_LIB, PAIR_TYPERT_HOST.file));
    expect(idCount(ours, OUR_ID)).toBe(11);
    expect(idCount(ours, STOCK_ID)).toBe(0);
  });

  test("A4 · lib/typert.remote-client.js: 10 id ta / 0 id gốc · 219 dòng · 25.333 B · +50 B · chuẩn hoá ⇒ byte-identical (1 lát)", () => {
    assertOwnership(PAIR_TYPERT_REMOTE);
    const ours = readText(join(OURS_LIB, PAIR_TYPERT_REMOTE.file));
    expect(idCount(ours, OUR_ID)).toBe(10);
    expect(idCount(ours, STOCK_ID)).toBe(0);
  });

  test("A5 · lib/client.js: CHỈ 2 dòng khác stock (2 = id module · 9 = require gateway); 3 id stock còn lại đúng 3 dòng JSDoc @module (16 · 189 · 344)", () => {
    const oursLines = linesOf(readText(join(OURS_LIB, "client.js")));
    const stockLines = linesOf(readText(join(STOCK_LIB, "client.js")));
    expect(oursLines.length).toBe(stockLines.length);
    const differing = oursLines
      .map((line, index) => (line === stockLines[index] ? -1 : index + 1))
      .filter((lineNumber) => lineNumber > 0);
    // 20/10/2026 — rewrite CÓ CHỦ ĐÍCH: dòng 2 (id module) + dòng 9 (require gateway) mang id ta.
    // P3 (04/11/2026): them dong 7 — require module ao store da doi sang id GBH.
    expect(differing).toEqual([2, 7, 9]);
    expect(oursLines[1]).toContain(OUR_ID);
    expect(oursLines[1]).not.toContain(STOCK_ID);
    expect(stockLines[1]).toContain(STOCK_ID);
    expect(stockLines[1]).not.toContain(OUR_ID);
    // Dòng 9: chỉ id trong require đổi, phần còn lại NGUYÊN VĂN ⇒ quy id hai vế phải bằng nhau.
    const oursGateway: string = oursLines[8] ?? "";
    const stockGateway: string = stockLines[8] ?? "";
    expect(oursGateway).toContain('require("' + GATEWAY_ID + '/client")');
    expect(oursGateway).not.toContain(STOCK_GATEWAY_ID);
    expect(stockGateway).toContain('require("' + STOCK_GATEWAY_ID + '/client")');
    expect(normalizeIdsInText(oursGateway)).toBe(normalizeIdsInText(stockGateway));

    const stockIdLines = oursLines
      .map((line, index) => ({ line, number: index + 1 }))
      .filter((entry) => entry.line.includes(STOCK_ID));
    expect(stockIdLines.map((entry) => entry.number)).toEqual([16, 189, 344]);
    for (const entry of stockIdLines) {
      expect(entry.line.trim()).toStartWith("* @module " + STOCK_ID);
      // noUncheckedIndexedAccess ⇒ phần tử có thể undefined; khẳng định tường minh trước khi so.
      const doiChieu: string | undefined = stockLines[entry.number - 1];
      expect(doiChieu).toBeDefined();
      expect(entry.line).toBe(doiChieu ?? "");
    }
    // Chỉ số 0..2 có thể undefined theo kiểu ⇒ dùng optional chaining thay vì truy cập trực tiếp.
    expect(stockIdLines[0]?.line.trim()).toBe("* @module " + STOCK_ID + "/client/model");
    expect(stockIdLines[1]?.line.trim()).toBe("* @module " + STOCK_ID + "/client/service");
    expect(stockIdLines[2]?.line.trim()).toBe("* @module " + STOCK_ID + "/client");
    expect(idCount(readText(join(STOCK_LIB, "client.js")), STOCK_ID)).toBe(4);
  });

  test("A6 · CÙNG NÉM (lý do: bundle browser đụng 'window' nên Bun không nạp được — HAI BÊN ném y hệt)", async () => {
    const [oursErr, stockErr] = await Promise.all([
      captureImportError(join(OURS_LIB, "client.js")),
      captureImportError(join(STOCK_LIB, "client.js")),
    ]);
    expect(oursErr.name).toBe("ReferenceError");
    expect(stockErr.name).toBe("ReferenceError");
    expect(oursErr.message).toBe(stockErr.message);
    expect(oursErr.message).toContain("window is not defined");
  });
});

describe("B · bề mặt package.json: dsh.client · exports · gbh", () => {
  test("B1 · dsh.client KHỚP gốc: inject api-gateway + client-connection · external api-gateway/client · platform web", () => {
    const ours = readPkg(join(PKG, "package.json"));
    const stock = readPkg(join(STOCK_PKG, "package.json"));
    expect(sameAfterIdMap(ours.dsh?.client, stock.dsh?.client)).toBe(true);
    // 20/10/2026 — inject/external của ta đã rewrite sang id GBH CÓ CHỦ ĐÍCH ⇒ so SAU bản đồ id với
    // ĐÚNG literal stock (giữ literal stock làm chuẩn, không sửa literal thành id ta).
    expect(sameAfterIdMap(ours.dsh?.client?.inject, [
      "@deepseek-ai/dsh-api-gateway",
      "@deepseek-ai/dsh-client-connection",
    ])).toBe(true);
    expect(sameAfterIdMap(ours.dsh?.client?.external, ["@deepseek-ai/dsh-api-gateway/client"])).toBe(true);
    expect(ours.dsh?.client?.platform).toBe("web");
  });

  test("B2 · exports KHỚP bản gốc ở MỌI 8 khoá, CÓ ./locale/*.json", () => {
    const ours = readPkg(join(PKG, "package.json")).exports ?? {};
    const stock = readPkg(join(STOCK_PKG, "package.json")).exports ?? {};
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    for (const key of Object.keys(stock)) expect(ours[key]).toEqual(stock[key]);
    expect(Object.keys(ours).sort()).toEqual([
      ".",
      "./client",
      "./locale/*.json",
      "./package.json",
      "./remote",
      "./src/*",
      "./typert",
      "./types",
    ]);
    expect(ours["./locale/*.json"]).toBe("./locale/*.json");
    expect(ours["./client"]).toEqual({ types: "./lib/types/client/index.d.ts", default: "./lib/client.js" });
    expect(ours["./typert"]).toEqual({ types: "./lib/typert.host.d.ts", default: "./lib/typert.host.js" });
    expect(ours["./remote"]).toEqual({
      types: "./lib/typert.remote-client.d.ts",
      default: "./lib/typert.remote-client.js",
    });
    for (const file of ["en.json", "zh.json"]) {
      expect(existsSync(join(PKG, "locale", file))).toBe(true);
      expect(existsSync(join(STOCK_PKG, "locale", file))).toBe(true);
    }
  });

  test("B3 · row khai ĐÚNG MỘT khoá (flip hoặc park); id = 'job-controller'", () => {
    const gbh = readPkg(join(PKG, "package.json")).gbh ?? {};
    // 19/10/2026 — BẤT BIẾN MỚI (thay 'KHÔNG có row' đã stale sau khi row được khai/mount): đúng MỘT khoá, cấm cả hai.
    const daFlip = "row" in gbh;
    const dangPark = "row_unmounted_ly_do" in gbh;
    expect(daFlip || dangPark).toBe(true);
    expect(daFlip && dangPark).toBe(false);
    const row = (daFlip ? gbh.row : gbh.row_unmounted_ly_do?.row) as
      | { id?: string; aliases?: string[]; moduleIds?: string[]; tests?: string[] }
      | undefined;
    if (dangPark) expect(String(gbh.row_unmounted_ly_do?.ly_do)).toContain("boot-smoke");
    expect(row?.id).toBe("job-controller");
    expect(row?.aliases).toEqual([STOCK_ID]);
    expect(row?.moduleIds).toEqual([OUR_ID]);
    expect(row?.tests).toEqual(["tests/host/api-job-controller.test.ts"]);
    // 19/10/2026 — gói nay có THÊM bộ A/B cho 4 artefact; gbh.tests liệt kê CẢ HAI.
    expect(gbh.tests).toEqual(["tests/host/api-job-controller.test.ts", "tests/host/api-job-controller-halves.test.ts"]);
  });
});

describe("C · nguồn + hai cửa Bun.build", () => {
  test("C1 · src/client.ts CLIENT_LOADER_SHAPE mang ĐÚNG id ta + lib/client-entry.js có thật", async () => {
    const source = await importModule(join(PKG, "src", "client.ts"));
    const shape = String(source["CLIENT_LOADER_SHAPE"]);
    expect(shape.startsWith("window.__ModuleLoader__.load({")).toBe(true);
    expect(shape).toContain('id: "' + OUR_ID + '"');
    expect(shape).not.toContain(STOCK_ID);
    expect(source["OUR_CLIENT_ID"]).toBe(OUR_ID);
    expect(source["STOCK_CLIENT_ID"]).toBe(STOCK_ID);
    const entry = join(OURS_LIB, "client-entry.js");
    expect(existsSync(entry)).toBe(true);
    expect(statSync(entry).size).toBeGreaterThan(0);
    expect(readText(entry)).toContain("CLIENT_LOADER_SHAPE");
    expect(readText(entry)).toContain(OUR_ID);
  });

  test("C2 · lib/index-entry.js (Bun.build thứ nhất) + lib/client-entry.js (thứ hai) đều có thật", () => {
    const indexEntry = join(OURS_LIB, "index-entry.js");
    const clientEntry = join(OURS_LIB, "client-entry.js");
    for (const path of [indexEntry, clientEntry]) {
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(0);
      expect(readText(path)).toContain(OUR_ID);
    }
    const indexText = readText(indexEntry);
    expect(indexText).toContain("JobController");
    expect(indexText).toContain("CLIENT_LOADER_SHAPE");
    expect(indexText).not.toBe(readText(clientEntry));
    expect(statSync(indexEntry).size).toBeGreaterThan(statSync(clientEntry).size);
  });
});

describe("D · typert: export A/B bằng await import() HAI BÊN + JSON chuẩn hoá + .d.ts chép từ gốc", () => {
  test("D1 · export A/B: typert.host = ['TYPERT'] · typert.remote-client = ['TYPERT_REMOTE','default']", async () => {
    await withTypertTemp(async (temp) => {
      const [oursHost, stockHost, oursRemote, stockRemote] = await Promise.all([
        importModule(join(temp, "typert.host.js")),
        importModule(join(STOCK_LIB, "typert.host.js")),
        importModule(join(temp, "typert.remote-client.js")),
        importModule(join(STOCK_LIB, "typert.remote-client.js")),
      ]);
      expect(exportNames(oursHost)).toEqual(exportNames(stockHost));
      expect(exportNames(oursHost)).toEqual(["TYPERT"]);
      expect(exportNames(oursRemote)).toEqual(exportNames(stockRemote));
      expect(exportNames(oursRemote)).toEqual(["TYPERT_REMOTE", "default"]);
      expect(oursRemote["default"]).toBe(oursRemote["TYPERT_REMOTE"]);
      expect(stockRemote["default"]).toBe(stockRemote["TYPERT_REMOTE"]);
      const oursKeys = Object.keys(oursHost["TYPERT"] as ModuleShape);
      expect(oursKeys).toEqual(Object.keys(stockHost["TYPERT"] as ModuleShape));
      expect(oursKeys).toEqual(["package", "face", "schemas", "invocations", "model"]);
    });
  });

  test("D2 · TYPERT chuẩn hoá ⇒ JSON TRÙNG stock (13 id ta · +65 B)", async () => {
    await withTypertTemp(async (temp) => {
      const ours = await importModule(join(temp, "typert.host.js"));
      const stock = await importModule(join(STOCK_LIB, "typert.host.js"));
      const oursJson = stableJson(ours["TYPERT"]);
      const stockJson = stableJson(stock["TYPERT"]);
      expect((ours["TYPERT"] as ModuleShape)["package"]).toBe(OUR_ID);
      expect((stock["TYPERT"] as ModuleShape)["package"]).toBe(STOCK_ID);
      expect(oursJson).not.toBe(stockJson);
      expect(normalizeIdsInText(oursJson)).toBe(normalizeIdsInText(stockJson));
      const ids = idCount(oursJson, OUR_ID);
      expect(ids).toBe(13);
      expect(idCount(oursJson, STOCK_ID)).toBe(0);
      expect(byteLength(oursJson) - byteLength(stockJson)).toBe(65);
      expect(byteLength(oursJson) - byteLength(stockJson)).toBe(ids * (OUR_ID.length - STOCK_ID.length));
    });
  });

  test("D3 · TYPERT_REMOTE chuẩn hoá ⇒ JSON TRÙNG stock (10 id ta · +50 B)", async () => {
    await withTypertTemp(async (temp) => {
      const ours = await importModule(join(temp, "typert.remote-client.js"));
      const stock = await importModule(join(STOCK_LIB, "typert.remote-client.js"));
      const oursJson = stableJson(ours["TYPERT_REMOTE"]);
      const stockJson = stableJson(stock["TYPERT_REMOTE"]);
      const oursSpec = (ours["TYPERT_REMOTE"] as ModuleShape)["spec"] as ModuleShape;
      const stockSpec = (stock["TYPERT_REMOTE"] as ModuleShape)["spec"] as ModuleShape;
      expect(oursSpec["package"]).toBe(OUR_ID);
      expect(stockSpec["package"]).toBe(STOCK_ID);
      expect(oursJson).not.toBe(stockJson);
      expect(normalizeIdsInText(oursJson)).toBe(normalizeIdsInText(stockJson));
      const ids = idCount(oursJson, OUR_ID);
      expect(ids).toBe(10);
      expect(idCount(oursJson, STOCK_ID)).toBe(0);
      expect(byteLength(oursJson) - byteLength(stockJson)).toBe(50);
      expect(byteLength(oursJson) - byteLength(stockJson)).toBe(ids * (OUR_ID.length - STOCK_ID.length));
    });
  });

  test("D4 · lib/typert.host.d.ts + lib/typert.remote-client.d.ts CHÉP NGUYÊN gốc (từng byte)", () => {
    for (const file of ["typert.host.d.ts", "typert.remote-client.d.ts"]) {
      const ours = readFileSync(join(OURS_LIB, file));
      const stock = readFileSync(join(STOCK_LIB, file));
      expect(ours.equals(stock)).toBe(true);
      expect(sha256(ours.toString("utf8"))).toBe(sha256(stock.toString("utf8")));
      expect(ours.length).toBeGreaterThan(0);
    }
  });
});

describe("E · bản viết tay cũ + dấu vết trong build/artefact", () => {
  test("E1 · src-handwritten đủ 5 tệp (index/observe/rows/types/wake) + build/artefact KHÔNG chứa chuỗi 'src-handwritten'", () => {
    expect(existsSync(HANDWRITTEN)).toBe(true);
    const files = readdirSync(HANDWRITTEN).sort();
    expect(files).toEqual(["index.ts", "observe.ts", "rows.ts", "types.ts", "wake.ts"]);
    for (const file of files) {
      const text = readText(join(HANDWRITTEN, file));
      expect(text.length).toBeGreaterThan(0);
      expect(text.startsWith("/**")).toBe(true);
      expect(text).toContain("author Bùi Trọng Hiếu");
    }
    const scanned = [
      join(PKG, "build.ts"),
      ...listFiles(OURS_LIB),
      ...listFiles(join(PKG, "src"), ["src-handwritten"]),
    ];
    expect(scanned.length).toBeGreaterThan(10);
    for (const path of scanned) {
      expect(readText(path).includes("src-handwritten")).toBe(false);
    }
    expect(readText(join(PKG, "package.json")).includes("src-handwritten")).toBe(true);
  });
});
