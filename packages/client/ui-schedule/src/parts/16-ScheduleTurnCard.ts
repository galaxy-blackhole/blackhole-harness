/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/ScheduleTurnCard.js
		/**
		* Props of one card rendered from the Turn tail.
		*
		* The keyed Tool seat also carries the owner's file opener, image loader, and
		* workspace facts; this card reads none of them, and the Turn tail supplies
		* only the fields it does.
		* @param block - settled result node recorded against the Turn.
		* @param openTaskDetail - right-Sidebar navigation for the created task.
		* @param t - the active locale's copy.
		* @returns the composed props of one `ScheduleCreateCard`.
		*/
		function cardProps(block, openTaskDetail, t, currentTask) {
			return {
				callId: block.callId,
				toolName: SCHEDULE_CREATE_TOOL,
				block,
				openTaskDetail,
				t,
				...currentTask === void 0 ? {} : { currentTask }
			};
		}
		/** Created-task cards reconciled against the authoritative Host catalog. */
		function CurrentScheduleCards({ created, openTaskDetail, t, useCatalog, onRetry }) {
			const catalog = useCatalog((snapshot) => snapshot);
			const requestAtMount = (0, react.useRef)(catalog.readRequest).current;
			(0, react.useEffect)(() => {
				onRetry(requestAtMount);
			}, [onRetry, requestAtMount]);
			const records = catalog.settled && catalog.readSettled > requestAtMount ? catalog.records : void 0;
			return created.map((block) => {
				const task = scheduleCreateCardModel(block, SCHEDULE_CREATE_TOOL).task;
				return (0, react_jsx_runtime.jsx)(ScheduleCreateCard, { ...cardProps(block, openTaskDetail, t, task === void 0 || records === void 0 ? void 0 : records.find((record) => record.id === task.id) ?? null) }, block.callId);
			});
		}
		/**
		* Render the tasks one Turn created as standalone cards beneath its closing
		* prose.
		*
		* The Turn tail is a list seat independent of the Turn's process disclosure,
		* so the cards stay visible while the Tool group is collapsed. Every list entry
		* renders for every Turn, so this one narrows its own Turn here.
		* @param props - closing Turn owner currency, turn-tail navigation, and copy.
		* @returns one created-task card per settled `schedule_create` result, or null when the Turn created none.
		*/
		function ScheduleTurnCard(props) {
			const matched = selectScheduleTasks(props);
			if (matched === null) return null;
			return (0, react_jsx_runtime.jsx)("div", {
				className: ScheduleTurnCard_module_css_default.list,
				children: (0, react_jsx_runtime.jsx)(CurrentScheduleCards, {
					created: matched.created,
					openTaskDetail: props.openTaskDetail,
					t: props.t,
					useCatalog: props.useCatalog,
					onRetry: props.onRetry
				})
			});
		}
		//#endregion
