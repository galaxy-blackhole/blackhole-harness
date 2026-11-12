/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test task-173 mức DUMP: patch sinh tự động override config của 4 row preset stock, mọi stockId đã khai
 *      `gbh.nested` đều thành id GBH trong VĂN BẢN patch ⇒ `dsh --dump-config` hết id stock; giữ isolate + !!js,
 *      số entry không đổi, fail-soft cảnh báo danh sách không thấy preset, tệp đã commit khớp generator.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  OUTPUT,
  generatePresetRedirect,
  parsePresetPatch,
  readDeclarations,
  readStockPresetConfigs,
} from "../../packages/host/agent-preset/src/preset-redirect.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/**
 * Đếm số khoá `name` trong một cây config (mọi độ sâu).
 * Nhận: value — cây config. Trả: số lần xuất hiện tên module.
 */
function countNames(value: unknown): number {
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + countNames(item), 0);
  if (typeof value !== "object" || value === null) return 0;
  const record = value as Record<string, unknown>;
  const self = typeof record["name"] === "string" ? 1 : 0;
  return Object.entries(record).reduce((sum: number, [key, item]) => (key === "name" ? sum : sum + countNames(item)), self);
}

describe("task-173 · patch dump-level: config preset mang id GBH", () => {
  test("generator: 4 preset, KHÔNG còn name stock nào của stockId đã khai", () => {
    const generated = generatePresetRedirect();
    expect(generated.presetIds.sort()).toEqual(["preset-cordis", "preset-minimal", "preset-ptc", "preset-standard"]);
    for (const declaration of readDeclarations()) {
      expect(generated.text.includes("name: '@" + declaration.stockId + "'")).toBe(false);
    }
    expect(generated.text.includes("name: '@galaxy-blackhole/gbh-")).toBe(true);
  });

  test("số entry của MỖI preset không đổi so với stock (đếm name mọi độ sâu)", () => {
    const { configs } = readStockPresetConfigs();
    const generated = generatePresetRedirect();
    const blocks = parsePresetPatch(generated.text) as Array<{ id: string; config: unknown }>;
    expect(blocks.length).toBe(4);
    for (const block of blocks) {
      const stockConfig = configs.get(block.id);
      expect(stockConfig).toBeDefined();
      expect(countNames(block.config)).toBe(countNames(stockConfig));
    }
  });

  test("giữ nguyên isolate của group lồng + !!js expressions + khoá khác (id/order)", () => {
    const generated = generatePresetRedirect();
    const blocks = parsePresetPatch(generated.text) as Array<{ id: string; config: Record<string, unknown> }>;
    const standard = blocks.find((block) => block.id === "preset-standard");
    expect(standard?.config["id"]).toBe("standard");
    expect(standard?.config["order"]).toBe(1);
    const cordis = blocks.find((block) => block.id === "preset-cordis");
    const json = JSON.stringify(cordis?.config);
    expect(json).toContain("workflowEngine");
    expect(generated.text.includes("!!js")).toBe(true);
  });

  test("mọi stockId đã khai đều KHÔNG xuất hiện như tên module (kể cả entry phụ /subpath)", () => {
    const text = readFileSync(OUTPUT, "utf8");
    for (const declaration of readDeclarations()) {
      const pattern = new RegExp("name: '@" + declaration.stockId.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&") + "(/[^']*)?'", "u");
      expect(pattern.test(text)).toBe(false);
    }
  });

  test("tệp đã commit khớp ĐÚNG generator (idempotent; sửa tay sẽ đỏ)", () => {
    expect(readFileSync(OUTPUT, "utf8")).toBe(generatePresetRedirect().text);
  });

  test("fail-soft: stockId không nằm trong preset nào ⇒ cảnh báo, KHÔNG ném, patch vẫn sinh", () => {
    const generated = generatePresetRedirect([
      { dir: join(REPO, "packages/host/agent-preset"), name: "@galaxy-blackhole/gbh-agent-preset", stockId: "@deepseek-ai/dsh-agent-preset" },
      { dir: join(REPO, "packages/host/agent-preset"), name: "@galaxy-blackhole/gbh-khong-ton-tai", stockId: "@deepseek-ai/dsh-khong-ton-tai" },
    ]);
    expect(generated.presetIds.length).toBe(4);
    expect(generated.warnings.some((warning) => warning.includes("@deepseek-ai/dsh-khong-ton-tai"))).toBe(true);
    // preset row agent-preset xuất hiện trong preset ⇒ KHÔNG cảnh báo cho nó.
    expect(generated.warnings.some((warning) => warning.includes("@deepseek-ai/dsh-agent-preset"))).toBe(false);
  });

  test("patch parse được dạng entry-list (4 block, mỗi block có config.plugins)", () => {
    const blocks = parsePresetPatch(readFileSync(OUTPUT, "utf8")) as Array<{ id: string; config: { plugins?: unknown[] }; insert?: unknown }>;
    expect(blocks.length).toBe(4);
    for (const block of blocks) {
      expect(block.id.startsWith("preset-")).toBe(true);
      expect(Array.isArray(block.config.plugins)).toBe(true);
      expect(block.insert).toBeUndefined();
    }
  });
});
