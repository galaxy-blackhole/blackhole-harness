/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build HAI nửa của row connection: lib/index.js (ESM cho Host) và lib/client.js (script classic đăng ký
 *      hai id module cho Loader của trình duyệt). KHÔNG khai gbh.row trước khi file client.js tồn tại.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";

import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "./src/ids.ts";

/** Năm dòng header bắt buộc, chèn vào file sinh ra để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-connection — khong sua tay",
  " */",
].join("\n");

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
 * Gom log của một lần build hỏng thành một dòng.
 * @param result - kết quả build của Bun.
 * @returns chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build nửa Host thành một file ESM duy nhất.
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
  if (!result.success) throw new Error("gbh-client-connection: build nua host that bai: " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Bọc bundle CJS thành script classic đăng ký HAI id module bằng cùng một factory.
 *
 * Hợp đồng C2: script chỉ ĐĂNG KÝ factory; thân module nằm trong closure và chạy ở lần vạt chất hoá đầu
 * tiên. Loader nạp bundle bằng thẻ script classic (không phải ESM) nên bundle được build ở dạng CJS rồi
 * bọc trong lời gọi đăng ký; id CỦA TA là id chính (khớp manifest và rev của HMR), id gốc là đăng ký phụ.
 * @param code - mã CJS đã bundle.
 * @returns văn bản script classic hoàn chỉnh.
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
    "    return module.exports;",
    "  };",
    "  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "  // id PHU = package goc DSH (mo khoa moi bundle phu thuoc require den no).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(STOCK_PACKAGE_NAME) + ", factory: factory });",
    "})();",
    "",
  ].join("\n");
}

/**
 * Build nửa browser thành script classic đăng ký hai id module.
 * @param out - thư mục đích.
 * @returns đường dẫn file đã build.
 */
async function buildClientHalf(out: string): Promise<string> {
  /* IIFE = script classic: Loader nạp bundle bằng thẻ script (không phải ESM), và chính src/client.ts
     đã tự đăng ký hai id module với __ModuleLoader__. */
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "iife",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("gbh-client-connection: build nua client that bai: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-connection: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, GENERATED_HEADER + "\n" + (await bundle.text()));
  return target;
}

/**
 * Build cả hai nửa của package vào một thư mục đích.
 * @param outDir - thư mục đích (mặc định: lib cạnh package.json).
 * @returns đường dẫn hai file đã build.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  // task-146 bước (b): BRAND RENAME tại chỗ artefact client vừa build (cổng đảo ngược bắt buộc).
  await renameClientArtifact(client);
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}