/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Build gói @galaxy-blackhole/gbh-headless: ghép 2 entry (index · startup) NGUYÊN VĂN + copy
 *      json-stream-BA-F3lfb.js nguyên văn, mỗi tệp so TỪNG BYTE với stock (cổng byte delta 0).
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");
/** Nguồn stock CHỈ ĐỌC. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-headless");
/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);
/** Tệp CHUNK thuần hàm copy nguyên văn (index/startup import đúng tên này). */
const CHUNK = "json-stream-BA-F3lfb.js";

/**
 * Bóc scaffold khỏi một lát rồi trả các dòng thân.
 * Nhận: text — nội dung tệp lát. Trả: các dòng thân nguyên văn.
 */
function sliceBody(text: string): string[] {
  const rows = text.split(EOL);
  const start = rows.indexOf("// @ts-nocheck") + 2;
  const end = rows.lastIndexOf("export {};") - 1;
  return rows.slice(start, end);
}

/**
 * Ghép các lát có tiền tố cho trước thành văn bản (không newline cuối).
 * Nhận: prefix — "part-index" hoặc "part-startup". Trả: văn bản đã ghép.
 */
export function assembleHostParts(prefix: string): string {
  const dir = join(import.meta.dir, "src", "parts");
  return readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".ts")).sort().map((f) => sliceBody(readFileSync(join(dir, f), "utf8")).join(EOL)).join(EOL);
}

/**
 * Build gói: ghép 2 entry + copy chunk, mỗi tệp có CỔNG BYTE riêng so với stock.
 * Nhận: outDir — thư mục đích (mặc định lib/). Trả: báo cáo dạng chuỗi.
 */
export function buildPackage(outDir: string = join(import.meta.dir, "lib")): string {
  mkdirSync(outDir, { recursive: true });
  const reports: string[] = [];
  for (const [partPrefix, file] of [["part-index", "index.js"], ["part-startup", "startup.js"]] as const) {
    const stockText = readFileSync(join(STOCK, "lib", file), "utf8");
    const expected = stockText
    // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator.
    .split("@deepseek-ai/dsh-typert-generator")
    .join("@galaxy-blackhole/gbh-typert-generator")
    // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator.
    .split("@galaxy-blackhole/gbh-typert-generator")
    .join("@galaxy-blackhole/gbh-typert-generator").endsWith(EOL) ? stockText.slice(0, -1) : stockText;
    const assembled = assembleHostParts(partPrefix);
    if (assembled !== expected) throw new Error("CỔNG BYTE ĐỎ — " + file + " không ghép ra đúng stock");
    const text = assembled + EOL;
    writeFileSync(join(outDir, file), text, "utf8");
    reports.push(file + " " + String(Buffer.byteLength(text)) + " B · sha256 " + createHash("sha256").update(text).digest("hex"));
  }
  const chunkSrc = join(STOCK, "lib", CHUNK);
  copyFileSync(chunkSrc, join(outDir, CHUNK));
  if (!readFileSync(chunkSrc).equals(readFileSync(join(outDir, CHUNK)))) throw new Error("CỔNG BYTE ĐỎ — chunk lệch byte: " + CHUNK);
  reports.push(CHUNK + " " + String(readFileSync(chunkSrc).byteLength) + " B · copy nguyên văn");
  return "CỔNG BYTE ĐẠT · gbh-headless · " + reports.join(" | ");
}

if (import.meta.main) console.log(buildPackage(process.argv[2]));
