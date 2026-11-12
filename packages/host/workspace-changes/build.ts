/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-host-workspace-changes ve lib/index.js + lib/types.js (ESM, target node)
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

/**
 * Build package thanh hai artifact ESM: nua plugin (index) va mat ./types.
 * Nhận: outDir — thu muc dich (mac dinh: lib canh package; mount.ts truyen <profile>/lib).
 * Trả: duong dan hai artifact da ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ index: string; types: string }> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  const common = { outdir: out, target: "node" as const, format: "esm" as const, packages: "external" as const };
  const index = await Bun.build({ ...common, entrypoints: [join(import.meta.dir, "src", "index.ts")], naming: "index.js" });
  if (!index.success) throw new Error("gbh-host-workspace-changes: build index that bai: " + index.logs.map(String).join(" | "));
  const types = await Bun.build({ ...common, entrypoints: [join(import.meta.dir, "src", "types.ts")], naming: "types.js" });
  if (!types.success) throw new Error("gbh-host-workspace-changes: build types that bai: " + types.logs.map(String).join(" | "));
  return { index: join(out, "index.js"), types: join(out, "types.js") };
}

if (import.meta.main) {
  const out = await buildPackage(process.argv[2]);
  console.log("built " + out.index + " + " + out.types);
}
