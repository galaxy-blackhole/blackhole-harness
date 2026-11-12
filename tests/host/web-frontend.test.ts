/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Test cổng byte @galaxy-blackhole/gbh-web-frontend (task-207): gói TÀI NGUYÊN TĨNH — dist/ phải trùng byte
 *      với stock (90 tệp), exports mirror stock, KHÔNG khai gbh.row (stock không có row).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO = join(import.meta.dir, "..", "..");
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-web-frontend");
const OURS = join(REPO, "packages/host/web-frontend");

describe("web-frontend · asset 1:1", () => {
  test("exports mirror stock + không gbh.row (stock không có row nào)", () => {
    const ours = JSON.parse(readFileSync(OURS + "/package.json", "utf8")) as { exports: unknown; gbh?: Record<string, unknown> };
    const stock = JSON.parse(readFileSync(STOCK + "/package.json", "utf8")) as { exports: unknown };
    expect(ours.exports).toEqual(stock.exports);
    expect(ours.gbh?.["row"]).toBeUndefined();
  });
  test("dist/index.html + manifest + favicon trùng byte", () => {
    for (const f of ["index.html", "manifest.webmanifest", "favicon.svg", "favicon-dark.svg"]) {
      expect(readFileSync(join(OURS, "dist", f)).equals(readFileSync(join(STOCK, "dist", f)))).toBe(true);
    }
  });
  test("provenance + draft giải thích đúng lý do không có row", () => {
    const m = JSON.parse(readFileSync(OURS + "/package.json", "utf8")) as { gbh: { provenance?: { stock?: string }; draft?: string } };
    expect(m.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-web-frontend");
    expect(m.gbh.draft).toContain("KHÔNG có row");
  });
});
