/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic dang ky HAI id module)
 */

import { renameClientArtifact } from "../../../tools/lib/brand-rename-client.ts";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME, STOCK_PACKAGE_NAME } from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, chèn vào file sinh ra để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-layout — khong sua tay",
  " */",
].join("\n");

/** CSS của khung — nguồn sự thật duy nhất, nhúng vào bundle bằng `define` chứ không chép lại. */
const CSS_FILE = join(import.meta.dir, "src", "AppFrame.module.css");

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
 * Gom log của một lần build hỏng thành một dòng.
 * Nhận: kết quả build của Bun.
 * Trả: chuỗi log đã nối.
 */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build nửa host thành một file ESM duy nhất.
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
  if (!result.success) throw new Error("gbh-ui-layout: build nua host that bai: " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Build nửa browser thành script classic đăng ký HAI id module, kèm CSS khung nhúng sẵn.
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
    define: {
      __GBH_LAYOUT_CSS__: JSON.stringify(readFileSync(CSS_FILE, "utf8")),
    },
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("gbh-ui-layout: build nua client that bai: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("gbh-ui-layout: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Bọc bundle CJS thành script classic đăng ký hai id module bằng cùng một factory.
 * Nhận: mã CJS đã bundle.
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
    "  // id CHINH = package cua ta (khop manifest va rev cua HMR tra theo ownerId).",
    "  window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: factory });",
    "})();",
    "",
  ].join("\n");
}

/**
 * Build cả hai nửa của package vào một thư mục đích.
 * Nhận: thư mục đích (mặc định: `lib` cạnh package.json).
 * Trả: `{ host, client }` — đường dẫn hai file đã build.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  const host = await buildHostHalf(out);
  const client = await buildClientHalf(out);
  // task-157 nhánh B phần 2: token CSS --dsh-* -> --gbh-* NGAY TRONG ARTEFACT.
  // 03/11/2026 (chặng 32): hook này từng bị TẮT nên ui-layout (bên SET token) vẫn ghi --dsh-*
  // trong khi mọi gói tiêu thụ đọc --gbh-* ⇒ font không bao giờ được áp ⇒ giao diện lệch 1-2 px
  // (đo được: bố cục 25/80). Ở đây CHỈ đổi tiền tố token, không dùng brand-rename đầy đủ
  // (bản đó còn đổi cả global __DSH_* và từng bị tắt vì guard "còn sót __GBH_").
  const layoutText = readFileSync(client, "utf8");
  writeFileSync(client, layoutText.split("--dsh-").join("--gbh-"));
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}
