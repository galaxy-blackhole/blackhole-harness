/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-host-tool-present ve lib/index.js
 */
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { emitDeclarations } from "../../../tools/typegen/emit-types.ts";

/**
 * Build gói thành artifact ESM trong lib/.
 * Nhận: outDir — thư mục đích (mặc định lib/ cạnh package).
 * Trả: đường dẫn file đã build.
 * @throws {Error} khi Bun.build thất bại.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const result = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "index.ts")], outdir: out, target: "node", format: "esm", naming: "index.js", packages: "external" });
  if (!result.success) throw new Error("gbh-host-tool-present: build that bai: " + result.logs.map(String).join(" | "));
  // 05/11/2026 (P1b): sinh .d.ts ngay trong build de khong bi xoa khi build lai.
  emitDeclarations(import.meta.dir);
  return join(out, "index.js");
}

if (import.meta.main) console.log("built " + (await buildPackage(process.argv[2])));
