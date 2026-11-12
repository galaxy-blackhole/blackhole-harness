/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/relative-clock.js
		/** Reference clock for the relative "time remaining" text. */
		/**
		* Refresh period for relative-time text.
		*
		* The text names whole seconds, minutes, hours, or days, so a half-minute
		* period keeps it correct to its own granularity without re-rendering a mounted
		* page on every frame.
		*/
		const RELATIVE_CLOCK_PERIOD_MS = 3e4;
		/**
		* Current epoch milliseconds, re-sampled on a fixed period.
		*
		* A relative duration is read against the moment it renders, not against the
		* moment its component mounted: a page left open across a delivery would keep
		* showing the time until the previous target.
		*
		* This is the shared clock of the mounted task page and its detail, the two
		* surfaces that sit side by side and must not disagree about how long remains.
		* Two other surfaces keep their own beat: the Session-header catalog reads
		* `Date.now()` and then a one-second interval while its popover is open, and the
		* Sidebar Session-row hover card samples `Date.now()` once per mount, because
		* that preview must not drift while the pointer rests on it.
		* @param periodMs - refresh period; defaults to {@link RELATIVE_CLOCK_PERIOD_MS}.
		* @returns epoch milliseconds, updated once per period.
		*/
		function useRelativeClock(periodMs = RELATIVE_CLOCK_PERIOD_MS) {
			const [now, setNow] = (0, react.useState)(() => Date.now());
			(0, react.useEffect)(() => {
				const timer = setInterval(() => {
					setNow(Date.now());
				}, periodMs);
				return () => {
					clearInterval(timer);
				};
			}, [periodMs]);
			return now;
		}
		//#endregion
