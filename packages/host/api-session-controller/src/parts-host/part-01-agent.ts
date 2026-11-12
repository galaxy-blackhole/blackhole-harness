/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-session-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/agent.js
/** Agent activation, composition, and model-selection policy owned by API Session. */
var __addDisposableResource$4 = function(env, value, async) {
	if (value !== null && value !== void 0) {
		if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
		var dispose, inner;
		if (async) {
			if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
			dispose = value[Symbol.asyncDispose];
		}
		if (dispose === void 0) {
			if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
			dispose = value[Symbol.dispose];
			if (async) inner = dispose;
		}
		if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
		if (inner) dispose = function() {
			try {
				inner.call(this);
			} catch (e) {
				return Promise.reject(e);
			}
		};
		env.stack.push({
			value,
			dispose,
			async
		});
	} else if (async) env.stack.push({ async: true });
	return value;
};
var __disposeResources$4 = (function(SuppressedError) {
	return function(env) {
		function fail(e) {
			env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
			env.hasError = true;
		}
		var r, s = 0;
		function next() {
			while (r = env.stack.pop()) try {
				if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
				if (r.dispose) {
					var result = r.dispose.call(r.value);
					if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
						fail(e);
						return next();
					});
				} else s |= 1;
			} catch (e) {
				fail(e);
			}
			if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
			if (env.hasError) throw env.error;
		}
		return next();
	};
})(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
	var e = new Error(message);
	return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
/** Cold Session identity absent from persistence. */
var ApiSessionNotFound = class extends Error {};
/** Session identity whose lifecycle belongs to subagent routing. */
var ApiSessionSubagentOwnership = class extends Error {
	sessionId;
	/** @param sessionId - identity reserved to subagent routing. */
	constructor(sessionId) {
		super(`session "${sessionId}" is a subagent session; use subagent delivery`);
		this.sessionId = sessionId;
	}
};
/** Explicit-id creation attempted to adopt a Session under another cwd. */
var ApiSessionCwdConflict = class extends Error {
	sessionId;
	requestedCwd;
	existingCwd;
	constructor(sessionId, requestedCwd, existingCwd) {
		super(existingCwd === void 0 ? `session "${sessionId}" records no cwd and cannot be adopted for "${requestedCwd}"` : `session "${sessionId}" belongs to "${existingCwd}", not "${requestedCwd}"`);
		this.sessionId = sessionId;
		this.requestedCwd = requestedCwd;
		this.existingCwd = existingCwd;
	}
};
/** Reuse of a Session named an Agent preset while the deployment composes no preset roster. */
var ApiSessionPresetConflict = class extends Error {
	sessionId;
	requestedPreset;
	constructor(sessionId, requestedPreset) {
		super(`the deployment composes no agent preset roster, so session "${sessionId}" cannot run preset "${requestedPreset}"`);
		this.sessionId = sessionId;
		this.requestedPreset = requestedPreset;
	}
};
/** A blank Session chosen for reuse started a turn before this Host acquired its writer. */
var ApiSessionStartedSinceObserved = class extends Error {};
/**
* Test whether generic Session routing must leave an identity to subagent routing.
* @param ctx - Host context carrying the Agent ownership registry.
* @param session - attached or live Session whose ownership is tested.
* @param agent - live Agent when one exists for the Session.
* @returns whether subagent routing owns the Session identity.
*/
function hasApiSessionSubagentOwner(ctx, session, agent) {
	if (session.header.origin === "subagent") return true;
	const parentId = session.header.parentSession;
	if (parentId === void 0 || agent === void 0) return false;
	const parent = ctx.agents.get(parentId);
	return parent !== void 0 && ctx.agents.isOwnedBy(agent.id, parent);
}
/**
* Build the stable caller-facing subagent ownership rejection.
* @param sessionId - Session identity owned by subagent routing.
* @returns a stable Session-domain failure.
*/
function apiSessionSubagentOwnershipError(sessionId) {
	return new RemoteError("session/agent-busy", `session "${sessionId}" is owned by subagent routing`, { reason: "use subagent delivery for this child session" });
}
/**
* Inspect one cold Session without repairing, resuming, or publishing it.
* @param ctx - Host context carrying Session persistence.
* @param sessionId - durable Session identity.
* @param signal - optional cancellation for persistence reads.
* @returns the persisted header and complete event prefix.
*/
async function inspectApiSession(ctx, sessionId, signal) {
	try {
		const env_1 = {
			stack: [],
			error: void 0,
			hasError: false
		};
		try {
			const observation = __addDisposableResource$4(env_1, await ctx.sessionQuery.observeSession(sessionId, {
				...signal === void 0 ? {} : { signal },
				projectionMode: "none"
			}), false);
			if (observation.header.cwd === void 0) throw new ApiSessionNotFound(`session "${sessionId}" not found`);
			return {
				meta: observation.header,
				inheritedEventCount: observation.inheritedEventCount,
				events: [...observation.events]
			};
		} catch (e_1) {
			env_1.error = e_1;
			env_1.hasError = true;
		} finally {
			__disposeResources$4(env_1);
		}
	} catch (error) {
		if (error instanceof SessionQueryError && error.code === "SESSION_QUERY_SESSION_NOT_FOUND") throw new ApiSessionNotFound(`session "${sessionId}" not found`);
		throw error;
	}
}
/** Owns every operation that may create, resume, or configure a Web Agent. */
var ApiSessionAgentController = class {
	ctx;
	resumes = /* @__PURE__ */ new Map();
	claims = /* @__PURE__ */ new Map();
	selections = /* @__PURE__ */ new WeakMap();
	imageAdmissionChains = /* @__PURE__ */ new WeakMap();
	/** @param ctx - Host context carrying Agent, model, persistence, and Typert services. */
	constructor(ctx) {
		this.ctx = ctx;
		ctx.typert.lookups.configure("agent", async (sessionId) => {
			const found = await this.resolveAgent(sessionId);
			if ("error" in found) throw found.error;
			return found.agent;
		});
		ctx.typert.lookups.configure("session", async (sessionId) => {
			const found = await this.resolveAgent(sessionId);
			if ("error" in found) throw found.error;
			return found.agent.session;
		});
		ctx.typert.contexts.configureHost("agent", async (sessionId) => {
			const found = await this.resolveAgent(sessionId);
			if ("error" in found) throw found.error;
			return found.agent.ctx;
		});
	}
	/**
	* Resolve or resume one ordinary Session, deduplicating concurrent resumes.
	* @param sessionId - ordinary Session identity.
	* @returns the live Agent or a stable Session-domain failure.
	*/
	async resolveAgent(sessionId) {
		return this.resolve(sessionId);
	}
	/**
	* Resolve one ordinary Session from an already-retained exact observation.
	* @param observation - Host-owned observation whose preparation stays pinned through setup.
	* @returns the live Agent or a stable Session-domain failure.
	*/
	async resolveObservedAgent(observation) {
		return this.resolve(observation.header.id, observation);
	}
	async resolve(sessionId, observation) {
		const live = this.liveAgent(sessionId);
		if (live !== void 0) return live;
		const attached = this.ctx.sessions.get(sessionId);
		if (attached !== void 0 && hasApiSessionSubagentOwner(this.ctx, attached, void 0)) return { error: apiSessionSubagentOwnershipError(sessionId) };
		let resume = this.resumes.get(sessionId);
		if (resume === void 0) {
			resume = this.resume(sessionId, observation).finally(() => {
				this.resumes.delete(sessionId);
			});
			this.resumes.set(sessionId, resume);
		}
		try {
			const agent = await resume;
			return this.liveAgent(sessionId) ?? { agent };
		} catch (error) {
			if (error instanceof ApiSessionNotFound) return { error: new RemoteError("session/not-found", error.message, { sessionId }) };
			if (error instanceof ApiSessionSubagentOwnership) return { error: apiSessionSubagentOwnershipError(error.sessionId) };
			const raced = this.liveAgent(sessionId);
			if (raced !== void 0) return raced;
			const racedSession = this.ctx.sessions.get(sessionId);
			if (racedSession !== void 0 && hasApiSessionSubagentOwner(this.ctx, racedSession, void 0)) return { error: apiSessionSubagentOwnershipError(sessionId) };
			if (error instanceof Error && error.name === "SessionAlreadyOwnedError") return { error: new RemoteError("session/writer-held", error.message, { sessionId }) };
			return { error: new RemoteError("gateway/internal", `resume failed for session "${sessionId}": ${String(error)}`, {}) };
		}
	}
	/**
	* Create a Session for a new conversation, reusing the named blank Session
	* while it is still reusable. A reused Session runs the requested preset, or
	* the configured default when the request names none; the preset it recorded
	* is not resolved, and a change is logged as `agent-preset/selected` before
	* the Agent is published. A named Session that has started a turn, fails the
	* caller's placement rule, or is written by another owner stays unchanged,
	* and a new Session is created instead. Requests naming one identity run in
	* arrival order, including their preset resolution, and check the named
	* Session's directory and ownership before resolving the preset.
	* @param request - optional Session to reuse, directory, preset, and placement rule.
	* @returns the reused or created Session and the preset it ran when this request finished.
	* @throws ApiSessionCwdConflict when the named Session belongs to another directory.
	* @throws ApiSessionSubagentOwnership when subagent routing owns the named Session.
	* @throws RemoteError `agent-preset/not-found` or `agent-preset/invalid` for the requested or default preset.
	* @throws ApiSessionPresetConflict when no roster is composed and the request names a preset for a reused Session.
	*/
	async createSession(request) {
		const named = request.sessionId;
		if (named === void 0) return this.created(await this.createMinted(request.cwd, await this.composeAgent(request.agentPreset)));
		return this.inOrder(named, async () => this.created(await this.claim(named, request)));
	}
	/**
	* Install or return the Session-local model selection used by prompt assembly.
	* @param agent - live Agent that owns the selection.
	* @returns the installed mutable selection reference.
	*/
	selectionFor(agent) {
		const installed = this.selections.get(agent);
		if (installed !== void 0) return installed;
		const projectionState = this.ctx.sessionProjections.stateOf(agent.session, "modelSelection");
		if (projectionState === void 0) throw new Error("api-session: required modelSelection projection is not registered");
		let picked = projectionState.pending === null ? void 0 : agentModelSelection(projectionState.pending);
		const defaultModel = this.ctx.agentDefaultModel;
		const selection = {
			get current() {
				if (picked !== void 0) return picked;
				const loggedHeader = agent.session.requestHeader();
				if (loggedHeader === void 0) return defaultModel.currentSelection();
				const logged = loggedHeader.config;
				return {
					provider: logged.provider,
					model: logged.model,
					...logged.reasoningEffort === void 0 || loggedHeader.adapterDefaults?.reasoningEffort === true ? {} : { reasoningEffort: logged.reasoningEffort }
				};
			},
			set current(next) {
				picked = next;
			},
			consume(provider, model, reasoningEffort) {
				if (picked?.provider !== provider || picked.model !== model || picked.reasoningEffort !== reasoningEffort) return false;
				picked = void 0;
				return true;
			},
			assembled: void 0
		};
		installModelSelection(agent.ctx, selection);
		this.selections.set(agent, selection);
		return selection;
	}
	/**
	* Commit and cache one validated selection for the next prompt assembly.
	* @param agent - live Agent that owns the selection.
	* @param selection - validated selection to record and apply.
	*/
	selectForNextRequest(agent, selection) {
		agent.session.append("model/selection", selection);
		this.selectionFor(agent).current = selection;
	}
	/**
	* Let a matching durable request header retire the execution cache.
	* @param agent - live Agent whose request was recorded.
	* @param provider - provider route used by the request.
	* @param model - provider-owned model used by the request.
	* @param reasoningEffort - adapter-owned effort used by the request.
	* @returns whether the pending selection was consumed.
	*/
	consumeSelection(agent, provider, model, reasoningEffort) {
		return this.selections.get(agent)?.consume(provider, model, reasoningEffort) ?? false;
	}
	/**
	* Read the current Agent preset from the Session projection.
	* @param session - live Session whose projection state is available.
	* @returns the current preset, or undefined when the capability is absent.
	*/
	presetForSession(session) {
		return this.ctx.sessionProjections.stateOf(session, "agentPreset") ?? void 0;
	}
	/**
	* Serialize image admission and model selection for one Agent.
	* @param agent - live Agent that owns the serialization chain.
	* @param operation - asynchronous operation admitted after prior work settles.
	* @returns the operation result or rejection.
	*/
	serializeImageAdmission(agent, operation) {
		const result = (this.imageAdmissionChains.get(agent) ?? Promise.resolve()).then(operation);
		this.imageAdmissionChains.set(agent, result.then(() => void 0, () => void 0));
		return result;
	}
	/**
	* Resolve the preset id and pre-publication Agent setup for a create or resume.
	* @param presetId - requested preset or the configured default when omitted.
	* @returns the resolved preset identity and Agent setup callback.
	*/
	async composeAgent(presetId) {
		const presets = this.ctx.get("agentPresets");
		if (presets === void 0) return { setup: (_agentCtx, agent) => {
			this.installSelection(agent);
		} };
		const resolvedId = (await presets.resolve(presetId)).id;
		return {
			agentPreset: resolvedId,
			setup: async (agentCtx, agent) => {
				this.installSelection(agent);
				await presets.mount(agentCtx, resolvedId);
			}
		};
	}
	liveAgent(sessionId) {
		const agent = this.ctx.agents.get(sessionId);
		if (agent === void 0) return void 0;
		return hasApiSessionSubagentOwner(this.ctx, agent.session, agent) ? { error: apiSessionSubagentOwnershipError(sessionId) } : { agent };
	}
	async resume(sessionId, supplied) {
		if (supplied !== void 0) return this.resumeObserved(sessionId, supplied);
		try {
			const env_2 = {
				stack: [],
				error: void 0,
				hasError: false
			};
			try {
				const observation = __addDisposableResource$4(env_2, await this.ctx.sessionQuery.observeSession(sessionId), false);
				return await this.resumeObserved(sessionId, observation);
			} catch (e_2) {
				env_2.error = e_2;
				env_2.hasError = true;
			} finally {
				__disposeResources$4(env_2);
			}
		} catch (error) {
			if (error instanceof SessionQueryError && error.code === "SESSION_QUERY_SESSION_NOT_FOUND") throw new ApiSessionNotFound(`session "${sessionId}" not found`);
			throw error;
		}
	}
	async resumeObserved(sessionId, observation) {
		if (observation.header.id !== sessionId || observation.header.cwd === void 0) throw new ApiSessionNotFound(`session "${sessionId}" not found`);
		if (hasApiSessionSubagentOwner(this.ctx, { header: observation.header }, void 0)) throw new ApiSessionSubagentOwnership(sessionId);
		const composition = await this.composeAgent(this.presetForObservation(observation));
		const published = this.ctx.sessions.get(sessionId);
		const live = this.ctx.agents.get(sessionId);
		if (published !== void 0 && hasApiSessionSubagentOwner(this.ctx, published, live)) throw new ApiSessionSubagentOwnership(sessionId);
		return (await this.ctx.agents.resume({
			resumeSessionId: sessionId,
			agentOptions: this.agentOptions(),
			setup: composition.setup
		})).agent;
	}
	async inOrder(sessionId, operation) {
		const result = (this.claims.get(sessionId) ?? Promise.resolve()).then(operation);
		const settled = result.then(() => void 0, () => void 0);
		this.claims.set(sessionId, settled);
		try {
			return await result;
		} finally {
			if (this.claims.get(sessionId) === settled) this.claims.delete(sessionId);
		}
	}
	/** @returns the reused Session, a new Session under `sessionId` when none is stored, or a new Session under a minted identity. */
	async claim(sessionId, request) {
		const attached = this.ctx.sessions.get(sessionId);
		const live = this.ctx.agents.get(sessionId);
		if (attached !== void 0 && hasApiSessionSubagentOwner(this.ctx, attached, live)) throw new ApiSessionSubagentOwnership(sessionId);
		if (live !== void 0) {
			if (live.session.header.cwd !== request.cwd) throw new ApiSessionCwdConflict(live.id, request.cwd, live.session.header.cwd);
			const composition = await this.composeAgent(request.agentPreset);
			return await this.reuseLive(live, request, composition) ?? this.createMinted(request.cwd, composition);
		}
		let observation;
		try {
			observation = await this.ctx.sessionQuery.observeSession(sessionId);
		} catch (error) {
			if (!(error instanceof SessionQueryError) || error.code !== "SESSION_QUERY_SESSION_NOT_FOUND") throw error;
			return this.createAgent(sessionId, request.cwd, await this.composeAgent(request.agentPreset));
		}
		let reusable;
		{
			const env_3 = {
				stack: [],
				error: void 0,
				hasError: false
			};
			try {
				const observed = __addDisposableResource$4(env_3, observation, false);
				if (hasApiSessionSubagentOwner(this.ctx, { header: observed.header }, void 0)) throw new ApiSessionSubagentOwnership(sessionId);
				if (observed.header.cwd !== request.cwd) throw new ApiSessionCwdConflict(sessionId, request.cwd, observed.header.cwd);
				reusable = request.reusable(sessionId) && !observed.events.some((event) => event.type === "turn/start");
			} catch (e_3) {
				env_3.error = e_3;
				env_3.hasError = true;
			} finally {
				__disposeResources$4(env_3);
			}
		}
		const composition = await this.composeAgent(request.agentPreset);
		if (!reusable) return this.createMinted(request.cwd, composition);
		this.assertPresetApplicable(sessionId, request.agentPreset);
		try {
			return (await this.ctx.agents.resume({
				resumeSessionId: sessionId,
				agentOptions: this.agentOptions(),
				setup: this.reuseSetup(composition)
			})).agent;
		} catch (error) {
			if (error instanceof ApiSessionStartedSinceObserved) return this.createMinted(request.cwd, composition);
			if (!(error instanceof Error) || error.name !== "SessionAlreadyOwnedError") throw error;
			return this.ctx.agents.get(sessionId) === void 0 ? this.createMinted(request.cwd, composition) : this.claim(sessionId, request);
		}
	}
	/** @returns the live blank Session under the requested preset, or undefined when it cannot be reused. */
	async reuseLive(live, request, composition) {
		if (!request.reusable(live.id) || !this.isBlank(live.session)) return void 0;
		this.assertPresetApplicable(live.id, request.agentPreset);
		const current = this.presetForSession(live.session);
		const presets = this.ctx.get("agentPresets");
		const target = composition.agentPreset;
		if (presets === void 0 || target === void 0 || target === current) return live;
		try {
			await presets.select(live, target);
		} catch (error) {
			if (remoteErrorOf(error)?.code !== "agent-preset/locked") throw error;
			return;
		}
		return live;
	}
	/** Setup that re-checks blankness under the acquired writer, then records a preset change before publication. */
	reuseSetup(composition) {
		return async (agentCtx, agent) => {
			if (!this.isBlank(agent.session)) throw new ApiSessionStartedSinceObserved();
			const commit = await composition.setup(agentCtx, agent);
			const target = composition.agentPreset;
			if (target !== void 0 && this.presetForSession(agent.session) !== target) agent.session.append("agent-preset/selected", { agentPreset: target });
			return commit;
		};
	}
	/** Whether no turn has started, by the predicate the preset registry's `select` enforces. */
	isBlank(session) {
		const boundary = this.ctx.sessionProjections.stateOf(session, "turnBoundary");
		return boundary === void 0 || boundary.openTurnStartSeq === null && boundary.lastTurn === 0;
	}
	/** Without a roster, reuse cannot apply a named preset. */
	assertPresetApplicable(sessionId, requested) {
		if (requested === void 0 || this.ctx.get("agentPresets") !== void 0) return;
		throw new ApiSessionPresetConflict(sessionId, requested);
	}
	created(agent) {
		return {
			agent,
			agentPreset: this.presetForSession(agent.session)
		};
	}
	createMinted(cwd, composition) {
		return this.createAgent(brandString(`session-${randomUUID()}`), cwd, composition);
	}
	async createAgent(sessionId, cwd, composition) {
		try {
			await mkdir(cwd, { recursive: true });
		} catch (error) {
			throw new Error(`failed to ensure project directory "${cwd}": ${String(error)}`, { cause: error });
		}
		return (await this.ctx.agents.create({
			sessionId,
			agentOptions: this.agentOptions(),
			meta: {
				cwd,
				...composition.agentPreset === void 0 ? {} : { agentPreset: composition.agentPreset }
			},
			setup: composition.setup
		})).agent;
	}
	agentOptions() {
		const { provider, model } = this.ctx.agentDefaultModel.currentSelection();
		return {
			provider,
			model
		};
	}
	installSelection(agent) {
		this.selectionFor(agent);
	}
	/**
	* Read the current Agent preset from an all-projections observation.
	* @param observation - exact Session observation carrying its projection snapshot.
	* @returns the current preset, or undefined when the capability is absent.
	*/
	presetForObservation(observation) {
		if (observation.projections === void 0) throw new Error("api-session: Agent activation requires a projected Session observation");
		return observation.projections.values.agentPreset ?? void 0;
	}
};
function agentModelSelection(selection) {
	return {
		provider: selection.provider,
		model: selection.model,
		...selection.reasoningEffort === void 0 ? {} : { reasoningEffort: ReasoningEffortId(selection.reasoningEffort) }
	};
}
//#endregion

export {};
