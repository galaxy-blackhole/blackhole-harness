/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				en
			}), "ui-sidebar-browser.copy");
			ctx.effect(() => ctx.sidebarRightTabs.register({
				...browserDefinition(t),
				keepMounted: desktop !== void 0
			}), "ui-sidebar-browser.type");
			const installFrames = (scope, factory) => {
				const controllers = /* @__PURE__ */ new Map();
				scope.effect(() => async () => {
					const pending = [...controllers.values()].map((controller) => controller.dispose());
					controllers.clear();
					await Promise.all(pending);
				}, "ui-sidebar-browser.frames");
				scope.effect(() => scope.slots.inject("sidebar.right.pane.tab", () => scope.slots.register({
					name: "sidebar.right.pane.tab",
					key: BROWSER_ID,
					locale: namespace,
					store,
					inject: (sessionId, actions) => {
						const existing = controllers.get(sessionId);
						if (existing !== void 0) {
							existing.rebind(actions);
							return existing;
						}
						const controller = createBrowserControllers(actions, factory(sessionId), (tabId) => openTabs.getSnapshot().some((tab) => tab.sessionId === sessionId && tab.tabId === tabId));
						controllers.set(sessionId, controller);
						return controller;
					}
				}, BrowserBody)), "ui-sidebar-browser.body");
			};
			if (desktop === void 0) installFrames(ctx, () => createIframePage);
			else ctx.inject(["workspaces"], (scope) => {
				installFrames(scope, (sessionId) => (options) => createElectronPage(options, desktop, (signal) => browserWorkspace(scope.workspaces.list, sessionId, signal)));
			});
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: BROWSER_ID,
				store
			}, BrowserTitle)), "ui-sidebar-browser.title");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
