/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build hai đầu ra: lib/index.js (node ESM) và lib/client.js (script classic đăng ký HAI id)
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {PACKAGE_NAME} from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, chèn vào file sinh ra. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TỰ ĐỘNG bởi build.ts của @galaxy-blackhole/gbh-client-ui-session — không sửa tay",
  " */",
].join("\n");

/**
 * Id module DUY NHẤT mà bundle TỰ KHAI (viết literal để bun run check:rows đọc được).
 * Id gốc KHÔNG tự đăng ký: TẦNG NẠP phát entry alias từ gbh.row.aliases, trỏ cùng URL bundle này.
 */
const DECLARED_IDS = [{ id: "@galaxy-blackhole/gbh-client-ui-session" }] as const;

/** Hai file mà build này sinh ra. */
export interface BuiltHalves {
  /** Nửa host (entry Loader nạp). */
  node: string;
  /** Nửa client (harness phục vụ qua export ./client). */
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
 * Chuẩn hoá chú thích đường dẫn nguồn do Bun chèn để hash bản build không phụ thuộc thư mục chạy build.
 * Nhận: mã đã bundle.
 * Trả: mã đã chuẩn hoá.
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
  if (!result.success) throw new Error("gbh-client-ui-session: build nửa host thất bại: " + logsOf(result));
  const file = join(out, "index.js");
  writeFileSync(file, normalizeSourceComments(readFileSync(file, "utf8")));
  return file;
}

/**
 * Đóng gói nửa client thành CJS (không ghi ra đĩa).
 * Nhận: đường dẫn entry.
 * Trả: mã CJS đã bundle.
 */
async function bundleClientCjs(entry: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [entry],
    target: "browser",
    format: "cjs",
    write: false,
    packages: "external",
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("gbh-client-ui-session: build nửa client thất bại: " + logsOf(result));
  const output = result.outputs[0];
  if (output === undefined) throw new Error("gbh-client-ui-session: nửa client không sinh output nào");
  return normalizeSourceComments(await output.text());
}

/**
 * Bọc bundle CJS thành script classic đăng ký HAI id bằng cùng một factory.
 * Nhận: mã CJS.
 * Trả: văn bản script classic.
 */
function wrapClientBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "(function () {",
    '  "use strict";',
    "  var factory = function (require) {",
    "    var module = { exports: {} };",
    "    var exports = module.exports;",
    indent(code, 4),
    "    return module.exports.createPlugin(require);",
    "  };",
    "  // id CHÍNH = package của ta (khớp manifest và rev của HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "})();",
    "",
  ].join("\n");
}

/**
 * Build cả hai đầu ra của package vào một thư mục đích.
 * Nhận: thư mục đích (mặc định: lib cạnh package.json).
 * Trả: { node, client } — đường dẫn hai file đã build.
 */
export async function buildPackage(outDir?: string): Promise<BuiltHalves> {
  if (DECLARED_IDS[0].id !== PACKAGE_NAME) {
    throw new Error("gbh-client-ui-session: id trong build.ts LỆCH với src/ids.ts — sửa cho khớp rồi build lại");
  }
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const node = await buildHostHalf(out);
  const client = join(out, "client.js");
  writeFileSync(client, wrapClientBundle(await bundleClientCjs(join(import.meta.dir, "src", "client.ts"))));
  return { node, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.node);
  console.log("built " + built.client);
}
