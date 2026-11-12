/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-message-feedback",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-message-feedback/src/client/FeedbackDialog.module.css.mjs
		const css$1 = "._6_jNJa_dialog._6_jNJa_dialog{border-radius:var(--dsw-radius-panel);gap:38px;width:min(488px,100%)}._6_jNJa_categories{flex-wrap:wrap;gap:8px;margin-top:-14px;display:flex}._6_jNJa_chip{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);height:28px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;padding:0 12px;font-size:13px;line-height:18px;transition:background-color .12s,border-color .12s,color .12s}._6_jNJa_chip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}._6_jNJa_chip:disabled{cursor:default;opacity:.4}._6_jNJa_chip:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}._6_jNJa_chipActive,._6_jNJa_chipActive:hover:not(:disabled){border-color:var(--dsw-alias-button-primary-fill);background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}._6_jNJa_detail{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1);width:100%;min-height:116px;max-height:280px;color:var(--dsw-alias-label-primary);font:inherit;field-sizing:content;resize:none;margin-top:18px;padding:12px 14px;font-size:14px;line-height:22px;transition:border-color .12s,box-shadow .12s;display:block}._6_jNJa_detail::placeholder{color:var(--dsw-alias-label-caption)}._6_jNJa_detail:focus{border-color:var(--dsw-alias-border-l3);box-shadow:0 0 0 1px var(--dsw-alias-state-business-primary);outline:none}._6_jNJa_submit{border-radius:var(--dsw-radius-lg);width:100%;height:44px;font-size:14px;font-weight:500}@media (prefers-reduced-motion:reduce){._6_jNJa_chip,._6_jNJa_detail{transition:none}}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-message-feedback/FeedbackDialog.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-message-feedback";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var FeedbackDialog_module_css_default = {
			"categories": "_6_jNJa_categories",
			"chip": "_6_jNJa_chip",
			"chipActive": "_6_jNJa_chipActive",
			"detail": "_6_jNJa_detail",
			"dialog": "_6_jNJa_dialog",
			"submit": "_6_jNJa_submit"
		};
		//#endregion
		//#region lib/types/client/FeedbackDialog.js
		/**
		* The feedback dialog and its acknowledgement and failure toasts, rendered as one entry
		* of `conversation.input.overlay` so each Session owns exactly one of each.
		* The Modal and the Toast both portal to `document.body`; the overlay slot
		* only supplies the per-session controller and the composer card the toast
		* centers over.
		* @module @deepseek-ai/dsh-client-ui-message-feedback/client/FeedbackDialog
		*/
		const CATEGORIES = Object.keys({
			"task-result": true,
			"instruction-following": true,
			"product-interaction": true,
			"service-stability": true,
			"resource-cost": true,
			"security-privacy-permission": true,
			"other": true
		});
		/** Failure codes with their own copy; every other code reads the generic line. */
		const FAILURE_COPY = {
			"version-conflict": "error.conflict",
			"note-too-large": "error.noteTooLarge"
		};
		/**
		* Render one Session's feedback dialog and toast.
		* @param props - the dialog hook, the draft verbs, and the locale seat.
		* @returns the modal while a target is open and either toast while it is showing.
		*/
		function FeedbackDialog({ useDialog, edit, submit, dismiss, dismissFailure, dismissToast, t }) {
			const state = useDialog((s) => s);
			const probeRef = (0, react.useRef)(null);
			const [card, setCard] = (0, react.useState)(null);
			(0, react.useLayoutEffect)(() => {
				setCard(probeRef.current?.closest("[data-composer-card]") ?? null);
			}, []);
			const toast = state.toast;
			const onToastDone = (0, react.useCallback)(() => {
				dismissToast(toast);
			}, [dismissToast, toast]);
			(0, react.useEffect)(() => () => {
				dismissToast(toast);
			}, [dismissToast, toast]);
			const failureCode = state.failure;
			const failure = failureCode === null ? null : t(FAILURE_COPY[failureCode] ?? "error.generic");
			const onFailureDone = (0, react.useCallback)(() => {
				dismissFailure();
			}, [dismissFailure]);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("span", {
					ref: probeRef,
					hidden: true
				}),
				toast > 0 && failure === null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
					text: t("toast.recorded"),
					tone: "success",
					anchor: card,
					onDone: onToastDone
				}, toast),
				failure !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
					text: failure,
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
					anchor: card,
					holdMs: 6e3,
					onDone: onFailureDone
				}, `failure-${failureCode}`),
				(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: state.target !== null,
					title: t("dialog.title"),
					closeLabel: t("close"),
					onClose: dismiss,
					className: FeedbackDialog_module_css_default.dialog,
					footer: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: FeedbackDialog_module_css_default.submit,
						disabled: state.submitting,
						onClick: () => {
							submit();
						},
						children: state.submitting ? t("submitting") : t("submit")
					}),
					children: [(0, react_jsx_runtime.jsx)("div", {
						className: FeedbackDialog_module_css_default.categories,
						role: "group",
						"aria-label": t("dialog.categories"),
						children: CATEGORIES.map((category) => (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: state.category === category ? `${FeedbackDialog_module_css_default.chip} ${FeedbackDialog_module_css_default.chipActive}` : FeedbackDialog_module_css_default.chip,
							"aria-pressed": state.category === category,
							disabled: state.submitting,
							onClick: () => {
								edit({ category: state.category === category ? null : category });
							},
							children: t(`category.${category}`)
						}, category))
					}), (0, react_jsx_runtime.jsx)("textarea", {
						className: FeedbackDialog_module_css_default.detail,
						"aria-label": t("dialog.detail"),
						placeholder: t("dialog.hint"),
						value: state.text,
						readOnly: state.submitting,
						onChange: (event) => {
							edit({ text: event.target.value });
						}
					})]
				})
			] });
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-message-feedback/src/client/MessageFeedbackActions.module.css.mjs
		const css = "._8_XoUG_action{width:calc(28px + var(--dsh-content-font-delta,0px));height:calc(28px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}._8_XoUG_action svg{width:calc(15px + var(--dsh-content-font-delta,0px));height:calc(15px + var(--dsh-content-font-delta,0px))}._8_XoUG_action:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}._8_XoUG_action:disabled{cursor:default;opacity:.4}._8_XoUG_action[data-active]{color:var(--dsw-alias-label-tertiary)}._8_XoUG_failure{color:var(--dsw-alias-label-tertiary);padding-left:4px;font-size:13px;line-height:20px}";
		const tagId = "@deepseek-ai/dsh-client-ui-message-feedback/MessageFeedbackActions.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-message-feedback";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var MessageFeedbackActions_module_css_default = {
			"action": "_8_XoUG_action",
			"failure": "_8_XoUG_failure"
		};
		//#endregion
		//#region lib/types/client/MessageFeedbackActions.js
		/**
		* Per-message feedback controls: the Like/Dislike pair inside the assistant
		* message's IconActions row, between copy and branch. Either rating opens the
		* Session's feedback dialog, whose submission records that judgment with its
		* category and text. Clicking the recorded rating retracts it. A recorded rating
		* shows the filled glyph so the signal survives a pointer leaving the row.
		* @module @deepseek-ai/dsh-client-ui-message-feedback/client/MessageFeedbackActions
		*/
		/**
		* One message's feedback controls.
		* @param props - the owner's message identity, the injected verbs, and the
		* shared feedback hook.
		* @returns the rating buttons with any failure notice beside them.
		*/
		function MessageFeedbackActions({ messageId, ensure, current, retract, openDialog, useFeedback, t }) {
			const item = useFeedback((view) => view.items.get(messageId));
			const loadFailed = useFeedback((view) => view.status === "error");
			const rating = item?.rating;
			const [pending, setPending] = (0, react.useState)(false);
			const [failure, setFailure] = (0, react.useState)(null);
			const seeded = (0, react.useRef)(false);
			const seed = (0, react.useCallback)(() => {
				if (seeded.current) return;
				seeded.current = true;
				ensure();
			}, [ensure]);
			const alive = (0, react.useRef)(true);
			(0, react.useEffect)(() => () => {
				alive.current = false;
			}, []);
			const errorCopy = (0, react.useCallback)((result) => {
				return result.error.code === "version-conflict" ? t("error.conflict") : t("error.generic");
			}, [t]);
			const choose = (0, react.useCallback)((nextRating) => {
				setPending(true);
				setFailure(null);
				ensure().then((loaded) => {
					if (!alive.current) return;
					if (!loaded.ok || current(messageId)?.rating !== nextRating) {
						setPending(false);
						openDialog(messageId, nextRating);
						return;
					}
					retract(messageId, nextRating).then((result) => {
						if (!alive.current) return;
						setPending(false);
						if (!result.ok) setFailure(errorCopy(result));
					});
				});
			}, [
				current,
				ensure,
				errorCopy,
				messageId,
				openDialog,
				retract
			]);
			const onLike = (0, react.useCallback)(() => {
				choose("positive");
			}, [choose]);
			const onDislike = (0, react.useCallback)(() => {
				choose("negative");
			}, [choose]);
			const likeLabel = rating === "positive" ? t("action.likeActive") : t("action.like");
			const dislikeLabel = rating === "negative" ? t("action.dislikeActive") : t("action.dislike");
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: likeLabel,
					side: "bottom",
					children: (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MessageFeedbackActions_module_css_default.action,
						"aria-label": likeLabel,
						"aria-pressed": rating === "positive",
						"data-active": rating === "positive" || void 0,
						disabled: pending,
						onFocus: seed,
						onPointerEnter: seed,
						onClick: onLike,
						children: rating === "positive" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLikeFillRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLikeOutlineRegular, {})
					})
				}),
				(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: dislikeLabel,
					side: "bottom",
					children: (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: MessageFeedbackActions_module_css_default.action,
						"aria-label": dislikeLabel,
						"aria-pressed": rating === "negative",
						"data-active": rating === "negative" || void 0,
						disabled: pending,
						onFocus: seed,
						onPointerEnter: seed,
						onClick: onDislike,
						children: rating === "negative" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDislikeFillRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDislikeOutlineRegular, {})
					})
				}),
				failure === null && loadFailed && (0, react_jsx_runtime.jsx)("span", {
					className: MessageFeedbackActions_module_css_default.failure,
					role: "status",
					children: t("error.load")
				}),
				failure !== null && (0, react_jsx_runtime.jsx)("span", {
					className: MessageFeedbackActions_module_css_default.failure,
					role: "status",
					children: failure
				})
			] });
		}
		//#endregion
		//#region lib/types/client/controller.js
		const INITIAL_VIEW = Object.freeze({
			status: "cold",
			items: /* @__PURE__ */ new Map(),
			error: null
		});
		const OK = Object.freeze({ ok: true });
		const DISPOSED = Object.freeze({
			ok: false,
			error: Object.freeze({
				code: "disposed",
				message: "feedback controller is disposed"
			})
		});
		/**
		* Human-readable text for one business failure code.
		* @param code - the Host's business failure code.
		* @returns the developer-facing description carried in the failure branch.
		*/
		function describe(code) {
			switch (code) {
				case "session-not-found": return "this session is no longer persisted";
				case "target-not-found": return "this message is not a persisted assistant message";
				case "version-conflict": return "feedback changed elsewhere";
				case "note-blank": return "a note must contain a non-whitespace character";
				case "note-too-large": return "the note is too long";
				default: return code;
			}
		}
		/** Build the rejected branch for one business failure code. */
		function fail(code) {
			return {
				ok: false,
				error: {
					code,
					message: describe(code)
				}
			};
		}
		/** Carrier failure rendered with the Host-supplied code and message. */
		function carrierFailure(error) {
			return {
				ok: false,
				error: {
					code: error.code,
					message: error.message
				}
			};
		}
		/**
		* Per-session feedback object layer. One instance backs every per-message
		* control in that Session, so a single list read seeds them all.
		*/
		var MessageFeedbackController = class {
			remote;
			sessionId;
			view = INITIAL_VIEW;
			listeners = /* @__PURE__ */ new Set();
			loadPromise = null;
			operationTail = Promise.resolve();
			disposed = false;
			/**
			* @param remote - the messageFeedback Remote namespace.
			* @param sessionId - Session owning every addressed assistant message.
			*/
			constructor(remote, sessionId) {
				this.remote = remote;
				this.sessionId = sessionId;
			}
			/** Return the cached immutable view. */
			getSnapshot = () => this.view;
			/** Subscribe to view replacement. */
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			/**
			* Load once; a failed load stays retryable.
			* @returns the settled load result, shared by concurrent callers.
			*/
			ensure() {
				if (this.view.status === "ready") return Promise.resolve(OK);
				return this.refresh();
			}
			/**
			* Re-read the authoritative list, collapsing concurrent callers onto one
			* in-flight read.
			*
			* This is the unserialized read used to seed a cold controller, where no
			* mutation can be in flight yet. A reconnect must use {@link resync} instead:
			* an unserialized list response can otherwise arrive after a newer mutation's
			* reply and overwrite the version that mutation just committed.
			* @returns the settled reload result.
			*/
			refresh() {
				if (this.loadPromise !== null) return this.loadPromise;
				this.publish({
					status: "loading",
					items: this.view.items,
					error: null
				});
				const pending = this.load();
				this.loadPromise = pending;
				return pending.finally(() => {
					this.loadPromise = null;
				});
			}
			/**
			* Re-read the list behind this Session's queued mutations, so a reconnect
			* cannot resurrect a version an in-flight mutation already replaced.
			* @returns the settled reload result.
			*/
			resync() {
				return this.mutate(() => this.refresh(), { seed: false });
			}
			/**
			* Create or replace feedback for one message, comparing against the version
			* this controller last observed. The item stores exactly `entry`: an entry
			* without a note or category replaces whatever the stored item carried.
			* @param messageId - target assistant message.
			* @param rating - desired judgment.
			* @param entry - explanation and category to store with the judgment.
			* @returns the settled mutation result.
			*/
			rate(messageId, rating, entry = {}) {
				return this.mutate(async () => {
					const observed = this.view.items.get(messageId);
					return await this.putCommitted(messageId, rating, entry, observed);
				});
			}
			/**
			* Retract one message's matching committed rating. The serialized operation
			* rechecks the current item and becomes a no-op if another operation already
			* changed or removed it, so a stale retraction can never record a bare rating.
export {};
