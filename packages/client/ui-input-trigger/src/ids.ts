/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Hằng định danh của row ui-input-trigger: một id module (id của TA), namespace từ điển,
 *   tên/id/thứ tự slot overlay, nhãn hiệu ứng và các hằng của menu. Id gói GỐC nằm ở src/ids-stock.ts
 *   (chỉ test/host dùng) — nửa client không import tệp đó nên artifact 0 lần id stock
 */

/**
 * Tên package của ta — id DUY NHẤT mà bundle client được phép đăng ký.
 * Bundle tự khai id này bằng window.__ModuleLoader__.load({ id: PACKAGE_NAME, factory }) trong artifact
 * lib/client.js (do build.ts phát ra) — KHÔNG khai id của gói gốc: nó thuộc gbh.row.aliases và tầng nạp
 * TỰ sinh entry alias trỏ về cùng URL bundle. Một bundle MỘT id.
 * Nhận: không có.
 * Trả: chuỗi tên package.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-input-trigger";

/**
 * Namespace từ điển của menu ứng viên — nguyên văn bản gốc (ctx.locale.register("slash.menu", { zh, en })).
 * Nhận: không có.
 * Trả: chuỗi namespace.
 */
export const MENU_NS = "slash.menu";

/**
 * Tên slot NGUYÊN VĂN mà row này chiếm — slot overlay của ô nhập hội thoại.
 * Nhận: không có.
 * Trả: chuỗi tên slot.
 */
export const MENU_SLOT_NAME = "conversation.input.overlay";

/**
 * Id NGƯỜI NGỒI (occupant) của slot overlay — nguyên văn "slash-menu" của bản gốc.
 * Nhận: không có.
 * Trả: chuỗi id người ngồi.
 */
export const MENU_SLOT_ID = "slash-menu";

/**
 * Thứ tự người ngồi trong slot overlay — nguyên văn của bản gốc (order: 0).
 * Nhận: không có.
 * Trả: số thứ tự.
 */
export const MENU_SLOT_ORDER = 0;

/**
 * Nhãn hiệu ứng đăng ký từ điển — nguyên văn chuỗi của bản gốc (dùng cho log vòng đời cordis).
 * Nhận: không có.
 * Trả: chuỗi nhãn.
 */
export const MENU_DICTIONARIES_EFFECT = "ui-input-trigger: menu dictionaries";

/**
 * Nhãn hiệu ứng gỡ controller theo phạm vi phiên — nguyên văn chuỗi của bản gốc.
 * Nhận: không có.
 * Trả: chuỗi nhãn.
 */
export const SESSION_CONTROLLER_EFFECT = "slash: session controller";

/**
 * Tên service mà plugin đăng ký trên context gốc — nguyên văn "inputTriggers" (ctx.inputTriggers).
 * Nhận: không có.
 * Trả: chuỗi tên service.
 */
export const SERVICE_NAME = "inputTriggers";

/**
 * Tên service phiên mà InputTriggerService lấy qua ctx.get("sessions") — nguyên văn.
 * Nhận: không có.
 * Trả: chuỗi tên service.
 */
export const SESSIONS_SERVICE = "sessions";

/**
 * Id thẻ <style> của TA: package CỦA TA + "/MenuView.module.css".
 * Bản gốc dùng tên gói gốc; luật MỘT-ID của Lead (19/10/2026) đòi id stock = 0 trong artifact nên ta đổi
 * tiền tố sang PACKAGE_NAME. Chuỗi CSS và tên lớp đã băm (_3e4SsG_*) vẫn NGUYÊN VĂN nên giao diện không đổi.
 * Nhận: không có.
 * Trả: chuỗi id thẻ style.
 */
export const CSS_TAG_ID = PACKAGE_NAME + "/MenuView.module.css";

/**
 * Tiền tố DOM id của một dòng ứng viên (đích của aria-activedescendant) — nguyên văn bản gốc.
 * Nhận: không có.
 * Trả: chuỗi tiền tố.
 */
export const OPTION_ID_PREFIX = "dsh-slash-option-";

/**
 * Chiều cao tối đa của menu (px) — nguyên văn bản gốc: vừa hai tiêu đề và tám dòng lệnh dựng sẵn.
 * Nhận: không có.
 * Trả: số pixel.
 */
export const MAX_MENU_HEIGHT = 400;

/**
 * Lề trên (px) mà menu phải né: khối 76px của tiêu đề hội thoại (ui-conversation) + 8px thở — nguyên văn.
 * Nhận: không có.
 * Trả: số pixel.
 */
export const MENU_TOP_MARGIN = 84;
