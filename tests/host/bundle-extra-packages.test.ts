/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test 2 gói R12 còn lại: gbh-lazy-require (A/B cache thành công / lỗi KHÔNG cache) và
 *      gbh-package-manifest (type-only: export runtime RỖNG, tập tên kiểu khớp bản gốc).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createLazyRequire as oursLazy } from "../../packages/host/lazy-require/src/index.ts";
import * as manifest from "../../packages/host/package-manifest/src/index.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Module GỐC của kernel (CHỈ ĐỌC) — oracle A/B. */
const stockLazy = (await import(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-lazy-require", "lib", "index.js"))) as { createLazyRequire: (specifier: string, parentURL: string) => () => unknown };

describe("gbh-lazy-require — A/B với bản gốc", () => {
  test("tập export BẰNG gốc: chỉ createLazyRequire", () => {
    expect(Object.keys(stockLazy)).toEqual(["createLazyRequire"]);
    expect(typeof oursLazy).toBe("function");
    expect(oursLazy.length).toBe(stockLazy.createLazyRequire.length);
  });

  test("CACHE THÀNH CÔNG: hai lần gọi trả CÙNG một giá trị, và giống bản gốc", () => {
    const parentURL = import.meta.url;
    for (const factory of [oursLazy, stockLazy.createLazyRequire]) {
      const load = factory("node:path", parentURL);
      const first = load();
      const second = load();
      expect(first).toBe(second);
      expect(typeof (first as { join?: unknown }).join).toBe("function");
    }
  });

  test("LỖI KHÔNG CACHE: gọi lại vẫn NÉM (cả hai bên), không nuốt lỗi lần đầu", () => {
    const parentURL = import.meta.url;
    const missing = "node:khong-ton-tai-" + Date.now();
    for (const factory of [oursLazy, stockLazy.createLazyRequire]) {
      const load = factory(missing, parentURL);
      expect(() => load()).toThrow();
      expect(() => load()).toThrow();
    }
  });
});

describe("gbh-package-manifest — type-only", () => {
  test("export RUNTIME rỗng y bản gốc (lib/index.js gốc = export {})", () => {
    expect(Object.keys(manifest)).toEqual([]);
    const stockEntry = readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-package-manifest", "lib", "index.js"), "utf8").trim();
    expect(stockEntry).toBe("export {};");
  });

  test("tập KHAI BÁO KIỂU của ta khớp bản gốc (đếm export trong .d.ts gốc vs src/index.ts)", () => {
    const namesOf = (text: string): string[] => [...text.matchAll(/^export (?:declare )?(?:interface|type|const|function|class) ([A-Za-z0-9_$]+)/gm)].map((m) => m[1] as string).sort();
    const stock = namesOf(readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-package-manifest", "lib", "types", "index.d.ts"), "utf8"));
    const ours = namesOf(readFileSync(join(REPO, "packages", "host", "package-manifest", "src", "index.ts"), "utf8"));
    // .d.ts gốc có thể dùng `export declare …` hoặc chỉ `export {…}`; đếm cả hai dạng.
    if (stock.length === 0) {
      const exportBlocks = [...readFileSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-package-manifest", "lib", "types", "index.d.ts"), "utf8").matchAll(/export \{([^}]*)\}/g)].flatMap((m) => (m[1] ?? "").split(",").map((s) => s.trim()).filter((s) => s.length > 0));
      expect(exportBlocks.length).toBe(0);
      expect(readFileSync(join(REPO, "packages", "host", "package-manifest", "src", "index.ts"), "utf8")).toContain("export");
      return;
    }
    expect(ours).toEqual(stock);
  });
});
