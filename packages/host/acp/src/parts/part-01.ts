/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc Lát NGUYÊN VĂN dòng 646–1467 của stock lib/index.js (@deepseek-ai/dsh-acp): ACP host plugin (content/mcp/model-control/codec/updates/session).
 */
// @ts-nocheck

//#region lib/types/session.js
/** One standard ACP session's Agent, configuration, prompt, update, and teardown lifecycle. */
/** Standard invalid-parameter failure with protocol-safe detail. */
function invalidParams$1(detail) {
	return RequestError.invalidParams(void 0, detail);
}
/** Standard internal failure with protocol-safe detail. */
function internalError$1(detail) {
	return RequestError.internalError(void 0, detail);
}
/** Restore the latest logged route before falling back to deployment config. */
function selectionFor(logged, fallback) {
	return logged === void 0 ? fallback : {
		provider: logged.config.provider,
		model: logged.config.model,
		...logged.config.reasoningEffort === void 0 || logged.adapterDefaults?.reasoningEffort === true ? {} : { reasoningEffort: logged.config.reasoningEffort }
	};
}
/**
* Per-session ACP module. It owns the unpublished Agent composition, selected
* route, one-prompt admission slot, ordered standard updates, and memoized
* quiescent teardown.
*/
var AcpSession = class AcpSession {
	ctx;
	notify;
	/** The exact top-level Agent owned by this ACP session. */
	agent;
	modelControl;
	outputTail = Promise.resolve();
	inflight;
	closing;
	pendingSelections = /* @__PURE__ */ new Map();
	constructor(ctx, handle, modelControl, notify) {
		this.ctx = ctx;
		this.notify = notify;
		this.agent = handle.agent;
		this.modelControl = modelControl;
		this.disposeAgent = () => handle.dispose();
	}
	disposeAgent;
	/**
	* Compose a fresh Agent and all requested MCP clients before publication.
	* @param ctx - ACP plugin context with Agent, LLM, and persistence services.
	* @param options - fresh session identity, workspace, route, MCP, and notifier.
	* @returns the fully composed per-session module.
	*/
	static async create(ctx, options) {
		const modelControl = new AcpModelControl(ctx.llm, options.fallbackSelection);
		return new AcpSession(ctx, await ctx.agents.create({
			sessionId: options.sessionId,
			meta: { cwd: options.cwd },
			agentOptions: options.agentOptions,
			signal: options.signal,
			setup: async (agentCtx) => {
				modelControl.install(agentCtx);
				await mountAcpMcpServers(agentCtx, options.mcpServers, options.cwd);
			}
		}), modelControl, options.notify);
	}
	/**
	* Restore a persisted Agent and compose the request's fresh MCP connections.
	* @param ctx - ACP plugin context with Agent, LLM, and persistence services.
	* @param options - persisted identity, workspace, fallback route, MCP, and notifier.
	* @returns the restored per-session module.
	*/
	static async resume(ctx, options) {
		let modelControl;
		const handle = await ctx.agents.resume({
			resumeSessionId: options.sessionId,
			agentOptions: options.agentOptions,
			signal: options.signal,
			setup: async (agentCtx, agent) => {
				modelControl = new AcpModelControl(ctx.llm, selectionFor(agent.session.requestHeader(), options.fallbackSelection));
				modelControl.install(agentCtx);
				await mountAcpMcpServers(agentCtx, options.mcpServers, options.cwd);
			}
		});
		/* v8 ignore start -- a fulfilled Agent resume necessarily ran setup to completion. */
		if (modelControl === void 0) {
			await handle.dispose();
			throw internalError$1("session/resume did not compose model selection");
		}
		/* v8 ignore stop */
		return new AcpSession(ctx, handle, modelControl, options.notify);
	}
	/**
	* Whether this module owns an exact Agent reference.
	* @param agent - Agent observed on a scoped runtime event.
	* @returns true only for this session's owned Agent.
	*/
	owns(agent) {
		return this.agent === agent;
	}
	/**
	* Whether this module owns an exact Session reference.
	* @param session - Session observed on a durable event.
	* @returns true only for this session's owned Session.
	*/
	ownsSession(session) {
		return this.agent.session === session;
	}
	/**
	* Return the complete standard model configuration state.
	* @param signal - optional request cancellation.
	* @returns provider-grouped model and exact-model reasoning options.
	*/
	configOptions(signal) {
		this.assertActive();
		return this.modelControl.options(signal);
	}
	/**
	* Apply one standard configuration option to later ACP turns.
	* @param configId - advertised standard option id.
	* @param value - selected standard option value.
	* @param signal - optional request cancellation.
	* @returns the complete resulting option state.
	*/
	setConfig(configId, value, signal) {
		this.assertActive();
		return this.modelControl.set(configId, value, signal);
	}
	/** Resolve topology state off-chain, then serialize its notification without blocking execution updates. */
	topologyChanged() {
		if (this.closing !== void 0) return;
		this.modelControl.options().then((configOptions) => {
			if (this.closing !== void 0) return;
			const previous = this.outputTail;
			this.outputTail = previous.then(() => this.notify({
				sessionId: this.agent.session.id,
				update: {
					sessionUpdate: "config_option_update",
					configOptions
				}
			})).catch((error) => {
				this.ctx.logger.warn(`acp: config-option update failed: ${errorChain(error)}`);
			});
			/* v8 ignore stop */
		}).catch((error) => {
			this.ctx.logger.warn(`acp: config-option update failed: ${errorChain(error)}`);
		});
		/* v8 ignore stop */
	}
	/**
	* Admit one prompt and settle after the root, descendants, and updates finish.
	* @param params - standard ACP prompt request for this session.
	* @param imageEnabled - connection capability advertised at initialization.
	* @param requestSignal - JSON-RPC request cancellation signal.
	* @returns the correlated standard stop reason after ordered updates drain.
	*/
	async prompt(params, imageEnabled, requestSignal) {
		this.assertActive();
		if (this.inflight !== void 0) throw invalidParams$1("a prompt is already in flight for this session");
		const completion = Promise.withResolvers();
		const admission = Promise.withResolvers();
		const admissionController = new AbortController();
		const inflight = {
			resolve: completion.resolve,
			reject: completion.reject,
			messageId: void 0,
			messageQueued: false,
			turn: void 0,
			endReason: void 0,
			admissionDone: admission.promise,
			finishAdmission: admission.resolve,
			admissionController,
			cancellationDone: Promise.withResolvers(),
			cancelStartedIdle: false,
			settlementStarted: false,
			outputError: void 0,
			agentError: void 0
		};
		this.inflight = inflight;
		const onRequestAbort = () => {
			this.cancelPrompt("ACP prompt request cancelled");
		};
		requestSignal?.addEventListener("abort", onRequestAbort, { once: true });
		/* v8 ignore next -- the SDK dispatches a live signal, then notifies abort through its listener. */
		if (requestSignal?.aborted === true) onRequestAbort();
		try {
			let admissionFailure;
			const promptSelection = this.modelControl.snapshot();
			try {
				if (this.ctx.agents.get(this.agent.id) !== this.agent) throw internalError$1("prompt was not queued: the agent was disposed outside the bridge");
				const content = await admitAcpPrompt(this.ctx, promptSelection, params.prompt, imageEnabled, admissionController.signal);
				admissionController.signal.throwIfAborted();
				if (this.ctx.agents.get(this.agent.id) !== this.agent) throw internalError$1("prompt was not queued: the agent was disposed outside the bridge");
				const message = createUserMessage({
					content,
					source: { kind: "user" }
				});
				inflight.messageId = message.id;
				inflight.messageQueued = true;
				if (promptSelection !== void 0) this.pendingSelections.set(message.id, promptSelection);
				try {
					this.agent.followup(message);
				} catch (error) {
					inflight.messageQueued = false;
					this.pendingSelections.delete(message.id);
					throw error;
				}
			} catch (error) {
				admissionFailure = error;
			} finally {
				inflight.finishAdmission();
			}
			if (inflight.admissionController.signal.aborted) {
				this.settleAfterQuiescence(inflight);
				return { stopReason: await completion.promise };
			}
			if (admissionFailure !== void 0) {
				this.inflight = void 0;
				if (admissionFailure instanceof AcpContentError) throw admissionFailure.kind === "invalid" ? invalidParams$1(admissionFailure.message) : internalError$1(admissionFailure.message);
				if (admissionFailure instanceof RequestError) throw admissionFailure;
				throw internalError$1(`prompt was not queued: ${admissionFailure.message}`);
			}
			this.settleAfterQuiescence(inflight);
			return { stopReason: await completion.promise };
		} finally {
			requestSignal?.removeEventListener("abort", onRequestAbort);
		}
	}
	/** Cancel the active prompt, or autonomous work when no ACP prompt exists. */
	cancel() {
		const inflight = this.inflight;
		this.cancelPrompt("ACP prompt cancelled");
		if (inflight === void 0) this.agent.cancel({ kind: "user" });
	}
	/**
	* Process one durable event and enqueue its standard ACP projections.
	* @param session - exact event-owning Session.
	* @param event - committed durable event.
	*/
	onSessionEvent(session, event) {
		if (event.type === "turn/start" && this.inflight?.turn !== void 0) {
			this.inflight.turn = event.data.turn;
			this.inflight.endReason = void 0;
		}
		try {
			if (event.type === "assistant/message") {
				const inflight = this.inflight?.turn === event.data.turn ? this.inflight : void 0;
				const delivery = this.outputTail.then(async () => {
					for (const update of await assistantUpdates(this.ctx, session, event)) await this.notify({
						sessionId: this.agent.session.id,
						update
					});
				});
				this.outputTail = delivery.catch((error) => {
					const failure = error;
					if (inflight !== void 0) inflight.outputError ??= failure;
					this.ctx.logger.warn(`acp: assistant output conversion failed: ${errorChain(error)}`);
				});
			} else if (event.type === "tool/call") {
				const previous = this.outputTail;
				this.outputTail = previous.then(() => this.notify({
					sessionId: this.agent.session.id,
					update: toolCallUpdate(event)
				})).catch((error) => {
					this.ctx.logger.warn(`acp: tool-call update delivery failed: ${errorChain(error)}`);
				});
			} else if (event.type === "tool/result") {
				const previous = this.outputTail;
				this.outputTail = previous.then(async () => this.notify({
					sessionId: this.agent.session.id,
					update: await toolResultUpdate(this.ctx, event)
				})).catch((error) => {
					this.ctx.logger.warn(`acp: tool-result update delivery failed: ${errorChain(error)}`);
				});
			}
		} finally {
			const inflight = this.inflight;
			if (inflight !== void 0 && event.type === "turn/end" && inflight.turn === event.data.turn) {
				inflight.endReason = event.data.reason;
				inflight.agentError = void 0;
			}
			if (event.type === "turn/end") this.modelControl.releaseTurn(event.data.turn);
		}
	}
	/**
	* Correlate an accepted user message with its Agent turn and pinned route.
	* @param message - claimed durable inbox message.
	* @param turn - allocated Agent turn.
	*/
	onInboxClaimed(message, turn) {
		if (this.inflight !== void 0 && this.inflight.messageId === message.id) this.inflight.turn = turn;
		const selection = this.pendingSelections.get(message.id);
		this.pendingSelections.delete(message.id);
		if (selection !== void 0) this.modelControl.pinTurn(turn, selection);
	}
	/**
	* Correlate an Agent interval failure with the active ACP prompt.
	* @param error - original same-process failure.
	*/
	onAgentError(error) {
		const inflight = this.inflight;
		if (inflight === void 0 || !inflight.messageQueued) return;
		inflight.agentError = new Error(errorChain(error));
		this.settleAfterQuiescence(inflight);
	}
	/**
	* Complete cancelled activity without following a later root driver.
	* @param status - the emitted transition, which may precede a reentrant wake.
	*/
	onAgentStatus(status) {
		const inflight = this.inflight;
		if (inflight === void 0 || !inflight.messageQueued || !inflight.admissionController.signal.aborted) return;
		if (status === "idle" || inflight.cancelStartedIdle) inflight.cancellationDone.resolve(this.outputTail);
	}
	/** Await every update queued before this call. */
	drainUpdates() {
		return this.outputTail;
	}
	/**
	* Cancel, drain, flush, and dispose this session once.
	* @param detail - cancellation detail for any prompt still in admission.
	* @returns the shared quiescent teardown promise.
	*/
	close(detail) {
		if (this.closing !== void 0) return this.closing;
		this.closing = (async () => {
			const failures = [];
			const inflight = this.inflight;
			this.cancelPrompt(detail);
			if (inflight === void 0 || !inflight.messageQueued) this.agent.cancel({ kind: "user" });
			try {
				await inflight?.admissionDone;
				await this.agent.whenIdle();
				await this.outputTail;
			} catch (error) {
				failures.push(new Error("ACP session activity drain failed", { cause: error }));
			}
			const subagents = this.ctx.get("subagents");
			try {
				await subagents?.drainDescendants([this.agent]);
			} catch (error) {
				this.ctx.logger.warn(`acp: subagent teardown failed: ${errorChain(error)}`);
				failures.push(new Error("subagent teardown failed", { cause: error }));
			}
			try {
				await this.ctx.sessions.flush(this.agent.session);
			} catch (error) {
				failures.push(new Error("ACP session persistence flush failed", { cause: error }));
			}
			try {
				await this.disposeAgent();
			} catch (error) {
				failures.push(error);
			}
			this.pendingSelections.clear();
			if (failures.length === 1) throw failures[0];
			/* v8 ignore start -- independent teardown failures can aggregate only under multiple simultaneous provider faults. */
			if (failures.length > 1) throw new AggregateError(failures, `ACP session teardown failed: ${failures.map(errorChain).join("; ")}`);
			/* v8 ignore stop */
		})();
		return this.closing;
	}
	assertActive() {
		if (this.closing !== void 0) throw invalidParams$1(`session is closing: ${this.agent.session.id}`);
	}
	cancelPrompt(detail) {
		const inflight = this.inflight;
		if (inflight === void 0) return;
		const firstCancellation = !inflight.admissionController.signal.aborted;
		if (firstCancellation) inflight.cancelStartedIdle = this.agent.status === "idle";
		inflight.admissionController.abort(new Error(detail));
		this.settleAfterQuiescence(inflight);
		if (!inflight.messageQueued) {
			inflight.cancellationDone.resolve();
			return;
		}
		this.agent.cancel({ kind: "user" });
		if (firstCancellation) {
			const done = inflight.cancellationDone;
			this.agent.whenIdle().then(() => {
				done.resolve(this.outputTail);
			}, done.reject);
		}
	}
	settleAfterQuiescence(inflight) {
		if (inflight.settlementStarted) return;
		inflight.settlementStarted = true;
		(async () => {
			await inflight.admissionDone;
			if (inflight.messageQueued) {
				const subagents = this.ctx.get("subagents");
				const cancelled = inflight.cancellationDone.promise;
				const isCancelled = () => inflight.admissionController.signal.aborted;
				const idleAt = (seq) => this.agent.status === "idle" && this.agent.session.seq === seq;
				while (true) {
					await Promise.race([this.agent.whenIdle(), cancelled]);
					if (isCancelled()) break;
					const idleSeq = this.agent.session.seq;
					const children = await Promise.race([subagents?.waitForChildren(this.agent), cancelled]);
					if (isCancelled()) break;
					if (children || !idleAt(idleSeq)) continue;
					await this.outputTail;
					if (isCancelled() || idleAt(idleSeq)) break;
				}
				if (isCancelled()) await cancelled;
			}
			/* v8 ignore next -- this prompt owns the slot until this exact settlement clears it. */
			if (this.inflight !== inflight) return;
			this.inflight = void 0;
			if (inflight.admissionController.signal.aborted) {
				inflight.resolve("cancelled");
				return;
			}
			if (inflight.outputError !== void 0) {
				inflight.reject(internalError$1(`assistant output delivery failed: ${inflight.outputError.message}`));
				return;
			}
			if (inflight.agentError !== void 0) {
				inflight.reject(internalError$1(`turn failed: ${inflight.agentError.message}`));
				return;
			}
			const end = inflight.endReason;
			if (end === void 0) inflight.resolve("cancelled");
			else if (end.kind === "error") inflight.reject(internalError$1(`turn failed: ${end.error.message}`));
			else inflight.resolve(turnEndToStopReason(end));
		})().catch((error) => {
			if (this.inflight !== inflight) return;
			this.inflight = void 0;
			inflight.reject(internalError$1(`prompt settlement failed: ${errorChain(error)}`));
		});
		/* v8 ignore stop */
	}
};
//#endregion
//#region lib/types/index.js
/**
* Automation-only Agent Client Protocol server over JSON-RPC stdio.
*
* The bridge exposes persistent harness sessions to trusted programmatic
* clients. It carries standard configuration, MCP mounts, prompt content,
* committed semantic updates, cancellation, and one-shot permission decisions;
* presentation and human-interaction features stay with the harness's UI modules.
*
* @module @deepseek-ai/dsh-acp
*/
const DEFAULT_SESSION_LIST_PAGE_SIZE = 100;
const name = "acp";
/** Core services required by the standard automation controls. */
const inject = [
	"agents",
	"llm",
	"sessionPersistence",
	"sessions"
];
/** Preserve invalid-parameter detail in the SDK wire error message. */
function invalidParams(detail) {
	return RequestError.invalidParams(void 0, detail);
}
/** Preserve failed-turn detail; plain handler errors become a generic wire internal error. */
function internalError(detail) {
	return RequestError.internalError(void 0, detail);
}
const Config = Schema.object({
	provider: Schema.string(),
	model: Schema.string(),
	sessionListPageSize: Schema.natural().min(1).default(DEFAULT_SESSION_LIST_PAGE_SIZE)
});
/**
* Mount the automation-only ACP server.
* @param ctx - Cordis context carrying the agent factory and session events.
* @param config - Initial provider/model selection and optional test transport.
*/
function apply(ctx, config) {
	const persistence = ctx.sessionPersistence;
	const logger = ctx.logger;
	const sessionListPageSize = resolveSessionListPageSize(config.sessionListPageSize);
	const sessions = /* @__PURE__ */ new Map();
	const activating = /* @__PURE__ */ new Set();
	let closed = false;
	let imagePromptEnabled = false;
	/** Return the bridge-owned record for an agent, rejecting same-id impostors. */
	const ownedRecord = (agent) => {
		const record = sessions.get(agent.session.id);
		return record?.owns(agent) === true ? record : void 0;
	};
	const assertOpen = () => {
		if (closed) throw internalError("the ACP bridge has been disposed");
	};
	const requireSession = (sessionId) => {
		const record = sessions.get(sessionId);
		if (record === void 0) throw invalidParams(`unknown session: ${sessionId}`);
		return record;
	};
	/** Send one ordered protocol update while containing transport-only failure. */
	const notify = async (notification) => {
		try {
			await conn.notify(methods.client.session.update, notification);
		} catch (error) {
			logger.warn(`acp: session/update failed: ${String(error)}`);
		}
		/* v8 ignore stop */
	};
	ctx.on("session/event", (session, event) => {
		const record = sessions.get(session.header.id);
		if (record?.ownsSession(session) === true) record.onSessionEvent(session, event);
	});
	ctx.on("agent/inbox/claimed", ({ agent, message, turn }) => {
		ownedRecord(agent)?.onInboxClaimed(message, turn);
	});
	ctx.on("agent/error", ({ agent, error }) => {
		ownedRecord(agent)?.onAgentError(error);
	});
	ctx.on("agent/status", ({ agent, status }) => {
		ownedRecord(agent)?.onAgentStatus(status);
	});
	ctx.on("llm/adapters-updated", () => {
		for (const record of sessions.values()) record.topologyChanged();
	});
	ctx.on("approval/request", (request, next) => {
		const record = ownedRecord(request.agent);
		if (record === void 0 || request.callId === void 0) return next();
		const callId = request.callId;
		return record.drainUpdates().then(() => {
			const params = {
				sessionId: record.agent.session.id,
				toolCall: { toolCallId: callId },
				options: [{
					optionId: "allow-once",
					name: "Allow once",
					kind: "allow_once"
				}, {
					optionId: "reject-once",
					name: "Reject",
					kind: "reject_once"
				}]
			};
			return conn.request(methods.client.session.requestPermission, params);
		}).then(({ outcome }) => {
			if (outcome.outcome === "cancelled") return "cancelled";
			return outcome.optionId === "allow-once" ? "allowed-once" : "rejected";
		});
	});
	const implementation = {
		async initialize(_params) {
			imagePromptEnabled = await supportsAcpImagePrompts(ctx, config.provider, config.model);
			return {
				protocolVersion: PROTOCOL_VERSION,
				agentInfo: {
					name: "deepseek-harness-acp",
					version: "0.0.1"
				},
				agentCapabilities: {
					mcpCapabilities: { http: true },
					promptCapabilities: {
						image: imagePromptEnabled,
						audio: false,
						embeddedContext: false
					},
					sessionCapabilities: {
						close: {},
						list: {},
						resume: {}
					}
				},
				authMethods: []
			};
		},
		authenticate(_params) {
			return Promise.resolve();
		},
		async newSession(params, signal) {
			assertOpen();
			validateWorkspaceParams(params);
			const sessionId = brandString(randomUUID());
			let record;
			try {
				record = await AcpSession.create(ctx, {
					sessionId,
					cwd: params.cwd,
					mcpServers: params.mcpServers,
					agentOptions: agentOptions(config),
					fallbackSelection: initialSelection(config),
					signal,
					notify
				});
			} catch (error) {
				if (error instanceof AcpMcpConfigError) throw invalidParams(error.message);
				throw error;
			}
			/* v8 ignore next 4 -- a real stdio close can race an in-flight create. */
			if (closed) {
				await record.close("connection closed during session/new");
				throw internalError("connection closed during session/new");
			}
			sessions.set(sessionId, record);
			try {
				const configOptions = await record.configOptions(signal);
				assertOpen();
				await ctx.sessions.flush(record.agent.session);
				assertOpen();
				return {
					sessionId,
					configOptions
				};
			} catch (error) {
				sessions.delete(sessionId);
				await record.close("session/new activation failed");
				throw error;
			}
		},
		async resumeSession(params, signal) {
			assertOpen();
			validateWorkspaceParams(params);
			const sessionId = brandString(params.sessionId);
			if (sessions.has(sessionId) || activating.has(sessionId) || ctx.sessions.get(sessionId) !== void 0) throw invalidParams(`session is already active: ${sessionId}`);
			activating.add(sessionId);
			return (async () => {
				const persisted = (await persistence.stat(sessionId, { signal }))?.header;
				if (persisted === void 0 || persisted.origin === "subagent" || persisted.parentSession !== void 0) throw invalidParams(`session is not resumable: ${sessionId}`);
				if (!await sameDirectory(persisted.cwd, params.cwd)) throw invalidParams(`session cwd does not match: ${params.cwd}`);
				let record;
				try {
					record = await AcpSession.resume(ctx, {
						sessionId,
						cwd: params.cwd,
						mcpServers: params.mcpServers ?? [],
						agentOptions: agentOptions(config),
						fallbackSelection: initialSelection(config),
						signal,
						notify
					});
				} catch (error) {
					if (error instanceof AcpMcpConfigError) throw invalidParams(error.message);
					throw error;
				}
				/* v8 ignore start -- the persisted header was checked before resume; the factory restores that exact header. */
				if (!await sameDirectory(record.agent.session.header.cwd, params.cwd)) {
					await record.close("session/resume cwd mismatch");
					throw invalidParams(`session cwd does not match: ${params.cwd}`);
				}
				/* v8 ignore stop */
				/* v8 ignore next 4 -- a real stdio close can race an in-flight resume. */
				if (closed) {
					await record.close("connection closed during session/resume");
					throw internalError("connection closed during session/resume");
				}
				sessions.set(sessionId, record);
				try {
					return { configOptions: await record.configOptions(signal) };
				} catch (error) {
					sessions.delete(sessionId);
					await record.close("session/resume option discovery failed");
					throw error;
				}
			})().finally(() => {
				activating.delete(sessionId);
			});
		},
		async listSessions(params, signal) {
			assertOpen();
			if (params.cwd !== void 0 && params.cwd !== null && !isAbsolute(params.cwd)) throw invalidParams(`cwd must be an absolute path: ${params.cwd}`);
			let cursor;
			try {
				cursor = decodeSessionListCursor(params.cursor);
			} catch (error) {
				throw invalidParams(error.message);
			}
			const listed = await persistence.list({ signal });
			const entries = (await Promise.all(listed.map(async ({ header }) => {
				if (sessions.has(header.id) || activating.has(header.id) || ctx.sessions.get(header.id) !== void 0 || header.origin === "subagent" || header.parentSession !== void 0 || header.cwd === void 0 || !isAbsolute(header.cwd)) return void 0;
				if (params.cwd !== void 0 && params.cwd !== null && !await sameDirectory(header.cwd, params.cwd)) return;
				return {
					sessionId: header.id,
					cwd: header.cwd,
					createdAt: header.createdAt
				};
			}))).filter((entry) => entry !== void 0).sort((left, right) => right.createdAt - left.createdAt || compareSessionIds(left.sessionId, right.sessionId));
			const remaining = cursor === void 0 ? entries : entries.filter((entry) => isAfterSessionListCursor(entry, cursor));
			const page = remaining.slice(0, sessionListPageSize);
			const next = remaining.length > page.length ? page.at(-1) : void 0;
			return {
				sessions: page.map(({ sessionId, cwd }) => ({
					sessionId,
					cwd
				})),
				...next === void 0 ? {} : { nextCursor: encodeSessionListCursor(next) }
			};
		},
		async setSessionConfigOption(params, signal) {
			assertOpen();
			const record = requireSession(brandString(params.sessionId));
			try {
				return { configOptions: await record.setConfig(params.configId, params.value, signal) };
			} catch (error) {
				if (error instanceof AcpModelConfigError) throw invalidParams(error.message);
				throw error;
			}
		},
		async closeSession(params) {
			assertOpen();
			const sessionId = brandString(params.sessionId);
			const record = requireSession(sessionId);
			try {
				await record.close("ACP session closed");
			} catch (error) {
				throw internalError(`session close failed: ${errorChain(error)}`);
			} finally {
				if (sessions.get(sessionId) === record) sessions.delete(sessionId);
			}
			return {};
		},
		async prompt(params, requestSignal) {
			assertOpen();
			return requireSession(brandString(params.sessionId)).prompt(params, imagePromptEnabled, requestSignal);
		},
		cancel(params) {
			sessions.get(brandString(params.sessionId))?.cancel();
			return Promise.resolve();
		}
	};
	/* v8 ignore next 4 -- production stdio wiring; tests inject config.stream. */
	const stream = config.stream ?? ndJsonStream(Writable.toWeb(process.stdout), Readable.toWeb(process.stdin));
	const connection = agent({ name: "deepseek-harness-acp" }).onRequest(methods.agent.initialize, ({ params }) => implementation.initialize(params)).onRequest(methods.agent.authenticate, async ({ params }) => {
		await implementation.authenticate(params);
		return {};
	}).onRequest(methods.agent.session.new, ({ params, signal }) => implementation.newSession(params, signal)).onRequest(methods.agent.session.list, ({ params, signal }) => implementation.listSessions(params, signal)).onRequest(methods.agent.session.resume, ({ params, signal }) => implementation.resumeSession(params, signal)).onRequest(methods.agent.session.close, ({ params }) => implementation.closeSession(params)).onRequest(methods.agent.session.setConfigOption, ({ params, signal }) => implementation.setSessionConfigOption(params, signal)).onRequest(methods.agent.session.prompt, ({ params, signal }) => implementation.prompt(params, signal)).onNotification(methods.agent.session.cancel, ({ params }) => implementation.cancel(params)).connect(stream);
	const conn = connection.client;
	let quiescing;
	const quiesce = () => {
		if (quiescing !== void 0) return quiescing;
		closed = true;
		const records = [...sessions.values()];
		quiescing = (async () => {
			const disposals = await Promise.allSettled(records.map((record) => record.close("ACP bridge disposed")));
			for (const record of records)
 /* v8 ignore next -- closed blocks concurrent handlers; each captured record remains mapped until this loop. */
			if (sessions.get(record.agent.session.id) === record) sessions.delete(record.agent.session.id);
			const failures = [];
			for (const result of disposals) if (result.status === "rejected") failures.push(result.reason);
			if (failures.length > 0) {
				const detail = failures.map((failure) => errorChain(failure)).join("; ");
				throw new AggregateError(failures, `ACP agent teardown failed for ${failures.length} session(s): ${detail}`);
			}
		})();
		return quiescing;
	};
	/* v8 ignore start -- production transport rejection and teardown failure. */
	connection.closed.catch((error) => {
		logger.warn(`acp: connection closed with an error: ${String(error)}`);
	}).then(quiesce).catch((error) => {
		logger.warn(`acp: connection-close teardown failed: ${String(error)}`);
	});
	/* v8 ignore stop */
	ctx.effect(() => quiesce, "acp.connection");
}
/**
* Build per-agent options from plugin config without assigning absent optional fields.
* @param config - ACP provider/model configuration.
* @returns the configured fields only.
*/
function agentOptions(config) {
	return {
		...config.provider !== void 0 ? { provider: config.provider } : {},
		...config.model !== void 0 ? { model: config.model } : {}
	};
}
/** Initial session selection when both deployment fields are present. */
function initialSelection(config) {
	return config.provider === void 0 || config.model === void 0 ? void 0 : {
		provider: config.provider,
		model: config.model
	};
}
/** Resolve and validate the deployment-owned session page limit. */
function resolveSessionListPageSize(value) {
	const resolved = value ?? DEFAULT_SESSION_LIST_PAGE_SIZE;
	/* v8 ignore start -- Cordis applies the positive-integer Config schema; this protects direct apply callers. */
	if (!Number.isSafeInteger(resolved) || resolved < 1) throw new Error("acp: sessionListPageSize must be a positive safe integer");
	/* v8 ignore stop */
	return resolved;
}
/** Decode an opaque keyset cursor without assigning meaning to client metadata. */
function decodeSessionListCursor(value) {
	if (value === void 0 || value === null) return void 0;
	if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("session/list cursor is invalid");
	try {
		const decoded = JSON.parse(Buffer$1.from(value, "base64url").toString("utf8"));
		const createdAt = Array.isArray(decoded) ? decoded[0] : void 0;
		const sessionId = Array.isArray(decoded) ? decoded[1] : void 0;
		if (!Array.isArray(decoded) || decoded.length !== 2 || typeof createdAt !== "number" || !Number.isSafeInteger(createdAt) || createdAt < 0 || typeof sessionId !== "string" || sessionId.length === 0) throw new Error("invalid cursor fields");
		if (Buffer$1.from(JSON.stringify(decoded), "utf8").toString("base64url") !== value) throw new Error("non-canonical cursor");
		return {
			createdAt,
			sessionId
		};
	} catch (_invalidCursor) {
		throw new Error("session/list cursor is invalid");
	}
}
/** Encode the last returned ordering key as an opaque continuation token. */
function encodeSessionListCursor(entry) {
	return Buffer$1.from(JSON.stringify([entry.createdAt, entry.sessionId]), "utf8").toString("base64url");
}
/** Test whether an entry follows the cursor in newest-first list order. */
function isAfterSessionListCursor(entry, cursor) {
	return entry.createdAt < cursor.createdAt || entry.createdAt === cursor.createdAt && compareSessionIds(entry.sessionId, cursor.sessionId) > 0;
}
/** Compare opaque session ids by stable UTF-8 bytes, independent of process locale. */
function compareSessionIds(left, right) {
	return Buffer$1.compare(Buffer$1.from(left), Buffer$1.from(right));
}
/** Reject workspace features outside the automation contract. */
function validateWorkspaceParams(params) {
	if (!isAbsolute(params.cwd)) throw invalidParams(`cwd must be an absolute path: ${params.cwd}`);
	if (params.additionalDirectories !== void 0 && params.additionalDirectories !== null && params.additionalDirectories.length > 0) throw invalidParams("additionalDirectories is not supported");
}
/** Compare existing directories by physical identity and missing paths lexically. */
async function sameDirectory(left, right) {
	if (left === void 0) return false;
	try {
		const [realLeft, realRight] = await Promise.all([realpath(left), realpath(right)]);
		return realLeft === realRight;
	} catch (_unresolvablePath) {
		return resolve(left) === resolve(right);
	}
}
//#endregion
export { Config, apply, inject, name };

export {};
