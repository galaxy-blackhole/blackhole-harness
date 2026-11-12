/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Build @galaxy-blackhole/gbh-session-title-all-prompts-llm: gói đã de-bundle nửa host ⇒ CHÉP nguyên cây lib/ (1:1 bản gốc).
 */
import { join } from "node:path";
import { copyIfDebundled } from "../../../tools/debundle-guard.ts";

/**
 * Build/copy gói ra thư mục đích của mount.
 * Nhận: outDir — thư mục đích (mặc định lib/ cạnh package). Trả: đường dẫn artefact chính (index.js).
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const daDebundle = copyIfDebundled(import.meta.dir, out);
  if (daDebundle !== null) return daDebundle[0] ?? join(out, "index.js");
  throw new Error("gbh-session-title-all-prompts-llm: chua de-bundle (thieu .debundled) — khong con ban typed de build");
}
