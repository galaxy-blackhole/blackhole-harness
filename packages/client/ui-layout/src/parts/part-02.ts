/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						rightbarTrack: false,
						rightbarFullscreen: false,
						rightbarInstant: false
					}
				}),
				actions: {
					selectPanel: (d, panelId) => {
						d.panelInfo.activePanelId = panelId;
					},
					retainMainPanels: (d, panelIds) => {
						if (d.panelInfo.activePanelId !== null && !panelIds.includes(d.panelInfo.activePanelId)) d.panelInfo.activePanelId = null;
					},
					setSidebar: (d, px) => {
						d.layoutInfo.rightbarInstant = false;
						d.layoutInfo.sidebar = clampWidth(px, 264, 420);
					},
					toggleSidebar: (d) => {
						d.layoutInfo.rightbarInstant = false;
						if (d.layoutInfo.viewportWidth < 1024) d.layoutInfo.narrowExpanded = !d.layoutInfo.narrowExpanded;
						else d.layoutInfo.sidebar = d.layoutInfo.sidebar === 0 ? 280 : 0;
					},
					setViewportWidth: (d, width) => {
						if (d.layoutInfo.viewportWidth === width) return;
						d.layoutInfo.rightbarInstant = false;
						if (d.layoutInfo.viewportWidth < 1024 !== width < 1024) d.layoutInfo.narrowExpanded = false;
						d.layoutInfo.viewportWidth = width;
					},
					setRightbar: (d, px) => {
						d.layoutInfo.rightbarInstant = false;
						d.layoutInfo.rightbar = clampWidth(px, 300, Math.max(300, d.layoutInfo.viewportWidth * RIGHTBAR_MAX_RATIO));
					},
					openRightbar: (d, track, fullscreen) => {
						if (!d.layoutInfo.rightbarShown || d.layoutInfo.rightbarTrack !== track || d.layoutInfo.rightbarFullscreen !== fullscreen) d.layoutInfo.rightbarInstant = d.layoutInfo.rightbarFullscreen && !fullscreen;
						if (!d.layoutInfo.rightbarShown && d.layoutInfo.viewportWidth < 1024) d.layoutInfo.narrowExpanded = false;
						d.layoutInfo.rightbar ??= Math.max(300, Math.round(d.layoutInfo.viewportWidth * RIGHTBAR_DEFAULT_RATIO));
						d.layoutInfo.rightbarShown = true;
						d.layoutInfo.rightbarTrack = track;
						d.layoutInfo.rightbarFullscreen = fullscreen;
					},
					closeRightbar: (d) => {
						if (d.layoutInfo.rightbarShown) d.layoutInfo.rightbarInstant = d.layoutInfo.rightbarFullscreen;
						d.layoutInfo.rightbarShown = false;
						d.layoutInfo.rightbarTrack = false;
						d.layoutInfo.rightbarFullscreen = false;
					}
				}
			});
		}
		//#endregion
		//#region lib/types/client/service.js
		/** Cross-plugin panel-action face (ctx.layout). */
		var LayoutController = class {
			panels;
			hasMainPanel;
			panelInfo;
			navigation = new AbortController();
			/**
			* @param panels - actions of the instance shared with the root entry.
			* @param hasMainPanel - checks the live main-slot registry for a panel id.
			* @param panelInfo - root store's shared central-panel selection source.
			*/
			constructor(panels, hasMainPanel, panelInfo) {
				this.panels = panels;
				this.hasMainPanel = hasMainPanel;
				this.panelInfo = panelInfo;
			}
			/** Select a global panel or return to the Conversation. */
			selectPanel(panelId) {
				if (panelId !== null && !this.hasMainPanel(panelId)) throw new Error(`layout.selectPanel: main panel "${panelId}" is not registered`);
				this.navigation.abort();
				this.panels.selectPanel(panelId);
			}
			/** @returns the new pending navigation's cancellation signal. */
			beginNavigation() {
				this.navigation.abort();
				this.navigation = new AbortController();
				return this.navigation.signal;
			}
			/** Invalidate pending navigations when the layout owner is unloaded. */
			dispose() {
				this.navigation.abort();
			}
			/** Toggle the sidebar panel (closed ⟷ contract default width). */
			toggleSidebar() {
				this.panels.toggleSidebar();
			}
			/** Report the right panel's track and fullscreen presentation. */
			openRightbar(track, fullscreen) {
				this.panels.openRightbar(track, fullscreen);
			}
			/** Report the right panel as hidden: no track, no handle. */
			closeRightbar() {
				this.panels.closeRightbar();
			}
		};
		//#endregion
		//#region lib/types/client/shortcut-locales.js
		/** Layout command labels. */
		const zh = { toggle: "展开／收起左侧栏" };
		/** English labels for the same layout commands. */
		const en = { toggle: "Toggle left sidebar" };
		//#endregion
		//#region lib/types/client/theme-presenter.js
		/** Body attribute selecting the dark base palette in the token stylesheets. */
		const DARK_ATTRIBUTE = "data-ds-dark-theme";
		/**
		* Root attribute publishing the theme source (`light`, `dark`, or `system`)
		* for host shells that mirror it into the native theme (the Electron preload
		* forwards it to `nativeTheme.themeSource`, so native chrome, renderer
		* `prefers-color-scheme` queries, and Platform login links follow the app
		* palette on every platform). `system` only when the preference is `system`;
		* a fixed preference (including registered theme ids) publishes its resolved
		* scheme.
		*/
		const THEME_SOURCE_ATTRIBUTE = "data-ds-theme-source";
		/** Body variables carrying the user's font sizes in px by role. */
		const FONT_SIZE_VARIABLES = {
			text: "--dsh-content-font-size",
			code: "--dsh-code-font-size",
			terminal: "--dsh-terminal-font-size"
		};
		/** Body variables carrying the user's normalized font lists; absent selects the built-in stack. */
		const FONT_FAMILY_VARIABLES = {
			text: "--dsh-font-family-text",
			code: "--dsh-font-family-code",
			terminal: "--dsh-font-family-terminal"
		};
		/** Applies theme snapshots to the document; one instance per plugin fiber. */
		var ThemePresenter = class {
			/** Token names this presenter wrote in the last apply (its retraction set). */
			appliedTokens = [];
			/** The single metadata node this presenter inserts and removes. */
			themeColorMeta;
			/** Create the presenter-owned metadata node before the first snapshot arrives. */
			constructor() {
				this.themeColorMeta = document.createElement("meta");
				this.themeColorMeta.name = "theme-color";
			}
			/**
			* Project a snapshot onto the document: set root `color-scheme` and the body
			* palette attribute from `active.colorScheme` (never the id — `system` is
			* resolved upstream), publish the font sizes and font lists, then replace the
			* previously applied token variables with `active.tokens`. Browser
			* theme-color metadata follows the computed body background after those
			* writes, so the rendered palette remains the color authority.
			* @param snapshot - resolved theme snapshot from ctx.theme.
			*/
			apply(snapshot) {
				const scheme = snapshot.active.colorScheme;
				document.documentElement.style.colorScheme = scheme;
				document.documentElement.setAttribute(THEME_SOURCE_ATTRIBUTE, snapshot.preference === "system" ? "system" : scheme);
				const body = document.body;
				if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, "");
				else body.removeAttribute(DARK_ATTRIBUTE);
				for (const [role, name] of Object.entries(FONT_SIZE_VARIABLES)) body.style.setProperty(name, `${snapshot.fontSizes[role]}px`);
				for (const [kind, name] of Object.entries(FONT_FAMILY_VARIABLES)) {
					const list = snapshot.fontFamilies[kind];
					if (list === "") body.style.removeProperty(name);
					else body.style.setProperty(name, list);
				}
				for (const name of this.appliedTokens) body.style.removeProperty(name);
				this.appliedTokens = [];
				for (const [name, value] of Object.entries(snapshot.active.tokens)) {
					body.style.setProperty(name, value);
					this.appliedTokens.push(name);
				}
				this.themeColorMeta.content = getComputedStyle(body).backgroundColor;
				if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta);
			}
			/**
			* Retract root color-scheme, the theme-source attribute, the palette
			* attribute, token variables, the font sizes, font lists, and the owned metadata node.
			*/
			dispose() {
				document.documentElement.style.removeProperty("color-scheme");
				document.documentElement.removeAttribute(THEME_SOURCE_ATTRIBUTE);
				const body = document.body;
				body.removeAttribute(DARK_ATTRIBUTE);
				for (const name of Object.values(FONT_SIZE_VARIABLES)) body.style.removeProperty(name);
				for (const name of Object.values(FONT_FAMILY_VARIABLES)) body.style.removeProperty(name);
				for (const name of this.appliedTokens) body.style.removeProperty(name);
				this.appliedTokens = [];
				this.themeColorMeta.remove();
			}
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */
		const inject = [
			"slots",
			"theme",
			"locale",
			"shortcuts"
		];
		/**
		* Client plugin body: provide ctx.layout, then one register() call — AppFrame
		* into 'root' with its child-slot declarations, the layout store seat,
		* and the shared root instance supplying commands and the panel-info source.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("shortcuts.layout", {
				zh,
				en
			}), "layout: command labels");
			const t = ctx.locale.bind("shortcuts.layout");
			ctx.effect(() => {
				const handle = createLayoutStore();
				const instance = handle.create();
				const store = {
					...handle,
					create: () => instance
				};
				const retainMainPanels = () => {
					instance.actions.retainMainPanels(ctx.slots.entries("main").flatMap((entry) => entry.options.key === void 0 ? [] : [entry.options.key]));
				};
				const layout = new LayoutController(instance.actions, (id) => ctx.slots.entries("main").some((entry) => entry.options.key === id), {
					getSnapshot: () => instance.getSnapshot().panelInfo,
					subscribe: (listener) => instance.subscribe(listener)
				});
				const disposePanelInfo = ctx.slots.provideRoot({ hooks: { panelInfo: layout.panelInfo } });
				const disposeService = ctx.reflect.provide("layout", layout);
				const disposeRegistration = ctx.slots.register({
					name: "root",
					locale: "common",
					children: {
						"sidebar": {
							kind: "single",
							scope: "root"
						},
						"main": {
							kind: "keyed",
							scope: "root"
						},
						"rightbar": {
							kind: "single",
							scope: "root"
						},
						"shell.bottom": {
							kind: "single",
							scope: "root"
						},
						"shell.overlay": {
							kind: "list",
							scope: "root"
						},
						"shell.leading": {
							kind: "single",
							scope: "root"
						}
					},
					store
				}, AppFrame);
				const disposeShortcut = ctx.shortcuts.register({
					id: "sidebar.left.toggle",
					label: () => t("toggle"),
					aliases: ["sidebar", "toggle left sidebar"],
					defaults: {
						"desktop:macos": {
							code: "KeyB",
							modifiers: ["primary"]
						},
						"desktop:windows": {
							code: "KeyB",
							modifiers: ["primary"]
						},
						"desktop:linux": {
							code: "KeyB",
							modifiers: ["primary"]
						},
						"web:macos": {
							code: "KeyB",
							modifiers: ["primary", "alt"]
						},
						"web:windows": {
							code: "KeyB",
							modifiers: ["primary", "alt"]
						}
					},
					regions: ["page", "editable"],
					modals: [],
					resolve: () => ({
						status: "handled",
						run: () => {
							layout.toggleSidebar();
						}
					})
				});
				const disposePanels = ctx.slots.subscribe("main", retainMainPanels);
				retainMainPanels();
				return () => {
					disposeShortcut();
					layout.dispose();
					disposePanels();
					disposeRegistration();
					disposePanelInfo();
					disposeService();
				};
			}, "ui-layout: service + root registration");
			ctx.effect(() => {
				const presenter = new ThemePresenter();
				presenter.apply(ctx.theme.getTheme());
				const off = ctx.on("theme/change", (snapshot) => {
					presenter.apply(snapshot);
				});
				return () => {
					off();
					presenter.dispose();
				};
			}, "ui-layout: theme presenter");
		}
		//#endregion
		exports.LayoutController = LayoutController;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
