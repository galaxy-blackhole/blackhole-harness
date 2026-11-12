/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build package tool-goal về lib/: MỘT entry (src/index.ts -> lib/index.js) — ESM, target node,
 *      dep giữ external; bản build CHỈ nằm trong profile của app (khuôn packages/host/time-context).
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build entry service của gói vào một thư mục đích (thư mục được DỌN một lần trước khi build).
 * Nhận: outDir — thư mục đích (mặc định: "lib" cạnh package).
 * Trả: đường dẫn tuyệt đối của file đã build ("lib/index.js"); ném khi Bun.build thất bại.
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
  console.log("built " + (await buildPackage(process.argv[2])));
}
