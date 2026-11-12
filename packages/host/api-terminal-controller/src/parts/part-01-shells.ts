/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-api-terminal-controller — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/shells.js
/**
* Resolve the configured shell or the execution environment's default shell.
* @param subprocess - target execution provider.
* @param configured - optional profile overriding the environment's default shell.
* @param signal - resolution cancellation.
* @returns one verified shell; a declared default that cannot resolve rejects.
*/
async function resolveShell(subprocess, configured, signal) {
	let shell = configured;
	if (shell === void 0) {
		const environment = await subprocess.terminalEnvironment(signal);
		shell = profile(environment.defaultShell ?? (environment.platform === "windows" ? "cmd.exe" : "/bin/sh"));
	}
	const path = await subprocess.resolveExecutable(shell.path, void 0, signal);
	return {
		...shell,
		path
	};
}
function profile(path) {
	const kind = shellKind(path);
	return {
		path,
		name: executableName(path),
		args: kind === "cmd" ? [] : kind === "pwsh" || kind === "powershell" ? ["-NoLogo"] : ["-i"]
	};
}
function executableName(path) {
	return path.slice(Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")) + 1);
}
function shellKind(path) {
	return executableName(path).toLowerCase().replace(/\.exe$/u, "");
}
/**
* List verified candidates after the configured or environment-default shell, one per executable name ignoring case and `.exe`.
* PATH lookup can reach the default through another directory, such as `/usr/bin/bash` for `/bin/bash` on merged-`/usr` systems.
* @param subprocess - target execution provider.
* @param configured - optional default profile.
* @param candidates - executable names or paths permitted for shell selection.
* @param signal - discovery cancellation.
* @returns installed shells with the default first, keeping the earliest entry per name; transport failures reject.
*/
async function discoverShells(subprocess, configured, candidates, signal) {
	const preferred = await resolveShell(subprocess, configured, signal);
	const found = await Promise.all(candidates.map(async (candidate) => {
		try {
			return await resolveShell(subprocess, profile(candidate), signal);
		} catch (error) {
			if (typeof error === "object" && error !== null && "name" in error && error.name === "SubprocessExecutableNotFoundError") return void 0;
			throw error;
		}
	}));
	const shells = /* @__PURE__ */ new Map();
	for (const shell of [preferred, ...found]) {
		if (shell === void 0) continue;
		const kind = shellKind(shell.path);
		if (!shells.has(kind)) shells.set(kind, shell);
	}
	return [...shells.values()];
}
//#endregion

export {};
