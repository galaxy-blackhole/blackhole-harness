/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					live.controllers.delete(binding);
				}, "slash: session controller");
				return controller;
			}
			sessions() {
				const sessions = this.ctx.get("sessions");
				if (sessions === void 0) throw new Error("ui-input-trigger: sessions service unavailable");
				return sessions;
			}
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-input-trigger/src/client/MenuView.module.css.mjs
		const css = "._3e4SsG_menu{z-index:100;box-sizing:border-box;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);--dsh-scrollbar-width:6px;--dsh-scrollbar-thumb-border:2px;--dsh-scrollbar-track-margin:12px;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);max-height:400px;box-shadow:var(--dsw-elevation-prominent);border:0;flex-direction:column;padding:4px;display:flex;position:absolute;bottom:calc(100% + 4px);left:0;right:0;overflow:hidden}._3e4SsG_menu[data-overflow-below]:after{content:\"\";background:linear-gradient(to bottom, transparent, var(--dsw-specific-menu));pointer-events:none;height:16px;position:absolute;bottom:4px;left:4px;right:14px}._3e4SsG_viewport{flex-direction:column;min-height:0;display:flex;overflow-y:auto}._3e4SsG_item{border-radius:var(--dsw-radius-md);cursor:pointer;width:100%;min-height:34px;color:var(--dsw-alias-label-primary);text-align:left;background:0 0;border:none;align-items:center;gap:6px;padding:6px 8px;font-size:13px;line-height:20px;display:flex}._3e4SsG_item._3e4SsG_active{background:var(--dsw-alias-interactive-bg-hover)}._3e4SsG_sectionTitle{min-height:23px;color:var(--dsw-alias-label-tertiary);flex:none;padding:5px 8px 2px;font-size:11px;font-weight:500;line-height:16px}._3e4SsG_sectionTitle:not(:first-child){margin-top:3px}._3e4SsG_itemIcon{width:14px;height:14px;color:var(--dsw-alias-menu-icon);flex:none;justify-content:center;align-items:center;display:inline-flex}._3e4SsG_itemIcon svg{width:14px;height:14px}._3e4SsG_itemName{text-overflow:ellipsis;white-space:nowrap;flex:none;max-width:40%;overflow:hidden}._3e4SsG_itemAlias{text-overflow:ellipsis;white-space:nowrap;max-width:20%;color:var(--dsw-alias-label-tertiary);flex:none;font-size:12px;line-height:18px;overflow:hidden}._3e4SsG_itemDescription{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:var(--dsw-alias-label-tertiary);flex:1;font-size:12px;line-height:18px;overflow:hidden}._3e4SsG_trailing{flex:none;align-items:center;gap:3px;margin-left:auto;display:inline-flex}._3e4SsG_drillHintText{color:var(--dsw-alias-label-caption);white-space:nowrap;font-size:10px;line-height:16px;display:none}._3e4SsG_drillHint{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-caption);padding:0 4px;font-family:inherit;font-size:10px;line-height:16px;display:none}._3e4SsG_item._3e4SsG_active ._3e4SsG_drillHintText,._3e4SsG_item._3e4SsG_active ._3e4SsG_drillHint{display:inline-flex}._3e4SsG_drill{border-radius:var(--dsw-radius-xs);width:18px;height:18px;color:var(--dsw-alias-menu-icon);flex:none;place-items:center;display:inline-grid}._3e4SsG_drill:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._3e4SsG_groupTitle{color:var(--dsw-alias-label-tertiary);padding:6px 8px;font-size:11px;line-height:15px}._3e4SsG_skeletonRow{box-sizing:border-box;align-items:center;min-height:34px;padding:6px 8px;display:flex}._3e4SsG_skeletonBar{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-skeleton);height:18px;animation:2s cubic-bezier(.36,0,.64,1) infinite _3e4SsG_dsh-menu-skeleton}@keyframes _3e4SsG_dsh-menu-skeleton{0%{opacity:1}40%{opacity:.6}80%,to{opacity:1}}._3e4SsG_crumbs{border-bottom:.5px solid var(--dsw-alias-border-l1);flex-wrap:wrap;flex:none;align-items:center;gap:2px;margin-bottom:2px;padding:3px 3px 5px;display:flex}._3e4SsG_crumb{border-radius:var(--dsw-radius-sm);max-width:40%;color:var(--dsw-alias-label-tertiary);cursor:pointer;text-overflow:ellipsis;white-space:nowrap;background:0 0;border:none;flex:0 auto;padding:2px 5px;font-family:inherit;font-size:11px;line-height:16px;overflow:hidden}._3e4SsG_crumb:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._3e4SsG_crumbCurrent,._3e4SsG_crumbCurrent:hover{color:var(--dsw-alias-label-primary);cursor:default;background:0 0}._3e4SsG_crumbSeparator{color:var(--dsw-alias-menu-icon);flex:none;display:inline-flex}";
		const tagId = "@deepseek-ai/dsh-client-ui-input-trigger/MenuView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-input-trigger";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var MenuView_module_css_default = {
			"active": "_3e4SsG_active",
			"crumb": "_3e4SsG_crumb",
			"crumbCurrent": "_3e4SsG_crumbCurrent",
			"crumbSeparator": "_3e4SsG_crumbSeparator",
			"crumbs": "_3e4SsG_crumbs",
			"drill": "_3e4SsG_drill",
			"drillHint": "_3e4SsG_drillHint",
			"drillHintText": "_3e4SsG_drillHintText",
			"dsh-menu-skeleton": "_3e4SsG_dsh-menu-skeleton",
			"groupTitle": "_3e4SsG_groupTitle",
			"item": "_3e4SsG_item",
			"itemAlias": "_3e4SsG_itemAlias",
			"itemDescription": "_3e4SsG_itemDescription",
			"itemIcon": "_3e4SsG_itemIcon",
			"itemName": "_3e4SsG_itemName",
			"menu": "_3e4SsG_menu",
			"sectionTitle": "_3e4SsG_sectionTitle",
			"skeletonBar": "_3e4SsG_skeletonBar",
			"skeletonRow": "_3e4SsG_skeletonRow",
			"trailing": "_3e4SsG_trailing",
			"viewport": "_3e4SsG_viewport"
		};
		//#endregion
		//#region lib/types/client/MenuView.js
		/**
		* Trigger candidate menu: renders the InputTriggerService menu store into the
		* conversation.input.overlay anchor. Closed state renders null (the overlay
		* slot stays mounted); groups render in roster order under localized title
		* rows. A pending group keeps showing the items it already had (the reducer
		* retains them across a query refinement) and falls back to two skeleton
		* rows only while it has none; pointer picks route back through
		* the service (combobox pattern — focus never leaves the textarea, so rows
		* are mousedown-handled and the highlight is exposed via
		* aria-activedescendant on the listbox). A row reads title, then the
		* command-name alias when the title is not the name in another letter case
		* (a localized title), then the description right-aligned. A source publishing crumbs gets a breadcrumb
		* header pinned above the scrolling list.
		*/
		/** Height cap that fits the two headings and eight built-in command rows. */
		const MAX_HEIGHT = 400;
		/**
		* Viewport top margin: the conversation header's 76px block (title row plus
		* view tabs, ui-conversation) plus 8px of air, so a tall list stops below the
		* header instead of sliding under it.
		*/
		const TOP_MARGIN = 84;
		/** DOM id of one option row (the aria-activedescendant target). */
		function optionId(source, index) {
			return `dsh-slash-option-${source}-${index}`;
		}
		/**
		* Render the candidate menu overlay entry.
		* @param props - injected face (the menu store and the pick route); `t` rides the standard locale seat.
		* @returns the dropdown while open; null while closed.
		*/
		function MenuView({ menu, headers, onPick, onCrumb, onHover, onDismiss, t }) {
			const state = (0, react.useSyncExternalStore)((fn) => menu.subscribe(fn), () => menu.getSnapshot());
			const crumbs = (0, react.useSyncExternalStore)((fn) => headers.subscribe(fn), () => headers.getSnapshot());
			const listRef = (0, react.useRef)(null);
			const viewportRef = (0, react.useRef)(null);
			const [hasOverflowBelow, setHasOverflowBelow] = (0, react.useState)(false);
			const maxHeight = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredMaxHeight)(listRef, MAX_HEIGHT, state, TOP_MARGIN);
			const updateOverflowHint = (0, react.useCallback)(() => {
				const viewport = viewportRef.current;
				setHasOverflowBelow(viewport !== null && viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1);
			}, []);
			(0, react.useLayoutEffect)(() => {
				updateOverflowHint();
			}, [
				state,
				maxHeight,
				updateOverflowHint
			]);
			const highlight = state.open ? state.highlight : null;
			(0, react.useEffect)(() => {
				if (highlight === null) return;
				document.getElementById(optionId(highlight.source, highlight.index))?.scrollIntoView({ block: "nearest" });
			}, [highlight]);
			(0, react.useEffect)(() => {
				if (!state.open) return;
				const onPointerDown = (ev) => {
					if (!(ev.target instanceof Node)) return;
					if (listRef.current?.contains(ev.target)) return;
					if ((listRef.current?.closest("[data-composer-card]"))?.contains(ev.target)) return;
					onDismiss();
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
				};
			}, [state.open, onDismiss]);
			if (!state.open) return null;
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.MenuSurface, {
				ref: listRef,
				className: MenuView_module_css_default.menu,
				style: { maxHeight },
				"data-trigger-menu": "",
				"data-overflow-below": hasOverflowBelow || void 0,
				children: [state.groups.map((group) => {
					const trail = crumbs.get(group.source);
					return trail === void 0 ? null : (0, react_jsx_runtime.jsx)("nav", {
						className: MenuView_module_css_default.crumbs,
						"aria-label": t("crumbs.aria"),
						children: trail.map((crumb, index) => (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [index > 0 && (0, react_jsx_runtime.jsx)("span", {
							className: MenuView_module_css_default.crumbSeparator,
							"aria-hidden": true,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: clsx(MenuView_module_css_default.crumb, crumb.current === true && MenuView_module_css_default.crumbCurrent),
							"aria-current": crumb.current === true ? "location" : void 0,
							disabled: crumb.current === true,
							onMouseDown: (ev) => {
								ev.preventDefault();
								onCrumb(group.source, index);
							},
							children: crumb.label
						})] }, `${String(index)}-${crumb.value}`))
					}, group.source);
				}), (0, react_jsx_runtime.jsx)("div", {
					ref: viewportRef,
					className: MenuView_module_css_default.viewport,
					role: "listbox",
					"aria-label": t("suggestions.aria"),
					"aria-activedescendant": highlight !== null ? optionId(highlight.source, highlight.index) : void 0,
					onScroll: updateOverflowHint,
					children: state.groups.map((group) => group.status === "ready" && group.items.length === 0 ? null : (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [group.showGroupTitle === false || group.items.some((item) => item.section !== void 0) ? null : (0, react_jsx_runtime.jsx)("div", {
						className: MenuView_module_css_default.groupTitle,
						role: "presentation",
						"data-source": group.source,
						children: t(group.source)
					}), group.status === "pending" && group.items.length === 0 ? (0, react_jsx_runtime.jsxs)("div", {
						role: "status",
						"aria-label": t("loading"),
						"data-source": group.source,
						children: [(0, react_jsx_runtime.jsx)("div", {
							className: MenuView_module_css_default.skeletonRow,
							children: (0, react_jsx_runtime.jsx)("span", {
								className: MenuView_module_css_default.skeletonBar,
								style: { width: "32%" }
							})
						}), (0, react_jsx_runtime.jsx)("div", {
							className: MenuView_module_css_default.skeletonRow,
							children: (0, react_jsx_runtime.jsx)("span", {
								className: MenuView_module_css_default.skeletonBar,
								style: { width: "48%" }
							})
						})]
					}) : group.items.map((item, index) => {
						const active = highlight !== null && highlight.source === group.source && highlight.index === index;
						return (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [item.section !== void 0 && item.section !== group.items[index - 1]?.section ? (0, react_jsx_runtime.jsx)("div", {
							className: MenuView_module_css_default.sectionTitle,
							role: "presentation",
							children: item.section
						}) : null, (0, react_jsx_runtime.jsxs)("button", {
							id: optionId(group.source, index),
							type: "button",
							role: "option",
							"aria-selected": active,
							className: clsx(MenuView_module_css_default.item, active && MenuView_module_css_default.active),
							onMouseDown: (ev) => {
								ev.preventDefault();
								onPick(group.source, index);
							},
							onMouseMove: active ? void 0 : () => {
								onHover(group.source, index);
							},
							children: [
								item.icon !== void 0 && (0, react_jsx_runtime.jsx)("span", {
									className: MenuView_module_css_default.itemIcon,
									"aria-hidden": true,
									children: typeof item.icon === "string" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ReferenceIconRegular, {
										kind: item.icon,
										size: 14
									}) : (0, react_jsx_runtime.jsx)(item.icon, { size: 14 })
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: MenuView_module_css_default.itemName,
									children: item.label ?? item.name
								}),
								item.label !== void 0 && item.label.toLowerCase() !== item.name.toLowerCase() && (0, react_jsx_runtime.jsx)("span", {
									className: MenuView_module_css_default.itemAlias,
									children: item.name
								}),
								item.description !== void 0 && (0, react_jsx_runtime.jsx)("span", {
									className: MenuView_module_css_default.itemDescription,
									children: item.description
								}),
								item.drill === true && (0, react_jsx_runtime.jsxs)("span", {
									className: MenuView_module_css_default.trailing,
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											className: MenuView_module_css_default.drillHintText,
											"aria-hidden": true,
											children: t("drill.hint")
										}),
										(0, react_jsx_runtime.jsx)("kbd", {
											className: MenuView_module_css_default.drillHint,
											"aria-hidden": true,
											children: t("drill.key")
										}),
										(0, react_jsx_runtime.jsx)("span", {
											role: "button",
											"aria-label": t("drill.aria"),
											className: MenuView_module_css_default.drill,
											onMouseDown: (ev) => {
												ev.preventDefault();
												ev.stopPropagation();
												onPick(group.source, index, "drill");
											},
											children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { size: 12 })
										})
									]
								})
							]
						})] }, optionId(group.source, index));
					})] }, group.source))
				})]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/**
		* `slash.menu` namespace dictionaries: group titles keyed by source name
		* (the lookup chain returns the key itself, so an unknown source shows its
		* raw name), the pending row, and the listbox and header aria labels.
		*/
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"command": "指令",
			"skill": "技能",
			"subagent": "子智能体",
			"loading": "正在加载…",
			"drill.aria": "进入目录",
			"drill.hint": "进入目录",
			"drill.key": "Tab",
			"crumbs.aria": "目录导航",
			"suggestions.aria": "触发候选建议"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"command": "Commands",
			"skill": "Skills",
			"subagent": "Subagents",
			"loading": "Loading…",
			"drill.aria": "Browse folder",
			"drill.hint": "Browse folder",
			"drill.key": "Tab",
			"crumbs.aria": "Folder navigation",
			"suggestions.aria": "Trigger suggestions"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Namespace owning the candidate-menu copy. */
		const MENU_NS = "slash.menu";
		/** Required services: controller resolution reads the session scope tree; the menu copy is localized. */
		const inject = ["sessions", "locale"];
		/**
		* Client plugin body: mount the service, then register MenuView into the
		* input overlay once its declarer is up.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.plugin(InputTriggerService);
			ctx.effect(() => ctx.locale.register(MENU_NS, {
				zh,
				en
			}), "ui-input-trigger: menu dictionaries");
			ctx.inject([
				"slots",
				"inputTriggers",
				"sessions"
			], (scope) => {
				const inputTriggers = scope.inputTriggers;
				const sessions = scope.sessions;
				scope.slots.inject("conversation.input.overlay", () => scope.slots.register({
					name: "conversation.input.overlay",
					id: "slash-menu",
					order: 0,
					locale: MENU_NS,
					inject: (sessionId) => {
						const actx = sessions.scope(sessionId);
						if (actx === void 0) throw new Error(`ui-input-trigger: session "${String(sessionId)}" resolved no scope`);
						const controller = inputTriggers.sessionOf(actx);
						return {
							menu: controller.menu,
							headers: controller.headers,
							onPick: (source, index, action) => {
								controller.pick(source, index, action);
							},
							onCrumb: (source, index) => {
								controller.pickCrumb(source, index);
							},
							onHover: (source, index) => {
								controller.hover(source, index);
							},
							onDismiss: () => {
								controller.dismiss();
							}
						};
					}
				}, MenuView));
			});
		}
		//#endregion
		exports.InputTriggerController = InputTriggerController;
		exports.InputTriggerService = InputTriggerService;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
