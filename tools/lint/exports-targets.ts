/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc Cong dich exports: MOI dich literal trong package.json > exports phai TRO TOI TEP CO THAT.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createResult, isDirectRun, printResult, REPO_ROOT, toRel, type CheckResult } from "./shared.ts";

/** Tầng chứa gói GBH (mỗi tầng là một thư mục con của packages/). */
const CAC_TANG = ["host", "client", "tools"];

/** Đích literal trong exports đã phân giải được hay chưa, kèm lý do khi hỏng. */
interface DichHong {
  goi: string;
  khoa: string;
  dich: string;
}

/**
 * Liệt kê mọi đích literal của một giá trị exports (bỏ qua pattern chứa "*").
 * Nhận: giá trị exports (chuỗi, mảng hoặc object điều kiện). Trả: mảng đường dẫn tương đối.
 * @param giaTri - giá trị exports của một khoá hoặc của cả trường exports.
 * @returns danh sách đích literal cần kiểm tồn tại.
 */
function lietKeDich(giaTri: unknown): string[] {
  if (typeof giaTri === "string") return giaTri.includes("*") ? [] : [giaTri];
  if (Array.isArray(giaTri)) return giaTri.flatMap((v) => lietKeDich(v));
  if (giaTri && typeof giaTri === "object") return Object.values(giaTri as Record<string, unknown>).flatMap((v) => lietKeDich(v));
  return [];
}

/**
 * Quét toàn bộ gói trong packages/ và tìm đích exports trỏ tới tệp không tồn tại.
 * Nhận: không. Trả: kết quả cổng kèm danh sách vi phạm (mỗi vi phạm là "gói > khoá > đích").
 * @returns kết quả kiểm để gate in ra và tính mã thoát.
 */
export function runExportsTargetsCheck(): CheckResult {
  const hong: DichHong[] = [];
  let soGoi = 0;
  let soDich = 0;
  for (const tang of CAC_TANG) {
    const goc = join(REPO_ROOT, "packages", tang);
    if (!existsSync(goc)) continue;
    for (const ten of readdirSync(goc)) {
      const pj = join(goc, ten, "package.json");
      if (!existsSync(pj)) continue;
      let meta: Record<string, unknown>;
      try {
        meta = JSON.parse(readFileSync(pj, "utf8")) as Record<string, unknown>;
      } catch {
        continue;
      }
      const exports = meta.exports;
      if (!exports || typeof exports !== "object") continue;
      soGoi += 1;
      for (const [khoa, giaTri] of Object.entries(exports as Record<string, unknown>)) {
        for (const dich of lietKeDich(giaTri)) {
          soDich += 1;
          if (!existsSync(join(goc, ten, dich.replace(/^\.\//u, "")))) {
            hong.push({ goi: tang + "/" + ten, khoa, dich });
          }
        }
      }
    }
  }
  const lines = hong.map((h) => ({
    file: toRel(join(REPO_ROOT, "packages", h.goi, "package.json")),
    line: 1,
    message: "exports[" + h.khoa + "] -> " + h.dich + " (khong ton tai)",
  }));
  // 08/11/2026: `createResult` chi nhan TEN cong; ket qua duoc gan o noi goi (xem tools/lint/gate.ts).
  const ketQua = createResult("exports-targets");
  ketQua.checked = hong.length;
  ketQua.violations = hong.map((h) => ({
    file: toRel(join(REPO_ROOT, "packages", h.goi, "package.json")),
    line: 0,
    message: "exports[" + h.khoa + "] -> " + h.dich + " (khong ton tai)",
  }));
  return ketQua;
}

if (isDirectRun(import.meta.url)) {
  const ketQua = runExportsTargetsCheck();
  printResult(ketQua);
  process.exit(ketQua.violations.length === 0 ? 0 : 1);
}