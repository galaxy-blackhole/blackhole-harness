/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Test A/B gói @galaxy-blackhole/gbh-session-format-catalog: artefact NGUYÊN VĂN @deepseek-ai/dsh-session-format-catalog
 *      (byte-identical + sha) + export surface + 6 tệp lib/types/*.js + locale + metadata provenance.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

/** Gốc repo (tệp nằm ở tests/host). */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục nguồn stock (CHỈ ĐỌC). */
const STOCK = join(REPO, "apps/host/node_modules/@deepseek-ai", "dsh-session-format-catalog");
/** Thư mục gói ta. */
const OURS = join(REPO, "packages/host", "session-format-catalog");

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

  test("lib/types/*.js: đủ 6 tệp, từng tệp byte-identical", () => {
    const files = readdirSync(join(OURS, "lib/types")).filter((f) => f.endsWith(".js")).sort();
    expect(files).toEqual(["children.js","current.js","generated.js","historical.js","index.js","message-projections.js"]);
    for (const file of files) {
      const ours = readFileSync(join(OURS, "lib/types", file));
      const stock = readFileSync(join(STOCK, "lib/types", file));
      expect(ours.equals(stock)).toBe(true);
    }
  });
});

describe("B · export surface A≡B", () => {
  test("tập export runtime trùng stock (kể cả default)", async () => {
    const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(typeof ours["default"]).toBe(typeof stock["default"]);
  });

  test("subpath runtime import chạy được và surface khớp stock", async () => {
    const file = "message-projections.js";
    const ours = (await import(join(OURS, "lib/types", file))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/types", file))) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
  });
});

describe("C · locale + metadata", () => {
  test("gói không có locale ở stock ⇒ không có thư mục locale", () => {
    expect(existsSync(join(OURS, "locale"))).toBe(false);
  });

  test("gbh.provenance { stock, version, sha } khớp stock", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: { provenance?: { stock?: string; version?: string; sha?: string } } };
    expect(manifest.gbh.provenance?.stock).toBe("@deepseek-ai/dsh-session-format-catalog");
    expect(manifest.gbh.provenance?.version).toBe("0.2.1-alpha.4");
    expect(manifest.gbh.provenance?.sha).toBe(sha(readFileSync(join(STOCK, "lib/index.js"))));
  });

  test("khai báo cơ chế đúng: draft và KHÔNG gbh.row", () => {
    const manifest = JSON.parse(readFileSync(join(OURS, "package.json"), "utf8")) as { gbh: Record<string, unknown> };
    expect(manifest.gbh["row"]).toBeUndefined();
    expect(manifest.gbh["row_unmounted_ly_do"]).toBeUndefined();
    expect(typeof manifest.gbh["draft"]).toBe("string");
  });
});

describe("D · HÀNH VI A/B với seam thật (không mạng) + subpath qua SPECIFIER gói", () => {
  test("sessionFormatCatalog: dữ liệu A≡B (JSON sâu)", async () => {
    const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
    expect(JSON.stringify(ours["sessionFormatCatalog"])).toBe(JSON.stringify(stock["sessionFormatCatalog"]));
  });

  test("historicalSessionFormatCatalog: dữ liệu A≡B (JSON sâu)", async () => {
    const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
    expect(JSON.stringify(ours["historicalSessionFormatCatalog"])).toBe(JSON.stringify(stock["historicalSessionFormatCatalog"]));
  });

  test("createSessionFormatCatalogWithChildren: hành vi lỗi A≡B khi thiếu tham số", async () => {
    const ours = (await import(join(OURS, "lib/index.js"))) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/index.js"))) as Record<string, unknown>;
    const run = (mod: Record<string, unknown>): string => {
      try {
        (mod["createSessionFormatCatalogWithChildren"] as (...args: unknown[]) => unknown)();
        return "KHONG-NEM";
      } catch (error) {
        return String((error as Error).message ?? error);
      }
    };
    expect(run(ours)).toBe(run(stock));
  });

  test("subpath ./message-projections import qua SPECIFIER gói (không phải đường dẫn file)", async () => {
    // Phân giải qua EXPORTS của gói (specifier), dùng resolver của chính gói ta (tests/host không có node_modules).
    const requireFromPackage = createRequire(join(OURS, "package.json"));
    const resolved = requireFromPackage.resolve("@galaxy-blackhole/gbh-session-format-catalog/message-projections");
    const ours = (await import(pathToFileURL(resolved).href)) as Record<string, unknown>;
    const stock = (await import(join(STOCK, "lib/types/message-projections.js"))) as Record<string, unknown>;
    expect(Object.keys(ours).sort()).toEqual(Object.keys(stock).sort());
    expect(JSON.stringify(ours)).toBe(JSON.stringify(stock));
  });
});
