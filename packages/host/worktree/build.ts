/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build gói @galaxy-blackhole/gbh-worktree ra lib/index.js (ESM, target node) — bản build chỉ nằm trong profile của app.
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { emitDeclarations } from "../../../tools/typegen/emit-types.ts";

/**
 * Build package thành một file ESM duy nhất.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh package; nhận từ process.argv[2] khi chạy CLI).
 * Trả: đường dẫn tuyệt đối của file đã build.
 */
export async function buildPackage(outDir?: string): Promise<string> {
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
  if (!result.success) throw new Error("build thất bại: " + result.logs.map((log) => String(log)).join(" | "));
  // 05/11/2026 (P1b): sinh .d.ts ngay trong build de khong bi xoa khi build lai.
  emitDeclarations(import.meta.dir);
  return join(out, "index.js");
}

if (import.meta.main) {
  const target = process.argv[2];
  console.log("built " + (await buildPackage(target)));
}
