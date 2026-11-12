/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				}, Co);
				return applied;
			}
			/**
			* Clear committed content using the model's suffix decision inside the editor update.
			* @param prefixLength - returns the clipboard-prefix length to remove, or null to clear the root.
			*/
			clearCommittedDraft(prefixLength) {
				this.editor.update(() => {
					const layout = $composerLayout();
					const length = prefixLength(layout.clipboardText);
					if (length !== null) {
						$replaceDetectSpanWithText({
							start: 0,
							end: detectOffsetOfClipboardOffset(layout, length)
						}, "");
						return;
					}
					const root = nl();
					root.clear();
					root.selectEnd();
				}, {
					discrete: true,
					tag: xo
				});
			}
			/**
			* Import semantic content or a model-selected failure snapshot with fresh reference nodes.
			* @param draft - clipboard text.
			* @param occurrences - reference occurrences in clipboard order.
			*/
			restoreDraft(draft, occurrences) {
				this.editor.update(() => {
					const root = nl();
					root.clear();
					let paragraph = es();
					root.append(paragraph);
					const appendText = (text) => {
						const lines = text.replace(REFERENCE_PLACEHOLDER_RE, "").split("\n");
						for (let i = 0; i < lines.length; i += 1) {
							const line = lines[i];
							if (line !== "") paragraph.append(Go(line));
							if (i < lines.length - 1) {
								paragraph = es();
								root.append(paragraph);
							}
						}
					};
					let cursor = 0;
					for (const occurrence of occurrences) {
						appendText(draft.slice(cursor, occurrence.offset));
						paragraph.append(new ReferenceChipNode({
							source: occurrence.source,
							ref: occurrence.ref,
							label: occurrence.label,
							...occurrence.appearance === void 0 ? {} : { appearance: occurrence.appearance },
							clipboardText: occurrence.clipboardText
						}, occurrence.invalid === true));
						cursor = occurrence.offset + occurrence.length;
					}
					appendText(draft.slice(cursor));
					root.selectEnd();
				}, {
					discrete: true,
					tag: xo
				});
			}
			/** Cut the editor's undo history after a committed clear or restoration. */
			clearHistory() {
				this.editor.dispatchCommand(Nn$1, void 0);
			}
		};
		//#endregion
		//#region lib/types/client/input/facade.js
		/** Guard tier from the machine phase. */
		function guardOf(phase) {
			switch (phase) {
				case "plain": return "plain";
				case "claimed": return "claimed";
				default: return "frozen";
			}
		}
		/** Whether two projections differ in content (selection and caret excluded). */
		function projectionContentChanged(prev, next) {
			if (prev.clipboardText !== next.clipboardText || prev.detectText !== next.detectText) return true;
			if (prev.command !== next.command) return true;
			if (prev.occurrences.length !== next.occurrences.length) return true;
			return next.occurrences.some((occ, i) => {
				const old = prev.occurrences[i];
				return old === void 0 || old.occurrenceId !== occ.occurrenceId || old.invalid !== occ.invalid;
			});
		}
		const EMPTY_QUEUE$1 = [];
		/** Unavailable catalogs contain no named text references. */
		const EMPTY_LEXICON$1 = /* @__PURE__ */ new Map();
		/**
		* The per-session input facade: scoped-event application verbs +
		* setDraft/submit + the published InputState store, over a shell-owned
		* Lexical editor.
		*/
		var SessionInputShell = class {
			deps;
			/** Published editor projection + submit-plane state + queue overlay (the InputZone currency source). */
			state;
			/** Latest surfaced notice (null after clear); the bar renders errors as banners and information inline. */
			notices = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			/** The shell-owned editor (text + chip truth); the composer binds its contenteditable to it. */
			get editor() {
				return this.draftEditor.editor;
			}
			/** The public provide-channel action face (one stable identity per session). */
			actions = {
				captureInsertion: () => ({
					...this.caretSpan(),
					draftRev: this.rev
				}),
				insertText: (text, span) => {
					if (this.snapshot.phase === "adjudicating" || this.snapshot.phase === "submitting" || this.disposed) return false;
					if (span.draftRev !== this.rev) return false;
					return this.draftEditor.insertAsyncText(span, text);
				},
				setDraft: (text) => {
					this.setDraft(text);
				},
				persistDraft: () => {
					this.persistCurrentDraft();
				},
				addAttachments: (ids) => this.addAttachments(ids),
				removeAttachment: (id) => {
					this.removeAttachment(id);
				},
				pruneAttachments: (ids) => {
					this.pruneAttachments(ids);
				},
				submit: () => {
					this.submit("queue");
				}
			};
			core = new SubmitMachine();
			draftEditor;
			get projection() {
				return this.draftEditor.projection;
			}
			rev = 0;
			unregister;
			noticeSeq = 0;
			lastPublishedDraft;
			draftSnapshotCache;
			attachmentIds = [];
			disposed = false;
			/** Conversation store writer for the current semantic document. */
			persistDraft;
			/** A restored draft's command token waiting for the trigger pipeline, with the revision its restore produced. */
			pendingCommand;
			/** The in-flight claim resolution for a restored command chip. */
			commandRestore;
			/** The mounted composer's file-picker opener (scoped pick-files event target). */
			filePicker;
			/** Default sends retained until admission settles or scope disposal releases their attachments. */
			detachedDrafts = /* @__PURE__ */ new Map();
			/** Failed default sends waiting to be restored together in submission order. */
			failedDetached = /* @__PURE__ */ new Map();
			/** Revision of the last automatic failure restoration. */
			failedRestoreRev;
			restoringFailures = false;
			attachmentFlightSeq = 0;
			/** Attachment-only sends retained until admission settles or scope disposal releases their attachments. */
			attachmentFlights = /* @__PURE__ */ new Map();
			unsubscribeInbox;
			constructor(deps) {
				this.deps = deps;
				this.draftEditor = new DraftEditorRuntime({
					onUpdate: () => {
						this.onEditorUpdate();
					},
					openReference: (source, reference) => this.deps.inputTriggers?.()?.openReference(source, reference) ?? false,
					lexicon: () => this.lexicon.getSnapshot(),
					resolveLexicon: () => this.deps.inputTriggers?.()?.lexicon
				});
				this.unregister = this.draftEditor.register();
				this.state = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(this.compose());
				this.unsubscribeInbox = deps.inbox?.subscribe(() => {
					this.publish();
				});
			}
			/** Re-project, sync the claim with the leading command chip, publish, and feed trigger tracking after every editor commit. */
			onEditorUpdate() {
				if (projectionContentChanged(this.draftEditor.refreshProjection(), this.projection)) {
					this.rev += 1;
					if (!this.restoringFailures && this.failedRestoreRev !== void 0) {
						this.failedDetached.clear();
						this.failedRestoreRev = void 0;
					}
					this.dispatchRun({
						type: "draft-changed",
						command: this.projection.command
					});
				}
				const caret = this.projection.caret;
				if (caret !== null) this.deps.inputTriggers?.()?.track(this.projection.detectText, caret, { tier: guardOf(this.core.state.phase) }, this.rev);
			}
			/**
			* Replace the whole draft (persisted-draft seed and programmatic writes).
			* Placeholder-sanitized; newlines split paragraphs; the caret lands at the
			* end. Merged into history so a seed is not an undoable step of its own.
			* @param text - plain text or the complete semantic document.
			*/
			setDraft(text) {
				const draft = resolveDraftInput(text);
				this.cancelCommandRestore();
				if (draft.references.length === 0) this.draftEditor.setDraft(draft.text);
				else this.draftEditor.restoreDraft(draft.text, draft.references);
				if (draft.command === void 0) return;
				this.pendingCommand = {
					token: draft.command.token,
					rev: this.rev
				};
				this.restoreCommand();
			}
			/**
			* Reconnect optional catalog notifications and resume a pending command
			* chip restore without waiting for another edit.
			*/
			refreshLexiconSubscription() {
				if (this.disposed) return;
				this.draftEditor.refreshLexiconSubscription();
				this.restoreCommand();
			}
			/**
			* Rebuild the command chip a restored draft carried once the trigger
			* pipeline can resolve its claim. The rebuild applies only at the revision
			* the restore produced: an edit made while the claim resolves keeps the
			* literal token, which Enter still adjudicates as the command.
			*/
			restoreCommand() {
				const pending = this.pendingCommand;
				const inputTriggers = this.deps.inputTriggers?.();
				if (pending === void 0 || inputTriggers === void 0 || this.disposed) return;
				this.pendingCommand = void 0;
				const restore = new AbortController();
				this.commandRestore = restore;
				const spelling = pending.token.trimEnd();
				inputTriggers.resolveClaim(spelling, restore.signal).then((claim) => {
					if (restore.signal.aborted) return;
					this.commandRestore = void 0;
					if (claim !== void 0) this.applyClaim(claim, {
						start: 0,
						end: spelling.length,
						draftRev: pending.rev
					}, true);
				}, (_error) => {
					if (this.commandRestore === restore) this.commandRestore = void 0;
				});
			}
			/** Drop a pending or in-flight command chip restore. */
			cancelCommandRestore() {
				this.pendingCommand = void 0;
				this.commandRestore?.abort();
				this.commandRestore = void 0;
			}
			/** Current semantic document, stable until its content revision changes. */
			get draftSnapshot() {
				if (this.draftSnapshotCache?.revision === this.rev) return this.draftSnapshotCache.value;
				const value = snapshotDraft(this.projection.clipboardText, this.projection.occurrences, this.projection.command?.token);
				this.draftSnapshotCache = {
					revision: this.rev,
					value
				};
				return value;
			}
			/** Persist the latest document without changing the editor or binding a writer. */
			persistCurrentDraft() {
				this.persistDraft?.(this.draftSnapshot);
			}
			/**
			* Apply one new-task request to this already-initialized input model.
			* @param options - replacement content and explicit permission to clear existing text.
			* @returns applied when the requested text is adopted, even if unchanged;
			* preserved when the current draft is kept; blocked after disposal or during a pending submission.
			*/
			requestDraftInitialization(options) {
				if (this.draftInitializationBlocked()) return "blocked";
				if (options.prompt === void 0 && options.clearPreviousDraft !== true) return "preserved";
				if (options.clearPreviousDraft !== true && (this.snapshot.draft !== "" || this.attachmentIds.length > 0)) return "preserved";
				this.setDraft(options.prompt ?? "");
				return "applied";
			}
			draftInitializationBlocked() {
				const { phase } = this.core.state;
				return this.disposed || phase === "adjudicating" || phase === "submitting" || this.detachedDrafts.size > 0 || this.attachmentFlights.size > 0;
			}
			/** Append ordered attachment ids unless an admission transaction is locked. */
			addAttachments(ids) {
				if (this.snapshot.phase === "adjudicating" || this.snapshot.phase === "submitting") return false;
				if (ids.length === 0) return true;
				this.attachmentIds = [...this.attachmentIds, ...ids];
				this.publish();
				return true;
			}
			/**
			* Add validated file references and attachment ids while admission is editable.
			* @param references - reference chips in source order.
			* @param ids - newly allocated attachment ids.
			* @returns false when admission is locked or the editor refuses the insertion.
			*/
			addFiles(references, ids) {
				if (this.snapshot.phase === "adjudicating" || this.snapshot.phase === "submitting") return false;
				if (!this.draftEditor.insertFileReferences(references)) return false;
				this.attachmentIds = [...this.attachmentIds, ...ids];
				this.publish();
				return true;
			}
			/**
			* Remove one attachment id from this draft. Busy admission phases refuse, like
			* {@link addAttachments}: a removal landing while a command submit serializes
			* would otherwise vanish from the rail yet still ride the in-flight send.
			*/
			removeAttachment(id) {
				if (this.snapshot.phase === "adjudicating" || this.snapshot.phase === "submitting") return false;
				const next = this.attachmentIds.filter((candidate) => candidate !== id);
				if (next.length === this.attachmentIds.length) return false;
				this.attachmentIds = next;
				this.publish();
				return true;
			}
			/**
			* Keep only ids that still resolve in the browser attachment registry.
			* @param available - live registry ids.
			*/
			pruneAttachments(available) {
				const keep = new Set(available);
				const next = this.attachmentIds.filter((id) => keep.has(id));
				if (next.length === this.attachmentIds.length) return;
				this.attachmentIds = next;
				this.publish();
			}
			/**
			* Clear the draft as a successful-send commit: the editor empties (no undo
			* unit) and the undo history is cut, so Ctrl/Cmd-Z cannot resurrect sent
			* content (the command path gets the same discipline from submit-settled).
			* @param attachmentIds - admitted attachment ids to remove from this draft.
			*/
			commitSend(attachmentIds) {
				const submitted = new Set(attachmentIds);
				this.attachmentIds = this.attachmentIds.filter((id) => !submitted.has(id));
				this.dispatchRun({ type: "send-committed" });
			}
			/**
			* Insert pasted plain text over the current editor selection
			* (placeholder-sanitized). The paste event's own default is suppressed by
			* the caller; PASTE_TAG makes the paste its own history boundary, so one
			* undo never removes both the paste and typing inside the merge window.
			* @param text - pasted plain text.
			*/
			paste(text) {
				this.draftEditor.paste(text);
			}
			/**
			* Enter adjudication + submit transaction + default sink. Effects fan out
			* from the machine; this method only feeds the event. Lock entry
			* (adjudicating/submitting) force-closes the transient layers: the popup
			* dismisses and the menu tracks frozen.
			*/
			submit(mode = "queue", source) {
				if (this.disposed) return;
				const timestamp = Date.now();
				let state;
				if (this.snapshot.phase === "plain" && (this.snapshot.draft.trim() !== "" || this.attachmentIds.length > 0)) try {
					state = this.deps.submissionState?.();
				} catch (_error) {}
				const submission = Object.freeze({
					timestamp,
					mode,
					...source === void 0 ? {} : { source },
					...state === void 0 ? {} : { state }
				});
				if (this.snapshot.draft.trim() === "" && this.attachmentIds.length > 0) {
					if (this.snapshot.phase === "plain") {
						const attachmentIds = [...this.attachmentIds];
						const controller = new AbortController();
						this.attachmentFlightSeq += 1;
						const flight = this.attachmentFlightSeq;
						this.attachmentFlights.set(flight, {
							controller,
							attachmentIds
						});
						this.commitSend(attachmentIds);
						this.notifySubmission(submission);
						this.deps.defaultSink("", attachmentIds, mode, controller.signal).then((outcome) => {
							if (this.disposed || !this.attachmentFlights.delete(flight)) return;
							if (outcome.kind === "success") return;
							this.restoreAttachments(attachmentIds);
							if (outcome.text !== void 0) this.notify("error", outcome.text);
						}, (error) => {
							if (this.disposed || !this.attachmentFlights.delete(flight)) return;
							this.restoreAttachments(attachmentIds);
							this.notify("error", error instanceof Error ? error.message : String(error));
						});
					}
					return;
export {};
