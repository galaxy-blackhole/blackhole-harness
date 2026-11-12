/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				const done = new Promise((resolve) => {
					settle = resolve;
				});
				this.fileUploadOperations.set(attachment.id, {
					controller,
					done
				});
				this.pendingFileUploads.add(done);
				done.then(() => {
					this.pendingFileUploads.delete(done);
				});
				const run = async () => {
					try {
						if (controller.signal.aborted || this.fileUploadOperations.get(attachment.id)?.controller !== controller) return;
						const result = await this.ctx.fileUpload.upload(sessionId, attachment.file, attachment.file.name === "" ? void 0 : attachment.file.name, controller.signal, (progress) => {
							if (this.fileUploadOperations.get(attachment.id)?.controller !== controller) return;
							this.fileUploads.update((draft) => {
								if (!(attachment.id in draft)) return;
								draft[attachment.id] = {
									status: "uploading",
									loaded: progress.loaded,
									...progress.total === void 0 ? {} : { total: progress.total }
								};
							});
						});
						if (this.fileUploadOperations.get(attachment.id)?.controller !== controller) return;
						this.fileUploads.update((draft) => {
							if (!(attachment.id in draft)) return;
							draft[attachment.id] = result.ok ? {
								status: "ready",
								receiptId: result.value.receiptId,
								file: result.value.file
							} : {
								status: "error",
								message: result.error.message
							};
						});
					} catch (error) {
						if (this.fileUploadOperations.get(attachment.id)?.controller !== controller) return;
						this.fileUploads.update((draft) => {
							if (!(attachment.id in draft)) return;
							draft[attachment.id] = {
								status: "error",
								message: error instanceof Error ? error.message : String(error)
							};
						});
					} finally {
						if (this.fileUploadOperations.get(attachment.id)?.controller === controller) this.fileUploadOperations.delete(attachment.id);
					}
				};
				this.fileUploadQueue.push({
					run,
					settle
				});
				this.pumpFileUploads();
			}
			/** Start queued upload Workers until the configured concurrency is occupied. */
			pumpFileUploads() {
				while (this.activeFileUploads < this.maxConcurrentFileUploads) {
					const task = this.fileUploadQueue.shift();
					if (task === void 0) return;
					this.activeFileUploads += 1;
					task.run().finally(() => {
						this.activeFileUploads -= 1;
						task.settle();
						this.pumpFileUploads();
					});
				}
			}
			/**
			* Resolve ordered input-state ids to runtime-owned draft attachments.
			* @param ids - draft attachment ids.
			* @returns descriptors that remain live, in requested order.
			*/
			resolveDraftAttachments(ids) {
				const attachments = [];
				for (const id of ids) {
					const attachment = this.draftAttachments.get(id);
					if (attachment !== void 0) attachments.push(attachment);
				}
				return attachments;
			}
			/**
			* Serialize ordered draft attachments to command-submit wire payloads without
			* sending or releasing them. Images are encoded; generic files cite receipts
			* from their completed background uploads and never reread browser bytes.
			* @param attachmentIds - ordered draft-local attachment ids.
			* @returns wire payloads in id order.
			*/
			async serializeDraftAttachments(attachmentIds) {
				const attachments = this.resolveDraftAttachments(attachmentIds);
				if (attachments.length !== attachmentIds.length) throw new Error("conversation.serializeDraftAttachments: one or more draft attachments are no longer available");
				const uploads = this.fileUploads.getSnapshot();
				return { attachments: await Promise.all(attachments.map(async (attachment) => {
					if (attachment.kind === "image") return {
						type: "image",
						...await this.encodeImage(attachment.file)
					};
					const upload = uploads[attachment.id];
					if (upload === void 0 || upload.status !== "ready") throw new Error("conversation.serializeDraftAttachments: one or more files have not finished uploading");
					return {
						type: "file",
						receiptId: upload.receiptId
					};
				})) };
			}
			/**
			* Release one browser-owned draft attachment, aborting its active upload.
			* @param id - draft attachment id.
			*/
			releaseDraftAttachment(id) {
				const attachment = this.draftAttachments.get(id);
				if (attachment === void 0) return;
				const operation = this.fileUploadOperations.get(id);
				this.fileUploadOperations.delete(id);
				operation?.controller.abort();
				this.draftAttachments.delete(id);
				if (attachment.kind === "image") {
					revokePreview(attachment.previewUrl);
					return;
				}
				this.fileUploads.set(Object.fromEntries(Object.entries(this.fileUploads.getSnapshot()).filter(([key]) => key !== id)));
			}
			/**
			* Release a set of browser-owned draft attachments.
			* @param attachments - descriptors to release.
			*/
			releaseDraftAttachments(attachments) {
				for (const attachment of attachments) this.releaseDraftAttachment(attachment.id);
			}
			/** Apply one operation to a pending queue occurrence. */
			async updateQueue(itemId, action) {
				const result = await this.scopedSession("updateQueue").updateQueue(itemId, action);
				if (!result.ok) {
					if (action.kind === "steer" && (result.error.code === "session/steer-unavailable" || result.error.code === "session/queue-item-not-found")) return;
					throw new Error(`conversation.updateQueue failed: ${result.error.code}: ${result.error.message}`);
				}
			}
			/** Cancel the scoped session's in-flight turn while preserving Queue (failures land in promptError and reject, as in send). */
			async cancel() {
				const result = await this.scopedSession("cancel").cancel();
				if (!result.ok) throw new Error(`conversation.cancel failed: ${result.error.code}: ${result.error.message}`);
			}
			/** Pull one older history page for the scoped Session. */
			async loadOlder() {
				await this.scopedSession("loadOlder").loadOlder();
			}
			/** Resolve the caller scope's session face or throw on root contexts. */
			scopedSession(op) {
				const id = this.scopeId(op);
				const binding = this.requireSessions().binding(id);
				if (binding === void 0) throw new Error(`conversation.${op}: session "${id}" resolved no binding`);
				return binding.session;
			}
			/** Read the caller's session scope tag via the sessions service; root contexts fail loud. */
			scopeId(op) {
				const id = this.requireSessions().scopeOf(this.ctx);
				if (id === void 0) throw new Error(`conversation.${op} requires a session scope — address one via ctx.sessions.scope(id).conversation`);
				return id;
			}
			requireSessions() {
				const sessions = this.ctx.get("sessions");
				if (sessions === void 0) throw new Error("conversation: sessions service unavailable");
				return sessions;
			}
			/**
			* Settle one submission's draft attachments when its echo retires. Observed:
			* each image leaves the registry, handing its preview URL to the durable
			* image cache (seeded under the admitted reference so the transcript node
			* renders immediately while the cache reads canonical bytes) or revoking it
			* when the cache already holds that reference. Failed: nothing changes;
			* the ids stay registered for the composer's rail restore.
			*/
			settleSubmittedAttachments(sessionId, attachments, retirement) {
				if (retirement.reason !== "observed") return;
				const uiConversation = this.ctx.get("uiConversation");
				let observedIndex = 0;
				for (const attachment of attachments) {
					const live = this.draftAttachments.get(attachment.id);
					const ref = retirement.attachments[observedIndex++];
					if (live === void 0) continue;
					if (attachment.kind === "file") {
						this.releaseDraftAttachment(attachment.id);
						continue;
					}
					this.draftAttachments.delete(attachment.id);
					if (ref !== void 0 && "mediaType" in ref && uiConversation?.seedImageUrl(sessionId, ref, attachment.previewUrl) === true) continue;
					revokePreview(attachment.previewUrl);
				}
			}
			/** Canonical base64 wire form of one browser image file. */
			async encodeImage(file) {
				return {
					mediaType: imageMediaType(file.type),
					data: await base64ImageOf(file),
					...file.name === "" ? {} : { name: file.name }
				};
			}
		};
		function imageMediaType(value) {
			switch (value) {
				case "image/png":
				case "image/jpeg":
				case "image/webp":
				case "image/gif": return value;
				default: throw new UnsupportedImageMediaTypeError(value);
			}
		}
		/**
		* Whether a browser-declared MIME selects the image draft path (all other files upload verbatim).
		* @param value - the browser's declared MIME type.
		* @returns whether the file is an accepted raster image.
		*/
		function isImageMediaType(value) {
			return value === "image/png" || value === "image/jpeg" || value === "image/webp" || value === "image/gif";
		}
		function revokePreview(url) {
			if (url.startsWith("blob:")) URL.revokeObjectURL(url);
		}
		//#endregion
		//#region lib/types/client/input/blocks.js
		/**
		* Composer blocks: the one way another plugin stops a session's input.
		*
		* The composer cannot read the plugins that would know — the dependency runs
		* ui-model-selection → ui-conversation, never back — so a blocker pushes here and the
		* bar reads its own session's store. A block carries the localized reason it
		* exists, because the plugin that raised it owns that copy; the composer only
		* knows how to render an inert textarea with a placeholder, exactly as it
		* already does for a session with no workspace.
		*
		* This is an affordance, not enforcement: the Host refuses a prompt it cannot
		* route regardless of what any client disables.
		*/
		/** The per-session composer-block registry (one instance per plugin fiber). */
		var ComposerBlockRegistry = class {
			stores = /* @__PURE__ */ new Map();
			/** @inheritdoc */
			set(sessionId, block) {
				const store = this.storeFor(sessionId);
				if (store.getSnapshot()?.reason === block?.reason) return;
				store.set(block);
			}
			/** @inheritdoc */
			storeFor(sessionId) {
				const existing = this.stores.get(sessionId);
				if (existing !== void 0) return existing;
				const created = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(void 0);
				this.stores.set(sessionId, created);
				return created;
			}
			/** @inheritdoc */
			forget(sessionId) {
				this.stores.delete(sessionId);
			}
		};
		//#endregion
		//#region lib/types/client/input/machine.js
		/** Exhaustiveness backstop for the closed InputEvent union. */
		function unreachable(value) {
			throw new Error(`unreachable input event: ${JSON.stringify(value)}`);
		}
		/** Strip a claimed command token from its submit-time draft. */
		function argsAfter(draft, token) {
			const s = draft.trimStart();
			if (s.startsWith(token)) return s.slice(token.length);
			const base = token.trimEnd();
			if (s.startsWith(base)) {
				const rest = s.slice(base.length);
				return /^\s/.test(rest) ? rest.slice(1) : rest;
			}
			return "";
		}
		/** Pure phase, claim, and attempt owner for one Session input. */
		var SubmitMachine = class {
			phase = "plain";
			claim;
			seq = 0;
			inflight;
			/** Ordinary sends detached from the editor, retained for settlement validation and cancellation. */
			detached = /* @__PURE__ */ new Map();
			/** Read-only snapshot of the submit-plane state. */
			get state() {
				const c = this.claim;
				return {
					phase: this.phase,
					...c ? { claim: {
						name: c.name,
						token: c.token,
						...c.hint !== void 0 ? { hint: c.hint } : {},
						...c.attachments === true ? { attachments: true } : {}
					} } : {}
				};
			}
			/**
			* Feed one event through the machine.
			* @param ev - submit-plane event.
			* @returns effects for the SessionInput shell, in execution order.
			*/
			dispatch(ev) {
				switch (ev.type) {
					case "draft-changed": return this.followCommand(ev.command);
					case "claim": return this.followCommand(ev.claim);
					case "enter": return this.onEnter(ev.mode, ev.draft, ev.submission);
					case "adjudicated": return this.onAdjudicated(ev.attempt, ev.outcome);
					case "adjudication-failed": return this.onAdjudicationFailed(ev.attempt, ev.message);
					case "submit-settled": return this.onSubmitSettled(ev);
					case "sink-settled": return this.onSinkSettled(ev);
					case "send-committed": return this.onSendCommitted();
					case "release": return this.onRelease();
					default: return unreachable(ev);
				}
			}
			/**
			* Outside a transaction the claim follows the document's leading command
			* chip: deleting or displacing the chip releases it, and a history restore
			* of the chip re-enters claimed. The claim event applies the same rule to a
			* chip the editor just inserted, before its update commits; busy phases
			* refuse both.
			*/
			followCommand(command) {
				if (this.phase !== "plain" && this.phase !== "claimed") return [];
				this.claim = command;
				this.phase = command === void 0 ? "plain" : "claimed";
				return [];
			}
			/** Mint an attempt and controller without assigning its lifecycle owner. */
			mintAttempt(mode, draft, submission) {
				const controller = new AbortController();
				this.seq += 1;
				return {
					attempt: {
						seq: this.seq,
						signal: controller.signal,
						draftSnapshot: draft,
						mode,
						...submission === void 0 ? {} : { submission }
					},
					controller
				};
			}
			/** Mint the frozen command/adjudication attempt. */
			beginAttempt(mode, draft, submission) {
				const flight = this.mintAttempt(mode, draft, submission);
				this.inflight = flight;
				return flight.attempt;
			}
			/** Mint an ordinary send that leaves the phase plain. */
			beginDetached(mode, draft, submission) {
				const flight = this.mintAttempt(mode, draft, submission);
				this.detached.set(flight.attempt.seq, flight.controller);
				this.claim = void 0;
				this.phase = "plain";
				return flight.attempt;
			}
			/** Default-send effects capture the sink input before the editor commit. */
			detachedEffects(attempt) {
				return [{
					type: "default-sink",
					attempt,
					draft: attempt.draftSnapshot,
					mode: attempt.mode
				}, {
					type: "commit-draft",
					retainSuffixOf: attempt.draftSnapshot
				}];
			}
			onEnter(mode, draft, submission) {
				if (this.phase === "adjudicating" || this.phase === "submitting") return [];
				if (this.phase === "claimed" && this.claim !== void 0) {
					const attempt = this.beginAttempt(mode, draft, submission);
					this.phase = "submitting";
					return [{
						type: "begin-submit",
						attempt,
						claim: this.claim,
						args: argsAfter(draft, this.claim.token)
					}];
				}
				const trimmed = draft.trim();
				if (trimmed === "") return [];
				if (trimmed.startsWith("/")) {
					const attempt = this.beginAttempt(mode, draft, submission);
					this.phase = "adjudicating";
					return [{
						type: "adjudicate",
						attempt,
						draft
					}];
				}
				return this.detachedEffects(this.beginDetached(mode, draft, submission));
			}
			onAdjudicated(attempt, outcome) {
				const flight = this.inflight;
				if (this.phase !== "adjudicating" || flight === void 0 || flight.attempt.seq !== attempt.seq) return [];
				if (outcome !== void 0 && outcome !== "handled" && "claim" in outcome) {
					this.claim = outcome.claim;
					this.phase = "submitting";
					return [{
						type: "begin-submit",
export {};
