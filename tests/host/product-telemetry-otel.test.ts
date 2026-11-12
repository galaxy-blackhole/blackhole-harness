/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 02/11/2026
 * desc Đối chứng gói product-telemetry-otel với bản gốc: từng byte của lib/.
 */
import { normalizePackageNames } from "../lib/brand-parity.ts";
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục gói của ta. */
const PKG = join(REPO, "packages", "host", "product-telemetry-otel");
/** Thư mục gói gốc trong kernel. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-host-product-telemetry-otel");

/**
 * Liệt kê mọi tệp trong một cây (đệ quy).
 * Nhận: dir — thư mục gốc; goc — tiền tố để tính đường dẫn tương đối.
 * Trả: mảng đường dẫn tương đối đã sắp xếp.
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
 * Băm sha256 của một tệp.
 * Nhận: path — đường dẫn tệp.
 * Trả: chuỗi hex sha256.
 */
function sha256(path: string): string {
  return createHash("sha256").update(normalizePackageNames(readFileSync(path, "utf8"))).digest("hex");
}

describe("gbh-product-telemetry-otel — bản sao 1:1 từ bản gốc", () => {
  test("cây lib/ của ta TRÙNG TỪNG BYTE với bản gốc", () => {
    const mine = listFiles(join(PKG, "lib"));
    const theirs = listFiles(join(STOCK, "lib"));
    expect(mine).toEqual(theirs);
    for (const rel of theirs) expect(sha256(join(PKG, "lib", rel))).toBe(sha256(join(STOCK, "lib", rel)));
  });

  test("package.json: tên GBH + provenance đúng bản gốc", () => {
    const pkg = JSON.parse(readFileSync(join(PKG, "package.json"), "utf8")) as { name: string; gbh?: { provenance?: { stock?: string } } };
    expect(pkg.name).toBe("@galaxy-blackhole/gbh-product-telemetry-otel");
    expect(pkg.gbh?.provenance?.stock).toBe("@deepseek-ai/dsh-host-product-telemetry-otel");
  });
});
