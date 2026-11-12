/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Test CỔNG PARITY METADATA của @galaxy-blackhole/gbh-command-goal (tách khỏi command-goal.test.ts
 *      08/11/2026 để giữ luật ≤1000 dòng/tệp, nguyên văn 3 ca): gbh.row + gbh.nested mirror đúng dump
 *      2026-10-18T01-31-57, và manifest (tên gói · peers theo stock · tests trùng đích · không dsh.client).
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (file này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Package của ta. */
const PKG = join(REPO, "packages", "host", "command-goal");
/** Dump đối chiếu mà cổng parity chỉ định. */
const DUMP_FILE = join(REPO, ".parity", "dumps", "2026-10-18T01-31-57", "ours.yml");
/** Manifest gốc — nguồn peerDependencies của bản stock. */
const STOCK_MANIFEST = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-command-goal", "package.json");
/** Đường dẫn test do gói tự khai (gbh.tests + gbh.row.tests). */
const TEST_PATH = "tests/host/command-goal.test.ts";

/** Hình dạng manifest mà cổng parity đọc. */
interface Manifest {
  /** Tên package. */
  readonly name?: string;
  /** Khoá cấu hình của kernel (phải KHÔNG có). */
  readonly dsh?: unknown;
  /** Khối khai báo của gói ta. */
  readonly gbh?: {
    /** Đường dẫn test do gói khai. */
    readonly tests?: string[];
    /** Row thay thế. */
    readonly row?: Record<string, unknown>;
    /** Khai báo row LỒNG. */
    readonly nested?: Record<string, unknown>;
    /** Danh sách peer CHỌN LỌC. */
    readonly peers?: readonly string[];
  };
}

/** Hình dạng một row đọc từ dump. */
interface DumpRow {
  /** Tên package. */
  name: string;
  /** Giá trị disabled (undefined = row không khai). */
  disabled: boolean | undefined;
  /** Các khoá cấp 1 trong config. */
  configKeys: string[];
  /** Các entry inject. */
  inject: string[];
}

/**
 * Đọc manifest của gói ta.
 * @returns object JSON đã parse.
 */
function manifest(): Manifest {
  return JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as Manifest;
}

/**
 * Trích MỘT row TOP-LEVEL (thụt lề 0) trong dump YAML.
 * @param text - nội dung dump.
 * @param id - id row cần tìm.
 * @returns hình dạng row (name/disabled/configKeys/inject).
 */
function dumpRow(text: string, id: string): DumpRow {
  const lines = text.split(String.fromCharCode(10));
  const start = lines.findIndex((line) => line === "- id: " + id);
  if (start === -1) throw new Error("không thấy row " + id + " trong dump");
  const row: DumpRow = { name: "", disabled: undefined, configKeys: [], inject: [] };
  let inConfig = false;
  let inInject = false;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.startsWith("- ") || line.startsWith("# ==")) break;
    const nameMatch = /^ {2}name: '?([^']+)'?$/.exec(line);
    if (nameMatch !== null) {
      row.name = nameMatch[1] ?? "";
      continue;
    }
    const disabledMatch = /^ {2}disabled: (true|false)$/.exec(line);
    if (disabledMatch !== null) {
      row.disabled = disabledMatch[1] === "true";
      continue;
    }
    if (line === "  config:") {
      inConfig = true;
      continue;
    }
    if (line === "  inject:") {
      inInject = true;
      continue;
    }
    if (inConfig) {
      const match = /^ {4}([A-Za-z_][\w]*):/.exec(line);
      if (match !== null) row.configKeys.push(match[1] ?? "");
    }
    if (inInject) {
      const match = /^ {4}- (.+)$/.exec(line);
      if (match !== null) row.inject.push((match[1] ?? "").trim());
    }
  }
  return row;
}

/**
 * Liệt kê các preset chứa entry LỒNG "- id: <id>" (entry phải thụt lề; row top-level bị bỏ).
 * @param text - nội dung dump.
 * @param id - id plugin lồng.
 * @returns id preset theo thứ tự xuất hiện.
 */
function nestedPresets(text: string, id: string): string[] {
  const out: string[] = [];
  let preset = "";
  const entry = new RegExp("^\\s+- id: " + id + "$");
  for (const line of text.split(String.fromCharCode(10))) {
    const presetMatch = /^- id: (preset-[a-z-]+)$/.exec(line);
    if (presetMatch !== null) {
      preset = presetMatch[1] ?? "";
      continue;
    }
    if (preset !== "" && entry.test(line)) out.push(preset);
  }
  return out;
}

/**
 * Số dòng (1-based) của mọi dòng khớp một biểu thức trong dump.
 * @param text - nội dung dump.
 * @param pattern - biểu thức cần khớp.
 * @returns mảng số dòng.
 */
function lineNumbers(text: string, pattern: RegExp): number[] {
  const out: number[] = [];
  const lines = text.split(String.fromCharCode(10));
  for (let index = 0; index < lines.length; index += 1) {
    if (pattern.test(lines[index] ?? "")) out.push(index + 1);
  }
  return out;
}

describe("D · cổng parity metadata (dump 2026-10-18T01-31-57)", () => {
  test("gbh.row mirror ĐÚNG top-level 280–282: {id, insertDisabled, disabled, tests}, KHÔNG config/inject", () => {
    const gbh = manifest().gbh;
    // 19/10/2026 (Lead chốt): row INSERT phải tắt theo row stock đang disabled:true (tiền lệ session-title-first-prompt-llm).
    expect(gbh?.row).toEqual({ id: "command-goal", insertDisabled: true, disabled: true, tests: [TEST_PATH] });
    expect(Object.keys(gbh?.row ?? {})).toEqual(["id", "insertDisabled", "disabled", "tests"]);
    const dump = readFileSync(DUMP_FILE, "utf8");
    const row = dumpRow(dump, "command-goal");
    expect(row.name).toBe("@deepseek-ai/dsh-command-goal");
    expect(row.disabled).toBe(true);
    expect(row.configKeys).toEqual([]);
    expect(row.inject).toEqual([]);
    expect(gbh?.row?.disabled).toBe(row.disabled);
    expect(gbh?.row?.config).toBeUndefined();
    expect(gbh?.row?.inject).toBeUndefined();
    expect(lineNumbers(dump, /^- id: command-goal$/)).toEqual([280]);
    expect(lineNumbers(dump, /^  disabled: true$/)).toContain(282);
  });

  test("gbh.nested mirror ĐÚNG 3 entry LỒNG 839/1003/1266: standard · ptc · cordis, KHÔNG minimal", () => {
    const dump = readFileSync(DUMP_FILE, "utf8");
    expect(nestedPresets(dump, "command-goal")).toEqual(["preset-standard", "preset-ptc", "preset-cordis"]);
    expect(lineNumbers(dump, /^\s+- id: command-goal$/)).toEqual([839, 1003, 1266]);
    expect(manifest().gbh?.nested).toEqual({
      kind: "preset",
      pluginId: "command-goal",
      stockId: "@deepseek-ai/dsh-command-goal",
      presets: ["preset-standard", "preset-ptc", "preset-cordis"],
    });
  });

  test("manifest: tên package · peers = peerDependencies của stock · tests trùng đích · không dsh.client", () => {
    const pkg = manifest();
    expect(pkg.name).toBe("@galaxy-blackhole/gbh-command-goal");
    const stock = JSON.parse(readFileSync(STOCK_MANIFEST, "utf8")) as { peerDependencies: Record<string, string> };
    expect(pkg.gbh?.peers).toEqual(Object.keys(stock.peerDependencies));
    expect(Object.keys(stock.peerDependencies).sort()).toEqual(
      ["@deepseek-ai/cordis", "@deepseek-ai/dsh-commands", "@deepseek-ai/dsh-goal", "@deepseek-ai/dsh-llm"].sort(),
    );
    expect(pkg.gbh?.tests).toEqual([TEST_PATH]);
    expect(pkg.dsh).toBeUndefined();
    expect(existsSync(join(PKG, "build.ts"))).toBe(true);
    expect(existsSync(join(PKG, "tsconfig.json"))).toBe(true);
    expect(existsSync(join(PKG, "README.md"))).toBe(true);
    expect(existsSync(join(PKG, "src", "index.ts"))).toBe(true);
    expect(existsSync(join(REPO, TEST_PATH))).toBe(true);
  });
});
