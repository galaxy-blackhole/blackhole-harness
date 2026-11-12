/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/control-spawn.js
/** Parent-side setup for one explicitly requested inherited control pipe. */
/**
* Read the optional extra pipe from Node's stdio tuple.
* @param child - child whose requested extra pipe was allocated by Node.
* @param control - requested transport, or undefined when absent.
* @returns the parent duplex endpoint, absent when not requested or native startup failed.
*/
function controlPipe(child, control) {
	const streams = child.stdio;
	return control === "pipe" ? streams[SUBPROCESS_CONTROL_FD] : void 0;
}
/**
* Stamp the private marker on a fresh child environment after rejecting a caller override.
* @param env - newly materialized child environment, owned by the caller.
* @param control - requested control transport, or undefined when absent.
* @returns the same environment with the provider-owned launch marker when requested.
*/
function controlEnvironment(env, control) {
	for (const [key, value] of Object.entries(env)) if (key.toUpperCase() === SUBPROCESS_CONTROL_ENV && value !== void 0) throw new Error(`${SUBPROCESS_CONTROL_ENV} is reserved for subprocess control-channel setup`);
	if (control === "pipe") Object.assign(env, { [SUBPROCESS_CONTROL_ENV]: "pipe" });
	return env;
}
//#endregion

export {};
