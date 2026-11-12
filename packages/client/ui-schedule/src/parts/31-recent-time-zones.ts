/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-client-ui-schedule — dựng lại 08/11/2026 (dev-1)
 *      theo ĐÚNG tên ngữ nghĩa trong src/manifest.ts; KHÔNG sửa tay (cổng byte của build.ts canh).
 */
		//#region lib/types/client/recent-time-zones.js
		/** Browser-local recently selected IANA time zones. */
		const STORAGE_KEY = "dsh.schedule.recent-time-zones.v1";
		const LIMIT = 5;
		/** First-run choices follow the device rather than guessing location from UI language. */
		function defaults(system) {
			return [...new Set([system, "UTC"])];
		}
		/**
		* Load up to five recent zones, or the system-zone/UTC first-run seed.
		* @param system - the host's current IANA zone.
		* @returns recent IANA zones in most-recent-first order.
		*/
		function loadRecentTimeZones(system) {
			if (typeof localStorage === "undefined") return defaults(system);
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (raw === null) return defaults(system);
				const parsed = JSON.parse(raw);
				if (!Array.isArray(parsed)) return defaults(system);
				const zones = [...new Set(parsed.filter((value) => typeof value === "string" && value !== ""))];
				return zones.length === 0 ? defaults(system) : zones.slice(0, LIMIT);
			} catch {
				return defaults(system);
			}
		}
		/**
		* Promote one exact IANA id and persist the bounded list when storage is available.
		* @param recent - current most-recent-first IANA zones.
		* @param zone - exact IANA zone to promote.
		* @returns the updated bounded most-recent-first list.
		*/
		function rememberTimeZone(recent, zone) {
			const next = [zone, ...recent.filter((value) => value !== zone)].slice(0, LIMIT);
			if (typeof localStorage !== "undefined") try {
				localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
			} catch {}
			return next;
		}
		//#endregion
