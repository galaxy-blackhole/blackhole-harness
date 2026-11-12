/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Nửa host của gói settings-about: RỖNG (gói thuần browser, không đụng kernel).
 */

/** Tên plugin phía host — chỉ để Loader nạp được, không làm gì. */
export const name = "@galaxy-blackhole/gbh-client-settings-about";

/**
 * Không làm gì ở phía host: toàn bộ tác dụng nằm ở `dsh.client` (nửa browser).
 * Bản gốc của mọi row `ui-settings-*` cũng export đúng một hàm rỗng như vậy.
 * @returns không.
 */
export function apply(): void {}

