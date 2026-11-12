/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build @galaxy-blackhole/gbh-spill-policy về lib/ (ESM, target node) — HAI đầu ra như bản gốc
 *      (lib/index.js + lib/notice.js cho subpath "./notice"), và nhận thư mục đích qua process.argv[2]
 *      để tầng mount truyền vào.
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build package thành các file ESM (một file cho mỗi đầu vào), giữ mọi gói ngoài là `external`.
 * Nhận: thư mục đích (mặc định: `lib` cạnh package).
 * Trả: đường dẫn file `index.js` đã build (đầu ra chính; `notice.js` nằm cạnh nó).
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts"), join(import.meta.dir, "src", "notice.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "[name].js",
    packages: "external",
  });
  if (!result.success) throw new Error("build thất bại: " + result.logs.map((log) => String(log)).join(" | "));
  return join(out, "index.js");
}

if (import.meta.main) {
  const target = process.argv[2];
  console.log("built " + (await buildPackage(target)));
}
