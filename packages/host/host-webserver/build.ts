/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build host-webserver: lib/index.js = 4 lát NGUYÊN VĂN ghép lại (byte-identical bundle gốc, cổng byte)
 *      + lib/types (chép từ gốc) + lib/index.d.ts + 1 lời gọi Bun.build cho entry nguồn.
 */

import { createHash } from "node:crypto";

/** 05/11/2026 (P1b): artefact ghi ra mang id CUA TA; cong byte van so tren ban ghep nguyen van. */
const denTa = (text: string): string => text.split("@deepseek-ai/dsh-").join("@galaxy-blackhole/gbh-");
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { HOST_PARTS_DIR_NAME, OUT_FILE_NAME, STOCK_BUNDLE } from "./src/manifest.ts";

/** Gốc repo (packages/host/host-webserver ⇒ ../../..). */
const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * Băm SHA-256 một chuỗi.
 * Nhận: text — nội dung cần băm (UTF-8). Trả: chuỗi hex 64 ký tự.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Cổng BYTE TUYỆT ĐỐI: artefact phải trùng TỪNG BYTE với bundle gốc.
 * Nhận: assembled — văn bản ghép; stock — văn bản gốc. Trả: không (ném khi lệch).
 */
function assertByteIdentical(assembled: string, stock: string): void {
  if (!Buffer.from(assembled, "utf8").equals(Buffer.from(stock, "utf8"))) {
    throw new Error("ban ghep KHONG trung bundle goc: " + String(Buffer.byteLength(assembled)) + " B / sha " + sha256(assembled).slice(0, 16) + " · stock " + String(Buffer.byteLength(stock)) + " B / sha " + sha256(stock).slice(0, 16));
  }
}

/**
 * Build artefact host + kiểu + entry Bun.build.
 * Nhận: outDir — thư mục đích (mặc định <gói>/lib). Trả: đường dẫn lib/index.js.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  const assembled = assembleBundle(join(import.meta.dir, "src", HOST_PARTS_DIR_NAME));
  // 20/10/2026: SAI LỆCH CÓ CHỦ ĐÍCH — `READY_MARKUP` phát `__GBH_BOOT_READY__` (vỏ SPA CỦA TA đọc tên GBH).
  // Cổng byte chỉ bỏ qua ĐÚNG một khác biệt này; mọi khác biệt khác vẫn bị chặn.
  assertByteIdentical(assembled.split("__GBH_BOOT_READY__").join("__DSH_BOOT_READY__"), readFileSync(join(REPO, STOCK_BUNDLE), "utf8"));
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, denTa(assembled));
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (existsSync(stockTypes)) {
    cpSync(stockTypes, join(out, "types"), { recursive: true });
    writeFileSync(join(out, "index.d.ts"), 'export * from "./types/index.js";' + String.fromCharCode(10) + 'export { WebServer as default } from "./types/index.js";' + String.fromCharCode(10));
  }
  const sourceBuild = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "index.ts")], outdir: out, naming: "index-entry.js", target: "bun", format: "esm", packages: "external" });
  if (!sourceBuild.success) throw new Error("Bun.build entry nguon that bai: " + sourceBuild.logs.map(String).join(" | "));
  return file;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])) + " (byte-identical voi bundle goc) + types + entry");
}
