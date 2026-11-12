/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-chunked-list: artefact NGUYÊN VĂN @deepseek-ai/dsh-chunked-list
 *      (byte-identical + sha) + export surface + 0 tệp lib/types/*.js + locale + metadata provenance.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tệp nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục nguồn stock (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai", "dsh-chunked-list");
/** Thư mục gói ta. */
const OURS = join(REPO, "packages/host", "chunked-list");

/** Tính sha256 của buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

describe("A · artefact byte-identical", () => {
  test("lib/index.js trùng TỪNG BYTE + cùng sha256", () => {
    const ours = readFileSync(join(OURS, "lib/index.js"));
    const stock = readFileSync(join(STOCK, "lib/index.js"));
    expect(ours.equals(stock)).toBe(true);
    expect(sha(ours)).toBe(sha(stock));
    expect(ours.length).toBe(stock.length);
  });

  test("gói không có lib/types/*.js ở stock ⇒ artefact chỉ index.js", () => {
    expect(existsSync(join(STOCK, "lib/types")) ? readdirSync(join(STOCK, "lib/types")).filter((f) => f.endsWith(".js")).length : 0).toBe(0);
    // 05/11/2026 (P1b): ta PHAT THEM .d.ts de goi TS dung duoc (stock chi co .d.ts, khong co .js).
    const ourTypes = existsSync(join(OURS, "lib/types")) ? readdirSync(join(OURS, "lib/types")) : [];
    expect(ourTypes.filter((f) => f.endsWith(".js"))).toEqual([]);
  });
});

describe("B · export surface A≡B", () => {
  test("tập export runtime trùng stock (kể cả default)", async () => {
    // Gói này KHÔNG import được trong Bun (dep 'zod' phân giải theo profile, hoặc stock dùng 'node:sea' chỉ có ở Node)
    // ⇒ so BỀ MẶT EXPORT bằng văn bản nguồn (đã byte-identical ở ca A) thay vì import động.
    try {
      const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
      const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
      expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
      expect(typeof ours["default"]).toBe(typeof stock["default"]);
    } catch {
      const oursText = readFileSync(join(OURS, "lib/index.js"), "utf8");
      const stockText = readFileSync(join(STOCK, "lib/index.js"), "utf8");
      const exportsOf = (text: string): string[] => (text.match(/export \{[^}]*\}/u)?.[0] ?? "").split("").length > 0 ? (text.match(/export \{([^}]*)\}/u)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean).sort() : [];
      expect(exportsOf(oursText)).toEqual(exportsOf(stockText));
      expect(oursText).toBe(stockText);
    }
  });

  test("gói không có subpath runtime (exports chỉ '.')", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { exports: Record<string, string> };
    expect(Object.keys(manifest.exports)).toEqual([".", "./package.json"]);
  });
});

describe("C · locale + metadata", () => {
  test("gói không có locale ở stock ⇒ không có thư mục locale", () => {
    expect(existsSync(join(OURS, "locale"))).toBe(false);
  });

  test("gbh.provenance { stock, version, sha } khớp stock", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; version?: string; sha?: string } } };
    expect(manifest.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-chunked-list");
    expect(manifest.gbh.provenance?.version).toBe("0.2.1-alpha.4");
    expect(manifest.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("khai báo cơ chế đúng: draft và KHÔNG gbh.row", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> };
    expect(manifest.gbh["row"]).toBeUndefined();
    expect(manifest.gbh["row_unmounted_ly_do"]).toBeUndefined();
    expect(typeof manifest.gbh["draft"]).toBe("string");
  });
});
