/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Test gói tool-subagent: artefact de-bundle phải TRÙNG TỪNG BYTE bản gốc DSH (cổng hai chiều)
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const TA = join(import.meta.dir, "..", "..", "packages", "host", "tool-subagent", "lib");
const GOC = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-subagent", "lib");

describe("tool-subagent · de-bundle nguyên văn", () => {
  test("index.js trùng từng byte bản gốc", () => {
    expect(readFileSync(join(TA, "index.js"), "utf8")).toBe(readFileSync(join(GOC, "index.js"), "utf8"));
  });

  test("model-selection-settings.js trùng từng byte bản gốc", () => {
    expect(readFileSync(join(TA, "model-selection-settings.js"), "utf8")).toBe(readFileSync(join(GOC, "model-selection-settings.js"), "utf8"));
  });

  test("có marker de-bundle", () => {
    expect(statSync(join(import.meta.dir, "..", "..", "packages", "host", "tool-subagent", ".debundled")).isFile()).toBe(true);
  });
});
