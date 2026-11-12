/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build @galaxy-blackhole/gbh-client-settings-about ra lib/index.js + lib/client.js.
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build gói thành hai tệp ESM trong `lib` (đầu ra CHỈ nằm trong profile của app).
 * @param outDir - thư mục đích do lệnh mount truyền qua `process.argv[2]`.
 * @returns promise hoàn tất khi cả hai tệp đã ghi.
 */
async function main(outDir: string): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  const index = Bun.build({ entrypoints: [join(import.meta.dir, "src/index.ts")], outdir: outDir, target: "node", format: "esm", packages: "external" });
  const client = Bun.build({ entrypoints: [join(import.meta.dir, "src/client.ts")], outdir: outDir, target: "browser", format: "iife", packages: "external", naming: "client.js" });
  const [a, b] = await Promise.all([index, client]);
  if (!a.success || !b.success) {
    for (const log of [...a.logs, ...b.logs]) console.error(String(log));
    throw new Error("build that bai");
  }
  console.log("built " + outDir);
}

const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: bun run build.ts <outDir>");
  process.exit(2);
}
await main(outDir);

