/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Test A/B cho task-137: khử id DSH khỏi BẢNG MODULE WEB qua bản đồ alias (gbh.row.aliases) — không sửa manifest
 */

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { dshRemapEnabled, OUR_SCOPE, profileModulesDir, readDshAliasMap, remapSpecifier, remapSpecifiers, STOCK_SCOPE } from "../../packages/client/modules/src/remap.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");

/**
 * Dựng một node_modules giả trong thư mục tạm với các package.json cho trước.
 * Nhận: entries — danh sách [tên package, nội dung manifest]. Trả: đường dẫn node_modules (dọn ở afterAll của test).
 */
function fakeModules(entries: readonly (readonly [string, Record<string, unknown>])[]): string {
  const root = mkdtempSync(join(tmpdir(), "gbh-remap-"));
  for (const [name, manifest] of entries) {
    const dir = join(root, "@galaxy-blackhole", name);
    mkdirSync(dir, { recursive: true });
    // 20/10/2026 — LUẬT 4 (sự cố 19/10/2026): gói THƯ VIỆN (không có nửa client) KHÔNG được remap.
    // Fixture của ca cần remap phải khai ĐỦ nửa client như gói thật: `dsh.client` + `lib/client.js`.
    if ((manifest["dsh"] as { client?: unknown } | undefined)?.client !== undefined) {
      mkdirSync(join(dir, "lib"), { recursive: true });
      writeFileSync(join(dir, "lib", "client.js"), "window.__ModuleLoader__.load({ id: " + JSON.stringify("@galaxy-blackhole/" + name) + ", factory: () => ({}) });\n");
    }
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "@galaxy-blackhole/" + name, ...manifest }));
  }
  return root;
}

/** Dọn thư mục tạm. */
function clean(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

describe("task-137 · khử id DSH khỏi bảng module web", () => {
  test("1 · map rỗng khi thư mục profile không tồn tại (fail-soft, KHÔNG ném)", () => {
    const map = readDshAliasMap(join(tmpdir(), "gbh-khong-ton-tai-" + String(Date.now())));
    expect(map.size).toBe(0);
  });

  test("2 · đọc alias từ gbh.row (đã flip) và từ khối park", () => {
    const root = fakeModules([
      ["gbh-api-session-controller", { dsh: { client: { platform: "web" } }, gbh: { row: { aliases: ["@deepseek-ai/dsh-api-session-controller"] } } }],
      ["gbh-tool-schedule", { dsh: { client: { platform: "web" } }, gbh: { row_unmounted_ly_do: { row: { aliases: ["@deepseek-ai/dsh-tool-schedule"] } } } }],
    ]);
    try {
      const map = readDshAliasMap(root);
      // Mỗi gói client khai 1 alias tường minh + 2 alias quy ước (`dsh-` và `dsh-experimental-`);
      // hai alias tường minh trùng khoá quy ước `dsh-` nên tổng là 4 khoá phân biệt.
      expect(map.size).toBe(4);
      expect(map.get("@deepseek-ai/dsh-api-session-controller")).toBe("@galaxy-blackhole/gbh-api-session-controller");
      expect(map.get("@deepseek-ai/dsh-tool-schedule")).toBe("@galaxy-blackhole/gbh-tool-schedule");
      expect(map.get("@deepseek-ai/dsh-experimental-api-session-controller")).toBe("@galaxy-blackhole/gbh-api-session-controller");
      expect(map.get("@deepseek-ai/dsh-experimental-tool-schedule")).toBe("@galaxy-blackhole/gbh-tool-schedule");
    } finally {
      clean(root);
    }
  });

  test("3 · bỏ qua gói không khai row + bỏ alias trùng tên package + JSON hỏng", () => {
    const root = fakeModules([
      ["gbh-khong-row", { gbh: { draft: "x" } }],
      ["gbh-tu-alias", { gbh: { row: { aliases: ["@galaxy-blackhole/gbh-tu-alias"] } } }],
    ]);
    // Thư mục phải tồn tại trước khi ghi (mkdtemp không tạo sẵn @galaxy-blackhole/hong).
    mkdirSync(join(root, "@galaxy-blackhole", "hong"), { recursive: true });
    writeFileSync(join(root, "@galaxy-blackhole", "hong", "package.json"), "{ khong phai json");
    try {
      const map = readDshAliasMap(root);
      expect(map.size).toBe(0);
    } finally {
      clean(root);
    }
  });

  test("4 · remapSpecifier: id CÓ trong map thì đổi, id LẠ giữ nguyên", () => {
    const map = new Map([["@deepseek-ai/dsh-api-remotes", "@galaxy-blackhole/gbh-api-remotes"]]);
    expect(remapSpecifier("@deepseek-ai/dsh-api-remotes", map)).toBe("@galaxy-blackhole/gbh-api-remotes");
    expect(remapSpecifier("@deepseek-ai/cordis", map)).toBe("@deepseek-ai/cordis");
    expect(remapSpecifier("zod", map)).toBe("zod");
    expect(remapSpecifier("@deepseek-ai/dsh-api-remotes/client", map)).toBe("@deepseek-ai/dsh-api-remotes/client");
  });

  test("5 · remapSpecifiers GIỮ NGUYÊN độ dài + thứ tự (số entry bảng inject không đổi)", () => {
    const map = new Map([["@deepseek-ai/dsh-client-locale", "@galaxy-blackhole/gbh-client-locale"]]);
    const input = ["@deepseek-ai/dsh-client-locale", "zod", "@deepseek-ai/dsh-client-locale"];
    const out = remapSpecifiers(input, map);
    expect(out).toBeDefined();
    expect(out?.length).toBe(input.length);
    expect(out).toEqual(["@galaxy-blackhole/gbh-client-locale", "zod", "@galaxy-blackhole/gbh-client-locale"]);
  });

  test("6 · remapSpecifiers: undefined ⇒ undefined; map rỗng ⇒ trả NGUYÊN mảng ban đầu", () => {
    expect(remapSpecifiers(undefined, new Map())).toBeUndefined();
    const input = ["@deepseek-ai/dsh-a"];
    expect(remapSpecifiers(input, new Map())).toBe(input);
  });

  test("7 · công tắc A/B: GBH_DSH_REMAP=off|0|false tắt remap, giá trị khác bật", () => {
    const cu = process.env.GBH_DSH_REMAP;
    try {
      for (const giaTri of ["off", "0", "false", "OFF"]) {
        process.env.GBH_DSH_REMAP = giaTri;
        expect(dshRemapEnabled()).toBe(false);
      }
      for (const giaTri of ["", "on", "1", "true"]) {
        process.env.GBH_DSH_REMAP = giaTri;
        expect(dshRemapEnabled()).toBe(true);
      }
    } finally {
      if (cu === undefined) delete process.env.GBH_DSH_REMAP;
      else process.env.GBH_DSH_REMAP = cu;
    }
  });

  test("8 · profileModulesDir theo GBH_HOME rồi DSH_HOME", () => {
    expect(profileModulesDir({ GBH_HOME: "/tmp/a", DSH_HOME: "/tmp/b" } as NodeJS.ProcessEnv)).toBe("/tmp/a/profiles/node_modules");
    expect(profileModulesDir({ DSH_HOME: "/tmp/b" } as NodeJS.ProcessEnv)).toBe("/tmp/b/profiles/node_modules");
  });

  test("9 · bảng inject MẪU không còn id DSH sau remap, và KHÔNG mất module nào", () => {
    const map = new Map([
      ["@deepseek-ai/dsh-client-locale", "@galaxy-blackhole/gbh-client-locale"],
      ["@deepseek-ai/dsh-api-remotes", "@galaxy-blackhole/gbh-api-remotes"],
    ]);
    const inject = ["@deepseek-ai/dsh-client-locale", "@deepseek-ai/dsh-api-remotes", "zod"];
    const external = ["@deepseek-ai/dsh-api-remotes/client"];
    const injectSau = remapSpecifiers(inject, map) ?? [];
    const externalSau = remapSpecifiers(external, map) ?? [];
    expect(injectSau.length).toBe(inject.length);
    expect(externalSau.length).toBe(external.length);
    const conDsh = [...injectSau, ...externalSau].filter((s) => s.startsWith(STOCK_SCOPE));
    expect(conDsh).toEqual(["@deepseek-ai/dsh-api-remotes/client"]);
    expect(injectSau.filter((s) => s.startsWith(OUR_SCOPE)).length).toBe(2);
  });

  test("10 · remap idempotent: chạy 2 lần cho cùng kết quả", () => {
    const map = new Map([["@deepseek-ai/dsh-a", "@galaxy-blackhole/gbh-a"]]);
    const mot = remapSpecifiers(["@deepseek-ai/dsh-a"], map) ?? [];
    const hai = remapSpecifiers(mot, map) ?? [];
    expect(hai).toEqual(mot);
  });

  test("11 · client-modules: nguồn index.ts CÓ áp remap vào inject + external (chống xoá nhầm)", async () => {
    const source = await Bun.file(join(REPO, "packages", "client", "modules", "src", "index.ts")).text();
    expect(source).toContain("remapSpecifiers(decl.inject, this.dshAliasMap)");
    expect(source).toContain("remapSpecifiers(decl.external ?? [], this.dshAliasMap)");
    expect(source).toContain("readDshAliasMap()");
  });

  test("12 · client-modules: KHÔNG xoá cơ chế aliases (lưới an toàn cho consumer còn require id stock)", async () => {
    const source = await Bun.file(join(REPO, "packages", "client", "modules", "src", "index.ts")).text();
    expect(source).toContain("aliases: readAliases(");
    const combos = await Bun.file(join(REPO, "packages", "client", "modules", "src", "combos.ts")).text();
    expect(combos).toContain("export function aliasRows(");
  });
});
