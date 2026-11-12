/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cắt bundle gốc @deepseek-ai/dsh-llm-deepseek thành các lát NGUYÊN VĂN (một lát một vùng region)
 */

/**
 * Vì sao cắt theo dấu vùng: bundle gốc do tsdown sinh còn nguyên dấu vùng của từng file nguồn upstream,
 * mỗi vùng là MỘT đơn vị cú pháp trọn vẹn ⇒ cắt ở đó không làm đứt câu lệnh, không cần vỏ bù ngoặc.
 *
 * BÀI HỌC ĐO ĐƯỢC (18/10/2026): bản đầu bỏ các DÒNG ĐÁNH DẤU VÙNG khi cắt ⇒ bản ghép THIẾU 946 byte so với
 * gốc (102.238 B vs 103.184 B). Nay lát giữ ĐÚNG NGUYÊN các dòng đánh dấu vùng và mọi dòng trống;
 * assemble.ts chỉ bỏ đúng 4 dòng giao kèo (header 5 dòng · dòng đánh dấu · dòng trống sau nó · dòng trống
 * trước + dòng export rỗng ở cuối), nên phần ghép lại TRÙNG TỪNG BYTE (build.ts DỪNG nếu lệch).
 *
 * Cách dùng: bun run tools/split-stock-bundle.ts <bundle-gốc> [thư-mục-đích]
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Ký tự xuống dòng (viết qua String.fromCharCode để không lẫn với văn bản). */
const EOL = String.fromCharCode(10);

/** Khối header 5 dòng bắt buộc — chèn vào đầu MỖI lát (bị gỡ khi ghép). */
const HEADER = [
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-llm-deepseek — sinh boi tools/split-stock-bundle.ts, khong sua tay",
  " */",
].join(EOL);

/** Dòng đánh dấu lát nguyên văn — assemble.ts bỏ đúng dòng này (và dòng trống ngay sau) khi ghép. */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS — assemble.ts bỏ dòng trống ngay trước nó cùng chính nó. */
export const MODULE_TAIL = "export {};";

/** Một lát: tên file + các dòng NGUYÊN VĂN (đã gồm cả dòng đánh dấu vùng và dòng trống). */
export interface Slice {
  /** Tên file (không gồm thư mục). */
  file: string;
  /** Các dòng nguyên văn lấy từ bundle gốc, giữ đúng thứ tự. */
  lines: string[];
}

/**
 * Cắt văn bản bundle thành các lát nguyên văn (chia HẾT mọi dòng, không bỏ dòng nào).
 * Nhận: source — nội dung bundle gốc.
 * Trả: danh sách lát theo ĐÚNG thứ tự xuất hiện (phần đầu · các vùng · phần đuôi).
 */
export function splitBundle(source: string): Slice[] {
  const lines = source.split(EOL);
  const slices: Slice[] = [];
  let current: string[] = [];
  let name = "";
  let index = 0;
  /** Đóng lát đang gom (nếu có) rồi ghi vào danh sách. */
  const flush = (): void => {
    if (current.length === 0) return;
    const suffix = name === "" ? (index === 0 ? "head" : "tail") : name;
    const fileName = "part-" + String(index).padStart(2, "0") + "-" + suffix + ".ts";
    slices.push({ file: fileName, lines: current });
    index += 1;
    current = [];
    name = "";
  };
  for (const line of lines) {
    const open = /^\/\/#region lib\/types\/(.+?)\.js$/u.exec(line);
    if (open !== null) {
      flush();
      name = String(open[1]).replace(/[^a-z0-9-]/gu, "-");
      current.push(line);
      continue;
    }
    if (line === "//#endregion") {
      current.push(line);
      flush();
      continue;
    }
    current.push(line);
  }
  flush();
  return slices;
}

/**
 * Dựng văn bản một file lát: header 5 dòng + dòng đánh dấu + dòng trống + thân nguyên văn + dòng trống + dòng kết thúc.
 * Nhận: slice — lát cần dựng.
 * Trả: nội dung file .ts.
 */
export function renderSlice(slice: Slice): string {
  return HEADER + EOL + SLICE_MARKER + EOL + EOL + slice.lines.join(EOL) + EOL + EOL + MODULE_TAIL + EOL;
}

if (import.meta.main) {
  const source = process.argv[2];
  if (source === undefined) throw new Error("thiếu đường dẫn bundle gốc");
  const outDir = process.argv[3] ?? join(import.meta.dir, "..", "src", "parts");
  const slices = splitBundle(readFileSync(source, "utf8"));
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const slice of slices) writeFileSync(join(outDir, slice.file), renderSlice(slice));
  console.log("cắt " + slices.length + " lát ⇒ " + outDir);
}
