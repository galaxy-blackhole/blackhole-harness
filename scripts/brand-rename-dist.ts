/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc task-157: post-processor BRAND RENAME cho vỏ SPA dist (CSS + JS + index.html). Ghi ra dist RIÊNG của ta,
 *      KHÔNG sửa node_modules (chỉ đọc). Mỗi file có cổng NGƯỢC byte-identical + đếm số lần đổi.
 *      Chạy: bun run scripts/brand-rename-dist.ts [--write]
 */

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { applyBrandRename, countBrandRenames, reverseBrandRename } from "../packages/tools/brand-rename/src/index.ts";

/** Gốc repo. */
const REPO = join(import.meta.dir, "..");

/** Dist GỐC (chỉ đọc) của gói stock dist-only. */
const DIST_GOC = join(REPO, "apps", "host", "node_modules", "@deepseek-ai", "dsh-web-frontend", "dist");

/** Dist RIÊNG của ta (đích ghi) — không bao giờ ghi vào node_modules. */
const DIST_TA = join(REPO, "packages", "host", "host-frontend-static", "dist");

/** Đuôi tệp được xử lý: CSS/JS/HTML đều chứa định danh thương hiệu. */
const DUOI_XU_LY: readonly string[] = Object.freeze([".js", ".css", ".html"]);

/**
 * Liệt kê mọi tệp cần xử lý trong một cây thư mục (đệ quy).
 * Nhận: goc — thư mục gốc. Trả: đường dẫn tương đối của các tệp có đuôi trong DUOI_XU_LY.
 */
function lietKe(goc: string, tienTo = ""): string[] {
  const ra: string[] = [];
  for (const muc of readdirSync(join(goc, tienTo), { withFileTypes: true })) {
    const tuongDoi = tienTo === "" ? muc.name : tienTo + "/" + muc.name;
    if (muc.isDirectory()) ra.push(...lietKe(goc, tuongDoi));
    else if (DUOI_XU_LY.some((duoi) => muc.name.endsWith(duoi))) ra.push(tuongDoi);
  }
  return ra;
}

/**
 * Đổi tên MỘT tệp: áp bản đồ, đối chiếu NGƯỢC phải khớp byte gốc, trả số lần đổi.
 * Nhận: goc — văn bản gốc. Trả: văn bản đã đổi tên.
 * @throws khi đảo ngược KHÔNG khớp bản gốc (tức là đã đổi thứ khác ngoài tên).
 */
function doiTen(goc: string): string {
  const daDoi = applyBrandRename(goc);
  if (reverseBrandRename(daDoi) !== goc) throw new Error("brand-rename-dist: dao nguoc KHONG khop ⇒ da doi ca logic");
  return daDoi;
}

/**
 * Điểm vào: đọc dist gốc, (tuỳ chọn) ghi dist của ta đã đổi tên, in bảng đếm từng tệp.
 * Nhận: tham số dòng lệnh — `--write` để ghi thật, mặc định chỉ đo (dry-run).
 * Trả: không.
 */
function main(): void {
  const ghiThat = process.argv.includes("--write");
  if (!existsSync(DIST_GOC)) throw new Error("brand-rename-dist: khong thay dist goc " + DIST_GOC);
  const files = lietKe(DIST_GOC);
  let tong = 0;
  let soFileDoi = 0;
  const dong: string[] = [];
  for (const tuongDoi of files) {
    const goc = readFileSync(join(DIST_GOC, tuongDoi), "utf8");
    const dem = countBrandRenames(goc).reduce((acc, muc) => acc + muc.count, 0);
    if (dem === 0) continue;
    const daDoi = doiTen(goc);
    tong += dem;
    soFileDoi += 1;
    dong.push("  " + String(dem).padStart(5) + " × " + tuongDoi + " (" + String(goc.length) + " B)");
    if (ghiThat) {
      const dich = join(DIST_TA, tuongDoi);
      mkdirSync(join(dich, ".."), { recursive: true });
      writeFileSync(dich, daDoi);
    }
  }
  if (ghiThat) {
    // Sao chép phần còn lại (ảnh, font…) nguyên byte để dist của ta phục vụ được đầy đủ.
    cpSync(DIST_GOC, DIST_TA, { recursive: true, force: true });
    for (const tuongDoi of files) {
      const goc = readFileSync(join(DIST_GOC, tuongDoi), "utf8");
      writeFileSync(join(DIST_TA, tuongDoi), doiTen(goc));
    }
  }
  console.log(dong.join("\n"));
  console.log("TONG: " + String(tong) + " lan doi tren " + String(soFileDoi) + "/" + String(files.length) + " tep" + (ghiThat ? " → da ghi " + DIST_TA : " (dry-run, chua ghi)"));
}

main();
