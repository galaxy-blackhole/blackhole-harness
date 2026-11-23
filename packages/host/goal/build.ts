/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 23/11/2026
 * desc Build @galaxy-blackhole/gbh-goal về lib/index.js (ESM, target node) — bản build chỉ nằm trong
 *      profile của app, và nhận thư mục đích qua process.argv[2] để tầng mount truyền vào.
 *      23/11/2026: chép MẶT TYPERT (src/typert-face/*) sang lib/typert-face/ ngay sau khi build.
 *      Lý do: tầng mount chỉ chép thư mục lib/ (và locale/) sang profile, nên để mặt typert ở src/
 *      thì profile KHÔNG có tệp, typert-loader ném ERR_MODULE_NOT_FOUND và cửa Goal chết.
 */
import { cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Chép mặt typert đã soạn sẵn từ src/typert-face sang lib/typert-face.
 * Nhận: out — thư mục build (lib của gói, hoặc thư mục mount truyền vào).
 * Trả: số tệp đã chép (0 khi gói không có mặt typert).
 */
async function copyTypertFace(out: string): Promise<number> {
  const from = join(import.meta.dir, "src", "typert-face");
  if (!existsSync(from)) return 0;
  await cp(from, join(out, "typert-face"), { recursive: true });
  return 4;
}

/**
 * Build package thành MỘT file ESM duy nhất.
 * Nhận: `outDir` — thư mục đích (mặc định: `lib` cạnh package; tầng mount truyền qua `process.argv[2]`).
 * Trả: đường dẫn file đã build.
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
  // lib/ vừa bị xoá và build lại, nên mặt typert phải chép lại SAU Bun.build (không phải trước).
  await copyTypertFace(out);
  return join(out, "index.js");
}

if (import.meta.main) {
  const target = process.argv[2];
  console.log("built " + (await buildPackage(target)));
}
