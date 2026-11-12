/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build terminal: lib/index.js = lát NGUYÊN VĂN ghép lại, CỔNG BYTE `assembled === stock` (delta 0) + in bytes/delta/sha
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { OUT_FILE_NAME, STOCK_BUNDLE } from "./src/manifest.ts";

/** Gốc repo (packages/host/terminal ⇒ lên ba cấp). */
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
 * Build gói: ghép lát NGUYÊN VĂN rồi ĐỐI CHIẾU TỪNG BYTE với bundle gốc (cổng byte, delta phải bằng 0)
 * trước khi ghi artefact. Lệch một byte là ném lỗi, KHÔNG ghi gì.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: đường dẫn artefact đã ghi (lib/index.js).
 */
export function buildPackage(outDir?: string): string {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembled = assembleBundle();
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  const delta = byteDelta(assembled, stock);
  if (assembled !== stock) {
    throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + String(Buffer.byteLength(assembled, "utf8")) + " B / sha " +
        sha256(assembled).slice(0, 12) + " · stock " + String(Buffer.byteLength(stock, "utf8")) + " B / sha " +
        sha256(stock).slice(0, 12) + " · delta " + String(delta) + " · lech dau tien o byte " + String(firstDiff(assembled, stock)),
    );
  }
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, assembled);
  return file;
}

if (import.meta.main) {
  const file = buildPackage(process.argv[2]);
  const assembled = readFileSync(file, "utf8");
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  console.log(
    "terminal: " + String(Buffer.byteLength(assembled, "utf8")) + " B · delta " + String(byteDelta(assembled, stock)) +
      " · sha256 " + sha256(assembled),
  );
  console.log("built " + file);
}
