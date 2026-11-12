/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Build hook cho gói agent-tool-presentation: artefact `lib/index.js` đã có sẵn (giữ NGUYÊN VĂN bản gốc,
 *      chỉ thêm `src/sync.ts` của ta), nên hàm này CHỈ chép artefact sang thư mục đích mà mount yêu cầu —
 *      không biên dịch lại. Trước 20/10/2026 gói không có tệp này nên `bh host` báo
 *      "khong build duoc … Module not found build.ts" và KHÔNG mount được gói.
 */
import { copyFileSync, cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** Tên gói — dùng cho thông điệp lỗi. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-agent-tool-presentation";

/**
 * Build trọn gói vào thư mục đích: chép `lib/index.js` (+ thư mục `lib/types`) từ gói sang.
 * Nhận: outDir — thư mục đích (mặc định `lib/` của gói).
 * Trả: đường dẫn artefact `index.js` đã ghi.
 */
export async function buildPackage(outDir?: string): Promise<{ host: string }> {
  const nguon = join(import.meta.dir, "lib");
  const out = outDir ?? nguon;
  mkdirSync(out, { recursive: true });
  const dich = join(out, "index.js");
  const goc = join(nguon, "index.js");
  if (!existsSync(goc)) throw new Error(PACKAGE_NAME + ": thieu artefact lib/index.js");
  if (goc !== dich) copyFileSync(goc, dich);
  const typesGoc = join(nguon, "types");
  if (existsSync(typesGoc) && join(out, "types") !== typesGoc) cpSync(typesGoc, join(out, "types"), { recursive: true });
  return { host: dich };
}

if (import.meta.main) {
  const built = await buildPackage(process.argv[2]);
  console.log("built " + built.host);
}
