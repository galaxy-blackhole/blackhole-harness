/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			throw new Error(`unreachable todo status: ${String(value)}`);
		}
		/** Map Todo lifecycle state onto the shared compact status language. */
		function statusDotState(status) {
			switch (status) {
				case "completed": return "done";
				case "in_progress": return "ongoing";
				case "pending": return "idle";
				/* v8 ignore next -- closed TodoItem status union */
				default: return assertNever(status);
			}
		}
		/** Return the localized status announced beside one decorative marker. */
		function statusLabel(status, t) {
			switch (status) {
				case "completed": return t("todo.status.completed");
				case "in_progress": return t("todo.status.inProgress");
				case "pending": return t("todo.status.pending");
				/* v8 ignore next -- closed TodoItem status union */
				default: return assertNever(status);
			}
		}
		/** Header summary: "·"-joined per-status counts; zero-count segments are omitted as noise (a non-empty list keeps at least one). */
		function progressLabel(todos, t) {
			const done = todos.filter((item) => item.status === "completed").length;
			const active = todos.filter((item) => item.status === "in_progress").length;
			const pending = todos.length - done - active;
			return [
				...done > 0 ? [t("todo.progress.done", { done })] : [],
				...active > 0 ? [t("todo.progress.active", { active })] : [],
				...pending > 0 ? [t("todo.progress.pending", { pending })] : []
			].join(" · ");
		}
		function TodoPanel({ todos, t }) {
			const [collapsed, setCollapsed] = (0, react.useState)(true);
			if (todos.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("section", {
				className: TodoPanel_module_css_default.root,
				"data-testid": "todo-panel",
				"aria-label": t("todo.title"),
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: TodoPanel_module_css_default.body,
					children: [(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: TodoPanel_module_css_default.header,
						"aria-expanded": !collapsed,
						onClick: () => {
							setCollapsed((v) => !v);
						},
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.lead,
								"aria-hidden": true,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutlineRegular, {})
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.title,
								children: t("todo.title")
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.progress,
								children: progressLabel(todos, t)
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.chevron,
								"aria-hidden": true,
								children: collapsed ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronUpOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})
							})
						]
					}), !collapsed && (0, react_jsx_runtime.jsx)("ul", {
						className: TodoPanel_module_css_default.list,
						children: todos.map((item) => (0, react_jsx_runtime.jsxs)("li", {
							className: TodoPanel_module_css_default.item,
							"data-status": item.status,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.glyph,
								role: "img",
								"aria-label": statusLabel(item.status, t),
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: statusDotState(item.status) })
							}), (0, react_jsx_runtime.jsx)("span", {
								className: TodoPanel_module_css_default.content,
								children: item.content
							})]
						}, item.content))
					})]
				})
			});
		}
		/** Renders the current todo projection, or nothing when it is absent. */
		function TodoDock({ useProjection, t }) {
			return (0, react_jsx_runtime.jsx)(TodoPanel, {
				todos: useProjection("todos") ?? [],
				t
			});
		}
		/** Registers the projected todo dock. */
		const todoDockEntry = {
			name: "conversation-todo-dock",
			inject: ["slots"],
			apply(ctx) {
				ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
					name: "conversation.input.dock",
					id: "todo",
					order: 0,
					locale: NS
				}, TodoDock));
			}
		};
		//#endregion
		//#region lib/types/client/stop-sequence.js
		/** One short-lived first press, cleared before an accepted cancellation runs. */
		var StopSequence = class {
			intervalMs;
			release;
			first;
			timer;
			/**
			* @param intervalMs - validated maximum time between independent presses.
			* @param release - releases observations retained by the pending first press.
			*/
			constructor(intervalMs, release) {
				this.intervalMs = intervalMs;
				this.release = release;
			}
			/** Clear the first press and its expiry timer. */
			reset() {
				this.first = void 0;
				clearTimeout(this.timer);
				this.timer = void 0;
				this.release();
			}
			/**
			* Accept one eligible, non-repeated Escape against freshly resolved current state.
			* @param target - live turn and actual focused input region.
			* @returns whether this press requested cancellation.
			*/
			press(target) {
				const first = this.first;
				this.reset();
				if (first !== void 0 && performance.now() <= first.deadline && first.target.sessionId === target.sessionId && first.target.turn === target.turn && first.target.generation === target.generation && first.target.region === target.region) {
					target.cancel();
					return true;
				}
				this.first = {
					target,
					deadline: performance.now() + this.intervalMs
				};
				this.timer = setTimeout(() => {
					this.reset();
				}, this.intervalMs + 1);
				return false;
			}
		};
		//#endregion
		//#region lib/types/client/stop-shortcut.js
		/**
		* Subscribe fixed input to the same Session cancellation used by the stop button.
		* @param shortcuts - window keyboard arbitration and validated sequence interval.
		* @param sessions - live Session identities and lifecycle sources.
		* @param openTurn - stable current-turn source for a live Session binding.
		* @param uiSession - current pending-interaction status.
		* @param cancel - scoped stop operation that preserves Queue and reports failures.
		* @returns disposer releasing the input subscription, pending watches and expiry timer.
		*/
		function installStopShortcut(shortcuts, sessions, openTurn, uiSession, cancel) {
			let unwatch = () => {};
			const sequence = new StopSequence(shortcuts.stopSequenceMs, () => {
				unwatch();
				unwatch = () => {};
			});
			const reset = () => {
				sequence.reset();
			};
			const off = shortcuts.observeFixedInput((input) => {
				if (input.type === "reset") {
					reset();
					return;
				}
				const { gesture, context } = input;
				if (gesture.code !== "Escape" || gesture.repeat || gesture.composing || gesture.defaultPrevented || gesture.control || gesture.alt || gesture.shift || gesture.meta || context.modal !== null || context.region === "terminal" || context.target === null) {
					reset();
					return;
				}
				const target = context.target;
				const occurrence = target.closest("[data-conversation-session]");
				const region = target.closest("[data-conversation-region]");
				if (occurrence === null || region === null || !occurrence.contains(region) || target.closest("[data-approval-key], iframe, .xterm, [inert]") !== null) {
					reset();
					return;
				}
				const sessionId = occurrence.dataset.conversationSession;
				const binding = sessions.binding(sessionId);
				if (binding === void 0) {
					reset();
					return;
				}
				const turnSource = openTurn(binding);
				const currentTurn = () => {
					const session = binding.session.getSnapshot();
					if (!session.running || session.removed || session.subagent !== null && session.subagent.address.mode !== "continuable" || uiSession.sessionStatus.getSnapshot().get(sessionId)?.pendingInteraction !== void 0) return void 0;
					return turnSource.getSnapshot();
				};
				const turn = currentTurn();
				if (turn === void 0) {
					reset();
					return;
				}
				input.consume();
				if (sequence.press({
					sessionId,
					turn,
					generation: binding,
					region,
					cancel: () => {
						cancel(sessionId);
					}
				})) return;
				const changed = () => {
					if (sessions.binding(sessionId) !== binding || currentTurn() !== turn) reset();
				};
				const disposers = [
					turnSource.subscribe(changed),
					binding.session.subscribe(changed),
					uiSession.sessionStatus.subscribe(changed)
				];
				unwatch = () => {
					for (const dispose of disposers) dispose();
				};
			});
			return () => {
				off();
				reset();
			};
		}
		//#endregion
		//#region lib/types/client/apply.js
		/** Services required by the Conversation plugin. */
		const inject = [
			"slots",
			"sessions",
			"fileUpload",
			"uiSession",
			"uiWorkspace",
			"locale",
			"configForms"
		];
		/** Validated Conversation runtime configuration. */
		const Config = Schema.object({ maxConcurrentFileUploads: Schema.natural().min(1).default(2) });
		const ABSENT_NOTICES = {
			getSnapshot: () => null,
			subscribe: () => () => {}
		};
		const ABSENT_BLOCK = {
			getSnapshot: () => void 0,
			subscribe: () => () => {}
		};
		const EMPTY_LEXICON = /* @__PURE__ */ new Map();
		const ABSENT_LEXICON = {
			getSnapshot: () => EMPTY_LEXICON,
			subscribe: () => () => {}
		};
		const ABSENT_MENU_LAUNCHER = {
			getSnapshot: () => null,
			subscribe: () => () => {}
		};
		const EMPTY_FILE_UPLOADS = {};
		const ABSENT_FILE_UPLOADS = {
			getSnapshot: () => EMPTY_FILE_UPLOADS,
			subscribe: () => () => {}
		};
		/** The shell-installed bridge, when this document runs inside the Desktop application. */
		function hostPathBridge() {
			return globalThis.__DSH_HOST_PATHS__;
		}
		/** Resolve the session-scoped Conversation action face, failing loud. */
		function scopedConversation(sessions, id) {
			const scoped = sessions.scope(id);
			if (scoped === void 0) throw new Error(`ui-conversation: session "${id}" resolved no scope`);
			const conversation = scoped.get("conversation");
			if (conversation === void 0) throw new Error("ui-conversation: conversation service unavailable through the session scope");
			return conversation;
		}
		/** Resolve package-internal attachment operations from the public service. */
		function concreteConversation(ctx) {
			const conversation = ctx.get("conversation");
			if (conversation === void 0) throw new Error("ui-conversation: conversation service unavailable");
			return conversation;
		}
		/**
		* Mount the Conversation core and target-neutral presentation.
		* @param ctx - Client root context.
		*/
		function apply(ctx, config = Config({})) {
			const sessions = ctx.sessions;
			const slots = ctx.slots;
			const maxConcurrentFileUploads = config.maxConcurrentFileUploads;
			const workspaceNavigation = ctx.get("uiWorkspace");
			const uiConversation = new UiConversation(ctx, sessions);
			uiConversation.userText.register(sessionReferenceRule);
			uiConversation.userText.register(collapseWhitespaceRule);
			uiConversation.userText.register(trimWhitespaceRule);
			slots.registerFactory({
				name: "conversation.user.text",
				scope: "session",
				children: { "conversation.user.text.node": {
					kind: "keyed",
					scope: "session",
					inline: true
				} },
				inject: () => ({
					hooks: { userTextRevision: {
						getSnapshot: () => uiConversation.userText.getSnapshot(),
						subscribe: (listener) => uiConversation.userText.subscribe(listener)
					} },
					createUserTextEvaluator: () => uiConversation.userText.createEvaluator(),
					reportTransformFailure: (error) => {
						console.error("[ui-conversation] user-text transformation failed:", error);
					}
				})
			}, UserText);
			slots.inject("conversation.user.text.node", function* () {
				yield slots.register({
					name: "conversation.user.text.node",
					key: "text",
					priority: 100
				}, PlainUserText);
				yield slots.register({
					name: "conversation.user.text.node",
					key: "session",
					priority: 100
				}, SessionReference);
			});
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-conversation: dictionaries");
			const t = ctx.locale.bind(NS);
			const conversationStore = createConversationStore();
			const submissionPolicy = new ComposerSubmissionPolicy(ctx.configForms.get(CONVERSATION_SETTINGS_NAMESPACE));
			ctx.effect(() => () => {
				submissionPolicy.dispose();
			});
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "composer-enter",
				order: 20,
				locale: NS,
				inject: () => ({
					hooks: { busyEnter: submissionPolicy.busyEnter },
					setBusyEnter: (behavior) => {
						submissionPolicy.setBusyEnter(behavior);
					}
				})
			}, EnterBehaviorRow));
			const viewTabs = () => {
				const tabs = [];
				for (const entry of slots.entries("conversation.view")) {
					/* v8 ignore next -- list registration validates id at load. */
					if (entry.options.id === void 0) continue;
					if (!ctx.configForms.developerTools.enabled.getSnapshot() && entry.options.id === "trajectory") continue;
					tabs.push({
						id: entry.options.id,
						label: (0, _deepseek_ai_dsh_client_ui_slots.resolveSlotLabel)(entry.options.label) ?? entry.options.id
					});
				}
				return tabs;
			};
			const activateView = (sessionId, preferred) => {
				const active = resolveActiveView(viewTabs(), preferred);
				if (active !== void 0) uiConversation.binding(sessionId).activate(active.id);
			};
			const restoreView = (sessionId) => {
				activateView(sessionId, readConversationViewPreference(sessionId));
			};
			const conversationViews = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(viewTabs());
			const bindings = /* @__PURE__ */ new Set();
			const trackedBindings = /* @__PURE__ */ new WeakSet();
			const trackBinding = (binding) => {
				if (trackedBindings.has(binding)) return;
				trackedBindings.add(binding);
				bindings.add(binding);
				binding.ctx.effect(() => () => {
					bindings.delete(binding);
				}, "ui-conversation: active Provider binding");
			};
			const refreshViews = () => {
				const current = conversationViews.getSnapshot();
				const next = viewTabs();
				if (!(current.length === next.length && current.every((tab, index) => {
					const candidate = next.at(index);
					return candidate !== void 0 && tab.id === candidate.id && tab.label === candidate.label;
				}))) conversationViews.set(next);
				for (const binding of bindings) restoreView(binding.sessionId);
			};
			ctx.effect(() => {
				const disposeViews = slots.subscribe("conversation.view", refreshViews);
				const disposeLocale = ctx.locale.subscribe(refreshViews);
				const disposeDeveloperTools = ctx.configForms.developerTools.enabled.subscribe(refreshViews);
				return () => {
					disposeDeveloperTools();
export {};
