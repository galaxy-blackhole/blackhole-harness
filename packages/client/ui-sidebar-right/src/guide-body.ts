/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Than tab huong dan: chuoi thay the, cua mo cac loai tab (ban goc: tabs/guide/GuideBody.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/tabs/guide/GuideBody.js
 */

import * as react_jsx_runtime from "react/jsx-runtime";
import * as _deepseek_ai_dsh_client_ui_primitives from "@galaxy-blackhole/gbh-client-ui-primitives";
import { GUIDE_BODY_CLASS } from "./css.ts";
import { CompassGlyph, CubeGlyph } from "./guide-title.ts";

/**
* The guide tab's body: a chain host, and the guide it falls back to.
*
* The chain is the replacement seam. A product with its own idea of what an
* empty sidebar should say registers into `sidebar.right.tab.guide`, and its entry
* takes the whole body; with no entry, or with every entry declining, the guide
* below renders. The shipped guide is the owner's fallback rather than a chain
* entry of its own, so there is always exactly one body and the shipped one
* cannot be outvoted by accident.
*
* The shipped guide is a muted compass over the entry capsules every
* registered type contributed, centred in the body, and nothing else — no
* heading, as a browser start page shows its doors without a caption. While
* at most four entries are listed, a capsule with a description shows it
* under the title; a longer list drops every description to stay light.
* Picking one opens that type as a page
* in this tab's place, so the guide is a doorway rather than a page that stays
* open.
*/
/** Entry count past which the guide drops the capsules' descriptions to stay light. */
const MAX_DESCRIBED_ENTRIES = 4;
/** One entry capsule: the contributing type's glyph and title, and its description while the guide is short. */
function EntryBox({ entry, described, onPick, shortcut }: any) {
	const Icon = entry.icon ?? CubeGlyph;
	const description = described ? entry.description?.() : void 0;
	return (0, react_jsx_runtime.jsxs)("button", {
		type: "button",
		className: GUIDE_BODY_CLASS.entry,
		"data-sidebar-right-guide-entry": entry.kind,
		"aria-keyshortcuts": shortcut?.aria,
		onClick: () => {
			onPick(entry);
		},
		children: [
			(0, react_jsx_runtime.jsx)("span", {
				className: GUIDE_BODY_CLASS.entryIcon,
				children: (0, react_jsx_runtime.jsx)(Icon, {
					size: description === void 0 ? 22 : 26,
					className: entry.icon === void 0 ? GUIDE_BODY_CLASS.placeholderInk : void 0
				})
			}),
			(0, react_jsx_runtime.jsxs)("span", {
				className: GUIDE_BODY_CLASS.entryText,
				children: [(0, react_jsx_runtime.jsx)("span", {
					className: GUIDE_BODY_CLASS.entryTitle,
					children: entry.title()
				}), description !== void 0 && (0, react_jsx_runtime.jsx)("span", {
					className: GUIDE_BODY_CLASS.entryDescription,
					children: description
				})]
			}),
			shortcut !== void 0 && shortcut.keys.length > 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ShortcutKeys, { keys: shortcut.keys })
		]
	});
}
/** The shipped guide: the tab's own compass over the doors out of the column. */
function ShippedGuide({ children }: any) {
	return (0, react_jsx_runtime.jsxs)("div", {
		className: GUIDE_BODY_CLASS.guide,
		"data-sidebar-right-guide": true,
		children: [(0, react_jsx_runtime.jsx)("span", {
			className: GUIDE_BODY_CLASS.hero,
			"aria-hidden": "true",
			children: (0, react_jsx_runtime.jsx)(CompassGlyph, { size: 56 })
		}), children]
	});
}
/** The guide tab's body, replaceable through its chain child. */
export function GuideBody({ useTabInfo, useGuideEntries, renderSlot, renderSlotChain, useShortcuts }: any) {
	const shortcuts = useShortcuts((entries: any) => entries);
	const { tab } = useTabInfo();
	const entries = useGuideEntries((entries: any) => entries);
	return renderSlotChain("sidebar.right.tab.guide", {}, {
		hookContext: useTabInfo,
		fallback: (0, react_jsx_runtime.jsx)(ShippedGuide, { children: entries.map((entry: any) => {
			const described = entries.length <= MAX_DESCRIBED_ENTRIES;
			const description = described ? entry.description?.() : void 0;
			return (0, react_jsx_runtime.jsx)("div", {
				className: GUIDE_BODY_CLASS.entryCell,
				children: renderSlot("sidebar.right.tab.guide.entry", {
					entryId: entry.id,
					kind: entry.kind,
					title: entry.title(),
					...description === void 0 ? {} : { description }
				}, {
					entryKey: entry.providerId,
					hookContext: useTabInfo,
					fallback: (0, react_jsx_runtime.jsx)(EntryBox, {
						entry,
						described,
						shortcut: shortcuts.find((shortcut: any) => shortcut.id === entry.commandId),
						onPick: (selected: any) => {
							tab.actions.openTab(selected.kind, { replaceTab: true });
						}
					})
				})
			}, JSON.stringify([entry.providerId, entry.id]));
		}) })
	});
}
