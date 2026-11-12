/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 25/10/2026
 * desc Build gói speech-to-text-phowhisper: Bun.build nửa host ra lib/index.js + chép runtime/*.py.
 */
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { emitDeclarations } from "../../../tools/typegen/emit-types.ts";

/**
 * Build gói ra thư mục đích.
 * Nhận: outDir — thư mục lib đích (mặc định lib/ của gói).
 * Trả: đường dẫn lib/index.js đã ghi.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  const result = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "node",
    format: "esm",
    naming: "index.js",
    packages: "external",
  } as Parameters<typeof Bun.build>[0]);
  if (!result.success) throw new Error("phowhisper: build that bai: " + result.logs.map(String).join(" | "));
  // runtime/*.py phải nằm cạnh lib/ trong profile (mount chép cả thư mục gói).
  const runtimeOut = join(out, "..", "runtime");
  mkdirSync(runtimeOut, { recursive: true });
  for (const file of readdirSync(join(import.meta.dir, "runtime"))) {
    if (file.endsWith(".py")) copyFileSync(join(import.meta.dir, "runtime", file), join(runtimeOut, file));
  }
  // 05/11/2026 (P1b): sinh .d.ts ngay trong build de khong bi xoa khi build lai.
  emitDeclarations(import.meta.dir);
  return join(out, "index.js");
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])));
}
