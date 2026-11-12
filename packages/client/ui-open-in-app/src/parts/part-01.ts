/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-open-in-app",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_store = require("@galaxy-blackhole/gbh-client-store");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		/** Browser-relative form of {@link OPEN_IN_APP_APPS_PATH}. */
		const OPEN_IN_APP_APPS_ROUTE = "/open-in-app/apps".slice(1);
		/** Browser-relative form of {@link OPEN_IN_APP_ICON_PREFIX_PATH}. */
		const OPEN_IN_APP_ICON_PREFIX_ROUTE = "/open-in-app/icon".slice(1);
		/** Browser-relative form of {@link OPEN_IN_APP_OPEN_PATH}. */
		const OPEN_IN_APP_OPEN_ROUTE = "/open-in-app/open".slice(1);
		//#endregion
		//#region lib/types/client/applications.js
		/** Label keys for applications supported by this client. */
		const APP_LABEL_KEY = {
			finder: "app.finder",
			explorer: "app.explorer",
			filemanager: "app.filemanager",
			cursor: "app.cursor",
			vscode: "app.vscode",
			vscodeinsiders: "app.vscodeinsiders",
			windsurf: "app.windsurf",
			zed: "app.zed",
			sublimetext: "app.sublimetext",
			xcode: "app.xcode",
			androidstudio: "app.androidstudio",
			intellij: "app.intellij",
			pycharm: "app.pycharm",
			webstorm: "app.webstorm",
			phpstorm: "app.phpstorm",
			goland: "app.goland",
			rider: "app.rider",
			rustrover: "app.rustrover",
			fork: "app.fork",
			sourcetree: "app.sourcetree",
			github: "app.github",
			tower: "app.tower",
			gitkraken: "app.gitkraken",
			smartgit: "app.smartgit",
			sublimemerge: "app.sublimemerge",
			ghostty: "app.ghostty",
			warp: "app.warp",
			iterm: "app.iterm",
			kitty: "app.kitty",
			terminal: "app.terminal",
			windowsterminal: "app.windowsterminal",
			gitbash: "app.gitbash",
			gnometerminal: "app.gnometerminal",
			konsole: "app.konsole"
		};
		//#endregion
		//#region lib/types/client/controller.js
		/** Browser availability/choice state and the launch carrier for the split button. */
		/**
		* Owns the once-per-page availability read, the persisted last choice, and
		* the launch POST. Availability and choice publish through uSES-safe sources
		* so every Session header shares one truth.
		*/
		var OpenInAppController = class {
			fetcher;
			/** Installed app ids in host menu order; null until the host answered. */
			apps = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			/** Last chosen app id, or empty before the first choice, shared across sessions and browser restarts. */
			choice = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)("", { persist: { name: "dsh.open-in-app.choice" } });
			/** Current launch, shared by pointer and keyboard gestures. */
			operation = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				phase: "idle",
				path: null
			});
			/**
			* Resolve the remembered nameable installed application, with the button's first-app fallback.
			* @returns the installed app id, or undefined while unavailable.
			*/
			currentApp() {
				const apps = (this.apps.getSnapshot() ?? []).filter((id) => APP_LABEL_KEY[id] !== void 0);
				const choice = this.choice.getSnapshot();
				return apps.includes(choice) ? choice : apps[0];
			}
			loading;
			/**
			* @param fetcher - HTTP carrier for the apps read and the launch POST.
			*/
			constructor(fetcher = (input, init) => fetch(input, init)) {
				this.fetcher = fetcher;
			}
			/**
			* Read availability once per controller life; concurrent calls share the read.
			* A failed read publishes an empty list, which renders no button at all.
			* @returns after availability is published.
			*/
			load() {
				this.loading ??= this.run();
				return this.loading;
			}
			/**
			* Remember one picked app id.
			* @param appId - catalog id from the availability list.
			*/
			choose(appId) {
				if (this.operation.getSnapshot().phase !== "busy") this.choice.set(appId);
			}
			/**
			* Launch one installed app on a workspace directory.
			* @param appId - catalog id from the availability list.
			* @param path - the session's absolute workspace directory.
			* Concurrent gestures are ignored until the current Host request settles.
			* @returns after the host acknowledged the launch; rejects on any failure.
			*/
			async launch(appId, path) {
				if (this.operation.getSnapshot().phase === "busy") return;
				this.operation.set({
					phase: "busy",
					path
				});
				const body = {
					app: appId,
					path
				};
				try {
					const response = await this.fetcher(OPEN_IN_APP_OPEN_ROUTE, {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify(body)
					});
					if (!response.ok) throw new Error(`open failed: HTTP ${String(response.status)}`);
					this.operation.set({
						phase: "idle",
						path
					});
				} catch (error) {
					this.operation.set({
						phase: "error",
						path
					});
					throw error;
				}
			}
			async run() {
				let apps = [];
				try {
					const response = await this.fetcher(OPEN_IN_APP_APPS_ROUTE, { headers: { accept: "application/json" } });
					if (response.ok) {
						const payload = await response.json();
						if (Array.isArray(payload.apps)) apps = payload.apps.filter((id) => typeof id === "string");
					}
				} catch {}
				this.apps.set(apps);
			}
		};
		//#endregion
		//#region lib/types/client/open-failure-toast.js
		/** Per-control failure banner for path gestures. */
		/**
		* Transient failure banner owned by the control that initiated the gesture,
		* so one failed request announces once, from the control the user pressed.
		* @returns `toast` owned by the control and `show` to announce one
		* failure with resolved copy; announcing again replays the banner.
		*/
		function useOpenFailureToast() {
			const seq = (0, react.useRef)(0);
			const [banner, setBanner] = (0, react.useState)(null);
			const dismiss = (0, react.useCallback)(() => {
				setBanner(null);
			}, []);
			return {
				toast: banner === null ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
					text: banner.text,
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
					onDone: dismiss
				}, banner.seq),
				show: (text) => {
					seq.current += 1;
					setBanner({
						seq: seq.current,
						text
					});
				}
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-open-in-app/src/client/OpenTargetButton.module.css.mjs
		const css = ".OMoRSG_menuAnchor{flex:none;align-self:center;display:inline-flex}.OMoRSG_split{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);height:24px;font-family:var(--dsw-font-family);align-items:stretch;display:inline-flex;overflow:hidden}.OMoRSG_main,.OMoRSG_chevron{color:var(--dsw-alias-label-primary);white-space:nowrap;cursor:pointer;background:0 0;border:0;justify-content:center;align-items:center;font-size:11px;line-height:16px;display:inline-flex}.OMoRSG_main{gap:4px;padding:3px 5px}.OMoRSG_chevron{border-left:.5px solid var(--dsw-alias-border-l4);color:var(--dsw-alias-label-secondary);padding:3px 4px 3px 3px}.OMoRSG_main:hover:not(:disabled),.OMoRSG_main:focus-visible,.OMoRSG_chevron:hover:not(:disabled),.OMoRSG_chevron:focus-visible{background:var(--dsw-alias-interactive-bg-hover)}.OMoRSG_main:disabled,.OMoRSG_chevron:disabled{cursor:default}.OMoRSG_appIcon{object-fit:contain}.OMoRSG_split[data-size=large]{border-radius:var(--dsw-radius-md);border-color:var(--dsw-alias-border-l2);height:36px}.OMoRSG_split[data-size=large] .OMoRSG_main{gap:6px;padding:6px 14px;font-size:14px}.OMoRSG_split[data-size=large] .OMoRSG_chevron{padding:6px 10px}.OMoRSG_skeleton{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-interactive-bg-hover);flex:none;display:inline-block}";
		const tagId = "@deepseek-ai/dsh-client-ui-open-in-app/OpenTargetButton.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-open-in-app";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var OpenTargetButton_module_css_default = {
			"appIcon": "OMoRSG_appIcon",
			"chevron": "OMoRSG_chevron",
			"main": "OMoRSG_main",
			"menuAnchor": "OMoRSG_menuAnchor",
			"skeleton": "OMoRSG_skeleton",
			"split": "OMoRSG_split"
		};
		//#endregion
		//#region lib/types/client/OpenTargetButton.js
		/** Shared file and directory opener: one default action, application menu, and per-gesture feedback. */
		/**
		* Serialize gestures and announce their failures through the initiating control's toast.
		* @param execute - target adapter that returns the failure to announce, or null.
		* @param t - localized control copy.
		* @returns the pending state, feedback, and guarded action callback.
		*/
		function useOpenTargetGesture(execute, t) {
			const [pending, setPending] = (0, react.useState)(false);
			const inFlight = (0, react.useRef)(false);
			const { toast, show } = useOpenFailureToast();
			return {
				pending,
				toast,
				act: (operation) => {
					if (inFlight.current) return;
					inFlight.current = true;
					setPending(true);
					execute(operation).then((failure) => {
						if (failure !== null) show(t(`path.${failure}`));
					}).finally(() => {
						inFlight.current = false;
						setPending(false);
					});
				}
			};
		}
		/** One application image with a per-image fallback, shared by main and menu buttons. */
		function ApplicationIcon({ source, size = 14 }) {
			const [failed, setFailed] = (0, react.useState)(false);
			return source === null || failed ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRightUpOutlineRegular, { size }) : (0, react_jsx_runtime.jsx)("img", {
				src: source,
				width: size,
				height: size,
				className: OpenTargetButton_module_css_default.appIcon,
				alt: "",
				draggable: false,
				onError: () => {
					setFailed(true);
				}
			});
		}
		/**
		* Render identical split buttons for files and directories. File reveal always
		* stays last; it is the default only when no application is registered.
		* @param props - target applications, default selection, and operations.
		* @returns the control and its transient failure feedback.
		*/
		function OpenTargetButton(props) {
			const { applications, defaultId, kind, t } = props;
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const { pending, toast, act } = useOpenTargetGesture(props.execute, t);
			const preferred = kind === "file" ? applications.find((app) => app.id === defaultId) ?? applications[0] : applications.find((app) => app.id === defaultId);
			const disabled = pending || props.busy === true || props.loading === true;
			const hasMenu = props.loading === true || props.failed || applications.length + (kind === "file" ? 1 : 0) > 1;
			const revealDefault = kind === "file" && preferred === void 0 && props.loading !== true;
			const primaryLabel = preferred === void 0 ? t("path.reveal") : t("open.title", { app: preferred.name });
			const run = (operation) => {
				setMenuOpen(false);
				act(operation);
			};
			const primary = () => {
				if (revealDefault) {
					run({ kind: "reveal" });
					return;
				}
				if (preferred !== void 0 && preferred.id !== defaultId) {
					run({
						kind: "application",
						id: preferred.id
					});
					return;
				}
				run({ kind: "default" });
			};
			const icon = props.loading === true && preferred === void 0 ? (0, react_jsx_runtime.jsx)("span", {
				className: OpenTargetButton_module_css_default.skeleton,
				"data-open-target-skeleton": true,
				"aria-hidden": "true",
				style: {
					width: props.prominent ? 18 : 13,
					height: props.prominent ? 18 : 13
				}
			}) : revealDefault ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, { size: props.prominent ? 18 : 13 }) : (0, react_jsx_runtime.jsx)(ApplicationIcon, {
				source: preferred?.icon ?? null,
				size: props.prominent ? 18 : 13
			}, preferred?.icon);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
				className: OpenTargetButton_module_css_default.menuAnchor,
				open: menuOpen && !disabled && hasMenu,
				autoFocus: true,
				portal: true,
				dense: true,
				align: "end",
				onClose: () => {
					setMenuOpen(false);
				},
				items: [...applications.map((app) => ({
					id: `app:${app.id}`,
					icon: (0, react_jsx_runtime.jsx)(ApplicationIcon, { source: app.icon }, app.icon),
					label: app.id === preferred?.id ? t("path.appDefault", { app: app.name }) : app.name
				})), ...props.failed ? [{
					id: "unavailable",
					label: t("path.appsError"),
					disabled: true
				}] : []],
				footer: kind === "file" ? [{
					id: "reveal",
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenOutlineRegular, {}),
					label: revealDefault ? t("path.appDefault", { app: t("path.reveal") }) : t("path.reveal")
				}] : [],
				onSelect: (id) => {
					run(id === "reveal" ? { kind: "reveal" } : {
						kind: "application",
						id: id.slice(4)
					});
				},
				anchor: (0, react_jsx_runtime.jsxs)("div", {
					className: OpenTargetButton_module_css_default.split,
					"data-open-target": kind,
					"data-size": props.prominent ? "large" : "compact",
					"data-open-path": kind === "file" && !props.prominent ? "" : void 0,
					"data-state": disabled ? "busy" : "idle",
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						portal: true,
						label: primaryLabel,
						shortcutKeys: props.shortcut?.keys,
						side: "bottom",
						delayMs: 500,
						children: (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: OpenTargetButton_module_css_default.main,
							disabled,
							"aria-label": props.prominent ? void 0 : primaryLabel,
							"aria-keyshortcuts": props.shortcut?.aria,
							"data-open-path-open": kind === "file" && !props.prominent ? "" : void 0,
							"data-open-path-unpreviewable": props.prominent ? "" : void 0,
							onClick: primary,
							children: [icon, props.prominent && (revealDefault ? t("path.reveal") : t("path.open"))]
						})
					}), hasMenu && (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: OpenTargetButton_module_css_default.chevron,
						disabled,
						"aria-haspopup": "menu",
						"aria-expanded": menuOpen && !disabled,
						"aria-label": t("path.more"),
						"data-open-path-more": kind === "file" && !props.prominent ? "" : void 0,
						onClick: () => {
							if (!menuOpen) props.refresh?.();
							setMenuOpen((value) => !value);
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: props.prominent ? 14 : 10 })
					})]
				})
			}), toast] });
		}
		//#endregion
		//#region lib/types/client/OpenInAppAction.js
		/**
		* Adapt the installed directory catalog to the shared opening control.
		* @param props - displayed directory, installed catalog, and launch operations.
		* @returns the shared control, or null without an eligible application.
		*/
		function OpenInAppAction(props) {
			const { absolutePath, useOpenInAppApps, useOpenInAppChoice, t } = props;
			const available = useOpenInAppApps((apps) => apps);
			const choice = useOpenInAppChoice((id) => id);
			const operation = props.useOpenInAppLaunch((value) => value);
			const shortcut = props.useShortcuts((rows) => rows.find((row) => row.id === "workspace.openLocal"));
			const apps = (available ?? []).flatMap((id) => {
				const key = APP_LABEL_KEY[id];
				return key === void 0 ? [] : [{
					id,
					name: t(key),
					icon: props.iconUrl(id)
				}];
			});
			const preferred = apps.find((app) => app.id === choice) ?? apps[0];
			if (preferred === void 0) return null;
			return (0, react_jsx_runtime.jsx)(OpenTargetButton, {
				kind: "directory",
				applications: apps,
				defaultId: preferred.id,
				failed: false,
				t,
				busy: operation.phase === "busy",
				shortcut,
				execute: async (operation) => {
					const id = operation.kind === "application" ? operation.id : preferred.id;
					try {
						await props.launch(id, absolutePath);
					} catch (_error) {
						return "openError";
					}
export {};
