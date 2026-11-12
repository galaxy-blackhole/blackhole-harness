/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/sessions/service.js
		/** Structured session-create failure. */
		var SessionCreateError = class extends Error {
			rpcError;
			requestedSessionId;
			name = "SessionCreateError";
			/**
			* @param rpcError - Host business or folded transport error.
			* @param requestedSessionId - caller-preallocated id used for later stream/list reconciliation.
			*/
			constructor(rpcError, requestedSessionId) {
				super(`session create failed: ${rpcError.code}: ${rpcError.message}`);
				this.rpcError = rpcError;
				this.requestedSessionId = requestedSessionId;
			}
		};
		/** Structured session-fork failure. */
		var SessionForkError = class extends Error {
			rpcError;
			sourceSessionId;
			name = "SessionForkError";
			/**
			* @param rpcError - Host business or folded transport error.
			* @param sourceSessionId - the session the fork was cut from.
			*/
			constructor(rpcError, sourceSessionId) {
				super(`session fork failed: ${rpcError.code}: ${rpcError.message}`);
				this.rpcError = rpcError;
				this.sourceSessionId = sourceSessionId;
			}
		};
		/**
		* Display title projection: durable title, project directory basename, then
		* the raw id.
		*/
		function displayTitleOf(title, cwd, id) {
			if (title !== void 0) return title;
			if (cwd !== void 0 && cwd !== "") {
				const base = workspaceTitleOf(cwd);
				if (base !== "") return base;
			}
			return id;
		}
		/**
		* Increment a trailing fork number while preserving its half-width or
		* full-width parentheses; an unnumbered title starts with ` (1)`.
		* @param title - source session's durable title.
		* @returns the title assigned to the fork child.
		*/
		function increasedForkTitle(title) {
			const ascii = /^(.*?)\((\d+)\)$/u.exec(title);
			if (ascii?.[1] !== void 0 && ascii[2] !== void 0) return `${ascii[1]}(${BigInt(ascii[2]) + 1n})`;
			const fullWidth = /^(.*?)（(\d+)）$/u.exec(title);
			if (fullWidth?.[1] !== void 0 && fullWidth[2] !== void 0) return `${fullWidth[1]}（${BigInt(fullWidth[2]) + 1n}）`;
			return `${title} (1)`;
		}
		/** Source labels are dictionary keys, including names also present on Object.prototype. */
		function freezeRetainedBy(counts) {
			Object.setPrototypeOf(counts, null);
			return Object.freeze(counts);
		}
		const EMPTY_RETAIN_INFO = Object.freeze({
			referenceCount: 0,
			retainedBy: freezeRetainedBy({})
		});
		/** A cancelled waiter releases only its own reference, not the shared opening. */
		async function waitForOpen(opening, signal) {
			if (signal === void 0) return opening;
			const aborted = Promise.withResolvers();
			const onAbort = () => {
				aborted.reject(signal.reason);
			};
			signal.addEventListener("abort", onAbort, { once: true });
			try {
				if (signal.aborted) onAbort();
				await Promise.race([opening, aborted.promise]);
			} finally {
				signal.removeEventListener("abort", onAbort);
			}
		}
		var ClientSessionReference = class {
			sessionId;
			record;
			releaseReference;
			released = new AbortController();
			readiness = Promise.withResolvers();
			ready = this.readiness.promise;
			constructor(sessionId, record, releaseReference) {
				this.sessionId = sessionId;
				this.record = record;
				this.releaseReference = releaseReference;
				this.ready.catch(() => {});
			}
			get binding() {
				if (this.record === void 0 || !this.record.live) throw new Error(`Session reference "${this.sessionId}" is released`);
				return this.record.binding;
			}
			attachOpening(opening, signal) {
				const waitSignal = signal === void 0 ? this.released.signal : AbortSignal.any([this.released.signal, signal]);
				waitForOpen(opening, waitSignal).then(() => {
					try {
						waitSignal.throwIfAborted();
						this.readiness.resolve(this.binding);
					} catch (error) {
						this.readiness.reject(error);
					}
				}, (error) => {
					this.readiness.reject(error);
				});
			}
			release() {
				const reason = /* @__PURE__ */ new Error(`Session reference "${this.sessionId}" is released`);
				const release = this.releaseReference;
				this.released.abort(reason);
				this.readiness.reject(reason);
				this.record = void 0;
				this.releaseReference = void 0;
				release?.();
			}
			[Symbol.dispose]() {
				this.release();
			}
		};
		/** Host catalog and local reference allocator; view selection remains outside the Controller. */
		var ClientSessions = class {
			rootCtx;
			/**
			* The wire schema's own result bound, re-exposed for presentation plugins as
			* injected data. Not per-connection state: the `session.search` response
			* schema caps `items` at this constant, so every transport (fixture included)
			* reports the same number.
			*/
			searchResultLimit = 20;
			/** Catalog metadata and local reference-source projection. */
			list;
			/** The object-layer instance cluster and frame dispatch entry. */
			manager;
			scopes = /* @__PURE__ */ new Map();
			/** Stable per-id sources retained for the Client root lifetime, including across generation replacement. */
			retainObservers = /* @__PURE__ */ new Map();
			scopeDrops = /* @__PURE__ */ new Set();
			closed = false;
			/**
			* @param ctx - client root context (scope fibers mount under it).
			* @param remote - generated Remote namespaces shared with every Session.
			*/
			constructor(rootCtx, remote) {
				this.rootCtx = rootCtx;
				this.manager = new SessionManager(remote);
				this.list = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
					ids: [],
					byId: {},
					phase: "pending",
					projectionsBySession: {}
				});
				const disposeManagerProjection = this.manager.subscribe(() => {
					this.projectList();
				});
				rootCtx.effect(() => async () => {
					this.closed = true;
					disposeManagerProjection();
					const scopes = [...this.scopes];
					this.scopes.clear();
					for (const [, record] of scopes) {
						record.live = false;
						record.session.unbindScope();
					}
					const managerDisposal = this.manager.dispose();
					for (const [id, record] of scopes) {
						this.startScopeDrop(id, record);
						this.publishRetention(id);
					}
					await this.drainScopeDrops();
					await managerDisposal;
				}, "session-controller.client.sessions");
				rootCtx.reflect.provide("sessions", this, void 0);
			}
			retain(target, options) {
				const { source, signal } = options;
				signal?.throwIfAborted();
				if (this.closed) throw new Error("Session Controller is disposed");
				const id = this.manager.resolveTarget(target);
				const reference = this.retainScope(id, source);
				try {
					reference.attachOpening(this.manager.get(id).open(), signal);
					return reference;
				} catch (error) {
					reference.release();
					throw error;
				}
			}
			async using(target, options, operation) {
				const reference = this.retain(target, options);
				try {
					await reference.ready;
					return await operation(reference);
				} finally {
					reference.release();
				}
			}
			retainInfo(id) {
				let observer = this.retainObservers.get(id);
				if (observer === void 0) {
					const listeners = /* @__PURE__ */ new Set();
					observer = {
						listeners,
						published: this.retentionSnapshot(id),
						source: {
							getSnapshot: () => this.retentionSnapshot(id),
							subscribe: (listener) => {
								listeners.add(listener);
								return () => {
									listeners.delete(listener);
								};
							}
						}
					};
					this.retainObservers.set(id, observer);
				}
				return observer.source;
			}
			/**
			* Resolve an already discovered direct-parent address without opening it.
			* Feature plugins use this to avoid Agent-bound RPCs in persisted child views.
			* @param id - possible addressed child id.
			* @returns A retained, catalog-derived, or unknown-mode listed address, without retaining a new selection or scope.
			*/
			subagentAddress(id) {
				return this.manager.subagentAddress(id);
			}
			/**
			* Read projections without starting migration; retry failed or migration-deferred reads.
			* @param sessionId - Session to inspect without opening its conversation.
			*/
			refreshProjections(sessionId) {
				return this.manager.refreshProjections(sessionId);
			}
			/**
			* Refresh the real Session baseline, reusing an in-flight pull.
			* @returns completion of the current or newly started baseline pull.
			*/
			refresh() {
				return this.manager.refreshList();
			}
			/**
			* Search the Host's visible message-content index. Results stay
			* request-local; the list snapshot remains the metadata authority.
			* @param query - non-blank literal phrase.
			* @param signal - cancellation for a superseded search.
			* @returns bounded results or a business/transport error.
			*/
			search(query, signal) {
				return this.manager.search(query, signal);
			}
			/**
			* Apply one Session Controller live-control frame.
			* @param frame - baseline or live control replacement.
			*/
			handleControlFrame(frame) {
				this.manager.handleControlFrame(frame);
			}
			/**
			* Apply one remotely forwarded Session-list addition.
			* @param summary - current Host summary for the added Session.
			*/
			handleSessionAdded(summary) {
				this.manager.handleSessionAdded(summary);
			}
			/**
			* Apply one remotely forwarded Session removal.
			* @param sessionId - removed Session identity.
			*/
			handleSessionRemoved(sessionId) {
				this.manager.handleSessionRemoved(sessionId);
			}
			/**
			* Apply one remotely forwarded running-state change.
			* @param args - Session identity and current Agent running state.
			*/
			handleSessionStatus(...args) {
				this.manager.handleSessionStatus(...args);
			}
			/**
			* Apply one remotely forwarded list-activity change.
			* @param args - Session identity and durable activity timestamp.
			*/
			handleSessionActivity(...args) {
				this.manager.handleSessionActivity(...args);
			}
			/**
			* Apply one remotely forwarded Agent failure.
			* @param args - Session identity and caller-visible failure description.
			*/
			handleSessionError(...args) {
				this.manager.handleSessionError(...args);
			}
			/** Rebuild the Session baseline and every opened window after connection. */
			handleConnected() {
				this.manager.handleConnected();
			}
			/**
			* Create a Host Session and publish its catalog row before resolving.
			* Callers retain the returned identity before borrowing its binding.
			* @param opts - target workspace or directory, an optional blank Session to reuse, and an optional Agent preset.
			* @returns the created or reused session id.
			* @throws {SessionCreateError} with the requested id.
			*/
			async create(opts = {}) {
				const result = await this.manager.create(opts);
				if (!result.ok) throw new SessionCreateError(result.error, opts.sessionId);
				this.projectList();
				return result.value.sessionId;
			}
			/**
			* Fork a session from an exact inclusive prefix of the source (same
			* synchronous-addressability guarantee as {@link ClientSessions.create}:
			* on resolution the child is catalogued and may be explicitly retained).
			* @param opts - source session id, the optional exact inclusive boundary
			*   seq (a real event seq the caller already knows; a cut inside an open
			*   turn is balanced Host-side with synthetic closers, and omission selects
			*   the latest completed-turn prefix), and whether to increment an
			*   inherited durable title before resolving, plus permission to start source migration.
			* @returns the child session id.
			* @throws {SessionForkError} with the source id.
			* @throws {Error} when a requested child-title rename fails after creation.
			*/
			async fork(opts) {
				const sourceTitle = opts.increaseTitle ? this.list.getSnapshot().byId[opts.sessionId]?.title : void 0;
				const result = await this.manager.fork({
					sessionId: opts.sessionId,
					...opts.atSeq === void 0 ? {} : { atSeq: SessionSeq(opts.atSeq) },
					...opts.allowMigration === void 0 ? {} : { allowMigration: opts.allowMigration }
				});
				if (!result.ok) throw new SessionForkError(result.error, opts.sessionId);
				this.projectList();
				const childId = result.value.sessionId;
				opts.onCreated?.(childId);
				if (sourceTitle !== void 0) {
					const renamed = await this.manager.rename(childId, increasedForkTitle(sourceTitle));
					if (!renamed.ok) throw new Error(`fork child rename failed: ${renamed.error.code}: ${renamed.error.message}`);
				}
				return childId;
			}
			/**
			* Borrow an already-retained Agent-scoped Context.
			* @param id - session id (the agent identity — 1:1 same axis).
			* @returns the scoped Context, or undefined without a retained generation.
			*/
			scope(id) {
				return this.scopes.get(id)?.ctx;
			}
			/**
			* Retain a validated Gateway identity synchronously, without history or catalog I/O.
			* @param id - Host-projected Session identity, possibly not yet catalogued.
			* @returns a Gateway-source reference owned by the invocation.
			*/
			retainAgentScope(id) {
				if (this.closed) throw new Error("Session Controller is disposed");
				return this.retainScope(id, "gateway");
			}
			/**
			* Read the Agent scope tag off a context. Service-method boundary: fetch
			* bundles must reach scope resolution through ctx.sessions — a cross-bundle
			* value import of the standalone helper would inline a second module
			* instance whose private tag Symbol never matches.
			* @param ctx - any client context.
			* @returns the session id, or undefined on root contexts.
			*/
			scopeOf(ctx) {
				return scopeOf(ctx);
			}
			/**
			* Resolve the business Session behind an Agent-scoped context — the one
			* hop every scoped consumer (event listeners, per-session controllers)
			* takes from ctx-space into object-space (the client mirror of host
			* `agent.session`). Same service-method boundary as
			* {@link ClientSessions.scopeOf}.
			* @param ctx - an Agent-scoped context.
			* @returns the matching live Session, or undefined for an untagged or ended generation.
			*/
			sessionOf(ctx) {
				const id = scopeOf(ctx);
				if (id === void 0) return void 0;
				const record = this.scopes.get(id);
				return record !== void 0 && scopeIdentityOf(record.ctx) === scopeIdentityOf(ctx) ? record.binding.session : void 0;
			}
			/**
			* Borrow an already-retained binding without extending its lifetime.
			* @param id - Session identity.
			* @returns the live binding, or undefined without a retained generation.
			*/
			binding(id) {
				return this.scopes.get(id)?.binding;
			}
			retainScope(id, source) {
				const record = this.scopes.get(id) ?? this.materializeScope(id);
				const previous = record.retention;
				record.retention = Object.freeze({
					referenceCount: previous.referenceCount + 1,
					retainedBy: freezeRetainedBy({
						...previous.retainedBy,
						[source]: (previous.retainedBy[source] ?? 0) + 1
					})
				});
				const reference = new ClientSessionReference(id, record, () => {
					if (!record.live) return;
					const count = record.retention.referenceCount - 1;
					const { [source]: sourceCount = 0, ...otherSources } = record.retention.retainedBy;
					const retainedBy = sourceCount > 1 ? {
						...otherSources,
						[source]: sourceCount - 1
					} : otherSources;
					record.retention = count === 0 ? EMPTY_RETAIN_INFO : Object.freeze({
						referenceCount: count,
						retainedBy: freezeRetainedBy(retainedBy)
					});
					if (count === 0) this.retireScope(id, record);
					else this.publishRetention(id);
				});
				if (this.list.getSnapshot().byId[id] === void 0 && this.manager.subagentAddress(id) !== void 0) this.projectList();
				this.publishRetention(id);
				return reference;
			}
			retentionSnapshot(id) {
				return this.scopes.get(id)?.retention ?? EMPTY_RETAIN_INFO;
			}
			publishRetention(id) {
				const state = this.list.getSnapshot();
				const row = state.byId[id];
				const retainedBy = this.retentionSnapshot(id).retainedBy;
				if (row !== void 0 && row.retainedBy !== retainedBy) this.list.set({
					...state,
					byId: {
						...state.byId,
						[id]: {
							...row,
							retainedBy
						}
					}
				});
				const observer = this.retainObservers.get(id);
				const snapshot = this.retentionSnapshot(id);
				if (observer === void 0 || observer.published === snapshot) return;
				observer.published = snapshot;
				(0, _deepseek_ai_dsh_client_store.notifySubscribers)(observer.listeners, "[session-controller] reference sources");
			}
			retireScope(id, record, disposeFiber = true) {
				if (!record.live) return;
				record.live = false;
				if (this.scopes.get(id) === record) this.scopes.delete(id);
				record.session.unbindScope();
				const sessionDisposal = this.manager.drop(id, record.session);
				this.projectList();
				this.publishRetention(id);
				this.startScopeDrop(id, record, disposeFiber, sessionDisposal);
			}
			/** Materialize one scope after its caller establishes that the id may be addressed. */
			materializeScope(id) {
				const { fiber, ctx } = createScope(this.rootCtx, id);
				const session = this.manager.get(id);
				session.bindScope(ctx);
				const record = {
					fiber,
					ctx,
					binding: {
						sessionId: id,
						session,
						eventSource: session.eventSource,
						ctx
					},
					session,
					retention: EMPTY_RETAIN_INFO,
					live: true
				};
				this.scopes.set(id, record);
				ctx.effect(() => () => {
					this.retireScope(id, record, false);
				}, "session-controller: exact generation");
				return record;
			}
			/** Project the manager's list snapshot into the store (title derivation is display-only). */
			projectList() {
				const previousById = this.list.getSnapshot().byId;
				const { items, phase, projectionsBySession } = this.manager.getListSnapshot();
				const ids = [];
				const byId = {};
				for (const entry of items) {
					ids.push(entry.sessionId);
					byId[entry.sessionId] = {
						id: entry.sessionId,
						displayTitle: displayTitleOf(entry.title, entry.cwd, entry.sessionId),
						running: entry.running,
						retainedBy: this.retentionSnapshot(entry.sessionId).retainedBy,
						blank: entry.blank,
						updatedAt: entry.updatedAt,
						formatStatus: entry.formatStatus,
						...entry.projectionValues === void 0 ? {} : { projectionValues: entry.projectionValues },
						...entry.title !== void 0 ? { title: entry.title } : {},
						...entry.cwd !== void 0 ? { cwd: entry.cwd } : {},
						...entry.parentSessionId !== void 0 ? { parentId: entry.parentSessionId } : {},
						...entry.origin !== void 0 ? { origin: entry.origin } : {}
					};
				}
				for (const [parentId, projection] of Object.entries(projectionsBySession)) for (const child of projection.values.subagentCatalog ?? []) {
					if (child.mode === "external") continue;
					const childId = child.id;
					const summary = byId[childId];
					const projectionValues = summary?.projectionValues ?? this.manager.projectionValues(childId);
					const projectedTitle = projectionValues?.title;
					const title = typeof projectedTitle === "string" && projectedTitle !== "" ? projectedTitle : void 0;
					const displayTitle = title ?? child.label ?? childId;
					if (summary === void 0) byId[childId] = {
						id: childId,
						displayTitle,
						parentId,
						origin: "subagent",
						running: this.scopes.get(childId)?.session.getSnapshot().running ?? false,
						blank: false,
						updatedAt: 0,
						retainedBy: this.retentionSnapshot(childId).retainedBy,
						...projectionValues === void 0 ? {} : { projectionValues },
						...title === void 0 ? {} : { title }
					};
					else if (summary.displayTitle !== displayTitle || summary.projectionValues !== projectionValues) byId[childId] = {
						...summary,
						displayTitle,
						...projectionValues === void 0 ? {} : { projectionValues }
					};
				}
				for (const [id, record] of this.scopes) {
					if (byId[id] !== void 0) continue;
					const address = this.manager.subagentAddress(id);
					if (address === void 0) continue;
					const previous = previousById[id];
					const snapshot = record.session.getSnapshot();
					const projectionValues = this.manager.projectionValues(id);
					const projectedTitle = projectionValues?.title;
					const title = typeof projectedTitle === "string" && projectedTitle !== "" ? projectedTitle : previous?.title;
					byId[id] = {
						...previous ?? {
							id,
							displayTitle: id,
							updatedAt: 0
						},
						running: snapshot.running,
						retainedBy: record.retention.retainedBy,
						blank: snapshot.blank,
						parentId: address.parentSessionId,
						origin: "subagent",
						...projectionValues === void 0 ? {} : { projectionValues },
						...title === void 0 ? {} : {
							title,
							displayTitle: title
						}
					};
				}
				this.list.set({
					ids,
					byId,
					phase,
					projectionsBySession
				});
			}
			startScopeDrop(id, record, disposeFiber = true, sessionDisposal = this.manager.drop(id, record.session)) {
				const drop = this.dropScope(record, disposeFiber, sessionDisposal);
				this.scopeDrops.add(drop);
				drop.then(() => {
					this.scopeDrops.delete(drop);
				}, () => {
					this.scopeDrops.delete(drop);
				});
			}
			async drainScopeDrops() {
				while (this.scopeDrops.size > 0) await Promise.allSettled([...this.scopeDrops]);
			}
			/** Await the already-withdrawn Session and scoped cleanup to quiescence. */
			async dropScope(record, disposeFiber, sessionDisposal) {
				await Promise.allSettled([sessionDisposal, ...disposeFiber ? [record.fiber.dispose()] : []]);
			}
		};
		//#endregion

export {};
