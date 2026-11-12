/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					}
				},
				regions: ["page", "editable"],
				modals: [],
				resolve: () => {
					if (controller.operation.getSnapshot().phase === "busy") return {
						status: "blocked",
						reason: t("shortcut.busy")
					};
					const selected = target();
					if (selected === void 0) return {
						status: "blocked",
						reason: t("shortcut.unavailable")
					};
					return {
						status: "handled",
						run: () => {
							controller.launch(selected.appId, selected.path).catch((error) => {
								console.warn("workspace open rejected:", error);
							});
						}
					};
				}
			}), "open-in-app: workspace command");
			const directoryInjected = () => ({
				hooks: {
					openInAppApps: controller.apps,
					openInAppChoice: controller.choice,
					openInAppLaunch: controller.operation,
					shortcuts: ctx.shortcuts.catalog
				},
				launch: (appId, path) => controller.launch(appId, path),
				choose: (appId) => {
					controller.choose(appId);
				},
				iconUrl: (appId) => `${OPEN_IN_APP_ICON_PREFIX_ROUTE}/${appId}`
			});
			function SessionOpenInAppAction(props) {
				const { sessionId, useSessions } = props;
				const cwd = useSessions((state) => state.byId[sessionId]?.cwd);
				return cwd ? (0, react.createElement)(OpenInAppAction, {
					...props,
					absolutePath: cwd
				}) : null;
			}
			ctx.slots.inject("conversation.session.header.utilities", () => ctx.slots.register({
				name: "conversation.session.header.utilities",
				id: "open-in-app",
				order: -10,
				locale: NS,
				inject: directoryInjected
			}, SessionOpenInAppAction));
			ctx.slots.inject("sidebar.right.tab.files.actions", () => ctx.slots.register({
				name: "sidebar.right.tab.files.actions",
				id: "open-in-app",
				locale: NS,
				inject: directoryInjected
			}, OpenInAppAction));
			const applications = (path, signal) => paths.applications(path, signal);
			const pathInjected = () => ({
				hooks: { openInAppDesktop: paths.desktop },
				loadDesktop: () => paths.load(),
				openPath: (path, action, application) => paths.openPath(path, action, application),
				applications
			});
			ctx.slots.inject("sidebar.right.tab.document.actions", () => ctx.slots.register({
				name: "sidebar.right.tab.document.actions",
				id: "open-in-app",
				locale: NS,
				inject: pathInjected
			}, OpenPathAction));
			ctx.slots.inject("sidebar.right.tab.document.unpreviewable", () => ctx.slots.register({
				name: "sidebar.right.tab.document.unpreviewable",
				id: "open-in-app",
				locale: NS,
				inject: pathInjected
			}, OpenPathEmptyAction));
			ctx.slots.inject("deliverables.file.actions", () => ctx.slots.register({
				name: "deliverables.file.actions",
				id: "open-in-app",
				locale: NS
			}, FileRouteAction));
			ctx.slots.inject("deliverables.review.file.actions", () => ctx.slots.register({
				name: "deliverables.review.file.actions",
				id: "open-in-app",
				locale: NS
			}, FileRouteAction));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
