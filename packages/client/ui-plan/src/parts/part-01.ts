/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-plan",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		require("@deepseek-ai/cordis");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		//#region ../../util/crypto/src/index.ts
		/**
		* Random v4 UUID, minted from `crypto.getRandomValues`.
		* @returns the UUID string.
		*/
		function randomUUID() {
			const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
			const hex = Array.from(bytes, (byte, index) => {
				return (index === 6 ? byte & 15 | 64 : index === 8 ? byte & 63 | 128 : byte).toString(16).padStart(2, "0");
			}).join("");
			return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-plan/src/client/PlanPreview.module.css.mjs
		const css$1 = ".k74WwW_cards{flex-direction:column;gap:10px;display:flex}.k74WwW_card{--plan-card-fill:var(--dsw-static-neutral-50);--plan-card-hover:var(--dsw-static-neutral-100);box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--plan-card-fill);width:100%;min-width:0;height:60px;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;align-items:center;gap:10px;margin:0;padding:8px 10px;transition:background-color .12s;display:flex}body[data-ds-dark-theme] .k74WwW_card{--plan-card-fill:var(--dsw-static-neutral-850);--plan-card-hover:var(--dsw-static-neutral-800)}.k74WwW_card:hover{background:var(--plan-card-hover)}.k74WwW_card:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px}.k74WwW_cardIcon{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l1);background:color-mix(in srgb, var(--dsw-static-neutral-00) 50%, transparent);border-radius:10px;flex:none;place-items:center;width:40px;height:40px;display:grid}body[data-ds-dark-theme] .k74WwW_cardIcon{background:color-mix(in srgb, var(--dsw-static-neutral-00) 5%, transparent)}.k74WwW_cardDetails{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.k74WwW_cardTitle{text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.k74WwW_cardDescription{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:16px;overflow:hidden}.k74WwW_cardOpen{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-button-floating-fill);flex:none;align-items:center;height:28px;padding:4px 8px;font-size:12px;line-height:18px;display:inline-flex}.k74WwW_reviewLink{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:0;align-items:center;gap:4px;padding:0;display:inline-flex}.k74WwW_reviewLink:hover{color:var(--dsw-alias-label-primary)}.k74WwW_reviewLink:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px}.k74WwW_preview{box-sizing:border-box;height:100%;padding:20px 24px 40px;position:relative;overflow:auto}.k74WwW_document{color:var(--dsw-alias-label-primary);overflow-wrap:anywhere;font-size:14px;line-height:1.75}.k74WwW_message{color:var(--dsw-alias-label-secondary);padding:24px;font-size:14px}.k74WwW_titleIcon{flex:none}@media (width<=767px){.k74WwW_preview{padding:16px 18px 32px}}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-plan/PlanPreview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-plan";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var PlanPreview_module_css_default = {
			"card": "k74WwW_card",
			"cardDescription": "k74WwW_cardDescription",
			"cardDetails": "k74WwW_cardDetails",
			"cardIcon": "k74WwW_cardIcon",
			"cardOpen": "k74WwW_cardOpen",
			"cardTitle": "k74WwW_cardTitle",
			"cards": "k74WwW_cards",
			"document": "k74WwW_document",
			"message": "k74WwW_message",
			"preview": "k74WwW_preview",
			"reviewLink": "k74WwW_reviewLink",
			"titleIcon": "k74WwW_titleIcon"
		};
		//#endregion
		//#region lib/types/client/PlanCard.js
		/** Persistent transcript cards and pending-review sidebar navigation. */
		/**
		* Render the completed Turn's submitted plans in invocation order.
		* @param props - Logged plan, localized copy, and Session-bound navigation.
		* @returns keyboard-accessible plan cards, or null for a Turn without plans.
		*/
		function PlanCards({ turn, usePlans, openPlan, t }) {
			const plans = usePlans(String(turn.turn));
			if (plans === void 0 || plans.length === 0) return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: PlanPreview_module_css_default.cards,
				"data-plan-artifacts": true,
				children: plans.map((plan) => (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: PlanPreview_module_css_default.card,
					"data-plan-card": plan.callId,
					"aria-label": t("preview.openNamed", { title: plan.title }),
					onClick: () => {
						openPlan(plan.callId);
					},
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: PlanPreview_module_css_default.cardIcon,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
								kind: "markdown",
								size: 20
							})
						}),
						(0, react_jsx_runtime.jsxs)("span", {
							className: PlanPreview_module_css_default.cardDetails,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: PlanPreview_module_css_default.cardTitle,
								children: plan.title
							}), (0, react_jsx_runtime.jsx)("span", {
								className: PlanPreview_module_css_default.cardDescription,
								children: t("preview.document")
							})]
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: PlanPreview_module_css_default.cardOpen,
							children: t("preview.action")
						})
					]
				}, plan.callId))
			});
		}
		/**
		* Open each pending plan automatically and retain a manual opener without answering it.
		*
		* The automatic open waits for a Session on screen. `ctx.sidebarRight` names
		* the Session before the commit that brings its Conversation back renders, so
		* a review that arrived while the Conversation was off screen opens from the
		* effect of the commit that mounts it.
		* @param props - Review identity, Session store, localized copy, and navigation.
		* @returns an opener for either logged or temporary plan text.
		*/
		function PlanReviewOpen({ review, requestKey, openReview, useSidebarMounted, t, useStore, actions }) {
			const identity = review.callId === void 0 ? `review:${requestKey}` : `call:${review.callId}`;
			const opened = useStore((state) => state.opened[identity] === true);
			const mounted = useSidebarMounted((session) => session !== void 0);
			(0, react.useEffect)(() => {
				if (opened || !mounted) return;
				openReview(review, requestKey);
				actions.markOpened(identity);
			}, [
				identity,
				opened,
				mounted,
				openReview,
				review,
				requestKey,
				actions
			]);
			return (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: PlanPreview_module_css_default.reviewLink,
				title: t("preview.open"),
				"aria-label": t("preview.open"),
				onClick: () => {
					openReview(review, requestKey);
				},
				children: [t("preview.full"), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { size: 14 })]
			});
		}
		//#endregion
		//#region lib/types/client/review-preview.js
		/**
		* Name one temporary review within its browser lifetime and Session.
		* @param sessionId - Session displaying the review.
		* @param requestKey - Browser-unique pending request identity.
		* @returns the address used to focus or reopen its preview.
		*/
		function reviewPreviewAddress(sessionId, requestKey) {
			return `dsh-resource://plan-review/${encodeURIComponent(sessionId)}/${encodeURIComponent(requestKey)}`;
		}
		/**
		* Recognize temporary plan navigation without interpreting it as logged history.
		* @param address - Saved or caller-supplied navigation address.
		* @returns whether the address identifies a temporary review preview.
		*/
		function isReviewPreviewAddress(address) {
			return /^dsh-resource:\/\/plan-review\/[^/?#]+\/[^/?#]+$/.test(address);
		}
		//#endregion
		//#region lib/types/client/failure-line.js
		/**
		* Explain a failed plan read in the current locale.
		* @param t - Plan namespace translator.
		* @param failure - Failure reported by the resource provider.
		* @returns localized plan copy, or the external failure's diagnostic.
		*/
		function planFailureLine(t, failure) {
			switch (failure.code) {
				case "plan/invalid-address": return t("preview.invalidAddress");
				case "plan/unavailable": return t("preview.historyUnavailable");
				case "plan/not-found": return t("preview.notFound");
				default: return failure.message;
			}
		}
		//#endregion
		//#region lib/types/client/PlanPreview.js
		/** Read-only Markdown viewer for logged plans and temporary review documents. */
		/**
		* Render the submitted plan with its complete Markdown.
		* @param props - Framework-bound tab identity, resource, and copy.
		* @returns the plan document or a localized loading/failure state.
		*/
		function PlanPreview({ useTabInfo, useResource, t }) {
			const tab = useTabInfo();
			const resource = useResource(tab.tab.navigation.address);
			const temporary = isReviewPreviewAddress(tab.tab.navigation.address);
			const params = tab.tab.navigation.params;
			const plan = temporary ? params !== void 0 && "planReview" in params ? params.planReview : void 0 : resource.value;
			const labels = (0, react.useMemo)(() => ({
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied"),
					toolbarLabels: {
						codeLabel: t("codeBlock.title"),
						wrapLabel: t("codeBlock.wrap"),
						unwrapLabel: t("codeBlock.unwrap")
					}
				},
				footnotes: t("markdown.footnotes")
			}), [t]);
			if (plan === void 0) return (0, react_jsx_runtime.jsxs)("div", {
				className: PlanPreview_module_css_default.message,
				role: "status",
				children: [temporary ? t("preview.expired") : resource.status === "none" ? t("preview.unavailable") : resource.status === "failed" ? t("preview.failed") : t("preview.loading"), !temporary && resource.failure !== void 0 && (0, react_jsx_runtime.jsx)("p", { children: planFailureLine(t, resource.failure) })]
			});
			return (0, react_jsx_runtime.jsx)("section", {
				className: PlanPreview_module_css_default.preview,
				"data-plan-preview": "callId" in plan ? plan.callId : tab.tab.navigation.address,
				"aria-label": plan.title,
				children: (0, react_jsx_runtime.jsx)("div", {
					className: PlanPreview_module_css_default.document,
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
						text: plan.markdown,
						labels
					})
				})
			});
		}
		/**
		* Display a plain file icon and the heading in its tab after resource recovery.
		* @param props - Framework-bound tab identity and resource reader.
		* @returns a decorative file icon followed by the recovered title or initial localized label.
		*/
		function PlanTitle({ useTabInfo, useResource }) {
			const tab = useTabInfo();
			const resource = useResource(tab.tab.navigation.address);
			const params = tab.tab.navigation.params;
			const plan = isReviewPreviewAddress(tab.tab.navigation.address) ? params !== void 0 && "planReview" in params ? params.planReview : void 0 : resource.value;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
				kind: "other",
				size: 16,
				className: PlanPreview_module_css_default.titleIcon
			}), plan?.title ?? tab.tab.title] });
		}
		//#endregion
		//#region lib/types/client/plan.js
		function record(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		/**
		* Read a complete plan from untrusted logged arguments.
		* @param event - Native call or PTC dispatch event from Session history.
		* @returns the submitted plan, or undefined for unrelated or malformed data.
		*/
		function submittedPlan(event) {
			if (event.type !== "tool/call" && event.type !== "tool/ptc-dispatch-start" && event.type !== "tool/ptc-dispatch") return void 0;
			const data = event.data;
			if (!record(data) || data.name !== "exit_plan_mode") return void 0;
			const callId = event.type === "tool/call" ? data.callId : data.subCallId;
			if (typeof callId !== "string" || callId === "") return void 0;
			let args = data.arguments;
			if (event.type === "tool/call") {
				if (typeof args !== "string") return void 0;
				try {
					args = JSON.parse(args);
				} catch (_error) {
					return;
				}
			}
			if (!record(args) || typeof args.plan !== "string") return void 0;
			const markdown = args.plan;
			const title = /^#\s+(\S[^\r\n]*)/.exec(markdown.trim())?.[1];
			return title === void 0 ? void 0 : {
				callId,
				markdown,
				title
			};
		}
		/**
		* Encode the durable identity of a plan without retaining its text in layout storage.
		* @param target - Session and tool-call identity.
		* @returns the plan resource address.
		*/
		function planAddress(target) {
			const { session, callId } = target;
			return `dsh-resource://plan/${(session.kind === "session" ? [session.sessionId, callId] : [
				"subagent",
				session.parentSessionId,
				session.childSessionId,
				session.mode,
				callId
			]).map(encodeURIComponent).join("/")}`;
		}
		/**
		* Validate a saved or caller-supplied plan resource address.
		* @param address - Address submitted to the sidebar or resource provider.
		* @returns the decoded identity, or undefined for an unsupported address.
		*/
		function parsePlanAddress(address) {
			const match = /^dsh-resource:\/\/plan\/([^?#]+)$/.exec(address);
			if (match === null) return void 0;
			try {
				const parts = match[1].split("/").map(decodeURIComponent);
				if (parts.some((part) => part === "")) return void 0;
				if (parts.length === 2) return {
					session: {
						kind: "session",
						sessionId: parts[0]
					},
					callId: parts[1]
				};
				if (parts.length === 5 && parts[0] === "subagent" && (parts[3] === "one-shot" || parts[3] === "continuable" || parts[3] === "unknown")) return {
					session: {
						kind: "subagent",
						parentSessionId: parts[1],
						childSessionId: parts[2],
						mode: parts[3]
					},
					callId: parts[4]
				};
				return;
			} catch (_error) {
				return;
			}
		}
		//#endregion
		//#region lib/types/client/plan-definition.js
		/** One card per invocation; a later PTC settlement retains the original card position. */
		const planDefinition = {
			kind: "submitted-plan",
			target: "chat",
			match: (event) => {
				const plan = submittedPlan(event);
				return plan === void 0 ? null : {
					id: plan.callId,
					role: event.type === "tool/ptc-dispatch" ? "update" : "start"
				};
			},
			start: (_context, match) => submittedPlan(match.event),
			update: (context) => context.state,
			buildViewNode: (context) => {
				const start = context.start ?? context.matches[0];
				const data = context.state ?? (start === void 0 ? void 0 : submittedPlan(start.event));
				if (data === void 0 || start === void 0) return null;
				return {
					key: context.key,
					kind: "submitted-plan",
					id: context.id,
					target: "chat",
					anchorSeq: start.event.seq,
					location: start.location,
					visibility: "hidden",
					data
				};
			}
		};
		//#endregion
		//#region ../../typert/protocol/src/remote-error.ts
		/**
		* One Remote call failure: a real Error carrying its stable code and typed
		* details. Owners throw it at the failure point; the Host Gateway encodes it
		* onto the wire unchanged; the Client face rebuilds an instance for the
		* `RemoteResult` error branch, so `throw result.error` keeps throw semantics.
		* Discrimination is always by `code`, never by instanceof.
		*/
		var RemoteError = class extends Error {
			code;
			details;
			/** Structural marker: cross-realm/bundle identification never uses instanceof. */
			isDSHRemoteError = true;
			/**
			* @param code - stable failure code declared in {@link RemoteErrorDetailsMap}.
			* @param message - human diagnostic carried across the wire.
			* @param details - structured payload typed by the code.
			* @param options - standard Error options (`cause` survives in-process only).
			*/
			constructor(code, message, details, options) {
				super(message, options);
				this.code = code;
				this.details = details;
				this.name = "RemoteError";
			}
		};
		/**
		* Structurally identify a RemoteError thrown across module or realm copies of
		* this class. Mechanism-internal: the Gateway and test assertions use it;
		* business code receives typed failures and never needs it.
		* @param value - a caught value.
		* @returns the failure when the marker matches, otherwise undefined.
		*/
		function remoteErrorOf(value) {
			if (typeof value === "object" && value !== null && value.isDSHRemoteError === true && typeof value.code === "string") return value;
		}
		//#endregion
		//#region ../../typert/protocol/src/index.ts
		/**
		* Remote decorators and explicit Gateway bindings backed by versioned
		* descriptors carried on decorated class prototypes. Strict reflection
		* remains a Typert compiler responsibility.
		* @module @deepseek-ai/dsh-typert-protocol
		*/
		//#endregion
		//#region lib/types/client/plan-resource.js
		/**
		* Bind plan reads to the generated Session Remote face.
		* Opening a follow reads projections and may activate a prepared Session on the Host.
		* Generated Remote streams can throw carrier failures; the provider reports failed
		* reads as resource failure frames and preserves Remote error codes.
		* @param remote - Existing Session history API.
		* @returns a provider whose reads stop after finding the exact invocation.
		*/
		function planResourceProvider(remote) {
			return {
				protocol: "plan",
				async *open(address, { signal }) {
export {};
