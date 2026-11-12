/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Dang ky bon lenh ban phim cua thanh ben phai (ban goc: shortcuts.js)
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/shortcuts.js
 */

import * as _deepseek_ai_dsh_client_ui_primitives from "@galaxy-blackhole/gbh-client-ui-primitives";

/**
* Register the sidebar commands over the controller used by its visible controls.
* @param shortcuts - effective-binding registry for this window.
* @param sidebar - current Session and page owner.
* @param t - current localized command and unavailable labels.
* @param closeWindow - private native close operation using the current configuration revision.
* @returns release callback for the commands.
*/
export function registerSidebarShortcuts(shortcuts: any, sidebar: any, t: any, closeWindow: any) {
	const reason = (kind: any, target: any) => {
		if (kind === "split") {
			const block = sidebar.splitBlock(target);
			return block === void 0 ? null : t(`command.${block}`);
		}
		if (target.host === "float") return t("command.float");
		return null;
	};
	const disposers = [shortcuts.register({
		id: "sidebar.right.toggle",
		label: () => t("command.toggle"),
		aliases: ["right sidebar", "toggle right panel"],
		defaults: {
			"desktop:macos": {
				code: "KeyB",
				modifiers: ["primary", "alt"]
			},
			"desktop:windows": {
				code: "KeyB",
				modifiers: ["primary", "alt"]
			},
			"desktop:linux": {
				code: "KeyB",
				modifiers: ["primary", "alt"]
			},
			"web:macos": {
				code: "KeyB",
				modifiers: ["primary", "shift"]
			},
			"web:windows": {
				code: "KeyB",
				modifiers: ["primary", "shift"]
			}
		},
		regions: [
			"page",
			"editable",
			"terminal"
		],
		modals: [],
		resolve: () => {
			const target = sidebar.commandTarget(null);
			if (target === void 0) return {
				status: "blocked",
				reason: t("command.noSession")
			};
			return {
				status: "handled",
				run: () => {
					if (sidebar.isTargetCurrent(target)) sidebar.toggleExpanded();
				}
			};
		}
	})];
	for (const kind of ["split", "fullscreen"]) {
		const binding = kind === "split" ? {
			code: "Backslash",
			modifiers: ["primary"]
		} : {
			code: "Enter",
			modifiers: ["primary", "alt"]
		};
		disposers.push(shortcuts.register({
			id: kind === "split" ? "pane.split" : "pane.fullscreen.toggle",
			label: () => t(kind === "split" ? "dock.splitPane" : "command.fullscreen"),
			aliases: [kind, "panel"],
			defaults: {
				"desktop:macos": binding,
				"desktop:windows": binding,
				"desktop:linux": binding,
				"web:macos": binding,
				"web:windows": binding
			},
			regions: [
				"page",
				"editable",
				"terminal"
			],
			modals: [],
			resolve: ({ target: element }: any) => {
				const target = sidebar.focusedTarget(element);
				if (target === void 0) return {
					status: "blocked",
					reason: t("command.noFocus")
				};
				const unavailable = reason(kind, target);
				if (unavailable !== null) return {
					status: "blocked",
					reason: unavailable
				};
				return {
					status: "handled",
					run: () => {
						if (!sidebar.isTargetCurrent(target)) return;
						if (kind === "split") sidebar.split(target.paneId);
						else sidebar.toggleFullscreen(target);
					}
				};
			}
		}));
	}
	for (const kind of ["close", "refresh"]) {
		const desktop = {
			code: kind === "close" ? "KeyW" : "KeyR",
			modifiers: ["primary"]
		};
		const web = {
			...desktop,
			modifiers: ["primary", "alt"]
		};
		disposers.push(shortcuts.register({
			id: `page.${kind}`,
			label: () => t(`command.${kind}`),
			aliases: [kind, "page"],
			defaults: {
				"desktop:macos": desktop,
				"desktop:windows": desktop,
				"desktop:linux": desktop,
				"web:windows": web,
				...kind === "close" ? { "web:macos": web } : {}
			},
			regions: [
				"page",
				"editable",
				"terminal"
			],
			modals: kind === "close" ? [
				"settings",
				"shortcuts",
				"other"
			] : [],
			resolve: ({ target: element, source, modal }: any) => {
				if (kind === "close" && modal !== null) return {
					status: "handled",
					run: () => {
						(0, _deepseek_ai_dsh_client_ui_primitives.closeTopModal)(document);
					}
				};
				const target = sidebar.focusedTarget(element);
				if (target === void 0 && (source === "iframe" || element?.closest("[data-sidebar-right-session]"))) return {
					status: "blocked",
					reason: t("command.stale")
				};
				if (kind === "refresh") {
					const refresh = target?.occurrence?.commands.refresh;
					if (target === void 0 || refresh === void 0) return {
						status: "blocked",
						reason: t("command.noRefresh")
					};
					return {
						status: "handled",
						run: () => {
							if (sidebar.isTargetCurrent(target) && target.occurrence?.commands.refresh === refresh) refresh();
						}
					};
				}
				if (target !== void 0 && sidebar.canCloseTarget(target)) return {
					status: "handled",
					run: () => {
						sidebar.closeTarget(target);
					}
				};
				if (shortcuts.runtime !== "desktop") return {
					status: "blocked",
					reason: t("command.noFocus")
				};
				return {
					status: "handled",
					run: () => {
						if (target === void 0 || sidebar.isTargetCurrent(target)) closeWindow();
					}
				};
			}
		}));
	}
	return () => {
		for (const dispose of disposers.reverse()) dispose();
	};
}
