/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build tool-cordis: lib/index.js = 2 lát NGUYÊN VĂN ghép lại (cổng byte delta 0) + copy 6 tệp JS ./host + locale, so từng byte
 */

import { createHash } from "node:crypto";
import { denTa } from "../../../tools/lib/id-normalize.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import {
  HOST_TYPES_FILES,
  LOCALE_FILES,
  OUT_FILE_NAME,
  STOCK_BUNDLE,
  STOCK_LOCALE_DIR,
  STOCK_TYPES_DIR,
  TYPES_DIR_NAME,
} from "./src/manifest.ts";

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
 * Nhận: left — bản của ta; right — bản gốc.
 * Trả: chỉ số byte lệch đầu tiên, hoặc -1 khi hai bên trùng nhau hoàn toàn.
 */
function firstDiff(left: Buffer, right: Buffer): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) if (left[index] !== right[index]) return index;
  return left.length === right.length ? -1 : limit;
}

/**
 * Copy MỘT tệp nguyên văn rồi đọc lại để so từng byte với nguồn.
 * Nhận: stockFile — tệp gốc chỉ đọc; outFile — đích; label — nhãn in báo cáo.
 * Trả: không; in một dòng báo cáo bytes/sha.
 * @throws {Error} khi bản ghi ra KHÔNG trùng từng byte với nguồn.
 */
function copyIdentical(stockFile: string, outFile: string, label: string): void {
  const source = readFileSync(stockFile);
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, source);
  const written = readFileSync(outFile);
  if (firstDiff(written, source) !== -1) {
    throw new Error(
      label + ": copy KHONG trung nguon · " + String(written.length) + " B / sha " + sha256(written) +
        " · goc " + String(source.length) + " B / sha " + sha256(source) +
        " · lech dau tien o byte " + String(firstDiff(written, source)),
    );
  }
  console.log("copy " + label + " · " + String(source.length) + " B · sha256 " + sha256(source) + " · byte-identical");
}

/**
 * Build gói: ghép 2 lát rồi ĐỐI CHIẾU TỪNG BYTE với bundle gốc; chỉ ghi artefact khi delta 0.
 * Sau cổng byte, copy nguyên văn 6 tệp JS của subpath `./host` vào <outDir>/types và 4 tệp locale
 * vào locale/ của gói, mỗi tệp đều được so lại từng byte.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: đường dẫn artefact chính (outDir/index.js).
 * @throws {Error} khi bản ghép KHÔNG trùng từng byte với bundle gốc, hoặc khi copy lệch byte.
 */
export function buildPackage(outDir?: string): string {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembled = Buffer.from(assembleBundle(), "utf8");
  const stock = readFileSync(join(REPO, STOCK_BUNDLE));
  const delta = assembled.length - stock.length;
  const diff = firstDiff(assembled, stock);
  if (delta !== 0 || diff !== -1) {
    throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + String(assembled.length) + " B / sha " + sha256(assembled).slice(0, 12) +
        " · stock " + String(stock.length) + " B / sha " + sha256(stock).slice(0, 12) +
        " · delta " + String(delta) + " · lech dau tien o byte " + String(diff),
    );
  }
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, denTa(typeof assembled === "string" ? assembled : Buffer.from(assembled).toString("utf8")));
  console.log(
    "built " + file + " · " + String(assembled.length) + " B · delta 0 · sha256 " + sha256(assembled),
  );
  const typesOut = join(out, TYPES_DIR_NAME);
  for (const name of HOST_TYPES_FILES) {
    copyIdentical(join(REPO, STOCK_TYPES_DIR, name), join(typesOut, name), "lib/types/" + name);
  }
  const localeOut = join(import.meta.dir, "locale");
  for (const name of LOCALE_FILES) {
    copyIdentical(join(REPO, STOCK_LOCALE_DIR, name), join(localeOut, name), "locale/" + name);
  }
  console.log(
    "report: index.js 1 tep · " + String(HOST_TYPES_FILES.length) + " tep lib/types · " +
      String(LOCALE_FILES.length) + " tep locale · tat ca byte-identical",
  );
  return file;
}

if (import.meta.main) console.log(buildPackage(process.argv[2]));
