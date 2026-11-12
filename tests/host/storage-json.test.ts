/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-storage-json (row storage-json): bước 0 đo CẶP row trong ours.yml +
 *      HAI MẶT, tập export trên ARTIFACT (nạp thật cả hai bên), đối chứng TRỰC TIẾP với chính bundle gốc
 *      trên Context cordis THẬT + đĩa THẬT (single · per-record · legacy bootstrap · ma trận lỗi),
 *      C6 danh tính, quy ước `gbh.peers ⊆ peerDependencies` có 3 ĐỐI CHỨNG ÂM, và 000e.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/storage-json/build.ts";
import { peerRangeProblems } from "./peer-range-harness.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "storage-json");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-storage-json");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** cordis mà CHÍNH package ta nạp (symlink tới kernel) — cùng một tệp thật với kernel. */
const OUR_CORDIS = join(PKG, "node_modules", "@deepseek-ai", "cordis", "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer lúc nạp. */
const OUT = join(PKG, ".test-lib");
/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");
/** Trần chờ mặc định cho mọi phép chờ trạng thái (ms) — KHÔNG bao giờ chờ vô hạn. */
const WAIT_CEILING_MS = 3000;

/** Kiểu mô-đun động (hai bên đều là ESM đã build). */
type Mod = Record<string, any>;

/** Bundle gốc nạp động — năm export đúng như bản trong kernel cấp. */
const stockMod = (await import(STOCK)) as Mod;
/** Module của TA đã build (điền trong `beforeAll`). */
let ourMod: Mod;

beforeAll(async () => {
  const file = await buildPackage(OUT);
  ourMod = (await import(file)) as Mod;
});

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

/**
 * Chờ tới khi điều kiện đúng, có TRẦN thời gian.
 * Nhận: hàm kiểm, nhãn để báo lỗi, và trần (ms).
 * Trả: promise phân giải khi điều kiện đúng; NÉM khi hết trần.
 */
async function waitFor(check: () => boolean, label: string, timeoutMs = WAIT_CEILING_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error("waitFor hết trần " + timeoutMs + "ms: " + label);
}

/**
 * Mô tả một lỗi ĐỒNG BỘ (hoặc "(khong nem)") để so hai bên mà không làm đỏ test giữa đường.
 * Nhận: hàm cần chạy.
 * Trả: chuỗi JSON `{name, code, message}`.
 */
function errorOf(run: () => unknown): string {
  try {
    run();
    return "(khong nem)";
  } catch (error) {
    const subject = error as { name?: string; code?: string; message?: string };
    return JSON.stringify({ name: subject.name, code: subject.code, message: subject.message });
  }
}

/**
 * Mô tả một lỗi BẤT ĐỒNG BỘ (promise bị từ chối) để so hai bên.
 * Nhận: promise cần chạy.
 * Trả: promise của chuỗi mô tả như {@link errorOf}.
 */
async function rejectionOf(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "(khong nem)";
  } catch (error) {
    const subject = error as { name?: string; code?: string; message?: string };
    return JSON.stringify({ name: subject.name, code: subject.code, message: subject.message });
  }
}

/** Tên export của một file ESM đã build (cùng hai regex mà `check:rows` dùng). */
function exportNames(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of (match[1] ?? "").split(",")) {
      const trimmed = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (trimmed !== undefined && trimmed !== "") names.add(trimmed);
    }
  }
  for (const match of text.matchAll(/export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z0-9_$]+)/g)) {
    if (match[1] !== undefined) names.add(match[1]);
  }
  if (/export\s+default/.test(text)) names.add("default");
  return [...names].sort();
}

/**
 * Bề mặt prototype của một lớp dưới dạng danh sách tên thuộc tính riêng, đã sắp xếp.
 * Nhận: lớp cần đo.
 * Trả: mảng tên phương thức/getter của prototype.
 */
function prototypeNames(ctor: any): string[] {
  return Object.getOwnPropertyNames(ctor.prototype).sort();
}

/**
 * Dựng một gốc tạm RIÊNG cho mỗi lượt đo rồi luôn dọn nó.
 * Nhận: hàm chạy với gốc tạm.
 * Trả: promise của kết quả hàm chạy (gốc đã bị xoá sau đó).
 */
async function withRoot<T>(run: (root: string) => Promise<T>): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "gbh-sj-"));
  try {
    return await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/**
 * Chạy CÙNG một kịch bản trên HAI bên, mỗi bên một gốc tạm riêng.
 * Nhận: hàm kịch bản nhận (module của bên đó, gốc tạm).
 * Trả: cặp `{ours, stock}` để test so từng thành phần.
 */
async function bothSides<T>(run: (mod: Mod, root: string) => Promise<T>): Promise<{ ours: T; stock: T }> {
  const ours = await withRoot((root) => run(ourMod, root));
  const stock = await withRoot((root) => run(stockMod, root));
  return { ours, stock };
}

/**
 * Đọc TOÀN BỘ cây tệp của một gốc thành ảnh chụp `đường-dẫn-tương-đối → nội dung`.
 * Nhận: thư mục gốc cần chụp.
 * Trả: ảnh chụp đã chuẩn hoá dấu thời gian của tệp sao lưu để hai bên so được từng byte.
 */
function readTree(root: string, base = root): Record<string, string> {
  const out: Record<string, string> = {};
  if (!existsSync(root)) return out;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) Object.assign(out, readTree(full, base));
    else {
      const rel = full.slice(base.length + 1).replace(/\.bak\.\d{12}$/, ".bak.<DAU-THOI-GIAN>");
      out[rel] = readFileSync(full, "utf8");
    }
  }
  return out;
}

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Tên package của ta. */
  name?: string;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Metadata của ta để `bh host` sinh khối patch. */
  gbh?: { peers?: string[]; row?: unknown };
  /** Nửa browser — row này KHÔNG được có. */
  dsh?: unknown;
  /** Đầu ra công khai. */
  exports?: Record<string, unknown>;
}

/**
 * Đọc manifest của gói từ đĩa (đọc thẳng file, không `import`).
 * Nhận: không.
 * Trả: manifest đã ép kiểu.
 */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 * Nhận: manifest cần kiểm.
 * Trả: danh sách tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/**
 * Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật.
 * Nhận: manifest gốc.
 * Trả: bản sao độc lập.
 */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

/** Peer của riêng gói này — danh sách ĐÓNG, cả hai tên đều thuộc BẬC 1 của bảng §3b. */
const SEAM_PEERS = ["@deepseek-ai/cordis", "@deepseek-ai/schemastery"];
/** Tên export kỳ vọng trên ARTIFACT — đo được từ chính bundle gốc (5 tên, KHÔNG có `default`). */
const EXPORT_NAMES = ["Config", "JsonStorageBackend", "apply", "inject", "name"];
/** Thư mục dump MỚI NHẤT của `.parity/dumps` (cặp row phải đo trên bản đang chạy, không phải bản cũ). */
function newestDump(): string {
  const dumps = join(REPO, ".parity", "dumps");
  const names = readdirSync(dumps).filter((name) => existsSync(join(dumps, name, "ours.yml"))).sort();
  const last = names[names.length - 1];
  if (last === undefined) throw new Error("không có dump nào trong " + dumps);
  return join(dumps, last);
}

/**
 * Cắt khối của MỘT row trong `ours.yml` (từ dòng `- id: <row>` tới dòng `- id:` kế tiếp).
 * Nhận: nội dung ours.yml và id row.
 * Trả: các dòng của khối (rỗng khi không thấy row).
 */
function rowBlock(yaml: string, rowId: string): string[] {
  const lines = yaml.split("\n");
  const start = lines.findIndex((line) => line.trimEnd() === "- id: " + rowId);
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (i > start && /^-\s/.test(line)) break;
    out.push(line);
  }
  return out;
}

describe("bước 0 — bốn phép đo trên FILE THẬT", () => {
  test("(i)(iii) cặp `- id: storage-json` + `name: '@deepseek-ai/dsh-storage-json'` CÓ THẬT và row ĐANG BẬT", () => {
    const dump = newestDump();
    const yaml = readFileSync(join(dump, "ours.yml"), "utf8");
    const block = rowBlock(yaml, "storage-json");
    expect(block.length).toBeGreaterThan(1);
    expect(block[0]?.trimEnd()).toBe("- id: storage-json");
    expect(block[1]?.trim()).toBe("name: '@deepseek-ai/dsh-storage-json'");
    // (iii) KHÔNG có `disabled` — kể cả dạng `!!js` điều kiện: row tắt theo thiết kế KHÔNG được mount.
    expect(block.filter((line) => /^\s*disabled\s*:/.test(line))).toEqual([]);
  });

  test("(iv) `config`/`inject` GỐC lấy từ ours.yml ĐANG CHẠY (không phải oracleA_nopatch)", () => {
    const dump = newestDump();
    const block = rowBlock(readFileSync(join(dump, "ours.yml"), "utf8"), "storage-json");
    // Row khai `config:` với ĐÚNG một khoá `root`, biểu thức `!!js dshHomePath('storages')`.
    expect(block.map((line) => line.trim())).toContain("config:");
    expect(block.map((line) => line.trim())).toContain("root: !!js dshHomePath('storages')");
    // `inject:` KHÔNG có trong ours.yml. Biểu thức config chỉ dùng `dshHomePath` (không `ctx.<X>`)
    // ⇒ luật "config `!!js` dùng `ctx.<X>` ⇒ inject phải chứa <X>" KHÔNG áp dụng cho row này.
    expect(block.filter((line) => /^\s*inject\s*:/.test(line))).toEqual([]);
    expect(block.some((line) => /ctx\./.test(line))).toBe(false);
    // Chính bundle gốc tự khai `inject = ["storage"]` — seam của ROW, không phải của patch.
    expect(stockMod.inject).toEqual(["storage"]);
  });

  test("(ii) KHÔNG `dsh.client` trong package.json GỐC và KHÔNG có `lib/client.js` ⇒ row MỘT MẶT", () => {
    const manifest = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as { dsh?: unknown };
    expect(manifest.dsh).toBeUndefined();
    expect(bool((manifest.dsh as { client?: unknown } | undefined)?.client)).toBe(false);
    expect(existsSync(join(STOCK_DIR, "lib", "client.js"))).toBe(false);
    // Bản gốc vẫn SHIP `locale/` (000e) — gói ta phải chép lại từng byte.
    expect(existsSync(join(STOCK_DIR, "locale", "en.json"))).toBe(true);
    expect(existsSync(join(STOCK_DIR, "locale", "zh.json"))).toBe(true);
  });
});

/**
 * Ép một giá trị tuỳ ý về boolean đúng nghĩa "có/không" (dùng cho khoá `dsh.client`).
 * Nhận: giá trị cần đo.
 * Trả: `true` khi giá trị khác vắng/null/false.
 */
function bool(value: unknown): boolean {
  return value !== undefined && value !== null && value !== false;
}

describe("ARTIFACT — tập export và hình dạng bề mặt service", () => {
  test("tập export NẠP THẬT hai bên = nhau, 5 phần tử, 0 id module, 1 import ngoài", () => {
    const oursText = readFileSync(join(OUT, "index.js"), "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    // (a) Nạp THẬT cả hai bên rồi so PHẦN TỬ — không đọc chú thích, không đọc `src/`.
    expect(Object.keys(ourMod).sort()).toEqual(Object.keys(stockMod).sort());
    expect(Object.keys(ourMod).sort()).toEqual(EXPORT_NAMES);
    // (b) Cùng một tập đo bằng regex của `check:rows` trên chính artifact.
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(EXPORT_NAMES);
    // Row HOST thuần: KHÔNG bộ nạp module nào trong artifact ⇒ đếm id stock phải là 0.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect((oursText.match(/id: @deepseek-ai/g) ?? []).length).toBe(0);
    expect((stockText.match(/id: @deepseek-ai/g) ?? []).length).toBe(0);
    // Import NGOÀI của ta: chỉ `schemastery` (bản gốc 2: schemastery + gói kho — xem README §3).
    const outside = (text: string): string[] =>
      [...text.matchAll(/^import[^"']*["']([^"']+)["']/gm)].map((m) => m[1] as string).filter((spec) => !spec.startsWith("node:"));
    expect([...new Set(outside(oursText))]).toEqual(["@deepseek-ai/schemastery"]);
    expect([...new Set(outside(stockText))].sort()).toEqual(["@deepseek-ai/dsh-storage", "@deepseek-ai/schemastery"]);
    // `build.ts` nhận `process.argv[2]` — thiếu nó thì profile KHÔNG có `lib/` ⇒ không sinh entry.
    expect(readFileSync(join(PKG, "build.ts"), "utf8")).toContain("process.argv[2]");
  });

  test("bề mặt plugin + lớp: name · inject · apply.length · prototype · String(Config) trùng bản gốc", () => {
    expect(ourMod.name).toBe(stockMod.name);
    expect(ourMod.name).toBe("storage-json");
    expect(ourMod.inject).toEqual(stockMod.inject);
    expect(ourMod.apply.length).toBe(stockMod.apply.length);
    expect(ourMod.apply.length).toBe(2);
    expect(prototypeNames(ourMod.JsonStorageBackend)).toEqual(prototypeNames(stockMod.JsonStorageBackend));
    expect(prototypeNames(ourMod.JsonStorageBackend)).toEqual(["close", "constructor", "openUnit"]);
    expect(String(ourMod.Config)).toBe(String(stockMod.Config));
    // Cùng kết quả/câu lỗi cho ba đầu vào cấu hình.
    for (const value of [{ root: "/x" }, {}, { root: 1 }]) {
      expect(errorOf(() => ourMod.Config(value))).toBe(errorOf(() => stockMod.Config(value)));
    }
    expect(ourMod.Config({ root: "/x" })).toEqual({ root: "/x" });
    // Thuộc tính RIÊNG của thể hiện backend: cùng tập, cùng thứ tự khai.
    const own = (mod: Mod): string[] => Object.keys(new mod.JsonStorageBackend("/tmp/khong-dung")).sort();
    expect(own(ourMod)).toEqual(own(stockMod));
    expect(own(ourMod)).toEqual(["closed", "kv", "open", "opening", "root"]);
  });
});

describe("hành vi A/B với chính bundle gốc — bố trí `single` trên ĐĨA THẬT", () => {
  /** Mô tả đơn vị dùng cho kịch bản single (hai bảng + ô global). */
  const single = { name: "demo", version: 2, tables: ["rows", "empty"], hasGlobal: true };

  test("ghi/xoá/global công bố tệp GIỐNG TỪNG BYTE và ảnh chụp bộ nhớ trùng", async () => {
    const { ours, stock } = await bothSides(async (mod, root) => {
      const backend = new mod.JsonStorageBackend(root);
      const unit = await backend.kv.open(single);
      const beforeFile = existsSync(join(root, "demo.json"));
      const empty = await unit.loadAll();
      await unit.putRecord("rows", "a", { n: 1 });
      await unit.putRecord("rows", "b", { n: 2 });
      const afterTwo = readTree(root);
      const deleteMissing = await unit.deleteRecord("rows", "khong-co");
      const deletePresent = await unit.deleteRecord("rows", "a");
      await unit.setGlobal({ theme: "dark" });
      const snapshot = await unit.loadAll();
      const undeclaredTable = await rejectionOf(() => unit.putRecord("nope", "k", 1));
      await unit.close();
      const closedWrite = await rejectionOf(() => unit.putRecord("rows", "c", { n: 3 }));
      const closedRead = await rejectionOf(() => unit.loadAll());
      // Vị trí đang-mở được NHẢ sau close ⇒ mở lại cùng tên phải được.
      const again = await backend.kv.open(single);
      const reopened = await again.loadAll();
      const doubleOpen = await rejectionOf(() => backend.kv.open(single));
      await backend.close();
      const openAfterClose = await rejectionOf(() => backend.kv.open(single));
      return {
        beforeFile,
        empty,
        afterTwo,
        deleteMissing,
        deletePresent,
        snapshot,
        undeclaredTable,
        closedWrite,
        closedRead,
        reopened,
        doubleOpen,
        openAfterClose,
        finalTree: readTree(root),
      };
    });
    expect(ours).toEqual(stock);
    // Ba khẳng định ĐỘC LẬP để test không chỉ "hai bên cùng sai":
    expect(ours.beforeFile).toBe(false); // mở KHÔNG tạo tệp (tạo lười ở lượt ghi đầu)
    // Hai lượt xoá trả `undefined` (hợp đồng `Promise<void>`) — trạng thái mới là thứ đổi.
    expect(ours.deleteMissing).toBeUndefined();
    expect(ours.deletePresent).toBeUndefined();
    expect(ours.afterTwo["demo.json"]).toContain('"a"');
    expect(ours.snapshot.tables.rows["a"]).toBeUndefined();
    expect(ours.snapshot.tables.rows).toEqual({ b: { n: 2 } });
    expect(ours.snapshot.global).toEqual({ theme: "dark" });
    expect(ours.reopened.tables.rows).toEqual({ b: { n: 2 } });
    expect(ours.undeclaredTable).toContain("does not declare table 'nope'");
    expect(ours.closedWrite).toContain('"code":"closed"');
    expect(ours.openAfterClose).toContain("json backend is closed");
    // Tệp là tài liệu NGƯỜI-ĐỌC-ĐƯỢC: in 2 dấu cách, header `unit`, global, tables, xuống dòng cuối.
    expect(ours.finalTree["demo.json"]).toBe(
      JSON.stringify({ unit: { name: "demo", version: 2 }, global: { theme: "dark" }, tables: { rows: { b: { n: 2 } }, empty: {} } }, null, 2) + "\n",
    );
  });

  test("close() XẢ lượt ghi đang chạy — chờ có TRẦN (ca dễ flaky nhất của gói)", async () => {
    const { ours, stock } = await bothSides(async (mod, root) => {
      const backend = new mod.JsonStorageBackend(root);
      const unit = await backend.kv.open({ name: "demo", version: 1, tables: ["rows"], hasGlobal: false });
      // CỐ Ý không await: lượt ghi đang chạy khi close() được gọi.
      const pending = unit.putRecord("rows", "a", { n: 1 });
      await unit.close();
      await pending;
      await waitFor(() => existsSync(join(root, "demo.json")), "tệp đơn vị sau khi close xả lượt ghi", 2000);
      const text = readFileSync(join(root, "demo.json"), "utf8");
      await backend.close();
      return text;
    });
    expect(ours).toBe(stock);
    expect(ours).toContain('"a"');
  });
});

describe("hành vi A/B — bố trí `per-record`, sao lưu và bootstrap LEGACY", () => {
  test("mỗi bản ghi một tài liệu; sao lưu đổi tên; khoá không an toàn bị TỪ CHỐI trước khi chạm đĩa", async () => {
    const { ours, stock } = await bothSides(async (mod, root) => {
      const backend = new mod.JsonStorageBackend(root);
      const descriptor = { name: "demo", version: 3, tables: ["rows"], hasGlobal: true, layout: "per-record" };
      const unit = await backend.kv.open(descriptor);
      const dirAfterOpen = existsSync(join(root, "demo"));
      const emptyLoad = await unit.loadAll();
      const dirAfterLoad = existsSync(join(root, "demo"));
      await unit.putRecord("rows", "a", { n: 1 });
      await unit.putRecord("rows", "b", { n: 2 });
      await unit.setGlobal({ theme: "dark" });
      const afterWrites = readTree(root);
      const backed = await unit.backupRecord("rows", "b");
      const afterBackup = await unit.loadAll();
      const unsafePut = await rejectionOf(() => unit.putRecord("rows", "../x", 1));
      const unsafeDelete = await rejectionOf(() => unit.deleteRecord("rows", "a.b"));
      const unsafeBackup = await rejectionOf(() => unit.backupRecord("rows", "a/b"));
      const badTable = await rejectionOf(() => unit.putRecord("nope", "a", 1));
      const deleteMissing = await unit.deleteRecord("rows", "khong-co");
      await unit.close();
      const closed = await rejectionOf(() => unit.loadAll());
      await backend.close();
      return {
        dirAfterOpen,
        emptyLoad,
        dirAfterLoad,
        afterWrites,
        backedTail: backed.slice(-12),
        backedShape: backed.replace(root, "").replace(/\d{12}$/, "<DAU-THOI-GIAN>"),
        afterBackup,
        unsafePut,
        unsafeDelete,
        unsafeBackup,
        badTable,
        deleteMissing,
        closed,
        finalTree: readTree(root),
      };
    });
    expect(ours).toEqual(stock);
    expect(ours.dirAfterOpen).toBe(false); // đơn vị KHÔNG chạm đĩa lúc mở (nạp lười)
    expect(ours.dirAfterLoad).toBe(false);
    expect(ours.emptyLoad).toEqual({ tables: { rows: {} }, global: null });
    expect(ours.afterWrites["demo/rows/a.json"]).toBe(JSON.stringify({ version: 3, record: { n: 1 } }, null, 2) + "\n");
    expect(ours.afterWrites["demo/global.json"]).toBe(JSON.stringify({ version: 3, record: { theme: "dark" } }, null, 2) + "\n");
    expect(ours.backedShape).toBe("/demo/rows/b.json.bak.<DAU-THOI-GIAN>");
    expect(ours.backedTail).toMatch(/^\d{12}$/);
    expect(ours.afterBackup.tables.rows).toEqual({ a: { n: 1 } });
    expect(ours.unsafePut).toContain("is not path-safe");
    expect(ours.badTable).toContain("does not declare table 'nope'");
    expect(ours.deleteMissing).toBeUndefined();
  });

  test("bootstrap LEGACY: chỉ mồi khi cây CHƯA có tài liệu nào và dấu phiên bản được chấp nhận", async () => {
    /** Ghi một tệp cả-đơn-vị legacy vào gốc. */
    const seedLegacy = (root: string, version: number, name = "demo"): void => {
      writeFileSync(
        join(root, "demo.json"),
        JSON.stringify({ unit: { name, version }, global: { theme: "light" }, tables: { rows: { a: { n: 1 } } } }, null, 2) + "\n",
        "utf8",
      );
    };
    const descriptor = {
      name: "demo",
      version: 3,
      tables: ["rows"],
      hasGlobal: true,
      layout: "per-record",
      compatibleVersions: [2],
    };
    const run = async (mod: Mod, root: string, setup: (root: string) => void) => {
      setup(root);
      const backend = new mod.JsonStorageBackend(root);
      const unit = await backend.kv.open(descriptor);
      const loaded = await unit.loadAll();
      await backend.close();
      return { loaded, tree: readTree(root) };
    };
    const cases: {
      label: string;
      legacyVersion: number;
      expectedRows: Record<string, unknown>;
      setup: (root: string) => void;
    }[] = [
      { label: "dấu HIỆN TẠI", legacyVersion: 3, expectedRows: { a: { n: 1 } }, setup: (root: string) => seedLegacy(root, 3) },
      { label: "dấu TƯƠNG THÍCH", legacyVersion: 2, expectedRows: { a: { n: 1 } }, setup: (root: string) => seedLegacy(root, 2) },
      { label: "dấu NGOẠI LAI", legacyVersion: 9, expectedRows: {}, setup: (root: string) => seedLegacy(root, 9) },
      { label: "tên đơn vị KHÁC", legacyVersion: 3, expectedRows: {}, setup: (root: string) => seedLegacy(root, 3, "khac") },
      {
        label: "cây ĐÃ có tài liệu",
        legacyVersion: 3,
        expectedRows: { z: { n: 9 } },
        setup: (root: string) => {
          seedLegacy(root, 3);
          mkdirSync(join(root, "demo", "rows"), { recursive: true });
          writeFileSync(join(root, "demo", "rows", "z.json"), JSON.stringify({ version: 3, record: { n: 9 } }) + "\n", "utf8");
        },
      },
      {
        label: "cây có tài liệu HỎNG",
        legacyVersion: 3,
        expectedRows: {},
        setup: (root: string) => {
          seedLegacy(root, 3);
          mkdirSync(join(root, "demo", "rows"), { recursive: true });
          writeFileSync(join(root, "demo", "rows", "z.json"), "khong-phai-json", "utf8");
        },
      },
    ];
    for (const item of cases) {
      const ours = await withRoot((root) => run(ourMod, root, item.setup));
      const stock = await withRoot((root) => run(stockMod, root, item.setup));
      // So TỪNG BYTE cây tệp (tệp legacy phải được GIỮ NGUYÊN) + ảnh chụp đã nạp.
      expect({ case: item.label, ...ours }).toEqual({ case: item.label, ...stock });
      if (item.label === "dấu HIỆN TẠI" || item.label === "dấu TƯƠNG THÍCH") {
        // Bootstrap ĐÃ chạy: bản ghi được chép thành tài liệu mang phiên bản HIỆN TẠI.
        expect(ours.loaded.tables.rows).toEqual({ a: { n: 1 } });
        expect(ours.tree["demo/rows/a.json"]).toBe(JSON.stringify({ version: 3, record: { n: 1 } }, null, 2) + "\n");
        // Tệp legacy được GIỮ NGUYÊN (không bị sửa, không bị xoá) — đúng dấu phiên bản đã gieo.
        expect(ours.tree["demo.json"]).toContain('"version": ' + item.legacyVersion);
      }
      // Kỳ vọng ĐỘC LẬP cho từng ca (để test không chỉ "hai bên cùng sai").
      expect({ case: item.label, rows: ours.loaded.tables.rows }).toEqual({ case: item.label, rows: item.expectedRows });
    }
  });
});

describe("MA TRẬN ĐƯỜNG LỖI — cùng name/code/message ở cả hai bên", () => {
  /** Các tệp đơn vị HỎNG, mỗi ca một nội dung. */
  const broken: { label: string; text: string | undefined }[] = [
    { label: "không phải JSON", text: "day khong phai json" },
    { label: "JSON không phải object", text: '"chuoi"' },
    { label: "header NGOẠI LAI", text: JSON.stringify({ unit: { name: "khac", version: 2 }, tables: {} }) },
    { label: "header thiếu version", text: JSON.stringify({ unit: { name: "demo" }, tables: {} }) },
    { label: "phiên bản LỆCH", text: JSON.stringify({ unit: { name: "demo", version: 9 }, tables: {} }) },
    { label: "tables là MẢNG", text: JSON.stringify({ unit: { name: "demo", version: 2 }, tables: [] }) },
    { label: "bảng là MẢNG", text: JSON.stringify({ unit: { name: "demo", version: 2 }, tables: { rows: [] } }) },
    { label: "không có tệp", text: undefined },
  ];

  test("mở đơn vị trên môi trường lưu hỏng: 8 ca cùng câu, cùng mã", async () => {
    const descriptor = { name: "demo", version: 2, tables: ["rows"], hasGlobal: true };
    const run = async (mod: Mod, root: string, text: string | undefined) => {
      if (text !== undefined) writeFileSync(join(root, "demo.json"), text, "utf8");
      const backend = new mod.JsonStorageBackend(root);
      const outcome = await rejectionOf(() => backend.kv.open(descriptor));
      await backend.close();
      return outcome;
    };
    for (const item of broken) {
      const ours = await withRoot((root) => run(ourMod, root, item.text));
      const stock = await withRoot((root) => run(stockMod, root, item.text));
      expect({ label: item.label, outcome: ours }).toEqual({ label: item.label, outcome: stock });
      if (item.text !== undefined) expect(ours).not.toBe("(khong nem)");
    }
  });

  test("mô tả SAI + backend đã đóng + ô global KHÔNG khai: cùng lớp, cùng câu", async () => {
    const run = async (mod: Mod, root: string) => {
      const backend = new mod.JsonStorageBackend(root);
      const badName = await rejectionOf(() => backend.kv.open({ name: "Bad", version: 1, tables: [], hasGlobal: false }));
      const badTable = await rejectionOf(() => backend.kv.open({ name: "demo", version: 1, tables: ["Bad"], hasGlobal: false }));
      const unit = await backend.kv.open({ name: "demo", version: 1, tables: ["rows"], hasGlobal: false });
      const noGlobal = await rejectionOf(() => unit.setGlobal({ x: 1 }));
      const emptyName = await rejectionOf(() => backend.kv.open({ name: "", version: 1, tables: [], hasGlobal: false }));
      await backend.close();
      const afterClose = await rejectionOf(() => backend.kv.open({ name: "demo2", version: 1, tables: [], hasGlobal: false }));
      return { badName, badTable, noGlobal, emptyName, afterClose };
    };
    const { ours, stock } = await bothSides(run);
    expect(ours).toEqual(stock);
    expect(ours.badName).toContain("invalid unit name 'Bad'");
    expect(ours.badTable).toContain("invalid table name 'Bad' in unit 'demo'");
    expect(ours.noGlobal).toContain("does not declare a global slot");
    expect(ours.afterClose).toContain("json backend is closed");
  });

  test("tài liệu per-record NGOẠI LAI đọc như VẮNG; `global.json` chỉ đọc khi đã khai", async () => {
    const run = async (mod: Mod, root: string) => {
      mkdirSync(join(root, "demo", "rows"), { recursive: true });
      const write = (rel: string, text: string): void => writeFileSync(join(root, "demo", rel), text, "utf8");
      write("rows/ok.json", JSON.stringify({ version: 2, record: { n: 1 } }));
      write("rows/stale.json", JSON.stringify({ version: 7, record: { n: 2 } }));
      write("rows/broken.json", "hong");
      write("rows/thieu-dau.json", JSON.stringify({ record: { n: 3 } }));
      write("rows/bad-key!.json", JSON.stringify({ version: 2, record: { n: 4 } }));
      write("rows/ghi-chu.txt", "bo qua");
      write("global.json", JSON.stringify({ version: 2, record: { theme: "dark" } }));
      const backend = new mod.JsonStorageBackend(root);
      const withGlobal = await backend.kv.open({ name: "demo", version: 2, tables: ["rows"], hasGlobal: true, layout: "per-record" });
      const loaded = await withGlobal.loadAll();
      await withGlobal.close();
      const noGlobal = await backend.kv.open({ name: "demo", version: 2, tables: ["rows"], hasGlobal: false, layout: "per-record" });
      const loadedNoGlobal = await noGlobal.loadAll();
      await noGlobal.close();
      await backend.close();
      return { loaded, loadedNoGlobal };
    };
    const { ours, stock } = await bothSides(run);
    expect(ours).toEqual(stock);
    expect(ours.loaded.tables.rows).toEqual({ ok: { n: 1 } });
    expect(ours.loaded.global).toEqual({ theme: "dark" });
    expect(ours.loadedNoGlobal.global).toBeNull();
  });
});

describe("apply trên Context cordis THẬT — đăng ký, phơi khoá vòng đời, gỡ mount", () => {
  test("cùng vết sự kiện `register → unregister → close` và cùng khoá `storage.backend.json`", async () => {
    const { Context } = (await import(OUR_CORDIS)) as unknown as { Context: new () => any };
    const run = async (mod: Mod, root: string) => {
      const events: string[] = [];
      const backends = new Map<string, any>();
      const hub = {
        backend: {
          register(name: string, backend: any): () => void {
            events.push("register:" + name);
            backends.set(name, backend);
            return () => {
              events.push("unregister:" + name);
              backends.delete(name);
            };
          },
        },
      };
      const ctx: any = new Context();
      ctx.provide("storage", hub);
      const fiber = ctx.plugin(mod, { root });
      await waitFor(() => ctx.get("storage.backend.json") !== undefined, "khoá vòng đời backend json");
      const registered = backends.get("json");
      const exposed = ctx.get("storage.backend.json");
      const same = registered === exposed;
      const hasKv = typeof registered?.kv?.open === "function";
      await fiber.dispose();
      await waitFor(() => backends.size === 0, "gỡ đăng ký sau dispose");
      // Backend đã ĐÓNG thật (không chỉ gỡ khỏi sổ).
      const afterDispose = await rejectionOf(() => registered.kv.open({ name: "demo", version: 1, tables: [], hasGlobal: false }));
      return { events, same, hasKv, afterDispose };
    };
    const ours = await withRoot((root) => run(ourMod, root));
    const stock = await withRoot((root) => run(stockMod, root));
    expect(ours).toEqual(stock);
    expect(ours.events).toEqual(["register:json", "unregister:json"]);
    expect(ours.same).toBe(true);
    expect(ours.hasKv).toBe(true);
    expect(ours.afterDispose).toContain("json backend is closed");
  });
});

describe("C6 — vật thể cấu hình/trạng thái phải ĐỘC LẬP (kiểm bằng DANH TÍNH, không so sâu)", () => {
  test("hai backend: sổ đang-mở, tập đang-mở và facet `kv` đều là vật thể RIÊNG", async () => {
    for (const mod of [ourMod, stockMod]) {
      await withRoot(async (rootA) => {
        await withRoot(async (rootB) => {
          const a = new mod.JsonStorageBackend(rootA);
          const b = new mod.JsonStorageBackend(rootB);
          expect(a).not.toBe(b);
          expect(a.kv).not.toBe(b.kv);
          expect(a.open).not.toBe(b.open);
          expect(a.opening).not.toBe(b.opening);
          const descriptor = { name: "demo", version: 1, tables: ["rows"], hasGlobal: false };
          const unitA = await a.kv.open(descriptor);
          const unitB = await b.kv.open(descriptor);
          expect(unitA).not.toBe(unitB);
          expect(unitA.state).not.toBe(unitB.state);
          expect(unitA.state.tables).not.toBe(unitB.state.tables);
          await unitA.putRecord("rows", "a", { n: 1 });
          // Ghi bên A KHÔNG lan sang B.
          expect((await unitB.loadAll()).tables.rows).toEqual({});
          expect((await unitA.loadAll()).tables.rows).toEqual({ a: { n: 1 } });
          await a.close();
          await b.close();
        });
      });
    }
  });

  test("ảnh chụp `loadAll` TÁCH RỜI trạng thái: sửa ảnh chụp không chạm bộ nhớ ủy quyền", async () => {
    const { ours, stock } = await bothSides(async (mod, root) => {
      const backend = new mod.JsonStorageBackend(root);
      const unit = await backend.kv.open({ name: "demo", version: 1, tables: ["rows"], hasGlobal: true });
      await unit.putRecord("rows", "a", { n: 1 });
      const first = await unit.loadAll();
      const second = await unit.loadAll();
      const detached = first.tables.rows !== second.tables.rows && first.tables !== second.tables;
      first.tables.rows["bia"] = { n: 9 };
      const after = await unit.loadAll();
      await backend.close();
      return { detached, after };
    });
    expect(ours).toEqual(stock);
    expect(ours.detached).toBe(true);
    expect(ours.after.tables.rows).toEqual({ a: { n: 1 } });
  });
});

describe("quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có trong peerDependencies, đúng dải version của kernel", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: danh sách peer phải ĐÚNG bằng danh sách đóng, không chỉ "rỗng thì đạt".
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
    // Dải: (1) PHẢI BẰNG ĐÚNG dải manifest stock của gói, (2) PHẢI phủ bản kernel đang chạy — phép kiểm
    // MẠNH trong harness (stock khai dải alpha, kernel chạy bản không-alpha; vẫn chặn drift rc.5).
    expect(peerRangeProblems(PKG)).toEqual([]);
    // Peer KHÔNG bao giờ nằm ở `dependencies` (sẽ tạo thể hiện THỨ HAI).
    expect(manifest.dependencies).toBeUndefined();
  });

  test("BA ĐỐI CHỨNG ÂM: xoá-một-tên · cùng-số-lượng-lệch-phần-tử · thừa-tên", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBe(2);
    // (1) xoá ĐÚNG một tên ⇒ phép kiểm phải báo ĐÚNG tên đó.
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    // (2) GIỮ NGUYÊN SỐ LƯỢNG nhưng ĐỔI PHẦN TỬ ⇒ vẫn phải báo thiếu: so số lượng là verdict RỖNG.
    const swapped = cloneManifest(manifest);
    const declared = { ...(swapped.peerDependencies ?? {}) };
    delete declared[peers[0] as string];
    declared["@deepseek-ai/khong-phai-peer"] = "~0.0.1";
    swapped.peerDependencies = declared;
    expect(Object.keys(declared).length).toBe(peers.length);
    expect(missingPeers(swapped)).toEqual([peers[0] as string]);
    // (3) THỪA tên vẫn ĐẠT (⊆ chứ không phải =).
    const extra = cloneManifest(manifest);
    extra.peerDependencies = { ...(extra.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(extra)).toEqual([]);
    // Xoá SẠCH ⇒ phải báo ĐỦ cả danh sách, không phải một con số.
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
  });
});

describe("TEST CANH + 000e cho gói CHƯA khai gbh.row", () => {
  test("canh HAI CHIỀU: `gbh.row` (nếu có) phải ĐÚNG hình dạng; không có thì vẫn là trạng thái an toàn", () => {
    const manifest = readManifest();
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-storage-json");
    expect(manifest.dsh).toBeUndefined();
    expect(existsSync(join(PKG, "src", "client.ts"))).toBe(false);
    expect(existsSync(join(PKG, "lib", "client.js"))).toBe(false);
    expect(manifest.gbh?.peers).toEqual(SEAM_PEERS);
    // Recipe §7: đọc CẢ HAI dạng — `gbh.row` (đang mount) HOẶC `gbh.row_unmounted_ly_do.row` (đã gỡ mount).
    // Vắng = trạng thái an toàn (chưa khai thì `bh host` không sinh patch) ⇒ hợp lệ.
    const row = (manifest.gbh?.row ?? (manifest.gbh as { row_unmounted_ly_do?: { row?: unknown } } | undefined)?.row_unmounted_ly_do?.row) as
      | { id?: string; config?: unknown; tests?: unknown; moduleIds?: unknown; aliases?: unknown }
      | undefined;
    if (row === undefined) return;
    // CÓ khai (Lead khai NGOÀI phiên viết gói — quyền của Lead, sau ba phép tiền-mount) ⇒ hình dạng phải khớp
    // ĐÚNG row của `ours.yml` ĐANG CHẠY: id + `config.root = !!js dshHomePath('storages')` + tests trỏ file này.
    expect(row.id).toBe("storage-json");
    expect(row.config).toEqual({ root: { js: "dshHomePath('storages')" } });
    expect(row.tests).toEqual(["tests/host/storage-json.test.ts"]);
    // Row MỘT MẶT ⇒ KHÔNG id module/alias (không có entry browser nào để trỏ tới).
    expect(row.moduleIds).toBeUndefined();
    expect(row.aliases).toBeUndefined();
  });

  test("000e: bản gốc CÓ `locale/` ⇒ ta ship lại TỪNG BYTE và khai trong exports", () => {
    const manifest = readManifest();
    expect(Object.keys(manifest.exports ?? {})).toContain("./locale/*.json");
    for (const language of ["en", "zh"]) {
      const ours = readFileSync(join(PKG, "locale", language + ".json"));
      const theirs = readFileSync(join(STOCK_DIR, "locale", language + ".json"));
      expect(ours.equals(theirs)).toBe(true);
      // Cùng `meta.title` — tiêu đề hàng trong màn Plugins của DSH đọc đúng khoá này.
      expect(JSON.parse(ours.toString("utf8")).meta.title).toBe(JSON.parse(theirs.toString("utf8")).meta.title);
    }
    // Điều kiện cổng `hygiene` (dòng §4) — có mặt NGAY trong lượt viết gói, trước khi khai `gbh.row`.
    expect(readFileSync(join(REPO, "packages", "README.md"), "utf8")).toContain("host/storage-json");
  });
});
