/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-host-tools ve lib/index.js (ESM) + types/presentation
 */
import { mkdir, rm } from "node:fs/promises";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
import { join } from "node:path";

/** Điểm vào TS → tên artifact trong lib/. */
const ENTRYPOINTS: ReadonlyArray<readonly [string, string]> = [
  ["index.ts", "index.js"],
  ["types.ts", "types.js"],
  ["presentation.ts", "presentation.js"],
];

/**
 * Build gói thành các artifact ESM trong lib/.
 * Nhận: outDir — thư mục đích (mặc định lib/ cạnh package; mount.ts truyền <profile>/lib).
 * Trả: danh sách đường dẫn đã build.
 * @throws {Error} khi Bun.build thất bại.
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  // 20/10/2026 (task-186): gói đã de-bundle nửa host ⇒ CHÉP nguyên cây lib/ (1:1), KHÔNG build lại từ src.
  const out0 = outDir ?? join(import.meta.dir, "lib");
  const daDebundle = copyIfDebundled(import.meta.dir, out0);
  if (daDebundle !== null) return daDebundle;
  const out = out0;
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const result = await Bun.build({
    entrypoints: ENTRYPOINTS.map(([source]) => join(import.meta.dir, "src", source)),
    outdir: out,
    target: "node",
    format: "esm",
    naming: "[name].js",
    packages: "external",
  });
  if (!result.success) throw new Error("gbh-host-tools: build that bai: " + result.logs.map(String).join(" | "));
  return ENTRYPOINTS.map(([, artifact]) => join(out, artifact));
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])).join("\n      "));
}
