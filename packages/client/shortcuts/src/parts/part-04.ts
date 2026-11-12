/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				const current = this.config.getSnapshot();
				if (config.revision === current.revision && config.status === current.status && config.error === current.error) return;
				this.refreshLabels(config);
			}
			/**
			* Register atomically after checking defaults for all supported platforms and shells.
			* @param command - feature-owned command definition.
			* @returns idempotent disposer removing both matching and catalog entries.
			*/
			register(command) {
				if (this.commands.has(command.id) || this.fixedCommands.has(command.id)) throw new Error(`Duplicate shortcut command: ${command.id}`);
				for (const runtime of ["desktop", "web"]) for (const platform of [
					"macos",
					"windows",
					"linux"
				]) {
					const candidate = resolveShortcutDefault(command, runtime, platform);
					if (candidate === void 0) continue;
					const binding = normalizeBinding(candidate, platform);
					if (runtime === "web" && !isWebBindingAllowed(binding, platform)) throw new Error(`Unsupported Web shortcut: ${command.id}`);
					if (bindingIssue(binding, runtime, platform) !== null) throw new Error(`Reserved shortcut default: ${command.id}`);
					for (const existing of this.commands.values()) {
						const other = resolveShortcutDefault(existing, runtime, platform);
						if (other !== void 0 && overlappingBindings(binding, normalizeBinding(other, platform))) throw new Error(`Conflicting shortcut defaults: ${command.id} and ${existing.id} (${runtime}:${platform})`);
					}
				}
				this.commands.set(command.id, command);
				this.refreshLabels();
				return () => {
					if (this.commands.get(command.id) !== command) return;
					this.commands.delete(command.id);
					this.refreshLabels();
				};
			}
			/**
			* Recompute effective bindings when preferences, commands, or locale change.
			* @param config - accepted configuration, defaulting to the current snapshot.
			*/
			refreshLabels(config = this.config.getSnapshot()) {
				this.bindings.clear();
				this.conflicts.clear();
				const catalog = effectiveShortcuts(this.definitions(), config.document, this.runtime, this.platform).map((row) => {
					const command = this.commands.get(row.id);
					const enabled = config.status !== "loading" && row.issue === null && row.conflicts.length === 0;
					if (enabled && row.binding !== null) this.bindings.set(bindingKey(row.binding), command);
					if (config.status !== "loading" && row.issue === null && row.conflicts.length > 0 && row.binding !== null) this.conflicts.set(bindingKey(row.binding), command);
					return {
						...row,
						label: command.label(),
						aliases: command.aliases,
						...presentBinding(row.binding, this.platform),
						aria: enabled ? presentBinding(row.binding, this.platform).aria : void 0
					};
				});
				this.state.set({
					config,
					catalog
				});
				this.refreshFixedLabels();
			}
			/**
			* Invoke a native menu selection independently of its optional key binding.
			* @param id - registered product command.
			* @param context - live input owner and modal state.
			*/
			invoke(id, context) {
				const command = this.commands.get(id);
				if (command === void 0 || context.modal !== null && !command.modals.includes(context.modal)) return;
				const result = command.resolve({
					...context,
					source: "menu"
				});
				if (result.status === "handled") result.run();
			}
			/**
			* Windows/macOS Desktop bindings override local regions and modal controls independently of their configuration source.
			* @param gesture - normalized DOM/native input facts.
			* @param context - synchronous input and modal owner.
			* @param consume - adapter's preventDefault, called before business execution.
			* @returns handled, blocked with a reason, or pass for local/system input.
			*/
			dispatch(gesture, context, consume) {
				if (gesture.defaultPrevented || gesture.composing) return { status: "pass" };
				const modifiers = [
					"control",
					"alt",
					"shift",
					"meta"
				].filter((value) => gesture[value]);
				const pairKey = bindingKey({
					code: gesture.code,
					modifiers,
					...gesture.secondCode === void 0 ? {} : { secondCode: gesture.secondCode }
				});
				const key = this.bindings.has(pairKey) || this.conflicts.has(pairKey) ? pairKey : bindingKey({
					code: gesture.code,
					modifiers
				});
				const command = this.bindings.get(key) ?? this.conflicts.get(key);
				const priority = this.runtime === "desktop" && (this.platform === "windows" || this.platform === "macos");
				if (command === void 0 || !priority && !command.regions.includes(context.region)) return { status: "pass" };
				if (!priority && context.region === "terminal" && gesture.control && !gesture.meta && !gesture.alt && !gesture.shift && (gesture.code === "KeyW" || gesture.code === "KeyR")) return { status: "pass" };
				if (!this.bindings.has(key)) {
					consume();
					return {
						status: "blocked",
						commandId: command.id,
						reason: "conflict"
					};
				}
				if (!priority && context.modal !== null && !command.modals.includes(context.modal)) {
					consume();
					return {
						status: "blocked",
						commandId: command.id,
						reason: "modal"
					};
				}
				const resolution = command.resolve(context);
				if (resolution.status === "pass") return resolution;
				consume();
				if (resolution.status === "blocked") return {
					...resolution,
					commandId: command.id
				};
				if (!gesture.repeat) resolution.run();
				return {
					status: "handled",
					commandId: command.id
				};
			}
		};
		//#endregion
		//#region lib/types/client/dom.js
		/** Main-document keyboard adapter; local controls arbitrate before window bubbling. */
		/**
		* Detect the visiting device, never the server operating system.
		* @param document - product document, marked by Electron preload when present.
		* @param navigator - browser device identification.
		* @returns explicit runtime and platform for default resolution.
		*/
		function detectEnvironment(document, navigator) {
			const desktop = document.documentElement.dataset.platform;
			const device = desktop ?? navigator.platform;
			return {
				runtime: desktop === void 0 ? "web" : "desktop",
				platform: /darwin|mac|iphone|ipad/iu.test(device) ? "macos" : /win/iu.test(device) ? "windows" : "linux"
			};
		}
		/**
		* Install document composition tracking, modal-cache invalidation, and dispatch after local handlers.
		* @param window - input window owned by the client plugin.
		* @param shortcuts - command registry for this window.
		* @param fixed - optional fixed-sequence consumer after local controls.
		* @param native - native input owns configurable bindings; DOM delivery only feeds fixed actions.
		* @returns disposer releasing every listener, the modal observer, and cached nodes.
		*/
		function installKeyboard(window, shortcuts, fixed, native = false) {
			const document = window.document;
			const composition = (0, _deepseek_ai_dsh_client_ui_primitives.observeComposition)(document);
			let pending = false;
			let pendingTimer;
			const reset = () => {
				fixed?.({ type: "reset" });
			};
			let deadKey = false;
			let dialogs;
			const blur = () => {
				deadKey = false;
				reset();
			};
			const containsModal = (node) => node instanceof Element && (node.matches(_deepseek_ai_dsh_client_ui_primitives.modalSelector) || node.querySelector(_deepseek_ai_dsh_client_ui_primitives.modalSelector) !== null);
			const changedModals = (records) => {
				if (records.length > 0) dialogs = void 0;
				if (records.some((record) => record.type === "attributes" ? record.oldValue === "dialog" || record.oldValue === "true" || containsModal(record.target) : [...record.addedNodes, ...record.removedNodes].some(containsModal))) reset();
			};
			const observer = new MutationObserver(changedModals);
			observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ["role", "aria-modal"],
				attributeOldValue: true
			});
			const capture = () => {
				if (pending) reset();
				window.clearTimeout(pendingTimer);
				changedModals(observer.takeRecords());
				pending = true;
				pendingTimer = window.setTimeout(() => {
					pending = false;
					pendingTimer = void 0;
					reset();
				}, 0);
			};
			const keydown = (event) => {
				window.clearTimeout(pendingTimer);
				pendingTimer = void 0;
				pending = false;
				const target = event.composedPath().find((value) => value instanceof Element);
				const element = target instanceof Element ? target : document.activeElement;
				const region = element?.closest(".xterm") ? "terminal" : element?.closest("input, textarea, select, [contenteditable=\"true\"], [contenteditable=\"\"]") ? "editable" : "page";
				changedModals(observer.takeRecords());
				dialogs ??= document.querySelectorAll(_deepseek_ai_dsh_client_ui_primitives.modalSelector);
				const top = dialogs[dialogs.length - 1];
				const context = {
					region,
					modal: top === void 0 ? null : top.dataset.shortcutModal ?? "other",
					target: element
				};
				const guarded = composition.guards(event) || deadKey || event.getModifierState("AltGraph");
				const isDead = event.key === "Dead";
				const commandDeadKey = isDead && shortcuts.runtime === "web" && shortcuts.platform === "macos" && event.code === "KeyN" && event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey;
				deadKey = isDead;
				const gesture = {
					code: event.code,
					control: event.ctrlKey,
					alt: event.altKey,
					shift: event.shiftKey,
					meta: event.metaKey,
					repeat: event.repeat,
					composing: guarded || isDead,
					defaultPrevented: event.defaultPrevented
				};
				const consume = () => {
					event.preventDefault();
					if (commandDeadKey) deadKey = false;
				};
				fixed?.({
					type: "keydown",
					gesture,
					context,
					consume
				});
				if (native) return;
				shortcuts.dispatch({
					...gesture,
					composing: guarded || isDead && !commandDeadKey,
					defaultPrevented: event.defaultPrevented
				}, context, consume);
			};
			document.addEventListener("compositionstart", reset, true);
			document.addEventListener("compositionend", reset, true);
			document.addEventListener("focusin", reset, true);
			document.addEventListener("pointerdown", reset, true);
			window.addEventListener("keydown", capture, true);
			window.addEventListener("keydown", keydown);
			window.addEventListener("blur", blur);
			return () => {
				pending = false;
				window.clearTimeout(pendingTimer);
				observer.disconnect();
				dialogs = void 0;
				composition.dispose();
				document.removeEventListener("compositionstart", reset, true);
				document.removeEventListener("compositionend", reset, true);
				document.removeEventListener("focusin", reset, true);
				document.removeEventListener("pointerdown", reset, true);
				window.removeEventListener("keydown", capture, true);
				window.removeEventListener("keydown", keydown);
				window.removeEventListener("blur", blur);
			};
		}
		//#endregion
		//#region lib/types/client/storage.js
		/** Explicit browser and Desktop preference adapters; Desktop never falls back to browser storage. */
		/** Browser-profile and origin-local preference key. */
		const SHORTCUT_STORAGE_KEY = "dsh.keybindings.v1";
		/**
		* Connect localStorage and same-origin external updates to the shared transaction coordinator.
		* @param window - owning browser window.
		* @param platform - visiting device platform.
		* @param publish - accepts complete configuration snapshots.
		* @returns adapter and lifecycle disposal.
		*/
		function webShortcutStorage(window, platform, publish) {
			const persistence = new ShortcutPersistence({
				read: () => window.localStorage.getItem(SHORTCUT_STORAGE_KEY),
				write: (raw) => {
					window.localStorage.setItem(SHORTCUT_STORAGE_KEY, raw);
				}
			}, "web", platform, true, publish);
			const changed = (event) => {
				if (event.key === null || event.key === "dsh.keybindings.v1") persistence.readCurrent();
			};
			window.addEventListener("storage", changed);
			return {
				get: (definitions) => {
					persistence.setDefinitions(definitions);
					return persistence.readCurrent();
				},
				edit: (edit, revision) => persistence.edit(edit, revision),
				subscribe: () => () => {},
				recording: async () => {},
				dispose: () => {
					window.removeEventListener("storage", changed);
					persistence.dispose();
				}
			};
		}
		/**
		* Read the origin-scoped preload capability; a missing bridge is an explicit configuration failure.
		* @param window - product window.
		* @returns the restricted Desktop API, or undefined while the preload is unavailable.
		*/
		function desktopShortcutStorage(window) {
			return window.dshDesktop?.shortcuts;
		}
		//#endregion
		//#region lib/types/client/native.js
		/** Desktop gestures use live focus, modal state, and verified embedding ownership. */
		/**
		* Route native menu, main-frame, and embedded-frame input through the shared command registry.
		* @param window - trusted product document.
		* @param keyboard - top-frame preload capability.
		* @param registry - window-local command owner.
		* @param snapshot - latest accepted configuration.
		* @param reset - clears pending fixed sequences when native input bypasses DOM delivery.
		* @returns disposer releasing native input.
		*/
		function installNativeKeyboard(window, keyboard, registry, snapshot, reset) {
			return keyboard.subscribe((input) => {
				if (input.revision !== snapshot().revision) return;
				reset?.();
				let target = window.document.activeElement;
				while (target?.shadowRoot?.activeElement != null && !target.matches("webview[data-sidebar-browser-frame]")) target = target.shadowRoot.activeElement;
				const top = [...window.document.querySelectorAll(_deepseek_ai_dsh_client_ui_primitives.modalSelector)].at(-1);
				const region = target?.closest(".xterm") ? "terminal" : target?.matches("input, textarea, select, [contenteditable=\"true\"], [contenteditable=\"\"]") ? "editable" : "page";
				const context = {
					target,
					region,
					modal: top?.dataset.shortcutModal ?? (top === void 0 ? null : "other")
				};
				if (input.kind === "menu") {
					registry.invoke(input.commandId, context);
					return;
				}
				if (input.kind === "keyboard") {
					registry.dispatch({
						...input,
						composing: false,
						defaultPrevented: false
					}, context, () => {});
					return;
				}
				if (input.kind === "webview") {
					if (target?.matches("webview[data-sidebar-browser-frame]") !== true || !target.isConnected || input.frameName === "" || target.getAttribute("name") !== input.frameName) return;
					registry.dispatch({
						...input,
						composing: false,
						defaultPrevented: false
					}, {
						...context,
						source: "webview"
					}, () => {});
					return;
				}
				if (!(target instanceof HTMLIFrameElement) || !target.isConnected || !target.matches("iframe[data-sidebar-browser-frame], iframe[data-html-preview]") || input.frameName === "" || target.name !== input.frameName) return;
				registry.dispatch({
					...input,
					composing: false,
					defaultPrevented: false
				}, {
					...context,
					source: "iframe"
				}, () => {});
			});
		}
		//#endregion
		//#region ../../../vendor/cosmokit/lib/index.js
		/** Return true when a value is `null` or `undefined`. */
		function isNullable(value) {
			return value === null || value === void 0;
		}
		/** Return true for non-array object values. */
		function isPlainObject(data) {
			return data && typeof data === "object" && !Array.isArray(data);
		}
		/** Filter object entries and return a new object. */
		function filterKeys(object, filter) {
			return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
		}
		/** Map object values while preserving the original key set. */
		function mapValues(object, transform) {
			return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
		}
		/** Pick selected keys from an object, optionally including `undefined` values. */
		function pick(source, keys, forced) {
			if (!keys) return { ...source };
			const result = {};
			for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
			return result;
		}
		/** Shared config references used by schema validators and plugin runtimes. */
		const write = Symbol.for("cosmokit.volatile.write");
		function snapshot(value, ancestors = /* @__PURE__ */ new Set()) {
			if (typeof value === "function") throw new TypeError("volatile config cannot contain functions");
			if (value === null || typeof value !== "object") return value;
			if (ancestors.has(value)) throw new TypeError("volatile config cannot contain cycles");
			ancestors.add(value);
export {};
