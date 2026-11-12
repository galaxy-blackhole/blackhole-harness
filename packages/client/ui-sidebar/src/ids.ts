/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang dinh danh cua row ui-sidebar: id MODULE, ten slot, nhan hieu ung va hai hang so thoi gian
 */

/**
 * Id MODULE chính — package của ta. Bundle tự khai id này trong `__ModuleLoader__.load`, nên đây là
 * dòng mà manifest của Host trỏ tới và là `ownerId` để HMR tra `rev` (và gỡ style đã chèn).
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-sidebar";

/**
 * Id MODULE phụ — package gốc của DSH. Bản gốc đăng ký ĐÚNG MỘT id module (không có `chunk:`), nên bản
 * viết lại đăng ký hai id (của ta + stock) bằng cùng một factory.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-sidebar";

/** Namespace từ điển do package này sở hữu. */
export const NS = "sidebar";

/** Seam mà fiber của sidebar cần, đúng thứ tự như bản gốc. */
export const INJECT = ["slots", "layout", "uiWorkspace", "locale", "shortcuts"] as const;

/**
 * Tên các slot mà row này ĐĂNG KÝ hoặc PHỤC VỤ (ghi thẳng bằng chuỗi tại chỗ đăng ký — xem plugin.ts).
 * Chỉ `sidebar` và `shell.leading` là lời gọi `slots.register`; bảy tên còn lại là slot con khai trong
 * `children` nên KHÔNG phải id module và cũng không phải lời gọi đăng ký riêng.
 */
export const SLOTS = {
  /** Cột sidebar trong lưới của layout. */
  sidebar: "sidebar",
  /** Ghế window-chrome khi sidebar thu hẳn (macOS). */
  shellLeading: "shell.leading",
  /** Ô con: biểu tượng thương hiệu khi cột mở. */
  brandMark: "sidebar.brand.mark",
  /** Ô con: tên thương hiệu cạnh biểu tượng. */
  brandName: "sidebar.brand.name",
  /** Ô con: huy hiệu trên nút mở sidebar (rail). */
  toggleBadge: "sidebar.toggle.badge",
  /** Ô con (list): biểu tượng cho từng panel toàn cục. */
  panellist: "sidebar.panellist",
  /** Ô con: vùng duyệt workspace/phiên (do ui-workspace đăng ký). */
  workspaces: "sidebar.workspaces",
  /** Ô con: ghế Settings ở chân cột (do ui-settings đăng ký). */
  settings: "sidebar.settings",
  /** Ô con (list): hành động tuỳ chọn cạnh Settings. */
  footerAction: "sidebar.footer.action",
} as const;

/** Nhãn hiệu ứng vòng đời — giữ nguyên chuỗi của bản gốc để log/chẩn đoán đối chiếu được. */
export const EFFECT = {
  /** Đăng ký hai bản dịch. */
  dictionaries: "ui-sidebar: dictionaries",
  /** Theo dõi danh sách biểu tượng panel. */
  panelEntries: "ui-sidebar: panel entries",
  /** Cập nhật nhãn panel khi ngôn ngữ đổi. */
  panelLabels: "ui-sidebar: panel labels",
} as const;

/** Id phím tắt mở/đóng sidebar — dùng để tra nhãn và tổ hợp phím trong tooltip. */
export const TOGGLE_SHORTCUT_ID = "sidebar.left.toggle";

/** Id phím tắt tạo phiên mới. */
export const NEW_SESSION_SHORTCUT_ID = "session.new";

/** Hai panel được đếm analytics khi người dùng bấm (giữ nguyên như bản gốc). */
export const TRACKED_PANELS: Readonly<Record<string, string>> = { plugins: "plugin", schedules: "cron" };

/**
 * Thời gian chờ nội dung rộng tháo ra sau khi cột bắt đầu thu — khớp nhịp mờ 150ms của CSS.
 * Thu gọn là một cú trượt kèm mờ chéo: nội dung giữ nguyên bề rộng cũ rồi mờ dần tại chỗ.
 */
export const COLLAPSE_SETTLE_MS = 150;

/**
 * Thời gian thanh cuộn của cột còn được vẽ sau khi con trỏ rời khỏi cột. Thanh cuộn ở đây là tín hiệu
 * của con trỏ; ẩn ngay lúc `pointerleave` sẽ làm nó nhấp nháy khi con trỏ chỉ đi ngang qua mép cột.
 */
export const SCROLLBAR_LINGER_MS = 2000;

/**
 * Huy hiệu bản build cục bộ in trong cột sidebar. Bản gốc in HẰNG SỐ này lúc build; ta cũng vậy, nhưng
 * cho phép `build.ts` ghi đè bằng `GBH_SIDEBAR_BUILD_TAG` khi nâng runtime.
 */
export const LOCAL_BUILD_TAG = "0.2.1-alpha.4-cc6a8f5";
