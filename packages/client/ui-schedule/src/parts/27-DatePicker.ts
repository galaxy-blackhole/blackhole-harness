/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/DatePicker.js
		/**
		* Month calendar for one staged one-shot date.
		*
		* The picker owns only the panel: the row renders the read-only trigger, whose
		* text exposes the date as `YYYY/MM/DD` while the draft it stages keeps the ISO
		* text this panel writes back and the Host receives. The row's Escape guard
		* closes the panel and hands focus back.
		*/
		/** ISO calendar date, the only text this row stores. */
		const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
		/** Weekday column headings, Monday first as the weekly choice orders them. */
		const WEEKDAY_KEYS = [
			"frequency.weekday.1",
			"frequency.weekday.2",
			"frequency.weekday.3",
			"frequency.weekday.4",
			"frequency.weekday.5",
			"frequency.weekday.6",
			"frequency.weekday.7"
		];
		/** Arrow key to the number of days it moves the focused cell. */
		const STEP_BY_KEY = {
			ArrowLeft: -1,
			ArrowRight: 1,
			ArrowUp: -7,
			ArrowDown: 7
		};
		/**
		* The month and day one stored date opens on.
		* @param date - staged ISO date text.
		* @returns its own year, month, and day, or today when it is not an ISO calendar date.
		*/
		function viewOf(date) {
			const match = ISO_DATE.exec(date);
			if (match === null) {
				const today = /* @__PURE__ */ new Date();
				return {
					year: today.getFullYear(),
					month: today.getMonth(),
					day: today.getDate()
				};
			}
			return {
				year: Number(match[1]),
				month: Number(match[2]) - 1,
				day: Number(match[3])
			};
		}
		/** Zero-padded two-digit field. */
		function pad(value) {
			return String(value).padStart(2, "0");
		}
		/**
		* Last day of one month.
		* @param view - year and zero-based month.
		* @returns that month's length in days.
		*/
		function daysIn(view) {
			return new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
		}
		/**
		* The same day in another month, clamped to that month's length.
		* @param view - current month and day.
		* @param step - months to move, negative for earlier.
		* @returns the moved view.
		*/
		function shiftMonth(view, step) {
			const months = view.year * 12 + view.month + step;
			const moved = {
				year: Math.floor(months / 12),
				month: months % 12
			};
			return {
				...moved,
				day: Math.min(view.day, daysIn(moved))
			};
		}
		/**
		* ISO text of one day in a shown month.
		* @param view - shown year and month.
		* @param day - day of that month.
		* @returns `YYYY-MM-DD`.
		*/
		function isoOf(view, day) {
			return `${view.year}-${pad(view.month + 1)}-${pad(day)}`;
		}
		/**
		* Render the month panel: one localized heading row over weeks of day cells.
		* @param props - open state, the trigger, the staged date, the pick and close callbacks, and row copy.
		* @returns the anchored panel while open, and nothing while closed.
		*/
		function DatePicker({ open, anchorRef, value, onPick, onClose, t }) {
			const refs = (0, react.useRef)(/* @__PURE__ */ new Map());
			const valueRef = (0, react.useRef)(value);
			valueRef.current = value;
			const [view, setView] = (0, react.useState)(() => viewOf(value));
			const today = /* @__PURE__ */ new Date();
			const todayIso = isoOf({
				year: today.getFullYear(),
				month: today.getMonth()
			}, today.getDate());
			(0, react.useEffect)(() => {
				if (!open) return;
				setView(viewOf(valueRef.current));
			}, [open]);
			(0, react.useEffect)(() => {
				if (!open) return;
				refs.current.get(String(view.day))?.focus();
			}, [open, view]);
			/**
			* Stage one day of the shown month and leave the keyboard on it.
			* @param day - day of the shown month.
			*/
			const pick = (day) => {
				setView((current) => ({
					...current,
					day
				}));
				onPick(isoOf(view, day));
			};
			/**
			* Move the focused cell inside the month, or stage the day it is on.
			* @param event - keydown from that cell.
			* @param day - day of the shown month the cell holds.
			*/
			const onCellKeyDown = (event, day) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					pick(day);
					return;
				}
				const step = STEP_BY_KEY[event.key] ?? 0;
				if (step === 0) return;
				event.preventDefault();
				const last = daysIn(view);
				setView((current) => ({
					...current,
					day: Math.min(Math.max(day + step, 1), last)
				}));
			};
			const offset = (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 6) % 7;
			const total = daysIn(view);
			const cellCount = Math.ceil((offset + total) / 7) * 7;
			const weeks = Array.from({ length: cellCount / 7 }, (_value, week) => week);
			const monthTitle = new Intl.DateTimeFormat(t("time.locale"), {
				month: "long",
				year: "numeric",
				timeZone: "UTC"
			}).format(Date.UTC(view.year, view.month, 1));
			return (0, react_jsx_runtime.jsxs)(PickerPopover, {
				open,
				anchorRef,
				label: t("timing.date"),
				className: DatePicker_module_css_default.calendar,
				onClose,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: DatePicker_module_css_default.head,
					children: [
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: DatePicker_module_css_default.nav,
							"aria-label": t("timing.prevMonth"),
							onClick: () => {
								setView((current) => shiftMonth(current, -1));
							},
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutlineRegular, {})
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: DatePicker_module_css_default.title,
							"aria-live": "polite",
							children: monthTitle
						}),
						(0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: DatePicker_module_css_default.nav,
							"aria-label": t("timing.nextMonth"),
							onClick: () => {
								setView((current) => shiftMonth(current, 1));
							},
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
						})
					]
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: DatePicker_module_css_default.grid,
					role: "grid",
					"aria-label": monthTitle,
					children: [(0, react_jsx_runtime.jsx)("div", {
						role: "row",
						className: DatePicker_module_css_default.week,
						children: WEEKDAY_KEYS.map((key) => (0, react_jsx_runtime.jsx)("div", {
							role: "columnheader",
							className: DatePicker_module_css_default.weekday,
							children: t(key)
						}, key))
					}), weeks.map((week) => (0, react_jsx_runtime.jsx)("div", {
						role: "row",
						className: DatePicker_module_css_default.week,
						children: Array.from({ length: 7 }, (_value, column) => week * 7 + column - offset + 1).map((day) => day < 1 || day > total ? (0, react_jsx_runtime.jsx)("div", {
							role: "gridcell",
							"aria-hidden": "true",
							className: DatePicker_module_css_default.blank
						}, day) : (0, react_jsx_runtime.jsx)("div", {
							ref: (element) => {
								if (element === null) refs.current.delete(String(day));
								else refs.current.set(String(day), element);
							},
							role: "gridcell",
							"aria-selected": isoOf(view, day) === value,
							"aria-current": isoOf(view, day) === todayIso ? "date" : void 0,
							tabIndex: day === view.day ? 0 : -1,
							className: clsx(DatePicker_module_css_default.cell, isoOf(view, day) === value && DatePicker_module_css_default.selected),
							onClick: () => {
								pick(day);
							},
							onKeyDown: (event) => {
								onCellKeyDown(event, day);
							},
							children: day
						}, day))
					}, week))]
				})]
			});
		}
		//#endregion
