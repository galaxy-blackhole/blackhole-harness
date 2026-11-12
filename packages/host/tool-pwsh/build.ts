/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-tool-pwsh thành lib/index.js (Bun.build, ESM node, gói ngoài external).
 *      Chạy TRONG thư mục gói (`cd packages/host/tool-pwsh && bun run build.ts`) để nhãn comment khớp.
 */

import { createHash } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/** Tên package của ta. */
const PACKAGE_NAME = "@galaxy-blackhole/gbh-tool-pwsh";

/**
 * Build gói thành artifact ESM trong lib/.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package.json).
 * Trả: đường dẫn artifact đã build (index.js).
 * @throws {Error} khi Bun.build thất bại — in toàn bộ log của bundler.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
    sourcemap: "none",
  });
  if (!result.success) throw new Error(PACKAGE_NAME + ": build thất bại: " + result.logs.map((log) => String(log)).join(" | "));
  return join(out, "index.js");
}

/**
 * Băm SHA-256 một khối byte.
 * Nhận: bytes — nội dung cần băm.
 * Trả: chuỗi hex 64 ký tự.
 */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

if (import.meta.main) {
  const file = await buildPackage(process.argv[2]);
  const bytes = readFileSync(file);
  console.log("build " + PACKAGE_NAME + ": " + file + " · bytes=" + String(bytes.length) + " · sha256=" + sha256(bytes));
}
