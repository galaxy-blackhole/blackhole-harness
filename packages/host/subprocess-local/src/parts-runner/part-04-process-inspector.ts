/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/process-inspector.js
/** Platform process-table inspection for terminal readiness, signals, and teardown. */
/* v8 ignore start -- thin OS bindings; injected logic is unit-tested and real platform composition exercises them. */
const DEFAULT_INTERNALS = {
	readFile: (path) => readFileSync(path, "utf8"),
	readDir: (path) => readdirSync(path),
	readLink: (path) => readlinkSync(path, "utf8"),
	stat: (path) => statSync(path),
	open: (path) => openSync(path, "r"),
	read: (fd, buffer, length, position) => readSync(fd, buffer, 0, length, position),
	close: closeSync,
	exec: (file, args) => execFileSync(file, args, { encoding: "utf8" }),
	kill: (pid, signal) => process.kill(pid, signal)
};
/**
* Parse fields used from Linux `/proc/<pid>/stat`, including parenthesized comm text.
* @param text - complete stat line.
* @returns Parsed identity/group fields, or undefined for malformed input.
*/
function parseProcStat(text) {
	const open = text.indexOf("(");
	const close = text.lastIndexOf(")");
	if (open <= 0 || close <= open) return void 0;
	const pid = Number(text.slice(0, open).trim());
	const rest = text.slice(close + 2).trim().split(/\s+/);
	const state = rest[0] || "";
	const parentPid = Number(rest[1]);
	const pgrp = Number(rest[2]);
	const session = Number(rest[3]);
	const ttyDevice = Number(rest[4]);
	const tpgid = Number(rest[5]);
	const started = rest[19];
	if (![
		pid,
		parentPid,
		pgrp,
		session,
		ttyDevice,
		tpgid
	].every(Number.isSafeInteger) || state.length !== 1 || started === void 0) return void 0;
	return {
		pid,
		parentPid,
		pgrp,
		session,
		state,
		ttyDevice,
		tpgid,
		started
	};
}
function readLinuxStat(internals, pid) {
	try {
		return parseProcStat(internals.readFile(`/proc/${pid}/stat`));
	} catch (_unreadableProcEntry) {
		return;
	}
}
function linuxDeviceNumber(value) {
	return value >>> 0;
}
function readLinuxTerminalDevice(internals, pid, ttyDevice, tid) {
	const terminalDevice = linuxDeviceNumber(ttyDevice);
	if (terminalDevice === 0) return void 0;
	const path = tid === void 0 ? `/proc/${pid}/fd/0` : `/proc/${pid}/task/${tid}/fd/0`;
	try {
		if (internals.readLink(path) === "/dev/tty") return terminalDevice;
		const status = internals.stat(path);
		return status.isCharacterDevice() && linuxDeviceNumber(status.rdev) === terminalDevice ? terminalDevice : void 0;
	} catch (_unreadableStdinDevice) {
		return;
	}
}
/**
* Report whether a Linux process group has an executing member. `false`
* means the group contains only zombie/dead entries; `undefined` means the
* process table could not prove either outcome.
* @param processGroupId - POSIX process-group id to inspect.
* @param internals - injectable process-table operations.
* @returns Live-member presence, or `undefined` when unavailable/absent.
*/
function linuxProcessGroupHasLiveMembers(processGroupId, internals = DEFAULT_INTERNALS) {
	let entries;
	try {
		entries = internals.readDir("/proc");
	} catch (_unreadableProcDirectory) {
		return;
	}
	let matched = false;
	for (const entry of entries) {
		if (!/^\d+$/.test(entry)) continue;
		const stat = readLinuxStat(internals, Number(entry));
		if (stat?.pgrp !== processGroupId) continue;
		matched = true;
		if (!/^[ZXx]$/.test(stat.state)) return true;
	}
	return matched ? false : void 0;
}
function numericEntries(internals, path) {
	try {
		return internals.readDir(path).filter((entry) => /^\d+$/.test(entry)).map(Number);
	} catch (_unreadableProcDirectory) {
		return;
	}
}
function readSyscall(internals, pid, tid) {
	try {
		const text = internals.readFile(`/proc/${pid}/task/${tid}/syscall`).trim();
		if (text === "running" || text.startsWith("-1 ")) return void 0;
		const fields = text.split(/\s+/);
		const number = Number(fields[0]);
		const args = fields.slice(1, 7).map((field) => Number.parseInt(field, 16));
		if (!Number.isSafeInteger(number) || args.some((value) => !Number.isSafeInteger(value))) return void 0;
		return {
			number,
			args
		};
	} catch (_unreadableSyscall) {
		return;
	}
}
function readMemory(internals, pid, address, length) {
	let fd;
	try {
		fd = internals.open(`/proc/${pid}/mem`);
		const buffer = Buffer.alloc(length);
		const count = internals.read(fd, buffer, length, address);
		return buffer.subarray(0, count);
	} catch (_unreadableProcessMemory) {
		return;
	} finally {
		if (fd !== void 0) internals.close(fd);
	}
}
function fdSetHasStdin(internals, pid, address) {
	return address !== 0 && (readMemory(internals, pid, address, 8)?.[0] ?? 0) % 2 === 1;
}
function pollHasStdin(internals, pid, address, count) {
	if (address === 0 || count <= 0) return false;
	const memory = readMemory(internals, pid, address, Math.min(count, 1024) * 8);
	if (memory === void 0) return false;
	for (let offset = 0; offset + 8 <= memory.length; offset += 8) if (memory.readInt32LE(offset) === 0 && (memory.readInt16LE(offset + 4) & 1) !== 0) return true;
	return false;
}
function epollHasStdin(internals, pid, tid, epfd) {
	try {
		return internals.readFile(`/proc/${pid}/task/${tid}/fdinfo/${epfd}`).split("\n").some((line) => /^tfd:\s+0\b/.test(line.trim()));
	} catch (_unreadableFdInfo) {
		return false;
	}
}
const SYSCALLS = {
	x64: {
		read: 0,
		select: 23,
		pselect: 270,
		poll: 7,
		ppoll: 271,
		epollWait: 232,
		epollPwait: 281
	},
	arm64: {
		read: 63,
		pselect: 72,
		ppoll: 73,
		epollPwait: 22
	}
};
const SUPPORTED_SYSCALL_TABLES = Object.values(SYSCALLS);
function linuxSyscallTables(arch) {
	const primary = SYSCALLS[arch];
	if (primary === void 0) return void 0;
	return [primary, ...SUPPORTED_SYSCALL_TABLES.filter((table) => table !== primary)];
}
function syscallWaitsOnStdin(internals, pid, tid, syscall, tables) {
	const [a0 = 0, a1 = 0, a2 = 0] = syscall.args;
	for (const table of tables) {
		if (syscall.number === table.read) return a0 === 0;
		if (syscall.number === table.select || syscall.number === table.pselect) return a0 >= 1 && fdSetHasStdin(internals, pid, a1);
		if (syscall.number === table.poll || syscall.number === table.ppoll) return a1 >= 1 && pollHasStdin(internals, pid, a0, a1);
		if (syscall.number === table.epollWait || syscall.number === table.epollPwait) return a2 >= 1 && epollHasStdin(internals, pid, tid, a0);
	}
	return false;
}
var PosixProcessInspector = class {
	internals;
	constructor(internals) {
		this.internals = internals;
	}
	signalGroup(pgid, signal) {
		this.internals.kill(-pgid, signal);
	}
	signalProcess(identity, signal) {
		if (this.isAlive(identity)) this.internals.kill(identity.pid, signal);
	}
};
function quiescent(state) {
	return state !== void 0 && /^[ZXx]$/.test(state);
}
var PosixProcessSnapshot = class {
	rows;
	complete;
	byPid;
	constructor(rows, complete) {
		this.rows = rows;
		this.complete = complete;
		this.byPid = new Map(rows.map((row) => [row.pid, row]));
	}
	tree(rootPid) {
		return processTree(this.rows, rootPid);
	}
	session(sessionId) {
		return this.rows.flatMap((row) => row.session === sessionId ? [{
			pid: row.pid,
			started: row.started
		}] : []);
	}
	alive(identity) {
		const row = this.byPid.get(identity.pid);
		return row?.started === identity.started && !quiescent(row.state);
	}
};
function processTree(entries, rootPid) {
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
		result.push({
			pid: entry.pid,
			started: entry.started
		});
	};
	visit(root);
	return result;
}
var LinuxProcessInspector = class extends PosixProcessInspector {
	arch;
	constructor(arch, internals) {
		super(internals);
		this.arch = arch;
	}
	foregroundPgid(shellPid) {
		const tpgid = readLinuxStat(this.internals, shellPid)?.tpgid;
		return tpgid !== void 0 && tpgid > 0 ? tpgid : void 0;
	}
	isStdinWaiting(pgid, shellPid) {
		const tables = linuxSyscallTables(this.arch);
		if (tables === void 0) return false;
		const shell = readLinuxStat(this.internals, shellPid);
		if (shell === void 0) return false;
		const terminalDevice = readLinuxTerminalDevice(this.internals, shellPid, shell.ttyDevice);
		if (terminalDevice === void 0) return false;
		for (const pid of numericEntries(this.internals, "/proc") ?? []) {
			const process = readLinuxStat(this.internals, pid);
			if (process?.pgrp !== pgid) continue;
			for (const tid of numericEntries(this.internals, `/proc/${pid}/task`) ?? []) {
				const syscall = readSyscall(this.internals, pid, tid);
				if (syscall !== void 0 && syscallWaitsOnStdin(this.internals, pid, tid, syscall, tables) && readLinuxTerminalDevice(this.internals, pid, process.ttyDevice, tid) === terminalDevice) return true;
			}
		}
		return false;
	}
	isAlive(identity) {
		const stat = readLinuxStat(this.internals, identity.pid);
		return stat?.started === identity.started && !quiescent(stat.state);
	}
	snapshot() {
		const pids = numericEntries(this.internals, "/proc");
		if (pids === void 0) throw new Error("Cannot inspect processes: /proc directory is unreadable");
		let complete = true;
		return new PosixProcessSnapshot(pids.flatMap((pid) => {
			const stat = readLinuxStat(this.internals, pid);
			if (stat === void 0) complete = false;
			return stat === void 0 ? [] : [{
				pid,
				parentPid: stat.parentPid,
				started: stat.started,
				session: stat.session,
				state: stat.state
			}];
		}), complete);
	}
};
function macProcessTable(internals) {
	let complete = true;
	return {
		rows: internals.exec("/bin/ps", ["-axo", "pid=,ppid=,lstart="]).split("\n").flatMap((line) => {
			const match = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
			if (match?.[1] === void 0 || match[2] === void 0 || match[3] === void 0) {
				if (line.trim().length > 0) complete = false;
				return [];
			}
			return [{
				pid: Number(match[1]),
				parentPid: Number(match[2]),
				started: match[3],
				session: void 0,
				state: void 0
			}];
		}),
		complete
	};
}
var MacProcessInspector = class extends PosixProcessInspector {
	foregroundPgid(shellPid) {
		try {
			const value = Number(this.internals.exec("/bin/ps", [
				"-o",
				"tpgid=",
				"-p",
				String(shellPid)
			]).trim());
			return Number.isSafeInteger(value) && value > 0 ? value : void 0;
		} catch (_missingProcess) {
			return;
		}
	}
	isStdinWaiting(_pgid, _shellPid) {
		return false;
	}
	isAlive(identity) {
		return macProcessTable(this.internals).rows.some((entry) => entry.pid === identity.pid && entry.started === identity.started);
	}
	snapshot() {
		const table = macProcessTable(this.internals);
		return new PosixProcessSnapshot(table.rows, table.complete);
	}
};
/**
* Create the supported platform inspector or fail at plugin load.
* @param platform - target Node platform.
* @param arch - target CPU architecture for Linux syscall numbers.
* @param internals - filesystem/process boundary, injectable for deterministic tests.
* @returns Platform process inspector.
*/
function createProcessInspector(platform = process.platform, arch = process.arch, internals = DEFAULT_INTERNALS) {
	if (platform === "linux") return new LinuxProcessInspector(arch, internals);
	if (platform === "darwin") return new MacProcessInspector(internals);
	if (platform === "win32") return createWindowsProcessInspector();
	throw new Error(`subprocess-local: terminal inspection is unsupported on platform ${platform}`);
}
//#endregion

export {};
