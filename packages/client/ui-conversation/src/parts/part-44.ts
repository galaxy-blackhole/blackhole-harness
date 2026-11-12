/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				"sessions",
				"uiConversation"
			],
			apply(ctx) {
				ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
					name: "conversation.input.dock",
					id: "queue",
					order: 20,
					locale: NS,
					inject: (sessionId) => {
						const actx = ctx.sessions.scope(sessionId);
						if (actx === void 0) throw new Error(`queue dock: session "${sessionId}" resolved no scope`);
						const conversation = actx.get("conversation");
						if (conversation === void 0) throw new Error("queue dock: conversation service unavailable");
						return {
							updateQueue: (itemId, action) => conversation.updateQueue(itemId, action),
							notify: (level, text) => {
								conversation.input.for(actx).notify(level, text);
							},
							loadImage: (attachment) => ctx.uiConversation.imageUrl(sessionId, attachment)
						};
					}
				}, QueueDock));
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-conversation/src/client/settings/EnterBehaviorRow.module.css.mjs
		const css$5 = ".T1PP_q_row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}.T1PP_q_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.T1PP_q_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.T1PP_q_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}.T1PP_q_selector{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.T1PP_q_selector:hover{background:var(--dsw-alias-interactive-bg-hover)}.T1PP_q_chevron{flex:none}";
		const tagId$5 = "@deepseek-ai/dsh-client-ui-conversation/EnterBehaviorRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var EnterBehaviorRow_module_css_default = {
			"chevron": "T1PP_q_chevron",
			"desc": "T1PP_q_desc",
			"row": "T1PP_q_row",
			"rowText": "T1PP_q_rowText",
			"selector": "T1PP_q_selector",
			"title": "T1PP_q_title"
		};
		//#endregion
		//#region lib/types/client/settings/EnterBehaviorRow.js
		/** General Settings row for the Composer's busy-state Enter preference. */
		const OPTIONS = [{
			id: "queue",
			label: "settings.enter.queue"
		}, {
			id: "steer",
			label: "settings.enter.steer"
		}];
		/**
		* Render the busy-state Enter behavior selector.
		* @param props - composed Settings slot props.
		* @returns the preference row.
		*/
		function EnterBehaviorRow({ useBusyEnter, setBusyEnter, t }) {
			const behavior = useBusyEnter((value) => value);
			const [open, setOpen] = (0, react.useState)(false);
			const selectedLabel = behavior === "queue" ? "settings.enter.queue" : "settings.enter.steer";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: EnterBehaviorRow_module_css_default.row,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: EnterBehaviorRow_module_css_default.rowText,
					children: [(0, react_jsx_runtime.jsx)("div", {
						className: EnterBehaviorRow_module_css_default.title,
						children: t("settings.enter.title")
					}), (0, react_jsx_runtime.jsx)("div", {
						className: EnterBehaviorRow_module_css_default.desc,
						children: t("settings.enter.description")
					})]
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open,
					onClose: () => {
						setOpen(false);
					},
					items: OPTIONS.map((option) => ({
						id: option.id,
						label: t(option.label)
					})),
					selectedId: behavior,
					onSelect: (id) => {
						setOpen(false);
						setBusyEnter(id);
					},
					align: "end",
					portal: true,
					anchor: (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: EnterBehaviorRow_module_css_default.selector,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						onClick: () => {
							setOpen((value) => !value);
						},
						children: [t(selectedLabel), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: EnterBehaviorRow_module_css_default.chevron })]
					})
				})]
			});
		}
		//#endregion
		//#region lib/types/client/contract/snapshot.js
		/** Empty Conversation value used before a Session binding is available. */
		const EMPTY_CONVERSATION_SNAPSHOT = {
			views: {
				get: () => void 0,
				grouped: () => void 0
			},
			activeTargets: /* @__PURE__ */ new Set()
		};
		/**
		* Resolve the shell phase without adding Conversation data to the Session snapshot.
		* @param session - current Session lifecycle state.
		* @param conversation - current target-neutral Conversation state.
		* @returns the phase used by the header, View ring, and composer layout.
		*/
		function conversationPhase(session, conversation) {
			return conversation.activeTargets.size > 0 || !session.blank && !session.awaitingFirstTurn || session.running ? "active" : session.promptAttempted ? "engaging" : "blank";
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css.mjs
		const css$4 = ".wSkVaW_root{background:var(--dsw-alias-bg-base);flex-direction:column;min-width:0;height:100%;display:flex;position:relative}.wSkVaW_header{box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l3);flex:none;grid-template-columns:auto minmax(0,1fr);min-height:76px;padding:10px 28px 0 20px;display:grid}.wSkVaW_header:where(:not(:has(.wSkVaW_tabs))){min-height:0;padding-bottom:10px}.wSkVaW_headerBlank{border-bottom:none;min-height:0;padding-bottom:0}.wSkVaW_headerBlank .wSkVaW_headerCorner{margin-left:auto}html:not([data-platform=darwin]) .wSkVaW_headerSessionless{padding-top:0}html:not([data-platform=darwin]) .wSkVaW_headerSessionless .wSkVaW_titleRow{min-height:0}[data-platform=darwin] .wSkVaW_headerLeading,[data-platform=darwin] .wSkVaW_headerActions,[data-platform=darwin] .wSkVaW_headerUtilities,[data-platform=darwin] .wSkVaW_headerCorner{-webkit-app-region:no-drag}.wSkVaW_titleRow{min-height:30px;grid-column:2;align-items:center;gap:0;padding-inline-start:max(0px, calc(var(--dsh-frame-leading-clearance,0px) - 20px));display:flex;container-type:inline-size}.wSkVaW_titleCluster{flex:1;align-items:center;gap:10px;min-width:0;display:flex}.wSkVaW_headerLeading{flex:none;grid-area:1/1;align-items:center;gap:8px;display:flex}.wSkVaW_crumbs{white-space:nowrap;align-items:center;gap:4px;min-width:0;display:flex;overflow:hidden}.wSkVaW_crumbSeg{align-items:center;gap:4px;min-width:0;display:inline-flex}.wSkVaW_crumbSep{color:var(--dsw-alias-label-caption);font-size:14px;line-height:20px}.wSkVaW_crumb{border-radius:var(--dsw-radius-md);max-width:220px;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;cursor:pointer;background:0 0;border:none;padding:4px 8px;font-size:14px;line-height:20px;display:inline-block;overflow:hidden}.wSkVaW_crumbSubagent{font-size:12px;line-height:18px}button.wSkVaW_crumb:hover{background:var(--dsw-alias-interactive-bg-hover)}.wSkVaW_crumbCurrent{color:var(--dsw-alias-label-primary);cursor:default;font-weight:500}.wSkVaW_headerActions{flex:none;align-items:center;gap:8px;display:flex}.wSkVaW_headerUtilities{flex:none;align-items:center;gap:8px;margin-left:20px;display:flex}.wSkVaW_headerUtilities:empty{display:none}.wSkVaW_headerCorner{flex:none;align-items:center;margin-left:8px;margin-right:-16px;display:flex}.wSkVaW_headerCorner:empty{display:none}.wSkVaW_tabs{z-index:1;grid-column:1/-1;gap:36px;margin-top:10px;padding-left:8px;display:flex;position:relative}.wSkVaW_tab{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;padding:0 0 9px;font-size:13px;font-weight:500;line-height:16px;position:relative}.wSkVaW_tab:after{content:\"\";background:0 0;border-radius:2px;height:2px;position:absolute;bottom:-1px;left:0;right:0}.wSkVaW_tabActive{color:var(--dsw-alias-state-business-primary)}.wSkVaW_tabActive:after{background:var(--dsw-alias-state-business-primary)}.wSkVaW_viewArea{flex-direction:column;flex:1;min-height:0;display:flex}.wSkVaW_widthHandle{z-index:0;width:min(10px, calc((100% - var(--dsh-chat-content-width)) / 2 - 24px - 24px));cursor:col-resize;position:absolute;top:0;bottom:0}.wSkVaW_widthHandle[data-side=left]{right:calc(50% + var(--dsh-chat-content-width) / 2 + 24px)}.wSkVaW_widthHandle[data-side=right]{left:calc(50% + var(--dsh-chat-content-width) / 2 + 24px)}.wSkVaW_widthHandle:after{content:\"\";background:linear-gradient(to bottom, transparent calc(var(--dsh-width-handle-pointer-y,50%) - 36px), var(--dsw-alias-scrollbar-bg-l1) calc(var(--dsh-width-handle-pointer-y,50%) - 8px), var(--dsw-alias-scrollbar-bg-l1) calc(var(--dsh-width-handle-pointer-y,50%) + 8px), transparent calc(var(--dsh-width-handle-pointer-y,50%) + 36px));opacity:0;pointer-events:none;border-radius:2px;width:2px;position:absolute;top:0;bottom:0}.wSkVaW_widthHandle[data-side=left]:after{right:4px}.wSkVaW_widthHandle[data-side=right]:after{left:4px}.wSkVaW_widthHandle:hover:after,.wSkVaW_widthHandle[data-dragging]:after{opacity:1}.wSkVaW_widthHandle[data-dragging]{z-index:8}.wSkVaW_root:has([data-conversation-composer-overlay]) .wSkVaW_widthHandle{display:none}.wSkVaW_composerStack{--dsh-composer-stack-gap:6px;gap:var(--dsh-composer-stack-gap);flex-direction:column;display:flex}.wSkVaW_composerSeat{--dsh-composer-text-max-height:336px;flex-direction:column;flex:none;display:flex}.wSkVaW_root[data-phase=active]{overflow:hidden}.wSkVaW_root[data-phase=active] .wSkVaW_header{flex:none}.wSkVaW_body{--dsh-chat-content-width:var(--dsh-chat-user-width,clamp(680px, calc(var(--dsh-conversation-column-width,0px) * .64), 920px));--dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);--dsh-composer-side-clearance:16px;--dsh-composer-dock-inset:8px;flex-direction:column;flex:1;min-height:0;display:flex;position:relative}.wSkVaW_embeddedBody{--dsh-chat-content-width:min(calc(100% - 32px), 920px);--dsh-composer-card-max-width:min(calc(100% - 16px), 952px);--dsh-composer-side-clearance:8px;--dsh-composer-dock-inset:8px;overflow:hidden}.wSkVaW_scrollBody{scrollbar-gutter:stable;flex-direction:column;flex:1;min-height:0;margin-right:2px;display:flex;overflow-y:auto}.wSkVaW_scrollBody::-webkit-scrollbar-track{margin:2px}.wSkVaW_root[data-phase=active] .wSkVaW_viewArea,.wSkVaW_embeddedBody[data-content-phase=active] .wSkVaW_viewArea{flex:1 0 auto;min-height:auto}.wSkVaW_root[data-phase=active] .wSkVaW_composerSeat,.wSkVaW_embeddedBody[data-content-phase=active] .wSkVaW_composerSeat{z-index:7;background:linear-gradient(180deg, color-mix(in srgb, var(--dsw-alias-bg-base) 0%, transparent) 0px, var(--dsw-alias-bg-base) 36px);position:sticky;bottom:0}.wSkVaW_root[data-phase=active] .wSkVaW_composerSeat:has([data-trigger-menu]){z-index:9}.wSkVaW_scrollBody:has([data-conversation-composer-overlay]){scrollbar-gutter:auto;position:relative;overflow:hidden auto}.wSkVaW_scrollBody:has([data-conversation-composer-overlay])>[data-slot=conversation\\.session]>.wSkVaW_viewArea{flex:1 1 0;min-height:0;overflow:hidden}.wSkVaW_scrollBody:has([data-conversation-composer-overlay])>.wSkVaW_composerSeat{right:var(--dsh-scrollbar-width);position:absolute;bottom:0;left:0}.wSkVaW_composerHero{width:min(calc(var(--dsh-composer-card-max-width) + 2 * var(--dsh-composer-side-clearance)), 100%);z-index:1;align-self:center;gap:8px;padding-bottom:32px}.wSkVaW_heroWorkspaceRow{align-items:center;gap:2px;min-width:0;margin-top:4px;padding:0 16px 0 20px;display:flex}.wSkVaW_heroOptions{flex:none;align-items:center;gap:2px;min-width:0;margin-left:auto;display:flex}.wSkVaW_heroOptions:empty{display:none}.wSkVaW_root[data-phase=hero] .wSkVaW_scrollBody,.wSkVaW_embeddedBody[data-content-phase=hero] .wSkVaW_scrollBody{justify-content:center;overflow-y:auto}.wSkVaW_root[data-phase=settling] .wSkVaW_composerSeat,.wSkVaW_embeddedBody[data-content-phase=settling] .wSkVaW_composerSeat{visibility:hidden}";
		const tagId$4 = "@deepseek-ai/dsh-client-ui-conversation/ConversationRoot.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var ConversationRoot_module_css_default = {
			"body": "wSkVaW_body",
			"composerHero": "wSkVaW_composerHero",
			"composerSeat": "wSkVaW_composerSeat",
			"composerStack": "wSkVaW_composerStack",
			"crumb": "wSkVaW_crumb",
			"crumbCurrent": "wSkVaW_crumbCurrent",
			"crumbSeg": "wSkVaW_crumbSeg",
			"crumbSep": "wSkVaW_crumbSep",
			"crumbSubagent": "wSkVaW_crumbSubagent",
			"crumbs": "wSkVaW_crumbs",
			"embeddedBody": "wSkVaW_embeddedBody",
			"header": "wSkVaW_header",
			"headerActions": "wSkVaW_headerActions",
			"headerBlank": "wSkVaW_headerBlank",
			"headerCorner": "wSkVaW_headerCorner",
			"headerLeading": "wSkVaW_headerLeading",
			"headerSessionless": "wSkVaW_headerSessionless",
			"headerUtilities": "wSkVaW_headerUtilities",
			"heroOptions": "wSkVaW_heroOptions",
			"heroWorkspaceRow": "wSkVaW_heroWorkspaceRow",
			"root": "wSkVaW_root",
			"scrollBody": "wSkVaW_scrollBody",
			"tab": "wSkVaW_tab",
			"tabActive": "wSkVaW_tabActive",
			"tabs": "wSkVaW_tabs",
			"titleCluster": "wSkVaW_titleCluster",
			"titleRow": "wSkVaW_titleRow",
			"viewArea": "wSkVaW_viewArea",
			"widthHandle": "wSkVaW_widthHandle"
		};
		//#endregion
		//#region lib/types/client/skeleton/ConversationWidthControls.js
		/** localStorage key for the dragged transcript width preference (px). */
		const WIDTH_PREF_KEY = "dsh.conversation.contentWidth";
		/** Floor for a dragged content width; matches the layout center-column minimum. */
		const CONTENT_MIN = 640;
		/** Horizontal room reserved for both handles and their safe edge zones. */
		const CONTENT_EDGE_BUDGET = 176;
		const WHEEL_DELTA_LINE = 1;
		const WHEEL_DELTA_PAGE = 2;
		const FALLBACK_WHEEL_LINE_PX = 16;
		/** Read a valid persisted width preference, or null when absent or corrupt. */
		function readWidthPreference() {
			const raw = localStorage.getItem(WIDTH_PREF_KEY);
			if (raw === null) return null;
			const value = Number(raw);
			return Number.isFinite(value) && value > 0 ? value : null;
		}
		/** Resolve the width displayed for one measured Conversation column. */
		function resolveContentWidth(columnWidth, preference) {
			const max = Math.max(CONTENT_MIN, columnWidth - CONTENT_EDGE_BUDGET);
			if (preference !== null) return Math.min(Math.max(preference, CONTENT_MIN), max);
			return Math.max(680, Math.min(columnWidth * .64, 920));
		}
		/** Convert a wheel event's vertical delta to scrollport pixels. */
		function wheelDeltaY(event, scrollport) {
			if (event.deltaMode === WHEEL_DELTA_LINE) {
				const lineHeight = Number.parseFloat(getComputedStyle(scrollport).lineHeight);
				return event.deltaY * (Number.isFinite(lineHeight) ? lineHeight : FALLBACK_WHEEL_LINE_PX);
			}
			if (event.deltaMode === WHEEL_DELTA_PAGE) return event.deltaY * scrollport.clientHeight;
			return event.deltaY;
		}
		/** One pointer-captured transcript width handle. */
		function WidthHandle(props) {
			const dragging = (0, react.useRef)(false);
			const base = (0, react.useRef)(0);
			const origin = (0, react.useRef)(0);
			const latest = (0, react.useRef)(0);
			const frame = (0, react.useRef)(null);
			const callbacks = (0, react.useRef)(props);
			callbacks.current = props;
			const outwardWidth = () => {
				const dx = latest.current - origin.current;
				const outward = callbacks.current.side === "right" ? dx : -dx;
				return base.current + outward * 2;
			};
			const cancelFrame = () => {
				if (frame.current !== null) {
					cancelAnimationFrame(frame.current);
					frame.current = null;
				}
			};
			const onPointerDown = (0, react.useCallback)((event) => {
				if (event.button !== 0) return;
				event.preventDefault();
				event.currentTarget.setPointerCapture(event.pointerId);
				origin.current = event.clientX;
				latest.current = event.clientX;
				base.current = callbacks.current.onStart();
				dragging.current = true;
				event.currentTarget.toggleAttribute("data-dragging", true);
			}, []);
			const onPointerMove = (0, react.useCallback)((event) => {
				if (!dragging.current) return;
				if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
				const box = event.currentTarget.getBoundingClientRect();
				event.currentTarget.style.setProperty("--dsh-width-handle-pointer-y", `${event.clientY - box.top}px`);
				latest.current = event.clientX;
				frame.current ??= requestAnimationFrame(() => {
					frame.current = null;
					callbacks.current.onDrag(outwardWidth());
				});
			}, []);
			const onPointerUp = (0, react.useCallback)((event) => {
				if (!dragging.current) return;
				if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
				dragging.current = false;
				event.currentTarget.toggleAttribute("data-dragging", false);
				event.currentTarget.releasePointerCapture(event.pointerId);
				cancelFrame();
				latest.current = event.clientX;
				if (latest.current !== origin.current) callbacks.current.onCommit(outwardWidth());
				callbacks.current.onEnd();
			}, []);
			const onPointerCancel = (0, react.useCallback)((event) => {
				if (!dragging.current) return;
				dragging.current = false;
				event.currentTarget.toggleAttribute("data-dragging", false);
				cancelFrame();
				callbacks.current.onEnd();
			}, []);
			const onWheel = (0, react.useCallback)((event) => {
				const body = event.currentTarget.parentElement;
				/* v8 ignore next -- a width handle renders only inside the Conversation body. */
				if (body === null) return;
				const scrollport = body.querySelector(":scope > [data-conversation-scroll]");
				/* v8 ignore next -- the Conversation body always contains its direct scroll element. */
				if (scrollport === null) return;
				if (event.ctrlKey || event.deltaY === 0) return;
				scrollport.scrollBy({ top: wheelDeltaY(event, scrollport) });
			}, []);
			return (0, react_jsx_runtime.jsx)("div", {
				className: ConversationRoot_module_css_default.widthHandle,
				"data-side": props.side,
				"data-width-handle": props.side,
				onPointerDown,
				onPointerMove,
				onPointerUp,
				onPointerCancel,
				onLostPointerCapture: onPointerCancel,
				onWheel
			});
		}
		/**
		* Install the main Conversation width axis and render its drag handles.
		* @param props - Mounted Conversation body and current presentation phase.
		* @returns two active-phase width handles, or no controls outside the active phase.
		*/
		function ConversationWidthControls({ container, phase }) {
			const publishWidths = (0, react.useCallback)((container) => {
				const target = container.parentElement ?? container;
				const column = container.offsetWidth;
				target.style.setProperty("--dsh-conversation-column-width", `${column}px`);
				const preference = readWidthPreference();
				if (preference === null) target.style.removeProperty("--dsh-chat-user-width");
				else target.style.setProperty("--dsh-chat-user-width", `${resolveContentWidth(column, preference)}px`);
			}, []);
			(0, react.useLayoutEffect)(() => {
				if (container === null) return;
				const observer = new ResizeObserver(() => {
					publishWidths(container);
				});
				observer.observe(container);
				publishWidths(container);
				return () => {
					observer.disconnect();
				};
			}, [container, publishWidths]);
			const onStart = (0, react.useCallback)(() => {
				if (container === null) return 680;
				return resolveContentWidth(container.offsetWidth, readWidthPreference());
			}, [container]);
			const onDrag = (0, react.useCallback)((width) => {
				if (container === null) return;
				(container.parentElement ?? container).style.setProperty("--dsh-chat-user-width", `${resolveContentWidth(container.offsetWidth, width)}px`);
			}, [container]);
			const onCommit = (0, react.useCallback)((width) => {
				if (container === null) return;
				localStorage.setItem(WIDTH_PREF_KEY, `${resolveContentWidth(container.offsetWidth, width)}`);
			}, [container]);
			const onEnd = (0, react.useCallback)(() => {
				if (container !== null) publishWidths(container);
			}, [container, publishWidths]);
			if (container === null || phase !== "active") return null;
			return ["left", "right"].map((side) => (0, react_jsx_runtime.jsx)(WidthHandle, {
				side,
				onStart,
				onDrag,
				onCommit,
				onEnd
			}, side));
		}
		//#endregion
		//#region lib/types/client/skeleton/ConversationMainPanel.js
		const CONTENT_SLOTS = { widthControls: ConversationWidthControls };
		/**
		* Render the existing main Conversation frame around the extracted content.
		* @param props - the original `main.conversation` Slot props.
		* @returns the unchanged root, Header, content, and width-control subtree.
		*/
		function ConversationMainPanel(props) {
			const { sessionId, useSession, useSessions, useConversation, renderSlot, renderFactorySlot } = props;
			const session = useSession((s) => s);
			const conversation = useConversation((s) => s);
			const shellPhase = session === void 0 || conversation === void 0 ? "blank" : conversationPhase(session, conversation);
			const openState = session?.openState;
			const summaryBlank = useSessions((s) => sessionId === void 0 ? void 0 : s.byId[sessionId]?.blank);
			const parentAvailabilityPending = session?.subagent?.address.mode === "continuable" && session.subagent.parentAvailable === void 0;
			const settling = sessionId !== void 0 && (shellPhase === "blank" && openState === "loading" && summaryBlank !== true || parentAvailabilityPending);
			const hero = sessionId === void 0 || shellPhase === "blank" && (openState === "open" || summaryBlank === true);
			const phase = settling ? "settling" : hero ? "hero" : "active";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ConversationRoot_module_css_default.root,
				"data-phase": phase,
				children: [renderSlot("conversation.header", {}), renderFactorySlot("conversation.content", {
					variant: "main",
					phase,
					hero
				}, { slots: CONTENT_SLOTS })]
			});
		}
		//#endregion
		//#region lib/types/client/skeleton/ConversationRoot.js
		function ConversationRoot(props) {
			return (0, react_jsx_runtime.jsx)(ConversationMainPanel, { ...props });
		}
		/**
		* The text one Workspace is labeled with. A Workspace still carrying the
		* automatic first-use title reads as the caller's localized default name; every
		* other title reads verbatim in every language. A title the user typed as
		* exactly {@link DEFAULT_WORKSPACE_DIRECTORY} is labeled as the default too;
		* nothing else depends on the distinction.
		* @param title - stored Workspace title.
		* @param localizedDefault - the default Workspace name in the active language.
		* @returns the title to display.
		*/
		function workspaceDisplayTitle(title, localizedDefault) {
			return title === "default-workspace" ? localizedDefault : title;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/HeroShell.module.css.mjs
		const css$3 = ".pXSMma_root{justify-content:center;align-items:center;min-width:0;height:100%;padding:0 24px;display:flex}.pXSMma_stack{width:100%;max-width:var(--dsh-composer-card-max-width);flex-direction:column;align-items:stretch;gap:12px;display:flex;overflow:visible}.pXSMma_headline{color:var(--dsw-alias-label-primary);flex-wrap:wrap;justify-content:center;align-items:center;gap:12px 10px;font-size:26px;font-weight:500;line-height:32px;display:flex}.pXSMma_titleGroup{flex-wrap:wrap;justify-content:center;align-items:center;gap:4px 7px;min-width:0;display:flex}.pXSMma_previewBadge{border:.5px solid var(--dsw-alias-interactive-bg-hover);corner-shape:round;background:var(--dsw-alias-state-business-tertiary);color:var(--dsw-alias-label-primary-bluish);font-family:var(--ds-font-family-code);white-space:nowrap;border-radius:999px;align-self:flex-start;margin-top:2px;padding:1px 7px 0;font-size:12px;font-weight:500;line-height:18px}.pXSMma_fishHitbox{flex:none;justify-content:center;align-items:center;display:inline-flex}.pXSMma_fish{transform-origin:50% 60%;color:var(--dsw-alias-label-primary);display:block;overflow:visible}@keyframes pXSMma_hero-fish-swim{0%,to{transform:none}35%{transform:rotate(-4deg)translate(-.4px,-.9px)}70%{transform:rotate(1.6deg)translate(.3px,.2px)}}@media (hover:hover) and (prefers-reduced-motion:no-preference){.pXSMma_fishHitbox:hover .pXSMma_fish{animation:1.6s ease-in-out infinite pXSMma_hero-fish-swim}}.pXSMma_body{flex-direction:column;gap:12px;min-width:0;display:flex;position:relative;overflow:visible}.pXSMma_body>*{z-index:1;position:relative}.pXSMma_body>.pXSMma_workspaceRow{z-index:10;align-items:center;min-width:0;padding-left:8px;display:flex}.pXSMma_workspace{border-radius:var(--dsw-radius-sm);max-width:min(100%,360px);min-height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;align-items:center;gap:4px;padding:0 8px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}.pXSMma_workspace:not(:disabled):hover,.pXSMma_workspace[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover)}.pXSMma_workspace:disabled{cursor:default}.pXSMma_folder{color:var(--dsw-alias-label-primary);flex:none}.pXSMma_workspaceLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.pXSMma_chevron{color:var(--dsw-alias-label-caption);flex:none}.pXSMma_modalInput{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);width:100%;height:44px;color:var(--dsw-alias-label-primary);background:0 0;outline:none;padding:7px 14px;font-size:14px;font-weight:400;line-height:22px}.pXSMma_modalInput::placeholder{color:var(--dsw-alias-label-caption)}.pXSMma_modalInput:disabled{color:var(--dsw-alias-label-dimmed)}.pXSMma_modalAction{min-width:72px}.pXSMma_modalError{color:var(--dsw-alias-state-error-primary);margin-top:8px;font-size:12px;line-height:18px}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-conversation/HeroShell.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var HeroShell_module_css_default = {
			"body": "pXSMma_body",
			"chevron": "pXSMma_chevron",
			"fish": "pXSMma_fish",
			"fishHitbox": "pXSMma_fishHitbox",
			"folder": "pXSMma_folder",
			"headline": "pXSMma_headline",
			"hero-fish-swim": "pXSMma_hero-fish-swim",
			"modalAction": "pXSMma_modalAction",
			"modalError": "pXSMma_modalError",
			"modalInput": "pXSMma_modalInput",
			"previewBadge": "pXSMma_previewBadge",
			"root": "pXSMma_root",
			"stack": "pXSMma_stack",
			"titleGroup": "pXSMma_titleGroup",
export {};
