/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ban xem Office da nap song qua cac lan mount lai than tab cho toi khi doc lai hoac tab dong
 */

import type { StoreModuleLike } from "../types.ts";
import type { RemoteFailureLike } from "../failure-line.ts";

/** Mot lan xem Office cua mot tab. */
export interface OfficeTabView {
  /** Diep khuc noi dung. */
  revision: number;
  /** Byte PDF da muon duoc. */
  file?: { data: Uint8Array; version: number; absolutePath: string; generation?: number; missingFonts: string[] };
  /** Loi hien duoc cho nguoi doc. */
  failure?: RemoteFailureLike;
}

/**
 * Khai store giu noi dung Office.
 * Nhan: defineStore — ham cua bang module @galaxy-blackhole/gbh-client-store.
 * Tra: khai bao store theo tab.
 */
export function createOfficeStore(defineStore: StoreModuleLike["defineStore"]): unknown {
  return defineStore({
    init: () => ({ byTab: {} }),
    actions: {
      /** Danh dau mot diep khuc moi dang nap. */
      loading(state: { byTab: Record<string, OfficeTabView> }, tab: string, revision: number): void {
        state.byTab[tab] = { revision };
      },
      /** Ghi ket qua chuyen doi da xong. */
      complete(state: { byTab: Record<string, OfficeTabView> }, tab: string, revision: number, file: OfficeTabView["file"]): void {
        state.byTab[tab] = { revision, file };
      },
      /** Ghi mot lan chuyen doi that bai. */
      failed(state: { byTab: Record<string, OfficeTabView> }, tab: string, revision: number, failure: RemoteFailureLike): void {
        state.byTab[tab] = { revision, failure };
      },
      /** Bo trang thai cua mot tab da dong. */
      forget(state: { byTab: Record<string, OfficeTabView> }, tab: string): void {
        const { [tab]: _closed, ...remaining } = state.byTab;
        state.byTab = remaining;
      },
    },
  });
}
