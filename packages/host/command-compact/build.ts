/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build command-compact: lib/index.js = lát NGUYÊN VĂN ghép lại, CỔNG BYTE `assembled === stock` (delta 0)
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { OUT_FILE_NAME, STOCK_BUNDLE } from "./src/manifest.ts";

/** Gốc repo (packages/host/command-compact ⇒ lên ba cấp). */
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
 * Đếm số BYTE lệch giữa hai văn bản (chênh độ dài + số vị trí khác nhau) — 0 nghĩa là trùng khít.
 * Nhận: left — bản ghép của ta; right — bundle gốc.
 * Trả: số byte lệch; 0 khi hai bên trùng nhau hoàn toàn.
 */
function deltaBytes(left: string, right: string): number {
  if (left === right) return 0;
  const limit = Math.min(left.length, right.length);
  let delta = Math.abs(left.length - right.length);
  for (let index = 0; index < limit; index += 1) if (left[index] !== right[index]) delta += 1;
  return delta;
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
  const delta = deltaBytes(assembled, stock);
  if (delta !== 0 || assembled !== stock) {
    throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + assembled.length + " B / sha " + sha256(assembled).slice(0, 12) +
        " · stock " + stock.length + " B / sha " + sha256(stock).slice(0, 12) + " · delta " + String(delta),
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
    "built " + file + " · " + Buffer.byteLength(assembled, "utf8") + " bytes · delta " + String(deltaBytes(assembled, stock)) +
      " · sha256 " + sha256(assembled),
  );
}
