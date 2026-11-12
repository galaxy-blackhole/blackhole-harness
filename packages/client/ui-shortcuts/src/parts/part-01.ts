/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-shortcuts",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/types/client/store.js
		/** Shortcut reference visibility and search state, shared by its entry points. */
		/**
		* Declare the reference dialog store.
		* @returns root-scoped visibility, focus request, and search actions.
		*/
		function createShortcutsStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					open: false,
					query: "",
					focusRequest: 0
				}),
				actions: {
					open: (d) => {
						d.open = true;
						d.focusRequest++;
					},
					close: (d) => {
						d.open = false;
						d.query = "";
					},
					search: (d, query) => {
						d.query = query;
					}
				}
			});
		}
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region lib/types/client/feedback.js
		/**
		* Identify the unreadable preferences, their recovery path, and the bindings still in use.
		* @param config - failed read and last accepted preferences.
		* @param runtime - storage owner whose location and reload action to show.
		* @param t - shortcut dictionary.
		* @returns localized recovery guidance without replacing the stored document.
		*/
		function shortcutReadFailure(config, runtime, t) {
			const location = t(runtime === "desktop" ? "desktop-document" : "web-document");
			const reload = t(runtime === "desktop" ? "desktop-reload" : "web-reload");
			return `${t(config.error ?? "read", {
				location,
				reload
			})} ${t(config.usingDefaults ? "using-defaults" : "using-accepted")}`;
		}
		/**
		* Describe an unsuccessful preference write without losing command names.
		* @param result - rejected operation result.
		* @param catalog - current command labels.
		* @param t - shortcut dictionary.
		* @param runtime - storage owner for unreadable-document recovery guidance.
		* @returns localized diagnosis for a system toast and accessible field description.
		*/
		function shortcutFailure(result, catalog, t, runtime) {
			if (result.status === "unreadable") return shortcutReadFailure(result.snapshot, runtime, t);
			return result.issue ? t(result.issue) : result.status === "conflict" ? t("conflict", { commands: result.conflicts?.map((id) => catalog.find((row) => row.id === id)?.label ?? id).join(", ") ?? "" }) : t(result.status);
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-shortcuts/src/client/Reference.module.css.mjs
		const css = ".nhfO0a_setting,.nhfO0a_row,.nhfO0a_binding{justify-content:space-between;align-items:center;gap:8px;display:flex}.nhfO0a_setting{box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l2);min-height:60px;padding:16px 0}.nhfO0a_settingText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.nhfO0a_settingTitle{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}.nhfO0a_settingDescription{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.nhfO0a_button{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);min-width:90px;max-width:280px;height:36px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;white-space:nowrap;border:none;flex-shrink:0;justify-content:center;align-items:center;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.nhfO0a_button:hover{background:var(--dsw-alias-interactive-bg-hover)}.nhfO0a_dialog{box-sizing:border-box;border-radius:24px;gap:0;width:min(480px,100%);height:600px;max-height:calc(100dvh - 108px);padding:0;transform:translateY(30px);box-shadow:0 0 1px #0003,0 0 4px #00000005,0 12px 32px #00000014}.nhfO0a_dialog:focus{outline:none}.nhfO0a_contents{flex-direction:column;flex:1;min-height:0;display:flex}.nhfO0a_header{box-sizing:border-box;flex:0 0 46px;padding:22px 54px 0 24px;position:relative}.nhfO0a_title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px}.nhfO0a_close{width:28px;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:0;border-radius:28px;justify-content:center;align-items:center;padding:6px;display:inline-flex;position:absolute;top:20px;right:14px}.nhfO0a_close:hover{background:var(--dsw-alias-interactive-bg-hover)}.nhfO0a_searchRow{box-sizing:border-box;flex:0 0 60px;align-items:center;padding:14px 20px 10px;display:flex}.nhfO0a_searchField{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-markdown-code-block);border-radius:12px;align-items:center;gap:8px;width:100%;height:36px;padding:8px 14px;display:flex}.nhfO0a_searchIcon{color:var(--dsw-alias-label-caption);flex:none}.nhfO0a_search{width:100%;min-width:0;color:var(--dsw-alias-label-primary);font:inherit;background:0 0;border:0;outline:none;padding:0;font-size:13px;line-height:18px}.nhfO0a_search::placeholder{color:var(--dsw-alias-label-tertiary);opacity:1}.nhfO0a_list{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);overscroll-behavior:contain;flex:1;min-height:0;padding:0 16px 18px;overflow-y:auto}.nhfO0a_footer{border-top:.5px solid var(--dsw-alias-border-l2);flex:none;justify-content:space-between;align-items:center;gap:12px;min-height:52px;padding:0 24px;font-size:12px;line-height:18px;display:flex}.nhfO0a_resetAll{color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;background:0 0;border:0;border-radius:4px;align-items:center;gap:8px;padding:6px 0;display:inline-flex}.nhfO0a_resetAll:enabled:hover{color:var(--dsw-alias-label-secondary)}.nhfO0a_resetAll:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.nhfO0a_resetAll:disabled{cursor:default;opacity:.45}.nhfO0a_modifiedCount{color:var(--dsw-alias-label-tertiary)}.nhfO0a_group{color:var(--dsw-alias-label-tertiary);margin:18px 8px 4px;font-size:12px;font-weight:400;line-height:18px}.nhfO0a_rows{margin:0;padding:0;list-style:none}.nhfO0a_row{border-radius:var(--dsw-radius-md);box-sizing:border-box;min-height:42px;color:var(--dsw-alias-label-primary);padding:8px;font-size:13px;line-height:18px;position:relative}.nhfO0a_binding{pointer-events:none;flex-shrink:0;position:relative}.nhfO0a_binding:has(.nhfO0a_inlineEditor){pointer-events:auto}.nhfO0a_commandLabel{pointer-events:none;text-overflow:ellipsis;white-space:nowrap;min-width:0;position:relative;overflow:hidden}.nhfO0a_hint{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}p.nhfO0a_hint{margin:6px 0}.nhfO0a_rowActions{width:20px;height:26px;color:var(--dsw-alias-label-tertiary);opacity:0;justify-content:center;align-items:center;display:inline-flex}.nhfO0a_row:hover .nhfO0a_rowActions,.nhfO0a_row:has(:focus-visible) .nhfO0a_rowActions{opacity:1}.nhfO0a_inlineAction:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px;border-radius:4px}.nhfO0a_rowButton{border-radius:inherit;cursor:pointer;background:0 0;border:0;width:100%;height:100%;position:absolute;inset:0}.nhfO0a_row:has(.nhfO0a_rowButton:enabled):hover{background:var(--dsw-alias-interactive-bg-hover)}.nhfO0a_rowButton:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-1px}.nhfO0a_binding .nhfO0a_keyBadge{color:var(--dsw-alias-label-secondary)}.nhfO0a_binding .nhfO0a_fixedKeyBadge{height:26px;color:var(--dsw-alias-label-tertiary)}.nhfO0a_keyBadge{box-sizing:border-box;background:var(--dsw-alias-bg-module-platform);border-radius:10px;justify-content:center;height:26px;padding:0 12px}.nhfO0a_unbound{box-sizing:border-box;background:var(--dsw-alias-bg-module-platform);height:26px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;border-radius:10px;justify-content:center;align-items:center;padding:6px 16px;font-size:12px;line-height:14px;display:inline-flex}.nhfO0a_inlineEditor{flex-direction:column;align-items:flex-end;gap:6px;display:flex}.nhfO0a_binding:has(.nhfO0a_inlineEditor){max-width:100%}.nhfO0a_inlineControls{justify-content:flex-end;align-items:center;gap:8px;display:flex}.nhfO0a_inlineAction{color:var(--dsw-alias-label-tertiary);font:inherit;white-space:nowrap;cursor:pointer;background:0 0;border:0;padding:0;font-size:12px;line-height:18px}.nhfO0a_recorder{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-module-platform);min-width:96px;height:26px;color:var(--dsw-alias-label-secondary);font:inherit;white-space:nowrap;cursor:pointer;border-radius:10px;justify-content:center;align-items:center;padding:3px 14px;font-size:12px;line-height:18px;display:inline-flex}.nhfO0a_recorder:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.nhfO0a_recorder.nhfO0a_invalid{border:1px solid var(--dsw-alias-state-error-primary);box-shadow:none}.nhfO0a_recorded{height:auto;color:inherit;background:0 0;padding:0}.nhfO0a_review{color:var(--dsw-alias-label-tertiary);flex-direction:column;align-items:flex-end;gap:4px;font-size:12px;line-height:18px;display:flex}.nhfO0a_toastSuccess{color:var(--dsw-alias-state-success-secondary)}.nhfO0a_toastError{color:var(--dsw-alias-state-warn-secondary)}.nhfO0a_srOnly{clip-path:inset(50%);white-space:nowrap;border:0;width:1px;height:1px;margin:-1px;padding:0;position:absolute;overflow:hidden}@media (hover:none){.nhfO0a_rowActions{opacity:1}}.nhfO0a_button:disabled,.nhfO0a_rowButton:disabled,.nhfO0a_inlineAction:disabled,.nhfO0a_recorder[aria-disabled=true]{cursor:default;opacity:.45}.nhfO0a_search::-webkit-search-cancel-button{-webkit-appearance:none}.nhfO0a_clearSearch{box-sizing:border-box;border:.5px solid var(--dsw-alias-label-tertiary);corner-shape:round;width:16px;height:16px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.nhfO0a_clearSearch:hover{background:var(--dsw-alias-interactive-bg-hover)}.nhfO0a_clearSearch:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}";
		const tagId = "@deepseek-ai/dsh-client-ui-shortcuts/Reference.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-shortcuts";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var Reference_module_css_default = {
			"binding": "nhfO0a_binding",
			"button": "nhfO0a_button",
			"clearSearch": "nhfO0a_clearSearch",
			"close": "nhfO0a_close",
			"commandLabel": "nhfO0a_commandLabel",
			"contents": "nhfO0a_contents",
			"dialog": "nhfO0a_dialog",
			"fixedKeyBadge": "nhfO0a_fixedKeyBadge",
			"footer": "nhfO0a_footer",
			"group": "nhfO0a_group",
			"header": "nhfO0a_header",
			"hint": "nhfO0a_hint",
			"inlineAction": "nhfO0a_inlineAction",
			"inlineControls": "nhfO0a_inlineControls",
			"inlineEditor": "nhfO0a_inlineEditor",
			"invalid": "nhfO0a_invalid",
			"keyBadge": "nhfO0a_keyBadge",
			"list": "nhfO0a_list",
			"modifiedCount": "nhfO0a_modifiedCount",
			"recorded": "nhfO0a_recorded",
			"recorder": "nhfO0a_recorder",
			"resetAll": "nhfO0a_resetAll",
			"review": "nhfO0a_review",
			"row": "nhfO0a_row",
			"rowActions": "nhfO0a_rowActions",
			"rowButton": "nhfO0a_rowButton",
			"rows": "nhfO0a_rows",
			"search": "nhfO0a_search",
			"searchField": "nhfO0a_searchField",
			"searchIcon": "nhfO0a_searchIcon",
			"searchRow": "nhfO0a_searchRow",
			"setting": "nhfO0a_setting",
			"settingDescription": "nhfO0a_settingDescription",
			"settingText": "nhfO0a_settingText",
			"settingTitle": "nhfO0a_settingTitle",
			"srOnly": "nhfO0a_srOnly",
			"title": "nhfO0a_title",
			"toastError": "nhfO0a_toastError",
			"toastSuccess": "nhfO0a_toastSuccess",
			"unbound": "nhfO0a_unbound"
		};
		//#endregion
		//#region lib/types/client/Editor.js
		/** Inline physical-key recording and revision-aware command editing. */
		/**
		* Save a released physical combination against the configuration the user reviewed.
		* @param props - command, accepted snapshots, and storage/feedback callbacks.
		* @returns inline command controls; failures retain the draft and allow another recording.
		*/
		function ShortcutEditor({ target, onClose, onSaved, onError, useCatalog, useConfig, useFixedCatalog, edit, recording, describeBinding, runtime, platform, t }) {
			const config = useConfig((value) => value);
			const catalog = useCatalog((value) => value);
			const fixed = useFixedCatalog((value) => value);
			const [revision, setRevision] = (0, react.useState)(config.revision);
			const [candidate, setCandidate] = (0, react.useState)(null);
			const [captured, setCaptured] = (0, react.useState)(false);
			const [busy, setBusy] = (0, react.useState)(false);
			const [nativeReady, setNativeReady] = (0, react.useState)(runtime === "web");
			const [message, setMessage] = (0, react.useState)("");
			const [retry, setRetry] = (0, react.useState)(null);
			const descriptionId = (0, react.useId)();
			const recorder = (0, react.useRef)(null);
			const mounted = (0, react.useRef)(true);
			const writing = (0, react.useRef)(false);
			/* v8 ignore next -- The effect installs reset before the recorder is enabled. */
			const restart = (0, react.useRef)(() => {});
			const desktopChords = runtime === "desktop" && (platform === "macos" || platform === "windows");
			const targetId = target.id;
			const stale = revision !== config.revision;
			const report = (text) => {
				setMessage(text);
				onError(text);
			};
			const save = async (operation, reviewedRevision = revision) => {
				if (writing.current) return;
				writing.current = true;
				setBusy(true);
				const result = await edit(operation, reviewedRevision);
				if (!mounted.current) return;
				writing.current = false;
				setBusy(false);
				if (result.status === "saved") onSaved();
				else {
					setRetry(operation.type === "set" ? operation.binding : null);
					report(shortcutFailure(result, [...catalog, ...fixed], t, runtime));
				}
			};
			const capture = (binding, id) => {
				setCandidate(binding);
				setCaptured(true);
				setRetry(null);
				const described = describeBinding(binding);
				const conflicts = described.conflicts.filter((value) => value !== id).map((value) => [...catalog, ...fixed].find((row) => row.id === value)?.label ?? value);
				if (described.issue !== null) {
					report(t(described.issue));
					return;
				}
				if (conflicts.length > 0) {
					report(t("conflict", { commands: conflicts.join(", ") }));
					return;
				}
				if (stale) {
					setRetry(binding);
					report(t("stale"));
					return;
				}
				if (config.status !== "ready") {
					report(config.status === "loading" ? t("not-ready") : shortcutReadFailure(config, runtime, t));
					return;
				}
				save({
					type: "set",
					id,
					binding
				});
			};
			const handlers = (0, react.useRef)({
				capture,
				report,
				onClose
			});
			(0, react.useLayoutEffect)(() => {
				handlers.current = {
					capture,
					report,
					onClose
				};
			});
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			(0, react.useEffect)(() => {
				let disposed = false;
				recording(true).then(() => {
					if (!disposed) setNativeReady(true);
				}, () => {
					if (!disposed) handlers.current.report(t("native-failed"));
				});
				const composition = (0, _deepseek_ai_dsh_client_ui_primitives.observeComposition)(document);
				let pending = null;
				let dead = false;
				let blocked = false;
				const held = /* @__PURE__ */ new Set();
				const reset = () => {
					pending = null;
					held.clear();
					blocked = false;
					dead = false;
				};
				restart.current = reset;
				const down = (event) => {
					if (composition.guards(event) || event.getModifierState("AltGraph")) {
						if (desktopChords) reset();
						return;
					}
					if ((!desktopChords || document.activeElement !== recorder.current) && event.key === "Escape" && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
						event.preventDefault();
						event.stopPropagation();
						if (!event.repeat && !writing.current) handlers.current.onClose();
						return;
					}
					const commandDeadKey = runtime === "web" && platform === "macos" && document.activeElement === recorder.current && event.code === "KeyN" && event.metaKey && event.altKey && !event.ctrlKey && !event.shiftKey;
					if (event.key === "Dead" && !commandDeadKey) {
						if (desktopChords) reset();
						dead = true;
						return;
					}
					if (dead) {
						dead = false;
						return;
					}
					const modifiers = [
						"control",
						"alt",
						"shift",
						"meta"
					].filter((value) => ({
						control: event.ctrlKey,
						alt: event.altKey,
						shift: event.shiftKey,
						meta: event.metaKey
					})[value]);
					const recordTab = desktopChords || (platform === "macos" || platform === "windows") && modifiers.length >= 3;
					if (document.activeElement !== recorder.current || event.key === "Tab" && !recordTab) return;
					event.preventDefault();
					event.stopPropagation();
					if (writing.current || event.repeat) return;
					if (/^(Control|Alt|Shift|Meta)(Left|Right)$/u.test(event.code)) {
						if (desktopChords && pending !== null) {
							reset();
							setCandidate(null);
							setCaptured(false);
						}
						return;
					}
					if (desktopChords) {
						held.add(event.code);
						if (blocked) return;
						if (held.size > 2) {
							blocked = true;
							pending = null;
							handlers.current.report(t("too-many-keys"));
							return;
						}
					}
					try {
						const codes = [event.code, ...desktopChords ? [...held].filter((value) => value !== event.code) : []];
						pending = describeBinding({
							code: codes[0],
							...codes[1] === void 0 ? {} : { secondCode: codes[1] },
							modifiers
						}).binding;
						setCandidate(pending);
						setCaptured(desktopChords);
						setMessage("");
						setRetry(null);
					} catch (_error) {
						blocked = desktopChords;
						pending = null;
						handlers.current.report(t("unsupported-key"));
					}
				};
				const up = (event) => {
					held.delete(event.code);
					if (desktopChords && document.activeElement === recorder.current) {
						event.preventDefault();
						event.stopPropagation();
					}
					const binding = pending !== null && (pending.code === event.code || pending.secondCode === event.code || pending.modifiers.some((modifier) => modifier === event.code.replace(/(Left|Right)$/u, "").toLowerCase())) ? pending : null;
					if (binding !== null) {
						pending = null;
						blocked = desktopChords;
					}
					if (desktopChords && (held.size === 0 || platform === "macos" && /^Meta(Left|Right)$/u.test(event.code))) {
						held.clear();
						blocked = false;
					}
					if (binding === null) return;
					handlers.current.capture(binding, targetId);
				};
				const blur = () => {
					reset();
					if (desktopChords) {
						setCandidate(null);
						setCaptured(false);
					}
				};
				const focus = () => {
					if (document.activeElement !== recorder.current) blur();
				};
				document.addEventListener("keydown", down, true);
				document.addEventListener("keyup", up, true);
				window.addEventListener("blur", blur);
				if (desktopChords) {
					document.addEventListener("focusin", focus, true);
					document.addEventListener("compositionstart", blur, true);
				}
				return () => {
					disposed = true;
					composition.dispose();
					document.removeEventListener("keydown", down, true);
					document.removeEventListener("keyup", up, true);
					window.removeEventListener("blur", blur);
					document.removeEventListener("focusin", focus, true);
					document.removeEventListener("compositionstart", blur, true);
					recording(false).catch(() => {});
				};
			}, [
				describeBinding,
				recording,
				t,
				targetId,
				runtime,
				platform,
				desktopChords
			]);
			(0, react.useEffect)(() => {
				const element = recorder.current;
				if (nativeReady && element !== null) (0, _deepseek_ai_dsh_client_ui_primitives.focusWithoutRing)(element);
			}, [nativeReady]);
			const readonly = busy || stale || config.status !== "ready";
			const review = stale && (0, react_jsx_runtime.jsxs)("div", {
				className: Reference_module_css_default.review,
				children: [(0, react_jsx_runtime.jsx)("span", { children: t("stale") }), (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: Reference_module_css_default.inlineAction,
					disabled: busy,
					onClick: () => {
						setRevision(config.revision);
						setMessage("");
					},
					children: t("review")
				})]
			});
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Reference_module_css_default.inlineEditor,
				role: "group",
				"aria-label": target.label,
				"data-shortcut-modal": "shortcut-edit",
				"aria-busy": busy,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: Reference_module_css_default.inlineControls,
export {};
