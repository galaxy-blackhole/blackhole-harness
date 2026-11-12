/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-typert-protocol: artefact NGUYÊN VĂN @deepseek-ai/dsh-typert-protocol,
 *      export surface, 8 tệp lib/types/*.js, locale, provenance — thư viện (draft).
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
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai", "dsh-typert-protocol");
/** Gói ta. */
const OURS = join(REPO, "packages/host", "typert-protocol");
/** sha256 buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

describe("A · artefact byte-identical", () => {
  test("lib/index.js trùng từng byte + sha", () => {
    const ours = readFileSync(join(OURS, "lib/index.js"));
    const stock = readFileSync(join(STOCK, "lib/index.js"));
    expect(ours.equals(stock)).toBe(true);
    expect(sha(ours)).toBe(sha(stock));
  });

  test("lib/types/*.js: đủ 8 tệp, từng tệp byte-identical", () => {
    const files = readdirSync(join(OURS, "lib/types")).filter((f) => f.endsWith(".js")).sort();
    expect(files).toEqual(["index.js","json-value.js","owned-value.js","principal.js","remote-access.js","remote-error.js","remote-info.js","types.js"]);
    for (const file of files) {
      expect(readFileSync(join(OURS, "lib/types", file)).equals(readFileSync(join(STOCK, "lib/types", file)))).toBe(true);
    }
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

  test("subpath import qua SPECIFIER gói chạy được (resolver exports)", async () => {
    const requireFromPackage = createRequire(join(OURS, "package.json"));
    const sub = "types";
    const resolved = requireFromPackage.resolve("@galaxy-blackhole/gbh-typert-protocol/" + sub);
    // Subpath chỉ cần PHÂN GIẢI qua exports + nạp được; một số tệp types.js rỗng export là hợp lệ.
    expect(resolved.endsWith("lib/types/" + sub + ".js")).toBe(true);
    const mod = (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
    expect(typeof mod).toBe("object");
    const stockResolved = createRequire(join(STOCK, "package.json")).resolve("@deepseek-ai/dsh-typert-protocol/" + sub);
    expect(resolved.endsWith("/" + sub + ".js")).toBe(stockResolved.endsWith("/" + sub + ".js"));
  });
});

describe("C · metadata + provenance", () => {
  test("gbh.provenance { stock, version, sha } khớp stock", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; version?: string; sha?: string } } };
    expect(m.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-typert-protocol");
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
