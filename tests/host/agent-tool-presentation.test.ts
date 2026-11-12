/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-agent-tool-presentation: artefact NGUYÊN VĂN @deepseek-ai/dsh-agent-tool-presentation
 *      (byte-identical + sha) + export surface + 0 tệp lib/types/*.js + locale + metadata provenance.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (tệp nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục nguồn stock (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai", "dsh-agent-tool-presentation");
/** Thư mục gói ta. */
const OURS = join(REPO, "packages/host", "agent-tool-presentation");

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

  test("stock không có lib/types/*.js ⇒ gói ta chỉ có lib/index.js", () => {
    const stockTypes = existsSync(join(STOCK, "lib/types")) ? readdirSync(join(STOCK, "lib/types")).filter((f) => f.endsWith(".js")) : [];
    expect(stockTypes).toEqual([]);
    const ours = readdirSync(join(OURS, "lib")).filter((f) => f.endsWith(".js")).sort();
    expect(ours).toEqual(["index.js"]);
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
    expect(Object.keys(manifest.exports)).toEqual([".", "./package.json", "./locale/*.json"]);
  });
});

describe("C · locale + metadata", () => {
  test("locale trùng byte-for-byte stock", () => {
    for (const rel of ["en.json","zh.json"]) {
      const ours = readFileSync(join(OURS, "locale", rel));
      const stock = readFileSync(join(STOCK, "locale", rel));
      expect(ours.equals(stock)).toBe(true);
    }
  });

  test("gbh.provenance { stock, version, sha } khớp stock", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; version?: string; sha?: string } } };
    expect(manifest.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-agent-tool-presentation");
    expect(manifest.gbh.provenance?.version).toBe("0.2.1-alpha.4");
    expect(manifest.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("khai báo cơ chế đúng: nested preset và KHÔNG gbh.row", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> };
    expect(manifest.gbh["row"]).toBeUndefined();
    expect(manifest.gbh["row_unmounted_ly_do"]).toBeUndefined();
    expect(manifest.gbh["nested"]).toEqual({"kind":"preset","pluginId":"tool-presentation","stockId":"@deepseek-ai/dsh-agent-tool-presentation","presets":["preset-ptc"]});
  });
});

describe("E · runtime surface + locale + assets (đủ ≥8 ca)", () => {
  test("inject + name + (Config nếu có) A≡B", async () => {
    const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
    expect(ours["inject"]).toEqual(stock["inject"]);
    expect(ours["name"]).toBe(stock["name"]);
    expect(typeof ours["apply"]).toBe("function");
    expect(String(ours["Config"])).toBe(String(stock["Config"]));
  });

  test("locale trùng byte-for-byte stock", () => {
    for (const rel of ["en.json", "zh.json"]) {
      const ours = readFileSync(join(OURS, "locale", rel));
      const stock = readFileSync(join(STOCK, "locale", rel));
      expect(ours.equals(stock)).toBe(true);
    }
  });
  test("gói không có assets ở stock", () => {
    expect(existsSync(join(OURS, "assets"))).toBe(false);
  });
});
