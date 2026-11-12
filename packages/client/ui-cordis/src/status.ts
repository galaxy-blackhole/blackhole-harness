/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Suy ra trạng thái hiển thị của một Package từ inventory của Host và tập gói client đã nạp trong trang — port 1:1 vùng #region status.js
 */

import type { CordisDynamicPackageId, DynamicCordisInventoryRow, DynamicCordisLivePackage } from "./events.ts";

/** Ba cách đọc vòng đời mà sản phẩm nhìn thấy. */
export type CordisVisibleStatus = "idle" | "client-pending" | "running";

/**
 * Tìm một Package bất biến trong một dòng Plugin.
 * Nhận: row — dòng inventory sở hữu; packageId — id Package bất biến cần tìm.
 * Trả: siêu dữ liệu Package khớp, hoặc `undefined` khi không có.
 */
export function packageOf(
  row: DynamicCordisInventoryRow,
  packageId: CordisDynamicPackageId,
): DynamicCordisInventoryRow["packages"][number] | undefined {
  return row.packages.find((pkg) => pkg.packageId === packageId);
}

/**
 * Suy ra trạng thái hiển thị của một Package.
 * Nhận: row — dòng inventory sở hữu; packageId — Package đang được mô tả; loaded — các lần nạp client trong trang.
 * Trả: `idle` (chưa chạy), `client-pending` (Host đã chạy, client chưa nạp) hoặc `running` (đủ hai nửa).
 */
export function cordisVisibleStatus(
  row: DynamicCordisInventoryRow,
  packageId: CordisDynamicPackageId,
  loaded: readonly DynamicCordisLivePackage[],
): CordisVisibleStatus {
  const run = row.activeRun;
  if (run === undefined || run.packageId !== packageId) return "idle";
  if (packageOf(row, packageId)?.hasClientHalf !== true) return "running";
  return loaded.some(
    (live) => live.pluginId === row.pluginId && live.packageId === packageId && live.pluginRunId === run.pluginRunId,
  )
    ? "running"
    : "client-pending";
}
