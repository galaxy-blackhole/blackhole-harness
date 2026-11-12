/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Diem vao nua browser cua row locale: dang ky MOT id module (id cua ta) voi factory cua plugin
 */

import { PACKAGE_NAME } from "./ids.ts";
import { createPlugin, type RequireFn } from "./plugin.ts";

/** Bảng module của trang: CHỈ id truyền vào `load()` mới vào bảng module. */
const loader = (globalThis as unknown as {
  __ModuleLoader__: { load(registration: { id: string; factory: (require: RequireFn) => unknown }): void };
}).__ModuleLoader__;

// id CHÍNH = tên package của ta (cũng là id mà bundle TỰ KHAI; khai thêm ở `gbh.row.moduleIds` để cổng
// mount kiểm được — khuôn này lấy id qua hằng nên phép quét văn bản của cổng không thấy).
// KHÔNG đăng ký id stock: đo được 0 bundle nào require id đó (xem README mục 4).
loader.load({ id: PACKAGE_NAME, factory: createPlugin });
// một bundle, và cờ ở phạm vi MODULE bảo đảm plugin chỉ được cài MỘT lần.

/** Đánh dấu file này là MODULE (tránh chế độ script toàn cục làm đụng tên với package client khác). */
export {};
