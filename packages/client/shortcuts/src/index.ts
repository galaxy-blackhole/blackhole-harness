/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Nua host cua row shortcuts: nhung cau hinh da kiem vao trang san pham
 */

import { CONFIG_GLOBAL, INDEX_INJECT_EVENT } from "./ids.ts";
import type { Config } from "./config.ts";

// Bề mặt package: bản gốc export `Config` và `apply` ở gốc gói — thiếu là `check:rows` báo "thiếu export".
export { Config } from "./config.ts";

/** Một dòng chèn vào trang. */
export interface InjectEntry {
  /** Loại chèn (`global` = biến toàn cục). */
  readonly kind: "global";
  /** Tên biến toàn cục. */
  readonly name: string;
  /** Giá trị nhúng. */
  readonly value: unknown;
}

/** Context host (chỉ seam mà row này dùng). */
export interface HostContext {
  /**
   * Theo dõi một sự kiện của host.
   * Nhận: `event` — tên sự kiện, `listener` — người nhận bảng chèn.
   * Trả: hàm gỡ (nếu seam có).
   */
  on(event: string, listener: (table: InjectEntry[]) => void): unknown;
}

/**
 * Nhúng cấu hình bàn phím đã kiểm vào trang sản phẩm.
 * Nhận: `ctx` — context host phục vụ trang, `config` — thời gian chuỗi được dùng khi trang tải.
 * Trả: không.
 */
export function apply(ctx: HostContext, config: Config): void {
  ctx.on(INDEX_INJECT_EVENT, (table) => {
    table.push({ kind: "global", name: CONFIG_GLOBAL, value: config });
  });
}
