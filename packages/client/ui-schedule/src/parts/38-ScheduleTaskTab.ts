/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/ScheduleTaskTab.js
		/**
		* The task tab's body: one retained task's detail in the right Sidebar.
		*
		* The tab's layout record stores nothing durable. It selects its task from the
		* shared Host catalog by the navigation parameters it was opened with and
		* renders the same `TaskDetail` component the Tasks page renders, so both views
		* offer identical fields, timing edits, saved deliveries, confirmed deletion,
		* and the original Session link. A record restored by a reload carries no
		* parameters, so the body falls back to the provider-owned binding that the
		* navigation wrote; a retained edit draft keeps the detail on screen after the
		* catalog row disappears, and a confirmed deletion closes this tab once the
		* refreshed catalog reports the row gone; without a draft, the body reports
		* that the task is gone.
		*
		* The parameters name the task's original Session, and every mutation carries
		* that binding, so reading or deleting from here never activates a Session.
		*/
		/**
		* Render the single task named by this tab's navigation parameters or by the
		* binding those parameters last wrote.
		*
		* When neither names a task, the body reports the catalog feedback until a read
		* requested after the baseline for the current navigation succeeds without the
		* task; the missing-task state then covers both an unbound restored tab and a
		* navigated tab whose task is gone.
		* @param props - tab information, the Host task catalog, localized copy, and action callbacks.
		* @returns the task's detail, or its centered loading, query-failure, or missing-task state.
		*/
		function ScheduleTaskTab(props) {
			const { sessionId, useTabInfo, useCatalog, onRetry, taskBindings, t } = props;
			const { tab } = useTabInfo();
			const { navigated, navigation, recovered, params } = useTaskTabTarget(sessionId, tab, taskBindings);
			const catalog = useCatalog((snapshot) => snapshot);
			const detail = useTaskDetail(props, catalog, params?.id);
			const { task, record: catalogRecord } = detail;
			const navigationRevision = navigated ? tab.navigation.revision : void 0;
			const [baseline, setBaseline] = (0, react.useState)(() => ({
				revision: navigationRevision,
				request: catalog.readRequest
			}));
			if (baseline.revision !== navigationRevision) setBaseline({
				revision: navigationRevision,
				request: catalog.readRequest
			});
			const answered = catalog.settled && catalog.readSettled > baseline.request;
			(0, react.useEffect)(() => {
				if (task === void 0 && !answered) onRetry(baseline.request);
			}, [
				onRetry,
				baseline.request,
				task,
				answered
			]);
			(0, react.useEffect)(() => {
				if (navigation === void 0) return;
				taskBindings.write(sessionId, {
					id: tab.id,
					kind: tab.kind,
					contentId: tab.contentId
				}, navigation);
			}, [
				taskBindings,
				sessionId,
				tab.id,
				tab.kind,
				tab.contentId,
				navigation?.sessionId,
				navigation?.id
			]);
			(0, react.useEffect)(() => {
				if (recovered === void 0 || navigated || !answered || catalogRecord !== void 0) return;
				taskBindings.forget(sessionId, {
					id: tab.id,
					kind: tab.kind,
					contentId: tab.contentId
				});
			}, [
				taskBindings,
				sessionId,
				tab.id,
				tab.kind,
				tab.contentId,
				recovered,
				navigated,
				answered,
				catalogRecord
			]);
			if (task === void 0) {
				const pending = catalog.status === "ready" && !answered;
				return (0, react_jsx_runtime.jsx)("div", {
					className: TaskManagerPage_module_css_default.tabBody,
					children: answered ? (0, react_jsx_runtime.jsxs)("div", {
						className: TaskManagerPage_module_css_default.empty,
						role: "status",
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconClockOutlineRegular, {
							size: 24,
							className: TaskManagerPage_module_css_default.emptyGlyph
						}), (0, react_jsx_runtime.jsx)("h3", { children: t("detail.missing") })]
					}) : (0, react_jsx_runtime.jsx)(CatalogFeedback, {
						status: pending ? "loading" : catalog.status,
						populated: false,
						onRetry,
						t
					})
				});
			}
			return (0, react_jsx_runtime.jsx)("div", {
				className: TaskManagerPage_module_css_default.tabBody,
				children: (0, react_jsx_runtime.jsx)(TaskDetail, {
					...detail.props,
					task,
					authoritative: catalogRecord !== void 0,
					onDeleted: () => {
						tab.actions.close();
					},
					withinSession: sessionId
				})
			});
		}
		//#endregion
