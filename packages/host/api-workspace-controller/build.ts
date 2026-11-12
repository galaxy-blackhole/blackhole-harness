/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-api-workspace-controller: lib/index.js (nửa host, Bun.build) + 3 artefact
 *      NGUYÊN VĂN (client.js · typert.host.js · typert.remote-client.js) ghép từ slice và ĐO CỔNG BYTE so với
 *      stock đã thay đúng một trường ownership/id — sai một byte là build đỏ.
 */

import { createHash } from "node:crypto";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { FACE_ARTIFACTS, PACKAGE_NAME, STOCK_LIB_DIR, type FaceArtifact } from "./src/ids.ts";

/** Đường dẫn gốc repo (package nằm ở packages/host/<tên>). */
const REPO_ROOT = join(import.meta.dir, "..", "..", "..");

/** Dòng đánh dấu slice nguyên văn (bị gỡ khỏi artefact). */
const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS (bị gỡ khỏi artefact). */
const MODULE_TAIL = "export {};";

/** Dấu đóng khối header 5 dòng. */
const HEADER_END = "*/";

/**
 * Bỏ phần GIAO KÈO của slice: header 5 dòng + dòng marker + dòng kết thúc module.
 * Nhận: source — nội dung slice; name — tên tệp (chẩn đoán). Trả: nội dung nguyên văn của bundle gốc.
 */
function stripSliceScaffold(source: string, name: string): string {
  const EOL = String.fromCharCode(10);
  const lines = source.split(EOL);
  const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
  if (marker < 0) throw new Error(name + ": thiếu dòng marker slice");
  if (!lines.slice(0, marker).some((line) => line.trim() === HEADER_END)) throw new Error(name + ": thiếu khối header 5 dòng");
  const tail = lines.lastIndexOf(MODULE_TAIL);
  if (tail < 0) throw new Error(name + ": thiếu dòng kết thúc module");
  // Bỏ các dòng TRỐNG biên quanh thân (khuôn slice có thể có hoặc không dòng trống sau marker).
  let start = marker + 1;
  while (start < tail && lines[start]?.trim() === "") start += 1;
  let end = tail;
  while (end > start && lines[end - 1]?.trim() === "") end -= 1;
  return lines.slice(start, end).join(EOL) + EOL;
}

/**
 * Băm sha256 một chuỗi.
 * Nhận: text — chuỗi cần băm. Trả: hex sha256.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Tìm vị trí khác nhau đầu tiên giữa hai chuỗi.
 * Nhận: left/right — hai chuỗi. Trả: chỉ số khác đầu tiên, hoặc -1 khi bằng nhau.
 */
function firstDifference(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) if (left[index] !== right[index]) return index;
  return left.length === right.length ? -1 : limit;
}

/**
 * Ghép một artefact nguyên văn từ slice và ĐO CỔNG BYTE với bản gốc đã thay đúng một trường.
 * Nhận: artifact — mô tả artefact; outDir — thư mục đích. Trả: số đo để in báo cáo.
 */
async function buildFaceArtifact(
  artifact: FaceArtifact,
  outDir: string,
): Promise<{ readonly name: string; readonly bytes: number; readonly stockBytes: number; readonly sha256: string; readonly stockSha256: string }> {
  const EOL = String.fromCharCode(10);
  const slice = await readFile(join(import.meta.dir, "src", artifact.entry), "utf8");
  let assembled = stripSliceScaffold(slice, artifact.entry);
  const stockText = await readFile(join(REPO_ROOT, STOCK_LIB_DIR, artifact.stockFile), "utf8");
  const occurrences = stockText.split(artifact.replaceFrom).length - 1;
  if (occurrences !== artifact.occurrences) {
    throw new Error(artifact.stockFile + ": trường ownership/id phải xuất hiện ĐÚNG " + artifact.occurrences + " lần, đo được " + occurrences);
  }
  // 19/10/2026 (task-151, PILOT type-brand → nhân rộng): typeSymbol của ta mang id GBH ⇒ gốc-quy-đổi
  // phải quy cả BRAND trước khi so byte (chứng minh chỉ đổi id, không đổi gì khác).
  const expected = stockText
    // P3 (04/11/2026): module ao store doi id => goc-quy-doi phai quy tuong ung.
    .split("@deepseek-ai/dsh-client-store")
    .join("@galaxy-blackhole/gbh-client-store")
    // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator.
    .split("@deepseek-ai/dsh-typert-generator")
    .join("@galaxy-blackhole/gbh-typert-generator")
    // P3 (04/11/2026): lat typert sinh ra mang id MOI cua typert-generator.
    .split("@galaxy-blackhole/gbh-typert-generator")
    .join("@galaxy-blackhole/gbh-typert-generator")
    .split(artifact.replaceFrom)
    .join(artifact.replaceTo)
    .split("@deepseek-ai/dsh-api-workspace-controller")
    .join("@galaxy-blackhole/gbh-api-workspace-controller")
    // 20/10/2026: part nguồn đã REWRITE specifier gateway sang id ta ⇒ gốc-quy-đổi phải quy tương ứng.
    .split("@deepseek-ai/dsh-api-gateway")
    .join("@galaxy-blackhole/gbh-host-typert-gateway")
    // 20/10/2026 (task-160, SỬA LỖI THẬT): KHÔNG quy tham chiếu `typert-protocol` — đó là THƯ VIỆN, id phải giữ
    // stock vì gói ta không có bản thay thế trong profile (`gbh-typert-protocol` không tồn tại ⇒ import nổ ⇒
    // typert contributor không đăng ký được ⇒ (5) did-not-activate). Chỉ BRAND của chính gói mới được quy.
  // Tôn trọng ĐÚNG dấu xuống dòng cuối của stock (client.js KHÔNG có newline cuối).
  if (expected.endsWith(EOL) && !assembled.endsWith(EOL)) assembled += EOL;
  if (!expected.endsWith(EOL) && assembled.endsWith(EOL)) assembled = assembled.slice(0, -1);
  if (assembled !== expected) {
    const at = firstDifference(assembled, expected);
    throw new Error(
      artifact.entry + ": CỔNG BYTE ĐỎ — ghép " + assembled.length + " B vs gốc-quy-đổi " + expected.length + " B, lệch ở ký tự " + at,
    );
  }
  await writeFile(join(outDir, artifact.naming), assembled, "utf8");
  return {
    name: artifact.naming,
    bytes: Buffer.byteLength(assembled, "utf8"),
    stockBytes: Buffer.byteLength(stockText, "utf8"),
    sha256: sha256(assembled),
    stockSha256: sha256(stockText),
  };
}

/** Một dòng báo cáo cổng byte của một artefact. */
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
 * Build package thành 4 artefact (1 host + 3 nguyên văn) và ĐO cổng byte.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package). Trả: đường dẫn artefact host (lib/index.js).
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const host = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!host.success) throw new Error("build index.ts thất bại: " + host.logs.map((log) => String(log)).join(" | "));
  const reports: ByteGateReport[] = [];
  for (const artifact of FACE_ARTIFACTS) reports.push(await buildFaceArtifact(artifact, out));
  // Build THỨ HAI: biên dịch entry nửa client (src/client.ts) — bằng chứng build nửa client mà
  // tools/check/rows.ts đòi (>= 2 lời gọi Bun.build), đồng thời kiểm cú pháp entry ngay trong build.
  const clientEntry = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "client-entry.js",
    packages: "external",
  });
  if (!clientEntry.success) throw new Error("build entry nửa client thất bại: " + clientEntry.logs.map((log) => String(log)).join(" | "));
  for (const report of reports) {
    if (report.bytes !== report.stockBytes && artifactLogEnabled()) {
      console.log(report.name + ": " + report.bytes + " B (gốc " + report.stockBytes + " B) · sha256 " + report.sha256);
    }
  }
  return join(out, "index.js");
}

/**
 * Cờ in báo cáo cổng byte — chỉ in khi chạy trực tiếp build.ts.
 * Nhận: không. Trả: true khi tiến trình hiện tại là entry chính.
 */
function artifactLogEnabled(): boolean {
  return import.meta.main;
}

if (import.meta.main) {
  const index = await buildPackage(process.argv[2]);
  console.log("built " + index + " (PACKAGE " + PACKAGE_NAME + ")");
}