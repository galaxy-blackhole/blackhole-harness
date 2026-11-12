/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Test A/B @galaxy-blackhole/gbh-compaction-image-offload (task-207): de-bundle 1:1 từ stock — byte-identical
 *      9 tệp lib + locale en/zh, export surface, row image-offload.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo. */ const REPO = join(import.meta.dir, "..", "..");
/** Stock. */ const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-compaction-image-offload");
/** Gói ta. */ const OURS = join(REPO, "packages/host/compaction-image-offload");
/** sha256. */ const sha = (b: Buffer): string => createHash("sha256").update(b).digest("hex");

describe("A · de-bundle 1:1", () => {
  test("lib/types đủ tệp + từng tệp trùng byte stock", () => {
    const stock = readdirSync(STOCK + "/lib/types").sort();
    const ours = readdirSync(OURS + "/lib/types").sort();
    expect(ours).toEqual(stock);
    expect(readFileSync(OURS + "/lib/index.js").equals(readFileSync(STOCK + "/lib/index.js"))).toBe(true);
    for (const f of stock) expect(readFileSync(join(OURS, "lib/types", f)).equals(readFileSync(join(STOCK, "lib/types", f)))).toBe(true);
  });
  test("locale en/zh trùng byte stock", () => {
    for (const f of ["en.json", "zh.json"]) expect(readFileSync(join(OURS, "locale", f)).equals(readFileSync(join(STOCK, "locale", f)))).toBe(true);
  });
  test(".debundled trỏ đúng stock + sha provenance", () => {
    expect((JSON.parse(readFileSync(OURS + "/.debundled", "utf8")) as { stock?: string }).stock).toBe("@deepseek-ai/dsh-compaction-image-offload");
    const m = JSON.parse(readFileSync(OURS + "/package.json", "utf8")) as { gbh: { provenance?: { sha?: string } } };
    expect(m.gbh.provenance?.sha).toBe(sha(readFileSync(STOCK + "/lib/index.js")));
  });
  test("buildPackage copy nguyên cây lib/ ra outDir", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs"); const { tmpdir } = await import("node:os");
    const out = mkdtempSync(join(tmpdir(), "gbh-img-offload-"));
    const { buildPackage } = (await import(join(OURS, "build.ts"))) as { buildPackage(d?: string): Promise<string> };
    expect(readFileSync(await buildPackage(out)).equals(readFileSync(STOCK + "/lib/index.js"))).toBe(true);
    rmSync(out, { recursive: true, force: true });
  });
});
describe("B · export + manifest", () => {
  test("export surface khớp stock + exports mirror stock", async () => {
    const a = (await import(pathToFileURL(OURS + "/lib/index.js").href)) as Record<string, unknown>;
    const b = (await import(pathToFileURL(STOCK + "/lib/index.js").href)) as Record<string, unknown>;
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
    const ma = JSON.parse(readFileSync(OURS + "/package.json", "utf8")) as { exports: unknown };
    const mb = JSON.parse(readFileSync(STOCK + "/package.json", "utf8")) as { exports: unknown };
    expect(ma.exports).toEqual(mb.exports);
  });
  test("KHÔNG khai gbh.row (row image-offload do gói gbh-image-offload sở hữu) + draft ghi lý do", () => {
    const m = JSON.parse(readFileSync(OURS + "/package.json", "utf8")) as { gbh: { row?: unknown; draft?: string; provenance?: { stock?: string } } };
    expect(m.gbh.row).toBeUndefined();
    expect(m.gbh.draft).toContain("gbh-image-offload");
    expect(m.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-compaction-image-offload");
  });
});
