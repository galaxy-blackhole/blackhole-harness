/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		/**
		* Declare the file tree's store.
		*
		* A factory rather than a shared handle: the registration declares it as an
		* exclusive store, so the framework mints one instance per session.
		* @returns the store handle to declare on the registration.
		*/
		function createFilesStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({ byTab: {} }),
				actions: {
					autoRefresh: (d, tabId, enabled) => {
						bucket(d, tabId).autoRefresh = enabled;
					},
					/**
					* Seed one tab's tree at its workspace root, with the root expanded.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param root - absolute path of the workspace root.
					*/
					start: (d, tabId, root) => {
						d.byTab[tabId] = {
							root,
							levels: {},
							expanded: [root],
							scrollTop: 0,
							autoRefresh: true
						};
					},
					/**
					* Mark one directory as being listed.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param path - absolute directory path.
					*/
					loading: (d, tabId, path) => {
						const state = bucket(d, tabId);
						if (state.levels[path]?.kind !== "ready") state.levels[path] = { kind: "loading" };
					},
					/**
					* Record one directory's contents.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param path - absolute directory path.
					* @param level - the listing to show under it.
					*/
					loaded: (d, tabId, path, level) => {
						const state = bucket(d, tabId);
						const previous = state.levels[path];
						if (previous?.kind === "ready") {
							const directories = new Set(level.entries.filter((entry) => entry.type === "directory").map((entry) => entry.name));
							for (const entry of previous.level.entries) {
								if (entry.type !== "directory" || directories.has(entry.name)) continue;
								const removed = `${path.replace(/[/\\]+$/, "")}/${entry.name}`;
								state.expanded = state.expanded.filter((value) => value !== removed && !value.startsWith(`${removed}/`));
								state.levels = Object.fromEntries(Object.entries(state.levels).filter(([key]) => key !== removed && !key.startsWith(`${removed}/`)));
							}
						}
						state.levels[path] = {
							kind: "ready",
							level
						};
					},
					/**
					* Record why one directory could not be listed.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param path - absolute directory path.
					* @param failure - the settled Remote failure.
					*/
					failed: (d, tabId, path, failure) => {
						const level = bucket(d, tabId).levels[path];
						bucket(d, tabId).levels[path] = level?.kind === "ready" ? {
							...level,
							failure
						} : {
							kind: "failed",
							failure
						};
					},
					/**
					* Open a collapsed directory, or collapse an open one.
					*
					* A collapsed level keeps what it loaded, so reopening it draws at once.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param path - absolute directory path.
					*/
					toggled: (d, tabId, path) => {
						const state = bucket(d, tabId);
						const at = state.expanded.indexOf(path);
						if (at >= 0) state.expanded.splice(at, 1);
						else state.expanded.push(path);
					},
					/**
					* Record where one tab's body is scrolled to.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					* @param scrollTop - the body's scroll offset, in px.
					*/
					scrolled: (d, tabId, scrollTop) => {
						bucket(d, tabId).scrollTop = scrollTop;
					},
					/**
					* Drop every loaded level, keeping what is expanded.
					*
					* This is the reload gesture's first half: the expanded set says which
					* levels to fetch again.
					* @param d - draft state.
					* @param tabId - the tab being drawn.
					*/
					reset: (d, tabId) => {
						bucket(d, tabId).levels = {};
					},
					/**
					* Forget one tab's tree, for a tab record that is gone.
					* @param d - draft state.
					* @param tabId - the tab that went away.
					*/
					forget: (d, tabId) => {
						d.byTab = Object.fromEntries(Object.entries(d.byTab).filter(([id]) => id !== tabId));
					}
				}
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/** This package's copy namespace. */
		const NS = "sidebarFiles";
		/**
		* Required browser services: the tab registry, the keyed seat, the Remote
		* carrier and its namespace, and copy.
		*/
		const inject = [
			"slots",
			"locale",
			"sidebarRightTabs",
			"sidebarRight",
			"remote",
			"remote.workspaceFiles"
		];
		/**
		* Client plugin body: register the type, its dictionaries, its body, and its chip title.
		* @param ctx - client root context carrying the registry, the slots, and the Remote face.
		*/
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.inject(["shortcuts"], (ctx) => {
				ctx.effect(() => ctx.shortcuts.register({
					id: "workspace.files",
					label: () => t("guide.title"),
					aliases: ["workspace files", "files"],
					defaults: {
						"desktop:macos": {
							code: "KeyP",
							modifiers: ["primary"]
						},
						"desktop:windows": {
							code: "KeyP",
							modifiers: ["primary"]
						},
						"desktop:linux": {
							code: "KeyP",
							modifiers: ["primary"]
						},
						"web:macos": {
							code: "KeyP",
							modifiers: ["primary", "alt"]
						},
						"web:windows": {
							code: "KeyP",
							modifiers: ["primary", "alt"]
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
								ctx.sidebarRight.openTabFromTarget("files", target);
							}
						};
					}
				}), "ui-sidebar-files: shortcut");
			});
			ctx.effect(() => ctx.sidebarRightTabs.register(filesDefinition(t)), "ui-sidebar-files: files type");
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-sidebar-files: dictionaries");
			const store = createFilesStore();
			const inject = filesFace(createList(ctx.remote), createWatch(ctx.remote));
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: FILES_ID,
				locale: NS,
				store,
				inject,
				children: { "sidebar.right.tab.files.actions": {
					kind: "list",
					scope: "session"
				} }
			}, FilesBody)), "ui-sidebar-files: files tab body");
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: FILES_ID
			}, FilesTitle)), "ui-sidebar-files: files tab title");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
