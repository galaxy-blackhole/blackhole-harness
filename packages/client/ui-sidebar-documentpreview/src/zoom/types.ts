/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kieu tuy chon thu phong cua tung tab — nguyen van hang so cua ban goc
 */

/** Tuy chon mac dinh cho mot ban xem co thu phong vua mo. */
export const FIT_WIDTH = { kind: "fit-width" } as const;

/** Ti le nho nhat ma mot tuy chon thu phong co dinh giu lai — nguyen van ban goc. */
export const MIN_FIXED_ZOOM = 0.25;

/** Buoc ti le ma cac cong cu tang/giam dung — nguyen van ban goc. */
export const ZOOM_STEP = 0.25;

/** Cac muc ti le co dinh hien trong menu thu phong — nguyen van ban goc. */
export const ZOOM_OPTIONS: readonly number[] = [0.25, 0.5, 1, 1.5, 2];

/** Ti le lon nhat ma ban xem cho phep — nguyen van ban goc. */
export const MAX_ZOOM = 4;

/** Tuy chon thu phong cua mot tab. */
export type ZoomPreference = { kind: "fit-width" } | { kind: "fixed"; scale: number };
