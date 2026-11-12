/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				}), "ui-theme: font size input");
			});
		}
		/**
		* Required services: settings transport plus slots/locale for the Appearance
		* row. `remote` carries the forwarded settings invalidation that
		* `ctx.configForms.get(entryId)` subscribes to on this context.
		*/
		const inject = [
			"slots",
			"locale",
			"remote",
			"configForms"
		];
		/**
		* Client plugin body: provide the theme service and register the
		* feature-owned Appearance and font settings rows into the General section's item
		* slot (a feature owns its settings surface). Desktop font-size shortcuts share
		* all three font-size settings when the keyboard service is available.
		* @param ctx - client cordis context.
		*/
		function apply(ctx) {
			installThemeStyles(ctx);
			ctx.effect(() => ctx.locale.register(SETTINGS_NS, {
				zh,
				en
			}), "ui-theme: settings row dictionaries");
			const theme = new ThemeRuntime(ctx, ctx.configForms.get(THEME_SETTINGS_NAMESPACE));
			ctx.provide("theme", theme);
			const store = createAppearanceRowStore();
			let bound;
			const fontStore = createFontRowStore();
			let fontBound;
			const sync = (snapshot) => {
				bound?.sync(snapshot.preference, snapshot.revision);
				fontBound?.sync(snapshot.fontSizes, snapshot.fontFamilies, snapshot.revision);
			};
			ctx.on("theme/change", sync);
			const injected = (actions) => {
				bound = actions;
				sync(theme.getTheme());
				return { setTheme: (id) => {
					theme.setTheme(id);
				} };
			};
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "appearance",
				order: 10,
				store,
				locale: SETTINGS_NS,
				inject: injected
			}, AppearanceRow));
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "font-size",
				order: 11,
				store: fontStore,
				locale: SETTINGS_NS,
				inject: (actions) => {
					fontBound = actions;
					sync(theme.getTheme());
					return {
						setFontFamily: (role, value) => {
							theme.setFontFamily(role, value);
						},
						setFontSize: (role, px) => {
							theme.setFontSize(role, px);
						}
					};
				}
			}, FontSettingsGroup));
		}
		//#endregion
		exports.SETTINGS_NS = SETTINGS_NS;
		exports.ThemeRuntime = ThemeRuntime;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
