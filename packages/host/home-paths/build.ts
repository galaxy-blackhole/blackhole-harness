/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vendor lại TOÀN BỘ lib/** của @deepseek-ai/dsh-home-paths từ kernel đóng băng + CỔNG SHA (byte-identical).
 */

import { createHash } from "node:crypto";
import { cpSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Đường dẫn bản gốc trong kernel đóng băng (CHỈ ĐỌC). */
const STOCK = join(import.meta.dir, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai/dsh-home-paths");

/** sha256 của lib/index.js bản gốc đã đo lúc port. */
export const STOCK_SHA = "9877a6117c5def69b61fae12f70a7a7400894a9dc4a9f7069ce4cc58aeb66e9d";

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
