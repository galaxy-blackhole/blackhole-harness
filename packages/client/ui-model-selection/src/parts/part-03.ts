/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		//#endregion
		//#region lib/types/client/directory.js
		/** One session's shared directory controller; disposed with the session scope. */
		var ModelDirectory = class {
			sessions;
			sessionId;
			available;
			catalog;
			projected;
			isBlank;
			track;
			/** The shared snapshot both entries render from (uSES-safe store). */
			store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				current: null,
				routable: null,
				groups: [],
				failures: [],
				status: "idle",
				pending: null,
				error: null
			});
			/** Latest selection operation wins; an older response never overwrites a newer one. */
			generation = 0;
			disposed = false;
			unsubscribeCatalog;
			unsubscribeSelection;
			/**
			* @param sessions - the session wire face (captured from the plugin's root connection).
			* @param sessionId - the owning session.
			* @param available - whether this session may use Agent-bound model RPCs.
			* @param catalog - Host-generation catalog shared by every Session.
			* @param projected - durable model selection projected from Session history.
			* @param isBlank - whether this Session has no first message yet.
			* @param track - desktop-only callback after a successful user selection.
			*/
			constructor(sessions, sessionId, available, catalog, projected, isBlank, track) {
				this.sessions = sessions;
				this.sessionId = sessionId;
				this.available = available;
				this.catalog = catalog;
				this.projected = projected;
				this.isBlank = isBlank;
				this.track = track;
				this.unsubscribeCatalog = catalog.store.subscribe(() => {
					this.syncInputs();
				});
				this.unsubscribeSelection = projected.subscribe(() => {
					this.syncInputs();
				});
				this.syncInputs();
			}
			/**
			* Ensure the Host generation's shared available catalog is loaded.
			* @returns the fresh directory value.
			*/
			async load() {
				this.assertAvailable();
				await this.catalog.load();
				this.syncInputs();
				return this.store.getSnapshot();
			}
			/**
			* Select the complete provider/model/reasoning selection. The durable
			* projection frame updates the shared current; failures surface on the store
			* and return with the operation so each entry can present its own failure.
			* @param selection - provider, provider-owned model id, and optional adapter-owned effort.
			* @returns the selection outcome, including the original Remote failure.
			*/
			async select(selection) {
				this.assertAvailable();
				const previous = this.store.getSnapshot().current;
				const previousEffort = previous?.reasoningEffort ?? (previous === null ? void 0 : this.catalog.reasoningFor(previous)?.defaultEffort);
				const nextEffort = selection.reasoningEffort ?? this.catalog.reasoningFor(selection)?.defaultEffort;
				const generation = ++this.generation;
				this.store.update((s) => {
					s.status = "selecting";
					s.pending = selection;
					s.error = null;
				});
				const result = await this.sessions.selectModel({
					sessionId: this.sessionId,
					provider: selection.provider,
					model: selection.model,
					...selection.reasoningEffort === void 0 ? {} : { reasoningEffort: selection.reasoningEffort }
				});
				if (this.disposed || generation !== this.generation) return result.ok ? {
					ok: true,
					value: void 0
				} : result;
				if (!result.ok) {
					this.store.update((s) => {
						s.status = "error";
						s.pending = null;
						s.error = `${result.error.code}: ${result.error.message}`;
					});
					return result;
				}
				if (previous !== null) {
					const from = `${previous.provider}/${previous.model}`;
					const to = `${selection.provider}/${selection.model}`;
					if (from !== to) this.track?.("model_switch", {
						...this.isBlank() ? {} : { session_id: this.sessionId },
						switch_from: from,
						switch_to: to
					});
					if (from === to && previousEffort !== nextEffort) this.track?.("thinking_level_switch", {
						...this.isBlank() ? {} : { session_id: this.sessionId },
						model_name: to,
						switch_from: previousEffort ?? "default",
						switch_to: nextEffort ?? "default"
					});
				}
				this.store.update((s) => {
					s.status = "ready";
					s.pending = null;
					s.error = null;
				});
				this.syncInputs();
				return {
					ok: true,
					value: void 0
				};
			}
			/**
			* Invalidate an in-flight selection response from the previous Host generation.
			*/
			resetConnected() {
				if (this.disposed) return;
				++this.generation;
				this.store.update((state) => {
					if (state.status === "selecting") state.status = "idle";
					state.pending = null;
					state.error = null;
				});
				this.syncInputs();
			}
			/** Scope teardown: late settlements lose write access to the store. */
			dispose() {
				this.disposed = true;
				this.unsubscribeSelection();
				this.unsubscribeCatalog();
			}
			assertAvailable() {
				if (!this.available()) throw new Error("model selection is unavailable for addressed subagent sessions");
			}
			syncInputs() {
				if (this.disposed) return;
				const catalog = this.catalog.store.getSnapshot();
				const projected = modelSelectionProjection(this.projected.getSnapshot());
				const intended = projected?.next ?? catalog.value?.default;
				const reasoning = intended === void 0 ? void 0 : this.catalog.reasoningFor(intended);
				const effort = intended?.reasoningEffort ?? reasoning?.defaultEffort;
				const retainedEffort = effort === void 0 ? void 0 : reasoning?.efforts.find((level) => level.id === effort)?.name ?? effort;
				if (catalog.status !== "ready" || catalog.value === null || projected === void 0) {
					this.store.set({
						current: catalog.value === null ? null : this.store.getSnapshot().current,
						...retainedEffort === void 0 ? {} : { retainedEffort },
						routable: null,
						groups: catalog.value?.groups ?? [],
						failures: catalog.value?.failures ?? [],
						status: catalog.status === "error" ? "error" : "loading",
						pending: this.store.getSnapshot().pending,
						error: catalog.error
					});
					return;
				}
				const selection = projected.next ?? catalog.value.default;
				const routable = catalog.value.groups.some((group) => group.id === selection.provider && group.models.some((model) => model.id === selection.model));
				this.store.set({
					current: selection,
					...retainedEffort === void 0 ? {} : { retainedEffort },
					routable,
					groups: catalog.value.groups,
					failures: catalog.value.failures,
					status: this.store.getSnapshot().status === "selecting" ? "selecting" : "ready",
					pending: this.store.getSnapshot().pending,
					error: null
				});
			}
		};
		function modelSelectionProjection(value) {
			return value === void 0 ? void 0 : value;
		}
		//#endregion
		//#region lib/types/client/service.js
		/** The `ctx.modelDirectories` session model-selection service. */
		var ModelDirectoryResolver = class extends _deepseek_ai_cordis.Service {
			static inject = [
				"sessions",
				"remote",
				"remote.session"
			];
			live = { directories: new WeakMapWithValues() };
			catalog;
			/**
			* @param ctx - owning root context (the service registers itself as `models`).
			*/
			constructor(ctx) {
				super(ctx, "modelDirectories");
				this.catalog = new ModelCatalogDirectory(ctx);
				this.catalog.load().catch(() => {});
				ctx.on("connection/reset", () => {
					this.catalog.resetGeneration();
					for (const directory of this.live.directories.values) directory.resetConnected();
				});
				ctx.remote.$on("llm/adapters-updated", () => {
					this.catalog.refresh();
				});
				ctx.remote.$on("settings/document-updated", () => {
					this.catalog.refresh();
				});
				ctx.remote.$on("credentials/record-updated", () => {
					this.catalog.refresh();
				});
				ctx.remote.$on("credentials/reference-updated", () => {
					this.catalog.refresh();
				});
			}
			/**
			* Resolve the per-session shared directory (lazy; the scope disposer
			* removes and disposes it). Unknown sessions fail loud.
			* @param sessionId - the owning session.
			* @returns the resident directory both entries share.
			*/
			directoryFor(sessionId) {
				const { live } = this;
				const sessions = this.ctx.sessions;
				const actx = sessions.scope(sessionId);
				if (actx === void 0) throw new Error(`ui-model-selection: session "${String(sessionId)}" resolved no scope`);
				const binding = sessions.binding(sessionId);
				if (binding === void 0) throw new Error(`ui-model-selection: session "${String(sessionId)}" resolved no binding`);
				const existing = live.directories.get(binding);
				if (existing !== void 0) return existing;
				const directory = new ModelDirectory(this.ctx.remote.session, sessionId, () => sessions.subagentAddress(sessionId) === void 0, this.catalog, binding.session.projections.faceOf("modelSelection"), () => binding.session.getSnapshot().blank, (name, attributes) => this.ctx.get("productAnalytics")?.track(name, attributes));
				live.directories.set(binding, directory);
				actx.effect(() => () => {
					directory.dispose();
					live.directories.delete(binding);
				}, "ui-model-selection: session directory");
				return directory;
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
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-model-selection/src/client/ModelSelect.module.css.mjs
		const css = "._7KE1Ra_root{min-width:0;position:relative}._7KE1Ra_trigger{border-radius:var(--dsw-radius-sm);min-width:0;max-width:min(360px,45cqw);height:28px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:4px;padding:0 4px 0 8px;font-size:13px;font-weight:400;line-height:20px;display:flex}._7KE1Ra_trigger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}._7KE1Ra_trigger:focus-visible:not([data-selection-focus]){box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary))}._7KE1Ra_trigger:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}._7KE1Ra_triggerLabel{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}._7KE1Ra_triggerEffort{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-caption);flex-shrink:1000;overflow:hidden}._7KE1Ra_triggerIcon{display:var(--dsh-composer-model-icon-display,none);flex:none}._7KE1Ra_triggerLabel,._7KE1Ra_triggerEffort{display:var(--dsh-composer-model-text-display,block)}._7KE1Ra_chevron{color:var(--dsw-alias-label-caption);flex:none;transition:transform .12s}._7KE1Ra_chevronOpen{transform:rotate(180deg)}._7KE1Ra_menu{z-index:1100;--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);width:max-content;min-width:min(240px,100vw - 32px);max-width:min(420px,100vw - 32px);max-height:min(360px,100vh - 96px);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:0;flex-direction:column;padding:4px;display:flex;position:fixed;overflow:hidden}._7KE1Ra_status,._7KE1Ra_empty{color:var(--dsw-alias-label-tertiary);padding:8px;font-size:12px;line-height:18px}._7KE1Ra_error,._7KE1Ra_warning{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);justify-content:space-between;align-items:flex-start;gap:6px;margin-bottom:3px;padding:6px 7px;font-size:11px;line-height:16px;display:flex}._7KE1Ra_warning{background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-state-warn-label)}._7KE1Ra_retry{color:inherit;font:inherit;cursor:pointer;background:0 0;border:none;flex:none;padding:0;font-weight:600}._7KE1Ra_searchRow{flex-shrink:0;margin:2px 0 3px;position:relative}._7KE1Ra_searchRow ._7KE1Ra_search{border-radius:var(--dsw-radius-md);background:0 0;border:0 solid #0000;height:auto;padding:5px 7px;display:flex}._7KE1Ra_searchRow ._7KE1Ra_searchWithQuery{padding-right:34px}._7KE1Ra_searchClear{corner-shape:round;width:24px;height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:50%;justify-content:center;align-items:center;padding:0;display:inline-flex;position:absolute;top:50%;right:4px;transform:translateY(-50%)}._7KE1Ra_searchClear:hover,._7KE1Ra_searchClear:focus-visible{background:var(--dsw-alias-interactive-bg-hover);outline:none}._7KE1Ra_searchRow ._7KE1Ra_search:focus-within{border-color:#0000}._7KE1Ra_searchRow ._7KE1Ra_search input{padding:0;font-size:12px;line-height:normal}._7KE1Ra_searchRow ._7KE1Ra_search input::placeholder{color:var(--dsw-alias-label-caption)}._7KE1Ra_groups{min-height:0;overflow-y:auto}._7KE1Ra_option{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;min-height:34px;color:inherit;text-align:left;cursor:pointer;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:5px 7px;display:flex}._7KE1Ra_option:not(._7KE1Ra_modelOption):hover:not(:disabled),._7KE1Ra_option:focus-visible,._7KE1Ra_optionActive:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}._7KE1Ra_selected{background:0 0}._7KE1Ra_option:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}._7KE1Ra_optionCopy{flex-direction:column;flex:1;min-width:0;display:flex}._7KE1Ra_modelName{color:inherit;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:400;line-height:18px;overflow:hidden}._7KE1Ra_check{color:var(--dsw-alias-label-primary);flex:0 0 14px;place-items:center;display:grid}._7KE1Ra_check svg{width:14px;height:14px}._7KE1Ra_cell{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:auto;min-width:100%;height:34px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;outline:none;align-items:center;gap:6px;padding:0 8px;font-size:13px;line-height:20px;display:flex}._7KE1Ra_cell:hover,._7KE1Ra_cell:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}._7KE1Ra_cellLabel{white-space:nowrap;flex:none}._7KE1Ra_cellValue{text-overflow:ellipsis;white-space:nowrap;text-align:right;min-width:0;color:var(--dsw-alias-label-tertiary);flex:auto;overflow:hidden}._7KE1Ra_cellChevron{width:12px;height:12px;color:var(--dsw-alias-menu-icon);flex:none}";
		const tagId = "@deepseek-ai/dsh-client-ui-model-selection/ModelSelect.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-model-selection";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ModelSelect_module_css_default = {
			"cell": "_7KE1Ra_cell",
			"cellChevron": "_7KE1Ra_cellChevron",
			"cellLabel": "_7KE1Ra_cellLabel",
			"cellValue": "_7KE1Ra_cellValue",
			"check": "_7KE1Ra_check",
			"chevron": "_7KE1Ra_chevron",
			"chevronOpen": "_7KE1Ra_chevronOpen",
			"empty": "_7KE1Ra_empty",
			"error": "_7KE1Ra_error",
			"groups": "_7KE1Ra_groups",
			"menu": "_7KE1Ra_menu",
			"modelName": "_7KE1Ra_modelName",
			"modelOption": "_7KE1Ra_modelOption",
			"option": "_7KE1Ra_option",
			"optionActive": "_7KE1Ra_optionActive",
			"optionCopy": "_7KE1Ra_optionCopy",
			"retry": "_7KE1Ra_retry",
			"root": "_7KE1Ra_root",
			"search": "_7KE1Ra_search",
			"searchClear": "_7KE1Ra_searchClear",
			"searchRow": "_7KE1Ra_searchRow",
			"searchWithQuery": "_7KE1Ra_searchWithQuery",
			"selected": "_7KE1Ra_selected",
			"status": "_7KE1Ra_status",
			"trigger": "_7KE1Ra_trigger",
			"triggerEffort": "_7KE1Ra_triggerEffort",
			"triggerIcon": "_7KE1Ra_triggerIcon",
			"triggerLabel": "_7KE1Ra_triggerLabel",
			"warning": "_7KE1Ra_warning"
		};
		//#endregion
		//#region lib/types/client/provider-order.js
		/** Shared provider display order for the composer and command model pickers. */
		/**
		* Put the account and official providers first, preserving every other relative order.
		* @param groups - Provider groups in catalog order.
		* @returns a sorted copy; model order within each group is unchanged.
		*/
		function orderModelProviders(groups) {
			return groups.toSorted((left, right) => (left.id === "deepseek-account" ? 0 : left.id === "deepseek-official" ? 1 : 2) - (right.id === "deepseek-account" ? 0 : right.id === "deepseek-official" ? 1 : 2));
		}
		//#endregion
		//#region lib/types/client/ModelSelect.js
		/**
		* ModelSelect: the composer's named model seat (`conversation.input.model`).
		* Two-level selection per figma 496:26454's MenuDropdown: the root menu is
		* the Model / Effort row pair (label + current value + a right chevron),
		* each drilling into its own list — the provider-grouped model list over
		* the shared directory, and the effort levels. The trigger (313:14108's
		* ToggleButton) shows both: model name + effort in the caption tone.
		* Model catalogs above four entries show search, which retains focus while
		* ↑/↓ cycle the highlighted result; Enter and Tab accept it. Smaller model
		* catalogs, root panes, and effort panes move focus between rows. Escape and Shift+Tab leave a drilled pane first and otherwise close
		* back to the trigger. A drilled pane focuses the current effort or model
		* search field. Provider headings paint their background only while pinned
		* by scrolling. Clearing a query restores the full list and search focus.
		* Selecting restores trigger focus without a ring until the trigger loses focus
		* or the menu reopens. Model names match a case-insensitive ordered subsequence
		* within each provider group, ranked by
		* prefix, alignment score, then catalog order. Returning to the root pane
		* hands focus back to the cell that opened it. Data and submission ride the
		* same per-session ModelDirectory as the /model popup; exact-model reasoning
		* metadata and the selected effort come from the Host rather than a
		* client-owned vocabulary. A rejected selection announces through the shared
		* transient Toast anchored to the composer card; the in-menu strip with
		* Retry remains the catalog-load surface. While the directory's pending
		* selection is unsettled, the trigger shows a spinner in place of its
		* chevron, and each row whose value that selection carries shows one in place
		* of its check mark.
		*/
		/** Unplaced portal card: hidden but laid out at a fixed origin so offsetWidth/offsetHeight are real (Menu primitive's measure pass). */
		const MEASURE_STYLE = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		/**
		* Render the composer model seat.
		* @param props - owner share (locked) + injected face (shared directory
		* store/verbs) + the standard locale seat.
		* @returns the trigger and, while open, the two-level menu.
		*/
		function ModelSelect({ locked, available, directory, load, select, t }) {
			const state = (0, react.useSyncExternalStore)((fn) => directory.subscribe(fn), () => directory.getSnapshot());
			const [open, setOpen] = (0, react.useState)(false);
			const [pane, setPane] = (0, react.useState)("root");
			const [query, setQuery] = (0, react.useState)("");
			const [highlightedIndex, setHighlightedIndex] = (0, react.useState)(null);
			const [selectionFocus, setSelectionFocus] = (0, react.useState)(false);
			const lastActionRef = (0, react.useRef)("load");
			const [toast, setToast] = (0, react.useState)(null);
			const toastSeq = (0, react.useRef)(0);
			const rootRef = (0, react.useRef)(null);
			const triggerRef = (0, react.useRef)(null);
			const searchRef = (0, react.useRef)(null);
			const menuRef = (0, react.useRef)(null);
			const groupsRef = (0, react.useRef)(null);
			const [menuPos, setMenuPos] = (0, react.useState)(null);
			const itemRefs = (0, react.useRef)([]);
			const id = (0, react.useId)();
			const groups = (0, react.useMemo)(() => orderModelProviders(state.groups), [state.groups]);
			const choices = (0, react.useMemo)(() => groups.flatMap((group) => group.models.map((model) => ({
				group,
				model,
				selection: {
					provider: group.id,
					model: model.id,
					...model.reasoning?.defaultEffort === void 0 ? {} : { reasoningEffort: model.reasoning.defaultEffort }
				}
			}))), [groups]);
			const showSearch = choices.length > 4;
			const filteredGroups = (0, react.useMemo)(() => groups.map((group) => ({
				...group,
				models: (0, _deepseek_ai_dsh_client_ui_primitives.rankByName)(group.models, showSearch ? query.trim() : "")
			})).filter((group) => group.models.length > 0), [
				groups,
				query,
				showSearch
			]);
			const visibleModels = (0, react.useMemo)(() => filteredGroups.flatMap((group) => group.models.map((model) => ({
				provider: group.id,
				model: model.id
			}))), [filteredGroups]);
			const currentVisibleIndex = visibleModels.findIndex((model) => model.provider === state.current?.provider && model.model === state.current.model);
			const activeModelIndex = Math.min(highlightedIndex ?? Math.max(0, currentVisibleIndex), visibleModels.length - 1);
			const currentChoice = choices[state.current === null ? -1 : choices.findIndex((c) => c.selection.provider === state.current?.provider && c.selection.model === state.current.model)];
			const reasoning = currentChoice?.model.reasoning;
			const effectiveEffort = state.current?.reasoningEffort ?? reasoning?.defaultEffort;
			const effortLabel = currentChoice === void 0 ? void 0 : reasoning === void 0 ? state.retainedEffort : effectiveEffort === void 0 ? t("effort.providerDefault") : reasoning.efforts.find((level) => level.id === effectiveEffort)?.name ?? effectiveEffort;
			const effortChoices = (0, react.useMemo)(() => reasoning === void 0 ? [] : [...reasoning.defaultEffort === void 0 ? [{
				key: "provider-default",
export {};
