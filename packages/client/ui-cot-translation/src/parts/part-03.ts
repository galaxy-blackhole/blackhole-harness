/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
							state.provider.invalid && (0, react_jsx_runtime.jsx)("p", {
								role: "status",
								children: t("invalidProvider")
							}),
							missingProvider && !state.provider.invalid && (0, react_jsx_runtime.jsx)("p", {
								role: "status",
								className: Translation_module_css_default.notice,
								children: t("providerUnavailable")
							})
						]
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SettingsValueField, {
						id: languageId,
						label: t("targetLanguage"),
						hint: t("targetLanguageHint"),
						...state.targetLanguage,
						overriddenLabel: t("overridden"),
						resetLabel: t("reset"),
						invalidLabel: t("invalidLanguage"),
						disabled,
						onEdit: (value) => {
							props.edit("targetLanguage", value);
						},
						onReset: () => {
							props.resetField("targetLanguage");
						}
					})
				]
			});
		}
		//#endregion
		//#region lib/types/preferences.js
		/** Language preference accepted by both Host configuration and browser drafts. */
		const LANGUAGE_PREFERENCE_PATTERN = /^(?:auto|[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*)$/;
		/** Explicit provider choices accepted by Host configuration and browser drafts. */
		const PROVIDER_PREFERENCES = [
			"bing",
			"google",
			"deepseek-account",
			"deepseek-official"
		];
		//#endregion
		//#region lib/types/client/preferences-form.js
		/** Staged translation preferences using the shared Plugins form model. */
		/** Stages provider and language edits until the reader saves them. */
		var TranslationPreferencesForm = class {
			form;
			state;
			/** @param scope - Host-backed configuration form for this plugin. */
			constructor(scope) {
				this.form = new _deepseek_ai_dsh_client_ui_primitives.SettingsFormModel(scope, [{
					...(0, _deepseek_ai_dsh_client_ui_primitives.settingsTextField)("provider"),
					parse: (text) => {
						const provider = text.trim();
						return provider === "" ? { kind: "clear" } : PROVIDER_PREFERENCES.some((choice) => choice === provider) ? {
							kind: "set",
							value: provider
						} : void 0;
					}
				}, {
					...(0, _deepseek_ai_dsh_client_ui_primitives.settingsTextField)("targetLanguage"),
					parse: (text) => LANGUAGE_PREFERENCE_PATTERN.test(text.trim()) ? {
						kind: "set",
						value: text.trim()
					} : void 0
				}]);
				this.state = this.form.bind(() => ({
					...this.form.shell(),
					provider: this.form.field("provider"),
					targetLanguage: this.form.field("targetLanguage")
				}));
			}
			/**
			* Build the registration face for the preferences form.
			* @returns draft observable and shared edit/save actions.
			*/
			inject() {
				return {
					hooks: { translationForm: this.state },
					...this.form.actions()
				};
			}
			/** Release the accepted-preference subscription. */
			dispose() {
				this.form.dispose();
			}
		};
		//#endregion
		//#region lib/types/client/mount.js
		/** Services required to mount the optional Remote and UI contributions. */
		const inject = [
			"remote",
			"slots",
			"locale",
			"configForms"
		];
		async function registerUi(ctx, lifetime) {
			let readTask;
			let updating;
			let revision = 0, lastReadRevision = -1, acceptedRevision = -1;
			const isDisposed = () => lifetime.signal.aborted || ctx.fiber.uid === null;
			ctx.effect(() => async () => {
				lifetime.abort();
				await Promise.allSettled([readTask, updating]);
			}, "cot-translation: metadata queries");
			const invalidate = () => {
				revision += 1;
				refresh();
			};
			ctx.effect(() => [
				ctx.remote.$on("settings/document-updated", invalidate),
				ctx.remote.$on("llm/adapters-updated", invalidate),
				ctx.remote.$on("deepseek-account/session-expired", invalidate),
				ctx.remote.$on("deepseek-account/model-sign-in-required", invalidate),
				ctx.remote.$on("credentials/record-updated", invalidate),
				ctx.remote.$on("credentials/reference-updated", invalidate)
			]);
			ctx.on("connection/reset", invalidate);
			const read = async () => {
				while (true) {
					const observed = revision;
					lastReadRevision = observed;
					readTask = ctx.remote.cotTranslation.limits(lifetime.signal);
					const result = await readTask;
					if (isDisposed()) return void 0;
					if (observed === revision) return result;
				}
			};
			let initial;
			try {
				initial = await read();
			} catch (error) {
				if (isDisposed()) return;
				throw error;
			}
			if (initial === void 0) return;
			if (!initial.ok) throw initial.error;
			const preferences = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(initial.value.preferences);
			const translationLimit = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(initial.value.maxTextChars);
			const availableProviders = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(initial.value.availableProviders);
			acceptedRevision = lastReadRevision;
			function refresh() {
				if (updating !== void 0 || acceptedRevision < 0 || isDisposed()) return;
				updating = (async () => {
					try {
						const result = await read();
						if (result?.ok) {
							preferences.set(result.value.preferences);
							translationLimit.set(result.value.maxTextChars);
							availableProviders.set(result.value.availableProviders);
							acceptedRevision = lastReadRevision;
						}
					} catch (_error) {
						if (!isDisposed()) ctx.logger.warn("cot-translation: could not refresh Host preferences and request limits");
					}
				})().finally(() => {
					updating = void 0;
					if (revision !== lastReadRevision && !isDisposed()) refresh();
				});
			}
			const scope = ctx.configForms.get("cot-translation");
			ctx.effect(() => scope.subscribe(invalidate));
			ctx.effect(() => ctx.locale.register(NS, {
				en,
				zh
			}));
			const form = new TranslationPreferencesForm(scope);
			ctx.effect(() => () => {
				form.dispose();
			});
			const injected = (sessionId) => ({
				hooks: {
					preferences,
					translationLocale: ctx.locale,
					translationLimit
				},
				translate: async (request, signal) => {
					if (acceptedRevision !== revision) refresh();
					while (updating !== void 0) await updating;
					signal.throwIfAborted();
					const accepted = preferences.getSnapshot();
					if (isDisposed() || acceptedRevision !== revision || request.provider !== accepted.provider || accepted.targetLanguage !== "auto" && request.targetLanguage !== accepted.targetLanguage || request.text.length > translationLimit.getSnapshot()) throw new Error("Translation preferences or limits changed");
					const result = await ctx.remote.cotTranslation.translate({
						...request,
						sessionId
					}, signal);
					if (!result.ok) throw result.error;
					return result.value;
				}
			});
			ctx.slots.inject("conversation.chat.reasoning.body", () => ctx.slots.register({
				name: "conversation.chat.reasoning.body",
				locale: NS,
				inject: injected
			}, TranslationBody));
			ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
				name: "plugins.bundle.config",
				key: "@deepseek-ai/dsh-experimental-cot-translation-bundle",
				locale: NS,
				inject: () => {
					const face = form.inject();
					return {
						...face,
						hooks: {
							...face.hooks,
							availableProviders
						},
						refreshProviders: invalidate
					};
				}
			}, TranslationSettings));
		}
		/**
		* Mount Session-bound translation and withdraw UI before its generated Remote.
		* @param ctx - Client plugin lifetime.
		* @param contribution - generated controller Remote definitions.
		* @returns disposer that removes both contributions.
		*/
		async function mountTranslation(ctx, contribution) {
			const lifetime = new AbortController();
			ctx.on("internal/plugin", (fiber) => {
				if (fiber === ctx.fiber && fiber.uid === null) lifetime.abort();
			});
			ctx.effect(() => () => {
				lifetime.abort();
			}, "cot-translation: query cancellation");
			const unmountRemote = await ctx.remote.$mount(contribution);
			const ui = ctx.inject(["remote.cotTranslation", ...inject.slice(1)], (child) => registerUi(child, lifetime));
			try {
				await ui;
			} catch (error) {
				await ui.dispose();
				await unmountRemote();
				throw error;
			}
			return async () => {
				await ui.dispose();
				await unmountRemote();
			};
		}
		//#endregion
		//#region lib/types/client/index.js
		/**
		* Mount the experimental reasoning presentation and its Remote methods.
		* @param ctx - browser plugin context.
		* @returns disposer joining UI and Remote withdrawal.
		*/
		async function apply(ctx) {
			return await mountTranslation(ctx, TYPERT_REMOTE);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
