/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Vendor lại TOÀN BỘ lib/** của @deepseek-ai/dsh-session-format từ kernel đóng băng (apps/host/node_modules) và
 *      CỔNG SHA: lệch một byte là build đỏ (byte-identical, luật task-141).
 */

import { createHash } from "node:crypto";
import { cpSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Đường dẫn bản gốc trong kernel đóng băng (CHỈ ĐỌC). */
const STOCK = join(import.meta.dir, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai/dsh-session-format");

/** sha256 của lib/index.js bản gốc đã đo lúc port — CỔNG BYTE. */
export const STOCK_SHA = "6c7417ec2cd555e2781197d91c4566c88ffcf2728f362d7a2937859be57226ec";

/**
 * Vendor lại lib/** từ kernel và xác nhận BYTE-IDENTICAL.
 * Nhận: không.
 * Trả: sha256 của artifact vừa vendor (đã kiểm bằng STOCK_SHA).
 */
export function buildPackage(): string {
  cpSync(join(STOCK, "lib"), join(import.meta.dir, "lib"), { recursive: true });
  const sha = createHash("sha256").update(readFileSync(join(import.meta.dir, "lib", "index.js"))).digest("hex");
  if (sha !== STOCK_SHA) throw new Error("byte-identical FAIL: " + sha + " != " + STOCK_SHA);
  return sha;
}

if (import.meta.main) console.log("built " + buildPackage());
