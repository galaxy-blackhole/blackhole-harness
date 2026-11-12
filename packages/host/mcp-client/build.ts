/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build gói @galaxy-blackhole/gbh-mcp-client: ghép 1 lát nguyên văn thành lib/index.js với CỔNG BYTE delta 0.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");
/** Nguồn stock CHỈ ĐỌC. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-mcp-client");
/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

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
 * Ghép mọi lát trong src/parts thành văn bản stock (không newline cuối).
 * Nhận: không. Trả: văn bản đã ghép.
 */
export function assembleHostParts(): string {
  const dir = join(import.meta.dir, "src", "parts");
  return readdirSync(dir).filter((f) => f.endsWith(".ts")).sort().map((f) => sliceBody(readFileSync(join(dir, f), "utf8")).join(EOL)).join(EOL);
}

/**
 * Build gói: cổng byte so với stock rồi ghi lib/index.js.
 * Nhận: outDir — thư mục đích (mặc định lib/). Trả: báo cáo dạng chuỗi.
 */
export function buildPackage(outDir: string = join(import.meta.dir, "lib")): string {
  const stockText = readFileSync(join(STOCK, "lib", "index.js"), "utf8");
  const expected = stockText
    // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator.
    .split("@deepseek-ai/dsh-typert-generator")
    .join("@galaxy-blackhole/gbh-typert-generator")
    // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator.
    .split("@galaxy-blackhole/gbh-typert-generator")
    .join("@galaxy-blackhole/gbh-typert-generator").endsWith(EOL) ? stockText.slice(0, -1) : stockText;
  const assembled = assembleHostParts();
  if (assembled !== expected) throw new Error("CỔNG BYTE ĐỎ — lát host không ghép ra đúng stock lib/index.js");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.js"), assembled + EOL, "utf8");
  return "CỔNG BYTE ĐẠT · gbh-mcp-client · sha256 " + createHash("sha256").update(readFileSync(join(outDir, "index.js"))).digest("hex");
}

if (import.meta.main) console.log(buildPackage(process.argv[2]));
