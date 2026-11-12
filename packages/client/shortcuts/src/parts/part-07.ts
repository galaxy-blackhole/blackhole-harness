/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
								schema.bits[key] = args[index][key];
							}
							break;
						case "callback": {
							const callback = schema.callback = args[index];
							callback["toJSON"] ||= () => callback.toString();
							break;
						}
						case "constructor": {
							const constructor = schema.constructor = args[index];
							if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
							break;
						}
						default: schema[key] = args[index];
					}
				});
				if (name === "object" || name === "dict") schema.meta.default = {};
				else if (name === "array" || name === "tuple") schema.meta.default = [];
				else if (name === "bitset") schema.meta.default = 0;
				return schema;
			} });
		}
		defineMethod("is", ["constructor"], ({ constructor }) => {
			if (typeof constructor === "function") return constructor.name;
			else return constructor;
		});
		defineMethod("any", [], () => "any");
		defineMethod("never", [], () => "never");
		defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
		defineMethod("string", [], () => "string");
		defineMethod("number", [], () => "number");
		defineMethod("boolean", [], () => "boolean");
		defineMethod("bitset", ["bits"], () => "bitset");
		defineMethod("function", [], () => "function");
		defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
		defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
		defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
		defineMethod("object", ["dict"], ({ dict }) => {
			if (Object.keys(dict).length === 0) return "{}";
			return `{ ${Object.entries(dict).map(([key, inner]) => {
				return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
			}).join(", ")} }`;
		});
		defineMethod("union", ["list"], ({ list }, inline) => {
			const result = list.map(({ toString: format }) => format()).join(" | ");
			return inline ? `(${result})` : result;
		});
		defineMethod("intersect", ["list"], ({ list }) => {
			return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
		});
		defineMethod("transform", [
			"inner",
			"callback",
			"preserve"
		], ({ inner }, isInner) => inner.toString(isInner));
		//#endregion
		//#region lib/types/config.js
		/** Window-local timing accepted by the Host and browser keyboard service. */
		/** Validated deployment settings for fixed keyboard sequences. */
		const Config = Schema.object({ stopSequenceMs: Schema.natural().min(1).max(2147483646).default(500) });
		//#endregion
		//#region lib/types/client/index.js
		/** Browser command service, with one keyboard adapter per plugin lifetime. */
		/** Cordis keyboard provider; Desktop startup requires its native keyboard bridge. */
		var ShortcutsService = class extends _deepseek_ai_cordis.Service {
			static inject = ["locale"];
			runtime;
			platform;
			catalog;
			config;
			fixedCatalog;
			stopSequenceMs;
			fixedListeners = /* @__PURE__ */ new Set();
			adapter;
			keyboard;
			active = true;
			connected = false;
			registry;
			constructor(ctx) {
				const environment = detectEnvironment(document, navigator);
				const keyboard = environment.runtime === "desktop" ? window.dshDesktop?.keyboard : void 0;
				if (environment.runtime === "desktop" && keyboard === void 0) throw new Error("Desktop keyboard bridge unavailable");
				super(ctx, "shortcuts");
				this.keyboard = keyboard;
				this.runtime = environment.runtime;
				this.platform = environment.platform;
				const config = Config(globalThis.__DSH_SHORTCUTS_CONFIG__ ?? {});
				this.stopSequenceMs = config.stopSequenceMs;
				this.registry = new ShortcutRegistry(this.runtime, this.platform, initialShortcutConfig());
				this.catalog = this.registry.catalog;
				this.config = this.registry.config;
				this.fixedCatalog = this.registry.fixedCatalog;
				const publish = (snapshot) => {
					if (this.active && this.connected && snapshot.sequence >= this.config.getSnapshot().sequence) this.registry.configure(snapshot);
				};
				const web = this.runtime === "web" ? webShortcutStorage(window, this.platform, publish) : void 0;
				this.adapter = web ?? desktopShortcutStorage(window);
				if (keyboard !== void 0) ctx.effect(() => installNativeKeyboard(window, keyboard, this.registry, () => this.config.getSnapshot(), () => {
					this.fixedInput({ type: "reset" });
				}), "shortcuts: native keyboard");
				ctx.effect(() => {
					const off = this.adapter?.subscribe(publish);
					return () => {
						this.active = false;
						off?.();
						web?.dispose();
					};
				}, "shortcuts: preferences");
				this.syncDefinitions();
				ctx.effect(() => {
					const off = installKeyboard(window, this.registry, (input) => {
						this.fixedInput(input);
					}, keyboard !== void 0 && (this.platform === "macos" || this.platform === "windows"));
					return () => {
						off();
						this.fixedListeners.clear();
					};
				}, "shortcuts: keyboard");
				ctx.effect(() => ctx.locale.subscribe(() => {
					this.registry.refreshLabels();
				}), "shortcuts: locale");
			}
			register(command) {
				const off = this.registry.register(command);
				this.syncDefinitions();
				return () => {
					off();
					this.syncDefinitions();
				};
			}
			registerFixed(command) {
				const off = this.registry.registerFixed(command);
				this.syncDefinitions();
				return () => {
					off();
					this.syncDefinitions();
				};
			}
			observeFixedInput(listener) {
				this.fixedListeners.add(listener);
				return () => {
					this.fixedListeners.delete(listener);
				};
			}
			fixedInput(input) {
				let consumed = false;
				for (const listener of [...this.fixedListeners]) {
					if (!this.fixedListeners.has(listener)) continue;
					try {
						listener(input.type === "reset" ? input : {
							...input,
							gesture: {
								...input.gesture,
								defaultPrevented: input.gesture.defaultPrevented || consumed
							},
							consume: () => {
								consumed = true;
								input.consume();
							}
						});
					} catch (error) {
						console.error("Fixed shortcut handler failed", error);
					}
				}
			}
			describeBinding(binding) {
				const normalized = binding === null ? null : normalizeBinding(binding, this.platform);
				return {
					binding: normalized,
					keys: presentBinding(normalized, this.platform).keys,
					issue: normalized === null ? null : bindingIssue(normalized, this.runtime, this.platform),
					conflicts: normalized === null ? [] : [...this.catalog.getSnapshot().filter((row) => row.binding !== null && overlappingBindings(row.binding, normalized)).map((row) => row.id), ...this.fixedCatalog.getSnapshot().filter((row) => row.bindings.some((binding) => overlappingBindings(binding, normalized))).map((row) => row.id)]
				};
			}
			syncDefinitions() {
				if (!this.active) return;
				if (this.adapter === void 0) {
					this.failRead();
					return;
				}
				this.adapter.get(this.registry.definitions()).then((snapshot) => {
					this.connected = true;
					if (this.active && snapshot.sequence >= this.config.getSnapshot().sequence) this.registry.configure(snapshot);
				}, () => {
					this.failRead();
				});
			}
			failRead() {
				if (this.active) this.registry.configure({
					...this.config.getSnapshot(),
					status: "unreadable",
					error: "read"
				});
			}
			/**
			* Persist one reviewed operation while retaining accepted bindings on failure.
			* @param args - edit and expected revision supplied by the editor.
			* @returns classified save outcome and accepted snapshot.
			*/
			async edit(...args) {
				if (this.adapter === void 0) return {
					status: "unreadable",
					snapshot: this.config.getSnapshot()
				};
				let result;
				try {
					result = await this.adapter.edit(...args);
				} catch (error) {
					if (this.active) console.error("Shortcut preference save failed", error);
					return {
						status: "write-failed",
						snapshot: this.config.getSnapshot()
					};
				}
				if (this.active && result.snapshot.sequence >= this.config.getSnapshot().sequence) this.registry.configure(result.snapshot);
				return result;
			}
			async recording(active) {
				if (this.adapter === void 0) throw new Error("Desktop shortcuts bridge unavailable");
				await this.adapter.recording(active);
			}
			async closeWindow() {
				if (this.keyboard === void 0) throw new Error("Desktop keyboard bridge unavailable");
				await this.keyboard.closeWindow(this.config.getSnapshot().revision);
			}
		};
		//#endregion
		module.exports = ShortcutsService;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
