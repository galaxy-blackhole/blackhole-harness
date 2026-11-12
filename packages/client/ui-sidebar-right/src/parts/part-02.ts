/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		* The cube: an isometric box — hexagonal silhouette, the top face's two edges,
		* and the front seam — in straight strokes with softly rounded joins, on
		* `currentColor`. The guide body draws it in a capsule whose type registered
		* no glyph of its own.
		* @param props - rendered size and class.
		* @returns the cube glyph.
		*/
		function CubeGlyph({ size = 16, className }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				className,
				children: [(0, react_jsx_runtime.jsx)("path", {
					d: "M7.99998 2.5L12.9 5.2V10.8L7.99998 13.5L3.09998 10.8V5.2L7.99998 2.5Z",
					stroke: "currentColor",
					strokeLinejoin: "round"
				}), (0, react_jsx_runtime.jsx)("path", {
					d: "M3.09998 5.19995L7.99998 7.89995M7.99998 7.89995L12.9 5.19995M7.99998 7.89995V13.5",
					stroke: "currentColor",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})]
			});
		}
		/**
		* The title as the chip and a floating panel's header show it.
		* @param props - the tab information hook.
		* @returns the compass followed by the tab's title text.
		*/
		function GuideTitle({ useTabInfo }) {
			const { tab } = useTabInfo();
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(CompassGlyph, { className: GuideBody_module_css_default.titleIcon }), tab.title] });
		}
		//#endregion
		//#region lib/types/client/tabs/guide/GuideBody.js
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
		function EntryBox({ entry, described, onPick, shortcut }) {
			const Icon = entry.icon ?? CubeGlyph;
			const description = described ? entry.description?.() : void 0;
			return (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: GuideBody_module_css_default.entry,
				"data-sidebar-right-guide-entry": entry.kind,
				"aria-keyshortcuts": shortcut?.aria,
				onClick: () => {
					onPick(entry);
				},
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: GuideBody_module_css_default.entryIcon,
						children: (0, react_jsx_runtime.jsx)(Icon, {
							size: description === void 0 ? 22 : 26,
							className: entry.icon === void 0 ? GuideBody_module_css_default.placeholderInk : void 0
						})
					}),
					(0, react_jsx_runtime.jsxs)("span", {
						className: GuideBody_module_css_default.entryText,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: GuideBody_module_css_default.entryTitle,
							children: entry.title()
						}), description !== void 0 && (0, react_jsx_runtime.jsx)("span", {
							className: GuideBody_module_css_default.entryDescription,
							children: description
						})]
					}),
					shortcut !== void 0 && shortcut.keys.length > 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ShortcutKeys, { keys: shortcut.keys })
				]
			});
		}
		/** The shipped guide: the tab's own compass over the doors out of the column. */
		function ShippedGuide({ children }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: GuideBody_module_css_default.guide,
				"data-sidebar-right-guide": true,
				children: [(0, react_jsx_runtime.jsx)("span", {
					className: GuideBody_module_css_default.hero,
					"aria-hidden": "true",
					children: (0, react_jsx_runtime.jsx)(CompassGlyph, { size: 56 })
				}), children]
			});
		}
		/** The guide tab's body, replaceable through its chain child. */
		function GuideBody({ useTabInfo, useGuideEntries, renderSlot, renderSlotChain, useShortcuts }) {
			const shortcuts = useShortcuts((entries) => entries);
			const { tab } = useTabInfo();
			const entries = useGuideEntries((entries) => entries);
			return renderSlotChain("sidebar.right.tab.guide", {}, {
				hookContext: useTabInfo,
				fallback: (0, react_jsx_runtime.jsx)(ShippedGuide, { children: entries.map((entry) => {
					const described = entries.length <= MAX_DESCRIBED_ENTRIES;
					const description = described ? entry.description?.() : void 0;
					return (0, react_jsx_runtime.jsx)("div", {
						className: GuideBody_module_css_default.entryCell,
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
								shortcut: shortcuts.find((shortcut) => shortcut.id === entry.commandId),
								onPick: (selected) => {
									tab.actions.openTab(selected.kind, { replaceTab: true });
								}
							})
						})
					}, JSON.stringify([entry.providerId, entry.id]));
				}) })
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-right/src/client/shell/ExpandButton.module.css.mjs
		const css$1 = "._1kL45W_button{width:28px;color:var(--dsw-alias-label-secondary);flex:none;padding:0}._1kL45W_button svg{width:15px;height:15px}._1kL45W_icon{transform:scaleX(-1)}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-sidebar-right/ExpandButton.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-right";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ExpandButton_module_css_default = {
			"button": "_1kL45W_button",
			"icon": "_1kL45W_icon"
		};
		//#endregion
		//#region lib/types/client/shell/ExpandButton.js
		/** The expand control while the panel is collapsed; nothing while it is shown. */
		function ExpandButton({ sessionId, useStore, actions, t, useShortcuts }) {
			const shortcut = useShortcuts((entries) => entries.find((entry) => entry.id === "sidebar.right.toggle"));
			if (useStore((state) => state.bySession[sessionId]?.layout.expanded ?? false)) return null;
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: t("chrome.expand"),
				shortcutKeys: shortcut?.keys,
				side: "bottom",
				delayMs: 500,
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					size: "sm",
					className: ExpandButton_module_css_default.button,
					"aria-label": t("chrome.expandAria"),
					"aria-keyshortcuts": shortcut?.aria,
					"data-sidebar-right-expand": true,
					onClick: () => {
						actions.setExpanded(sessionId, true);
					},
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutlineRegular, { className: ExpandButton_module_css_default.icon })
				})
			});
		}
		//#endregion
		//#region lib/types/client/contract/seed.js
		/**
		* Resolve the default page from the registered entry count.
		* @param tabs - current tab registry.
		* @returns the sole entry, or the guide when there are zero or multiple entries.
		*/
		function defaultSeed(tabs) {
			const [only, ...others] = tabs.guide();
			const kind = only !== void 0 && others.length === 0 ? only.kind : GUIDE_KIND;
			const definition = tabs.get(kind);
			if (definition === void 0) throw new Error(`sidebarRight: default tab kind "${kind}" is not registered`);
			return {
				kind,
				title: definition.title(pageAddress(kind))
			};
		}
		/** The guide tab's kind. */
		const GUIDE_KIND = "guide";
		/**
		* The address a page tab is recorded under: `sidebar://<kind>`. The scheme is
		* this package's bookkeeping for `openTab`, spelled here and nowhere else; a
		* caller names the kind and never sees or composes the address.
		* @param kind - the page type's kind.
		* @returns the page's address.
		*/
		function pageAddress(kind) {
			return `sidebar://${kind}`;
		}
		//#endregion
		//#region lib/types/client/labels.js
		/**
		* Project the dictionary into the kit's label contract.
		*
		* Called during render, so a language change reaches the kit with the next one —
		* the kit caches no copy to invalidate.
		* @param t - namespace-bound translate.
		* @param split - effective split binding, when available.
		* @param close - effective page-close binding, when available.
		* @returns every string the kit renders.
		*/
		function dockLabels(t, split, close) {
			return {
				emptyPane: t("dock.emptyPane"),
				splitPane: t("dock.splitPane"),
				splitPaneShortcut: split?.aria,
				splitPaneKeys: split?.keys,
				splitPaneDisabled: t("dock.splitPaneDisabled"),
				splitPaneNarrow: t("dock.splitPaneNarrow"),
				closeTab: t("dock.closeTab"),
				closeTabShortcut: close?.aria,
				closeTabKeys: close?.keys,
				addTab: t("dock.addTab"),
				dockFloat: t("dock.dockFloat"),
				closeFloat: t("dock.closeFloat"),
				dropZone: {
					center: t("dock.drop.center"),
					left: t("dock.drop.left"),
					right: t("dock.drop.right"),
					top: t("dock.drop.top"),
					bottom: t("dock.drop.bottom")
				}
			};
		}
		//#endregion
		//#region lib/types/client/persistence.js
		/** Validated current-layout snapshots; undo history belongs to the live window. */
		/** Persistence namespace shared by scoped stores and startup discovery. */
		const sidebarPersistence = "dsh.sidebar-right.v1";
		const paneId = zod.z.string().regex(/^(?:pane|float)[1-9][0-9]*$/u);
		const splitId = zod.z.string().regex(/^split[1-9][0-9]*$/u);
		const tabId = zod.z.string().regex(/^tab[1-9][0-9]*$/u);
		const nodeId = zod.z.union([paneId, splitId]);
		const rectangle = zod.z.object({
			x: zod.z.number(),
			y: zod.z.number(),
			width: zod.z.number().positive(),
			height: zod.z.number().positive()
		});
		const node = zod.z.discriminatedUnion("kind", [zod.z.object({
			kind: zod.z.literal("pane"),
			id: paneId,
			host: zod.z.enum(["dock", "float"]),
			tabs: zod.z.array(tabId),
			activeTabId: tabId.optional(),
			rect: rectangle.optional()
		}), zod.z.object({
			kind: zod.z.literal("split"),
			id: splitId,
			axis: zod.z.enum(["row", "column"]),
			children: zod.z.array(nodeId).min(2),
			sizes: zod.z.array(zod.z.number().positive()).min(2)
		})]);
		const layout = zod.z.object({
			nodes: zod.z.record(nodeId, node),
			tabs: zod.z.record(tabId, zod.z.object({
				id: tabId,
				kind: zod.z.string().min(1),
				contentId: zod.z.string().min(1),
				title: zod.z.string()
			})),
			rootId: nodeId,
			floats: zod.z.array(paneId),
			activePaneId: paneId,
			expanded: zod.z.boolean(),
			mode: zod.z.enum(["push", "fullscreen"])
		});
		const surface = zod.z.object({
			layout,
			minted: zod.z.int().nonnegative()
		});
		const envelope = zod.z.object({ bySession: zod.z.record(zod.z.string(), zod.z.unknown()) });
		function validateReferences(value) {
			const { layout, minted } = value;
			const reject = () => {
				throw new Error("Invalid saved sidebar layout references");
			};
			const visited = /* @__PURE__ */ new Set();
			const usedTabs = /* @__PURE__ */ new Set();
			const pending = [{
				id: layout.rootId,
				host: "dock"
			}, ...layout.floats.map((id) => ({
				id,
				host: "float"
			}))];
			for (const [id, entry] of [...Object.entries(layout.nodes), ...Object.entries(layout.tabs)]) if (entry.id !== id || Number(id.replace(/^[a-z]+/u, "")) > minted) reject();
			for (const { id, host } of pending) {
				const entry = layout.nodes[id];
				if (visited.has(id) || entry === void 0) reject();
				visited.add(id);
				if (entry.kind === "split") {
					if (host !== "dock" || id !== layout.rootId || entry.axis !== "row" || entry.children.length !== 2 || entry.children.length !== entry.sizes.length || Math.abs(entry.sizes.reduce((sum, size) => sum + size, 0) - 1) > 1e-9) reject();
					pending.push(...entry.children.map((id) => ({
						id,
						host
					})));
				} else {
					if (entry.host !== host || (host === "float" ? entry.rect === void 0 || entry.tabs.length !== 1 : entry.rect !== void 0)) reject();
					if (entry.tabs.length === 0 ? entry.activeTabId !== void 0 : !entry.tabs.includes(entry.activeTabId ?? "")) reject();
					for (const tab of entry.tabs) {
						if (usedTabs.has(tab) || layout.tabs[tab] === void 0) reject();
						usedTabs.add(tab);
					}
				}
			}
			if (visited.size !== Object.keys(layout.nodes).length || usedTabs.size !== Object.keys(layout.tabs).length || layout.nodes[layout.activePaneId]?.kind !== "pane") reject();
		}
		/**
		* Restore one validated Session layout with a fresh in-window undo history.
		* @param sessionId - storage scope.
		* @returns the saved surface, or undefined when absent, inaccessible or invalid.
		*/
		function readSidebarLayout(sessionId) {
			if (typeof localStorage === "undefined") return void 0;
			let raw;
			try {
				raw = localStorage.getItem(`${sidebarPersistence}.${sessionId}`);
			} catch (_storageUnavailable) {
				return;
			}
			if (raw === null) return void 0;
			try {
				const saved = envelope.parse(JSON.parse(raw)).bySession[sessionId];
				if (saved === void 0) return void 0;
				const parsed = surface.parse(saved);
				validateReferences(parsed);
				return {
					layout: parsed.layout,
					minted: parsed.minted,
					history: _deepseek_ai_dsh_client_ui_dockkit.EMPTY_HISTORY
				};
			} catch (_invalidLayout) {
				clearSidebarLayout(sessionId);
				return;
			}
		}
		/**
		* Persist current layout and identity allocation without retaining undo entries.
		* @param sessionId - storage scope.
		* @param surface - current in-memory surface.
		*/
		function writeSidebarLayout(sessionId, surface) {
			if (typeof localStorage === "undefined") return;
			const saved = { bySession: { [sessionId]: {
				layout: surface.layout,
				minted: surface.minted
			} } };
			try {
				localStorage.setItem(`${sidebarPersistence}.${sessionId}`, JSON.stringify(saved));
			} catch (error) {
				console.error("Sidebar layout persistence failed:", error);
			}
		}
		/**
		* Remove only one Session's persisted layout.
		* @param sessionId - storage scope to discard.
		*/
		function clearSidebarLayout(sessionId) {
			if (typeof localStorage === "undefined") return;
			try {
				localStorage.removeItem(`${sidebarPersistence}.${sessionId}`);
			} catch (_storageUnavailable) {}
		}
		//#endregion
		//#region lib/types/client/stores.js
		/**
		* The store shell over the docking kit: one surface per session, held as plain
		* data so the kit's pure functions are the only thing that ever computes a
		* layout.
		*
		* Every action follows the same steps — mint the ids the intent needs, ask the
		* kit's planner what operations carry it out, let the settle planner keep every
		* pane populated, record it all as one history entry — and then assigns the
		* session's whole surface back in one go. Nothing here reaches into a draft to
		* edit a layout in place, which is what keeps the kit testable without a store
		* and keeps snapshot identity honest.
		*
		* The settle step is this product's rule, not the kit's: an intent never leaves
		* an expanded column with an empty pane — emptied side panes merge away, and an
		* empty root pane seeds the default page. A collapsed column may stand empty;
		* the seed waits for the expansion that would otherwise show nothing.
		*
export {};
