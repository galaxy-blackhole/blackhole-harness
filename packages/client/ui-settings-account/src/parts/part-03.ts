/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				messages.push(error);
			}
			throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		});
		Schema.extend("intersect", (data, { list, toString }, options, strict) => {
			if (!list.length) return [data];
			let result;
			for (const inner of list) {
				const value = Schema.resolve(data, inner, options, true)[0];
				if (isNullable(value)) continue;
				if (isNullable(result)) result = value;
				else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
				else if (typeof value === "object") merge(result ??= {}, value);
				else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
			}
			if (!strict && isPlainObject(data)) merge(result, data);
			return [result];
		});
		Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
			const [result, adapted = data] = Schema.resolve(data, inner, options, true);
			if (preserve) return [callback(result)];
			else return [callback(result), callback(adapted)];
		});
		const formatters = {};
		function defineMethod(name, keys, format) {
			formatters[name] = format;
			Object.assign(Schema, { [name](...args) {
				const schema = new Schema({ type: name });
				keys.forEach((key, index) => {
					switch (key) {
						case "sKey":
							schema.sKey = args[index] ?? Schema.string();
							break;
						case "inner":
							schema.inner = Schema.from(args[index]);
							break;
						case "list":
							schema.list = args[index].map(Schema.from);
							break;
						case "dict":
							schema.dict = mapValues(args[index], Schema.from);
							break;
						case "bits":
							schema.bits = {};
							for (const key in args[index]) {
								if (typeof args[index][key] !== "number") continue;
								schema.bits[key] = args[index][key];
							}
							break;
						case "callback": {
							const callback = schema.callback = args[index];
							callback["toJSON"] ||= () => callback.toString();
							break;
						}
						case "constructor": {
							const constructor = schema.constructor = args[index];
							if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
							break;
						}
						default: schema[key] = args[index];
					}
				});
				if (name === "object" || name === "dict") schema.meta.default = {};
				else if (name === "array" || name === "tuple") schema.meta.default = [];
				else if (name === "bitset") schema.meta.default = 0;
				return schema;
			} });
		}
		defineMethod("is", ["constructor"], ({ constructor }) => {
			if (typeof constructor === "function") return constructor.name;
			else return constructor;
		});
		defineMethod("any", [], () => "any");
		defineMethod("never", [], () => "never");
		defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
		defineMethod("string", [], () => "string");
		defineMethod("number", [], () => "number");
		defineMethod("boolean", [], () => "boolean");
		defineMethod("bitset", ["bits"], () => "bitset");
		defineMethod("function", [], () => "function");
		defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
		defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
		defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
		defineMethod("object", ["dict"], ({ dict }) => {
			if (Object.keys(dict).length === 0) return "{}";
			return `{ ${Object.entries(dict).map(([key, inner]) => {
				return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
			}).join(", ")} }`;
		});
		defineMethod("union", ["list"], ({ list }, inline) => {
			const result = list.map(({ toString: format }) => format()).join(" | ");
			return inline ? `(${result})` : result;
		});
		defineMethod("intersect", ["list"], ({ list }) => {
			return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
		});
		defineMethod("transform", [
			"inner",
			"callback",
			"preserve"
		], ({ inner }, isInner) => inner.toString(isInner));
		//#endregion
		//#region lib/types/contact-config.js
		/** Public contact and bonus notice options shared by Host and Client. */
		/** Validate public questionnaire options. */
		const ContactConfigFields = {
			contactFormUrl: Schema.string().pattern(/^https:\/\/[^/\s]+\//).default("https://trtgsjkv6r.feishu.cn/share/base/form/shrcnlCoGElW7MQznGy9r3YYXcg?hide_uid=1&hide_device_info=1&hide_harness_version=1"),
			contactSource: Schema.string().default(""),
			bonusAckRetryDelayMs: Schema.number().min(1).default(1e3),
			bonusAckRetryMaxDelayMs: Schema.number().min(1).default(6e4)
		};
		/** Validate public questionnaire options. */
		const ContactConfig = Schema.object(ContactConfigFields);
		//#endregion
		//#region lib/types/client/contact-url.js
		/**
		* Build an external questionnaire URL without authentication credentials.
		* @param config - questionnaire destination and supported source option.
		* @param context - account, build and environment facts sampled by the caller.
		* @returns questionnaire URL with hidden, optionally prefilled context fields.
		*/
		function contactUrl(config, context) {
			const url = new URL(config.contactFormUrl);
			const ratio = Number.isFinite(context.pixelRatio) ? context.pixelRatio : 1;
			const width = Math.round(context.width * ratio);
			const height = Math.round(context.height * ratio);
			const deviceInfo = [context.deviceInfo];
			if (width > 0 && height > 0) deviceInfo.push(`screen_resolution=${width}x${height}`);
			const fields = {
				uid: context.uid,
				source: config.contactSource,
				harness_version: context.version,
				device_info: deviceInfo.filter(Boolean).join("; ")
			};
			for (const [name, value] of Object.entries(fields)) {
				url.searchParams.set(`hide_${name}`, "1");
				url.searchParams.delete(`prefill_${name}`);
				if (value) url.searchParams.set(`prefill_${name}`, value);
			}
			for (const name of [
				"os_version",
				"device_brand",
				"app_locale",
				"screen_resolution",
				"app_version",
				"device_model"
			]) {
				url.searchParams.delete(`prefill_${name}`);
				url.searchParams.delete(`hide_${name}`);
			}
			return url.href;
		}
		//#endregion
		//#region lib/types/client/authorize-url.js
		/** Platform authorization links that carry the active application palette into the login page. */
		/**
		* Add the resolved application palette to a Platform authorization link without
		* dropping any parameter the Host already put on it.
		* @param authorizeUrl - authorization URL of the current account attempt.
		* @param colorScheme - resolved scheme of the active application theme.
		* @returns the authorization URL carrying `theme=light` or `theme=dark`.
		*/
		function authorizeUrlWithTheme(authorizeUrl, colorScheme) {
			const url = new URL(authorizeUrl);
			url.searchParams.set("theme", colorScheme);
			return url.href;
		}
		//#endregion
		//#region lib/types/client/browser-login.js
		/** Keeps a preopened browser tab separate from Host authorization state. */
		var BrowserLogin = class {
			destination;
			popup = null;
			navigated = false;
			attempt;
			/** @param destination - maps the Host authorization URL to the page the tab opens, read when the tab navigates. */
			constructor(destination) {
				this.destination = destination;
			}
			/**
			* Preopen a tab and bind it to the attempt returned by the Host.
			* @param request - authenticated Host start request.
			* @param latest - most recent streamed state, including frames received before the response.
			* @returns after this UI is following the new attempt.
			*/
			async start(request, latest) {
				this.begin();
				try {
					this.follow(await request());
					this.update(latest());
				} catch (error) {
					this.dispose();
					throw error;
				}
			}
			/** Preopen a tab during the user's click; blocked popups need the copy-link route. */
			begin() {
				this.dispose();
				this.popup = window.open("about:blank", "_blank");
				if (this.popup) this.popup.opener = null;
			}
			/**
			* Bind the preopened tab to its Host attempt.
			* @param view - initial RPC response identifying this UI's attempt.
			*/
			follow(view) {
				this.attempt = view.attempt?.id;
				this.update(view);
			}
			/**
			* Navigate or close the pending tab when its attempt changes.
			* @param view - latest Host state.
			*/
			update(view) {
				const attempt = view?.attempt;
				if (attempt?.id !== this.attempt) return;
				if (attempt && [
					"failed",
					"expired",
					"cancelled"
				].includes(attempt.phase)) {
					this.dispose();
					return;
				}
				if (attempt?.phase === "succeeded") {
					if (!this.navigated) this.popup?.close();
					this.popup = null;
					this.attempt = void 0;
					return;
				}
				if (!attempt?.authorizeUrl || this.navigated) return;
				this.navigated = true;
				if (this.popup && !this.popup.closed) this.popup.location.replace(this.destination(attempt.authorizeUrl));
			}
			/** Close the owned authorization tab and stop following its attempt. */
			dispose() {
				this.popup?.close();
				this.popup = null;
				this.attempt = void 0;
				this.navigated = false;
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-account/src/client/SignInDialog.module.css.mjs
		const css$7 = "._76YFJG_dialog{user-select:none;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-inverted)}._76YFJG_content{flex-direction:column;width:100%;display:flex}._76YFJG_header{justify-content:space-between;align-items:center;gap:8px;padding:22px 24px 12px;display:flex}._76YFJG_title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px}._76YFJG_close{box-sizing:border-box;border-radius:var(--dsw-radius-sm);width:28px;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:0;flex:none;justify-content:center;align-items:center;padding:6px;display:inline-flex}._76YFJG_close:hover{background:var(--dsw-alias-interactive-bg-hover)}._76YFJG_actions{box-sizing:border-box;justify-content:flex-end;align-items:center;gap:8px;width:100%;padding:0 24px;display:flex}._76YFJG_primaryButton,._76YFJG_secondaryButton{box-sizing:border-box;border-radius:var(--dsw-radius-md);min-width:72px;height:36px;font-size:14px;line-height:22px}._76YFJG_primaryButton{padding:0 16px;font-weight:500}._76YFJG_secondaryButton{border:.5px solid var(--dsw-alias-border-l2);padding:0 14px}._76YFJG_description{color:var(--dsw-alias-label-primary);margin:0;padding:0 24px;font-size:14px;line-height:22px}._76YFJG_link{color:inherit;font:inherit;cursor:pointer;background:0 0;border:0;padding:0;text-decoration:underline}._76YFJG_spinner{flex:none;animation:1s linear infinite _76YFJG_spin}._76YFJG_primaryButton:has(._76YFJG_spinner){opacity:1}@keyframes _76YFJG_spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){._76YFJG_spinner{animation:none}}";
		const tagId$7 = "@deepseek-ai/dsh-client-ui-settings-account/SignInDialog.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$7) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-account";
			tag.dataset.pluginCss = tagId$7;
			tag.textContent = css$7;
			document.head.appendChild(tag);
		}
		var SignInDialog_module_css_default = {
			"actions": "_76YFJG_actions",
			"close": "_76YFJG_close",
			"content": "_76YFJG_content",
			"description": "_76YFJG_description",
			"dialog": "_76YFJG_dialog",
			"header": "_76YFJG_header",
			"link": "_76YFJG_link",
			"primaryButton": "_76YFJG_primaryButton",
			"secondaryButton": "_76YFJG_secondaryButton",
			"spin": "_76YFJG_spin",
			"spinner": "_76YFJG_spinner",
			"title": "_76YFJG_title"
		};
		//#endregion
		//#region lib/types/client/SignInDialog.js
		/** Account authorization dialog; errors allow retry after cancelling any active attempt. */
		/** @param props - safe account state, localized copy, and user actions. @returns login dialog. */
		function SignInDialog({ account, colorScheme, start, cancel, close, useApiKey, t }) {
			const [busy, setBusy] = (0, react.useState)(false);
			const [failed, setFailed] = (0, react.useState)(false);
			const [copyResult, setCopyResult] = (0, react.useState)(null);
			const attempt = account.view?.attempt;
			(0, react.useEffect)(() => {
				setCopyResult(null);
			}, [attempt?.id, attempt?.authorizeUrl]);
			(0, react.useEffect)(() => {
				if (copyResult === null) return;
				const timer = setTimeout(() => {
					setCopyResult(null);
				}, 2e3);
				return () => {
					clearTimeout(timer);
				};
			}, [copyResult]);
			const authorizeUrl = attempt?.authorizeUrl;
			const phase = attempt?.phase;
			const active = busy || phase === "initializing" || phase === "waiting-browser" || phase === "exchanging" || phase === "committing";
			const expired = phase === "expired";
			const localFailure = failed || account.loginFailed || account.failed;
			const error = localFailure || phase === "failed";
			const failureKey = !localFailure && phase === "failed" && attempt?.errorCode === "no-response" ? "noResponse" : "failed";
			const waiting = active && !error;
			const committing = phase === "committing";
			(0, react.useEffect)(() => {
				if (account.view?.status === "credential-stored") close();
			}, [account.view?.status, close]);
			const run = async (action) => {
				setBusy(true);
				setFailed(false);
				try {
					await action();
				} catch {
					setFailed(true);
				} finally {
					setBusy(false);
				}
			};
			const dismiss = () => {
				if (committing || busy) return;
				if (active && attempt) run(async () => {
					await cancel(attempt.id);
					close();
				});
				else close();
			};
			const retry = async () => {
				if (active && attempt) await cancel(attempt.id);
				await start();
			};
			const copyLink = async (authorizeUrl) => {
				try {
					await navigator.clipboard.writeText(authorizeUrlWithTheme(authorizeUrl, colorScheme));
					setCopyResult({ messageKey: "copiedLink" });
				} catch {
					setCopyResult({ messageKey: "copyFailed" });
				}
			};
			const title = error ? t("failureTitle") : active ? t("browserTitle") : expired ? t("timeoutTitle") : t("loginTitle");
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				headless: true,
				title,
				onClose: dismiss,
				className: SignInDialog_module_css_default.dialog,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: SignInDialog_module_css_default.content,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: SignInDialog_module_css_default.header,
						children: [(0, react_jsx_runtime.jsx)("h2", {
							className: SignInDialog_module_css_default.title,
							children: title
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: SignInDialog_module_css_default.close,
							"aria-label": t("close"),
							onClick: dismiss,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
						})]
					}), waiting ? (0, react_jsx_runtime.jsxs)("p", {
						className: SignInDialog_module_css_default.description,
						children: [
							t("browserPrompt"),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: SignInDialog_module_css_default.link,
								disabled: !authorizeUrl,
								onClick: authorizeUrl ? () => {
									copyLink(authorizeUrl);
								} : void 0,
								children: t(copyResult?.messageKey ?? "copyLink")
							}),
							t("browserDescription")
						]
					}) : (0, react_jsx_runtime.jsx)("p", {
						className: SignInDialog_module_css_default.description,
						children: error ? t(failureKey) : expired ? t("timeoutDescription") : t("loginDescription")
					})]
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: SignInDialog_module_css_default.actions,
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						className: SignInDialog_module_css_default.secondaryButton,
						disabled: committing || busy,
						onClick: active ? dismiss : useApiKey,
						children: t(active ? "cancel" : "addApiKey")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						className: SignInDialog_module_css_default.primaryButton,
						disabled: busy || committing || waiting || account.view === void 0,
						"aria-label": waiting ? t("waiting") : void 0,
						onClick: () => {
							run(retry);
						},
						children: waiting ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutlineRegular, { className: SignInDialog_module_css_default.spinner }) : t(expired || error ? "retry" : "signIn")
					})]
				})]
			});
		}
		//#endregion
		//#region lib/types/client/AccountOnboarding.js
		/** Account choice inside the model credential onboarding step. */
		/** @param props - onboarding completion, account state and actions. @returns account dialog while signed out. */
		function AccountOnboarding({ complete, useApiKey, useAccount, useTheme, setOnboarding, showLogin, start, cancel, t }) {
			const account = useAccount((value) => value);
			const colorScheme = useTheme((snapshot) => snapshot.active.colorScheme);
			(0, react.useEffect)(() => {
export {};
