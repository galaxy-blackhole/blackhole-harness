/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/runner-protocol.js
/** Closed private transports shared by the native subprocess runner. */
function isRecord(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys(value, required, optional = []) {
	const allowed = new Set([...required, ...optional]);
	return required.every((key) => Object.hasOwn(value, key)) && Object.keys(value).every((key) => allowed.has(key));
}
function isStringRecord(value) {
	return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}
function isSerializedRunnerError(value) {
	if (!isRecord(value) || !hasExactKeys(value, ["name", "message"], [
		"code",
		"syscall",
		"path"
	])) return false;
	return typeof value.name === "string" && typeof value.message === "string" && (value.code === void 0 || typeof value.code === "string") && (value.syscall === void 0 || typeof value.syscall === "string") && (value.path === void 0 || typeof value.path === "string");
}
function parseErrorResult(value) {
	if (!hasExactKeys(value, ["type", "error"]) || !isSerializedRunnerError(value.error)) throw new Error("subprocess runner emitted an invalid error result");
	if (value.type !== "error") throw new Error("subprocess runner emitted an unknown error result");
	return {
		type: "error",
		error: value.error
	};
}
/**
* Create a private 0700 directory and one complete 0600 launch request.
* @param request - target cwd and complete environment for the bootstrap.
* @returns private paths owned by this launch.
*/
function createLinuxLaunchFiles(request) {
	const directory = mkdtempSync(join(tmpdir(), "dsh-subprocess-launch-"));
	const files = {
		directory,
		requestPath: join(directory, "launch-request.json"),
		startupErrorPath: join(directory, "startup-error.json")
	};
	try {
		chmodSync(directory, 448);
		writeFileSync(files.requestPath, JSON.stringify(request), {
			flag: "wx",
			mode: 384
		});
		return files;
	} catch (error) {
		cleanupLinuxLaunchFiles(files);
		throw error;
	}
}
/**
* Derive the only permitted startup-error path from an absolute request locator.
* @param requestPath - absolute path to the private launch-request file.
* @returns validated sibling paths for this launch.
*/
function linuxLaunchFilesFromLocator(requestPath) {
	if (!isAbsolute(requestPath) || basename(requestPath) !== "launch-request.json") throw new Error("subprocess runner received an invalid Linux launch-request locator");
	const directory = dirname(requestPath);
	return {
		directory,
		requestPath,
		startupErrorPath: join(directory, "startup-error.json")
	};
}
/**
* Strictly read and remove a one-shot Linux launch request.
* @param requestPath - private launch-request path to consume.
* @returns validated target cwd and environment.
*/
function consumeLinuxLaunchRequest(requestPath) {
	const text = readFileSync(requestPath, "utf8");
	unlinkSync(requestPath);
	const value = JSON.parse(text);
	if (!isRecord(value) || !hasExactKeys(value, ["cwd", "env"], ["control"]) || typeof value.cwd !== "string" || !isStringRecord(value.env) || value.control !== void 0 && value.control !== "pipe") throw new Error("subprocess runner received an invalid Linux launch request");
	return {
		cwd: value.cwd,
		env: value.env,
		...value.control === "pipe" ? { control: "pipe" } : {}
	};
}
/**
* Publish one strict 0600 Linux pre-exec error.
* @param files - private paths for this launch.
* @param error - bounded spawn or runner failure to publish.
*/
function writeLinuxStartupError(files, error) {
	writeFileSync(files.startupErrorPath, JSON.stringify(error), {
		flag: "wx",
		mode: 384
	});
}
/**
* Read the Linux pre-exec error, if the bootstrap published one.
* @param path - expected startup-error path.
* @returns the validated failure, or undefined when none was published.
*/
function readLinuxStartupError(path) {
	if (!existsSync(path)) return void 0;
	const value = JSON.parse(readFileSync(path, "utf8"));
	if (!isRecord(value)) throw new Error("subprocess runner emitted an invalid startup error");
	return parseErrorResult(value);
}
/**
* Strictly parse the single Windows start message.
* @param value - untrusted IPC payload.
* @returns validated target start request.
*/
function parseWindowsStartRequest(value) {
	if (!isRecord(value) || !hasExactKeys(value, [
		"type",
		"cwd",
		"env"
	], ["control"]) || value.type !== "start" || typeof value.cwd !== "string" || !isStringRecord(value.env) || value.control !== void 0 && value.control !== "pipe") throw new Error("subprocess runner received an invalid Windows start request");
	return {
		type: "start",
		cwd: value.cwd,
		env: value.env,
		...value.control === "pipe" ? { control: "pipe" } : {}
	};
}
/**
* Return true only for the exact, payload-free Windows terminate control.
* @param value - untrusted IPC payload.
* @returns whether the payload is the exact terminate request.
*/
function isWindowsTerminateRequest(value) {
	return isRecord(value) && hasExactKeys(value, ["type"]) && value.type === "terminate";
}
/**
* Strictly parse one of the two Windows direct-result branches.
* @param value - untrusted IPC payload.
* @returns validated direct-result message.
*/
function parseWindowsRunnerResult(value) {
	if (!isRecord(value) || typeof value.type !== "string") throw new Error("subprocess runner emitted an invalid Windows result");
	if (value.type === "error") return parseErrorResult(value);
	if (value.type === "target-exit") {
		const validExitCode = typeof value.exitCode === "number" && Number.isSafeInteger(value.exitCode) && value.exitCode >= 0;
		if (!hasExactKeys(value, ["type", "exitCode"]) || !validExitCode) throw new Error("subprocess runner emitted an invalid target-exit result");
		return {
			type: "target-exit",
			exitCode: value.exitCode
		};
	}
	throw new Error(`subprocess runner emitted an unknown Windows result: ${value.type}`);
}
/**
* Convert an unknown failure into the bounded cross-process error record.
* @param error - failure caught at the process boundary.
* @returns bounded serializable error fields.
*/
function serializeRunnerError(error) {
	const source = error instanceof Error ? error : new Error(String(error));
	const node = source;
	return {
		name: source.name,
		message: source.message,
		...typeof node.code === "string" ? { code: node.code } : {},
		...typeof node.syscall === "string" ? { syscall: node.syscall } : {},
		...typeof node.path === "string" ? { path: node.path } : {}
	};
}
/**
* Rebuild a Node-shaped Error from a strict runner record.
* @param serialized - validated bounded error fields.
* @returns reconstructed Error with supported Node fields.
*/
function deserializeRunnerError(serialized) {
	const error = new Error(serialized.message);
	error.name = serialized.name;
	return Object.assign(error, {
		...serialized.code === void 0 ? {} : { code: serialized.code },
		...serialized.syscall === void 0 ? {} : { syscall: serialized.syscall },
		...serialized.path === void 0 ? {} : { path: serialized.path }
	});
}
/**
* Best-effort removal of only the private paths created for this Linux spawn.
* @param files - exact private paths owned by this launch.
*/
function cleanupLinuxLaunchFiles(files) {
	try {
		if (lstatSync(files.directory).isSymbolicLink()) {
			unlinkSync(files.directory);
			return;
		}
		for (const path of [files.requestPath, files.startupErrorPath]) try {
			unlinkSync(path);
		} catch (error) {
			if (error.code !== "ENOENT") throw error;
		}
		rmdirSync(files.directory);
	} catch {}
}
//#endregion

export {};
