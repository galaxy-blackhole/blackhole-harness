/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build hai nua: lib/index.js (node ESM) va lib/client.js (script classic dang ky MOT id module)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PACKAGE_NAME } from "./src/ids.ts";

/**
 * Id module DUY NHẤT mà bundle TỰ KHAI, viết dạng LITERAL có khoá "id" để "bun run check:rows" đọc được
 * (khuôn CJS-bọc-IIFE sinh id qua JSON.stringify nên regex của cổng không thấy nếu không literal ở đây).
 * Id gốc KHÔNG tự đăng ký: TẦNG NẠP phát entry alias từ gbh.row.aliases, trỏ cùng URL bundle này.
 */
const DECLARED_IDS = [{ id: "@galaxy-blackhole/gbh-client-ui-shortcuts" }] as const;

/** Năm dòng header bắt buộc của repo, chèn vào file sinh ra để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc File SINH TỰ ĐỘNG bởi build.ts của @galaxy-blackhole/gbh-client-ui-shortcuts — không sửa tay",
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
 * Thụt lề mọi dòng không rỗng của một khối mã.
 * Nhận: khối mã và số cấp thụt lề.
 * Trả: khối mã đã thụt lề.
 */
function indent(code: string, levels: number): string {
  const pad = "  ".repeat(levels);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}

/**
 * Chuẩn hoá các dòng chú thích đường dẫn nguồn do Bun chèn ("// src/x.ts" hoặc "// packages/…/src/x.ts")
 * thành "// x.ts" — nhờ vậy HASH của bản build KHÔNG phụ thuộc thư mục chạy build (chỉ số "bản mount cũ"
 * so hash repo ↔ bản đang mount sẽ không báo nhầm).
 * Nhận: mã nguồn đã bundle.
 * Trả: mã đã chuẩn hoá chú thích.
 */
function normalizeSourceComments(code: string): string {
  return code.replace(/^(\s*)\/\/ .*[\\/]([^\\/]+\.ts)$/gmu, "$1// $2");
}

/**
 * Gom log của một lần build hỏng thành một dòng.
 * Nhận: kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build nửa host thành ESM cho node.
 * Nhận: thư mục đích.
 * Trả: đường dẫn file đã build.
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
  if (!result.success) throw new Error("gbh-client-ui-shortcuts: build nửa host thất bại: " + logsOf(result));
  const hostFile = join(out, "index.js");
  writeFileSync(hostFile, normalizeSourceComments(readFileSync(hostFile, "utf8")));
  return hostFile;
}

/**
 * Build nửa browser thành script classic đăng ký MỘT id module (id của ta).
 * Hợp đồng C2: script chỉ ĐĂNG KÝ factory; thân module nằm trong closure của factory và chỉ chạy ở lần
 * vát chất hoá đầu tiên. Loader nạp bundle bằng thẻ script classic (không phải ESM) nên phần này được
 * build ở dạng CJS rồi bọc trong lời gọi đăng ký.
 * Nhận: thư mục đích.
 * Trả: đường dẫn file đã build.
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("gbh-client-ui-shortcuts: build nửa client thất bại: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-shortcuts: nửa client không sinh output nào");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(normalizeSourceComments(await bundle.text())));
  return target;
}

/**
 * Bọc bundle CJS thành script classic đăng ký MỘT id module.
 * Nhận: mã CJS đã bundle (dùng module/exports như biến tự do).
 * Trả: văn bản script classic hoàn chỉnh.
 */
function wrapClientBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "(function () {",
    '  "use strict";',
    "  var factory = function (require) {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    indent(code, 2),
    "    return module.exports.createPlugin(require);",
    "  };",
    "  // id CHÍNH = package của ta (khớp manifest và rev của HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "})();",
    "",
  ].join("\n");
}

/**
 * Build cả hai nửa của package vào một thư mục đích.
 * Nhận: thư mục đích (mặc định: lib cạnh package.json).
 * Trả: { node, client } — đường dẫn hai file đã build.
 */
export async function buildPackage(outDir?: string): Promise<BuiltHalves> {
  if (DECLARED_IDS[0].id !== PACKAGE_NAME) {
    throw new Error("gbh-client-ui-shortcuts: id trong build.ts LỆCH với src/ids.ts — sửa cho khớp rồi build lại");
  }
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const node = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  // task-157 nhánh B (pilot): BRAND RENAME tại chỗ artefact client vừa build — token `--dsh-*` → `--gbh-*`
  // + `__GBH_*` → `__GBH_*`; cổng đảo ngược byte-identical bắt buộc (giữ 4 tên vỏ dist đang đọc).
  await renameClientArtifact(client);
  return { node, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.node);
  console.log("built " + built.client);
}