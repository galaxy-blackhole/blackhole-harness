/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build terminal-bash: lib/index.js = hai lát NGUYÊN VĂN ghép lại (cổng BYTE với bundle gốc, delta 0)
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { OUT_FILE_NAME, PACKAGE_NAME, STOCK_BUNDLE, STOCK_PACKAGE_NAME } from "./src/manifest.ts";

/** Gốc repo (packages/host/terminal-bash ⇒ ../../../). */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Số ký tự hex của sha256 in trong thông báo lỗi. */
const SHA_CHARS = 12;

/**
 * Băm SHA-256 một khối byte.
 * Nhận: bytes — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Tìm vị trí BYTE đầu tiên lệch giữa hai khối byte (so TỪNG BYTE, không so ký tự —
 * bundle có UTF-8 nhiều byte).
 * Nhận: left — byte bản ghép của ta; right — byte bundle gốc.
 * Trả: chỉ số byte lệch đầu tiên; -1 khi hai khối bằng nhau; độ dài khối ngắn khi một khối là tiền tố.
 */
function firstDiffByte(left: Uint8Array, right: Uint8Array): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return left.length === right.length ? -1 : limit;
}

/**
 * Build gói THƯ VIỆN: ghép lát nguyên văn ⇒ CỔNG BYTE với bundle gốc (lệch một byte
 * là ném lỗi) ⇒ ghi <outDir>/index.js; in bytes/delta/sha của artefact.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: đường dẫn artefact chính (index.js).
 * @throws {Error} khi thiếu bundle gốc hoặc bản ghép KHÔNG trùng từng byte.
 */
export function buildPackage(outDir?: string): string {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembledBytes = Buffer.from(assembleBundle(), "utf8");
  const stockPath = join(REPO, STOCK_BUNDLE);
  if (!existsSync(stockPath)) throw new Error("khong thay bundle goc de doi chieu: " + stockPath);
  const stockBytes = readFileSync(stockPath);
  const delta = assembledBytes.length - stockBytes.length;
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
  console.log(
    "build " + PACKAGE_NAME + ": " + file + " · bytes=" + String(assembledBytes.length) + " · delta=" + String(delta) +
      " · sha256=" + sha256(assembledBytes) + " · stock=" + STOCK_PACKAGE_NAME,
  );
  return file;
}

if (import.meta.main) console.log(buildPackage(process.argv[2]));
