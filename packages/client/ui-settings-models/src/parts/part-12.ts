/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.models";
		/**
		* Refetch the page snapshot only after its first load: an unopened Models
		* page must not fetch on background invalidations.
		* @param controller - the page store.
		*/
		function refreshIfLoaded(controller) {
			if (controller.store.getSnapshot().status === "idle") return;
			controller.load();
		}
		/**
		* Required services (cordis fiber inject). The target slot is declared by
		* ui-settings' apply, whose activation order relative to this one is NOT
		* constrained; registration depends on each slot through `slots.inject()`.
		*/
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.credentials",
			"remote.llm",
			"remote.settings",
			"remote.session",
			"configForms",
			"settingsSchema"
		];
		/**
		* Register the Models section once the `settings.section` declaration is on
		* the ledger, wire its store to the connection, and keep it fresh on every
		* pushed invalidation (settings, credentials, or provider topology).
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const payload = globalThis[ONBOARDING_CONFIG_GLOBAL];
			const credentialOnboarding = Config(payload === void 0 ? {} : payload).credentialOnboarding && !("dshDesktop" in globalThis);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-settings-models: copy dictionaries");
			const schema = createSettingsSchemaOperations(ctx.settingsSchema);
			const operations = createModelsOperations(ctx);
			const controller = new ModelsSettingsStore(ctx, schema, ctx.configForms.describe());
			const t = ctx.locale.bind(NS);
			const injected = () => ({
				controller,
				hooks: { snapshot: controller.store },
				operations,
				schema,
				t
			});
			const deepSeekOnboardingInjected = () => ({
				automatic: credentialOnboarding,
				track: (name, attributes) => ctx.get("productAnalytics")?.track(name, attributes),
				controller,
				hooks: { models: controller.store },
				operations,
				schema,
				t
			});
			const welcomeController = new WelcomeNoticeStore(ctx.configForms.get(WELCOME_NOTICE_SETTINGS_NAMESPACE));
			const welcomeInjected = () => ({
				controller: welcomeController,
				hooks: { welcome: welcomeController.store },
				t
			});
			ctx.effect(() => {
				const refreshModels = () => {
					refreshIfLoaded(controller);
				};
				const disposers = [
					ctx.remote.$on("settings/document-updated", () => {
						refreshModels();
					}),
					ctx.remote.$on("credentials/record-updated", refreshModels),
					ctx.remote.$on("credentials/reference-updated", refreshModels),
					ctx.remote.$on("llm/adapters-updated", refreshModels),
					ctx.on("connection/reset", refreshModels)
				];
				return () => {
					welcomeController.dispose();
					for (const dispose of disposers) dispose();
				};
			}, "ui-settings-models: pushed invalidations");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "models",
				order: 10,
				label: () => t("nav"),
				inject: injected,
				children: {
					"settings.models.provider-card": {
						kind: "keyed",
						scope: "root"
					},
					"settings.models.footer": {
						kind: "list",
						scope: "root"
					}
				}
			}, ModelsSection));
			if (!("dshDesktop" in globalThis)) ctx.slots.inject("settings.onboarding", () => ctx.slots.register({
				name: "settings.onboarding",
				id: "welcome-notice",
				order: -100,
				inject: welcomeInjected
			}, WelcomeNotice));
			ctx.slots.inject("settings.onboarding", () => ctx.slots.register({
				name: "settings.onboarding",
				id: "deepseek-official",
				children: { "settings.models.sign-in": {
					kind: "single",
					scope: "root"
				} },
				order: 0,
				inject: deepSeekOnboardingInjected
			}, DeepSeekOnboardingDialog));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.refreshIfLoaded = refreshIfLoaded;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
