/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Chon trinh phan tich theo ten tep, giu ngoai chunk bang tinh nang
 */

import { ExcelPreviewError } from "./error.ts";

/**
 * Giai mot ten tep da dang ky thanh trinh phan tich cua no.
 * Nhan: path — duong dan tep da giai ma.
 * Tra: hau to duoc ho tro; ten tep khong ho tro thi nem.
 */
export function excelFormat(path: string): string {
  const suffix = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (suffix === "xlsx" || suffix === "xls" || suffix === "csv" || suffix === "tsv") return suffix;
  throw new ExcelPreviewError("invalid");
}
