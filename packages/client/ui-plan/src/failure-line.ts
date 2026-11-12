/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Giai thich mot lan doc plan that bai bang ngon ngu hien tai (ma loi cua ta) hoac giu chan doan ben ngoai
 */
import type { PlanKey } from "./plan-keys.ts";

/** Ham dich cua namespace `plan` do seam `locale` cap (`ctx.locale.bind(NS)`). */
export type TranslatePlan = (key: PlanKey, params?: Record<string, string>) => string;

/** Loi doc tai nguyen: chi hai truong ma bo doc nay dung. */
export interface ResourceFailure {
  /** Ma loi on dinh (`plan/invalid-address`, `plan/unavailable`, …). */
  readonly code: string;
  /** Chan doan nguoi doc duoc. */
  readonly message: string;
}

/**
 * Giai thich mot lan doc plan that bai bang ngon ngu hien tai.
 * Nhan: `t` — ham dich namespace `plan`; `failure` — loi do provider tai nguyen bao ve.
 * Tra: cau chu cua namespace, hoac chan doan nguyen van cua loi ben ngoai.
 */
export function planFailureLine(t: TranslatePlan, failure: ResourceFailure): string {
  switch (failure.code) {
    case "plan/invalid-address":
      return t("preview.invalidAddress");
    case "plan/unavailable":
      return t("preview.historyUnavailable");
    case "plan/not-found":
      return t("preview.notFound");
    default:
      return failure.message;
  }
}
