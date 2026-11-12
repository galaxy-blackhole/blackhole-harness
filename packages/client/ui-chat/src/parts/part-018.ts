/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 08/11/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-chat/lib/client.js — CẮT LẠI 08/11/2026
 *      theo MOT kieu duy nhat (region-based), gộp/cắt tiếp để mỗi lát ≤ 900 dòng.
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#region lib/types/chat-settings.js
		/** Chat display preferences stored in the Host user-settings document. */
		/** Settings namespace owned by the Chat target. */
		const CHAT_SETTINGS_NAMESPACE = "ui-chat";
		/** Field carrying the work-details presentation mode. */
		const TRANSCRIPT_VIEW_FIELD = "transcriptView";
		/** Field carrying the independent work-details collapse timing. */
		const COLLAPSE_TIMING_FIELD = "collapseTiming";
		/** Available points when a completed Turn returns to its historical presentation. */
		const COLLAPSE_TIMINGS = ["completion", "next-input"];
		/** Preserve completion-time folding when no timing preference is saved. */
		const DEFAULT_COLLAPSE_TIMING = "completion";
		/** Work-details presentation modes a user can choose. */
		const TRANSCRIPT_VIEW_MODES = [
			"compact",
			"standard",
			"detailed",
			"verbose"
		];
		/**
		* Saved value from the two-mode generation of this setting. Read as `detailed`;
		* never offered as a choice and never written back.
		*/
		const LEGACY_TRANSCRIPT_VIEW_MODE = "normal";
		/** Saved `expanded` values read as `detailed`, without being offered or written back. */
		const LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE = "expanded";
		/** Every value the durable field accepts: current modes plus legacy saved values. */
		const TRANSCRIPT_VIEW_SETTING_VALUES = [
			...TRANSCRIPT_VIEW_MODES,
			LEGACY_TRANSCRIPT_VIEW_MODE,
			LEGACY_EXPANDED_TRANSCRIPT_VIEW_MODE
		];
		/** Default work details for non-Desktop Web clients. */
		const DEFAULT_TRANSCRIPT_VIEW_MODE = "detailed";
		/** Performance and usage detail levels accepted by user settings. */
		const PERFORMANCE_USAGE_MODES = ["compact", "detailed"];
		/** Preserve detailed accounting for users without an explicit preference. */
		const DEFAULT_PERFORMANCE_USAGE = "detailed";
		/** Preserve the built-in browser for users without an explicit preference. */
		const DEFAULT_LINK_OPENING = "sidebar";
		/** Durable Chat schema; also the wire envelope the browser scope validates against. */
		const ChatSettingsFields = {
			[COLLAPSE_TIMING_FIELD]: Schema.union([...COLLAPSE_TIMINGS]).default(DEFAULT_COLLAPSE_TIMING),
			linkOpening: Schema.union(["sidebar", "new-tab"]).default(DEFAULT_LINK_OPENING),
			performanceUsage: Schema.union([...PERFORMANCE_USAGE_MODES]).default(DEFAULT_PERFORMANCE_USAGE),
			[TRANSCRIPT_VIEW_FIELD]: Schema.union([...TRANSCRIPT_VIEW_SETTING_VALUES]).loose()
		};
		Schema.object(ChatSettingsFields);
		//#endregion
		//#region lib/types/client/presentation-policy.js
		const POLICIES = {
			compact: {
				mode: "compact",
				foldCompletedTurns: true,
				stepGrouping: "collapsed",
				liveProcessDetail: false,
				settledReasoningPreview: false
			},
			standard: {
				mode: "standard",
				foldCompletedTurns: true,
				stepGrouping: "collapsed",
				liveProcessDetail: true,
				settledReasoningPreview: true
			},
			detailed: {
				mode: "detailed",
				foldCompletedTurns: true,
				stepGrouping: "history",
				liveProcessDetail: true,
				settledReasoningPreview: true
			},
			verbose: {
				mode: "verbose",
				foldCompletedTurns: false,
				stepGrouping: "none",
				liveProcessDetail: false,
				settledReasoningPreview: true
			}
		};
		function withTiming(collapseTiming) {
			return {
				compact: {
					...POLICIES.compact,
					collapseTiming
				},
				standard: {
					...POLICIES.standard,
					collapseTiming
				},
				detailed: {
					...POLICIES.detailed,
					collapseTiming
				},
				verbose: {
					...POLICIES.verbose,
					collapseTiming
				}
			};
		}
		const TIMING_POLICIES = {
			completion: withTiming("completion"),
			"next-input": withTiming("next-input")
		};
		/**
		* Resolve a stable policy for one detail mode and collapse timing.
		* @param mode - persisted work-details mode.
		* @param collapseTiming - persisted timing; defaults to immediate completion folding.
		* @returns the same policy object for the same pair of choices.
		*/
		function presentationPolicyFor(mode, collapseTiming = "completion") {
			return TIMING_POLICIES[collapseTiming][mode];
		}
		/**
		* Combine Host-backed detail and persisted timing without owning subscriptions.
		* @param mode - live work-details mode.
		* @param collapseTiming - live Host-backed collapse timing.
		* @returns observable policy whose subscriptions follow both preferences.
		*/
		function derivePresentationPolicy(mode, collapseTiming) {
			return {
				getSnapshot: () => presentationPolicyFor(mode.getSnapshot(), collapseTiming.getSnapshot()),
				subscribe: (listener) => {
					const unsubscribeMode = mode.subscribe(listener);
					const unsubscribeTiming = collapseTiming.subscribe(listener);
					return () => {
						unsubscribeMode();
						unsubscribeTiming();
					};
				}
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-chat/src/client/settings/PreferenceRow.module.css.mjs
		const css = "._2XZxNq_row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}._2XZxNq_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}._2XZxNq_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}._2XZxNq_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}._2XZxNq_selector{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}._2XZxNq_selector:hover{background:var(--dsw-alias-interactive-bg-hover)}._2XZxNq_chevron{flex:none}";
		const tagId = "@deepseek-ai/dsh-client-ui-chat/PreferenceRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-chat";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PreferenceRow_module_css_default = {
			"chevron": "_2XZxNq_chevron",
			"desc": "_2XZxNq_desc",
			"row": "_2XZxNq_row",
			"rowText": "_2XZxNq_rowText",
			"selector": "_2XZxNq_selector",
			"title": "_2XZxNq_title"
		};
		//#endregion
		//#region lib/types/client/settings/PreferenceRow.js
		/** Localized two-column selector shared by Chat preference rows. */
		/**
		* Render a preference label and its menu; selection restores focus before publishing the new value.
		* @param props - localized copy, selected value, choices, and mutation callback.
		* @returns the settings row.
		*/
		function PreferenceRow({ title, description, value, selectedLabel, options, onSelect }) {
			const [open, setOpen] = (0, react.useState)(false);
			const selectorRef = (0, react.useRef)(null);
			const closeMenu = () => {
				setOpen(false);
			};
			const selectMode = (id) => {
				selectorRef.current?.focus({ preventScroll: true });
				closeMenu();
				onSelect(id);
			};
			const selector = (0, react_jsx_runtime.jsxs)("button", {
				ref: selectorRef,
				type: "button",
				className: PreferenceRow_module_css_default.selector,
				"aria-haspopup": "menu",
				"aria-expanded": open,
				onClick: () => {
					setOpen((value) => !value);
				},
				children: [selectedLabel, (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: PreferenceRow_module_css_default.chevron })]
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: PreferenceRow_module_css_default.row,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: PreferenceRow_module_css_default.rowText,
					children: [(0, react_jsx_runtime.jsx)("div", {
						className: PreferenceRow_module_css_default.title,
						children: title
					}), (0, react_jsx_runtime.jsx)("div", {
						className: PreferenceRow_module_css_default.desc,
						children: description
					})]
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open,
					onClose: closeMenu,
					items: options,
					selectedId: value,
					onSelect: selectMode,
					align: "end",
					portal: true,
					anchor: selector
				})]
			});
		}
		//#endregion
		//#region lib/types/client/settings/TranscriptViewRow.js
		const LABELS = {
			compact: "settings.transcript.compact",
			standard: "settings.transcript.standard",
			detailed: "settings.transcript.detailed",
			verbose: "settings.transcript.verbose"
		};
		const COLLAPSE_LABELS = {
			completion: "settings.collapse.completion",
			"next-input": "settings.collapse.nextInput"
		};
		/**
		* Render the independent, Host-backed work-details and collapse-timing selectors.
		* @param props - composed Settings slot props.
		* @returns the preference row.
		*/
		function TranscriptViewRow({ useTranscriptView, setTranscriptView, useCollapseTiming, setCollapseTiming, t }) {
			const mode = useTranscriptView((value) => value);
			const timing = useCollapseTiming((value) => value);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(PreferenceRow, {
				title: t("settings.transcript.title"),
				description: t("settings.transcript.description"),
				value: mode,
				selectedLabel: t(LABELS[mode]),
				options: TRANSCRIPT_VIEW_MODES.map((id) => ({
					id,
					label: t(LABELS[id])
				})),
				onSelect: (value) => {
					setTranscriptView(value);
				}
			}), (0, react_jsx_runtime.jsx)(PreferenceRow, {
				title: t("settings.collapse.title"),
				description: t("settings.collapse.description"),
				value: timing,
				selectedLabel: t(COLLAPSE_LABELS[timing]),
				options: COLLAPSE_TIMINGS.map((id) => ({
					id,
					label: t(COLLAPSE_LABELS[id])
				})),
				onSelect: (value) => {
					setCollapseTiming(value);
				}
			})] });
		}
		//#endregion
		//#region lib/types/client/transcript-view.js
		/** Independent work-details preferences backed by the same Host configuration form. */
		/** Live work-details preference consumed by Chat and its Settings row. */
		var TranscriptViewPolicy = class {
			host;
			defaultMode;
			unsubscribe;
			/** Reactive current mode, including the client default before Host settings arrive. */
			mode;
			/** Reactive collapse timing, defaulting to completion until Host settings arrive. */
			collapseTiming = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(DEFAULT_COLLAPSE_TIMING);
			/**
			* @param host - durable Chat settings scope.
			* @param defaultMode - presentation used without an explicit saved mode.
			*/
			constructor(host, defaultMode = DEFAULT_TRANSCRIPT_VIEW_MODE) {
				this.host = host;
				this.defaultMode = defaultMode;
				this.mode = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(defaultMode);
				this.unsubscribe = host.subscribe(() => {
					this.adopt();
				});
				this.adopt();
			}
			/** Release the accepted-value subscription. */
			dispose() {
				this.unsubscribe();
			}
			/**
			* Publish and persist one explicit user choice.
			* @param mode - Compact, Standard, Detailed, or Verbose work details.
			*/
			setMode(mode) {
				if (this.mode.getSnapshot() === mode) return;
				this.mode.set(mode);
				this.host.set(TRANSCRIPT_VIEW_FIELD, mode);
			}
			/**
			* Publish and persist collapse timing without changing the work-details mode.
			* @param timing - immediate completion folding or deferred folding at the next input.
			*/
			setCollapseTiming(timing) {
				if (this.collapseTiming.getSnapshot() === timing) return;
				this.collapseTiming.set(timing);
				this.host.set(COLLAPSE_TIMING_FIELD, timing);
			}
			/** Adopt the latest accepted Host section without writing it back. */
			adopt() {
				const section = this.host.getSnapshot().value;
				if (section === void 0) return;
				const saved = section.transcriptView;
				const mode = saved === "normal" || saved === "expanded" ? "detailed" : saved ?? this.defaultMode;
				if (this.mode.getSnapshot() !== mode) this.mode.set(mode);
				const timing = section.collapseTiming ?? "completion";
				if (this.collapseTiming.getSnapshot() !== timing) this.collapseTiming.set(timing);
			}
		};
		//#endregion
		//#region lib/types/client/settings/LinkOpeningRow.js
		/**
		* Render the link-opening destination selector.
		* @param props - Composed Settings slot props.
		* @returns The preference row.
		*/
		function LinkOpeningRow({ useLinkOpening, useBrowserAvailable, setLinkOpening, t }) {
			const destination = useLinkOpening((value) => value);
			if (!useBrowserAvailable((value) => value)) return null;
			return (0, react_jsx_runtime.jsx)(PreferenceRow, {
				title: t("settings.links.title"),
				description: t("settings.links.description"),
				value: destination,
				selectedLabel: t(destination === "sidebar" ? "settings.links.sidebar" : "settings.links.newTab"),
				options: [{
					id: "sidebar",
					label: t("settings.links.sidebar")
				}, {
					id: "new-tab",
					label: t("settings.links.newTab")
				}],
				onSelect: (value) => {
					setLinkOpening(value);
				}
			});
		}
		//#endregion
		//#region lib/types/client/settings/PerformanceUsageRow.js
		const OPTIONS = [{
			id: "compact",
			label: "settings.performance.compact"
		}, {
			id: "detailed",
			label: "settings.performance.detailed"
		}];
		/**
		* Render the performance and usage detail selector.
		* @param props - composed Settings slot props.
		* @returns the preference row.
		*/
		function PerformanceUsageRow({ usePerformanceUsage, setPerformanceUsage, t }) {
			const mode = usePerformanceUsage((value) => value);
			const selectedLabel = mode === "detailed" ? "settings.performance.detailed" : "settings.performance.compact";
			return (0, react_jsx_runtime.jsx)(PreferenceRow, {
				title: t("settings.performance.title"),
				description: t("settings.performance.description"),
				value: mode,
				selectedLabel: t(selectedLabel),
				options: OPTIONS.map((option) => ({
					id: option.id,
					label: t(option.label)
				})),
				onSelect: (value) => {
					setPerformanceUsage(value);
				}
			});
		}
		//#endregion
		//#region lib/types/client/performance-usage.js
		/** Performance detail preference, live immediately and reconciled with accepted Host settings. */
		/** Shared live preference for the settings row and chat statistics. */
		var PerformanceUsagePolicy = class {
			host;
			unsubscribe;
			/** Current choice, reconciled with accepted Host settings when available. */
			mode = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(DEFAULT_PERFORMANCE_USAGE);
			/** @param host - Chat settings scope persisted through the Host. */
			constructor(host) {
				this.host = host;
				const adopt = () => {
					const accepted = host.getSnapshot().value?.performanceUsage;
					if (accepted !== void 0) this.mode.set(accepted);
				};
				this.unsubscribe = host.subscribe(adopt);
				adopt();
			}
			/** Release the accepted-value subscription. */
			dispose() {
				this.unsubscribe();
			}
			/**
			* Publish a choice immediately and queue its Host write.
			* @param mode - Statistics detail selected by the user.
			*/
			setMode(mode) {
				if (mode === this.mode.getSnapshot()) return;
				this.mode.set(mode);
				this.host.set("performanceUsage", mode);
			}
		};
		//#endregion
		//#region lib/types/client/chat/use-turn-data.js
		const EMPTY_SOURCE = {
			getSnapshot: () => void 0,
			subscribe: () => () => {}
		};
		/**
		* Subscribe to one value from a Turn's keyed Location-data store.
		* @param data - current Turn data store, or absence for a Node outside a Turn.
		* @param key - declaration-merged business key.
		* @returns the current value for that key.
		*/
		function useTurnDataValue(data, key) {
			const source = data?.source(key) ?? EMPTY_SOURCE;
			return (0, react.useSyncExternalStore)(source.subscribe, source.getSnapshot);
		}
		//#endregion
		//#region lib/types/client/apply.js
		/** Bind group and header visibility to the viewport of one flow render. */
		const CHAT_FLOW_INJECT = { hooks: {
			groupAction: (_standard, { motion }) => function useGroupAction(hidden, reveal) {
				return useFlowHidden(hidden, reveal, motion);
			},
			groupHeaderAction: (_standard, { motion }) => function useGroupHeaderAction(ref, hidden) {
				useMotionHidden(ref, hidden, motion);
			}
		} };
		/** Bind node-local sources and forward the flow's existing visibility hook. */
		const CHAT_NODE_INJECT = { hooks: {
			turnData: (_standard, { turnData }) => function useTurnData(key) {
				return useTurnDataValue(turnData, key);
			},
			disclosure: (_standard, { disclosureReset }) => bindDisclosure(disclosureReset),
			groupAction: (_standard, { useGroupAction }) => useGroupAction
		} };
		/**
		 * 08/11/2026 (dev-5, B1 đã được Lead duyệt): BẢNG TÊN HIỂN THỊ của route, nạp MỘT LẦN từ catalog.
		 * Bản gốc render thẳng `provider/model` thô (dsh-client-ui-chat/lib/client.js:6851) nên với route
		 * nội bộ "auto" người dùng thấy id model. Tên KHÔNG hard-code: lấy từ CONFIG qua
		 * `session/modelCatalog` (groups[].name + models[].name) — đổi displayName trong config là nhãn đổi.
		 */
		const __gbhRouteNames = /* @__PURE__ */ Object.create(null);
		/**
		 * Nạp bảng tên route từ catalog, ĐÚNG MỘT LẦN cho mỗi lượt mount; lỗi/thiếu ⇒ bảng rỗng ⇒ hiển thị
		 * fallback `provider/model` y như bản gốc (không ném, không chặn mount).
		 * @param ctx — Context client (đã inject sẵn `remote.session`).
		 */
		function napTenRoute(ctx) {
			if (__gbhRouteNames.daNap === true) return;
			__gbhRouteNames.daNap = true;
			void (async () => {
				try {
					const answer = await ctx.remote.session.modelCatalog();
					const payload = answer !== null && typeof answer === "object" && "value" in answer ? answer.value : answer;
					const groups = Array.isArray(payload?.groups) ? payload.groups : [];
					for (const group of groups) {
						if (group === null || typeof group !== "object") continue;
						const providerName = typeof group.name === "string" && group.name !== "" ? group.name : void 0;
						const models = Array.isArray(group.models) ? group.models : [];
						for (const model of models) {
							if (model === null || typeof model !== "object" || typeof group.id !== "string" || typeof model.id !== "string") continue;
							const modelName = typeof model.name === "string" && model.name !== "" ? model.name : void 0;
							if (providerName === void 0 && modelName === void 0) continue;
							__gbhRouteNames[group.id + "|" + model.id] = (providerName ?? group.id) + " / " + (modelName ?? model.id);
						}
					}
				} catch {}
			})();
		}
		/** Services required by the Chat target and its presentation registrations. */
		const inject = [
			"slots",
			"sessions",
			"uiWorkspace",
			"uiSession",
			"uiConversation",
			"locale",
			"configForms",
			"remote",
			"remote.session",
			"sidebarRight"
		];
		/**
		* Mount all Chat-owned contributions.
		* @param ctx - Client root context.
		*/
		function apply(ctx) {
			const quotaNotice = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			let quotaNoticeSeq = 0;
			const quotaNoticeHolds = /* @__PURE__ */ new Set();
			const chatSources = /* @__PURE__ */ new WeakMap();
			const quotaSubscriptions = /* @__PURE__ */ new Set();
			ctx.effect(() => {
				// 08/11/2026 (dev-5, B1): nạp bảng tên route MỘT LẦN, dùng CHUNG effect sẵn có để KHÔNG thêm
				// phần tử vào chuỗi effect/inject của bundle (tests/client/ui-chat.test.ts:315 so chuỗi với bản gốc).
				void napTenRoute(ctx);
				return async () => {
					await Promise.all([...quotaSubscriptions].map((dispose) => dispose()));
				};
			}, "ui-chat: live quota notices");
			const chatSource = (binding) => {
				let source = chatSources.get(binding);
				if (source === void 0) {
					const dispose = binding.ctx.effect(() => {
						const stop = binding.eventSource.subscribe(() => {
							const { change } = binding.eventSource.getSnapshot();
							if (change.kind !== "append") return;
							for (const { event } of change.entries) {
								if (event.type !== "turn/end" || event.data.reason.kind !== "error") continue;
								const { code } = event.data.reason.error;
								if (quotaNoticeHolds.size > 0 || code !== "QUOTA" && code !== "ACCOUNT_QUOTA") continue;
								quotaNotice.set({
									code,
									seq: ++quotaNoticeSeq
								});
							}
						});
						return () => {
							stop();
							chatSources.delete(binding);
							quotaSubscriptions.delete(dispose);
						};
					}, "ui-chat: Provider binding quota notices");
					quotaSubscriptions.add(dispose);
					const target = ctx.uiConversation.binding(binding).target("chat");
					source = {
						getSnapshot: () => target.getSnapshot() ?? EMPTY_CHAT_SNAPSHOT,
						subscribe: (listener) => target.subscribe(listener)
					};
					chatSources.set(binding, source);
				}
				return source;
			};
			registerConversationNodes(ctx);
			ctx.uiSession.provide({
				hooks: ["chat"],
				resolve: (binding) => ({ hooks: { chat: chatSource(binding) } })
			});
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-chat: dictionaries");
			const t = ctx.locale.bind(NS);
			const chatStore = createChatStore();
			const chatScrollPositions = /* @__PURE__ */ new Map();
			const chatSettings = ctx.configForms.get(CHAT_SETTINGS_NAMESPACE);
			const linkOpening = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(chatSettings.getSnapshot().value?.linkOpening ?? "sidebar");
			ctx.effect(() => chatSettings.subscribe(() => {
				const accepted = chatSettings.getSnapshot().value?.linkOpening;
				if (accepted !== void 0) linkOpening.set(accepted);
			}));
			ctx.inject(["sidebarRightTabs"], (scope) => {
				const tabs = scope.sidebarRightTabs;
				const browserAvailable = {
					getSnapshot: () => tabs.get("browser") !== void 0,
					subscribe: (listener) => tabs.subscribe(listener)
				};
				scope.slots.inject("settings.general.item", () => scope.slots.register({
					name: "settings.general.item",
					id: "link-opening",
					order: 17,
					locale: NS,
					inject: () => ({
						hooks: {
							linkOpening,
							browserAvailable
						},
						setLinkOpening: (destination) => {
							linkOpening.set(destination);
							chatSettings.set("linkOpening", destination).catch((_error) => {});
						}
					})
				}, LinkOpeningRow));
			});
			const transcriptView = new TranscriptViewPolicy(chatSettings, "dshDesktop" in globalThis ? "standard" : DEFAULT_TRANSCRIPT_VIEW_MODE);
			const presentation = derivePresentationPolicy(transcriptView.mode, transcriptView.collapseTiming);
			const performancePolicy = new PerformanceUsagePolicy(chatSettings);
			ctx.effect(() => () => {
				transcriptView.dispose();
				performancePolicy.dispose();
			});
			const performanceUsage = performancePolicy.mode;
			registerChatNodeRenderers(ctx, performanceUsage, presentation);
			ctx.slots.registerFactory({
				name: "conversation.chat.user.content",
				scope: "session",
				locale: NS,
				children: { "conversation.chat.user.images": {
					kind: "single",
					scope: "session"
				} }
			}, UserContent);
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "performance-usage",
				order: 30,
				locale: NS,
				inject: () => ({
					hooks: { performanceUsage },
					setPerformanceUsage: (mode) => {
						performancePolicy.setMode(mode);
					}
				})
			}, PerformanceUsageRow));
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "transcript-view",
				order: 12,
				locale: NS,
				inject: () => ({
					hooks: {
						transcriptView: transcriptView.mode,
						collapseTiming: transcriptView.collapseTiming
					},
					setTranscriptView: (mode) => {
						transcriptView.setMode(mode);
					},
					setCollapseTiming: (timing) => {
						transcriptView.setCollapseTiming(timing);
					}
				})
			}, TranscriptViewRow));
			const nodeSources = (binding) => {
				const chat = chatSource(binding);
				const conversation = ctx.uiConversation.binding(binding);
				return {
					hooks: { presentation },
					keyedHooks: {
						chatNode: (key) => chat.getSnapshot().nodes.source(key),
						chatNodeBottom: (key) => chat.getSnapshot().nodes.bottomSource(key),
						chatNodeProcess: (key) => chat.getSnapshot().nodes.processSource(key),
						chatGroup: (key) => conversation.snapshot.getSnapshot().views.grouped("chat")?.groupSource(key)
					}
				};
			};
			ctx.slots.inject("conversation.chat.flow", () => ctx.slots.register({
				name: "conversation.chat.flow",
				locale: NS,
				store: chatStore,
				children: { "conversation.chat.node": {
					kind: "keyed",
					scope: "session",
					inject: CHAT_NODE_INJECT
				} },
				inject: (sessionId) => {
					const binding = ctx.sessions.binding(sessionId);
					if (binding === void 0) throw new Error(`ui-chat: unknown session "${sessionId}"`);
					return nodeSources(binding);
				}
			}, ChatFlow));
			ctx.slots.inject("conversation.view", () => {
				return ctx.slots.register({
					name: "conversation.view",
					id: "chat",
					order: 0,
					label: () => t("view.chat"),
					locale: NS,
					children: { "conversation.chat.flow": {
						kind: "single",
						scope: "session",
						inject: CHAT_FLOW_INJECT
					} },
					store: chatStore,
					inject: (sessionId) => {
						const binding = ctx.sessions.binding(sessionId);
						if (binding === void 0) throw new Error(`ui-chat: unknown session "${sessionId}"`);
						const session = binding.session;
						const chat = chatSource(binding);
						return {
							...nodeSources(binding),
							fileMentions: (owner) => ctx.get("chatFileMentions")?.forClosing(owner, sessionId),
							openFile: async (path, options) => {
								const cwd = ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd;
								const url = fileAddressFor(sessionId, cwd, path);
								if (options?.line === void 0) ctx.sidebarRight.openResource(url);
								else ctx.sidebarRight.openResource(url, { params: { line: options.line } });
								await Promise.resolve();
							},
							openExternalLink: (url) => {
								if (linkOpening.getSnapshot() === "sidebar" && ctx.get("sidebarRightTabs")?.get("browser") !== void 0) ctx.sidebarRight.openTab("browser", { params: { url } });
								else window.open(url, "_blank", "noopener,noreferrer");
							},
							loadOlder: () => {
								session.loadOlder();
							},
							loadThrough: (seq) => session.loadThrough(seq),
							loadImage: Object.assign((attachment) => ctx.uiConversation.imageUrl(sessionId, attachment), { peek: (attachment) => ctx.uiConversation.peekImageUrl(sessionId, attachment) }),
							chatScroll: {
								save: (position) => {
									if (position === null) chatScrollPositions.delete(sessionId);
									else chatScrollPositions.set(sessionId, position);
								},
								read: () => chatScrollPositions.get(sessionId) ?? null
							},
							forkAt: (seq) => {
								const messageId = [...chat.getSnapshot().timeline.turns.values()].find((turn) => turn.end?.seq === seq)?.data.get("turn-tail")?.closing?.finalNode.messageId;
								ctx.sessions.fork({
									sessionId,
									atSeq: seq,
									increaseTitle: true,
									onCreated: (childId) => {
										ctx.get("productAnalytics")?.track("branch_session_click", {
											session_id: childId,
											parent_session_id: sessionId,
											...messageId === void 0 ? {} : { parent_message_id: messageId },
											click_position: "footer"
										});
									}
								}).then((childId) => {
									ctx.uiWorkspace.openSession(childId);
								}).catch(() => {});
							}
						};
					}
				}, ChatView);
			});
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "chat.quota-notice",
				locale: NS,
				children: { "shell.quota-notice": {
					kind: "chain",
					scope: "root"
				} },
				inject: () => ({
					hooks: { notice: quotaNotice },
					dismissNotice: () => {
						quotaNoticeHolds.clear();
						quotaNotice.set(null);
					},
					keepNoticeOpen: () => {
						if (quotaNotice.getSnapshot() === null) return () => {};
						const token = Symbol("ui-chat quota notice hold");
						quotaNoticeHolds.add(token);
						return () => {
							quotaNoticeHolds.delete(token);
						};
					}
				})
			}, QuotaNoticeHost));
			const statPillInject = () => ({ hooks: { performanceUsage } });
			ctx.slots.inject("conversation.composer.dock", function* () {
				yield ctx.slots.register({
					name: "conversation.composer.dock",
					id: "activity",
					order: 0,
					locale: NS,
					inject: statPillInject
				}, ActivityPill);
				yield ctx.slots.register({
					name: "conversation.composer.dock",
					id: "usage",
					order: 1,
					locale: NS,
					inject: statPillInject
				}, UsagePill);
			});
			ctx.slots.inject("conversation.approval.detail", () => ctx.slots.register({ name: "conversation.approval.detail" }, ApprovalCommand));
		}
		//#endregion