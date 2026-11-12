/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test canh row file-upload: metadata phải MIRROR đúng row gốc (inject + immediately),
 *      bề mặt export trên ARTIFACT, khối gbh.row (id · moduleIds · tests), quy ước peer,
 *      locale byte-for-byte, và bước 0 trên oracle dump mới nhất.
 */

import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Fixture thật của hợp đồng C1. */
const FIXTURE = join(import.meta.dir, "..", "contract", "fixtures", "c1-boot-graph.json");
/** Package của ta cho row này. */
const PACKAGE_JSON = join(import.meta.dir, "..", "..", "packages", "client", "file-upload", "package.json");
/** Thư mục package của ta. */
const PKG = join(import.meta.dir, "..", "..", "packages", "client", "file-upload");
/** Bản gốc của row (CHỈ ĐỌC) để đối chiếu bề mặt khai báo. */
const STOCK_DIR = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-file-upload");
/** Manifest bản gốc. */
const STOCK_JSON = join(STOCK_DIR, "package.json");

/** Tên package của ta. */
const OUR_NAME = "@galaxy-blackhole/gbh-client-file-upload";

/** Hình dạng manifest cần đọc. */
interface Manifest {
  /** Tên package. */
  name?: string;
  /** Bảng export. */
  exports?: Record<string, unknown>;
  /** Metadata nửa client của DSH. */
  dsh?: { client?: { inject?: string[]; immediately?: boolean; platform?: string } };
  /** Peer bắt buộc. */
  peerDependencies?: Record<string, string>;
  /** Phụ thuộc thường (peer KHÔNG được nằm ở đây). */
  dependencies?: Record<string, string>;
  /** Metadata row của ta. */
  gbh?: {
    /** Khối thay row. */
    row?: { id?: string; moduleIds?: string[]; aliases?: string[]; tests?: string[]; config?: unknown; inject?: unknown };
    /** Peer bổ sung. */
    peers?: string[];
  };
}

/**
 * Đọc một file JSON có kiểu.
 * @param path - đường dẫn tuyệt đối.
 * @returns object đã parse.
 */
function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/**
 * Đọc manifest của package ta.
 * @returns manifest đã parse.
 */
function ours(): Manifest {
  return readJson<Manifest>(PACKAGE_JSON);
}

/**
 * Băm sha256 một file — dùng cho phép đối chứng TỪNG BYTE.
 * @param path - đường dẫn file.
 * @returns hex sha256.
 */
function sha256Of(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/**
 * Tên export trong một file ESM đã build (cùng hai regex mà check:rows dùng).
 * @param text - nội dung file.
 * @returns danh sách tên export đã sắp xếp.
 */
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
 * Tên peer còn THIẾU: phần tử gbh.peers không có trong peerDependencies (so PHẦN TỬ, không so số lượng).
 * @param manifest - manifest cần kiểm.
 * @returns tên thiếu đã sắp xếp — RỖNG mới là đạt.
 */
function missingPeers(manifest: Manifest): string[] {
  const declared = new Set(Object.keys(manifest.peerDependencies ?? {}));
  return (manifest.gbh?.peers ?? []).filter((peer) => !declared.has(peer)).sort();
}

describe("file-upload — metadata phải khớp row gốc", () => {
  test("row gốc: inject đúng 1 gói, immediately TRUE, không external", () => {
    const capture = readJson<{ entries: { id: string; inject?: string[]; external?: string[]; immediately?: boolean }[] }>(FIXTURE);
    const row = capture.entries.find((entry) => entry.id === "@deepseek-ai/dsh-client-file-upload");
    expect(row).toBeDefined();
    expect(row?.inject).toEqual(["@deepseek-ai/dsh-api-remotes"]);
    expect(row?.immediately).toBe(true);
    expect(row?.external).toBeUndefined();
  });

  test("2 row inject nó như DỊCH VỤ, 0 external require; nhưng api-remotes mang TYPERT_REMOTE ⇒ alias bắt buộc", () => {
    const capture = readJson<{ entries: { id: string; inject?: string[]; external?: string[] }[] }>(FIXTURE);
    const target = "@deepseek-ai/dsh-client-file-upload";
    const injectors = capture.entries.filter((entry) => (entry.inject ?? []).includes(target)).map((entry) => entry.id);
    expect(injectors.sort()).toEqual(["@deepseek-ai/dsh-api-session-controller", "@deepseek-ai/dsh-client-ui-conversation"]);
    expect(capture.entries.filter((entry) => (entry.external ?? []).some((spec) => spec.startsWith(target)))).toEqual([]);
  });

  test("dsh.client của TA mirror đúng bản gốc (inject + immediately + platform)", () => {
    const mine = ours();
    const stock = readJson<Manifest>(STOCK_JSON);
    expect(mine.name).toBe(OUR_NAME);
    // 20/10/2026 — ID gói đã REWRITE CÓ CHỦ ĐÍCH sang @galaxy-blackhole/gbh-*: quy id ta → id stock rồi so
    //   DEEP-EQUAL (sameAfterIdMap giữ THỨ TỰ), KHÔNG nới contains.
    expect(sameAfterIdMap(mine.dsh?.client?.inject, stock.dsh?.client?.inject)).toBe(true);
    expect(mine.dsh?.client?.immediately).toBe(stock.dsh?.client?.immediately);
    expect(mine.dsh?.client?.platform).toBe("web");
    expect(mine.exports?.["./client"]).toBeDefined();
    expect(mine.exports?.["./locale/*.json"]).toBeDefined();
  });

  test("id stock CHỈ nằm ở aliases (không ở moduleIds) — 3 entry vẫn inject/require id đó", () => {
    const row = ours().gbh?.row;
    expect(row?.aliases).toEqual(["@deepseek-ai/dsh-client-file-upload"]);
    expect(row?.moduleIds).toEqual([OUR_NAME]);
    expect(row?.moduleIds).not.toContain("@deepseek-ai/dsh-client-file-upload");
  });
});

describe("file-upload — khối gbh.row (hợp đồng mount)", () => {
  test("row id đúng id stock, moduleIds[0] = tên package ta, KHÔNG có config/inject (row trần như dump)", () => {
    const row = ours().gbh?.row;
    expect(row).toBeDefined();
    expect(row?.id).toBe("file-upload");
    expect(row?.moduleIds).toEqual([OUR_NAME]);
    expect(row?.config).toBeUndefined();
    expect(row?.inject).toBeUndefined();
  });

  test("mọi tệp test khai trong gbh.row đều TỒN TẠI", () => {
    const tests = ours().gbh?.row?.tests ?? [];
    expect(tests.length).toBeGreaterThan(0);
    for (const rel of tests) expect(existsSync(join(import.meta.dir, "..", "..", rel))).toBe(true);
  });

  test("quy ước peer: gbh.peers ⊆ peerDependencies + dependencies RỖNG; ĐỐI CHỨNG ÂM", () => {
    const mine = ours();
    expect(missingPeers(mine)).toEqual([]);
    expect(Object.keys(mine.dependencies ?? {})).toEqual([]);
    expect(mine.gbh?.peers).toEqual(["@deepseek-ai/dsh-typert-protocol"]);
    const broken: Manifest = JSON.parse(JSON.stringify(mine)) as Manifest;
    broken.peerDependencies = { "@deepseek-ai/cordis": "~4.0.5" };
    expect(missingPeers(broken)).toEqual(["@deepseek-ai/dsh-typert-protocol"]);
    const extra: Manifest = JSON.parse(JSON.stringify(mine)) as Manifest;
    extra.gbh = { ...extra.gbh, peers: ["@deepseek-ai/not-allowed"] };
    expect(missingPeers(extra)).toEqual(["@deepseek-ai/not-allowed"]);
  });
});

describe("file-upload — ARTIFACT và bằng chứng 000e", () => {
  test("nửa host: tập export = ĐÚNG tập của bundle gốc (FileUploads + default), KHÔNG có apply", () => {
    const built = join(PKG, "lib", "index.js");
    expect(existsSync(built)).toBe(true);
    const mine = exportNames(readFileSync(built, "utf8"));
    const stock = exportNames(readFileSync(join(STOCK_DIR, "lib", "index.js"), "utf8"));
    expect(mine).toEqual(stock);
    expect(mine).toEqual(["FileUploads", "default"]);
  });

  test("nửa client: MỘT id module (của ta), 0 id gốc, CJS nạp bằng thẻ script", () => {
    const client = readFileSync(join(PKG, "lib", "client.js"), "utf8");
    expect([...client.matchAll(/__ModuleLoader__\.load\(/g)].length).toBe(1);
    expect([...client.matchAll(/id:\s*"@deepseek-ai/g)].length).toBe(0);
    expect([...client.matchAll(/id:\s*"@galaxy-blackhole/g)].length).toBe(1);
    expect(client).not.toMatch(/^\s*export\s/m);
    expect(client).toContain("factory: (require) =>");
  });

  test("build.ts build CẢ HAI nửa (host ESM + client CJS bọc __ModuleLoader__.load)", () => {
    const build = readFileSync(join(PKG, "build.ts"), "utf8");
    expect(build).toContain('"index.ts"');
    expect(build).toContain('"client.ts"');
    expect(build).toContain("wrapClientBundle");
    expect([...build.matchAll(/Bun\.build\s*\(/g)].length).toBe(2);
  });

  test("000e: locale/{en,zh}.json của TA byte-for-byte với bản gốc", () => {
    for (const name of ["en.json", "zh.json"]) {
      const stockPath = join(STOCK_DIR, "locale", name);
      const minePath = join(PKG, "locale", name);
      expect(statSync(minePath).size).toBe(statSync(stockPath).size);
      expect(sha256Of(minePath)).toBe(sha256Of(stockPath));
    }
  });

  test.skipIf(!existsSync(join(import.meta.dir, "..", "..", ".parity", "dumps")))("bước 0: row `file-upload` trong oracle dump mới nhất = row TRẦN, tên đúng gói gốc", () => {
    const dumps = join(import.meta.dir, "..", "..", ".parity", "dumps");
    const newest = readdirSync(dumps)
      .filter((name) => existsSync(join(dumps, name, "ours.yml")))
      .sort()
      .pop() as string;
    const lines = readFileSync(join(dumps, newest, "ours.yml"), "utf8").split("\n");
    const index = lines.findIndex((line) => line.trim() === "- id: file-upload");
    expect(index).toBeGreaterThanOrEqual(0);
    expect(lines[index + 1]?.trim()).toBe("name: '@deepseek-ai/dsh-client-file-upload'");
    const next = lines[index + 2]?.trim() ?? "";
    expect(next.startsWith("- ") || next.startsWith("#")).toBe(true);
  });
});
