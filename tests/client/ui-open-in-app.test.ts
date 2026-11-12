/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Test goi ui-open-in-app — luat mot-id, SAU slot nguyen van, tu dien, cong idempotent
 */

import { describe, expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/** Thu muc goi cua ta (goc repo). */
const OURS = join(import.meta.dir, "..", "..", "packages", "client", "ui-open-in-app");
/** Goi GOC cua DSH trong cay runtime (chi doc) — dung lam doi chung A/B. */
const STOCK = join(import.meta.dir, "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-open-in-app");
/** Ten package cua ta — id duy nhat duoc phep dang ky. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-open-in-app";
/** Ten package goc — CHI duoc khai o aliases. */
const STOCK_NAME = "@deepseek-ai/dsh-client-ui-open-in-app";
/** Sau ten slot ma ban goc dang ky. */
const SLOTS = [
  "conversation.session.header.utilities",
  "sidebar.right.tab.files.actions",
  "sidebar.right.tab.document.actions",
  "sidebar.right.tab.document.unpreviewable",
  "deliverables.file.actions",
  "deliverables.review.file.actions",
];

/**
 * Rut ten slot ma mot doan ma dang ky — DUNG y khuon cua tools/check/rows.ts (slotNames).
 * Nhan: text — noi dung file nguon hoac artifact.
 * Tra: tap ten slot tim thay.
 */
function slotNames(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\([^)]*?name\s*:\s*["\']([^"\']+)["\']/g)) out.add(m[1] as string);
  for (const m of text.matchAll(/slots\s*\.\s*(?:inject|register)\s*\(\s*["\']([^"\']+)["\']/g)) out.add(m[1] as string);
  return out;
}

/**
 * Doc toan bo ma nguon TypeScript cua goi ta.
 * Nhan: khong co.
 * Tra: van ban gop cua moi file trong src/.
 */
function ourSources(): string {
  return readdirSync(join(OURS, "src"))
    .filter((name) => name.endsWith(".ts"))
    .map((name) => readFileSync(join(OURS, "src", name), "utf8"))
    .join("\n");
}

/** Bundle client cua ban goc (chi doc) — doi chung tap slot. */
const stockClient = readFileSync(join(STOCK, "lib", "client.js"), "utf8");
/** Manifest cua ta. */
const pkg = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as {
  dsh: { client: { inject: string[] } };
  gbh: { row: { moduleIds: string[]; aliases: string[]; id: string } };
};

describe("row ui-open-in-app — khuon bundle", () => {
  test("bundle dang ky DUNG MOT id (id cua ta), KHONG dang ky id goc", () => {
    const code = readFileSync(join(OURS, "lib", "client.js"), "utf8");
    const ids = [...code.matchAll(/__ModuleLoader__\.load\(\{ id: ("[^"]+")/g)].map((m) => JSON.parse(m[1] as string) as string);
    expect(ids).toEqual([PACKAGE_NAME]);
    // Khoa lai: id goc di qua gbh.row.aliases; dang ky no => bundle chay hai lan => app trang.
    expect(ids).not.toContain(STOCK_NAME);
    // Cong chong cai hai lan KHONG duoc khoa theo ctx (ca that HAI ENTRY thi HAI ctx nen cong chet).
    expect(code).not.toContain("lastCtx");
    expect(code).not.toContain("installedContexts");
  });

  test("package.json khai mot id + aliases giu id goc + inject Y HET ban goc", () => {
    expect(pkg.gbh.row.moduleIds).toEqual([PACKAGE_NAME]);
    expect(pkg.gbh.row.aliases).toContain(STOCK_NAME);
    const stock = JSON.parse(readFileSync(join(STOCK, "package.json"), "utf8")) as { dsh: { client: { inject: string[] } } };
    expect(pkg.dsh.client.inject).toEqual(stock.dsh.client.inject);
  });
});

describe("row ui-open-in-app — sau slot", () => {
  test("tap slot cua ta BANG tap slot cua ban goc (sau ten nguyen van)", () => {
    const theirs = [...slotNames(stockClient)].sort();
    const ours = [...slotNames(ourSources())].sort();
    expect(theirs).toEqual([...SLOTS].sort());
    expect(ours).toEqual(theirs);
  });

  test("moi register co id nguyen van open-in-app va component la THAM SO THU HAI", () => {
    const src = ourSources();
    for (const slot of SLOTS) {
      // TEN SLOT PHAI LA LITERAL trong register({ name: "..." }): truu tuong hoa la check:rows bao thieu slot.
      expect(src).toContain("name: \"" + slot + "\"");
      expect(src).toContain("ctx.slots.inject(\"" + slot + "\"");
    }
    const occupants = [...src.matchAll(/id: "open-in-app"/g)].length;
    expect(occupants).toBe(SLOTS.length);
    // Nut o tieu de phien giu nguyen thu tu chen cua ban goc.
    expect(src).toContain("order: -10");
    // Component la THAM SO THU HAI cua register(spec, Component) — khong nhet vao spec.
    const shaped = [...src.matchAll(/ctx\.slots\.register\(\s*\{[^{}]*\},\s*actions\.\w+,/g)].length;
    expect(shaped).toBe(SLOTS.length);
  });
});

describe("row ui-open-in-app — tu dien va cong cai", () => {
  test("tu dien: tap khoa cua ta BANG tap khoa ban goc (nhan ung dung + khoa giao dien)", () => {
    const stockLocales = readFileSync(join(STOCK, "lib", "types", "client", "locales.d.ts"), "utf8");
    const theirs = new Set([...stockLocales.matchAll(/readonly \'([^\']+)\':/g)].map((m) => m[1] as string));
    expect(theirs.size).toBe(45);
    const oursSrc = readFileSync(join(OURS, "src", "locales.ts"), "utf8");
    const namesBlock = oursSrc.slice(oursSrc.indexOf("export const PRODUCT_NAMES = {"), oursSrc.indexOf("export const zh = {"));
    const zhBlock = oursSrc.slice(oursSrc.indexOf("export const zh = {"), oursSrc.indexOf("export const en"));
    const keys = (block: string): string[] => [...block.matchAll(/"([a-z]+\.[a-zA-Z]+)":/g)].map((m) => m[1] as string);
    const ours = new Set([...keys(namesBlock), ...keys(zhBlock)]);
    expect(ours.size).toBe(45);
    expect([...ours].sort()).toEqual([...theirs].sort());
  });

  test("cong chong cai hai lan: co PHAM VI MODULE, va bat SAU khi dang ky xong", () => {
    const src = readFileSync(join(OURS, "src", "plugin.ts"), "utf8");
    const guard = src.indexOf("let openInAppInstalled = false;");
    const flip = src.indexOf("openInAppInstalled = true;");
    expect(guard).toBeGreaterThan(-1);
    expect(flip).toBeGreaterThan(guard);
    // Bat co SAU khi applyInner chay xong: bat som ma dang ky nem giua duong thi sau slot khong bao gio
    // duoc dang ky lai => renderer gap undefined => React #130 (ca that ui-settings-general 18/10/2026).
    expect(src.indexOf("applyInner(ctx);")).toBeLessThan(flip);
    expect(src.indexOf("function applyInner")).toBeLessThan(src.indexOf("ctx.slots.inject"));
  });
});
