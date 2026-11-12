/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-subagent",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-subagent/src/client/SubagentHeaderLineage.module.css.mjs
		const css$2 = ".ZKlsPq_root{align-items:center;gap:10px;min-width:0;display:inline-flex;position:relative}.ZKlsPq_switcherRoot{min-width:0;margin-left:6px}.ZKlsPq_trigger,.ZKlsPq_switcherTrigger{border-radius:var(--dsw-radius-sm);min-height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;align-items:center;padding:3px 2px;font-size:12px;line-height:18px;display:inline-flex}.ZKlsPq_trigger{gap:4px}.ZKlsPq_switcherTrigger{min-width:0;max-width:244px;color:var(--dsw-alias-label-primary);gap:4px;font-weight:500}.ZKlsPq_ancestorSwitcherTrigger{color:var(--dsw-alias-label-tertiary);font-weight:400}.ZKlsPq_switcherTitle{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.ZKlsPq_switcherTrigger svg{flex:none}.ZKlsPq_activitySlot{flex:none;justify-content:center;align-items:center;width:14px;height:14px;display:inline-flex}.ZKlsPq_trigger:hover,.ZKlsPq_trigger:focus-visible,.ZKlsPq_switcherTrigger:hover,.ZKlsPq_switcherTrigger:focus-visible{color:var(--dsw-alias-label-primary)}.ZKlsPq_ancestorSwitcherTrigger:hover,.ZKlsPq_ancestorSwitcherTrigger:focus-visible{color:var(--dsw-alias-label-tertiary)}.ZKlsPq_trigger svg,.ZKlsPq_switcherTrigger svg{transition:transform .12s}.ZKlsPq_triggerOpen{transform:rotate(180deg)}.ZKlsPq_menu{z-index:100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);width:336px;max-width:min(400px,100vw - 32px);max-height:min(560px,100vh - 140px);box-shadow:var(--dsw-elevation-prominent);flex-direction:column;padding:4px;display:flex;position:fixed;overflow:hidden}.ZKlsPq_menu:before{content:\"\";z-index:-1;border-radius:inherit;background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);position:absolute;inset:0}.ZKlsPq_menuBody{flex-direction:column;flex:auto;min-height:0;display:flex;overflow:auto}.ZKlsPq_node{min-width:0;position:relative}.ZKlsPq_menuBody>.ZKlsPq_node{margin-left:-2px}.ZKlsPq_row{box-sizing:border-box;border-radius:var(--dsw-radius-md);width:100%;min-height:44px;color:var(--dsw-alias-label-primary);text-align:left;cursor:pointer;background:0 0;border:0;outline:none;align-items:flex-start;gap:6px;padding:6px 7px 6px 9px;font-size:12px;line-height:17px;display:flex;position:relative}.ZKlsPq_row:hover>.ZKlsPq_clickarea,.ZKlsPq_row:focus-visible>.ZKlsPq_clickarea{background:var(--dsw-alias-interactive-bg-hover)}.ZKlsPq_clickarea{box-sizing:border-box;border-radius:var(--dsw-radius-md);flex:1;align-self:stretch;align-items:flex-start;gap:6px;min-width:0;margin:-6px -7px;padding:6px 7px;display:flex}.ZKlsPq_rowActivitySlot{flex:none;justify-content:center;align-items:center;width:14px;height:17px;display:inline-flex}.ZKlsPq_disclosure,.ZKlsPq_disclosureSpace{flex:none;width:14px;height:17px}.ZKlsPq_disclosure{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;justify-content:center;align-items:center;padding:0;transition:transform .12s;display:inline-flex}.ZKlsPq_disclosure svg{width:12px;height:12px}.ZKlsPq_disclosure:hover{color:var(--dsw-alias-label-primary)}.ZKlsPq_disclosureOpen{transform:rotate(90deg)}.ZKlsPq_content{flex-direction:column;flex:1;min-width:0;display:flex}.ZKlsPq_label,.ZKlsPq_summary{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.ZKlsPq_label{color:inherit;font-weight:400}.ZKlsPq_currentLabel{font-weight:600}.ZKlsPq_summary,.ZKlsPq_metrics{color:var(--dsw-alias-label-tertiary);font-size:10px;line-height:15px}.ZKlsPq_metrics{font-variant-numeric:tabular-nums;text-align:right;white-space:nowrap;flex:none;grid-template-rows:17px 15px;display:grid}.ZKlsPq_metricToken{grid-row:1;line-height:17px}.ZKlsPq_metricDuration{grid-row:2}.ZKlsPq_sidebarButton{border-radius:var(--dsw-radius-sm);width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:0;flex:none;justify-content:center;align-items:center;margin:4px 0;padding:6px;display:inline-flex}.ZKlsPq_sidebarButton:hover,.ZKlsPq_sidebarButton:focus-visible{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.ZKlsPq_children{margin-left:16px;padding-left:3px;position:relative}.ZKlsPq_children:before,.ZKlsPq_children>.ZKlsPq_node:before{content:\"\";border-left:.5px solid var(--dsw-alias-border-l2);position:absolute;left:0}.ZKlsPq_children:before{height:23px;top:-23px}.ZKlsPq_children[aria-busy=true]:before{content:none}.ZKlsPq_children>.ZKlsPq_node:before{top:0;bottom:0;left:-3px}.ZKlsPq_children>.ZKlsPq_node:last-child:before{height:15px;bottom:auto}.ZKlsPq_children>.ZKlsPq_node>.ZKlsPq_row:before{content:\"\";border-top:.5px solid var(--dsw-alias-border-l2);width:12px;position:absolute;top:14px;left:-3px}.ZKlsPq_notice,.ZKlsPq_error{color:var(--dsw-alias-label-tertiary);padding:8px 10px;font-size:11px;line-height:16px}.ZKlsPq_error{color:var(--dsw-alias-state-error-primary);justify-content:space-between;align-items:center;gap:10px;display:flex}.ZKlsPq_refresh{border-radius:var(--dsw-radius-sm);color:inherit;cursor:pointer;background:0 0;border:0;flex:none;align-items:center;gap:3px;padding:3px 5px;display:inline-flex}.ZKlsPq_refresh svg{width:12px;height:12px}.ZKlsPq_refresh:hover{background:var(--dsw-alias-interactive-bg-hover)}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-subagent/SubagentHeaderLineage.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-subagent";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var SubagentHeaderLineage_module_css_default = {
			"activitySlot": "ZKlsPq_activitySlot",
			"ancestorSwitcherTrigger": "ZKlsPq_ancestorSwitcherTrigger",
			"children": "ZKlsPq_children",
			"clickarea": "ZKlsPq_clickarea",
			"content": "ZKlsPq_content",
			"currentLabel": "ZKlsPq_currentLabel",
			"disclosure": "ZKlsPq_disclosure",
			"disclosureOpen": "ZKlsPq_disclosureOpen",
			"disclosureSpace": "ZKlsPq_disclosureSpace",
			"error": "ZKlsPq_error",
			"label": "ZKlsPq_label",
			"menu": "ZKlsPq_menu",
			"menuBody": "ZKlsPq_menuBody",
			"metricDuration": "ZKlsPq_metricDuration",
			"metricToken": "ZKlsPq_metricToken",
			"metrics": "ZKlsPq_metrics",
			"node": "ZKlsPq_node",
			"notice": "ZKlsPq_notice",
			"refresh": "ZKlsPq_refresh",
			"root": "ZKlsPq_root",
			"row": "ZKlsPq_row",
			"rowActivitySlot": "ZKlsPq_rowActivitySlot",
			"sidebarButton": "ZKlsPq_sidebarButton",
			"summary": "ZKlsPq_summary",
			"switcherRoot": "ZKlsPq_switcherRoot",
			"switcherTitle": "ZKlsPq_switcherTitle",
			"switcherTrigger": "ZKlsPq_switcherTrigger",
			"trigger": "ZKlsPq_trigger",
			"triggerOpen": "ZKlsPq_triggerOpen"
		};
		//#endregion
		//#region lib/types/client/SubagentHeaderLineage.js
		function treeItems(root) {
			return root === null ? [] : Array.from(root.querySelectorAll("[role=\"treeitem\"]:not([aria-disabled=\"true\"])"));
		}
		/** Compact token count shared in shape with the conversation stats strip. */
		function formatTokens(value, t) {
			const scaled = (next) => next >= 100 ? String(Math.round(next)) : String(Math.round(next * 10) / 10);
			if (value < 1e3) return String(value);
			if (value < 1e6) return t("tokens.thousand", { value: scaled(value / 1e3) });
			return t("tokens.million", { value: scaled(value / 1e6) });
		}
		/** Sum the four disjoint durable provider-usage buckets. */
		function tokenTotal(usage) {
			return usage === void 0 ? void 0 : usage.uncachedInputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
		}
		/** Exact whole-second active-turn duration for one catalog row. */
		function activityDuration(summary, activity, now) {
			if (summary === void 0) return void 0;
			const timing = summary.projectionValues?.subagentTiming;
			if (timing === void 0) return void 0;
			if (timing.active === void 0) return timing.settledMs;
			const end = activity === "running" ? now : timing.active.through;
			return timing.settledMs + Math.max(0, end - timing.active.since);
		}
		function splitDuration(ms) {
			const totalSeconds = Math.floor(Math.max(0, ms) / 1e3);
			const totalMinutes = Math.floor(totalSeconds / 60);
			const totalHours = Math.floor(totalMinutes / 60);
			return {
				seconds: totalSeconds % 60,
				minutes: totalMinutes % 60,
				hours: totalHours % 24,
				days: Math.floor(totalHours / 24),
				totalMinutes,
				totalHours
			};
		}
		/** Format a duration with decreasing visual precision at larger scales. */
		function formatDuration(ms, t) {
			const { seconds, minutes, hours, days, totalMinutes, totalHours } = splitDuration(ms);
			if (days >= 365) {
				const years = Math.floor(days / 365);
				const months = Math.floor(days % 365 / 30);
				return months === 0 ? t("duration.years", { years }) : t("duration.yearsMonths", {
					years,
					months
				});
			}
			if (days >= 30) {
				const months = Math.floor(days / 30);
				const remainingDays = days % 30;
				return remainingDays === 0 ? t("duration.months", { months }) : t("duration.monthsDays", {
					months,
					days: remainingDays
				});
			}
			if (days > 0) return hours === 0 ? t("duration.days", { days }) : t("duration.daysHours", {
				days,
				hours
			});
			if (totalHours > 0) return t("duration.hours", {
				hours: totalHours,
				minutes: String(minutes).padStart(2, "0"),
				seconds: String(seconds).padStart(2, "0")
			});
			if (totalMinutes > 0) return t("duration.minutes", {
				minutes: totalMinutes,
				seconds: String(seconds).padStart(2, "0")
			});
			return t("duration.seconds", { seconds });
		}
		/** Preserve exact whole seconds for hover and accessible naming. */
		function formatExactDuration(ms, t) {
			const { seconds, minutes, hours, days } = splitDuration(ms);
			return days === 0 ? formatDuration(ms, t) : t("duration.exactDays", {
				days,
				hours: String(hours).padStart(2, "0"),
				minutes: String(minutes).padStart(2, "0"),
				seconds: String(seconds).padStart(2, "0")
			});
		}
		function SubagentSwitcherIcon() {
			return (0, react_jsx_runtime.jsxs)("svg", {
				width: "16",
				height: "16",
				viewBox: "0 0 20 20",
				fill: "none",
				"aria-hidden": "true",
				children: [(0, react_jsx_runtime.jsx)("path", {
					d: "M5.99951 12.7L8.95546 14.9478C9.40011 15.2859 9.62244 15.455 9.87526 15.488C9.95774 15.4988 10.0413 15.4988 10.1238 15.488C10.3766 15.455 10.5989 15.2859 11.0436 14.9478L13.9995 12.7",
					stroke: "currentColor",
					strokeWidth: "1.5"
				}), (0, react_jsx_runtime.jsx)("path", {
					d: "M13.9995 7.7417L11.0436 5.49387C10.5989 5.15574 10.3766 4.98668 10.1238 4.95362C10.0413 4.94283 9.95775 4.94283 9.87527 4.95362C9.62245 4.98668 9.40012 5.15574 8.95547 5.49387L5.99952 7.7417",
					stroke: "currentColor",
					strokeWidth: "1.5"
				})]
			});
		}
		/** Render catalog loading without inventing child membership. */
		function CatalogLoadingRows({ t }) {
			return (0, react_jsx_runtime.jsx)("div", {
				className: SubagentHeaderLineage_module_css_default.notice,
				children: t("loading.label")
			});
		}
		/** A child becomes a known leaf only after its own authoritative catalog loads empty. */
		function isKnownLeaf(catalog) {
			return catalog?.state === "ready" && catalog.entries.length === 0;
		}
		/** Render one catalog level and recurse only through explicitly expanded rows. */
		function CatalogRows({ parentSessionId, currentSessionId, catalog, catalogs, summaries, expanded, level, openChild, openChildAside, refreshProjection, toggleBranch, closeCatalog, t }) {
			const [now, setNow] = (0, react.useState)(() => Date.now());
			const running = catalog.entries.some((entry) => entry.activity === "running");
			(0, react.useEffect)(() => {
				if (!running) return;
				const timer = setInterval(() => {
					setNow(Date.now());
				}, 1e3);
				return () => {
					clearInterval(timer);
				};
			}, [running]);
			const emptyLoading = catalog.state === "loading" && catalog.entries.length === 0;
			const reserveDisclosure = catalog.entries.some((entry) => entry.mode !== "external" && !isKnownLeaf(catalogs[entry.id]) && summaries[entry.id]?.formatStatus !== "migration-required" && catalogs[entry.id]?.state !== "migration-required");
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				emptyLoading && (0, react_jsx_runtime.jsx)(CatalogLoadingRows, { t }),
				catalog.state === "error" && (0, react_jsx_runtime.jsxs)("div", {
					className: SubagentHeaderLineage_module_css_default.error,
					children: [(0, react_jsx_runtime.jsx)("span", { children: catalog.error?.message ?? t("load.error") }), (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: SubagentHeaderLineage_module_css_default.refresh,
						onClick: () => {
							refreshProjection(parentSessionId);
						},
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 }), t("retry")]
					})]
				}),
				catalog.entries.map((entry) => {
					const external = entry.mode === "external";
					const childCatalog = catalogs[entry.id];
					const isCurrent = entry.id === currentSessionId;
					const knownLeaf = external || isKnownLeaf(childCatalog);
					const requiresOpening = summaries[entry.id]?.formatStatus === "migration-required" || childCatalog?.state === "migration-required";
					const canExpand = !knownLeaf && !requiresOpening;
					const isExpanded = canExpand && expanded.has(entry.id);
					const childLoading = childCatalog === void 0 || childCatalog.state === "loading" && childCatalog.entries.length === 0;
					const summary = summaries[entry.id];
					const label = entry.label ?? entry.id;
					const mode = external ? t("mode.external") : entry.mode === "unknown" ? t("mode.unknown") : entry.mode === "one-shot" ? t("mode.oneShot") : t("mode.continuable");
					const completed = !external && entry.activity === "inactive" && summary?.projectionValues?.subagentTiming?.lastTurnCompleted === true;
					const activity = external ? void 0 : entry.activity === "running" ? t("activity.running") : completed ? t("activity.completed") : t("activity.inactive");
					const secondary = [
						summary?.title,
						requiresOpening ? t("catalog.migrationRequired") : mode,
						activity
					].filter((value) => value !== void 0).join(" · ");
					const totalTokens = tokenTotal(summary?.projectionValues?.tokenUsage);
					const durationMs = activityDuration(summary, entry.activity, now);
					const tokenMetric = totalTokens === void 0 ? void 0 : t("tokens.total", { value: formatTokens(totalTokens, t) });
					const durationMetric = durationMs === void 0 ? void 0 : {
						compact: formatDuration(durationMs, t),
						exact: formatExactDuration(durationMs, t)
					};
					const metrics = [tokenMetric, durationMetric?.exact].filter((value) => value !== void 0).join(" · ");
					const open = () => {
						if (external) return;
						openChild({
							parentSessionId,
							childSessionId: entry.id,
							mode: entry.mode
						});
						closeCatalog();
					};
					const handleKey = (event) => {
						if (event.key === "Enter" || event.key === " ") {
							event.preventDefault();
							event.stopPropagation();
							open();
						} else if (event.key === "ArrowRight" && canExpand && !isExpanded || event.key === "ArrowLeft" && isExpanded) {
							event.preventDefault();
							event.stopPropagation();
							toggleBranch(entry.id);
						}
					};
					const toggle = (event) => {
						event.preventDefault();
						event.stopPropagation();
						toggleBranch(entry.id);
					};
					return (0, react_jsx_runtime.jsxs)("div", {
						className: SubagentHeaderLineage_module_css_default.node,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							role: "treeitem",
							tabIndex: external ? -1 : 0,
							"aria-disabled": external || void 0,
							"aria-level": level,
							"aria-current": isCurrent || void 0,
							"aria-label": [
								label,
								secondary,
								metrics
							].filter((value) => value !== "").join(" "),
							...canExpand ? { "aria-expanded": isExpanded } : {},
							className: SubagentHeaderLineage_module_css_default.row,
							onClick: open,
							onKeyDown: handleKey,
							children: [!canExpand ? reserveDisclosure && (0, react_jsx_runtime.jsx)("span", { className: SubagentHeaderLineage_module_css_default.disclosureSpace }) : (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								tabIndex: -1,
								className: `${SubagentHeaderLineage_module_css_default.disclosure} ${isExpanded ? SubagentHeaderLineage_module_css_default.disclosureOpen : ""}`,
								"aria-label": t(isExpanded ? "branch.collapse" : "branch.expand", { label }),
								onClick: toggle,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
							}), (0, react_jsx_runtime.jsxs)("div", {
								className: SubagentHeaderLineage_module_css_default.clickarea,
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: SubagentHeaderLineage_module_css_default.rowActivitySlot,
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: entry.activity === "running" ? "ongoing" : completed ? "done" : "idle" })
									}),
									(0, react_jsx_runtime.jsxs)("span", {
										className: SubagentHeaderLineage_module_css_default.content,
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: `${SubagentHeaderLineage_module_css_default.label} ${isCurrent ? SubagentHeaderLineage_module_css_default.currentLabel : ""}`,
											children: label
										}), (0, react_jsx_runtime.jsx)("span", {
											className: SubagentHeaderLineage_module_css_default.summary,
											children: secondary
										})]
									}),
									metrics !== "" && (0, react_jsx_runtime.jsxs)("span", {
										className: SubagentHeaderLineage_module_css_default.metrics,
										children: [tokenMetric !== void 0 && (0, react_jsx_runtime.jsx)("span", {
											className: SubagentHeaderLineage_module_css_default.metricToken,
											children: tokenMetric
										}), durationMetric !== void 0 && (0, react_jsx_runtime.jsx)("span", {
											className: SubagentHeaderLineage_module_css_default.metricDuration,
											title: t("duration.exactTitle", { duration: durationMetric.exact }),
											children: durationMetric.compact
										})]
									}),
									!isCurrent && !external && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
										label: t("open.sidebar"),
										side: "bottom",
										align: "end",
										children: (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: SubagentHeaderLineage_module_css_default.sidebarButton,
											"aria-label": t("open.sidebar.aria", { label }),
											onClick: (event) => {
												event.preventDefault();
												event.stopPropagation();
												openChildAside({
													parentSessionId,
													childSessionId: entry.id,
													mode: entry.mode
												});
												closeCatalog();
											},
											onKeyDown: (event) => {
												event.stopPropagation();
											},
											children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
										})
									})
								]
							})]
						}), isExpanded && (0, react_jsx_runtime.jsx)("div", {
							role: "group",
							className: SubagentHeaderLineage_module_css_default.children,
							"aria-busy": childLoading || void 0,
							children: childCatalog === void 0 ? (0, react_jsx_runtime.jsx)(CatalogLoadingRows, { t }) : (0, react_jsx_runtime.jsx)(CatalogRows, {
								parentSessionId: entry.id,
								currentSessionId,
								catalog: childCatalog,
								catalogs,
								summaries,
								expanded,
								level: level + 1,
								openChild,
								openChildAside,
								refreshProjection,
								toggleBranch,
								closeCatalog,
								t
							})
						})]
					}, entry.id);
				})
			] });
		}
		const MENU_VIEWPORT_MARGIN = 16;
		/** Place a portaled catalog below its trigger without crossing the viewport edge. */
		function catalogMenuPosition(trigger) {
			const rect = trigger.getBoundingClientRect();
			const width = Math.min(336, window.innerWidth - MENU_VIEWPORT_MARGIN * 2);
			return {
				top: rect.bottom + 5,
				left: Math.min(Math.max(MENU_VIEWPORT_MARGIN, rect.left), window.innerWidth - width - MENU_VIEWPORT_MARGIN)
			};
		}
		/** One trigger-plus-tree dropdown over the catalog rooted at `rootSessionId`. */
		function CatalogDropdown({ rootSessionId, currentSessionId, displayTitle, openTitle, variant, useSessions, useSessionStatus, openChild, openChildAside, refreshProjection, t }) {
			const ancestorSwitcher = variant === "switcher" && openTitle !== void 0;
			const projections = useSessions((state) => state.projectionsBySession);
			const summaries = useSessions((state) => state.byId);
			const statuses = useSessionStatus((value) => value);
			const catalogs = (0, react.useMemo)(() => {
				return Object.fromEntries(Object.entries(projections).map(([id, snapshot]) => {
					const projected = snapshot.values.subagentCatalog;
					return [id, {
						state: snapshot.state === "idle" ? projected === void 0 ? "loading" : "ready" : snapshot.state === "migration-required" && projected !== void 0 ? "ready" : snapshot.state,
						error: snapshot.error,
						entries: (projected ?? []).map((entry) => ({
							...entry,
							activity: (statuses.get(entry.id)?.running ?? summaries[entry.id]?.running) === true ? "running" : "inactive"
						}))
					}];
				}));
			}, [
				projections,
				summaries,
				statuses
			]);
			const catalog = catalogs[rootSessionId];
			const [open, setOpen] = (0, react.useState)(false);
			const [menuPosition, setMenuPosition] = (0, react.useState)();
			const [expanded, setExpanded] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const rootRef = (0, react.useRef)(null);
			const triggerRef = (0, react.useRef)(null);
			const menuRef = (0, react.useRef)(null);
			const hoverOpenTimer = (0, react.useRef)(void 0);
			const hoverCloseTimer = (0, react.useRef)(void 0);
			const pinnedRef = (0, react.useRef)(false);
			const currentEntry = currentSessionId === void 0 ? void 0 : projections[rootSessionId]?.values.subagentCatalog?.find((entry) => entry.id === currentSessionId);
			const switcherDisplayTitle = currentEntry !== void 0 ? currentEntry.label ?? currentEntry.id : displayTitle;
			const directChildren = catalog?.entries ?? [];
			const directCount = directChildren.length;
			const runningCount = directChildren.filter((entry) => entry.activity === "running").length;
			const totalCountKey = directCount === 1 ? "count.total.one" : "count.total.other";
			const runningCountKey = runningCount === 1 ? "count.running.one" : "count.running.other";
			const presentedCatalog = catalog ?? (variant === "switcher" ? {
				entries: [],
				state: "loading",
				error: null
			} : void 0);
			const cancelHoverClose = () => {
export {};
