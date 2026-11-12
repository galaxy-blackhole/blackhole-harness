/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc Build gói thư viện: lib/index.js (ESM, target node). Khai báo kiểu trỏ thẳng src/index.ts.
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build gói thành một file ESM duy nhất.
 * Nhận: outDir — thư mục đích (mặc định `lib` cạnh package.json).
 * Trả: đường dẫn file đã build.
 * @param outDir - thư mục đích.
 * @returns đường dẫn `lib/index.js`.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const result = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "index.ts")], outdir: out, target: "node", format: "esm", naming: "index.js", packages: "external" });
  if (!result.success) throw new Error("gbh-host-bundle-labels: build that bai: " + result.logs.map((l) => String(l)).join(" | "));
  return join(out, "index.js");
}

if (import.meta.main) {
  console.log("built " + (await buildPackage()));
}
