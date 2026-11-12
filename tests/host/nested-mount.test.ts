/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test ADR 0011 — mount row NHÓM (`cordis:group`): viết lại `name` của các CON trong MỘT row nhóm theo bản
 *      đồ redirect `gbh.nested`, giữ nguyên `id`/`group`/`isolate`/`config`; nhận CẢ HAI hình dạng `config`
 *      (MẢNG như `optional-session-search`, ĐỐI TƯỢNG `{plugins}` như nhóm lồng trong preset); idempotent và
 *      KHÔNG sửa tham số vào. Ca cuối đọc DUMP THẬT để chứng minh cấu trúc inline khớp dữ liệu oracle.
 */
import { renderGroupRewriteBlocks } from "../../apps/cli/src/profile.ts";
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  isGroupRow,
  readNestedRedirects,
  rewriteGroupChildren,
  rewriteGroupRows,
  rewriteNestedNames,
} from "../../packages/host/agent-preset-registry/src/nested-mount.ts";

/** Gốc repo (tệp này nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");

/** Dump parity chứa row nhóm THẬT `optional-session-search`. */
const DUMP = join(REPO, ".parity", "dumps", "2026-10-17T05-02-00", "oracleA_nopatch.yml");

/**
 * Dựng home giả có `profiles/node_modules` với các gói khai `gbh.nested`.
 * Nhận: danh sách [tên gói, stockId, có lib/index.js?].
 * Trả: đường dẫn `profiles/node_modules` (đã tạo).
 */
function makeHome(packages: readonly [string, string, boolean][]): string {
  const root = mkdtempSync(join(tmpdir(), "gbh-nested-test-"));
  const modules = join(root, "profiles", "node_modules");
  const scope = join(modules, "@galaxy-blackhole");
  for (const [name, stockId, hasLib] of packages) {
    const dir = join(scope, name);
    mkdirSync(hasLib ? join(dir, "lib") : dir, { recursive: true });
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@galaxy-blackhole/" + name, gbh: { nested: { stockId } } }));
    if (hasLib) writeFileSync(join(dir, "lib", "index.js"), "export {};");
  }
  return modules;
}

/** Row nhóm THẬT `optional-session-search` (chép từ dump: config là MẢNG con + `isolate`). */
function realGroupRow(): Record<string, unknown> {
  return {
    id: "optional-session-search",
    name: "cordis:group",
    group: true,
    isolate: { sessionQuery: true },
    config: [
      { id: "optional-session-query-sqlite", name: "@deepseek-ai/dsh-session-query-sqlite", config: { path: ":memory:", openAt: "first-search" } },
      { id: "optional-tool-session-query", name: "@deepseek-ai/dsh-tool-session-query" },
    ],
  };
}

describe("ADR 0011 — mount row NHÓM (cordis:group)", () => {
  test("profile.ts: sinh khối patch THAY ROW NHÓM từ DUMP THẬT (giữ group/isolate/config đã viết lại)", () => {
    const text = readFileSync(DUMP, "utf8");
    const result = renderGroupRewriteBlocks(text, [
      { stockId: "@deepseek-ai/dsh-tool-session-query", specifier: "@galaxy-blackhole/gbh-tool-session-query", kind: "group" },
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.blocks).toHaveLength(1);
    const block = result.blocks[0] ?? "";
    // Khuôn BẮT BUỘC (Lead chốt): tắt row nhóm + insert bản sao cordis:group.
    expect(block).toContain("- id: optional-session-search\n  disabled: true");
    expect(block).toContain("- insert:\n    - id: optional-session-search-ours\n      name: cordis:group");
    // group: true + isolate + config của con KHÔNG bị mất.
    expect(block).toContain("      group: true");
    expect(block).toContain("      isolate:\n        sessionQuery: true");
    expect(block).toContain("          openAt: first-search");
    // Con CÓ khai nested đổi specifier; con KHÔNG khai giữ nguyên.
    expect(block).toContain("          name: '@galaxy-blackhole/gbh-tool-session-query'");
    expect(block).toContain("          name: '@deepseek-ai/dsh-session-query-sqlite'");
    // KHÔNG nuốt comment của bundle kế tiếp trong dump.
    expect(block.includes("experimental-inspector-profile")).toBe(false);
  });

  test("profile.ts: FAIL-SOFT khi không tìm thấy row nhóm/không thấy name", () => {
    const text = readFileSync(DUMP, "utf8");
    const missing = renderGroupRewriteBlocks(text, [
      { stockId: "@deepseek-ai/dsh-khong-ton-tai", specifier: "@galaxy-blackhole/gbh-x", kind: "group" },
    ]);
    expect(missing.blocks).toEqual([]);
    expect(missing.warnings).toHaveLength(1);
    // Cha KHÔNG phải nhóm (row top-level thường trong dump) ⇒ cảnh báo, KHÔNG ném.
    const notGroup = renderGroupRewriteBlocks(text, [
      { stockId: "@deepseek-ai/dsh-experimental-translator", specifier: "@galaxy-blackhole/gbh-translator", kind: "group" },
    ]);
    expect(notGroup.blocks).toEqual([]);
    expect(notGroup.warnings).toHaveLength(1);
    // Row top-level KHÔNG có row cha nào ⇒ thông điệp đúng là "khong thay row cha" (vẫn fail-soft, không ném).
    expect(notGroup.warnings[0] ?? "").toContain("khong thay row cha");
  });

  test("đọc bản đồ redirect + FAIL-SOFT khi gói thiếu lib/index.js", () => {
    const modules = makeHome([
      ["gbh-tool-session-query", "@deepseek-ai/dsh-tool-session-query", true],
      ["gbh-tool-thieu-lib", "@deepseek-ai/dsh-tool-thieu-lib", false],
    ]);
    try {
      const read = readNestedRedirects(modules);
      expect(read.map.size).toBe(1);
      expect(read.map.get("@deepseek-ai/dsh-tool-session-query")).toBe("@galaxy-blackhole/gbh-tool-session-query");
      expect(read.warnings).toHaveLength(1);
      expect(read.warnings[0] ?? "").toContain("gbh-tool-thieu-lib");
    } finally {
      rmSync(join(modules, "..", ".."), { recursive: true, force: true });
    }
  });

  test("row nhóm: con CÓ khai nested ⇒ đổi specifier, con KHÔNG khai ⇒ giữ nguyên", () => {
    const modules = makeHome([["gbh-tool-session-query", "@deepseek-ai/dsh-tool-session-query", true]]);
    try {
      const { map } = readNestedRedirects(modules);
      const row = realGroupRow();
      const out = rewriteGroupChildren(row, map) as {
        id: string;
        group: boolean;
        isolate: unknown;
        config: Array<Record<string, unknown>>;
      };
      expect(out.id).toBe("optional-session-search");
      expect(out.group).toBe(true);
      expect(out.isolate).toEqual({ sessionQuery: true });
      expect(out.config[0]?.["name"]).toBe("@deepseek-ai/dsh-session-query-sqlite");
      expect(out.config[1]?.["name"]).toBe("@galaxy-blackhole/gbh-tool-session-query");
      expect(out.config[0]?.["config"]).toEqual({ path: ":memory:", openAt: "first-search" });
    } finally {
      rmSync(join(modules, "..", ".."), { recursive: true, force: true });
    }
  });

  test("hình dạng ĐỐI TƯỢNG (config.plugins — nhóm lồng trong preset) cũng được viết lại", () => {
    const modules = makeHome([["gbh-tool-session-query", "@deepseek-ai/dsh-tool-session-query", true]]);
    try {
      const { map } = readNestedRedirects(modules);
      const presetGroup = {
        id: "planning",
        name: "cordis:group",
        group: true,
        config: { plugins: [{ id: "inner", name: "@deepseek-ai/dsh-tool-session-query" }] },
      };
      const out = rewriteGroupChildren(presetGroup, map) as { config: { plugins: Array<{ name: string }> } };
      expect(out.config.plugins[0]?.name).toBe("@galaxy-blackhole/gbh-tool-session-query");
    } finally {
      rmSync(join(modules, "..", ".."), { recursive: true, force: true });
    }
  });

  test("IDEMPOTENT + KHÔNG sửa tham số vào + row không phải nhóm đi qua nguyên vẹn", () => {
    const modules = makeHome([["gbh-tool-session-query", "@deepseek-ai/dsh-tool-session-query", true]]);
    try {
      const { map } = readNestedRedirects(modules);
      const rows = [realGroupRow(), { id: "persona", name: "@deepseek-ai/dsh-persona" }];
      const once = rewriteGroupRows(rows, map);
      const twice = rewriteGroupRows(once, map);
      expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
      const original = rows[0] as { config: Array<Record<string, unknown>> };
      expect(original.config[1]?.["name"]).toBe("@deepseek-ai/dsh-tool-session-query");
      expect((once[1] as { name: string }).name).toBe("@deepseek-ai/dsh-persona");
    } finally {
      rmSync(join(modules, "..", ".."), { recursive: true, force: true });
    }
  });

  test("bản đồ RỖNG ⇒ trả bản sao nông, không đổi gì", () => {
    const rows = [realGroupRow()];
    const out = rewriteGroupRows(rows, new Map());
    expect(JSON.stringify(out)).toBe(JSON.stringify(rows));
    expect(out[0]).not.toBe(rows[0]);
  });

  test("isGroupRow: nhận theo cờ group:true và theo name cordis:group; loại row thường", () => {
    expect(isGroupRow({ id: "a", group: true })).toBe(true);
    expect(isGroupRow({ id: "a", name: "cordis:group" })).toBe(true);
    expect(isGroupRow({ id: "a", name: "@deepseek-ai/dsh-persona" })).toBe(false);
    expect(isGroupRow(null)).toBe(false);
    expect(isGroupRow("x")).toBe(false);
  });

  test("DUMP THẬT: cấu trúc inline khớp oracle và CON đổi sang specifier của ta", () => {
    const text = readFileSync(DUMP, "utf8");
    expect(text).toContain("- id: optional-session-search");
    expect(text).toContain("  name: cordis:group");
    expect(text).toContain("    sessionQuery: true");
    expect(text).toContain("    - id: optional-tool-session-query");
    expect(text).toContain("      name: '@deepseek-ai/dsh-tool-session-query'");
    const modules = makeHome([["gbh-tool-session-query", "@deepseek-ai/dsh-tool-session-query", true]]);
    try {
      const { map } = readNestedRedirects(modules);
      const out = rewriteGroupChildren(realGroupRow(), map) as { config: Array<Record<string, unknown>> };
      expect(out.config[1]?.["name"]).toBe("@galaxy-blackhole/gbh-tool-session-query");
    } finally {
      rmSync(join(modules, "..", ".."), { recursive: true, force: true });
    }
  });

  test("preset (đường cũ) vẫn nguyên hành vi: rewriteNestedNames thay ở MỌI độ sâu", () => {
    const modules = makeHome([["gbh-tool-session-query", "@deepseek-ai/dsh-tool-session-query", true]]);
    try {
      const { map } = readNestedRedirects(modules);
      const plugins = [
        { id: "persona", name: "@deepseek-ai/dsh-persona" },
        { id: "planning", name: "cordis:group", group: true, config: { plugins: [{ id: "inner", name: "@deepseek-ai/dsh-tool-session-query" }] } },
      ];
      const out = rewriteNestedNames(plugins, map) as Array<Record<string, unknown>>;
      const group = out[1] as { config: { plugins: Array<{ name: string }> } };
      expect(group.config.plugins[0]?.name).toBe("@galaxy-blackhole/gbh-tool-session-query");
      expect((out[0] as { name: string }).name).toBe("@deepseek-ai/dsh-persona");
    } finally {
      rmSync(join(modules, "..", ".."), { recursive: true, force: true });
    }
  });
});
