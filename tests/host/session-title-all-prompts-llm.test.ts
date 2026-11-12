/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-session-title-all-prompts-llm (task-202): de-bundle 1:1 từ
 *      @deepseek-ai/dsh-session-title-all-prompts-llm — byte-identical, export surface, manifest row/nested, provenance.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Nguồn stock. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-session-title-all-prompts-llm");
/** Gói ta. */
const OURS = join(REPO, "packages/host/session-title-all-prompts-llm");
/** sha256 buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");

describe("A · de-bundle 1:1", () => {
  test("lib/index.js trùng TỪNG BYTE + sha", () => {
    expect(readFileSync(join(OURS, "lib/index.js")).equals(readFileSync(join(STOCK, "lib/index.js")))).toBe(true);
    expect(sha(readFileSync(join(OURS, "lib/index.js")))).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("đủ cây lib như stock (index.js + types)", () => {
    const stockFiles = readdirSync(join(STOCK, "lib")).sort();
    const ourFiles = readdirSync(join(OURS, "lib")).sort();
    expect(ourFiles).toEqual(stockFiles);
    expect(existsSync(join(OURS, "lib/types/index.d.ts"))).toBe(true);
  });

  test(".debundled có mặt và trỏ đúng stock", () => {
    const marker = JSON.parse(readFileSync(join(OURS, ".debundled"), "utf8")) as { stock?: string };
    expect(marker.stock).toBe("@deepseek-ai/dsh-session-title-all-prompts-llm");
  });
});

describe("B · export surface A/B", () => {
  test("tập export runtime khớp stock", async () => {
    const ours = (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>;
    const stock = (await import(pathToFileURL(join(STOCK, "lib/index.js")).href)) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
  });

  test("Config + name + inject A≡B", async () => {
    const ours = (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>;
    const stock = (await import(pathToFileURL(join(STOCK, "lib/index.js")).href)) as Record<string, unknown>;
    expect(String(ours["Config"])).toBe(String(stock["Config"]));
    expect(ours["name"]).toBe(stock["name"]);
    expect(ours["inject"]).toEqual(stock["inject"]);
  });
});

describe("C · manifest", () => {
  test("KHÔNG khai gbh.row (row long do gói khác sở hữu) + nested đúng stockId", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { row?: unknown; nested?: { stockId?: string; pluginId?: string } } };
    expect(manifest.gbh.row).toBeUndefined();
    expect(manifest.gbh.nested?.stockId).toBe("@deepseek-ai/dsh-session-title-all-prompts-llm");
    expect(manifest.gbh.nested?.pluginId).toBe("optional-session-title-all-prompts");
  });

  test("provenance khớp stock + exports mirror stock", () => {
    const ours = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; sha?: string } }; exports: Record<string, unknown> };
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { exports: Record<string, unknown> };
    expect(ours.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-session-title-all-prompts-llm");
    expect(ours.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
    expect(ours.exports).toEqual(stock.exports);
  });

  test("buildPackage copy nguyên cây lib/ ra outDir", async () => {
    const { mkdtempSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const out = mkdtempSync(join(tmpdir(), "gbh-session-title-"));
    const { buildPackage } = (await import(join(OURS, "build.ts"))) as { buildPackage(outDir?: string): Promise<string> };
    const built = await buildPackage(out);
    expect(readFileSync(built).equals(readFileSync(join(STOCK, "lib/index.js")))).toBe(true);
    rmSync(out, { recursive: true, force: true });
  });
});
