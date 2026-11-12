/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build package agent-instructions về lib/: entry service (src/index.ts) -> lib/index.js — ESM, target node,
 *      dependency giữ external; bản build CHỈ nằm trong profile của app.
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/** Đường dẫn tuyệt đối của entry đã build. */
export interface BuiltPackage {
  /** Tệp lib/index.js đã build từ src/index.ts. */
  service: string;
}

/**
 * Build MỘT entry thành một file ESM duy nhất trong outDir.
 * Nhận: entry — đường dẫn tuyệt đối của file nguồn; outDir — thư mục đích; naming — tên file đầu ra.
 * Trả: đường dẫn file đã build.
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
  if (!result.success) {
    throw new Error("build that bai (" + naming + "): " + result.logs.map((log) => String(log)).join(" | "));
  }
  return join(outDir, naming);
}

/**
 * Build entry service của gói vào một thư mục đích (mặc định: lib cạnh package).
 * Nhận: outDir — thư mục đích; thư mục được DỌN một lần trước khi build.
 * Trả: object đường dẫn entry — service (lib/index.js).
 */
export async function buildPackage(outDir?: string): Promise<BuiltPackage> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const service = await buildEntry(join(import.meta.dir, "src", "index.ts"), out, "index.js");
  return { service };
}

if (import.meta.main) {
  const target = process.argv[2];
  const built = await buildPackage(target);
  console.log("built " + built.service);
}
