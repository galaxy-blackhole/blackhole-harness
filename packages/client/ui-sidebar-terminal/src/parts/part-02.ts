/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					"desktop:linux": {
						code: "Backquote",
						modifiers: ["control"]
					},
					"web:macos": {
						code: "Backquote",
						modifiers: ["control"]
					},
					"web:windows": {
						code: "Backquote",
						modifiers: ["control"]
					}
				},
				regions: [
					"page",
					"editable",
					"terminal"
				],
				modals: [],
				resolve: ({ target: element }) => {
					const target = ctx.sidebarRight.commandTarget(element);
					if (target === void 0) return {
						status: "blocked",
						reason: t("shortcut.noSession")
					};
					return {
						status: "handled",
						run: () => {
							ctx.sidebarRight.openTabFromTarget("terminal", target);
						}
					};
				}
			}), "ui-sidebar-terminal: shortcut");
			ctx.effect(() => ctx.locale.register(namespace, {
				zh,
				en
			}), "ui-sidebar-terminal.copy");
			ctx.effect(() => ctx.sidebarRightTabs.register({
				id,
				kind: "terminal",
				multiple: true,
				priority: "builtin",
				title: () => t("title"),
				guide: [{
					id: "new",
					order: 20,
					title: () => t("new"),
					description: () => t("description"),
					icon: _deepseek_ai_dsh_client_ui_primitives.PluginArtworkTerminal
				}]
			}), "ui-sidebar-terminal.type");
			ctx.effect(() => ctx.sidebarRight.registerCloseHandler("terminal", (sessionId, tab) => {
				ctx.webTerminals.close(sessionId, tab.id, tab.contentId, terminalId(sessionId, tab.id));
			}), "ui-sidebar-terminal.close");
			const inject = (sessionId) => ({
				view: (key) => view(sessionId, key),
				keyedHooks: { terminal: (key) => view(sessionId, key).state }
			});
			const theme = {
				getSnapshot: () => ctx.theme.getTheme(),
				subscribe: (listener) => ctx.on("theme/change", listener)
			};
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.guide.entry", () => ctx.slots.register({
				name: "sidebar.right.tab.guide.entry",
				key: id,
				locale: namespace,
				inject: (sessionId) => ({
					hooks: { shortcuts: ctx.shortcuts.catalog },
					loadShells: (signal) => ctx.webTerminals.launchShells(sessionId, signal),
					selectShell: (path) => {
						ctx.webTerminals.selectShell(path);
					}
				})
			}, TerminalGuide)), "ui-sidebar-terminal.guide");
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: id,
				locale: namespace,
				inject: (sessionId) => ({
					...inject(sessionId),
					hooks: { theme }
				})
			}, LazyTerminalBody)), "ui-sidebar-terminal.body");
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: id,
				locale: namespace,
				inject
			}, TerminalTitle)), "ui-sidebar-terminal.title");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
