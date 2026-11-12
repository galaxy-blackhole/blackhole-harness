/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cắt bundle gốc của row ui-chat thành các lát nguồn ≤ ngưỡng dòng, giữ nguyên từng byte
 *
 * Nguồn đối chiếu (CHỈ ĐỌC): apps/host/node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js
 * Cách dùng: bun run tools/split-stock-bundle.ts <đường-dẫn-bundle> [thư-mục-đích]
 *
 * Vì sao cắt theo `//#region`: bundle gốc do tsdown sinh ra còn nguyên dấu vùng của từng file
 * nguồn upstream, nên mỗi vùng là một đơn vị cú pháp trọn vẹn — cắt ở đó không làm đứt câu lệnh.
 */

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Ngưỡng dòng cho phần thân của một lát (chừa chỗ cho header 5 dòng + @ts-nocheck). */
export const PART_LINE_BUDGET = 940;

/** Khối header 5 dòng bắt buộc của repo, in vào mọi lát để bản cắt cũng tự khai nguồn. */
const HEADER: readonly string[] = [
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js (xem tools/split-stock-bundle.ts)",
  " */",
];

/** Một vùng nguồn trong bundle gốc. */
interface Region {
  /** Tên vùng, ví dụ `lib/types/client/chat/ChatView.js`. */
  readonly name: string;
  /** Các dòng nguyên văn của vùng, kể cả hai dòng đánh dấu `//#region` / `//#endregion`. */
  readonly lines: readonly string[];
}

/**
 * Cắt nội dung bundle thành các vùng theo dấu `//#region` / `//#endregion` của tsdown.
 * @param lines - toàn bộ dòng của bundle gốc.
 * @returns danh sách vùng theo đúng thứ tự xuất hiện.
 */
export function splitRegions(lines: readonly string[]): Region[] {
  const regions: Region[] = [];
  let current: { name: string; lines: string[] } | null = null;
  for (const line of lines) {
    const open = /^\t\t\/\/#region (.*)$/.exec(line);
    if (open !== null) {
      current = { name: open[1] as string, lines: [line] };
      regions.push(current);
      continue;
    }
    if (/^\t\t\/\/#endregion\s*$/.test(line)) {
      current?.lines.push(line);
      current = null;
      continue;
    }
    current?.lines.push(line);
  }
  return regions;
}

/**
 * Tìm chỗ cắt an toàn bên trong một vùng quá dài: đầu một câu lệnh ở cấp cao nhất.
 * Ba mức thut lui, dùng mức sau khi mức trước không tìm được chỗ nào.
 * @param lines - các dòng của vùng.
 * @param from - chỉ số bắt đầu tìm (0-based).
 * @returns chỉ số cắt, hoặc -1 khi không tìm được chỗ nào.
 */
export function safeCut(lines: readonly string[], from: number): number {
  const topLevel = (line: string): boolean => /^\t\t(?:const|let|var|function|class|async function|\/\*\*)/.test(line);
  const scan = (predicate: (index: number) => boolean): number => {
    for (let i = from; i < lines.length; i++) if (predicate(i)) return i;
    return -1;
  };
  // Muc 1: dau cau lenh cap cao nhat ngay sau mot dong trong.
  const afterBlank = scan((i) => topLevel(lines[i] as string) && (lines[i - 1] ?? "").trim() === "");
  if (afterBlank > 0) return afterBlank;
  // Muc 2: bat ky dau cau lenh cap cao nhat nao.
  const anyTopLevel = scan((i) => topLevel(lines[i] as string));
  if (anyTopLevel > 0) return anyTopLevel;
  // Muc 3: bat ky dong trong nao (khong the cat giua mot bieu thuc nhieu dong).
  return scan((i) => (lines[i] ?? "").trim() === "");
}

/**
 * Gom các vùng thành các lát ≤ ngân sách dòng, chỉ cắt thêm khi một vùng tự nó đã quá dài.
 * Bất biến: mọi lát trả về đều ≤ budget dòng — bước 1 cắt vùng dài thành mảnh ≤ budget,
 * bước 2 ghép tham lam các mảnh nhưng không bao giờ vượt budget.
 * @param regions - danh sách vùng theo thứ tự.
 * @param budget - số dòng tối đa cho phần thân một lát.
 * @returns mảng các lát, mỗi lát là mảng dòng nguyên văn.
 */
export function packParts(regions: readonly Region[], budget: number): string[][] {
  const pieces: string[][] = [];
  for (const region of regions) {
    let rest = [...region.lines];
    while (rest.length > budget) {
      let cut = safeCut(rest, Math.floor(budget * 0.75));
      if (cut <= 0) cut = budget;
      pieces.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    pieces.push(rest);
  }
  const parts: string[][] = [];
  let current: string[] = [];
  for (const piece of pieces) {
    if (current.length + piece.length > budget) {
      if (current.length > 0) parts.push(current);
      current = [];
    }
    current.push(...piece);
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

/**
 * Sinh các file lát vào thư mục đích.
 * @param bundlePath - đường dẫn bundle gốc.
 * @param outDir - thư mục chứa các lát.
 * @returns danh sách tên file đã ghi, theo thứ tự ghép.
 */
export function writeParts(bundlePath: string, outDir: string): string[] {
  const lines = readFileSync(bundlePath, "utf8").split("\n");
  const firstRegion = lines.findIndex((line) => /^\t\t\/\/#region /.test(line));
  const lastEnd = lines.reduce((acc, line, index) => (/^\t\t\/\/#endregion\s*$/.test(line) ? index : acc), -1);
  const regions = splitRegions(lines.slice(firstRegion, lastEnd + 1));
  const parts = packParts(regions, PART_LINE_BUDGET);
  // CHI xoa cac lat do chinh ham nay sinh (part-NN.ts): ba lat viet tay cua goi
  // (runtime-deps.ts · stock-exports.ts · plugin-surface.ts) PHAI song sot qua moi lan cat lai.
  mkdirSync(outDir, { recursive: true });
  for (const name of readdirSync(outDir)) {
    if (!/^part-\d\d\.ts$/.test(name)) continue;
    rmSync(join(outDir, name), { force: true });
  }
  const written: string[] = [];
  parts.forEach((part, index) => {
    const name = "part-" + String(index + 1).padStart(2, "0") + ".ts";
    const body = [
      ...HEADER,
      "// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.",
      "",
      ...part,
      "",
      // Giữ file ở chế độ MODULE của TS để các khai báo cấp cao nhất không rơi vào phạm vi toàn cục;
      // build.ts bỏ đúng dòng này khi ghép lát vào thân bundle.
      "export {};",
      "",
    ].join("\n");
    writeFileSync(join(outDir, name), body);
    written.push(name);
  });
  return written;
}

if (import.meta.main) {
  const bundle = process.argv[2];
  if (bundle === undefined) throw new Error("thiếu đường dẫn bundle gốc");
  const outDir = process.argv[3] ?? join(import.meta.dir, "..", "src", "parts");
  const written = writeParts(bundle, outDir);
  console.log("đã ghi " + written.length + " lát vào " + outDir);
  for (const name of written) console.log("  " + name + " · " + readFileSync(join(outDir, name), "utf8").split("\n").length + " dòng");
}
