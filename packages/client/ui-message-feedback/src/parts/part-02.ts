/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			* @param messageId - target assistant message.
			* @param rating - judgment the human asked to retract.
			* @returns the settled mutation result.
			*/
			retract(messageId, rating) {
				return this.mutate(async () => {
					const observed = this.view.items.get(messageId);
					return observed?.rating === rating ? await this.deleteCommitted(messageId, observed) : OK;
				});
			}
			/** Commit one put against the observed version and reconcile a conflict. */
			async putCommitted(messageId, rating, entry, observed) {
				const carried = await this.remote.put({
					sessionId: this.sessionId,
					messageId,
					rating,
					...entry.text === void 0 ? {} : { note: entry.text },
					...entry.category === void 0 ? {} : { category: entry.category },
					ifVersion: observed?.version ?? null
				});
				if (!carried.ok) return carrierFailure(carried.error);
				const result = carried.value;
				if (result.ok) {
					this.commit(messageId, result.value);
					return OK;
				}
				if (result.error.code === "version-conflict") this.commit(messageId, result.error.current);
				return fail(result.error.code);
			}
			/** Commit one delete against the observed version and reconcile a conflict. */
			async deleteCommitted(messageId, observed) {
				const carried = await this.remote.delete({
					sessionId: this.sessionId,
					messageId,
					ifVersion: observed.version
				});
				if (!carried.ok) return carrierFailure(carried.error);
				const result = carried.value;
				if (result.ok) {
					this.commit(messageId, null);
					return OK;
				}
				if (result.error.code === "version-conflict") this.commit(messageId, result.error.current);
				return fail(result.error.code);
			}
			/** Drop subscribers and refuse further work when the owning fiber unloads. */
			dispose() {
				this.disposed = true;
				this.listeners.clear();
			}
			/** Fetch the whole sidecar and publish it as the seeded view. */
			async load() {
				const carried = await this.remote.list({ sessionId: this.sessionId });
				if (this.disposed) return OK;
				if (!carried.ok) {
					this.publish({
						status: "error",
						items: this.view.items,
						error: carried.error.message
					});
					return carrierFailure(carried.error);
				}
				const result = carried.value;
				if (!result.ok) {
					this.publish({
						status: "error",
						items: this.view.items,
						error: describe(result.error.code)
					});
					return fail(result.error.code);
				}
				const items = /* @__PURE__ */ new Map();
				for (const item of result.value.items) items.set(item.messageId, item);
				this.publish({
					status: "ready",
					items,
					error: null
				});
				return OK;
			}
			/**
			* Serialize one mutation behind this Session's prior mutation so queued
			* operations always compare against the committed version.
			*/
			mutate(operation, options = {}) {
				const guarded = async () => {
					if (this.disposed) return DISPOSED;
					if (options.seed !== false) {
						const loaded = await this.ensure();
						if (!loaded.ok) return loaded;
						if (this.disposed) return DISPOSED;
					}
					return await operation();
				};
				const result = this.operationTail.then(guarded, guarded);
				this.operationTail = result.then(() => void 0);
				return result;
			}
			/**
			* Replace one message's entry, keeping every other entry's identity. Only a
			* `mutate` operation reaches this, and `mutate` refuses admission once the
			* controller is disposed, so no disposal guard belongs here; `publish` is
			* the single place that stops notifying after listeners are dropped.
			*/
			commit(messageId, item) {
				const items = new Map(this.view.items);
				if (item === null) items.delete(messageId);
				else items.set(messageId, item);
				this.publish({
					status: "ready",
					items,
					error: null
				});
			}
			/** Replace the view and contain subscriber failures at the observable boundary. */
			publish(view) {
				this.view = Object.freeze(view);
				for (const listener of this.listeners) try {
					listener();
				} catch (error) {
					console.error("[ui-message-feedback] subscriber threw:", error);
				}
			}
		};
		//#endregion
		//#region lib/types/client/dialog.js
		/**
		* Headless state of one Session's feedback dialog and its acknowledgement and
		* failure toasts. One form serves two targets: the Session itself (a bare `/feedback`)
		* and one assistant message (Like or Dislike). The overlay view renders from
		* the store and raises the acknowledgement after a successful submission.
		* @module @deepseek-ai/dsh-client-ui-message-feedback/client/dialog
		*/
		const CLOSED = {
			target: null,
			category: null,
			text: "",
			submitting: false,
			failure: null
		};
		/** Per-session dialog controller; one instance backs the overlay entry and every message control. */
		var FeedbackDialogController = class {
			submit;
			/** Dialog state store (the overlay entry subscribes here). */
			state = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				...CLOSED,
				toast: 0
			});
			/** Bumped by every open, dismiss, and dispose so a late settlement can tell its draft is gone. */
			generation = 0;
			toastSeq = 0;
			/**
			* @param submit - records one submission; the owner routes it by target.
			*/
			constructor(submit) {
				this.submit = submit;
			}
			/**
			* Open the dialog with an empty draft, replacing any open draft.
			* @param target - what the submission records against.
			*/
			open(target) {
				this.generation += 1;
				this.state.set({
					...CLOSED,
					target,
					toast: this.state.getSnapshot().toast
				});
			}
			/** Close the dialog and discard the draft; a toast on screen stays. */
			dismiss() {
				this.generation += 1;
				this.state.set({
					...CLOSED,
					toast: this.state.getSnapshot().toast
				});
			}
			/**
			* Replace part of the draft while it is editable.
			* @param draft - the category (null clears it) or the text as typed.
			*/
			edit(draft) {
				const s = this.state.getSnapshot();
				if (s.target === null || s.submitting) return;
				this.state.set({
					...s,
					...draft
				});
			}
			/**
			* Submit the draft; an empty draft is a valid submission. Success closes the
			* dialog and raises the acknowledgement toast; a failure keeps the dialog
			* open and publishes its code for the failure toast.
			* @returns after the submission settles.
			*/
			async submitDraft() {
				const s = this.state.getSnapshot();
				if (s.target === null || s.submitting) return;
				const generation = this.generation;
				this.state.set({
					...s,
					submitting: true,
					failure: null
				});
				const text = s.text.trim();
				const result = await this.submit(s.target, {
					...text.length === 0 ? {} : { text },
					...s.category === null ? {} : { category: s.category }
				});
				if (result.ok) {
					if (generation === this.generation) this.dismiss();
					this.acknowledge();
					return;
				}
				if (generation !== this.generation) return;
				this.state.set({
					...this.state.getSnapshot(),
					submitting: false,
					failure: result.error.code,
					toast: 0
				});
			}
			/** Clear the current failure toast without closing its draft. */
			dismissFailure() {
				const s = this.state.getSnapshot();
				this.state.set({
					...s,
					failure: null
				});
			}
			/** Show the acknowledgement toast; a toast already on screen restarts. */
			acknowledge() {
				this.toastSeq += 1;
				this.state.set({
					...this.state.getSnapshot(),
					toast: this.toastSeq
				});
			}
			/**
			* Retire one toast after its fade; a newer toast is left alone.
			* @param seq - the toast sequence the view finished showing.
			*/
			dismissToast(seq) {
				const s = this.state.getSnapshot();
				if (s.toast === seq) this.state.set({
					...s,
					toast: 0
				});
			}
			/** Scope-teardown disposer: drop the draft and the toast, orphan in-flight work. */
			dispose() {
				this.generation += 1;
				this.state.set({
					...CLOSED,
					toast: 0
				});
			}
		};
		//#endregion
		//#region lib/types/client/surface.js
		/**
		* One Session's feedback surface: the message-feedback object layer and the
		* dialog controller, plus the routing between them. A message target puts a
		* selected judgment through the message controller; the Session target records
		* through the `sessionFeedback` Remote.
		* @module @deepseek-ai/dsh-client-ui-message-feedback/client/surface
		*/
		/** The per-session pair behind every entry of one Session. */
		var FeedbackSurface = class {
			ctx;
			sessionId;
			/** The Session's message-feedback object layer, shared by every message control. */
			feedback;
			/** The Session's dialog and toast state, shared by the overlay entry and the message controls. */
			dialog;
			/**
			* @param ctx - the browser plugin context carrying both feedback Remotes.
			* @param sessionId - Session owning the transcript and the remark.
			*/
			constructor(ctx, sessionId) {
				this.ctx = ctx;
				this.sessionId = sessionId;
				this.feedback = new MessageFeedbackController(ctx.remote.messageFeedback, sessionId);
				this.dialog = new FeedbackDialogController((target, entry) => target.kind === "message" ? this.feedback.rate(target.messageId, target.rating, entry) : this.recordSession(entry));
			}
			/** Record one Session-level remark through the sessionFeedback Remote. */
			async recordSession(entry) {
				const carried = await this.ctx.remote.sessionFeedback.record({
					sessionId: this.sessionId,
					...entry
				});
				if (!carried.ok) return {
					ok: false,
					error: {
						code: carried.error.code,
						message: carried.error.message
					}
				};
				if (carried.value.ok) return { ok: true };
				return {
					ok: false,
					error: {
						code: carried.value.error.code,
						message: describe(carried.value.error.code)
					}
				};
			}
			/** Drop both controllers when the owning fiber unloads. */
			dispose() {
				this.feedback.dispose();
				this.dialog.dispose();
			}
		};
		//#endregion
		//#region lib/types/client/locales.js
		/** `feedback` namespace dictionaries. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"action.like": "好的回答",
			"action.likeActive": "取消标记",
			"action.dislike": "有问题的回答",
			"action.dislikeActive": "取消标记",
			"dialog.title": "提交反馈",
			"dialog.categories": "反馈分类",
			"dialog.detail": "反馈详情",
			"dialog.hint": "填写详情以帮助我们改进体验，提交内容会包括当前对话的日志",
			"category.task-result": "任务结果",
			"category.instruction-following": "指令理解与遵循",
			"category.product-interaction": "产品功能与交互",
			"category.service-stability": "稳定性和速度",
			"category.resource-cost": "资源使用与费用",
			"category.security-privacy-permission": "安全隐私与权限",
			"category.other": "其他",
			"toast.recorded": "感谢你的反馈",
			"error.conflict": "这条反馈已在别处改动，已显示最新状态",
			"error.load": "反馈状态加载失败",
			"error.generic": "反馈保存失败",
			"error.noteTooLarge": "描述太长，请缩短后再提交"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"action.like": "Good response",
			"action.likeActive": "Remove rating",
			"action.dislike": "Bad response",
			"action.dislikeActive": "Remove rating",
			"dialog.title": "Submit feedback",
			"dialog.categories": "Feedback category",
			"dialog.detail": "Feedback details",
			"dialog.hint": "Add details to help us improve. Your submission will include the current conversation log.",
			"category.task-result": "Task result",
			"category.instruction-following": "Instruction understanding and following",
			"category.product-interaction": "Product features and interaction",
			"category.service-stability": "Stability and speed",
			"category.resource-cost": "Resource usage and cost",
			"category.security-privacy-permission": "Security, privacy, and permissions",
			"category.other": "Other",
			"toast.recorded": "Thanks for your feedback",
			"error.conflict": "This feedback changed elsewhere; the latest state is shown",
			"error.load": "Could not load feedback",
			"error.generic": "Could not save feedback",
			"error.noteTooLarge": "The description is too long; shorten it and submit again"
		};
		//#endregion
		//#region lib/types/client/index.js
		/**
		* Feedback surface plugin, browser half: the Like/Dislike entry in the
		* conversation.chat.assistant-actions strip, the feedback dialog and its
		* acknowledgement and failure toasts in conversation.input.overlay, and the `/feedback`
		* decoration that opens the dialog from the composer menu or a bare typed
		* command. The feedbackUi service opens the same dialog for other plugins.
		* One FeedbackSurface per Session backs every entry in that Session.
		* @module @deepseek-ai/dsh-client-ui-message-feedback/client
		*/
		/** Dictionary namespace owned by this plugin. */
		const NS = "feedback";
		/** Required services: the slot registry, the two Remote namespaces, and the copy. */
		const inject = [
			"slots",
			"remote",
			"remote.messageFeedback",
			"remote.sessionFeedback",
			"locale"
		];
		/**
		* Client plugin body: the per-message feedback entry, the Session's dialog
		* entry, the `feedbackUi` service, the `/feedback` decoration, and their
		* per-session surfaces.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-message-feedback: dictionaries");
			const surfaces = /* @__PURE__ */ new Map();
			const surfaceFor = (sessionId) => {
				let surface = surfaces.get(sessionId);
				if (surface === void 0) {
					surface = new FeedbackSurface(ctx, sessionId);
					surfaces.set(sessionId, surface);
export {};
