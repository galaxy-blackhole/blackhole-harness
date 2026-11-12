/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 21/10/2026
 * desc Build gói DE-BUNDLE nửa host: CHÉP nguyên cây lib/ (1:1 bản gốc DSH), không build lại từ src.
 */

import { copyIfDebundled } from "../../../tools/debundle-guard.ts";
import { join } from "node:path";

/**
 * Build gói (thực chất là chép artefact de-bundle sang thư mục đích).
 * Nhận: outDir — thư mục đích (mặc định `lib` cạnh gói).
 * Trả: đường dẫn artefact chính.
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const daDebundle = copyIfDebundled(import.meta.dir, out);
  return daDebundle?.[0] ?? join(out, "index.js");
}
