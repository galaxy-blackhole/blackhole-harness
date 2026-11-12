/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build package về lib/ (ESM, target node): HAI đầu ra như bản gốc — lib/index.js (seam) và lib/control.js (kênh điều khiển thừa kế)
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build MỘT entry trong src/ thành một file ESM duy nhất trong thư mục đích.
 * Nhận: tên file nguồn (trong src/), thư mục đích, tên file ra.
 * Trả: đường dẫn tuyệt đối của file đã build.
 */
async function buildEntry(entry: string, outDir: string, naming: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", entry)],
    outdir: outDir,
    target: "node",
    format: "esm",
    naming,
    packages: "external",
  });
  if (!result.success) throw new Error("build that bai: " + result.logs.map((log) => String(log)).join(" | "));
  return join(outDir, naming);
}

/**
 * Build CẢ HAI đầu ra của package, đúng hình dạng bản gốc: `lib/index.js` + `lib/control.js`.
 * Nhận: thư mục đích (mặc định `lib` cạnh package); `bh host` truyền thư mục `lib` trong profile qua `process.argv[2]`.
 * Trả: đường dẫn file CHÍNH `index.js`; file `control.js` nằm cạnh nó.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const main = await buildEntry("index.ts", out, "index.js");
  await buildEntry("control.ts", out, "control.js");
  return main;
}

if (import.meta.main) {
  const target = process.argv[2];
  console.log("built " + (await buildPackage(target)));
}
