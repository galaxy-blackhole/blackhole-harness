/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/terminal.js
/** Local node-pty terminal-process implementation for the subprocess seam. */
function delay(ms, signal) {
	return new Promise((resolve) => {
		const finish = () => {
			clearTimeout(timer);
			signal?.removeEventListener("abort", finish);
			resolve();
		};
		const timer = setTimeout(finish, ms);
		signal?.addEventListener("abort", finish, { once: true });
	});
}
async function raceWithDelay(operation, ms, timeout) {
	const controller = new AbortController();
	try {
		return await Promise.race([operation, delay(ms, controller.signal).then(() => timeout)]);
	} finally {
		controller.abort();
	}
}
function signalName(number) {
	if (number === void 0 || number === 0) return null;
	for (const [name, value] of Object.entries(constants$1.signals)) if (value === number) return name;
	return null;
}
/**
* A local terminal whose native managed range or fallback process-session
* ownership stays below the PTY backend.
* The seam's terminate() promise — no write, inspection, or signal in flight
* after settlement — holds here without operation tracking only because every
* handle call completes synchronously under the hood (node-pty write, ps-based
* inspection). A first genuinely asynchronous step in any handle call must add
* the tracking a remote provider needs.
*/
var LocalTerminalHandle = class {
	terminal;
	inspector;
	graceMs;
	platform;
	managedOwner;
	resolveManagedOutcome;
	shellActivity;
	onQuiescence;
	observeShellExit;
	pid;
	output = new PassThrough();
	done;
	outcome = Promise.withResolvers();
	dataDisposable;
	exitDisposable;
	cleanup;
	managedOwnerCleaned = false;
	exited = false;
	outputPaused = false;
	trackedDescendants = [];
	activityRevision = 0;
	activityKey = "";
	quiescent = false;
	managedRangeEmpty = false;
	/** The spawned shell's start identity; scans stop adopting members once the root pid no longer carries it. */
	rootIdentity;
	/**
	* @param terminal - allocated node-pty process.
	* @param inspector - platform process/session operations.
	* @param graceMs - TERM-to-KILL and exit-wait grace.
	* @param platform - host platform; defaults to the running platform, injectable for deterministic tests.
	*/
	constructor(terminal, inspector, graceMs, platform = process.platform, managedOwner, resolveManagedOutcome, shellActivity, onQuiescence, observeShellExit = false) {
		this.terminal = terminal;
		this.inspector = inspector;
		this.graceMs = graceMs;
		this.platform = platform;
		this.managedOwner = managedOwner;
		this.resolveManagedOutcome = resolveManagedOutcome;
		this.shellActivity = shellActivity;
		this.onQuiescence = onQuiescence;
		this.observeShellExit = observeShellExit;
		this.pid = terminal.pid;
		try {
			this.rootIdentity = inspector.snapshot().tree(this.pid).find((member) => member.pid === this.pid);
		} catch (_rootIdentityUnavailable) {
			this.rootIdentity = void 0;
		}
		this.done = this.outcome.promise;
		const resume = () => {
			if (!this.outputPaused) return;
			this.outputPaused = false;
			if (!this.exited) terminal.resume();
		};
		this.output.on("drain", resume);
		this.output.once("close", () => {
			this.output.off("drain", resume);
		});
		this.dataDisposable = terminal.onData((data) => {
			if (!this.output.write(Buffer.from(data, "utf8")) && this.cleanup === void 0 && !this.outputPaused) {
				this.outputPaused = true;
				terminal.pause();
			}
		});
		this.exitDisposable = terminal.onExit(({ exitCode, signal: exitSignal }) => {
			if (this.exited) return;
			this.exited = true;
			if (this.managedOwner !== void 0 && this.observeShellExit) this.managedOwner.waitForExit().then(() => {
				this.managedRangeEmpty = true;
			}).catch(() => {});
			this.output.end();
			const outcome = {
				exitCode: exitSignal === void 0 || exitSignal === 0 ? exitCode : null,
				signal: signalName(exitSignal)
			};
			try {
				this.outcome.resolve(this.resolveManagedOutcome?.(outcome) ?? outcome);
			} catch (error) {
				this.outcome.reject(error);
			}
		});
	}
	/** Whether node-pty has not yet published the top-level exit event. */
	get running() {
		return !this.exited;
	}
	async write(data) {
		if (this.exited) throw new Error("terminal process has exited");
		this.shellActivity?.invalidate();
		this.terminal.write(data);
	}
	async resize(cols, rows) {
		if (this.exited) throw new Error("terminal process has exited");
		this.terminal.resize(cols, rows);
	}
	async inspectForeground() {
		this.descendants(this.inspector.snapshot());
		const processGroupId = this.inspector.foregroundPgid(this.pid);
		if (processGroupId === void 0) return void 0;
		return {
			processGroupId,
			inputWaiting: this.inspector.isStdinWaiting(processGroupId, this.pid)
		};
	}
	async inspectActivity() {
		let state = this.quiescent ? "idle" : "unknown";
		let revision = 0;
		if (!this.quiescent) try {
			const shell = this.shellActivity?.inspect(this.pid) ?? {
				state: "unknown",
				revision: 0
			};
			revision = shell.revision;
			const observed = this.inspector.snapshot();
			const descendants = this.descendants(observed);
			const root = observed.tree(this.pid).find((member) => member.pid === this.pid);
			if (this.exited && this.managedRangeEmpty) state = "idle";
			else if (descendants.length > 0) state = "busy";
			else if (this.exited && this.managedOwner === void 0 && this.platform === "linux" && observed.complete === true && root === void 0) state = observed.session(this.pid).some((member) => observed.alive(member)) ? "busy" : "idle";
			else if (observed.complete === true && root?.started === this.rootIdentity?.started && root !== void 0) {
				const foreground = this.inspector.foregroundPgid(this.pid);
				state = foreground === void 0 ? "unknown" : foreground === this.pid ? shell.state : "busy";
				if (state === "idle" && this.managedOwner !== void 0) {
					const tasks = this.managedOwner.inspectTaskCount?.();
					state = tasks === void 0 || tasks < 1 ? "unknown" : tasks === 1 ? "idle" : "busy";
				}
			}
		} catch (_incompleteActivityObservation) {
			state = "unknown";
		}
		const key = `${revision}:${state}`;
		if (key !== this.activityKey) {
			this.activityKey = key;
			this.activityRevision++;
		}
		return {
			state,
			revision: this.activityRevision
		};
	}
	async signalForeground(signal) {
		this.shellActivity?.invalidate();
		const foreground = await this.inspectForeground();
		if (foreground === void 0) throw new Error(`cannot resolve foreground process group for terminal ${this.pid}`);
		if (signal === "SIGKILL" && foreground.processGroupId === this.pid) throw new Error("refusing to SIGKILL the terminal shell; terminate the terminal session instead");
		if (this.platform === "win32") {
			if (signal === "SIGINT") {
				this.terminal.write("");
				return foreground.processGroupId;
			}
			if (signal === "SIGTSTP" || signal === "SIGHUP") throw new Error(`signal ${signal} is unsupported on Windows; only SIGINT, SIGTERM, and SIGKILL are available`);
		}
		this.inspector.signalGroup(foreground.processGroupId, signal);
		return foreground.processGroupId;
	}
	terminate() {
		if (this.cleanup !== void 0) return this.cleanup;
		if (this.outputPaused) {
			this.outputPaused = false;
			this.terminal.resume();
		}
		const cleanup = this.closeOnce().then(() => {
			this.quiescent = true;
			this.shellActivity?.dispose();
			this.onQuiescence?.();
		});
		this.cleanup = cleanup;
		cleanup.catch(() => {
			this.cleanup = void 0;
		});
		return cleanup;
	}
	/**
	* Force-terminate the observable session synchronously during Node's exit
	* event. This does not claim quiescence and does not replace terminate().
	*/
	terminateForHostExit() {
		this.forceStopDescendants();
		this.forceStopShell();
		this.forceStopDescendants();
		this.managedOwner?.terminateForHostExit();
	}
	forceStopShell() {
		if (this.exited) return;
		if (this.rootIdentity !== void 0) {
			try {
				this.inspector.signalProcess(this.rootIdentity, "SIGKILL");
			} catch (_rootExitedDuringHostExit) {}
			return;
		}
		try {
			this.terminal.kill("SIGKILL");
		} catch (_unidentifiedShellExitedDuringHostExit) {}
	}
	survivors(members, observed) {
		return members.filter((member) => observed.alive(member));
	}
	descendants(observed) {
		const tree = observed.tree(this.pid);
		const root = tree.find((member) => member.pid === this.pid);
		const rootVerified = this.rootIdentity !== void 0 && root !== void 0 && root.started === this.rootIdentity.started;
		this.trackedDescendants = this.survivors(this.unionMembers(this.trackedDescendants, ...rootVerified ? [tree, observed.session(this.pid)] : []).filter((member) => member.pid !== this.pid), observed);
		return this.trackedDescendants;
	}
	async waitForMembers(members) {
		if (members.length === 0) return [];
		const until = Date.now() + this.graceMs;
		let survivors = this.survivors(members, this.inspector.snapshot());
		while (survivors.length > 0 && Date.now() < until) {
			await delay(Math.min(25, Math.max(1, until - Date.now())));
			survivors = this.survivors(members, this.inspector.snapshot());
		}
		return survivors;
	}
	signalMembers(members, signal) {
		for (const member of members) try {
			this.inspector.signalProcess(member, signal);
		} catch (_alreadyExitedDuringSignal) {}
	}
	forceStopDescendants() {
		let members = this.trackedDescendants;
		try {
			members = this.descendants(this.inspector.snapshot());
		} catch (_processTableUnavailableDuringHostExit) {}
		this.signalMembers(members, "SIGKILL");
	}
	unionMembers(...groups) {
		const members = [];
		const seen = /* @__PURE__ */ new Set();
		for (const group of groups) for (const member of group) {
			const key = `${member.pid}:${member.started}`;
			if (seen.has(key)) continue;
			seen.add(key);
			members.push(member);
		}
		return members;
	}
	async stopDescendants() {
		const captured = this.descendants(this.inspector.snapshot());
		this.signalMembers(captured, "SIGTERM");
		const capturedSurvivors = await this.waitForMembers(captured);
		const members = this.unionMembers(capturedSurvivors, this.descendants(this.inspector.snapshot()));
		this.signalMembers(members, "SIGKILL");
		const survivors = await this.waitForMembers(members);
		const observed = this.inspector.snapshot();
		return this.survivors(this.unionMembers(survivors, this.descendants(observed)), observed);
	}
	async stopShell() {
		if (this.platform === "win32") {
			await this.stopShellWindows();
			return;
		}
		if (!this.exited) {
			try {
				this.terminal.kill("SIGTERM");
			} catch (_topLevelAlreadyExitedDuringTerm) {}
			await Promise.race([this.done.then(() => void 0), delay(this.graceMs)]);
		}
		if (!this.exited) {
			try {
				this.terminal.kill("SIGKILL");
			} catch (_topLevelAlreadyExitedDuringKill) {}
			await Promise.race([this.done.then(() => void 0), delay(this.graceMs)]);
		}
		if (!this.exited) throw new Error(`terminal cleanup failed; surviving pid: ${this.pid}`);
	}
	async stopShellWindows() {
		const shellGone = () => this.exited || this.rootIdentity !== void 0 && !this.inspector.isAlive(this.rootIdentity);
		if (!shellGone() && this.rootIdentity !== void 0) {
			this.inspector.signalProcess(this.rootIdentity, "SIGTERM");
			await this.waitForWindowsShellExit();
		}
		if (!shellGone() && this.rootIdentity === void 0) {
			try {
				this.terminal.kill();
			} catch (_topLevelAlreadyExitedDuringKill) {}
			await Promise.race([this.done.then(() => void 0), delay(this.graceMs)]);
		}
		if (!shellGone() && this.rootIdentity !== void 0) {
			this.inspector.signalProcess(this.rootIdentity, "SIGKILL");
			await this.waitForWindowsShellExit();
		}
		if (!shellGone()) throw new Error(`terminal cleanup failed; surviving pid: ${this.pid}`);
	}
	async waitForWindowsShellExit() {
		const until = Date.now() + this.graceMs;
		while (!this.exited && Date.now() < until) {
			if (this.rootIdentity !== void 0 && !this.inspector.isAlive(this.rootIdentity)) return;
			await delay(Math.min(25, Math.max(1, until - Date.now())));
		}
	}
	async closeOnce() {
		if (this.managedOwner !== void 0) {
			try {
				await this.closeManagedRange(this.managedOwner);
				this.dataDisposable.dispose();
				this.exitDisposable.dispose();
			} finally {
				this.done.finally(() => {
					this.cleanupManagedOwner(this.managedOwner);
				}).catch(() => {});
			}
			return;
		}
		let survivors = await this.stopDescendants();
		if (survivors.length > 0) throw new Error(`terminal cleanup failed; surviving pids: ${survivors.map((member) => member.pid).join(", ")}`);
		await this.stopShell();
		survivors = await this.stopDescendants();
		if (survivors.length > 0) throw new Error(`terminal cleanup failed; surviving pids: ${survivors.map((member) => member.pid).join(", ")}`);
		this.settleExitIfGone();
		this.dataDisposable.dispose();
		this.exitDisposable.dispose();
	}
	cleanupManagedOwner(owner) {
		if (this.managedOwnerCleaned) return;
		this.managedOwnerCleaned = true;
		owner.cleanup?.();
	}
	async closeManagedRange(owner) {
		owner.signal("SIGTERM");
		const observation = owner.waitForExit();
		const first = await raceWithDelay(observation.then(() => ({ kind: "stopped" }), (error) => ({
			kind: "failed",
			error
		})), this.graceMs, { kind: "timeout" });
		if (first.kind !== "stopped") {
			owner.signal("SIGKILL");
			if (first.kind === "failed") {
				try {
					await owner.waitForExit();
				} catch (finalError) {
					throw new AggregateError([first.error, finalError], "terminal managed-range cleanup failed");
				}
				throw first.error;
			}
			await observation;
		}
		if (!this.exited) await raceWithDelay(this.done.then(() => void 0), this.graceMs, void 0);
		if (!this.exited) throw new Error(`terminal cleanup failed; surviving pid: ${this.pid}`);
	}
	settleExitIfGone() {
		if (this.platform !== "win32") return;
		if (this.exited) return;
		/* v8 ignore next -- stopShellWindows() verified the shell is gone or threw;
		the identity re-check is a defensive fence for a future caller. */
		if (this.rootIdentity !== void 0 && this.inspector.isAlive(this.rootIdentity)) return;
		this.exited = true;
		this.output.end();
		this.outcome.resolve({
			exitCode: null,
			signal: null
		});
	}
};
//#endregion

export {};
