/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/sessions/session.js
		function projectionsBaseline(value) {
			return {
				...value,
				asOfSeq: value.asOfSeq === -1 ? -1 : SessionSeq(value.asOfSeq)
			};
		}
		const HISTORY_PAGE_OPTIONS = {
			maxMessages: 500,
			turnWindow: {
				minMessages: 50,
				minTurns: 2
			}
		};
		const JUMP_PAGE_OPTIONS = {
			...HISTORY_PAGE_OPTIONS,
			turnWindow: {
				...HISTORY_PAGE_OPTIONS.turnWindow,
				minMessages: 200
			}
		};
		/**
		* Owns a session's event window, lifecycle state, and observable
		* snapshot. React bindings remain outside this data layer. Features see only
		* the {@link SessionFace} slice (ISession verbs + the snapshot source); the
		* remaining public members are Session Controller internals.
		*/
		var Session = class {
			sessionId;
			remote;
			options;
			baseSeq = SessionLogOffset(0);
			hasMore = false;
			openState = "cold";
			openError = null;
			openPromise = null;
			/** Bumped by stream replacement to invalidate an in-flight doOpen. Stale
			*  passes drop all writes once the generation moves on. */
			openGeneration = 0;
			loadingOlder = false;
			/** Shared low-water target of the running jump loop; null when no jump is paging. */
			jumpTargetSeq = null;
			/** The running jump loop's completion, shared by retargeting callers. */
			jumpPromise = null;
			pendingHistory = null;
			stopObservingInbox;
			assistantStream = new ClientAssistantStream();
			running = false;
			address;
			parentAvailable;
			/**
			* Sticky send marker, private input of the composerPhase derivation: set
			* synchronously before prompt()'s first await, never reset — the blank →
			* engaging edge of the phase machine (see ComposerPhase).
			*/
			promptAttempted = false;
			/** A first accepted prompt stays in the engaging phase until its turn is observable. */
			firstPromptPendingTurn = false;
			/** New Session display state; unknown bare sessions begin conservatively blank. */
			blankBit = true;
			removed = false;
			promptError = null;
			lastAgentError = null;
			/** Local submission echoes, insertion-ordered (see SessionSnapshot.pendingSubmissions). */
			pendingSubmissions = [];
			/** Per-echo settlement state; `retiring` latches the first observation so a
			*  Inbox projection and its durable event cannot both retire one echo. */
			submissionSettlements = /* @__PURE__ */ new Map();
			/** Owns the addressed page/follow lifecycle while this Session is open. */
			events;
			/**
			* Per-session projection value store (push model; see the session-projection
			* subsystem page, docs/subsystems/session-projection.md): finished whole
			* values computed on the Host, seeded by the tail page's
			* projections block and updated by Session Controller control frames;
			* Host-sequenced writes merge under higher-seq-wins and cached list blocks
			* yield to them (projection-store.ts). Keys are read via `projections.faceOf(key)`
			* (the useProjection resolution face); the conversation snapshot never
			* carries projection values, and no client-side domain folding exists.
			* Manager-owned when constructed through SessionManager (frames route and
			* the store outlives instantiation, the title-snapshot precedent); a bare
			* construction gets a private store.
			*/
			projections;
			/** Contiguous history and live tail consumed by Conversation assembly. */
			eventSource = new MutableSessionEventSource();
			snapshotCache;
			notifier;
			/**
			* Agent-scoped cordis context, bound once by ClientSessions when it
			* mints the scope (the client mirror of the host Agent's loopCtx). The
			* Session dispatches its own scoped events through it; undefined means
			* unbound (bare object-layer construction) or already pruned — both skip
			* dispatch-dependent behavior rather than fail.
			*/
			actx;
			/**
			* @param sessionId - Host session identity (client sessions are always Host-born).
			* @param remote - generated Remote namespaces this session calls.
			* @param options - optional manager-owned state observers.
			*/
			constructor(sessionId, remote, options = {}) {
				this.sessionId = sessionId;
				this.remote = remote;
				this.options = options;
				this.projections = options.projections ?? new ProjectionValueStore();
				this.address = options.address;
				this.parentAvailable = options.parentAvailable;
				this.notifier = new Notifier(() => {
					this.snapshotCache = this.buildSnapshot();
				});
				this.snapshotCache = this.buildSnapshot();
				this.stopObservingInbox = this.projections.faceOf("inbox").subscribe(() => {
					this.observeSubmissionInbox();
				});
			}
			/**
			* Bind the Agent-scoped context minted by ClientSessions (single write;
			* a second bind is a wiring error and throws). Direction stays one-way at
			* this binding boundary: consumers still reach the Session via `sessions.sessionOf`,
			* while the Session holds its own dispatch point (host Agent.loopCtx
			* mirror).
			* @param actx - the agent's scoped context.
			*/
			bindScope(actx) {
				if (this.actx !== void 0) throw new Error(`session ${this.sessionId} already has a bound scope`);
				this.actx = actx;
			}
			/** Release the bound scope at prune time (a later rebind accompanies a freshly minted scope). */
			unbindScope() {
				this.actx = void 0;
			}
			/**
			* Register one local submission echo (see the ISession declaration).
			* Synchronous through markDirty: the echo is in the very next snapshot, so
			* the conversation can paint it before the caller starts serializing.
			* @param input - echo content and the optional settlement callback.
			* @returns the minted identity for {@link prompt} plus the pre-prompt abandon path.
			*/
			beginSubmission(input) {
				const requestId = randomUUID();
				const placement = this.running ? input.mode === "steer" ? "steering" : "queued" : "transcript";
				this.pendingSubmissions = [...this.pendingSubmissions, {
					requestId,
					placement,
					time: Date.now(),
					text: input.text,
					attachments: input.attachments
				}];
				this.submissionSettlements.set(requestId, {
					placement,
					onRetire: input.onRetire,
					retiring: false
				});
				this.promptAttempted = true;
				this.notifier.markDirty();
				return {
					requestId,
					abandon: () => {
						this.retireFailedSubmission(requestId);
					}
				};
			}
			/**
			* Send (queue/steer passed through 1:1); failures land in the snapshot's promptError.
			* @param content - text, browser-owned temporary image uploads, and staged-file receipts.
			* @param mode - queue appends after the current turn; steer interrupts it.
			* @param signal - optional caller cancellation for the complete admission round-trip.
			* @param requestId - identity from {@link beginSubmission}; a failed identified prompt retires its echo.
			* @returns the prompt result (also mirrored into promptError on failure).
			*/
			async prompt(content, mode, signal, requestId) {
				this.promptError = null;
				this.lastAgentError = null;
				this.promptAttempted = true;
				if (this.blankBit) this.firstPromptPendingTurn = true;
				this.notifier.markDirty();
				let result;
				if (this.address === void 0) {
					const clientTimeZone = resolvedClientTimeZone();
					result = await this.remote.session.prompt({
						requestId: requestId ?? randomUUID(),
						sessionId: this.sessionId,
						mode,
						content,
						clientTimeZone
					}, signal);
				} else if (content.some((part) => part.type === "file")) result = {
					ok: false,
					error: new RemoteError("subagent/attachment-invalid", "subagent continuation does not accept files", { reason: "SUBAGENT_FILE_UNSUPPORTED" })
				};
				else {
					const routedContent = content;
					const routed = await this.remote.subagents.prompt({
						requestId: requestId ?? randomUUID(),
						parentSessionId: this.address.parentSessionId,
						childSessionId: this.address.childSessionId,
						mode: "continuable",
						delivery: mode,
						content: routedContent,
						clientTimeZone: resolvedClientTimeZone()
					}, signal);
					result = routed.ok ? {
						ok: true,
						value: { accepted: true }
					} : routed;
				}
				if (!result.ok) {
					if (requestId !== void 0) this.retireFailedSubmission(requestId);
					this.promptError = {
						op: "send",
						error: result.error
					};
					this.notifier.markDirty();
					return result;
				}
				if (this.blankBit) {
					this.blankBit = false;
					this.notifier.markDirty();
				}
				this.options.onEngaged?.(this);
				return result;
			}
			/**
			* Resolve one image referenced by this session into browser-consumable bytes.
			* @param attachmentId - opaque id found in the folded session log.
			* @returns the authenticated reference and decoded bytes.
			*/
			async readAttachment(attachmentId) {
				const result = await this.remote.session.attachment({
					sessionId: this.sessionId,
					attachmentId
				});
				if (!result.ok) return result;
				const binary = atob(result.value.data);
				const data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
				return {
					ok: true,
					value: {
						attachment: result.value.attachment,
						data
					}
				};
			}
			/** Apply one operation to a still-pending queue occurrence. */
			async updateQueue(itemId, action) {
				return this.remote.session.updateQueue({
					sessionId: this.sessionId,
					itemId,
					action
				});
			}
			/**
			* Stop the active turn while the Host preserves pending inbox work; failures
			* land in promptError (same error-strip display slot). A subagent address
			* routes through `subagents.interruptByParent`, whose durable parent-address
			* authority works without a live parent Agent.
			* @returns the cancel result.
			*/
			async cancel() {
				const address = this.address;
				const result = address !== void 0 ? await this.remote.subagents.interruptByParent(address.childSessionId, address.parentSessionId, "continuable") : await this.remote.session.cancel({ sessionId: this.sessionId });
				if (!result.ok) {
					this.promptError = {
						op: "stop",
						error: result.error
					};
					this.notifier.markDirty();
				}
				return result;
			}
			/**
			* Rename: contract session.rename 1:1. On success settle the 'title'
			* projection cell from the response's `{title, seq}` under the store's
			* higher-seq-wins rule (the push frame arriving later is a no-op replay),
			* so the list row and any useProjection('title') reader update without
			* waiting for the control-stream projection update.
			* @param title - raw title text (the host normalizes acceptance).
			* @returns the rename result (normalized accepted title + title event seq).
			*/
			async rename(title) {
				const result = await this.remote.session.rename({
					sessionId: this.sessionId,
					title
				});
				if (!result.ok) return result;
				const seq = SessionSeq(result.value.seq);
				this.projections.apply("title", result.value.title, seq);
				return {
					ok: true,
					value: {
						title: result.value.title,
						seq
					}
				};
			}
			/**
			* Execute one slash-command line against this session's agent — pure
			* admission semantics (the host executor durably logs the lifecycle;
			* outcomes render as flow nodes, never as a response echo).
			* @param line - the full command line, leading slash included.
			* @returns the admission result.
			*/
			async command(line) {
				const result = await this.remote.commands.execute(this.sessionId, line, []);
				if (!result.ok) return result;
				return {
					ok: true,
					value: { matched: result.value !== void 0 }
				};
			}
			/** First open: pull the tail page (idempotent — in-flight/already-open returns the existing promise). */
			open() {
				if (this.openState === "open") return Promise.resolve();
				if (this.openPromise !== null) return this.openPromise;
				const promise = this.doOpen(this.openGeneration).finally(() => {
					if (this.openPromise === promise) this.openPromise = null;
				});
				this.openPromise = promise;
				return promise;
			}
			/** Prepend one Turn-aligned page: at least 50 messages and two Turn starts, capped at 500 messages. */
			async loadOlder() {
				if (this.openState !== "open" || !this.hasMore || this.loadingOlder) return;
				const events = this.events;
				if (events === void 0) return;
				this.loadingOlder = true;
				this.notifier.markDirty();
				try {
					await events.prepend({
						beforeSeq: this.baseSeq,
						...HISTORY_PAGE_OPTIONS
					});
				} catch (error) {
					if (!(0, _deepseek_ai_dsh_api_gateway_client.isRemoteFailure)(error)) console.error("[session-controller] loadOlder failed:", error);
				} finally {
					this.loadingOlder = false;
					this.notifier.markDirty();
				}
			}
			/** Jump loader: page backwards until the window covers seq (see ISession.loadThrough). */
			loadThrough(seq) {
				if (this.openState !== "open" || !this.hasMore || this.baseSeq <= seq) return Promise.resolve();
				if (this.jumpPromise !== null) {
					this.jumpTargetSeq = SessionSeq(Math.min(this.jumpTargetSeq ?? seq, seq));
					return this.jumpPromise;
				}
				if (this.loadingOlder) return Promise.resolve();
				const events = this.events;
				if (events === void 0) return Promise.resolve();
				const pending = {
					beforeSeq: this.baseSeq,
					hasMore: this.hasMore,
					pages: []
				};
				this.pendingHistory = pending;
				this.jumpTargetSeq = seq;
				this.loadingOlder = true;
				this.notifier.markDirty();
				const generation = this.openGeneration;
				this.jumpPromise = (async () => {
					try {
						while (pending.hasMore && this.jumpTargetSeq !== null && pending.beforeSeq > this.jumpTargetSeq) {
							if (generation !== this.openGeneration) return;
							const before = pending.beforeSeq;
							await events.prepend({
								beforeSeq: before,
								...JUMP_PAGE_OPTIONS
							});
							if (pending.beforeSeq >= before) return;
						}
					} catch (error) {
						if (!(0, _deepseek_ai_dsh_api_gateway_client.isRemoteFailure)(error)) console.error("[session-controller] loadThrough failed:", error);
					} finally {
						this.jumpTargetSeq = null;
						this.jumpPromise = null;
						this.pendingHistory = null;
						this.loadingOlder = false;
						if (generation === this.openGeneration && pending.pages.length > 0) this.prependWindow(pending.pages.reverse().flat(), pending.hasMore);
						this.notifier.markDirty();
					}
				})();
				return this.jumpPromise;
			}
			/** Rebuild an opened history source after address replacement.
			*  Invalidates any in-flight open first; projection state belongs to the independently
			*  reconnecting control stream and remains untouched. */
			async resync() {
				if (this.openState === "cold") return;
				this.openGeneration++;
				const events = this.events;
				this.events = void 0;
				await events?.dispose();
				this.openPromise = null;
				this.openState = "cold";
				this.openError = null;
				this.baseSeq = SessionLogOffset(0);
				this.notifier.markDirty();
				await this.open();
			}
			/**
			* uSES subscription entry.
			* @param listener - change callback.
			* @returns the unsubscribe function.
			*/
			subscribe(listener) {
				return this.notifier.subscribe(listener);
			}
			/**
			* Cached Session snapshot (rebuilt lazily when dirty with no listeners).
			* @returns the cached reference (stable until the next flush).
			*/
			getSnapshot() {
				this.notifier.ensureFresh();
				return this.snapshotCache;
			}
			/**
			* Running-bit relay from the host stream (list entry and snapshot stay consistent).
			* @param running - the new running state.
			*/
			handleRunning(running) {
				if (running && this.blankBit) {
					this.blankBit = false;
					this.notifier.markDirty();
				}
				if (running) this.firstPromptPendingTurn = false;
				if (this.running === running) return;
				this.running = running;
				this.notifier.markDirty();
			}
			/**
			* Install or clear the catalog-discovered transport address. A changed
			* address rebuilds an already-open window through its new history route.
			* @param address - direct parent/child address, or undefined for ordinary transport.
			* @param parentAvailable - latest exact-parent availability hint, or undefined before a catalog read.
			*/
			configureSubagent(address, parentAvailable) {
				const same = this.address?.parentSessionId === address?.parentSessionId && this.address?.childSessionId === address?.childSessionId && this.address?.mode === address?.mode;
				this.address = address;
				this.parentAvailable = parentAvailable;
				if (!same && this.openState !== "cold") this.resync();
				else this.notifier.markDirty();
			}
			/**
			* Update only the parent availability hint from a catalog refresh.
			* @param available - whether the exact direct parent is live.
			*/
			handleSubagentParentAvailable(available) {
				if (this.parentAvailable === available) return;
				this.parentAvailable = available;
				this.notifier.markDirty();
			}
			/**
			* Apply the Manager's effective display blank, further reconciled with the
			* current `sessionListMetadata` projection. Local send attempts and current
			* running state prevent re-blanking; an earlier false summary alone does not.
			* The Manager retains acceptance and earlier running observations across
			* Session-object replacement.
			* @param blank - New Session display state after Manager reconciliation.
			*/
			handleBlank(blank) {
				blank = blank && this.projections.values().sessionListMetadata?.blank !== false;
				if (blank === this.blankBit) return;
				if (blank && (this.promptAttempted || this.running)) return;
				this.blankBit = blank;
				this.notifier.markDirty();
			}
			/** `api-session/removed` relay: flag the snapshot while retaining the resident instance. */
			handleRemoved() {
				this.removed = true;
				this.notifier.markDirty();
			}
			/**
			* `api-session/error` relay: the outlet for live failures with no turn position.
			* @param message - the stringified error.
			*/
			handleAgentError(message) {
				this.lastAgentError = message;
				this.notifier.markDirty();
			}
			/**
			* Stop the Session's live Remote source.
			* @returns when the Remote iterator has completed teardown.
			*/
			async dispose() {
				this.stopObservingInbox();
				for (const [requestId, settlement] of [...this.submissionSettlements]) if (settlement.admitted !== void 0) this.scheduleObservedRetirement(requestId, settlement.admitted);
				else this.retireFailedSubmission(requestId);
				this.openGeneration++;
				const events = this.events;
				this.events = void 0;
				await events?.dispose();
			}
			/** @param generation - openGeneration at launch; stale passes cannot publish after replacement. */
			async doOpen(generation) {
				this.openState = "loading";
				this.openError = null;
				this.notifier.markDirty();
				const events = new SessionEventStream(this.remote, this.sessionAddress(), {
					publish: (change) => {
						if (generation !== this.openGeneration || this.events !== events) return;
						this.acceptEventChange(change);
					},
					failed: (error) => {
						this.failEventStream(events, generation, error);
					}
				});
				this.events = events;
				try {
					await events.open(HISTORY_PAGE_OPTIONS);
					if (generation !== this.openGeneration || this.events !== events) return;
					this.openState = "open";
				} catch (error) {
					if (generation !== this.openGeneration || this.events !== events) return;
					if (!(0, _deepseek_ai_dsh_api_gateway_client.isRemoteFailure)(error)) throw error;
					this.events = void 0;
					this.openState = "error";
					this.openError = error;
				} finally {
					if (generation === this.openGeneration) this.notifier.markDirty();
				}
			}
			/** Apply one contiguous journal update already reconciled by the Remote stream. */
			acceptEventChange(change) {
				switch (change.type) {
					case "replace":
						this.installWindow(change.entries, change.hasMore, change.page.projections === void 0 ? void 0 : projectionsBaseline(change.page.projections), change.page.assistantStream);
						return;
					case "prepend":
						this.prependWindow(change.entries, change.hasMore);
						return;
					case "append":
						this.publishAssistantEntry(this.assistantStream.acceptDurable(change.entry));
						return;
					case "assistant-stream": this.publishAssistantEntry(this.assistantStream.acceptFrame(change.frame));
				}
			}
			/** Replace the complete contiguous window and apply page-owned projection metadata. */
			installWindow(entries, hasMore, projections, assistantStream) {
				const visible = this.assistantStream.replace(entries, assistantStream);
				this.baseSeq = SessionLogOffset(entries[0]?.event.seq ?? 0);
				this.hasMore = hasMore;
				if (this.pendingHistory !== null) {
					this.pendingHistory.beforeSeq = this.baseSeq;
					this.pendingHistory.hasMore = hasMore;
					this.pendingHistory.pages.length = 0;
				}
				if (visible.some((entry) => entry.event.type === "turn/start")) this.firstPromptPendingTurn = false;
				if (projections !== void 0) this.projections.seed(projections);
				this.eventSource.replace(visible, hasMore);
				if (projections !== void 0) {
					for (const [requestId, { receipt }] of this.submissionSettlements) if (receipt !== void 0 && receipt.seq <= projections.asOfSeq) this.scheduleObservedRetirement(requestId, receipt.attachments);
				}
				for (const entry of visible) this.observeSubmissionEvent(entry.event);
				if (projections !== void 0) {
					const inbox = projections.values.inbox;
					for (const target of ["next-turn", "next-step"]) this.observeSubmissionInsertions(target, inbox?.[target] ?? [], 0, projections.asOfSeq);
				}
				this.notifier.markDirty();
			}
			publishAssistantEntry(result) {
				if (result?.type === "rebaseline") {
					const events = this.events;
					queueMicrotask(() => {
						if (events !== void 0 && this.events === events) events.restart();
					});
					return;
				}
				if (result?.type === "settlement") {
					this.eventSource.settleAssistant(result.attemptId, result.entry);
					this.observeSubmissionEvent(result.entry.event);
					this.notifier.markDirty();
					return;
				}
				if (result?.type === "abandonment") {
					this.eventSource.settleAssistant(result.attemptId);
					this.notifier.markDirty();
					return;
				}
				if (result?.type === "publish") {
					const changed = this.appendLive(result.entry);
					if (result.retireAttemptId !== void 0) this.eventSource.settleAssistant(result.retireAttemptId);
					if (changed || result.retireAttemptId !== void 0) this.notifier.markDirty();
				} else if (result?.type === "transient") {
					this.eventSource.append(result.entry);
					this.notifier.markDirty();
				}
			}
			/** Prepend one stream-validated history page. */
			prependWindow(entries, hasMore) {
				if (this.pendingHistory !== null) {
					const pending = this.pendingHistory;
					pending.beforeSeq = entries[0] === void 0 ? pending.beforeSeq : SessionLogOffset(entries[0].event.seq);
					pending.hasMore = hasMore;
					pending.pages.push(entries);
					return;
				}
				this.baseSeq = entries[0] === void 0 ? this.baseSeq : SessionLogOffset(entries[0].event.seq);
				this.hasMore = hasMore;
				this.eventSource.prepend(entries, hasMore);
			}
			/** Append one stream-validated live event. */
			appendLive(entry) {
				const event = entry.event;
				const awaitingFirstTurn = this.firstPromptPendingTurn;
				if (event.type === "turn/start") this.firstPromptPendingTurn = false;
				this.eventSource.append(entry);
				this.observeSubmissionEvent(event);
				return awaitingFirstTurn !== this.firstPromptPendingTurn;
			}
			/** Observe durable acceptance even when insertion and claim share one projection notification. */
			observeSubmissionEvent(event) {
				if (this.submissionSettlements.size === 0) return;
				if (event.type === "agent/inbox/spliced") {
					const { target, start, removedCount = 0, inserted, outcome } = event.data;
					for (const [requestId, settlement] of this.submissionSettlements) {
						const receipt = settlement.receipt;
						if (receipt?.target !== target || receipt.index === null || receipt.seq >= event.seq) continue;
						const removed = receipt.index >= start && receipt.index < start + removedCount;
						if (removed && outcome === "canceled") this.retireFailedSubmission(requestId);
						else settlement.receipt = {
							...receipt,
							seq: event.seq,
							index: removed ? null : receipt.index < start ? receipt.index : receipt.index + inserted.length - removedCount
						};
					}
					this.observeSubmissionInsertions(target, inserted, start, event.seq);
					for (const message of inserted) this.observeSubmissionMessage(message, false);
					return;
				}
				if (event.type === "request/context" || event.type === "turn/end") {
					for (const [requestId, settlement] of this.submissionSettlements) if (settlement.admitted === void 0 && settlement.receipt?.index === null && settlement.receipt.seq < event.seq) this.retireFailedSubmission(requestId);
					return;
				}
				if (event.type === "user/message") this.observeSubmissionMessage(event.data, true);
			}
			observeSubmissionInsertions(target, messages, start, seq) {
				for (const [index, message] of messages.entries()) {
					const source = message.source;
					if (source.kind !== "user" || !("rpcId" in source)) continue;
					const settlement = this.submissionSettlements.get(source.rpcId);
					if (settlement === void 0 || settlement.placement === "queued" || settlement.retiring || (settlement.receipt?.seq ?? -1) > seq) continue;
					settlement.receipt = {
						target,
						seq,
						index: start + index,
						attachments: attachmentRefsIn(message.content)
					};
				}
			}
			observeSubmissionMessage(message, admitted) {
				const source = message.source;
				if (source.kind !== "user" || !("rpcId" in source)) return;
				const settlement = this.submissionSettlements.get(source.rpcId);
				if (settlement === void 0 || settlement.retiring) return;
				if (!admitted) {
					if (settlement.placement === "queued") this.scheduleObservedRetirement(source.rpcId, attachmentRefsIn(message.content));
					return;
				}
				settlement.admitted = attachmentRefsIn(message.content);
				this.retireAdmittedSubmission(source.rpcId);
			}
			/** Retire admitted Chat identities only after stale Inbox rows can no longer reappear. */
			retireAdmittedSubmission(requestId) {
				const settlement = this.submissionSettlements.get(requestId);
				if (settlement?.admitted === void 0) return;
				const receipt = settlement.receipt;
				if (receipt?.index === null && (this.projections.seqOf("inbox") ?? -1) < receipt.seq) return;
				this.scheduleObservedRetirement(requestId, settlement.admitted);
			}
			/** Inbox acceptance retires queued echoes; its watermark completes admitted Chat handoffs. */
			observeSubmissionInbox() {
				if (this.submissionSettlements.size === 0) return;
				const inbox = this.projections.get("inbox");
				if (inbox === void 0) return;
				const seq = this.projections.seqOf("inbox");
				for (const target of ["next-turn", "next-step"]) {
					if (seq !== void 0) this.observeSubmissionInsertions(target, inbox[target], 0, seq);
					for (const message of inbox[target]) this.observeSubmissionMessage(message, false);
				}
				for (const requestId of this.submissionSettlements.keys()) this.retireAdmittedSubmission(requestId);
			}
			/**
			* Latch one observed settlement and remove the echo an animation frame
			* later. The delay keeps the echo in the snapshot until the frame in which
			* the durable node (whose assembly frame was registered first) is
			* renderable; the render-time rpcId dedupe hides the one-frame overlap.
			*/
			scheduleObservedRetirement(requestId, attachments) {
				const settlement = this.submissionSettlements.get(requestId);
				if (settlement === void 0 || settlement.retiring) return;
				settlement.retiring = true;
				scheduleFrame(() => {
					this.finishSubmission(requestId, {
						reason: "observed",
						attachments
					});
				});
			}
			/** Remove one unsettled echo immediately (prompt rejection, abort, or disposal). */
			retireFailedSubmission(requestId) {
				const settlement = this.submissionSettlements.get(requestId);
				if (settlement === void 0 || settlement.retiring || settlement.admitted !== void 0) return;
				settlement.retiring = true;
				this.finishSubmission(requestId, { reason: "failed" });
			}
			/** Single removal point: drop the echo, publish, then notify the owner. */
			finishSubmission(requestId, retirement) {
				const settlement = this.submissionSettlements.get(requestId);
				/* v8 ignore next -- retiring latches before every schedule, so one settlement never finishes twice. */
				if (settlement === void 0) return;
				this.submissionSettlements.delete(requestId);
				this.pendingSubmissions = this.pendingSubmissions.filter((echo) => echo.requestId !== requestId);
				this.notifier.markDirty();
				settlement.onRetire?.(retirement);
			}
			/** Publish a terminal background failure only while this stream still owns the Session. */
			failEventStream(events, generation, error) {
				if (generation !== this.openGeneration || this.events !== events) return;
				if (!(0, _deepseek_ai_dsh_api_gateway_client.isRemoteFailure)(error)) throw error;
				this.openGeneration++;
				this.events = void 0;
				this.openPromise = null;
				this.openState = "error";
				this.openError = error;
				events.dispose();
				this.notifier.markDirty();
			}
			buildSnapshot() {
				const identity = this.projections.values().subagent;
				return {
					sessionId: this.sessionId,
					pendingSubmissions: this.pendingSubmissions,
					running: this.running,
					subagent: this.address === void 0 ? null : {
						address: this.address.mode === "unknown" && identity != null ? {
							...this.address,
							mode: identity.mode
						} : this.address,
						...this.parentAvailable === void 0 ? {} : { parentAvailable: this.parentAvailable }
					},
					removed: this.removed,
					openState: this.openState,
					openError: this.openError,
					hasMore: this.hasMore,
					loadingOlder: this.loadingOlder,
					promptError: this.promptError,
					blank: this.blankBit,
					lastAgentError: this.lastAgentError,
					promptAttempted: this.promptAttempted,
					awaitingFirstTurn: this.firstPromptPendingTurn
				};
			}
			sessionAddress() {
				return this.address === void 0 ? {
					kind: "session",
					sessionId: this.sessionId
				} : {
					kind: "subagent",
					...this.address
				};
			}
		};
		/** Run one callback on the next animation frame, or a macrotask where no frame clock exists. */
		function scheduleFrame(fn) {
			if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => {
				fn();
			});
			else setTimeout(fn, 0);
		}
		/** Attachment references in one structurally-read content block list, in block order. */
		function attachmentRefsIn(content) {
			if (!Array.isArray(content)) return [];
			const refs = [];
			for (const block of content) {
				if (typeof block !== "object" || block === null) continue;
				const candidate = block;
				if ((candidate.type === "image" || candidate.type === "file") && typeof candidate.attachment === "object" && candidate.attachment !== null) refs.push(candidate.attachment);
			}
			return refs;
		}
		//#endregion

export {};
