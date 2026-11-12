/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/bin.js
/** Thin executable/importable entry for the provider-private runner core. */
/**
* Run a selector already removed by a packaging bootstrap.
* @param selection - private runner selector or Linux launch-request locator.
*/
async function runSelectedSubprocessRunner(selection) {
	try {
		await runSpawnRunner(selection, process.argv.slice(2));
	} catch (error) {
		await reportSpawnRunnerFailure(selection, error);
	}
}
if (import.meta.main) {
	const selection = consumeRunnerSelection();
	if (selection === void 0) process.exitCode = 127;
	else runSelectedSubprocessRunner(selection);
}
//#endregion

export {};
