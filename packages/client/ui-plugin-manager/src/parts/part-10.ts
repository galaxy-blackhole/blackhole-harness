/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutlineMedium, { "aria-hidden": "true" }), (0, react_jsx_runtime.jsx)("span", { children: t(install.confirmed !== void 0 ? "cancel" : pending ? "installCancelAndEdit" : "installEdit") })]
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: PluginManagerPage_module_css_default.wizardClose,
							"aria-label": t(cancellable ? "installCloseCancels" : "close"),
							onClick: onClose,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineMedium, { size: 14 })
						})]
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.wizardScroll,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: PluginManagerPage_module_css_default.wizardHero,
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: PluginManagerPage_module_css_default.wizardIcon,
										"data-state": pending ? "ongoing" : phase === "done" ? "done" : "error",
										"aria-hidden": "true",
										children: pending ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
											state: "ongoing",
											size: 28
										}) : phase === "done" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckCircleFillRegular, { size: 28 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, { size: 28 })
									}),
									(0, react_jsx_runtime.jsx)("h2", {
										className: PluginManagerPage_module_css_default.wizardTitle,
										role: phase === "failed" ? "alert" : "status",
										children: heading
									}),
									phase === "failed" ? (0, react_jsx_runtime.jsx)("p", {
										className: PluginManagerPage_module_css_default.wizardSub,
										children: failureText(install.failure, t, install)
									}) : null,
									attemptLine === null ? null : (0, react_jsx_runtime.jsx)("p", {
										className: PluginManagerPage_module_css_default.wizardSub,
										children: attemptLine
									}),
									uncertaintyText === null ? null : (0, react_jsx_runtime.jsx)("p", {
										className: PluginManagerPage_module_css_default.wizardSub,
										role: "alert",
										children: uncertaintyText
									}),
									phase === "unknown" ? (0, react_jsx_runtime.jsx)("p", {
										className: PluginManagerPage_module_css_default.wizardSub,
										children: t("installUnknownDescription")
									}) : null
								]
							}),
							subject === null ? null : (0, react_jsx_runtime.jsx)(SubjectCard, {
								subject: phase === "done" && install.installedVersion !== null ? {
									...subject,
									version: install.installedVersion
								} : subject,
								confirmed: install.confirmed,
								t
							}),
							approvable ? (0, react_jsx_runtime.jsxs)("section", {
								className: PluginManagerPage_module_css_default.approval,
								role: "group",
								"aria-labelledby": approvalId,
								"data-install-approval": true,
								children: [
									(0, react_jsx_runtime.jsx)("h3", {
										id: approvalId,
										className: PluginManagerPage_module_css_default.approvalTitle,
										children: t("installApprovalTitle")
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: PluginManagerPage_module_css_default.approvalText,
										children: t("installApprovalDescription")
									}),
									(0, react_jsx_runtime.jsx)("ul", {
										className: PluginManagerPage_module_css_default.approvalList,
										children: pendingBuilds.map((name) => (0, react_jsx_runtime.jsx)("li", { children: (0, react_jsx_runtime.jsx)("code", { children: name }) }, name))
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: PluginManagerPage_module_css_default.approvalText,
										children: t("installApprovalConsequence")
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: PluginManagerPage_module_css_default.approvalCaution,
										children: t("installApprovalCaution")
									}),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										className: PluginManagerPage_module_css_default.wide,
										onClick: onApproveBuilds,
										children: t("installApproveAndRetry")
									})
								]
							}) : null,
							phase === "done" && install.installed === null ? (0, react_jsx_runtime.jsx)("p", {
								className: PluginManagerPage_module_css_default.result,
								role: "status",
								children: t("installDoneNothing")
							}) : null,
							phase === "done" && install.restartRequired ? (0, react_jsx_runtime.jsx)("p", {
								className: PluginManagerPage_module_css_default.resultWarn,
								role: "status",
								children: restartText("installDoneRestart", install.restartReason, t)
							}) : null,
							phase === "done" && subject?.kind === "registry" && subject.name !== void 0 && subject.version !== void 0 && install.installedVersion !== null && install.installedVersion !== subject.version && (install.attempts?.registries.length ?? 1) === 1 ? (0, react_jsx_runtime.jsx)("p", {
								className: PluginManagerPage_module_css_default.resultWarn,
								role: "status",
								children: t("installDoneOtherVersion", {
									installed: install.installedVersion,
									version: subject.version,
									exact: `${subject.name}@${subject.version}`
								})
							}) : null,
							phase === "done" && install.approvedBuilds.length > 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: PluginManagerPage_module_css_default.result,
								role: "status",
								children: t("installDoneApproved", { names: install.approvedBuilds.join(", ") })
							}) : null,
							(0, react_jsx_runtime.jsxs)("div", {
								className: PluginManagerPage_module_css_default.wizardFoot,
								children: [
									(0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: PluginManagerPage_module_css_default.detailsToggle,
										"aria-expanded": install.detailsOpen,
										onClick: onToggleDetails,
										children: [(0, react_jsx_runtime.jsx)("span", { children: t(install.detailsOpen ? "installDetailsHide" : "installDetailsShow") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
											className: PluginManagerPage_module_css_default.detailsChevron,
											"aria-hidden": "true"
										})]
									}),
									uncertainty === "result" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										className: PluginManagerPage_module_css_default.footAction,
										onClick: onReconcile,
										children: t("installReconcile")
									}) : null,
									pending ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										size: "sm",
										className: PluginManagerPage_module_css_default.footAction,
										disabled: !cancellable,
										onClick: onCancel,
										children: t(phase === "cancelling" ? "installCancelling" : "installCancel")
									}) : null,
									phase === "failed" && !approvable ? (0, react_jsx_runtime.jsxs)("span", {
										className: PluginManagerPage_module_css_default.wizardActions,
										children: [changeable ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											size: "sm",
											className: PluginManagerPage_module_css_default.footAction,
											onClick: onChangeRegistry,
											children: t("installChangeRegistry")
										}) : null, (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "primary",
											size: "sm",
											className: PluginManagerPage_module_css_default.footAction,
											onClick: onRun,
											children: t("installRetry")
										})]
									}) : null
								]
							}),
							install.detailsOpen ? (0, react_jsx_runtime.jsxs)("div", {
								className: PluginManagerPage_module_css_default.detailsBody,
								children: [(0, react_jsx_runtime.jsx)("p", {
									className: PluginManagerPage_module_css_default.installLocation,
									children: firstRun === void 0 ? t("terminalNoOutput") : t("installLocation", { dir: firstRun.cwd })
								}), install.runs.map((run, index) => {
									const registry = asked?.registries[index];
									return (0, react_jsx_runtime.jsxs)("div", {
										className: PluginManagerPage_module_css_default.run,
										children: [registry === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
											className: PluginManagerPage_module_css_default.attemptBadge,
											children: t("installAttemptBadge", {
												index: String(index + 1),
												registry: registryText(registry, t, resolved).name
											})
										}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.TerminalBlock, {
											command: run.command,
											output: run.output,
											running: run.exitCode === void 0,
											exitCode: run.exitCode,
											maxLines: INSTALL_TERMINAL_LINES,
											labels: {
												...terminalLabels(t),
												...phase === "cancelling" ? { failed: t("installCancelledShort") } : {}
											},
											className: PluginManagerPage_module_css_default.terminal
										})]
									}, run.jobId);
								})]
							}) : null,
							phase !== "done" ? null : install.installed !== null && install.subject?.selection === void 0 ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								className: PluginManagerPage_module_css_default.wide,
								disabled: install.enabling,
								"aria-busy": install.enabling,
								onClick: onEnableNow,
								children: t("installEnableNow")
							}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "primary",
								className: PluginManagerPage_module_css_default.wide,
								onClick: onClose,
								children: t("installClose")
							})
						]
					})]
				})
			});
		}
		/** The confirmation an uninstall waits on. */
		function ConfirmDialog({ name, t, onConfirm, onCancel }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose: onCancel,
				title: t("confirmUninstallTitle", { name }),
				closeLabel: t("close"),
				description: t("confirmUninstallDescription"),
				footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					onClick: onCancel,
					children: t("cancel")
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					className: PluginManagerPage_module_css_default.dangerButton,
					onClick: onConfirm,
					children: t("confirmUninstall")
				})] })
			});
		}
		/** Render the plugin manager: the official plugins and installed bundles, their pages, the install dialog, and the confirmation. */
		function PluginManagerPage(props) {
			const { t, ensure, renderSlot, resolveText } = props;
			const configurations = props.useConfigurations((snapshot) => snapshot.view?.namespaces);
			const formFor = (id) => {
				if (!configurations?.some((view) => view.ns === id)) return void 0;
				const form = props.configForm(id);
				return {
					state: form.getSnapshot(),
					mutate: (ops, revision) => form.mutate(ops, revision)
				};
			};
			const state = props.usePluginManager((snapshot) => snapshot);
			const ledger = props.useConfigLedger((snapshot) => snapshot);
			const view = props.useStore((state) => state.view), { setView, setTab } = props.actions;
			const tabs = props.usePluginTabs((snapshot) => snapshot);
			const selectedTab = props.useStore((state) => state.tab);
			const tab = tabs.some((item) => item.id === selectedTab) ? selectedTab : INSTALLED_TAB;
			(0, react.useEffect)(() => {
				if (tab !== selectedTab) setTab(tab);
			}, [
				tab,
				selectedTab,
				setTab
			]);
			(0, react.useEffect)(() => {
				if (state.highlight !== null) setTab(INSTALLED_TAB);
			}, [state.highlight, setTab]);
			const tabsId = (0, react.useId)();
			const [activation, setActivation] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				ensure();
			}, [ensure]);
			const { highlight, clearHighlight } = {
				highlight: state.highlight,
				clearHighlight: props.clearHighlight
			};
			(0, react.useEffect)(() => {
				if (highlight === null) return;
				const card = document.querySelector(`[data-plugin-package="${highlight}"]`);
				if (card !== null && typeof card.scrollIntoView === "function") card.scrollIntoView({
					block: "center",
					behavior: "smooth"
				});
				const timer = setTimeout(clearHighlight, HIGHLIGHT_MS);
				return () => {
					clearTimeout(timer);
				};
			}, [highlight, clearHighlight]);
			const noticeLine = state.notice === null || state.notice.kind === "refresh-failed" ? null : noticeText(state.notice, t);
			const listed = state.packages.filter((pkg) => !BUILTIN_PROFILE_BUNDLES.has(pkg.name) && (pkg.installed || pkg.official || pkg.error !== void 0));
			const mine = listed.filter((pkg) => !pkg.official);
			const official = listed.filter((pkg) => pkg.official);
			const ordered = orderOptionalBundles(official);
			const pinned = new Set(official.filter(pinnedToMainList).map((pkg) => pkg.name));
			const extensions = ordered.filter((pkg) => pinned.has(pkg.name));
			const more = ordered;
			const loaded = state.status === "ready" || state.status === "error";
			const refreshing = state.refreshStatus === "refreshing";
			const openPkg = view.kind === "package" || view.kind === "row" ? listed.find((pkg) => pkg.name === view.name) : void 0;
			const openItem = view.kind === "item" ? ledger.items.find((item) => item.id === view.id) : void 0;
			const openRow = view.kind === "row" && openPkg !== void 0 ? openPkg.rows.find((row) => row.rowId === view.rowId) : void 0;
			const onInstalled = tab === INSTALLED_TAB;
			const showsCards = !onInstalled || openPkg === void 0 && openItem === void 0;
			const detailFromMore = (view.kind === "package" || view.kind === "row") && (view.from === "more" || MORE_BUNDLES.includes(view.name) && !pinned.has(view.name));
			const showsMoreList = onInstalled && showsCards && (view.kind === "more" || detailFromMore);
			const showsMainList = showsCards && !showsMoreList;
			const installedCards = onInstalled && showsCards;
			const openPkgInMore = openPkg !== void 0 && openPkg.official && detailFromMore;
			const installedPanel = tabs.length === 0 || showsMoreList ? {} : {
				role: "tabpanel",
				id: `${tabsId}-${INSTALLED_TAB}-panel`,
				"aria-labelledby": `${tabsId}-${INSTALLED_TAB}`
			};
			const activated = listed.find((pkg) => pkg.name === activation && pkg.enabled && !state.busy.includes(pkg.name));
			const setRowEnabled = (row, enabled) => {
				/* v8 ignore next -- a row without a live entry has its switch disabled */
				if (row.entryId !== void 0) props.setRowEnabled(row.entryId, enabled);
			};
			const configure = (pkg) => ({
				has: (row) => ledger.rows.has(rowConfigKey(pkg.name, row.rowId)),
				open: (row) => {
					setView({
						kind: "row",
						name: pkg.name,
						rowId: row.rowId,
						...openPkgInMore ? { from: "more" } : {}
					});
				}
			});
			const packageBusy = (pkg) => state.busy.includes(pkg.name) || state.install.subject?.name === pkg.name && (isInstallPending(state.install.phase) || state.install.phase === "checking");
			const packageCard = (pkg) => (0, react_jsx_runtime.jsx)(PackageCard, {
				pkg,
				t,
				resolveText,
				busy: packageBusy(pkg),
				highlighted: state.highlight === pkg.name,
				onOpen: () => {
					setActivation(null);
					setView({
						kind: "package",
						name: pkg.name,
						...showsMoreList ? { from: "more" } : {}
					});
				},
				onSetEnabled: (enabled) => {
					setActivation(enabled ? pkg.name : null);
					props.setEnabled(pkg.name, enabled);
				}
			}, pkg.name);
			const basicCards = ledger.items.map((item) => (0, react_jsx_runtime.jsx)(ItemCard, {
				item,
				t,
				renderSlot,
				onOpen: () => {
					setView({
						kind: "item",
						id: item.id
					});
				}
			}, `item:${item.id}`));
			const renderGroup = (id, heading, cards) => {
				const offersMore = id === "extensions" && more.length > 0;
				if (cards.length === 0 && !offersMore) return null;
				return (0, react_jsx_runtime.jsxs)("section", {
					className: PluginManagerPage_module_css_default.group,
					"data-plugin-scope": "global",
					"data-plugin-group": id,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.groupHead,
						children: [(0, react_jsx_runtime.jsx)("h3", {
							className: PluginManagerPage_module_css_default.groupTitle,
							children: heading
						}), offersMore ? (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							className: PluginManagerPage_module_css_default.groupMore,
							onClick: () => {
								setView({ kind: "more" });
							},
							children: [t("moreAction"), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
								size: 14,
								"aria-hidden": "true"
							})]
						}) : null]
					}), cards.length > 0 ? (0, react_jsx_runtime.jsx)("ul", {
						className: PluginManagerPage_module_css_default.cards,
						children: cards
					}) : null]
				});
			};
			return (0, react_jsx_runtime.jsxs)("section", {
				className: PluginManagerPage_module_css_default.page,
				"data-plugin-panel": true,
				"aria-busy": state.status === "loading" || refreshing,
				children: [
					showsMainList ? (0, react_jsx_runtime.jsxs)("header", {
						className: PluginManagerPage_module_css_default.pageHead,
						"data-window-drag": true,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: PluginManagerPage_module_css_default.pageHeading,
							children: [(0, react_jsx_runtime.jsx)("h1", {
								className: PluginManagerPage_module_css_default.pageTitle,
								children: t("title")
							}), (0, react_jsx_runtime.jsxs)("div", {
								className: PluginManagerPage_module_css_default.pageIntro,
								children: [(0, react_jsx_runtime.jsx)("span", { children: t("intro") }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t("infoDescription"),
									side: "bottom",
									delayMs: 300,
									maxWidth: 300,
									portal: true,
									openOnClick: true,
export {};
