/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-schedule về lib/index.js (ESM, target node) — row schedule (nhắc hẹn bền
 *      theo host); nhận thư mục đích qua process.argv[2] để tầng mount truyền vào.
 */

import { rm } from "node:fs/promises";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
import { join } from "node:path";

/**
 * Build package thành một file ESM duy nhất.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package).
 * Trả: đường dẫn file đã build.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  // 20/10/2026 (task-186): gói đã de-bundle nửa host ⇒ CHÉP nguyên cây lib/ (1:1 bản gốc), KHÔNG build lại.
  {
    const out0 = outDir ?? join(import.meta.dir, "lib");
    const daDebundle = copyIfDebundled(import.meta.dir, out0);
    if (daDebundle !== null) return (daDebundle.length > 0 ? daDebundle[0]! : join(out0, "index.js")) as never;
  }
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
