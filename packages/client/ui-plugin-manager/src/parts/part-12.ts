/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			const face = controller.inject(configLedger, tabLedgerSource(ctx), (text) => ctx.locale.resolveText(text));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "plugin-manager.refresh-toast",
				locale: NS,
				inject: () => ({
					hooks: { pluginManager: face.hooks.pluginManager },
					dismissNotice: face.dismissNotice
				})
			}, PluginRefreshToast));
			ctx.slots.inject("main", function* () {
				const handle = createNavigationStore(), instance = handle.create();
				const store = {
					...handle,
					create: () => instance
				};
				yield ctx.slots.register({
					name: "main",
					key: PANEL_ID,
					locale: NS,
					store,
					inject: () => face,
					children: {
						"plugins.add.actions": {
							kind: "list",
							scope: "root"
						},
						"plugins.tab": {
							kind: "list",
							scope: "root"
						},
						"plugins.item": {
							kind: "list",
							scope: "root"
						},
						"plugins.bundle.activation": {
							kind: "keyed",
							scope: "root"
						},
						"plugins.bundle.config": {
							kind: "keyed",
							scope: "root"
						},
						"plugins.row.config": {
							kind: "keyed",
							scope: "root"
						},
						"plugins.detail.actions": {
							kind: "list",
							scope: "root"
						},
						"plugins.detail.badge": {
							kind: "list",
							scope: "root"
						},
						"plugins.detail.section": {
							kind: "list",
							scope: "root"
						}
					}
				}, PluginManagerPage);
				yield ctx.layout.panelInfo.subscribe(() => {
					if (ctx.layout.panelInfo.getSnapshot().activePanelId !== "plugins") instance.actions.setView({ kind: "list" });
				});
				const disposeNavigation = ctx.reflect.provide("pluginNavigation", { openBundle: (packageName) => {
					ctx.layout.selectPanel(PANEL_ID);
					instance.actions.setTab("installed");
					instance.actions.setView({
						kind: "package",
						name: packageName
					});
				} });
				yield () => {
					disposeNavigation();
				};
			});
			ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
				name: "sidebar.panellist",
				id: PANEL_ID,
				order: 0,
				label: () => t("panel"),
				locale: NS
			}, PluginsPanelIcon));
		}
		//#endregion
		exports.NS = NS;
		exports.PANEL_ID = PANEL_ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
