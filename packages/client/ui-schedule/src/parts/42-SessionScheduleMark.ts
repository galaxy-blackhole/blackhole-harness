/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/SessionScheduleMark.js
		/**
		* Sidebar Session-row clock mark: one Session's active scheduled-task
		* indicator, seated in the row's leading 16px cell before the title.
		*
		* The row offers that cell to this seat only while its own primary state is
		* idle, so an approval request, a new message, or live activity keeps the
		* row's state dot in the same cell and never mounts the mark. The mark
		* projects the one shared Host task catalog onto this Session; it activates,
		* retains, and unarchives nothing, and it never reads a Session log.
		*/
		/**
		* Render the clock mark while this Session's active tasks are non-empty.
		* @param props.sessionId - Session this row shows.
		* @param props.useCatalog - selector hook over the shared Host task catalog.
		* @param props.t - Schedule catalog locale seat.
		* @returns the mark, or nothing while the read is unresolved, failed, ended, or empty.
		*/
		function SessionScheduleMark({ sessionId, useCatalog, t }) {
			const facts = useSessionScheduleFacts(useCatalog, sessionId);
			if (!facts.hasActive) return null;
			return (0, react_jsx_runtime.jsxs)("span", {
				className: SessionScheduleMark_module_css_default.mark,
				"data-session-schedule-mark": "",
				onClick: (event) => {
					event.stopPropagation();
				},
				children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, { size: 14 }), (0, react_jsx_runtime.jsx)("span", {
					className: SessionScheduleMark_module_css_default.visuallyHidden,
					children: t("mark.aria", { count: facts.records.length })
				})]
			});
		}
		//#endregion
