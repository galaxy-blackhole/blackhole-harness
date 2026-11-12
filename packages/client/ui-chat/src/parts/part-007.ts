/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/client/chat/use-disclosure.js
		/** Bind independent disclosure state to a Chat seat's reset source. */
		/**
		* Own one initially collapsed disclosure without an external subscription.
		* @param version - reset generation; unchanged generations retain local open state.
		* @returns the open state, an explicit setter, and a toggle action.
		*/
		function useDisclosure(version = 0) {
			const [expandedVersion, setExpandedVersion] = (0, react.useState)(null);
			return {
				expanded: expandedVersion === version,
				setExpanded: (0, react.useCallback)((open) => {
					setExpandedVersion(open ? version : null);
				}, [version]),
				toggle: (0, react.useCallback)(() => {
					setExpandedVersion((previous) => previous === version ? null : version);
				}, [version])
			};
		}
		/**
		* Bind a Hook without subscribing until a component calls it.
		* @param reset - stable source whose version advances when the seat is hidden by its Turn.
		* @returns a Hook with independent open state for each invocation.
		*/
		function bindDisclosure(reset) {
			const subscribe = (listener) => reset.subscribe(listener);
			const getSnapshot = () => reset.getSnapshot();
			return function useBoundDisclosure() {
				return useDisclosure((0, react.useSyncExternalStore)(subscribe, getSnapshot));
			};
		}
		//#endregion
		//#region lib/types/client/chat/use-process-scroll.js
		/** Capped process-group scrolling and fades over the shared follow controller. */
		const AT_REST = {
			canScrollUp: false,
			canScrollDown: false
		};
		const SCROLL_KEYS = new Set([
			"ArrowUp",
			"ArrowDown",
			"PageUp",
			"PageDown",
			"Home",
			"End",
			" "
		]);
		/**
		* Observe one group's body and content without coupling its follow intent to the outer transcript.
		* Wheel, touchstart, any pointerdown, and unprevented scroll keys interrupt active animations,
		* including events from editable controls; subsequent position sampling determines follow intent.
		* @param bodyRef - capped scrolling body.
		* @param contentRef - uncapped content whose size reports growth.
		* @param open - local disclosure state.
		* @param grouped - whether the display mode retains the group's height cap.
		* @returns edge fades, DOM event bindings, and one-shot positioning for manual opening.
		*/
		function useProcessScroll(bodyRef, contentRef, open, grouped) {
			const follow = useScrollFollow(false, 1);
			const initialPosition = (0, react.useRef)(null);
			const [edges, setEdges] = (0, react.useState)(AT_REST);
			const initialize = (0, react.useCallback)((position) => {
				initialPosition.current = position;
			}, []);
			const sync = (0, react.useCallback)((cause) => {
				const body = bodyRef.current;
				let next = AT_REST;
				if (body !== null && body.closest("[hidden], [data-group-expanded-mode]") === null) {
					let metrics = scrollMetrics(body);
					const initial = cause === "resize" ? initialPosition.current : null;
					if (initial !== null) {
						metrics = follow.jump(body, metrics, initial === "bottom" ? metrics.floor : 0);
						if (initial === "top") follow.setFollowing(false);
						initialPosition.current = null;
					} else {
						const wasAnimating = follow.animating;
						if (cause === "scrollend") follow.settle(metrics);
						else follow.sample(metrics);
						if (follow.active && (cause === "resize" || cause === "scrollend" && wasAnimating)) metrics = follow.toBottom(body, metrics, "smooth");
					}
					next = {
						canScrollUp: metrics.top > 1,
						canScrollDown: metrics.top < metrics.floor - 1
					};
				} else follow.reset();
				setEdges((previous) => previous.canScrollUp === next.canScrollUp && previous.canScrollDown === next.canScrollDown ? previous : next);
			}, [bodyRef, follow]);
			const interrupt = (0, react.useCallback)(() => {
				const body = bodyRef.current;
				if (body !== null && follow.animating) follow.interrupt(body, scrollMetrics(body));
			}, [bodyRef, follow]);
			const events = (0, react.useMemo)(() => ({
				onScroll: () => {
					sync("scroll");
				},
				onWheel: interrupt,
				onTouchStart: interrupt,
				onPointerDown: interrupt,
				onKeyDown: (event) => {
					if (!event.defaultPrevented && SCROLL_KEYS.has(event.key)) interrupt();
				}
			}), [interrupt, sync]);
			(0, react.useLayoutEffect)(() => {
				interrupt();
				follow.reset();
				if (!grouped || !open) initialPosition.current = null;
			}, [
				follow,
				grouped,
				interrupt,
				open
			]);
			(0, react.useLayoutEffect)(() => {
				const body = bodyRef.current;
				if (body === null || !open || typeof ResizeObserver === "undefined") return;
				const unbind = follow.bind(body);
				const observer = new ResizeObserver(() => {
					sync("resize");
				});
				const onScrollEnd = (event) => {
					if (event.target === body) sync("scrollend");
				};
				body.addEventListener("scrollend", onScrollEnd);
				observer.observe(body);
				if (contentRef.current !== null) observer.observe(contentRef.current);
				return () => {
					unbind();
					observer.disconnect();
					body.removeEventListener("scrollend", onScrollEnd);
				};
			}, [
				bodyRef,
				contentRef,
				follow,
				open,
				sync
			]);
			return {
				edges,
				events,
				initialize
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/ChatGroupSeat.module.css.mjs
		const css$15 = ".O_Ebla_root{min-width:0}.O_Ebla_title{max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:var(--dsh-content-font-size,14px);text-align:left;cursor:pointer;background:0 0;border:0;align-items:center;gap:6px;padding:0;transition:color .1s;display:flex}.O_Ebla_title:hover{color:var(--dsw-alias-label-secondary)}.O_Ebla_leading{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));color:inherit;flex:none;justify-content:center;align-items:center;display:inline-flex;position:relative}.O_Ebla_leading svg{width:calc(14px + var(--dsh-content-font-delta,0px));height:calc(14px + var(--dsh-content-font-delta,0px))}.O_Ebla_leading svg[width=\"16\"]{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px))}.O_Ebla_activityIcon,.O_Ebla_chevron{justify-content:center;align-items:center;transition:opacity .1s;display:inline-flex;position:absolute;inset:0}.O_Ebla_activityIcon{opacity:1}.O_Ebla_chevron,.O_Ebla_title:is(:hover,:focus-visible) .O_Ebla_activityIcon{opacity:0}.O_Ebla_title:is(:hover,:focus-visible) .O_Ebla_chevron{opacity:1}.O_Ebla_title[aria-expanded=true] .O_Ebla_activityIcon{opacity:0}.O_Ebla_title[aria-expanded=true] .O_Ebla_chevron{opacity:1}.O_Ebla_title[aria-expanded=true]{padding-bottom:8px}.O_Ebla_body{--dsh-chat-flow-gap:6px;overscroll-behavior-y:auto;scrollbar-gutter:stable;max-height:min(400px,50vh);overflow-y:auto}.O_Ebla_label{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}.O_Ebla_fadeTop{mask-image:linear-gradient(#0000 0,#000 24px 100%)}.O_Ebla_fadeBottom{mask-image:linear-gradient(#000 0 calc(100% - 24px),#0000 100%)}.O_Ebla_fadeTop.O_Ebla_fadeBottom{mask-image:linear-gradient(#0000 0,#000 24px calc(100% - 24px),#0000 100%)}@media (prefers-reduced-motion:reduce){.O_Ebla_title,.O_Ebla_activityIcon,.O_Ebla_chevron{transition:none}}.O_Ebla_content{flex-direction:column;display:flex}.O_Ebla_content>*{flex-shrink:0}.O_Ebla_content>:not([hidden]):not(:empty)~:not([hidden]):not(:empty){margin-top:var(--dsh-chat-flow-gap,6px)}.O_Ebla_expandedBody{scrollbar-gutter:auto;max-height:none;overflow:visible}[data-chat-motion] .O_Ebla_content>:not([data-chat-motion]){transition:margin-top .16s cubic-bezier(.4,0,.2,1)}@media (prefers-reduced-motion:reduce){[data-chat-motion] .O_Ebla_content>:not([data-chat-motion]){transition:none}}";
		const tagId$15 = "@deepseek-ai/dsh-client-ui-chat/ChatGroupSeat.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$15) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$15;
			tag.textContent = css$15;
			document.head.appendChild(tag);
		}
		var ChatGroupSeat_module_css_default = {
			"activityIcon": "O_Ebla_activityIcon",
			"body": "O_Ebla_body",
			"chevron": "O_Ebla_chevron",
			"content": "O_Ebla_content",
			"expandedBody": "O_Ebla_expandedBody",
			"fadeBottom": "O_Ebla_fadeBottom",
			"fadeTop": "O_Ebla_fadeTop",
			"label": "O_Ebla_label",
			"leading": "O_Ebla_leading",
			"root": "O_Ebla_root",
			"title": "O_Ebla_title"
		};
		//#endregion
		//#region lib/types/client/chat/ChatGroupSeat.js
		/** Stable process container; display policy changes visibility, never member parents. */
		const PROCESS_TITLE_MINIMUM_MS = 150;
		const PROCESS_ICONS = {
			thinking: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconThinkOutlineRegular, {}),
			read: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutlineRegular, { size: 14 }),
			readImage: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutlineRegular, { size: 14 }),
			search: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 14 }),
			edit: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 }),
			write: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutlineRegular, { size: 14 }),
			commands: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconApiOutlineRegular, {}),
			code: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 14 }),
			webSearch: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular, {}),
			webFetch: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBrowseOutlineRegular, { size: 14 }),
			subagents: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconAgentPresetOutlineRegular, { size: 14 }),
			plan: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlanOutlineRegular, {}),
			questions: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconQuestionOutlineRegular, {}),
			tools: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSparkleRegular, { size: 14 })
		};
		function sameLiveProcessTitle(left, right) {
			return left.activity === right.activity && left.detail === right.detail && left.preparing === right.preparing;
		}
		function useStableLiveProcessTitle(desired, active) {
			const [displayed, setDisplayed] = (0, react.useState)(desired);
			const displayedRef = (0, react.useRef)(displayed);
			const desiredRef = (0, react.useRef)(desired);
			const displayedAtRef = (0, react.useRef)(Date.now());
			(0, react.useEffect)(() => {
				desiredRef.current = desired;
				if (!active || sameLiveProcessTitle(displayedRef.current, desired)) return;
				const remaining = PROCESS_TITLE_MINIMUM_MS - (Date.now() - displayedAtRef.current);
				const commit = () => {
					const next = desiredRef.current;
					displayedRef.current = next;
					displayedAtRef.current = Date.now();
					setDisplayed(next);
				};
				if (remaining <= 0) {
					commit();
					return;
				}
				const timer = setTimeout(commit, remaining);
				return () => {
					clearTimeout(timer);
				};
			}, [
				active,
				desired.activity,
				desired.detail,
				desired.preparing
			]);
			return active ? displayed : desired;
		}
		const GroupMembers = (0, react.memo)(function GroupMembers({ members, ...props }) {
			return members.map((member) => (0, react.createElement)(ChatNodeSeat, {
				...props,
				key: chatRenderKey(member),
				nodeKey: member.key,
				...member.groupPart === void 0 ? {} : { groupPart: member.groupPart }
			}));
		});
		const ProcessGroupHeader = (0, react.memo)(function ProcessGroupHeader({ groupKey, useChatGroup, usePresentation, t, open, bodyId, toggle }) {
			const data = useChatGroup(groupKey, (group) => group?.data);
			const detailed = usePresentation((policy) => data?.closed === false && policy.liveProcessDetail);
			const live = useStableLiveProcessTitle({
				activity: data?.summary.running ?? "thinking",
				detail: data?.summary.runningDetail ?? "",
				preparing: data?.summary.preparing === true
			}, data !== void 0 && !data.closed);
			if (data === void 0) return null;
			const label = data.closed ? processTitle(data.summary, t) : live.preparing ? t(`message.stepProcess.prepare.${live.activity === "thinking" ? "tools" : live.activity}`) : t(`message.stepProcess.${live.activity}`);
			const detail = detailed && !data.closed ? live.detail : "";
			const title = detail === "" ? label : `${label}${t("message.turnProcess.separator")}${detail}`;
			const activity = data.closed ? data.summary.counts[0]?.kind ?? "thinking" : live.activity;
			return (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: ChatGroupSeat_module_css_default.title,
				"aria-expanded": open,
				"aria-controls": bodyId,
				"data-process-activity": activity,
				onClick: (event) => {
					event.currentTarget.focus();
					toggle();
				},
				children: [(0, react_jsx_runtime.jsxs)("span", {
					className: ChatGroupSeat_module_css_default.leading,
					"aria-hidden": "true",
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: ChatGroupSeat_module_css_default.activityIcon,
						"data-step-process-icon": true,
						children: PROCESS_ICONS[activity]
					}), (0, react_jsx_runtime.jsx)("span", {
						className: ChatGroupSeat_module_css_default.chevron,
						"data-step-process-chevron": true,
						children: open ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})
					})]
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, {
					active: !data.closed,
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TextShimmer, {
						className: ChatGroupSeat_module_css_default.label,
						children: title
					})
				})]
			});
		});
		/** Render a process group with local disclosure and the existing outer-Turn visibility. */
		const ChatGroupSeat = (0, react.memo)(function ChatGroupSeat({ groupKey, useChatGroup, useGroupHeaderAction, ...props }) {
			const members = useChatGroup(groupKey, (group) => group?.members);
			const turn = useChatGroup(groupKey, (group) => group?.data.turn);
			const closed = useChatGroup(groupKey, (group) => group?.data.closed);
			const foldCompleted = props.usePresentation((policy) => policy.foldCompletedTurns);
			const { expanded: open, setExpanded: setOpen } = useDisclosure();
			const firstKey = members?.[0]?.key ?? "";
			const deferCollapse = props.useChatNodeBottom(firstKey) === true && props.deferCollapse;
			const presentation = props.useChatNodeProcess(firstKey);
			const turnLocation = props.useChatNode(firstKey, (node) => {
				const location = node?.location;
				return location?.kind === "turn" || location?.kind === "step" ? location.turn : void 0;
			});
			const grouped = props.usePresentation((policy) => policy.stepGrouping === "collapsed" || policy.stepGrouping === "history" && turnLocation?.status !== "open" && !deferCollapse);
			const reason = turnLocation?.end?.data.reason.kind;
			const alwaysOpen = presentation?.turnClosed === false || presentation?.hasInterleavedInput === true || reason === "aborted" || reason === "interrupted" || reason === "error";
			const spec = presentation?.spec;
			const selectOpen = (0, react.useCallback)((state) => spec !== void 0 && turnProcessOpen(state, spec, deferCollapse), [spec, deferCollapse]);
			const storedOpen = props.useStore(selectOpen);
			const outerHidden = foldCompleted && presentation?.turnClosed === true && spec !== void 0 && !alwaysOpen && !storedOpen;
			const revealOuter = (0, react.useCallback)(() => {
				if (spec !== void 0 && !alwaysOpen) props.actions.setTurnProcessOpen(spec.turn, spec.answerStep ?? 0, true);
			}, [
				props.actions,
				spec,
				alwaysOpen
			]);
			const rootRef = props.useGroupAction(outerHidden, revealOuter);
			const headerRef = (0, react.useRef)(null);
			const deferCompletedTurns = props.usePresentation((policy) => policy.collapseTiming === "next-input");
			useGroupHeaderAction(headerRef, !grouped || deferCompletedTurns && outerHidden);
			(0, react.useEffect)(() => {
				if (outerHidden && rootRef.current !== null && hiddenOrCollapsing(rootRef.current)) setOpen(false);
			}, [
				outerHidden,
				rootRef,
				setOpen
			]);
			const reveal = (0, react.useCallback)(() => {
				setOpen(true);
			}, [setOpen]);
			const bodyRef = props.useGroupAction(grouped && !open, reveal);
			const contentRef = (0, react.useRef)(null);
			const bodyId = (0, react.useId)();
			const { edges, events, initialize } = useProcessScroll(bodyRef, contentRef, open, grouped);
			const toggle = (0, react.useCallback)(() => {
				if (!open) initialize(closed === false ? "bottom" : "top");
				setOpen(!open);
			}, [
				closed,
				initialize,
				open,
				setOpen
			]);
			if (members === void 0) return null;
			const capped = grouped && (!deferCompletedTurns || open);
			const classes = [
				ChatGroupSeat_module_css_default.body,
				!capped ? ChatGroupSeat_module_css_default.expandedBody : "",
				capped && edges.canScrollUp ? ChatGroupSeat_module_css_default.fadeTop : "",
				capped && edges.canScrollDown ? ChatGroupSeat_module_css_default.fadeBottom : ""
			];
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: ChatGroupSeat_module_css_default.root,
				"data-chat-group-key": groupKey,
				"data-chat-flow-key": groupKey,
				"data-chat-anchor-key": `group:${groupKey}`,
				"data-chat-turn": turn,
				"data-chat-paging-anchor": grouped && !open || void 0,
				"data-step-process": true,
				"data-group-expanded-mode": !grouped || void 0,
				children: [(0, react_jsx_runtime.jsx)("div", {
					ref: headerRef,
					children: (0, react_jsx_runtime.jsx)(ProcessGroupHeader, {
						groupKey,
						useChatGroup,
						usePresentation: props.usePresentation,
						t: props.t,
						open,
						bodyId,
						toggle
					})
				}), (0, react_jsx_runtime.jsx)("div", {
					ref: bodyRef,
					id: bodyId,
					className: classes.join(" "),
					"data-step-process-body": true,
					"data-scroll-up": edges.canScrollUp || void 0,
					"data-scroll-down": edges.canScrollDown || void 0,
					...events,
					children: (0, react_jsx_runtime.jsx)("div", {
						ref: contentRef,
						className: ChatGroupSeat_module_css_default.content,
						"data-step-process-content": true,
						"data-chat-flow": "",
						children: (0, react_jsx_runtime.jsx)(GroupMembers, {
							...props,
							members
						})
					})
				})]
			});
		});
		//#endregion
		//#region lib/types/client/markdown-labels.js
		/** Localized copy adapters for Cordis-free Markdown primitives. */
		/**
		* Build the complete Markdown chrome copy for one locale revision.
		* @param t - Chat locale seat.
		* @returns Labels for code fences and footnotes.
		*/
		function markdownLabels(t) {
			return {
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied"),
					toolbarLabels: {
						codeLabel: t("codeBlock.title"),
						wrapLabel: t("codeBlock.wrap"),
						unwrapLabel: t("codeBlock.unwrap")
					}
				},
				footnotes: t("markdown.footnotes")
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/MessageItem.module.css.mjs
		const css$14 = ".Sixlwa_userRow{flex-direction:column;align-items:flex-end;gap:6px;display:flex}.Sixlwa_userStack{min-width:0;max-width:min(calc(var(--dsh-chat-content-width,748px) * .702), 82%);flex-direction:column;align-items:flex-end;gap:8px;display:flex}.Sixlwa_bubble{background:var(--dsw-specific-bubble);border-radius:var(--dsw-radius-xl);max-width:100%;font-size:var(--dsh-content-font-size,14px);line-height:calc(22px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-primary);white-space:pre-wrap;word-break:break-word;padding:10px 16px}.Sixlwa_referenceSummary{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px))}.Sixlwa_contextRow{padding:2px 0}.Sixlwa_compactionRow{--dsh-compaction-header-height:calc(24px + var(--dsh-content-font-delta,0px));padding:2px 0}.Sixlwa_compactionButton{width:100%;height:var(--dsh-compaction-header-height);border-radius:var(--dsw-radius-sm);min-width:0;color:var(--dsw-alias-label-tertiary);font:inherit;text-align:left;background:0 0;border:none;align-items:center;padding:0;transition:color .1s;display:flex}.Sixlwa_compactionRow:has(.Sixlwa_compactionBody) .Sixlwa_compactionButton{z-index:7;background:var(--dsw-alias-bg-base);border-radius:0;position:sticky;top:0}.Sixlwa_compactionBody :has(>[data-code-block-banner]){top:var(--dsh-compaction-header-height)}.Sixlwa_compactionRow:has(.Sixlwa_compactionBody) .Sixlwa_compactionButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}.Sixlwa_compactionButton:not(:disabled){cursor:pointer}.Sixlwa_compactionButton:hover{color:var(--dsw-alias-label-secondary)}.Sixlwa_compactionButton:not(:disabled):hover{background:var(--dsw-alias-interactive-bg-hover)}.Sixlwa_compactionLeading{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));color:inherit;flex:none;place-items:center;margin-right:6px;display:inline-grid}.Sixlwa_compactionLeading svg{width:calc(14px + var(--dsh-content-font-delta,0px));height:calc(14px + var(--dsh-content-font-delta,0px))}.Sixlwa_compactionContextIcon,.Sixlwa_compactionDisclosureIcon{grid-area:1/1;justify-content:center;align-items:center;display:inline-flex}.Sixlwa_compactionDisclosureIcon,.Sixlwa_compactionButton:not(:disabled):hover .Sixlwa_compactionContextIcon,.Sixlwa_compactionButton:not(:disabled):focus-visible .Sixlwa_compactionContextIcon{opacity:0}.Sixlwa_compactionButton:not(:disabled):hover .Sixlwa_compactionDisclosureIcon,.Sixlwa_compactionButton:not(:disabled):focus-visible .Sixlwa_compactionDisclosureIcon{opacity:1}.Sixlwa_compactionTitle{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:inherit;flex:none}.Sixlwa_compactionSep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.Sixlwa_compactionSummary{min-width:0;color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}.Sixlwa_compactionBody{padding:4px 0 4px calc(22px + var(--dsh-content-font-delta,0px));color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px))}.Sixlwa_retryRow{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px))}.Sixlwa_retrySummary{border-radius:var(--dsw-radius-sm);width:fit-content;max-width:100%;color:inherit;cursor:pointer;user-select:none;align-items:center;gap:7px;padding:2px 0;list-style:none;display:inline-flex}.Sixlwa_retrySummary::-webkit-details-marker{display:none}.Sixlwa_retrySummary:after{content:\"\";border-bottom:1.5px solid;border-right:1.5px solid;flex:none;width:6px;height:6px;margin-right:2px;transition:transform .12s;transform:rotate(-45deg)}.Sixlwa_retrySummary:hover{color:var(--dsw-alias-label-secondary)}@media (prefers-reduced-motion:reduce){.Sixlwa_compactionButton{transition:none}}.Sixlwa_retrySummary:focus-visible{outline:1.5px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.Sixlwa_retryText{overflow-wrap:anywhere;min-width:0}.Sixlwa_retryRow[open] .Sixlwa_retrySummary:after{transform:rotate(45deg)}.Sixlwa_retryDetails{overflow-wrap:anywhere;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px));gap:2px;margin-top:3px;padding-left:14px;display:grid}.Sixlwa_retryDetailLabel{color:var(--dsw-alias-label-secondary)}.Sixlwa_turnErrorRow{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));grid-template-columns:10px minmax(0,1fr) auto;align-items:start;gap:8px;padding:2px 0;display:grid}.Sixlwa_turnErrorDot{margin-top:5px}.Sixlwa_turnErrorCopy{overflow-wrap:anywhere;min-width:0}.Sixlwa_turnErrorTitle{color:var(--dsw-alias-state-error-primary);margin-right:6px;font-weight:600}.Sixlwa_turnErrorMessage{color:var(--dsw-alias-label-secondary)}.Sixlwa_turnErrorCode{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-markdown-code-block-small)}.Sixlwa_maxTokensTitle{color:var(--dsw-alias-state-warn-primary);margin-right:6px;font-weight:600}.Sixlwa_attachmentRow{flex-wrap:wrap;justify-content:flex-end;gap:8px;max-width:100%;display:flex}.Sixlwa_fileCard{border:.5px solid var(--dsw-alias-border-l2,#0000001f);border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-input-major,transparent);box-sizing:border-box;flex:0 0 240px;align-items:center;gap:10px;width:240px;min-height:64px;padding:8px 12px;display:inline-flex}.Sixlwa_fileIcon{flex:none;width:28px;height:28px}.Sixlwa_fileContent{flex-direction:column;flex:1;min-width:0;display:flex}.Sixlwa_fileName{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px;overflow:hidden}.Sixlwa_fileMeta{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-tertiary,#00000073);font-size:12px;line-height:15px;overflow:hidden}";
		const tagId$14 = "@deepseek-ai/dsh-client-ui-chat/MessageItem.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$14) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$14;
			tag.textContent = css$14;
			document.head.appendChild(tag);
		}
		var MessageItem_module_css_default = {
			"attachmentRow": "Sixlwa_attachmentRow",
			"bubble": "Sixlwa_bubble",
			"compactionBody": "Sixlwa_compactionBody",
			"compactionButton": "Sixlwa_compactionButton",
			"compactionContextIcon": "Sixlwa_compactionContextIcon",
			"compactionDisclosureIcon": "Sixlwa_compactionDisclosureIcon",
			"compactionLeading": "Sixlwa_compactionLeading",
			"compactionRow": "Sixlwa_compactionRow",
			"compactionSep": "Sixlwa_compactionSep",
			"compactionSummary": "Sixlwa_compactionSummary",
			"compactionTitle": "Sixlwa_compactionTitle",
			"contextRow": "Sixlwa_contextRow",
			"fileCard": "Sixlwa_fileCard",
			"fileContent": "Sixlwa_fileContent",
			"fileIcon": "Sixlwa_fileIcon",
			"fileMeta": "Sixlwa_fileMeta",
			"fileName": "Sixlwa_fileName",
			"maxTokensTitle": "Sixlwa_maxTokensTitle",
			"referenceSummary": "Sixlwa_referenceSummary",
			"retryDetailLabel": "Sixlwa_retryDetailLabel",
			"retryDetails": "Sixlwa_retryDetails",
			"retryRow": "Sixlwa_retryRow",
			"retrySummary": "Sixlwa_retrySummary",
			"retryText": "Sixlwa_retryText",
			"turnErrorCode": "Sixlwa_turnErrorCode",
			"turnErrorCopy": "Sixlwa_turnErrorCopy",
			"turnErrorDot": "Sixlwa_turnErrorDot",
			"turnErrorMessage": "Sixlwa_turnErrorMessage",
			"turnErrorRow": "Sixlwa_turnErrorRow",
			"turnErrorTitle": "Sixlwa_turnErrorTitle",
			"userRow": "Sixlwa_userRow",
			"userStack": "Sixlwa_userStack"
		};
		//#endregion
		//#region lib/types/client/chat/CompactionItem.js
		/**
		* Renders the model-history compaction marker.
		* @param props - the marker node off the snapshot cache.
		* @returns the marker row, with the summary disclosure when one is available.
		*/
		const CompactionItem = (0, react.memo)(function CompactionItem({ node, title, fallbackSummary, t }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const labels = (0, react.useMemo)(() => markdownLabels(t), [t]);
			const expandable = node.summary !== null;
			const open = expandable && expanded;
			const summary = node.shadowedItemCount !== null && node.shadowedTokenCount !== null ? t("message.compaction.completed", {
				items: node.shadowedItemCount,
				tokens: node.shadowedTokenCount
			}) : fallbackSummary ?? (expandable ? t("message.compaction.expand") : t("message.compaction.unavailable"));
			return (0, react_jsx_runtime.jsxs)("div", {
				className: MessageItem_module_css_default.compactionRow,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: MessageItem_module_css_default.compactionButton,
					disabled: !expandable,
					"aria-expanded": expandable ? open : void 0,
					onClick: () => {
						setExpanded((value) => !value);
					},
					children: [
						(0, react_jsx_runtime.jsxs)("span", {
							className: MessageItem_module_css_default.compactionLeading,
							"aria-hidden": true,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: MessageItem_module_css_default.compactionContextIcon,
								"data-compaction-icon": "context",
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconApiOutlineRegular, {})
							}), (0, react_jsx_runtime.jsx)("span", {
								className: MessageItem_module_css_default.compactionDisclosureIcon,
								"data-compaction-disclosure": open ? "expanded" : "collapsed",
								children: open ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
							})]
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.compactionTitle,
							children: title ?? t("message.compaction")
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.compactionSep,
							"aria-hidden": true
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: MessageItem_module_css_default.compactionSummary,
							children: summary
						})
					]
				}), open && node.summary !== null && (0, react_jsx_runtime.jsx)("div", {
					className: MessageItem_module_css_default.compactionBody,
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
						text: node.summary,
						labels
					})
				})]
			});
		});
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/ContextBody.module.css.mjs
		const css$13 = ".ZkiH0q_text{color:var(--dsw-alias-label-secondary);font:inherit;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.ZkiH0q_fields{border-top:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:2px;margin:8px 0 0;padding-top:8px;display:flex}.ZkiH0q_field{gap:8px;min-width:0;display:flex}.ZkiH0q_fieldKey{min-width:96px;color:var(--dsw-alias-label-caption);flex:none}.ZkiH0q_fieldValue{min-width:0;color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;flex:auto;margin:0}.ZkiH0q_files{flex-wrap:wrap;gap:4px 12px;margin:0 0 8px;padding:0;list-style:none;display:flex}.ZkiH0q_file{align-items:baseline;gap:6px;min-width:0;display:flex}.ZkiH0q_filePath{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.ZkiH0q_fileAction{color:var(--dsw-alias-label-caption)}.ZkiH0q_catalogNotice{color:var(--dsw-alias-label-caption);margin:0 0 6px}.ZkiH0q_entries{flex-direction:column;gap:4px;margin:0;padding:0;list-style:none;display:flex}.ZkiH0q_entry{gap:8px;min-width:0;display:flex}.ZkiH0q_entryName{color:var(--dsw-alias-label-secondary);flex:none}.ZkiH0q_entryDescription{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;overflow:hidden}.ZkiH0q_sections{flex-direction:column;gap:8px;margin:0;display:flex}.ZkiH0q_section{flex-direction:column;gap:2px;min-width:0;display:flex}.ZkiH0q_sectionName{color:var(--dsw-alias-label-caption)}.ZkiH0q_sectionText{color:var(--dsw-alias-label-secondary);white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.ZkiH0q_relaySender{color:var(--dsw-alias-label-caption);overflow-wrap:anywhere;margin:0 0 6px}.ZkiH0q_recalls{flex-direction:column;gap:2px;margin:0 0 8px;padding:0;list-style:none;display:flex}.ZkiH0q_recall{gap:8px;min-width:0;display:flex}.ZkiH0q_recallLabel{color:var(--dsw-alias-label-secondary);overflow-wrap:anywhere}.ZkiH0q_recallCounts{color:var(--dsw-alias-label-caption);flex:none}";
		const tagId$13 = "@deepseek-ai/dsh-client-ui-chat/ContextBody.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$13) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$13;
			tag.textContent = css$13;
			document.head.appendChild(tag);
		}
		var ContextBody_module_css_default = {
			"catalogNotice": "ZkiH0q_catalogNotice",
			"entries": "ZkiH0q_entries",
			"entry": "ZkiH0q_entry",
			"entryDescription": "ZkiH0q_entryDescription",
			"entryName": "ZkiH0q_entryName",
			"field": "ZkiH0q_field",
			"fieldKey": "ZkiH0q_fieldKey",
			"fieldValue": "ZkiH0q_fieldValue",
			"fields": "ZkiH0q_fields",
			"file": "ZkiH0q_file",
			"fileAction": "ZkiH0q_fileAction",
			"filePath": "ZkiH0q_filePath",
			"files": "ZkiH0q_files",
			"recall": "ZkiH0q_recall",
			"recallCounts": "ZkiH0q_recallCounts",
			"recallLabel": "ZkiH0q_recallLabel",
			"recalls": "ZkiH0q_recalls",
			"relaySender": "ZkiH0q_relaySender",
			"section": "ZkiH0q_section",
			"sectionName": "ZkiH0q_sectionName",
			"sectionText": "ZkiH0q_sectionText",
			"sections": "ZkiH0q_sections",
			"text": "ZkiH0q_text"
		};
		//#endregion