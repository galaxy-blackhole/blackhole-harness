/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build gói subagent: lib/index.js + internal.js + client.js (Bun.build từ src typed) và 2 artefact typert
 *      NGUYÊN VĂN ghép từ slice — CỔNG BYTE so với stock rồi CỔNG OWNERSHIP (id của ta, 0 id stock).
 */
import { createHash } from "node:crypto";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { FACE_ARTIFACTS, OWNERSHIP_SWAP, PACKAGE_NAME, STOCK_LIB_DIR } from "./src/ids.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");
/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);
/** Báo cáo cổng byte của một artefact. */
export interface ByteGateReport {
  /** Tên file artefact. */
  readonly name: string;
  /** Số byte bản của ta. */
  readonly bytes: number;
  /** Số byte bản gốc. */
  readonly stockBytes: number;
  /** sha256 bản của ta. */
  readonly sha256: string;
  /** sha256 bản gốc. */
  readonly stockSha256: string;
}

/**
 * Băm sha256 một chuỗi.
 * Nhận: text — chuỗi cần băm. Trả: hex sha256.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Bỏ scaffold của một slice (header 5 dòng + marker + dòng trống biên).
 * Nhận: source — nội dung tệp; name — tên tệp. Trả: các dòng nguyên văn.
 */
function stripSlice(source: string, name: string): string[] {
  const lines = source.split(EOL);
  const marker = lines.findIndex((line) => line.startsWith("// @ts-nocheck"));
  if (marker < 0) throw new Error(name + ": thiếu marker slice");
  const tail = lines.lastIndexOf("export {};");
  if (tail < 0) throw new Error(name + ": thiếu dòng kết thúc");
  const body = lines.slice(marker + 1, tail);
  let start = 0;
  while (start < body.length && (body[start] ?? "").trim() === "") start += 1;
  let end = body.length;
  while (end > start && (body[end - 1] ?? "").trim() === "") end -= 1;
  return body.slice(start, end);
}

/**
 * Ghép + kiểm một artefact typert: cổng byte với stock.replaceAll(ownership) và cổng ownership.
 * Nhận: artifact — mô tả artefact; out — thư mục đích. Trả: báo cáo cổng byte.
 */
function buildFace(artifact: (typeof FACE_ARTIFACTS)[number], out: string): ByteGateReport {
  const assembledLines: string[] = [];
  for (const part of artifact.parts) assembledLines.push(...stripSlice(readFileSync(join(import.meta.dir, "src", part), "utf8"), part));
  const assembled = assembledLines.join(EOL).split(OWNERSHIP_SWAP[0]).join(OWNERSHIP_SWAP[1]) + EOL;
  const stockText = readFileSync(join(REPO, STOCK_LIB_DIR, artifact.stockFile), "utf8");
  const expected = stockText
    // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator.
    .split("@deepseek-ai/dsh-typert-generator")
    .join("@galaxy-blackhole/gbh-typert-generator")
    // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator.
    .split("@galaxy-blackhole/gbh-typert-generator")
    .join("@galaxy-blackhole/gbh-typert-generator").split(OWNERSHIP_SWAP[0]).join(OWNERSHIP_SWAP[1]);
  if (assembled !== expected) {
    throw new Error(artifact.stockFile + ": CỔNG BYTE ĐỎ — ghép " + String(assembled.length) + " B vs gốc-quy-đổi " + String(expected.length) + " B");
  }
  const ourCount = assembled.split(OWNERSHIP_SWAP[1]).length - 1;
  const stockCount = assembled.split(OWNERSHIP_SWAP[0]).length - 1;
  if (ourCount !== artifact.occurrences) throw new Error(artifact.stockFile + ": CỔNG OWNERSHIP ĐỎ — " + String(ourCount) + " trường ownership của ta, cần " + String(artifact.occurrences));
  if (stockCount !== 0) throw new Error(artifact.stockFile + ": CỔNG OWNERSHIP ĐỎ — còn " + String(stockCount) + " trường ownership của stock");
  writeFileSync(join(out, artifact.naming), assembled, "utf8");
  return { name: artifact.naming, bytes: Buffer.byteLength(assembled, "utf8"), stockBytes: Buffer.byteLength(stockText, "utf8"), sha256: sha256(assembled), stockSha256: sha256(stockText) };
}

/**
 * Build gói: Bun.build 3 entry typed + 2 artefact typert có cổng byte/ownership.
 * Nhận: outDir — thư mục đích (mặc định lib). Trả: đường dẫn index.js.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  // 20/10/2026 (task-186): gói đã de-bundle nửa host ⇒ CHÉP nguyên cây lib/ (1:1 bản gốc), KHÔNG build lại.
  {
    const out0 = outDir ?? join(import.meta.dir, "lib");
    const daDebundle = copyIfDebundled(import.meta.dir, out0);
    if (daDebundle !== null) return (daDebundle.length > 0 ? daDebundle[0]! : join(out0, "index.js")) as never;
  }
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  const entries: readonly (readonly [string, string])[] = [
    ["index.ts", "index.js"],
    ["internal.ts", "internal.js"],
    ["client.ts", "client.js"],
  ];
  for (const [entry, naming] of entries) {
    const result = await Bun.build({ entrypoints: [join(import.meta.dir, "src", entry)], outdir: out, target: "node", format: "esm", naming, packages: "external" });
    if (!result.success) throw new Error("build " + entry + " thất bại: " + result.logs.map((log) => String(log)).join(" | "));
  }
  const reports = FACE_ARTIFACTS.map((artifact) => buildFace(artifact, out));
  if (import.meta.main) {
    for (const report of reports) console.log(report.name + ": " + report.bytes + " B (gốc " + report.stockBytes + " B) · sha256 " + report.sha256);
    console.log("PACKAGE " + PACKAGE_NAME);
  }
  return join(out, "index.js");
}

if (import.meta.main) await buildPackage(process.argv[2]);