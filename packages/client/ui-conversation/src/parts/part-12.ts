/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		* @param commandToken - claim token of the command chip opening the document, if any.
		* @returns an editor-independent snapshot.
		*/
		function snapshotDraft(text, occurrences, commandToken) {
			return {
				text,
				references: occurrences.map(copyReference),
				...commandToken === void 0 ? {} : { command: { token: commandToken } }
			};
		}
		function copyReference(reference) {
			return {
				source: reference.source,
				ref: reference.ref,
				offset: reference.offset,
				length: reference.length,
				label: reference.label,
				clipboardText: reference.clipboardText,
				...reference.appearance === void 0 ? {} : { appearance: reference.appearance },
				...reference.invalid === void 0 ? {} : { invalid: reference.invalid }
			};
		}
		//#endregion
		//#region lib/types/client/stores.js
		/** Per-session Conversation store shared by the shell body and header. */
		const CONVERSATION_STORE_KEY = "dsh.conversation";
		/**
		* Declare per-session draft persistence and View selection.
		* @returns the store handle.
		*/
		function createConversationStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					draft: "",
					view: null,
					viewRequest: null
				}),
				persist: CONVERSATION_STORE_KEY,
				actions: {
					setDraft: (d, text) => {
						d.draft = text;
					},
					setView: (d, view) => {
						d.view = view;
					},
					openView: (d, view, focus) => {
						d.view = view;
						d.viewRequest = {
							view,
							focus
						};
					},
					completeViewRequest: (d) => {
						d.viewRequest = null;
					}
				}
			});
		}
		/**
		* Read a Session's draft before its input source is published to React.
		* @param sessionId - Session-scoped persistence suffix.
		* @returns saved semantic content, or an empty document when storage is absent or invalid.
		*/
		function readConversationDraft(sessionId) {
			const empty = {
				text: "",
				references: []
			};
			if (typeof localStorage === "undefined") return empty;
			try {
				const raw = localStorage.getItem(`${CONVERSATION_STORE_KEY}.${sessionId}`);
				if (raw === null) return empty;
				const stored = JSON.parse(raw);
				if (typeof stored !== "object" || stored === null || !("draft" in stored)) return empty;
				return parseStoredDraft(stored.draft) ?? empty;
			} catch (_error) {
				return empty;
			}
		}
		/**
		* Read the persisted View preference before the Slot store is materialized.
		* @param sessionId - Session-scoped persistence suffix.
		* @returns the preferred View id, or null when storage has no usable value.
		*/
		function readConversationViewPreference(sessionId) {
			if (typeof localStorage === "undefined") return null;
			try {
				const raw = localStorage.getItem(`${CONVERSATION_STORE_KEY}.${sessionId}`);
				if (raw === null) return null;
				const stored = JSON.parse(raw);
				if (typeof stored !== "object" || stored === null || !("view" in stored)) return null;
				return typeof stored.view === "string" ? stored.view : null;
			} catch {
				return null;
			}
		}
		//#endregion
		//#region ../../context/file-reference/lib/types/grammar.js
		/**
		* Format a selected path as prompt text. Whitespace uses the quoted
		* `@"path"` grammar; a quoted directory keeps that quote open after its
		* trailing slash so completion can descend another level.
		* @param candidate - selected file or directory.
		* @param preserveQuote - retain an explicitly opened quote even when unnecessary.
		* @returns the insertion value, or `undefined` for a path the editor grammar cannot represent safely.
		*/
		function formatFileMention(candidate, preserveQuote) {
			const path = candidate.kind === "directory" ? `${candidate.path}/` : candidate.path;
			if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return void 0;
			if (!(preserveQuote || /\s/u.test(path))) return `@${path}`;
			if (candidate.kind === "directory") return `@"${path}`;
			return `@"${path}"`;
		}
		//#endregion
		//#region ../../util/workspace-path/lib/index.js
		/**
		* Read the final non-empty segment of a Workspace path for display.
		* Workspace-label surfaces use this helper instead of deriving another basename.
		* @param path - Workspace directory path using POSIX or Windows separators.
		* @returns the final segment, or an empty string for a separator-only path.
		*/
		function workspaceTitleOf(path) {
			const trimmed = path.replace(/[/\\]+$/, "");
			const separator = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
			return trimmed.slice(separator + 1);
		}
		/**
		* Strip the workspace root from a workspace-rooted absolute path (display only).
		* @param text - the path to shorten.
		* @param cwd - session workspace root; absent or empty leaves the path unchanged.
		* @returns the path relative to the workspace root, or unchanged when it is not rooted there.
		*/
		function relativizeToCwd(text, cwd) {
			if (cwd === void 0 || cwd === "") return text;
			const root = cwd.replace(/[/\\]+$/, "");
			if (text.startsWith(`${root}/`) || text.startsWith(`${root}\\`)) return text.slice(root.length + 1);
			return text;
		}
		//#endregion
		//#region lib/types/client/service.js
		/**
		* Scope-addressed conversation send, cancel, and history orchestration.
		*
		* Scope addressing rides the cordis Service tracker: property access through
		* `ctx.conversation` rebinds `this.ctx` to the caller's context, so methods
		* read the session tag with `scopeOf`. Mutable state must remain reachable
		* through one property read; assignment through the tracker proxy and `#`
		* private fields bypass that rebinding.
		*/
		/** Create one browser-only image draft descriptor; only its id enters input state. */
		function browserDraftAttachment(file) {
			return {
				kind: "image",
				id: randomUUID(),
				previewUrl: URL.createObjectURL(file),
				file
			};
		}
		/**
		* Fill the draft's intrinsic dimensions once the browser parses the image
		* header (a metadata read off the preview URL, not a full decode). Failures
		* and non-browser runtimes leave them absent — consumers size those images
		* from CSS constraints instead. The descriptors stay registry-owned; submit
		* reads the dimensions into an immutable echo snapshot, so this late write
		* does not require a store notification.
		*/
		function probeDimensions(attachment) {
			if (typeof Image !== "function") return;
			const probe = new Image();
			probe.onload = () => {
				attachment.width = probe.naturalWidth;
				attachment.height = probe.naturalHeight;
			};
			probe.src = attachment.previewUrl;
		}
		/** Give the echo one paint opportunity without letting a throttled frame clock block admission. */
		function nextPaint() {
			return new Promise((resolve) => {
				if (typeof requestAnimationFrame === "function") {
					if (typeof document !== "undefined" && document.visibilityState === "hidden") {
						setTimeout(resolve, 0);
						return;
					}
					let settled = false;
					const finish = () => {
						if (settled) return;
						settled = true;
						clearTimeout(fallback);
						setTimeout(resolve, 0);
					};
					const fallback = setTimeout(finish, 100);
					requestAnimationFrame(finish);
				} else setTimeout(resolve, 0);
			});
		}
		/** Native canonical base64 of one browser image (FileReader data-URL encode; no main-thread byte loop). */
		function base64ImageOf(file) {
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => {
					const url = reader.result;
					resolve(url.slice(url.indexOf(",") + 1));
				};
				reader.onerror = () => {
					reject(reader.error ?? /* @__PURE__ */ new Error("conversation: image read failed"));
				};
				reader.readAsDataURL(file);
			});
		}
		/** Unsupported browser-declared image type, localized by the UI boundary. */
		var UnsupportedImageMediaTypeError = class extends Error {
			/** Browser-declared MIME value, possibly empty. */
			mediaType;
			/** @param mediaType - Browser-declared MIME value, possibly empty. */
			constructor(mediaType) {
				super(`unsupported image media type: ${mediaType || "(empty)"}`);
				this.name = "UnsupportedImageMediaTypeError";
				this.mediaType = mediaType;
			}
		};
		/** Scope-addressed conversation service (root singleton, provided as `conversation`). */
		var ConversationController = class extends _deepseek_ai_cordis.Service {
			/** The per-session input machine registry (SessionInputResolver face). */
			input;
			/** The per-session composer-block registry. */
			blocks;
			/** Live upload state per file-kind draft; images never appear here. */
			fileUploads = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({});
			draftAttachments = /* @__PURE__ */ new Map();
			fileUploadOperations = /* @__PURE__ */ new Map();
			pendingFileUploads = /* @__PURE__ */ new Set();
			fileUploadQueue = [];
			activeFileUploads = 0;
			maxConcurrentFileUploads;
			/**
			* @param ctx - owning root context (the plugin apply context; the service
			* registers itself and follows that fiber's lifetime).
			* @param config - carries the SessionInputResolver and composer-block registry
			* constructed by the plugin apply (the same instances the slot inject
			* factories close over).
			*/
			constructor(ctx, config) {
				super(ctx, "conversation");
				this.input = config.input;
				this.blocks = config.blocks;
				this.maxConcurrentFileUploads = config.maxConcurrentFileUploads;
				ctx.effect(() => async () => {
					const operations = [...this.fileUploadOperations.values()];
					for (const operation of operations) operation.controller.abort();
					await Promise.allSettled([...this.pendingFileUploads]);
					this.fileUploadOperations.clear();
					this.fileUploadQueue.length = 0;
					for (const attachment of this.draftAttachments.values()) if (attachment.kind === "image") revokePreview(attachment.previewUrl);
					this.draftAttachments.clear();
					this.fileUploads.set({});
				}, "conversation draft attachments");
			}
			/**
			* Send a prompt into the scoped session. Business failures also land in the
			* session snapshot's promptError (object-layer state); the rejection here
			* exists for caller choreography (the composer restores the draft on it).
			* @param text - prompt text, sent verbatim as one text block.
			*/
			async send(text) {
				const result = await this.scopedSession("send").prompt([{
					type: "text",
					text
				}], "queue");
				if (!result.ok) throw new Error(`conversation.send failed: ${result.error.code}: ${result.error.message}`);
			}
			/**
			* Submit ordered draft attachments with text through one host admission. A local
			* submission echo enters the session snapshot synchronously; serialization
			* and the prompt round-trip start after the browser can paint it. On the
			* echo's observed retirement seeds admitted image previews into the durable
			* cache and removes every attachment from the draft registry. On failure,
			* every attachment remains registered so the composer can restore it.
			* @param session - target session.
			* @param text - serialized prompt text.
			* @param attachmentIds - ordered draft-local attachment ids.
			* @param mode - queue or steer delivery selected by composer policy.
			* @param signal - optional cancellation for the complete Host admission.
			* @returns the Host admission outcome; local attachment preparation failures reject.
			*/
			async sendSession(session, text, attachmentIds, mode, signal) {
				const attachments = this.resolveDraftAttachments(attachmentIds);
				if (attachments.length !== attachmentIds.length) throw new Error("conversation.sendSession: one or more draft attachments are no longer available");
				const uploads = this.fileUploads.getSnapshot();
				const uploadFor = (attachment) => {
					const upload = uploads[attachment.id];
					if (upload === void 0 || upload.status !== "ready") throw new Error("conversation.sendSession: one or more files have not finished uploading");
					return upload;
				};
				const pendingAttachments = attachments.map((attachment) => attachment.kind === "image" ? {
					type: "image",
					value: {
						previewUrl: attachment.previewUrl,
						...attachment.file.name === "" ? {} : { name: attachment.file.name },
						...attachment.width === void 0 ? {} : { width: attachment.width },
						...attachment.height === void 0 ? {} : { height: attachment.height }
					}
				} : {
					type: "file",
					value: uploadFor(attachment).file
				});
				const serializeAttachments = () => Promise.all(attachments.map(async (attachment) => attachment.kind === "image" ? {
					type: "image",
					...await this.encodeImage(attachment.file)
				} : {
					type: "file",
					receiptId: uploadFor(attachment).receiptId
				}));
				let finishRetirement;
				const retirement = attachments.length === 0 ? void 0 : new Promise((resolve) => {
					finishRetirement = resolve;
				});
				const submission = session.beginSubmission({
					mode,
					text,
					attachments: pendingAttachments,
					onRetire: (settlement) => {
						this.settleSubmittedAttachments(session.sessionId, attachments, settlement);
						finishRetirement?.(settlement);
					}
				});
				let content;
				try {
					await nextPaint();
					content = [...await serializeAttachments(), ...text === "" ? [] : [{
						type: "text",
						text
					}]];
				} catch (error) {
					submission.abandon();
					throw error;
				}
				if (!(await session.prompt(content, mode, signal, submission.requestId)).ok) return { kind: "error" };
				if (retirement !== void 0 && (await retirement).reason !== "observed") return { kind: "error" };
				return { kind: "success" };
			}
			/**
			* Create runtime-only draft attachments. Files whose browser MIME is an
			* accepted image type become image drafts (object URL preview, bytes sent
			* with the prompt); every other file becomes a file draft whose background
			* upload starts immediately and remains owned by this service across Session
			* navigation until completion or explicit removal.
			* @param sessionId - target Agent-scope identity.
			* @param files - browser files to register.
			* @returns ordered draft descriptors.
			*/
			createDrafts(sessionId, files) {
				return files.map((file) => {
					if (isImageMediaType(file.type)) {
						const attachment = browserDraftAttachment(file);
						this.draftAttachments.set(attachment.id, attachment);
						probeDimensions(attachment);
						return attachment;
					}
					const attachment = {
						kind: "file",
						id: randomUUID(),
						file
					};
					this.draftAttachments.set(attachment.id, attachment);
					this.beginFileUpload(sessionId, attachment);
					return attachment;
				});
			}
			/**
			* Restart one failed file upload.
			* @param sessionId - target Agent-scope identity.
			* @param id - draft attachment id whose upload previously failed.
			*/
			retryFileUpload(sessionId, id) {
				const attachment = this.draftAttachments.get(id);
				if (attachment === void 0 || attachment.kind !== "file") return;
				if (this.fileUploads.getSnapshot()[id]?.status !== "error") return;
				this.beginFileUpload(sessionId, attachment);
			}
			/**
			* Stage carried file drafts again for a new Session.
			* @param sessionId - target Agent-scope identity after a Workspace switch.
			* @param ids - carried draft attachment ids.
			*/
			rebindDraftFiles(sessionId, ids) {
				for (const id of ids) {
					const attachment = this.draftAttachments.get(id);
					if (attachment?.kind === "file") this.beginFileUpload(sessionId, attachment);
				}
			}
			beginFileUpload(sessionId, attachment) {
				this.fileUploadOperations.get(attachment.id)?.controller.abort();
				const controller = new AbortController();
				this.fileUploads.update((draft) => {
					draft[attachment.id] = {
						status: "uploading",
						loaded: 0
					};
				});
				let settle;
export {};
