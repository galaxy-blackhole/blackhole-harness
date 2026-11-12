/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Diem vao nua browser cua row ui-reference: dang ky MOT id module (id cua ta) voi factory cua plugin
 */

import { PACKAGE_NAME } from "./ids.ts";
import { createPlugin, type RequireFn } from "./plugin.ts";

/** Bảng module của trang: CHỈ id truyền vào `load()` mới vào bảng module. */
const loader = (globalThis as unknown as {
  __ModuleLoader__: { load(registration: { id: string; factory: (require: RequireFn) => unknown }): void };
}).__ModuleLoader__;

// id CHÍNH = tên package của ta (cũng là id mà bundle TỰ KHAI — bảng module khoá theo id này, còn Loader
// import theo tên package mà row trỏ tới; lệch nhau là 'import failed' và UI chết).
// KHÔNG đăng ký id stock: đo được 0 bundle nào require id đó (xem README mục 4).
loader.load({ id: PACKAGE_NAME, factory: createPlugin });

/** Đánh dấu file này là MODULE (tránh chế độ script toàn cục làm đụng tên với package client khác). */
export {};
