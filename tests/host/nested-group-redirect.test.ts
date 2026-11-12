/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test lỗ hổng cơ chế #2 (19/10/2026): readNestedRedirects KHÔNG còn bỏ qua kind 'group' ⇒ group nằm trong
 *      config.plugins của preset (vd persistent-shell) được registry thay tên; group TOP-LEVEL vẫn do patch xử lý
 *      và map không gây double-replace (idempotent); fail-soft khi gói thiếu lib/index.js giữ nguyên.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readNestedRedirects, rewriteNestedNames } from "../../packages/host/agent-preset-registry/src/nested-mount.ts";
import { renderGroupRewriteBlocks } from "../../apps/cli/src/profile.ts";

/** Dựng profile giả với các gói khai gbh.nested (kind tuỳ chọn, có/không lib/index.js). */
function makeHome(items: readonly { name: string; stockId: string; kind?: "group" | "preset"; lib?: boolean }[]): string {
  const root = mkdtempSync(join(tmpdir(), "gbh-group-redirect-"));
  const modules = join(root, "profiles", "node_modules");
  const scope = join(modules, "@galaxy-blackhole");
  for (const item of items) {
    const dir = join(scope, item.name);
    mkdirSync(join(dir, "lib"), { recursive: true });
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ name: "@galaxy-blackhole/" + item.name, gbh: { nested: { stockId: item.stockId, ...(item.kind === undefined ? {} : { kind: item.kind }) } } }),
    );
    if (item.lib !== false) writeFileSync(join(dir, "lib", "index.js"), "export {};");
  }
  return modules;
}

/** Preset có MỘT nhóm cordis:group chứa 3 con stock (giống persistent-shell trong preset thật). */
function presetPlugins(): unknown[] {
  return [
    { id: "persona", name: "@deepseek-ai/dsh-persona" },
    {
      id: "persistent-shell",
      name: "cordis:group",
      group: true,
      isolate: { terminals: true },
      config: [
        { id: "pty", name: "@deepseek-ai/dsh-terminal" },
        { id: "terminal-bash", name: "@deepseek-ai/dsh-terminal-bash" },
        { id: "persistent-bash", name: "@deepseek-ai/dsh-tool-bash-persistent" },
      ],
    },
  ];
}

describe("lỗ hổng #2 · group trong preset phải được registry redirect", () => {
  test("readNestedRedirects KHÔNG bỏ qua kind 'group' nữa (map có đủ 3 gói)", () => {
    const modules = makeHome([
      { name: "gbh-terminal", stockId: "@deepseek-ai/dsh-terminal", kind: "group" },
      { name: "gbh-terminal-bash", stockId: "@deepseek-ai/dsh-terminal-bash", kind: "group" },
      { name: "gbh-tool-bash-persistent", stockId: "@deepseek-ai/dsh-tool-bash-persistent", kind: "group" },
    ]);
    try {
      const { map, warnings } = readNestedRedirects(modules);
      expect(warnings).toEqual([]);
      expect([...map.keys()].sort()).toEqual([
        "@deepseek-ai/dsh-terminal",
        "@deepseek-ai/dsh-terminal-bash",
        "@deepseek-ai/dsh-tool-bash-persistent",
      ]);
      expect(map.get("@deepseek-ai/dsh-terminal")).toBe("@galaxy-blackhole/gbh-terminal");
    } finally {
      rmSync(modules, { recursive: true, force: true });
    }
  });

  test("rewriteNestedNames thay HẾT 3 con trong nhóm của preset, giữ group/isolate", () => {
    const modules = makeHome([
      { name: "gbh-terminal", stockId: "@deepseek-ai/dsh-terminal", kind: "group" },
      { name: "gbh-terminal-bash", stockId: "@deepseek-ai/dsh-terminal-bash", kind: "group" },
      { name: "gbh-tool-bash-persistent", stockId: "@deepseek-ai/dsh-tool-bash-persistent", kind: "group" },
    ]);
    try {
      const { map } = readNestedRedirects(modules);
      const out = rewriteNestedNames(presetPlugins(), map, "standard") as Array<Record<string, unknown>>;
      const group = out[1] as { name: string; group?: boolean; isolate?: unknown; config: Array<Record<string, unknown>> };
      expect(group.name).toBe("cordis:group");
      expect(group.group).toBe(true);
      expect(group.isolate).toEqual({ terminals: true });
      expect(group.config.map((child) => child["name"])).toEqual([
        "@galaxy-blackhole/gbh-terminal",
        "@galaxy-blackhole/gbh-terminal-bash",
        "@galaxy-blackhole/gbh-tool-bash-persistent",
      ]);
    } finally {
      rmSync(modules, { recursive: true, force: true });
    }
  });

  test("idempotent: chạy lần 2 trên kết quả lần 1 KHÔNG đổi (không double-replace)", () => {
    const modules = makeHome([
      { name: "gbh-terminal", stockId: "@deepseek-ai/dsh-terminal", kind: "group" },
      { name: "gbh-terminal-bash", stockId: "@deepseek-ai/dsh-terminal-bash", kind: "group" },
    ]);
    try {
      const { map } = readNestedRedirects(modules);
      const once = rewriteNestedNames(presetPlugins(), map, "standard");
      const twice = rewriteNestedNames(once, map, "standard");
      expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
      expect(JSON.stringify(once)).toContain("@galaxy-blackhole/gbh-terminal");
      expect(JSON.stringify(once)).not.toContain("'@galaxy-blackhole/@galaxy-blackhole");
    } finally {
      rmSync(modules, { recursive: true, force: true });
    }
  });

  test("fail-soft giữ nguyên: gói kind group THIẾU lib/index.js ⇒ cảnh báo, không vào map", () => {
    const modules = makeHome([{ name: "gbh-terminal", stockId: "@deepseek-ai/dsh-terminal", kind: "group", lib: false }]);
    try {
      const { map, warnings } = readNestedRedirects(modules);
      expect(map.size).toBe(0);
      expect(warnings).toHaveLength(1);
      expect(warnings[0] ?? "").toContain("CHUA co lib/index.js");
    } finally {
      rmSync(modules, { recursive: true, force: true });
    }
  });

  test("group TOP-LEVEL: patch vẫn ĐÚNG MỘT khối và render 2 lần cho cùng kết quả; map không tạo double-replace", () => {
    const source = [
      "- id: optional-persistent-terminals",
      "  name: cordis:group",
      "  group: true",
      "  isolate:",
      "    terminals: true",
      "  config:",
      "    - id: optional-terminal-registry",
      "      name: '@deepseek-ai/dsh-terminal'",
      "    - id: optional-tool-terminal",
      "      name: '@deepseek-ai/dsh-tool-terminal'",
    ].join("\n");
    const redirects = [
      { stockId: "@deepseek-ai/dsh-terminal", specifier: "@galaxy-blackhole/gbh-terminal", kind: "group" as const },
      { stockId: "@deepseek-ai/dsh-tool-terminal", specifier: "@galaxy-blackhole/gbh-tool-terminal", kind: "group" as const },
    ];
    const first = renderGroupRewriteBlocks(source, redirects);
    const second = renderGroupRewriteBlocks(source, redirects);
    expect(first.blocks).toHaveLength(1);
    expect(first.warnings).toEqual([]);
    expect(second.blocks).toEqual(first.blocks);
    const block = first.blocks[0] ?? "";
    expect(block).toContain("name: '@galaxy-blackhole/gbh-terminal'");
    expect(block).toContain("name: '@galaxy-blackhole/gbh-tool-terminal'");
    // Đã thay rồi thì map registry không còn khớp tên stock ⇒ không double-replace.
    expect(block.includes("@deepseek-ai/dsh-terminal'")).toBe(false);
  });
});
