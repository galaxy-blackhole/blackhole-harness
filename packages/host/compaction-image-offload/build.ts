/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Build @galaxy-blackhole/gbh-compaction-image-offload: đã de-bundle ⇒ CHÉP nguyên cây lib/ (1:1 stock).
 */
import { join } from "node:path";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";

/**
 * Build/copy gói ra thư mục đích của mount.
 * Nhận: outDir — thư mục đích (mặc định lib/). Trả: đường dẫn artefact chính.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const daDebundle = copyIfDebundled(import.meta.dir, out);
  if (daDebundle !== null) return daDebundle[0] ?? join(out, "index.js");
  throw new Error("gbh-compaction-image-offload: chua de-bundle (thieu .debundled)");
}
