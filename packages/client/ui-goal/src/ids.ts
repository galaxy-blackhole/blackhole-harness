/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang dinh danh cua row ui-goal: id MODULE, ten slot, ten su kien va cac nhan hieu ung
 */

/**
 * Id MODULE chính — package của ta. Bundle tự khai id này trong `__ModuleLoader__.load`, nên đây là
 * dòng mà manifest của Host trỏ tới và là `ownerId` để HMR tra `rev`.
 */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-goal";

/**
 * Id MODULE phụ — package gốc của DSH. Bản gốc đăng ký ĐÚNG MỘT id module (không có `chunk:`), nên bản
 * viết lại đăng ký hai id bằng cùng một factory.
 */
export const STOCK_PACKAGE_NAME = "@deepseek-ai/dsh-client-ui-goal";

/** Namespace từ điển do package này sở hữu. */
export const NS = "goal";

/** Seam mà fiber của GoalBar cần, đúng thứ tự như bản gốc. */
export const INJECT = ["slots", "sessions", "remote", "remote.goals", "locale", "uiConversation"] as const;

/** Tên khoá đăng ký của các slot mà row này chiếm. */
export const SLOT_KEYS = {
  /** Ô chip lệnh trong cây văn bản người dùng. */
  userTextNode: "command",
  /** Ô xem trước lệnh trong cây hội thoại. */
  chatNode: "command-input",
} as const;

/** Id occupant của dải GoalBar trong dock soạn tin. */
export const DOCK_ID = "goal";

/** Thứ tự occupant trong dock. */
export const DOCK_ORDER = 10;

/** Ưu tiên của rule nhận diện chip lệnh trong văn bản người dùng. */
export const USER_TEXT_RULE_PRIORITY = 100;

/** Thứ tự của rule trong sổ rule văn bản người dùng. */
export const USER_TEXT_RULE_ORDER = 20;

/** Tên lệnh mà row này sở hữu phần chiếu (`/goal`). */
export const GOAL_COMMAND = "goal";

/** Sự kiện Remote báo quá trình kích hoạt của goal đổi. */
export const ACTIVATION_EVENT = "goal/activation-changed";

/** Sự kiện kết nối được đặt lại — nguồn kích hoạt phải đọc lại. */
export const RESET_EVENT = "connection/reset";

/** Nguồn tham chiếu phiên mà lần đọc kích hoạt giữ phiên sống qua (`SessionReferenceSourceMap`). */
export const ACTIVATION_REFERENCE_SOURCE = "goalActivation";

/** Nhãn hiệu ứng vòng đời — giữ nguyên chuỗi của bản gốc. */
export const EFFECT = {
  /** Đăng ký hai bản dịch. */
  dictionaries: "ui-goal: dictionaries",
} as const;

/** Mã lỗi cục bộ khi phiên chưa chiếu ra goal nào (không gọi wire). */
export const NO_CURRENT_GOAL = {
  /** Mã lỗi. */
  code: "no-current-goal",
  /** Câu mô tả. */
  message: "no current goal to mutate",
} as const;

/** Khoá nhãn theo pha hiển thị; goal `complete` không render gì. */
export const PHASE_LABELS: Readonly<Record<"active" | "paused" | "blocked", string>> = {
  /** Đang chạy. */
  active: "phase.active",
  /** Đang tạm dừng. */
  paused: "phase.paused",
  /** Bị chặn. */
  blocked: "phase.blocked",
};

/** Id gắn vào `data-plugin-css` của hai thẻ style. */
export const STYLE_TAGS = {
  /** CSS của dải GoalBar. */
  bar: "@galaxy-blackhole/gbh-client-ui-goal/GoalBar.module.css",
  /** CSS của ô xem trước lệnh. */
  view: "@galaxy-blackhole/gbh-client-ui-goal/GoalCommandInputView.module.css",
} as const;
