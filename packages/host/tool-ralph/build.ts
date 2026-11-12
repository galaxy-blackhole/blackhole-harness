/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 06/11/2026
 * desc Build tool-ralph: lib/index.js = 3 lát NGUYÊN VĂN ghép lại, CỔNG BYTE đối chiếu bundle gốc (delta 0)
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
 * Băm SHA-256 một dãy byte.
 * Nhận: bytes — dãy byte cần băm.
 * Trả: chuỗi hex.
 */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Tìm chỉ số BYTE đầu tiên mà hai dãy khác nhau.
 * Nhận: left — bản ghép của ta; right — bundle gốc.
 * Trả: chỉ số byte lệch đầu tiên, hoặc -1 khi hai bên trùng nhau hoàn toàn.
 */
function firstDiffByte(left: Uint8Array, right: Uint8Array): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) if (left[index] !== right[index]) return index;
  return left.length === right.length ? -1 : limit;
}

/**
 * Build gói MỘT MẶT: ghép các lát rồi ĐỐI CHIẾU TỪNG BYTE với bundle gốc ⇒ lib/index.js (đồng bộ).
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: đường dẫn artefact chính (lib/index.js).
 */
export function buildPackage(outDir?: string): string {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembled = assembleBundle();
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  const ours = Buffer.from(assembled, "utf8");
  const theirs = Buffer.from(stock, "utf8");
  const delta = ours.length - theirs.length;
  if (assembled !== stock) {
    throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + ours.length + " B / sha " + sha256(ours).slice(0, 12) +
        " · stock " + theirs.length + " B / sha " + sha256(theirs).slice(0, 12) + " · delta " + String(delta) +
        " · lech dau tien o byte " + String(firstDiffByte(ours, theirs)),
    );
  }
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  // 06/11/2026 (P1b): ghi bản ĐÃ ĐỔI ID (cổng byte ở trên vẫn so bản ghép NGUYÊN VĂN với stock).
  writeFileSync(file, denTa(assembled));
  return file;
}

if (import.meta.main) {
  const file = buildPackage(process.argv[2]);
  const bytes = readFileSync(file);
  console.log("built " + file + " · " + String(bytes.length) + " B · delta 0 · sha256 " + sha256(bytes));
}
