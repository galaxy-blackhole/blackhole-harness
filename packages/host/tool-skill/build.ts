/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build @galaxy-blackhole/gbh-host-tool-skill ve lib/index.js
 */
import { mkdir, rm } from "node:fs/promises";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
import { join } from "node:path";

/**
 * Build gói thành artifact ESM trong lib/.
 * Nhận: outDir — thư mục đích (mặc định lib/ cạnh package).
 * Trả: đường dẫn file đã build.
 * @throws {Error} khi Bun.build thất bại.
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
  await mkdir(out, { recursive: true });
  const result = await Bun.build({ entrypoints: [join(import.meta.dir, "src", "index.ts")], outdir: out, target: "node", format: "esm", naming: "index.js", packages: "external" });
  if (!result.success) throw new Error("gbh-host-tool-skill: build that bai: " + result.logs.map(String).join(" | "));
  return join(out, "index.js");
}

if (import.meta.main) console.log("built " + (await buildPackage(process.argv[2])));
