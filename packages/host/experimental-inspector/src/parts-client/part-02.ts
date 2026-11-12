/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát 02/03 NGUYÊN VĂN của stock lib/client.js (dòng 1753–2635): CDP runtime/sources/index + inspection realm/network + bridge lifecycle + shared buffer
 */
// @ts-nocheck

		//#region lib/types/client/cdp/runtime.js
		/** Client-realm executor for the typed Runtime command protocol. */
		const MAX_RUNTIME_ERROR_MESSAGE_LENGTH = 2048;
		/**
		* Describe browser-side Runtime execution.
		* @param origin - Origin assigned to the synthetic execution context.
		* @returns The Runtime capability advertised by a browser Client source.
		*/
		function runtimeBridgeCapability(origin) {
			return {
				type: "client-runtime",
				origin
			};
		}
		/** Executes Runtime requests while isolating object handles by DevTools session. */
		var ClientRuntimeExecutor = class {
			limits;
			resolveScript;
			sessions = /* @__PURE__ */ new Map();
			responseAllocations = /* @__PURE__ */ new Map();
			constructor(limits, resolveScript = () => void 0) {
				this.limits = limits;
				this.resolveScript = resolveScript;
			}
			/**
			* Execute one request and preserve its source, generation, session, and request identities.
			* @param frame - Validated command envelope from the Worker.
			* @param signal - Optional cancellation for an operation awaiting user code.
			* @param deferObjectCommit - Keep new object handles provisional until {@link acknowledge}.
			* @returns A success or transport-error response for the same request.
			*/
			async execute(frame, signal, deferObjectCommit = false) {
				const session = this.session(frame.sessionId);
				const allocation = session.beginAllocation();
				try {
					const result = await session.execute(frame.command, allocation, signal);
					if (signal?.aborted === true) throw new ClientRuntimeExecutionError("timeout", "Client Runtime request was canceled");
					const response = responseFrame(frame, {
						ok: true,
						result
					});
					if (!isJsonValue(response) || jsonByteLength(response) > this.limits.maxResponseBytes) {
						session.rollback(allocation);
						return responseFrame(frame, {
							ok: false,
							error: {
								code: "result-too-large",
								message: "Client Runtime result exceeds the source-frame byte limit"
							}
						});
					}
					if (deferObjectCommit) {
						if (this.responseAllocations.has(frame.requestId)) {
							session.rollback(allocation);
							return responseFrame(frame, {
								ok: false,
								error: {
									code: "invalid-request",
									message: "Client Runtime request id is already pending"
								}
							});
						}
						this.responseAllocations.set(frame.requestId, {
							sessionId: frame.sessionId,
							session,
							allocation
						});
					} else session.commitAllocation(allocation);
					return response;
				} catch (error) {
					session.rollback(allocation);
					return responseFrame(frame, {
						ok: false,
						error: runtimeError(error)
					});
				}
			}
			/**
			* Commit handles after the Worker accepts one Runtime response.
			* @param sessionId - Session that owns the response.
			* @param requestId - Correlation id acknowledged by the Worker.
			*/
			acknowledge(sessionId, requestId) {
				const pending = this.responseAllocations.get(requestId);
				if (pending === void 0 || pending.sessionId !== sessionId) return;
				this.responseAllocations.delete(requestId);
				pending.session.commitAllocation(pending.allocation);
			}
			/**
			* Roll back handles from a canceled or otherwise unaccepted Runtime response.
			* @param sessionId - Session that owns the response.
			* @param requestId - Correlation id rejected by the Worker.
			*/
			cancel(sessionId, requestId) {
				const pending = this.responseAllocations.get(requestId);
				if (pending === void 0 || pending.sessionId !== sessionId) return;
				this.responseAllocations.delete(requestId);
				pending.session.rollback(pending.allocation);
			}
			/**
			* Release all values retained for one closed DevTools connection.
			* @param sessionId - Runtime session owned by that DevTools connection.
			*/
			closeSession(sessionId) {
				for (const [requestId, pending] of this.responseAllocations) if (pending.sessionId === sessionId) this.responseAllocations.delete(requestId);
				this.sessions.get(sessionId)?.close();
				this.sessions.delete(sessionId);
			}
			/**
			* Release one object group without closing the surrounding Runtime session.
			* @param sessionId - Session that owns the retained objects.
			* @param group - Object-group name to release.
			*/
			releaseObjectGroup(sessionId, group) {
				this.sessions.get(sessionId)?.releaseObjectGroup(group);
			}
			/**
			* Serialize one Console call for a specific DevTools Runtime session.
			* @param sessionId - Session receiving the Console event.
			* @param type - Console API operation.
			* @param values - Original arguments from the page call.
			* @param timestamp - Epoch timestamp in milliseconds.
			* @param stackTrace - Browser call frames captured before deferred delivery.
			* @returns A wire-safe event whose object handles belong only to this session.
			*/
			consoleEvent(sessionId, type, values, timestamp, stackTrace) {
				const session = this.session(sessionId);
				const allocation = session.beginAllocation();
				try {
					const event = {
						type: "console-api",
						event: {
							type,
							arguments: session.serializeAll(values, "console", allocation),
							timestamp,
							...stackTrace === void 0 ? {} : { stackTrace }
						}
					};
					if (!isJsonValue(event) || jsonByteLength(event) + 4096 > this.limits.maxResponseBytes) {
						session.rollback(allocation);
						return;
					}
					session.commitAllocation(allocation);
					return event;
				} catch (error) {
					session.rollback(allocation);
					throw error;
				}
			}
			/**
			* Serialize one uncaught Client exception for a DevTools Runtime session.
			* @param sessionId - Session receiving the exception event.
			* @param error - Thrown or rejected value.
			* @param timestamp - Epoch timestamp in milliseconds.
			* @param stackTrace - Browser call frames attached to the failure.
			* @returns A wire-safe exception event.
			*/
			exceptionEvent(sessionId, error, timestamp, stackTrace) {
				const session = this.session(sessionId);
				const allocation = session.beginAllocation();
				try {
					const event = {
						type: "exception",
						event: {
							timestamp,
							details: session.describeException(error, "console", stackTrace, allocation)
						}
					};
					if (!isJsonValue(event) || jsonByteLength(event) + 4096 > this.limits.maxResponseBytes) {
						session.rollback(allocation);
						return;
					}
					session.commitAllocation(allocation);
					return event;
				} catch (serializationError) {
					session.rollback(allocation);
					throw serializationError;
				}
			}
			/** Release all sessions when a source generation ends or reconnects. */
			reset() {
				this.responseAllocations.clear();
				for (const session of this.sessions.values()) session.close();
				this.sessions.clear();
			}
			session(sessionId) {
				let session = this.sessions.get(sessionId);
				if (session === void 0) {
					session = new ClientRuntimeSession(this.limits.maxObjectsPerSession, this.limits.maxPropertiesPerResult, this.resolveScript);
					this.sessions.set(sessionId, session);
				}
				return session;
			}
		};
		var ClientRuntimeSession = class {
			maxProperties;
			resolveScript;
			objects;
			constructor(maxObjects, maxProperties, resolveScript) {
				this.maxProperties = maxProperties;
				this.resolveScript = resolveScript;
				this.objects = new ClientObjectStore(maxObjects);
			}
			beginAllocation() {
				return this.objects.beginAllocation();
			}
			commitAllocation(allocation) {
				this.objects.commitAllocation(allocation);
			}
			rollback(allocation) {
				this.objects.rollback(allocation);
			}
			async execute(command, allocation, signal) {
				switch (command.op) {
					case "evaluate": return {
						op: command.op,
						completion: await this.evaluate(command, allocation, signal)
					};
					case "get-properties": {
						const result = getClientProperties(this.objects, command, this.maxProperties, allocation);
						return {
							op: command.op,
							...result
						};
					}
					case "call-function": return {
						op: command.op,
						completion: await this.callFunction(command, allocation, signal)
					};
					case "await-promise": return {
						op: command.op,
						completion: await this.awaitPromise(command, allocation, signal)
					};
					case "release-object":
						this.objects.release(command.handle);
						return { op: command.op };
					case "release-object-group":
						this.releaseObjectGroup(command.objectGroup);
						return { op: command.op };
					case "global-lexical-scope-names": return {
						op: command.op,
						names: []
					};
					default: return assertNever$1(command);
				}
			}
			close() {
				this.objects.clear();
			}
			releaseObjectGroup(group) {
				this.objects.releaseGroup(group);
			}
			serializeAll(values, group, allocation) {
				return values.map((value) => this.objects.serialize(value, {
					group,
					generatePreview: true
				}, allocation));
			}
			describeException(error, group, stackTrace, allocation) {
				const options = { ...group === void 0 ? {} : { group } };
				const resolvedStackTrace = stackTrace ?? clientErrorStack(error, this.resolveScript);
				const firstFrame = resolvedStackTrace?.callFrames[0];
				return {
					text: "Uncaught",
					lineNumber: firstFrame?.lineNumber ?? 0,
					columnNumber: firstFrame?.columnNumber ?? 0,
					...firstFrame === void 0 ? clientUrl() : { url: firstFrame.url },
					...resolvedStackTrace === void 0 ? {} : { stackTrace: resolvedStackTrace },
					exception: this.objects.serialize(error, options, allocation)
				};
			}
			async evaluate(command, allocation, signal) {
				let value;
				try {
					value = globalThis.eval(command.expression);
					if (command.awaitPromise === true) value = await awaitWithCancellation(value, signal, command.timeoutMs);
				} catch (error) {
					if (error instanceof ClientRuntimeExecutionError) throw error;
					return this.exception(error, command.objectGroup, allocation);
				}
				return this.completion(value, allocation, command.objectGroup, command.generatePreview, command.returnByValue);
			}
			async callFunction(command, allocation, signal) {
				const receiver = command.receiver === void 0 ? globalThis : this.objects.get(command.receiver);
				const inheritedGroup = command.receiver === void 0 ? void 0 : this.objects.group(command.receiver);
				const group = command.objectGroup ?? inheritedGroup;
				const args = (command.arguments ?? []).map((argument) => this.resolveArgument(argument));
				let value;
				try {
					const fn = globalThis.eval(`(${command.functionDeclaration}\n)`);
					if (typeof fn !== "function") throw new TypeError("functionDeclaration did not evaluate to a function");
					value = Reflect.apply(fn, receiver, args);
					if (command.awaitPromise === true) value = await awaitWithCancellation(value, signal);
				} catch (error) {
					if (error instanceof ClientRuntimeExecutionError) throw error;
					return this.exception(error, group, allocation);
				}
				return this.completion(value, allocation, group, command.generatePreview, command.returnByValue);
			}
			async awaitPromise(command, allocation, signal) {
				const group = this.objects.group(command.promise);
				let value;
				try {
					value = await awaitWithCancellation(this.objects.get(command.promise), signal);
				} catch (error) {
					if (error instanceof ClientRuntimeExecutionError) throw error;
					return this.exception(error, group, allocation);
				}
				return this.completion(value, allocation, group, command.generatePreview, command.returnByValue);
			}
			resolveArgument(argument) {
				switch (argument.kind) {
					case "value": return argument.value;
					case "object": return this.objects.get(argument.handle);
					case "undefined": return;
					case "unserializable": return parseUnserializable(argument.value);
					default: return assertNever$1(argument);
				}
			}
			exception(error, group, allocation) {
				const options = { ...group === void 0 ? {} : { group } };
				const details = this.describeException(error, group, void 0, allocation);
				return {
					result: this.objects.serialize(error, options, allocation),
					exceptionDetails: details
				};
			}
			completion(value, allocation, group, generatePreview, returnByValue) {
				return { result: this.objects.serialize(value, {
					...group === void 0 ? {} : { group },
					...generatePreview === void 0 ? {} : { generatePreview },
					...returnByValue === void 0 ? {} : { returnByValue }
				}, allocation) };
			}
		};
		function responseFrame(request, outcome) {
			return {
				v: 0,
				t: "client-runtime/response",
				sourceId: request.sourceId,
				generation: request.generation,
				sessionId: request.sessionId,
				requestId: request.requestId,
				outcome
			};
		}
		function runtimeError(error) {
			return {
				code: error instanceof ClientRuntimeExecutionError ? error.code : "internal-error",
				message: (error instanceof Error ? error.message : String(error)).slice(0, MAX_RUNTIME_ERROR_MESSAGE_LENGTH)
			};
		}
		function parseUnserializable(value) {
			if (value === "NaN") return NaN;
			if (value === "Infinity") return Number.POSITIVE_INFINITY;
			if (value === "-Infinity") return Number.NEGATIVE_INFINITY;
			if (value === "-0") return -0;
			if (/^-?(?:0|[1-9]\d*)n$/u.test(value)) return BigInt(value.slice(0, -1));
			throw new ClientRuntimeExecutionError("invalid-request", `Unsupported unserializable value ${JSON.stringify(value)}`);
		}
		function clientUrl() {
			const location = Reflect.get(globalThis, "location");
			if (typeof location !== "object" || location === null) return {};
			const href = Reflect.get(location, "href");
			return typeof href === "string" ? { url: href } : {};
		}
		async function awaitWithCancellation(value, signal, timeoutMs) {
			if (signal?.aborted === true) throw new ClientRuntimeExecutionError("timeout", "Client Runtime request was canceled");
			let timer;
			let onAbort;
			try {
				const limits = [];
				if (timeoutMs !== void 0) limits.push(new Promise((_resolve, reject) => {
					timer = setTimeout(() => {
						reject(new ClientRuntimeExecutionError("timeout", `Client evaluation exceeded ${String(timeoutMs)}ms`));
					}, timeoutMs);
				}));
				if (signal !== void 0) limits.push(new Promise((_resolve, reject) => {
					onAbort = () => {
						reject(new ClientRuntimeExecutionError("timeout", "Client Runtime request was canceled"));
					};
					signal.addEventListener("abort", onAbort, { once: true });
				}));
				return await Promise.race([Promise.resolve(value), ...limits]);
			} finally {
				if (timer !== void 0) clearTimeout(timer);
				if (onAbort !== void 0) signal?.removeEventListener("abort", onAbort);
			}
		}
		function assertNever$1(value) {
			throw new Error(`Unexpected Client Runtime variant: ${JSON.stringify(value)}`);
		}
		//#endregion
		//#region lib/types/client/cdp/sources.js
		/** Browser-side catalog for the Inspector Client bundle and its source map. */
		const PACKAGE_ID = "@deepseek-ai/dsh-experimental-inspector";
		const CLIENT_SCRIPT_KEY = inspectorId("client-bundle", "scriptKey");
		/**
		* Describe browser-side source access.
		* @param available - Whether the Client bundle was discovered.
		* @returns The Sources capability when this Client discovered its bundle.
		*/
		function sourcesBridgeCapability(available) {
			return available ? { type: "client-sources" } : void 0;
		}
		/** Deliberate error serialized by the Client source transport. */
		var ClientSourceCatalogError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
			}
		};
		/** Executes bounded, read-only operations over Client script assets. */
		var ClientSourceCatalog = class {
			assets = /* @__PURE__ */ new Map();
			constructor(assets) {
				for (const asset of assets) {
					if (this.assets.has(asset.scriptKey)) throw new Error(`inspector: duplicate Client script key ${asset.scriptKey}`);
					this.assets.set(asset.scriptKey, { asset });
				}
			}
			/**
			* Resolve a stack-frame URL to this catalog's local script key.
			* @param url - Absolute or page-relative stack-frame URL.
			* @returns The matching script key when the URL belongs to this catalog.
			*/
			scriptKeyForUrl(url) {
				const normalized = normalizedUrl(url);
				for (const entry of this.assets.values()) if (normalizedUrl(entry.asset.url) === normalized) return entry.asset.scriptKey;
			}
			/**
			* Execute one validated source operation.
			* @param command - Read-only catalog command.
			* @param maxContentBytes - Maximum encoded bytes admitted for one asset.
			* @returns Script metadata or one bounded content chunk.
			*/
			async execute(command, maxContentBytes) {
				if (command.op === "list-scripts") return {
					op: command.op,
					scripts: await Promise.all([...this.assets.values()].map(async (entry) => this.describe(entry, maxContentBytes)))
				};
				const entry = this.assets.get(command.scriptKey);
				if (entry === void 0) throw new ClientSourceCatalogError("script-not-found", "Client script is not available");
				const bytes = command.content === "source" ? await this.sourceBytes(entry, maxContentBytes) : await this.sourceMapBytes(entry, maxContentBytes);
				if (bytes === void 0) return {
					op: command.op,
					scriptKey: command.scriptKey,
					content: command.content,
					available: false
				};
				if (command.offset > bytes.byteLength) throw new ClientSourceCatalogError("invalid-request", "Client source chunk offset exceeds content length");
				const nextOffset = Math.min(bytes.byteLength, command.offset + command.maxBytes);
				return {
					op: command.op,
					scriptKey: command.scriptKey,
					content: command.content,
					available: true,
					offset: command.offset,
					nextOffset,
					data: bytesToBase64(bytes.subarray(command.offset, nextOffset)),
					eof: nextOffset === bytes.byteLength
				};
			}
			async describe(entry, maxContentBytes) {
				const source = await this.source(entry, maxContentBytes);
				const newline = source.lastIndexOf("\n");
				return {
					scriptKey: entry.asset.scriptKey,
					url: entry.asset.url,
					hash: entry.asset.hash,
					buildId: "",
					...entry.asset.sourceMapUrl === void 0 ? {} : { sourceMapUrl: entry.asset.sourceMapUrl },
					startLine: 0,
					startColumn: 0,
					endLine: countNewlines(source),
					endColumn: newline === -1 ? source.length : source.length - newline - 1,
					...entry.asset.isModule === void 0 ? {} : { isModule: entry.asset.isModule },
					length: source.length
				};
			}
			source(entry, maxContentBytes) {
				entry.source ??= entry.asset.loadSource().catch((error) => {
					throw new ClientSourceCatalogError("load-failed", `Cannot load Client script: ${renderError$2(error)}`);
				});
				return entry.source.then((source) => {
					if (new TextEncoder().encode(source).byteLength > maxContentBytes) throw new ClientSourceCatalogError("result-too-large", "Client script exceeds the configured content limit");
					return source;
				});
			}
			sourceBytes(entry, maxContentBytes) {
				entry.sourceBytes ??= this.source(entry, maxContentBytes).then((source) => new TextEncoder().encode(source));
				return entry.sourceBytes;
			}
			async sourceMapBytes(entry, maxContentBytes) {
				if (entry.asset.loadSourceMap === void 0) return void 0;
				await this.source(entry, maxContentBytes);
				entry.sourceMapBytes ??= entry.asset.loadSourceMap().then((value) => value === void 0 ? void 0 : new TextEncoder().encode(value)).catch((error) => {
					throw new ClientSourceCatalogError("load-failed", `Cannot load Client source map: ${renderError$2(error)}`);
				});
				return entry.sourceMapBytes.then((bytes) => {
					if (bytes !== void 0 && bytes.byteLength > maxContentBytes) throw new ClientSourceCatalogError("result-too-large", "Client source map exceeds the configured content limit");
					return bytes;
				});
			}
		};
		/**
		* Discover this package's bundle URL from the Host-injected web boot graph and its map from the loaded script trailer.
		* @returns A lazy catalog, or `undefined` outside the assembled web application.
		*/
		function discoverInspectorClientSourceCatalog() {
			const graph = Reflect.get(globalThis, "__GBH_BOOT__");
			if (typeof graph !== "object" || graph === null) return void 0;
			const entries = Reflect.get(graph, "entries");
			if (!Array.isArray(entries)) return void 0;
			const row = entries.find((value) => {
				if (typeof value !== "object" || value === null) return false;
				return Reflect.get(value, "id") === PACKAGE_ID;
			});
			if (row === void 0 || typeof row.url !== "string" || typeof row.rev !== "string") return void 0;
			const base = documentBase();
			if (base === void 0) return void 0;
			const sourceUrl = new URL(row.url, base);
			let sourceMapUrl;
			return new ClientSourceCatalog([{
				scriptKey: CLIENT_SCRIPT_KEY,
				url: sourceUrl.href,
				hash: row.rev,
				get sourceMapUrl() {
					return sourceMapUrl;
				},
				isModule: false,
				loadSource: async () => {
					const source = await fetchText(sourceUrl.href);
					const reference = /\/\/#\s*sourceMappingURL=(\S+)\s*$/u.exec(source)?.[1];
					if (reference !== void 0) sourceMapUrl = new URL(reference, sourceUrl).href;
					return source;
				},
				loadSourceMap: async () => sourceMapUrl === void 0 ? void 0 : fetchText(sourceMapUrl)
			}]);
		}
		async function fetchText(url) {
			const response = await fetch(url);
			if (!response.ok) throw new Error(`${String(response.status)} ${response.statusText}`);
			return response.text();
		}
		/**
		* Base every app-owned route reference resolves against: the document's
		* `baseURI`, else the location URL, else undefined outside a browser.
		*/
		function documentBase() {
			const document = Reflect.get(globalThis, "document");
			if (typeof document === "object" && document !== null) {
				const baseURI = Reflect.get(document, "baseURI");
				if (typeof baseURI === "string" && baseURI !== "") return baseURI;
			}
			const location = Reflect.get(globalThis, "location");
			if (typeof location !== "object" || location === null) return void 0;
			const href = Reflect.get(location, "href");
			return typeof href === "string" ? href : void 0;
		}
		function countNewlines(value) {
			let count = 0;
			for (let index = 0; index < value.length; index++) if (value.charCodeAt(index) === 10) count++;
			return count;
		}
		function renderError$2(error) {
			return error instanceof Error ? error.message : String(error);
		}
		function normalizedUrl(value) {
			try {
				const url = new URL(value, documentBase());
				url.hash = "";
				return url.href;
			} catch {
				return value;
			}
		}
		//#endregion
		//#region lib/types/client/cdp/index.js
		/** Source-side CDP capability declarations for the browser Client realm. */
		/**
		* Describe Client operations that require Worker-to-page bridge messages.
		* @param origin - Origin assigned to the synthetic execution context.
		* @param hasSources - Whether the Client bundle source was discovered.
		* @returns Capabilities included in the Client source handshake.
		*/
		function bridgeCapabilities(origin, hasSources) {
			return [
				runtimeBridgeCapability(origin),
				consoleBridgeCapability(),
				sourcesBridgeCapability(hasSources),
				void 0,
				void 0,
				void 0
			].filter((capability) => capability !== void 0);
		}
		//#endregion
		//#region lib/types/client/inspection/realm.js
		/** Stable Client source identity with a fresh descriptor for each WebSocket generation. */
		const CLIENT_SOURCE_STORAGE_KEY = "dsh.experimental-inspector.client-source-id.v0";
		const CLIENT_SOURCE_LOCK_PREFIX = "dsh.experimental-inspector.client-source:";
		/** Owns one browser realm's stable source id across transport reconnects. */
		var ClientRealmSource = class ClientRealmSource {
			label;
			releaseClaim;
			/** Logical source id retained across reconnecting transport generations. */
			sourceId;
			constructor(label, sourceId = sessionClientSourceId(), releaseClaim) {
				this.label = label;
				this.releaseClaim = releaseClaim;
				this.sourceId = sourceId;
			}
			/**
			* Claim the tab identity before opening its source transport. Browsers with
			* Web Locks reject a copied `sessionStorage` identity while its original tab
			* remains live; a fresh id is persisted and claimed instead.
			* @param label - Human-readable Client label reported to the Worker.
			* @returns The claimed realm source.
			*/
			static async claim(label) {
				let sourceId = sessionClientSourceId();
				const locks = browserLockManager();
				if (locks === void 0) return new ClientRealmSource(label, sourceId);
				while (true) {
					const release = await tryClaimSourceId(locks, sourceId);
					if (release !== void 0) {
						persistClientSourceId(sourceId);
						return new ClientRealmSource(label, sourceId, release);
					}
					sourceId = generatedClientSourceId();
				}
			}
			/**
			* Create the descriptor for one newly admitted transport generation.
			* @param hasSources - Whether the built Client bundle is available for source reads.
			* @returns A source descriptor with a fresh generation.
			*/
			connect(hasSources) {
				return {
					sourceId: this.sourceId,
					generation: inspectorId(randomUUID(), "generation"),
					kind: "client",
					label: this.label,
					timeOriginMs: performance.timeOrigin,
					capabilities: bridgeCapabilities(clientOrigin(), hasSources)
				};
			}
			/** Release this page's identity claim. */
			close() {
				this.releaseClaim?.();
				this.releaseClaim = void 0;
			}
		};
		function sessionClientSourceId() {
			const generated = generatedClientSourceId();
			try {
				const stored = sessionStorage.getItem(CLIENT_SOURCE_STORAGE_KEY);
				if (stored !== null) try {
					return inspectorId(stored, "sourceId");
				} catch {}
				sessionStorage.setItem(CLIENT_SOURCE_STORAGE_KEY, generated);
			} catch {}
			return generated;
		}
		function generatedClientSourceId() {
			return inspectorId(`client-${randomUUID()}`, "sourceId");
		}
		function persistClientSourceId(sourceId) {
			try {
				sessionStorage.setItem(CLIENT_SOURCE_STORAGE_KEY, sourceId);
			} catch {}
		}
		function browserLockManager() {
			if (typeof navigator === "undefined") return void 0;
			return navigator.locks;
		}
		function tryClaimSourceId(locks, sourceId) {
			return new Promise((resolve, reject) => {
				let release;
				const held = new Promise((released) => {
					release = released;
				});
				locks.request(`${CLIENT_SOURCE_LOCK_PREFIX}${sourceId}`, { ifAvailable: true }, async (lock) => {
					if (lock === null) {
						resolve(void 0);
						return;
					}
					resolve(release);
					await held;
				}).catch(reject);
			});
		}
		function clientOrigin() {
			const location = Reflect.get(globalThis, "location");
			if (typeof location !== "object" || location === null) return "";
			const origin = Reflect.get(location, "origin");
			return typeof origin === "string" ? origin : "";
		}
		//#endregion
		//#region lib/types/client/inspection/network.js
		/** Client network observation is not enabled in the current source producer. */
		/** Observation topics published by the Client network adapter. */
		const NETWORK_TOPICS = [];
		//#endregion
		//#region lib/types/client/bridge/lifecycle.js
		/** Reconnection lifecycle for the browser Client bridge. */
		/** Owns one bounded-backoff timer and prevents reconnection after disposal. */
		var ClientBridgeLifecycle = class {
			baseDelayMs;
			maxDelayMs;
			reconnectAttempt = 0;
			reconnectTimer;
			closed = false;
			constructor(baseDelayMs, maxDelayMs) {
				this.baseDelayMs = baseDelayMs;
				this.maxDelayMs = maxDelayMs;
			}
			/** Reset backoff after the Worker accepts a source generation. */
			connected() {
				this.reconnectAttempt = 0;
			}
			/**
			* Schedule the next reconnect attempt unless one is already pending.
			* @param connect - Operation that opens the next transport generation.
			*/
			reconnect(connect) {
				if (this.reconnectTimer !== void 0 || this.closed) return;
				const cap = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** this.reconnectAttempt);
				this.reconnectAttempt++;
				this.reconnectTimer = setTimeout(() => {
					this.reconnectTimer = void 0;
					connect();
				}, cap / 2 + Math.random() * cap / 2);
			}
			/** Stop pending and future reconnect attempts. */
			close() {
				if (this.closed) return;
				this.closed = true;
				this.cancelReconnect();
			}
			/** Cancel a scheduled attempt while the page is outside its active lifetime. */
			cancelReconnect() {
				if (this.reconnectTimer !== void 0) clearTimeout(this.reconnectTimer);
				this.reconnectTimer = void 0;
			}
		};
		//#endregion
		//#region lib/types/shared/bridge/buffer.js
		/** Realm-neutral bounded buffering for Host and Client observation sources. */
		const SOURCE_FRAME_OVERHEAD_BYTES = 4096;
		/**
		* Owns retained state, queued events, and source-local sequencing independently
		* of whether frames travel over MessagePort or WebSocket.
		*/
		var InspectorSourceBuffer = class {
			options;
			queue = [];
			state = /* @__PURE__ */ new Map();
			queuedBytes = 0;
			nextSequence = 1;
			expectedSequence = 1;
			constructor(options) {
				this.options = options;
			}
			/** Whether at least one observation is waiting for transport. */
			get hasPending() {
				return this.queue.length > 0;
			}
			/**
			* Validate and enqueue one observation, dropping the oldest prefix as needed.
			* A record larger than one transport frame is dropped after consuming its sequence number.
			* @param topic - Declared domain topic.
			* @param payload - Lossless JSON payload.
			* @param monotonicMs - Finite source-clock timestamp.
			*/
			publish(topic, payload, monotonicMs) {
				this.enqueue(this.record(topic, payload, monotonicMs));
			}
			/**
			* Replace one retained topic and enqueue the same observation for live delivery.
			* @param topic - Declared state topic.
			* @param payload - Lossless JSON payload retained for replacement frames.
			* @param monotonicMs - Finite source-clock timestamp.
			*/
			setState(topic, payload, monotonicMs) {
				const record = this.record(topic, payload, monotonicMs);
				const previous = this.state.get(topic);
				this.state.set(topic, record);
				if (!this.stateFits()) {
					if (previous === void 0) this.state.delete(topic);
					else this.state.set(topic, previous);
					throw new Error("inspector: source state exceeds the source-frame byte limit");
				}
				this.enqueue(record);
			}
			/**
			* Build a complete state replacement and absorb every preceding queue drop.
			* @param sourceId - Logical source identity.
			* @param generation - Current transport generation.
			* @returns A replacement frame whose sequence is the next append position.
			*/
			replacement(sourceId, generation) {
				const nextSequence = this.queue[0]?.sequence ?? this.nextSequence;
				this.expectedSequence = nextSequence;
				return {
					v: 0,
					t: "source/replace",
					sourceId,
					generation,
					nextSequence,
					records: [...this.state.values()]
				};
			}
			/**
			* Remove and sequence the next transport-sized observation batch.
			* @param sourceId - Logical source identity.
			* @param generation - Current transport generation.
			* @returns The next append frame, or `undefined` when the queue is empty.
			*/
			takeBatch(sourceId, generation) {
				if (this.queue.length === 0) return void 0;
				const batch = [];
				let batchBytes = SOURCE_FRAME_OVERHEAD_BYTES;
				const first = this.queue[0];
				while (batch.length < this.options.maxRecordsPerFrame && this.queue.length > 0) {
					const candidate = this.queue[0];
					if (candidate.sequence !== first.sequence + batch.length) break;
					if (batch.length > 0 && batchBytes + candidate.bytes > this.options.maxFrameBytes) break;
					this.queue.shift();
					batch.push(candidate);
					batchBytes += candidate.bytes;
				}
				this.queuedBytes -= batch.reduce((sum, item) => sum + item.bytes, 0);
				const firstSequence = first.sequence;
				const frame = {
					v: 0,
					t: "source/append",
					sourceId,
					generation,
					firstSequence,
					droppedBefore: firstSequence - this.expectedSequence,
					records: batch.map((item) => item.record)
				};
				this.expectedSequence = firstSequence + frame.records.length;
				return frame;
			}
			/** Discard observations that have not entered a transport frame. */
			discardPending() {
				this.queue.length = 0;
				this.queuedBytes = 0;
			}
			record(topic, payload, monotonicMs) {
				if (topic.length === 0 || topic.length > 128) throw new Error("inspector: topic must contain 1 to 128 characters");
				if (!this.options.topics.includes("*") && !this.options.topics.includes(topic)) throw new Error(`inspector: source does not declare topic ${JSON.stringify(topic)}`);
				if (!isJsonValue(payload)) throw new Error("inspector: source payload must be lossless JSON data");
				if (!Number.isFinite(monotonicMs)) throw new Error("inspector: monotonicMs must be finite");
				return {
					monotonicMs,
					topic,
					payload
				};
			}
			enqueue(record) {
				const bytes = jsonByteLength(record);
				const sequence = this.nextSequence++;
				if (bytes + SOURCE_FRAME_OVERHEAD_BYTES > this.options.maxFrameBytes) return;
				this.queue.push({
					sequence,
					bytes,
					record
				});
				this.queuedBytes += bytes;
				while (this.queue.length > this.options.maxQueuedRecords || this.queuedBytes > this.options.maxQueuedBytes) {
					const dropped = this.queue.shift();
					this.queuedBytes -= dropped.bytes;
				}
			}
			stateFits() {
				return jsonByteLength([...this.state.values()]) + SOURCE_FRAME_OVERHEAD_BYTES <= this.options.maxFrameBytes;
			}
		};
		//#endregion

export {};
