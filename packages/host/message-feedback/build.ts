/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build @galaxy-blackhole/gbh-message-feedback về lib/ (ESM, target node) — hai đầu ra như bản
 *      gốc: `lib/index.js` (service + mặt plugin) và `lib/types.js` (từ vựng CHỈ-CÓ-KIỂU, module rỗng
 *      lúc chạy, đúng như `lib/types/types.js` của bản gốc). Nhận thư mục đích qua process.argv[2].
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build package thành các file ESM (mọi gói ngoài đều external — kernel cấp đúng một thể hiện).
 * Nhận: thư mục đích (mặc định: `lib` cạnh package; tầng mount của Lead truyền qua argv[2]).
 * Trả: đường dẫn file điểm vào `index.js` đã build.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts"), join(import.meta.dir, "src", "types.ts")],
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
