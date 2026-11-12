/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang dinh danh cua row ui-settings-subagent: id MODULE, namespace, seam, o dang ky va su kien
 */

/** Id MODULE chính — package của ta (bundle tự khai trong `__ModuleLoader__.load`). */
export const PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-subagent";

/** Id MODULE phụ — package gốc của DSH (bản gốc đăng ký ĐÚNG MỘT id, không có `chunk:`). */
export const STOCK_PACKAGE_NAME = "@galaxy-blackhole/gbh-client-ui-settings-subagent";

/** Namespace từ điển của trang này. */
export const NS = "settings.subagent";

/** Namespace của phần GIỚI HẠN uỷ nhiệm (spell tại đây: gói client không được phụ thuộc gói Host). */
export const SUBAGENT_NS = "subagent";

/** Namespace của tuỳ chọn CHỌN MODEL cho subagent. */
export const SUBAGENT_MODEL_SELECTION_NS = "subagent-model-selection-settings";

/** Seam của fiber — ĐÚNG NĂM mục như bản gốc. */
export const INJECT = ["slots", "locale", "remote", "remote.session", "configForms"] as const;

/** Ô mà trang này đăng ký vào, và định danh của nó trong ô đó. */
export const SLOT = {
  /** Ô con của trang Plugins. */
  name: "plugins.item",
  /** Id occupant. */
  id: "subagent",
  /** Thứ tự occupant. */
  order: 10,
} as const;

/** Sự kiện Remote làm danh mục model phải nạp lại. */
export const MODEL_CATALOG_EVENTS = {
  /** Bộ chuyển đổi LLM đổi. */
  adapters: "llm/adapters-updated",
  /** Tài liệu cài đặt đổi. */
  settings: "settings/document-updated",
} as const;

/** Sự kiện kết nối được đặt lại. */
export const RESET_EVENT = "connection/reset";

/** Nhãn hiệu ứng vòng đời — giữ nguyên chuỗi của bản gốc (thứ tự cũng y vậy). */
export const EFFECT = {
  /** Đăng ký hai bản dịch. */
  dictionaries: "ui-settings-subagent: dictionaries",
  /** Ghế theo dõi form giới hạn. */
  limitsSubscription: "ui-settings-subagent: limits form subscription",
  /** Nạp lại danh mục khi bộ chuyển đổi đổi. */
  adapterInvalidations: "ui-settings-subagent: adapter invalidations",
  /** Nạp lại danh mục khi tài liệu cài đặt đổi. */
  settingsInvalidations: "ui-settings-subagent: settings invalidations",
  /** Thế hệ kết nối. */
  connectionGeneration: "ui-settings-subagent: connection generation",
  /** Ghế tuỳ chọn model. */
  modelPreference: "ui-settings-subagent: model preference",
  /** Trang cài đặt. */
  page: "ui-settings-subagent: page",
} as const;

/** Id gắn vào `data-plugin-css` của ba thẻ style. */
export const STYLE_TAGS = {
  /** CSS của hai ô giới hạn. */
  limits: "@galaxy-blackhole/gbh-client-ui-settings-subagent/SubagentLimitsFields.module.css",
  /** CSS của ô chọn model. */
  models: "@galaxy-blackhole/gbh-client-ui-settings-subagent/SubagentModelSelectionFields.module.css",
  /** CSS của thẻ. */
  card: "@galaxy-blackhole/gbh-client-ui-settings-subagent/SubagentCard.module.css",
} as const;
