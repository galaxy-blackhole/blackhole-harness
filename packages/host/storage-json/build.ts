/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build @galaxy-blackhole/gbh-storage-json ve lib/index.js (ESM, target node) — ban build CHI nam trong profile cua app.
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build package thành một file ESM duy nhất.
 * Nhận: thư mục đích tuỳ chọn (mặc định: `lib` cạnh package) — tầng mount truyền vào qua `process.argv[2]`.
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
  if (!result.success) throw new Error("build that bai: " + result.logs.map((log) => String(log)).join(" | "));
  return join(out, "index.js");
}

if (import.meta.main) {
  const target = process.argv[2];
  console.log("built " + (await buildPackage(target)));
}
