/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang ten lop cua AppFrame.module.css — giu NGUYEN hash cua ban goc
 */

/** Tên lớp của `AppFrame.module.css` — hash `pI_x6G_` của bản gốc, giữ nguyên để DOM không lệch. */
export const FRAME_CLASS = {
  /** Khung lưới ba cột (ô gốc của lưới). */
  frame: "pI_x6G_frame",
  /** Cột trái (thanh bên). */
  sidebarCol: "pI_x6G_sidebarCol",
  /** Cột giữa. */
  centerCol: "pI_x6G_centerCol",
  /** Cột phải (chỉ là một track, không phải một hộp). */
  rightbarCol: "pI_x6G_rightbarCol",
  /** Ghế nổi cho dải dẫn khi thanh bên đang thu trên macOS. */
  leadingSeat: "pI_x6G_leadingSeat",
  /** Tay kéo giữa hai cột. */
  handle: "pI_x6G_handle",
  /** Dải đáy của vỏ. */
  bottomRow: "pI_x6G_bottomRow",
  /** Lớp phủ toàn khung (pointer-events chỉ bật cho con). */
  overlayLayer: "pI_x6G_overlayLayer",
} as const;
