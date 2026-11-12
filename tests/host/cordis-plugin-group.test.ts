/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-cordis-plugin-group: artefact NGUYÊN VĂN @deepseek-ai/cordis-plugin-group
 *      (byte-identical + sha) + export surface + 0 tệp lib/types/*.js + locale + metadata provenance.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tệp nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục nguồn stock (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai", "cordis-plugin-group");
/** Thư mục gói ta. */
const OURS = join(REPO, "packages/host", "cordis-plugin-group");

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
    // 05/11/2026 (task-38 · P1b): gói ĐÃ port khai báo kiểu từ stock ⇒ chỉ được có .d.ts, KHÔNG tệp .js trong types.
    expect(existsSync(join(OURS, "lib/types")) ? readdirSync(join(OURS, "lib/types")).filter((f) => f.endsWith(".js")).length : 0).toBe(0);
    expect(existsSync(join(OURS, "lib/types", "index.d.ts"))).toBe(true);
  });
});

describe("B · export surface A≡B", () => {
  test("tập export runtime trùng stock (kể cả default)", async () => {
    const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(typeof ours["default"]).toBe(typeof stock["default"]);
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
    expect(manifest.gbh.provenance?.stock).toBe("@deepseek-ai/cordis-plugin-group");
    expect(manifest.gbh.provenance?.version).toBe("1.0.5");
    expect(manifest.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("khai báo cơ chế đúng: draft và KHÔNG gbh.row", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> };
    expect(manifest.gbh["row"]).toBeUndefined();
    expect(manifest.gbh["row_unmounted_ly_do"]).toBeUndefined();
    expect(typeof manifest.gbh["draft"]).toBe("string");
  });
});
