/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build session-query-sqlite: lib/index.js = 4 lát NGUYÊN VĂN ghép lại (byte-identical bundle gốc, cổng byte)
 *      + lib/types chép từ bản gốc + lib/index.d.ts trỏ vào cây kiểu đó
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { OUT_FILE_NAME, PART_FILES, PACKAGE_NAME, STOCK_BUNDLE, STOCK_PACKAGE_NAME } from "./src/manifest.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Số ký tự hex của sha256 in trong thông báo lỗi. */
const SHA_CHARS = 12;

/**
 * Băm SHA-256 một khối byte.
 * Nhận: bytes — nội dung cần băm.
 * Trả: chuỗi hex.
 */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Tìm vị trí BYTE đầu tiên lệch giữa hai khối byte (so TỪNG BYTE, không so ký tự — bundle có UTF-8 nhiều byte).
 * Nhận: left — byte bản ghép; right — byte bản gốc.
 * Trả: chỉ số byte lệch đầu tiên; -1 khi một khối là tiền tố của khối kia.
 */
function firstDiffByte(left: Uint8Array, right: Uint8Array): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return left.length === right.length ? -1 : limit;
}

/**
 * Build gói MỘT MẶT: ghép các lát ⇒ ĐỐI CHIẾU TỪNG BYTE với bundle gốc ⇒ ghi lib/index.js;
 * chép lib/types từ bản gốc (thiếu là lỗi) và sinh lib/index.d.ts trỏ vào cây kiểu đó.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: đường dẫn artefact chính (lib/index.js).
 */
export function buildPackage(outDir?: string): string {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembledBytes = Buffer.from(assembleBundle(), "utf8");
  const stockPath = join(REPO, STOCK_BUNDLE);
  if (!existsSync(stockPath)) throw new Error("khong thay bundle goc de doi chieu: " + stockPath);
  const stockBytes = readFileSync(stockPath);
  if (!assembledBytes.equals(stockBytes)) {
    throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + String(assembledBytes.length) + " B / sha " + sha256(assembledBytes).slice(0, SHA_CHARS) +
        " · stock " + String(stockBytes.length) + " B / sha " + sha256(stockBytes).slice(0, SHA_CHARS) +
        " · lech dau tien o byte " + String(firstDiffByte(assembledBytes, stockBytes)),
    );
  }
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, assembledBytes);
  // Cây KHAI BÁO KIỂU của bản gốc — consumer giữ ĐÚNG kiểu gốc, không viết lại tay.
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (!existsSync(stockTypes)) throw new Error("khong thay cay kieu cua ban goc: " + stockTypes);
  cpSync(stockTypes, join(out, "types"), { recursive: true });
  // Bản gốc CÓ default export (SqliteSessionQueryEngine) ⇒ khai báo lại default cho artefact ghép.
  writeFileSync(
    join(out, "index.d.ts"),
    'export * from "./types/index.js";' + EOL + 'export { SqliteSessionQueryEngine as default } from "./types/index.js";' + EOL,
    "utf8",
  );
  return file;
}

if (import.meta.main) {
  const file = buildPackage(process.argv[2]);
  console.log("built " + file + " · " + String(PART_FILES.length) + " lát · byte-identical với " + STOCK_PACKAGE_NAME + " (" + PACKAGE_NAME + ")");
}
