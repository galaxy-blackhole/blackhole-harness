/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 09/11/2026
 * desc Build package client-store: lib/index.js (ESM cho Node, peer de external) + lib/client.js
 *      (script CLASSIC tu dang ky id module vao bang module cua trang).
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Nam dong header bat buoc cua repo, chen vao moi file sinh ra. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 09/11/2026",
  " * desc File SINH TU DONG boi build.ts cua " + PACKAGE_NAME + " — khong sua tay",
  " */",
].join("\n");

/** Bốn tên export bắt buộc phải có trong artefact (khớp bản gốc). */
const BAT_BUOC = ["createSnapshotStore", "defineStore", "notifySubscribers", "shallowEqual"];

/**
 * Gom log của một lần build hỏng thành một dòng để đọc.
 * Nhận: result — kết quả build của Bun. Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build nửa host (ESM cho Node).
 * Nhận: out — thư mục đích. Trả: đường dẫn file index.js.
 */
async function buildHostHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    packages: "external",
    naming: "index.js",
    banner: GENERATED_HEADER,
  });
  if (!result.success) throw new Error("client-store: build nua host that bai: " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Build nửa browser thành script CLASSIC tự đăng ký id module của ta.
 * Nhận: out — thư mục đích. Trả: đường dẫn file client.js.
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: join(out, ".tmp-client"),
    target: "browser",
    format: "cjs",
    naming: "bundle.js",
  });
  if (!result.success) throw new Error("client-store: build nua client that bai: " + logsOf(result));
  const ma = await Bun.file(join(out, ".tmp-client", "bundle.js")).text();
  const boc = [
    GENERATED_HEADER,
    "(function () {",
    "  var module = { exports: {} };",
    "  var exports = module.exports;",
    ma,
    "  window.__ModuleLoader__.load({",
    "  	id: " + JSON.stringify(PACKAGE_NAME) + ",",
    "  	factory: function () { return module.exports; },",
    "  });",
    "})();",
    "",
  ].join("\n");
  const file = join(out, "client.js");
  await Bun.write(file, boc);
  await rm(join(out, ".tmp-client"), { recursive: true, force: true });
  return file;
}

/**
 * Điểm vào: build cả hai nửa và tự kiểm bốn tên export.
 * Nhận: không (đọc tham số dòng lệnh). Trả: không.
 */
async function main(): Promise<void> {
  const out = join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const hostFile = await buildHostHalf(out);
  const clientFile = await buildClientHalf(out);
  const hostCode = await Bun.file(hostFile).text();
  for (const ten of BAT_BUOC) {
    if (!hostCode.includes(ten)) throw new Error("client-store: nua host thieu export " + ten);
  }
  const clientCode = await Bun.file(clientFile).text();
  if (!clientCode.includes(PACKAGE_NAME)) throw new Error("client-store: nua client thieu id module");
  console.log("client-store: da build lib/index.js + lib/client.js");
}

await main();
