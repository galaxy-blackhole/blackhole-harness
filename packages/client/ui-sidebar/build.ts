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
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-sidebar — khong sua tay",
  " */",
].join("\n");

/** CSS của hai module — nguồn sự thật duy nhất, nhúng vào bundle bằng `define` chứ không chép lại. */
const CSS_FILES = {
  sidebar: join(import.meta.dir, "src", "SidebarRoot.module.css"),
  header: join(import.meta.dir, "src", "HeaderLeadingControls.module.css"),
} as const;

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
  if (!result.success) throw new Error("gbh-ui-sidebar: build nua host that bai: " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Build nửa browser thành script classic đăng ký HAI id module, kèm CSS của cả hai module nhúng sẵn.
 *
 * Hợp đồng C2: script chỉ ĐĂNG KÝ factory, thân module nằm trong closure của factory và chạy ở lần vạt
 * chất hoá đầu tiên. Loader nạp bundle bằng thẻ `<script>` classic (không phải ESM) nên bundle được
 * build ở dạng CJS rồi bọc trong lời gọi đăng ký; id CỦA TA là id chính (khớp manifest và rev của HMR),
 * id của package GỐC là đăng ký phụ. Hai lời gọi dùng CHUNG một factory.
 * Nhận: thư mục đích.
 * Trả: đường dẫn file đã build.
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    target: "browser",
    format: "cjs",
    package: "bundle",
    naming: "client.bundle.js",
    write: false,
    packages: "external",
    define: {
      __GBH_SIDEBAR_CSS__: JSON.stringify(readFileSync(CSS_FILES.sidebar, "utf8")),
      __GBH_SIDEBAR_HEADER_CSS__: JSON.stringify(readFileSync(CSS_FILES.header, "utf8")),
    },
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("gbh-ui-sidebar: build nua client that bai: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("gbh-ui-sidebar: build nua client khong sinh output nao");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/**
 * Bọc bundle CJS thành script classic đăng ký hai id module bằng cùng một factory.
 * Nhận: mã CJS đã bundle (dùng `module`/`exports` như biến tự do).
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
    "  // id PHU = package goc DSH (mo khoa moi bundle phu thuoc require den no).",
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
  // task-157 nhánh B phần 2: BRAND RENAME tại chỗ — token --dsh-* → --gbh-* (cổng đảo ngược bắt buộc).
  await renameClientArtifact(client);
  return { host, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
  console.log("built " + built.client);
}
