/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Hinh hoc ba cot cua khung: hang so giao keo + ham giai — DOI CHIEU TUNG SO voi bundle goc
 */

/** Bề rộng tối thiểu của cột giữa được bảo vệ khi cột phải đang mở. */
export const CENTER_MIN = 400;

/** Sàn kéo của thanh bên. */
export const SIDEBAR_MIN = 264;

/** Trần kéo của thanh bên. */
export const SIDEBAR_MAX = 420;

/** Bề rộng thanh bên trước khi người dùng kéo lần nào. */
export const SIDEBAR_DEFAULT = 280;

/** Ray thu gọn: một cột biểu tượng 24px giữa hai lề ngang 16px. */
export const SIDEBAR_COLLAPSED = 56;

/**
 * Bề rộng khung dưới ngưỡng này thì thanh bên tự thu về ray (điểm ngắt LG của deepsuite);
 * dười ngưỡng đó mà người dùng bấm nút thì nó mở đè lên cột giữa đã bị ép (`narrowExpanded`).
 */
export const SIDEBAR_AUTO_COLLAPSE = 1024;

/** Sàn kéo của cột phải. */
export const RIGHTBAR_MIN = 300;

/** Bề rộng cột phải tối đa, tính theo tỉ lệ khung. */
export const RIGHTBAR_MAX_RATIO = 0.7;

/** Bề rộng cột phải lần mở đầu tiên, tính theo tỉ lệ khung. */
export const RIGHTBAR_DEFAULT_RATIO = 0.45;

/** Bề rộng ba cột đã giải cho một khung. */
export interface Columns {
  /** Bề rộng thanh bên (hoặc bề rộng ray khi đang thu). */
  sidebar: number;
  /** Bề rộng cột giữa. */
  center: number;
  /** Bề rộng cột phải; 0 nghĩa là không có track. */
  rightbar: number;
}

/**
 * Kẹp một bề rộng panel vào khoảng hợp đồng của nó.
 * Nhận: bề rộng yêu cầu và hai biên.
 * Trả: bề rộng đã kẹp (làm tròn về số nguyên).
 */
export function clampWidth(px: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(px)));
}

/**
 * Giải bề rộng ba cột cho một khung nhìn.
 * Nhận: bề rộng khung, bề rộng thanh bên (0 = đang thu), bề rộng cột phải yêu cầu (0 = không track),
 * và bề rộng track của thanh bên đang thu (mặc định giữ ray biểu tượng; 0 là ẩn hẳn cột — kiểu macOS).
 * Trả: bề rộng thật sau khi cột phải thu bớt hoặc mất track; chỉ khi không còn track đó thì cột giữa mới
 * được phép xuống dưới mức tối thiểu, xuống tới 0.
 */
export function computeColumns(viewport: number, sidebar: number, rightbar: number, collapsedWidth = SIDEBAR_COLLAPSED): Columns {
  const s = sidebar === 0 ? collapsedWidth : clampWidth(sidebar, SIDEBAR_MIN, SIDEBAR_MAX);
  const available = viewport - s - CENTER_MIN;
  const r =
    rightbar === 0 || available < RIGHTBAR_MIN
      ? 0
      : Math.min(available, clampWidth(rightbar, RIGHTBAR_MIN, viewport * RIGHTBAR_MAX_RATIO));
  return {
    sidebar: s,
    center: Math.max(0, viewport - s - r),
    rightbar: r,
  };
}
