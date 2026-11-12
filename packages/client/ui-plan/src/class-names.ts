/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang ten lop cua hai CSS module cua row ui-plan — giu NGUYEN hash cua ban goc
 */

/** Ten lop cua `PlanPreview.module.css` — giu nguyen hash `k74WwW_` cua ban goc de DOM khong lech. */
export const PREVIEW_CLASS = {
  /** Cot chua cac the plan trong mot Turn. */
  cards: "k74WwW_cards",
  /** Mot the plan bam duoc. */
  card: "k74WwW_card",
  /** O bieu tuong cua the. */
  cardIcon: "k74WwW_cardIcon",
  /** Cot chu cua the (tieu de + mo ta). */
  cardDetails: "k74WwW_cardDetails",
  /** Tieu de plan. */
  cardTitle: "k74WwW_cardTitle",
  /** Dong mo ta duoi tieu de. */
  cardDescription: "k74WwW_cardDescription",
  /** Nut "mo" o cuoi the. */
  cardOpen: "k74WwW_cardOpen",
  /** Nut mo plan day du trong khoi review dang cho. */
  reviewLink: "k74WwW_reviewLink",
  /** Khung trang thai (dang doc / that bai / het han). */
  message: "k74WwW_message",
  /** Khung tai lieu Markdown. */
  document: "k74WwW_document",
  /** Khung ngoai cua the xem truoc. */
  preview: "k74WwW_preview",
  /** Bieu tuong canh tieu de tab. */
  titleIcon: "k74WwW_titleIcon",
} as const;

/** Ten lop cua `PlanModeControl.module.css` — hash `rS3zOq_` cua ban goc. */
export const CONTROL_CLASS = {
  /** Khung ngoai cua chip. */
  wrap: "rS3zOq_wrap",
  /** Nut chip plan mode. */
  chip: "rS3zOq_chip",
  /** O bieu tuong (doi giua nghi va hover). */
  glyph: "rS3zOq_glyph",
  /** Bieu tuong luc nghi. */
  restGlyph: "rS3zOq_restGlyph",
  /** Bieu tuong luc hover/focus. */
  hoverGlyph: "rS3zOq_hoverGlyph",
  /** Cau loi khi thoat plan mode that bai. */
  error: "rS3zOq_error",
} as const;
