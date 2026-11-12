/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic dang ky qua __ModuleLoader__)
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { PACKAGE_NAME } from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, chèn vào mọi file sinh ra. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-resources — khong sua tay",
  " */",
].join("\n");

/**
 * Build nửa node thành một file ESM duy nhất (peer cordis để external).
 * Nhận: thư mục đích.
 * Trả: đường dẫn file đã build.
 */
async function buildNodeHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    packages: "external",
    naming: "index.js",
    banner: GENERATED_HEADER,
  });
  if (!result.success) throw new Error("gbh-client-resources: build node that bai: " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Build nửa browser thành script classic đăng ký một factory lười (hợp đồng C2).
 * Nhận: thư mục đích.
 * Trả: đường dẫn file đã build.
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client", "index.ts")],
    target: "browser",
    format: "cjs",
    package: "bundle",
    naming: "client.bundle.js",
    write: false,
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("gbh-client-resources: build client that bai: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-resources: build client khong sinh output nao");
  const code = await bundle.text();
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(code));
  return target;
}

/** Bọc bundle CJS thành factory của __ModuleLoader__. */
/**
 * Bọc bundle CJS thành lời gọi đăng ký của vỏ.
 * Đăng ký HAI id (của ta + id stock) với CÙNG MỘT factory, trong MỘT lần thực thi bundle:
 * entry id stock do host phát thêm phân giải được mà bundle không chạy lần thứ hai
 * (chạy hai lần ⇒ `duplicate factory registration`).
 * Nhận: mã CJS đã build của nửa browser và header sinh tự động.
 * Trả: mã hoàn chỉnh để ghi ra `lib/client.js`.
 */
function wrapClientBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "var gbhFactory = (require) => {",
    '\t"use strict";',
    "\tvar module = { exports: {} };",
    "\tvar exports = module.exports;",
    indent(code, 1),
    "\treturn module.exports;",
    "};",
    /* MỘT id: id của ta. Id stock được phục vụ qua `gbh.row.aliases` (tầng nạp phát entry alias dùng CÙNG URL,
       và nửa browser trả bản sao `apply` no-op) — đăng ký id stock ở đây nữa là ĐĂNG KÝ HAI LẦN ⇒ entry thứ hai
       cho cùng bundle ⇒ đúng lớp lỗi làm row kẹt (đo 17/10/2026). Test của chính gói này (resources.test.ts:190)
       đã assert đúng quy tắc một-id. */
    "window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: gbhFactory });",
    "",
  ].join("\n");
}

/** Thụt lề mọi dòng không rỗng của một khối mã. */
function indent(code: string, levels: number): string {
  const pad = "\t".repeat(levels);
  return code.split("\n").map((line) => (line.trim() === "" ? "" : pad + line)).join("\n");
}

/** Gom log của một lần build hỏng thành một dòng. */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build cả hai nửa vào một thư mục đích.
 * Nhận: thư mục đích (mặc định: lib cạnh package.json).
 * Trả: đường dẫn hai file đã build.
 */
export async function buildPackage(outDir?: string): Promise<{ node: string; client: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(dirname(join(out, "x")), { recursive: true });
  const node = await buildNodeHalf(out);
  const client = await buildClientHalf(out);
  return { node, client };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.node);
  console.log("built " + built.client);
}
