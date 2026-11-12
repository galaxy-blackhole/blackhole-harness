/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test cho @galaxy-blackhole/gbh-storage-domain (row storage-domain): bước 0 đo CẶP row trong
 *      ours.yml + HAI MẶT, tập export trên ARTIFACT, đối chứng TRỰC TIẾP với chính bundle gốc trên
 *      Context cordis THẬT (bảng · global · ma trận đường lỗi · backup-and-skip · thứ tự bền-trước-sự-kiện),
 *      C6 danh tính, quy ước `gbh.peers ⊆ peerDependencies` có ĐỐI CHỨNG ÂM, và 000e.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { buildPackage } from "../../packages/host/storage-domain/build.ts";
import { domainTable } from "../../packages/host/storage-domain/src/spec.ts";
import { peerRangeProblems } from "./peer-range-harness.ts";
import type { DomainTableSpec } from "../../packages/host/storage-domain/src/spec.ts";
import { z as zod } from "../../apps/host/node_modules/zod/index.js";
import {
  disposeHub,
  errorOf,
  makeGlobalSpec,
  makeHub,
  makeSpec,
  mountDomain,
  rejectionOf,
  runBackupScenario,
  runErrorMatrix,
  runGlobalScenario,
  runTableScenario,
  unitOf,
} from "./storage-domain-harness.ts";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "storage-domain");
/** Thư mục gói GỐC trong kernel (CHỈ ĐỌC) — oracle của mọi phép so. */
const STOCK_DIR = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-storage-domain");
/** Bundle GỐC đã build trong kernel. */
const STOCK = join(STOCK_DIR, "lib", "index.js");
/** Thư mục build tạm: nằm TRONG package để `packages: "external"` phân giải được peer lúc nạp. */
const OUT = join(PKG, ".test-lib");

/** Kiểu mô-đun động (hai bên đều là ESM đã build). */
type Mod = Record<string, any>;

/** Bundle gốc nạp động — chín export đúng như bản trong kernel cấp. */
const stockMod = (await import(STOCK)) as Mod;
/** Module của TA đã build (điền trong `beforeAll`). */
let ourMod: Mod;

/** Hai bên của phép A/B. */
const SIDES: readonly { readonly label: string; readonly mod: () => Mod }[] = [
  { label: "ta", mod: () => ourMod },
  { label: "gốc", mod: () => stockMod },
];

/** Manifest của gói — nguồn DUY NHẤT của cả `gbh.peers` lẫn `peerDependencies` (JSON được miễn header). */
const MANIFEST = join(PKG, "package.json");
/** Peer của riêng gói này (ngoài hai tên `mount.ts` tự thêm) — danh sách ĐÓNG. */
// `@deepseek-ai/dsh-storage-domain` là peer CHỈ-KIỂU: seam `Context.storageDomain` thuộc MỘT chủ sở hữu là bản gốc (ADR 0009).
const SEAM_PEERS = ["@deepseek-ai/cordis", "@deepseek-ai/dsh-storage-domain", "@deepseek-ai/schemastery"];
/** Tên export kỳ vọng trên ARTIFACT — đo được từ chính bundle gốc. */
const EXPORT_NAMES = ["Config", "DomainError", "DomainFacility", "apply", "defineDomain", "descriptorOf", "domainTable", "inject", "name"];

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

/** Bề mặt prototype của một lớp dưới dạng danh sách tên thuộc tính riêng, đã sắp xếp. */
function prototypeNames(ctor: Mod): string[] {
  return Object.getOwnPropertyNames(ctor.prototype).sort();
}

/** Hình dạng tối thiểu của manifest mà phép kiểm quy ước cần đọc. */
interface Manifest {
  /** Tên package. */
  name?: string;
  /** Hợp đồng với trình quản lý gói. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường — peer KHÔNG được nằm ở đây. */
  dependencies?: Record<string, string>;
  /** Chỉ mượn KIỂU (bị xoá lúc build) — không phải seam lúc chạy. */
  devDependencies?: Record<string, string>;
  /** Metadata của ta để `bh host` sinh khối patch. */
  gbh?: { peers?: string[]; row?: unknown; row_unmounted_ly_do?: { ly_do?: string; row?: unknown } };
  /** Đầu ra công khai. */
  exports?: Record<string, unknown>;
  /** Nửa client (không được có ở row MỘT MẶT). */
  dsh?: { client?: unknown };
  /** Đầu vào chính. */
  main?: string;
}

/** Đọc manifest của gói từ đĩa (đọc thẳng file, không `import`). */
function readManifest(): Manifest {
  return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest;
}

/**
 * Tên còn THIẾU: phần tử của `gbh.peers` không có mặt trong `peerDependencies`.
 * So PHẦN TỬ, KHÔNG so số lượng — `peerDependencies` thừa tên vẫn ĐẠT (quy ước là ⊆, không phải =).
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

/** Bản sao SÂU của manifest để ca đối chứng âm tiêm lỗi mà không đụng file thật. */
function cloneManifest(manifest: Manifest): Manifest {
  return JSON.parse(JSON.stringify(manifest)) as Manifest;
}

/** Khối YAML của một row trong `ours.yml` (từ dòng `- id:` tới row kế tiếp). */
function rowBlock(text: string, rowId: string): string {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => line.trimEnd() === "- id: " + rowId);
  if (at < 0) return "";
  const out: string[] = [];
  for (let i = at; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (i > at && line.startsWith("- id:")) break;
    out.push(line);
  }
  return out.join("\n");
}

beforeAll(async () => {
  const file = await buildPackage(OUT);
  ourMod = (await import(file)) as Mod;
});

afterAll(async () => {
  await rm(OUT, { recursive: true, force: true });
});

describe("row storage-domain — BƯỚC 0 và ARTIFACT", () => {
  test("bước 0: cặp row THẬT trong ours.yml MỚI NHẤT; config `backend: json`; KHÔNG inject; gốc MỘT MẶT", () => {
    const dumpsDir = join(REPO, ".parity", "dumps");
    const newest = readdirSync(dumpsDir).filter((name) => /^\d{4}-/.test(name)).sort().at(-1) ?? "";
    expect(newest).not.toBe("");
    const block = rowBlock(readFileSync(join(dumpsDir, newest, "ours.yml"), "utf8"), "storage-domain");
    expect(block).not.toBe("");
    expect(block).toContain("name: '@deepseek-ai/dsh-storage-domain'");
    // Cấu hình lấy từ ours.yml ĐANG CHẠY (không phải oracleA_nopatch) — profile ghi đè.
    expect(block).toContain("backend: json");
    // Row TRẦN: không `inject:`, không biểu thức `!!js` ⇒ không có `ctx.<X>` nào cần khai inject.
    expect(block).not.toContain("inject:");
    expect(block).not.toContain("!!js");
    // MỘT MẶT: bản gốc KHÔNG có `dsh.client` VÀ KHÔNG có `lib/client.js`.
    const stockManifest = JSON.parse(readFileSync(join(STOCK_DIR, "package.json"), "utf8")) as Manifest;
    expect(stockManifest.dsh?.client).toBeUndefined();
    expect(existsSync(join(STOCK_DIR, "lib", "client.js"))).toBe(false);
    expect(stockManifest.main).toBe("lib/index.js");
  });

  test("ARTIFACT: tập export ta = gốc (9 = 9), 0 id module, MỘT import ngoài, không lộ nội bộ", () => {
    const oursText = readFileSync(join(OUT, "index.js"), "utf8");
    const stockText = readFileSync(STOCK, "utf8");
    expect(exportNames(oursText)).toEqual(exportNames(stockText));
    expect(exportNames(oursText)).toEqual(EXPORT_NAMES);
    // Row HOST thuần: không bộ nạp module nào ⇒ đếm id stock trong artifact phải là 0 ở CẢ HAI bên.
    expect(oursText).not.toContain("__ModuleLoader__");
    expect(oursText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    expect(stockText.match(/id: @deepseek-ai/g) ?? []).toEqual([]);
    // Chỉ MỘT mô-đun ngoài được nạp: schemastery (peer của kernel). Bản gốc nạp THÊM gói kho.
    expect([...(oursText.matchAll(/from "@deepseek-ai\//g))].length).toBe(1);
    expect([...(stockText.matchAll(/from "@deepseek-ai\//g))].length).toBe(2);
    expect(oursText).toContain('from "@deepseek-ai/schemastery"');
    expect(oursText).not.toContain("@deepseek-ai/dsh-storage");
    expect(exportNames(oursText)).not.toContain("default");
    expect(exportNames(stockText)).not.toContain("default");
    // Hằng nội bộ của seam KHÔNG được lọt ra bề mặt công khai (bản gốc cũng không export chúng).
    expect(ourMod.UNIT_NAME_RE).toBeUndefined();
    expect(ourMod.storageBackendServiceKey).toBeUndefined();
    expect(stockMod.UNIT_NAME_RE).toBeUndefined();
    expect(ourMod.DomainImpl).toBeUndefined();
    expect(stockMod.DomainImpl).toBeUndefined();
  });

  test("bề mặt service: name · inject · apply.length · Config · prototype — trùng bản gốc", () => {
    expect(ourMod.name).toBe(stockMod.name);
    expect(ourMod.name).toBe("storage-domain");
    expect(ourMod.inject).toEqual(stockMod.inject);
    expect(ourMod.inject).toEqual(["storage"]);
    expect(ourMod.apply.length).toBe(stockMod.apply.length);
    // Config: cùng chuỗi mô tả, cùng đầu ra, cùng câu lỗi khi thiếu backend bắt buộc.
    expect(String(ourMod.Config)).toBe(String(stockMod.Config));
    expect(ourMod.Config({ backend: "json" })).toEqual(stockMod.Config({ backend: "json" }));
    expect(ourMod.Config({ backend: "json", routes: { demo: "sqlite" } })).toEqual(
      stockMod.Config({ backend: "json", routes: { demo: "sqlite" } }),
    );
    const missingBackend = (schema: any): string => {
      try {
        schema({});
        return "(khong nem)";
      } catch (error) {
        return String((error as Error).message);
      }
    };
    expect(missingBackend(ourMod.Config)).toBe(missingBackend(stockMod.Config));
    for (const className of ["DomainError", "DomainFacility"]) {
      expect(prototypeNames(ourMod[className])).toEqual(prototypeNames(stockMod[className]));
    }
    expect(prototypeNames(ourMod.DomainFacility)).toEqual(["closeAll", "constructor", "get", "open"]);
    expect(ourMod.DomainError.prototype instanceof Error).toBe(true);
    expect(stockMod.DomainError.prototype instanceof Error).toBe(true);
  });
});

describe("khai báo miền — defineDomain / domainTable / descriptorOf A/B", () => {
  test("hợp lệ: trả CHÍNH spec (danh tính) và descriptor y hệt từng khoá", () => {
    const schema = { parse: (value: unknown) => value, safeParse: () => ({ success: true }) };
    for (const mod of [ourMod, stockMod]) {
      const spec = { name: "demo", version: 2, tables: { rows: { valueSchema: schema } } };
      expect(mod.defineDomain(spec)).toBe(spec);
      expect(Object.keys(mod.domainTable(schema))).toEqual(["valueSchema"]);
      expect(mod.domainTable(schema).valueSchema).toBe(schema);
    }
    const variants: any[] = [
      { name: "demo", version: 1, tables: { rows: { valueSchema: schema }, empty: { valueSchema: schema } } },
      { name: "demo", version: 3, layout: "single", tables: {} },
      { name: "demo", version: 3, layout: "per-record", compatibleVersions: [1, 2], tables: { rows: { valueSchema: schema } } },
      {
        name: "demo",
        version: 4,
        global: { schema: { parse: (v: unknown) => v, safeParse: (v: unknown) => ({ success: v !== null }) }, initial: { n: 1 } },
        tables: {},
      },
    ];
    for (const spec of variants) {
      const ours = ourMod.descriptorOf(spec);
      const theirs = stockMod.descriptorOf(spec);
      expect(JSON.stringify(ours)).toBe(JSON.stringify(theirs));
      expect(Object.keys(ours)).toEqual(Object.keys(theirs));
    }
    // `layout`/`compatibleVersions` KHÔNG được ghi thành khoá `undefined`.
    expect(Object.keys(ourMod.descriptorOf(variants[0]))).toEqual(["name", "version", "tables", "hasGlobal"]);
  });

  test("9 hình dạng SAI: cùng câu lỗi ở cả hai bên, không bên nào im lặng", () => {
    const schema = { parse: (value: unknown) => value, safeParse: () => ({ success: true }) };
    const base = (): any => ({ name: "demo", version: 2, tables: { rows: { valueSchema: schema } } });
    const mutations: { readonly label: string; readonly mutate: (spec: any) => void }[] = [
      { label: "tên miền sai mẫu", mutate: (spec) => { spec.name = "Demo"; } },
      { label: "version âm", mutate: (spec) => { spec.version = -1; } },
      { label: "version lẻ", mutate: (spec) => { spec.version = 1.5; } },
      { label: "compatibleVersions bằng version", mutate: (spec) => { spec.compatibleVersions = [2]; } },
      { label: "compatibleVersions âm", mutate: (spec) => { spec.compatibleVersions = [-1]; } },
      { label: "layout lạ", mutate: (spec) => { spec.layout = "multi"; } },
      { label: "invalidRecords lạ", mutate: (spec) => { spec.invalidRecords = "skip"; } },
      { label: "tên bảng sai mẫu", mutate: (spec) => { spec.tables = { Rows: { valueSchema: schema } }; } },
      {
        label: "global nhận null",
        mutate: (spec) => { spec.global = { schema: { parse: (v: unknown) => v, safeParse: () => ({ success: true }) }, initial: {} }; },
      },
    ];
    for (const { label, mutate } of mutations) {
      const oursSpec = base();
      const stockSpec = base();
      mutate(oursSpec);
      mutate(stockSpec);
      const ours = errorOf(() => ourMod.defineDomain(oursSpec));
      expect(label.length).toBeGreaterThan(0);
      expect(ours).not.toBe("(khong nem)");
      expect(ours).toBe(errorOf(() => stockMod.defineDomain(stockSpec)));
    }
  });

  test("zod THẬT đi qua seam kiểu: domainTable nhận ZodObject và parse chạy thật", () => {
    const schema = zod.object({ n: zod.number() });
    const table: DomainTableSpec<"k", { n: number }> = domainTable<"k", { n: number }>(schema);
    expect(table.valueSchema).toBe(schema);
    expect(table.valueSchema.parse({ n: 1 })).toEqual({ n: 1 });
    expect(() => table.valueSchema.parse({ n: "x" })).toThrow();
    expect(table.valueSchema.safeParse(null).success).toBe(false);
    // Cả hai bên chỉ BỌC schema, không sao chép: cùng thể hiện zod đi vào, cùng thể hiện đi ra.
    for (const mod of [ourMod, stockMod]) {
      expect(mod.domainTable(schema).valueSchema).toBe(schema);
    }
  });
});

describe("bảng + global trên Context cordis THẬT — A/B", () => {
  test("vòng đời bảng: ảnh chụp 22 trường TRÙNG cả hai bên", async () => {
    const snapshots = [];
    for (const side of SIDES) snapshots.push(await runTableScenario(side.mod()));
    expect(snapshots[0]).toEqual(snapshots[1]);
    const snapshot = snapshots[0];
    expect(snapshot?.domainName).toBe("demo");
    expect(snapshot?.sizeAfterOpen).toBe(2);
    expect(snapshot?.getA).toEqual({ n: 1 });
    expect(snapshot?.entries).toEqual([["a", { n: 1 }], ["b", { n: 2 }]]);
    expect(snapshot?.keys).toEqual(["a", "b"]);
    expect(snapshot?.sizeAfterPut).toBe(3);
    expect(snapshot?.updated).toEqual({ n: 4 });
    expect(snapshot?.deletePresent).toBe(true);
    expect(snapshot?.deleteMissing).toBe(false);
    expect(snapshot?.finalEntries).toEqual([["b", { n: 2 }], ["c", { n: 4 }]]);
    expect(snapshot?.snapshotIsDetached).toBe(true);
    // Thứ tự: BỀN TRƯỚC, rồi bộ nhớ, rồi sự kiện — vết sự kiện khớp đúng các lượt ghi đã bền.
    expect(snapshot?.trace).toEqual(["event:put:rows/c", "event:put:rows/c", "event:deleted:rows/a"]);
    expect(snapshot?.medium.puts).toEqual(['rows/c={"n":3}', 'rows/c={"n":4}']);
    expect(snapshot?.medium.deletes).toEqual(["rows/a"]);
    expect(snapshot?.medium.closes).toBe(1);
    expect(snapshot?.closeShared).toBe(true);
    expect(snapshot?.facilityAfterClose).toBe("undefined");
    expect(snapshot?.descriptor).toEqual({ name: "demo", version: 1, tables: ["rows", "empty"], hasGlobal: false });
    // Đường lỗi (so từng câu với bản gốc ở phép `toEqual` phía trên).
    expect(snapshot?.undeclaredTable).toContain("declares no table 'nope'");
    expect(snapshot?.noGlobal).toContain("declares no global");
    expect(snapshot?.alreadyOpen).toContain("already-open");
    expect(snapshot?.closedWrite).toContain("closed");
    expect(snapshot?.closedRead).toContain("closed");
  });

  test("global: initial trước set, set ghi bền + phát sự kiện, đọc lại global đã lưu, `null` ⇒ initial", async () => {
    for (const seed of [null, { theme: "stored" }]) {
      const snapshots = [];
      for (const side of SIDES) snapshots.push(await runGlobalScenario(side.mod(), seed));
      expect(snapshots[0]).toEqual(snapshots[1]);
      const snapshot = snapshots[0];
      expect(snapshot?.beforeSet).toEqual(seed === null ? { theme: "light" } : { theme: "stored" });
      expect(snapshot?.afterSet).toEqual({ theme: "dark" });
      expect(snapshot?.globals).toEqual(['{"theme":"dark"}']);
      expect(snapshot?.events).toEqual([{ domain: "demo", table: "", key: "", operation: "put", value: { theme: "dark" } }]);
    }
  });

  test("bền HỎNG (`putRecord` ném) ⇒ bộ nhớ KHÔNG đổi, KHÔNG sự kiện", async () => {
    const snapshots = [];
    for (const side of SIDES) {
      const hub = await makeHub({
        backends: [{ name: "json", options: { failPut: true, seed: { tables: { rows: { a: { n: 1 } } }, global: null } } }],
      });
      try {
        const facility = await mountDomain(hub, side.mod());
        const domain = await facility.open(makeSpec(side.mod()));
        const failure = await rejectionOf(() => domain.table("rows").put("b", { n: 2 }));
        snapshots.push({
          failure,
          size: domain.table("rows").size,
          getB: String(domain.table("rows").get("b")),
          events: hub.events.length,
          puts: unitOf(hub).puts.length,
        });
      } finally {
        await disposeHub(hub);
      }
    }
    expect(snapshots[0]).toEqual(snapshots[1]);
    expect(snapshots[0]?.failure).toContain("medium down");
    expect(snapshots[0]?.size).toBe(1);
    expect(snapshots[0]?.getB).toBe("undefined");
    expect(snapshots[0]?.events).toBe(0);
    expect(snapshots[0]?.puts).toBe(0);
  });
});

describe("ma trận đường lỗi — A/B", () => {
  test("8 ca lỗi: cùng name/code/message/detail, đơn vị mở hỏng vẫn được đóng", async () => {
    const snapshots = [];
    for (const side of SIDES) snapshots.push(await runErrorMatrix(side.mod()));
    expect(snapshots[0]).toEqual(snapshots[1]);
    const snapshot = snapshots[0];
    expect(snapshot?.backendNotFound).toContain("is not registered");
    expect(snapshot?.facetUnsupported).toContain("facet-unsupported");
    expect(snapshot?.invalidRecord).toContain("invalid-record");
    expect(snapshot?.invalidRecord).toContain('"table":"rows"');
    expect(snapshot?.invalidRecord).toContain('"key":"oops"');
    expect(snapshot?.invalidRecordCause).toBe("ZodError:invalid_type");
    expect(snapshot?.invalidGlobal).toContain("stored global does not match its schema");
    expect(snapshot?.invalidGlobal).toContain('"table":""');
    expect(snapshot?.missingKey).toContain("missing-key");
    expect(snapshot?.reopenAfterFailure).toBe("demo");
    // Đơn vị ĐẦU TIÊN của backend "bad" bị đóng ĐÚNG MỘT lần cho lượt mở hỏng của nó.
    expect(snapshot?.failedUnitCloses).toBe(1);
    expect(snapshot?.routedDescriptor).toEqual({ name: "demo", version: 1, tables: ["rows"], hasGlobal: false });
  });
});

describe("invalidRecords: 'backup-and-skip' — A/B", () => {
  test("có backupRecord: mở ĐƯỢC, bản ghi hỏng bị chuyển sang chỗ khác, log kèm cause", async () => {
    const snapshots = [];
    for (const side of SIDES) snapshots.push(await runBackupScenario(side.mod(), true));
    expect(snapshots[0]).toEqual(snapshots[1]);
    const snapshot = snapshots[0];
    expect(snapshot?.outcome).toEqual({ ok: true, keys: ["good"] });
    expect(snapshot?.backups).toEqual(["rows/oops"]);
    expect(snapshot?.unitCloses).toBe(0);
    expect(snapshot?.logs.length).toBe(1);
    expect(snapshot?.logs[0]).toContain("failed schema validation; moved to 'rows/oops.json.bak.1' and treated as absent");
    // `String(cause)` của ZodError là MẢNG ISSUE (không phải tên lớp) — giữ nguyên hành vi bản gốc.
    expect(snapshot?.logs[0]).toContain('"expected": "number"');
    expect(snapshot?.descriptor).toEqual({
      name: "demo",
      version: 1,
      tables: ["rows"],
      hasGlobal: false,
      layout: "per-record",
    });
  });

  test("KHÔNG có backupRecord: rơi về mặc định TỪ CHỐI, đơn vị vẫn được đóng", async () => {
    const snapshots = [];
    for (const side of SIDES) snapshots.push(await runBackupScenario(side.mod(), false));
    expect(snapshots[0]).toEqual(snapshots[1]);
    const snapshot = snapshots[0];
    expect(snapshot?.outcome.ok).toBe(false);
    expect(snapshot?.outcome.code).toBe("invalid-record");
    expect(snapshot?.backups).toEqual([]);
    expect(snapshot?.unitCloses).toBe(1);
    expect(snapshot?.logs).toEqual([]);
  });
});

describe("C6 — vật thể cấu hình phải ĐỘC LẬP (danh tính, không so sâu)", () => {
  test("hai facility: sổ/bảng RIÊNG, giữ ĐÚNG vật thể cấu hình của mình; hai miền cùng tên KHÔNG chia sẻ", async () => {
    for (const side of SIDES) {
      const mod = side.mod();
      const hub = await makeHub({
        backends: [{ name: "json", options: { seed: { tables: { rows: { a: { n: 1 } } }, global: null } } }],
      });
      try {
        const configA = { backend: "json", routes: {} };
        const configB = { backend: "json", routes: {} };
        const a = new mod.DomainFacility(hub.ctx, configA);
        const b = new mod.DomainFacility(hub.ctx, configB);
        expect(a).not.toBe(b);
        expect(a.config).not.toBe(b.config);
        expect(a.config).toBe(configA);
        expect(b.config).toBe(configB);
        expect(a.domains).not.toBe(b.domains);
        expect(a.reserved).not.toBe(b.reserved);
        expect(a.domains.size).toBe(0);
        const first = await a.open(makeSpec(mod));
        expect(a.domains.size).toBe(1);
        expect(b.domains.size).toBe(0);
        const second = await b.open(makeSpec(mod));
        expect(first).not.toBe(second);
        expect(a.get("demo")).toBe(first);
        expect(b.get("demo")).toBe(second);
        await first.table("rows").put("only-a", { n: 7 });
        expect(first.table("rows").get("only-a")).toEqual({ n: 7 });
        expect(second.table("rows").get("only-a")).toBeUndefined();
        expect(second.table("rows").size).toBe(1);
        // Hai handle global của hai miền là hai VẬT THỂ riêng (mở trên HAI facility khác).
        const c = new mod.DomainFacility(hub.ctx, { backend: "json" });
        const d = new mod.DomainFacility(hub.ctx, { backend: "json" });
        const g1 = await c.open(makeGlobalSpec(mod));
        const g2 = await d.open(makeGlobalSpec(mod));
        expect(g1).not.toBe(g2);
        expect(g1.global).not.toBe(g2.global);
        expect(g1.global.get()).toEqual(g2.global.get());
      } finally {
        await disposeHub(hub);
      }
    }
  });

  test("ảnh chụp entries()/keys() là vật thể MỚI mỗi lượt; bảng của hai miền không chia sẻ", async () => {
    for (const side of SIDES) {
      const mod = side.mod();
      const hub = await makeHub({
        backends: [{ name: "json", options: { seed: { tables: { rows: { a: { n: 1 } }, empty: {} }, global: null } } }],
      });
      try {
        const facility = await mountDomain(hub, mod);
        const domain = await facility.open(makeSpec(mod));
        const rows = domain.table("rows");
        const entriesA = rows.entries();
        const entriesB = rows.entries();
        expect(entriesA).not.toBe(entriesB);
        expect([...entriesA]).toEqual([...entriesB]);
        const keysA = rows.keys();
        const keysB = rows.keys();
        expect(keysA).not.toBe(keysB);
        const empty = domain.table("empty");
        expect(rows).not.toBe(empty);
        expect(empty.size).toBe(0);
        // Handle bảng ỔN ĐỊNH: gọi lặp lại trả CÙNG thể hiện.
        expect(domain.table("rows")).toBe(rows);
      } finally {
        await disposeHub(hub);
      }
    }
  });
});

describe("quy ước khai peer: gbh.peers ⊆ peerDependencies", () => {
  test("mọi tên trong gbh.peers đều có trong peerDependencies, đúng dải version của kernel", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    // Chống verdict RỖNG: xoá tên khỏi CẢ gbh.peers thì phép ⊆ dưới đây sẽ ĐẠT VÔ NGHĨA.
    expect([...peers].sort()).toEqual([...SEAM_PEERS].sort());
    expect(missingPeers(manifest)).toEqual([]);
    for (const peer of peers) expect(existsSync(join(REPO, "apps", "host", "node_modules", peer, "package.json"))).toBe(true);
    // Dải: (1) PHẢI BẰNG ĐÚNG dải manifest stock của gói, (2) PHẢI phủ bản kernel đang chạy — phép kiểm
    // MẠNH trong harness (stock khai dải alpha, kernel chạy bản không-alpha; vẫn chặn drift rc.5).
    expect(peerRangeProblems(PKG)).toEqual([]);
    // Peer không bao giờ nằm ở `dependencies` (sẽ tạo thể hiện THỨ HAI).
    expect(manifest.dependencies).toBeUndefined();
  });

  test("ĐỐI CHỨNG ÂM: xoá một peer khỏi peerDependencies ⇒ phép kiểm PHẢI báo ĐÚNG tên đó", () => {
    const manifest = readManifest();
    const peers = manifest.gbh?.peers ?? [];
    expect(peers.length).toBe(3);
    for (const peer of peers) {
      const mutated = cloneManifest(manifest);
      const declared = mutated.peerDependencies ?? {};
      delete declared[peer];
      mutated.peerDependencies = declared;
      expect(missingPeers(mutated)).toEqual([peer]);
    }
    // Xoá SẠCH ⇒ phải báo ĐỦ cả danh sách, không phải một con số.
    expect(missingPeers({ ...manifest, peerDependencies: {} })).toEqual([...peers].sort());
    // THỪA tên vẫn ĐẠT (⊆ chứ không phải =).
    const extra = cloneManifest(manifest);
    extra.peerDependencies = { ...(extra.peerDependencies ?? {}), "@deepseek-ai/khong-phai-peer": "~0.0.1" };
    expect(missingPeers(extra)).toEqual([]);
  });
});

describe("000e + ca 0c — hình dạng khai báo row", () => {
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
  });

  test("ca 0c: HÌNH DẠNG `gbh.row` do LEAD khai NGOÀI phiên viết gói + KHÔNG có nửa client", () => {
    const manifest = readManifest();
    expect(manifest.name).toBe("@galaxy-blackhole/gbh-storage-domain");
    expect(manifest.name?.startsWith("@galaxy-blackhole/gbh-")).toBe(true);
    // Recipe §7: đọc CẢ HAI dạng — `gbh.row` (đang mount) HOẶC `gbh.row_unmounted_ly_do.row` (đã gỡ mount).
    const row = (manifest.gbh?.row ?? manifest.gbh?.row_unmounted_ly_do?.row) as
      | { id?: string; config?: unknown; tests?: unknown; moduleIds?: unknown; aliases?: unknown }
      | undefined;
    expect(row).toBeDefined();
    // Phiên viết gói KHÔNG tự khai; Lead khai sau ba phép tiền-mount ⇒ ghi lại ĐÚNG hình dạng đã khai.
    expect(row?.id).toBe("storage-domain");
    // `config` LẤY TỪ ours.yml ĐANG CHẠY (row trần, không `!!js`) — không phải từ oracleA_nopatch.
    expect(row?.config).toEqual({ backend: "json" });
    expect(row?.tests).toEqual(["tests/host/storage-domain.test.ts"]);
    // Row MỘT MẶT ⇒ KHÔNG id module/alias (không có entry browser nào để trỏ tới).
    expect(row?.moduleIds).toBeUndefined();
    expect(row?.aliases).toBeUndefined();
    expect(manifest.dsh?.client).toBeUndefined();
    expect(existsSync(join(PKG, "src", "client.ts"))).toBe(false);
    // Điều kiện cổng `hygiene` (dòng §4) — có mặt ngay từ lượt viết gói.
    expect(readFileSync(join(REPO, "packages", "README.md"), "utf8")).toContain("host/storage-domain");
  });
});
