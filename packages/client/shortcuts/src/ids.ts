/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hang so cua row shortcuts: ten package, ten bien cau hinh toan cuc, khoa luu trưng
 */

/**
 * Id module của GÓI GỐC — cũng được bundle đăng ký như một KHOÁ ALIAS trong CÙNG một lần thực thi.
 *
 * Vì sao cần: khi ta thay row, id stock **biến mất khỏi đồ thị** nhưng các entry stock khác (đo được nhiều
 * nhất là 50 row) vẫn `inject` đúng id đó ⇒ chúng treo `loading`/waiting. Đăng ký thêm id stock trong
 * chính bundle của ta làm id đó phân giải được. Một lần thực thi, một lần cài đặt: cờ chống cài hai lần
 * ở phạm vi MODULE lo phần đó (xem `plugin.ts` / `client.ts`).
 */
export const STOCK_MODULE_ID = "@deepseek-ai/dsh-client-shortcuts";

/** Tên package của ta — cũng là **id module** mà nửa browser tự khai. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-shortcuts";

/** Tên service mà nửa browser phơi cho 10 row khác (`ctx.shortcuts`). */
export const SERVICE_NAME = "shortcuts";

/** Biến toàn cục mà **nửa host** nhúng vào trang để chở cấu hình đã kiểm. */
export const CONFIG_GLOBAL = "__GBH_SHORTCUTS_CONFIG__";

/** Sự kiện của host để nhúng script cấu hình vào trang sản phẩm. */
export const INDEX_INJECT_EVENT = "webserver/index-inject";

/** Khoá localStorage theo profile trình duyệt + origin. */
// 18/10/2026 (task-38): khoá persist MỚI; khoá cũ dsh.keybindings.v1 chỉ còn trong bảng migration.
export const STORAGE_KEY = "gbh.keybindings.v1";

/** Thời gian mặc định giữa hai lần Escape liên tiếp (ms) — khớp schema của bản gốc. */
export const DEFAULT_STOP_SEQUENCE_MS = 500;

/** Cận trên của `stopSequenceMs` — khớp `.max(2147483646)` của bản gốc. */
export const MAX_STOP_SEQUENCE_MS = 2147483646;
