/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mien tab: phat hanh va thu hoi lan xuat hien cua tab (ban goc: tab-domain.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/tab-domain.js
 */

import * as _deepseek_ai_dsh_client_ui_dockkit from "@galaxy-blackhole/gbh-client-ui-dockkit";
import * as _deepseek_ai_dsh_client_store from "@galaxy-blackhole/gbh-client-store";
import { layout, paneId, tabId } from "./persistence.ts";
import { randomUUID } from "./uuid.ts";

/** Every session's occurrences. */
export class TabDomain {
	navigator: any;
	pin: any;
	bySession = /* @__PURE__ */ new Map();
	/**
	* @param navigator - where tab actions go, aimed at the tab's session; the navigation controller.
	* @param pin - `ctx.resources.pin`, called once per occurrence at its first sync.
	*/
	constructor(navigator: any, pin: any) {
		this.navigator = navigator;
		this.pin = pin;
	}
	/**
	* Reconcile one session's occurrences with its committed layout.
	*
	* Called by the seat after every commit, and only then: aborting a vanished
	* record runs the types' cleanup, which writes their stores.
	* @param sessionId - the session whose layout committed.
	* @param layout - that session's layout as committed.
	*/
	sync(sessionId: any, layout: any) {
		const held = this.session(sessionId);
		for (const [tabId, occurrence] of held) {
			if (layout.tabs[tabId] !== void 0) continue;
			held.delete(tabId);
			occurrence.controller.abort();
		}
		for (const tab of Object.values(layout.tabs) as any) {
			const occurrence = held.get(tab.id) ?? this.hold(sessionId, tab.id, {
				address: tab.contentId,
				params: void 0,
				revision: 0
			});
			const pane = (0, _deepseek_ai_dsh_client_ui_dockkit.findTabPane)(layout, tab.id);
			occurrence.paneId = pane.host === "dock" ? pane.id : void 0;
			if (occurrence.pinned) continue;
			occurrence.pinned = true;
			this.pin(occurrence.navigation.getSnapshot().address, occurrence.signal);
		}
	}
	/**
	* Read an occurrence created by navigation or committed-store reconciliation.
	* @param sessionId - the session the record is in.
	* @param tab - the record being drawn.
	* @returns its occurrence.
	* @throws when the record has not been reconciled or has disappeared.
	*/
	occurrence(sessionId: any, tab: any) {
		const occurrence = this.bySession.get(sessionId)?.get(tab.id);
		if (occurrence === void 0) throw new Error(`sidebarRight: tab "${tab.id}" has no committed occurrence in session "${sessionId}"`);
		return occurrence;
	}
	/**
	* Record that an `open` settled on a tab.
	*
	* A record the layout has not yet shown the seat gets its occurrence here, so
	* the body's first render already carries the opener's `params`.
	* @param sessionId - the session opened into.
	* @param tabId - the tab the open settled on.
	* @param target - the address and the opener's params.
	*/
	navigate(sessionId: any, tabId: any, target: any) {
		const existing = this.session(sessionId).get(tabId);
		if (existing === void 0) {
			this.hold(sessionId, tabId, {
				...target,
				revision: 1
			});
			return;
		}
		existing.navigation.set({
			...target,
			revision: existing.navigation.getSnapshot().revision + 1
		});
	}
	/** Abort every occurrence of every session; the package is unloading. */
	dispose() {
		for (const held of this.bySession.values()) for (const occurrence of held.values()) occurrence.controller.abort();
		this.bySession.clear();
	}
	session(sessionId: any) {
		let held = this.bySession.get(sessionId);
		if (held === void 0) {
			held = /* @__PURE__ */ new Map();
			this.bySession.set(sessionId, held);
		}
		return held;
	}
	hold(sessionId: any, tabId: any, navigation: any) {
		const controller = new AbortController();
		const { navigator } = this;
		const place = (placement: any) => ({
			...placement.replaceTab === true ? { replaceTab: tabId } : held.paneId === void 0 ? {} : { paneId: held.paneId },
			...placement.paneId === void 0 ? {} : { paneId: placement.paneId },
			...placement.preferNewPane === void 0 ? {} : { preferNewPane: placement.preferNewPane },
			...placement.revealIfOpened === void 0 ? {} : { revealIfOpened: placement.revealIfOpened }
		});
		const held = {
			id: randomUUID(),
			sessionId,
			tabId,
			controller,
			commands: {},
			signal: controller.signal,
			navigation: (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(navigation),
			paneId: void 0,
			pinned: false,
			tabActions: {
				bindCommands: (commands: any) => {
					if (controller.signal.aborted) return () => {};
					held.commands = commands;
					const release = () => {
						if (held.commands === commands) held.commands = {};
						controller.signal.removeEventListener("abort", release);
					};
					controller.signal.addEventListener("abort", release, { once: true });
					return release;
				},
				openResource: (address: any, options: any = {}) => {
					navigator.openResourceIn(sessionId, address, {
						...place(options),
						params: options.params
					});
				},
				openTab: (kind: any, options: any = {}) => {
					navigator.openTabIn(sessionId, kind, {
						...place(options),
						params: options.params
					});
				},
				close: () => {
					navigator.closeIn(sessionId, tabId);
				}
			}
		};
		this.session(sessionId).set(tabId, held);
		return held;
	}
};
