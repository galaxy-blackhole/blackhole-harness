/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Cơ chế GIAM ĐƯỜNG DẪN cho sandbox hệ tệp: đường chính tắc đi đường NHANH từ vựng, danh
 *      tính hệ tệp làm đường DỰ PHÒNG thận trọng cho các gốc tương đương bí danh (tên 8.3 và cách viết
 *      hoa/thường trên Windows) — bản viết lại của vùng "lib/types/containment.js" trong bundle gốc
 */

import type { BigIntStats } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, sep } from "node:path";

/** Mã lỗi "không tồn tại" mà phép dò tổ tiên coi là VẮNG MẶT (không ném). */
const MISSING_CODES = new Set(["ENOENT", "ENOTDIR"]);

/**
 * Nhận ra lỗi "đường dẫn không tồn tại" của `stat`.
 * Nhận: giá trị bắt được (`unknown`, có thể không phải Error).
 * Trả: `true` khi mã lỗi là ENOENT/ENOTDIR.
 */
function isMissing(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === "string" && MISSING_CODES.has(code);
}

/**
 * Dạng so sánh được của một đường dẫn: giữ nguyên hoa/thường khi hệ tệp phân biệt.
 * Nhận: đường dẫn và cờ phân biệt hoa/thường.
 * Trả: chuỗi dùng để so từ vựng.
 */
function comparablePath(path: string, caseSensitive: boolean): string {
  return caseSensitive ? path : path.toLowerCase();
}

/**
 * Phép so TỪ VỰNG nhanh: đích LÀ gốc hoặc nằm dưới gốc.
 * Nhận: đường dẫn đích, gốc, và cờ phân biệt hoa/thường.
 * Trả: `true` khi `path` bằng `root` hoặc bắt đầu bằng `root + sep`.
 */
function isLexicallyUnder(path: string, root: string, caseSensitive: boolean): boolean {
  const comparableTarget = comparablePath(path, caseSensitive);
  const comparableRoot = comparablePath(root, caseSensitive);
  if (comparableTarget === comparableRoot) return true;
  const prefix = comparableRoot.endsWith(sep) ? comparableRoot : comparableRoot + sep;
  return comparableTarget.startsWith(prefix);
}

/**
 * `stat` bigint nếu đường dẫn có mặt; lỗi khác "không tồn tại" đi thẳng ra ngoài.
 * Nhận: đường dẫn cần dò.
 * Trả: thông tin `stat` (bigint), hoặc `undefined` khi vắng mặt.
 */
async function statIfPresent(path: string): Promise<BigIntStats | undefined> {
  try {
    return await stat(path, { bigint: true });
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

/**
 * So DANH TÍNH hệ tệp của hai mục (cùng thiết bị + cùng inode).
 * Nhận: hai kết quả `stat` bigint.
 * Trả: `true` khi cả hai cùng một mục trên đĩa.
 */
function sameIdentity(left: BigIntStats, right: BigIntStats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

/**
 * Cho biết một đích chính tắc LÀ gốc ghi được hay nằm dưới gốc đó.
 * Đường từ vựng xử lý cách viết chính tắc thường gặp. Khi hai cách viết khác nhau, đi ngược các tổ tiên
 * CÓ THẬT của đích và so DANH TÍNH hệ tệp với gốc: nhờ vậy nhận ra bí danh tên dài/8.3 và cách viết
 * hoa/thường trên Windows mà KHÔNG nới phép giam thành một phép xấp xỉ văn bản.
 * Nhận: `path` — khoá đích chính tắc (có thể kết thúc bằng hậu tố chưa tồn tại); `root` — gốc ghi được
 * chính tắc; `caseSensitive` — phép so từ vựng có giữ hoa/thường không (mặc định theo hệ tệp của nền
 * tảng đang chạy).
 * Trả: `true` khi đích là chính gốc hoặc một hậu duệ của gốc.
 */
export async function isPathUnder(
  path: string,
  root: string,
  caseSensitive: boolean = process.platform !== "win32",
): Promise<boolean> {
  if (isLexicallyUnder(path, root, caseSensitive)) return true;
  const rootInfo = await statIfPresent(root);
  if (!rootInfo) return false;
  let ancestor = path;
  while (true) {
    const ancestorInfo = await statIfPresent(ancestor);
    if (ancestorInfo && sameIdentity(ancestorInfo, rootInfo)) return true;
    const parent = dirname(ancestor);
    if (parent === ancestor) return false;
    ancestor = parent;
  }
}
