/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build lib/index.js: ghép các lát nguyên văn rồi ĐỐI CHIẾU BYTE với bundle gốc trước khi ghi
 */

import { createHash } from "node:crypto";
import { denTa } from "../../../tools/lib/id-normalize.ts";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { OUT_FILE_NAME, STOCK_BUNDLE } from "./src/manifest.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * Băm SHA-256 một chuỗi.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Build gói: ghép lát → so byte với bundle gốc → ghi lib/index.js (+ chép cây .d.ts).
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: đường dẫn file đã ghi.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembled = assembleBundle();
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  if (assembled !== stock) {
    const at = [...assembled].findIndex((char, index) => char !== stock[index]);
    throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + assembled.length + " B / sha " + sha256(assembled).slice(0, 12) +
        " · stock " + stock.length + " B / sha " + sha256(stock).slice(0, 12) + " · lech dau tien o byte " + String(at),
    );
  }
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, denTa(typeof assembled === "string" ? assembled : Buffer.from(assembled).toString("utf8")));
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (existsSync(stockTypes)) cpSync(stockTypes, join(out, "types"), { recursive: true });
  return file;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])) + " (byte-identical với bundle gốc)");
}
