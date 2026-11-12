/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/windows-inspector.js
/**
* Windows process-table operations for terminal readiness, signalling, and
* teardown: Toolhelp32 snapshot enumeration with GetProcessTimes creation-time
* identity and process-handle wait-state liveness, the shell pid as a pseudo
* process group (Windows has no POSIX groups), and taskkill tree signalling.
* The koffi bindings load lazily so
* non-Windows processes never touch Win32 libraries; all decision logic takes
* an injectable internals boundary so suites can pin it on any host.
* @module dsh-subprocess-local/windows-inspector
*/
const requireKoffi$1 = createLazyRequire("koffi", import.meta.url);
/**
* Walk a process table from one root in children-first order, retaining only
* members whose start identity is readable (unreadable members are detector
* misses, exactly like an unreadable `/proc` entry on Linux).
* @param entries - the process table snapshot.
* @param rootPid - the tree root to descend from.
* @param started - creation-time identity resolver for one member.
* @returns the root and its current transitive descendants, children first.
*/
function windowsProcessTree(entries, rootPid, started) {
	const root = new Map(entries.map((entry) => [entry.pid, entry])).get(rootPid);
	if (root === void 0) return [];
	const byParent = /* @__PURE__ */ new Map();
	for (const entry of entries) {
		const children = byParent.get(entry.parentPid) ?? [];
		children.push(entry);
		byParent.set(entry.parentPid, children);
	}
	const visited = /* @__PURE__ */ new Set();
	const result = [];
	const visit = (entry) => {
		if (visited.has(entry.pid)) return;
		visited.add(entry.pid);
		for (const child of byParent.get(entry.pid) ?? []) visit(child);
		const identity = started(entry.pid);
		if (identity !== void 0) result.push({
			pid: entry.pid,
			started: identity
		});
	};
	visit(root);
	return result;
}
/**
* Windows {@link ProcessInspector}. The shell pid stands in for a foreground
* process group: it is a stable pseudo-group that lets the prompt-marker
* readiness path compare foreground identities, while every actual signal
* targets the console-wide tree through taskkill (SIGINT is delivered by the
* terminal handle as a `\x03` input write and never reaches this layer).
*/
var WindowsProcessInspector = class {
	internals;
	constructor(internals = defaultWindowsProcessInternals()) {
		this.internals = internals;
	}
	foregroundPgid(shellPid) {
		return shellPid;
	}
	isStdinWaiting(_pgid, _shellPid) {
		return false;
	}
	isAlive(identity) {
		const state = this.internals.processState(identity.pid);
		return state?.active === true && state.started === identity.started;
	}
	snapshot() {
		let entries;
		return {
			tree: (rootPid) => windowsProcessTree(entries ??= this.internals.snapshot(), rootPid, (pid) => this.internals.processState(pid)?.started),
			session: () => [],
			alive: (identity) => this.isAlive(identity)
		};
	}
	signalGroup(pgid, signal) {
		this.internals.taskkill(pgid, signal === "SIGKILL");
	}
	signalProcess(identity, signal) {
		if (this.isAlive(identity)) this.internals.taskkill(identity.pid, signal === "SIGKILL");
	}
};
/**
* Create the Windows process inspector.
* @param internals - injectable process operations; defaults to the koffi-backed table.
* @returns the Windows inspector.
*/
function createWindowsProcessInspector(internals = defaultWindowsProcessInternals()) {
	return new WindowsProcessInspector(internals);
}
/** Terminate one Windows process tree with taskkill, contained like POSIX group signalling. */
function taskkillTree(pid, force) {
	if (pid <= 0) return;
	spawnSync("taskkill", [
		"/PID",
		String(pid),
		"/T",
		...force ? ["/F"] : []
	], {
		stdio: "ignore",
		windowsHide: true
	});
}
/**
* True for NULL and INVALID_HANDLE_VALUE returns from Win32 handle APIs.
* @param value - a handle as koffi may hand it back (pointer, null, or 0n).
* @returns whether the value signals an invalid handle.
*/
function isInvalidHandle(value) {
	if (value === null || value === void 0) return true;
	const asBigInt = value;
	return asBigInt === 0n || asBigInt === 18446744073709551615n || asBigInt === -1n;
}
/**
* Resolve the koffi Win32 struct types once. Registration is lazy and cached
* because koffi's type registry is global per process: test runners that
* re-evaluate this module (a hoisted `vi.mock` re-imports the graph) must not
* re-register the names.
*/
function win32Structs() {
	if (cachedStructs !== void 0) return cachedStructs;
	const koffi = requireKoffi$1();
	const PVOID = koffi.pointer("void");
	const PROCESSENTRY32W = koffi.struct("PROCESSENTRY32W", {
		dwSize: "uint32",
		cntUsage: "uint32",
		th32ProcessID: "uint32",
		th32DefaultHeapID: PVOID,
		th32ModuleID: "uint32",
		cCntThreads: "uint32",
		th32ParentProcessID: "uint32",
		pcPriClassBase: "int32",
		dwFlags: "uint32",
		szExeFile: koffi.array("char16", 260)
	});
	const FILETIME = koffi.struct("FILETIME", {
		dwLowDateTime: "uint32",
		dwHighDateTime: "uint32"
	});
	/* v8 ignore start -- a layout-mismatch guard fires only on ABI breakage; the windows-native suites exercise the real struct. */
	if (PROCESSENTRY32W.size !== 568) throw new Error(`PROCESSENTRY32W layout mismatch: koffi computed ${PROCESSENTRY32W.size}, Windows headers say 568`);
	/* v8 ignore stop */
	cachedStructs = {
		PVOID,
		PROCESSENTRY32W,
		FILETIME
	};
	return cachedStructs;
}
let cachedStructs;
const TH32CS_SNAPPROCESS = 2;
const WAIT_OBJECT_0 = 0;
const WAIT_TIMEOUT = 258;
let cachedBindings;
/**
* Resolve the lazy Win32 bindings (throws the first binding failure, fail-closed).
* @returns the cached binding table.
*/
function win32Bindings() {
	if (cachedBindings !== void 0) return cachedBindings;
	const koffi = requireKoffi$1();
	const { PVOID, PROCESSENTRY32W, FILETIME } = win32Structs();
	const kernel32 = koffi.load("kernel32.dll");
	const bind = (name, result, args) => kernel32.func("__stdcall", name, result, args);
	cachedBindings = {
		createToolhelp32Snapshot: bind("CreateToolhelp32Snapshot", PVOID, ["uint32", "uint32"]),
		process32FirstW: bind("Process32FirstW", "int", [PVOID, koffi.pointer(PROCESSENTRY32W)]),
		process32NextW: bind("Process32NextW", "int", [PVOID, koffi.pointer(PROCESSENTRY32W)]),
		openProcess: bind("OpenProcess", PVOID, [
			"uint32",
			"int",
			"uint32"
		]),
		getProcessTimes: bind("GetProcessTimes", "int", [
			PVOID,
			koffi.pointer(FILETIME),
			koffi.pointer(FILETIME),
			koffi.pointer(FILETIME),
			koffi.pointer(FILETIME)
		]),
		waitForSingleObject: bind("WaitForSingleObject", "uint32", [PVOID, "uint32"]),
		closeHandle: bind("CloseHandle", "int", [PVOID])
	};
	return cachedBindings;
}
/**
* Allocate koffi memory as a branded {@link NativePtr}; koffi's TS types are
* `any`, so the cast goes through `unknown` to keep the unsafe surface here.
* @param type - the koffi type to allocate.
* @param count - element count.
* @returns the branded allocation pointer.
*/
function allocNative(type, count) {
	return requireKoffi$1().alloc(type, count);
}
/** Enumerate the current process table through Toolhelp32. */
function snapshotWindowsProcesses(bindings) {
	const koffi = requireKoffi$1();
	const { PROCESSENTRY32W } = win32Structs();
	const snapshot = bindings.createToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
	/* v8 ignore next -- an invalid snapshot for the process flag is not producible through the public API;
	the guard mirrors POSIX's unreadable-proc tolerance and isInvalidHandle is unit-tested. */
	if (isInvalidHandle(snapshot)) return [];
	const entries = [];
	try {
		const entry = allocNative(PROCESSENTRY32W, 1);
		koffi.encode(entry, "uint32", PROCESSENTRY32W.size);
		let ok = bindings.process32FirstW(snapshot, entry);
		while (ok !== 0) {
			const record = koffi.decode(entry, PROCESSENTRY32W);
			entries.push({
				pid: record.th32ProcessID,
				parentPid: record.th32ParentProcessID
			});
			ok = bindings.process32NextW(snapshot, entry);
		}
	} finally {
		bindings.closeHandle(snapshot);
	}
	return entries;
}
/** Read one process's creation identity and current wait state. */
function windowsProcessState(bindings, pid) {
	const koffi = requireKoffi$1();
	const { FILETIME } = win32Structs();
	const handle = bindings.openProcess(1052672, 0, pid);
	if (isInvalidHandle(handle)) return void 0;
	try {
		const creation = allocNative(FILETIME, 1);
		const exit = allocNative(FILETIME, 1);
		const kernel = allocNative(FILETIME, 1);
		const user = allocNative(FILETIME, 1);
		/* v8 ignore next -- a GetProcessTimes failure after a successful open races process exit and
		cannot be staged deterministically; the absent-process path is covered and the caller
		treats undefined as a detector miss. */
		if (bindings.getProcessTimes(handle, creation, exit, kernel, user) === 0) return void 0;
		const record = koffi.decode(creation, FILETIME);
		const wait = bindings.waitForSingleObject(handle, 0);
		/* v8 ignore next -- an opened process handle has exactly one of these two
		zero-time wait states; an unexpected Win32 failure is an unreadable process. */
		if (wait !== WAIT_OBJECT_0 && wait !== WAIT_TIMEOUT) return void 0;
		return {
			started: `${record.dwHighDateTime}:${record.dwLowDateTime}`,
			active: wait === WAIT_TIMEOUT
		};
	} finally {
		bindings.closeHandle(handle);
	}
}
/** The koffi-backed default internals; bindings resolve lazily on first use. */
function defaultWindowsProcessInternals() {
	return {
		snapshot: () => snapshotWindowsProcesses(win32Bindings()),
		processState: (pid) => windowsProcessState(win32Bindings(), pid),
		taskkill: taskkillTree
	};
}
//#endregion

export {};
