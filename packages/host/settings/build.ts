import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build goi settings ve lib/index.js (ESM, target node) — ban build CHI nam trong profile cua app.
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build package thanh mot file ESM duy nhat.
 * @param outDir - thu muc dich (mac dinh: lib canh package).
 * @returns duong dan file da build.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  // 20/10/2026: gói đã de-bundle nửa host (xem tools/debundle-guard.ts) ⇒ CHÉP nguyên cây lib/, không build lại.
  const daDebundle = copyIfDebundled(import.meta.dir, outDir ?? join(import.meta.dir, "lib"));
  if (daDebundle !== null) return daDebundle[0] ?? join(outDir ?? join(import.meta.dir, "lib"), "index.js");
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
  if (!result.success) throw new Error("build that bai: " + result.logs.map((log) => String(log)).join(" | "));
  return join(out, "index.js");
}

if (import.meta.main) {
  const target = process.argv[2];
  console.log("built " + (await buildPackage(target)));
}
