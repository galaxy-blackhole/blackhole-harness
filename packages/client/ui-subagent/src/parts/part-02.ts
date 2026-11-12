/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				if (hoverCloseTimer.current === void 0) return;
				clearTimeout(hoverCloseTimer.current);
				hoverCloseTimer.current = void 0;
			};
			const cancelHoverOpen = () => {
				if (hoverOpenTimer.current === void 0) return;
				clearTimeout(hoverOpenTimer.current);
				hoverOpenTimer.current = void 0;
			};
			const changeOpen = (next, restoreFocus = false) => {
				cancelHoverOpen();
				cancelHoverClose();
				if (next) {
					const trigger = triggerRef.current;
					/* v8 ignore next -- a queued callback can outlive the trigger */
					if (trigger === null) return;
					setOpen(true);
					setMenuPosition(catalogMenuPosition(trigger));
				} else {
					pinnedRef.current = false;
					setOpen(false);
					setMenuPosition(void 0);
					setExpanded(/* @__PURE__ */ new Set());
				}
				if (restoreFocus) queueMicrotask(() => {
					triggerRef.current?.focus();
				});
			};
			const scheduleHoverOpen = () => {
				cancelHoverOpen();
				cancelHoverClose();
				if (open) return;
				hoverOpenTimer.current = setTimeout(() => {
					hoverOpenTimer.current = void 0;
					changeOpen(true);
				}, 150);
			};
			const scheduleHoverClose = () => {
				cancelHoverOpen();
				cancelHoverClose();
				if (pinnedRef.current) return;
				hoverCloseTimer.current = setTimeout(() => {
					hoverCloseTimer.current = void 0;
					changeOpen(false);
				}, 120);
			};
			const closeBranch = (root) => {
				const closing = /* @__PURE__ */ new Set();
				const visit = (parentSessionId) => {
					if (closing.has(parentSessionId) || !expanded.has(parentSessionId)) return;
					closing.add(parentSessionId);
					const branch = catalogs[parentSessionId];
					for (const entry of branch?.entries ?? []) visit(entry.id);
				};
				visit(root);
				setExpanded((current) => new Set([...current].filter((id) => !closing.has(id))));
			};
			const toggleBranch = (childSessionId) => {
				if (expanded.has(childSessionId)) {
					closeBranch(childSessionId);
					return;
				}
				setExpanded((current) => new Set(current).add(childSessionId));
				refreshProjection(childSessionId);
			};
			(0, react.useEffect)(() => {
				if (!open) return;
				const closeOutside = (event) => {
					if (event.target instanceof Node && !rootRef.current?.contains(event.target) && !menuRef.current?.contains(event.target)) changeOpen(false);
				};
				document.addEventListener("pointerdown", closeOutside);
				return () => {
					document.removeEventListener("pointerdown", closeOutside);
				};
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open) return;
				const placeMenu = () => {
					const trigger = triggerRef.current;
					/* v8 ignore next -- native resize or scroll can outlive the trigger */
					if (trigger === null) return;
					setMenuPosition(catalogMenuPosition(trigger));
				};
				window.addEventListener("resize", placeMenu);
				document.addEventListener("scroll", placeMenu, true);
				return () => {
					window.removeEventListener("resize", placeMenu);
					document.removeEventListener("scroll", placeMenu, true);
				};
			}, [open]);
			(0, react.useEffect)(() => () => {
				cancelHoverOpen();
				cancelHoverClose();
			}, []);
			const visible = presentedCatalog !== void 0 && (variant === "switcher" || presentedCatalog.state === "error" || presentedCatalog.entries.length > 0);
			(0, react.useEffect)(() => {
				if (visible) return;
				cancelHoverOpen();
				cancelHoverClose();
				if (!open) return;
				pinnedRef.current = false;
				setOpen(false);
				setExpanded(/* @__PURE__ */ new Set());
			}, [visible, open]);
			if (!visible) return null;
			const focusAt = (index) => {
				const items = treeItems(menuRef.current);
				if (items.length === 0) return;
				items[(index + items.length) % items.length]?.focus();
			};
			const navigate = (event) => {
				const items = treeItems(menuRef.current);
				const index = items.indexOf(document.activeElement);
				if (event.key === "Escape") {
					event.preventDefault();
					changeOpen(false, true);
				} else if (event.key === "Home") {
					event.preventDefault();
					focusAt(0);
				} else if (event.key === "End") {
					event.preventDefault();
					focusAt(items.length - 1);
				} else if (event.key === "ArrowDown") {
					event.preventDefault();
					focusAt(index + 1);
				} else if (event.key === "ArrowUp") {
					event.preventDefault();
					focusAt(index < 0 ? items.length - 1 : index - 1);
				}
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: `${SubagentHeaderLineage_module_css_default.root} ${variant === "switcher" ? SubagentHeaderLineage_module_css_default.switcherRoot : ""}`,
				ref: rootRef,
				onKeyDown: navigate,
				onMouseLeave: scheduleHoverClose,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					ref: triggerRef,
					onMouseEnter: scheduleHoverOpen,
					type: "button",
					className: variant === "switcher" ? `${SubagentHeaderLineage_module_css_default.switcherTrigger} ${ancestorSwitcher ? SubagentHeaderLineage_module_css_default.ancestorSwitcherTrigger : ""}` : SubagentHeaderLineage_module_css_default.trigger,
					"aria-haspopup": "tree",
					"aria-expanded": open,
					"aria-label": variant === "switcher" ? t("switcher.aria", { title: switcherDisplayTitle }) : t(runningCount > 0 ? runningCountKey : totalCountKey, { count: runningCount > 0 ? runningCount : directCount }),
					onClick: openTitle === void 0 ? () => {
						cancelHoverOpen();
						cancelHoverClose();
						pinnedRef.current = true;
						if (!open) changeOpen(true);
					} : () => {
						cancelHoverOpen();
						if (open) changeOpen(false);
						openTitle();
					},
					onKeyDown: (event) => {
						if (event.key !== "ArrowDown") return;
						event.preventDefault();
						if (!open) changeOpen(true);
						queueMicrotask(() => {
							focusAt(0);
						});
					},
					children: [variant === "switcher" ? (0, react_jsx_runtime.jsx)("span", {
						className: SubagentHeaderLineage_module_css_default.switcherTitle,
						children: switcherDisplayTitle
					}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [runningCount > 0 && (0, react_jsx_runtime.jsx)("span", {
						className: SubagentHeaderLineage_module_css_default.activitySlot,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" })
					}), (0, react_jsx_runtime.jsx)("span", {
						className: SubagentHeaderLineage_module_css_default.count,
						children: t(totalCountKey, { count: directCount })
					})] }), variant === "switcher" ? (0, react_jsx_runtime.jsx)(SubagentSwitcherIcon, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: open ? SubagentHeaderLineage_module_css_default.triggerOpen : void 0 })]
				}), open && (0, react_dom.createPortal)((0, react_jsx_runtime.jsx)("div", {
					ref: menuRef,
					className: SubagentHeaderLineage_module_css_default.menu,
					style: menuPosition,
					onMouseEnter: cancelHoverClose,
					onMouseLeave: scheduleHoverClose,
					children: (0, react_jsx_runtime.jsx)("div", {
						className: SubagentHeaderLineage_module_css_default.menuBody,
						role: "tree",
						"aria-label": t("tree.aria"),
						children: (0, react_jsx_runtime.jsx)(CatalogRows, {
							parentSessionId: rootSessionId,
							currentSessionId,
							catalog: presentedCatalog,
							catalogs,
							summaries,
							expanded,
							level: 1,
							openChild,
							openChildAside,
							refreshProjection,
							toggleBranch,
							closeCatalog: () => {
								changeOpen(false);
							},
							t
						})
					})
				}), document.body)]
			});
		}
		/**
		* Session-header catalog action for root sessions: the descendant count and
		* its dropdown after the preset label in the header actions band. Child sessions render nothing
		* here — their breadcrumb switcher in the lineage slot owns the same
		* navigation.
		* @param props - Session standard props plus the catalog actions and translator.
		* @returns The count dropdown, or null on a child session.
		*/
		function SubagentCatalogAction({ sessionId, useSessions, useSessionStatus, openChild, openChildAside, refreshProjection, t }) {
			if (useSessions((state) => state.byId[sessionId]?.origin === "subagent")) return null;
			return (0, react_jsx_runtime.jsx)(CatalogDropdown, {
				rootSessionId: sessionId,
				variant: "count",
				useSessions,
				useSessionStatus,
				openChild,
				openChildAside,
				refreshProjection,
				t
			}, sessionId);
		}
		/**
		* Render one breadcrumb title together with its subagent navigation.
		* @param props - Breadcrumb title, session standard props, and catalog actions.
		* @returns A title-and-chevron sibling switcher, or nothing on a root session.
		*/
		function SubagentHeaderLineage({ lineageSessionId, displayTitle, openTitle, useSessions, useSession, useSessionStatus, openChild, openChildAside, refreshProjection, t }) {
			const address = useSession((session) => session.subagent?.address);
			const parentId = useSessions((state) => {
				if (address?.childSessionId === lineageSessionId) return address.parentSessionId;
				for (const [parentId, snapshot] of Object.entries(state.projectionsBySession)) if (snapshot.values.subagentCatalog?.some((entry) => entry.id === lineageSessionId)) return parentId;
				const summary = state.byId[lineageSessionId];
				return summary?.origin === "subagent" ? summary.parentId : void 0;
			});
			const shared = {
				useSessions,
				useSessionStatus,
				openChild,
				openChildAside,
				refreshProjection,
				t
			};
			if (parentId === void 0) return null;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(CatalogDropdown, {
				rootSessionId: parentId,
				currentSessionId: lineageSessionId,
				variant: "switcher",
				displayTitle,
				...openTitle === void 0 ? {} : { openTitle },
				...shared
			}, `switcher:${lineageSessionId}`), openTitle === void 0 && (0, react_jsx_runtime.jsx)(CatalogDropdown, {
				rootSessionId: lineageSessionId,
				variant: "count",
				...shared
			}, `children:${lineageSessionId}`)] });
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-subagent/src/client/SubagentReadOnlyComposer.module.css.mjs
		const css$1 = ".XJ7liG_frame{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);min-height:54px;color:var(--dsw-alias-label-tertiary);justify-content:center;align-items:center;gap:8px;margin:0 24px 20px;padding:10px 16px;font-size:13px;line-height:20px;display:flex}.XJ7liG_frame strong{color:var(--dsw-alias-label-primary);font-weight:510}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-subagent/SubagentReadOnlyComposer.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-subagent";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var SubagentReadOnlyComposer_module_css_default = { "frame": "XJ7liG_frame" };
		//#endregion
		//#region lib/types/client/SubagentReadOnlyComposer.js
		/**
		* Explain why the normal composer is unavailable for an addressed child.
		* @param props - selector-owned read-only reason plus standard slot props.
		* @returns A read-only composer replacement.
		*/
		function SubagentReadOnlyComposer({ matched, t }) {
			const oneShot = matched.reason === "one-shot";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: SubagentReadOnlyComposer_module_css_default.frame,
				role: "status",
				children: [(0, react_jsx_runtime.jsx)("strong", { children: t(oneShot ? "readonly.oneShot.title" : "readonly.title") }), (0, react_jsx_runtime.jsx)("span", { children: t(matched.reason === "unknown" ? "readonly.unknown.body" : oneShot ? "readonly.oneShot.body" : "readonly.body") })]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-subagent/src/client/sidebar-chat/SidebarChat.module.css.mjs
		const css = ".olTFqa_root{width:100%;min-width:0;height:100%;min-height:0;display:flex}";
		const tagId = "@deepseek-ai/dsh-client-ui-subagent/SidebarChat.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-subagent";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SidebarChat_module_css_default = { "root": "olTFqa_root" };
		//#endregion
		//#region lib/types/client/sidebar-chat/index.js
		/** Stable implementation identity for the Sidebar tab body. */
		const SUBAGENT_CHAT_ID = "@deepseek-ai/dsh-client-ui-subagent";
		/** Resource-address prefix for an embedded Session chat. */
		const SUBAGENT_CHAT_ADDRESS = "dsh-resource://subagentchat/session/";
		/**
		* Address one subagent Session together with the routing facts needed to restore it.
		* @param address - durable direct-parent subagent address.
		* @returns canonical Sidebar resource address.
		*/
		function subagentChatAddress(address) {
			const query = new URLSearchParams({
				parent: address.parentSessionId,
				mode: address.mode
			});
			return `${SUBAGENT_CHAT_ADDRESS}${encodeURIComponent(address.childSessionId)}?${query}`;
		}
		/**
		* Parse one canonical Sidebar chat resource address.
		* @param value - possible chat resource address.
		* @returns the encoded direct-parent address, or undefined for another or malformed resource.
		*/
		function parseSubagentChatAddress(value) {
			let url;
			try {
				url = new URL(value);
			} catch (_invalidUrl) {
				return;
			}
			if (url.protocol !== "dsh-resource:" || url.hostname.toLowerCase() !== "subagentchat") return void 0;
			const parts = url.pathname.split("/").filter(Boolean);
			if (parts.length !== 2 || parts[0] !== "session") return void 0;
			const parentSessionId = url.searchParams.get("parent");
			const mode = url.searchParams.get("mode");
			if (parentSessionId === null || parentSessionId === "" || mode !== "one-shot" && mode !== "continuable" && mode !== "unknown") return;
			try {
				return {
					parentSessionId,
					childSessionId: decodeURIComponent(parts[1]),
					mode
				};
			} catch (_invalidEncoding) {
				return;
			}
		}
		function waitForAbort(signal) {
			if (signal.aborted) return Promise.resolve();
			return new Promise((resolve) => {
				signal.addEventListener("abort", () => {
					resolve();
				}, { once: true });
			});
		}
		function isAbortRequested(signal) {
			return signal.aborted;
		}
		function subagentChatResourceProvider(sessions) {
			return {
				protocol: "subagentchat",
				async *open(resourceAddress, { signal }) {
					const address = parseSubagentChatAddress(resourceAddress);
					if (address === void 0) throw new Error(`ui-subagent: invalid chat resource address "${resourceAddress}"`);
					if (isAbortRequested(signal)) return;
					const reference = sessions.retain(address, {
						source: "sidebarChat",
						signal
					});
					try {
						yield {
							ok: true,
							value: {
								address,
								reference
							}
						};
						await waitForAbort(signal);
					} finally {
						reference.release();
					}
				}
			};
		}
		/** Fixed Chat selection used by an embedded Conversation occurrence. */
		function FixedChatConversationView(props) {
			return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: props.renderSlot("conversation.session", { view: "chat" }) });
		}
		/** Render the shared Conversation content for one explicitly provided child Session. */
		function ConversationSlotPanel({ sessionId, useSession, useConversation, useSessions, renderFactorySlot }) {
			const session = useSession((value) => value);
			const shellPhase = useConversation((value) => value).activeTargets.size > 0 || !session.blank && !session.awaitingFirstTurn || session.running ? "active" : session.promptAttempted ? "engaging" : "blank";
			const summaryBlank = useSessions((state) => state.byId[sessionId]?.blank);
			const parentAvailabilityPending = session.subagent?.address.mode === "continuable" && session.subagent.parentAvailable === void 0;
			const settling = shellPhase === "blank" && session.openState === "loading" && summaryBlank !== true || parentAvailabilityPending;
			const hero = shellPhase === "blank" && (session.openState === "open" || summaryBlank === true);
			return renderFactorySlot("conversation.content", {
				variant: "embedded",
				phase: settling ? "settling" : hero ? "hero" : "active",
				hero
			}, { slots: { views: FixedChatConversationView } });
		}
		/** Bind a chat resource's child reference around its Conversation slot. */
		function SidebarChatTab({ useResource, useTabInfo, SessionProvider, renderSlot }) {
export {};
