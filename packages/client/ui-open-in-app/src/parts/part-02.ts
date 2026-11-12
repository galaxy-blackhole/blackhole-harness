/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					if (operation.kind === "application") props.choose(id);
					return null;
				}
			}, absolutePath);
		}
		//#endregion
		//#region lib/types/client/open-path.js
		/**
		* Host desktop availability, file associations, and open/reveal actions over the Session Remote.
		* The desktop answer is read once per page; a failed read renders no control.
		*/
		/** Page-lifetime desktop availability and the open/reveal carrier shared by every path control. */
		var OpenInAppPathController = class {
			remote;
			/** Whether the Host desktop can open paths; null until the Host answered, false also after a failed read. */
			desktop = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null);
			loading;
			/**
			* @param remote - the Session Remote namespace answering availability and running gestures.
			*/
			constructor(remote) {
				this.remote = remote;
			}
			/**
			* Read desktop availability once per controller life; concurrent calls share the read.
			* @returns after availability is published.
			*/
			load() {
				this.loading ??= this.run();
				return this.loading;
			}
			/**
			* Open one Host path in its default application, or reveal it in the file manager.
			* @param path - absolute path on the Host, as the file's metadata reports it.
			* @param action - default application open, or file-manager reveal.
			* @param application - registered application path for an explicit open.
			* @returns the failure kind to announce, or `null` once the Host acknowledged.
			*/
			async openPath(path, action, application) {
				const request = action === "reveal" ? {
					path,
					action
				} : {
					path,
					...application === void 0 ? {} : { application }
				};
				let ok = false;
				try {
					ok = (await this.remote.session.openWorkspacePath(request)).ok;
				} catch {}
				return ok ? null : action === "open" ? "openError" : "revealError";
			}
			/**
			* Refresh the file's OS associations; failures remain distinct from an empty handler list.
			* @param path - file path reported by the Host.
			* @param signal - lifetime of the requesting preview.
			* @returns application metadata, or null when the query fails.
			*/
			async applications(path, signal) {
				let result;
				try {
					result = await this.remote.session.workspacePathApplications({ path }, signal);
				} catch (_error) {
					return null;
				}
				return result.ok ? result.value : null;
			}
			async run() {
				let available = false;
				try {
					const result = await this.remote.session.canOpenWorkspacePath();
					available = result.ok && result.value;
				} catch {}
				this.desktop.set(available);
			}
		};
		//#endregion
		//#region lib/types/client/file-applications.js
		/** File association reads shared by mounted controls using the same reader and target. */
		const EMPTY = {
			apps: [],
			loading: true,
			failed: false
		};
		const readers = /* @__PURE__ */ new WeakMap();
		/** Each mounted consumer retains the query; the last release cancels and discards it. */
		function subscribe(query, target, listener) {
			let targets = readers.get(query);
			if (targets === void 0) {
				targets = /* @__PURE__ */ new Map();
				readers.set(query, targets);
			}
			let entry = targets.get(target);
			const initial = entry === void 0;
			if (entry === void 0) {
				const created = {
					state: (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(EMPTY),
					users: 0,
					controller: null,
					refresh: () => {
						created.controller?.abort();
						const controller = new AbortController();
						created.controller = controller;
						query(target, controller.signal).then((apps) => {
							if (!controller.signal.aborted) created.state.set({
								apps: apps ?? [],
								loading: false,
								failed: apps === null
							});
						});
					}
				};
				entry = created;
				targets.set(target, entry);
			}
			const retained = entry;
			retained.users += 1;
			const release = retained.state.subscribe(listener);
			if (initial) retained.refresh();
			return () => {
				release();
				retained.users -= 1;
				if (retained.users === 0) {
					retained.controller?.abort();
					targets.delete(target);
				}
			};
		}
		/**
		* Share associations and refreshes across mounted controls for the same file and reader.
		* @param target - path or authenticated route identifying the current file.
		* @param query - stable reader scoped to the serving Host; failures resolve to null.
		* @param enabled - whether a native desktop is available.
		* @returns metadata, initial loading state, failure state, and a shared refresh callback.
		*/
		function useFileApplications(target, query, enabled) {
			const retain = (0, react.useCallback)((listener) => enabled ? subscribe(query, target, listener) : () => {}, [
				enabled,
				query,
				target
			]);
			const snapshot = (0, react.useCallback)(() => enabled ? readers.get(query)?.get(target)?.state.getSnapshot() ?? EMPTY : EMPTY, [
				enabled,
				query,
				target
			]);
			const state = (0, react.useSyncExternalStore)(retain, snapshot, snapshot);
			const refresh = (0, react.useCallback)(() => {
				readers.get(query)?.get(target)?.refresh();
			}, [query, target]);
			return {
				...state,
				refresh
			};
		}
		//#endregion
		//#region lib/types/client/OpenPathAction.js
		/** File association adapter for the shared file/directory opening control. */
		/**
		* Resolve file associations and adapt operations without embedding platform behavior in the control.
		* @param props - verified file path, desktop query, native operations, and display variant.
		* @returns the shared opening control, or null without a desktop.
		*/
		function FileOpenTarget(props) {
			const desktop = props.useOpenInAppDesktop((value) => value);
			const association = useFileApplications(props.absolutePath, props.applications, desktop === true);
			(0, react.useEffect)(() => {
				if (desktop === null) props.loadDesktop();
			}, [desktop, props.loadDesktop]);
			if (desktop !== true) return null;
			const { apps } = association;
			return (0, react_jsx_runtime.jsx)(OpenTargetButton, {
				kind: "file",
				applications: apps,
				defaultId: apps.find((app) => app.default)?.id,
				loading: association.loading,
				failed: association.failed,
				prominent: props.empty === true,
				t: props.t,
				refresh: association.refresh,
				execute: (operation) => props.openPath(props.absolutePath, operation.kind === "reveal" ? "reveal" : "open", operation.kind === "application" ? operation.id : void 0)
			}, props.absolutePath);
		}
		/**
		* Render the file adapter in the document header.
		* @param props - document owner inputs and injected opening capabilities.
		* @returns the shared split button.
		*/
		function OpenPathAction(props) {
			return (0, react_jsx_runtime.jsx)(FileOpenTarget, { ...props });
		}
		//#endregion
		//#region ../../util/native-command/src/types.ts
		/**
		* Validate file association metadata received from a native process or authenticated Host.
		* @param value - decoded application list.
		* @returns validated application metadata.
		* @throws Error for malformed entries or unsupported icon URLs.
		*/
		function parseNativeFileApplications(value) {
			if (!Array.isArray(value)) throw new Error("Invalid native application list");
			const applications = [];
			const entries = value;
			for (const entry of entries) {
				if (typeof entry !== "object" || entry === null || !("id" in entry) || !("name" in entry) || !("default" in entry) || !("icon" in entry) || typeof entry.id !== "string" || entry.id.length === 0 || typeof entry.name !== "string" || typeof entry.default !== "boolean" || !(entry.icon === null || typeof entry.icon === "string" && /^data:image\/(?:png|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(entry.icon))) throw new Error("Invalid native application entry");
				applications.push({
					id: entry.id,
					name: entry.name,
					default: entry.default,
					icon: entry.icon
				});
			}
			return applications;
		}
		//#endregion
		//#region lib/types/client/FileRouteAction.js
		async function queryRoute(url, signal) {
			try {
				const response = await fetch(url, { signal });
				if (!response.ok) return null;
				return parseNativeFileApplications(await response.json());
			} catch (_error) {
				return null;
			}
		}
		/**
		* Render file actions without bypassing the owning Session's authorization route.
		* @param props - authenticated route, desktop availability, and native gesture callback.
		* @returns the shared compact control, or null without a desktop.
		*/
		function FileRouteAction(props) {
			const association = useFileApplications(props.actionUrl, queryRoute, props.available);
			if (!props.available) return null;
			return (0, react_jsx_runtime.jsx)(OpenTargetButton, {
				kind: "file",
				applications: association.apps,
				defaultId: association.apps.find((app) => app.default)?.id,
				failed: association.failed,
				loading: association.loading,
				busy: props.pending,
				refresh: association.refresh,
				t: props.t,
				execute: async (operation) => {
					return props.onAction(operation.kind === "reveal" ? "reveal" : "open", operation.kind === "application" ? operation.id : void 0);
				}
			}, props.actionUrl);
		}
		//#endregion
		//#region lib/types/client/OpenPathEmptyAction.js
		/**
		* Render the shared file opening menu with a larger labeled main button.
		* @param props - unpreviewable file and injected opening capabilities.
		* @returns the shared file opening action.
		*/
		function OpenPathEmptyAction(props) {
			return (0, react_jsx_runtime.jsx)(FileOpenTarget, {
				...props,
				empty: true
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** `open-in-app` namespace dictionaries: the workspace split button and the document-preview path controls. */
		/** Dictionary namespace owned by this plugin. */
		const NS = "open-in-app";
		/** Application labels shared verbatim by both dictionaries (product names). */
		const PRODUCT_NAMES = {
			"app.cursor": "Cursor",
			"app.vscode": "VS Code",
			"app.vscodeinsiders": "VS Code Insiders",
			"app.windsurf": "Windsurf",
			"app.zed": "Zed",
			"app.sublimetext": "Sublime Text",
			"app.xcode": "Xcode",
			"app.androidstudio": "Android Studio",
			"app.intellij": "IntelliJ IDEA",
			"app.pycharm": "PyCharm",
			"app.webstorm": "WebStorm",
			"app.phpstorm": "PhpStorm",
			"app.goland": "GoLand",
			"app.rider": "Rider",
			"app.rustrover": "RustRover",
			"app.fork": "Fork",
			"app.sourcetree": "Sourcetree",
			"app.github": "GitHub Desktop",
			"app.tower": "Tower",
			"app.gitkraken": "GitKraken",
			"app.smartgit": "SmartGit",
			"app.sublimemerge": "Sublime Merge",
			"app.ghostty": "Ghostty",
			"app.warp": "Warp",
			"app.iterm": "iTerm2",
			"app.kitty": "kitty",
			"app.windowsterminal": "Windows Terminal",
			"app.gitbash": "Git Bash",
			"app.gnometerminal": "GNOME Terminal",
			"app.konsole": "Konsole"
		};
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"open.title": "用 {app} 打开",
			"path.appDefault": "{app}（默认）",
			"path.appsError": "无法获取应用列表",
			"shortcut.busy": "正在打开工作区",
			"shortcut.unavailable": "当前工作区或本地应用不可用",
			"open.tooltip": "在本地打开",
			"path.open": "打开",
			"path.more": "更多打开方式",
			"path.reveal": "显示文件位置",
			"path.openError": "打开失败，请重试",
			"path.revealError": "无法显示文件位置，请重试",
			...PRODUCT_NAMES,
			"app.finder": "访达",
			"app.explorer": "文件资源管理器",
			"app.filemanager": "文件管理器",
			"app.terminal": "终端"
		};
		/** English dictionary, key-identical to the Chinese source of truth. */
		const en = {
			"open.title": "Open in {app}",
			"path.appDefault": "{app} (default)",
			"path.appsError": "Could not load applications",
			"shortcut.busy": "Opening workspace",
			"shortcut.unavailable": "Current workspace or local application unavailable",
			"open.tooltip": "Open locally",
			"path.open": "Open",
			"path.more": "More ways to open",
			"path.reveal": "Show file location",
			"path.openError": "Could not open. Try again.",
			"path.revealError": "Could not show the file location. Try again.",
			...PRODUCT_NAMES,
			"app.finder": "Finder",
			"app.explorer": "File Explorer",
			"app.filemanager": "Files",
			"app.terminal": "Terminal"
		};
		//#endregion
		//#region lib/types/client/index.js
		/**
		* Shared native opening controls for workspace directories, document previews,
		* delivery cards, and changed-file review. Directory choices persist in the browser;
		* file defaults and application lists come from the serving Host desktop.
		*/
		/** Required services: sessions, layout selection, the slot registry, copy, Remote calls, and shortcuts. */
		const inject = [
			"sessions",
			"slots",
			"locale",
			"remote",
			"remote.session",
			"shortcuts",
			"layout"
		];
		/**
		* Client plugin body: register dictionaries, workspace directory controls, and
		* document preview path controls.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const controller = new OpenInAppController();
			controller.load();
			const paths = new OpenInAppPathController(ctx.remote);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "open-in-app: dictionaries");
			const t = ctx.locale.bind(NS);
			const target = () => {
				if (ctx.layout.panelInfo.getSnapshot().activePanelId !== null) return void 0;
				const session = Object.values(ctx.sessions.list.getSnapshot().byId).find((row) => (row.retainedBy.mainView ?? 0) > 0);
				const appId = controller.currentApp();
				return session?.cwd && appId !== void 0 ? {
					appId,
					path: session.cwd
				} : void 0;
			};
			ctx.effect(() => ctx.shortcuts.register({
				id: "workspace.openLocal",
				label: () => t("open.tooltip"),
				aliases: ["open workspace locally", "open in app"],
				defaults: {
					"desktop:macos": {
						code: "KeyO",
						modifiers: ["primary", "alt"]
					},
					"desktop:windows": {
						code: "KeyO",
						modifiers: ["primary", "alt"]
					},
					"desktop:linux": {
						code: "KeyO",
						modifiers: ["primary", "alt"]
					},
					"web:macos": {
						code: "KeyO",
						modifiers: ["primary", "shift"]
					},
					"web:windows": {
						code: "KeyO",
						modifiers: ["primary", "shift"]
export {};
