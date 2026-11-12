/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vendor lại TOÀN BỘ lib/** của @deepseek-ai/dsh-util-workspace-path từ kernel đóng băng + CỔNG SHA (byte-identical).
 */

import { createHash } from "node:crypto";
import { cpSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Đường dẫn bản gốc trong kernel đóng băng (CHỈ ĐỌC). */
const STOCK = join(import.meta.dir, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai/dsh-util-workspace-path");

/** sha256 của lib/index.js bản gốc đã đo lúc port. */
export const STOCK_SHA = "5129d81b46c8f62ef084817af6a8e149724b7e69a253c40e3594805148742528";

/**
 * Vendor lại lib/** từ kernel và xác nhận BYTE-IDENTICAL.
 * Nhận: không.
 * Trả: sha256 của artifact vừa vendor (đã kiểm bằng STOCK_SHA).
 */
export function buildPackage(): string {
  cpSync(join(STOCK, "lib"), join(import.meta.dir, "lib"), { recursive: true });
  const actual = createHash("sha256").update(readFileSync(join(import.meta.dir, "lib", "index.js"))).digest("hex");
  if (actual !== STOCK_SHA) throw new Error("byte-identical FAIL: " + actual + " != " + STOCK_SHA);
  return actual;
}

if (import.meta.main) console.log("built " + buildPackage());
