/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hằng số định danh của row ui-plugin-market — một id module, một slot nguyên văn, một namespace từ điển
 */

/**
 * Tên package của TA — id DUY NHẤT mà bundle được phép đăng ký.
 * Bundle tự khai id này bằng window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phát ra) — KHÔNG khai id của gói gốc: nó thuộc gbh.row.aliases và tầng nạp
 * TỰ sinh entry alias trỏ về cùng URL bundle. Một bundle MỘT id.
 * Nhận: không có.
 * Trả: chuỗi tên package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-plugin-market";

/**
 * Tên package GỐC của DSH — CHỈ được khai ở gbh.row.aliases, KHÔNG bao giờ đăng ký trong bundle.
 * Nhận: không có.
 * Trả: chuỗi tên package gốc.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-plugin-market";

/**
 * Tên slot mà tab này chiếm — nguyên văn từ bundle gốc: "plugins.tab", slot LIST của trang Plugins.
 * Nhận: không có.
 * Trả: chuỗi tên slot.
 */
export const SLOT_NAME = "plugins.tab";

/**
 * Id occupant của tab trong slot LIST — nguyên văn từ bundle gốc: id "discover".
 * ⚠️ Slot LIST BẮT BUỘC có id: thiếu nó thì seam ném "list slot … requires options.id" ⇒ apply ném ⇒ trang chết.
 * Nhận: không có.
 * Trả: chuỗi id occupant.
 */
export const SLOT_OCCUPANT_ID = "discover";

/**
 * Namespace từ điển do row này sở hữu — nguyên văn từ bundle gốc: const NS = "pluginMarket".
 * Nhận: không có.
 * Trả: chuỗi namespace.
 */
export const NS = "pluginMarket";

/**
 * Dịch vụ mà bản gốc khai trong inject (cordis fiber) — giữ nguyên thứ tự và tên.
 * Nhận: không có.
 * Trả: mảng tên dịch vụ.
 */
export const INJECT = ["slots", "locale", "remote", "remote.pluginMarket"];
