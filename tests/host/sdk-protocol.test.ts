/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-sdk-protocol: artefact NGUYÊN VĂN @deepseek-ai/dsh-sdk-protocol,
 *      export surface, 0 tệp lib/types/*.js, locale, provenance — thư viện (draft).
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Nguồn stock. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai", "dsh-sdk-protocol");
/** Gói ta. */
const OURS = join(REPO, "packages/host", "sdk-protocol");
/** sha256 buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

describe("A · artefact byte-identical", () => {
  test("lib/index.js trùng từng byte + sha", () => {
    const ours = readFileSync(join(OURS, "lib/index.js"));
    const stock = readFileSync(join(STOCK, "lib/index.js"));
    expect(ours.equals(stock)).toBe(true);
    expect(sha(ours)).toBe(sha(stock));
  });

  test("stock không có lib/types/*.js ⇒ gói ta chỉ có index.js", () => {
    expect(existsSync(join(STOCK, "lib/types")) ? readdirSync(join(STOCK, "lib/types")).filter((f) => f.endsWith(".js")) : []).toEqual([]);
    expect(readdirSync(join(OURS, "lib")).filter((f) => f.endsWith(".js"))).toEqual(["index.js"]);
  });
});

describe("B · export surface", () => {
  test("tập export runtime khớp stock (kể cả default) hoặc văn bản nguồn khớp", async () => {
    try {
      const ours = (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>;
      const stock = (await import(pathToFileURL(join(STOCK, "lib/index.js")).href)) as Record<string, unknown>;
      expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
      expect(typeof ours["default"]).toBe(typeof stock["default"]);
    } catch {
      const oursText = readFileSync(join(OURS, "lib/index.js"), "utf8");
      const stockText = readFileSync(join(STOCK, "lib/index.js"), "utf8");
      expect(oursText).toBe(stockText);
    }
  });

  test("gói không có subpath runtime ⇒ exports chỉ '.' và './package.json'", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { exports: Record<string, string> };
    expect(Object.keys(m.exports).sort()).toEqual([".", "./package.json"]);
  });
});

describe("C · metadata + provenance", () => {
  test("gbh.provenance { stock, version, sha } khớp stock", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; version?: string; sha?: string } } };
    expect(m.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-sdk-protocol");
    expect(m.gbh.provenance?.version).toBe("0.2.1-alpha.4");
    expect(m.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("khai draft (thư viện), KHÔNG gbh.row/row_unmounted_ly_do", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> };
    expect(typeof m.gbh["draft"]).toBe("string");
    expect(m.gbh["row"]).toBeUndefined();
    expect(m.gbh["row_unmounted_ly_do"]).toBeUndefined();
  });

  test("peerDependencies chép đúng JSON stock", () => {
    const ours = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { peerDependencies: Record<string, string> };
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { peerDependencies: Record<string, string> };
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(ours.peerDependencies, stock.peerDependencies)).toBe(true);
  });

  test("stock không có locale ⇒ gói ta không có thư mục locale", () => {
    expect(existsSync(join(OURS, "locale"))).toBe(false);
  });
});
