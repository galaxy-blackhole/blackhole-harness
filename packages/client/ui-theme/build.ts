/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Build hai nua cua package ui-theme: lib/index.js (node ESM) va lib/client.js (script classic MOT id).
 *      08/11/2026 — chép nhóm asset font/style (brand-font.css + 3 Montserrat woff2 + OFL) từ assets/styles vào
 *      lib/styles SAU khi sinh bundle, để subpath "\"./brand-font.css\" trong package.json có tệp thật (review-4).
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { injectViDictionary } from "../../../tools/inject-vi-dictionary.ts";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_NAME } from "./src/ids.ts";

/**
 * Id module DUY NHẤT mà bundle TỰ KHAI, viết dạng LITERAL để bun run check:rows đọc được
 * (khuôn CJS-bọc-IIFE sinh id qua JSON.stringify nên regex của cổng không thấy nếu không có literal).
 */
const DECLARED_IDS = [{ id: "@galaxy-blackhole/gbh-client-ui-theme" }] as const;

/** Năm dòng header bắt buộc của repo, chèn vào file sinh ra. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc File SINH TỰ ĐỘNG bởi build.ts của @galaxy-blackhole/gbh-client-ui-theme — không sửa tay",
  " */",
].join("\n");

/** Hai file mà build này sinh ra. */
export interface BuiltHalves {
  /** Đường dẫn nửa host (entry Loader nạp). */
  node: string;
  /** Đường dẫn nửa client (harness phục vụ qua export ./client). */
  client: string;
}

/**
 * Gom log của một lần build hỏng thành một dòng.
 * @param result - kết quả build của Bun.
 * @returns chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Chuẩn hoá các dòng chú thích đường dẫn nguồn do Bun chèn thành "// x.ts" — hash bản build không phụ thuộc cwd.
 * @param code - mã đã bundle.
 * @returns mã đã chuẩn hoá.
 */
function normalizeSourceComments(code: string): string {
  return code.replace(/^(\s*)\/\/ .*[\\/]([^\\/]+\.ts)$/gmu, "$1// $2");
}

/**
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * @param code - khối mã.
 * @param levels - số cấp thụt lề.
 * @returns khối mã đã thụt lề.
 */
function indent(code: string, levels: number): string {
  const pad = "  ".repeat(levels);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}

/**
 * Build nửa host thành ESM cho node (peer external để chỉ có một instance trong tiến trình).
 * @param out - thư mục đích.
 * @returns đường dẫn file đã build.
 */
async function buildHostHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!result.success) throw new Error("gbh-client-ui-theme: build nửa host thất bại: " + logsOf(result));
  const file = join(out, "index.js");
  writeFileSync(file, GENERATED_HEADER + "\n" + normalizeSourceComments(readFileSync(file, "utf8")));
  return file;
}

/** Id của bundle gốc (stock) — dùng cho cổng byte. */
const STOCK_ID = "@deepseek-ai/dsh-client-ui-theme";

/** Đường dẫn bundle gốc để so byte (chỉ đọc). */
const STOCK_BUNDLE = join(import.meta.dir, "..", "..", "..", "apps", "host", "node_modules", "@deepseek-ai", "dsh-client-ui-theme", "lib", "client.js");

/** Dòng đánh dấu lát nguyên văn. */
const SLICE_MARKER = "// @ts-nocheck";

/** Neo CHÈN khối VIẾT TAY: ngay sau lời đăng ký từ điển zh/en của bản gốc (vị trí theo manifest). */
const HANDWRITTEN_ANCHOR = '}), "ui-theme: settings row dictionaries");';

/** Neo dùng để KIỂM: khối viết tay phải nằm NGAY SAU dòng neo và xuất hiện ĐÚNG MỘT lần. */
const HANDWRITTEN_MARK = 'ui-theme: settings row dictionaries (vi)';

/**
 * Ghép các lát NGUYÊN VĂN trong src/parts thành đúng văn bản bundle gốc (bỏ phần giao ke của file .ts).
 * @param partsDir - thư mục chứa lát.
 * @returns văn bản đã ghép.
 */
function assembleParts(partsDir: string): string {
  const NL = String.fromCharCode(10);
  const files = readdirSync(partsDir).filter((name) => name.endsWith(".ts")).sort();
  const flat: string[] = [];
  for (const name of files) {
    const lines = readFileSync(join(partsDir, name), "utf8").split(NL);
    const marker = lines.findIndex((line) => line.startsWith(SLICE_MARKER));
    if (marker < 0) throw new Error(name + ": khong thay dong danh dau lat nguyen van");
    const end = lines.findIndex((line, i) => i > marker && line.trim() === "export {};");
    if (end < 0) throw new Error(name + ": thieu dong ket thuc lat");
    const body = lines.slice(marker + 1, end);
    if (body.length > 0 && body[body.length - 1] === "") body.pop();
    flat.push(...body);
  }
  return flat.join(NL);
}

/**
 * Vị trí ký tự lệch đầu tiên giữa hai chuỗi.
 * @param a - chuỗi thứ nhất.
 * @param b - chuỗi thứ hai.
 * @returns chỉ số lệch đầu tiên.
 */
function firstDifference(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) if (a[i] !== b[i]) return i;
  return limit;
}

/**
 * Build nửa browser: ghép LÁT NGUYÊN VĂN của bundle gốc, đổi ĐÚNG MỘT id, so BYTE với bản gốc.
 * @param out - thư mục đích.
 * @returns đường dẫn file đã build.
 * @throws khi cổng byte lệch (kèm ngữ cảnh hai phía).
 */
async function buildClientHalf(out: string): Promise<string> {
  const assembled = assembleParts(join(import.meta.dir, "src", "parts"));
  // 20/10/2026 (CANON — theo phát hiện của tm-evidence): quy id **CHỈ Ở DÒNG LOADER**. Các lần xuất hiện khác của
  // id stock trong bundle gốc là DỮ LIỆU (khoá slot/owner id/nhãn) — bản gốc giữ id stock ở đó, nên artefact của ta
  // cũng phải giữ, nếu không sẽ lệch khỏi bản build lại từ `src` và sai parity 1:1.
  const loaderLine = 'id: ' + JSON.stringify(STOCK_ID) + ',';
  const loaderLineOurs = 'id: ' + JSON.stringify(PACKAGE_NAME) + ',';
  const stockRaw = readFileSync(STOCK_BUNDLE, "utf8");
  if (!assembled.includes(loaderLine)) throw new Error("gbh-client-ui-theme: lat ghep khong co dong loader id stock");
  const quyId = (text: string): string => text.replace(loaderLine, loaderLineOurs);
  const ours = quyId(assembled);
  const expected = quyId(stockRaw);
  if (ours !== expected) {
    const at = firstDifference(ours, expected);
    const ctx = (text: string): string => text.slice(Math.max(0, at - 40), at + 40);
    throw new Error(
      "gbh-client-ui-theme: CONG BYTE DO — ghep " + String(ours.length) + " B vs goc-quy-doi " + String(expected.length) + " B, lech o " + String(at) + String.fromCharCode(10) +
        "  ta : " + ctx(ours) + String.fromCharCode(10) +
        "  goc: " + ctx(expected),
    );
  }
  // 08/11/2026 (task-231 + review-4 — Lead duyệt): khối VIẾT TAY cũ đăng ký thêm MỘT lượt `vi` đã bị gỡ; giờ chỉ
  // còn DẤU NEO, và từ điển `vi` được CHÈN vào artefact bằng tools/inject-vi-dictionary.ts (gộp vào lượt đăng ký
  // DUY NHẤT `{ zh, en, vi }`) — trước đây chính khối này làm `settings.theme` bị đăng ký 2 lần và `vi` rơi khỏi lượt đầu.
  const block = String.fromCharCode(10) + '			// ' + HANDWRITTEN_MARK + String.fromCharCode(10);
  const hits = ours.split(HANDWRITTEN_ANCHOR).length - 1;
  if (hits !== 1) throw new Error("gbh-client-ui-theme: neo khoi viet tay xuat hien " + String(hits) + " lan (phai dung 1)");
  const withHandwritten = ours.replace(HANDWRITTEN_ANCHOR, HANDWRITTEN_ANCHOR + block);
  if (withHandwritten.split(HANDWRITTEN_MARK).length - 1 !== 1) throw new Error("gbh-client-ui-theme: khoi viet tay khong nam dung vi tri neo");
  // (b) gỡ khối ⇒ phải TRÙNG TỪNG BYTE bản gốc đã quy id.
  if (withHandwritten.split(block).join("") !== expected) throw new Error("gbh-client-ui-theme: go khoi viet tay KHONG trung ban goc ⇒ vung nguyen van da bi sua");
  const file = join(out, "client.js");
  writeFileSync(file, withHandwritten);
  // task-231: chèn từ điển vi (nguồn override locale/vi-chrome.json) — chạy SAU cổng byte nên không ảnh hưởng parity.
  injectViDictionary(file, join(import.meta.dir, "locale", "vi-chrome.json"));
  return file;
}

/**
 * Bọc bundle CJS thành script classic đăng ký MỘT id module.
 * @param code - mã CJS đã bundle (dùng module/exports như biến tự do).
 * @returns văn bản script classic hoàn chỉnh.
 */
function wrapClientBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "var __gbhModule = (function () {",
    '  "use strict";',
    "  var module = { exports: {} };",
    "  var exports = module.exports;",
    indent(code, 2),
    "  return module.exports;",
    "})();",
    // 09/11/2026 (Lead yeu cau): khuon DE-BUNDLE — dong loader tach 3 dong, id o dong rieng thut TAB.
    "window.__ModuleLoader__.load({",
    "\tid: " + JSON.stringify(PACKAGE_NAME) + ",",
    "\tfactory: function (require) { return __gbhModule.createPlugin(require); },",
    "});",
    "",
  ].join("\n");
}

/**
 * Chép nhóm asset font/style vào thư mục đích để subpath `"./brand-font.css"` của package.json có tệp thật.
 * Nguồn là `assets/styles/` (BYTE-IDENTICAL so stock `dsh-client-ui-theme/lib/styles/`, gồm cả `Montserrat-OFL.txt`
 * mà giấy phép OFL bắt buộc đi kèm font) — để NGOÀI `lib/` nên `rmSync` đầu mỗi lượt build không xoá mất.
 * Nhận: outDir — thư mục đích (`lib/`) đã sinh xong hai nửa.
 * Trả: số tệp đã chép vào `outDir/styles`.
 */
function copyStyleAssets(outDir: string): number {
  const source = join(import.meta.dir, "assets", "styles");
  const target = join(outDir, "styles");
  cpSync(source, target, { recursive: true });
  return readdirSync(target).length;
}

/**
 * Build cả hai nửa vào một thư mục đích.
 * @param outDir - thư mục đích (mặc định: lib cạnh package.json).
 * @returns { node, client } — đường dẫn hai file đã build.
 */
export async function buildPackage(outDir?: string): Promise<BuiltHalves> {
  if (DECLARED_IDS[0].id !== PACKAGE_NAME) {
    throw new Error("gbh-client-ui-theme: id trong build.ts LỆCH với src/ids.ts — sửa cho khớp rồi build lại");
  }
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const node = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-* (cổng đảo ngược bắt buộc).
  await renameClientArtifact(client);
  copyStyleAssets(out);
  return { node, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.node);
  console.log("built " + built.client);
}
