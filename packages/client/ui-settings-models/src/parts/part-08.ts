/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-models/src/client/OnboardingModal.module.css.mjs
		const css$2 = ".jLrgrW_dialog{width:min(600px,100%);max-height:100%;padding:0}.jLrgrW_content{box-sizing:border-box;flex-direction:column;min-height:0;padding:28px;display:flex;overflow-y:auto}.jLrgrW_title{color:var(--dsw-alias-label-primary);outline:none;margin:0;font-size:20px;font-weight:500;line-height:28px}.jLrgrW_body{margin-top:20px}@media (width<=560px){.jLrgrW_content{padding:24px}}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-settings-models/OnboardingModal.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-models";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var OnboardingModal_module_css_default = {
			"body": "jLrgrW_body",
			"content": "jLrgrW_content",
			"dialog": "jLrgrW_dialog",
			"title": "jLrgrW_title"
		};
		//#endregion
		//#region lib/types/client/OnboardingModal.js
		/** Shared modal chrome for every step registered by this onboarding plugin. */
		const ignoreImplicitDismiss = () => {};
		/**
		* Render a blocking onboarding dialog and keep the application root inert.
		* @param props.title - accessible and visible dialog title.
		* @param props.focusTitle - focus the title when the step has no form control.
		* @param props.children - step-owned body and actions.
		* @returns the body-portaled modal.
		*/
		function OnboardingModal({ title, focusTitle = false, children }) {
			const titleRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const appRoot = document.getElementById("root");
				if (appRoot === null) return;
				const previous = appRoot.inert;
				appRoot.inert = true;
				return () => {
					appRoot.inert = previous;
				};
			}, []);
			(0, react.useEffect)(() => {
				if (focusTitle) titleRef.current?.focus();
			}, [focusTitle]);
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				title,
				onClose: ignoreImplicitDismiss,
				headless: true,
				className: OnboardingModal_module_css_default.dialog,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: OnboardingModal_module_css_default.content,
					children: [(0, react_jsx_runtime.jsx)("h2", {
						ref: titleRef,
						className: OnboardingModal_module_css_default.title,
						tabIndex: focusTitle ? -1 : void 0,
						children: title
					}), (0, react_jsx_runtime.jsx)("div", {
						className: OnboardingModal_module_css_default.body,
						children
					})]
				})
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-models/src/client/DeepSeekOnboardingDialog.module.css.mjs
		const css$1 = ".GL8Viq_description{color:var(--dsw-alias-label-secondary);margin:0;font-size:14px;line-height:24px}.GL8Viq_editor{margin-top:24px}@media (width<=560px){.GL8Viq_editor{margin-top:20px}}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-settings-models/DeepSeekOnboardingDialog.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-models";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var DeepSeekOnboardingDialog_module_css_default = {
			"description": "GL8Viq_description",
			"editor": "GL8Viq_editor"
		};
		//#endregion
		//#region lib/types/client/DeepSeekOnboardingDialog.js
		/* v8 ignore next 3 -- closed-union defaults only defend future source widening */
		function assertNever$1(_value) {
			throw new Error("unexpected DeepSeek onboarding state");
		}
		/**
		* Prompt a first-run user for the official DeepSeek credential while no
		* provider can serve requests and that credential is writable.
		* @param props - settings-shell owner state and Models feature dependencies.
		* @returns the onboarding modal or null when onboarding needs no intervention.
		*/
		function DeepSeekOnboardingDialog(props) {
			const { complete, controller, useModels, operations, schema, t, renderSlot, automatic, explicit = false } = props;
			const [apiKey, setApiKey] = (0, react.useState)(explicit);
			const state = useModels((snapshot) => snapshot);
			const readiness = onboardingReadiness(state);
			(0, react.useEffect)(() => {
				if ((automatic || explicit) && state.status === "idle") controller.load();
			}, [
				controller,
				state.status,
				automatic,
				explicit
			]);
			(0, react.useEffect)(() => {
				if (!automatic && !explicit || readiness.kind === "adapter-absent" || !explicit && readiness.kind === "provider-ready" || readiness.kind === "unavailable") complete();
			}, [
				complete,
				readiness.kind,
				explicit,
				automatic
			]);
			if (!automatic && !explicit) return null;
			switch (readiness.kind) {
				case "loading":
				case "adapter-absent":
				case "unavailable": return null;
				case "provider-ready":
					if (!explicit) return null;
					break;
				case "credential-missing": break;
				/* v8 ignore next -- every current readiness variant is handled above */
				default: return assertNever$1(readiness);
			}
			const row = state.rows.find((candidate) => candidate.entry.provider === "deepseek-official" && candidate.entry.settingsNs === "llm-deepseek" && candidate.entry.settingsPath.length === 0);
			const namespace = state.namespaces.get("llm-deepseek");
			/* v8 ignore next 2 -- credential-missing is derived only from this exact joined row. */
			if (row === void 0 || namespace === void 0) return null;
			const finishCredential = (changed) => {
				if (!changed) {
					complete();
					return;
				}
				controller.load();
			};
			const editor = (0, react_jsx_runtime.jsxs)(OnboardingModal, {
				title: t("onboardingTitle"),
				children: [(0, react_jsx_runtime.jsx)("p", {
					className: DeepSeekOnboardingDialog_module_css_default.description,
					children: t("onboardingDescription")
				}), (0, react_jsx_runtime.jsx)("div", {
					className: DeepSeekOnboardingDialog_module_css_default.editor,
					children: (0, react_jsx_runtime.jsx)(ProviderEditor, {
						provider: row.entry.provider,
						displayName: row.entry.displayName,
						namespace,
						schema,
						settingsPath: row.entry.settingsPath,
						operations,
						t,
						readOnly: false,
						hideTitle: true,
						credentialOnly: true,
						onSubmitCredential: () => {
							props.track?.("api_key_save_click", {});
						},
						credentialRequired: true,
						autoFocusCredential: true,
						cancelLabelKey: "onboardingLater",
						submitLabelKey: "onboardingSave",
						submitBusyLabelKey: "onboardingSaving",
						onClose: finishCredential
					})
				})]
			});
			return apiKey ? editor : renderSlot("settings.models.sign-in", {
				complete,
				useApiKey: () => {
					setApiKey(true);
				}
			}, { fallback: editor });
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-models/src/client/WelcomeNotice.module.css.mjs
		const css = ".t1T8VW_copy{color:var(--dsw-alias-label-secondary);font-size:14px;line-height:24px}.t1T8VW_copy p{margin:0}.t1T8VW_copy p+p{margin-top:12px}.t1T8VW_error{color:var(--dsw-alias-state-error-primary);margin:16px 0 0;font-size:14px;line-height:22px}.t1T8VW_actions{justify-content:flex-end;margin-top:24px;display:flex}.t1T8VW_primary{min-width:120px}@media (width<=560px){.t1T8VW_primary{width:100%}}";
		const tagId = "@deepseek-ai/dsh-client-ui-settings-models/WelcomeNotice.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-models";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var WelcomeNotice_module_css_default = {
			"actions": "t1T8VW_actions",
			"copy": "t1T8VW_copy",
			"error": "t1T8VW_error",
			"primary": "t1T8VW_primary"
		};
		//#endregion
		//#region lib/types/client/WelcomeNotice.js
		/** Product-wide, versioned preview notice. */
		/**
		* Render the current notice until its exact copy version is acknowledged.
		* @param props - settings-shell owner state and welcome dependencies.
		* @returns the welcome modal or null while the step decides not to show.
		*/
		function WelcomeNotice(props) {
			const { complete, controller, useWelcome, t } = props;
			const state = useWelcome((snapshot) => snapshot);
			const finished = (0, react.useRef)(false);
			const finish = (0, react.useCallback)(() => {
				if (finished.current) return;
				finished.current = true;
				complete();
			}, [complete]);
			(0, react.useEffect)(() => {
				if (state.status === "idle") controller.load();
			}, [controller, state.status]);
			(0, react.useEffect)(() => {
				if (state.acknowledged) finish();
			}, [finish, state.acknowledged]);
			if (state.status === "idle" || state.status === "loading" || state.acknowledged) return null;
			const acknowledge = async () => {
				if (await controller.acknowledge()) finish();
			};
			const paragraphs = t("welcomeBody").split("\n\n");
			return (0, react_jsx_runtime.jsxs)(OnboardingModal, {
				title: t("welcomeTitle"),
				focusTitle: true,
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						className: WelcomeNotice_module_css_default.copy,
						children: paragraphs.map((paragraph) => (0, react_jsx_runtime.jsx)("p", { children: paragraph }, paragraph))
					}),
					state.error === null ? null : (0, react_jsx_runtime.jsx)("p", {
						className: WelcomeNotice_module_css_default.error,
						role: "alert",
						children: t("welcomeError")
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: WelcomeNotice_module_css_default.actions,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							className: WelcomeNotice_module_css_default.primary,
							disabled: state.status === "saving",
							onClick: () => {
								acknowledge();
							},
							children: t("welcomeContinue")
						})
					})
				]
			});
		}
		//#endregion
		//#region lib/types/onboarding-copy.js
		/** Durable settings namespace for product-wide GUI onboarding facts. */
		const WELCOME_NOTICE_SETTINGS_NAMESPACE = "ui-settings-general";
		/** Field storing the last welcome notice version the user acknowledged. */
		const WELCOME_NOTICE_ACK_FIELD = "welcomeNoticeVersion";
		/**
		* Bump only when the notice changes materially and every user should see it
		* again. The acknowledgement is compared for exact equality.
		*/
		const WELCOME_NOTICE_VERSION = "2026-09-28.1";
		//#endregion
		//#region lib/types/client/welcome-store.js
		/**
		* Welcome-notice state derived from the welcome settings scope: the notice
		* follows the Host section and records its acknowledgement through it.
		*/
		/* v8 ignore next 3 -- closed-union default only defends future source widening */
		function assertNever(_value) {
			throw new Error("unexpected welcome settings status");
		}
		/** Coordinates the durable Host acknowledgement. */
		var WelcomeNoticeStore = class {
			scope;
			/** uSES-safe state source shared by the registered welcome step. */
			store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				status: "idle",
				acknowledged: false,
				error: null
			});
			saving = false;
			following;
			constructor(scope) {
				this.scope = scope;
			}
			/**
			* Begin following the bound scope (idempotent) and publish its current answer.
			* @returns settlement after the current answer is published.
			*/
			load() {
				this.following ??= this.scope.subscribe(() => {
					this.derive();
				});
				this.derive();
				return Promise.resolve();
			}
			/**
			* Persist this copy version through the scope. Success is judged against the
			* state the write left behind, so a refused or failed write reports false
			* after its recovery read settles.
			* @returns true when the Host holds the acknowledgement.
			*/
			async acknowledge() {
				this.saving = true;
				this.store.update((state) => {
					state.status = "saving";
					state.error = null;
				});
				try {
					await this.scope.set(WELCOME_NOTICE_ACK_FIELD, WELCOME_NOTICE_VERSION);
				} finally {
					this.saving = false;
				}
				this.derive();
				const { acknowledged } = this.store.getSnapshot();
				if (!acknowledged) this.store.update((state) => {
					state.status = "error";
					state.error = "the acknowledgement did not persist";
				});
				return acknowledged;
			}
			/** Stop following the scope. */
			dispose() {
				this.following?.();
				this.following = void 0;
			}
			derive() {
				if (this.saving) return;
				const scope = this.scope.getSnapshot();
				switch (scope.status) {
					case "loading":
						this.store.update((state) => {
							state.status = "loading";
							state.error = null;
						});
						return;
					case "unavailable":
						this.store.update((state) => {
							state.status = "error";
							state.acknowledged = false;
							state.error = "welcome acknowledgement settings are unavailable";
						});
						return;
					case "ready": {
						const acknowledged = scope.value?.[WELCOME_NOTICE_ACK_FIELD] === WELCOME_NOTICE_VERSION;
						this.store.update((state) => {
							state.status = "ready";
							state.acknowledged = acknowledged;
							state.error = null;
						});
						return;
					}
					/* v8 ignore next -- every current settings scope status is handled above */
					default: return assertNever(scope.status);
				}
			}
		};
		//#endregion
		//#region lib/types/client/operations.js
		/**
		* The Host reads and writes the Models cards perform, as callbacks built in the
		* plugin body. Cards receive these instead of a context: the outcomes name what
		* a card renders — a stored view, a stale revision, a refusal message — so the
		* failure codes and Remote namespaces stay in the apply world.
		*/
		/**
		* Bind the page's Host operations to the plugin's own Remote namespaces.
		* @param ctx - the page plugin's context, which declares `remote.credentials`,
		* `remote.llm`, and `remote.settings` in its own `inject`.
		* @returns the callbacks the section and its cards are injected with.
		*/
		function createModelsOperations(ctx) {
			return {
				storeCredential: async (ref, value) => {
					const response = await ctx.remote.credentials.set(ref, value);
					return response.ok ? void 0 : response.error.message;
				},
				removeCredential: async (ref) => {
					const response = await ctx.remote.credentials.unset(ref);
					return response.ok ? void 0 : response.error.message;
				},
				writeSettings: async (ns, ops, expectedRevision) => {
					const response = await ctx.remote.settings.mutate(ns, ops, expectedRevision);
					if (response.ok) return {
						kind: "written",
						view: response.value
					};
					const { code, message } = response.error;
					return code === "settings/conflict" ? {
						kind: "conflict",
						message
					} : {
						kind: "refused",
						message
					};
				},
				discoverModels: async (settingsNs, request) => {
					const response = await ctx.remote.llm.discoverModels(settingsNs, request);
					return response.ok ? {
						kind: "found",
						models: response.value
					} : {
						kind: "refused",
export {};
