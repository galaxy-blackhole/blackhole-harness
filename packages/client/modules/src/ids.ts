/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hang so dinh danh cua package: ten goi la khoa dang ky bundle trong window.__ModuleLoader__
 */

/**
 * Ten package nay — cung la id ma nua browser dang ky qua window.__ModuleLoader__.load({id, factory}),
 * va la id cua row bootstrap trong dong thi __GBH_BOOT__. Node va browser PHAI dung chung mot hang so
 * nay: HTML tra cuu dung dong dang ky do theo id, lech mot ky tu la ca trang khong boot duoc.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-modules";

/**
 * Tên global DUY NHẤT mang đồ thị boot trên trang (task-31 → task-137).
 * 19/10/2026: alias `__GBH_BOOT__` đã BỎ HẲN (Lead duyệt, mục tiêu 0 chuỗi DSH trong HTML) ⇒ host CHỈ phát tên này;
 * mọi công cụ đo (tools/check/boot-global.ts) và shell đọc đúng tên này.
 */
export const BOOT_GLOBAL = "__GBH_BOOT__";

/**
 * Tên global CŨ của bản gốc DSH — GIỮ HẰNG nhưng KHÔNG còn được phát ra HTML.
 * Chỉ dùng để công cụ đo (`tools/check/boot-global.ts` — hằng cùng tên ở đó = `__DSH_BOOT__`) đọc được
 * app/fixture CŨ khi so với bản stock.
 * 08/11/2026 (review): trước đây hằng này bị chép TRÙNG giá trị với {@link BOOT_GLOBAL} ⇒ hằng CHẾT,
 * phép đo global cũ vô hiệu. Nay trả lại đúng giá trị cũ.
 */
export const BOOT_GLOBAL_LEGACY = "__DSH_BOOT__";

/**
 * Id STOCK của row bị thay. Bundle **KHÔNG đăng ký nó** (mục §8: một id); id này khai trong
 * `gbh.row.aliases` để tầng nạp phát entry alias trỏ về chính URL bundle của gói này.
 * Nhờ vậy entry id stock (host phát thêm) phân giải được mà bundle KHÔNG chạy lần thứ hai.
 */
export const STOCK_NAME = "@deepseek-ai/dsh-client-modules";