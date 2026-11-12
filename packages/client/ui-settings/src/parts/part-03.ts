/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			for (const inner of list) {
				const value = Schema.resolve(data, inner, options, true)[0];
				if (isNullable(value)) continue;
				if (isNullable(result)) result = value;
				else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
				else if (typeof value === "object") merge(result ??= {}, value);
				else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
			}
			if (!strict && isPlainObject(data)) merge(result, data);
			return [result];
		});
		Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
			const [result, adapted = data] = Schema.resolve(data, inner, options, true);
			if (preserve) return [callback(result)];
			else return [callback(result), callback(adapted)];
		});
		const formatters = {};
		function defineMethod(name, keys, format) {
			formatters[name] = format;
			Object.assign(Schema, { [name](...args) {
				const schema = new Schema({ type: name });
				keys.forEach((key, index) => {
					switch (key) {
						case "sKey":
							schema.sKey = args[index] ?? Schema.string();
							break;
						case "inner":
							schema.inner = Schema.from(args[index]);
							break;
						case "list":
							schema.list = args[index].map(Schema.from);
							break;
						case "dict":
							schema.dict = mapValues(args[index], Schema.from);
							break;
						case "bits":
							schema.bits = {};
							for (const key in args[index]) {
								if (typeof args[index][key] !== "number") continue;
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
		//#region lib/types/client/schema.js
		/** Synchronous schema introspection and immutable settings-draft edits. */
		function cloneContainer(container, key) {
			if (Array.isArray(container)) return [...container];
			if (typeof container === "object" && container !== null) return { ...container };
			return /^\d+$/.test(key) ? [] : {};
		}
		function cloneSpine(root, path) {
			const result = { ...root };
			let target = result;
			for (let index = 0; index < path.length - 1; index++) {
				const key = path[index];
				const child = cloneContainer(Array.isArray(target) ? target[Number(key)] : target[key], path[index + 1]);
				if (Array.isArray(target)) target[Number(key)] = child;
				else target[key] = child;
				target = child;
			}
			return {
				result,
				parent: target,
				leaf: path[path.length - 1]
			};
		}
		/**
		* Settings-owned synchronous schema service. Dynamic client plugins receive
		* this Cordis entity instead of importing executable helpers from one another.
		*/
		var SettingsSchemaService = class extends _deepseek_ai_cordis.Service {
			/** @param ctx - providing ui-settings context. */
			constructor(ctx) {
				super(ctx, "settingsSchema");
			}
			/**
			* Rehydrate one serialized `schema.toJSON()` envelope.
			* @param serialized - serialized Schemastery node.
			* @returns live schema node.
			*/
			rehydrate(serialized) {
				return new Schema(serialized);
			}
			/**
			* Validate a settings draft.
			* @param schema - live schema node.
			* @param draft - candidate settings value.
			* @returns validation failure text, or `undefined` when valid.
			*/
			validate(schema, draft) {
				try {
					schema(draft);
					return;
				} catch (error) {
					return error instanceof Error ? error.message : String(error);
				}
			}
			/**
			* Resolve an object, dict, or array schema node at a settings path.
			* @param root - schema node to traverse.
			* @param path - object keys or array indexes.
			* @returns the resolved node, or `undefined` when the path is absent.
			*/
			nodeAtPath(root, path) {
				let node = root;
				for (const key of path) {
					if (node === void 0) return void 0;
					if (node.type === "object") node = node.dict?.[key];
					else if (node.type === "dict" || node.type === "array") node = node.inner;
					else return void 0;
				}
				return node;
			}
			/**
			* Read a nested value by a string-key or array-index path.
			* @param value - value to traverse.
			* @param path - object keys or array indexes.
			* @returns the resolved value, or `undefined` when the path is absent.
			*/
			getPath(value, path) {
				let current = value;
				for (const key of path) {
					if (Array.isArray(current)) {
						current = current[Number(key)];
						continue;
					}
					if (typeof current !== "object" || current === null) return void 0;
					current = current[key];
				}
				return current;
			}
			/**
			* Report whether the final path key exists independently of its value.
			* @param value - value to traverse.
			* @param path - object keys or array indexes.
			* @returns whether the path exists.
			*/
			hasPath(value, path) {
				if (path.length === 0) return value !== void 0;
				const parent = this.getPath(value, path.slice(0, -1));
				const key = path[path.length - 1];
				if (Array.isArray(parent)) return Number(key) < parent.length;
				if (typeof parent !== "object" || parent === null) return false;
				return key in parent;
			}
			/**
			* Immutably set a nested value, materializing missing containers.
			* @param root - settings object to copy.
			* @param path - non-empty object-key or array-index path.
			* @param value - replacement value.
			* @returns copied root containing the replacement.
			* @throws when `path` is empty.
			*/
			setPath(root, path, value) {
				if (path.length === 0) throw new Error("ui-settings: setPath needs a non-empty path");
				const { result, parent, leaf } = cloneSpine(root, path);
				if (Array.isArray(parent)) parent[Number(leaf)] = value;
				else parent[leaf] = value;
				return result;
			}
			/**
			* Immutably remove a nested key, preserving an unchanged missing root.
			* @param root - settings object to copy.
			* @param path - non-empty object-key or array-index path.
			* @returns copied root without the key, or `root` when the path is absent.
			* @throws when `path` is empty.
			*/
			deletePath(root, path) {
				if (path.length === 0) throw new Error("ui-settings: deletePath needs a non-empty path");
				if (!this.hasPath(root, path)) return root;
				const { result, parent, leaf } = cloneSpine(root, path);
				if (Array.isArray(parent)) parent.splice(Number(leaf), 1);
				else Reflect.deleteProperty(parent, leaf);
				return result;
			}
		};
		//#endregion
		//#region lib/types/client/developer-tools.js
		/** Shared preference; Host-backed features stay disabled until an accepted value arrives. */
		var DeveloperToolsPreference = class {
			scope;
			/** Accepted enablement, observable through renderer-bound hooks. */
			enabled;
			/**
			* @param scope - settings-owned namespace controller.
			*/
			constructor(scope) {
				this.scope = scope;
				this.enabled = {
					getSnapshot: () => scope.getSnapshot().value?.enabled ?? false,
					subscribe: (listener) => {
						let previous = this.enabled.getSnapshot();
						return scope.subscribe(() => {
							const next = this.enabled.getSnapshot();
							if (next === previous) return;
							previous = next;
							listener();
						});
					}
				};
			}
			/**
			* Persist the choice on the Host with ordered writes.
			* @param enabled - requested developer-tool mode.
			* @returns settlement after Host acceptance; rejects after a refused write recovers.
			*/
			async setEnabled(enabled) {
				if (!await this.scope.set("enabled", enabled)) throw new Error("Developer tools preference was not saved");
			}
		};
		//#endregion
		//#region lib/types/developer-tools-settings.js
		/** Shared Web and desktop developer-tool preference stored by the Host. */
		/** Namespace for developer UI and HTML preview capabilities. */
		const DEVELOPER_TOOLS_NAMESPACE = "ui-settings";
		/** New installations and missing values enable the full interface. */
		const DeveloperToolsSettingsFields = { enabled: Schema.boolean().default(true) };
		Schema.object(DeveloperToolsSettingsFields);
		//#endregion
		//#region lib/types/client/config-form.js
		/** Shared entry values and ordered writes over the Host configuration mirror. */
		/**
		* One namespace's derived view over the shared describe mirror, plus that
		* namespace's serialized Host writes. Writes carry the latest known namespace
		* revision, fold their answers back into the mirror, and teardown waits for
		* the operation already crossing the wire.
		*/
		var ConfigFormController = class {
			ctx;
			spec;
			mirror;
			schema;
			store;
			tail = Promise.resolve();
			writeGeneration = 0;
			disposed = false;
			unsubscribe;
			/**
			* Revision answered by a superseded write still ahead of the mirror: the
			* mirror only folds the LATEST settlement in, so a queued successor takes
			* its fence from here first.
			*/
			pendingRevision;
			/**
			* @param ctx - the providing plugin's context, whose `remote.settings`
			* namespace carries this form's writes (reads ride the mirror).
			* @param spec - namespace identity and optional narrowing decoder.
			* @param mirror - the shared describe mirror this form derives from.
			* @param schema - settings-owned schema operations.
			*/
			constructor(ctx, spec, mirror, schema) {
				this.ctx = ctx;
				this.spec = spec;
				this.mirror = mirror;
				this.schema = schema;
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
					status: "loading",
					value: void 0,
					base: void 0,
					user: void 0,
					revision: void 0,
					writable: false
				});
				this.unsubscribe = mirror.subscribe(() => {
					this.derive();
				});
				this.derive();
			}
			/** @returns the current sync snapshot (stable reference until the next change). */
			getSnapshot() {
				return this.store.getSnapshot();
			}
			/**
			* Observe snapshot replacements.
			* @param listener - invoked after each snapshot change.
			* @returns the disposer removing this listener.
			*/
			subscribe(listener) {
				return this.store.subscribe(listener);
			}
			/**
			* Queue one field write; see {@link ConfigForm.set} for the ordering,
			* revision, and recovery contract.
			* @param field - scalar field inside the namespace section.
			* @param value - JSON-shaped value selected by the user.
			* @returns whether the Host accepted the write, after any recovery read.
			*/
			set(field, value) {
				return this.mutate([{
					op: "set",
					path: [field],
					value
				}]);
			}
			/**
			* Queue one field clear; see {@link ConfigForm.unset} for the ordering,
			* revision, and recovery contract.
			* @param field - scalar field inside the namespace section.
			* @returns whether the Host accepted the clear, after any recovery read.
			*/
			unset(field) {
				return this.mutate([{
					op: "unset",
					path: [field]
				}]);
			}
			/**
			* Queue one atomic namespace mutation; see {@link ConfigForm.mutate}.
			* @param ops - ordered field operations copied when queued.
			* @param expectedRevision - optional fixed revision read by the domain editor.
			* @returns whether the Host accepted the mutation, after any recovery read.
			*/
			mutate(ops, expectedRevision) {
				const ownedOps = structuredClone(ops);
				const generation = ++this.writeGeneration;
				return this.enqueue(async () => {
					const revision = expectedRevision ?? this.pendingRevision ?? this.getSnapshot().revision;
					const response = await this.ctx.remote.settings.mutate(this.spec.namespace, ownedOps, revision);
					if (!response.ok) {
						await this.recover(generation);
						return false;
					}
					if (this.disposed) return true;
					if (generation === this.writeGeneration) {
						this.pendingRevision = void 0;
						this.mirror.acceptView(response.value);
					} else this.pendingRevision = response.value.revision;
					return true;
				});
			}
			/** Reload Host state for the latest failed write; superseded failures leave recovery to it. */
			async recover(generation) {
				if (this.disposed || generation !== this.writeGeneration) return;
				this.pendingRevision = void 0;
				await this.mirror.load();
			}
			/**
			* Stop queued operations, stop deriving, and wait for the current wire call
			* to settle.
			* @returns settlement after the controller reaches quiescence.
			*/
			async dispose() {
				this.disposed = true;
				this.writeGeneration += 1;
				this.unsubscribe();
				await this.tail;
			}
			enqueue(operation) {
export {};
