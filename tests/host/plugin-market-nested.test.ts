/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B cho phần ROW LỒNG của 'tool-plugin-market': so DU LIEU CAU HINH (id · ten · subpath /tools ·
 *      disabled) giua ba patch preset cua kernel (A) va du lieu 'gbh.nested' cua ta (B). KHONG ky vong tool
 *      list o scope preset — do la hanh vi cua DSH (tool vao runtime Agent/session; ADR-0007 §7.4: A == B 12/12).
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NESTED_ROWS, type NestedRowDeclaration } from "../../packages/host/plugin-market/src/nested-rows.ts";
import { NESTED_ROW_ID, PACKAGE_NAME, STOCK_PACKAGE_NAME, TOOLS_SUBPATH } from "../../packages/host/plugin-market/src/ids.ts";
import { buildPackage } from "../../packages/host/plugin-market/build.ts";

/** Gốc repo (tệp này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục preset của kernel — nguồn A. */
const PRESETS = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-web-app/presets");
/** Package gốc — đối chiếu exports. */
const STOCK_DIR = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-plugin-market");
/** Package của ta. */
const OURS = join(REPO, "packages/host/plugin-market");

/** Kết quả parse một khối row lồng trong patch preset. */
interface ParsedRow {
  /** Id row đọc được. */
  readonly id: string;
  /** Tên package + subpath đọc được. */
  readonly name: string;
  /** Điều kiện disabled đọc được (chuỗi thô sau dấu hai chấm). */
  readonly disabled: string;
}

/**
 * Đọc khối `- id: tool-plugin-market` trong một patch preset (YAML nhỏ, parse bằng dòng).
 * Nhận: tên preset (standard · ptc · cordis).
 * Trả: row đọc được, hoặc null khi preset không khai row này.
 */
function readPresetRow(preset: string): ParsedRow | null {
  const text = readFileSync(join(PRESETS, preset + ".patch.yml"), "utf8");
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.trim() === "- id: " + NESTED_ROW_ID);
  if (start === -1) return null;
  let id = NESTED_ROW_ID;
  let name = "";
  let disabled = "";
  for (const line of lines.slice(start + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("- id: ")) break;
    if (trimmed.startsWith("id: ")) id = trimmed.slice(4).trim();
    if (trimmed.startsWith("name: ")) name = trimmed.slice(6).trim().replace(/^'|'$/g, "");
    if (trimmed.startsWith("disabled: ")) disabled = trimmed.slice(10).trim();
  }
  return { id, name, disabled };
}

/** Đọc trường exports của một package.json. Nhận: đường dẫn package. Trả: bảng exports. */
function readExports(dir: string): Record<string, unknown> {
  const json = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { exports?: Record<string, unknown> };
  return json.exports ?? {};
}

/** Chuẩn hoá một giá trị exports về chuỗi đường dẫn (`{types,default}` ⇒ `default`). */
function specifierOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value !== null && typeof value === "object" && typeof (value as { default?: unknown }).default === "string") {
    return (value as { default: string }).default;
  }
  throw new Error("exports khong co duong dan mac dinh: " + JSON.stringify(value));
}

describe("plugin-market — ROW LỒNG tool-plugin-market: A (patch preset kernel) vs B (gbh.nested của ta)", () => {
  const presets = ["standard", "ptc", "cordis"] as const;
  const parsed = presets.map((preset) => ({ preset, row: readPresetRow(preset) }));

  test("A: kernel khai ĐÚNG 3 row lồng (standard · ptc · cordis) — không thiếu preset nào", () => {
    expect(parsed.map((item) => item.preset)).toEqual(["standard", "ptc", "cordis"]);
    expect(parsed.every((item) => item.row !== null)).toBe(true);
  });

  test("A: cả 3 row dùng CÙNG id 'tool-plugin-market' (giữ id gốc)", () => {
    for (const item of parsed) expect(item.row?.id).toBe(NESTED_ROW_ID);
  });

  test("A: tên row trong kernel = @deepseek-ai/dsh-plugin-market/tools (subpath /tools)", () => {
    for (const item of parsed) expect(item.row?.name).toBe(STOCK_PACKAGE_NAME + "/" + TOOLS_SUBPATH);
  });

  test("B: NESTED_ROWS có đúng 3 phần tử, đúng thứ tự preset", () => {
    expect(NESTED_ROWS.length).toBe(3);
    expect(NESTED_ROWS.map((row: NestedRowDeclaration) => row.preset)).toEqual(["standard", "ptc", "cordis"]);
  });

  test("A/B: id của ta BẰNG id kernel ở cả 3 preset", () => {
    for (let index = 0; index < presets.length; index += 1) {
      expect(NESTED_ROWS[index]?.id).toBe(parsed[index]?.row?.id ?? "");
    }
  });

  test("A/B: tên package gốc trong dữ liệu ta BẰNG tên kernel (stockName)", () => {
    for (let index = 0; index < presets.length; index += 1) {
      expect(NESTED_ROWS[index]?.stockName).toBe(parsed[index]?.row?.name ?? "");
    }
  });

  test("A/B: tên của ta = @galaxy-blackhole/gbh-plugin-market/tools (cùng subpath /tools)", () => {
    for (const row of NESTED_ROWS) {
      expect(row.name).toBe(PACKAGE_NAME + "/" + TOOLS_SUBPATH);
      expect(row.name.endsWith("/tools")).toBe(true);
    }
  });

  test("A/B: disabled của standard = true (kernel: 'true')", () => {
    expect(parsed[0]?.row?.disabled).toBe("true");
    expect(NESTED_ROWS[0]?.disabled).toBe(true);
  });

  test("A/B: disabled của ptc = true (kernel: 'true')", () => {
    expect(parsed[1]?.row?.disabled).toBe("true");
    expect(NESTED_ROWS[1]?.disabled).toBe(true);
  });

  test("A/B: disabled của cordis = biểu thức js !ctx.get('profileContext') — NGUYÊN VĂN", () => {
    const raw = parsed[2]?.row?.disabled ?? "";
    expect(raw).toContain("!ctx.get('profileContext')");
    expect(NESTED_ROWS[2]?.disabled).toBe("!ctx.get('profileContext')");
  });

  test("A/B: subpath '/tools' tồn tại ở CẢ hai package.json, và tên row = package + '/tools'", () => {
    const stockExports = readExports(STOCK_DIR);
    const ourExports = readExports(OURS);
    // Kernel khai dạng CONDITIONAL ({types, default}); ta khai dạng chuỗi — chuẩn hoá rồi so đường dẫn.
    const stockSpecifier = specifierOf(stockExports["./tools"]);
    const ourSpecifier = specifierOf(ourExports["./tools"]);
    expect(stockSpecifier.startsWith("./lib/")).toBe(true);
    expect(ourSpecifier.startsWith("./lib/")).toBe(true);
    expect(stockSpecifier).toContain("tools.js");
    expect(ourSpecifier).toBe("./lib/tools.js");
    expect(STOCK_PACKAGE_NAME + "/" + TOOLS_SUBPATH).toBe(STOCK_PACKAGE_NAME + "/tools");
    expect(PACKAGE_NAME + "/" + TOOLS_SUBPATH).toBe(PACKAGE_NAME + "/tools");
  });

  test("artifact '/tools' của ta: export inject = ['tools'] + apply là hàm (khớp stock)", async () => {
    const out = join("/tmp", "gbh-plugin-market-nested");
    const built = await buildPackage(out);
    // Artifact nằm NGOÀI repo nên phải bắc cầu peer: symlink node_modules của gói vào thư mục build.
    try {
      const { symlinkSync, mkdirSync } = await import("node:fs");
      symlinkSync(join(OURS, "node_modules"), join(out, "node_modules"), "dir");
    } catch {
      // đã có symlink từ lượt trước
    }
    // 08/11/2026 (Lead): artefact import `@galaxy-blackhole/gbh-host-tools` — gói này KHÔNG khai trong
    //   peerDependencies (peer của ta giữ id stock theo §2e), nên bắc cầu thêm một symlink để artefact
    //   ngoài repo phân giải được. Chỉ phục vụ phép đo bề mặt, không đụng manifest của gói.
    try {
      const { symlinkSync, mkdirSync } = await import("node:fs");
      const gbhDir = join(out, "node_modules", "@galaxy-blackhole");
      mkdirSync(gbhDir, { recursive: true });
      symlinkSync(join(REPO, "packages", "host", "tools"), join(gbhDir, "gbh-host-tools"), "dir");
    } catch {
      // đã có symlink từ lượt trước
    }
    // buildPackage trả OBJECT {service,worker,tools,typertHost,typertRemoteClient} (không phải mảng).
    expect(Array.isArray(built) ? built.some((path) => String(path).endsWith("tools.js")) : String((built as { tools?: string }).tools).endsWith("tools.js")).toBe(true);
    const ours = (await import(join(out, "tools.js"))) as { inject?: string[]; apply?: unknown };
    const stock = (await import(join(STOCK_DIR, "lib/types/tools.js"))) as { inject?: string[]; apply?: unknown };
    expect(ours.inject).toEqual(stock.inject as string[]);
    expect(ours.inject).toEqual(["tools"]);
    expect(typeof ours.apply).toBe("function");
    expect(typeof stock.apply).toBe("function");
  });

  test("NESTED_ROWS KHÔNG khai tool list (đúng hành vi DSH: tool vào runtime Agent/session, không ở scope preset)", () => {
    for (const row of NESTED_ROWS) {
      const keys = Object.keys(row).sort();
      expect(keys).toEqual(["disabled", "id", "name", "preset", "stockName"]);
    }
  });

  test("gbh của ta: row TOP-LEVEL ĐÃ MOUNT (disabled:true + insertDisabled) + nested tool-plugin-market", () => {
    const json = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
      gbh?: {
        row?: { id?: string; stockId?: string; disabled?: unknown; insertDisabled?: { js?: string } };
        row_unmounted_ly_do?: unknown;
        nested?: { kind?: string; pluginId?: string; stockId?: string };
      };
    };
    // 19/10/2026 (luật mới sau sự cố mount): row stock PHẢI tắt VÔ ĐIỀU KIỆN, điều kiện gốc chuyển sang row INSERT.
    expect(json.gbh?.row_unmounted_ly_do).toBeUndefined();
    expect(json.gbh?.row?.id).toBe("plugin-market");
    expect(json.gbh?.row?.stockId).toBe("@deepseek-ai/dsh-plugin-market");
    expect(json.gbh?.row?.disabled).toBe(true);
    expect(json.gbh?.row?.insertDisabled).toEqual({ js: "!ctx.get('profileContext')" });
    expect(json.gbh?.nested?.kind).toBe("preset");
    expect(json.gbh?.nested?.pluginId).toBe("tool-plugin-market");
    expect(json.gbh?.nested?.stockId).toBe("@deepseek-ai/dsh-plugin-market/tools");
  });
});