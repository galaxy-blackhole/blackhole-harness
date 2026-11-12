/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Store thu phong cuc bo theo tab cho cac renderer khong co trang thai khung nhin rieng
 */

import type { StoreModuleLike } from "../types.ts";
import { FIT_WIDTH, type ZoomPreference } from "./types.ts";

/**
 * Khai trang thai thu phong cuc bo theo tab.
 * Nhan: defineStore — ham cua bang module @galaxy-blackhole/gbh-client-store.
 * Tra: khai bao store giu thu phong cho toi khi tab dong.
 */
export function createZoomStore(defineStore: StoreModuleLike["defineStore"]): unknown {
  return defineStore({
    init: () => ({ byTab: {} }),
    actions: {
      /** Ghi tuy chon thu phong cua mot tab. */
      zoom: (draft: { byTab: Record<string, ZoomPreference> }, tabId: string, preference: ZoomPreference): void => {
        draft.byTab[tabId] = preference;
      },
      /** Bo tuy chon thu phong cua mot tab da dong. */
      forget: (draft: { byTab: Record<string, ZoomPreference> }, tabId: string): void => {
        const { [tabId]: _closed, ...remaining } = draft.byTab;
        draft.byTab = remaining;
      },
    },
  });
}

/** Gia tri thu phong mac dinh cho mot tab chua co trang thai giu lai. */
export const DEFAULT_ZOOM: ZoomPreference = FIT_WIDTH;
