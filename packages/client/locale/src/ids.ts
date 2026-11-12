/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hang so dinh danh + schema cua row locale (giu nguyen gia tri cua ban goc)
 */

/**
 * Id module của GÓI GỐC — cũng được bundle đăng ký như một KHOÁ ALIAS trong CÙNG một lần thực thi.
 *
 * Vì sao cần: khi ta thay row, id stock **biến mất khỏi đồ thị** nhưng các entry stock khác (đo được nhiều
 * nhất là 50 row) vẫn `inject` đúng id đó ⇒ chúng treo `loading`/waiting. Đăng ký thêm id stock trong
 * chính bundle của ta làm id đó phân giải được. Một lần thực thi, một lần cài đặt: cờ chống cài hai lần
 * ở phạm vi MODULE lo phần đó (xem `plugin.ts` / `client.ts`).
 */
export const STOCK_MODULE_ID = "@deepseek-ai/dsh-client-locale";

/** Tên package của ta — cũng là **id module** mà bundle tự khai. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-locale";

/** Namespace cài đặt do plugin này sở hữu (dùng chung với nửa host). */
export const LOCALE_SETTINGS_NAMESPACE = "locale";

/** Trường mang lựa chọn ngôn ngữ tường minh; vắng mặt thì nhường cho trình duyệt. */
export const LOCALE_PREFERENCE_FIELD = "preference";

/** Mẫu id ngôn ngữ kiểu BCP 47. */
export const LOCALE_ID_PATTERN = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/u;

/** Các ngôn ngữ mà nửa browser phát. vi thêm 18/10/2026 theo yêu cầu chủ dự án. */
export const LOCALE_IDS: readonly string[] = ["vi", "en"];

/** Namespace dùng chung cho chữ ở tầng vỏ. */
export const COMMON_NS = "common";

/** Namespace của chính mục cài đặt này. */
export const SETTINGS_NS = "settings.locale";

/** Ngôn ngữ dự phòng cuối cùng. */
export const FALLBACK_LOCALE = "en";
