/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 24/10/2026
 * desc Bảng tên lớp của dialog.module.css — hai lớp "nguy hiểm" cho mục menu và nút xác nhận xoá phiên.
 */

/** Tên lớp CSS của row ui-session-delete. */
export const DELETE_CLASS = {
  /** Mục menu "Xoá phiên" — chữ + icon đỏ như "Xoá workspace". */
  menuDanger: "GbhDelete_menuDanger",
  /** Nút "Xoá vĩnh viễn" trong hộp xác nhận — đỏ như nút xác nhận của "Xoá workspace". */
  confirmDanger: "GbhDelete_confirmDanger",
} as const;
