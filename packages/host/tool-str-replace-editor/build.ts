/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-tool-str-replace-editor thành lib/index.js bằng Bun.build (ESM, node, peer ngoài bundle) — chạy TRONG thư mục gói.
 */
import { mkdir, rm } from "node:fs/promises";
import { cpSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo (packages/host/<gói> ⇒ ../../.. ⇒ repo root). */
const REPO = join(import.meta.dir, "..", "..", "..");

/**
 * Build gói thành một artifact ESM trong lib/ (entry `src/index.ts` → `index.js`).
 * Nhận: outDir — thư mục đích (mặc định `lib/` cạnh package.json).
 * Trả: đường dẫn tuyệt đối của artifact đã build.
 * @throws {Error} khi Bun.build thất bại — thông điệp kèm log của bun.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external"
  });
  if (!result.success) throw new Error("gbh-tool-str-replace-editor: build that bai: " + result.logs.map(String).join(" | "));
  // 19/10/2026 (Lead duyệt (a)): parity TYPE với stock — stock có lib/types/index.d.ts ⇒ gói ta phải có.
  // Chép NGUYÊN VĂN để exports["."].types trỏ được (build TRONG thư mục gói).
  cpSync(join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-tool-str-replace-editor", "lib", "types"), join(out, "types"), { recursive: true });
  return join(out, "index.js");
}

if (import.meta.main) console.log("built " + (await buildPackage(process.argv[2])));
