/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ke khai tab da luu cua mot phien (ban goc: tab-inventory.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/tab-inventory.js
 */

import * as _deepseek_ai_dsh_client_store from "@galaxy-blackhole/gbh-client-store";
import { readSidebarLayout, tabId } from "./persistence.ts";

/** Metadata inventory of saved and adopted layouts without mounting their content. */
/** Derived membership only; layout stores remain the persisted authority. */
export class SidebarTabInventory {
	sessions = /* @__PURE__ */ new Map();
	snapshot = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)([]);
	/** Read-only metadata observable shared with content providers. */
	source = this.snapshot;
	/** Read saved layouts once before the root service is published. */
	constructor() {
		try {
			if (typeof localStorage === "undefined") return;
			const keys = Array.from({ length: localStorage.length }, (_: any, index: any) => localStorage.key(index));
			for (const key of keys) {
				if (key === null || !key.startsWith(`dsh.sidebar-right.v1.`)) continue;
				const sessionId = key.slice(21);
				const saved = readSidebarLayout(sessionId);
				if (saved !== void 0) this.sessions.set(sessionId, Object.values(saved.layout.tabs).map((tab: any) => ({
					sessionId,
					tabId: tab.id,
					kind: tab.kind,
					contentId: tab.contentId
				})));
			}
			this.publish();
		} catch (_storageUnavailable: any) {}
	}
	/**
	* Replace membership from the authoritative in-window store.
	* @param sessionId - adopted Session.
	* @param tabs - current committed records.
	*/
	update(sessionId: any, tabs: any) {
		this.sessions.set(sessionId, tabs.map((tab: any) => ({
			sessionId,
			tabId: tab.id,
			kind: tab.kind,
			contentId: tab.contentId
		})));
		this.publish();
	}
	/**
	* Forget a permanently cleared scope.
	* @param sessionId - removed Session scope.
	*/
	remove(sessionId: any) {
		this.sessions.delete(sessionId);
		this.publish();
	}
	publish() {
		const next = [...this.sessions.values()].flat();
		if (JSON.stringify(next) !== JSON.stringify(this.snapshot.getSnapshot())) this.snapshot.set(next);
	}
};
