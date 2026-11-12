/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hợp đồng cài đặt của row ui-chat ở nửa host — nguyên văn lib/index.js của bản gốc
 */

import z from "@deepseek-ai/schemastery";

/** Namespace cài đặt mà đích Chat sở hữu. */
export const CHAT_SETTINGS_NAMESPACE = "ui-chat";

/** Trường mang chế độ trình bày chi tiết công việc. */
export const TRANSCRIPT_VIEW_FIELD = "transcriptView";

/** Trường mang thời điểm thu gọn chi tiết công việc. */
export const COLLAPSE_TIMING_FIELD = "collapseTiming";

/** Các mốc hợp lệ để chi tiết công việc trở về dạng lịch sử. */
export const COLLAPSE_TIMINGS = ["completion", "next-input"] as const;

/** Giữ mốc thu gọn khi hoàn tất nếu người dùng chưa chọn gì. */
export const DEFAULT_COLLAPSE_TIMING = "completion";

/** Bốn chế độ trình bày mà người dùng chọn được. */
export const TRANSCRIPT_VIEW_MODES = ["compact", "standard", "detailed", "verbose"] as const;

/**
 * Giá trị đã lưu của thế hệ hai chế độ; đọc như `detailed`, không bao giờ hiện ra và không ghi lại.
 */
export const LEGACY_TRANSCRIPT_VIEW_MODE = "normal";

/** Giá trị `expanded` đã lưu; đọc như `detailed`, không hiện ra và không ghi lại. */
export const LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE = "expanded";

/** Mọi giá trị trường lâu dài chấp nhận: bốn chế độ hiện hành cộng hai giá trị cũ. */
export const TRANSCRIPT_VIEW_SETTING_VALUES = [
  ...TRANSCRIPT_VIEW_MODES,
  LEGACY_TRANSCRIPT_VIEW_MODE,
  LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE,
] as const;

/** Chế độ chi tiết mặc định cho client Web không phải Desktop. */
export const DEFAULT_TRANSCRIPT_VIEW_MODE = "detailed";

/** Mức chi tiết hiệu năng và sử dụng mà cài đặt người dùng chấp nhận. */
export const PERFORMANCE_USAGE_MODES = ["compact", "detailed"] as const;

/** Giữ mức chi tiết đầy đủ cho người dùng chưa chọn gì. */
export const DEFAULT_PERFORMANCE_USAGE = "detailed";

/** Giữ trình duyệt dựng sẵn cho người dùng chưa chọn gì. */
export const DEFAULT_LINK_OPENING = "sidebar";

/**
 * Lược đồ cài đặt Chat lâu dài; cũng là phong bì dây mà phạm vi trình duyệt kiểm định.
 * Nhận: không có (hằng lược đồ).
 * Trả: đối tượng trường schemastery.
 */
export const ChatSettingsFields = {
  [COLLAPSE_TIMING_FIELD]: z.union([...COLLAPSE_TIMINGS]).default(DEFAULT_COLLAPSE_TIMING),
  linkOpening: z.union(["sidebar", "new-tab"]).default(DEFAULT_LINK_OPENING),
  performanceUsage: z.union([...PERFORMANCE_USAGE_MODES]).default(DEFAULT_PERFORMANCE_USAGE),
  [TRANSCRIPT_VIEW_FIELD]: z.union([...TRANSCRIPT_VIEW_SETTING_VALUES]).loose(),
};
