/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build hai nửa: lib/index.js (node ESM) và lib/client.js (script classic đăng ký HAI id module)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";

import { PACKAGE_NAME } from "./src/ids.ts";

/**
 * Hai id module mà bundle tự khai, viết dạng LITERAL có khoá \"id\" để \"bun run check:rows\" đọc được
 * và đối chiếu với tên package của row (đúng loại lỗi đã làm app chết ngày 17/10/2026).
 * buildPackage kiểm hai literal này khớp src/ids.ts — lệch là ném lỗi, không cho build ra bản sai.
 */
/**
 * Id module DUY NHẤT mà bundle TỰ KHAI (viết literal để bun run check:rows đọc được).
 * Id gốc KHÔNG tự đăng ký: TẦNG NẠP phát entry alias từ gbh.row.aliases, trỏ cùng URL bundle này.
 */
const DECLARED_IDS = [{ id: "@galaxy-blackhole/gbh-client-ui-settings-general" }] as const;

/** Năm dòng header bắt buộc của repo, chèn vào file sinh ra để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TỰ ĐỘNG bởi build.ts của @galaxy-blackhole/gbh-client-ui-settings-general — không sửa tay",
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
 * thành "// x.ts". Nhờ vậy HASH của bản build KHÔNG phụ thuộc thư mục chạy build — nếu không, chỉ số
 * "bản mount cũ" (so hash repo ↔ bản đang mount) sẽ báo nhầm dù mã giống hệt.
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
  if (!result.success) throw new Error("gbh-client-ui-settings-general: build nửa host thất bại: " + logsOf(result));
  const hostFile = join(out, "index.js");
  writeFileSync(hostFile, normalizeSourceComments(readFileSync(hostFile, "utf8")));
  return hostFile;
}

/**
 * Build nửa browser thành script classic đăng ký HAI id module.
 *
 * Hợp đồng C2: script chỉ ĐĂNG KÝ factory; thân module nằm trong closure của factory và chỉ chạy ở lần
 * vạt chất hoá đầu tiên. Loader nạp bundle bằng thẻ script classic (không phải ESM) nên phần này được
 * build ở dạng CJS rồi bọc trong lời gọi đăng ký; id CỦA TA là id chính (khớp manifest + rev của HMR),
 * id package GỐC là đăng ký phụ. Hai lời gọi dùng CHUNG một factory nên chỉ có một bản thân module.
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
  if (!result.success) throw new Error("gbh-client-ui-settings-general: build nửa client thất bại: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-ui-settings-general: nửa client không sinh output nào");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(normalizeSourceComments(await bundle.text())));
  return target;
}

/**
 * Bọc bundle CJS thành script classic đăng ký hai id module bằng cùng một factory.
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
  // 20/10/2026: nếu gói đã de-bundle (src/parts) thì CHÉP artefact, không build lại (xem tools/debundle-guard.ts).
  const daDebundle = copyIfDebundled(import.meta.dir, outDir ?? join(import.meta.dir, "lib"));
  if (daDebundle !== null) return daDebundle as never;
  if (DECLARED_IDS[0].id !== PACKAGE_NAME) {
    throw new Error("gbh-client-ui-settings-general: id trong build.ts LỆCH với src/ids.ts — sửa cho khớp rồi build lại");
  }
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const node = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-*.
  await renameClientArtifact(client);
  return { node, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.node);
  console.log("built " + built.client);
}
