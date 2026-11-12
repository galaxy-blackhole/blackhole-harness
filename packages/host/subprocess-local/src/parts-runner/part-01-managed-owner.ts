/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/managed-owner.js
/** Minimal managed-range ownership bound to one ordinary subprocess handle. */
/**
* Apply an optional abort bound to one shared wait promise.
* @param pending - managed-range wait shared by all callers.
* @param signal - optional caller cancellation signal.
* @returns whether the managed-range wait completed before cancellation.
*/
async function waitWithAbort(pending, signal) {
	if (signal?.aborted) {
		pending.catch(() => {});
		return false;
	}
	if (signal === void 0) {
		await pending;
		return true;
	}
	const aborted = Promise.withResolvers();
	const onAbort = () => {
		aborted.resolve(false);
	};
	signal.addEventListener("abort", onAbort, { once: true });
	try {
		return await Promise.race([pending.then(() => true), aborted.promise]);
	} finally {
		signal.removeEventListener("abort", onAbort);
	}
}
//#endregion

export {};
