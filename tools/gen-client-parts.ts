/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Cắt bundle gốc thành các LÁT NGUYÊN VĂN (src/parts/part-XX.ts) theo RANH GIỚI DÒNG — không sửa byte nào.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Header 5 dòng bắt buộc của repo (chèn vào mọi file sinh ra). */
const HEADER = [
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 20/10/2026",
  " * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay",
  " */",
].join(String.fromCharCode(10));

/** Số dòng mỗi lát (cắt theo RANH GIỚI DÒNG nên không cần dòng đánh dấu vỏ). */
const CHUNK = 400;

/**
 * Cắt bundle gốc thành các lát nguyên văn.
 * Nhận: bundlePath — đường dẫn bundle gốc, outDir — thư mục src/parts của gói.
 * Trả: số lát đã ghi.
 */
export function splitStockBundle(bundlePath: string, outDir: string): number {
  const text = readFileSync(bundlePath, "utf8");
  const lines = text.split(String.fromCharCode(10));
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  let index = 0;
  for (let start = 0; start < lines.length; start += CHUNK) {
    index += 1;
    const slice = lines.slice(start, start + CHUNK);
    const name = "part-" + String(index).padStart(2, "0") + ".ts";
    const body = [HEADER, "// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.", slice.join(String.fromCharCode(10)), "export {};", ""].join(String.fromCharCode(10));
    writeFileSync(join(outDir, name), body, "utf8");
  }
  return index;
}

if (import.meta.main) {
  const [bundle, out] = process.argv.slice(2);
  if (bundle === undefined || out === undefined) throw new Error("dùng: bun run tools/gen-client-parts.ts <bundle> <outDir>");
  console.log("ghi " + String(splitStockBundle(bundle, out)) + " lát vào " + out);
}