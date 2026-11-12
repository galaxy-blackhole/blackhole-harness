/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build nua HOST cua package ptc-runtime: 3 entry (index + process + persistent-process) ra lib/
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { PACKAGE_NAME } from "./src/ids.ts";

/**
 * Build cả ba entry của gói (ESM, node) ra `outDir`.
 *
 * Vì sao BA entry: tiến trình cha chạy `lib/process.js` và `lib/persistent-process.js` bằng ĐƯỜNG DẪN
 * (exports "./process" của bản gốc) — thiếu một entry là runtime PTC chết khi spawn tiến trình con.
 * Vì sao nhận tham số: `apps/cli/src/mount.ts` gọi `buildIfStale(pkg, <lib trong profile>)`.
 *
 * Nhận: outDir — thư mục đích (mặc định `lib` cạnh package.json).
 * Trả: danh sách tệp đã ghi.
 */
export async function buildPackage(outDir?: string): Promise<string[]> {
  const out = outDir ?? join(import.meta.dir, "lib");
  mkdirSync(out, { recursive: true });
  const entries: Record<string, string> = {
    index: join(import.meta.dir, "src", "index.ts"),
    process: join(import.meta.dir, "src", "process-entry.ts"),
    "persistent-process": join(import.meta.dir, "src", "persistent-process-entry.ts"),
  };
  const written: string[] = [];
  for (const [name, entry] of Object.entries(entries)) {
    const result = await Bun.build({ entrypoints: [entry], outdir: out, target: "node", format: "esm", naming: name + ".js", packages: "external" });
    if (!result.success) throw new Error(PACKAGE_NAME + ": build " + name + " that bai: " + result.logs.map(String).join(" | "));
    written.push(join(out, name + ".js"));
  }
  return written;
}

if (import.meta.main) {
  for (const file of await buildPackage(process.argv[2])) console.log("built " + file);
}
