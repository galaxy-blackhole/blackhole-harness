/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang ten lop cua hai CSS module cua row ui-goal — giu NGUYEN hash cua ban goc
 */

/** Tên lớp của `GoalBar.module.css` — giữ nguyên hash `nLMEza_` của bản gốc để DOM không lệch. */
export const BAR_CLASS = {
  /** Khung dải nằm trong dock soạn tin. */
  dock: "nLMEza_dock",
  /** Hàng nội dung của dải. */
  bar: "nLMEza_bar",
  /** Biến thể hàng khi đang sửa. */
  editBar: "nLMEza_editBar",
  /** Ô biểu tượng goal. */
  goalGlyph: "nLMEza_goalGlyph",
  /** Nhãn pha. */
  label: "nLMEza_label",
  /** Nội dung objective (cắt bớt). */
  objective: "nLMEza_objective",
  /** Câu lỗi của lần hành động gần nhất. */
  error: "nLMEza_error",
  /** Hàng nút hành động. */
  actions: "nLMEza_actions",
  /** Nút biểu tượng. */
  iconBtn: "nLMEza_iconBtn",
} as const;

/** Tên lớp của `GoalCommandInputView.module.css` — hash `oRe1gG_` của bản gốc. */
export const VIEW_CLASS = {
  /** Hàng canh phải. */
  row: "oRe1gG_row",
  /** Cột chứa bong bóng. */
  stack: "oRe1gG_stack",
  /** Bong bóng lệnh. */
  bubble: "oRe1gG_bubble",
} as const;
