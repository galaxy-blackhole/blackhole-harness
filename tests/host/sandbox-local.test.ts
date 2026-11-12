/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Cổng 1:1 cho gbh-sandbox-local (de-bundle): lib/ phải TRÙNG BYTE stock · có dấu .debundled · exports mirror stock.
 *      KHÔNG mount · KHÔNG restart host.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Gói ta. */
const OURS = join(REPO, "packages", "host", "sandbox-local");
/** Gói gốc (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-sandbox-local");

/** Liệt kê tệp dưới một thư mục (đệ quy, đường dẫn tương đối, đã sắp xếp). */
function filesOf(dir: string): string[] {
  const out: string[] = [];
  const walk = (sub: string): void => {
    for (const name of readdirSync(join(dir, sub), { withFileTypes: true })) {
      const rel = sub === "" ? name.name : sub + "/" + name.name;
      if (name.isDirectory()) walk(rel);
      else out.push(rel);
    }
  };
  walk("");
  return out.sort();
}

describe("gbh-sandbox-local = bản gốc NGUYÊN VĂN", () => {
  test("cùng danh sách tệp + TRÙNG BYTE từng tệp trong lib/", () => {
    const ours = filesOf(join(OURS, "lib"));
    const stock = filesOf(join(STOCK, "lib"));
    expect(ours).toEqual(stock);
    for (const rel of stock) {
      const a = readFileSync(join(OURS, "lib", rel));
      const b = readFileSync(join(STOCK, "lib", rel));
      expect(a.equals(b)).toBe(true);
      expect(statSync(join(OURS, "lib", rel)).size).toBe(statSync(join(STOCK, "lib", rel)).size);
    }
  });

  test("có dấu .debundled + gbh.provenance khai đúng stock + exports mirror stock", () => {
    expect(existsSync(join(OURS, ".debundled"))).toBe(true);
    const ours = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { name: string; exports: Record<string, unknown>; gbh: { provenance: { stock: string }; tests: string[] } };
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { exports: Record<string, unknown> };
    expect(ours.gbh.provenance.stock).toBe("@deepseek-ai/dsh-sandbox-local");
    expect(ours.exports).toEqual(stock.exports);
    expect(ours.gbh.tests).toEqual(["tests/host/sandbox-local.test.ts"]);
    expect(ours.name).toBe("@galaxy-blackhole/gbh-sandbox-local");
  });
});
