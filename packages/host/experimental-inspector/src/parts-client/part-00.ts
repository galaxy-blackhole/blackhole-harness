/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát 00/03 NGUYÊN VĂN của stock lib/client.js (dòng 1–885): vỏ đăng ký module + shared identity/json/validation + cordis object-registry/collector/observer/publisher + bridge runtime codec
 */
// @ts-nocheck

window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-experimental-inspector",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_cordis = require("@deepseek-ai/cordis");
		//#region lib/types/shared/identity.js
		/** Shared branded-identifier construction without assigning protocol ownership. */
		/**
		* Validate and brand a non-empty identifier received from or sent across a runtime boundary.
		* @param value - Untrusted identifier text.
		* @param label - Field name used in validation errors.
		* @returns The role-branded identifier.
		*/
		function inspectorId(value, label) {
			if (value.length === 0 || value.length > 256) throw new Error(`inspector protocol: ${label} must contain 1 to 256 characters`);
			return value;
		}
		/** Document-relative browser route for the authenticated source bootstrap. */
		const INSPECTOR_BOOTSTRAP_ROUTE = "/api/experimental-inspector/bootstrap".slice(1);
		//#endregion
		//#region lib/types/shared/json.js
		/** JSON values admitted by every Inspector cross-realm message. */
		/**
		* Test that a value can cross both MessagePort and JSON WebSocket carriers without coercion.
		* @param value - Candidate wire value.
		* @returns Whether the value is lossless JSON data.
		*/
		function isJsonValue(value) {
			return visitJson(value, /* @__PURE__ */ new Set());
		}
		/**
		* Compute the UTF-8 byte length of a JSON wire value.
		* @param value - Validated JSON value.
		* @returns Its encoded byte length.
		*/
		function jsonByteLength(value) {
			return new TextEncoder().encode(JSON.stringify(value)).byteLength;
		}
		/**
		* Test whether a value is a plain object with string own keys.
		* @param value - Candidate object.
		* @returns Whether the value has `Object.prototype` or a null prototype.
		*/
		function isPlainObject(value) {
			if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
			const prototype = Reflect.getPrototypeOf(value);
			return prototype === Object.prototype || prototype === null;
		}
		function visitJson(value, ancestors) {
			if (value === null || typeof value === "string" || typeof value === "boolean") return true;
			if (typeof value === "number") return Number.isFinite(value) && !Object.is(value, -0);
			if (typeof value !== "object" || ancestors.has(value)) return false;
			ancestors.add(value);
			try {
				if (Array.isArray(value)) {
					if (Object.getPrototypeOf(value) !== Array.prototype || Reflect.ownKeys(value).length !== value.length + 1) return false;
					return value.every((item) => visitJson(item, ancestors));
				}
				if (!isPlainObject(value)) return false;
				for (const key of Reflect.ownKeys(value)) {
					if (typeof key !== "string") return false;
					const descriptor = Object.getOwnPropertyDescriptor(value, key);
					if (descriptor?.enumerable !== true || !("value" in descriptor) || !visitJson(descriptor.value, ancestors)) return false;
				}
				return true;
			} finally {
				ancestors.delete(value);
			}
		}
		//#endregion
		//#region lib/types/shared/validation.js
		/** Shared exact-object readers for versioned Inspector wire protocols. */
		/**
		* Require a plain object containing only the listed fields.
		* @param value - Candidate object.
		* @param keys - Complete field allowlist.
		* @param label - Object name used in validation errors.
		* @returns The validated plain object.
		*/
		function exactObject(value, keys, label) {
			if (!isPlainObject(value)) throw new Error(`inspector protocol: ${label} must be an object`);
			exactKeys(value, keys, label);
			return value;
		}
		/**
		* Reject fields outside one versioned object's declared field set.
		* @param value - Plain object being validated.
		* @param keys - Complete field allowlist.
		* @param label - Object name used in validation errors.
		*/
		function exactKeys(value, keys, label) {
			const allowed = new Set(keys);
			for (const key of Reflect.ownKeys(value)) if (typeof key !== "string" || !allowed.has(key)) throw new Error(`inspector protocol: ${label} has unknown field ${JSON.stringify(String(key))}`);
		}
		/**
		* Read one non-empty opaque identifier.
		* @param value - Candidate identifier.
		* @param label - Field name used in validation errors.
		* @returns The role-branded identifier.
		*/
		function wireId(value, label) {
			if (typeof value !== "string") throw new Error(`inspector protocol: ${label} must be a string`);
			return inspectorId(value, label);
		}
		/**
		* Read one optional string field.
		* @param value - Object containing the field.
		* @param key - Field name.
		* @returns An empty object or the validated field.
		*/
		function optionalString(value, key) {
			const item = value[key];
			if (item === void 0) return {};
			if (typeof item !== "string") throw new Error(`inspector protocol: ${key} must be a string`);
			return { [key]: item };
		}
		/**
		* Read one optional boolean field.
		* @param value - Object containing the field.
		* @param key - Field name.
		* @returns An empty object or the validated field.
		*/
		function optionalBoolean(value, key) {
			const item = value[key];
			if (item === void 0) return {};
			if (typeof item !== "boolean") throw new Error(`inspector protocol: ${key} must be a boolean`);
			return { [key]: item };
		}
		/**
		* Read one optional non-negative finite number field.
		* @param value - Object containing the field.
		* @param key - Field name.
		* @returns An empty object or the validated field.
		*/
		function optionalNonNegativeNumber(value, key) {
			const item = value[key];
			if (item === void 0) return {};
			if (typeof item !== "number" || !Number.isFinite(item) || item < 0) throw new Error(`inspector protocol: ${key} must be a non-negative finite number`);
			return { [key]: item };
		}
		//#endregion
		//#region lib/types/shared/bridge/control-codec.js
		/**
		* Decode bootstrap data injected into the browser global.
		* @param value - Untrusted injected value.
		* @returns The validated Client bootstrap.
		*/
		function parseInspectorClientBootstrap(value) {
			const record = exactObject(value, [
				"endpoint",
				"protocol",
				"maxQueuedRecords",
				"maxQueuedBytes",
				"maxRecordsPerFrame",
				"maxFrameBytes",
				"reconnectBaseMs",
				"reconnectMaxMs",
				"queryTimeoutMs",
				"maxRuntimeObjectsPerSession",
				"maxRuntimePropertiesPerResult",
				"maxCordisNodes",
				"maxClientSourceBytes"
			], "Client bootstrap");
			if (typeof record.endpoint !== "string" || typeof record.protocol !== "string") throw new Error("inspector protocol: Client bootstrap endpoint and protocol must be strings");
			let endpoint;
			try {
				endpoint = new URL(record.endpoint);
			} catch {
				throw new Error("inspector protocol: Client bootstrap endpoint must be an absolute URL");
			}
			if (endpoint.protocol !== "ws:" || endpoint.hostname !== "127.0.0.1") throw new Error("inspector protocol: Client bootstrap endpoint must use ws on 127.0.0.1");
			if (record.protocol.length === 0 || record.protocol.length > 256) throw new Error("inspector protocol: Client bootstrap protocol must contain 1 to 256 characters");
			const bootstrap = {
				endpoint: record.endpoint,
				protocol: record.protocol,
				maxQueuedRecords: natural$2(record.maxQueuedRecords, "maxQueuedRecords"),
				maxQueuedBytes: natural$2(record.maxQueuedBytes, "maxQueuedBytes"),
				maxRecordsPerFrame: natural$2(record.maxRecordsPerFrame, "maxRecordsPerFrame"),
				maxFrameBytes: natural$2(record.maxFrameBytes, "maxFrameBytes"),
				reconnectBaseMs: natural$2(record.reconnectBaseMs, "reconnectBaseMs"),
				reconnectMaxMs: natural$2(record.reconnectMaxMs, "reconnectMaxMs"),
				queryTimeoutMs: natural$2(record.queryTimeoutMs, "queryTimeoutMs"),
				maxRuntimeObjectsPerSession: natural$2(record.maxRuntimeObjectsPerSession, "maxRuntimeObjectsPerSession"),
				maxRuntimePropertiesPerResult: natural$2(record.maxRuntimePropertiesPerResult, "maxRuntimePropertiesPerResult"),
				maxClientSourceBytes: natural$2(record.maxClientSourceBytes, "maxClientSourceBytes"),
				maxCordisNodes: natural$2(record.maxCordisNodes, "maxCordisNodes")
			};
			if (bootstrap.reconnectMaxMs < bootstrap.reconnectBaseMs) throw new Error("inspector protocol: reconnectMaxMs must be at least reconnectBaseMs");
			return bootstrap;
		}
		function natural$2(value, label, zero = false) {
			if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1)) throw new Error(`inspector protocol: ${label} must be ${zero ? "a non-negative" : "a positive"} safe integer`);
			return value;
		}
		//#endregion
		//#region lib/types/shared/bridge/query-reader.js
		/** Query-backed adapter for the transport-independent Cordis tree reader. */
		/**
		* Create a reader that obtains the tree through the typed Inspector query protocol.
		* @param requester - Active Host or Client query connection.
		* @returns A non-CDP Cordis tree reader.
		*/
		function createQueryCordisRuntimeTreeReader(requester) {
			return { async getTree() {
				return (await requester.request({ op: "cordis-tree/get" })).tree;
			} };
		}
		//#endregion
		//#region lib/types/shared/service.js
		/** Cordis service API shared by the Host and Client plugin faces. */
		/**
		* Create the shared service façade without exposing the carrier implementation.
		* @param connection - Realm-local observation and query transport.
		* @returns The Cordis service value.
		*/
		function createInspectorService(connection) {
			return {
				publish: (topic, payload, monotonicMs) => {
					connection.publish(topic, payload, monotonicMs);
				},
				cordis: createQueryCordisRuntimeTreeReader(connection)
			};
		}
		//#endregion
		//#region lib/types/shared/bridge/messages/cordis.js
		/** Bridge message metadata for Cordis runtime-tree snapshots. */
		/** Observation topic carrying the latest complete Cordis tree. */
		const CORDIS_TREE_TOPIC = "cordis/tree";
		//#endregion
		//#region ../../util/crypto/lib/index.js
		/**
		* UUID minting that works in every JavaScript context this repository ships
		* to. `crypto.randomUUID` is a secure-context Web API — a page or worker
		* served over plain HTTP on a LAN address has no such method — while
		* `crypto.getRandomValues` is unrestricted everywhere (browsers, workers,
		* Node ≥ 19). One implementation here replaces per-caller polyfills; the
		* `no-restricted-properties` lint rule points `crypto.randomUUID` callers at
		* this module.
		* @module @deepseek-ai/dsh-util-crypto
		*/
		/**
		* Encode bytes as canonical base64 without overflowing function argument limits.
		* @param data - Bytes to encode.
		* @returns base64 text.
		*/
		function bytesToBase64(data) {
			let binary = "";
			const chunk = 32768;
			for (let offset = 0; offset < data.length; offset += chunk) binary += String.fromCharCode(...data.subarray(offset, offset + chunk));
			return btoa(binary);
		}
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
		//#region lib/types/shared/cordis/object-registry.js
		/** Realm-local retention and identity for live objects referenced by Inspector snapshots. */
		const REGISTRIES_SYMBOL = "dsh.inspector.realm-object-registries";
		const MAX_FIBER_WRAPPER_DEPTH = 8;
		`${JSON.stringify(REGISTRIES_SYMBOL)}`;
		/** One realm's bounded table of objects retained by its latest semantic snapshot. */
		var RealmObjectRegistry = class {
			/** Realm-unique id carried by every reference from this registry. */
			id = inspectorId(randomUUID(), "registryId");
			known = /* @__PURE__ */ new WeakMap();
			retained = /* @__PURE__ */ new Map();
			nextHandle = 1;
			disposed = false;
			constructor() {
				registries().set(this.id, this);
			}
			/**
			* Start one replacement generation.
			* @returns A collector that atomically installs exactly the retained objects on commit.
			*/
			begin() {
				if (this.disposed) throw new Error("inspector: realm object registry is disposed");
				return new RealmObjectGeneration(this);
			}
			/**
			* Resolve one current opaque handle.
			* @param handle - Handle from the latest committed snapshot.
			* @returns The live object, when it remains retained.
			*/
			resolve(handle) {
				return this.retained.get(handle);
			}
			/**
			* Identify one object retained by the latest snapshot. Cordis plugin calls may return nested thenable facades;
			* only objects whose prototype path consists exclusively of those `then` wrappers resolve to the retained Fiber.
			* @param value - Candidate live value.
			* @returns Its wire reference, when present in this registry.
			*/
			identify(value) {
				if ((typeof value !== "object" || value === null) && typeof value !== "function") return void 0;
				let candidate = value;
				for (let depth = 0; candidate !== null && depth <= MAX_FIBER_WRAPPER_DEPTH; depth++) {
					const handle = this.known.get(candidate);
					if (handle !== void 0 && this.retained.get(handle) === candidate) return {
						registryId: this.id,
						handle
					};
					try {
						const keys = Reflect.ownKeys(candidate);
						if (keys.length !== 1 || keys[0] !== "then") return void 0;
						candidate = Object.getPrototypeOf(candidate);
					} catch {
						return;
					}
				}
			}
			/** Remove this registry from the realm and release all strong references. */
			close() {
				if (this.disposed) return;
				this.disposed = true;
				registries().delete(this.id);
				this.retained.clear();
			}
			/**
			* Assign a stable handle and retain a value in one pending generation.
			* @param value - Object represented by the pending snapshot.
			* @param next - Pending generation's strong-reference table.
			* @returns The registry id and stable object handle.
			*/
			retain(value, next) {
				let handle = this.known.get(value);
				if (handle === void 0) {
					handle = inspectorId(`object-${String(this.nextHandle++)}`, "objectHandle");
					this.known.set(value, handle);
				}
				next.set(handle, value);
				return {
					registryId: this.id,
					handle
				};
			}
			/**
			* Replace the current strong-reference set with one completed generation.
			* @param next - Complete object table for the committed snapshot.
			*/
			commit(next) {
				this.retained = next;
			}
		};
		/** Mutable object set assembled before one snapshot becomes visible. */
		var RealmObjectGeneration = class {
			owner;
			retained = /* @__PURE__ */ new Map();
			committed = false;
			constructor(owner) {
				this.owner = owner;
			}
			/**
			* Retain one object and obtain its stable opaque reference.
			* @param value - Context or Fiber represented in the snapshot.
			* @returns Source-local wire reference.
			*/
			retain(value) {
				if (this.committed) throw new Error("inspector: realm object generation is already committed");
				return this.owner.retain(value, this.retained);
			}
			/**
			* Stop retaining an object omitted while bounding the pending snapshot.
			* @param handle - Opaque handle removed from this pending generation.
			*/
			release(handle) {
				if (this.committed) throw new Error("inspector: realm object generation is already committed");
				this.retained.delete(handle);
			}
			/** Atomically replace the registry's retained set. */
			commit() {
				if (this.committed) return;
				this.committed = true;
				this.owner.commit(this.retained);
			}
		};
		/**
		* Identify a retained object across all Inspector collectors in this realm.
		* @param value - Runtime value returned to a debugger.
		* @returns Its source-local reference, when the value is a visible entity.
		*/
		function identifyRealmObject(value) {
			for (const registry of registries().values()) {
				const reference = registry.identify(value);
				if (reference !== void 0) return reference;
			}
		}
		function registries() {
			const key = Symbol.for(REGISTRIES_SYMBOL);
			const existing = Reflect.get(globalThis, key);
			if (existing instanceof Map) return existing;
			const value = /* @__PURE__ */ new Map();
			Reflect.set(globalThis, key, value);
			return value;
		}
		//#endregion
		//#region lib/types/shared/cordis/collector.js
		/** Shared Host/Client projection from live Cordis objects to a bounded semantic tree. */
		const SHADOW = Symbol.for("cordis.shadow");
		/** Realm-local collector retaining Contexts without Cordis service-call shadow wrappers. */
		var CordisTreeCollector = class {
			root;
			limits;
			/** Live-object table replaced atomically with each emitted snapshot. */
			objects = new RealmObjectRegistry();
			revision = 0;
			constructor(root, limits) {
				this.root = root;
				this.limits = limits;
			}
			/**
			* Capture the current reachable Context/Fiber tree.
			* @returns A detached JSON snapshot whose retained objects replace the prior generation atomically.
			*/
			snapshot() {
				const collected = collectContexts(this.root);
				const tree = collected.root;
				const objects = this.objects.begin();
				let nodeCount = 0;
				let truncated = collected.truncated;
				const contextNode = (info) => {
					if (nodeCount >= this.limits.maxNodes) {
						truncated = true;
						return;
					}
					nodeCount++;
					const node = {
						kind: "context",
						objectHandle: objects.retain(info.value).handle,
						children: []
					};
					for (const child of info.children) if (child.fiber !== void 0 && unwrapContext(child.fiber.ctx) === child.value) {
						const projected = fiberNode(child.fiber, child);
						if (projected !== void 0) node.children.push(projected);
					} else {
						const projected = contextNode(child);
						if (projected !== void 0) node.children.push(projected);
					}
					return node;
				};
				const fiberNode = (fiber, owned) => {
					if (fiber.uid === null) return void 0;
					if (nodeCount + 2 > this.limits.maxNodes) {
						truncated = true;
						return;
					}
					nodeCount++;
					const context = contextNode(owned);
					return {
						kind: "fiber",
						objectHandle: objects.retain(fiber).handle,
						uid: fiber.uid,
						children: [context]
					};
				};
				const root = contextNode(tree);
				if (root === void 0) throw new Error("inspector: maxNodes cannot retain the root Context");
				let snapshot = {
					schemaVersion: 0,
					revision: ++this.revision,
					objectRegistryId: this.objects.id,
					root,
					truncated
				};
				while (jsonByteLength(snapshot) > this.limits.maxBytes) {
					const removed = pruneLast(root);
					if (removed.length === 0) break;
					for (const handle of removed) objects.release(handle);
					snapshot = {
						...snapshot,
						truncated: true
					};
				}
				if (jsonByteLength(snapshot) > this.limits.maxBytes) throw new Error("inspector: Cordis root exceeds the source-frame byte limit");
				objects.commit();
				return snapshot;
			}
			/** Release the realm-global resolver and every retained object. */
			close() {
				this.objects.close();
			}
		};
		function collectContexts(root) {
			const contexts = /* @__PURE__ */ new Map();
			let truncated = false;
			const ensure = (candidate, depth = 0) => {
				if (depth > 100) {
					truncated = true;
					return;
				}
				const value = unwrapContext(candidate);
				if (!_deepseek_ai_cordis.Context.is(value)) return void 0;
				const existing = contexts.get(value);
				if (existing !== void 0) return existing;
				if (value === root) {
					const info = describeContext(value);
					contexts.set(value, info);
					return info;
				}
				const parent = ensure(unwrapContext(Object.getPrototypeOf(value)), depth + 1);
				if (parent === void 0) return void 0;
				const info = describeContext(value);
				contexts.set(value, info);
				parent.children.push(info);
				return info;
			};
			const rootInfo = ensure(root);
			for (const runtime of root.registry.values()) for (const fiber of runtime.fibers) {
				if (fiber.uid === null) continue;
				ensure(fiber.parent);
				ensure(fiber.ctx);
			}
			for (const key of Reflect.ownKeys(root.events._hooks)) for (const hook of root.events._hooks[key] ?? []) ensure(hook.ctx);
			const order = (info) => info.fiber?.uid ?? Number.MAX_SAFE_INTEGER;
			for (const info of contexts.values()) info.children.sort((left, right) => order(left) - order(right));
			return {
				root: rootInfo,
				truncated
			};
		}
		function describeContext(value) {
			return {
				value,
				children: [],
				fiber: ownValue(value, "fiber")
			};
		}
		function ownValue(value, key) {
			return Reflect.getOwnPropertyDescriptor(value, key)?.value;
		}
		function unwrapContext(value) {
			let current = value;
			while (typeof current === "object" && current !== null && Object.hasOwn(current, SHADOW)) current = Object.getPrototypeOf(current);
			return current;
		}
		function pruneLast(context) {
			const child = context.children.at(-1);
			if (child === void 0) return [];
			if (child.kind === "context") {
				const nested = pruneLast(child);
				if (nested.length > 0) return nested;
				context.children.pop();
				return [child.objectHandle];
			}
			const owned = child.children[0];
			const nested = pruneLast(owned);
			if (nested.length > 0) return nested;
			context.children.pop();
			return [child.objectHandle, owned.objectHandle];
		}
		//#endregion
		//#region lib/types/shared/cordis/observer.js
		/** Lifecycle-driven Cordis tree publication shared by Host and Client plugin faces. */
		/**
		* Observe one Cordis realm and publish immutable tree replacements.
		* @param ctx - Plugin context whose root is inspected and whose effects own listeners.
		* @param listener - Consumer of complete snapshots in the inspected realm.
		* @param limits - Snapshot node and encoded-byte limits.
		* @returns A disposer that unregisters listeners and releases retained objects.
		*/
		function observeCordisTree(ctx, listener, limits) {
			const collector = new CordisTreeCollector(ctx.root, limits);
			let scheduled = false;
			let closed = false;
			const publish = () => {
				scheduled = false;
				if (closed) return;
				listener(collector.snapshot());
			};
			const schedule = () => {
				if (scheduled || closed) return;
				scheduled = true;
				queueMicrotask(publish);
			};
			const disposers = [ctx.on("internal/plugin", schedule, { global: true }), ctx.on("internal/status", schedule, { global: true })];
			publish();
			return () => {
				if (closed) return;
				closed = true;
				for (const dispose of disposers) dispose();
				collector.close();
			};
		}
		//#endregion
		//#region lib/types/shared/cordis/publisher.js
		/** Shared Host/Client publication of browser-safe Cordis snapshots. */
		/**
		* Observe one Cordis runtime and retain its latest source snapshot.
		* @param ctx - Plugin context whose root is inspected.
		* @param publisher - Active Host or Client source publisher.
		* @param limits - Snapshot node and encoded-byte limits.
		* @returns A disposer that stops observation and releases retained objects.
		*/
		function publishCordisTree(ctx, publisher, limits) {
			return observeCordisTree(ctx, (snapshot) => {
				publisher.setState(CORDIS_TREE_TOPIC, snapshot);
			}, limits);
		}
		//#endregion
		//#region lib/types/shared/bridge/messages/runtime/console-frames.js
		/**
		* Parse a Worker-to-Client Console lifecycle frame.
		* @param value - Untrusted decoded frame.
		* @returns A validated enable or disable frame.
		*/
		function parseClientConsoleControlFrame(value) {
			exactKeys(value, [
				"v",
				"t",
				"sourceId",
				"generation",
				"sessionId"
			], "Client Console control frame");
			if (value.v !== 0 || value.t !== "client-console/enable" && value.t !== "client-console/disable") throw new Error("inspector protocol: invalid Client Console control frame");
			return {
				v: 0,
				t: value.t,
				sourceId: wireId(value.sourceId, "sourceId"),
				generation: wireId(value.generation, "generation"),
				sessionId: wireId(value.sessionId, "sessionId")
			};
		}
		//#endregion
		//#region lib/types/shared/bridge/messages/runtime/command-codec.js
		/** Exact wire decoder for Client Runtime commands. */
		/**
		* Parse and rebuild one Runtime command before it enters the Client realm.
		* @param value - Untrusted command value.
		* @returns The validated command union member.
		*/
		function parseClientRuntimeCommand(value) {
			if (!isPlainObject(value) || typeof value.op !== "string") throw new Error("inspector protocol: Client Runtime command must have an op");
			switch (value.op) {
				case "evaluate":
					exactKeys(value, [
						"op",
						"expression",
						"objectGroup",
						"includeCommandLineAPI",
						"silent",
						"returnByValue",
						"generatePreview",
						"userGesture",
						"awaitPromise",
						"disableBreaks",
						"replMode",
						"allowUnsafeEvalBlockedByCSP",
						"timeoutMs"
					], "evaluate command");
					if (typeof value.expression !== "string") throw new Error("inspector protocol: evaluate expression must be a string");
					return {
						op: "evaluate",
						expression: value.expression,
						...optionalString(value, "objectGroup"),
						...optionalBoolean(value, "includeCommandLineAPI"),
						...optionalBoolean(value, "silent"),
						...optionalBoolean(value, "returnByValue"),
						...optionalBoolean(value, "generatePreview"),
						...optionalBoolean(value, "userGesture"),
						...optionalBoolean(value, "awaitPromise"),
						...optionalBoolean(value, "disableBreaks"),
						...optionalBoolean(value, "replMode"),
						...optionalBoolean(value, "allowUnsafeEvalBlockedByCSP"),
						...optionalNonNegativeNumber(value, "timeoutMs")
					};
				case "get-properties":
					exactKeys(value, [
						"op",
						"handle",
						"ownProperties",
						"accessorPropertiesOnly",
						"generatePreview",
						"nonIndexedPropertiesOnly"
					], "get-properties command");
					return {
						op: "get-properties",
						handle: wireId(value.handle, "handle"),
						...optionalBoolean(value, "ownProperties"),
						...optionalBoolean(value, "accessorPropertiesOnly"),
						...optionalBoolean(value, "generatePreview"),
						...optionalBoolean(value, "nonIndexedPropertiesOnly")
					};
				case "call-function": return parseCallFunction(value);
				case "await-promise":
					exactKeys(value, [
						"op",
						"promise",
						"returnByValue",
						"generatePreview"
					], "await-promise command");
					return {
						op: "await-promise",
						promise: wireId(value.promise, "promise"),
						...optionalBoolean(value, "returnByValue"),
						...optionalBoolean(value, "generatePreview")
					};
				case "release-object":
					exactKeys(value, ["op", "handle"], "release-object command");
					return {
						op: "release-object",
						handle: wireId(value.handle, "handle")
					};
				case "release-object-group":
					exactKeys(value, ["op", "objectGroup"], "release-object-group command");
					if (typeof value.objectGroup !== "string") throw new Error("inspector protocol: objectGroup must be a string");
					return {
						op: "release-object-group",
						objectGroup: value.objectGroup
					};
				case "global-lexical-scope-names":
					exactKeys(value, ["op"], "global-lexical-scope-names command");
					return { op: "global-lexical-scope-names" };
				default: throw new Error(`inspector protocol: unknown Client Runtime command ${JSON.stringify(value.op)}`);
			}
		}
		function parseCallFunction(value) {
			exactKeys(value, [
				"op",
				"functionDeclaration",
				"receiver",
				"arguments",
				"objectGroup",
				"silent",
				"returnByValue",
				"generatePreview",
				"userGesture",
				"awaitPromise"
			], "call-function command");
			if (typeof value.functionDeclaration !== "string") throw new Error("inspector protocol: functionDeclaration must be a string");
			let args;
			if (value.arguments !== void 0) {
				if (!Array.isArray(value.arguments)) throw new Error("inspector protocol: call arguments must be an array");
				args = value.arguments.map(parseCallArgument);
			}
			return {
				op: "call-function",
				functionDeclaration: value.functionDeclaration,
				...value.receiver === void 0 ? {} : { receiver: wireId(value.receiver, "receiver") },
				...args === void 0 ? {} : { arguments: args },
				...optionalString(value, "objectGroup"),
				...optionalBoolean(value, "silent"),
				...optionalBoolean(value, "returnByValue"),
				...optionalBoolean(value, "generatePreview"),
				...optionalBoolean(value, "userGesture"),
				...optionalBoolean(value, "awaitPromise")
			};
		}
		function parseCallArgument(value) {
			if (!isPlainObject(value) || typeof value.kind !== "string") throw new Error("inspector protocol: invalid Client Runtime call argument");
			switch (value.kind) {
				case "value":
					exactKeys(value, ["kind", "value"], "value call argument");
					if (!isJsonValue(value.value)) throw new Error("inspector protocol: call argument value must be JSON");
					return {
						kind: "value",
						value: value.value
					};
				case "unserializable":
					exactKeys(value, ["kind", "value"], "unserializable call argument");
					if (typeof value.value !== "string") throw new Error("inspector protocol: unserializable argument must be a string");
					return {
						kind: "unserializable",
						value: value.value
					};
				case "object":
					exactKeys(value, ["kind", "handle"], "object call argument");
					return {
						kind: "object",
						handle: wireId(value.handle, "handle")
					};
				case "undefined":
					exactKeys(value, ["kind"], "undefined call argument");
					return { kind: "undefined" };
				default: throw new Error(`inspector protocol: unknown call argument ${JSON.stringify(value.kind)}`);
			}
		}
		//#endregion
		//#region lib/types/shared/bridge/messages/runtime/frames.js
		/**
		* Parse and rebuild one Worker-to-Client Runtime request.
		* @param value - Untrusted request frame.
		* @returns The validated request frame.
		*/
		function parseClientRuntimeRequestFrame(value) {
			exactKeys(value, [
				"v",
				"t",
				"sourceId",
				"generation",
				"sessionId",
				"requestId",
				"command"
			], "Client Runtime request");
			if (value.v !== 0 || value.t !== "client-runtime/request") throw new Error("inspector protocol: invalid Client Runtime request envelope");
			return {
				v: 0,
				t: "client-runtime/request",
				sourceId: wireId(value.sourceId, "sourceId"),
				generation: wireId(value.generation, "generation"),
				sessionId: wireId(value.sessionId, "sessionId"),
				requestId: wireId(value.requestId, "requestId"),
				command: parseClientRuntimeCommand(value.command)
			};
		}
		/**
		* Parse and rebuild one Worker-to-Client Runtime cancellation.
		* @param value - Untrusted cancellation frame.
		* @returns The validated cancellation frame.
		*/
		function parseClientRuntimeCancelFrame(value) {
			exactKeys(value, [
				"v",
				"t",
				"sourceId",
				"generation",
				"sessionId",
				"requestId"
			], "Client Runtime cancellation");
			if (value.v !== 0 || value.t !== "client-runtime/cancel") throw new Error("inspector protocol: invalid Client Runtime cancellation envelope");
			return {
				v: 0,
				t: "client-runtime/cancel",
				sourceId: wireId(value.sourceId, "sourceId"),
				generation: wireId(value.generation, "generation"),
				sessionId: wireId(value.sessionId, "sessionId"),
				requestId: wireId(value.requestId, "requestId")
			};
		}
		/**
		* Parse and rebuild one Worker acknowledgement for a Client Runtime response.
		* @param value - Untrusted acknowledgement frame.
		* @returns The validated acknowledgement frame.
		*/
		function parseClientRuntimeResponseAcknowledgedFrame(value) {
			exactKeys(value, [
				"v",
				"t",
				"sourceId",
				"generation",
				"sessionId",
				"requestId"
			], "Client Runtime response acknowledgement");
			if (value.v !== 0 || value.t !== "client-runtime/response-acknowledged") throw new Error("inspector protocol: invalid Client Runtime response acknowledgement envelope");
			return {
				v: 0,
				t: "client-runtime/response-acknowledged",
				sourceId: wireId(value.sourceId, "sourceId"),
				generation: wireId(value.generation, "generation"),
				sessionId: wireId(value.sessionId, "sessionId"),
				requestId: wireId(value.requestId, "requestId")
			};
		}
		/**
		* Parse and rebuild one Runtime-session cleanup notification.
		* @param value - Untrusted cleanup frame.
		* @returns The validated cleanup frame.
		*/
		function parseClientRuntimeSessionClosedFrame(value) {
			exactKeys(value, [
				"v",
				"t",
				"sourceId",
				"generation",
				"sessionId"
			], "Client Runtime session close");
			if (value.v !== 0 || value.t !== "client-runtime/session-closed") throw new Error("inspector protocol: invalid Client Runtime session close envelope");
			return {
				v: 0,
				t: "client-runtime/session-closed",
				sourceId: wireId(value.sourceId, "sourceId"),
				generation: wireId(value.generation, "generation"),
				sessionId: wireId(value.sessionId, "sessionId")
			};
		}
		//#endregion

export {};
