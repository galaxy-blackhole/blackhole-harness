/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 02/11/2026
 * desc Doi chung goi ha tang GBH voi ban goc DSH: tung byte cua lib/ va be mat export.
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { sha256Renamed } from "../lib/brand-parity.ts";
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Goc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thu muc goi cua ta. */
const PKG = join(REPO, "packages", "host/cordis");
/** Thu muc goi goc trong kernel. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "cordis");

/**
 * Liet ke moi tep trong mot cay (de quy).
 * Nhan: dir - thu muc goc; goc - tien to de tinh duong dan tuong doi.
 * Tra: mang duong dan tuong doi da sap xep.
 */
function listFiles(dir: string, goc: string = dir): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...listFiles(abs, goc));
    else out.push(abs.slice(goc.length + 1));
  }
  return out.sort();
}

/**
 * Bam sha256 cua mot tep.
 * Nhan: path - duong dan tep.
 * Tra: chuoi hex sha256.
 */
function sha256(path: string): string {
  return createHash("sha256").update(normalizePackageNames(readFileSync(path, "utf8"))).digest("hex");
}

describe("@galaxy-blackhole/gbh-cordis - ban sao 1:1 tu ban goc", () => {
  test("cay lib/ cua ta TRUNG TUNG BYTE voi ban goc (va khong thua tep nao)", () => {
    const mine = listFiles(join(PKG, "lib"));
    const theirs = listFiles(join(STOCK, "lib"));
    const skip = (list: string[]): string[] => list.filter((one) => one !== "types/index.d.ts");
    // ADR-0030: mặt kiểu của kernel CỦA TA = mặt kiểu GỐC (một thể hiện kernel) nên tệp này khác có chủ đích.
    expect(skip(mine)).toEqual(skip(theirs));
    for (const rel of theirs.filter((one) => one !== "types/index.d.ts")) {
      expect(sha256Renamed(readFileSync(join(PKG, "lib", rel), "utf8"))).toBe(sha256Renamed(readFileSync(join(STOCK, "lib", rel), "utf8")));
    }
    expect(mine.length).toBeGreaterThan(0);
  });

  test("package.json: ten GBH, main/exports CHEP nguyen ban goc, co provenance", () => {
    const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as {
      name: string;
      main?: string;
      exports?: unknown;
      gbh?: { provenance?: { stock?: string } };
    };
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as {
      main?: string;
      exports?: unknown;
    };
    expect(pkg.name).toBe("@galaxy-blackhole/gbh-cordis");
    expect(pkg.main).toBe(stock.main);
    expect(pkg.exports).toEqual(stock.exports);
    expect(pkg.gbh?.provenance?.stock).toBe("@deepseek-ai/cordis");
  });

  test("be mat export runtime TRUNG ban goc", async () => {
    // Diem vao THAT cua goi lay tu `main` cua manifest (cordis: lib/index.js; schemastery: lib/index.cjs).
    const mainOf = (dir: string): string => (JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as { main: string }).main;
    const mine = (await import(join(PKG, mainOf(PKG)))) as Record<string, unknown>;
    const theirs = (await import(join(STOCK, mainOf(STOCK)))) as Record<string, unknown>;
    expect(Object.keys(mine).sort()).toEqual(Object.keys(theirs).sort());
    expect(Object.keys(mine).length).toBeGreaterThan(0);
  });
});
