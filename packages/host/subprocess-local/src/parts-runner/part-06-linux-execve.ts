/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/linux-execve.js
/** Lazy libc execve and descriptor bindings used by the one-shot Linux bootstrap. */
const requireKoffi = createLazyRequire("koffi", import.meta.url);
const STANDARD_FILE_DESCRIPTORS = [
	0,
	1,
	2
];
const F_GETFD = 1;
const F_SETFD = 2;
const FD_CLOEXEC = 1;
let cachedExecve;
function systemError(errno, syscall, path) {
	const uvError = -errno;
	const code = getSystemErrorName(uvError);
	const detail = getSystemErrorMessage(uvError);
	const subject = path === void 0 ? syscall : `${syscall} '${path}'`;
	const error = Object.assign(/* @__PURE__ */ new Error(`${code}: ${detail}, ${subject}`), {
		code,
		errno: uvError,
		syscall
	});
	return path === void 0 ? error : Object.assign(error, { path });
}
/**
* Load libc's execve and fcntl symbols on first use and retain the native bindings.
* @returns a process-replacing execve operation that throws Node-style errors on failure.
*/
function loadLinuxExecve() {
	if (cachedExecve !== void 0) return cachedExecve;
	const koffi = requireKoffi();
	const libc = koffi.load(null);
	const nativeExecve = libc.func("int execve(const char *pathname, const char **argv, const char **envp)");
	const nativeFcntl = libc.func("int fcntl(int fd, int cmd, int arg)");
	cachedExecve = (file, argv, env, control) => {
		const descriptors = control === "pipe" ? [...STANDARD_FILE_DESCRIPTORS, SUBPROCESS_CONTROL_FD] : STANDARD_FILE_DESCRIPTORS;
		for (const fd of descriptors) {
			const flags = nativeFcntl(fd, F_GETFD, 0);
			if (flags === -1) throw systemError(koffi.errno(), "fcntl");
			if ((flags & FD_CLOEXEC) === 0) continue;
			if (nativeFcntl(fd, F_SETFD, flags & -2) === -1) throw systemError(koffi.errno(), "fcntl");
		}
		nativeExecve(file, [...argv, null], [...Object.entries(env).map(([key, value]) => `${key}=${value}`), null]);
		throw systemError(koffi.errno(), "execve", file);
	};
	return cachedExecve;
}
//#endregion

export {};
