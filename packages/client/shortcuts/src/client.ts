/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Diem vao nua browser cua row shortcuts: dang ky MOT id module voi factory tra ve LOP SERVICE
 */

import { PACKAGE_NAME } from "./ids.ts";
import { createShortcutsService, type ServiceConstructor } from "./client/service.ts";
import { installClientStore, type ClientStoreSeam } from "./client/registry.ts";
import type { PrimitivesSeam } from "./client/dom.ts";

/** `require` do bảng module cấp cho factory (lazy-CJS, hợp đồng C2). */
export type RequireFn = (specifier: string) => unknown;

/** Bảng module của trang: CHỈ id truyền vào `load()` mới vào bảng module. */
const loader = (globalThis as unknown as {
  __ModuleLoader__: { load(registration: { id: string; factory: (require: RequireFn) => unknown }): void };
}).__ModuleLoader__;

/**
 * Factory của nửa browser: lấy seam từ bảng module rồi trả về **lớp service**.
 * Bản gốc cũng `module.exports = ShortcutsService` (một lớp cordis Service), nên Loader nhận lớp này
 * và tự `ctx.plugin(...)` — KHÔNG phải một bề mặt `{ apply, inject }`.
 * Nhận: `requireFn` — hàm require của bảng module.
 * Trả: lớp service `shortcuts`.
 */
// ⚠️ KHÔNG chặn ở TẦNG FACTORY (bài học 17/10/2026, tm-parity chỉ ra và Lead đã sửa chỉ đạo):
// hai ENTRY (id của ta + id alias) là **hai fiber ⇒ hai ctx KHÁC nhau**, và **cả hai đều hợp lệ**. Nếu
// factory trả **plugin RỖNG** cho lần gọi thứ hai thì entry alias **không bao giờ activate** — tức ta tự
// gây ra đúng cái triệu chứng đang sửa. Ở thời điểm factory **chưa có `ctx`**, nên mọi phán quyết "đã cài
// rồi" ở đây đều không thể đúng. Bản sửa GỐC (aliasView của tm-client) đã làm entry alias **không tạo
// plugin instance thứ hai**, nên chỗ này chỉ cần trả **plugin THẬT** như bản gốc.
const factory = (requireFn: RequireFn): unknown => {
  const store = requireFn("@galaxy-blackhole/gbh-client-store") as ClientStoreSeam;
  installClientStore(store);
  return createShortcutsService({
    Service: (requireFn("@deepseek-ai/cordis") as { Service: ServiceConstructor }).Service,
    store,
    primitives: requireFn("@galaxy-blackhole/gbh-client-ui-primitives") as PrimitivesSeam,
    window,
    document,
    navigator,
  });
};

// id CHÍNH = tên package của ta (cũng là id mà bundle TỰ KHAI; khai thêm ở `gbh.row.moduleIds`).
// KHÔNG đăng ký id stock: đo được 0 bundle nào require id đó (xem README mục 4).
loader.load({ id: PACKAGE_NAME, factory });
// một bundle, và cờ ở phạm vi MODULE bảo đảm service chỉ được cài MỘT lần.

/** Đánh dấu file này là MODULE (tránh chế độ script toàn cục làm đụng tên với package client khác). */
export {};
