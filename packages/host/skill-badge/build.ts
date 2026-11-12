/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 25/10/2026
 * desc Build của gói skill-badge: gói ship SẴN artefact (lib/index.js + assets/ + locale/) nên "build" chỉ
 *      CHÉP lib/index.js sang thư mục đích (mount gọi build với outDir = lib/ trong profile; thiếu bước này
 *      profile rỗng lib ⇒ boot báo "failed to import … lib/index.js"). Có tệp này để tools/check/rows.ts
 *      nhận gói là de-bundle thay vì CHẶN vì "thieu src/index.ts".
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Đường dẫn tính từ gói này. */
const OURS = import.meta.dir;

/** Năm dòng header bắt buộc của repo, in vào artefact để bản build cũng tự khai nguồn. */
const GENERATED_HEADER = [
  "/*",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 25/10/2026",
  " * desc ARTIFACT SINH TU DONG boi build.ts cua gbh-skill-badge — khong sua tay",
  " */",
].join(String.fromCharCode(10));

/**
 * Sinh (chép) artefact host của gói vào thư mục đích.
 * Nhận: outDir — thư mục lib đích (mặc định lib/ của gói).
 * Trả: đường dẫn artefact đã ghi.
 */
export function buildPackage(outDir?: string): string {
  const out = outDir ?? join(OURS, "lib");
  const source = join(OURS, "lib", "index.js");
  if (!existsSync(source)) throw new Error("gbh-skill-badge: thiếu lib/index.js nguồn");
  mkdirSync(out, { recursive: true });
  const target = join(out, "index.js");
  const body = readFileSync(source, "utf8");
  const hasHeader = body.startsWith("/*");
  const text = (hasHeader ? "" : GENERATED_HEADER + String.fromCharCode(10)) + body;
  if (target === source) return target;
  writeFileSync(target, text);
  return target;
}

if (import.meta.main) {
  console.log("built " + buildPackage(process.argv[2]));
}
