/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tap khung nhin phien dang giu (ban goc: session-views.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/session-views.js
 */

import * as _deepseek_ai_dsh_client_store from "@galaxy-blackhole/gbh-client-store";
import { SidebarSessionView } from "./session-view.ts";

/** Selects and retires views; the Sidebar plugin's injected dependencies own global teardown. */
export class SidebarSessionViews {
	sessions: any;
	/** Selected and retained View targets observed by the root renderer. */
	source = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)([]);
	views = /* @__PURE__ */ new Map();
	viewsByReference = /* @__PURE__ */ new Map();
	selected: any;
	closed = false;
	constructor(sessions: any) {
		this.sessions = sessions;
	}
	/**
	* Change the foreground Session while preserving retained background Views.
	* @param sessionId - main selection, or absence.
	*/
	select(sessionId: any) {
		if (this.closed || this.selected === sessionId) return;
		this.selected = sessionId;
		if (sessionId !== void 0 && !this.views.has(sessionId)) {
			const view = new SidebarSessionView(sessionId, this.sessions, (disposed: any) => {
				this.viewsByReference.delete(disposed.reference);
			}, (released: any) => {
				this.prune(released);
			});
			this.views.set(sessionId, view);
			this.viewsByReference.set(view.reference, view);
		}
		for (const view of this.views.values()) this.prune(view);
		this.publish();
	}
	/**
	* Bind a committed root; release retired references after that root unmounts.
	* @param reference - framework target published by this owner.
	* @returns releases this committed mount.
	*/
	mount(reference: any) {
		const view = this.viewsByReference.get(reference);
		if (view === void 0) {
			if (this.closed) return () => {};
			throw new Error("Sidebar Session view reference is no longer owned");
		}
		return view.mount();
	}
	/** Plugin shutdown releases every view, including any awaiting a React unmount. */
	dispose() {
		this.closed = true;
		this.views.clear();
		this.source.set([]);
		for (const view of this.viewsByReference.values()) view.dispose();
	}
	prune(view: any) {
		if (view.sessionId === this.selected || view.hasRetainedTabs || this.views.get(view.sessionId) !== view) return;
		this.views.delete(view.sessionId);
		this.publish();
		view.retire();
	}
	publish() {
		this.source.set([...this.views.values()].sort((a: any, b: any) => a.sessionId.localeCompare(b.sessionId)).map((view: any) => ({
			sessionId: view.sessionId,
			reference: view.reference,
			selected: view.sessionId === this.selected,
			retainTab: view.retainTab
		})));
	}
};
