/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hằng định danh của package — khoá đăng ký bundle trong window.__ModuleLoader__.
 */

/**
 * Tên package — cũng là id DUY NHẤT mà nửa browser đăng ký qua §window.__ModuleLoader__.load({id, factory})§.
 * Node và browser phải dùng chung một hằng số: lệch một ký tự là entry của row không vật chất hoá được.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-attachment";

/**
 * Id STOCK của row bị thay.
 *
 * LUẬT MỘT-ID (đo 17/10/2026, docs/recipes/HOST-ROW-REWRITE.md §8): id này KHÔNG được đăng ký trong bundle và
 * KHÔNG nằm trong §gbh.row.moduleIds§. Chỗ đúng của nó là §gbh.row.aliases§ — tầng nạp phát entry alias dùng
 * CÙNG URL (một bundle ⇒ một plugin), còn nửa browser trả bản sao có §apply§ no-op cho id alias.
 * Khai nó ở hai chỗ là dạng khai cũ gây "entry thứ hai cho cùng bundle".
 */
export const STOCK_NAME = "@deepseek-ai/dsh-client-ui-attachment";
