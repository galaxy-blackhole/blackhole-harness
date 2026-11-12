/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		* A focus that changes nothing — a tab already active in its already-active
		* pane, a pane already active — plans nothing and records nothing, whoever
		* asks: the kit's chip click and `ctx.sidebarRight.focus` alike.
		*
		* So is page uniqueness: a pane holds at most one tab of each page kind (a tab
		* whose content is the kind's own page address — the guide, the explorer).
		* Opening a page into a pane that shows it focuses that tab, in that pane and
		* nowhere else, and a page dragged, dropped, or docked into such a pane merges
		* into the pane's own — the arriving tab closes and the pane's own is focused.
		* The kit plans none of this; it is decided here before its planners run.
		*/
		/**
		* Decide whether an explicit close may remove a tab.
		* @param surface - current surface.
		* @param tabId - tab requested for closing.
		* @returns false for a missing tab or the guide standing as the only docked tab.
		*/
		function canCloseTab(surface, tabId) {
			const tab = surface.layout.tabs[tabId];
			return tab !== void 0 && !(tab.kind === "guide" && soleDockedTab(surface.layout, tabId));
		}
		/** Build the currently selected default tab. */
		function seedRecord(id, seed) {
			const initial = seed();
			return {
				id,
				kind: initial.kind,
				title: initial.title,
				contentId: pageAddress(initial.kind)
			};
		}
		/** A mint that counts, so the surface can carry its position forward. */
		function counting(from) {
			let counter = from;
			const mint = ((prefix) => {
				counter += 1;
				return `${prefix}${counter}`;
			});
			return {
				mint,
				used: () => counter
			};
		}
		/**
		* The surface a session starts with: collapsed, one pane, no tabs. The default
		* page is not seeded here — the settle rule seeds it when the column first
		* expands still empty, so a collapsed column never holds a page nobody asked
		* for, and an open into a fresh surface shows only what it opened.
		* @returns the initial surface.
		*/
		function createSurface() {
			const counter = counting(0);
			return {
				layout: (0, _deepseek_ai_dsh_client_ui_dockkit.createInitialState)({ next: counter.mint }),
				history: _deepseek_ai_dsh_client_ui_dockkit.EMPTY_HISTORY,
				minted: counter.used()
			};
		}
		/** The tab showing `kind`'s page in a pane, if any. */
		function panePage(state, paneId, kind) {
			return (0, _deepseek_ai_dsh_client_ui_dockkit.findPaneContentTab)(state, paneId, pageAddress(kind), kind);
		}
		/**
		* The kind whose page a tab shows, or `undefined` for a resource tab. A pane
		* holds at most one page of each kind, so a page tab is never copied.
		*/
		function pageKind(state, tabId) {
			const tab = state.tabs[tabId];
			return tab !== void 0 && tab.contentId === pageAddress(tab.kind) ? tab.kind : void 0;
		}
		/**
		* Whether a tab stands alone on the docked surface: its pane is the sole docked
		* pane and holds nothing else. Floating panels do not count — they render
		* whether or not the column is expanded.
		* @param state - current layout.
		* @param tabId - the tab asked about.
		* @returns `true` for the docked surface's only tab.
		*/
		function soleDockedTab(state, tabId) {
			const pane = (0, _deepseek_ai_dsh_client_ui_dockkit.findTabPane)(state, tabId);
			return pane.host === "dock" && pane.tabs.length === 1 && (0, _deepseek_ai_dsh_client_ui_dockkit.dockPaneIds)(state).length === 1;
		}
		/** Focus a tab: nothing to plan while it is its pane's active tab and its pane is the active one. */
		function planFocusTab(state, tabId) {
			const pane = (0, _deepseek_ai_dsh_client_ui_dockkit.findTabPane)(state, tabId);
			return pane.activeTabId === tabId && state.activePaneId === pane.id ? [] : [{
				type: "focusTab",
				tabId
			}];
		}
		/** Focus a pane: nothing to plan while it is the active one. */
		function planFocusPane(state, paneId) {
			return state.activePaneId === paneId ? [] : [{
				type: "focusPane",
				paneId
			}];
		}
		/**
		* Plan a tab's arrival in a docked pane: a page arriving where its kind's page
		* already shows merges into it, anything else plans as the kit does.
		* @param state - current layout.
		* @param tabId - the arriving tab.
		* @param toPaneId - the pane it arrives in.
		* @param otherwise - the kit's plan for the move.
		* @returns the operations.
		*/
		function arriving(state, tabId, toPaneId, otherwise) {
			const kind = pageKind(state, tabId);
			if (kind === void 0) return otherwise();
			const existing = panePage(state, toPaneId, kind);
			if (existing === void 0 || existing === tabId) return otherwise();
			return [{
				type: "closeTab",
				tabId
			}, {
				type: "focusTab",
				tabId: existing
			}];
		}
		/**
		* Run one planner against a surface, settle what it left behind, and record the
		* whole intent as one history entry.
		* @param surface - the session's current surface.
		* @param plan - the kit planner to consult.
		* @param seed - the registered default page for an empty docked pane.
		* @returns the next surface, or the same one when the intent changes nothing.
		*/
		function advance(surface, plan, seed) {
			const counter = counting(surface.minted);
			const makeTab = (id) => seedRecord(id, seed);
			const planned = plan(surface.layout, counter.mint, makeTab);
			if (planned.length === 0) return surface;
			const after = (0, _deepseek_ai_dsh_client_ui_dockkit.replay)(surface.layout, planned);
			const settled = (0, _deepseek_ai_dsh_client_ui_dockkit.planSettle)(after, counter.mint, after.expanded ? makeTab : void 0);
			const stepped = (0, _deepseek_ai_dsh_client_ui_dockkit.record)(surface.history, surface.layout, [...planned, ...settled]);
			return {
				layout: stepped.state,
				history: stepped.history,
				minted: counter.used()
			};
		}
		/**
		* Replace one session's surface, leaving every other session by reference.
		*
		* A session with no surface yet gets its initial one even when the intent
		* changes nothing: materializing is itself the change.
		*/
		function seat(state, sessionId, next) {
			const existing = state.bySession[sessionId];
			const updated = next(existing ?? createSurface());
			return updated === existing ? state.bySession : {
				...state.bySession,
				[sessionId]: updated
			};
		}
		/** Step a surface through the history in one direction. */
		function stepped(surface, step) {
			const moved = step(surface.history, surface.layout);
			return moved === void 0 ? surface : {
				...surface,
				layout: moved.state,
				history: moved.history
			};
		}
		/**
		* Create the Sidebar store handle with per-Session JSON persistence in localStorage.
		*
		* The default page arrives as a thunk: a pane is seeded when a split or an
		* expansion of an empty column needs one, which can be long after the store was
		* built and in a language the user has since changed to.
		* @param seed - the registered default page, read at each mint.
		* @returns the handle (spec, type, identity, and factory in one).
		*/
		function createSidebarRightStore(seed) {
			const handle = (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({ bySession: {} }),
				actions: {
					open: (d, sessionId) => {
						d.bySession = seat(d, sessionId, (surface) => surface);
					},
					setExpanded: (d, sessionId, expanded) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state) => (0, _deepseek_ai_dsh_client_ui_dockkit.planSetExpanded)(state, expanded), seed));
					},
					toggleExpanded: (d, sessionId) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state) => (0, _deepseek_ai_dsh_client_ui_dockkit.planSetExpanded)(state, !state.expanded), seed));
					},
					setMode: (d, sessionId, mode) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state) => (0, _deepseek_ai_dsh_client_ui_dockkit.planSetMode)(state, mode), seed));
					},
					splitPane: (d, sessionId, paneId, settled) => {
						d.bySession = seat(d, sessionId, (s) => {
							const next = advance(s, (state, mint, makeTab) => (0, _deepseek_ai_dsh_client_ui_dockkit.dockPaneIds)(state).length >= 2 || (0, _deepseek_ai_dsh_client_ui_dockkit.getPane)(state, paneId ?? (0, _deepseek_ai_dsh_client_ui_dockkit.activeDockPaneId)(state)).tabs.length === 0 ? [] : (0, _deepseek_ai_dsh_client_ui_dockkit.planSplitPane)(state, mint, paneId, makeTab), seed);
							if (settled !== void 0 && next !== s) {
								const before = new Set((0, _deepseek_ai_dsh_client_ui_dockkit.dockPaneIds)(s.layout));
								for (const id of (0, _deepseek_ai_dsh_client_ui_dockkit.dockPaneIds)(next.layout)) if (!before.has(id)) settled(id);
							}
							return next;
						});
					},
					openContent: (d, sessionId, intent, settled) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state, mint) => {
							const { kind, contentId, title, replaceTab: replace } = intent;
							const ops = [...(0, _deepseek_ai_dsh_client_ui_dockkit.planSetExpanded)(state, true)];
							const replaced = replace === void 0 ? void 0 : (0, _deepseek_ai_dsh_client_ui_dockkit.findTabPane)(state, replace);
							const lent = replace !== void 0 && replaced !== void 0 && replaced.host === "dock" ? replaced : void 0;
							const paneId = lent?.id ?? intent.paneId;
							const index = lent === void 0 || replace === void 0 ? void 0 : lent.tabs.indexOf(replace);
							const page = contentId === pageAddress(kind);
							const held = page ? panePage(state, paneId ?? (0, _deepseek_ai_dsh_client_ui_dockkit.activeDockPaneId)(state), kind) : void 0;
							const revealed = page ? held : intent.revealIfOpened === false ? void 0 : (0, _deepseek_ai_dsh_client_ui_dockkit.findContentTab)(state, contentId, kind);
							let openedInNewPane;
							const split = intent.preferNewPane === true && replace === void 0 && revealed === void 0 ? (0, _deepseek_ai_dsh_client_ui_dockkit.planSplitPane)(state, mint, paneId, (id) => {
								openedInNewPane = id;
								return {
									id,
									kind,
									contentId,
									title
								};
							}) : [];
							const planned = revealed !== void 0 ? {
								ops: [{
									type: "focusTab",
									tabId: revealed
								}],
								tabId: revealed
							} : openedInNewPane !== void 0 ? {
								ops: split,
								tabId: openedInNewPane
							} : (0, _deepseek_ai_dsh_client_ui_dockkit.planOpenContent)(state, mint, {
								kind,
								contentId,
								title,
								...paneId === void 0 ? {} : { paneId },
								...index === void 0 ? {} : { index },
								...page ? { revealIfOpened: false } : intent.revealIfOpened === void 0 ? {} : { revealIfOpened: intent.revealIfOpened }
							});
							ops.push(...planned.ops);
							if (replace !== void 0 && replace !== planned.tabId) ops.push({
								type: "closeTab",
								tabId: replace
							});
							settled(planned.tabId);
							return ops;
						}, seed));
					},
					duplicateTab: (d, sessionId, tabId) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state, mint) => pageKind(state, tabId) !== void 0 ? [] : (0, _deepseek_ai_dsh_client_ui_dockkit.planDuplicateTab)(state, mint, tabId).ops, seed));
					},
					closeTab: (d, sessionId, tabId) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state) => {
							if (!canCloseTab(s, tabId)) return [];
							if (!soleDockedTab(state, tabId)) return [{
								type: "closeTab",
								tabId
							}];
							return [
								{
									type: "closeTab",
									tabId
								},
								...(0, _deepseek_ai_dsh_client_ui_dockkit.planSetMode)(state, "push"),
								...(0, _deepseek_ai_dsh_client_ui_dockkit.planSetExpanded)(state, false)
							];
						}, seed));
					},
					focusTab: (d, sessionId, tabId) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state) => planFocusTab(state, tabId), seed));
					},
					focusPane: (d, sessionId, paneId) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state) => planFocusPane(state, paneId), seed));
					},
					placeTab: (d, sessionId, tabId, toPaneId, index) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state) => arriving(state, tabId, toPaneId, () => (0, _deepseek_ai_dsh_client_ui_dockkit.planPlaceTab)(state, tabId, toPaneId, index)), seed));
					},
					dropTab: (d, sessionId, tabId, paneId, zone) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state, mint, makeTab) => {
							if (zone === "top" || zone === "bottom") return [];
							if (zone !== "center" && (0, _deepseek_ai_dsh_client_ui_dockkit.dockPaneIds)(state).length >= 2) return [];
							const plan = () => (0, _deepseek_ai_dsh_client_ui_dockkit.planDropTab)(state, mint, tabId, paneId, zone, makeTab);
							return zone === "center" ? arriving(state, tabId, paneId, plan) : plan();
						}, seed));
					},
					floatTab: (d, sessionId, tabId, rect) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state, mint) => (0, _deepseek_ai_dsh_client_ui_dockkit.planFloatTab)(state, mint, tabId, rect).ops, seed));
					},
					unfloatPane: (d, sessionId, paneId) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, (state) => {
							const floated = (0, _deepseek_ai_dsh_client_ui_dockkit.getPane)(state, paneId).tabs[0];
							const plan = () => (0, _deepseek_ai_dsh_client_ui_dockkit.planUnfloatPane)(state, paneId);
							/* v8 ignore next -- a floating pane holds exactly one tab. */
							return floated === void 0 ? plan() : arriving(state, floated, (0, _deepseek_ai_dsh_client_ui_dockkit.activeDockPaneId)(state), plan);
						}, seed));
					},
					moveFloat: (d, sessionId, paneId, x, y) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, () => [{
							type: "moveFloat",
							paneId,
							x,
							y
						}], seed));
					},
					resizeFloat: (d, sessionId, paneId, rect) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, () => [{
							type: "resizeFloat",
							paneId,
							rect
						}], seed));
					},
					resizeSplit: (d, sessionId, splitId, sizes) => {
						d.bySession = seat(d, sessionId, (s) => advance(s, () => (0, _deepseek_ai_dsh_client_ui_dockkit.planResizeSplit)(splitId, sizes, .2), seed));
					},
					undo: (d, sessionId) => {
						d.bySession = seat(d, sessionId, (s) => stepped(s, _deepseek_ai_dsh_client_ui_dockkit.stepBack));
					},
					redo: (d, sessionId) => {
						d.bySession = seat(d, sessionId, (s) => stepped(s, _deepseek_ai_dsh_client_ui_dockkit.stepForward));
					}
				}
			});
			return {
				...handle,
				create(scopeKey) {
					const instance = handle.create(scopeKey);
					if (scopeKey === void 0) return instance;
					const saved = readSidebarLayout(scopeKey);
					if (saved !== void 0) instance.store.set({ bySession: { [scopeKey]: saved } });
					instance.subscribe(() => {
						const surface = instance.getSnapshot().bySession[scopeKey];
						if (surface !== void 0) writeSidebarLayout(scopeKey, surface);
					});
					return {
						...instance,
						clearPersisted: () => {
							clearSidebarLayout(scopeKey);
						}
					};
				}
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-right/src/client/shell/SidebarRight.module.css.mjs
		const css = ".P3OORG_session{display:contents}.P3OORG_session[hidden]{display:none}.P3OORG_panel{--dsh-dockkit-dock-layer:10;--dsh-dockkit-float-layer:60;pointer-events:none;flex-direction:column;min-width:0;display:flex;position:absolute;top:0;bottom:0;right:0}.P3OORG_panel [data-dockkit-host=dock],.P3OORG_panel [data-dockkit-empty],.P3OORG_panel [data-dockkit-divider]{transform:translateX(var(--dsh-sidebar-width));visibility:hidden;transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out), visibility 0s linear var(--ds-transition-duration-slow)}.P3OORG_panel[data-sidebar-right-open] [data-dockkit-host=dock],.P3OORG_panel[data-sidebar-right-open] [data-dockkit-empty],.P3OORG_panel[data-sidebar-right-open] [data-dockkit-divider]{visibility:visible;transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out);transform:none}.P3OORG_panel[data-sidebar-right-panel=fullscreen]{--dsh-dockkit-dock-layer:40}[data-windows-titlebar] .P3OORG_panel[data-sidebar-right-panel=fullscreen]{max-width:calc(100vw - var(--dsh-windows-sidebar-width))}[data-windows-titlebar] .P3OORG_panel[data-sidebar-right-panel=fullscreen] [data-dockkit-column=\"0\"][data-dockkit-pane]{border-radius:var(--dsh-windows-content-radius) 0 0 0;corner-shape:round}[data-platform=darwin] .P3OORG_panel[data-sidebar-right-panel=fullscreen] [data-dockkit-host=dock][data-dockkit-column=\"0\"]{--dsh-dockkit-strip-inline-start:88px}[data-platform=darwin] .P3OORG_panel[data-sidebar-right-panel=fullscreen] [data-dockkit-host=dock][data-dockkit-column=\"1\"]{--dsh-dockkit-strip-inline-start:10px}[data-platform=darwin][data-fullscreen] .P3OORG_panel[data-sidebar-right-panel=fullscreen] [data-dockkit-host=dock][data-dockkit-column=\"0\"]{--dsh-dockkit-strip-inline-start:10px}@media (prefers-reduced-motion:reduce){.P3OORG_panel [data-dockkit-host=dock],.P3OORG_panel [data-dockkit-empty],.P3OORG_panel [data-dockkit-divider]{transition:none}}.P3OORG_iconButton{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);cursor:pointer;background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:6px;line-height:1;display:inline-flex}.P3OORG_iconButton svg{width:15px;height:15px}.P3OORG_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.P3OORG_collapseGlyph{transform:scaleX(-1)}.P3OORG_panelBody{flex:auto;min-height:0;display:flex}.P3OORG_unavailable{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);margin:0;padding:12px}.P3OORG_tabTitle{display:contents}.P3OORG_tabBody{flex-direction:column;min-width:0;height:100%;min-height:0;display:flex;overflow:hidden}";
		const tagId = "@deepseek-ai/dsh-client-ui-sidebar-right/SidebarRight.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-right";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SidebarRight_module_css_default = {
			"collapseGlyph": "P3OORG_collapseGlyph",
			"iconButton": "P3OORG_iconButton",
			"panel": "P3OORG_panel",
			"panelBody": "P3OORG_panelBody",
			"session": "P3OORG_session",
			"tabBody": "P3OORG_tabBody",
			"tabTitle": "P3OORG_tabTitle",
			"unavailable": "P3OORG_unavailable"
		};
		//#endregion
		//#region lib/types/client/shell/SidebarRight.js
		/**
		* The Sidebar's seat in the frame, and the panel it draws.
		*
		* The frame owns the right column's geometry; this package owns one content
		* tree at the column width or spanning the viewport. A shown wide panel
		* retains its track in fullscreen, preserving the conversation width. Below
		* 768px fullscreen is derived from viewport width, without changing manual mode.
		*
		* Docked content stays mounted while collapsed, translated off the frame's right
		* edge, so opening and closing are one gesture in both presentations: a slide
		* from and to that edge. Normal presentation moves the frame's tracks with
		* the panel. A fullscreen opening reserves its underlying track only after
		* the panel covers the frame, without animating those hidden columns.
		*
		* The panel has no header of its own: its two controls — presentation switch
		* and collapse — ride the docking kit's chrome seat at the end of the top-right
		* pane's tab strip, so the strip is the panel's whole top edge. The way back in
		* while collapsed is not here either: it is one button in the conversation
		* header (`ExpandButton.tsx`), because it exists only while this panel is
		* hidden. Floating panels remain in the same content tree; untransformed
		* ancestors let their fixed-position frames cross the column and conversation.
		*
		* Tab bodies do not live here. Each one is a registration under its type's kind,
		* dispatched through the keyed `sidebar.right.pane.tab` seat (and a live chip
		* title through `sidebar.right.pane.tab.title`), so a new tab type needs no edit
		* to this file. What a body receives beyond the record — navigation, lifetime
		* signal, actions — is read through the slot-owned useTabInfo hook. The Tab
		* domain follows each session's store commits, including sessions off screen.
		*/
		/** The guide tab one pane holds, if any: a pane holds at most one. */
		function guideIn(layout, paneId) {
			return (0, _deepseek_ai_dsh_client_ui_dockkit.findPaneContentTab)(layout, paneId, pageAddress(GUIDE_KIND), GUIDE_KIND);
		}
		/**
		* Build the kit's intent face for one session out of the store's actions.
		* @param sessionId - the session the seat draws; every action is bound to it.
		* @param actions - the seat's bound store actions.
export {};
