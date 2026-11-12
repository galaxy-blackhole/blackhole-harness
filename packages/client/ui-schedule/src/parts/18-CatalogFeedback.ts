/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/CatalogFeedback.js
		/**
		* Render the catalog's loading and query-failure states.
		*
		* An empty panel centers a bare spinner while loading and the failure with its
		* retry; a panel that already shows content keeps a compact notice for a failed
		* refresh, and stays silent while a refresh loads, so the retained rows remain
		* readable. Deletion outcomes are not catalog states: the app-wide toast
		* announces them.
		* @param props - query state, whether content is shown, the retry action, and localized copy.
		* @returns the applicable states, or nothing while the catalog is ready.
		*/
		function CatalogFeedback({ status, populated, onRetry, t }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [status === "loading" && !populated && (0, react_jsx_runtime.jsx)("div", {
				className: TaskManagerPage_module_css_default.empty,
				role: "status",
				"aria-label": t("list.loading"),
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" })
			}), status === "error" && (populated ? (0, react_jsx_runtime.jsxs)("div", {
				className: TaskManagerPage_module_css_default.notice,
				children: [(0, react_jsx_runtime.jsx)("p", {
					role: "alert",
					children: t("list.error")
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					onClick: () => {
						onRetry();
					},
					children: t("list.retry")
				})]
			}) : (0, react_jsx_runtime.jsxs)("div", {
				className: TaskManagerPage_module_css_default.empty,
				children: [
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {
						size: 24,
						className: TaskManagerPage_module_css_default.emptyGlyph
					}),
					(0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						className: TaskManagerPage_module_css_default.emptyTitle,
						children: t("list.error")
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						className: TaskManagerPage_module_css_default.emptyAction,
						onClick: () => {
							onRetry();
						},
						children: t("list.retry")
					})
				]
			}))] });
		}
		//#endregion
