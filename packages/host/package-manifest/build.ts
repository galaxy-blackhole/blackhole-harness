/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-package-manifest về lib/index.js (ESM, node) — nhận outDir qua argv[2]
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build package thành một file ESM duy nhất.
 * Nhận: thư mục đích (mặc định lib cạnh package).
 * Trả: đường dẫn file đã build.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const result = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "index.ts")], outdir: out, target: "node", format: "esm", naming: "index.js", packages: "external" } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("gbh-package-manifest: build that bai: " + result.logs.map(String).join(" | "));
  return join(out, "index.js");
}

if (import.meta.main) console.log("built " + (await buildPackage(process.argv[2])));
