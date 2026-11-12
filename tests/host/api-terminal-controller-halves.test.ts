/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc A/B 3 artefact MỚI (client 2 dòng id: loader + require gateway ⇒ +18B · typert.host +115B · typert.remote +110B) so bản gốc; dsh.client so bằng sameAfterIdMap; package.json; 2 cửa Bun.build; export typert import HAI BÊN
 */
import { afterAll, describe, expect, test } from "bun:test";
import { normalizeIdsInText, sameAfterIdMap } from "../lib/brand-parity.ts";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** Gốc repo (tests/host ⇒ ../..). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "api-terminal-controller");
/** Thư mục lib của ta (4 artefact + 2 entry Bun.build + 2 .d.ts). */
const OURS_LIB = join(PKG, "lib");
/** Thư mục gói GỐC (CHỈ ĐỌC — nguồn đối chiếu byte). */
const STOCK_PKG = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-api-terminal-controller");
/** Thư mục lib của gói gốc. */
const STOCK_LIB = join(STOCK_PKG, "lib");
/** Id MỘT-ID của ta (45 ký tự). */
const OUR_ID = "@galaxy-blackhole/gbh-api-terminal-controller";
/** Id gốc của bản stock (40 ký tự) — chênh 5 byte mỗi lần quy đổi. */
const STOCK_ID = "@deepseek-ai/dsh-api-terminal-controller";
/** Id CỔNG của ta (41 ký tự) — bundle client.js require nó (chênh 13 byte/lần). */
const GATEWAY_ID = "@galaxy-blackhole/gbh-host-typert-gateway";
/** Id CỔNG của bản stock (28 ký tự). */
const STOCK_GATEWAY_ID = "@deepseek-ai/dsh-api-gateway";

// NẠP ĐƯỢC (không chỉ đọc byte): bản lib copy sang thư mục tạm, peer trỏ về KERNEL (pattern
// tests/host/shell.test.ts). typert.*.js import `zod` + `@deepseek-ai/dsh-typert-protocol`: để chúng phân
// giải từ node_modules của workspace thì cấu trúc serialize là của zod 4.6.7, còn oracle là zod 4.4.3 của
// kernel ⇒ JSON lệch (ca D3/D4). Trạng thái node_modules của gói KHÔNG được là một phần của "test xanh".
const RUNTIME_DIR = mkdtempSync(join(tmpdir(), "gbh-api-terminal-runtime-"));
mkdirSync(join(RUNTIME_DIR, "node_modules"), { recursive: true });
for (const shared of ["@deepseek-ai", "zod"]) {
  symlinkSync(
    join(REPO, "apps", "host", "node_modules", shared),
    join(RUNTIME_DIR, "node_modules", shared),
    "dir",
  );
}
for (const artifact of readdirSync(OURS_LIB)) {
  if (artifact.endsWith(".js")) copyFileSync(join(OURS_LIB, artifact), join(RUNTIME_DIR, artifact));
}
/** Thư mục lib NẠP ĐƯỢC của ta (cùng byte với lib/, peer = kernel). */
const OUR_RUNTIME_LIB = RUNTIME_DIR;

/** Dọn thư mục nạp tạm. Nhận: không. Trả: không. */
afterAll(() => {
  rmSync(RUNTIME_DIR, { recursive: true, force: true });
});

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

/** Một cặp artefact A/B: tên tệp trong lib + số id ta kỳ vọng + hiệu số byte kỳ vọng. */
interface ArtefactPair {
  /** Tên tệp nằm trong lib của CẢ HAI bên. */
  file: string;
  /** Số lần id MODULE của ta xuất hiện trong artefact của ta (+5 B mỗi lần). */
  ourIds: number;
  /** Số lần id CỔNG (gateway) của ta xuất hiện trong artefact của ta (+13 B mỗi lần). */
  gatewayIds: number;
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
 * Danh sách tên export của một module ESM, đã sắp xếp để so A/B không phụ thuộc thứ tự.
 * Nhận: mod — bề mặt module (kết quả `await import()`).
 * Trả: mảng tên export đã sắp xếp.
 */
function exportNames(mod: ModuleShape): string[] {
  return Object.keys(mod).sort();
}

/**
 * Nạp một module ESM bằng `await import()`.
 * Nhận: path — đường dẫn tuyệt đối tới tệp .js cần nạp.
 * Trả: bề mặt module.
 */
async function importModule(path: string): Promise<ModuleShape> {
  return (await import(path)) as ModuleShape;
}

/**
 * Nạp một module và BẮT lỗi ném ra (dùng cho artefact browser không nạp được trong Bun).
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
 * Nhận: value — giá trị cần serialize (TYPERT của typert.remote-client có BigInt).
 * Trả: chuỗi JSON ổn định.
 */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key: string, item: unknown) => (typeof item === "bigint" ? String(item) + "n" : item));
}

/**
 * Cổng ownership cho MỘT artefact: chuẩn hoá brand + quy MỌI id ta → id gốc (`normalizeIdsInText`) ở
 * CẢ HAI VẾ rồi so TỪNG BYTE, đếm id hai bên và đo hiệu số byte (5 B/id module · 13 B/id gateway).
 * Nhận: pair — cặp artefact cần canh (tên tệp + số id + hiệu byte kỳ vọng).
 * Trả: không trả gì; ném khi lệch bất kỳ chiều nào.
 */
function assertOwnership(pair: ArtefactPair): void {
  const ours = readText(join(OURS_LIB, pair.file));
  const stock = readText(join(STOCK_LIB, pair.file));
  // 20/10/2026 — nửa client nay mang NHIỀU id ta (module + require gateway) ⇒ phép quy MỘT-id không đủ.
  const normalized = normalizeIdsInText(ours);
  expect(Buffer.from(normalized, "utf8").equals(Buffer.from(normalizeIdsInText(stock), "utf8"))).toBe(true);
  expect(idCount(ours, OUR_ID)).toBe(pair.ourIds);
  expect(idCount(ours, GATEWAY_ID + "/client")).toBe(pair.gatewayIds);
  expect(idCount(ours, STOCK_ID)).toBe(0);
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
  expect(sha256(normalized)).toBe(sha256(normalizeIdsInText(stock)));
}

/** Cặp artefact nửa client: 1 id module + 1 id gateway (require), +18 byte. */
// P3 (04/11/2026): client.js mang them id MOI cua module ao store (+5 byte).
const PAIR_CLIENT: ArtefactPair = { file: "client.js", ourIds: 1, gatewayIds: 1, delta: 23 };
/** Cặp artefact typert host: 23 id ta, +115 byte. */
const PAIR_TYPERT_HOST: ArtefactPair = { file: "typert.host.js", ourIds: 23, gatewayIds: 0, delta: 120 };
/** Cặp artefact typert remote: 22 id ta, +110 byte. */
const PAIR_TYPERT_REMOTE: ArtefactPair = { file: "typert.remote-client.js", ourIds: 22, gatewayIds: 0, delta: 115 };

describe("A · artefact: chuẩn hoá id ta → id gốc rồi so TỪNG BYTE với bản gốc", () => {
  test("A1 · lib/client.js: 1 id module + 1 id gateway ta / 0 id gốc · +18 byte · chuẩn hoá ⇒ byte-identical", () => {
    assertOwnership(PAIR_CLIENT);
    const ours = readText(join(OURS_LIB, PAIR_CLIENT.file));
    expect(ours.includes('id: "' + OUR_ID + '"')).toBe(true);
    expect(ours.startsWith("window.__ModuleLoader__.load({")).toBe(true);
  });

  test("A2 · lib/typert.host.js: 23 id ta / 0 id gốc · +115 byte · chuẩn hoá ⇒ byte-identical", () => {
    assertOwnership(PAIR_TYPERT_HOST);
    expect(statSync(join(OURS_LIB, PAIR_TYPERT_HOST.file)).size).toBe(90251);
  });

  test("A3 · lib/typert.remote-client.js: 22 id ta / 0 id gốc · +110 byte · chuẩn hoá ⇒ byte-identical", () => {
    assertOwnership(PAIR_TYPERT_REMOTE);
    expect(statSync(join(OURS_LIB, PAIR_TYPERT_REMOTE.file)).size).toBe(37608);
  });

  test("A4 · CÙNG NÉM: nạp lib/client.js (bundle browser) ⇒ HAI BÊN ném y hệt nhau", async () => {
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
  test("B1 · dsh.client KHỚP bản gốc (inject · external · platform)", () => {
    const ours = readPkg(join(PKG, "package.json"));
    const stock = readPkg(join(STOCK_PKG, "package.json"));
    expect(sameAfterIdMap(ours.dsh?.client, stock.dsh?.client)).toBe(true);
    // 20/10/2026 — inject/external của ta đã rewrite sang id GBH CÓ CHỦ ĐÍCH ⇒ so SAU bản đồ id với
    // ĐÚNG literal stock (giữ literal stock làm chuẩn, không sửa literal thành id ta).
    expect(sameAfterIdMap(ours.dsh?.client?.inject, ["@deepseek-ai/dsh-api-gateway"])).toBe(true);
    expect(sameAfterIdMap(ours.dsh?.client?.external, ["@deepseek-ai/dsh-api-gateway/client"])).toBe(true);
    expect(ours.dsh?.client?.platform).toBe("web");
  });

  test("B2 · exports KHỚP bản gốc ở MỌI mục", () => {
    const ours = readPkg(join(PKG, "package.json")).exports ?? {};
    const stock = readPkg(join(STOCK_PKG, "package.json")).exports ?? {};
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    for (const key of Object.keys(stock)) expect(ours[key]).toEqual(stock[key]);
    expect(Object.keys(ours).length).toBe(8);
    expect(ours["./client"]).toEqual({ types: "./lib/types/client/index.d.ts", default: "./lib/client.js" });
    expect(ours["./typert"]).toEqual({ types: "./lib/typert.host.d.ts", default: "./lib/typert.host.js" });
    expect(ours["./remote"]).toEqual({ types: "./lib/typert.remote-client.d.ts", default: "./lib/typert.remote-client.js" });
  });

  test("B3 · row khai ĐÚNG MỘT khoá (flip hoặc park) + id = 'terminal-controller' (aliases/moduleIds/tests)", () => {
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
    expect(row?.id).toBe("terminal-controller");
    expect(row?.aliases).toEqual([STOCK_ID]);
    expect(row?.moduleIds).toEqual([OUR_ID]);
    expect(row?.tests).toEqual(["tests/host/api-terminal-controller.test.ts"]);
  });
});

describe("C · nguồn + hai cửa Bun.build", () => {
  test("C1 · src/client.ts khai CLIENT_LOADER_SHAPE mang ĐÚNG id ta + lib/client-entry.js tồn tại", async () => {
    const entry = join(OURS_LIB, "client-entry.js");
    expect(existsSync(entry)).toBe(true);
    const source = (await import(join(PKG, "src", "client.ts"))) as ModuleShape;
    const shape = String(source["CLIENT_LOADER_SHAPE"]);
    expect(shape.startsWith("window.__ModuleLoader__.load({")).toBe(true);
    expect(shape).toContain('id: "' + OUR_ID + '"');
    expect(shape).not.toContain(STOCK_ID);
    expect(source["OUR_CLIENT_ID"]).toBe(OUR_ID);
    expect(readText(entry)).toContain("CLIENT_LOADER_SHAPE");
  });

  test("C2 · lib/index-entry.js (Bun.build thứ nhất) + lib/client-entry.js (Bun.build thứ hai) đều có thật", () => {
    const indexEntry = join(OURS_LIB, "index-entry.js");
    const clientEntry = join(OURS_LIB, "client-entry.js");
    for (const path of [indexEntry, clientEntry]) {
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(0);
    }
    expect(readText(indexEntry)).toContain(OUR_ID);
    expect(readText(clientEntry)).toContain(OUR_ID);
    expect(readText(indexEntry)).not.toBe(readText(clientEntry));
  });
});

describe("D · typert: export A/B bằng await import() HAI BÊN + .d.ts chép từ gốc", () => {
  test("D1 · lib/typert.host.js: danh sách export TRÙNG bản gốc (cả hai = ['TYPERT'])", async () => {
    const [ours, stock] = await Promise.all([
      importModule(join(OURS_LIB, "typert.host.js")),
      importModule(join(STOCK_LIB, "typert.host.js")),
    ]);
    expect(exportNames(ours)).toEqual(exportNames(stock));
    expect(exportNames(ours)).toEqual(["TYPERT"]);
    expect(Object.keys(ours["TYPERT"] as ModuleShape)).toEqual(Object.keys(stock["TYPERT"] as ModuleShape));
  });

  test("D2 · lib/typert.remote-client.js: export TRÙNG bản gốc + default === TYPERT_REMOTE ở CẢ HAI", async () => {
    const [ours, stock] = await Promise.all([
      importModule(join(OUR_RUNTIME_LIB, "typert.remote-client.js")),
      importModule(join(STOCK_LIB, "typert.remote-client.js")),
    ]);
    expect(exportNames(ours)).toEqual(exportNames(stock));
    expect(exportNames(ours)).toEqual(["TYPERT_REMOTE", "default"]);
    expect(ours["default"]).toBe(ours["TYPERT_REMOTE"]);
    expect(stock["default"]).toBe(stock["TYPERT_REMOTE"]);
  });

  test("D3 · TYPERT host: cấu trúc sau chuẩn hoá id TRÙNG bản gốc (BigInt-safe serialize)", async () => {
    const [ours, stock] = await Promise.all([
      importModule(join(OUR_RUNTIME_LIB, "typert.host.js")),
      importModule(join(STOCK_LIB, "typert.host.js")),
    ]);
    const oursJson = stableJson(ours["TYPERT"]);
    const stockJson = stableJson(stock["TYPERT"]);
    expect(oursJson).not.toBe(stockJson);
    expect(normalizeIdsInText(oursJson)).toBe(normalizeIdsInText(stockJson));
    const ids = idCount(oursJson, OUR_ID);
    expect(ids).toBe(30);
    expect(byteLength(oursJson) - byteLength(stockJson)).toBe(ids * (OUR_ID.length - STOCK_ID.length));
  });

  test("D4 · TYPERT_REMOTE: cấu trúc sau chuẩn hoá id TRÙNG bản gốc (BigInt-safe serialize)", async () => {
    const [ours, stock] = await Promise.all([
      importModule(join(OUR_RUNTIME_LIB, "typert.remote-client.js")),
      importModule(join(STOCK_LIB, "typert.remote-client.js")),
    ]);
    const oursJson = stableJson(ours["TYPERT_REMOTE"]);
    const stockJson = stableJson(stock["TYPERT_REMOTE"]);
    expect(oursJson).not.toBe(stockJson);
    expect(normalizeIdsInText(oursJson)).toBe(normalizeIdsInText(stockJson));
    const ids = idCount(oursJson, OUR_ID);
    expect(ids).toBe(22);
    expect(byteLength(oursJson) - byteLength(stockJson)).toBe(110);
  });

  test("D5 · lib/typert.host.d.ts + lib/typert.remote-client.d.ts CHÉP NGUYÊN từ gốc (so từng byte)", () => {
    for (const file of ["typert.host.d.ts", "typert.remote-client.d.ts"]) {
      const ours = readFileSync(join(OURS_LIB, file));
      const stock = readFileSync(join(STOCK_LIB, file));
      expect(ours.equals(stock)).toBe(true);
      expect(sha256(ours.toString("utf8"))).toBe(sha256(stock.toString("utf8")));
      expect(ours.length).toBeGreaterThan(0);
    }
  });

  test("D6 · bản sao mkdtemp của HAI typert nạp được + export y hệt bản gốc (symlink node_modules)", async () => {
    const temp = mkdtempSync(join(tmpdir(), "gbh-terminal-halves-"));
    try {
      symlinkSync(join(REPO, "apps", "host", "node_modules"), join(temp, "node_modules"), "dir");
      for (const file of ["typert.host.js", "typert.remote-client.js"]) {
        copyFileSync(join(OURS_LIB, file), join(temp, file));
        expect(readFileSync(join(temp, file)).equals(readFileSync(join(OURS_LIB, file)))).toBe(true);
      }
      const hostCopy = await importModule(join(temp, "typert.host.js"));
      const remoteCopy = await importModule(join(temp, "typert.remote-client.js"));
      expect(exportNames(hostCopy)).toEqual(exportNames(await importModule(join(OURS_LIB, "typert.host.js"))));
      expect(exportNames(remoteCopy)).toEqual(exportNames(await importModule(join(OURS_LIB, "typert.remote-client.js"))));
      const stockHost = await importModule(join(STOCK_LIB, "typert.host.js"));
      expect(normalizeIdsInText(stableJson(hostCopy["TYPERT"]))).toBe(normalizeIdsInText(stableJson(stockHost["TYPERT"])));
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  }, 30_000);
});
