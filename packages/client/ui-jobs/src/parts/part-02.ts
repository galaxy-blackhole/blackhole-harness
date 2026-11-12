/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					setKillPhase((current) => current?.key === key && !ok ? {
						key,
						state: "failed"
					} : current);
				});
			};
			if (visibleCount === 0) return null;
			const countLabel = t(liveRows.length > 0 ? liveRows.length === 1 ? "count.live.one" : "count.live.other" : visibleCount === 1 ? "count.idle.one" : "count.idle.other", { count: liveRows.length > 0 ? liveRows.length : visibleCount });
			const clearSettled = () => {
				setClearedKeys((current) => {
					const next = new Set(current);
					for (const job of settledRows) next.add(String(job.id));
					return next;
				});
				if (expandedKey !== void 0 && settledRows.some((job) => String(job.id) === expandedKey)) setExpandedKey(void 0);
			};
			const onKeyDown = (event) => {
				if (!open) return;
				const trigger = triggerRef.current;
				if (event.key === "Escape") {
					event.preventDefault();
					setOpen(false);
					trigger?.focus();
					return;
				}
				const menu = menuRef.current;
				/* v8 ignore next -- both refs are attached while the open list renders. */
				if (event.key !== "Tab" || trigger === null || menu === null) return;
				const focusable = [...menu.querySelectorAll(FOCUSABLE)];
				if (event.target === trigger) {
					if (event.shiftKey) return;
					event.preventDefault();
					focusable[0]?.focus();
				} else if (event.shiftKey ? event.target === focusable[0] : event.target === focusable.at(-1)) {
					if (event.shiftKey) event.preventDefault();
					trigger.focus();
				}
			};
			const item = (job) => (0, react_jsx_runtime.jsx)(JobItem, {
				job,
				view: isObservable(job) ? observedViews[String(job.id)] : void 0,
				expanded: expandedKey === String(job.id),
				now,
				onToggle: () => {
					setExpandedKey((current) => current === String(job.id) ? void 0 : String(job.id));
				},
				...job.status === "running" ? { kill: {
					state: killPhase?.key === String(job.id) ? killPhase.state : "idle",
					onPress: () => {
						pressKill(job);
					}
				} } : {},
				t
			}, String(job.id));
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				onKeyDown,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					ref: triggerRef,
					type: "button",
					className: JobListAction_module_css_default.trigger,
					"aria-expanded": open,
					"aria-label": countLabel,
					onClick: () => {
						setNow(Date.now());
						setOpen((current) => !current);
					},
					children: [
						liveRows.length > 0 ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, {
							state: "ongoing",
							className: JobListAction_module_css_default.triggerDot
						}) : null,
						(0, react_jsx_runtime.jsx)("span", {
							className: JobListAction_module_css_default.count,
							children: countLabel
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
							size: 12,
							className: open ? JobListAction_module_css_default.triggerOpen : void 0
						})
					]
				}), open ? (0, react_dom.createPortal)((0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuSurface, {
					ref: menuRef,
					className: JobListAction_module_css_default.menu,
					style: menuPosition ?? MEASURE_STYLE,
					children: (0, react_jsx_runtime.jsxs)("ul", {
						className: JobListAction_module_css_default.menuBody,
						"aria-label": t("list.aria"),
						children: [
							liveRows.length > 0 ? (0, react_jsx_runtime.jsx)("li", {
								className: JobListAction_module_css_default.sectionHeader,
								"aria-hidden": "true",
								children: t("section.live")
							}) : null,
							liveRows.map(item),
							settledRows.length > 0 ? (0, react_jsx_runtime.jsxs)("li", {
								className: JobListAction_module_css_default.sectionHeader,
								children: [(0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: JobListAction_module_css_default.sectionToggle,
									"aria-expanded": settledExpanded,
									onClick: () => {
										setSettledOpen(!settledExpanded);
									},
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
										size: 12,
										className: settledExpanded ? `${JobListAction_module_css_default.sectionChevron} ${JobListAction_module_css_default.sectionChevronOpen}` : JobListAction_module_css_default.sectionChevron
									}), t("section.settledCount", { count: settledRows.length })]
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: JobListAction_module_css_default.sectionClear,
									onClick: clearSettled,
									children: t("section.clear")
								})]
							}) : null,
							settledExpanded ? settledRows.map(item) : null
						]
					})
				}), document.body) : null]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"count.live.one": "{count} 个后台任务运行中",
			"count.live.other": "{count} 个后台任务运行中",
			"count.idle.one": "{count} 个后台任务",
			"count.idle.other": "{count} 个后台任务",
			"list.aria": "后台任务",
			"section.live": "进行中",
			"section.settledCount": "已结束 {count}",
			"section.clear": "清空",
			"row.expandAria": "展开 {label} 的实时输出",
			"row.collapseAria": "收起 {label} 的实时输出",
			"kill.stop": "停止任务 {label}",
			"kill.confirm": "再次点击确认停止",
			"kill.confirmAction": "确认停止",
			"kill.failed": "停止失败",
			"status.running": "运行中",
			"status.stopping": "正在停止",
			"status.completed": "已完成",
			"status.killed": "已取消",
			"status.failed": "已失败",
			"duration.seconds": "{seconds}秒",
			"duration.minutes": "{minutes}分{seconds}秒",
			"duration.hours": "{hours}小时{minutes}分",
			"duration.title.live": "已运行 {duration}",
			"duration.title.done": "耗时 {duration}",
			"output.gap": "……较早的输出已丢弃……",
			"output.error": "实时输出流中断：{error}",
			"terminal.signal": "信号 {signal}",
			"terminal.exitCode": "退出码 {code}",
			"terminal.noExitCode": "未正常退出",
			"terminal.commandLine": "命令第 {n} 行",
			"terminal.running": "运行中",
			"terminal.failed": "已失败",
			"terminal.done": "已完成",
			"terminal.copy": "复制",
			"terminal.copied": "已复制",
			"terminal.noOutput": "（无输出）",
			"terminal.collapse": "收起",
			"terminal.collapseAria": "收起输出",
			"terminal.expand": "展开其余 {n} 行",
			"terminal.expandAria": "展开被折叠的 {n} 行输出"
		};
		/** English dictionary, key-identical to the Chinese source of truth. */
		const en = {
			"count.live.one": "{count} background job running",
			"count.live.other": "{count} background jobs running",
			"count.idle.one": "{count} background job",
			"count.idle.other": "{count} background jobs",
			"list.aria": "Background jobs",
			"section.live": "Running",
			"section.settledCount": "Finished {count}",
			"section.clear": "Clear",
			"row.expandAria": "Show live output of {label}",
			"row.collapseAria": "Hide live output of {label}",
			"kill.stop": "Stop task {label}",
			"kill.confirm": "Click again to confirm",
			"kill.confirmAction": "Confirm stop",
			"kill.failed": "Stop failed",
			"status.running": "running",
			"status.stopping": "stopping",
			"status.completed": "completed",
			"status.killed": "cancelled",
			"status.failed": "failed",
			"duration.seconds": "{seconds}s",
			"duration.minutes": "{minutes}m {seconds}s",
			"duration.hours": "{hours}h {minutes}m",
			"duration.title.live": "Running for {duration}",
			"duration.title.done": "Took {duration}",
			"output.gap": "… earlier output dropped …",
			"output.error": "live output stream interrupted: {error}",
			"terminal.signal": "signal {signal}",
			"terminal.exitCode": "exit {code}",
			"terminal.noExitCode": "no exit code",
			"terminal.commandLine": "Command line {n}",
			"terminal.running": "running",
			"terminal.failed": "failed",
			"terminal.done": "done",
			"terminal.copy": "Copy",
			"terminal.copied": "Copied",
			"terminal.noOutput": "(no output)",
			"terminal.collapse": "Collapse",
			"terminal.collapseAria": "Collapse output",
			"terminal.expand": "Show {n} more lines",
			"terminal.expandAria": "Expand {n} collapsed output lines"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Required services: the jobs rosters, observations, and kill, the slot registry, and dictionaries. */
		const inject = [
			"jobs",
			"slots",
			"locale"
		];
		/**
		* Client plugin body: register the dictionaries and the header action.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("job", {
				zh,
				en
			}), "ui-jobs: dictionaries");
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "job-list",
				order: 20,
				locale: "job",
				inject: () => ({
					hooks: { jobs: ctx.jobs.state },
					watchRows: (sessionId) => ctx.jobs.watchRows(sessionId),
					observe: (sessionId, id) => ctx.jobs.observe(sessionId, id),
					killJob: async (sessionId, jobId) => (await ctx.jobs.kill(sessionId, jobId)).ok
				})
			}, JobListAction));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
