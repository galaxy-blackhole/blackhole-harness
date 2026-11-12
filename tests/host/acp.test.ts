/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-acp: byte-identical + export surface + Config + hành vi lỗi của
 *      apply() với Context thiếu dịch vụ (A≡B) + draft metadata.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assembleHostParts } from "../../packages/host/acp/build.ts";
import { sameAfterIdMap } from "../lib/brand-parity.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Nguồn stock. */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai/dsh-acp");
/** Gói ta. */
const OURS = join(REPO, "packages/host/acp");
/** sha256 buffer. */
const sha = (buf: Buffer): string => createHash("sha256").update(buf).digest("hex");
/** Nạp 2 bên. */
const load = async (): Promise<{ ours: Record<string, unknown>; stock: Record<string, unknown> }> => ({
  ours: (await import(pathToFileURL(join(OURS, "lib/index.js")).href)) as Record<string, unknown>,
  stock: (await import(pathToFileURL(join(STOCK, "lib/index.js")).href)) as Record<string, unknown>,
});
/** Chạy và bắt lỗi, trả message. */
const messageOf = async (fn: () => Promise<unknown> | unknown): Promise<string> => {
  try { await fn(); return "KHONG-NEM"; } catch (error) { return String((error as Error).message ?? error); }
};

describe("A · artefact + build", () => {
  test("lib/index.js trùng TỪNG BYTE + sha", () => {
    expect(readFileSync(join(OURS, "lib/index.js")).equals(readFileSync(join(STOCK, "lib/index.js")))).toBe(true);
    expect(sha(readFileSync(join(OURS, "lib/index.js")))).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("assembleHostParts() + EOL === stock", () => {
    expect(assembleHostParts() + "\n").toBe(readFileSync(join(STOCK, "lib/index.js"), "utf8"));
  });
});

describe("B · export surface + Config", () => {
  test("tập export runtime khớp stock", async () => {
    const { ours, stock } = await load();
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
  });

  test("Config/name/inject A≡B", async () => {
    const { ours, stock } = await load();
    expect(String(ours["Config"])).toBe(String(stock["Config"]));
    expect(ours["name"]).toBe(stock["name"]);
    expect(ours["inject"]).toEqual(stock["inject"]);
  });

  test("inject có đủ các seam chính (agent factory/session events/logger…)", async () => {
    const { ours } = await load();
    const inject = ours["inject"] as string[];
    expect(inject.length).toBeGreaterThanOrEqual(4);
    for (const key of inject) expect(typeof key).toBe("string");
  });
});

describe("C · hành vi apply với Context thiếu dịch vụ (A≡B)", () => {
  test("apply({}) ném lỗi cùng message ở A và B", async () => {
    const { ours, stock } = await load();
    const a = await messageOf(() => (ours["apply"] as (ctx: unknown, cfg: unknown) => unknown)({}, {}));
    const b = await messageOf(() => (stock["apply"] as (ctx: unknown, cfg: unknown) => unknown)({}, {}));
    expect(a).toBe(b);
  });

  test("apply với ctx thiếu sessionPersistence ném cùng message ở A và B", async () => {
    const { ours, stock } = await load();
    const fakeCtx = { logger: { info: () => {}, warn: () => {}, error: () => {} } };
    const a = await messageOf(() => (ours["apply"] as (ctx: unknown, cfg: unknown) => unknown)(fakeCtx, { provider: "p", model: "m" }));
    const b = await messageOf(() => (stock["apply"] as (ctx: unknown, cfg: unknown) => unknown)(fakeCtx, { provider: "p", model: "m" }));
    expect(a).toBe(b);
  });
});

describe("D · metadata gói", () => {
  test("provenance + draft + KHÔNG row", () => {
    const m = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> & { provenance?: { stock?: string; sha?: string } } };
    expect(m.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-acp");
    expect(m.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
    expect(typeof m.gbh["draft"]).toBe("string");
    expect(m.gbh["row"]).toBeUndefined();
  });

  test("exports chỉ . và ./package.json; peers chép stock", () => {
    const ours = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { exports: Record<string, string>; peerDependencies: Record<string, string> };
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { peerDependencies: Record<string, string> };
    expect(Object.keys(ours.exports).sort()).toEqual([".", "./package.json"]);
    // P1b (04/11/2026): so SAU khi quy id (ten goi cua ta vs ten stock).
    expect(sameAfterIdMap(ours.peerDependencies, stock.peerDependencies)).toBe(true);
  });
});
