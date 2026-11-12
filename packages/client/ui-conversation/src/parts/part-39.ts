/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				}
				const before = this.snapshot;
				if (before.phase === "claimed" && this.attachmentIds.length > 0 && before.claim?.attachments !== true) {
					this.notify("error", this.deps.commandAttachments.unsupportedNotice(before.claim?.token ?? before.draft));
					return;
				}
				this.dispatchRun({
					type: "enter",
					mode,
					draft: this.projection.clipboardText,
					submission
				});
				const phase = this.snapshot.phase;
				if (phase === "adjudicating" || phase === "submitting") {
					this.deps.popup?.()?.dismiss();
					this.deps.inputTriggers?.()?.track(this.projection.detectText, 0, { tier: "frozen" }, this.rev);
				}
			}
			/**
			* Keyboard arbitration while the menu is open.
			* @param key - the intercepted key.
			* @param composing - IME composition guard state.
			* @returns the menu's verdict; 'pass' when no pipeline is mounted.
			*/
			arbitrate(key, composing) {
				return this.deps.inputTriggers?.()?.arbitrate(key, composing) ?? "pass";
			}
			/**
			* Steer every still-pending queued message into the running turn (the
			* empty-draft accelerated-Enter gesture). Execution belongs to the hub's
			* queue choreography; absent dep = the gesture falls back to the machine's
			* empty-draft no-op.
			*/
			steerQueue() {
				this.deps.steerQueue?.();
			}
			/**
			* Space adjudication over the controller's hot state.
			* @returns true = a claim/insert was applied — the caller preventDefaults.
			*/
			space() {
				const inputTriggers = this.deps.inputTriggers?.();
				if (inputTriggers === void 0) return false;
				return inputTriggers.onSpace();
			}
			/** Dismiss the popupSelect shell (any interaction outside the box). */
			dismissPopup() {
				this.deps.popup?.()?.dismiss();
			}
			/**
			* The live selection as a detect-coordinate span (menu-launcher synthetic
			* hits replace it on pick); an absent selection answers a collapsed span at
			* the document end.
			* @returns the ordered [start, end) span in detect coordinates.
			*/
			caretSpan() {
				return this.draftEditor.caretSpan();
			}
			/**
			* Hot plain-text reference lexicon source for the decoration scan:
			* delegates to the controller's aggregated store. Stable
			* identity per shell; without a pipeline the snapshot is the empty Map and
			* subscribers never fire.
			*/
			lexicon = {
				getSnapshot: () => this.deps.inputTriggers?.()?.lexicon.getSnapshot() ?? EMPTY_LEXICON$1,
				subscribe: (fn) => this.deps.inputTriggers?.()?.lexicon.subscribe(fn) ?? (() => {})
			};
			/**
			* Apply one command claim (scoped begin-command event listener body): the
			* editor replaces [0, span.end) with the command chip and its separator,
			* then the machine enters claimed.
			* @param claim - the command claim from the pick path.
			* @param span - pick-time span snapshot (detect coordinates).
			* @returns whether the edit applied (phase, span CAS, and leading guard passed).
			*/
			beginCommand(claim, span) {
				return this.applyClaim(claim, span, false);
			}
			/**
			* Replace [0, span.end) with the command chip and enter claimed.
			* @param mergeHistory - merge the edit into the previous history entry.
			* @returns whether the edit applied.
			*/
			applyClaim(claim, span, mergeHistory) {
				const phase = this.core.state.phase;
				if (phase !== "plain" && phase !== "claimed") return false;
				if (span.draftRev !== this.rev) return false;
				if (this.projection.detectText.slice(0, span.start).trim() !== "") return false;
				const tail = this.projection.detectText.slice(span.end, span.end + 1);
				if (!this.draftEditor.insertCommand({
					start: 0,
					end: span.end
				}, claim, tail, mergeHistory)) return false;
				this.dispatchRun({
					type: "claim",
					claim
				});
				return true;
			}
			/**
			* Apply one reference insertion (scoped insert-reference event listener
			* body): the editor replaces the span with one chip node, followed by a
			* separating space unless one is already next.
			* @param ref - the reference insertion from the pick path.
			* @param span - pick-time span snapshot (detect coordinates).
			* @returns whether the edit applied.
			*/
			insertReference(ref, span) {
				const phase = this.core.state.phase;
				if (phase !== "plain" && phase !== "claimed") return false;
				if (span.draftRev !== this.rev) return false;
				const tail = this.projection.detectText.slice(span.end, span.end + 1);
				return this.draftEditor.insertReference(span, ref, tail);
			}
			/**
			* Consume one command token after business success (scoped consume-token
			* event listener body). Span guard: revision CAS then splice; bare-token
			* guard: trimmed-draft equality then clear.
			* @param guard - exact span or bare-token guard.
			* @returns whether the token was consumed.
			*/
			consumeToken(guard) {
				if (guard.kind === "span") {
					if (guard.span.draftRev !== this.rev || guard.span.start === guard.span.end) return false;
					return this.draftEditor.replaceText(guard.span, "");
				}
				if (guard.token === "" || this.projection.clipboardText.trim() !== guard.token) return false;
				this.setDraft("");
				return true;
			}
			/**
			* Insert plain reference text over the pick-time span (scoped insert-text
			* event listener body; the plain-text reference path). The editor gains
			* ordinary characters — no chip node; the chip look is a scan-derived
			* decoration, never state.
			* @param text - the plain reference text to splice in (e.g. `/name `).
			* @param span - pick-time span snapshot (detect coordinates).
			* @param keepCompleting - contract passenger; completion re-opening is
			* automatic here (the update listener re-tracks at the settled caret, so an
			* open token — a directory pick's trailing slash — reopens the menu without
			* an explicit re-track).
			* @returns whether the text was applied.
			*/
			insertText(text, span, keepCompleting = false) {
				if (span.draftRev !== this.rev) return false;
				return this.draftEditor.replaceText(span, text);
			}
			/**
			* Surface a notice from outside the machine (detached command results).
			* @param level - severity tier.
			* @param text - notice body.
			*/
			notify(level, text) {
				this.noticeSeq += 1;
				this.notices.set({
					level,
					text,
					seq: this.noticeSeq
				});
			}
			/**
			* Return the keyboard to the composer with the caret it last held. Lexical's
			* own focus restores its stored selection; a bare DOM focus on the
			* contenteditable would land the caret at the start instead.
			*/
			focus() {
				this.editor.getRootElement()?.focus({ preventScroll: true });
				this.editor.focus();
			}
			/**
			* Teardown the shell and return every browser-owned attachment still retained by
			* the draft or an unsettled default send.
			* @returns attachment ids the scope disposer must release.
			*/
			dispose() {
				if (this.disposed) return [];
				const retained = new Set(this.attachmentIds);
				for (const record of this.detachedDrafts.values()) for (const attachmentId of record.attachmentIds) retained.add(attachmentId);
				for (const flight of this.attachmentFlights.values()) {
					for (const attachmentId of flight.attachmentIds) retained.add(attachmentId);
					flight.controller.abort();
				}
				this.disposed = true;
				this.cancelCommandRestore();
				this.dispatchRun({ type: "release" });
				this.unsubscribeInbox?.();
				this.unregister();
				this.detachedDrafts.clear();
				this.failedDetached.clear();
				this.attachmentFlights.clear();
				return [...retained];
			}
			/** Read the live input state (guard derivation reads here). */
			get snapshot() {
				return this.state.getSnapshot();
			}
			/**
			* Bind the Conversation store writer without importing or saving content.
			* @param write - semantic draft writer; persistCurrentDraft flushes the initial value.
			* @returns the unbind disposer.
			*/
			bindDraftPersistence(write) {
				this.persistDraft = write;
				return () => {
					if (this.persistDraft === write) this.persistDraft = void 0;
				};
			}
			/**
			* Bind the mounted composer's file action and live intake availability.
			* @param picker - availability query and native file-dialog opener.
			* @returns the unbind disposer.
			*/
			bindFilePicker(picker) {
				this.filePicker = picker;
				return () => {
					if (this.filePicker === picker) this.filePicker = void 0;
				};
			}
			/**
			* Read the mounted composer's live file-intake availability.
			* @returns false when no accepting composer is mounted.
			*/
			canPickFiles() {
				return this.filePicker?.available() === true;
			}
			/**
			* Open the native file dialog when the mounted composer accepts files.
			* @returns whether the opener was called.
			*/
			pickFiles() {
				if (this.filePicker === void 0 || !this.filePicker.available()) return false;
				this.filePicker.open();
				return true;
			}
			/** Dispatch one machine event and execute its effects. */
			dispatchRun(ev) {
				this.run(this.core.dispatch(ev));
			}
			run(effects) {
				for (const fx of effects) this.execute(fx);
				this.publish();
			}
			execute(fx) {
				switch (fx.type) {
					case "notice":
						this.noticeSeq += 1;
						this.notices.set({
							level: fx.level,
							text: fx.text,
							seq: this.noticeSeq
						});
						return;
					case "adjudicate":
						this.adjudicate(fx.attempt, fx.draft);
						return;
					case "begin-submit":
						this.beginSubmit(fx.attempt, fx.claim, fx.args);
						return;
					case "default-sink":
						this.sinkSerialized(fx.attempt, fx.draft, fx.mode);
						return;
					case "commit-draft":
						this.commitDraft(fx.retainSuffixOf);
						return;
				}
			}
			/**
			* Execute the commit-draft effect: clear the committed content (retaining
			* a pure typed-during-flight suffix when the snapshot allows) and cut the
			* undo history so sent content cannot resurrect.
			*/
			commitDraft(retainSuffixOf) {
				this.draftEditor.clearCommittedDraft((clip) => {
					if (retainSuffixOf !== null && clip !== retainSuffixOf && clip.startsWith(retainSuffixOf)) return retainSuffixOf.length;
					return null;
				});
				this.draftEditor.clearHistory();
			}
			/**
			* Prompt serialization before the sink: expand each chip occurrence to its
			* owner's model form via the session controller's codec routing. Owner
			* missing or serialization failure rejects the detached send and restores
			* its editor snapshot. Chip-free drafts skip the async detour.
			*/
			sinkSerialized(attempt, draft, mode) {
				this.notifySubmission(attempt.submission);
				const attachmentIds = [...this.attachmentIds];
				this.attachmentIds = [];
				const occurrences = this.projection.occurrences;
				const record = {
					draft,
					occurrences,
					attachmentIds
				};
				this.detachedDrafts.set(attempt.seq, record);
				if (this.failedRestoreRev === this.rev) {
					this.failedDetached.clear();
					this.failedRestoreRev = void 0;
				}
				if (occurrences.length === 0) {
					this.settleSink(attempt, this.deps.defaultSink(draft.trim(), attachmentIds, mode, attempt.signal));
					return;
				}
				const inputTriggers = this.deps.inputTriggers?.();
				Promise.all(occurrences.map(async (o) => {
					if (inputTriggers === void 0) throw new Error(`no serializer for reference source "${o.source}"`);
					return {
						offset: o.offset,
						length: o.length,
						text: await inputTriggers.serializeReference(o.source, o.ref, attempt.signal)
					};
				})).then((parts) => {
					if (this.disposed) return;
					let out = "";
					let cursor = 0;
					for (const part of parts) {
						out += draft.slice(cursor, part.offset) + part.text;
						cursor = part.offset + part.length;
					}
					out += draft.slice(cursor);
					this.settleSink(attempt, this.deps.defaultSink(out.trim(), attachmentIds, mode, attempt.signal));
				}, (error) => {
					if (this.dead(attempt)) return;
					const message = error instanceof Error ? error.message : String(error);
					this.settleDetachedFailure(attempt, message);
				});
			}
			notifySubmission(submission) {
				if (submission === void 0) return;
				try {
					this.deps.messageSubmitted?.(submission);
				} catch (_error) {}
			}
			/** Settle one detached default send independently of other sends. */
			settleSink(attempt, pending) {
				pending.then((outcome) => {
					if (this.dead(attempt)) return;
					if (outcome.kind !== "success") {
						this.settleDetachedFailure(attempt, outcome.text);
						return;
					}
					this.detachedDrafts.delete(attempt.seq);
					this.dispatchRun({
						type: "sink-settled",
						attempt,
						ok: true,
						outcome
					});
				}, (error) => {
					if (this.dead(attempt)) return;
					this.settleDetachedFailure(attempt, error instanceof Error ? error.message : String(error));
				});
			}
			/** Restore one failed detached send without overwriting text entered after a restoration. */
			settleDetachedFailure(attempt, message) {
				const record = this.detachedDrafts.get(attempt.seq);
				if (record === void 0) return;
				this.detachedDrafts.delete(attempt.seq);
				this.restoreAttachments(record.attachmentIds);
				this.failedDetached.set(attempt.seq, record);
				if (this.projection.clipboardText === "" || this.failedRestoreRev === this.rev) this.restoreFailedDrafts();
				this.dispatchRun({
					type: "sink-settled",
					attempt,
					ok: false,
					...message === void 0 ? {} : { message }
				});
			}
			/** Rebuild all currently failed snapshots in submission order. */
			restoreFailedDrafts() {
				const records = [...this.failedDetached.entries()].sort(([a], [b]) => a - b).map(([, record]) => record);
				if (records.length === 0) return;
				const separator = "\n\n";
				let draft = "";
				const occurrences = [];
				for (const record of records) {
					const base = draft.length + (draft === "" ? 0 : 2);
					if (draft !== "") draft += separator;
					draft += record.draft;
					for (const occurrence of record.occurrences) occurrences.push({
						...occurrence,
						offset: base + occurrence.offset
					});
				}
				this.restoringFailures = true;
				try {
					this.draftEditor.restoreDraft(draft, occurrences);
					this.draftEditor.clearHistory();
					this.failedRestoreRev = this.rev;
				} finally {
					this.restoringFailures = false;
				}
			}
			/** Return failed-send attachments to the head of the rail; release happens only after success. */
			restoreAttachments(attachmentIds) {
				if (attachmentIds.length === 0) return;
				const current = new Set(this.attachmentIds);
				const restored = attachmentIds.filter((id) => !current.has(id));
				if (restored.length === 0) return;
export {};
