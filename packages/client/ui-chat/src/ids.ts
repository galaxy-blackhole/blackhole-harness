/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hằng định danh của row ui-chat: một id module, một id gốc (chỉ khai ở aliases), namespace từ điển
 */

/**
 * Tên package của ta — id DUY NHẤT mà bundle được phép đăng ký.
 * Bundle tự khai id này bằng window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phát ra) — KHÔNG khai id của gói gốc: nó thuộc gbh.row.aliases và tầng nạp
 * TỰ sinh entry alias trỏ về cùng URL bundle. Một bundle MỘT id.
 * Nhận: không có.
 * Trả: chuỗi tên package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-chat";

/**
 * Tên package GỐC của DSH — CHỈ được khai ở gbh.row.aliases, KHÔNG bao giờ load() trong bundle.
 * Nhận: không có.
 * Trả: chuỗi tên package gốc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-chat";

/**
 * Namespace từ điển mà row này sở hữu — nguyên văn bản gốc (ctx.locale.register(NS, { zh, en })).
 * Nhận: không có.
 * Trả: chuỗi namespace.
 */
export const NS = "ui-chat";

/**
 * Thư mục chứa các lát nguồn của nửa client (so với gốc package).
 * Nhận: không có.
 * Trả: đường dẫn tương đối.
 */
export const PARTS_DIR = "src/parts";

/**
 * Tiền tố tên file lát; build.ts ghép theo thứ tự tên đã sắp xếp.
 * Nhận: không có.
 * Trả: chuỗi tiền tố.
 */
export const PART_PREFIX = "part-";

/**
 * Tiền tố id thẻ CSS của bản gốc — nguyên văn, để <style data-plugin-css> trùng khớp bản gốc từng byte.
 * Nhận: không có.
 * Trả: chuỗi tiền tố.
 */
export const CSS_TAG_PREFIX = STOCK_PACKAGE_NAME + "/";
