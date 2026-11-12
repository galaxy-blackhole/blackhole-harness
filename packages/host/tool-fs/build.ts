/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build tool-fs: lib/index.js = 2 lát NGUYÊN VĂN ghép lại (cổng byte: assembled === bundle gốc, delta 0)
 */

import { denTa } from "../../../tools/lib/id-normalize.ts";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { OUT_FILE_NAME, STOCK_BUNDLE } from "./src/manifest.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * Băm SHA-256 một chuỗi UTF-8.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Đếm số BYTE UTF-8 khác nhau giữa hai văn bản (chênh độ dài tính là byte lệch).
 * Nhận: left — bản ghép của ta; right — bundle gốc.
 * Trả: 0 khi trùng khít hoàn toàn.
 */
function byteDelta(left: string, right: string): number {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  const limit = Math.min(a.length, b.length);
  let delta = Math.abs(a.length - b.length);
  for (let index = 0; index < limit; index += 1) if (a[index] !== b[index]) delta += 1;
  return delta;
}

/**
 * Tìm chỉ số BYTE đầu tiên mà hai văn bản khác nhau.
 * Nhận: left — bản ghép của ta; right — bundle gốc.
 * Trả: chỉ số byte lệch đầu tiên, hoặc -1 khi hai bên trùng nhau hoàn toàn.
 */
function firstDiff(left: string, right: string): number {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  const limit = Math.min(a.length, b.length);
  for (let index = 0; index < limit; index += 1) if (a[index] !== b[index]) return index;
  return a.length === b.length ? -1 : limit;
}

/**
 * Build gói MỘT MẶT: ghép các lát rồi ĐỐI CHIẾU TỪNG BYTE với bundle gốc (cổng byte, delta 0) ⇒ outDir/index.js.
 * Nhận: outDir — thư mục đích dạng CHUỖI (mặc định: lib cạnh gói).
 * Trả: đường dẫn artefact chính (outDir/index.js).
 */
export function buildPackage(outDir?: string): string {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembled = assembleBundle();
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  const delta = byteDelta(assembled, stock);
  const bytes = Buffer.byteLength(assembled, "utf8");
  if (assembled !== stock) {
    throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + String(bytes) + " B / sha " + sha256(assembled).slice(0, 12) +
        " · stock " + String(Buffer.byteLength(stock, "utf8")) + " B / sha " + sha256(stock).slice(0, 12) +
        " · delta " + String(delta) + " · lech dau tien o byte " + String(firstDiff(assembled, stock)),
    );
  }
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, denTa(typeof assembled === "string" ? assembled : Buffer.from(assembled).toString("utf8")));
  console.log("tool-fs: " + String(bytes) + " B · delta " + String(delta) + " · sha256 " + sha256(assembled));
  return file;
}

if (import.meta.main) console.log(buildPackage(process.argv[2]));
