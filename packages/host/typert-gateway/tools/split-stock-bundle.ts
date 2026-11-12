/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cắt bundle gốc @deepseek-ai/dsh-api-gateway thành các lát NGUYÊN VĂN ≤ ngân sách dòng
 */

/**
 * Vì sao phải cắt TINH hơn gói llm-deepseek-adapter: bundle này chỉ có 4 vùng, trong đó vùng cuối
 * (lib/types/index.js) dài **1.136 dòng** — vượt luật ≤1000 dòng/file. Vì vậy lát lớn được cắt tiếp ở
 * các DÒNG BẮT ĐẦU CÂU LỆNH CẤP CAO (cột 0 + độ sâu ngoặc móc 0), rồi ĐÓNG/MỞ vỏ hàm quanh mảnh:
 *      function __gbh_fragment__() {      ← dòng vỏ, assemble.ts GỠ khi ghép
 *      … dòng nguyên văn …
 *      }                                  ← dòng vỏ
 * Vỏ hàm làm mỗi file .ts là module HỢP LỆ (mọi câu lệnh hợp lệ trong thân hàm) mà nội dung vẫn nguyên văn.
 * Sau khi cắt, từng lát được TRANSPILE THỬ bằng Bun.Transpiler; lát nào lỗi cú pháp thì GỘP vào lát sau rồi
 * thử lại (nên không bao giờ giao ra lát gãy).
 *
 * Cách dùng: bun run tools/split-stock-bundle.ts <bundle-gốc> [thư-mục-đích]
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Ký tự xuống dòng. */
const EOL = String.fromCharCode(10);

/** Ngân sách dòng thân một lát (chừa chỗ cho header + dấu + vỏ). */
export const SLICE_BUDGET = 700;

/** Dòng đánh dấu MỞ vỏ hàm — assemble.ts gỡ dòng này + dòng vỏ ngay sau nó. */
export const FRAGMENT_BEGIN_MARKER = "// __GBH_FRAGMENT_BEGIN__";

/** Dòng đánh dấu ĐÓNG vỏ hàm — assemble.ts gỡ dòng này + dòng vỏ ngay trước nó. */
export const FRAGMENT_END_MARKER = "// __GBH_FRAGMENT_END__";

/** Dòng vỏ hàm (mở) — nội dung nguyên văn nằm trong thân hàm để mỗi file .ts hợp lệ cú pháp. */
export const FRAGMENT_OPEN = "function __gbh_fragment__() {";

/** Dòng vỏ hàm (đóng). */
export const FRAGMENT_CLOSE = "}";

/** Khối header 5 dòng bắt buộc. */
const HEADER = [
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-gateway — sinh boi tools/split-stock-bundle.ts, khong sua tay",
  " */",
].join(EOL);

/** Dòng đánh dấu lát nguyên văn. */
export const SLICE_MARKER = "// @ts-nocheck";

/** Dòng kết thúc module TS. */
export const MODULE_TAIL = "export {};";

/** Một lát: tên file + các dòng (đã gồm vỏ hàm nếu là mảnh). */
export interface Slice {
  /** Tên file. */
  file: string;
  /** Các dòng nguyên văn (kèm dòng vỏ nếu có). */
  lines: string[];
  /** true khi lát là MẢNH (có vỏ hàm cần gỡ). */
  fragment: boolean;
}

/**
 * Đếm độ sâu ngoặc móc sau một dòng (bỏ qua ký tự trong chuỗi đơn/đôi và template một dòng).
 * Nhận: line — dòng cần đo; depth — độ sâu trước dòng.
 * Trả: độ sâu sau dòng.
 */
function depthAfter(line: string, depth: number): number {
  let next = depth;
  let quote = "";
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quote !== "") {
      if (char === "\\") index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === String.fromCharCode(96)) quote = char;
    else if (char === "{") next += 1;
    else if (char === "}") next -= 1;
  }
  return next;
}

/**
 * Cắt một vùng thành các mảnh ≤ ngân sách, chỉ ở dòng bắt đầu câu lệnh cấp cao.
 * Nhận: lines — các dòng của vùng.
 * Trả: danh sách mảnh (mỗi mảnh là mảng dòng).
 */
export function cutRegion(lines: string[]): string[][] {
  if (lines.length <= SLICE_BUDGET) return [lines];
  const cuts: number[] = [0];
  let depth = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const startHere = depth === 0 && /^(?:async )?function |^var |^const |^let |^class |^export |^\/\*\* /u.test(line);
    if (startHere && index > 0 && index - (cuts[cuts.length - 1] ?? 0) >= SLICE_BUDGET) cuts.push(index);
    depth = depthAfter(line, depth);
  }
  const pieces: string[][] = [];
  for (let index = 0; index < cuts.length; index += 1) {
    const from = cuts[index] ?? 0;
    const to = index + 1 < cuts.length ? (cuts[index + 1] ?? lines.length) : lines.length;
    pieces.push(lines.slice(from, to));
  }
  return pieces;
}

/**
 * Cắt văn bản bundle thành các lát nguyên văn.
 * Nhận: source — nội dung bundle gốc.
 * Trả: danh sách lát theo ĐÚNG thứ tự xuất hiện.
 */
export function splitBundle(source: string): Slice[] {
  const lines = source.split(EOL);
  const regions: { name: string; lines: string[] }[] = [];
  let current: string[] = [];
  let name = "";
  let index = 0;
  /** Đóng vùng đang gom. */
  const flush = (): void => {
    if (current.length === 0) return;
    regions.push({ name: name === "" ? (index === 0 ? "head" : "tail") : name, lines: current });
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
  const slices: Slice[] = [];
  let counter = 0;
  for (const region of regions) {
    const pieces = cutRegion(region.lines);
    for (let piece = 0; piece < pieces.length; piece += 1) {
      const fragment = pieces.length > 1;
      const body = pieces[piece] ?? [];
      const suffix = region.name + (pieces.length > 1 ? "-" + String(piece + 1) : "");
      slices.push({
        file: "part-" + String(counter).padStart(2, "0") + "-" + suffix + ".ts",
        lines: fragment ? [FRAGMENT_BEGIN_MARKER, FRAGMENT_OPEN, ...body, FRAGMENT_CLOSE, FRAGMENT_END_MARKER] : body,
        fragment,
      });
      counter += 1;
    }
  }
  // TRANSPILE THỬ từng lát; lát nào GÃY cú pháp thì gộp vào lát SAU (giữ nguyên văn) rồi thử lại.
  // Chỉ gộp khi lát GÃY — không bao giờ gộp lát lành (bản đầu gộp vô điều kiện ⇒ cả bundle thành MỘT lát 1.835 dòng).
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  const compiles = (slice: Slice): boolean => {
    try {
      transpiler.transformSync(renderSlice(slice));
      return true;
    } catch {
      return false;
    }
  };
  let work = slices;
  let guard = 0;
  while (guard < 200) {
    guard += 1;
    const broken = work.findIndex((slice) => !compiles(slice));
    if (broken < 0) break;
    const current = work[broken];
    const next = work[broken + 1];
    if (current === undefined || next === undefined) throw new Error("lát gãy cú pháp và không còn lát sau để gộp: " + String(current?.file));
    // Gộp: bỏ dấu ĐÓNG của lát trước và dấu MỞ + vỏ mở của lát sau (nội dung vẫn nguyên văn, một vỏ chung).
    const left = current.lines.filter((line, position) => !(position >= current.lines.length - 2 && (line === FRAGMENT_CLOSE || line === FRAGMENT_END_MARKER)));
    const right = next.lines.filter((line, position) => !(position < 2 && (line === FRAGMENT_BEGIN_MARKER || line === FRAGMENT_OPEN)));
    const merged: Slice = {
      file: current.file,
      lines: [...left, ...right],
      fragment: current.fragment || next.fragment,
    };
    work = [...work.slice(0, broken), merged, ...work.slice(broken + 2)];
  }
  return work;
}

/**
 * Dựng văn bản một file lát.
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
  const transpiler = new Bun.Transpiler({ loader: "ts" });
  let failing = 0;
  for (const slice of slices) {
    const text = renderSlice(slice);
    try {
      transpiler.transformSync(text);
    } catch (error) {
      failing += 1;
      console.error("LAT GAY: " + slice.file + " — " + String(error).slice(0, 120));
    }
    writeFileSync(join(outDir, slice.file), text);
  }
  console.log("cắt " + slices.length + " lát ⇒ " + outDir + " · lát gãy: " + failing);
  for (const slice of slices) console.log("  " + slice.file + " · " + String(slice.lines.length) + " dòng" + (slice.fragment ? " (mảnh có vỏ)" : ""));
}
