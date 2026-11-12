/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build package command-goal về lib/: MỘT entry (src/index.ts -> lib/index.js) — ESM, target node,
 *      dep giữ external; bản build CHỈ nằm trong profile của app (khuôn packages/host/time-context).
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build MỘT entry thành một file ESM duy nhất trong outDir.
 * Nhận: entry — đường dẫn tuyệt đối của file nguồn; outDir — thư mục đích; naming — tên file đầu ra.
 * Trả: đường dẫn file đã build; ném khi Bun.build thất bại (kèm log của lần build hỏng).
 */
async function buildEntry(entry: string, outDir: string, naming: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [entry],
    outdir: outDir,
    target: "node",
    format: "esm",
    naming,
    packages: "external",
  });
  if (!result.success) throw new Error("build that bai (" + naming + "): " + result.logs.map((log) => String(log)).join(" | "));
  return join(outDir, naming);
}

/**
 * Kết quả buildPackage: đường dẫn tuyệt đối của entry đã build.
 * Gói này chỉ có MỘT entry (plugin đăng ký lệnh) — không worker, không manifest typert.
 */
export interface BuiltEntries {
  /** Đường dẫn artefact của entry duy nhất. */
  service: string;
}

/**
 * Build entry service của gói vào một thư mục đích (thư mục được DỌN một lần trước khi build).
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package).
 * Trả: object đường dẫn entry — service = lib/index.js.
 */
export async function buildPackage(outDir?: string): Promise<BuiltEntries> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const service = await buildEntry(join(import.meta.dir, "src", "index.ts"), out, "index.js");
  return { service };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.service);
}
