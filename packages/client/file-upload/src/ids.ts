/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hằng số định danh của package (khoá đăng ký bundle trong window.__ModuleLoader__)
 */

/**
 * Tên package — cũng là id DUY NHẤT mà nửa browser đăng ký.
 * Id gốc `@deepseek-ai/dsh-client-file-upload` KHÔNG đăng ký trong bundle: nó nằm ở `gbh.row.aliases`
 * (tầng nạp phát entry alias cùng URL) vì `dsh-api-remotes` mang TYPERT_REMOTE trỏ tới id đó và 3 entry
 * khác vẫn inject nó — đo được ngày 18/10/2026, xem README gói §6.5.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-file-upload";
