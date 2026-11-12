/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hang so dinh danh cua package (khoa dang ky bundle trong window.__ModuleLoader__)
 */

/**
 * Tên package — cũng là id mà nửa browser đăng ký qua §window.__ModuleLoader__.load({id, factory})§.
 * Node và browser phải dùng chung một hằng số: lệch một ký tự là entry của row không vạt chất hoá được.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-resources";

/**
 * Id STOCK của row bị thay — bundle đăng ký CẢ HAI id trong MỘT lần thực thi (một factory).
 * Nhờ vậy entry id stock (host phát thêm) phân giải được mà bundle KHÔNG chạy lần thứ hai.
 */
export const STOCK_NAME = "@deepseek-ai/dsh-client-resources";
