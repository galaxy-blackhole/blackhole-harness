/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang ten lop cua hai CSS module cua row ui-message-feedback — giu NGUYEN hash cua ban goc
 */

/** Ten lop cua `FeedbackDialog.module.css` — hash `_6_jNJa_` cua ban goc (DOM khong lech). */
export const DIALOG_CLASS = {
  /** Hop thoai. */
  dialog: "_6_jNJa_dialog",
  /** Hang chip phan loai. */
  categories: "_6_jNJa_categories",
  /** Mot chip phan loai. */
  chip: "_6_jNJa_chip",
  /** Chip dang duoc chon. */
  chipActive: "_6_jNJa_chipActive",
  /** O van ban chi tiet. */
  detail: "_6_jNJa_detail",
  /** Nut gui. */
  submit: "_6_jNJa_submit",
} as const;

/** Ten lop cua `MessageFeedbackActions.module.css` — hash `_8_XoUG_` cua ban goc. */
export const ACTIONS_CLASS = {
  /** Mot nut bieu tuong Like/Dislike. */
  action: "_8_XoUG_action",
  /** Dong bao loi canh hai nut. */
  failure: "_8_XoUG_failure",
} as const;
