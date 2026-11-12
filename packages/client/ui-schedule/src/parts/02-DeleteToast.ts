/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/DeleteToast.js
		/**
		* Create the one deletion-outcome store the overlay entry shows.
		* @returns the observable notice with its report and dismiss actions.
		*/
		function createDeleteToastSource() {
			let state = null;
			let seq = 0;
			const listeners = /* @__PURE__ */ new Set();
			const publish = (next) => {
				state = next;
				for (const listener of listeners) listener();
			};
			return {
				hooks: { toast: {
					getSnapshot: () => state,
					subscribe(listener) {
						listeners.add(listener);
						return () => {
							listeners.delete(listener);
						};
					}
				} },
				report: (outcome) => {
					if (outcome === "pending") return;
					publish({
						kind: outcome === "deleted" ? "deleted" : "deleteFailed",
						seq: ++seq
					});
				},
				dismiss: () => {
					publish(null);
				}
			};
		}
		/**
		* Render the current deletion notice: a success banner for a confirmed
		* deletion, a warning for one that could not be confirmed, or nothing.
		* @param props - the notice hook, its dismissal, and the locale seat.
		* @returns the banner on display, or null.
		*/
		function ScheduleDeleteToast({ useToast, dismiss, t }) {
			const toast = useToast((current) => current);
			if (toast === null) return null;
			return toast.kind === "deleted" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: t("toast.deleted"),
				tone: "success",
				onDone: dismiss
			}, `schedule-delete-${String(toast.seq)}`) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
				text: t("toast.deleteFailed"),
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
				onDone: dismiss
			}, `schedule-delete-${String(toast.seq)}`);
		}
		//#endregion
