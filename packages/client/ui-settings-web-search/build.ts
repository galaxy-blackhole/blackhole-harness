/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build hai nua: lib/index.js (node ESM) va lib/client.js (CJS boc __ModuleLoader__.load, seed nen tang de external)
 */

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
  " * desc File SINH TU DONG boi build.ts cua @galaxy-blackhole/gbh-client-ui-settings-web-search — khong sua tay",
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
  if (!result.success) throw new Error("that bai (node): " + logsOf(result));
  return join(out, "index.js");
}

/**
 * Build nửa browser sang **CJS** rồi bọc §__ModuleLoader__.load({ id, factory })§.
 * CJS là bắt buộc: ESM sẽ sinh câu §export {…}§ và nạp bằng thẻ script là SyntaxError.
 * §packages: "external"§ giữ §require("react/jsx-runtime")§ và §require("@galaxy-blackhole/gbh-client-ui-primitives")§
 * nguyên dạng — chúng là seed nền tảng do vỏ cấp qua chính §require§ của factory.
 * Nhận: thư mục đích.
 * Trả: đường dẫn file đã build.
 */
async function buildClientHalf(out: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "client.ts")],
    outdir: out,
    target: "browser",
    format: "cjs",
    packages: "external",
    naming: "client.bundle.js",
    write: false,
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("that bai (client): " + logsOf(result));
  const bundle = result.outputs[0];
  if (bundle === undefined) throw new Error("khong sinh output nao cho nua browser");
  const target = join(out, "client.js");
  writeFileSync(target, wrapClientBundle(await bundle.text()));
  return target;
}

/** Bọc bundle CJS thành factory của __ModuleLoader__ (chỉ MỘT id: row không cần alias). */
function wrapClientBundle(code: string): string {
  return [
    GENERATED_HEADER,
    "window.__ModuleLoader__.load({",
    "\tid: " + JSON.stringify(PACKAGE_NAME) + ",",
    "\tfactory: (require) => {",
    "\t\t\"use strict\";",
    "\t\tvar module = { exports: {} };",
    "\t\tvar exports = module.exports;",
    indent(code, 2),
    "\t\treturn module.exports;",
    "\t}",
    "});",
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

