/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build @galaxy-blackhole/gbh-spill-local về lib/index.js (ESM, target node) — MỘT đầu ra như bản
 *      gốc (chỉ subpath "."), và nhận thư mục đích qua process.argv[2] để tầng mount truyền vào.
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build package thành một file ESM duy nhất, giữ mọi gói ngoài là `external`.
 * Nhận: thư mục đích (mặc định: `lib` cạnh package); `mount.ts` truyền thư mục lib trong profile qua argv[2].
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
  return join(out, "index.js");
}

if (import.meta.main) {
  const target = process.argv[2];
  console.log("built " + (await buildPackage(target)));
}
