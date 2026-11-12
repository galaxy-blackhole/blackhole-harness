/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-util-time về lib/index.js (ESM, target node) — nhận thư mục đích qua
 *      process.argv[2] để tầng mount truyền vào.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build package thành một file ESM duy nhất.
 * Nhận: thư mục đích (mặc định: thư mục lib cạnh package).
 * Trả: đường dẫn file đã build.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!result.success) throw new Error("build thất bại: " + result.logs.map((log) => String(log)).join(" | "));
  // 05/11/2026 (P1b): sinh stub .d.ts tro ve nguon de import goi GBH resolve duoc kieu.
  await mkdir(join(out, "types"), { recursive: true });
  await writeFile(join(out, "types", "index.d.ts"), 'export * from "../../src/index.ts";\n');
  return join(out, "index.js");
}

if (import.meta.main) {
  const target = process.argv[2];
  console.log("built " + (await buildPackage(target)));
}
