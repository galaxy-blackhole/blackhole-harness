/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Ten lop cua hai CSS module — giu nguyen hash cua ban goc de DOM khong lech
 */

/** Ten lop cua PermissionRow.module.css — hash oY77xG_ cua ban goc. */
export const ROW_CLASS = {
  /** Dong bao ngoai cua hang. */
  row: "oY77xG_row",
  /** Khoi chu (tieu de + mo ta). */
  rowText: "oY77xG_rowText",
  /** Tieu de hang. */
  title: "oY77xG_title",
  /** Mo ta / dong loi. */
  desc: "oY77xG_desc",
  /** Nut chon preset. */
  selector: "oY77xG_selector",
  /** Mui ten trong nut chon. */
  chevron: "oY77xG_chevron",
} as const;

/** Ten lop cua PermissionSelect.module.css — hash iWlSmW_ cua ban goc. */
export const SELECT_CLASS = {
  /** Nut chip tren composer. */
  trigger: "iWlSmW_trigger",
  /** Vo icon trong chip. */
  triggerIcon: "iWlSmW_triggerIcon",
  /** Nhan trong chip. */
  triggerLabel: "iWlSmW_triggerLabel",
  /** Vo nhan cua mot lua chon trong menu. */
  optionLabel: "iWlSmW_optionLabel",
  /** Phan chu cua nhan lua chon. */
  optionLabelText: "iWlSmW_optionLabelText",
  /** Badge thi nghiem (EXP). */
  badge: "iWlSmW_badge",
  /** Mui ten trong chip. */
  chevron: "iWlSmW_chevron",
  /** Trang thai mo cua mui ten. */
  chevronOpen: "iWlSmW_chevronOpen",
} as const;
