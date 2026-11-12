/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/ScheduleCreateCard.js
		/**
		* Render one `schedule_create` call as the created task's card.
		*
		* A settled result yields the task's title, its localized frequency, and the
		* button that opens that task's right-Sidebar detail. A running call, a failed
		* creation, or a replayed result with no complete task renders its title and
		* raw result text with no open action, so the card never presents an identity
		* it does not have.
		* @param props - the settled card payload, injected task navigation, and copy.
		* @returns the created task's transcript card.
		*/
		function ScheduleCreateCard({ block, toolName, openTaskDetail, t, currentTask }) {
			const model = scheduleCreateCardModel(block, toolName);
			const task = currentTask ?? model.task;
			const deleted = currentTask === null;
			const title = currentTask === void 0 || currentTask === null ? model.title : taskName(currentTask);
			const openable = task !== void 0 && !deleted;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ScheduleCreateCard_module_css_default.card,
				"data-tool": "schedule_create",
				children: [
					openable ? (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: ScheduleCreateCard_module_css_default.cardOpen,
						"aria-label": t("card.openLabel", { title }),
						onClick: () => {
							openTaskDetail(task.id);
						}
					}) : null,
					(0, react_jsx_runtime.jsxs)("div", {
						className: ScheduleCreateCard_module_css_default.row,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: ScheduleCreateCard_module_css_default.leading,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, { size: 18 })
							}),
							(0, react_jsx_runtime.jsxs)("span", {
								className: ScheduleCreateCard_module_css_default.body,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: ScheduleCreateCard_module_css_default.title,
									children: title
								}), task !== void 0 ? (0, react_jsx_runtime.jsx)("span", {
									className: ScheduleCreateCard_module_css_default.frequency,
									children: deleted ? t("card.deleted") : formatScheduleFrequency(task, t)
								}) : null]
							}),
							openable ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "outline",
								size: "sm",
								className: ScheduleCreateCard_module_css_default.openButton,
								onClick: () => {
									openTaskDetail(task.id);
								},
								children: t("card.open")
							}) : null
						]
					}),
					task === void 0 && model.output !== null ? (0, react_jsx_runtime.jsx)("pre", {
						className: ScheduleCreateCard_module_css_default.fallback,
						children: model.output
					}) : null
				]
			});
		}
		//#endregion
