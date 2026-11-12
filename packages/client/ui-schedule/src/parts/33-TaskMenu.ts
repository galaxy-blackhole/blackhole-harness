/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/TaskMenu.js
		/**
		* Anchored dropdown menu of the task manager's rule rows and task header.
		*
		* This is the schedule-local copy of the shared `Menu` implementation. The
		* pinned `header` slot and the `data-menu-field` keyboard handover exist for
		* the Time zone row's search box, so the four call sites here keep that
		* capability locally instead of extending the shared card.
		*/
		/** Unplaced portal list: hidden but laid out at a fixed origin so its offset size is real. */
		const MEASURE_STYLE = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		/** Distance the list keeps from the anchor edge. */
		const ANCHOR_GAP = 4;
		/** Distance the list keeps from each viewport edge. */
		const VIEWPORT_MARGIN = 12;
		/**
		* Whether an entry is a group hairline.
		* @param entry - one menu entry.
		* @returns true for a separator entry.
		*/
		function isSeparator(entry) {
			return "type" in entry && entry.type === "separator";
		}
		/**
		* Whether an entry is a non-interactive heading.
		* @param entry - one menu entry.
		* @returns true for a heading entry.
		*/
		function isLabel(entry) {
			return "type" in entry && entry.type === "label";
		}
		/**
		* Render an anchored dropdown menu. While the list is open, Tab settles the
		* focused row — from the trigger, Tab enters the list instead — Escape and
		* Shift+Tab close it and return focus to the anchor's first enabled button, and
		* selecting a row does the same.
		* @param props.open - whether the list is showing (owner-controlled).
		* @param props.anchor - the trigger element, rendered in place.
		* @param props.items - selectable rows and optional separators or heading labels.
		* @param props.selectedId - row shown as selected.
		* @param props.onSelect - row activation callback, not called for disabled rows.
		* @param props.onClose - invoked on an outside pointer press, Escape, or a
		* window blur that moved focus into a cross-origin iframe.
		* @param props.align - list alignment against the anchor (default 'start').
		* @param props.portal - render the list into document.body, fixed-positioned
		* from the anchor rect (follows scroll and resize while open).
		* @param props.header - owner content pinned above the scrolling rows; a control
		* it marks `data-menu-field` takes the keyboard once the list is placed, which
		* is the frame a portaled list becomes focusable in.
		* @param props.className - extra class on the anchor wrapper span.
		* @param props.listClassName - extra class on the dropdown card itself.
		* @returns the anchor wrapper with the conditional list.
		*/
		function TaskMenu({ open, anchor, items = [], selectedId, onSelect, onClose, align = "start", portal = false, header, className, listClassName }) {
			const rootRef = (0, react.useRef)(null);
			const listRef = (0, react.useRef)(null);
			/** Index the arrow walk last focused, the resume point when focus left the rows. */
			const walkIndex = (0, react.useRef)(null);
			/** Whether this open already moved the keyboard into the list. */
			const handedOver = (0, react.useRef)(false);
			const openRef = (0, react.useRef)(open);
			openRef.current = open;
			/** Latest close callback, so the document listeners bind once per open. */
			const closeRef = (0, react.useRef)(onClose);
			closeRef.current = onClose;
			const dismiss = (0, react.useCallback)(() => {
				closeRef.current();
			}, []);
			const position = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open: open && portal,
				anchorRef: rootRef,
				panelRef: listRef,
				align,
				gap: ANCHOR_GAP,
				margin: VIEWPORT_MARGIN
			});
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, dismiss, listRef);
			/**
			* Hand the keyboard back to the anchor's first enabled button. Focus left on
			* a removed row otherwise falls to the page body, where the next Tab restarts
			* from the top of the page.
			*/
			const refocusAnchor = () => {
				rootRef.current?.querySelector("button:not(:disabled)")?.focus();
			};
			/**
			* Post-selection focus, for the paths where the rows unmount with the list.
			* A selection whose owner keeps the menu open is left alone, and so is an
			* owner that moved focus itself: only a keyboard left on the closing list
			* (or on the body its removal produced) comes back to the anchor.
			*/
			const refocusAfterSelection = () => {
				queueMicrotask(() => {
					if (openRef.current) return;
					const active = document.activeElement;
					if (active === null || active === document.body || listRef.current?.contains(active) === true) refocusAnchor();
				});
			};
			(0, react.useEffect)(() => {
				if (!open) {
					handedOver.current = false;
					return;
				}
				if (handedOver.current) return;
				const list = listRef.current;
				/* v8 ignore next -- the list is rendered in the same commit that sets `open`, before this effect runs. */
				if (list === null) return;
				if (portal && position === null) return;
				const field = list.querySelector("[data-menu-field]");
				if (field === null) return;
				handedOver.current = true;
				field.focus();
			}, [
				open,
				portal,
				position
			]);
			(0, react.useEffect)(() => {
				if (!open) {
					walkIndex.current = null;
					return;
				}
				const onKeyDown = (e) => {
					const focused = document.activeElement;
					const insideList = listRef.current?.contains(focused) === true;
					const anchored = rootRef.current?.contains(focused) === true || insideList;
					if (e.key === "Escape") {
						dismiss();
						if (anchored) refocusAnchor();
					}
					if (e.key === "Tab") {
						const list = listRef.current;
						/* v8 ignore next -- the list is mounted whenever this effect's `open` is true. */
						if (list === null) return;
						if (!anchored) return;
						if (e.shiftKey) {
							e.preventDefault();
							dismiss();
							refocusAnchor();
							return;
						}
						if (insideList) {
							if (focused instanceof Element && focused.getAttribute("role") === "menuitem") {
								e.preventDefault();
								focused.click();
							}
							return;
						}
						const row = list.querySelector("button:not(:disabled)");
						if (row === null) return;
						e.preventDefault();
						row.focus();
						walkIndex.current = 0;
						return;
					}
					if (![
						"ArrowDown",
						"ArrowUp",
						"Home",
						"End"
					].includes(e.key)) return;
					if (e.target instanceof HTMLInputElement && (e.key === "Home" || e.key === "End")) return;
					const list = listRef.current;
					/* v8 ignore next -- the list is mounted whenever this effect's `open` is true. */
					if (list === null) return;
					if (!anchored) return;
					const buttons = Array.from(list.querySelectorAll("button:not(:disabled)"));
					if (buttons.length === 0) return;
					const index = buttons.indexOf(focused);
					const from = index >= 0 ? index : walkIndex.current;
					const next = e.key === "Home" ? 0 : e.key === "End" ? buttons.length - 1 : from === null ? e.key === "ArrowDown" ? 0 : buttons.length - 1 : (from + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
					e.preventDefault();
					walkIndex.current = next;
					buttons[next]?.focus();
				};
				const onWindowBlur = () => {
					if (document.activeElement instanceof HTMLIFrameElement) dismiss();
				};
				document.addEventListener("keydown", onKeyDown);
				window.addEventListener("blur", onWindowBlur);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
					window.removeEventListener("blur", onWindowBlur);
				};
			}, [open, dismiss]);
			const renderEntry = (entry) => {
				if (isSeparator(entry)) return (0, react_jsx_runtime.jsx)("div", {
					className: TaskMenu_module_css_default.separator,
					role: "separator"
				}, entry.id);
				if (isLabel(entry)) return (0, react_jsx_runtime.jsx)("div", {
					className: TaskMenu_module_css_default.label,
					role: "presentation",
					children: entry.text
				}, entry.id);
				const selected = entry.id === selectedId;
				return (0, react_jsx_runtime.jsx)("div", {
					className: TaskMenu_module_css_default.itemWrap,
					children: (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						role: "menuitem",
						className: clsx(TaskMenu_module_css_default.item, selected && TaskMenu_module_css_default.selected, entry.danger === true && TaskMenu_module_css_default.danger),
						disabled: entry.disabled,
						onClick: () => {
							onSelect(entry.id);
						},
						children: [
							entry.icon !== void 0 && (0, react_jsx_runtime.jsx)("span", {
								className: TaskMenu_module_css_default.itemIcon,
								children: entry.icon
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: TaskMenu_module_css_default.itemLabel,
								children: entry.label
							}),
							selected && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { className: TaskMenu_module_css_default.check })
						]
					})
				}, entry.id);
			};
			const list = open && (0, react_jsx_runtime.jsxs)("div", {
				ref: listRef,
				className: clsx(TaskMenu_module_css_default.list, listClassName, TaskMenu_module_css_default.scrollable, portal && TaskMenu_module_css_default.portal, align === "end" && !portal && TaskMenu_module_css_default.alignEnd),
				style: portal ? position ?? MEASURE_STYLE : void 0,
				role: "menu",
				onClick: (e) => {
					e.stopPropagation();
					if ((e.target instanceof Element ? e.target.closest("button[role=\"menuitem\"]") : null) !== null) refocusAfterSelection();
				},
				children: [header !== void 0 && (0, react_jsx_runtime.jsx)("div", {
					className: TaskMenu_module_css_default.header,
					role: "presentation",
					children: header
				}), (0, react_jsx_runtime.jsx)("div", {
					className: TaskMenu_module_css_default.viewport,
					role: "presentation",
					children: items.map(renderEntry)
				})]
			});
			return (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: clsx(TaskMenu_module_css_default.root, className),
				children: [anchor, portal ? list !== false && (0, react_dom.createPortal)(list, document.body) : list]
			});
		}
		//#endregion
