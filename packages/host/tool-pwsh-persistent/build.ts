/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 06/11/2026
 * desc Build tool-pwsh-persistent: lib/index.js = 1 lát NGUYÊN VĂN (cổng byte: delta 0 so với bundle gốc)
 */

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// 06/11/2026 (P1b): artefact mang id GBH — đổi id gốc → id ta bằng helper DÙNG CHUNG (theo provenance).
import { denTa } from "../../../tools/lib/id-normalize.ts";
import { assembleBundle } from "./src/assemble.ts";
import { OUT_FILE_NAME, STOCK_BUNDLE } from "./src/manifest.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * Băm SHA-256 một buffer.
 * Nhận: bytes — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Tìm chỉ số BYTE đầu tiên mà hai buffer khác nhau.
 * Nhận: left — bản ghép của ta; right — bundle gốc.
 * Trả: chỉ số byte lệch đầu tiên, hoặc -1 khi hai bên trùng nhau hoàn toàn.
 */
function firstDiff(left: Buffer, right: Buffer): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) if (left[index] !== right[index]) return index;
  return left.length === right.length ? -1 : limit;
}

/**
 * Build gói MỘT MẶT: ghép lát rồi ĐỐI CHIẾU TỪNG BYTE với bundle gốc; chỉ ghi artefact khi delta 0.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: đường dẫn artefact chính (outDir/index.js).
 * @throws {Error} khi bản ghép KHÔNG trùng từng byte với bundle gốc.
 */
export function buildPackage(outDir?: string): string {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembled = Buffer.from(assembleBundle(), "utf8");
  const stock = readFileSync(join(REPO, STOCK_BUNDLE));
  const delta = assembled.length - stock.length;
  if (delta !== 0 || firstDiff(assembled, stock) !== -1) {
    throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + String(assembled.length) + " B / sha " + sha256(assembled).slice(0, 12) +
        " · stock " + String(stock.length) + " B / sha " + sha256(stock).slice(0, 12) +
        " · delta " + String(delta) + " · lech dau tien o byte " + String(firstDiff(assembled, stock)),
    );
  }
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  // 06/11/2026 (P1b): ghi bản ĐÃ ĐỔI ID (cổng byte ở trên vẫn so bản ghép NGUYÊN VĂN với stock).
  writeFileSync(file, denTa(assembled.toString("utf8")));
  console.log(
    "built " + file + " · " + String(assembled.length) + " B · delta 0 · sha256 " + sha256(assembled),
  );
  return file;
}

if (import.meta.main) console.log(buildPackage(process.argv[2]));
