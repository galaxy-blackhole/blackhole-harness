/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-app-boot (kernel boot library): ghép [7] lát NGUYÊN VĂN thành
 *      lib/index.js byte-identical stock + worker JS nguyên văn + export surface + hằng số thuần + provenance.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assembleHostParts, buildPackage } from "../../packages/host/app-boot/build.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Nguồn stock. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-app-boot");
/** Gói ta. */
const OURS = join(REPO, "packages/host/app-boot");
/** sha256 buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

describe("A · cổng byte (kernel boot — sai là chết boot)", () => {
  test("lib/index.js trùng TỪNG BYTE stock + cùng sha", () => {
    const ours = readFileSync(join(OURS, "lib/index.js"));
    const stock = readFileSync(join(STOCK, "lib/index.js"));
    expect(ours.equals(stock)).toBe(true);
    expect(sha(ours)).toBe(sha(stock));
  });

  test("assembleHostParts() + EOL === stock (cổng byte của build)", () => {
    const stock = readFileSync(join(STOCK, "lib/index.js"), "utf8");
    const expected = stock.endsWith("\n") ? stock.slice(0, -1) : stock;
    expect(assembleHostParts()).toBe(expected);
  });

  test("lib/worker/*.js copy NGUYÊN VĂN, đủ số tệp", () => {
    const stockFiles = readdirSync(join(STOCK, "lib/worker")).filter((f) => f.endsWith(".js")).sort();
    const ourFiles = readdirSync(join(OURS, "lib/worker")).filter((f) => f.endsWith(".js")).sort();
    expect(ourFiles).toEqual(stockFiles);
    for (const file of stockFiles) {
      expect(readFileSync(join(OURS, "lib/worker", file)).equals(readFileSync(join(STOCK, "lib/worker", file)))).toBe(true);
    }
  });

  test("buildPackage() chạy lại vẫn delta 0 (idempotent)", () => {
    expect(buildPackage(join(OURS, "lib"))).toContain("CỔNG BYTE ĐẠT");
    expect(readFileSync(join(OURS, "lib/index.js")).equals(readFileSync(join(STOCK, "lib/index.js")))).toBe(true);
  });
});

describe("B · export surface + hằng số thuần A/B", () => {
  test("tập export runtime khớp stock (kể cả hằng số)", async () => {
    const ours = (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>;
    const stock = (await import(pathToFileURL(join(STOCK, "lib/index.js")).href)) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
  });

  test("hằng số thuần A≡B (JSON sâu): DEFAULT_PROFILE_BUNDLES · ON_DEMAND_BUNDLES · OPTIONAL_BUNDLES · PROFILE_TEMPLATES", async () => {
    const ours = (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>;
    const stock = (await import(pathToFileURL(join(STOCK, "lib/index.js")).href)) as Record<string, unknown>;
    for (const key of ["DEFAULT_PROFILE_BUNDLES", "ON_DEMAND_BUNDLES", "OPTIONAL_BUNDLES", "PROFILE_TEMPLATES", "OFFICIAL_ON_DEMAND_CATALOG"]) {
      expect(JSON.stringify(ours[key])).toBe(JSON.stringify(stock[key]));
    }
  });

  test("subpath worker bootstrap import được và surface khớp stock", async () => {
    const ours = (await import(pathToFileURL(join(OURS, "lib/worker/profile-resolution-bootstrap.js")).href)) as Record<string, unknown>;
    const stock = (await import(pathToFileURL(join(STOCK, "lib/worker/profile-resolution-bootstrap.js")).href)) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
  });
});

describe("C · metadata", () => {
  test("provenance { stock, version, sha } khớp stock", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; version?: string; sha?: string } } };
    expect(m.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-app-boot");
    expect(m.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("draft (kernel boot lib) — KHÔNG gbh.row/row_unmounted_ly_do, KHÔNG mount", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> };
    expect(typeof m.gbh["draft"]).toBe("string");
    expect(m.gbh["row"]).toBeUndefined();
    expect(m.gbh["row_unmounted_ly_do"]).toBeUndefined();
  });

  test("exports mirror runtime: . · ./package.json · ./worker/profile-resolution-bootstrap", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { exports: Record<string, string> };
    expect(Object.keys(m.exports).sort()).toEqual([".", "./package.json", "./worker/profile-resolution-bootstrap"]);
    expect(existsSync(join(OURS, "lib/worker/profile-resolution-bootstrap.js"))).toBe(true);
  });
});
