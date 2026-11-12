/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát 01/03 NGUYÊN VĂN của stock lib/client.js (dòng 886–1752): bridge sources/observation/publisher + client CDP stack/console/errors/objects/properties
 */
// @ts-nocheck

		//#region lib/types/shared/bridge/messages/sources/codec.js
		/** Exact decoders for Client source catalog operations and values. */
		/**
		* Parse one Worker-to-Client source command.
		* @param value - Untrusted decoded command.
		* @returns The validated command.
		*/
		function parseClientSourceCommand(value) {
			if (!isPlainObject(value) || typeof value.op !== "string") throw new Error("inspector protocol: Client source command must have an op");
			if (value.op === "list-scripts") {
				exactKeys(value, ["op"], "Client source list command");
				return { op: "list-scripts" };
			}
			if (value.op !== "get-content-chunk") throw new Error(`inspector protocol: unknown Client source command ${JSON.stringify(value.op)}`);
			exactKeys(value, [
				"op",
				"scriptKey",
				"content",
				"offset",
				"maxBytes"
			], "Client source chunk command");
			return {
				op: "get-content-chunk",
				scriptKey: wireId(value.scriptKey, "scriptKey"),
				content: contentKind(value.content),
				offset: natural$1(value.offset, "offset", true),
				maxBytes: natural$1(value.maxBytes, "maxBytes", false)
			};
		}
		function contentKind(value) {
			if (value !== "source" && value !== "source-map") throw new Error("inspector protocol: invalid Client source content kind");
			return value;
		}
		function natural$1(value, label, zero) {
			if (!Number.isSafeInteger(value) || value < (zero ? 0 : 1)) throw new Error(`inspector protocol: ${label} must be ${zero ? "a non-negative" : "a positive"} integer`);
			return value;
		}
		//#endregion
		//#region lib/types/shared/bridge/messages/sources/frames.js
		/**
		* Parse one Worker-to-Client source request.
		* @param value - Untrusted decoded request.
		* @returns The validated request frame.
		*/
		function parseClientSourceRequestFrame(value) {
			exactKeys(value, [
				"v",
				"t",
				"sourceId",
				"generation",
				"sessionId",
				"requestId",
				"command"
			], "Client source request");
			if (value.v !== 0 || value.t !== "client-sources/request") throw new Error("inspector protocol: invalid Client source request envelope");
			return {
				v: 0,
				t: "client-sources/request",
				sourceId: wireId(value.sourceId, "sourceId"),
				generation: wireId(value.generation, "generation"),
				sessionId: wireId(value.sessionId, "sessionId"),
				requestId: wireId(value.requestId, "requestId"),
				command: parseClientSourceCommand(value.command)
			};
		}
		/**
		* Parse one Client source-session cleanup notification.
		* @param value - Untrusted decoded notification.
		* @returns The validated cleanup frame.
		*/
		function parseClientSourceSessionClosedFrame(value) {
			exactKeys(value, [
				"v",
				"t",
				"sourceId",
				"generation",
				"sessionId"
			], "Client source session close");
			if (value.v !== 0 || value.t !== "client-sources/session-closed") throw new Error("inspector protocol: invalid Client source session close envelope");
			return {
				v: 0,
				t: "client-sources/session-closed",
				sourceId: wireId(value.sourceId, "sourceId"),
				generation: wireId(value.generation, "generation"),
				sessionId: wireId(value.sessionId, "sessionId")
			};
		}
		//#endregion
		//#region lib/types/shared/bridge/messages/observation.js
		/** Versioned source lifecycle, observation, and extension frames shared by both carriers. */
		/**
		* Parse and rebuild one Worker control frame received by a source.
		* @param value - Untrusted decoded wire value.
		* @returns The validated Worker-to-source frame.
		*/
		function parseWorkerSourceFrame(value) {
			if (!isJsonValue(value) || !isPlainObject(value) || value.v !== 0 || typeof value.t !== "string") throw new Error("inspector protocol: invalid Worker source frame");
			if (value.t === "source/rejected") {
				exactKeys(value, [
					"v",
					"t",
					"code",
					"message"
				], "source/rejected frame");
				if (value.code !== "invalid-frame" && value.code !== "version-mismatch" && value.code !== "unauthorized" || typeof value.message !== "string") throw new Error("inspector protocol: invalid source/rejected frame");
				return {
					v: 0,
					t: "source/rejected",
					code: value.code,
					message: value.message
				};
			}
			if (value.t === "client-runtime/request") return parseClientRuntimeRequestFrame(value);
			if (value.t === "client-runtime/cancel") return parseClientRuntimeCancelFrame(value);
			if (value.t === "client-runtime/response-acknowledged") return parseClientRuntimeResponseAcknowledgedFrame(value);
			if (value.t === "client-runtime/session-closed") return parseClientRuntimeSessionClosedFrame(value);
			if (value.t === "client-sources/request") return parseClientSourceRequestFrame(value);
			if (value.t === "client-sources/session-closed") return parseClientSourceSessionClosedFrame(value);
			if (value.t === "client-console/enable" || value.t === "client-console/disable") return parseClientConsoleControlFrame(value);
			const common = {
				v: 0,
				sourceId: sourceId(value.sourceId),
				generation: generation(value.generation)
			};
			if (value.t === "source/accepted") {
				exactKeys(value, [
					"v",
					"t",
					"sourceId",
					"generation"
				], "source/accepted frame");
				return {
					...common,
					t: "source/accepted"
				};
			}
			if (value.t === "source/append-acknowledged") {
				exactKeys(value, [
					"v",
					"t",
					"sourceId",
					"generation",
					"nextSequence"
				], "source append acknowledgement");
				return {
					...common,
					t: "source/append-acknowledged",
					nextSequence: natural(value.nextSequence, "nextSequence")
				};
			}
			if (value.t === "source/resnapshot" && typeof value.reason === "string") {
				exactKeys(value, [
					"v",
					"t",
					"sourceId",
					"generation",
					"expectedSequence",
					"reason"
				], "source/resnapshot frame");
				return {
					...common,
					t: "source/resnapshot",
					expectedSequence: natural(value.expectedSequence, "expectedSequence"),
					reason: value.reason
				};
			}
			throw new Error(`inspector protocol: unknown Worker source frame ${JSON.stringify(value.t)}`);
		}
		function sourceId(value) {
			if (typeof value !== "string") throw new Error("inspector protocol: sourceId must be a string");
			return inspectorId(value, "sourceId");
		}
		function generation(value) {
			if (typeof value !== "string") throw new Error("inspector protocol: generation must be a string");
			return inspectorId(value, "generation");
		}
		function natural(value, label) {
			if (!Number.isSafeInteger(value) || value < 0) throw new Error(`inspector protocol: ${label} must be a non-negative safe integer`);
			return value;
		}
		//#endregion
		//#region lib/types/shared/bridge/publisher.js
		/** Source-side interfaces shared by MessagePort and WebSocket bridge implementations. */
		/** Shared observation and query delegation inherited by both source transports. */
		var InspectorSourceConnection = class {
			/** Publish one JSON observation without waiting on its carrier. */
			publish(topic, payload, monotonicMs = performance.now()) {
				this.publisher.publish(topic, payload, monotonicMs);
			}
			/** Retain and publish one state value for reconnect or replacement recovery. */
			setState(topic, payload, monotonicMs = performance.now()) {
				this.publisher.setState(topic, payload, monotonicMs);
			}
			/** Execute one non-CDP query through the active source generation. */
			request(query) {
				return this.queries.request(query);
			}
		};
		//#endregion
		//#region lib/types/client/cdp/stack.js
		/** Browser stack parsing for realm-neutral Runtime and Console events. */
		/**
		* Capture the caller stack of a wrapped Client Console method.
		* @param resolveScript - Resolver for Client catalog script keys.
		* @returns Parsed call frames when the browser supplies a stack.
		*/
		function captureClientConsoleStack(resolveScript) {
			return parseClientStack((/* @__PURE__ */ new Error()).stack, resolveScript, 3);
		}
		/**
		* Parse the stack attached to an uncaught Client value when available.
		* @param value - Thrown or rejected value.
		* @param resolveScript - Resolver for Client catalog script keys.
		* @returns Parsed call frames when the value has a recognized stack string.
		*/
		function clientErrorStack(value, resolveScript = () => void 0) {
			if (typeof value !== "object" || value === null) return void 0;
			let stack;
			try {
				stack = Reflect.get(value, "stack");
			} catch {
				return;
			}
			return typeof stack === "string" ? parseClientStack(stack, resolveScript, 0) : void 0;
		}
		/**
		* Parse V8- and Firefox-style textual frames into the common stack model.
		* @param stack - Browser stack text.
		* @param resolveScript - Resolver for Client catalog script keys.
		* @param skipFrames - Parsed observer frames omitted from the result.
		* @returns Parsed call frames, or `undefined` when none remain.
		*/
		function parseClientStack(stack, resolveScript, skipFrames) {
			if (stack === void 0) return void 0;
			const frames = [];
			for (const line of stack.split("\n")) {
				const frame = parseFrame(line, resolveScript);
				if (frame !== void 0) frames.push(frame);
			}
			const callFrames = frames.slice(skipFrames);
			return callFrames.length === 0 ? void 0 : { callFrames };
		}
		function parseFrame(line, resolveScript) {
			const chrome = /^\s*at\s+(?:(.*?)\s+\()?(.+):(\d+):(\d+)\)?$/u.exec(line);
			const firefox = chrome === null ? /^(.*?)@(.+):(\d+):(\d+)$/u.exec(line) : null;
			const match = chrome ?? firefox;
			if (match === null) return void 0;
			const url = match[2];
			const lineNumber = Number(match[3]) - 1;
			const columnNumber = Number(match[4]) - 1;
			if (url === void 0 || !Number.isSafeInteger(lineNumber) || !Number.isSafeInteger(columnNumber)) return void 0;
			const scriptKey = resolveScript(url);
			return {
				functionName: match[1] ?? "",
				...scriptKey === void 0 ? {} : { scriptKey },
				url,
				lineNumber,
				columnNumber
			};
		}
		//#endregion
		//#region lib/types/client/cdp/console.js
		/** Client Console observation shared by every active DevTools Runtime session. */
		/**
		* Describe browser-side Console observation.
		* @returns The Console capability advertised by a browser Client source.
		*/
		function consoleBridgeCapability() {
			return { type: "client-console" };
		}
		const METHODS = [
			["log", "log"],
			["debug", "debug"],
			["info", "info"],
			["error", "error"],
			["warn", "warning"],
			["dir", "dir"],
			["dirxml", "dirxml"],
			["table", "table"],
			["trace", "trace"],
			["clear", "clear"],
			["group", "startGroup"],
			["groupCollapsed", "startGroupCollapsed"],
			["groupEnd", "endGroup"],
			["assert", "assert"],
			["profile", "profile"],
			["profileEnd", "profileEnd"],
			["count", "count"],
			["timeEnd", "timeEnd"]
		];
		/** Installs one transparent console/error observer and fans out session-local values. */
		var ClientConsoleObserver = class {
			runtime;
			sink;
			resolveScript;
			sessions = /* @__PURE__ */ new Set();
			installed = [];
			active = false;
			closed = false;
			constructor(runtime, sink, resolveScript = () => void 0) {
				this.runtime = runtime;
				this.sink = sink;
				this.resolveScript = resolveScript;
			}
			/**
			* Start producing events for one DevTools Runtime session.
			* @param sessionId - Session whose object table retains event arguments.
			*/
			enable(sessionId) {
				if (this.closed) return;
				this.sessions.add(sessionId);
				if (!this.active) this.install();
			}
			/**
			* Stop producing events and release Console objects for one session.
			* @param sessionId - Session being disabled or closed.
			*/
			disable(sessionId) {
				this.sessions.delete(sessionId);
				this.runtime.releaseObjectGroup(sessionId, "console");
				if (this.sessions.size === 0) this.uninstall();
			}
			/** Restore original browser hooks and clear every active session. */
			close() {
				if (this.closed) return;
				this.closed = true;
				this.reset();
			}
			/** Stop observing the current source generation while allowing a later reconnect. */
			reset() {
				this.sessions.clear();
				this.uninstall();
			}
			install() {
				this.active = true;
				for (const [name, type] of METHODS) {
					const candidate = Reflect.get(console, name);
					if (typeof candidate !== "function") continue;
					const original = candidate;
					const capture = (values) => {
						this.captureConsole(type, values);
					};
					const replacement = function(...args) {
						const result = Reflect.apply(original, this, args);
						const values = name === "assert" ? args.slice(1) : args;
						if (name !== "assert" || !args[0]) capture(values);
						return result;
					};
					if (Reflect.set(console, name, replacement)) this.installed.push({
						name,
						original,
						replacement
					});
				}
				addGlobalListener("error", this.onError);
				addGlobalListener("unhandledrejection", this.onUnhandledRejection);
			}
			uninstall() {
				if (!this.active) return;
				this.active = false;
				removeGlobalListener("error", this.onError);
				removeGlobalListener("unhandledrejection", this.onUnhandledRejection);
				for (const method of this.installed.splice(0).reverse()) if (Reflect.get(console, method.name) === method.replacement) Reflect.set(console, method.name, method.original);
			}
			onError = (event) => {
				const error = Reflect.get(event, "error");
				const message = Reflect.get(event, "message");
				this.captureException(error ?? new Error(typeof message === "string" ? message : "Client error"));
			};
			onUnhandledRejection = (event) => {
				this.captureException(Reflect.get(event, "reason"));
			};
			captureConsole(type, values) {
				const timestamp = Date.now();
				const stackTrace = captureClientConsoleStack(this.resolveScript);
				queueMicrotask(() => {
					for (const sessionId of [...this.sessions]) try {
						const event = this.runtime.consoleEvent(sessionId, type, values, timestamp, stackTrace);
						if (event !== void 0) this.sink(sessionId, event);
					} catch {}
				});
			}
			captureException(error) {
				const timestamp = Date.now();
				const stackTrace = clientErrorStack(error, this.resolveScript);
				queueMicrotask(() => {
					for (const sessionId of [...this.sessions]) try {
						const event = this.runtime.exceptionEvent(sessionId, error, timestamp, stackTrace);
						if (event !== void 0) this.sink(sessionId, event);
					} catch {}
				});
			}
		};
		function addGlobalListener(type, listener) {
			const add = Reflect.get(globalThis, "addEventListener");
			if (typeof add === "function") Reflect.apply(add, globalThis, [type, listener]);
		}
		function removeGlobalListener(type, listener) {
			const remove = Reflect.get(globalThis, "removeEventListener");
			if (typeof remove === "function") Reflect.apply(remove, globalThis, [type, listener]);
		}
		//#endregion
		//#region lib/types/client/cdp/errors.js
		/** Client Runtime failures that belong to the transport rather than evaluated JavaScript. */
		/** Failure returned through the typed Client Runtime error outcome. */
		var ClientRuntimeExecutionError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
			}
		};
		//#endregion
		//#region lib/types/client/cdp/objects.js
		/** Client-local object handles and CDP-compatible RemoteObject serialization. */
		const MAX_CLASS_PROTOTYPE_DEPTH = 32;
		/** Per-DevTools-session owner of all live Client object references. */
		var ClientObjectStore = class {
			maxObjects;
			objects = /* @__PURE__ */ new Map();
			groups = /* @__PURE__ */ new Map();
			allocations = /* @__PURE__ */ new Map();
			nextOrdinal = 1;
			constructor(maxObjects) {
				this.maxObjects = maxObjects;
			}
			/**
			* Start tracking handles allocated by one independently settling operation.
			* @returns An opaque allocation identity.
			*/
			beginAllocation() {
				const allocation = Symbol("Client Runtime object allocation");
				this.allocations.set(allocation, /* @__PURE__ */ new Set());
				return allocation;
			}
			/**
			* Keep an operation's handles and release its allocation bookkeeping.
			* @param allocation - Allocation returned by {@link beginAllocation}.
			*/
			commitAllocation(allocation) {
				this.allocations.delete(allocation);
			}
			/**
			* Resolve one handle or fail without exposing another session's objects.
			* @param handle - Client-local object handle.
			* @returns The retained JavaScript value.
			*/
			get(handle) {
				const object = this.objects.get(handle);
				if (object === void 0) throw new ClientRuntimeExecutionError("object-not-found", "Client RemoteObject was released");
				return object.value;
			}
			/**
			* Read the object group inherited by values reached through one handle.
			* @param handle - Client-local object handle.
			* @returns Its object group, or `undefined` when it is ungrouped.
			*/
			group(handle) {
				const object = this.objects.get(handle);
				if (object === void 0) throw new ClientRuntimeExecutionError("object-not-found", "Client RemoteObject was released");
				return object.group;
			}
			/**
			* Convert a live value to the JSON-safe RemoteObject protocol.
			* @param value - Value owned by this Client realm.
			* @param options - Object group and serialization options.
			* @param allocation - Optional operation that owns any newly retained handle.
			* @returns A primitive value or opaque Client handle with display metadata.
			*/
			serialize(value, options = {}, allocation) {
				const primitive = serializePrimitive(value);
				if (primitive !== void 0) return primitive;
				if (options.returnByValue === true) return { descriptor: {
					type: typeof value === "function" ? "function" : "object",
					value: serializeByValue(value),
					description: describe(value)
				} };
				const type = typeof value === "function" ? "function" : typeof value === "symbol" ? "symbol" : "object";
				const subtype = type === "object" ? subtypeOf(value) : void 0;
				const objectReference = identifyRealmObject(value);
				return {
					descriptor: {
						type,
						...subtype === void 0 ? {} : { subtype },
						className: className(value),
						description: describe(value),
						...options.generatePreview === true && type === "object" ? { preview: preview(value, type, subtype) } : {}
					},
					object: { handle: this.register(value, options.group, allocation) },
					...objectReference === void 0 ? {} : { semanticReference: objectReference }
				};
			}
			/**
			* Release exactly one handle. Releasing an unknown handle is idempotent.
			* @param handle - Client-local object handle.
			*/
			release(handle) {
				const object = this.objects.get(handle);
				if (object === void 0) return;
				this.objects.delete(handle);
				if (object.group === void 0) return;
				const members = this.groups.get(object.group);
				members?.delete(handle);
				if (members?.size === 0) this.groups.delete(object.group);
			}
			/**
			* Release every handle in one DevTools object group.
			* @param group - DevTools object-group name.
			*/
			releaseGroup(group) {
				const members = this.groups.get(group);
				if (members === void 0) return;
				for (const handle of members) this.objects.delete(handle);
				this.groups.delete(group);
			}
			/**
			* Discard exactly the handles allocated by one failed operation.
			* @param allocation - Allocation returned by {@link beginAllocation}.
			*/
			rollback(allocation) {
				const handles = this.allocations.get(allocation);
				if (handles === void 0) return;
				this.allocations.delete(allocation);
				for (const handle of handles) this.release(handle);
			}
			/** Release the whole DevTools session. */
			clear() {
				this.objects.clear();
				this.groups.clear();
				this.allocations.clear();
			}
			register(value, group, allocation) {
				if (this.objects.size >= this.maxObjects) throw new ClientRuntimeExecutionError("result-too-large", `Client Runtime retained-object limit ${String(this.maxObjects)} reached`);
				const ordinal = this.nextOrdinal++;
				const handle = inspectorId(`object-${String(ordinal)}`, "handle");
				this.objects.set(handle, {
					value,
					group
				});
				if (allocation !== void 0) this.allocations.get(allocation)?.add(handle);
				if (group !== void 0) {
					let members = this.groups.get(group);
					if (members === void 0) {
						members = /* @__PURE__ */ new Set();
						this.groups.set(group, members);
					}
					members.add(handle);
				}
				return handle;
			}
		};
		function serializePrimitive(value) {
			if (value === void 0) return { descriptor: { type: "undefined" } };
			if (value === null) return { descriptor: {
				type: "object",
				subtype: "null",
				value: null
			} };
			if (typeof value === "string") return { descriptor: {
				type: "string",
				value
			} };
			if (typeof value === "boolean") return { descriptor: {
				type: "boolean",
				value
			} };
			if (typeof value === "bigint") {
				const text = `${String(value)}n`;
				return { descriptor: {
					type: "bigint",
					unserializableValue: text,
					description: text
				} };
			}
			if (typeof value !== "number") return void 0;
			if (Number.isFinite(value) && !Object.is(value, -0)) return { descriptor: {
				type: "number",
				value,
				description: String(value)
			} };
			const text = Object.is(value, -0) ? "-0" : String(value);
			return { descriptor: {
				type: "number",
				unserializableValue: text,
				description: text
			} };
		}
		function serializeByValue(value) {
			let serialized;
			try {
				serialized = JSON.stringify(value);
			} catch (error) {
				throw new ClientRuntimeExecutionError("unsupported", `Value cannot be returned by value: ${renderError$4(error)}`);
			}
			if (typeof serialized !== "string") throw new ClientRuntimeExecutionError("unsupported", "Value cannot be returned by value");
			const result = JSON.parse(serialized);
			if (!isJsonValue(result)) throw new ClientRuntimeExecutionError("unsupported", "Value is outside the JSON value set");
			return result;
		}
		function preview(value, type, subtype) {
			const properties = [];
			let overflow = false;
			if (typeof value === "object" && value !== null || typeof value === "function") {
				let keys = [];
				try {
					keys = Reflect.ownKeys(value);
				} catch {
					overflow = true;
				}
				for (const key of keys) {
					if (properties.length === 5) {
						overflow = true;
						break;
					}
					let descriptor;
					try {
						descriptor = Reflect.getOwnPropertyDescriptor(value, key);
					} catch {
						continue;
					}
					if (descriptor === void 0) continue;
					if (!("value" in descriptor)) {
						properties.push({
							name: String(key),
							type: "accessor"
						});
						continue;
					}
					const propertyType = remoteType(descriptor.value);
					const propertySubtype = propertyType === "object" ? subtypeOf(descriptor.value) : void 0;
					properties.push({
						name: String(key),
						type: propertyType,
						value: previewText(descriptor.value),
						...propertySubtype === void 0 ? {} : { subtype: propertySubtype }
					});
				}
			}
			return {
				type,
				...subtype === void 0 ? {} : { subtype },
				description: describe(value),
				overflow,
				properties
			};
		}
		function remoteType(value) {
			if (value === null) return "object";
			return typeof value;
		}
		function subtypeOf(value) {
			if (value === null) return "null";
			if (Array.isArray(value)) return "array";
			if (ArrayBuffer.isView(value)) return value instanceof DataView ? "dataview" : "typedarray";
			if (typeof value !== "object") return void 0;
			for (const [prototype, subtype] of SUBTYPES_BY_PROTOTYPE) if (inheritsFrom(value, prototype)) return subtype;
		}
		function className(value) {
			if (typeof value === "function") return functionName(value);
			if (typeof value === "symbol") return "Symbol";
			if (typeof value !== "object" || value === null) return "Object";
			const visited = /* @__PURE__ */ new Set();
			let prototype = prototypeOf(value);
			while (prototype !== null && visited.size < MAX_CLASS_PROTOTYPE_DEPTH && !visited.has(prototype)) {
				visited.add(prototype);
				const constructor = Reflect.getOwnPropertyDescriptor(prototype, "constructor");
				const candidate = constructor !== void 0 && "value" in constructor ? constructor.value : void 0;
				if (typeof candidate === "function") return functionName(candidate);
				prototype = prototypeOf(prototype);
			}
			return "Object";
		}
		function describe(value) {
			if (typeof value === "function") try {
				return Function.prototype.toString.call(value);
			} catch {
				return functionName(value);
			}
			const subtype = subtypeOf(value);
			if (subtype === "array") {
				const descriptor = Reflect.getOwnPropertyDescriptor(value, "length");
				const length = descriptor !== void 0 && "value" in descriptor ? descriptor.value : void 0;
				return `Array(${typeof length === "number" ? String(length) : "?"})`;
			}
			if (subtype === "error") {
				const stack = ownString(value, "stack");
				if (stack !== void 0) return stack;
				const name = ownString(value, "name") ?? className(value);
				const message = ownString(value, "message");
				return message === void 0 || message.length === 0 ? name : `${name}: ${message}`;
			}
			if (subtype === "date") try {
				return Date.prototype.toString.call(value);
			} catch {
				return "Date";
			}
			if (subtype === "regexp") try {
				return RegExp.prototype.toString.call(value);
			} catch {
				return "RegExp";
			}
			return className(value);
		}
		function previewText(value) {
			if (typeof value === "string") return value.slice(0, 100);
			if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" || typeof value === "symbol") return String(value);
			if (value === null) return "null";
			if (value === void 0) return "undefined";
			return describe(value).slice(0, 100);
		}
		function functionName(value) {
			try {
				const descriptor = Reflect.getOwnPropertyDescriptor(value, "name");
				const name = descriptor !== void 0 && "value" in descriptor ? descriptor.value : void 0;
				return typeof name === "string" && name.length > 0 ? name : "Function";
			} catch {
				return "Function";
			}
		}
		function prototypeOf(value) {
			try {
				return Reflect.getPrototypeOf(value);
			} catch {
				return null;
			}
		}
		function inheritsFrom(value, expected) {
			const visited = /* @__PURE__ */ new Set();
			let current = prototypeOf(value);
			while (current !== null && visited.size < MAX_CLASS_PROTOTYPE_DEPTH && !visited.has(current)) {
				if (current === expected) return true;
				visited.add(current);
				current = prototypeOf(current);
			}
			return false;
		}
		function ownString(value, key) {
			try {
				const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
				return descriptor !== void 0 && "value" in descriptor && typeof descriptor.value === "string" ? descriptor.value : void 0;
			} catch {
				return;
			}
		}
		function renderError$4(error) {
			return error instanceof Error ? error.message : String(error);
		}
		const SUBTYPES_BY_PROTOTYPE = [
			[RegExp.prototype, "regexp"],
			[Date.prototype, "date"],
			[Map.prototype, "map"],
			[Set.prototype, "set"],
			[WeakMap.prototype, "weakmap"],
			[WeakSet.prototype, "weakset"],
			[Error.prototype, "error"],
			[Promise.prototype, "promise"],
			[ArrayBuffer.prototype, "arraybuffer"],
			[DataView.prototype, "dataview"]
		];
		//#endregion
		//#region lib/types/client/cdp/properties.js
		/** Lazy Client property enumeration for `Runtime.getProperties`. */
		/**
		* Read property descriptors without invoking getters.
		* @param objects - Object table that owns the requested handle.
		* @param command - Validated property request.
		* @param maxProperties - Maximum descriptors returned by this operation.
		* @param allocation - Current operation's object-allocation identity.
		* @returns Own or inherited descriptors and the immediate prototype.
		*/
		function getClientProperties(objects, command, maxProperties, allocation) {
			const raw = objects.get(command.handle);
			if (!isObjectLike(raw)) return { properties: [] };
			const value = typeof raw === "symbol" ? Symbol.prototype : raw;
			const group = objects.group(command.handle);
			const properties = [];
			const seen = /* @__PURE__ */ new Set();
			const visited = /* @__PURE__ */ new Set();
			let owner = value;
			let own = true;
			while (owner !== null) {
				if (visited.has(owner) || visited.size >= maxProperties) throw new ClientRuntimeExecutionError("result-too-large", "Client prototype traversal exceeded its configured limit");
				visited.add(owner);
				const keys = readKeys(owner);
				for (const key of keys) {
					if (seen.has(key)) continue;
					seen.add(key);
					if (command.nonIndexedPropertiesOnly === true && typeof key === "string" && isArrayIndex(key)) continue;
					const descriptor = readDescriptor(owner, key);
					if (descriptor === void 0) continue;
					if (command.accessorPropertiesOnly === true && "value" in descriptor) continue;
					if (properties.length >= maxProperties) throw new ClientRuntimeExecutionError("result-too-large", `Client property result exceeds the configured ${String(maxProperties)}-property limit`);
					properties.push(toRemoteDescriptor(objects, key, descriptor, group, own, command.generatePreview === true, allocation));
				}
				if (command.ownProperties === true) break;
				owner = readPrototype(owner);
				own = false;
			}
			if (command.accessorPropertiesOnly === true) return { properties };
			const prototype = readPrototype(value);
			return {
				properties,
				internalProperties: prototype === null ? [] : [{
					name: "[[Prototype]]",
					value: objects.serialize(prototype, remoteOptions(group, command.generatePreview), allocation)
				}]
			};
		}
		function toRemoteDescriptor(objects, key, descriptor, group, own, generatePreview, allocation) {
			const common = {
				name: typeof key === "symbol" ? key.description ?? String(key) : String(key),
				configurable: descriptor.configurable ?? false,
				enumerable: descriptor.enumerable ?? false,
				isOwn: own,
				...typeof key === "symbol" ? { symbol: objects.serialize(key, remoteOptions(group), allocation) } : {}
			};
			if ("value" in descriptor) return {
				...common,
				value: objects.serialize(descriptor.value, remoteOptions(group, generatePreview), allocation),
				writable: descriptor.writable ?? false
			};
			const getter = Reflect.get(descriptor, "get");
			const setter = Reflect.get(descriptor, "set");
			return {
				...common,
				...getter === void 0 ? {} : { get: objects.serialize(getter, remoteOptions(group), allocation) },
				...setter === void 0 ? {} : { set: objects.serialize(setter, remoteOptions(group), allocation) }
			};
		}
		function readKeys(value) {
			try {
				return Reflect.ownKeys(value);
			} catch (error) {
				throw new ClientRuntimeExecutionError("internal-error", `Cannot enumerate Client object: ${renderError$3(error)}`);
			}
		}
		function readDescriptor(value, key) {
			try {
				return Reflect.getOwnPropertyDescriptor(value, key);
			} catch (error) {
				throw new ClientRuntimeExecutionError("internal-error", `Cannot read Client property ${String(key)}: ${renderError$3(error)}`);
			}
		}
		function readPrototype(value) {
			try {
				return Object.getPrototypeOf(value);
			} catch (error) {
				throw new ClientRuntimeExecutionError("internal-error", `Cannot read Client object prototype: ${renderError$3(error)}`);
			}
		}
		function isObjectLike(value) {
			return typeof value === "object" && value !== null || typeof value === "function" || typeof value === "symbol";
		}
		function isArrayIndex(value) {
			const number = Number(value);
			return Number.isInteger(number) && number >= 0 && number < 4294967295 && String(number) === value;
		}
		function renderError$3(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function remoteOptions(group, generatePreview) {
			return {
				...group === void 0 ? {} : { group },
				...generatePreview === void 0 ? {} : { generatePreview }
			};
		}
		//#endregion

export {};
