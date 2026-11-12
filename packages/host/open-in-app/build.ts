/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Build package ve lib/index.js (ESM, target node) — ban build CHI nam trong profile cua app.
 */
import { rm } from "node:fs/promises";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
import { join } from "node:path";

/**
 * Build package thanh mot file ESM duy nhat.
 * @param outDir - thu muc dich (mac dinh: lib canh package).
 * @returns duong dan file da build.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  // 20/10/2026 (task-186): gói đã de-bundle nửa host ⇒ CHÉP nguyên cây lib/ (1:1 bản gốc), KHÔNG build lại.
  {
    const out0 = outDir ?? join(import.meta.dir, "lib");
    const daDebundle = copyIfDebundled(import.meta.dir, out0);
    if (daDebundle !== null) return (daDebundle.length > 0 ? daDebundle[0]! : join(out0, "index.js")) as never;
  }
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