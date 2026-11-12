/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Store checkpoint cua tab trinh duyet, chia se giua cho ngoi than va cho ngoi tieu de
 */

import type { BrowserTabState } from "./persistence.ts";
import { SIDEBAR_BROWSER_STORE_KEY, migrateSidebarBrowserKey } from "./persist-migration.ts";
import type { DefineStoreLike } from "./types.ts";

/** Toan bo tab trinh duyet trong mot store theo pham vi phien. */
export interface BrowserState {
  /** Checkpoint theo id tab. */
  byTab: Record<string, BrowserTabState>;
}

/**
 * Khai store ben vung theo pham vi phien cho trinh duyet.
 * Nhan: defineStore — ham `defineStore` cua @galaxy-blackhole/gbh-client-store.
 * Tra: handle store moi de dang ky vao khe cam.
 */
export function createBrowserStore(defineStore: DefineStoreLike): unknown {
  // 18/10/2026 (task-38): MIGRATION MỘT LẦN dsh.sidebar-browser.v1 → gbh.sidebar-browser.v1 TRƯỚC khi
  // defineStore đọc localStorage.
  migrateSidebarBrowserKey();
  return defineStore({
    init: (): BrowserState => ({ byTab: {} }),
    persist: SIDEBAR_BROWSER_STORE_KEY,
    actions: {
      /** Ghi checkpoint cua mot tab. */
      replace: (draft: BrowserState, tabId: string, state: BrowserTabState): void => {
        draft.byTab[tabId] = state;
      },
      /** Quen mot tab da dong, giu nguyen cac tab khac. */
      forget: (draft: BrowserState, tabId: string): void => {
        const byTab: Record<string, BrowserTabState> = {};
        for (const [id, state] of Object.entries(draft.byTab)) if (id !== tabId) byTab[id] = state;
        draft.byTab = byTab;
      },
    },
  });
}
