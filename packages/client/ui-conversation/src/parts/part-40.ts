/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				this.attachmentIds = [...restored, ...this.attachmentIds];
				this.publish();
			}
			/** Enter adjudication: poll the session controller; failure = notice + draft retained (never a silent downgrade). */
			adjudicate(attempt, draft) {
				const inputTriggers = this.deps.inputTriggers?.();
				if (inputTriggers === void 0) {
					this.dispatchRun({
						type: "adjudicated",
						attempt,
						outcome: void 0
					});
					return;
				}
				inputTriggers.adjudicate(draft.trim(), attempt.signal, { attachments: this.attachmentIds.length }).then((outcome) => {
					if (this.dead(attempt)) return;
					this.dispatchRun({
						type: "adjudicated",
						attempt,
						outcome
					});
				}, (error) => {
					if (this.dead(attempt)) return;
					const message = error instanceof Error ? error.message : String(error);
					this.dispatchRun({
						type: "adjudication-failed",
						attempt,
						message
					});
				});
			}
			/**
			* The submit transaction: claim.submit against the session scope; ok maps
			* from the outcome kind. An accepting claim receives the serialized draft
			* attachments, which are cleared and released only on a success outcome; a
			* failure (serialize, transport, or handler error) keeps draft and attachments
			* for correction.
			*/
			beginSubmit(attempt, claim, args) {
				const attachmentIds = claim.attachments === true ? [...this.attachmentIds] : [];
				Promise.resolve().then(async () => {
					const attachments = attachmentIds.length > 0 ? await this.deps.commandAttachments.serialize(attachmentIds) : [];
					if (this.dead(attempt)) return void 0;
					return claim.submit(args, this.deps.actx, attachments);
				}).then((outcome) => {
					if (outcome === void 0 || this.dead(attempt)) return;
					if (outcome.kind === "success" && attachmentIds.length > 0) {
						const submitted = new Set(attachmentIds);
						this.attachmentIds = this.attachmentIds.filter((id) => !submitted.has(id));
						this.deps.commandAttachments.release(attachmentIds);
					}
					this.dispatchRun({
						type: "submit-settled",
						attempt,
						ok: outcome.kind === "success",
						command: this.projection.command,
						outcome,
						...outcome.kind === "error" && outcome.text === void 0 ? { message: "command failed" } : {}
					});
				}, (error) => {
					if (this.dead(attempt)) return;
					const message = error instanceof Error ? error.message : String(error);
					this.dispatchRun({
						type: "submit-settled",
						attempt,
						ok: false,
						command: this.projection.command,
						message
					});
				});
			}
			/** Late-settlement guard: superseded attempts and disposed facades drop silently. */
			dead(attempt) {
				return this.disposed || attempt.signal.aborted;
			}
			compose() {
				const core = this.core.state;
				return {
					draft: this.projection.clipboardText,
					attachmentIds: this.attachmentIds,
					draftRev: this.rev,
					phase: core.phase,
					...core.claim !== void 0 ? { claim: core.claim } : {},
					occurrences: this.projection.occurrences,
					queue: this.deps.inbox?.getSnapshot()?.["next-turn"] ?? EMPTY_QUEUE$1
				};
			}
			publish() {
				const next = this.compose();
				this.state.set(next);
				const draft = this.draftSnapshot;
				if (draft !== this.lastPublishedDraft) {
					this.lastPublishedDraft = draft;
					this.persistDraft?.(draft);
				}
			}
		};
		//#endregion
		//#region lib/types/client/input/submission-analytics.js
		/**
		* Report the original message occurrence without reading newer Session facts.
		* @param ctx - client context.
		* @param submission - original occurrence and Session snapshot.
		*/
		function reportMessageSubmission(ctx, submission) {
			const { state, timestamp, mode } = submission;
			if (state === void 0) return;
			const model = state.model;
			ctx.get("productAnalytics")?.track("send_button_click", {
				...state.sessionId === void 0 ? {} : { session_id: state.sessionId },
				...model === void 0 ? {} : {
					model_name: `${model.provider}/${model.name}`,
					...model.effort === void 0 ? {} : { thinking_effort: model.effort }
				},
				run_mode: state.runMode,
				msg_type: state.running ? mode : "default"
			}, timestamp);
		}
		//#endregion
		//#region lib/types/client/input/hub.js
		/** Session-addressed input facade registry (SessionInputResolver face + composer-layer extras). */
		var InputHub = class {
			rootCtx;
			t;
			shells = /* @__PURE__ */ new WeakMap();
			/**
			* @param ctx - client root context (services resolved lazily per call — boot order stays free).
			* @param t - conversation-namespace translate thunk (reads the active locale at call time).
			*/
			constructor(rootCtx, t) {
				this.rootCtx = rootCtx;
				this.t = t;
			}
			/**
			* Resolve the facade for one session-scope ctx (SessionInputResolver face).
			* @param actx - session-scope context.
			* @returns the resident per-session facade.
			*/
			for(actx) {
				const sessions = this.sessions();
				const session = sessions.sessionOf(actx);
				const binding = session === void 0 ? void 0 : sessions.binding(session.sessionId);
				if (binding === void 0 || binding.session !== session) throw new Error("conversation.input.for requires a retained Session scope");
				return this.shellFor(binding);
			}
			requestDraftInitialization(binding, options) {
				if (this.sessions().binding(binding.sessionId) !== binding) throw new Error("conversation.input.requestDraftInitialization requires a retained Session binding");
				return this.shellFor(binding).requestDraftInitialization(options);
			}
			/**
			* Resolve the resident shell for an already-retained, addressable Session binding.
			* Draft import completes before return. The Session scope owns input listeners,
			* the inject-managed catalog subscription, and shell teardown.
			* @param binding - session assembly handle.
			* @returns the shell.
			*/
			shellFor(binding) {
				const existing = this.shells.get(binding);
				if (existing !== void 0) return existing;
				const { session, ctx: actx } = binding;
				const shell = new SessionInputShell({
					actx,
					submissionState: () => {
						const state = session.getSnapshot();
						const model = session.projections.faceOf("modelSelection").getSnapshot();
						const plan = session.projections.faceOf("plan").getSnapshot();
						const goal = session.projections.faceOf("goal").getSnapshot();
						const selection = model?.next ?? model?.lastUsed;
						return Object.freeze({
							...state.blank ? {} : { sessionId: state.sessionId },
							...selection == null ? {} : { model: Object.freeze({
								provider: selection.provider,
								name: selection.model,
								...selection.reasoningEffort === void 0 ? {} : { effort: selection.reasoningEffort }
							}) },
							runMode: plan?.active ? "plan" : goal?.goal.phase === "active" ? "goal" : "default",
							running: state.running
						});
					},
					messageSubmitted: (submission) => {
						reportMessageSubmission(this.rootCtx, submission);
					},
					inputTriggers: () => this.controller(actx),
					popup: () => this.popup(actx),
					inbox: session.projections.faceOf("inbox"),
					defaultSink: (text, attachmentIds, mode, signal) => this.sink(session, text, attachmentIds, mode, signal),
					steerQueue: () => {
						this.steerQueue(session, shell);
					},
					commandAttachments: {
						serialize: async (ids) => {
							return (await this.conversation().serializeDraftAttachments(ids)).attachments;
						},
						release: (ids) => {
							const conversation = this.rootCtx.get("conversation");
							for (const attachmentId of ids) conversation?.releaseDraftAttachment(attachmentId);
						},
						unsupportedNotice: (token) => this.t("command.attachmentsUnsupported", { command: token.trim().replace(/^\//u, "") })
					}
				});
				this.shells.set(binding, shell);
				actx.effect(() => {
					const offs = [
						actx.on("slash/input-begin-command", (req) => shell.beginCommand(req.claim, req.span) ? true : void 0),
						actx.on("slash/input-insert-reference", (req) => shell.insertReference(req.reference, req.span) ? true : void 0),
						actx.on("slash/input-consume-token", (req) => shell.consumeToken(req.guard) ? true : void 0),
						actx.on("slash/input-insert-text", (req) => shell.insertText(req.text, req.span, req.continue === true) ? true : void 0)
					];
					return () => {
						for (const off of offs) off();
						const drafts = shell.dispose();
						this.shells.delete(binding);
						const conversation = this.rootCtx.get("conversation");
						for (const attachmentId of drafts) conversation?.releaseDraftAttachment(attachmentId);
					};
				}, "conversation.input: session shell");
				actx.inject(["inputTriggers"], (scope) => {
					scope.effect(() => {
						shell.refreshLexiconSubscription();
						return () => {
							shell.refreshLexiconSubscription();
						};
					}, "conversation.input: reference catalogs");
				});
				shell.setDraft(readConversationDraft(binding.sessionId));
				return shell;
			}
			/**
			* Resident shell by session id (service-face path; the provide channel has
			* normally created it already — this covers direct id-addressed access).
			* @param id - session id.
			* @returns the shell.
			*/
			shell(id) {
				const binding = this.sessions().binding(id);
				if (binding === void 0) throw new Error(`conversation.input: session "${id}" resolved no binding`);
				return this.shellFor(binding);
			}
			/**
			* The InputBar-exclusive keyboard command face: the shell
			* satisfies it structurally; package-internal — handed through the
			* composer-bar entry's inject, never across a plugin boundary.
			* @param id - session id.
			* @returns the shell as the keyboard face.
			*/
			keyboard(id) {
				return this.shell(id);
			}
			/**
			* Query file intake without creating a Session input.
			* @param id - target Session.
			* @returns whether its mounted composer currently accepts files.
			*/
			canPickFiles(id) {
				const binding = this.sessions().binding(id);
				return binding !== void 0 && this.shells.get(binding)?.canPickFiles() === true;
			}
			/**
			* Open the target composer's file dialog under its live intake policy.
			* @param id - target Session.
			*/
			pickFiles(id) {
				const binding = this.sessions().binding(id);
				if (binding !== void 0) this.shells.get(binding)?.pickFiles();
			}
			/**
			* Resolve the optional slash controller for composer chrome that launches
			* the shared candidate menu without typing a trigger.
			* @param id - session id.
			* @returns the resident controller, or undefined when no trigger provider is installed.
			*/
			inputTriggers(id) {
				const binding = this.sessions().binding(id);
				return binding === void 0 ? void 0 : this.controller(binding.ctx);
			}
			/**
			* Default sink: optimistic clear + prompt. The session is always a real
			* host entity (materialized when its workspace was picked), so there is
			* exactly one path; a failed first prompt is an ordinary prompt failure
			* (banner via promptError, draft restored only while untouched).
			*/
			sink(session, text, attachmentIds, mode, signal) {
				if (text === "" && attachmentIds.length === 0) return Promise.resolve({ kind: "success" });
				return this.conversation().sendSession(session, text, attachmentIds, mode, signal);
			}
			/**
			* Submit every still-pending queued message through QueueDock Steer, in FIFO
			* request order — the same operation as the queue dock's per-row button.
			* An Agent stopping before a command (`session/steer-unavailable`) or a row already
			* claimed by the agent (`session/queue-item-not-found`) converges silently, while a
			* genuine failure surfaces as one composer notice. Repeated triggers
			* (e.g. two rapid empty-draft chords) rely on that `session/queue-item-not-found`
			* convergence: the snapshot may still list a row the host already steered,
			* and the duplicate Steer is a silent no-op.
			* @param session - the addressed host session.
			* @param shell - the resident shell (notice outlet).
			*/
			async steerQueue(session, shell) {
				const queued = session.projections.faceOf("inbox").getSnapshot()?.["next-turn"] ?? [];
				if (queued.length === 0) return;
				for (const item of queued) {
					const result = await session.updateQueue(item.id, { kind: "steer" });
					if (result.ok) continue;
					if (result.error.code === "session/steer-unavailable" || result.error.code === "session/queue-item-not-found") return;
					shell.notify("error", this.t("queue.steerFailed"));
					return;
				}
			}
			controller(actx) {
				if (this.sessions().sessionOf(actx) === void 0) return void 0;
				return this.rootCtx.get("inputTriggers")?.sessionOf(actx);
			}
			popup(actx) {
				if (this.sessions().sessionOf(actx) === void 0) return void 0;
				return this.rootCtx.get("commandUi")?.popupFor(actx);
			}
			sessions() {
				const sessions = this.rootCtx.get("sessions");
				if (sessions === void 0) throw new Error("conversation.input: sessions service unavailable");
				return sessions;
			}
			conversation() {
				const conversation = this.rootCtx.get("conversation");
				if (conversation === void 0) throw new Error("conversation.input: conversation service unavailable");
				return conversation;
			}
		};
		//#endregion
		//#region lib/types/submission-settings.js
		/** Busy-Enter preference stored in the Host user-settings document. */
		/** Settings namespace owned by the conversation plugin. */
		const CONVERSATION_SETTINGS_NAMESPACE = "ui-conversation";
		/** Field carrying the delivery mode for plain Enter while an agent is busy. */
		const BUSY_ENTER_FIELD = "busyEnter";
		/** Busy-Enter behaviors accepted at settings and input boundaries. */
		const BUSY_ENTER_BEHAVIORS = ["queue", "steer"];
		/** Default preserves Enter-as-Queue for running conversations. */
		const DEFAULT_BUSY_ENTER_BEHAVIOR = "queue";
		/** Durable conversation schema; also the wire envelope the browser scope validates against. */
		const ConversationSettingsFields = { [BUSY_ENTER_FIELD]: Schema.union([...BUSY_ENTER_BEHAVIORS]).default(DEFAULT_BUSY_ENTER_BEHAVIOR) };
		Schema.object(ConversationSettingsFields);
		//#endregion
		//#region lib/types/client/input/submission-policy.js
		/**
		* Composer submission policy. It owns the live busy-Enter preference and
		* resolves submission gestures into queue/steer delivery modes; Host and
		* Agent keep the actual delivery-window authority.
		*/
		/**
		* Resolve one submission gesture against the busy-Enter preference. Plain
		* Enter and the primary Send button share the `enter` gesture, so the button
		* delivers exactly what Enter would. Direct `steer` is intentionally
		* best-effort: AgentLoop turns a closed-window submission into the next waking
		* Queue item.
		* @param preferred - the live busy-Enter preference.
		* @param running - whether the addressed agent currently reports busy.
		* @param gesture - plain Enter (or the Send button) or the Cmd/Ctrl-accelerated chord.
		* @param steeringAvailable - whether this session transport supports steering.
		* @returns Queue outside steer-capable busy state; otherwise the preferred mode or its opposite.
		*/
		function resolveSubmitMode(preferred, running, gesture, steeringAvailable) {
			if (!running || !steeringAvailable) return "queue";
			if (gesture === "enter") return preferred;
			return preferred === "queue" ? "steer" : "queue";
		}
		/**
		* Busy-Enter preference shared by the composer bar inject face and its
		* Settings row: one live store the bar's submission gestures and Send label
		* read, backed by the Host user-settings document when one is composed.
		*/
		var ComposerSubmissionPolicy = class {
			/** Reactive preference source for the composer bar and the Settings row. */
			busyEnter = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(DEFAULT_BUSY_ENTER_BEHAVIOR);
			unsubscribe;
			host;
			/**
			* @param host Shared configuration form; omitted keeps the browser-local default.
			*/
			constructor(host) {
				this.host = host;
				if (host !== void 0) {
					this.unsubscribe = host.subscribe(() => {
						this.adopt(host);
					});
					this.adopt(host);
				}
			}
			/** Release the preference subscription. */
			dispose() {
				this.unsubscribe?.();
			}
			/**
			* Change the busy-state submission behavior; the live value publishes
			* before the durable write starts.
			* @param behavior - Queue or Steer.
			*/
			setBusyEnter(behavior) {
				if (this.busyEnter.getSnapshot() === behavior) return;
				this.busyEnter.set(behavior);
				this.host?.set(BUSY_ENTER_FIELD, behavior);
export {};
