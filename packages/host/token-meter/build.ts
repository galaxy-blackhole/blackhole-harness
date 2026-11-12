/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-token-meter về lib/ (ESM, target node). Gói có BA entry theo `exports`:
 *      `.` (index) · `./estimate` · `./client` — nên build sinh cả ba file, mỗi entry một tệp phẳng.
 */

import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";

/** Ba entry công khai của gói, theo đúng `exports` trong package.json. */
export const ENTRIES: readonly { readonly source: string; readonly output: string }[] = [
  { source: "index.ts", output: "index.js" },
  { source: "estimate.ts", output: "estimate.js" },
  { source: "client.ts", output: "client.js" },
];

/**
 * Build TẤT CẢ entry đang có mặt (entry chưa port thì bỏ qua, KHÔNG làm hỏng build).
 * Nhận: thư mục đích (mặc định: `lib` cạnh package).
 * Trả: đường dẫn các file đã build.
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const built: string[] = [];
  for (const entry of ENTRIES) {
    const entrypoint = join(import.meta.dir, "src", entry.source);
    if (!existsSync(entrypoint)) continue;
    const result = await Bun.build({
      entrypoints: [entrypoint],
      outdir: out,
      target: "node",
      format: "esm",
      naming: entry.output,
      packages: "external",
    });
    if (!result.success) {
      throw new Error("build thất bại (" + entry.source + "): " + result.logs.map((log) => String(log)).join(" | "));
    }
    built.push(join(out, entry.output));
  }
  if (built.length === 0) throw new Error("build thất bại: chưa có entry nào trong src/");
  return built;
}

if (import.meta.main) {
  const target = process.argv[2];
  console.log("built " + (await buildPackage(target)).join(", "));
}
