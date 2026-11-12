/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Bảng định danh của gói attachment-local: id gói của ta + id gói gốc DSH mà row của ta thay thế.
 */

/** Id gói của Galaxy Blackhole — tên row vẫn là id gốc do tầng mount quyết định, KHÔNG khai ở đây. */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-attachment-local";

/** Id gói gốc DSH (@deepseek-ai/dsh-attachment-local) — dùng khi cần đối chiếu/ghi log, KHÔNG đăng ký trong bundle. */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-attachment-local";
