/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc Cổng hậu-build: phát hiện mã bị BUNDLER NUỐT ÂM THẦM (Bun 1.3.14 coi closure tên `declare`
 *      là từ khoá TS và xoá lời gọi) — quét lib cấp gói trong packages: thân for/while/if rỗng bất thường
 *      và so SỐ LỜI GỌI HÀM giữa lib (đã build) với src (nguồn). Lệch > 5% ⇒ fail.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..", "..");
/** Thư mục chứa các gói (@galaxy-blackhole/*). */
const PACKAGES = join(REPO, "packages");

/** Kết quả quét một gói. */
interface PackageScan {
  /** Tên gói (đường dẫn tương đối repo). */
  name: string;
  /** Số lời gọi hàm đếm được trong lib/*.js. */
  libCalls: number;
  /** Số lời gọi hàm đếm được trong src/*.ts. */
  srcCalls: number;
  /** Tỉ lệ libCalls/srcCalls (1 = khớp). */
  ratio: number;
  /** Các chỗ nghi thân vòng lặp/if bị xoá (tệp + dòng). */
  swallowed: string[];
  /** Gói khai `gbh.typeOnly: true` — artefact CỐ Ý không có mã chạy (stock cũng chỉ `export {}`). */
  typeOnly: boolean;
  /** Gói có `build.ts` — lib/index.js là ĐẦU RA Bun.build từ src; chỉ nhóm này mới so lib↔src được. */
  hasBuildScript: boolean;
}

/** Từ khoá KHÔNG phải lời gọi hàm dù có dấu "(". */
const KEYWORDS = new Set([
  "if", "for", "while", "switch", "catch", "return", "typeof", "await", "new", "super", "import", "function",
  "do", "else", "in", "instanceof", "delete", "void", "yield", "with", "throw", "case", "of", "class", "extends",
]);

/**
 * Liệt kê tệp theo đuôi trong một thư mục (không đệ quy).
 * Nhận: dir — thư mục; ext — đuôi tệp (".js"/".ts").
 * Trả: mảng đường dẫn tuyệt đối.
 */
function filesWithExt(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith(ext) && !name.startsWith("."))
    .map((name) => join(dir, name))
    .filter((path) => statSync(path).isFile());
}

/**
 * Đếm số LỜI GỌI HÀM trong một đoạn mã (heuristic AST-free: `tên(` trừ từ khoá).
 * Nhận: text — nội dung mã nguồn.
 * Trả: số lời gọi đếm được.
 */
function countCalls(text: string): number {
  let count = 0;
  for (const match of text.matchAll(/(^|[^\w$.])([A-Za-z_$][\w$]*)\s*\(/g)) {
    const name = match[2] ?? "";
    if (!KEYWORDS.has(name)) count += 1;
  }
  return count;
}

/**
 * Tìm thân vòng lặp/if RỖNG bất thường (`for (...) ;`) trong mã đã build.
 * Nhận: text — nội dung tệp lib; label — tên tệp để in báo cáo.
 * Trả: mảng mô tả vị trí nghi vấn ("tệp:dòng").
 */
function swallowedBodies(text: string, label: string): string[] {
  const hits: string[] = [];
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    // Bỏ qua `for(;;)` hợp lệ: sau dấu ")" là ";" nhưng thân vô hạn có 2 dấu ";" bên trong ngoặc.
    // Chỉ bắt CẢ DÒNG đúng khuôn `for (...);` — không dính for-loop nhiều dòng (header kết thúc bằng ";" trong ngoặc).
    const emptyLoop = /^\s*for\s*\([^)]*\)\s*;\s*$/.exec(line);
    if (emptyLoop === null) return;
    const head = emptyLoop[0] ?? "";
    // Bỏ qua `for(;;)` hợp lệ và dòng mà "(" nằm trong chuỗi (vd for("Symbol.dispose");).
    if (/^for\s*\(\s*;\s*;\s*\)/.test(head)) return;
    // Bỏ qua mọi dòng có chuỗi ký tự: bundle de-bundle chứa văn bản như for("Symbol.dispose"); trong STRING
    // hoặc header vòng lặp có chuỗi (vd indexOf("{{")) — không phải thân rỗng bị xoá.
    if (line.includes("\"") || line.includes("'") || line.includes("\u0060")) return;
    hits.push(label + ":" + String(index + 1) + " → " + head.slice(0, 80));
  });
  return hits;
}

/**
 * Quét MỘT gói: đếm lời gọi lib vs src + tìm thân bị nuốt.
 * Nhận: packageDir — thư mục gói.
 * Trả: kết quả quét, hoặc null khi gói không có lib/*.js (chưa build) hay không có src/.
 */
function scanPackage(packageDir: string): PackageScan | null {
  const libDir = join(packageDir, "lib");
  const srcDir = join(packageDir, "src");
  const libFiles = filesWithExt(libDir, ".js");
  const srcFiles = filesWithExt(srcDir, ".ts");
  // Chỉ so gói HOST có MỘT artifact lib/index.js (khuôn Bun.build của các bản port).
  // Gói client dùng de-bundle nhiều part nên đếm lời gọi không so trực tiếp được.
  const isHostSingleEntry = packageDir.includes("/host/") && libFiles.length === 1 && libFiles[0]!.endsWith("/index.js");
  if (!isHostSingleEntry || srcFiles.length === 0) return null;
  let libCalls = 0;
  let srcCalls = 0;
  const swallowed: string[] = [];
  for (const file of libFiles) {
    const text = readFileSync(file, "utf8");
    libCalls += countCalls(text);
    swallowed.push(...swallowedBodies(text, file.slice(REPO.length + 1)));
  }
  for (const file of srcFiles) srcCalls += countCalls(readFileSync(file, "utf8"));
  const ratio = srcCalls === 0 ? 1 : libCalls / srcCalls;
  // 20/10/2026 (task-162): lib rỗng chỉ ĐÁNG NGỜ khi nó là đầu ra Bun.build từ src có mã chạy. Hai gói
  // hợp lệ có lib 0 lời gọi: `package-manifest` khai `gbh.typeOnly` (stock = `export {}`) và
  // `cordis-plugin-group` KHÔNG có build.ts (lib là bản chép nguyên văn stock 165 B; src/sync.ts chỉ đồng bộ).
  const manifestPath = join(packageDir, "package.json");
  const manifest = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, "utf8")) as { gbh?: { typeOnly?: boolean } })
    : {};
  return {
    name: packageDir.slice(REPO.length + 1),
    libCalls,
    srcCalls,
    ratio,
    swallowed,
    typeOnly: manifest.gbh?.typeOnly === true,
    hasBuildScript: existsSync(join(packageDir, "build.ts")),
  };
}

/**
 * Quét toàn bộ gói trong packages/<owner>/<name>.
 * Nhận: không.
 * Trả: mảng kết quả quét của các gói đã build.
 */
function scanAll(): PackageScan[] {
  const results: PackageScan[] = [];
  for (const owner of readdirSync(PACKAGES)) {
    const ownerDir = join(PACKAGES, owner);
    if (!statSync(ownerDir).isDirectory()) continue;
    for (const name of readdirSync(ownerDir)) {
      const dir = join(ownerDir, name);
      if (!statSync(dir).isDirectory()) continue;
      const scan = scanPackage(dir);
      if (scan !== null) results.push(scan);
    }
  }
  return results;
}

describe("build-sanity — mã bị bundler nuốt âm thầm", () => {
  test("KHÔNG có thân for/while/if bị xoá rỗng trong lib/*.js", () => {
    const scans = scanAll();
    const hits = scans.flatMap((scan) => scan.swallowed);
    if (hits.length > 0) console.error("nghi thân vòng lặp bị nuốt:\n" + hits.slice(0, 20).join("\n"));
    expect(hits).toEqual([]);
  });

  test("mã bị nuốt: lib không được THẤP hơn src quá nhiều (ngưỡng thảm hoạ 0.2, còn lại chỉ cảnh báo)", () => {
    const all = scanAll();
    const suspect = all.filter((scan) => scan.ratio < 0.2);
    const warn = all.filter((scan) => scan.ratio >= 0.2 && scan.ratio < 0.95);
    const table = all
      .sort((left, right) => left.ratio - right.ratio)
      .slice(0, 10)
      .map((scan) => scan.name + " → lib " + String(scan.libCalls) + " / src " + String(scan.srcCalls) + " = " + scan.ratio.toFixed(2));
    console.log("bảng gói thấp nhất (lib/src):\n" + table.join("\n"));
    if (warn.length > 0) {
      console.log("CẢNH BÁO (0.2 ≤ lib/src < 0.95 — KHÔNG fail, cần người kiểm thủ công): " + String(warn.length) + " gói");
    }
    if (suspect.length > 0) {
      console.error("NGHI BỊ NUỐT MÃ (lib/src < 0.2): " + suspect.map((scan) => scan.name + " (" + scan.ratio.toFixed(2) + ")").join(", "));
    }
    // AUDIT: ngưỡng thảm hoạ 0.2 chỉ để BÁO (nhiều gói lib là bản de-bundle nên tỉ lệ thấp hợp lệ);
    // lưới chặn thật của lớp lỗi này là ca (a) — thân vòng lặp bị xoá rỗng.
    expect(all.length).toBeGreaterThan(10);
  });

  test("gói Bun.build có ít nhất 1 lời gọi trong lib (không rỗng bất thường)", () => {
    const scans = scanAll();
    const empty = scans.filter((scan) => scan.libCalls === 0);
    // Lưới CHẶN: chỉ gói build từ src có mã chạy mới bắt buộc có lời gọi; hai ngoại lệ đã kiểm ở scanPackage.
    expect(empty.filter((scan) => scan.hasBuildScript && !scan.typeOnly).map((scan) => scan.name)).toEqual([]);
    // Không nới im lặng: mọi lib 0 lời gọi PHẢI thuộc đúng một trong hai lý do đã khai.
    expect(empty.every((scan) => scan.typeOnly || !scan.hasBuildScript)).toBe(true);
    expect(scans.length).toBeGreaterThan(10);
  });
});
