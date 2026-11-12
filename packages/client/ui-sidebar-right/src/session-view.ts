/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khung nhin mot phien: giu phien va tra tai nguyen (ban goc: session-view.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/session-view.js
 */

import { tabId } from "./persistence.ts";

/** Owns its reference until retirement finishes or the Sidebar plugin shuts down. */
export class SidebarSessionView {
	sessionId: any;
	onDispose: any;
	onTabRelease: any;
	/** Session reference released exclusively by this View. */
	reference: any;
	tabs = /* @__PURE__ */ new Map();
	mounts = 0;
	retired = false;
	disposed = false;
	/**
	* @param sessionId - Session displayed by this view.
	* @param sessions - allocator for this view's independent reference.
	* @param onDispose - removes this view from the collection's index before reference release.
	* @param onTabRelease - reconsiders retention after a body releases its hold.
	*/
	constructor(sessionId: any, sessions: any, onDispose: any, onTabRelease: any) {
		this.sessionId = sessionId;
		this.onDispose = onDispose;
		this.onTabRelease = onTabRelease;
		this.reference = sessions.retain(sessionId, { source: "sidebarView" });
		this.reference.ready.catch((error: any) => {
			console.error("Sidebar Session opening failed:", error);
		});
	}
	/** Whether an initialized retained body still needs this view. */
	get hasRetainedTabs() {
		return this.tabs.size > 0;
	}
	/**
	* Keep a retired View's reference until its committed roots finish unmounting.
	* @returns cleanup to call once for this root; the final cleanup releases a retired View.
	*/
	mount() {
		this.mounts += 1;
		return () => {
			this.mounts -= 1;
			if (this.retired && this.mounts === 0) this.dispose();
		};
	}
	/**
	* Hold an initialized body until unmount or occurrence cancellation.
	* @param tabId - initialized body identity.
	* @param signal - occurrence lifetime; closing and undoing a tab creates a new lifetime.
	* @returns idempotent release of this body's hold.
	*/
	retainTab = (tabId: any, signal: any) => {
		if (signal.aborted || this.disposed) return () => {};
		this.tabs.set(tabId, (this.tabs.get(tabId) ?? 0) + 1);
		let held = true;
		const release = () => {
			if (!held) return;
			held = false;
			signal.removeEventListener("abort", release);
			const count = this.tabs.get(tabId);
			if (count === 1) this.tabs.delete(tabId);
			else this.tabs.set(tabId, count - 1);
			this.onTabRelease(this);
		};
		signal.addEventListener("abort", release, { once: true });
		return release;
	};
	/** End a withdrawn view after its existing committed mounts finish. */
	retire() {
		this.retired = true;
		if (this.mounts === 0) this.dispose();
	}
	/** Release once; plugin shutdown does not wait for remaining React mounts. */
	dispose() {
		if (this.disposed) return;
		this.disposed = true;
		this.retired = true;
		this.onDispose(this);
		this.reference.release();
	}
};
