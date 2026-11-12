/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-plugin-market: 5 entrypoint theo exports của gói
 *      (index → lib/index.js · worker → lib/worker.js · tools → lib/tools.js ·
 *      typert-host → lib/typert.host.js · typert-remote-client → lib/typert.remote-client.js)
 *      MỖI entrypoint build RIÊNG (build gộp 5 entry làm Bun sinh prelude chia sẻ ⇒ lệch byte so bản gốc)
 */

import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";

/** Bản đồ entrypoint (src) → tệp đích trong lib/ theo exports của package.json. */
const ENTRYPOINTS: ReadonlyArray<readonly [string, string]> = [
  ["index", "index.js"],
  ["worker", "worker.js"],
  ["tools", "tools.js"],
  ["typert-host", "typert.host.js"],
  ["typert-remote-client", "typert.remote-client.js"],
];

/**
 * Build 5 entrypoint của gói thành artifact ESM trong thư mục đích, mỗi entrypoint build RIÊNG.
 * Nhận: outDir — thư mục đích (mặc định lib/ cạnh package).
 * Trả: mảng đường dẫn các tệp đã build, theo thứ tự exports.
 * @throws {Error} khi Bun.build thất bại.
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  const out = outDir ?? join(import.meta.dir, "lib");
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  const produced: string[] = [];
  for (const [name, file] of ENTRYPOINTS) {
    const result = await Bun.build({
      entrypoints: [join(import.meta.dir, "src", name + ".ts")],
      outdir: out,
      target: "node",
      format: "esm",
      naming: "[name].js",
      packages: "external",
    });
    if (!result.success) throw new Error("gbh-plugin-market: build " + name + " that bai: " + result.logs.map(String).join(" | "));
    if (name + ".js" !== file) await rename(join(out, name + ".js"), join(out, file));
    produced.push(join(out, file));
  }
  return produced;
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.length + " tep: " + built.map((path) => path.split("/").slice(-1)[0]).join(", "));
}
