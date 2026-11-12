/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-ptc-runtime: artefact NGUYÊN VĂN @deepseek-ai/dsh-ptc-runtime,
 *      export surface + hằng số + lớp PtcRuntime, provenance, draft.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Nguồn stock. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-ptc-runtime");
/** Gói ta. */
const OURS = join(REPO, "packages/host/ptc-runtime");
/** sha256 buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

describe("A · artefact", () => {
  test("lib/index.js trùng TỪNG BYTE + sha", () => {
    const ours = readFileSync(join(OURS, "lib/index.js"));
    const stock = readFileSync(join(STOCK, "lib/index.js"));
    expect(ours.equals(stock)).toBe(true);
    expect(sha(ours)).toBe(sha(stock));
  });
});

describe("B · export surface A/B", () => {
  test("tập export runtime khớp stock (kể cả default)", async () => {
    const ours = (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>;
    const stock = (await import(pathToFileURL(join(STOCK, "lib/index.js")).href)) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(typeof ours["default"]).toBe(typeof stock["default"]);
  });

  test("hằng số thuần A≡B: DUNDER_MEMBER · PORTABLE_RESERVED_WORDS · RESERVED_BINDING_GLOBALS · RESERVED_ERROR_MEMBERS", async () => {
    const ours = (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>;
    const stock = (await import(pathToFileURL(join(STOCK, "lib/index.js")).href)) as Record<string, unknown>;
    for (const key of ["DUNDER_MEMBER", "PORTABLE_RESERVED_WORDS", "RESERVED_BINDING_GLOBALS", "RESERVED_ERROR_MEMBERS"]) {
      expect(JSON.stringify(ours[key])).toBe(JSON.stringify(stock[key]));
    }
  });

  test("lớp PtcRuntime: tên + prototype A≡B", async () => {
    const ours = (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>;
    const stock = (await import(pathToFileURL(join(STOCK, "lib/index.js")).href)) as Record<string, unknown>;
    const oursCtor = ours["PtcRuntime"] as { name?: string };
    const stockCtor = stock["PtcRuntime"] as { name?: string };
    expect(oursCtor?.name).toBe(stockCtor?.name);
    expect(Object.getOwnPropertyNames((oursCtor as unknown as { prototype: object }).prototype).sort()).toEqual(
      Object.getOwnPropertyNames((stockCtor as unknown as { prototype: object }).prototype).sort(),
    );
  });
});

describe("C · metadata", () => {
  test("provenance khớp stock", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; sha?: string } } };
    expect(m.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-ptc-runtime");
    expect(m.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("draft + KHÔNG gbh.row", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> };
    expect(typeof m.gbh["draft"]).toBe("string");
    expect(m.gbh["row"]).toBeUndefined();
  });

  test("peerDependencies chép stock + exports chỉ . và ./package.json", () => {
    const ours = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { peerDependencies: Record<string, string>; exports: Record<string, string> };
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { peerDependencies: Record<string, string> };
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(ours.peerDependencies, stock.peerDependencies)).toBe(true);
    expect(Object.keys(ours.exports).sort()).toEqual([".", "./package.json"]);
  });

  test("không có locale ở stock ⇒ không có thư mục locale", () => {
    expect(existsSync(join(OURS, "locale"))).toBe(false);
  });
});
