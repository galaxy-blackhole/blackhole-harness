/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 10/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 *      SỬA 10/11/2026 (chủ dự án yêu cầu): XOÁ CSS của icon "con cá" ở chỉ báo đang chạy —
 *      .EvIC1a_runningIcon · .EvIC1a_runningWhaleAnimated (APNG base64 29 477 ký tự) ·
 *      .EvIC1a_runningWhaleStill · khối @supports mask-mode của chúng, cùng 3 khoá tương ứng
 *      trong ChatView_module_css_default. Xem docs/GBH-SAI-KHAC-CO-CHU-DICH.md (mục ui-chat).
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/client/chat/use-chat-scroll.js
		/** Composes viewport operations, reading policy, and history navigation for Chat. */
		/**
		* Coordinate scroll policy after Chat content commits. Initial history must be ready
		* before automatic scroll or resize handling can initialize reading state and fold motion.
		* New submitted input supersedes pending reader sampling.
		* @param input - current Chat content, scroll memory, and history operations.
		* @returns element refs, visible reading state, and navigation callbacks.
		*/
		function useChatScroll(input) {
			const { ready, order, firstSeq, lastKey, lastIsUser, steeringId, submissionId, running, deferCompletedTurns, loadedTurns, chatScroll, hasMore, loadingOlder, loadOlder, loadThrough, transcriptView } = input;
			const { viewport, listRef, columnRef } = useChatViewport();
			const { reading, state } = useChatReading(viewport, chatScroll, loadedTurns.at(-1)?.turn ?? null);
			const navigationInput = (0, react.useMemo)(() => ({
				firstSeq,
				loadingOlder,
				hasMore,
				loadOlder,
				loadThrough
			}), [
				firstSeq,
				loadingOlder,
				hasMore,
				loadOlder,
				loadThrough
			]);
			const { navigation, busyTurn } = useChatNavigation(viewport, reading, navigationInput);
			const content = (0, react.useRef)({
				input,
				applied: null,
				opened: false
			});
			const cancelPendingFollow = (0, react.useCallback)(() => {
				viewport.motion.cancelInput();
			}, [viewport]);
			const processContent = (0, react.useCallback)(() => {
				const current = content.current.input;
				if (!current.ready && !content.current.opened) return;
				const previous = content.current.applied;
				const ownInput = current.lastIsUser && current.lastKey !== previous?.lastKey || current.steeringId !== null && current.steeringId !== previous?.steeringId && current.steeringId !== previous?.submissionId || current.submissionId !== null && current.submissionId !== previous?.submissionId && current.submissionId !== previous?.steeringId;
				if (reading.pending && !ownInput) return;
				content.current.applied = current;
				if (current.ready && !content.current.opened) {
					content.current.opened = true;
					navigation.reset();
					reading.restore();
					return;
				}
				if (ownInput) {
					navigation.cancel();
					if (current.deferCompletedTurns && reading.followInputFold()) return;
					reading.followTail(current.deferCompletedTurns ? "smooth" : "instant");
					return;
				}
				if (navigation.contentCommitted()) {
					navigation.reconcile();
					return;
				}
				if ((previous === null || current.ready !== previous.ready || current.firstSeq !== previous.firstSeq || current.lastKey !== previous.lastKey || current.order.length !== previous.order.length || current.running !== previous.running || current.steeringId !== previous.steeringId || current.submissionId !== previous.submissionId) && reading.followingTail) {
					navigation.cancel();
					if (current.deferCompletedTurns && reading.followInputFold()) return;
					reading.followTail();
				} else navigation.reconcile();
			}, [reading, navigation]);
			(0, react.useLayoutEffect)(() => {
				const disconnectViewport = viewport.connect({
					scroll: (event) => {
						if (!content.current.opened) return;
						if (!event.movedByReader && viewport.motion.foldActive()) return;
						reading.onScroll(event);
					},
					scrollEnd: (outer) => {
						reading.onScrollEnd(outer);
						navigation.readerSettled();
					},
					interact: () => {
						navigation.cancel();
					},
					intent: () => {
						cancelPendingFollow();
						reading.interruptFollow();
					},
					resize: () => {
						if (!content.current.opened) return;
						if (navigation.contentCommitted()) {
							navigation.reconcile();
							return;
						}
						if (!content.current.input.deferCompletedTurns || !viewport.motion.foldActive()) reading.onResize();
						navigation.reconcile();
					}
				});
				const disconnectReading = reading.connect((sample) => {
					navigation.readerSampled(sample);
					processContent();
				});
				return () => {
					disconnectViewport();
					disconnectReading();
					content.current.opened = false;
					content.current.applied = null;
				};
			}, [
				viewport,
				reading,
				navigation,
				processContent,
				cancelPendingFollow
			]);
			(0, react.useLayoutEffect)(() => {
				const previous = content.current.input;
				content.current.input = {
					ready,
					order,
					lastKey,
					lastIsUser,
					steeringId,
					submissionId,
					running,
					loadedTurns,
					chatScroll,
					deferCompletedTurns,
					transcriptView,
					...navigationInput
				};
				if (!deferCompletedTurns) {
					cancelPendingFollow();
					reading.interruptFollow();
				}
				viewport.updateTurns(loadedTurns);
				const layoutChanged = previous.order !== order || previous.ready !== ready;
				if (layoutChanged) viewport.invalidate();
				viewport.reclaimBelow();
				processContent();
				if (layoutChanged && content.current.opened) reading.refreshActiveTurn();
			}, [
				viewport,
				reading,
				processContent,
				navigationInput,
				ready,
				order,
				lastKey,
				lastIsUser,
				steeringId,
				submissionId,
				running,
				loadedTurns,
				chatScroll,
				deferCompletedTurns,
				transcriptView,
				cancelPendingFollow
			]);
			const previousView = (0, react.useRef)(transcriptView);
			(0, react.useLayoutEffect)(() => {
				if (previousView.current === transcriptView) return;
				previousView.current = transcriptView;
				cancelPendingFollow();
				reading.interruptFollow();
				return viewport.motion.onFoldIdle(() => {
					viewport.resetBelow();
					if (content.current.opened) reading.onResize();
				});
			}, [
				transcriptView,
				viewport,
				reading,
				cancelPendingFollow
			]);
			const returnToBottom = (0, react.useCallback)(() => {
				cancelPendingFollow();
				navigation.cancel();
				reading.followTail();
			}, [
				navigation,
				reading,
				cancelPendingFollow
			]);
			return {
				listRef,
				columnRef,
				...state,
				busyTurn,
				motion: viewport.motion,
				navigateToTurn: navigation.navigateToTurn,
				loadEarlier: navigation.loadEarlier,
				returnToBottom
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/ChatView.module.css.mjs
		const css$16 = ".EvIC1a_frame{flex-direction:column;flex:auto;min-height:0;display:flex;position:relative;container-type:inline-size}.EvIC1a_root{flex-direction:column;flex:auto;min-height:0;display:flex;position:relative;overflow:visible clip}.EvIC1a_scroll{min-height:0;padding:16px calc(var(--dsh-composer-side-clearance) + 16px);flex:auto;overflow-y:auto;container-type:inline-size}.EvIC1a_root[data-chat-following-tail] .EvIC1a_scroll,[data-conversation-scroll]:has(.EvIC1a_root[data-chat-following-tail]){overflow-anchor:none}[data-conversation-scroll] .EvIC1a_frame,[data-conversation-scroll] .EvIC1a_root{flex:none;height:auto;min-height:auto}[data-conversation-scroll] .EvIC1a_scroll{flex:none;min-height:auto;overflow:visible}.EvIC1a_column{max-width:var(--dsh-chat-content-width);flex-direction:column;width:100%;margin:0 auto;display:flex}:is(.EvIC1a_column,[data-slot=\"conversation.chat.flow\"])>:not([hidden]):not(.EvIC1a_flowItem:is(:empty,:has(>[data-slot=\"conversation.chat.node\"]:empty)))~:not([hidden]):not(.EvIC1a_flowItem:is(:empty,:has(>[data-slot=\"conversation.chat.node\"]:empty))),.EvIC1a_column:has(>.EvIC1a_older)>[data-slot=\"conversation.chat.flow\"]>:not([hidden]):not(.EvIC1a_flowItem:is(:empty,:has(>[data-slot=\"conversation.chat.node\"]:empty))){margin-top:var(--dsh-chat-flow-gap,6px)}.EvIC1a_flowItem[data-chat-group-part=response],:is(.EvIC1a_column,[data-slot=\"conversation.chat.flow\"])>[data-chat-group-part=response]:not([hidden]):not(:empty)+:not([hidden]):not(.EvIC1a_flowItem:is(:empty,:has(>[data-slot=\"conversation.chat.node\"]:empty))):not(.EvIC1a_running){--dsh-chat-flow-gap:12px}.EvIC1a_flowItem{min-width:0}.EvIC1a_turnSpacer{height:0}.EvIC1a_column[data-chat-motion]>:not([data-chat-motion]),.EvIC1a_column[data-chat-motion]>[data-slot=\"conversation.chat.flow\"]>:not([data-chat-motion]){transition:margin-top .16s cubic-bezier(.4,0,.2,1)}.EvIC1a_column[data-input-fold]>:not([data-chat-motion]),.EvIC1a_column[data-input-fold]>[data-slot=\"conversation.chat.flow\"]>:not([data-chat-motion]){transition:none}@media (prefers-reduced-motion:reduce){.EvIC1a_column[data-chat-motion]>:not([data-chat-motion]),.EvIC1a_column[data-chat-motion]>[data-slot=\"conversation.chat.flow\"]>:not([data-chat-motion]){transition:none}}.EvIC1a_flowItem[data-chat-flow-kind=turn-process],.EvIC1a_flowItem[data-turn-process-answer],:is(.EvIC1a_column,[data-slot=\"conversation.chat.flow\"])>[data-chat-flow-kind=turn-process]+:not([hidden]):not(.EvIC1a_flowItem:is(:empty,:has(>[data-slot=\"conversation.chat.node\"]:empty))):not(.EvIC1a_running){--dsh-chat-flow-gap:16px}.EvIC1a_flowItem:is(:empty,:has(>[data-slot=\"conversation.chat.node\"]:empty)){height:0}.EvIC1a_callRow{border-radius:var(--dsw-radius-sm)}.EvIC1a_hint{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px))}.EvIC1a_running{--dsh-chat-flow-gap:12px;--dsw-alias-label-shimmer:var(--dsw-alias-label-deep-diving-shimmer);color:var(--dsw-alias-label-deep-diving);font-size:calc(var(--dsh-content-font-size,14px) - 2px);line-height:calc(22px + var(--dsh-content-font-delta,0px));flex-direction:column;align-items:flex-start;display:flex}:is(.EvIC1a_column,[data-slot=\"conversation.chat.flow\"])>:nth-last-child(2 of :not([hidden]):not(.EvIC1a_flowItem:is(:empty,:has(>[data-slot=\"conversation.chat.node\"]:empty)))):is(.EvIC1a_flowItem:not([data-chat-flow-kind=user]):not([data-chat-flow-kind=steering]):not([data-chat-flow-kind=turn-trigger]),[data-chat-group-key])~.EvIC1a_running>.EvIC1a_runningDivider{display:block}.EvIC1a_runningDivider{background:color-mix(in srgb, var(--dsw-alias-border-l1) 75%, var(--dsw-alias-border-l2));pointer-events:none;width:100%;height:.5px;margin:8px 0 10px;display:none}.EvIC1a_runningContent{align-items:center;gap:6px;min-width:0;display:inline-flex}.EvIC1a_runningText{font-variant-numeric:tabular-nums;min-width:0}.EvIC1a_openError{color:var(--dsw-alias-state-error-primary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px))}.EvIC1a_older{justify-content:center;display:flex}.EvIC1a_older button{border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover-solid);cursor:pointer;border:none;padding:4px 12px;font-size:12px}.EvIC1a_older button:disabled{cursor:default;opacity:.6}.EvIC1a_toBottomSlot{z-index:8;height:0;padding-right:max(calc(var(--dsh-composer-side-clearance) + 16px), calc((100% - var(--dsh-chat-content-width)) / 2));pointer-events:none;justify-content:flex-end;display:flex;position:absolute;bottom:16px;left:0;right:0}[data-conversation-scroll] .EvIC1a_toBottomSlot{bottom:calc(var(--dsh-composer-height,152px) + 16px);position:sticky}.EvIC1a_toBottom{--dsw-elevation-stroke-color:var(--dsw-alias-border-l3);corner-shape:round;width:34px;height:34px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-button-floating-fill);box-shadow:var(--dsw-elevation-panel);cursor:pointer;pointer-events:auto;border:0;border-radius:100px;justify-content:center;align-items:center;margin-top:-34px;padding:0;display:flex}.EvIC1a_toBottom:hover{background:var(--dsw-alias-button-floating-hover)}.EvIC1a_modalAction{min-width:72px}";
		const tagId$16 = "@deepseek-ai/dsh-client-ui-chat/ChatView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$16) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$16;
			tag.textContent = css$16;
			document.head.appendChild(tag);
		}
		var ChatView_module_css_default = {
			"callRow": "EvIC1a_callRow",
			"column": "EvIC1a_column",
			"flowItem": "EvIC1a_flowItem",
			"frame": "EvIC1a_frame",
			"hint": "EvIC1a_hint",
			"modalAction": "EvIC1a_modalAction",
			"older": "EvIC1a_older",
			"openError": "EvIC1a_openError",
			"root": "EvIC1a_root",
			"running": "EvIC1a_running",
			"runningContent": "EvIC1a_runningContent",
			"runningDivider": "EvIC1a_runningDivider",
			"runningText": "EvIC1a_runningText",
			"scroll": "EvIC1a_scroll",
			"toBottom": "EvIC1a_toBottom",
			"toBottomSlot": "EvIC1a_toBottomSlot",
			"turnSpacer": "EvIC1a_turnSpacer"
		};
		//#endregion
		//#region lib/types/client/chat/ChatView.js
		/** Host/OS refusal text for the file-open dialog; empty throws keep a locale fallback. */
		function openFailureMessage(error, fallback) {
			const message = error instanceof Error ? error.message : String(error);
			return message === "" ? fallback : message;
		}
		/**
		* Durable input identities suppress matching echoes in the same render.
		* The last input's Turn also distinguishes an empty opening control from
		* one whose human input or trigger notice is already present.
		*/
		function observedInputs(order, nodes) {
			const observed = /* @__PURE__ */ new Set();
			let lastInputTurn;
			for (const key of order) {
				const node = nodes.get(key);
				if (node === void 0 || !isAtOrOutside(node, "input")) continue;
				if (node.location.kind === "turn" || node.location.kind === "step") lastInputTurn = node.location.turn.turn;
				const data = node.data;
				const source = typeof data === "object" && data !== null && "source" in data ? data.source : void 0;
				if (typeof source === "object" && source !== null && "kind" in source && source.kind === "user" && "rpcId" in source && typeof source.rpcId === "string") observed.add(source.rpcId);
			}
			return {
				rpcIds: observed,
				lastInputTurn
			};
		}
		/** How long fold transitions stay enabled after a Turn stops running. */
		const MOTION_TAIL_MS = 800;
		/**
		* The chat view slot entry: pure component over the composed props; each
		* ordered business Node crosses the keyed renderer seat.
		*/
		function ChatView({ useSession, useChat, useConversation, useSessions, renderSlot, sessionId, openFile, openExternalLink, loadOlder, loadThrough, loadImage, inspectCall, chatScroll, forkAt, fileMentions, usePresentation, useProjection, t }) {
			const order = useChat((s) => s.order);
			const groupedEntries = useConversation((snapshot) => snapshot.views.grouped("chat")?.entries);
			const entries = (0, react.useMemo)(() => groupedEntries ?? order.map((key) => ({
				kind: "node",
				key
			})), [groupedEntries, order]);
			const nodeStore = useChat((s) => s.nodes);
			const deferCompletedTurns = usePresentation((policy) => policy.collapseTiming === "next-input");
			const transcriptView = usePresentation((policy) => policy.mode);
			const turnNavigationItems = useChat((s) => s.navigation.items());
			const turnOutline = useProjection("turnOutline");
			const railItems = (0, react.useMemo)(() => mergeTurnRailItems(turnNavigationItems, turnOutline), [turnNavigationItems, turnOutline]);
			const inbox = useProjection("inbox");
			const cwd = useSessions((s) => s.byId[sessionId]?.cwd);
			const fileImages = (0, react.useMemo)(() => ({
				resolve: (path) => fileMediaUrl(document.baseURI, resolveWorkspacePath(cwd, path)),
				labels: {
					open: t("image.open"),
					loading: t("image.loading"),
					failed: t("image.failed"),
					dialog: t("image.dialog"),
					close: t("image.close")
				}
			}), [cwd, t]);
			const running = useSession((s) => s.running);
			const [motionTail, setMotionTail] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!deferCompletedTurns) {
					setMotionTail(false);
					return;
				}
				if (running) {
					setMotionTail(true);
					return;
				}
				const timer = setTimeout(() => {
					setMotionTail(false);
				}, MOTION_TAIL_MS);
				return () => {
					clearTimeout(timer);
				};
			}, [running, deferCompletedTurns]);
			const openState = useSession((s) => s.openState);
			const openError = useSession((s) => s.openError);
			const hasMore = useSession((s) => s.hasMore);
			const loadingOlder = useSession((s) => s.loadingOlder);
			const [fileOpenError, setFileOpenError] = (0, react.useState)(null);
			const [fileOpenBusy, setFileOpenBusy] = (0, react.useState)(false);
			const fileOpenRequest = (0, react.useRef)(0);
			const requestOpenFile = (0, react.useCallback)((path, options) => {
				const id = ++fileOpenRequest.current;
				setFileOpenBusy(true);
				(options === void 0 ? openFile(path) : openFile(path, options)).then(() => {
					if (id !== fileOpenRequest.current) return;
					setFileOpenError(null);
					setFileOpenBusy(false);
				}, (error) => {
					if (id !== fileOpenRequest.current) return;
					setFileOpenError({
						path,
						message: openFailureMessage(error, t("fileOpen.unknown"))
					});
					setFileOpenBusy(false);
				});
			}, [openFile, t]);
			const closeFileOpenError = (0, react.useCallback)(() => {
				fileOpenRequest.current += 1;
				setFileOpenError(null);
				setFileOpenBusy(false);
			}, []);
			const inboxSteering = (0, react.useMemo)(() => inbox?.["next-step"].filter((message) => message.source.kind === "user") ?? [], [inbox]);
			const pendingSubmissions = useSession((s) => s.pendingSubmissions);
			const [visibleSubmissions, lastInputTurn] = (0, react.useMemo)(() => {
				if (pendingSubmissions.length === 0) return [pendingSubmissions, void 0];
				const observed = observedInputs(order, nodeStore);
				return [pendingSubmissions.filter((submission) => submission.placement !== "queued" && !observed.rpcIds.has(submission.requestId)), observed.lastInputTurn];
			}, [
				pendingSubmissions,
				order,
				nodeStore
			]);
			const pendingInputs = (0, react.useMemo)(() => {
				const local = new Map(visibleSubmissions.map((submission) => [submission.requestId, submission]));
				const localIds = new Set(pendingSubmissions.filter((submission) => submission.placement !== "queued").map((submission) => submission.requestId));
				return [...inboxSteering.flatMap((item) => {
					const source = item.source;
					if (source.kind !== "user" || !("rpcId" in source)) return [item];
					const submission = local.get(source.rpcId);
					if (submission === void 0) return localIds.has(source.rpcId) ? [] : [item];
					local.delete(source.rpcId);
					return [submission];
				}), ...local.values()];
			}, [
				inboxSteering,
				pendingSubmissions,
				visibleSubmissions
			]);
			const deferCollapse = deferCompletedTurns && !pendingInputs.some((item) => "requestId" in item && item.placement === "transcript");
			const firstKey = order[0];
			const firstSeq = firstKey === void 0 ? null : nodeStore.get(firstKey)?.anchorSeq ?? null;
			const lastKey = order.at(-1) ?? null;
			const latestSteering = pendingInputs.findLast((item) => "source" in item);
			const steeringId = latestSteering?.source.kind === "user" && "rpcId" in latestSteering.source ? latestSteering.source.rpcId : latestSteering?.id ?? null;
			const scroll = useChatScroll({
				ready: openState === "open",
				order,
				firstSeq,
				lastKey,
				running,
				loadingOlder,
				hasMore,
				chatScroll,
				loadOlder,
				loadThrough,
				deferCompletedTurns,
				lastIsUser: lastKey !== null && nodeStore.get(lastKey)?.kind === "user",
				steeringId,
				submissionId: visibleSubmissions.at(-1)?.requestId ?? null,
				loadedTurns: turnNavigationItems,
				transcriptView
			});
			const flowContext = (0, react.useMemo)(() => ({ motion: scroll.motion }), [scroll.motion]);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ChatView_module_css_default.frame,
				children: [
					scroll.initialized && (0, react_jsx_runtime.jsx)(TurnNavigator, {
						items: railItems,
						activeTurn: scroll.activeTurn,
						busyTurn: scroll.busyTurn,
						onNavigate: scroll.navigateToTurn,
						t
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: ChatView_module_css_default.root,
						"data-chat-following-tail": scroll.followingTail ? "" : void 0,
						children: (0, react_jsx_runtime.jsxs)("div", {
							ref: scroll.listRef,
							className: ChatView_module_css_default.scroll,
							children: [(0, react_jsx_runtime.jsxs)("div", {
								ref: scroll.columnRef,
								className: ChatView_module_css_default.column,
								"data-chat-flow": "",
								"data-chat-motion": deferCompletedTurns && scroll.initialized && (running || motionTail || pendingInputs.length > 0) ? "" : void 0,
								children: [
									openState === "loading" && (0, react_jsx_runtime.jsx)("div", {
										className: ChatView_module_css_default.hint,
										children: t("chat.loadingHistory")
									}),
									openState === "error" && openError !== null && (0, react_jsx_runtime.jsx)("div", {
										className: ChatView_module_css_default.openError,
										children: t("chat.loadError", {
											message: openError.message,
											code: openError.code
										})
									}),
									hasMore && (0, react_jsx_runtime.jsx)("div", {
										className: ChatView_module_css_default.older,
										children: (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											disabled: loadingOlder,
											onClick: scroll.loadEarlier,
											children: loadingOlder ? t("loading") : t("chat.loadOlder")
										})
									}),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownDelegateProvider, {
										openFile: requestOpenFile,
										openExternalLink,
										fileImages,
										children: renderSlot("conversation.chat.flow", {
											entries,
											pendingInputs,
											lastInputTurn,
											deferCollapse,
											cwd,
											openFile: requestOpenFile,
											inspectCall,
											forkAt,
											loadImage,
											fileMentions
										}, { hookContext: flowContext })
									})
								]
							}), (0, react_jsx_runtime.jsx)("div", {
								className: ChatView_module_css_default.turnSpacer,
								"data-chat-turn-spacer": true,
								"aria-hidden": "true"
							})]
						})
					}),
					!scroll.followingTail && (0, react_jsx_runtime.jsx)("div", {
						className: ChatView_module_css_default.toBottomSlot,
						children: (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: ChatView_module_css_default.toBottom,
							"aria-label": t("chat.toBottom"),
							onClick: scroll.returnToBottom,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})
						})
					}),
					fileOpenError !== null && (0, react_jsx_runtime.jsx)(FileOpenErrorDialog, {
						message: fileOpenError.message,
						busy: fileOpenBusy,
						onClose: closeFileOpenError,
						onRetry: () => {
							requestOpenFile(fileOpenError.path);
						},
						t
					})
				]
			});
		}
		/** In-page Host open-path refusal: the wire reason plus a retry of the same path. */
		function FileOpenErrorDialog({ message, busy, onClose, onRetry, t }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose,
				closeLabel: t("close"),
				title: t("fileOpen.title"),
				description: message,
				footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					className: ChatView_module_css_default.modalAction,
					onClick: onClose,
					children: t("cancel")
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					className: ChatView_module_css_default.modalAction,
					disabled: busy,
					onClick: onRetry,
					children: t("retry")
				})] })
			});
		}
		//#endregion