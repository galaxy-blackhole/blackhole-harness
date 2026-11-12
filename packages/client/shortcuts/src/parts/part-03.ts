/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				schemaVersion: 1,
				profiles: {}
			};
			try {
				const value = JSON.parse(raw);
				if (!record(value)) return "invalid";
				if (typeof value.schemaVersion === "number" && value.schemaVersion > 2) return "future";
				if (value.schemaVersion !== 1 && value.schemaVersion !== 2 || !record(value.profiles) || Object.keys(value).some((key) => key !== "schemaVersion" && key !== "profiles")) return "invalid";
				const profiles = {};
				for (const [profile, overrides] of Object.entries(value.profiles)) {
					if (!/^(desktop|web):(macos|windows|linux)$/u.test(profile) || !record(overrides)) return "invalid";
					const bindings = {};
					for (const [id, binding] of Object.entries(overrides)) {
						if (!commandPattern.test(id)) return "invalid";
						const parsed = parseBinding(binding);
						if (value.schemaVersion === 1 && parsed?.secondCode !== void 0) return "invalid";
						bindings[id] = parsed;
					}
					profiles[profile] = bindings;
				}
				return {
					schemaVersion: value.schemaVersion,
					profiles
				};
			} catch (_error) {
				return "invalid";
			}
		}
		/**
		* Check system, editor, and browser reservations using expanded physical modifiers.
		* @param binding - normalized candidate.
		* @param runtime - receiving application shell.
		* @param platform - receiving device.
		* @returns the rejection reason, or null when this combination is allowed.
		*/
		function bindingIssue(binding, runtime, platform) {
			const { code, modifiers } = binding;
			if (runtime === "desktop" && (platform === "windows" || platform === "macos")) return null;
			if (binding.secondCode !== void 0) return "unsupported-key";
			if (modifiers.length === 0 || modifiers.every((modifier) => modifier === "shift")) return "modifier-required";
			if ((platform === "windows" || platform === "macos") && modifiers.length >= 3) return null;
			if (runtime === "web" && (platform === "windows" || platform === "macos") && isWebBindingAllowed(binding, platform)) return null;
			const primary = modifiers.includes(platform === "macos" ? "meta" : "control");
			if ([
				"Escape",
				"Tab",
				"Space",
				"Backspace",
				"Delete",
				"ArrowUp",
				"ArrowDown",
				"ArrowLeft",
				"ArrowRight"
			].includes(code) || code === "Enter" && !modifiers.includes("alt") || primary && [
				"KeyC",
				"KeyV",
				"KeyX",
				"KeyZ",
				"KeyY",
				"KeyQ",
				"KeyH"
			].includes(code) || primary && code === "KeyA" && !modifiers.includes("shift") || platform !== "macos" && (modifiers.includes("meta") || modifiers.includes("alt") && ["F4", "F2"].includes(code)) || platform === "macos" && modifiers.includes("control") && modifiers.includes("meta") || platform === "macos" && modifiers.includes("alt") && !primary) return "reserved";
			if (runtime === "web" && !isWebBindingAllowed(binding, platform)) return "unsupported-browser";
			return null;
		}
		/**
		* Select the command owner's explicit default for one device profile.
		* @param definition - command identity and per-profile defaults.
		* @param runtime - receiving shell.
		* @param platform - receiving device.
		* @returns the declared physical binding, or undefined for an unbound action.
		*/
		function resolveShortcutDefault(definition, runtime, platform) {
			return definition.defaults[`${runtime}:${platform}`];
		}
		/**
		* Resolve overrides and conflicts independently of registration order. Explicit overrides displace defaults.
		* @param definitions - active commands.
		* @param document - accepted preferences.
		* @param runtime - receiving shell.
		* @param platform - receiving device.
		* @returns every active command, including unavailable conflicting bindings.
		*/
		function effectiveShortcuts(definitions, document, runtime, platform) {
			const overrides = document.profiles[`${runtime}:${platform}`] ?? {};
			const fixed = definitions.flatMap((row) => row.fixed?.map((binding) => ({
				id: row.id,
				binding: normalizeBinding(binding, platform)
			})) ?? []);
			const rows = definitions.filter((row) => row.fixed === void 0).map(({ id, defaults }) => {
				const modified = Object.hasOwn(overrides, id);
				const candidate = modified ? overrides[id] : resolveShortcutDefault({
					id,
					defaults
				}, runtime, platform);
				const binding = candidate == null ? null : normalizeBinding(candidate, platform);
				return {
					id,
					binding,
					modified,
					issue: binding === null ? null : bindingIssue(binding, runtime, platform)
				};
			});
			return rows.map((row) => {
				const binding = row.binding;
				return {
					...row,
					conflicts: binding === null ? [] : [...new Set([...rows.filter((other) => other.id !== row.id && other.binding !== null && other.issue === null && overlappingBindings(other.binding, binding) && (!row.modified || other.modified)).map((other) => other.id), ...fixed.filter((other) => overlappingBindings(other.binding, binding)).map((other) => other.id)])]
				};
			});
		}
		/**
		* Detect identical combinations or a single key contained in a two-key chord.
		* @param left - normalized candidate.
		* @param right - normalized occupied binding.
		* @returns whether both bindings require the same modifiers and overlap.
		*/
		function overlappingBindings(left, right) {
			if (left.modifiers.join("+") !== right.modifiers.join("+")) return false;
			if (left.secondCode !== void 0 && right.secondCode !== void 0) return bindingKey(left) === bindingKey(right);
			return [left.code, left.secondCode].some((code) => code !== void 0 && (code === right.code || code === right.secondCode));
		}
		/**
		* Apply an edit without modifying other profiles or dormant overrides.
		* @param document - accepted document.
		* @param edit - validated operation.
		* @param runtime - current shell.
		* @param platform - current device.
		* @returns the candidate document, pending conflict checks and durable storage.
		*/
		function editShortcutDocument(document, edit, runtime, platform) {
			const schemaVersion = runtime === "desktop" && (platform === "macos" || platform === "windows") ? 2 : document.schemaVersion;
			const profile = `${runtime}:${platform}`;
			let overrides = { ...document.profiles[profile] };
			switch (edit.type) {
				case "set":
					overrides[edit.id] = edit.binding;
					break;
				case "reset": {
					const { [edit.id]: _removed, ...remaining } = overrides;
					overrides = remaining;
					break;
				}
				case "reset-all":
					overrides = {};
					break;
				/* v8 ignore next -- parseShortcutEdit validates this closed union before persistence. */
				default: return assertNever(edit, "shortcut edit");
			}
			return {
				schemaVersion,
				profiles: {
					...document.profiles,
					[profile]: overrides
				}
			};
		}
		//#endregion
		//#region ../../util/crypto/lib/index.js
		/**
		* Random v4 UUID, minted from `crypto.getRandomValues`.
		* @returns the UUID string.
		*/
		function randomUUID() {
			const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
			const hex = Array.from(bytes, (byte, index) => {
				return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
			}).join("");
			return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
		}
		//#endregion
		//#region lib/types/persistence.js
		/** Serialized preference transactions; storage owners publish only accepted writes or read diagnostics. */
		/**
		* Create a disabled initial snapshot for asynchronous adapter startup.
		* @returns a fresh configuration with no accepted persisted state.
		*/
		function initialShortcutConfig() {
			return {
				revision: randomUUID(),
				sequence: 0,
				document: {
					schemaVersion: 1,
					profiles: {}
				},
				status: "loading",
				error: null,
				usingDefaults: true
			};
		}
		/** Single-writer coordinator shared by localStorage and Electron's atomic file adapter. */
		var ShortcutPersistence = class {
			storage;
			runtime;
			platform;
			rereadBeforeWrite;
			publish;
			snapshot = initialShortcutConfig();
			raw;
			queue = Promise.resolve();
			definitions = null;
			active = true;
			constructor(storage, runtime, platform, rereadBeforeWrite, publish) {
				this.storage = storage;
				this.runtime = runtime;
				this.platform = platform;
				this.rereadBeforeWrite = rereadBeforeWrite;
				this.publish = publish;
			}
			/**
			* Install or revoke a product catalog and invalidate drafts from its previous lifetime.
			* @param definitions - current trusted definitions, or null while the product is not ready.
			*/
			setDefinitions(definitions) {
				this.definitions = definitions;
				this.accept({ ...this.snapshot });
			}
			/** Stop accepting edits or publishing late completions. */
			dispose() {
				this.active = false;
			}
			/**
			* Read the current file; failures retain the last accepted document and disable ordinary writes.
			* @returns the accepted snapshot or diagnostic snapshot.
			*/
			readCurrent() {
				return this.serialize(() => this.read());
			}
			/**
			* Compare the draft revision, validate the complete candidate, then persist before publishing.
			* @param edit - constrained preference operation.
			* @param revision - state against which the user reviewed the edit.
			* @returns a classified outcome and the currently accepted snapshot.
			*/
			edit(edit, revision) {
				return this.serialize(async () => {
					if (this.rereadBeforeWrite) await this.read();
					const result = (status) => ({
						status,
						snapshot: this.snapshot
					});
					if (!this.active || this.definitions === null || this.snapshot.status === "loading") return result("not-ready");
					if (revision !== this.snapshot.revision) return result("stale");
					if (this.snapshot.status === "unreadable") return result("unreadable");
					if ((edit.type === "set" || edit.type === "reset") && !this.definitions.some((row) => row.id === edit.id && row.fixed === void 0)) return result("not-ready");
					const document = editShortcutDocument(this.snapshot.document, edit, this.runtime, this.platform);
					const rows = effectiveShortcuts(this.definitions, document, this.runtime, this.platform);
					const invalid = rows.find((row) => (edit.type === "reset-all" || row.id === edit.id) && (row.issue !== null || row.conflicts.length > 0));
					const displaced = edit.type === "set" ? rows.find((row) => row.conflicts.includes(edit.id)) : void 0;
					if (invalid !== void 0 || displaced !== void 0) return {
						...result("conflict"),
						...invalid?.issue ? { issue: invalid.issue } : {},
						conflicts: invalid?.conflicts.length ? invalid.conflicts : displaced === void 0 ? [] : [displaced.id]
					};
					try {
						const raw = `${JSON.stringify(document, null, 2)}\n`;
						await this.storage.write(raw);
						this.raw = raw;
						this.accept({
							...this.snapshot,
							document,
							status: "ready",
							error: null,
							usingDefaults: false
						});
						return result("saved");
					} catch (_error) {
						return result("write-failed");
					}
				});
			}
			serialize(operation) {
				const next = this.queue.then(operation);
				this.queue = next.catch(() => void 0);
				return next;
			}
			accept(snapshot) {
				this.snapshot = {
					...snapshot,
					sequence: this.snapshot.sequence + 1,
					revision: randomUUID()
				};
				if (!this.active) return;
				try {
					this.publish(this.snapshot);
				} catch (error) {
					console.error("Shortcut configuration subscriber failed:", error);
				}
			}
			async read() {
				let raw;
				try {
					raw = await this.storage.read();
				} catch (_error) {
					if (this.snapshot.error !== "read") this.accept({
						...this.snapshot,
						status: "unreadable",
						error: "read"
					});
					return this.snapshot;
				}
				if (raw === this.raw && this.snapshot.error !== "read") return this.snapshot;
				this.raw = raw;
				const document = parseShortcutDocument(raw);
				if (typeof document === "string") this.accept({
					...this.snapshot,
					status: "unreadable",
					error: document
				});
				else this.accept({
					...this.snapshot,
					document,
					status: "ready",
					error: null,
					usingDefaults: raw === null
				});
				return this.snapshot;
			}
		};
		//#endregion
		//#region lib/types/client/registry.js
		/** Command registration, normalized default bindings, and synchronous dispatch. */
		/** Application command registry; adapters own event listeners, feature plugins own actions. */
		var ShortcutRegistry = class {
			runtime;
			platform;
			commands = /* @__PURE__ */ new Map();
			fixedCommands = /* @__PURE__ */ new Map();
			conflicts = /* @__PURE__ */ new Map();
			bindings = /* @__PURE__ */ new Map();
			state;
			/** Effective localized rows derived from the accepted configuration. */
			catalog;
			/** Accepted preferences and visible read diagnostics. */
			config;
			/** Fixed local operations whose owning plugins are mounted. */
			fixedCatalog = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)([]);
			constructor(runtime, platform, config = {
				...initialShortcutConfig(),
				status: "ready"
			}) {
				this.runtime = runtime;
				this.platform = platform;
				this.state = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
					catalog: [],
					config
				});
				this.catalog = {
					getSnapshot: () => this.state.getSnapshot().catalog,
					subscribe: (listener) => this.state.subscribe(listener)
				};
				this.config = {
					getSnapshot: () => this.state.getSnapshot().config,
					subscribe: (listener) => this.state.subscribe(listener)
				};
			}
			/**
			* Return the serializable active catalog for storage validation.
			* @returns definitions without callbacks or localized labels.
			*/
			definitions() {
				return [...[...this.commands.values()].map(({ id, defaults }) => ({
					id,
					defaults
				})), ...[...this.fixedCommands.values()].map(({ id, bindings }) => ({
					id,
					defaults: {},
					fixed: bindings
				}))];
			}
			/**
			* Register a read-only input action whose keys cannot be assigned to editable commands.
			* @param command - owner-localized action and readable sequence.
			* @returns idempotent disposer removing its reference row.
			*/
			registerFixed(command) {
				if (this.fixedCommands.has(command.id) || this.commands.has(command.id)) throw new Error(`Duplicate shortcut command: ${command.id}`);
				for (const binding of command.bindings) normalizeBinding(binding, this.platform);
				this.fixedCommands.set(command.id, command);
				this.refreshLabels();
				return () => {
					if (this.fixedCommands.get(command.id) !== command) return;
					this.fixedCommands.delete(command.id);
					this.refreshLabels();
				};
			}
			refreshFixedLabels() {
				this.fixedCatalog.set([...this.fixedCommands.values()].map((command) => ({
					id: command.id,
					label: command.label(),
					keys: command.keys,
					group: command.group,
					bindings: command.bindings.map((binding) => normalizeBinding(binding, this.platform))
				})));
			}
			/**
			* Publish accepted preferences and all derived labels atomically.
			* @param config - storage owner's latest accepted snapshot.
			*/
			configure(config) {
export {};
