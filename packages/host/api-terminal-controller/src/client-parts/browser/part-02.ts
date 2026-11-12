/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LAT NGUYEN VAN THAN nua client @galaxy-blackhole/gbh-host-typert-gateway — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region lib/types/client/shell-preference.js
		/** Browser-local shell preference; Host discovery decides whether the saved path is usable. */
		const KEY = "dsh.terminal.shell";
		/**
		* Read the browser preference.
		* @returns the last selected shell path, or null when storage is unavailable.
		*/
		function preferredShell() {
			try {
				return typeof localStorage === "undefined" ? null : localStorage.getItem(KEY);
			} catch (_storageUnavailable) {
				return null;
			}
		}
		/**
		* Remember the selected shell without making storage a startup dependency.
		* @param path - verified executable path offered by the Host.
		*/
		function rememberShell(path) {
			try {
				if (typeof localStorage !== "undefined") localStorage.setItem(KEY, path);
			} catch (_storageUnavailable) {}
		}
		//#endregion

export {};
