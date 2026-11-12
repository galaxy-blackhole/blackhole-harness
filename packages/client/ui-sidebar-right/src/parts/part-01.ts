/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-sidebar-right",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_dockkit = require("@deepseek-ai/dsh-client-ui-dockkit");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		let zod = require("zod");
		let react_dom = require("react-dom");
		//#region lib/types/client/focus.js
		/**
		* Read pane and tab identity from live owner markup, including an embedding iframe.
		* @param element - focused or pointer-activated element in the product document.
		* @param sessionId - Session currently drawn by the sidebar.
		* @param layout - current committed layout for that Session.
		* @param occurrence - current occurrence lookup for a committed tab.
		* @returns the captured page, or undefined for stale, hidden, or outside elements.
		*/
		function sidebarTargetFromElement(element, sessionId, layout, occurrence) {
			if (element === null || !element.isConnected) return void 0;
			if (element.closest("[data-sidebar-right-session]")?.dataset.sidebarRightSession !== sessionId) return void 0;
			const container = element.closest("[data-dockkit-pane], [data-dockkit-float]");
			const paneId = container?.dataset.dockkitPane ?? container?.dataset.dockkitFloat;
			if (paneId === void 0 || container?.closest("[hidden], [aria-hidden=\"true\"]") !== null) return void 0;
			const pane = layout.nodes[paneId];
			if (pane?.kind !== "pane" || pane.host === "dock" && !layout.expanded) return void 0;
			const tabElement = element.closest("[data-dockkit-tab], [data-sidebar-right-tab]");
			const tabId = tabElement?.dataset.dockkitTab ?? tabElement?.dataset.sidebarRightTab ?? pane.activeTabId;
			if (tabId !== void 0 && (!pane.tabs.includes(tabId) || layout.tabs[tabId] === void 0)) return void 0;
			const held = tabId === void 0 ? void 0 : occurrence(tabId);
			const marker = element.closest("[data-sidebar-right-occurrence]") ?? tabElement?.querySelector("[data-sidebar-right-occurrence]");
			if (marker !== null && marker !== void 0 && marker.dataset.sidebarRightOccurrence !== held?.id) return void 0;
			return {
				sessionId,
				paneId,
				host: pane.host,
				tabId,
				occurrence: held,
				navigationRevision: held?.navigation.getSnapshot().revision
			};
		}
		/**
		* Find a visible pane of one Session, preferring the requested pane over the active fallback.
		* @param document - product document containing docked and floating panes.
		* @param sessionId - Session whose panes may receive focus.
		* @param paneId - preferred pane before an operation changed the layout.
		* @returns a surviving visible pane, or undefined when the Session has none.
		*/
		function visibleSidebarPane(document, sessionId, paneId) {
			const panes = [...document.querySelectorAll("[data-dockkit-pane], [data-dockkit-float]")].filter((pane) => {
				const owner = pane.closest("[data-sidebar-right-session]");
				return owner?.dataset.sidebarRightSession === sessionId && pane.closest("[hidden], [aria-hidden=\"true\"]") === null && (pane.hasAttribute("data-dockkit-float") || owner.hasAttribute("data-sidebar-right-open"));
			});
			return panes.find((pane) => (pane.dataset.dockkitPane ?? pane.dataset.dockkitFloat) === paneId) ?? panes.find((pane) => pane.hasAttribute("data-dockkit-pane-active") || pane.hasAttribute("data-dockkit-float-active")) ?? panes[0];
		}
		/**
		* Observe pane focus and retain it when its DOM node is replaced, preserving text selections.
		* @param document - product document whose sidebar owns the listener lifetime.
		* @returns disposer for every document/window listener.
		*/
		function observeSidebarFocus(document) {
			let active = true;
			let focused;
			const removal = new MutationObserver(() => {
				if (focused === void 0 || focused.element.isConnected) return;
				const previous = focused;
				focused = void 0;
				removal.disconnect();
				if (document.activeElement !== document.body) return;
				const moved = previous.occurrence === void 0 ? void 0 : [...document.querySelectorAll("[data-sidebar-right-occurrence]")].find((marker) => marker.dataset.sidebarRightOccurrence === previous.occurrence)?.closest("[data-dockkit-pane], [data-dockkit-float]");
				const paneId = moved?.dataset.dockkitPane ?? moved?.dataset.dockkitFloat;
				visibleSidebarPane(document, previous.sessionId, paneId ?? previous.paneId)?.focus({ preventScroll: true });
			});
			const capture = () => {
				removal.disconnect();
				focused = void 0;
				const element = document.activeElement;
				const pane = element?.closest("[data-dockkit-pane], [data-dockkit-float]");
				if (element === null || pane === void 0 || pane === null) return;
				const owner = pane.closest("[data-sidebar-right-session]");
				const sessionId = owner?.dataset.sidebarRightSession;
				const paneId = pane.dataset.dockkitPane ?? pane.dataset.dockkitFloat;
				if (owner === null || sessionId === void 0 || paneId === void 0) return;
				const tab = element.closest("[data-dockkit-tab]") ?? pane.querySelector("[role=\"tab\"][aria-selected=\"true\"], [data-dockkit-float-title]");
				focused = {
					element,
					sessionId,
					paneId,
					occurrence: (element.closest("[data-sidebar-right-occurrence]") ?? tab?.querySelector("[data-sidebar-right-occurrence]"))?.dataset.sidebarRightOccurrence
				};
				removal.observe(owner, {
					childList: true,
					subtree: true
				});
				if (owner.parentElement !== null) removal.observe(owner.parentElement, { childList: true });
			};
			const focusout = (event) => {
				if (event.relatedTarget === null && focused?.element.isConnected) {
					focused = void 0;
					removal.disconnect();
				}
			};
			const pointer = (event) => {
				const element = event.composedPath().find((value) => value instanceof Element);
				if (!(element instanceof Element)) return;
				const pane = element.closest("[data-sidebar-right-session] [data-dockkit-pane], [data-sidebar-right-session] [data-dockkit-float]");
				if (pane === null) {
					focused = void 0;
					removal.disconnect();
				}
				const control = element.closest("button, input, textarea, select, a, [contenteditable], [tabindex], iframe");
				if (pane !== null && (control === null || control === pane)) pane.focus({ preventScroll: true });
			};
			const blur = () => {
				queueMicrotask(() => {
					if (active) capture();
				});
			};
			document.addEventListener("focusin", capture);
			document.addEventListener("focusout", focusout);
			document.addEventListener("pointerdown", pointer, true);
			document.defaultView?.addEventListener("blur", blur);
			document.defaultView?.addEventListener("focus", capture);
			capture();
			return () => {
				active = false;
				removal.disconnect();
				document.removeEventListener("focusin", capture);
				document.removeEventListener("focusout", focusout);
				document.removeEventListener("pointerdown", pointer, true);
				document.defaultView?.removeEventListener("blur", blur);
				document.defaultView?.removeEventListener("focus", capture);
			};
		}
		//#endregion
		//#region lib/types/client/shortcuts.js
		/**
		* Register the sidebar commands over the controller used by its visible controls.
		* @param shortcuts - effective-binding registry for this window.
		* @param sidebar - current Session and page owner.
		* @param t - current localized command and unavailable labels.
		* @param closeWindow - private native close operation using the current configuration revision.
		* @returns release callback for the commands.
		*/
		function registerSidebarShortcuts(shortcuts, sidebar, t, closeWindow) {
			const reason = (kind, target) => {
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
					resolve: ({ target: element }) => {
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
					resolve: ({ target: element, source, modal }) => {
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
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-right/src/client/tabs/guide/GuideBody.module.css.mjs
		const css$2 = ".geFEbW_guide{--dsl-guide-entry-radius:var(--dsw-radius-xl);box-sizing:border-box;flex-direction:column;justify-content:center;align-items:center;gap:14px;min-height:100%;padding:0 24px;display:flex}.geFEbW_guide:after{content:\"\";flex:0 10%}.geFEbW_hero{color:var(--dsw-static-neutral-200);margin-bottom:16px;display:flex}body[data-ds-dark-theme] .geFEbW_hero{color:var(--dsw-static-neutral-700)}.geFEbW_entry{box-sizing:border-box;width:380px;max-width:100%;min-height:56px;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsl-guide-entry-radius);cursor:pointer;align-items:center;gap:14px;padding:14px 20px;display:flex}.geFEbW_entry:hover{background:var(--dsw-alias-interactive-bg-hover)}.geFEbW_entryIcon{width:26px;height:26px;color:var(--dsw-alias-label-secondary);flex:none;justify-content:center;align-items:center;display:flex}.geFEbW_placeholderInk{color:var(--dsw-alias-label-tertiary)}.geFEbW_entryText{flex-direction:column;flex:1;gap:3px;min-width:0;display:flex}.geFEbW_entryTitle{white-space:nowrap;text-overflow:ellipsis;font-size:14px;line-height:1.4;overflow:hidden}.geFEbW_entryDescription{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;font-size:11px;line-height:1.4;overflow:hidden}.geFEbW_titleIcon{color:var(--dsw-alias-label-tertiary);flex:none}.geFEbW_entryCell{width:380px;max-width:100%}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-sidebar-right/GuideBody.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-right";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var GuideBody_module_css_default = {
			"entry": "geFEbW_entry",
			"entryCell": "geFEbW_entryCell",
			"entryDescription": "geFEbW_entryDescription",
			"entryIcon": "geFEbW_entryIcon",
			"entryText": "geFEbW_entryText",
			"entryTitle": "geFEbW_entryTitle",
			"guide": "geFEbW_guide",
			"hero": "geFEbW_hero",
			"placeholderInk": "geFEbW_placeholderInk",
			"titleIcon": "geFEbW_titleIcon"
		};
		//#endregion
		//#region lib/types/client/tabs/guide/GuideTitle.js
		/**
		* The compass: a ring with the needle's rhombus pointing north-east, on
		* `currentColor` so each rendering picks its own ink.
		* @param props - rendered size and class.
		* @returns the compass glyph.
		*/
		function CompassGlyph({ size = 16, className }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				className,
				children: [(0, react_jsx_runtime.jsx)("path", {
					d: "M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z",
					stroke: "currentColor"
				}), (0, react_jsx_runtime.jsx)("path", {
					d: "M10.6101 5.39014L8.99014 8.99014L5.39014 10.6101L7.01014 7.01014L10.6101 5.39014Z",
					fill: "currentColor"
				})]
			});
		}
		/**
export {};
