/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hằng định danh của row ui-sidebar-files — một id module, hai tên slot và một slot con nguyên văn.
 */

/**
 * Tên package — cũng là id DUY NHẤT mà nửa browser đăng ký qua §window.__ModuleLoader__.load({id, factory})§.
 * Id gói gốc KHÔNG đăng ký trong bundle: nó thuộc §gbh.row.aliases§, tầng nạp tự phát entry alias dùng CÙNG URL.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-sidebar-files";

/**
 * Id STOCK của row bị thay.
 *
 * LUẬT MỘT-ID (docs/recipes/HOST-ROW-REWRITE.md §8): id này KHÔNG đăng ký trong bundle, KHÔNG nằm trong
 * §gbh.row.moduleIds§. Chỗ đúng của nó là §gbh.row.aliases§.
 */
export const STOCK_NAME = "@deepseek-ai/dsh-client-ui-sidebar-files";

/** Loại tab mà gói này sở hữu — nguyên văn từ bundle gốc (§kind: "files"§). */
export const FILES_KIND = "files";

/**
 * Id của bản cài đặt trong sổ kiểu tab, ĐỒNG THỜI là §key§ mà hai chỗ ngồi đăng ký dưới.
 *
 * ⚠️ Hai giá trị này PHẢI bằng nhau: sidebar phải tra chỗ ngồi theo §definition?.id ?? tab.kind§
 * (§entryKey§ trong TabSlot của ui-sidebar-right), nên lệch nhau là thân tab không bao giờ được gọi.
 */
export const FILES_ID = PACKAGE_NAME;

/** Namespace từ điển của gói — nguyên văn từ bundle gốc. */
export const NS = "sidebarFiles";

/** Id lệnh/phím tắt mở tab — nguyên văn từ bundle gốc; thẻ hướng dẫn trỏ tới cùng id này. */
export const SHORTCUT_ID = "workspace.files";

/** Tên slot thân tab (cây thư mục). Tên PHẢI viết literal tại chỗ đăng ký để §check:rows§ đọc được. */
export const SLOT_PANE_TAB = "sidebar.right.pane.tab";

/** Tên slot tiêu đề tab (chip) — nguyên văn từ bundle gốc. */
export const SLOT_PANE_TAB_TITLE = "sidebar.right.pane.tab.title";

/** Tên slot CON kiểu danh sách trong header thân tab — nguyên văn từ bundle gốc. */
export const SLOT_TAB_ACTIONS = "sidebar.right.tab.files.actions";
