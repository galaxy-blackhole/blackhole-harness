/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/PickerPopover.js
		/** Anchored, outside-dismissed popover shell the timing pickers share. */
		/** Unplaced portal frame: laid out at the viewport origin but unpainted until measured. */
		const MEASURE_STYLE$1 = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		/**
		* Render one picker panel into `document.body`, fixed below its trigger.
		*
		* The panel is a portal, so an ancestor's `overflow` cannot crop it, and a
		* pointerdown outside both the trigger and the panel dismisses it.
		* @param props - open state, the trigger, the panel name and layout class, the dismissal callback, and the contents.
		* @returns the panel while open, and nothing while closed.
		*/
		function PickerPopover({ open, anchorRef, label, className, onClose, children }) {
			const panelRef = (0, react.useRef)(null);
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(anchorRef, open, onClose, panelRef);
			const position = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef,
				panelRef,
				gap: 4,
				margin: 12
			});
			if (!open) return null;
			return (0, react_dom.createPortal)((0, react_jsx_runtime.jsx)("div", {
				ref: panelRef,
				className: clsx(PickerPopover_module_css_default.panel, className),
				style: position ?? MEASURE_STYLE$1,
				role: "dialog",
				"aria-label": label,
				onClick: (event) => {
					event.stopPropagation();
				},
				children
			}), document.body);
		}
		//#endregion
