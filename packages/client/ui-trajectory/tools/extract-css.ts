/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tách CSS NGUYÊN VĂN khỏi các lát của ui-trajectory: giữ nguyên từng byte, giữ hash lớp gốc
 *
 * Vì sao tách: bundle gốc nhúng CSS Modules dưới dạng chuỗi một dòng khổng lồ
 * (`const css$3 = ".Y0dWHa_split{…}"`). Tách ra file .module.css để đối chứng từng byte với bản gốc,
 * đồng thời thay chuỗi trong lát bằng một ĐIỂM THAY THẾ; build.ts đọc file .module.css và nhúng lại
 * nguyên văn — nên hash lớp (.Y0dWHa_*) không đổi.
 *
 * Cách dùng: bun run tools/extract-css.ts
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

/** Thư mục gốc của gói. */
const PKG = join(import.meta.dir, "..");
/** Thư mục các lát nguồn. */
const PARTS = join(PKG, "src", "parts");
/** Thư mục đích của CSS Modules. */
const STYLES = join(PKG, "src", "styles");

/** Khối header 5 dòng bắt buộc của repo, in vào mọi file CSS. */
const HEADER: readonly string[] = [
  "/**",
  " * author Bùi Trọng Hiếu",
  " * email kevinbui210191@gmail.com",
  " * create date 15/10/2026",
  " * modify date 18/10/2026",
  " * desc CSS NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-trajectory — giữ nguyên hash lớp",
  " */",
];

/** Một lần tách CSS: điểm thay thế trong lát ↔ file .module.css. */
export interface CssExtraction {
  /** Điểm thay thế xuất hiện trong lát nguồn. */
  readonly placeholder: string;
  /** Tên file .module.css (không kèm thư mục). */
  readonly file: string;
  /** Tên biến `css$N` trong bundle gốc. */
  readonly variable: string;
  /** SHA-256 của nội dung CSS nguyên văn, để test đối chứng lại với bundle gốc. */
  readonly sha256: string;
  /** Số byte của nội dung CSS nguyên văn. */
  readonly bytes: number;
}

/** Dòng khai báo CSS trong bundle gốc: `		const css$3 = "…";`. */
const CSS_LINE = /^\t\tconst (css(?:\$\d+)?) = ("(?:[^"\\]|\\.)*");$/;
/** Dòng mở vùng CSS của tsdown: `		//#region \0dsh-css:…<Tên>.module.css.mjs`. */
const CSS_REGION = /^\t\t\/\/#region \\0dsh-css:.*\/([A-Za-z0-9_.-]+)\.module\.css\.mjs$/;

/**
 * Tách CSS của mọi lát ra file .module.css và thay chuỗi trong lát bằng điểm thay thế.
 * @returns danh sách lần tách, theo thứ tự xuất hiện trong bundle.
 */
export function extractCss(): CssExtraction[] {
  mkdirSync(STYLES, { recursive: true });
  const found: CssExtraction[] = [];
  for (const name of readdirSync(PARTS).sort()) {
    if (!name.endsWith(".ts")) continue;
    const path = join(PARTS, name);
    const lines = readFileSync(path, "utf8").split("\n");
    let moduleName: string | null = null;
    let touched = false;
    for (let i = 0; i < lines.length; i++) {
      const region = CSS_REGION.exec(lines[i] as string);
      if (region !== null) {
        moduleName = region[1] as string;
        continue;
      }
      const decl = CSS_LINE.exec(lines[i] as string);
      if (decl === null) continue;
      if (moduleName === null) throw new Error("gặp CSS mà không biết tên module trong " + name + " dòng " + (i + 1));
      const cssText = JSON.parse(decl[2] as string) as string;
      // ⚠️ 18/10/2026: CHẶN TÁCH HAI LẦN. Điểm thay thế cũng là một chuỗi trong ngoặc kép nên khớp
      //   cùng khuôn; lượt chạy thứ hai đã nuốt luôn điểm thay thế và ghi đè file .module.css bằng
      //   41 byte rác. Gặp điểm thay thế thì DỪNG, không ghi gì.
      if (cssText.startsWith("__GBH_")) throw new Error("lát " + name + " đã được tách CSS rồi (dòng " + (i + 1) + ") — chạy lại tools/split-stock-bundle.ts trước");
      const file = moduleName + ".module.css";
      const placeholder = "__GBH_UI_TRAJECTORY_CSS_" + moduleName.replace(/\./g, "_") + "__";
      writeFileSync(join(STYLES, file), [...HEADER, cssText, ""].join("\n"));
      lines[i] = "\t\tconst " + (decl[1] as string) + " = " + JSON.stringify(placeholder) + ";";
      found.push({
        placeholder,
        file,
        variable: decl[1] as string,
        sha256: createHash("sha256").update(cssText, "utf8").digest("hex"),
        bytes: Buffer.byteLength(cssText, "utf8"),
      });
      touched = true;
    }
    if (touched) writeFileSync(path, lines.join("\n"));
  }
  return found;
}

if (import.meta.main) {
  const found = extractCss();
  console.log("đã tách " + found.length + " module CSS vào " + STYLES);
  for (const item of found) console.log("  " + item.file + " · " + item.bytes + " byte · " + item.sha256.slice(0, 16) + " · " + item.placeholder);
}
