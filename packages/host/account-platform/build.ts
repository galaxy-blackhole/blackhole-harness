/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-account-platform về lib/index.js (ESM, target node) — row deepseek-account
 *      (uỷ quyền DeepSeek qua trình duyệt bằng PKCE); nhận thư mục đích qua process.argv[2].
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { emitDeclarations } from "../../../tools/typegen/emit-types.ts";

/**
 * Build package thành một file ESM duy nhất.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package).
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
  // 05/11/2026 (P1b): sinh .d.ts ngay trong build de khong bi xoa khi build lai.
  emitDeclarations(import.meta.dir);
  return join(out, "index.js");
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])));
}
