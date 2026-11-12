/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-sidebar-browser",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		//#region lib/types/client/browser/BrowserFrame.js
		/**
		* Create idle navigation state without a page target.
		* @returns state before any page has been requested.
		*/
		function emptyBrowserFrame() {
			return {
				target: void 0,
				address: "empty",
				loading: false,
				canGoBack: false,
				canGoForward: false,
				error: void 0,
				sandboxEnabled: void 0
			};
		}
		//#endregion
		//#region lib/types/client/browser/BrowserPersistence.js
		/**
		* Read the selected address from a saved navigation record.
		* @param state - saved navigation.
		* @returns its last selected address, if any.
		*/
		function currentBrowserTarget(state) {
			return state === void 0 || state.index < 0 ? void 0 : state.entries[state.index];
		}
		/**
		* Checkpoint an observed address without serializing native history.
		* @param target - current address.
		* @param revision - navigation generation.
		* @returns an address-only checkpoint.
		*/
		function browserAddressCheckpoint(target, revision) {
			return {
				entries: [target],
				index: 0,
				request: {
					target,
					revision
				},
				navigation: {
					status: "known",
					revision
				},
				failure: void 0
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-browser/src/client/view/Browser.module.css.mjs
		const css = ".SB_kFW_root{height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);flex-direction:column;flex:auto;display:flex}.SB_kFW_toolbar{box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l3);flex:none;align-items:center;gap:4px;height:38px;padding:5px 6px;display:flex}.SB_kFW_tool{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);cursor:pointer;background:0 0;border:0;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.SB_kFW_tool:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.SB_kFW_tool:disabled{color:var(--dsw-alias-label-quaternary);cursor:default}.SB_kFW_sandboxOff{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent)}.SB_kFW_addressBox{flex:auto;min-width:0;position:relative}.SB_kFW_address{box-sizing:border-box;width:100%;height:28px;color:var(--dsw-alias-label-primary);font:var(--dsw-font-xxs-12);background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);padding:0 34px 0 9px}.SB_kFW_addressGo{visibility:hidden;opacity:0;position:absolute;top:0;right:0}.SB_kFW_addressBox:focus-within .SB_kFW_addressGo{visibility:visible;opacity:1}.SB_kFW_addressUnknown{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-layer-2)}.SB_kFW_addressUnknown:focus{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1)}.SB_kFW_addressChanged{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);pointer-events:none;background:var(--dsw-alias-bg-layer-2);padding-left:8px;line-height:16px;position:absolute;top:6px;right:8px}.SB_kFW_addressBox:focus-within .SB_kFW_addressChanged{visibility:hidden;opacity:0}.SB_kFW_address:focus{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:-1px}.SB_kFW_frame{background:var(--dsw-alias-bg-base);border:0;flex:auto;width:100%;min-height:0;display:flex}.SB_kFW_content{flex:auto;min-width:0;min-height:0;display:flex;position:relative}.SB_kFW_viewport{flex:auto;min-width:0;min-height:0;display:flex}.SB_kFW_placeholder{pointer-events:none;display:flex;position:absolute;inset:0}.SB_kFW_restore{text-align:center;flex-direction:column;align-items:center;gap:10px;padding:24px;display:flex;position:absolute;inset:0;overflow:auto}.SB_kFW_restoreLabel{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);margin:auto 0 0}.SB_kFW_restoreTitle{overflow-wrap:anywhere;max-width:100%;font:var(--dsw-font-xs-13);margin:0;font-weight:500}.SB_kFW_restoreUrl{overflow-wrap:anywhere;max-width:100%;color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);margin:0}.SB_kFW_restore>:last-child{flex-shrink:0;margin-bottom:auto}.SB_kFW_webview{-webkit-app-region:no-drag;border:0;flex:auto;width:100%;min-width:0;height:100%;min-height:0;display:flex}html:has([data-dockkit-pointer]) .SB_kFW_webview{pointer-events:none}.SB_kFW_start{min-height:0;color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xs-13);text-align:center;flex:auto;justify-content:center;align-items:center;padding:24px;display:flex}.SB_kFW_failure{color:var(--dsw-alias-state-error-primary);font:var(--dsw-font-xxxs-11);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);flex:none;padding:6px 12px}.SB_kFW_sandboxWarning{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxxs-11);background:var(--dsw-alias-state-warn-tertiary);flex:none;padding:6px 12px}.SB_kFW_limit{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxxs-11);text-overflow:ellipsis;white-space:nowrap;border-top:.5px solid var(--dsw-alias-border-l3);flex:none;margin:0;padding:4px 10px;overflow:hidden}.SB_kFW_titleIcon{flex:none;margin-right:4px}";
		const tagId = "@deepseek-ai/dsh-client-ui-sidebar-browser/Browser.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-browser";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var Browser_module_css_default = {
			"address": "SB_kFW_address",
			"addressBox": "SB_kFW_addressBox",
			"addressChanged": "SB_kFW_addressChanged",
			"addressGo": "SB_kFW_addressGo",
			"addressUnknown": "SB_kFW_addressUnknown",
			"content": "SB_kFW_content",
			"failure": "SB_kFW_failure",
			"frame": "SB_kFW_frame",
			"limit": "SB_kFW_limit",
			"placeholder": "SB_kFW_placeholder",
			"restore": "SB_kFW_restore",
			"restoreLabel": "SB_kFW_restoreLabel",
			"restoreTitle": "SB_kFW_restoreTitle",
			"restoreUrl": "SB_kFW_restoreUrl",
			"root": "SB_kFW_root",
			"sandboxOff": "SB_kFW_sandboxOff",
			"sandboxWarning": "SB_kFW_sandboxWarning",
			"start": "SB_kFW_start",
			"titleIcon": "SB_kFW_titleIcon",
			"tool": "SB_kFW_tool",
			"toolbar": "SB_kFW_toolbar",
			"viewport": "SB_kFW_viewport",
			"webview": "SB_kFW_webview"
		};
		//#endregion
		//#region lib/types/client/view/BrowserBody.js
		/** Common browser chrome; a presentation adapter attaches the page inside its content container. */
		const EMPTY_FRAME = emptyBrowserFrame();
		function SandboxPolicyIcon({ sandboxed }) {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: "15",
				height: "15",
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": true,
				children: [(0, react_jsx_runtime.jsx)("path", {
					d: _deepseek_ai_dsh_client_ui_primitives.SHIELD_OUTLINE_PATH,
					stroke: "currentColor",
					strokeWidth: _deepseek_ai_dsh_client_ui_primitives.ICON_REGULAR_STROKE,
					strokeLinejoin: "round"
				}), sandboxed ? (0, react_jsx_runtime.jsx)("path", {
					d: "M12.1654 5.7552L8.9447 9.41475C8.73044 9.65816 8.53628 9.8804 8.35774 10.0423C8.1713 10.2114 7.94235 10.3717 7.64016 10.4254C7.48207 10.4535 7.32 10.4552 7.16151 10.4294C6.85843 10.3801 6.62728 10.2223 6.43836 10.0559C6.25752 9.89653 6.06037 9.67732 5.84264 9.43705L4.72925 8.20897L5.63557 7.38707L6.74897 8.61594C6.98603 8.87755 7.12974 9.03533 7.24673 9.13839C7.31033 9.19443 7.34485 9.21476 7.35823 9.22122C7.38068 9.22484 7.40352 9.22515 7.42593 9.22122C7.40522 9.22502 7.42893 9.23294 7.53583 9.136C7.65132 9.03126 7.79316 8.87139 8.02643 8.60638L11.2479 4.94763L12.1654 5.7552Z",
					fill: "currentColor"
				}) : (0, react_jsx_runtime.jsx)("path", {
					d: "M10.6074 4.40278L8.00975 6.99973L10.6074 9.59739L9.59736 10.6074L6.9997 8.00978L4.40274 10.6074L3.3927 9.59739L5.98966 6.99973L3.3927 4.40278L4.40274 3.39273L6.9997 5.98969L9.59736 3.39273L10.6074 4.40278Z",
					fill: "currentColor",
					transform: "translate(1.2 0.8)"
				})]
			});
		}
		function useBrowserDraft(url, revision) {
			const [edit, setEdit] = (0, react.useState)();
			return [edit?.revision === revision ? edit.value : url ?? "", (value) => {
				setEdit({
					revision,
					value
				});
			}];
		}
		/** Render provider-neutral navigation state and optional controls. */
		function BrowserBody(props) {
			const { mount, loadUrl, restore, goBack, goForward, reload, setSandbox, useBrowserState, useStore, useTabInfo, t } = props;
			const { tab } = useTabInfo();
			(0, react.useEffect)(() => tab.actions.bindCommands({ refresh: () => {
				reload(tab.id);
			} }), [
				tab.actions,
				tab.id,
				reload
			]);
			const initial = (0, react.useRef)(useStore((state) => state.byTab[tab.id]));
			const initialUrl = (0, react.useRef)(tab.navigation.params?.url);
			const viewportId = (0, react.useId)();
			const [mountEpoch, setMountEpoch] = (0, react.useState)(0);
			const state = useBrowserState(tab.id);
			const frame = state?.frame ?? EMPTY_FRAME;
			const restoreTarget = state === void 0 ? currentBrowserTarget(initial.current) : state.restoreTarget;
			const target = frame.target ?? restoreTarget;
			const [draft, setDraft] = useBrowserDraft(target?.url ?? initialUrl.current, state?.addressRevision ?? 0);
			(0, react.useLayoutEffect)(() => {
				const hide = mount({
					tabId: tab.id,
					signal: tab.signal,
					viewportId,
					applicationOrigin: window.location.origin,
					initial: initial.current,
					initialUrl: initialUrl.current,
					openTab: (url) => {
						tab.actions.openTab("browser", {
							params: { url },
							revealIfOpened: false
						});
					}
				});
				setMountEpoch((value) => value + 1);
				return hide;
			}, [
				mount,
				tab.id,
				tab.signal,
				tab.actions,
				viewportId,
				props.actions
			]);
			const unknown = frame.address === "unknown";
			const externalUrl = unknown ? void 0 : target?.url;
			const sandboxed = frame.sandboxEnabled;
			const failure = state?.addressFailure;
			const error = frame.error;
			const submit = (event) => {
				event.preventDefault();
				loadUrl(tab.id, draft);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Browser_module_css_default.root,
				children: [
					(0, react_jsx_runtime.jsxs)("form", {
						className: Browser_module_css_default.toolbar,
						onSubmit: submit,
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Browser_module_css_default.tool,
								"aria-label": t("back"),
								title: t("back"),
								disabled: !frame.canGoBack,
								onClick: () => {
									goBack(tab.id);
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutlineRegular, {})
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Browser_module_css_default.tool,
								"aria-label": t("forward"),
								title: t("forward"),
								disabled: !frame.canGoForward,
								onClick: () => {
									goForward(tab.id);
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("reload"),
								shortcutKeys: tab.refreshShortcut?.keys,
								side: "bottom",
								delayMs: 500,
								children: (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: Browser_module_css_default.tool,
									"aria-label": t("reload"),
									"aria-keyshortcuts": tab.refreshShortcut?.aria,
									disabled: target === void 0 || mountEpoch === 0,
									onClick: () => {
										reload(tab.id);
									},
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {})
								})
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: Browser_module_css_default.addressBox,
								children: [
									(0, react_jsx_runtime.jsx)("input", {
										className: [Browser_module_css_default.address, unknown ? Browser_module_css_default.addressUnknown : ""].join(" "),
										value: draft,
										"aria-label": t("address.placeholder"),
										placeholder: t("address.placeholder"),
										spellCheck: false,
										onChange: (event) => {
											setDraft(event.currentTarget.value);
										}
									}),
									unknown && (0, react_jsx_runtime.jsx)("span", {
										className: Browser_module_css_default.addressChanged,
										children: t("address.changed")
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "submit",
										className: [Browser_module_css_default.tool, Browser_module_css_default.addressGo].join(" "),
										"aria-label": t("go"),
										title: t("go"),
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLinkOutlineRegular, {})
									})
								]
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Browser_module_css_default.tool,
								"aria-label": t("external"),
								title: t("external"),
								disabled: externalUrl === void 0,
								onClick: externalUrl === void 0 ? void 0 : () => {
									window.open(externalUrl, "_blank", "noopener,noreferrer");
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size: 14 })
							}),
							sandboxed !== void 0 && (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: [Browser_module_css_default.tool, sandboxed ? "" : Browser_module_css_default.sandboxOff].join(" "),
								"aria-label": t(sandboxed ? "sandbox.disable" : "sandbox.enable"),
								title: t(sandboxed ? "sandbox.disable" : "sandbox.enable"),
								"aria-pressed": !sandboxed,
								onClick: () => {
									setSandbox(tab.id, !sandboxed);
								},
								children: (0, react_jsx_runtime.jsx)(SandboxPolicyIcon, { sandboxed })
							})
						]
					}),
					sandboxed === false && (0, react_jsx_runtime.jsx)("div", {
						className: Browser_module_css_default.sandboxWarning,
						role: "status",
						children: t("sandbox.warning")
					}),
					error !== void 0 && (0, react_jsx_runtime.jsx)("div", {
						className: Browser_module_css_default.failure,
						role: "status",
						children: error.code !== void 0 && error.description !== void 0 ? t("load.failed.detail", {
							code: String(error.code),
							description: error.description
						}) : t("load.failed")
					}),
					failure !== void 0 && (0, react_jsx_runtime.jsx)("div", {
						className: Browser_module_css_default.failure,
						role: "alert",
						children: t(`error.${failure}`)
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: Browser_module_css_default.content,
						"aria-busy": frame.loading,
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								id: viewportId,
								className: Browser_module_css_default.viewport,
								"aria-label": t("type.label")
							}),
							restoreTarget !== void 0 && (0, react_jsx_runtime.jsxs)("section", {
								className: Browser_module_css_default.restore,
								"aria-label": t("restore.previous"),
								children: [
									(0, react_jsx_runtime.jsx)("p", {
										className: Browser_module_css_default.restoreLabel,
										children: t("restore.previous")
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: Browser_module_css_default.restoreTitle,
										children: restoreTarget.title
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: Browser_module_css_default.restoreUrl,
										children: restoreTarget.url
									}),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										size: "sm",
										disabled: mountEpoch === 0,
										onClick: () => {
											restore(tab.id);
										},
										children: t("restore.action")
									})
								]
							}),
							restoreTarget === void 0 && (target === void 0 || frame.loading) && error === void 0 && (0, react_jsx_runtime.jsx)("div", {
								className: Browser_module_css_default.placeholder,
								children: (0, react_jsx_runtime.jsx)("div", {
									className: Browser_module_css_default.start,
									children: t(target === void 0 ? "start" : "loading")
								})
							})
						]
					}),
					unknown && (0, react_jsx_runtime.jsx)("p", {
						className: Browser_module_css_default.limit,
						children: t("address.unknown")
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/view/BrowserTitle.js
		/** Browser icon and current host name. */
		function BrowserTitle({ useTabInfo, useStore }) {
			const { tab } = useTabInfo();
			const entry = useStore((state) => currentBrowserTarget(state.byTab[tab.id]));
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconGlobeOutlineRegular, { className: Browser_module_css_default.titleIcon }), entry?.title ?? tab.title] });
		}
		/**
		* Parse one address-bar value into the fixed protocol allowlist.
		* @param input - user or typed-open input.
		* @param applicationOrigin - current DSH document origin, blocked for HTTPS.
		* @returns a canonical target or the refusal reason.
		*/
		function parseBrowserAddress(input, applicationOrigin) {
			const trimmed = input.trim();
			if (trimmed === "") return {
				ok: false,
				reason: "empty"
			};
			if (trimmed.length > 16384) return {
				ok: false,
				reason: "invalid"
			};
			const candidate = /^[A-Za-z][A-Za-z\d+.-]*:(?!\d+(?:[/?#]|$))/u.test(trimmed) ? trimmed : `https://${trimmed}`;
			let url;
			try {
				url = new URL(candidate);
			} catch {
				return {
					ok: false,
					reason: "invalid"
				};
			}
			if (url.username !== "" || url.password !== "") return {
				ok: false,
				reason: "credentials"
			};
			if (url.protocol === "https:" || url.protocol === "http:") {
				if (applicationOrigin !== void 0 && applicationOrigin !== "null") try {
					if (url.origin === new URL(applicationOrigin).origin) return {
						ok: false,
						reason: "application-origin"
					};
				} catch {}
				return {
					ok: true,
					target: {
						kind: url.protocol === "https:" ? "https" : "http",
						url: url.href,
						title: url.hostname
					}
export {};
