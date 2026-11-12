/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-host-directory-picker-native: lib/index.js (ESM node) + COPY NGUYÊN VĂN lib/worker.cjs (entry ./worker, spawn bằng node)
 */
import { copyFile, rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build gói: bundle index + copy worker.
 * Nhận: thư mục đích (mặc định lib cạnh package).
 * Trả: danh sách tệp đã ghi.
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const result = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "index.ts")], outdir: out, target: "node", format: "esm", naming: "index.js", packages: "external" });
  if (!result.success) throw new Error("gbh-host-directory-picker-native: build that bai: " + result.logs.map(String).join(" | "));
  // worker là CJS thuần, bản gốc phát hành NGUYÊN VĂN (không qua bundler) ⇒ copy byte-identical.
  await copyFile(join(import.meta.dir, "src", "worker.cjs"), join(out, "worker.cjs"));
  return [join(out, "index.js"), join(out, "worker.cjs")];
}

if (import.meta.main) console.log("built " + (await buildPackage(process.argv[2])).join(" + "));
