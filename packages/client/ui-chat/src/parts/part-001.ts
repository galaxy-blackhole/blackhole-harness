/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region ../../util/workspace-path/lib/index.js
		/**
		* The `dsh-resource://file/…` address grammar: how a file is named across the
		* Sidebar and the resource model, built and parsed without touching a
		* filesystem.
		* @module
		*/
		/** The scheme and type every file address opens with. */
		const FILE_ADDRESS_PREFIX = "dsh-resource://file/";
		/** Component-encode one id or path segment, keeping `:` literal for drive letters. */
		function encodeSegment(segment) {
			return encodeURIComponent(segment).replace(/%3A/gi, ":");
		}
		/** Encode a `/`-separated path segment by segment. */
		function encodePath(path) {
			return path.split("/").map(encodeSegment).join("/");
		}
		/**
		* Build the address of a file read through one Session.
		* @param sessionId - the Session whose Host workspace resolves the path.
		* @param path - absolute or workspace-relative path; backslashes are normalized to `/`, and leading `./` prefixes are dropped.
		* @returns the `dsh-resource://file/session/<sessionId>/<path>` address.
		*/
		function sessionFileAddress(sessionId, path) {
			const normalized = path.replace(/\\/g, "/").replace(/^(?:\.\/)+/, "");
			return `${FILE_ADDRESS_PREFIX}session/${encodeSegment(sessionId)}/${encodePath(normalized)}`;
		}
		/**
		* Browser-safe Workspace path and display helpers.
		* @module @deepseek-ai/dsh-util-workspace-path
		*/
		/** Whether a path uses a Windows drive or UNC prefix. */
		function isWindowsStylePath(value) {
			return /^[A-Za-z]:[/\\]/.test(value) || value.startsWith("\\\\");
		}
		/**
		* Whether a path is absolute in either spelling the Host accepts: POSIX (`/a/b`) or Windows drive or UNC.
		* @param path - the path to classify.
		* @returns `true` for an absolute path; `false` for a Workspace-relative one.
		*/
		function isAbsoluteWorkspacePath(path) {
			return path.startsWith("/") || isWindowsStylePath(path);
		}
		/**
		* Resolve a Workspace-relative path into the Host-facing spelling used by path operations.
		* @param cwd - Session Workspace root, when known.
		* @param path - Absolute or Workspace-relative path.
		* @returns an absolute path when a Workspace root is available, otherwise the original path.
		*/
		function resolveWorkspacePath(cwd, path) {
			if (isAbsoluteWorkspacePath(path)) return path;
			if (cwd === void 0 || cwd === "") return path;
			const separator = isWindowsStylePath(cwd) && cwd.includes("\\") ? "\\" : "/";
			return `${cwd.replace(/[/\\]+$/, "")}${separator}${path.replace(/^[/\\]+/, "")}`;
		}
		/**
		* The address for a path as a caller holds it: a relative path, or an absolute
		* path inside the Session's workspace, becomes a `session`-scoped address; an
		* absolute path outside it, or one whose workspace root is unknown, keeps its
		* absolute path in that Session's address.
		* @param sessionId - the Session the path is read in.
		* @param cwd - that Session's workspace root, when known.
		* @param path - absolute or workspace-relative path, in either separator spelling.
		* @returns the `dsh-resource://file/…` address.
		*/
		function fileAddressFor(sessionId, cwd, path) {
			const normalized = path.replace(/\\/g, "/");
			if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized);
			const root = cwd === void 0 ? "" : cwd.replace(/\\/g, "/").replace(/\/+$/, "");
			if (root !== "" && normalized === root) return sessionFileAddress(sessionId, "");
			if (root !== "" && normalized.startsWith(`${root}/`)) return sessionFileAddress(sessionId, normalized.slice(root.length + 1));
			return sessionFileAddress(sessionId, normalized);
		}
		/**
		* Address a decoded absolute file path through the authenticated file route.
		* @param base - HTTP(S) application base, including its deployment prefix, or `dsh-app://app/`.
		* @param path - Native file path; URL escapes in authored Markdown must already be decoded.
		* @returns File URL, or undefined for unsupported transports and non-absolute paths.
		*/
		function fileMediaUrl(base, path) {
			if (!/^https?:/u.test(base) && !base.startsWith("dsh-app://app/") || !isAbsoluteWorkspacePath(path) || /^[/\\]{2}/u.test(path) || /[\u0000-\u001f\u007f]/u.test(path)) return void 0;
			return new URL(`api/file?path=${encodeURIComponent(path)}`, base).href;
		}
		//#endregion
		//#region lib/types/client/contract/snapshot.js
		const EMPTY_LIST$1 = [];
		const EMPTY_TIMELINE = {
			turnOrder: EMPTY_LIST$1,
			turns: /* @__PURE__ */ new Map()
		};
		const EMPTY_NODE_SOURCE = {
			getSnapshot: () => void 0,
			subscribe: () => () => {}
		};
		const EMPTY_BOTTOM_SOURCE = {
			getSnapshot: () => false,
			subscribe: () => () => {}
		};
		const EMPTY_NODE_PROCESS_SOURCE = {
			getSnapshot: () => void 0,
			subscribe: () => () => {}
		};
		const EMPTY_TURN_NODE_SOURCE = {
			getSnapshot: () => EMPTY_LIST$1,
			subscribe: () => () => {}
		};
		/** Empty Chat target used before a view builder is registered. */
		const EMPTY_CHAT_SNAPSHOT = {
			order: EMPTY_LIST$1,
			nodes: {
				get: () => void 0,
				source: () => EMPTY_NODE_SOURCE,
				bottomSource: () => EMPTY_BOTTOM_SOURCE,
				turnDataSource: () => EMPTY_TURN_NODE_SOURCE,
				processSource: () => EMPTY_NODE_PROCESS_SOURCE,
				values: () => EMPTY_LIST$1
			},
			locations: {
				getTurn: () => EMPTY_LIST$1,
				getStep: () => EMPTY_LIST$1
			},
			navigation: { items: () => EMPTY_LIST$1 },
			timeline: EMPTY_TIMELINE,
			legacy: {
				nodes: EMPTY_LIST$1,
				turnTimings: /* @__PURE__ */ new Map(),
				turnEnds: /* @__PURE__ */ new Map(),
				partial: null,
				runningCalls: EMPTY_LIST$1
			}
		};
		//#endregion
		//#region lib/types/client/chat/ApprovalCommand.js
		/**
		* Extract a shell command from a correlated Tool call when its arguments carry one.
		* @param call - Tool call arguments, when a correlated call exists.
		* @returns command text, or undefined for absent, malformed, or unrelated arguments.
		*/
		function commandOf(call) {
			if (call === void 0) return void 0;
			try {
				const args = JSON.parse(call.argsRaw);
				return typeof args.command === "string" ? args.command : void 0;
			} catch {
				return;
			}
		}
		/**
		* Render the command of the Chat Tool node correlated with an approval.
		* @param props - Approval identity and Session-standard Chat selector hook.
		* @returns command text when the correlated call carries one.
		*/
		function ApprovalCommand({ callId, useChat }) {
			return useChat((snapshot) => {
				for (const node of snapshot.nodes.values()) {
					const root = node.kind === "tool-call" ? node.data.root : void 0;
					if (root !== void 0 && root.callId === callId && !("kind" in root) && root.phase === "start") return commandOf(root);
				}
			}) ?? null;
		}
		//#endregion
		//#region lib/types/client/contract/group-tree.js
		const DEPTH = {
			exchange: 0,
			input: 1,
			turn: 2,
			process: 3
		};
		/**
		* Test whether a Node stands at a group-tree position or outside it.
		* @param node - Chat Node.
		* @param position - group-tree position to compare against.
		* @returns whether the Node's position is `position` or an outer one.
		*/
		function isAtOrOutside(node, position) {
			return node.groupTree !== void 0 && DEPTH[node.groupTree] <= DEPTH[position];
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/chat/TurnNavigator.module.css.mjs
		const css$17 = ".eGxaPq_slot{z-index:7;height:0;padding-inline:calc(var(--dsh-composer-side-clearance) + 16px);pointer-events:none;position:absolute;top:0;left:0;right:0;container-type:inline-size}[data-conversation-scroll] .eGxaPq_slot{position:sticky}.eGxaPq_frame{--turn-rail-band:calc(var(--dsh-conversation-viewport-height,100dvh) - var(--dsh-composer-height,152px));--turn-preview-height:100px;top:calc(var(--turn-rail-band) / 2);width:28px;max-height:min(max(0px, calc(var(--turn-rail-band) - 64px)), 420px);contain:layout;cursor:pointer;pointer-events:auto;position:absolute;right:12px;transform:translateY(-50%)}.eGxaPq_scroller{max-height:inherit;overscroll-behavior:contain;scrollbar-width:none;position:relative;overflow-y:auto}.eGxaPq_scroller::-webkit-scrollbar{display:none}.eGxaPq_fadeTop{mask-image:linear-gradient(#0000 0,#000 24px 100%)}.eGxaPq_fadeBottom{mask-image:linear-gradient(#000 0 calc(100% - 24px),#0000 100%)}.eGxaPq_fadeTop.eGxaPq_fadeBottom{mask-image:linear-gradient(#0000 0,#000 24px calc(100% - 24px),#0000 100%)}.eGxaPq_marks{position:relative}.eGxaPq_mark{cursor:pointer;background:0 0;border:0;border-radius:8px;height:10px;padding:0;position:absolute;top:0;left:0;right:0}.eGxaPq_mark:before{background:var(--dsw-alias-border-l4);content:\"\";transform-origin:100%;border-radius:2px;width:20px;height:2px;transition:transform .14s,background-color .14s;position:absolute;top:50%;right:0;transform:translateY(-50%)scaleX(.6)}.eGxaPq_markUnloaded:before{opacity:.6;transform:translateY(-50%)scaleX(.4)}.eGxaPq_markPreview:before{background:var(--dsw-alias-label-tertiary);transform:translateY(-50%)scaleX(.9)}.eGxaPq_markBusy:before{animation:1s ease-in-out infinite eGxaPq_dsh-turn-mark-busy}.eGxaPq_markActive:before{background:var(--dsw-alias-label-primary);transform:translateY(-50%)scaleX(1)}.eGxaPq_mark:focus-visible:before{background:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));transform:translateY(-50%)scaleX(1)}.eGxaPq_mark:focus-visible{outline:none}.eGxaPq_mark:focus-visible:after{border-radius:inherit;outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-1px;content:\"\";width:20px;position:absolute;inset:0 0 0 auto}.eGxaPq_preview{top:clamp(0px, calc(var(--turn-preview-center) - var(--turn-preview-height) / 2), calc(100% - var(--turn-preview-height)));box-sizing:border-box;width:min(300px,100cqw - 120px);max-height:var(--turn-preview-height);border-radius:var(--dsw-radius-lg);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);box-shadow:var(--dsw-elevation-panel);pointer-events:none;border:0;padding:10px 12px;transition:top .14s cubic-bezier(.2,.8,.2,1);animation:.12s ease-out eGxaPq_dsh-turn-preview-enter;position:absolute;right:calc(100% + 10px);overflow:hidden}.eGxaPq_previewPrompt,.eGxaPq_previewResponse{-webkit-box-orient:vertical;display:-webkit-box;overflow:hidden}.eGxaPq_previewPrompt{font:var(--dsw-font-xs-strong-13);-webkit-line-clamp:1}.eGxaPq_previewResponse{color:var(--dsw-alias-label-caption);font:var(--dsw-font-xxs-12);-webkit-line-clamp:3;margin-top:4px}@keyframes eGxaPq_dsh-turn-preview-enter{0%{opacity:0;transform:translate(4px)}to{opacity:1;transform:translate(0)}}@keyframes eGxaPq_dsh-turn-mark-busy{0%,to{opacity:1}50%{opacity:.35}}@container (width<=900px){.eGxaPq_frame{display:none}}@media (prefers-reduced-motion:reduce){.eGxaPq_frame,.eGxaPq_scroller,.eGxaPq_mark:before,.eGxaPq_markBusy:before,.eGxaPq_preview{scroll-behavior:auto;transition:none;animation:none}}";
		const tagId$17 = "@deepseek-ai/dsh-client-ui-chat/TurnNavigator.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$17) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId$17;
			tag.textContent = css$17;
			document.head.appendChild(tag);
		}
		var TurnNavigator_module_css_default = {
			"dsh-turn-mark-busy": "eGxaPq_dsh-turn-mark-busy",
			"dsh-turn-preview-enter": "eGxaPq_dsh-turn-preview-enter",
			"fadeBottom": "eGxaPq_fadeBottom",
			"fadeTop": "eGxaPq_fadeTop",
			"frame": "eGxaPq_frame",
			"mark": "eGxaPq_mark",
			"markActive": "eGxaPq_markActive",
			"markBusy": "eGxaPq_markBusy",
			"markPreview": "eGxaPq_markPreview",
			"markUnloaded": "eGxaPq_markUnloaded",
			"marks": "eGxaPq_marks",
			"preview": "eGxaPq_preview",
			"previewPrompt": "eGxaPq_previewPrompt",
			"previewResponse": "eGxaPq_previewResponse",
			"scroller": "eGxaPq_scroller",
			"slot": "eGxaPq_slot"
		};
		//#endregion
		//#region lib/types/client/chat/TurnNavigator.js
		/** Fixed-pitch virtual turn rail with independent activation and scroll controls. */
		/** Fixed pitch between neighbouring marks; overflow scrolls inside the frame. */
		const TURN_SPACING_PX = 10;
		/** Rail padding above the first mark and below the last one, per end. */
		const RAIL_INSET_PX = 6;
		/** Fade band the mask reserves at a scrollable end. */
		const FADE_PX = 24;
		function preferredScrollBehavior() {
			return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
		}
		const TurnMark = (0, react.memo)(function TurnMark({ item, index, active, busy, previewId, registerElement, onNavigate, onPreview, onFocusChange, t }) {
			const classes = [TurnNavigator_module_css_default.mark];
			if (item.anchor.kind === "unloaded") classes.push(TurnNavigator_module_css_default.markUnloaded);
			if (active) classes.push(TurnNavigator_module_css_default.markActive);
			else if (previewId !== void 0) classes.push(TurnNavigator_module_css_default.markPreview);
			if (busy) classes.push(TurnNavigator_module_css_default.markBusy);
			return (0, react_jsx_runtime.jsx)("button", {
				ref: registerElement,
				"data-index": index,
				type: "button",
				className: classes.join(" "),
				"aria-label": t(item.anchor.kind === "loaded" ? "chat.turnNavigation.jump" : "chat.turnNavigation.jumpLoad", { turn: item.turn }),
				"aria-current": active ? "true" : void 0,
				"aria-busy": busy ? "true" : void 0,
				"aria-describedby": previewId,
				onPointerMove: () => {
					onPreview(item.turn);
				},
				onClick: () => {
					onNavigate(item);
				},
				onFocus: () => {
					onFocusChange(item.turn);
				},
				onBlur: () => {
					onFocusChange(null);
				}
			});
		});
		function TurnNavigatorRail({ items, activeTurn, busyTurn, onNavigate, t }, ref) {
			const [previewTurn, setPreviewTurn] = (0, react.useState)(null);
			const [focusedTurn, setFocusedTurn] = (0, react.useState)(null);
			const scrollerRef = (0, react.useRef)(null);
			const initialization = (0, react.useRef)({
				placed: false,
				index: 0,
				follow: null,
				publishOffset: null
			});
			/** While the pointer works the rail, follow must not move it under the hand. */
			const pointerInsideRef = (0, react.useRef)(false);
			const previewId = (0, react.useId)();
			const turnIndexes = (0, react.useMemo)(() => {
				const indexes = /* @__PURE__ */ new Map();
				items.forEach((item, index) => {
					indexes.set(item.turn, index);
				});
				return indexes;
			}, [items]);
			const activeIndex = activeTurn === null ? void 0 : turnIndexes.get(activeTurn);
			(0, react.useLayoutEffect)(() => {
				initialization.current.index = activeIndex ?? 0;
			}, [activeIndex]);
			const focusedIndex = focusedTurn === null ? void 0 : turnIndexes.get(focusedTurn);
			const previewIndex = previewTurn === null ? void 0 : turnIndexes.get(previewTurn);
			const onFocusChange = (0, react.useCallback)((turn) => {
				setFocusedTurn(turn);
				setPreviewTurn(turn);
			}, []);
			const virtualizer = (0, _tanstack_react_virtual.useVirtualizer)({
				count: items.length,
				enabled: items.length >= 2,
				directDomUpdates: true,
				directDomUpdatesMode: "transform",
				useScrollendEvent: true,
				getScrollElement: (0, react.useCallback)(() => scrollerRef.current, []),
				getItemKey: (0, react.useCallback)((index) => items[index]?.turn ?? index, [items]),
				estimateSize: () => TURN_SPACING_PX,
				measureElement: () => TURN_SPACING_PX,
				initialRect: {
					width: 0,
					height: 0
				},
				initialOffset: 0,
				scrollToFn: (offset, options, instance) => {
					if (initialization.current.placed) (0, _tanstack_react_virtual.elementScroll)(offset, options, instance);
				},
				observeElementOffset: (instance, notify) => {
					initialization.current.publishOffset = notify;
					const dispose = (0, _tanstack_react_virtual.observeElementOffset)(instance, notify);
					return () => {
						dispose?.();
						initialization.current.placed = false;
						initialization.current.follow = null;
						initialization.current.publishOffset = null;
					};
				},
				observeElementRect: (instance, notify) => {
					const element = instance.scrollElement;
					const Observer = instance.targetWindow?.ResizeObserver;
					if (element === null || Observer === void 0) return;
					const observer = new Observer(([entry]) => {
						if (entry === void 0) return;
						const box = entry.borderBoxSize[0];
						const rect = {
							width: Math.round(box?.inlineSize ?? entry.contentRect.width),
							height: Math.round(box?.blockSize ?? entry.contentRect.height)
						};
						const initial = initialization.current;
						if (!initial.placed && rect.height > 0) {
							const max = Math.max(0, instance.getTotalSize() - rect.height);
							const center = initial.index * TURN_SPACING_PX + RAIL_INSET_PX;
							const target = Math.max(0, Math.min(max, center - rect.height / 2));
							initial.placed = true;
							initial.follow = {
								index: initial.index,
								count: instance.options.count,
								height: rect.height
							};
							element.scrollTop = target;
							initial.publishOffset?.(target, false);
						}
						notify(rect);
					});
					observer.observe(element, { box: "border-box" });
					return () => {
						observer.disconnect();
					};
				},
				paddingStart: RAIL_INSET_PX - TURN_SPACING_PX / 2,
				paddingEnd: RAIL_INSET_PX - TURN_SPACING_PX / 2,
				scrollPaddingStart: FADE_PX,
				scrollPaddingEnd: FADE_PX,
				overscan: 3,
				rangeExtractor: (0, react.useCallback)((range) => {
					const indexes = (0, _tanstack_react_virtual.defaultRangeExtractor)(range);
					if (focusedIndex !== void 0) {
						const last = Math.min(range.count - 1, focusedIndex + 1);
						for (let index = Math.max(0, focusedIndex - 1); index <= last; index++) if (!indexes.includes(index)) indexes.push(index);
						indexes.sort((left, right) => left - right);
					}
					return indexes;
				}, [focusedIndex])
			});
			const scrollTop = virtualizer.scrollOffset ?? 0;
			const viewHeight = virtualizer.scrollRect?.height ?? 0;
			const virtualItems = virtualizer.getVirtualItems();
			const scrollToIndex = (0, react.useCallback)((index, reveal, behavior = preferredScrollBehavior()) => {
				const item = virtualizer.measurementsCache[index];
				const height = virtualizer.scrollRect?.height ?? 0;
				if (item === void 0 || height <= 0) return;
				const current = virtualizer.scrollOffset ?? 0;
				const center = item.start + item.size / 2;
				if (reveal === "if-needed") {
					const { scrollPaddingStart, scrollPaddingEnd } = virtualizer.options;
					if (center >= current + scrollPaddingStart && center <= current + height - scrollPaddingEnd) return;
				}
				const target = center - height / 2;
				const max = Math.max(0, virtualizer.getTotalSize() - height);
				const delta = Math.max(0, Math.min(max, target)) - current;
				if (delta !== 0) virtualizer.scrollBy(delta, { behavior });
			}, [virtualizer]);
			(0, react.useImperativeHandle)(ref, () => ({
				activateTurn(turn) {
					const index = turnIndexes.get(turn);
					const item = index === void 0 ? void 0 : items[index];
					if (item !== void 0) onNavigate(item);
				},
				scrollToTurn(turn) {
					const index = turnIndexes.get(turn);
					if (index !== void 0) scrollToIndex(index, "always");
				}
			}), [
				items,
				turnIndexes,
				onNavigate,
				scrollToIndex
			]);
			(0, react.useEffect)(() => {
				if (viewHeight <= 0) {
					initialization.current.follow = null;
					return;
				}
				if (activeIndex === void 0 || pointerInsideRef.current) return;
				const previous = initialization.current.follow;
				if (previous?.index === activeIndex && previous.count === items.length && previous.height === viewHeight) return;
				initialization.current.follow = {
					index: activeIndex,
					count: items.length,
					height: viewHeight
				};
				scrollToIndex(activeIndex, "if-needed", previous?.count === items.length && previous.height === viewHeight ? preferredScrollBehavior() : "instant");
			}, [
				activeIndex,
				items.length,
				viewHeight,
				scrollToIndex
			]);
			if (items.length < 2) return null;
			const preview = previewIndex === void 0 ? void 0 : items[previewIndex];
			const previewPosition = virtualItems.find((item) => item.index === previewIndex);
			const fadeClasses = [TurnNavigator_module_css_default.scroller];
			if (scrollTop > 1) fadeClasses.push(TurnNavigator_module_css_default.fadeTop);
			if (scrollTop < virtualizer.getTotalSize() - viewHeight - 1) fadeClasses.push(TurnNavigator_module_css_default.fadeBottom);
			return (0, react_jsx_runtime.jsx)("div", {
				className: TurnNavigator_module_css_default.slot,
				children: (0, react_jsx_runtime.jsxs)("nav", {
					className: TurnNavigator_module_css_default.frame,
					"aria-label": t("chat.turnNavigation.label"),
					onPointerEnter: () => {
						pointerInsideRef.current = true;
					},
					onPointerLeave: () => {
						pointerInsideRef.current = false;
						setPreviewTurn(null);
					},
					children: [(0, react_jsx_runtime.jsx)("div", {
						ref: scrollerRef,
						className: fadeClasses.join(" "),
						children: (0, react_jsx_runtime.jsx)("div", {
							ref: virtualizer.containerRef,
							className: TurnNavigator_module_css_default.marks,
							children: virtualItems.map(({ index, key }) => {
								const item = items[index];
								if (item === void 0) return null;
								return (0, react_jsx_runtime.jsx)(TurnMark, {
									item,
									index,
									active: item.turn === activeTurn,
									busy: item.turn === busyTurn,
									previewId: item.turn === previewTurn ? previewId : void 0,
									registerElement: virtualizer.measureElement,
									onNavigate,
									onPreview: setPreviewTurn,
									onFocusChange,
									t
								}, key);
							})
						})
					}), preview !== void 0 && previewPosition !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
						id: previewId,
						role: "tooltip",
						className: TurnNavigator_module_css_default.preview,
						style: { "--turn-preview-center": `${String(previewPosition.start + previewPosition.size / 2 - scrollTop)}px` },
						children: [(0, react_jsx_runtime.jsx)("div", {
							className: TurnNavigator_module_css_default.previewPrompt,
							children: preview.prompt || t("chat.turnNavigation.turn", { turn: preview.turn })
						}), preview.response !== "" && (0, react_jsx_runtime.jsx)("div", {
							className: TurnNavigator_module_css_default.previewResponse,
							children: preview.response
						})]
					})]
				})
			});
		}
		/**
		* Fixed-pitch rail of every known Turn — loaded marks scroll, unloaded marks
		* page history in first — with hover and focus previews. Overflow scrolls
		* inside the frame, gradient fades marking each scrollable end, and the
		* active mark centers only outside the fade-free band while the pointer is
		* elsewhere. Previews follow pointer movement or focus, not scrolling under
		* a stationary pointer.
		*/
		const TurnNavigator = (0, react.memo)((0, react.forwardRef)(TurnNavigatorRail));
		//#endregion
		//#region ../../util/brand/lib/index.js
		/**
		* Duplicate-install-safe nominal primitive helpers.
		*
		* A brand makes structurally identical strings or numbers non-interchangeable
		* at the type level: a `SessionId` cannot be passed where a `ToolCallId` is
		* expected, and an event sequence cannot be passed as a log offset. Comparison,
		* logging, and serialization retain the underlying primitive behavior.
		*
		* This package owns no concrete domain value and keeps no runtime identity or mutable
		* state, so independently installed copies produce interchangeable values.
		*
		* @module @deepseek-ai/dsh-brand
		*/
		/**
		* Apply a compile-time string brand without changing the value.
		* @param value - string admitted by the domain that owns the target brand.
		* @returns the same string with the requested compile-time brand.
		*/
		function brandString(value) {
			return value;
		}
		/**
		* Apply a compile-time number brand without changing the value.
		* @param value - number admitted by the domain that owns the target brand.
		* @returns the same number with the requested compile-time brand.
		*/
		function brandNumber(value) {
			return value;
		}
		//#endregion
		//#region ../../core/session/lib/types/types.js
		/**
		* Admit a numeric value as an existing Session event position.
		* @param value - non-negative safe integer admitted by the owning log operation.
		* @returns the same number with the Session-sequence brand.
		*/
		function SessionSeq(value) {
			if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new TypeError(`SessionSeq must be a non-negative safe integer, got ${String(value)}`);
			return brandNumber(value);
		}
		//#endregion
		//#region lib/types/client/chat/turn-rail-items.js
		/**
		* View-layer union of the host turn outline and the loaded rail items. The
		* conversation snapshot never carries projection values, so this merge is the
		* one place the rail's two sources meet: the `turnOutline` projection names
		* every turn of the session, and the loaded window supplies anchors and
		* richer previews for the turns it holds.
		*/
		const EMPTY_ITEMS$1 = [];
		/**
		* Structurally narrow one wire outline entry (projection values cross the
		* wire). `turn` and `seq` are the load-bearing fields — a mark cannot exist
		* or jump without them — so their damage drops the entry; the previews are
		* decorative, so a malformed one degrades to `''` and the turn stays
		* navigable by number.
		*/
		function outlineEntry(value) {
			if (typeof value !== "object" || value === null) return void 0;
			const entry = value;
			if (typeof entry.turn !== "number" || !Number.isSafeInteger(entry.turn) || entry.turn < 0) return void 0;
			if (typeof entry.seq !== "number" || !Number.isSafeInteger(entry.seq) || entry.seq < 0 || Object.is(entry.seq, -0)) return void 0;
			return {
				turn: entry.turn,
				seq: SessionSeq(entry.seq),
				prompt: typeof entry.prompt === "string" ? entry.prompt : "",
				response: typeof entry.response === "string" ? entry.response : ""
			};
		}
		/** Wire outline entries, or none when the projection is absent or malformed. */
		function outlineEntries(outline) {
			return Array.isArray(outline) ? outline : EMPTY_ITEMS$1;
		}
		/**
		* Merge the host outline with the loaded rail items into the full ladder.
		* A turn present in both sides keeps the loaded anchor, taking an outline
		* preview only where the window's own is empty (a mid-Turn window head, or a
		* turn whose loaded nodes carry no text); turns on one side only pass
		* through. Result ascends by turn.
		* @param loaded - loaded-window rail items (timeline order).
		* @param outline - `turnOutline` projection value, treated as wire data.
		* @returns every known turn, ascending; a stable empty array when none.
		*/
		function mergeTurnRailItems(loaded, outline) {
			const byTurn = /* @__PURE__ */ new Map();
			for (const raw of outlineEntries(outline)) {
				const entry = outlineEntry(raw);
				if (entry === void 0) continue;
				byTurn.set(entry.turn, {
					turn: entry.turn,
					prompt: entry.prompt,
					response: entry.response,
					anchor: {
						kind: "unloaded",
						seq: entry.seq
					}
				});
			}
			for (const item of loaded) {
				const preview = byTurn.get(item.turn);
				byTurn.set(item.turn, {
					turn: item.turn,
					prompt: item.prompt !== "" ? item.prompt : preview?.prompt ?? "",
					response: item.response !== "" ? item.response : preview?.response ?? "",
					anchor: {
						kind: "loaded",
						key: item.anchorKey
					}
				});
			}
			if (byTurn.size === 0) return EMPTY_ITEMS$1;
			return [...byTurn.values()].sort((left, right) => left.turn - right.turn);
		}
		//#endregion
		//#region lib/types/client/chat/use-chat-navigation.js
		/** Turn jumps and history-prepend anchoring, independent of DOM measurement. */
		/** Owns one replaceable turn jump and the anchor retained while history loads. */
		var ChatNavigation = class {
			viewport;
			reading;
			input;
			onBusyTurn;
			jump = null;
			settleFrame = null;
			constructor(viewport, reading, input, onBusyTurn) {
				this.viewport = viewport;
				this.reading = reading;
				this.input = input;
				this.onBusyTurn = onBusyTurn;
			}
			/**
			* Adopt committed history availability without starting a request.
			* @param input - history state from the latest committed render.
			*/
			setInput(input) {
				this.input = input;
			}
			/** Cancel navigation when opening a Chat view. */
			reset() {
				this.cancel();
			}
			/** Cancel local callbacks; late history completions cannot revive a task. */
			dispose() {
				this.clearTask();
			}
			/** Release the jump, paging anchor, and busy indicator without cancelling shared history I/O. */
			cancel() {
				this.clearTask();
				this.onBusyTurn(null);
			}
			clearTask() {
				this.cancelFrame();
				this.jump = null;
				this.viewport.stopPreserving();
			}
			/**
			* Replace the current jump with an explicit turn selection.
			* @param item - loaded anchor or unloaded turn to fetch before landing.
			*/
			navigateToTurn = (item) => {
				if (item.anchor.kind === "loaded") {
					this.cancel();
					const landing = this.viewport.scrollToTurn(item.turn);
					if (landing === null) return;
					this.reading.acceptNavigation(landing);
					if (this.input.loadingOlder) this.viewport.beginPreserving(landing.position);
					return;
				}
				this.cancel();
				this.viewport.beginPreserving();
				this.reading.pauseFollowing();
				const jump = {
					turn: item.turn,
					seq: item.anchor.seq,
					phase: "loading",
					landing: "pending",
					repageHead: null
				};
				this.jump = jump;
				this.onBusyTurn(jump.turn);
				this.request(jump);
			};
			/** Request one older page while retaining the current semantic position. */
			loadEarlier = () => {
				this.cancel();
				this.viewport.beginPaging();
				this.reading.pauseFollowing();
				this.input.loadOlder();
			};
			/**
			* Preserve reader ownership across pending history work.
			* @param sample - settled reader movement that can update or interrupt an anchor.
			*/
			readerSampled(sample) {
				if (sample.movedByReader && this.jump?.landing === "landed") this.jump.landing = "interrupted";
				if (sample.followingTail || sample.movedByReader) this.viewport.stopPreserving();
			}
			/**
			* Preserve one paging anchor after a commit or a later size change, regardless of head identity.
			* @returns whether the retained anchor handled the layout change.
			*/
			contentCommitted() {
				if (!this.viewport.preserving || this.reading.pending) return false;
				if (this.landJump(false)) return true;
				const landing = this.viewport.preserve();
				if (landing === null) return false;
				this.reading.preservePosition(landing);
				return true;
			}
			/** Retarget a still-loading page only after inner or outer reader scrolling ends. */
			readerSettled() {
				if (this.input.loadingOlder && this.jump === null && !this.viewport.preserving && !this.reading.followingTail) this.viewport.beginPreserving();
			}
			/** Land, retry, or complete the current jump against the committed window. */
			reconcile() {
				const jump = this.jump;
				if (jump === null || this.reading.pending) return;
				if (jump.phase === "loading") {
					if (jump.landing === "pending") this.landJump(false);
					return;
				}
				if (this.input.loadingOlder) return;
				if (this.landJump(true)) return;
				if ((this.input.firstSeq === null || this.input.firstSeq > jump.seq) && this.input.hasMore && jump.repageHead !== this.input.firstSeq) {
					jump.repageHead = this.input.firstSeq;
					this.viewport.beginPreserving();
					this.request(jump);
					return;
				}
				const fallback = this.viewport.scrollToTurnAtOrAfter(jump.turn);
				this.cancel();
				if (fallback !== null) this.reading.acceptNavigation(fallback);
			}
			landJump(settle) {
				const jump = this.jump;
				if (jump === null) return false;
				if (jump.landing === "interrupted") {
					if (settle) {
						this.cancel();
						return true;
					}
					return false;
				}
				const landing = this.viewport.scrollToTurn(jump.turn);
				if (landing === null) return false;
				this.reading.acceptNavigation(landing);
				if (settle) this.cancel();
				else {
					this.viewport.beginPreserving(landing.position);
					jump.landing = "landed";
				}
				return true;
			}
			request(jump) {
				jump.phase = "loading";
				const settled = () => {
					if (this.jump !== jump) return;
					jump.phase = "settled";
					this.cancelFrame();
					if (typeof requestAnimationFrame !== "function") this.reconcile();
					else this.settleFrame = requestAnimationFrame(() => {
						this.settleFrame = null;
						if (this.jump === jump) this.reconcile();
					});
				};
				this.input.loadThrough(jump.seq).then(settled, settled);
			}
			cancelFrame() {
				if (this.settleFrame !== null && typeof cancelAnimationFrame === "function") cancelAnimationFrame(this.settleFrame);
				this.settleFrame = null;
			}
		};
		/**
		* Retain one navigation owner for the component's lifetime.
		* @param viewport - turn-aware DOM operations.
		* @param reading - reading and follow policy receiving navigation landings.
		* @param input - committed history state and load operations.
		* @returns the navigation owner and its visible busy turn.
		*/
		function useChatNavigation(viewport, reading, input) {
			const [busyTurn, setBusyTurn] = (0, react.useState)(null);
			const [navigation] = (0, react.useState)(() => new ChatNavigation(viewport, reading, input, setBusyTurn));
			(0, react.useLayoutEffect)(() => {
				navigation.setInput(input);
			}, [navigation, input]);
			(0, react.useLayoutEffect)(() => () => {
				navigation.dispose();
			}, [navigation]);
			return {
				navigation,
				busyTurn
			};
		}
		//#endregion