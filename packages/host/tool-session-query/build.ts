/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Build tool-session-query: lib/index.js = 8 lát NGUYÊN VĂN ghép lại (byte-identical bundle gốc, cổng byte)
 *      + chép cây lib/types của bản gốc + khai báo kiểu lib/index.d.ts (gói MỘT MẶT, không có default export)
 */

import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
// 05/11/2026 (P1b): artefact phải mang id GBH — dùng denTa DÙNG CHUNG theo gbh.provenance.stock (runbook bước 1).
import { denTa } from "../../../tools/lib/id-normalize.ts";
import { join } from "node:path";

import { assembleBundle } from "./src/assemble.ts";
import { OUT_FILE_NAME, STOCK_BUNDLE } from "./src/manifest.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..", "..");

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/**
 * Băm SHA-256 một chuỗi.
 * Nhận: text — nội dung cần băm.
 * Trả: chuỗi hex.
 */
function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Tìm chỉ số BYTE đầu tiên mà hai văn bản khác nhau.
 * Nhận: left — bản ghép của ta; right — bundle gốc.
 * Trả: chỉ số byte lệch đầu tiên, hoặc -1 khi hai bên trùng nhau hoàn toàn.
 */
function firstDiff(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) if (left[index] !== right[index]) return index;
  return left.length === right.length ? -1 : limit;
}

/**
 * Build gói MỘT MẶT: (a) ghép các lát rồi ĐỐI CHIẾU TỪNG BYTE với bundle gốc ⇒ lib/index.js;
 * (b) chép cây lib/types của bản gốc; (c) sinh lib/index.d.ts trỏ vào cây kiểu vừa chép.
 * Nhận: outDir — thư mục đích (mặc định: lib cạnh gói).
 * Trả: đường dẫn artefact chính (lib/index.js).
 */
export async function buildPackage(outDir?: string): Promise<string> {
  const out = outDir ?? join(import.meta.dir, "lib");
  const assembled = assembleBundle();
  const stock = readFileSync(join(REPO, STOCK_BUNDLE), "utf8");
  if (assembled !== stock) {
    throw new Error(
      "ban ghep KHONG trung bundle goc: assembled " + assembled.length + " B / sha " + sha256(assembled).slice(0, 12) +
        " · stock " + stock.length + " B / sha " + sha256(stock).slice(0, 12) + " · lech dau tien o byte " + String(firstDiff(assembled, stock)),
    );
  }
  mkdirSync(out, { recursive: true });
  const file = join(out, OUT_FILE_NAME);
  writeFileSync(file, denTa(typeof assembled === "string" ? assembled : Buffer.from(assembled).toString("utf8")));
  // Cây khai báo KIỂU của bản gốc — chép nguyên trạng để consumer giữ ĐÚNG kiểu, không phải viết lại bằng tay.
  const stockTypes = join(REPO, STOCK_BUNDLE.replace(/lib\/index\.js$/u, "lib/types"));
  if (!existsSync(stockTypes)) throw new Error("thieu cay kieu cua ban goc: " + stockTypes);
  cpSync(stockTypes, join(out, "types"), { recursive: true });
  // Gói MỘT MẶT: bản gốc KHÔNG có default export ⇒ tuyệt đối không thêm dòng default vào đây.
  writeFileSync(join(out, "index.d.ts"), 'export * from "./types/index.js";' + EOL);
  return file;
}

if (import.meta.main) {
  console.log("built " + (await buildPackage(process.argv[2])) + " (byte-identical bundle gốc) + lib/types + lib/index.d.ts");
}
