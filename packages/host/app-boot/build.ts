/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build gói @galaxy-blackhole/gbh-app-boot: ghép 7 lát nguyên văn thành lib/index.js với
 *      CỔNG BYTE delta 0 so với stock, rồi copy lib/worker/*.js nguyên văn và so từng byte.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");
/** Nguồn stock CHỈ ĐỌC. */
const STOCK = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-app-boot");
/** Đích trong gói ta. */
const OURS = import.meta.dir;
/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/**
 * Bóc scaffold (header 7 dòng + marker + dòng trống + dòng trống cuối + export {}) khỏi một lát.
 * Nhận: text — nội dung tệp lát. Trả: các dòng thân nguyên văn.
 */
function sliceBody(text: string): string[] {
  const lines = text.split(EOL);
  const start = lines.indexOf("// @ts-nocheck") + 2;
  // Dòng cuối thân nằm NGAY TRƯỚC dòng trống scaffold (thân có thể kết thúc bằng dòng trống của stock).
  const end = lines.lastIndexOf("export {};") - 1;
  return lines.slice(start, end);
}

/**
 * Ghép mọi lát trong src/parts theo thứ tự từ điển thành văn bản stock (không có newline cuối).
 * Nhận: không. Trả: văn bản đã ghép.
 */
export function assembleHostParts(): string {
  const dir = join(import.meta.dir, "src", "parts");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts")).sort();
  return files.map((f) => sliceBody(readFileSync(join(dir, f), "utf8")).join(EOL)).join(EOL);
}

/**
 * Build gói: cổng byte host + copy worker nguyên văn + xác minh từng byte.
 * Nhận: outDir — thư mục đích (mặc định lib/). Trả: báo cáo dạng chuỗi.
 */
export function buildPackage(outDir: string = join(OURS, "lib")): string {
  const expectedText = readFileSync(join(STOCK, "lib", "index.js"), "utf8");
  const expected = expectedText.endsWith(EOL) ? expectedText.slice(0, -1) : expectedText;
  const assembled = assembleHostParts();
  if (assembled !== expected) throw new Error("CỔNG BYTE ĐỎ — lát host không ghép ra đúng stock lib/index.js");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.js"), assembled + EOL, "utf8");
  const worker = readdirSync(join(STOCK, "lib", "worker")).filter((f) => f.endsWith(".js"));
  for (const file of worker) {
    mkdirSync(join(outDir, "worker"), { recursive: true });
    copyFileSync(join(STOCK, "lib", "worker", file), join(outDir, "worker", file));
    if (!readFileSync(join(STOCK, "lib", "worker", file)).equals(readFileSync(join(outDir, "worker", file)))) throw new Error("worker lệch byte: " + file);
  }
  const shaIndex = createHash("sha256").update(readFileSync(join(outDir, "index.js"))).digest("hex");
  return "CỔNG BYTE ĐẠT · gbh-app-boot · index " + String(assembled.length + 1) + " B · sha256 " + shaIndex + " · worker " + String(worker.length) + " tệp";
}

if (import.meta.main) console.log(buildPackage(process.argv[2]));
