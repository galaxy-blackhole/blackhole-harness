/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-attachment-local về lib/index.js (ESM, target node) — bản build chỉ
 *      nằm trong profile của app, và nhận thư mục đích qua process.argv[2] để tầng mount truyền vào
 *      (apps/cli/src/mount.ts gọi "bun run build.ts <libDir>" với cwd là gốc package).
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build package thành MỘT file ESM duy nhất (mọi import ngoài đều để external).
 * Nhận: `outDir` — thư mục đích; bỏ trống thì dùng `lib` cạnh package.
 * Trả: promise đường dẫn tuyệt đối của file đã build (`<outDir>/index.js`).
 * @throws Error khi bun build thất bại, kèm log của bun.
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
