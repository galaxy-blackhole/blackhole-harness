/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-experimental-speech-to-text-sensevoice về lib/: HAI entrypoint RIÊNG
 *      (src/index.ts -> lib/index.js, src/worker.ts -> lib/worker.js), mỗi entry MỘT lần Bun.build độc lập
 *      (bài học task-130: gộp nhiều entry trong một Bun.build làm Bun sinh prelude chia sẻ ⇒ byte lệch);
 *      ESM, target node, dependency giữ external; bản build CHỈ nằm trong profile của app,
 *      nhận thư mục đích qua process.argv[2].
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Kết quả buildPackage: đường dẫn tuyệt đối của TỪNG entry đã build.
 */
export interface BuiltEntries {
  /** Entry plugin — lib/index.js. */
  service: string;
  /** Entry tiến trình con riêng tư — lib/worker.js. */
  worker: string;
}

/**
 * Build MỘT entry thành MỘT file ESM duy nhất trong outDir.
 * Nhận: `entry` — đường dẫn tuyệt đối của file nguồn; `outDir` — thư mục đích; `naming` — tên artifact đầu ra.
 * Trả: đường dẫn tuyệt đối của file đã build.
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
  if (!result.success) throw new Error("gbh-experimental-speech-to-text-sensevoice: build thất bại (" + naming + "): " + result.logs.map((log) => String(log)).join(" | "));
  return join(outDir, naming);
}

/**
 * Build CẢ HAI entrypoint của gói vào cùng một thư mục đích, mỗi entry một lần Bun.build RIÊNG.
 * Nhận: `outDir` — thư mục đích (mặc định: `lib` cạnh package; tầng mount truyền qua process.argv[2]);
 *       thư mục được DỌN một lần trước khi build.
 * Trả: object đường dẫn từng entry — service (lib/index.js) và worker (lib/worker.js).
 */
export async function buildPackage(outDir?: string): Promise<BuiltEntries> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const service = await buildEntry(join(import.meta.dir, "src", "index.ts"), out, "index.js");
  const worker = await buildEntry(join(import.meta.dir, "src", "worker.ts"), out, "worker.js");
  return { service, worker };
}

if (import.meta.main) {
  const target = process.argv[2];
  const built = await buildPackage(target);
  console.log("built " + built.service);
  console.log("built " + built.worker);
}
