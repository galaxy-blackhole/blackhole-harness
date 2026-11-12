/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tap khoa cua namespace `plan` — hang so kieu, khong chua chu (nen khong phai ban sao tu dien)
 */

/**
 * Moi khoa ma namespace `plan` so huu — NGUYEN VAN ban goc, dung THU TU xuat hien trong bundle goc.
 * Khai o file rieng de `locales.ts` (chu that) va cac module doc khoa deu dung cung mot nguon su that,
 * va de TypeScript bat duoc mot khoa bi thieu o MOT trong hai ngon ngu.
 */
export const PLAN_KEYS = [
  "chip.label",
  "preview.title",
  "preview.document",
  "preview.action",
  "preview.open",
  "preview.full",
  "preview.openNamed",
  "preview.loading",
  "preview.failed",
  "preview.invalidAddress",
  "preview.historyUnavailable",
  "preview.notFound",
  "preview.unavailable",
  "preview.expired",
  "chip.on.aria",
  "chip.on.title",
  "chip.exitFailed",
] as const;

/** Mot khoa cua namespace `plan`. */
export type PlanKey = (typeof PLAN_KEYS)[number];
