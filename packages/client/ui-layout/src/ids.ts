/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang dinh danh cua row ui-layout: id MODULE, seam inject, ten o, nhan hieu ung va id phim tat
 */

/** Id MODULE chính — package của ta (bundle tự khai trong `__ModuleLoader__.load`). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-layout";

/** Id MODULE phụ — package gốc của DSH (bản gốc đăng ký ĐÚNG MỘT id, không có `chunk:`). */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-layout";

/** Namespace từ điển nhãn lệnh bàn phím do package này sở hữu. */
export const SHORTCUT_NS = "shortcuts.layout";

/** Namespace từ điển chung gắn vào ô `root`. */
export const ROOT_LOCALE_NS = "common";

/**
 * Seam của fiber — ĐÚNG BỐN mục như bản gốc (`const inject` trong bundle, dòng 589–594).
 * ⚠️ Khác với `dsh.client.inject` trong manifest (5 id): đây là danh sách service mà THÂN plugin cần.
 */
export const INJECT = ["slots", "theme", "locale", "shortcuts"] as const;

/** Id phím tắt mở/thu thanh bên. */
export const TOGGLE_SHORTCUT_ID = "sidebar.left.toggle";

/** Tên các ô: ô khung chiếm, và sáu ô con mà nó KHAI (khai = quyền render độc quyền). */
export const SLOT_NAMES = {
  /** Ô gốc của runtime — khung chiếm ô này. */
  root: "root",
  /** Cột trái (thanh bên chiếm). */
  sidebar: "sidebar",
  /** Panel giữa chọn theo id (khoá `conversation` là hội thoại). */
  main: "main",
  /** Cột phải. */
  rightbar: "rightbar",
  /** Dải đáy của vỏ. */
  shellBottom: "shell.bottom",
  /** Lớp phủ toàn khung (ô danh sách). */
  shellOverlay: "shell.overlay",
  /** Ghế nổi cho dải dẫn (macOS, khi thanh bên thu). */
  shellLeading: "shell.leading",
} as const;

/** Bảng `children` mà khung khai cho ô `root` — đúng thứ tự và đúng `kind`/`scope` bản gốc. */
export const ROOT_CHILDREN = {
  "sidebar": { kind: "single", scope: "root" },
  "main": { kind: "keyed", scope: "root" },
  "rightbar": { kind: "single", scope: "root" },
  "shell.bottom": { kind: "single", scope: "root" },
  "shell.overlay": { kind: "list", scope: "root" },
  "shell.leading": { kind: "single", scope: "root" },
} as const;

/** Nhãn hiệu ứng vòng đời — giữ nguyên chuỗi của bản gốc. */
export const EFFECT = {
  /** Đăng ký nhãn lệnh bàn phím. */
  commandLabels: "layout: command labels",
  /** Ghế store + đăng ký ô `root`. */
  service: "ui-layout: service + root registration",
  /** Ghế bộ chiếu theme. */
  themePresenter: "ui-layout: theme presenter",
} as const;

/** Sự kiện theme đổi. */
export const THEME_CHANGE_EVENT = "theme/change";

/** Id gắn vào `data-plugin-css` của thẻ style khung. */
export const STYLE_TAG = "@galaxy-blackhole/gbh-client-ui-layout/AppFrame.module.css";

/** Tiêu đề sản phẩm mà khung truyền xuống `DocumentTitle` (nguyên văn bản gốc). */
export const PRODUCT_TITLE = "Galaxy Blackhole";
