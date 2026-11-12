/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test task-169 — MỌI `stockId` trong `gbh.nested` của repo phải được đổi sang id GBH ở MỌI độ sâu,
 *      kể cả trong group lồng `config: [ … ]` có `isolate` (delegation) và entry phụ `/list-agents`;
 *      bản đồ phải phủ đủ dù profile copy đến muộn (cache đọc lại).
 */
import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  collectEntryNames,
  isUnresolvedStockName,
  readNestedRedirects,
  rewriteNestedNames,
} from "../../packages/host/agent-preset-registry/src/nested-mount.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Tiền tố scope gói của ta. */
const OUR_SCOPE = "@galaxy-blackhole/";

/** Khai báo gbh.nested trong toàn repo (kèm thư mục nguồn). */
interface Declaration {
  readonly dir: string;
  readonly stockId: string;
  readonly pluginId: string;
}

/**
 * Quét toàn repo tìm mọi khai báo `gbh.nested`.
 * Nhận: không. Trả: danh sách khai báo (đã khử trùng theo stockId) — ném nếu không thấy khai báo nào.
 */
function readDeclarations(): Declaration[] {
  const tiers = ["host", "client", "shared"].map((tier) => join(REPO, "packages", tier)).filter((dir) => existsSync(dir));
  const out: Declaration[] = [];
  const seen = new Set<string>();
  for (const tier of tiers) {
    for (const name of readdirSync(tier).sort()) {
      const dir = join(tier, name);
      const manifestPath = join(dir, "package.json");
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { gbh?: { nested?: unknown } };
      const nested = Array.isArray(manifest.gbh?.nested) ? manifest.gbh?.nested[0] : manifest.gbh?.nested;
      if (typeof nested !== "object" || nested === null) continue;
      const record = nested as { stockId?: unknown; pluginId?: unknown };
      const stockId = typeof record.stockId === "string" ? record.stockId : "";
      const pluginId = typeof record.pluginId === "string" ? record.pluginId : name;
      if (stockId === "" || seen.has(stockId)) continue;
      seen.add(stockId);
      out.push({ dir, stockId, pluginId });
    }
  }
  expect(out.length).toBeGreaterThan(10);
  return out;
}

describe("task-169 · mọi stockId trong gbh.nested đều được đổi sang id GBH", () => {
  test("bản đồ đọc từ profile TẠM phủ ĐỦ mọi khai báo repo", () => {
    const declarations = readDeclarations();
    const root = mkdtempSync(join(tmpdir(), "gbh-nested-"));
    const scopeDir = join(root, "@galaxy-blackhole");
    mkdirSync(scopeDir, { recursive: true });
    for (const declaration of declarations) {
      const last = declaration.dir.split("/").at(-1) ?? "pkg";
      if (existsSync(join(declaration.dir, "lib", "index.js"))) symlinkSync(declaration.dir, join(scopeDir, last), "dir");
    }
    const { map } = readNestedRedirects(root);
    const missing = declarations.filter((declaration) => !map.has(declaration.stockId));
    expect(missing.map((item) => item.stockId)).toEqual([]);
    for (const declaration of declarations) expect(map.get(declaration.stockId)?.startsWith(OUR_SCOPE)).toBe(true);
    rmSync(root, { recursive: true, force: true });
  });

  test("group lồng `config: [ … ]` có isolate (đúng hình dạng delegation): con được đổi, isolate giữ nguyên", () => {
    const map = new Map([["@deepseek-ai/dsh-tool-subagent-control", "@galaxy-blackhole/gbh-tool-subagent-control"]]);
    const plugins = [
      { id: "delegation", name: "cordis:group", group: true, isolate: { workflowEngine: true }, config: [
        { id: "tool-subagent-control", name: "@deepseek-ai/dsh-tool-subagent-control" },
        { id: "tool-subagent-list-agents", name: "@deepseek-ai/dsh-tool-subagent-control/list-agents" },
        { id: "tool-subagent", name: "@deepseek-ai/dsh-tool-subagent" },
      ] },
    ];
    const out = rewriteNestedNames(plugins, map, "preset-standard") as Array<Record<string, unknown>>;
    const group = out[0] as { isolate: unknown; config: Array<Record<string, unknown>> };
    expect(group.isolate).toEqual({ workflowEngine: true });
    expect(group.config[0]?.["name"]).toBe("@galaxy-blackhole/gbh-tool-subagent-control");
    // Entry PHỤ cùng gói cũng phải đổi (task-169: khớp tiền tố, không chỉ khớp chính xác).
    expect(group.config[1]?.["name"]).toBe("@galaxy-blackhole/gbh-tool-subagent-control/list-agents");
    expect(group.config[2]?.["name"]).toBe("@deepseek-ai/dsh-tool-subagent");
  });

  test("group lồng `config: { plugins: [ … ] }` (hình dạng planning/compaction): cũng đổi", () => {
    const map = new Map([["@deepseek-ai/dsh-workflow-ptc", "@galaxy-blackhole/gbh-workflow-ptc"]]);
    const plugins = [{ id: "outer", name: "cordis:group", group: true, config: { plugins: [{ id: "workflow-ptc", name: "@deepseek-ai/dsh-workflow-ptc" }] } }];
    const out = rewriteNestedNames(plugins, map) as Array<Record<string, unknown>>;
    const config = (out[0] as { config: { plugins: Array<Record<string, unknown>> } }).config;
    expect(config.plugins[0]?.["name"]).toBe("@galaxy-blackhole/gbh-workflow-ptc");
  });

  test("mọi stockId khai báo repo, nhét vào CẢ 3 hình dạng, đều thành id GBH", () => {
    const declarations = readDeclarations();
    const map = new Map(declarations.map((declaration) => [declaration.stockId, OUR_SCOPE + "gbh-" + declaration.pluginId] as const));
    const trees = [
      declarations.map((declaration, index) => ({ id: "row-" + String(index), name: declaration.stockId })),
      [{ id: "g1", name: "cordis:group", group: true, isolate: { workflowEngine: true }, config: declarations.map((declaration, index) => ({ id: "c-" + String(index), name: declaration.stockId })) }],
      [{ id: "g2", name: "cordis:group", group: true, config: { plugins: declarations.map((declaration, index) => ({ id: "p-" + String(index), name: declaration.stockId })) } }],
    ];
    for (const tree of trees) {
      const names = collectEntryNames(rewriteNestedNames(tree as unknown[], map)).filter((name) => name !== "cordis:group");
      expect(names.filter((name) => name.startsWith("@deepseek-ai/"))).toEqual([]);
      expect(names.length).toBe(declarations.length);
    }
  });

  test("idempotent: chạy 2 lần cho cùng kết quả; tên GBH không bị đổi ngược", () => {
    const map = new Map([["@deepseek-ai/dsh-tool-subagent-control", "@galaxy-blackhole/gbh-tool-subagent-control"]]);
    const tree = [{ id: "delegation", name: "cordis:group", group: true, config: [{ id: "x", name: "@deepseek-ai/dsh-tool-subagent-control" }] }];
    const once = rewriteNestedNames(tree, map);
    const twice = rewriteNestedNames(once, map);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  test("isUnresolvedStockName: phát hiện tên stock chưa phủ (để cache đọc lại) và bỏ qua entry phụ", () => {
    const map = new Map([["@deepseek-ai/dsh-tool-subagent-control", "@galaxy-blackhole/gbh-tool-subagent-control"]]);
    expect(isUnresolvedStockName("@deepseek-ai/dsh-tool-subagent-control", map)).toBe(false);
    expect(isUnresolvedStockName("@deepseek-ai/dsh-tool-subagent-control/list-agents", map)).toBe(false);
    expect(isUnresolvedStockName("@deepseek-ai/dsh-tool-subagent", map)).toBe(true);
    expect(isUnresolvedStockName("@galaxy-blackhole/gbh-tool-subagent-control", map)).toBe(true);
  });
});
