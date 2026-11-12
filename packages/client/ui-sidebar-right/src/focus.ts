/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Doc pane/tab tu DOM dang song va giu tieu diem khi node bi thay (ban goc: focus.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/focus.js
 */

import { layout, paneId, tabId } from "./persistence.ts";

/**
* Read pane and tab identity from live owner markup, including an embedding iframe.
* @param element - focused or pointer-activated element in the product document.
* @param sessionId - Session currently drawn by the sidebar.
* @param layout - current committed layout for that Session.
* @param occurrence - current occurrence lookup for a committed tab.
* @returns the captured page, or undefined for stale, hidden, or outside elements.
*/
export function sidebarTargetFromElement(element: any, sessionId: any, layout: any, occurrence: any) {
	if (element === null || !element.isConnected) return void 0;
	if (element.closest("[data-sidebar-right-session]")?.dataset.sidebarRightSession !== sessionId) return void 0;
	const container = element.closest("[data-dockkit-pane], [data-dockkit-float]");
	const paneId = container?.dataset.dockkitPane ?? container?.dataset.dockkitFloat;
	if (paneId === void 0 || container?.closest("[hidden], [aria-hidden=\"true\"]") !== null) return void 0;
	const pane = layout.nodes[paneId];
	if (pane?.kind !== "pane" || pane.host === "dock" && !layout.expanded) return void 0;
	const tabElement = element.closest("[data-dockkit-tab], [data-sidebar-right-tab]");
	const tabId = tabElement?.dataset.dockkitTab ?? tabElement?.dataset.sidebarRightTab ?? pane.activeTabId;
	if (tabId !== void 0 && (!pane.tabs.includes(tabId) || layout.tabs[tabId] === void 0)) return void 0;
	const held = tabId === void 0 ? void 0 : occurrence(tabId);
	const marker = element.closest("[data-sidebar-right-occurrence]") ?? tabElement?.querySelector("[data-sidebar-right-occurrence]");
	if (marker !== null && marker !== void 0 && marker.dataset.sidebarRightOccurrence !== held?.id) return void 0;
	return {
		sessionId,
		paneId,
		host: pane.host,
		tabId,
		occurrence: held,
		navigationRevision: held?.navigation.getSnapshot().revision
	};
}
/**
* Find a visible pane of one Session, preferring the requested pane over the active fallback.
* @param document - product document containing docked and floating panes.
* @param sessionId - Session whose panes may receive focus.
* @param paneId - preferred pane before an operation changed the layout.
* @returns a surviving visible pane, or undefined when the Session has none.
*/
export function visibleSidebarPane(document: any, sessionId: any, paneId: any) {
	const panes: any = [...document.querySelectorAll("[data-dockkit-pane], [data-dockkit-float]")].filter((pane: any) => {
		const owner = pane.closest("[data-sidebar-right-session]");
		return owner?.dataset.sidebarRightSession === sessionId && pane.closest("[hidden], [aria-hidden=\"true\"]") === null && (pane.hasAttribute("data-dockkit-float") || owner.hasAttribute("data-sidebar-right-open"));
	});
	return panes.find((pane: any) => (pane.dataset.dockkitPane ?? pane.dataset.dockkitFloat) === paneId) ?? panes.find((pane: any) => pane.hasAttribute("data-dockkit-pane-active") || pane.hasAttribute("data-dockkit-float-active")) ?? panes[0];
}
/**
* Observe pane focus and retain it when its DOM node is replaced, preserving text selections.
* @param document - product document whose sidebar owns the listener lifetime.
* @returns disposer for every document/window listener.
*/
export function observeSidebarFocus(document: any) {
	let active = true;
	let focused: any;
	const removal = new MutationObserver(() => {
		if (focused === void 0 || focused.element.isConnected) return;
		const previous = focused;
		focused = void 0;
		removal.disconnect();
		if (document.activeElement !== document.body) return;
		const moved = previous.occurrence === void 0 ? void 0 : [...document.querySelectorAll("[data-sidebar-right-occurrence]")].find((marker: any) => marker.dataset.sidebarRightOccurrence === previous.occurrence)?.closest("[data-dockkit-pane], [data-dockkit-float]");
		const paneId = moved?.dataset.dockkitPane ?? moved?.dataset.dockkitFloat;
		visibleSidebarPane(document, previous.sessionId, paneId ?? previous.paneId)?.focus({ preventScroll: true });
	});
	const capture = () => {
		removal.disconnect();
		focused = void 0;
		const element = document.activeElement;
		const pane = element?.closest("[data-dockkit-pane], [data-dockkit-float]");
		if (element === null || pane === void 0 || pane === null) return;
		const owner = pane.closest("[data-sidebar-right-session]");
		const sessionId = owner?.dataset.sidebarRightSession;
		const paneId = pane.dataset.dockkitPane ?? pane.dataset.dockkitFloat;
		if (owner === null || sessionId === void 0 || paneId === void 0) return;
		const tab = element.closest("[data-dockkit-tab]") ?? pane.querySelector("[role=\"tab\"][aria-selected=\"true\"], [data-dockkit-float-title]");
		focused = {
			element,
			sessionId,
			paneId,
			occurrence: (element.closest("[data-sidebar-right-occurrence]") ?? tab?.querySelector("[data-sidebar-right-occurrence]"))?.dataset.sidebarRightOccurrence
		};
		removal.observe(owner, {
			childList: true,
			subtree: true
		});
		if (owner.parentElement !== null) removal.observe(owner.parentElement, { childList: true });
	};
	const focusout = (event: any) => {
		if (event.relatedTarget === null && focused?.element.isConnected) {
			focused = void 0;
			removal.disconnect();
		}
	};
	const pointer = (event: any) => {
		const element = event.composedPath().find((value: any) => value instanceof Element);
		if (!(element instanceof Element)) return;
		const pane: any = element.closest("[data-sidebar-right-session] [data-dockkit-pane], [data-sidebar-right-session] [data-dockkit-float]");
		if (pane === null) {
			focused = void 0;
			removal.disconnect();
		}
		const control = element.closest("button, input, textarea, select, a, [contenteditable], [tabindex], iframe");
		if (pane !== null && (control === null || control === pane)) pane.focus({ preventScroll: true });
	};
	const blur = () => {
		queueMicrotask(() => {
			if (active) capture();
		});
	};
	document.addEventListener("focusin", capture);
	document.addEventListener("focusout", focusout);
	document.addEventListener("pointerdown", pointer, true);
	document.defaultView?.addEventListener("blur", blur);
	document.defaultView?.addEventListener("focus", capture);
	capture();
	return () => {
		active = false;
		removal.disconnect();
		document.removeEventListener("focusin", capture);
		document.removeEventListener("focusout", focusout);
		document.removeEventListener("pointerdown", pointer, true);
		document.defaultView?.removeEventListener("blur", blur);
		document.defaultView?.removeEventListener("focus", capture);
	};
}
