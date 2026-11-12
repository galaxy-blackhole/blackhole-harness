/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build hai nua cua package: lib/index.js (node ESM) va lib/client.js (script classic dang ky qua __ModuleLoader__)
 */

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { PACKAGE_NAME, STOCK_NAME } from "./src/ids.ts";

/** Năm dòng header bắt buộc của repo, chèn vào mọi file sinh ra để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 17/10/2026",
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-modules — khong sua tay",
  " */",
].join("\n");

/**
 * Build nửa node thành một file ESM duy nhất (giữ peer cordis ở dạng external để chỉ có một instance).
 * Nhận: thư mục đích.
 * Trả: đường dẫn file đã build.
 * @throws khi bun không build được; thông điệp kèm log của bundler.
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
    define: { __GBH_BUILD_COMMIT__: JSON.stringify(buildCommit()) },
  });
  if (!result.success) throw new Error("gbh-client-modules: build node that bai: " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Build nửa browser thành script classic đăng ký một factory lười vào window.__ModuleLoader__.
 *
 * Hợp đồng C2: script chỉ ĐĂNG KÝ, không chạy thân module; thân module nằm trong closure của factory
 * và chạy ở lần vạt chất hoá đầu tiên. Vì vậy bundle CJS được bọc trong đúng khuôn
 * window.__ModuleLoader__.load({ id, factory }), với module/exports do factory tự dựng.
 * Nhận: thư mục đích.
 * Trả: đường dẫn file đã build.
 * @throws khi bun không build được, hoặc bundle còn tham chiếu require ra ngoài (externals lạc).
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
  if (!result.success) throw new Error("gbh-client-modules: build client that bai: " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("gbh-client-modules: build client khong sinh output nao");
  const code = await bundle.text();
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(code));
  return target;
}

/**
 * Bọc bundle CJS thành factory của __ModuleLoader__.
 * Nhận: mã CJS đã bundle (dùng module/exports như biến tự do).
 * Trả: văn bản script classic hoàn chỉnh.
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
    // MỘT id theo mục §8: id stock thuộc `gbh.row.aliases` (tầng nạp phát entry alias trỏ về URL này).
    // Đăng ký hai lần = bundle chạy hai lần = `duplicate factory registration` (đã cắn ngày 17/10/2026).
    "window.__ModuleLoader__.load({ id: " + JSON.stringify(PACKAGE_NAME) + ", factory: gbhFactory });",
    "",
  ].join("\n");
}

/**
 * Commit nguồn đóng vào artifact lúc build; đây là danh tính release mà trang so mỗi khi Host phát
 * đồ thị mới, nên nó phải ỔN ĐỊNH giữa các lần chạy cùng một bản build.
 * Nhận: không.
 * Trả: hash ngắn của HEAD, hoặc "dev" khi không có git.
 */
function buildCommit(): string {
  const result = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: import.meta.dir, encoding: "utf8" });
  const hash = result.status === 0 ? result.stdout.trim() : "";
  return hash === "" ? "dev" : hash;
}

/** Thụt lề mọi dòng không rỗng của một khối mã. */
function indent(code: string, levels: number): string {
  const pad = "\t".repeat(levels);
  return code
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : pad + line))
    .join("\n");
}

/** Gom log của một lần build hỏng thành một dòng. */
function logsOf(result: { logs: unknown[] }): string {
  return result.logs.map((log) => String((log as { message?: unknown }).message ?? log)).join(" | ");
}

/**
 * Build cả hai nửa của package vào một thư mục đích.
 * Nhận: thư mục đích (mặc định: lib cạnh package.json).
 * Trả: { node, client } — đường dẫn hai file đã build.
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
