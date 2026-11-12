/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Build thu vien ESM cua goi ui-primitives ra lib/ (react external; nhan outDir qua argv[2] nhu cac goi khac)
 */

import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Build tron goi ra outDir (hoac lib/ cua chinh goi neu khong truyen).
 *
 * ⚠️ PHAI nhan outDir qua tham so dong lenh: tang nap cua app build vao BAN MOUNT trong profile
 * (buildIfStale(pkg, join(dir, "lib"))), hard-code lib/ se lam profile thieu artifact.
 * Nhận: outDir — thu muc dich (tuy chon).
 * Trả: khong.
 */
async function buildPackage(outDir?: string): Promise<void> {
  const out = outDir ?? join(import.meta.dir, "lib");
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const built = await Bun.build({
    entrypoints: [join(import.meta.dir, "src", "index.ts")],
    outdir: out,
    target: "browser",
    format: "esm",
    naming: "index.js",
    packages: "external",
  });
  if (!built.success) throw new Error("gbh-client-ui-primitives: build that bai");
}

if (import.meta.main) {
  await buildPackage(process.argv[2]);
  console.log("gbh-client-ui-primitives: da build lib/index.js");
}
