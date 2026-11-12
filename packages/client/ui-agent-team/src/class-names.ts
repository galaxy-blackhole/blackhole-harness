/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bảng tên lớp của TeamAction.module.css — CHÉP NGUYÊN VĂN bảng 30 lớp của bundle gốc
 *      (@deepseek-ai/dsh-experimental-client-ui-agent-team/lib/client.js dòng 21-52), giữ nguyên hash
 *      VoX2oq_ để DOM không lệch.
 */

/** Tên lớp của TeamAction.module.css — giữ nguyên hash VoX2oq_ của bản gốc. */
export const TEAM_ACTION_CLASS = {
  /** Vùng cuộn của bảng. */
  body: "VoX2oq_body",
  /** Mô tả bị kẹp hai dòng (khi chưa mở rộng). */
  clampedDescription: "VoX2oq_clampedDescription",
  /** Số đếm cạnh tiêu đề mục (thành viên / việc). */
  count: "VoX2oq_count",
  /** Tag phiên hiện tại. */
  currentTag: "VoX2oq_currentTag",
  /** Dòng lỗi riêng của thành viên. */
  diagnostic: "VoX2oq_diagnostic",
  /** Câu chưa có việc chia sẻ. */
  emptyNotice: "VoX2oq_emptyNotice",
  /** Khối lỗi (role=alert). */
  error: "VoX2oq_error",
  /** Nút xem thêm / thu gọn. */
  expandToggle: "VoX2oq_expandToggle",
  /** Mũi tên xoay khi đang mở. */
  expandToggleOpen: "VoX2oq_expandToggleOpen",
  /** Icon người cho thành viên KHÔNG chạy. */
  inactiveIcon: "VoX2oq_inactiveIcon",
  /** Thẻ một thành viên (nút bấm mở phiên). */
  member: "VoX2oq_member",
  /** Thẻ của phiên HIỆN TẠI (đánh dấu khi team > 1 người). */
  memberCurrent: "VoX2oq_memberCurrent",
  /** Ô chứa dot trạng thái / icon người. */
  memberDot: "VoX2oq_memberDot",
  /** Hậu tố · Model: tên. */
  memberModel: "VoX2oq_memberModel",
  /** Hàng tên thành viên (+ tag hiện tại). */
  memberName: "VoX2oq_memberName",
  /** Phần tên có thể cắt bằng ellipsis. */
  memberNameText: "VoX2oq_memberNameText",
  /** Cột chữ của thẻ thành viên. */
  memberText: "VoX2oq_memberText",
  /** Hàng meta: nút mở rộng, id, owner, phụ thuộc, write scope, cảnh báo. */
  meta: "VoX2oq_meta",
  /** Khối thông báo khi chưa có projection. */
  notice: "VoX2oq_notice",
  /** Bảng nổi (dialog) — render qua portal vào body. */
  panel: "VoX2oq_panel",
  /** Biến thể hẹp: một cột, dùng khi team chỉ có 1 thành viên và 0 việc. */
  panelCompact: "VoX2oq_panelCompact",
  /** Khung gốc của action (position:relative). */
  root: "VoX2oq_root",
  /** Lưới hai cột của danh sách thành viên. */
  roster: "VoX2oq_roster",
  /** Một thẻ việc (article). */
  task: "VoX2oq_task",
  /** Cụm dot + chữ trạng thái việc. */
  taskState: "VoX2oq_taskState",
  /** Hàng tiêu đề việc + trạng thái. */
  taskTitle: "VoX2oq_taskTitle",
  /** Danh sách thẻ việc. */
  tasks: "VoX2oq_tasks",
  /** Nút mở bảng (nhãn + icon), hover được. */
  trigger: "VoX2oq_trigger",
  /** Nhãn chữ của nút — ẩn khi bề rộng container ≤ 480px. */
  triggerLabel: "VoX2oq_triggerLabel",
  /** Cảnh báo write-scope của việc. */
  warning: "VoX2oq_warning",
} as const;

/** Kiểu giá trị của {@link TEAM_ACTION_CLASS}. */
export type TeamActionClassNames = typeof TEAM_ACTION_CLASS;

/**
 * Tên lớp của set-team-limits.module.css — CSS RIÊNG của ta cho hàng toolview bổ sung.
 * KHÔNG nằm trong bảng verbatim của gói gốc (`VoX2oq_`), nên dùng tiền tố riêng `GbhLimits_`.
 */
export const SET_LIMITS_CLASS = {
  /** Hàng ngang: icon + tiêu đề + tóm tắt. */
  row: "GbhLimits_row",
  /** Ô icon hai người. */
  icon: "GbhLimits_icon",
  /** Tiêu đề "Set team limits". */
  title: "GbhLimits_title",
  /** Dấu chấm ngăn cách tiêu đề với tóm tắt — CÙNG khuôn `.o3BgMG_sep` của row ui-tool. */
  sep: "GbhLimits_sep",
  /** Dòng tóm tắt "16 members · 256 tasks". */
  summary: "GbhLimits_summary",
} as const;

/** Kiểu giá trị của {@link SET_LIMITS_CLASS}. */
export type SetLimitsClassNames = typeof SET_LIMITS_CLASS;
