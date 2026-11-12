/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tuy chon xem PDF co the khoi phuc: trang cuoi cung va ti le, tach theo tab
 */

import type { StoreModuleLike } from "../types.ts";

/** Khung nhin PDF cua mot tab. */
export interface PdfTabView {
  /** Trang dang chon (1-based). */
  page?: number;
  /** Ti le dang chon. */
  zoom?: number;
}

/**
 * Khai trang thai xem PDF cuc bo theo tab.
 * Nhan: defineStore — ham cua bang module @galaxy-blackhole/gbh-client-store.
 * Tra: khai bao store ma slot tai lieu tao mot instance cho moi Phien.
 */
export function createPdfStore(defineStore: StoreModuleLike["defineStore"]): unknown {
  return defineStore({
    init: () => ({ byTab: {} }),
    actions: {
      /** Ghi trang dang chon cua mot tab. */
      page: (draft: { byTab: Record<string, PdfTabView> }, tabId: string, page: number): void => {
        draft.byTab[tabId] = { ...draft.byTab[tabId], page };
      },
      /** Ghi ti le dang chon cua mot tab. */
      zoom: (draft: { byTab: Record<string, PdfTabView> }, tabId: string, zoom: number): void => {
        draft.byTab[tabId] = { page: draft.byTab[tabId]?.page ?? 1, zoom };
      },
      /** Bo tuy chon cua mot tab da dong. */
      forget: (draft: { byTab: Record<string, PdfTabView> }, tabId: string): void => {
        const remaining: Record<string, PdfTabView> = {};
        for (const [id, view] of Object.entries(draft.byTab)) if (id !== tabId) remaining[id] = view;
        draft.byTab = remaining;
      },
    },
  });
}
