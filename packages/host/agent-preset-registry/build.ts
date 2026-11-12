/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-agent-preset-registry về lib/index.js (ESM, target node); nhận thư mục
 *      đích qua process.argv[2] để tầng mount truyền vào.
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";

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
  // 08/11/2026 (cùng lớp lỗi 404 của `gbh-session/fork`): gói khai subpath `./types` và `./display` nhưng `default`
  // trỏ `./src/*.ts` ⇒ bản MOUNT (chỉ copy lib/) sẽ nổ ERR_MODULE_NOT_FOUND nếu có ai import. Build runtime của
  // hai subpath vào `lib/types/` đúng layout bản gốc, rồi package.json trỏ `default` vào đó.
  const subpaths = ["types", "display"];
  const sub = await Bun.build({
    entrypoints: subpaths.map((name) => join(import.meta.dir, "src", name + ".ts")),
    outdir: join(out, "types"),
    target: "node",
    format: "esm",
    naming: "[name].js",
    packages: "external",
  });
  if (!sub.success) throw new Error("build subpath thất bại: " + sub.logs.map((log) => String(log)).join(" | "));
  return join(out, "index.js");
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])));
}
