/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Cổng parity metadata cho tool-jobs: đo dump oracle MỚI NHẤT (1 row TOP-LEVEL disabled + 3 entry LỒNG trong preset-standard/ptc/cordis, KHÔNG config/inject/disabled) rồi đối chiếu gbh.nested + gbh.row_unmounted_ly_do; khẳng định gói MỘT MẶT và CHƯA mount/flip.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói cần kiểm. */
const PACKAGE_DIR = join(REPO, "packages", "host", "tool-jobs");

/** Một lần xuất hiện của id 'tool-jobs' trong dump. */
interface Occurrence {
  /** Dòng 1-based của '- id: tool-jobs'. */
  line: number;
  /** Số space thụt lề (0 = top-level, 6 = entry lồng trong preset). */
  indent: number;
  /** Các dòng thuộc block của row (không gồm dòng '- id'). */
  block: string[];
  /** Tập khoá cấp 1 trong block (name/config/inject/disabled/...). */
  keys: string[];
  /** Giá trị thô của disabled, hoặc undefined khi row không khai. */
  disabled?: string;
}

/**
 * Dump oracle mới nhất trong repo có oracleA_nopatch.yml.
 * Nhận: không.
 * Trả: đường dẫn tuyệt đối tới dump.
 * @throws {Error} khi chưa có dump nào.
 */
function latestDump(): string {
  const root = join(REPO, ".parity", "dumps");
  const dirs = readdirSync(root)
    .filter((name) => existsSync(join(root, name, "oracleA_nopatch.yml")))
    .sort();
  const last = dirs[dirs.length - 1];
  if (last === undefined) throw new Error("không tìm thấy dump oracle");
  return join(root, last, "oracleA_nopatch.yml");
}

/**
 * Đọc manifest JSON của gói.
 * Nhận: không.
 * Trả: object manifest.
 */
function manifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(PACKAGE_DIR, "package.json"), "utf8")) as Record<string, unknown>;
}

/**
 * Cắt block của MỌI lần xuất hiện '- id: tool-jobs' theo đúng thụt lề (không đoán theo thứ tự).
 * Nhận: text — nội dung dump YAML.
 * Trả: mảng lần xuất hiện kèm dòng, indent, khoá cấp 1 và disabled thô.
 */
function occurrences(text: string): Occurrence[] {
  const lines = text.split("\n");
  const out: Occurrence[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const head = /^(\s*)- id: tool-jobs$/.exec(lines[i] ?? "");
    if (head === null) continue;
    const indent = (head[1] ?? "").length;
    const block: string[] = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const line = lines[j] ?? "";
      const sibling = /^(\s*)- id:/.exec(line);
      if (sibling !== null && (sibling[1] ?? "").length <= indent) break;
      if (line.startsWith("# ==")) break;
      block.push(line);
    }
    const keys: string[] = [];
    let disabled: string | undefined;
    const keyPattern = new RegExp("^ {" + String(indent + 2) + "}([A-Za-z_][A-Za-z0-9_]*):(.*)$");
    for (const line of block) {
      const key = keyPattern.exec(line);
      if (key === null) continue;
      const name = key[1] ?? "";
      keys.push(name);
      if (name === "disabled") disabled = (key[2] ?? "").trim();
    }
    out.push({ line: i + 1, indent, block, keys, disabled });
  }
  return out;
}

/**
 * Tìm row bao quanh một entry lồng (row gần nhất phía trên có thụt lề nhỏ hơn).
 * Nhận: lines — các dòng dump; hit — entry cần tìm cha.
 * Trả: id row cha + config.id của nó, hoặc undefined khi entry là top-level.
 */
function enclosingPreset(lines: string[], hit: Occurrence): { id: string; configId: string } | undefined {
  for (let i = hit.line - 2; i >= 0; i -= 1) {
    const head = /^(\s*)- id: (.+)$/.exec(lines[i] ?? "");
    if (head === null) continue;
    const indent = (head[1] ?? "").length;
    if (indent >= hit.indent) continue;
    let end = lines.length;
    for (let j = i + 1; j < lines.length; j += 1) {
      const sibling = /^(\s*)- id:/.exec(lines[j] ?? "");
      if ((sibling !== null && (sibling[1] ?? "").length <= indent) || (lines[j] ?? "").startsWith("# ==")) {
        end = j;
        break;
      }
    }
    const configId = /^ {4}id:\s*(.+)$/m.exec(lines.slice(i, end).join("\n"));
    return { id: (head[2] ?? "").trim(), configId: (configId?.[1] ?? "").trim() };
  }
  return undefined;
}

describe("A. Manifest — metadata row/nested khớp số đo dump", () => {
  // 20/10/2026 (Lead mount 6 gói host-tool): row ĐÃ KHAI + mount ⇒ bất biến mới là `gbh.row` ĐỦ field.
  test("A1 · gbh.nested ĐÚNG 4 khoá kind/pluginId/stockId/presets; gbh.row ĐÃ KHAI đủ field", () => {
    const gbh = manifest().gbh as { row?: Record<string, unknown>; nested?: Record<string, unknown> };
    expect(gbh.row?.["id"]).toBe("tool-jobs");
    expect(gbh.row?.["moduleIds"]).toEqual(["@galaxy-blackhole/gbh-tool-jobs"]);
    expect(gbh.row?.["aliases"]).toEqual(["@deepseek-ai/dsh-tool-jobs"]);
    expect(gbh.row?.["hostAliases"]).toEqual(["@deepseek-ai/dsh-tool-jobs"]);
    expect(Object.keys(gbh.nested ?? {}).sort()).toEqual(["kind", "pluginId", "presets", "stockId"]);
    expect(gbh.nested?.kind).toBe("preset");
    expect(gbh.nested?.pluginId).toBe("tool-jobs");
    expect(gbh.nested?.stockId).toBe("@deepseek-ai/dsh-tool-jobs");
    expect(gbh.nested?.presets).toEqual(["preset-standard", "preset-ptc", "preset-cordis"]);
  });

  test("A2 · KHÔNG còn park: row_unmounted_ly_do vắng; row khai đủ tests + đối chứng dump giữ ở mục B", () => {
    const gbh = manifest().gbh as { row_unmounted_ly_do?: unknown; row?: { tests?: string[] } };
    expect(gbh.row_unmounted_ly_do).toBeUndefined();
    expect(gbh.row?.tests).toEqual(["tests/host/tool-jobs.test.ts", "tests/host/tool-jobs-manifest.test.ts"]);
  });

  test("A3 · row ĐÃ KHAI đúng khoá id/moduleIds/aliases/hostAliases/tests; KHÔNG config/inject", () => {
    const gbh = manifest().gbh as { row?: Record<string, unknown> };
    const row = gbh.row;
    expect(row).toBeDefined();
    expect(Object.keys(row ?? {}).sort()).toEqual(["aliases", "hostAliases", "id", "moduleIds", "tests"]);
    expect(row?.id).toBe("tool-jobs");
    expect(row?.config).toBeUndefined();
    expect(row?.inject).toBeUndefined();
    expect(row?.moduleIds).toEqual(["@galaxy-blackhole/gbh-tool-jobs"]);
    expect(row?.aliases).toEqual(["@deepseek-ai/dsh-tool-jobs"]);
    expect(row?.hostAliases).toEqual(["@deepseek-ai/dsh-tool-jobs"]);
    expect(row?.tests).toEqual(["tests/host/tool-jobs.test.ts", "tests/host/tool-jobs-manifest.test.ts"]);
  });

  test("A4 · tên gói + gbh.tests trỏ CẢ test A/B lẫn cổng manifest", () => {
    const meta = manifest();
    expect(meta.name).toBe("@galaxy-blackhole/gbh-host-tool-jobs");
    expect(meta.gbh).toMatchObject({ tests: ["tests/host/tool-jobs.test.ts", "tests/host/tool-jobs-manifest.test.ts"] });
    for (const file of ["tests/host/tool-jobs.test.ts", "tests/host/tool-jobs-manifest.test.ts"]) {
      expect(existsSync(join(REPO, file))).toBe(true);
    }
  });
});

describe("B. Dump oracle — đúng 4 vị trí, top-level disabled, 3 entry lồng trần", () => {
  test("B1 · đúng 4 lần '- id: tool-jobs': 1 ở indent 0 + 3 ở indent 6", () => {
    const hits = occurrences(readFileSync(latestDump(), "utf8"));
    expect(hits).toHaveLength(4);
    expect(hits.filter((hit) => hit.indent === 0)).toHaveLength(1);
    expect(hits.filter((hit) => hit.indent === 6)).toHaveLength(3);
  });

  test("B2 · top-level chỉ id + name + disabled: true; KHÔNG config/inject", () => {
    const top = occurrences(readFileSync(latestDump(), "utf8")).find((hit) => hit.indent === 0);
    expect(top).toBeDefined();
    expect(top?.keys.sort()).toEqual(["disabled", "name"]);
    expect(top?.disabled).toBe("true");
    expect(top?.block.some((line) => /^\s{2}(config|inject):/.test(line))).toBe(false);
  });

  test("B3 · 3 entry lồng chỉ id + name; KHÔNG config/inject/disabled", () => {
    const nested = occurrences(readFileSync(latestDump(), "utf8")).filter((hit) => hit.indent === 6);
    expect(nested).toHaveLength(3);
    for (const hit of nested) {
      expect(hit.keys.sort()).toEqual(["name"]);
      expect(hit.disabled).toBeUndefined();
      expect(hit.block.some((line) => /^\s{8}(config|inject|disabled):/.test(line))).toBe(false);
    }
  });

  test("B4 · 3 entry lồng nằm trong preset-standard/ptc/cordis (config.id standard/ptc/cordis)", () => {
    const lines = readFileSync(latestDump(), "utf8").split("\n");
    const nested = occurrences(lines.join("\n")).filter((hit) => hit.indent === 6);
    const parents = nested.map((hit) => enclosingPreset(lines, hit));
    expect(parents.map((parent) => parent?.id)).toEqual(["preset-standard", "preset-ptc", "preset-cordis"]);
    expect(parents.map((parent) => parent?.configId)).toEqual(["standard", "ptc", "cordis"]);
  });

  test("B5 · manifest mirror ĐÚNG đo được: top-level dump disabled: true; row metadata KHÔNG config/inject (disabled do cơ chế mount quyết)", () => {
    const dump = readFileSync(latestDump(), "utf8");
    const top = occurrences(dump).find((hit) => hit.indent === 0);
    const gbh = manifest().gbh as { row?: Record<string, unknown>; nested?: { config?: unknown } };
    const row = gbh.row;
    expect(top?.disabled).toBe("true");
    expect(row?.config).toBeUndefined();
    expect(row?.inject).toBeUndefined();
    expect(gbh.nested?.config).toBeUndefined();
  });
});

describe("C. Gói MỘT MẶT — stock không có dsh.client nên park, chưa flip", () => {
  test("C1 · stock KHÔNG dsh.client / exports['./client'] / lib/client.js", () => {
    const dir = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-jobs");
    const stock = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { dsh?: unknown; exports?: Record<string, unknown> };
    expect(stock.dsh).toBeUndefined();
    expect(stock.exports?.["./client"]).toBeUndefined();
    expect(existsSync(join(dir, "lib", "client.js"))).toBe(false);
    expect(existsSync(join(dir, "lib", "index.js"))).toBe(true);
  });

  test("C2 · gói ta cũng MỘT MẶT (không dsh.client/exports './client'); row ĐÃ KHAI đủ field", () => {
    const meta = manifest() as { dsh?: unknown; exports?: Record<string, unknown>; gbh?: { row?: Record<string, unknown> } };
    expect(meta.dsh).toBeUndefined();
    expect(meta.exports?.["./client"]).toBeUndefined();
    expect(meta.gbh?.row?.["id"]).toBe("tool-jobs");
    expect(existsSync(join(PACKAGE_DIR, "lib", "client.js"))).toBe(false);
  });
});
