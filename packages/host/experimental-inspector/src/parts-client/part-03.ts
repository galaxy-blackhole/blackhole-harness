/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát 03/03 NGUYÊN VĂN của stock lib/client.js (dòng 2636–3572): bridge publisher/query codec/RPC/dispatcher/transport/controller + dispose + plugin + vỏ đóng đăng ký
 */
// @ts-nocheck

		//#region lib/types/client/bridge/publisher.js
		/** Buffered Client observation publication across reconnecting WebSockets. */
		/** Non-blocking Client publisher whose bounded state survives transport reconnects. */
		var ClientBridgePublisher = class {
			maxBufferedBytes;
			records;
			active;
			flushTimer;
			closed = false;
			constructor(options, maxBufferedBytes) {
				this.maxBufferedBytes = maxBufferedBytes;
				this.records = new InspectorSourceBuffer(options);
			}
			publish(topic, payload, monotonicMs = performance.now()) {
				if (this.closed) return;
				this.records.publish(topic, payload, monotonicMs);
				this.flush();
			}
			setState(topic, payload, monotonicMs = performance.now()) {
				if (this.closed) throw new Error("inspector: Client source is closed");
				this.records.setState(topic, payload, monotonicMs);
				this.flush();
			}
			/**
			* Install one unopened transport generation.
			* @param socket - WebSocket carrying the generation.
			* @param source - Source identity and generation sent by the socket.
			*/
			connect(socket, source) {
				this.active = {
					socket,
					source,
					accepted: false
				};
			}
			/**
			* Send retained state and queued observations after Worker acceptance.
			* @param socket - Accepted active WebSocket.
			*/
			accept(socket) {
				const active = this.active;
				if (active?.socket !== socket) return;
				active.accepted = true;
				this.replace(socket);
				this.flush();
			}
			/**
			* Resend retained state for the active generation.
			* @param socket - WebSocket that received the resnapshot request.
			*/
			replace(socket) {
				const active = this.active;
				if (active?.socket !== socket || socket.readyState !== WebSocket.OPEN) return;
				socket.send(JSON.stringify(this.records.replacement(active.source.sourceId, active.source.generation)));
			}
			/**
			* Forget one closed transport while retaining buffered state for reconnect.
			* @param socket - WebSocket whose close event fired.
			*/
			disconnect(socket) {
				if (this.active?.socket === socket) this.active = void 0;
			}
			/** Stop delayed writes and reject later publication. */
			close() {
				if (this.closed) return;
				this.closed = true;
				this.active = void 0;
				if (this.flushTimer !== void 0) clearTimeout(this.flushTimer);
				this.flushTimer = void 0;
			}
			flush() {
				const active = this.active;
				if (!active?.accepted || active.socket.readyState !== WebSocket.OPEN) return;
				if (active.socket.bufferedAmount > this.maxBufferedBytes) {
					this.scheduleFlush();
					return;
				}
				while (this.records.hasPending && active.socket.bufferedAmount <= this.maxBufferedBytes) {
					const frame = this.records.takeBatch(active.source.sourceId, active.source.generation);
					if (frame === void 0) break;
					active.socket.send(JSON.stringify(frame));
				}
				if (this.records.hasPending) this.scheduleFlush();
			}
			scheduleFlush() {
				if (this.flushTimer !== void 0 || this.closed) return;
				this.flushTimer = setTimeout(() => {
					this.flushTimer = void 0;
					this.flush();
				}, 25);
			}
		};
		/**
		* Decode a consumer-neutral tree received across an Inspector transport.
		* @param value - Untrusted query result value.
		* @returns A detached tree containing only public semantic fields.
		*/
		function parseCordisRuntimeTree(value) {
			const record = exactObject(value, [
				"schemaVersion",
				"host",
				"clients"
			], "Cordis runtime tree");
			if (record.schemaVersion !== 0 || !Array.isArray(record.clients)) throw new Error("inspector protocol: invalid Cordis runtime tree");
			const host = record.host === null ? null : parseRealm(record.host, "host");
			const clients = record.clients.map((client) => parseRealm(client, "client"));
			const sourceIds = /* @__PURE__ */ new Set();
			for (const realm of host === null ? clients : [host, ...clients]) {
				if (sourceIds.has(realm.source.sourceId)) throw new Error("inspector protocol: Cordis runtime tree repeats a sourceId");
				sourceIds.add(realm.source.sourceId);
			}
			return {
				schemaVersion: 0,
				host,
				clients
			};
		}
		function parseRealm(value, kind) {
			const record = exactObject(value, [
				"source",
				"connection",
				"revision",
				"truncated",
				"root"
			], "Cordis runtime realm");
			const source = exactObject(record.source, [
				"sourceId",
				"kind",
				"label"
			], "Cordis runtime source");
			if (source.kind !== kind || typeof source.label !== "string" || source.label.length === 0 || source.label.length > 256) throw new Error(`inspector protocol: invalid ${kind} Cordis runtime source`);
			if (!Number.isSafeInteger(record.revision) || record.revision < 1 || typeof record.truncated !== "boolean") throw new Error("inspector protocol: invalid Cordis runtime realm header");
			const root = parseNode(record.root, { fiberUids: /* @__PURE__ */ new Set() }, 0);
			if (root.kind !== "context") throw new Error("inspector protocol: Cordis runtime root must be a Context");
			return {
				source: {
					sourceId: wireId(source.sourceId, "sourceId"),
					kind,
					label: source.label
				},
				connection: parseConnection(record.connection),
				revision: record.revision,
				truncated: record.truncated,
				root
			};
		}
		function parseConnection(value) {
			if (!isPlainObject(value)) throw new Error("inspector protocol: Cordis runtime connection must be an object");
			if (value.state === "connected") {
				exactKeys(value, ["state"], "connected Cordis runtime connection");
				return { state: "connected" };
			}
			if (value.state === "disconnected" && typeof value.reason === "string") {
				exactKeys(value, ["state", "reason"], "disconnected Cordis runtime connection");
				return {
					state: "disconnected",
					reason: value.reason
				};
			}
			throw new Error("inspector protocol: invalid Cordis runtime connection");
		}
		function parseNode(value, state, depth) {
			if (depth > 256) throw new Error("inspector protocol: Cordis runtime tree exceeds the depth limit");
			if (!isPlainObject(value) || value.kind !== "context" && value.kind !== "fiber") throw new Error("inspector protocol: Cordis runtime node must have a known kind");
			const record = exactObject(value, value.kind === "fiber" ? [
				"kind",
				"uid",
				"children"
			] : ["kind", "children"], "Cordis runtime node");
			if (!Array.isArray(record.children)) throw new Error("inspector protocol: Cordis runtime node children must be an array");
			if (record.kind === "context") return {
				kind: "context",
				children: record.children.map((child) => parseNode(child, state, depth + 1))
			};
			if (!Number.isSafeInteger(record.uid) || record.uid < 1 || record.children.length !== 1) throw new Error("inspector protocol: invalid Cordis runtime Fiber");
			const uid = record.uid;
			if (state.fiberUids.has(uid)) throw new Error("inspector protocol: Cordis runtime tree repeats a Fiber uid");
			state.fiberUids.add(uid);
			const context = parseNode(record.children[0], state, depth + 1);
			if (context.kind !== "context") throw new Error("inspector protocol: Cordis runtime Fiber child must be a Context");
			return {
				kind: "fiber",
				uid,
				children: [context]
			};
		}
		//#endregion
		//#region lib/types/shared/bridge/messages/query/codec.js
		/** Exact decoders for non-CDP Inspector query frames. */
		/**
		* Test whether a decoded carrier value belongs to the query response protocol.
		* @param value - Decoded carrier value.
		* @returns Whether the query response decoder owns the value.
		*/
		function isInspectorQueryResponseEnvelope(value) {
			return isPlainObject(value) && value.t === "query/response";
		}
		/**
		* Decode one Worker-to-source query response.
		* @param value - Untrusted decoded carrier value.
		* @returns The detached, validated response frame.
		*/
		function parseInspectorQueryResponseFrame(value) {
			const record = exactObject(value, [
				"v",
				"t",
				"sourceId",
				"generation",
				"requestId",
				"outcome"
			], "query response");
			if (record.v !== 0 || record.t !== "query/response") throw new Error("inspector protocol: invalid query response envelope");
			return {
				v: 0,
				t: "query/response",
				sourceId: wireId(record.sourceId, "sourceId"),
				generation: wireId(record.generation, "generation"),
				requestId: wireId(record.requestId, "requestId"),
				outcome: parseOutcome(record.outcome)
			};
		}
		function parseResult(value) {
			if (!isPlainObject(value) || typeof value.op !== "string") throw new Error("inspector protocol: query result must have an op");
			switch (value.op) {
				case "cordis-tree/get":
					exactKeys(value, ["op", "tree"], "Cordis tree query result");
					return {
						op: "cordis-tree/get",
						tree: parseCordisRuntimeTree(value.tree)
					};
				default: throw new Error(`inspector protocol: unknown query result ${JSON.stringify(value.op)}`);
			}
		}
		function parseOutcome(value) {
			if (!isPlainObject(value) || typeof value.ok !== "boolean") throw new Error("inspector protocol: invalid query outcome");
			if (value.ok) {
				exactKeys(value, ["ok", "result"], "successful query outcome");
				return {
					ok: true,
					result: parseResult(value.result)
				};
			}
			exactKeys(value, ["ok", "error"], "failed query outcome");
			const error = exactObject(value.error, ["code", "message"], "query error");
			if (!QUERY_ERROR_CODES.has(error.code) || typeof error.message !== "string") throw new Error("inspector protocol: invalid query error");
			return {
				ok: false,
				error: {
					code: error.code,
					message: error.message
				}
			};
		}
		const QUERY_ERROR_CODES = new Set([
			"invalid-request",
			"stale-source",
			"result-too-large",
			"internal-error"
		]);
		//#endregion
		//#region lib/types/shared/bridge/rpc.js
		/** Shared Host/Client owner of correlated non-CDP query requests. */
		/** Failure deliberately returned by the Worker query handler. */
		var InspectorQueryRemoteError = class extends Error {
			code;
			constructor(code, message) {
				super(message);
				this.code = code;
			}
		};
		/** Correlates requests for one reconnecting Host or Client source. */
		var InspectorQueryConnection = class {
			options;
			pending = /* @__PURE__ */ new Map();
			active;
			nextRequestId = 0;
			closed = false;
			constructor(options) {
				this.options = options;
			}
			/**
			* Admit the source generation acknowledged by the Worker.
			* @param sourceId - Stable source identity.
			* @param generation - Newly accepted transport generation.
			* @param sender - Carrier writer valid for that generation.
			*/
			connect(sourceId, generation, sender) {
				if (this.closed) throw new Error("inspector query connection is closed");
				this.disconnect("Inspector source generation replaced");
				this.active = {
					sourceId,
					generation,
					sender
				};
			}
			/**
			* Execute a query against the currently accepted source generation.
			* @param query - Closed typed query command.
			* @returns The result with the same operation discriminant.
			*/
			request(query) {
				const active = this.active;
				if (this.closed || active === void 0) return Promise.reject(/* @__PURE__ */ new Error("Inspector query transport is not connected"));
				const requestId = inspectorId(`query-${String(++this.nextRequestId)}`, "requestId");
				const frame = {
					v: 0,
					t: "query/request",
					sourceId: active.sourceId,
					generation: active.generation,
					requestId,
					query
				};
				if (jsonByteLength(frame) > this.options.maxFrameBytes) return Promise.reject(/* @__PURE__ */ new Error(`Inspector query request exceeds ${String(this.options.maxFrameBytes)} bytes`));
				return new Promise((resolve, reject) => {
					const timer = setTimeout(() => {
						this.pending.delete(requestId);
						reject(/* @__PURE__ */ new Error(`Inspector query ${query.op} timed out after ${String(this.options.timeoutMs)}ms`));
					}, this.options.timeoutMs);
					this.pending.set(requestId, {
						op: query.op,
						resolve,
						reject,
						timer
					});
					try {
						active.sender.send(frame);
					} catch (error) {
						this.rejectPending(requestId, renderError$1(error));
					}
				});
			}
			/**
			* Consume a decoded carrier value when it is a query response.
			* @param value - Untrusted Worker-to-source value.
			* @returns Whether the value belonged to the query protocol.
			*/
			receive(value) {
				if (!isInspectorQueryResponseEnvelope(value)) return false;
				let frame;
				try {
					frame = parseInspectorQueryResponseFrame(value);
					if (jsonByteLength(frame) > this.options.maxFrameBytes) throw new Error(`inspector protocol: query response exceeds ${String(this.options.maxFrameBytes)} bytes`);
				} catch (error) {
					this.disconnect(`Invalid Inspector query response: ${renderError$1(error).message}`);
					throw error;
				}
				const pending = this.pending.get(frame.requestId);
				if (pending === void 0) return true;
				const active = this.active;
				if (active === void 0 || frame.sourceId !== active.sourceId || frame.generation !== active.generation) {
					this.rejectPending(frame.requestId, /* @__PURE__ */ new Error("Inspector query response source generation does not match"));
					return true;
				}
				if (!frame.outcome.ok) {
					this.rejectPending(frame.requestId, new InspectorQueryRemoteError(frame.outcome.error.code, frame.outcome.error.message));
					return true;
				}
				if (frame.outcome.result.op !== pending.op) {
					this.rejectPending(frame.requestId, /* @__PURE__ */ new Error(`Inspector query response op ${frame.outcome.result.op} does not match ${pending.op}`));
					return true;
				}
				clearTimeout(pending.timer);
				this.pending.delete(frame.requestId);
				pending.resolve(frame.outcome.result);
				return true;
			}
			/**
			* Reject active requests while permitting a later source generation.
			* @param reason - Failure reported to every pending caller.
			*/
			disconnect(reason) {
				this.active = void 0;
				for (const requestId of [...this.pending.keys()]) this.rejectPending(requestId, new Error(reason));
			}
			/**
			* Permanently reject requests and prevent later reconnection.
			* @param reason - Failure reported to every pending caller.
			*/
			close(reason = "Inspector query connection closed") {
				if (this.closed) return;
				this.closed = true;
				this.disconnect(reason);
			}
			rejectPending(requestId, error) {
				const pending = this.pending.get(requestId);
				if (pending === void 0) return;
				clearTimeout(pending.timer);
				this.pending.delete(requestId);
				pending.reject(error);
			}
		};
		function renderError$1(error) {
			return error instanceof Error ? error : new Error(String(error));
		}
		//#endregion
		//#region lib/types/client/bridge/rpc.js
		/** Client-side non-CDP query bridge over the active Worker WebSocket. */
		/** Owns query correlation across reconnecting Client source generations. */
		var ClientBridgeRpc = class extends InspectorQueryConnection {
			/**
			* Connect query writes to one accepted Client WebSocket generation.
			* @param source - Accepted source descriptor.
			* @param socket - Active source WebSocket.
			*/
			connectSocket(source, socket) {
				this.connect(source.sourceId, source.generation, { send: (frame) => {
					if (socket.readyState !== WebSocket.OPEN) throw new Error("Inspector Client query socket is not connected");
					socket.send(JSON.stringify(frame));
				} });
			}
		};
		//#endregion
		//#region lib/types/client/bridge/dispatcher.js
		/** Dispatch of validated Worker frames to browser-realm capability handlers. */
		/**
		* Dispatch one validated Worker frame without exposing transport details to domain adapters.
		* @param frame - Decoded Worker-to-source frame.
		* @param handlers - Browser-realm operations for each frame family.
		*/
		function dispatchBridgeFrame(frame, handlers) {
			switch (frame.t) {
				case "source/accepted":
					handlers.accepted(frame);
					return;
				case "source/append-acknowledged":
					handlers.acknowledged(frame);
					return;
				case "source/resnapshot":
					handlers.resnapshot(frame);
					return;
				case "source/rejected":
					handlers.rejected(frame);
					return;
				case "client-runtime/request":
					handlers.runtime(frame);
					return;
				case "client-runtime/cancel":
					handlers.runtimeCanceled(frame);
					return;
				case "client-runtime/response-acknowledged":
					handlers.runtimeAcknowledged(frame);
					return;
				case "client-runtime/session-closed":
					handlers.runtimeClosed(frame);
					return;
				case "client-console/enable":
					handlers.consoleEnabled(frame);
					return;
				case "client-console/disable":
					handlers.consoleDisabled(frame);
					return;
				case "client-sources/request":
					handlers.sources(frame);
					return;
				case "client-sources/session-closed":
					handlers.sourcesClosed(frame);
					return;
				default: return assertNever(frame);
			}
		}
		function assertNever(value) {
			throw new Error(`Unexpected Worker source frame: ${JSON.stringify(value)}`);
		}
		//#endregion
		//#region lib/types/client/bridge/transport.js
		/** Client observation and Runtime endpoint over the Inspector Worker's ingest WebSocket. */
		/** Reconnecting Client source whose bounded queue never blocks page work. */
		var ClientInspectorSource = class extends InspectorSourceConnection {
			bootstrap;
			sourceCatalog;
			realmSource;
			publisher;
			socket;
			generation;
			accepted = false;
			closed = false;
			suspended = false;
			runtime;
			runtimeRequests = /* @__PURE__ */ new Map();
			console;
			queries;
			lifecycle;
			/** Claimed page identity, unchanged across transport reconnects. */
			get sourceId() {
				return this.realmSource.sourceId;
			}
			onPageHide = () => {
				this.suspended = true;
				this.lifecycle.cancelReconnect();
				this.disconnect("Client page hidden");
			};
			onPageShow = () => {
				if (!this.suspended || this.closed) return;
				this.suspended = false;
				this.connect();
			};
			constructor(bootstrap, label = document.title || "Client", sourceCatalog = discoverInspectorClientSourceCatalog(), realmSource = new ClientRealmSource(label)) {
				super();
				this.bootstrap = bootstrap;
				this.sourceCatalog = sourceCatalog;
				this.realmSource = realmSource;
				this.lifecycle = new ClientBridgeLifecycle(bootstrap.reconnectBaseMs, bootstrap.reconnectMaxMs);
				this.publisher = new ClientBridgePublisher({
					topics: ["*"],
					maxQueuedRecords: bootstrap.maxQueuedRecords,
					maxQueuedBytes: bootstrap.maxQueuedBytes,
					maxRecordsPerFrame: bootstrap.maxRecordsPerFrame,
					maxFrameBytes: bootstrap.maxFrameBytes
				}, bootstrap.maxQueuedBytes);
				this.runtime = new ClientRuntimeExecutor({
					maxObjectsPerSession: bootstrap.maxRuntimeObjectsPerSession,
					maxPropertiesPerResult: bootstrap.maxRuntimePropertiesPerResult,
					maxResponseBytes: bootstrap.maxFrameBytes
				}, (url) => this.sourceCatalog?.scriptKeyForUrl(url));
				this.console = new ClientConsoleObserver(this.runtime, (sessionId, event) => {
					const socket = this.socket;
					const generation = this.generation;
					if (this.closed || !this.accepted || socket?.readyState !== WebSocket.OPEN || generation === void 0) return;
					const frame = {
						v: 0,
						t: "client-console/event",
						sourceId: this.realmSource.sourceId,
						generation,
						sessionId,
						event
					};
					if (!isJsonValue(frame) || jsonByteLength(frame) > this.bootstrap.maxFrameBytes) return;
					try {
						socket.send(JSON.stringify(frame));
					} catch {}
				}, (url) => this.sourceCatalog?.scriptKeyForUrl(url));
				this.queries = new ClientBridgeRpc({
					timeoutMs: bootstrap.queryTimeoutMs,
					maxFrameBytes: bootstrap.maxFrameBytes
				});
				this.connect();
				if (typeof window !== "undefined") {
					window.addEventListener("pagehide", this.onPageHide);
					window.addEventListener("pageshow", this.onPageShow);
				}
			}
			/** Permanently stop reconnecting and close the active source generation. */
			close() {
				if (this.closed) return;
				this.closed = true;
				if (typeof window !== "undefined") {
					window.removeEventListener("pagehide", this.onPageHide);
					window.removeEventListener("pageshow", this.onPageShow);
				}
				this.lifecycle.close();
				try {
					this.disconnect("Client source closed");
				} finally {
					this.console.close();
					this.queries.close("Inspector Client source closed");
					this.publisher.close();
					this.realmSource.close();
				}
			}
			disconnect(reason) {
				const socket = this.socket;
				const generation = this.generation;
				const accepted = this.accepted;
				this.socket = void 0;
				this.generation = void 0;
				this.accepted = false;
				this.console.reset();
				this.cancelRuntimeRequests();
				this.runtime.reset();
				this.queries.disconnect(reason);
				if (socket !== void 0) this.publisher.disconnect(socket);
				try {
					if (socket?.readyState === WebSocket.OPEN && generation !== void 0 && accepted) {
						const frame = {
							v: 0,
							t: "source/close",
							sourceId: this.realmSource.sourceId,
							generation
						};
						socket.send(JSON.stringify(frame));
					}
				} finally {
					socket?.close(1e3, reason);
				}
			}
			connect() {
				if (this.closed || this.suspended) return;
				this.console.reset();
				this.cancelRuntimeRequests();
				this.runtime.reset();
				this.queries.disconnect("Inspector Client source reconnecting");
				const source = this.realmSource.connect(this.sourceCatalog !== void 0);
				const generation = source.generation;
				const socket = new WebSocket(this.bootstrap.endpoint, this.bootstrap.protocol);
				this.socket = socket;
				this.generation = generation;
				this.accepted = false;
				this.publisher.connect(socket, source);
				socket.addEventListener("open", () => {
					if (this.socket !== socket || this.closed) return;
					const frame = {
						v: 0,
						t: "source/open",
						source,
						topics: ["*", ...NETWORK_TOPICS]
					};
					socket.send(JSON.stringify(frame));
				});
				socket.addEventListener("message", (event) => {
					if (this.socket !== socket || typeof event.data !== "string") return;
					try {
						if (new TextEncoder().encode(event.data).byteLength > this.bootstrap.maxFrameBytes) throw new Error(`inspector protocol: Worker frame exceeds ${String(this.bootstrap.maxFrameBytes)} bytes`);
						const value = JSON.parse(event.data);
						if (this.queries.receive(value)) return;
						const frame = parseWorkerSourceFrame(value);
						if (frame.t !== "source/rejected" && (frame.sourceId !== this.realmSource.sourceId || frame.generation !== generation)) return;
						dispatchBridgeFrame(frame, {
							accepted: () => {
								this.accepted = true;
								this.lifecycle.connected();
								this.queries.connectSocket(source, socket);
								this.publisher.accept(socket);
							},
							acknowledged: () => {},
							resnapshot: () => {
								this.publisher.replace(socket);
							},
							rejected: (rejected) => {
								console.error(`[inspector] Client source rejected: ${rejected.message}`);
								socket.close(1008, "source rejected");
							},
							runtime: (request) => {
								this.executeRuntime(socket, generation, request).catch((error) => {
									console.error("[inspector] Client Runtime transport failed:", error);
									socket.close(1011, "Client Runtime transport failed");
								});
							},
							runtimeCanceled: (canceled) => {
								this.cancelRuntime(canceled.sessionId, canceled.requestId);
							},
							runtimeAcknowledged: (acknowledged) => {
								this.acknowledgeRuntime(acknowledged.sessionId, acknowledged.requestId);
							},
							runtimeClosed: (closed) => {
								this.cancelRuntimeSession(closed.sessionId);
								this.console.disable(closed.sessionId);
								this.runtime.closeSession(closed.sessionId);
							},
							consoleEnabled: (enabled) => {
								this.console.enable(enabled.sessionId);
							},
							consoleDisabled: (disabled) => {
								this.console.disable(disabled.sessionId);
							},
							sources: (request) => {
								this.executeSourceRequest(socket, generation, request).catch((error) => {
									console.error("[inspector] Client Sources transport failed:", error);
									socket.close(1011, "Client Sources transport failed");
								});
							},
							sourcesClosed: () => {}
						});
					} catch (error) {
						console.error("[inspector] invalid Worker control frame:", error);
						socket.close(1008, "invalid Worker control frame");
					}
				});
				socket.addEventListener("close", () => {
					if (this.socket !== socket || this.closed) return;
					this.socket = void 0;
					this.accepted = false;
					this.publisher.disconnect(socket);
					this.console.reset();
					this.cancelRuntimeRequests();
					this.runtime.reset();
					this.queries.disconnect("Inspector Client source disconnected");
					this.lifecycle.reconnect(() => {
						this.connect();
					});
				});
				socket.addEventListener("error", () => {});
			}
			async executeRuntime(socket, generation, frame) {
				const controller = new AbortController();
				const operation = {
					controller,
					sessionId: frame.sessionId
				};
				this.runtimeRequests.set(frame.requestId, operation);
				const response = await this.runtime.execute(frame, controller.signal, true);
				if (this.runtimeRequests.get(frame.requestId) !== operation) return;
				if (this.closed || this.socket !== socket || this.generation !== generation || socket.readyState !== WebSocket.OPEN) {
					this.cancelRuntime(frame.sessionId, frame.requestId);
					return;
				}
				socket.send(JSON.stringify(response));
			}
			acknowledgeRuntime(sessionId, requestId) {
				const operation = this.runtimeRequests.get(requestId);
				if (operation === void 0 || operation.sessionId !== sessionId) return;
				this.runtimeRequests.delete(requestId);
				this.runtime.acknowledge(sessionId, requestId);
			}
			cancelRuntime(sessionId, requestId) {
				const operation = this.runtimeRequests.get(requestId);
				if (operation === void 0 || operation.sessionId !== sessionId) return;
				this.runtimeRequests.delete(requestId);
				operation.controller.abort();
				this.runtime.cancel(sessionId, requestId);
			}
			cancelRuntimeSession(sessionId) {
				for (const [requestId, operation] of this.runtimeRequests) {
					if (operation.sessionId !== sessionId) continue;
					operation.controller.abort();
					this.runtime.cancel(sessionId, requestId);
					this.runtimeRequests.delete(requestId);
				}
			}
			cancelRuntimeRequests() {
				for (const [requestId, operation] of this.runtimeRequests) {
					operation.controller.abort();
					this.runtime.cancel(operation.sessionId, requestId);
				}
				this.runtimeRequests.clear();
			}
			async executeSourceRequest(socket, generation, frame) {
				let outcome;
				try {
					if (this.sourceCatalog === void 0) throw new ClientSourceCatalogError("invalid-request", "Client source catalog is unavailable");
					outcome = {
						ok: true,
						result: await this.sourceCatalog.execute(frame.command, this.bootstrap.maxClientSourceBytes)
					};
				} catch (error) {
					outcome = {
						ok: false,
						error: {
							code: error instanceof ClientSourceCatalogError ? error.code : "internal-error",
							message: renderError(error).slice(0, 2048)
						}
					};
				}
				let response = {
					v: 0,
					t: "client-sources/response",
					sourceId: this.realmSource.sourceId,
					generation,
					sessionId: frame.sessionId,
					requestId: frame.requestId,
					outcome
				};
				if (!isJsonValue(response) || jsonByteLength(response) > this.bootstrap.maxFrameBytes) response = {
					...response,
					outcome: {
						ok: false,
						error: {
							code: "result-too-large",
							message: "Client source result exceeds the source-frame byte limit"
						}
					}
				};
				if (this.closed || this.socket !== socket || this.generation !== generation || socket.readyState !== WebSocket.OPEN) return;
				socket.send(JSON.stringify(response));
			}
		};
		function renderError(error) {
			return error instanceof Error ? error.message : String(error);
		}
		//#endregion
		//#region lib/types/client/bridge/controller.js
		/** Browser Client bridge construction for the Cordis plugin entry. */
		/**
		* Start the browser source transport for one validated Host bootstrap.
		* @param bootstrap - Host-injected endpoint and resource limits.
		* @returns The active reconnecting Client source after its tab identity is claimed.
		*/
		async function startInspectorClient(bootstrap) {
			const label = document.title || "Client";
			const realmSource = await ClientRealmSource.claim(label);
			try {
				return new ClientInspectorSource(bootstrap, label, void 0, realmSource);
			} catch (error) {
				realmSource.close();
				throw error;
			}
		}
		//#endregion
		//#region lib/types/shared/dispose.js
		/** Ordered release of Inspector registrations before their source transport closes. */
		/**
		* Join every registration disposer in reverse order, then close the source even after failures.
		* @param disposers - Registrations in acquisition order.
		* @param close - Final transport teardown.
		* @param message - Aggregate failure diagnostic owned by the Host or Client caller.
		* @returns Completion after all cleanup actions have settled.
		* @throws AggregateError containing every failed cleanup action in release order.
		*/
		async function disposeInspectorResources(disposers, close, message) {
			const failures = [];
			for (const dispose of [...disposers].reverse().concat(close)) try {
				await dispose();
			} catch (error) {
				failures.push(error);
			}
			if (failures.length > 0) throw new AggregateError(failures, message);
		}
		//#endregion
		//#region lib/types/client/plugin.js
		/** Client Cordis plugin that publishes browser observations directly to the Inspector Worker. */
		/** Cordis plugin name shared with the Host face. */
		const name = "experimental-inspector";
		/** This transport root has no Client service dependencies. */
		const inject = [];
		/**
		* Mount the Client source, including when the plugin activates after the page loads.
		* @param ctx - Client Cordis context whose page identity and lifecycle own the source.
		* @throws Invalid bootstrap data or a failed service registration; transport setup failures retain reconnect recovery.
		*/
		async function apply(ctx) {
			const session = new InspectorClientSession(ctx);
			ctx.effect(() => () => session.dispose(), "experimental-inspector: Client lifetime");
			ctx.on("connection/reset", () => {
				session.refresh().catch((error) => {
					ctx.logger.warn("experimental-inspector: Client connection failed; reconnect or reload the page to retry", error);
				});
			});
			const injected = globalThis.__GBH_INSPECTOR__;
			if (injected !== void 0) await session.connect(parseInspectorClientBootstrap(injected));
			else await session.refresh();
		}
		/**
		* Owns each source and its tree publisher until replacement or the outer lifetime effect disposes it.
		* Cordis owns service/listener effects; transport setup failures retain the reset listener for retry.
		* Invalid bootstrap data and registration errors reject startup after rollback.
		*/
		var InspectorClientSession = class {
			ctx;
			lifetime = new AbortController();
			pending = Promise.resolve();
			bootstrap;
			release;
			constructor(ctx) {
				this.ctx = ctx;
			}
			refresh() {
				return this.enqueue(() => this.readBootstrap());
			}
			connect(bootstrap) {
				return this.enqueue(() => this.replace(bootstrap));
			}
			async readBootstrap() {
				let response;
				try {
					response = await fetch(INSPECTOR_BOOTSTRAP_ROUTE, { signal: this.lifetime.signal });
				} catch (error) {
					this.connectionFailed(error);
					return;
				}
				if (!response.ok) {
					this.connectionFailed(/* @__PURE__ */ new Error(`Inspector bootstrap failed: HTTP ${response.status}`));
					return;
				}
				const value = await response.json();
				await this.replace(parseInspectorClientBootstrap(value));
			}
			connectionFailed(error) {
				if (this.lifetime.signal.aborted) return;
				this.ctx.logger.warn("experimental-inspector: Client connection failed; reconnect or reload the page to retry", error);
			}
			enqueue(task) {
				const pending = this.pending.then(() => {
					this.lifetime.signal.throwIfAborted();
					return task();
				});
				this.pending = pending.catch((error) => {});
				return pending;
			}
			async replace(bootstrap) {
				this.lifetime.signal.throwIfAborted();
				if (this.bootstrap?.endpoint === bootstrap.endpoint && this.bootstrap.protocol === bootstrap.protocol) return;
				await this.release?.();
				this.release = void 0;
				this.bootstrap = void 0;
				let source;
				try {
					source = await startInspectorClient(bootstrap);
				} catch (error) {
					this.connectionFailed(error);
					return;
				}
				const disposers = [];
				const dispose = () => disposeInspectorResources(disposers, () => {
					source.close();
				}, "experimental-inspector: Client disposal failed");
				try {
					this.lifetime.signal.throwIfAborted();
					disposers.push(publishCordisTree(this.ctx, source, {
						maxNodes: bootstrap.maxCordisNodes,
						maxBytes: bootstrap.maxFrameBytes - 4096
					}));
					disposers.push(this.ctx.provide("inspector", createInspectorService(source)));
					const panel = this.ctx.inject([
						"slots",
						"shortcuts",
						"locale"
					], async (ctx) => {
						const { registerInspectorPage } = await require.async("./client.page.js");
						registerInspectorPage(ctx, source.sourceId);
					});
					disposers.push(() => panel.dispose());
				} catch (error) {
					try {
						await dispose();
					} catch (cleanupError) {
						this.ctx.logger.error("experimental-inspector: Client initialization rollback failed", cleanupError);
					}
					throw error;
				}
				this.bootstrap = bootstrap;
				this.release = dispose;
			}
			async dispose() {
				this.lifetime.abort();
				await this.pending;
				await this.release?.();
				this.release = void 0;
			}
		};
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map

export {};
