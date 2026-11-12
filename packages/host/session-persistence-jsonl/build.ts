/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build session-persistence-jsonl: lib/index.js = 10 lát NGUYÊN VĂN ghép lại, ĐỐI CHIẾU TỪNG BYTE với bundle
 *      gốc (lệch 1 byte là DỪNG) + chép cây khai báo kiểu lib/types của bản gốc
 */
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { OUT_FILE_NAME, PACKAGE_NAME, PART_FILES, STOCK_BUNDLE } from "./src/manifest.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Số ký tự hex của sha256 in trong thông báo lỗi. */
const SHA_CHARS = 12;

/**
 * Băm SHA-256 một khối byte.
 * Nhận: bytes — nội dung cần băm. Trả: chuỗi hex.
 */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Tìm vị trí BYTE đầu tiên lệch giữa hai khối byte.
 * Nhận: left — bản ghép; right — bản gốc. Trả: chỉ số byte lệch; -1 khi bằng nhau hoàn toàn.
 */
function firstDiffByte(left: Uint8Array, right: Uint8Array): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return left.length === right.length ? -1 : limit;
}

/**
 * Build gói MỘT MẶT: ghép lát ⇒ ĐỐI CHIẾU TỪNG BYTE với bundle gốc ⇒ ghi lib/index.js; chép lib/types (thiếu là lỗi).
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói). Trả: đường dẫn artefact chính.
 */
export function buildPackage(outDir?: string): string {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembledBytes = Buffer.from(assembleBundle(), "utf8");
  const stockPath = join(REPO, STOCK_BUNDLE);
  if (!existsSync(stockPath)) throw new Error("không thấy bundle gốc để đối chiếu: " + stockPath);
  const stockBytes = readFileSync(stockPath);
  if (!assembledBytes.equals(stockBytes)) {
    throw new Error(
      "bản ghép KHÔNG trùng bundle gốc: assembled " + String(assembledBytes.length) + " B / sha " + sha256(assembledBytes).slice(0, SHA_CHARS) +
        " · stock " + String(stockBytes.length) + " B / sha " + sha256(stockBytes).slice(0, SHA_CHARS) +
        " · lệch đầu tiên ở byte " + String(firstDiffByte(assembledBytes, stockBytes)),
    );
  }
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, assembledBytes);
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (!existsSync(stockTypes)) throw new Error("không thấy cây kiểu của bản gốc: " + stockTypes);
  cpSync(stockTypes, join(out, "types"), { recursive: true });
  writeFileSync(join(out, "index.d.ts"), 'export * from "./types/index.js";' + String.fromCharCode(10), "utf8");
  return file;
}

if (import.meta.main) {
  const file = buildPackage(process.argv[2]);
  console.log("built " + file + " · " + String(PART_FILES.length) + " lát · byte-identical (" + PACKAGE_NAME + ")");
}
