/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Vendor lại lib/** của @deepseek-ai/dsh-tool-subagent-control từ kernel đóng băng + CỔNG SHA. Cần tệp này để `check:rows` nhận
 *      gói là DE-BUNDLE (không có src/index.ts) và đối chiếu export trên ARTIFACT thay vì chặn mount.
 */

import { createHash } from "node:crypto";
import { cpSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Đường dẫn bản gốc trong kernel đóng băng (CHỈ ĐỌC). */
const STOCK = join(import.meta.dir, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai/dsh-tool-subagent-control");

/** sha256 của lib/index.js bản gốc đã đo lúc port. */
export const STOCK_SHA = "3f64ef2df3bfc7d7f5e31607949246dc64c32bf4179b74188bc4b764e081af38";

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
