/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/index.js
/**
* Local Service Provider for the subprocess capability seam. Each spawn owns a
* platform-selected managed range with the spec's per-stream stdio dispositions.
* Normal disposal terminates and joins live ranges; Node's synchronous exit
* phase force-stops any ranges the service still owns. It has no config: every
* disposition and limit arrives on the spec, so deployment-varying choices
* stay with the caller's config (the bash executor's, the LSP host's, …).
* @module @deepseek-ai/dsh-subprocess-local
*/
const requireNodePty = createLazyRequire("node-pty", import.meta.url);
/**
* Local subprocess service: platform-selected managed ranges, Node-shaped stdio
* dispositions (raw pipes, inherit, bounded tail-keep collection with spill
* files), credential-scrubbed environment, and provider-owned range signalling.
* POSIX paths stage TERM before KILL; Windows paths terminate immediately.
* JavaScript-observable host exit also performs synchronous final termination.
*/
var LocalSubprocessRuntime = class extends SubprocessRuntime {
	/** Live handles retained for normal disposal and synchronous host-exit finalization. */
	live = /* @__PURE__ */ new Set();
	/** Live terminals retained through normal quiescence or host-exit finalization. */
	terminals = /* @__PURE__ */ new Set();
	/** Caller endpoints retained until close, independently of managed process lifetime. */
	controlChannels = /* @__PURE__ */ new Set();
	/** Test hook: process, spill, and platform operations forwarded to spawnSubprocess. */
	internals = {};
	/** Provider-lifetime latch suppressing repeated weaker-containment warnings. */
	fallbackWarningIssued = false;
	/**
	* Linux native containment decisions. Each probe is a spawnSync that blocks the event loop and forks the
	* host, so the selector reruns it only after an event invalidates the previous verdict.
	*/
	linuxScope = new LinuxScopeSelector({
		probe: () => probeLinuxNative(),
		managerListener: () => linuxManagerListener(),
		confirmManager: () => confirmLinuxManager(),
		launcherIdentity: () => systemdRunIdentity()
	});
	/** Scope decision of the launch in progress; selectContainmentMode sets it immediately before the launch reads it. */
	linuxScopeDecision;
	/** Test hook for platform process inspection; production resolves lazily on terminal spawn. */
	terminalInspector;
	constructor(ctx) {
		super(ctx);
		ctx.effect(() => {
			const onHostExit = () => {
				this.terminateForHostExit();
			};
			process.prependListener("exit", onHostExit);
			return async () => {
				await this.disposeManagedProcesses();
				process.off("exit", onHostExit);
			};
		}, "local subprocess teardown");
	}
	/** Spill failures reach the plugin logger; the log line is the only trace of why a result has no spill path. */
	reportSpillFailure = logSpillFailure(this.ctx.logger, "subprocess-local");
	terminateForHostExit() {
		for (const handle of this.live) try {
			handle.terminateForHostExit();
		} catch (_ordinaryRangeTerminationFailed) {}
		for (const terminal of this.terminals) try {
			terminal.terminateForHostExit();
		} catch (_terminalTerminationFailed) {}
	}
	async disposeManagedProcesses() {
		const pending = [];
		for (const handle of this.live) {
			handle.terminate();
			pending.push(Promise.all([handle.done.catch(() => {}), handle.waitForExit()]).then(() => {
				this.live.delete(handle);
			}));
		}
		for (const terminal of this.terminals) pending.push(terminal.terminate().then(() => {
			this.terminals.delete(terminal);
		}));
		const outcomes = await Promise.allSettled(pending);
		await Promise.all([...this.controlChannels].map((control) => new Promise((resolveClose) => {
			control.once("close", () => {
				resolveClose();
			});
			control.destroy();
		})));
		this.controlChannels.clear();
		const failures = [];
		for (const outcome of outcomes) if (outcome.status === "rejected") failures.push(outcome.reason);
		if (failures.length > 0) this.terminateForHostExit();
		if (failures.length === 1) throw failures[0];
		if (failures.length > 1) throw new AggregateError(failures, "local subprocess teardown failed");
	}
	async resolveExecutable(command, env, signal) {
		if (command.length === 0) throw new Error("subprocess-local: executable must be non-empty");
		signal?.throwIfAborted();
		const environment = childEnv(env);
		const absolute = isAbsolute(command);
		if (!absolute && (command.includes("/") || process.platform === "win32" && command.includes("\\"))) throw new Error(`subprocess-local: command ${JSON.stringify(command)} is a relative path; use an absolute path or a bare PATH name`);
		const candidates = absolute ? [command] : this.executableCandidates(command, environment);
		for (const candidate of candidates) {
			signal?.throwIfAborted();
			try {
				if (!(await stat(candidate)).isFile()) continue;
				await access(candidate, constants.X_OK);
				signal?.throwIfAborted();
				return candidate;
			} catch {}
		}
		signal?.throwIfAborted();
		throw new SubprocessExecutableNotFoundError(absolute ? `subprocess-local: command ${JSON.stringify(command)} is not an executable file` : `subprocess-local: command ${JSON.stringify(command)} was not found on PATH`);
	}
	executableCandidates(command, env) {
		const path = environmentValue(env, "PATH") ?? "";
		const extensions = process.platform === "win32" && extname(command) === "" ? (environmentValue(env, "PATHEXT") ?? ".COM;.EXE;.BAT;.CMD").split(";") : [""];
		return path.split(delimiter).flatMap((directory) => extensions.map((extension) => resolve(process.cwd(), directory, command + extension)));
	}
	spawn(spec) {
		validateSubprocessSpec(spec);
		const env = targetEnvironment(spec);
		const containmentMode = this.selectContainmentMode("ordinary");
		let handle;
		const internals = {
			...this.internals,
			onSpillFailure: this.reportSpillFailure
		};
		if (containmentMode === "fallback") handle = spawnSubprocess(spec, internals);
		else {
			const binding = prepareManagedProcessBinding(internals);
			const linuxScope = containmentMode === "linux-scope" ? this.linuxScopeDecision : void 0;
			handle = bindManagedProcess(spec, linuxScope === void 0 ? launchWindowsJob(spec, env) : launchLinuxScope(spec, env, linuxScope.literalArgv), binding);
			if (linuxScope !== void 0) this.watchLinuxScopeStart(handle.done, linuxScope.generation);
		}
		this.live.add(handle);
		const control = handle.control;
		if (control !== void 0) {
			this.controlChannels.add(control);
			control.once("close", () => {
				this.controlChannels.delete(control);
			});
		}
		const release = () => handle.waitForExit().then(() => {
			this.live.delete(handle);
		});
		handle.done.then(release, release).catch(() => {});
		return handle;
	}
	/** Probe again before the next launch when a scope launched under generation never started its target. */
	watchLinuxScopeStart(done, generation) {
		done.catch((error) => {
			if (error instanceof LinuxScopeNotStartedError) this.linuxScope.scopeNotStarted(generation);
		});
	}
	selectContainmentMode(kind) {
		const platform = this.internals.platform ?? process.platform;
		let fallbackReason;
		if (platform === "linux") {
			const decision = this.linuxScope.select();
			const probe = decision.probe === void 0 ? "" : `, probed after ${decision.probe}`;
			this.ctx.logger.debug(`linux native containment: ${decision.kind} (${decision.reason}${probe})`);
			if (decision.kind === "scope") {
				this.linuxScopeDecision = decision;
				return "linux-scope";
			}
			fallbackReason = "the current user-systemd scope or private bootstrap is unavailable";
		}
		if (kind === "ordinary" && platform === "win32") {
			if (probeWindowsJob()) return "windows-job";
		}
		this.warnFallback(platform, kind, fallbackReason);
		return "fallback";
	}
	warnFallback(platform, kind, selectedReason) {
		if (this.fallbackWarningIssued) return;
		this.fallbackWarningIssued = true;
		const reason = selectedReason ?? (platform === "darwin" ? "macOS has no supported persistent process-range owner" : platform === "win32" ? kind === "terminal" ? "Windows ConPTY remains outside Job containment" : "the Win32 Job runner is unavailable" : `platform ${platform} has no native managed range`);
		this.ctx.logger.warn(`subprocess-local is using weaker process-tree containment because ${reason}; descendants that escape the process group or direct-parent tree are not guaranteed to terminate or delay waitForExit()`);
	}
	/** @inheritdoc */
	async terminalEnvironment(signal) {
		signal?.throwIfAborted();
		const platform = process.platform === "win32" ? "windows" : "posix";
		const defaultShell = platform === "windows" ? process.env.ComSpec || void 0 : process.env.SHELL || userInfo().shell || void 0;
		return {
			platform,
			...defaultShell === void 0 ? {} : { defaultShell }
		};
	}
	async spawnTerminal(spec) {
		const file = spec.argv[0];
		if (file === void 0 || file.length === 0) throw new Error("subprocess-local: terminal argv must contain a program");
		spec.signal?.throwIfAborted();
		const inspector = this.terminalInspector ?? createProcessInspector();
		const containmentMode = this.selectContainmentMode("terminal");
		const env = targetEnvironment(spec);
		const platform = this.internals.platform ?? process.platform;
		const activity = prepareShellActivity(spec, env, platform);
		const launch = activity === void 0 ? spec : {
			...spec,
			argv: activity.argv,
			env: activity.env
		};
		const options = {
			name: spec.terminalType,
			rows: spec.rows,
			cols: spec.cols,
			cwd: spec.cwd,
			env: {
				...activity?.env ?? env,
				TERM: spec.terminalType
			},
			...platform === "win32" ? { useConptyDll: true } : {}
		};
		const linuxScope = containmentMode === "linux-scope" ? this.linuxScopeDecision : void 0;
		let scope;
		let terminal;
		try {
			scope = linuxScope === void 0 ? void 0 : prepareLinuxTerminalScope(launch, {
				...activity?.env ?? env,
				PWD: spec.cwd,
				TERM: spec.terminalType
			}, linuxScope.literalArgv);
			if (scope !== void 0) {
				options.cwd = scope.cwd;
				options.env = scope.env;
			}
			terminal = requireNodePty().spawn(scope?.command ?? file, scope?.args ?? [...launch.argv.slice(1)], options);
		} catch (error) {
			scope?.cleanup();
			activity?.dispose();
			throw error;
		}
		let handle;
		const directSettlement = Promise.withResolvers();
		const owner = scope?.bindOwner({
			running: () => handle?.running ?? true,
			settled: directSettlement.promise,
			signal: (signal) => signalLinuxDirectProcess(terminal.pid, () => process.kill(terminal.pid, signal))
		});
		handle = new LocalTerminalHandle(terminal, inspector, spec.graceMs, platform, owner, scope?.resolveOutcome, activity, () => {
			this.terminals.delete(handle);
		}, spec.shellActivity === true);
		this.terminals.add(handle);
		if (linuxScope !== void 0) this.watchLinuxScopeStart(handle.done, linuxScope.generation);
		const release = async () => {
			directSettlement.resolve();
			if (spec.shellActivity === true) return;
			await handle.terminate();
			this.terminals.delete(handle);
		};
		handle.done.then(release, release).catch(() => {});
		return handle;
	}
};
/** Read a Windows environment key using the platform's case-insensitive semantics. */
function environmentValue(env, name) {
	const exact = env[name];
	if (exact !== void 0 || process.platform !== "win32") return exact;
	const normalized = name.toUpperCase();
	return Object.entries(env).find(([key]) => key.toUpperCase() === normalized)?.[1];
}
//#endregion

export {};
