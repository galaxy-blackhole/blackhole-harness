/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc So cua phien: nho nhung plan dang cho DA duoc mo tu dong, de viec dong tay con hieu luc
 */

/** Trang thai cua so: tap dinh danh review da mo (theo phien). */
export interface PlanReviewState {
  /** Danh dau theo dinh danh review (`call:<id>` hoac `review:<key>`). */
  opened: Partial<Record<string, true>>;
}

/** Dong tu cua so review. */
export interface PlanReviewActions {
  /**
   * Danh dau mot review da duoc mo.
   * Nhan: `draft` — ban nhap cua so; `reviewKey` — dinh danh review.
   * Tra: khong co.
   */
  markOpened: (draft: PlanReviewState, reviewKey: string) => void;
}

/** Seam cua `@galaxy-blackhole/gbh-client-store` ma row nay dung (chi mot ham). */
export interface StoreSeam {
  /**
   * Dinh nghia mot so gan phien.
   * Nhan: `definition` — trang thai dau + dong tu.
   * Tra: tay nam so (handle) ma tang renderer nhan qua `store:` cua dang ky slot.
   */
  defineStore: (definition: { init: () => PlanReviewState; actions: PlanReviewActions }) => unknown;
}

/**
 * Giu hieu luc cua viec dong tay qua cac lan mount lai cua component review.
 * Nhan: `store` — seam cua bang module trang (`defineStore`).
 * Tra: tay nam so tam thoi; the hien cua no thuoc pham vi phien.
 */
export function createPlanReviewStore(store: StoreSeam): unknown {
  return store.defineStore({
    init: () => ({ opened: {} }),
    actions: {
      markOpened: (draft: PlanReviewState, reviewKey: string): void => {
        draft.opened[reviewKey] = true;
      },
    },
  });
}
