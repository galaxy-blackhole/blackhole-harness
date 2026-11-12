/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/TaskManagerIcon.js
		/** Decorative occupant for the task-manager sidebar entry. */
		/**
		* Render the clock glyph at the size the sidebar asks for; the sidebar owns
		* its accessible navigation label. The glyph is the row's direct icon child,
		* as on every other panel row: an inline wrapper makes it the baseline of a
		* line box inside the row's glyph slot, which lifts it above the label.
		* @param props - the sidebar's icon share: the requested edge and whether the panel is selected.
		* @returns decorative clock icon.
		*/
		function TaskManagerIcon({ size }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, { size });
		}
		//#endregion
