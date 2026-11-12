/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			while (true) {
				const match = separator.exec(text);
				let remaining = text.slice(start, match?.index ?? text.length);
				while (remaining.length > maxTextChars) {
					let cut = maxTextChars;
					if (/[\uD800-\uDBFF]/.test(remaining.charAt(cut - 1))) cut -= 1;
					const whitespace = remaining.slice(0, cut).search(/\s+\S*$/);
					if (whitespace > 0) cut = whitespace;
					const source = remaining.slice(0, cut);
					remaining = remaining.slice(cut);
					const suffix = remaining.match(/^\s+/)?.[0] ?? "";
					remaining = remaining.slice(suffix.length);
					result.push({
						text: source,
						suffix,
						complete: true
					});
				}
				result.push({
					text: remaining,
					suffix: match?.[0] ?? "",
					complete: match !== null || !running
				});
				if (match === null) return result;
				start = match.index + match[0].length;
			}
		}
		/** One lifecycle controller owns cancellation, request ordering, and stale-result exclusion. */
		var ReasoningTranslation = class {
			selection;
			maxTextChars;
			translate;
			publish;
			controller = new AbortController();
			cache = /* @__PURE__ */ new Map();
			fragments = [];
			pending = false;
			failed = false;
			/**
			* @param selection - explicit provider and resolved target language.
			* @param maxTextChars - configured translator request limit.
			* @param translate - one cancellation-aware Remote request.
			* @param publish - component-local display state update.
			*/
			constructor(selection, maxTextChars, translate, publish) {
				this.selection = selection;
				this.maxTextChars = maxTextChars;
				this.translate = translate;
				this.publish = publish;
			}
			/**
			* Adopt the current source and enqueue newly completed fragments.
			* @param text - current original reasoning.
			* @param running - whether its tail is still streaming.
			*/
			update(text, running) {
				this.fragments = reasoningFragments(text, running, this.maxTextChars);
				this.emit();
				this.run();
			}
			/** Retry untranslated fragments after a failed request. */
			retry() {
				this.failed = false;
				this.run();
			}
			/** Abort the disclosure's requests and suppress all later publications. */
			dispose() {
				this.controller.abort();
			}
			isDisposed() {
				return this.controller.signal.aborted;
			}
			emit() {
				if (this.isDisposed()) return;
				const text = this.fragments.map((fragment) => {
					return (fragment.complete ? this.cache.get(fragment.text) ?? fragment.text : fragment.text) + fragment.suffix;
				}).join("");
				this.publish({
					text,
					pending: this.pending,
					failed: this.failed
				});
			}
			async run() {
				if (this.pending || this.failed || this.isDisposed()) return;
				let next = this.fragments.find((fragment) => fragment.complete && fragment.text.trim() !== "" && !this.cache.has(fragment.text));
				if (next === void 0) return;
				this.pending = true;
				this.emit();
				try {
					while (next !== void 0) {
						const translated = await this.translate({
							...this.selection,
							text: next.text
						}, this.controller.signal);
						if (this.isDisposed()) return;
						this.cache.set(next.text, translated);
						this.emit();
						next = this.fragments.find((fragment) => fragment.complete && fragment.text.trim() !== "" && !this.cache.has(fragment.text));
					}
				} catch (_error) {
					if (!this.isDisposed()) this.failed = true;
				} finally {
					this.pending = false;
					this.emit();
				}
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/experimental/client-ui-cot-translation/src/client/Translation.module.css.mjs
		const css = ".egK6ha_toolbar{flex-wrap:wrap;align-items:center;gap:4px;min-height:28px;margin-bottom:4px;display:flex}.egK6ha_toolbar>.egK6ha_viewToggle{color:var(--dsw-alias-label-tertiary);margin-inline-start:-10px}.egK6ha_toolbar>.egK6ha_viewToggle:hover:not(:disabled),.egK6ha_toolbar>.egK6ha_viewToggle:active:not(:disabled),.egK6ha_toolbar>.egK6ha_viewToggle:focus-visible:not(:disabled){color:var(--dsw-alias-label-secondary)}.egK6ha_failure{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px)}.egK6ha_field{flex-direction:column;gap:8px;display:flex}.egK6ha_field label{color:var(--dsw-alias-label-primary);font-size:13px}.egK6ha_field select{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);min-height:32px;color:var(--dsw-alias-label-primary);font:inherit;padding:0 8px}.egK6ha_notice{color:var(--dsw-alias-label-secondary);margin:0;font-size:13px;line-height:20px}.egK6ha_spinner{animation:1s linear infinite egK6ha_cot-translation-spin}@keyframes egK6ha_cot-translation-spin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.egK6ha_spinner{animation:none}}";
		const tagId = "@deepseek-ai/dsh-experimental-client-ui-cot-translation/Translation.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-experimental-client-ui-cot-translation";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var Translation_module_css_default = {
			"cot-translation-spin": "egK6ha_cot-translation-spin",
			"failure": "egK6ha_failure",
			"field": "egK6ha_field",
			"notice": "egK6ha_notice",
			"spinner": "egK6ha_spinner",
			"toolbar": "egK6ha_toolbar",
			"viewToggle": "egK6ha_viewToggle"
		};
		//#endregion
		//#region lib/types/client/TranslationBody.js
		/** Translation controls for one expanded reasoning body. */
		/**
		* Render translated reasoning, retaining the complete original until a failed request is retried.
		* @param props - original reasoning, translation preferences, and cancellation-aware callback.
		* @returns compact Markdown and translation status with a retry action on failure.
		*/
		function TranslationBody(props) {
			const { text, running, translate, t, renderFactorySlot } = props;
			const preferences = props.usePreferences((value) => value);
			const locale = props.useTranslationLocale((value) => value.active);
			const maxTextChars = props.useTranslationLimit((value) => value);
			const targetLanguage = preferences.targetLanguage === "auto" ? locale : preferences.targetLanguage;
			const [state, setState] = (0, react.useState)({
				text,
				pending: false,
				failed: false
			});
			const [original, setOriginal] = (0, react.useState)(false);
			const translation = (0, react.useRef)();
			(0, react.useEffect)(() => {
				const controller = new ReasoningTranslation({
					provider: preferences.provider,
					targetLanguage
				}, maxTextChars, translate, setState);
				translation.current = controller;
				return () => {
					controller.dispose();
					translation.current = void 0;
				};
			}, [
				preferences.provider,
				targetLanguage,
				maxTextChars,
				translate
			]);
			(0, react.useEffect)(() => {
				translation.current?.update(text, running);
			}, [
				text,
				running,
				preferences.provider,
				targetLanguage,
				maxTextChars,
				translate
			]);
			const labels = (0, react.useMemo)(() => ({
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied"),
					toolbarLabels: {
						codeLabel: t("codeTitle"),
						wrapLabel: t("wrap"),
						unwrapLabel: t("unwrap")
					}
				},
				footnotes: t("footnotes")
			}), [t]);
			const showOriginal = original || state.failed;
			const actionLabel = t(showOriginal ? "translation" : "original");
			return (0, react_jsx_runtime.jsxs)("div", {
				"data-cot-translation": "true",
				"data-translation-state": state.failed ? "failed" : state.pending ? "pending" : "ready",
				"data-translation-view": showOriginal ? "original" : "translated",
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: Translation_module_css_default.toolbar,
					children: [
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							className: Translation_module_css_default.viewToggle,
							size: "sm",
							variant: "ghost",
							disabled: state.failed,
							onClick: () => {
								setOriginal(!showOriginal);
							},
							children: actionLabel
						}),
						state.pending && (0, react_jsx_runtime.jsx)("span", {
							role: "status",
							"aria-label": t("translating"),
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutlineRegular, {
								size: 14,
								className: Translation_module_css_default.spinner
							})
						}),
						state.failed && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
							className: Translation_module_css_default.failure,
							role: "status",
							children: t("failed")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => {
								translation.current?.retry();
							},
							children: t("retry")
						})] })
					]
				}), renderFactorySlot("conversation.chat.reasoning.content", {
					text: showOriginal ? text : state.text,
					running,
					labels
				})]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Dictionary namespace for this plugin. */
		const NS = "cotTranslation";
		/** English copy and key source. */
		const en = {
			provider: "Translation service",
			google: "Google",
			bing: "Bing",
			deepseekAccount: "DeepSeek Flash — Account (paid)",
			deepseekOfficial: "DeepSeek Flash — Official API (paid)",
			providerUnavailableOption: "{provider} — unavailable",
			providerUnavailable: "This provider is unavailable. Configure your DeepSeek account or Official API provider, or choose an available service.",
			paidNotice: "Each uncached fragment sends a separate paid DeepSeek Flash request through the selected account or Official API credentials. Reopening reasoning reuses saved results; changing the provider, language, source text, or request settings may send a new paid request.",
			anonymousNotice: "Bing and Google need no translation login or API key. Their anonymous endpoints may reject or limit requests.",
			targetLanguage: "Target language",
			targetLanguageHint: "auto follows the UI language; language codes such as zh, en, and ja also work.",
			privacy: "Expanded reasoning is sent to the selected service. It may contain private code or conversation details.",
			translation: "View translation",
			original: "View original",
			retry: "Retry",
			failed: "Translation failed. Showing the original.",
			translating: "Translating reasoning",
			invalidProvider: "Choose a translation service.",
			invalidLanguage: "Enter auto or a language code, such as zh, en, or ja.",
			overridden: "Overridden",
			reset: "Reset to default",
			unavailable: "Translation preferences are unavailable.",
			readOnly: "This deployment stores settings read-only.",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			save: "Save",
			saving: "Saving…",
			copy: "Copy",
			copied: "Copied",
			codeTitle: "Code block",
			wrap: "Wrap lines",
			unwrap: "Unwrap lines",
			footnotes: "Footnotes"
		};
		/** Chinese copy. */
		const zh = {
			provider: "翻译服务",
			google: "Google",
			bing: "Bing",
			deepseekAccount: "DeepSeek Flash · 账号（付费）",
			deepseekOfficial: "DeepSeek Flash · 官方 API（付费）",
			providerUnavailableOption: "{provider} — 不可用",
			providerUnavailable: "此服务暂不可用，请配置 DeepSeek 账号或官方 API 服务，或选择可用的翻译服务",
			paidNotice: "每个未缓存片段都会通过所选账号或官方 API 凭据单独发送一次付费的 DeepSeek Flash 请求；重新展开会复用已保存的译文，更改服务、语言、原文或请求设置可能发送新的付费请求",
			anonymousNotice: "Bing 和 Google 翻译无需额外登录或 API key，但匿名接口可能拒绝或限制请求",
			targetLanguage: "目标语言",
			targetLanguageHint: "auto 使用界面语言；也可填写语言代码，例如 zh、en、ja",
			privacy: "展开的思考内容会发送给所选翻译服务，可能包含私有代码或对话细节。",
			translation: "查看译文",
			original: "查看原文",
			retry: "重试",
			failed: "翻译暂不可用，已显示原文",
			translating: "正在翻译思考内容",
			invalidProvider: "请选择翻译服务",
			invalidLanguage: "请填写 auto 或语言代码，例如 zh、en、ja",
			overridden: "已覆盖",
			reset: "恢复默认",
			unavailable: "翻译设置暂不可用",
			readOnly: "本部署的设置为只读",
			saveFailed: "本部署没有接受这些值，已保留供你修改",
			save: "保存",
			saving: "保存中…",
			copy: "复制",
			copied: "已复制",
			codeTitle: "代码块",
			wrap: "自动换行",
			unwrap: "不换行",
			footnotes: "脚注"
		};
		/**
		* Read shared form chrome from the plugin dictionary.
		* @param t - current locale reader.
		* @returns localized form labels.
		*/
		function formLabels(t) {
			return {
				unavailable: t("unavailable"),
				readOnly: t("readOnly"),
				saveFailed: t("saveFailed"),
				save: t("save"),
				saving: t("saving")
			};
		}
		//#endregion
		//#region lib/types/client/TranslationSettings.js
		function providerLabel(provider, t) {
			switch (provider) {
				case "bing": return t("bing");
				case "google": return t("google");
				case "deepseek-account": return t("deepseekAccount");
				case "deepseek-official": return t("deepseekOfficial");
				default: return provider;
			}
		}
		/**
		* Render staged translation preferences and name which text leaves the Host.
		* @param props - current draft fields, accepted-value metadata, and save actions.
		* @returns the bundle's translation preferences.
		*/
		function TranslationSettings(props) {
			const { t } = props;
			const providerId = (0, react.useId)(), languageId = (0, react.useId)();
			const state = props.useTranslationForm((value) => value);
			const availableProviders = props.useAvailableProviders((value) => value);
			(0, react.useEffect)(() => {
				props.refreshProviders();
			}, [props.refreshProviders]);
			const missingProvider = state.provider.text !== "" && !availableProviders.some((provider) => provider === state.provider.text);
			const paid = state.provider.text === "deepseek-account" || state.provider.text === "deepseek-official";
			const disabled = !state.writable || state.saving;
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.SettingsForm, {
				labels: formLabels(t),
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: [
					(0, react_jsx_runtime.jsx)("p", {
						className: Translation_module_css_default.notice,
						children: t("privacy")
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: Translation_module_css_default.notice,
						children: t(paid ? "paidNotice" : "anonymousNotice")
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: Translation_module_css_default.field,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: Translation_module_css_default.toolbar,
								children: [(0, react_jsx_runtime.jsx)("label", {
									htmlFor: providerId,
									children: t("provider")
								}), state.provider.overridden && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
									tone: "neutral",
									children: t("overridden")
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									size: "sm",
									disabled,
									onClick: () => {
										props.resetField("provider");
									},
									children: t("reset")
								})] })]
							}),
							(0, react_jsx_runtime.jsxs)("select", {
								id: providerId,
								value: state.provider.text,
								disabled,
								"aria-invalid": state.provider.invalid || void 0,
								onChange: (event) => {
									props.edit("provider", event.target.value);
								},
								children: [missingProvider && (0, react_jsx_runtime.jsx)("option", {
									value: state.provider.text,
									disabled: true,
									children: t("providerUnavailableOption", { provider: providerLabel(state.provider.text, t) })
								}), availableProviders.map((provider) => (0, react_jsx_runtime.jsx)("option", {
									value: provider,
									children: providerLabel(provider, t)
								}, provider))]
							}),
export {};
