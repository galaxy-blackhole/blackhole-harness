/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-plan-mode về lib/index.js (ESM, target node, dependency giữ external);
 *      bản build chỉ nằm trong profile của app, nhận thư mục đích qua process.argv[2].
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Kết quả buildPackage: đường dẫn tuyệt đối của entry đã build.
 */
export interface BuiltEntries {
  /** File dịch vụ đã build — lib/index.js. */
  service: string;
}

/**
 * Build entry src/index.ts thành MỘT file ESM duy nhất trong outDir.
 *
 * Nhận: `outDir` — thư mục đích (mặc định: lib cạnh package; tầng mount truyền qua
 * process.argv[2]); thư mục được DỌN một lần trước khi build.
 * Trả: object `{ service }` — đường dẫn tuyệt đối của lib/index.js đã build.
 *
 * @param outDir Thư mục đích, mặc định `lib` cạnh package.
 * @returns Đường dẫn entry đã build.
 */
export async function buildPackage(outDir?: string): Promise<BuiltEntries> {
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
  if (!result.success) {
    throw new Error("gbh-plan-mode: build thất bại: " + result.logs.map((log) => String(log)).join(" | "));
  }
  return { service: join(out, "index.js") };
}

if (import.meta.main) {
  const target = process.argv[2];
  const built = await buildPackage(target);
  console.log("built " + built.service);
}
