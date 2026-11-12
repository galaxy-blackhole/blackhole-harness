/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										size: "sm",
										className: PluginManagerPage_module_css_default.infoButton,
										"aria-label": t("infoLabel"),
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInfoOutlineRegular, {
											size: 11,
											"aria-hidden": "true"
										})
									})
								})]
							})]
						}), (0, react_jsx_runtime.jsxs)("div", {
							className: PluginManagerPage_module_css_default.toolbar,
							hidden: !onInstalled,
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("refresh"),
								delayMs: 500,
								focusDelayMs: 500,
								side: "bottom",
								portal: true,
								disabled: !loaded || refreshing,
								children: (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: PluginManagerPage_module_css_default.iconButton,
									"aria-label": t("refresh"),
									"aria-busy": refreshing,
									disabled: !loaded || refreshing,
									onClick: props.refresh,
									children: (0, react_jsx_runtime.jsx)("span", {
										className: PluginManagerPage_module_css_default.iconWrap,
										"aria-hidden": "true",
										children: refreshing ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
											state: "ongoing",
											size: 18
										}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {})
									})
								})
							}), state.install.requestId === void 0 ? (0, react_jsx_runtime.jsx)(AddPluginMenu, {
								t,
								disabled: !loaded,
								openInstall: props.openInstall,
								renderSlot
							}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								size: "sm",
								className: PluginManagerPage_module_css_default.addButton,
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 13 }),
								disabled: !loaded,
								onClick: props.openInstall,
								children: t("installViewTask")
							})]
						})]
					}) : null,
					showsMainList && tabs.length > 0 ? (0, react_jsx_runtime.jsx)("div", {
						className: PluginManagerPage_module_css_default.pageTabs,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SegmentedTabs, {
							className: PluginManagerPage_module_css_default.pageTabList,
							label: t("tabsLabel"),
							value: tab,
							onChange: (next) => {
								setTab(next);
							},
							items: [{
								value: INSTALLED_TAB,
								label: t("installedTab"),
								id: `${tabsId}-${INSTALLED_TAB}`,
								panelId: `${tabsId}-${INSTALLED_TAB}-panel`
							}, ...tabs.map((item) => ({
								value: item.id,
								label: item.label,
								id: `${tabsId}-${item.id}`,
								panelId: `${tabsId}-${item.id}-panel`
							}))]
						})
					}) : null,
					!onInstalled ? (0, react_jsx_runtime.jsx)("div", {
						role: "tabpanel",
						id: `${tabsId}-${tab}-panel`,
						"aria-labelledby": `${tabsId}-${tab}`,
						className: PluginManagerPage_module_css_default.tabPanel,
						children: renderSlot("plugins.tab", {
							install: props.installFrom,
							openPackage: (name) => {
								setTab(INSTALLED_TAB);
								setView({
									kind: "package",
									name
								});
							}
						}, { only: tab })
					}) : null,
					showsMoreList ? (0, react_jsx_runtime.jsxs)("header", {
						className: PluginManagerPage_module_css_default.moreHead,
						"data-window-drag": true,
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							className: PluginManagerPage_module_css_default.moreBack,
							"aria-label": t("backToList"),
							onClick: () => {
								setView({ kind: "list" });
							},
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutlineMedium, {
								size: 20,
								"aria-hidden": "true"
							})
						}), (0, react_jsx_runtime.jsx)("h1", {
							className: PluginManagerPage_module_css_default.pageTitle,
							children: t("moreTitle")
						})]
					}) : null,
					installedCards && !loaded ? (0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.installedPanel,
						...installedPanel,
						children: [state.status === "loading" ? (0, react_jsx_runtime.jsx)(ListSkeleton, { label: t("loading") }) : null, state.status === "unavailable" ? (0, react_jsx_runtime.jsxs)("p", {
							className: `${PluginManagerPage_module_css_default.status} ${PluginManagerPage_module_css_default.statusWithDot}`,
							role: "status",
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "idle" }), t("unavailable")]
						}) : null]
					}) : null,
					state.notice === null || noticeLine === null ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
						text: noticeLine,
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
						holdMs: toastHoldMs(noticeLine),
						onDone: props.dismissNotice
					}, state.notice.seq),
					!showsCards && state.status === "error" && !refreshing ? (0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.failure,
						children: [(0, react_jsx_runtime.jsxs)("p", {
							className: PluginManagerPage_module_css_default.statusWithDot,
							role: "alert",
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" }), t(state.refreshStatus === "failed" ? "refreshError" : "error")]
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							size: "sm",
							onClick: props.refresh,
							children: t("retry")
						})]
					}) : null,
					onInstalled && loaded && openPkg !== void 0 && openRow !== void 0 ? (0, react_jsx_runtime.jsx)(RowDetail, {
						pkg: openPkg,
						row: openRow,
						form: formFor(openRow.rowId),
						t,
						resolveText,
						renderSlot,
						onBack: () => {
							setView({
								kind: "package",
								name: openPkg.name,
								...openPkgInMore ? { from: "more" } : {}
							});
						}
					}) : null,
					onInstalled && loaded && openPkg !== void 0 && openRow === void 0 ? (0, react_jsx_runtime.jsx)(PackageDetail, {
						pkg: openPkg,
						t,
						resolveText,
						busy: packageBusy(openPkg),
						rowBusy: (row) => row.entryId !== void 0 && state.busy.includes(rowKey(row.entryId)),
						configured: ledger.bundles.has(openPkg.name),
						configure: configure(openPkg),
						renderSlot,
						inMore: openPkgInMore,
						onBack: () => {
							setView({ kind: openPkgInMore ? "more" : "list" });
						},
						onSetEnabled: (enabled) => {
							props.setEnabled(openPkg.name, enabled);
						},
						onUninstall: () => {
							props.uninstall(openPkg.name);
						},
						onUpdate: () => {
							props.update(openPkg.name);
						},
						onSetRowEnabled: setRowEnabled
					}) : null,
					onInstalled && loaded && openItem !== void 0 ? (0, react_jsx_runtime.jsx)(ItemDetail, {
						form: formFor(openItem.id),
						item: openItem,
						t,
						renderSlot,
						onBack: () => {
							setView({ kind: "list" });
						}
					}) : null,
					loaded && installedCards ? basicCards.length === 0 && official.length === 0 && mine.length === 0 && state.status !== "error" ? (0, react_jsx_runtime.jsx)("div", {
						className: PluginManagerPage_module_css_default.installedPanel,
						...installedPanel,
						children: (0, react_jsx_runtime.jsx)("p", {
							className: PluginManagerPage_module_css_default.empty,
							children: t("empty")
						})
					}) : (0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.installedPanel,
						...installedPanel,
						children: [showsMoreList ? (0, react_jsx_runtime.jsx)("section", {
							className: PluginManagerPage_module_css_default.group,
							"data-plugin-scope": "global",
							"data-plugin-group": "more",
							children: (0, react_jsx_runtime.jsx)("ul", {
								className: PluginManagerPage_module_css_default.cards,
								children: more.map(packageCard)
							})
						}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							renderGroup("basic", t("basicTitle"), basicCards),
							renderGroup("extensions", t("extensionsTitle"), extensions.map(packageCard)),
							renderGroup("bundles", t("bundlesTitle"), mine.map(packageCard))
						] }), state.status === "error" && !refreshing ? (0, react_jsx_runtime.jsxs)("div", {
							className: PluginManagerPage_module_css_default.failure,
							children: [(0, react_jsx_runtime.jsxs)("p", {
								className: PluginManagerPage_module_css_default.statusWithDot,
								role: "alert",
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" }), t(state.refreshStatus === "failed" ? "refreshError" : "error")]
							}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								onClick: props.refresh,
								children: t("retry")
							})]
						}) : null]
					}) : null,
					showsCards && activated !== void 0 && !state.install.open ? renderSlot("plugins.bundle.activation", {
						packageName: activated.name,
						onDismiss: () => {
							setActivation(null);
						},
						onOpenDetails: () => {
							setActivation(null);
							setView({
								kind: "package",
								name: activated.name,
								...showsMoreList ? { from: "more" } : {}
							});
						}
					}, { entryKey: activated.name }) : null,
					(0, react_jsx_runtime.jsx)(InstallDialog, {
						install: state.install,
						t,
						onClose: props.closeInstall,
						onEditSpec: props.editInstallSpec,
						onRun: props.runInstall,
						onCancel: props.cancelInstall,
						onReconcile: props.reconcileInstall,
						onToggleDetails: props.toggleInstallDetails,
						onEnableNow: () => {
							setActivation(state.install.installed);
							props.enableInstalled();
						},
						onApproveBuilds: props.approveBuildsAndRetry,
						onToggleRegistry: props.toggleRegistryOptions,
						onChooseRegistry: props.chooseRegistry,
						onChangeRegistry: props.changeRegistry,
						onUseGithubMirror: props.useGithubMirror
					}),
					state.confirm === null ? null : (0, react_jsx_runtime.jsx)(ConfirmDialog, {
						name: packageText(state.packages.find((pkg) => pkg.name === state.confirm?.packageName) ?? { name: state.confirm.packageName }, resolveText).title,
						t,
						onConfirm: props.confirm,
						onCancel: props.cancelConfirm
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/PluginRefreshToast.js
		/**
		* Display refresh failures even after navigation leaves the Plugins panel.
		* @param props - shared notice hook, dismissal action, and locale seat.
		* @returns the refresh failure toast, or null for other notices.
		*/
		function PluginRefreshToast({ usePluginManager, dismissNotice, t }) {
			const notice = usePluginManager((state) => state.notice);
			if (notice?.kind !== "refresh-failed") return null;
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: noticeText(notice, t),
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
				onDone: dismissNotice
			}, notice.seq);
		}
		//#endregion
		//#region lib/types/client/PluginsPanelIcon.js
		/**
		* Render the plugin glyph at the size the sidebar asks for.
		* @param props - the sidebar's icon share: the requested edge and whether the panel is selected.
		* @returns the icon element.
		*/
		function PluginsPanelIcon({ size }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPluginPinwheelOutlineRegular, { size });
		}
		//#endregion
		//#region lib/types/client/tab-ledger.js
		/** The tabs other plugins contribute to the Plugins page through `plugins.tab`, in the active locale. */
		/**
		* Project the `plugins.tab` ledger as one observable the page binds.
		* @param ctx - the page plugin's context, whose slot registry and locale the projection follows.
		* @returns the tab source; its snapshot changes only when the ledger or the locale does.
		*/
		function tabLedgerSource(ctx) {
			let version = -1;
			let revision = -1;
			let tabs = [];
			return {
				getSnapshot: () => {
					const next = ctx.slots.getVersion("plugins.tab");
					const current = ctx.locale.getSnapshot().revision;
					if (next !== version || current !== revision) {
						version = next;
						revision = current;
						tabs = ctx.slots.entries("plugins.tab").map((entry) => ({
							/* v8 ignore next -- list-slot registration requires id */
							id: entry.options.id ?? "",
							label: (0, _deepseek_ai_dsh_client_ui_slots.resolveSlotLabel)(entry.options.label) ?? ""
						}));
					}
					return tabs;
				},
				subscribe: (listener) => {
					const offs = [ctx.slots.subscribe("plugins.tab", listener), ctx.locale.subscribe(listener)];
					return () => {
						for (const off of offs) off();
					};
				}
			};
		}
		//#endregion
		//#region lib/types/client/navigation-store.js
		/** Plugin page selection shared by the page and cross-plugin navigation. */
		/**
		* Create plugin page selection before the first page render.
		* @returns the registration-owned navigation store handle.
		*/
		function createNavigationStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({
					view: { kind: "list" },
					tab: "installed"
				}),
				actions: {
					setView: (draft, view) => {
						draft.view = view;
					},
					setTab: (draft, tab) => {
						draft.tab = tab;
					}
				}
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "pluginManager";
		/** The id shared by the sidebar entry and the main panel it opens. */
		const PANEL_ID = "plugins";
		/** Services required by the sidebar registration and the Remote methods; the inventory says whether the Host manages a profile. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.pluginManager",
			"remote.pluginInventory",
			"remote.pluginRegistryProbe",
			"configForms",
			"layout"
		];
		/**
		* Contribute the Plugins entry to the sidebar with the management page it
		* opens, and keep it current on the Host's change events.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-plugin-manager: dictionaries");
			const t = ctx.locale.bind(NS);
			const controller = new PluginManagerController(ctx);
			ctx.effect(() => () => {
				controller.dispose();
			}, "ui-plugin-manager: controller");
			ctx.effect(() => {
				const refresh = () => {
					if (controller.getSnapshot().status !== "idle") controller.load();
				};
				const disposers = [
					ctx.remote.$on("plugin-manager/changed", refresh),
					ctx.remote.$on("plugin-manager/install-log", (chunk) => {
						controller.appendLog(chunk);
					}),
					ctx.remote.$on("plugin-manager/install-state", (progress) => {
						controller.installProgress(progress);
					}),
					ctx.on("connection/reset", refresh)
				];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-plugin-manager: host invalidations");
			const configLedger = configLedgerSource(ctx);
export {};
