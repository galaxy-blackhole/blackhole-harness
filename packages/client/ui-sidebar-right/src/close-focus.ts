/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Tra tieu diem ve pane/tab sau khi mo hoac dong (ban goc: shell/close-focus.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/shell/close-focus.js
 */

import * as react_dom from "react-dom";
import { paneId } from "./persistence.ts";
import { visibleSidebarPane } from "./focus.ts";

/** Focus continuity after page operations replace docked or floating pane elements. */
/**
* Focus the page selected by an open or split after its DOM has committed.
* @param document - product document owning the input focus.
* @param sessionId - Session whose page is opening.
* @param open - synchronous operation returning its selected pane, or undefined when unchanged.
*/
export function openWithPaneFocus(document: any, sessionId: any, open: any) {
	let paneId: any;
	(0, react_dom.flushSync)(() => {
		paneId = open();
	});
	if (paneId !== void 0) visibleSidebarPane(document, sessionId, paneId)?.focus({ preventScroll: true });
}
/**
* Commit a focused page's removal before focusing a surviving visible pane.
* @param document - product document owning the input focus.
* @param sessionId - Session whose page is closing.
* @param paneId - pane whose page is closing; preferred if it survives.
* @param close - synchronous cleanup and layout removal; errors preserve focus.
*/
export function closeWithPaneFocus(document: any, sessionId: any, paneId: any, close: any) {
	const before = document.activeElement;
	const owner = before?.closest("[data-sidebar-right-session]");
	const source = before?.closest("[data-dockkit-pane], [data-dockkit-float]");
	const retain = owner?.dataset.sidebarRightSession === sessionId && (source?.dataset.dockkitPane ?? source?.dataset.dockkitFloat) === paneId;
	(0, react_dom.flushSync)(close);
	if (!retain || document.activeElement !== document.body && document.activeElement !== before) return;
	visibleSidebarPane(document, sessionId, paneId)?.focus({ preventScroll: true });
}
