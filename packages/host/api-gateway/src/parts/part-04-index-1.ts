/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-gateway — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

// __DSH_FRAGMENT_BEGIN__
function __gbh_fragment__() {
//#region lib/types/index.js
/**
* Live Typert Remote dispatch over Cordis Services and registered providers.
* Unary transport and response envelopes belong to Connection; live Remote
* streams use the Gateway-owned WebSocket mux.
* @module @deepseek-ai/dsh-api-gateway
*/
const NEVER_ABORTED_SIGNAL = new AbortController().signal;
const DEFAULT_WEBSOCKET_HEARTBEAT_INTERVAL_MS = 2e3;
const DEFAULT_STREAM_INBOX_BYTES = 262144;
const EMPTY_ASYNC_ITERABLE = { [Symbol.asyncIterator]: () => ({ next: () => Promise.resolve({
	value: void 0,
	done: true
}) }) };
const UPLINK_DONE = {
	value: void 0,
	done: true
};
const SRC_JSON_CODEC = { mode: "src-json" };
/**
* Dispatch failure produced outside the invoked business method. Rides the
* shared Remote failure vocabulary, so its code crosses the wire instead of
* folding to `internal`.
*/
var TypertGatewayError = class extends RemoteError {
	/** Canonical `<namespace>/<method>` endpoint. */
	endpoint;
	/** Affected wire field when the failure is field-specific. */
	field;
	/**
	* Construct a Gateway failure without embedding boundary values in its message.
	* @param code - stable failure category.
	* @param endpoint - canonical Remote endpoint.
	* @param message - correction-oriented diagnostic without sensitive values.
	* @param options - optional field and contained cause.
	*/
	constructor(code, endpoint, message, options = {}) {
		super(code, `typert gateway: ${endpoint}: ${message}`, {
			endpoint,
			...options.field === void 0 ? {} : { field: options.field }
		}, options.cause === void 0 ? void 0 : { cause: options.cause });
		this.name = "TypertGatewayError";
		this.endpoint = endpoint;
		this.field = options.field;
	}
};
/**
* Resolve strict generated definitions or conservative SRC markers against
* current Cordis Services and Typert providers.
* @typert service typertGateway
*/
var TypertGatewayService = class extends Service {
	static inject = ["typert", "remoteAccess"];
	static Config = z.object({
		websocketHeartbeatIntervalMs: z.number().step(1).min(1).max(MAX_TIMER_DELAY_MS).default(DEFAULT_WEBSOCKET_HEARTBEAT_INTERVAL_MS),
		streamInboxBytes: z.number().step(1).min(1).default(DEFAULT_STREAM_INBOX_BYTES)
	});
	/** Carrier adapter shared by the WebSocket mux and local Host transports. */
	wireStream = {
		open: (endpoint, payload, uplink, peer, signal) => this.openWireStream(endpoint, payload, uplink, peer, signal, new AbortController()),
		failure: (error) => rpcError(error)
	};
	srcClaims;
	remoteEvents;
	remoteEventClients = /* @__PURE__ */ new Map();
	pendingRemoteEvents = /* @__PURE__ */ new Map();
	/**
	* Register the Gateway against the active Typert registry.
	* WebSocket admission waits for launcher-owned application readiness when supplied;
	* direct invocation and in-process streams remain available independently.
	* @param ctx - owning Host Context with Typert registry access.
	* @param config - validated Gateway transport configuration.
	*/
	constructor(ctx, config) {
		super(ctx, "typertGateway");
		const resolved = config;
		ctx.on("internal/service", () => {
			this.srcClaims = void 0;
		});
		ctx.inject(["connection"], (connectionCtx) => {
			connectionCtx.connection.rpc.intercept("/api", (endpoint) => this.claimsEndpoint(endpoint), (endpoint, payload, signal, peer) => this.dispatchRpc(endpoint, payload, signal, peer));
		});
		ctx.inject(["connection", "webServer"], (webCtx) => {
			const listen = () => {
				const mux = new RemoteStreamMuxServer((endpoint, payload, uplink, peer, control, window) => this.openWireStream(endpoint, payload, uplink, peer, control.signal, control, window), this.wireStream.failure, resolved.websocketHeartbeatIntervalMs, resolved.streamInboxBytes);
				const releases = /* @__PURE__ */ new Set();
				webCtx.effect(function* () {
					yield async () => {
						await mux.close();
						await Promise.all(releases);
					};
					const route = {
						path: REMOTE_STREAM_MUX_PATH,
						handler: (req, socket, head) => {
							const admission = webCtx.connection.admitConnection(req);
							if ("rejection" in admission) {
								rejectRemoteStreamUpgrade(socket, admission.rejection);
								return;
							}
							const release = () => {
								const done = admission.release().catch((error) => {
									console.error("[api-gateway] Peer release failed:", error);
								});
								releases.add(done);
								done.then(() => {
									releases.delete(done);
								});
							};
							const closed = () => {
								socket.removeListener("error", release);
								release();
							};
							socket.on("error", release);
							socket.once("close", closed);
							if (socket.destroyed) {
								closed();
								return;
							}
							try {
								mux.handleUpgrade(req, socket, head, admission.peer);
							} catch (error) {
								release();
								socket.destroy();
								console.error("[api-gateway] Remote stream upgrade failed:", error);
							}
						}
					};
					yield webCtx.webServer.registerUpgrade(route);
				}, `api-gateway: ${REMOTE_STREAM_MUX_PATH} WebSocket`);
			};
			const ready = webCtx.get("appReady");
			if (ready === void 0) listen();
			else webCtx.effect(() => {
				let closed = false;
				const cancel = ready.onReady(() => {
					if (!closed) listen();
				});
				return () => {
					closed = true;
					cancel();
				};
			}, "api-gateway: application readiness");
		});
	}
	/**
	* Check for an active owner Client event stream, the only kind that can answer forwarded waterfalls.
	* @returns whether an owner stream is open and has not been cancelled.
	*/
	hasLiveClient() {
		for (const client of this.remoteEventClients.values()) if (client.answers && !client.signal.aborted) return true;
		return false;
	}
	/**
	* Register the sole application-selected forwarded-event source.
	* @param source - stream factory installed by the Remote assembly.
	* @param host - stable Host facts included in each Client generation's opening frame.
	* @returns disposer removing this source and cancelling its active streams.
	*/
	registerRemoteEvents(source, host) {
		if (this.remoteEvents !== void 0) throw new Error("typert gateway: forwarded Remote event source is already registered");
		const lifetime = new AbortController();
		const stream = source(lifetime.signal);
		const registration = {
			lifetime,
			done: this.consumeRemoteEvents(stream, lifetime.signal).catch((error) => {
				if (this.remoteEvents?.lifetime !== lifetime || lifetime.signal.aborted) return;
				this.closeRemoteEvents(error);
				this.remoteEvents = void 0;
				lifetime.abort(error);
			}),
			host: { home: host.home }
		};
		this.remoteEvents = registration;
		return async () => {
			if (this.remoteEvents === registration) {
				this.remoteEvents = void 0;
				const error = /* @__PURE__ */ new Error("typert gateway: forwarded Remote event source was removed");
				registration.lifetime.abort(error);
				this.closeRemoteEvents(error);
			}
			await registration.done;
		};
	}
	claimsEndpoint(endpoint) {
		if (endpoint === "$events/result") return true;
		const segments = endpoint.split("/");
		if (segments.length !== 2 || segments[0] === "" || segments[1] === "") return false;
		if (this.ctx.typert.local.get(endpoint) !== void 0 || this.ctx.typert.local.hasSeen(endpoint)) return true;
		this.srcClaims ??= this.collectSrcClaims();
		return this.srcClaims.has(endpoint);
	}
	/**
	* The `resources` readers of a method, read from the root Service's class
	* metadata so a Context method's receiver is not resolved before access is
	* decided; `undefined` when the Service is absent or the method declares none.
	*/
	resourceReaders(descriptor) {
		const receiver = this.ctx.get(descriptor.service);
		if (!isObject(receiver)) return void 0;
		const member = descriptor.implementation ?? descriptor.method;
		return remoteMethods(originalOf(receiver)).find((marker) => marker.method === member)?.resources;
	}
	collectSrcClaims() {
		const claims = /* @__PURE__ */ new Set();
		for (const [serviceKey, definition] of Object.entries(this.ctx.reflect.props)) {
			if (definition.type !== "service") continue;
			const receiver = this.ctx.get(serviceKey);
			if (!isObject(receiver)) continue;
			const original = originalOf(receiver);
			const binding = Reflect.get(original, "typertRemote");
			if (!isObject(binding) || typeof Reflect.get(binding, "namespace") !== "string") continue;
			const namespace = Reflect.get(binding, "namespace");
			for (const candidate of remoteMethods(original)) claims.add(endpointOf(namespace, candidate.exportName ?? candidate.method));
		}
		return claims;
	}
	/**
	* Invoke one live Remote method through strict generated reflection or SRC markers.
	* @param request - decoded endpoint and exact named wire arguments.
	* @returns the business result without output decoding.
	* @throws {@link TypertGatewayError} for dispatch, provider, or boundary failures; lookup-policy and business errors retain identity.
	*/
	async invoke(request) {
		return this.invokePrepared(await this.prepareInvocation(request, new AbortController()));
	}
	async invokePrepared(prepared) {
		if (prepared.descriptor.mode !== void 0) throw new TypertGatewayError("gateway/signature-invalid", prepared.endpoint, "stream Remote methods must be opened through the stream carrier");
		try {
			return await Reflect.apply(prepared.method, prepared.receiver, prepared.args);
		} catch (error) {
			if (prepared.invocation.signal.aborted) throw remoteCancelled(prepared.endpoint, error);
			throw error;
		} finally {
			await prepared.invocation.close();
		}
	}
	/**
	* Open one live stream Remote method without assuming a physical carrier.
	* @param request - decoded endpoint, named wire arguments, and the Client uplink when the carrier has one.
	* @returns a cancellation-aware iterable over the business results.
	*/
	async stream(request) {
		return this.openStream(request, new AbortController());
	}
	/**
	* `control` belongs to the logical stream: a rejected uplink item aborts it
	* with the Remote failure as the reason so the carrier delivers that failure.
	*/
	async openStream(request, control) {
		const prepared = await this.prepareInvocation(request, control);
		if (prepared.descriptor.mode === void 0) {
			await prepared.invocation.close();
			throw new TypertGatewayError("gateway/signature-invalid", prepared.endpoint, "unary Remote methods cannot be opened through the stream carrier");
		}
		let source;
		try {
			source = Reflect.apply(prepared.method, prepared.receiver, prepared.args);
		} catch (error) {
			await prepared.invocation.close();
			if (prepared.invocation.signal.aborted) throw remoteCancelled(prepared.endpoint, error);
			throw error;
		}
		if (!isIterable(source)) {
			await prepared.invocation.close();
			throw new TypertGatewayError("gateway/result-invalid", prepared.endpoint, "stream Remote method did not return Iterable or AsyncIterable", { field: "result" });
		}
		return cancellableStream(source, prepared.endpoint, prepared.invocation);
	}
	async dispatchRpc(endpoint, payload, signal, peer) {
		if (endpoint === "$events/result") try {
			assertPeerLive(peer, endpoint);
			requireInteractions(peer, endpoint);
			if (peer.principal.kind !== "owner") throw new TypertGatewayError("gateway/invocation-unavailable", endpoint, "only owner Peers answer forwarded Remote events");
			const result = parseRemoteEventResultPayload(payload);
			const client = this.remoteEventClients.get(result.clientId);
			if (client === void 0) throw new Error("typert gateway: Remote event result identifies no active event stream");
			if (client.peer !== peer) throw new TypertGatewayError("gateway/interactions-forbidden", endpoint, "Remote event result belongs to another Peer");
			this.receiveRemoteEventResult(client, result);
			return {
				ok: true,
				value: void 0
			};
		} catch (error) {
			return rpcFailure(error);
		}
		return this.invokeRpc(endpoint, payload, signal, peer);
	}
	async openWireStream(endpoint, payload, uplink, peer, signal, control, uplinkWindow) {
		if (endpoint === "$events") {
			releaseUplink(uplink);
			assertPeerLive(peer, endpoint);
			requireInteractions(peer, endpoint);
			return this.openRemoteEvents(payload, signal, peer);
		}
		return this.openStream({
			...remoteRequest(endpoint, payload, signal, peer),
			uplink,
			uplinkWindow
		}, control);
	}
	async *openRemoteEvents(payload, signal, peer) {
		if (!isObject(payload) || !isPlainObject(payload) || Reflect.ownKeys(payload).length !== 1 || !Object.hasOwn(payload, "args") || !isObject(payload.args) || !isPlainObject(payload.args) || Reflect.ownKeys(payload.args).length !== 0) throw new TypertGatewayError("gateway/arguments-invalid", REMOTE_EVENT_STREAM_ENDPOINT, "forwarded Remote event stream requires an empty args object");
		const registration = this.remoteEvents;
		if (registration === void 0) throw new TypertGatewayError("gateway/service-unavailable", REMOTE_EVENT_STREAM_ENDPOINT, "forwarded Remote event source is unavailable");
		const lifetime = AbortSignal.any([
			signal,
			registration.lifetime.signal,
			peer.signal
		]);
		let clientId = randomUUID();
		while (this.remoteEventClients.has(clientId)) clientId = randomUUID();
		const client = {
			peer,
			id: clientId,
			queue: new RemoteEventQueue(),
			signal: lifetime,
			deliveries: /* @__PURE__ */ new Map(),
			principal: peer.principal,
			answers: peer.principal.kind === "owner"
		};
		this.remoteEventClients.set(clientId, client);
		if (client.answers) for (const pending of this.pendingRemoteEvents.values()) this.deliverRemoteEvent(pending, client);
		try {
			yield {
				...REMOTE_EVENT_STREAM_READY,
				clientId,
				host: registration.host
			};
			yield* client.queue.iterate(lifetime);
		} finally {
			this.removeRemoteEventClient(client);
		}
	}
	async consumeRemoteEvents(source, signal) {
		for await (const dispatch of source) {
			if (signal.aborted) {
				if ("context" in dispatch) dispatch.reject(signal.reason);
				return;
			}
			if ("context" in dispatch) this.startRemoteEvent(dispatch);
			else this.broadcastRemoteEvent(dispatch);
		}
		if (!signal.aborted) throw new Error("typert gateway: forwarded Remote event source ended unexpectedly");
	}
	broadcastRemoteEvent(frame) {
		assertRemoteEventFrame(frame);
		const wire = {
			type: "emit",
			event: frame.event,
			args: frame.args
		};
		let resolved = false;
		let resources;
		for (const client of this.remoteEventClients.values()) {
			if (!client.answers) {
				if (!resolved) {
					resources = eventResources(frame.resources, frame.args);
					resolved = true;
				}
				if (resources === void 0) continue;
				if (this.ctx.remoteAccess.decide({
					principal: client.principal,
					action: `event:${frame.event}`,
					resources
				}).kind === "deny") continue;
			}
			client.queue.push(wire);
		}
	}
	startRemoteEvent(source) {
		try {
			assertRemoteEventName(source);
			if (!isRemoteEventAgentId(source.context.agentId)) throw new TypeError("typert gateway: scoped Remote events require a non-empty Agent identity");
			const projected = projectRemoteEventRequest(source.request, source.context.subject);
			let id = randomUUID();
			while (this.pendingRemoteEvents.has(id)) id = randomUUID();
			let releaseContext;
			try {
				const dispose = source.context.value.effect(() => () => {
					this.cancelRemoteEvent(pending, /* @__PURE__ */ new Error("typert gateway: Remote event Agent Context was released"));
				}, `api-gateway: Remote event ${JSON.stringify(source.event)}`);
				releaseContext = () => {
					dispose();
				};
			} catch {
				source.resolve({ kind: "next" });
				return;
			}
			const signals = new Set(projected.signal === void 0 ? [] : [projected.signal]);
			const abort = () => {
				const reason = [...signals].find((signal) => signal.aborted)?.reason;
				this.cancelRemoteEvent(pending, reason instanceof Error ? reason : new Error("typert gateway: Remote event was cancelled", { cause: reason }));
			};
			const pending = {
				id,
				source,
				frame: {
					type: "waterfall",
					event: source.event,
					eventId: id,
					agentId: source.context.agentId,
					request: projected.request
				},
				deliveries: /* @__PURE__ */ new Set(),
				releaseContext,
				releaseSignal: () => {
					for (const signal of signals) signal.removeEventListener("abort", abort);
				}
			};
			this.pendingRemoteEvents.set(id, pending);
			for (const signal of signals) signal.addEventListener("abort", abort, { once: true });
			if ([...signals].some((signal) => signal.aborted)) abort();
			else for (const client of this.remoteEventClients.values()) if (client.answers) this.deliverRemoteEvent(pending, client);
		} catch (error) {
			source.reject(error);
		}
	}
	deliverRemoteEvent(pending, client) {
		pending.deliveries.add(client);
		client.deliveries.set(pending.id, pending);
		client.queue.push(pending.frame);
	}
	receiveRemoteEventResult(client, result) {
		const pending = this.pendingRemoteEvents.get(result.eventId);
		if (pending === void 0 || !pending.deliveries.has(client)) return;
		this.removeRemoteEventDelivery(pending, client);
		if (result.outcome.kind === "result") this.settleRemoteEvent(pending, {
			kind: "result",
			value: result.outcome.value
		});
		else if (result.outcome.kind === "rejected") this.cancelRemoteEvent(pending, restoreRemoteEventRejection(result.outcome.error));
		else if (pending.deliveries.size === 0) this.settleRemoteEvent(pending, { kind: "next" });
	}
	removeRemoteEventDelivery(pending, client) {
		pending.deliveries.delete(client);
		client.deliveries.delete(pending.id);
	}
	removeRemoteEventClient(client) {
		this.remoteEventClients.delete(client.id);
		for (const pending of [...client.deliveries.values()]) this.removeRemoteEventDelivery(pending, client);
		client.queue.end();
	}
	settleRemoteEvent(pending, outcome) {
		this.finishRemoteEvent(pending);
		pending.source.resolve(outcome);
	}
	cancelRemoteEvent(pending, reason) {
		if (this.pendingRemoteEvents.get(pending.id) !== pending) return;
		this.finishRemoteEvent(pending);
		pending.source.reject(reason);
	}
	finishRemoteEvent(pending) {
		this.pendingRemoteEvents.delete(pending.id);
		pending.releaseSignal();
		pending.releaseContext();
		const clients = new Set(pending.deliveries);
		for (const client of clients) this.removeRemoteEventDelivery(pending, client);
		const cancellation = {
			type: "cancel",
			eventId: pending.id
		};
		for (const client of clients) client.queue.push(cancellation);
	}
	closeRemoteEvents(reason) {
		for (const pending of [...this.pendingRemoteEvents.values()]) this.cancelRemoteEvent(pending, reason);
		for (const client of [...this.remoteEventClients.values()]) client.queue.end();
	}
	async invokeRpc(endpoint, payload, signal, peer) {
		try {
			const prepared = await this.prepareInvocation(remoteRequest(endpoint, payload, signal, peer), new AbortController());
			return encodeRpcResult(await this.invokePrepared(prepared), prepared.descriptor.result);
		} catch (error) {
			return rpcFailure(error);
		}
	}
	/** `control` fails the logical stream when an uplink item is rejected; unary calls hand over an inert one. */
	async prepareInvocation(request, control) {
		const endpoint = endpointOf(request.namespace, request.method);
		assertPeerLive(request.peer, endpoint);
		const descriptor = this.resolveDescriptor(request.namespace, request.method, endpoint);
		assertExactArguments(request.args, descriptor, endpoint);
		const validated = validateArguments(descriptor, request.args, endpoint);
		if (request.peer.principal.kind !== "owner") {
			const resources = callResources(this.ctx.typert, this.resourceReaders(descriptor), descriptor, validated, request.signal ?? NEVER_ABORTED_SIGNAL);
			const decision = resources === void 0 ? {
				kind: "deny",
				reason: "resource-invalid"
			} : this.ctx.remoteAccess.decide({
				principal: request.peer.principal,
				action: `${descriptor.namespace}/${descriptor.method}`,
				resources,
				args: validated
			});
			if (decision.kind === "deny") throw new RemoteError("remote-access/denied", `remote access: ${endpoint}: access denied (${decision.reason})`, {
				action: endpoint,
				reason: decision.reason
			});
		}
		const receiverContext = await this.resolveReceiverContext(descriptor, validated, endpoint);
		const receiver = receiverContext.get(descriptor.service);
		if (!isObject(receiver)) throw new TypertGatewayError("gateway/service-unavailable", endpoint, `active Service ${JSON.stringify(descriptor.service)} is unavailable`);
		validateBinding(receiver, descriptor.service, descriptor.namespace, endpoint);
		const args = await Promise.all(descriptor.parameters.map((parameter) => this.resolveParameter(parameter, validated, endpoint)));
		const signal = methodSignal(request, control, descriptor.mode === "stream");
		const invocation = new GatewayInvocation({
			namespace: request.namespace,
			method: request.method,
			args: request.args
		}, descriptor.service, request.peer, signal, {
			source: request.uplink ?? EMPTY_ASYNC_ITERABLE,
			window: request.uplinkWindow,
			codec: descriptor.uplink?.codec ?? SRC_JSON_CODEC,
			endpoint,
			abort: (reason) => {
				control.abort(reason);
			}
		});
		if (descriptor.cancellation !== void 0) args.push(signal);
		const callReceiver = receiverContext.extend({ invocation }).get(descriptor.service);
		const implementation = descriptor.implementation ?? descriptor.method;
		const method = Reflect.get(callReceiver, implementation);
		if (typeof method !== "function") throw new TypertGatewayError("gateway/method-unavailable", endpoint, `active Service ${JSON.stringify(descriptor.service)} has no callable method ${JSON.stringify(implementation)}`);
		return {
			endpoint,
			descriptor,
			receiver: callReceiver,
			args,
			method,
			invocation
		};
	}
	resolveDescriptor(namespace, method, endpoint) {
		const strict = this.ctx.typert.local.get(endpoint);
		if (strict !== void 0) return strict;
		if (this.ctx.typert.local.hasSeen(endpoint)) throw new TypertGatewayError("gateway/definition-unavailable", endpoint, "its strict definition was withdrawn and SRC fallback is forbidden");
		return this.resolveSrcDescriptor(namespace, method, endpoint);
	}
	resolveSrcDescriptor(namespace, method, endpoint) {
		const candidates = [];
		for (const [serviceKey, definition] of Object.entries(this.ctx.reflect.props)) {
			if (definition.type !== "service") continue;
			const receiver = this.ctx.get(serviceKey);
			if (!isObject(receiver)) continue;
			const original = originalOf(receiver);
			const value = Reflect.get(original, "typertRemote");
			if (value === void 0) continue;
			const binding = readBinding(value, original, serviceKey, endpoint);
			if (binding.namespace !== namespace) continue;
			const marker = remoteMethods(original).find((candidate) => (candidate.exportName ?? candidate.method) === method);
			if (marker === void 0) continue;
			candidates.push(this.srcDescriptor(binding, marker, method, endpoint));
		}
		if (candidates.length === 0) throw new TypertGatewayError("gateway/invocation-unavailable", endpoint, "no active Remote method exports this endpoint");
		if (candidates.length > 1) throw new TypertGatewayError("gateway/ambiguous-endpoint", endpoint, `multiple active Services export this endpoint: ${candidates.map((candidate) => candidate.service).sort().join(", ")}`);
		return candidates[0];
	}
	srcDescriptor(binding, marker, method, endpoint) {
		const names = methodParameterNames(binding.service, marker.method, endpoint);
		const signalIndex = names.indexOf("signal");
		if (signalIndex >= 0 && signalIndex !== names.length - 1) throw new TypertGatewayError("gateway/signature-invalid", endpoint, "SRC cancellation parameter signal must be the final parameter", { field: "signal" });
		const cancellation = signalIndex >= 0 ? { parameter: "signal" } : void 0;
		const businessNames = cancellation === void 0 ? names : names.slice(0, -1);
		const parameters = [];
		const wires = /* @__PURE__ */ new Set();
		for (const name of businessNames) {
			const matches = this.ctx.typert.lookups.definitions().filter((definition) => definition.parameter === name);
			if (matches.length > 1) throw new TypertGatewayError("gateway/signature-invalid", endpoint, `parameter ${JSON.stringify(name)} matches multiple lookup providers`, { field: name });
			const match = matches[0];
			const parameter = match === void 0 ? {
				name,
				wire: name,
				source: "json",
				codec: { mode: "src-json" }
			} : {
				name,
				wire: match.wire,
				source: "lookup",
				lookup: match.key,
				codec: { mode: "src-json" }
			};
			if (wires.has(parameter.wire)) throw new TypertGatewayError("gateway/signature-invalid", endpoint, `multiple parameters use wire field ${JSON.stringify(parameter.wire)}`, { field: parameter.wire });
			wires.add(parameter.wire);
			parameters.push(parameter);
		}
		let receiver = { kind: "direct" };
		if (marker.invocation.kind === "context") {
			const provider = this.ctx.typert.contexts.getHost(marker.invocation.context);
			if (provider === void 0) throw new TypertGatewayError("gateway/context-unavailable", endpoint, `Context provider ${JSON.stringify(marker.invocation.context)} is unavailable`);
			if (wires.has(provider.wire)) throw new TypertGatewayError("gateway/signature-invalid", endpoint, `Context identity conflicts with wire field ${JSON.stringify(provider.wire)}`, { field: provider.wire });
			receiver = {
				kind: "context",
				context: marker.invocation.context,
				wire: provider.wire,
				codec: { mode: "src-json" }
			};
		}
		return {
			id: `src:${binding.serviceKey}#${endpoint}`,
			service: binding.serviceKey,
			namespace: binding.namespace,
			method,
			...marker.method === method ? {} : { implementation: marker.method },
			...marker.mode === void 0 ? {} : { mode: marker.mode },
			invocation: receiver,
			parameters,
			...cancellation === void 0 ? {} : { cancellation },
			result: { mode: "src-json" }
		};
	}
	async resolveReceiverContext(descriptor, args, endpoint) {
		if (descriptor.invocation.kind === "direct") return this.ctx;
		const invocation = descriptor.invocation;
		const provider = this.ctx.typert.contexts.getHost(invocation.context);
		if (provider === void 0) throw new TypertGatewayError("gateway/context-unavailable", endpoint, `Context provider ${JSON.stringify(invocation.context)} is unavailable`);
		if (provider.wire !== invocation.wire || invocation.codec.mode === "strict" && provider.wireTypeSymbol !== invocation.codec.typeSymbol) throw new TypertGatewayError("gateway/provider-mismatch", endpoint, `Context provider ${JSON.stringify(invocation.context)} does not match its strict definition`, { field: invocation.wire });
		const identity = decode(invocation.codec, args[invocation.wire], endpoint, invocation.wire);
		let context;
		try {
			context = await provider.resolve(identity);
		} catch (cause) {
			if (remoteErrorOf(cause) !== void 0) throw cause;
			throw new TypertGatewayError("gateway/context-failed", endpoint, `Context provider ${JSON.stringify(invocation.context)} failed`, {
				cause,
				field: invocation.wire
			});
		}
		if (context === void 0) throw new TypertGatewayError("gateway/context-not-found", endpoint, `Context provider ${JSON.stringify(invocation.context)} did not resolve the requested identity`, { field: invocation.wire });
		return context;
	}
	async resolveParameter(parameter, args, endpoint) {
		if (!Object.hasOwn(args, parameter.wire)) return void 0;
		if (parameter.source === "json") return args[parameter.wire];
		const value = decode(parameter.codec, args[parameter.wire], endpoint, parameter.wire);
		const key = parameter.lookup;
		/* v8 ignore next -- registry validation rejects strict descriptors without a key, and SRC derivation always supplies one. */
		if (key === void 0) throw new TypertGatewayError("gateway/lookup-unavailable", endpoint, `lookup parameter ${JSON.stringify(parameter.name)} has no provider key`, { field: parameter.wire });
		const provider = this.ctx.typert.lookups.get(key);
		if (provider === void 0) throw new TypertGatewayError("gateway/lookup-unavailable", endpoint, `lookup provider ${JSON.stringify(key)} is unavailable`, { field: parameter.wire });
		if (provider.wire !== parameter.wire || parameter.codec.mode === "strict" && provider.wireTypeSymbol !== parameter.codec.typeSymbol) throw new TypertGatewayError("gateway/provider-mismatch", endpoint, `lookup provider ${JSON.stringify(key)} does not match its strict definition`, { field: parameter.wire });
		let resolved;
		try {
			resolved = await provider.resolve(value);
		} catch (cause) {
			if (remoteErrorOf(cause) !== void 0) throw cause;
			throw new TypertGatewayError("gateway/lookup-failed", endpoint, `lookup provider ${JSON.stringify(key)} failed`, {
				cause,
				field: parameter.wire
			});
		}
		if (resolved === void 0) throw new TypertGatewayError("gateway/lookup-not-found", endpoint, `lookup provider ${JSON.stringify(key)} did not resolve the requested identity`, { field: parameter.wire });
		return resolved;
	}
};
function encodeRpcResult(value, codec) {
	const attachments = [];
	const writeBytes = (bytes, path) => {
		attachments.push({
			path: [...path],
			bytes
		});
		return null;
	};
	return {
		ok: true,
		value: codec.mode === "strict" ? codec.encode?.(value, writeBytes) ?? value : encodeRuntimeResult(value, writeBytes),
		...attachments.length === 0 ? {} : { attachments }
	};
}
function encodeRuntimeResult(input, writeBytes) {
	const path = [];
	const ancestors = /* @__PURE__ */ new Set();
	const extract = (input, key) => {
		let value = input;
		if (input !== null && typeof input === "object" && !(input instanceof Uint8Array)) {
			const toJSON = Reflect.get(input, "toJSON");
			if (typeof toJSON === "function") value = Reflect.apply(toJSON, input, [key]);
		}
		if (value instanceof Uint8Array) return writeBytes(value, path);
		if (typeof value !== "object" || value === null) return value;
		if (value instanceof Number || value instanceof String || value instanceof Boolean) return value.valueOf();
		if (ancestors.has(value)) throw new TypeError("gateway: circular RPC result");
		ancestors.add(value);
		let copy;
		if (Array.isArray(value)) {
			const items = [];
			for (let index = 0, length = value.length; index < length; index++) items.push(child(value[index], index));
			copy = items;
		} else {
			const fields = {};
			for (const key of Object.keys(value)) {
				const item = Reflect.get(value, key);
				if (key === "toJSON" && typeof item === "function") continue;
				const extracted = child(item, key);
				if (key === "__proto__") Object.defineProperty(fields, key, {
					value: extracted,
					enumerable: true
				});
				else fields[key] = extracted;
			}
			copy = fields;
		}
		ancestors.delete(value);
		return copy;
	};
	const child = (value, key) => {
		if (typeof value !== "object" || value === null) return value;
		path.push(key);
		const extracted = extract(value, String(key));
		path.pop();
		return extracted;
	};
	return extract(input, "value");
}
}
// __DSH_FRAGMENT_END__

export {};
