/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Store cua tab so sanh (chon file, split, wrap) — NGUYEN VAN ban goc
 */
import { type Any, fragment, jsx, jsxs, primitive, runtime, useId, useEffect, useMemo, useRef, useState } from "./runtime.ts";

/**
* The review tab's view state: which listed file is shown, whether hunks are
* drawn side by side, and whether long lines wrap. One bucket per tab, so two
* reviews in one session keep their own choices; the bucket ends with the
* tab record's signal.
*/
function bucket(state: Any,  tabId: Any) {
	const tab = state.byTab[tabId];
	if (tab === undefined) throw new Error(`ui-deliverables: no review state for tab "${tabId}"`);
	return tab;
}
/**
* Declare the review tab's store; the registration declares it as an
* exclusive store, so the framework mints one instance per session.
* @returns the store handle to declare on the registration.
*/
export function createReviewStore() {
	return runtime().store.defineStore({
		init: () => ({ byTab: {} }),
		actions: {
			/**
			* Apply a navigation: seed a side-by-side, unwrapped tab on its first one, then show the navigated file.
			* @param d - draft state.
			* @param tabId - the tab being drawn.
			* @param revision - the navigation revision being applied.
			* @param index - the file index the navigation named, or the current one.
			*/
			navigated: (d: Any,    tabId: Any,    revision: Any,    index: Any) => {
				const tab = d.byTab[tabId];
				if (tab === undefined) d.byTab[tabId] = {
					index,
					split: true,
					wrap: false,
					navigated: revision
				};
				else {
					tab.index = index;
					tab.navigated = revision;
				}
			},
			/**
			* Show another listed file.
			* @param d - draft state.
			* @param tabId - the tab being drawn.
			* @param index - original index in the summary's files array.
			*/
			selected: (d: Any,   tabId: Any,   index: Any) => {
				bucket(d, tabId).index = index;
			},
			/**
			* Switch between the unified and the side-by-side view.
			* @param d - draft state.
			* @param tabId - the tab being drawn.
			*/
			toggledSplit: (d: Any,  tabId: Any) => {
				const tab = bucket(d, tabId);
				tab.split = !tab.split;
			},
			/**
			* Switch line wrapping.
			* @param d - draft state.
			* @param tabId - the tab being drawn.
			*/
			toggledWrap: (d: Any,  tabId: Any) => {
				const tab = bucket(d, tabId);
				tab.wrap = !tab.wrap;
			},
			/**
			* Drop a tab's bucket once its record is gone.
			* @param d - draft state.
			* @param tabId - the tab that ended.
			*/
			forget: (d: Any,  tabId: Any) => {
				d.byTab = Object.fromEntries(Object.entries(d.byTab).filter(([id]) => id !== tabId));
			}
		}
	});
}
