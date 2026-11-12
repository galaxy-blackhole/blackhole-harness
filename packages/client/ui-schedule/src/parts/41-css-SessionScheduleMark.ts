/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-schedule/src/client/SessionScheduleMark.module.css.mjs
		const css = __GBH_UI_SCHEDULE_CSS_SessionScheduleMark__;
		const tagId = "@deepseek-ai/dsh-client-ui-schedule/SessionScheduleMark.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-schedule";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var SessionScheduleMark_module_css_default = {
			"mark": "mBt53q_mark",
			"omitted": "mBt53q_omitted",
			"task": "mBt53q_task",
			"taskBody": "mBt53q_taskBody",
			"taskIcon": "mBt53q_taskIcon",
			"taskName": "mBt53q_taskName",
			"taskRelative": "mBt53q_taskRelative",
			"taskTiming": "mBt53q_taskTiming",
			"tasks": "mBt53q_tasks",
			"visuallyHidden": "mBt53q_visuallyHidden"
		};
		/**
		* Render up to {@link SESSION_HOVER_TASK_LIMIT} overdue-first task rows.
		*
		* The reference clock is sampled once per mount: the card is a long-hover
		* preview, so its "next run" text must not drift while the pointer rests.
		* @param props.sessionId - Session this row shows.
		* @param props.useCatalog - selector hook over the shared Host task catalog.
		* @param props.t - Schedule catalog locale seat.
		* @returns the task rows plus an omission line, or nothing without an active task.
		*/
		function SessionScheduleHover({ sessionId, useCatalog, t }) {
			const facts = useSessionScheduleFacts(useCatalog, sessionId);
			const [now] = (0, react.useState)(() => Date.now());
			if (!facts.hasActive) return null;
			const ordered = orderScheduleRecords(facts.records, now);
			const shown = ordered.slice(0, 2);
			const omitted = ordered.length - shown.length;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: SessionScheduleMark_module_css_default.tasks,
				"data-session-schedule-tasks": "",
				children: [shown.map((record) => {
					const nextRun = nextRunParts(record.scheduledAt, t("time.locale"), now, t);
					return (0, react_jsx_runtime.jsxs)("div", {
						className: SessionScheduleMark_module_css_default.task,
						"data-session-schedule-task": "",
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: SessionScheduleMark_module_css_default.taskIcon,
							"aria-hidden": "true",
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, { size: 12 })
						}), (0, react_jsx_runtime.jsxs)("span", {
							className: SessionScheduleMark_module_css_default.taskBody,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: SessionScheduleMark_module_css_default.taskName,
								children: taskName(record)
							}), (0, react_jsx_runtime.jsxs)("span", {
								className: SessionScheduleMark_module_css_default.taskTiming,
								children: [
									`${formatScheduleFrequency(record, t)} · `,
									(0, react_jsx_runtime.jsx)("time", {
										dateTime: record.scheduledAt,
										children: nextRun.absolute
									}),
									" ",
									(0, react_jsx_runtime.jsx)("span", {
										className: SessionScheduleMark_module_css_default.taskRelative,
										children: nextRun.relative
									})
								]
							})]
						})]
					}, record.id);
				}), omitted > 0 && (0, react_jsx_runtime.jsx)("div", {
					className: SessionScheduleMark_module_css_default.omitted,
					children: t("hover.more", { count: omitted })
				})]
			});
		}
		//#endregion
