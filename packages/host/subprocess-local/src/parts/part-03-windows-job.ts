/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/windows-job.js
/** Windows parent-side launch and ownership for the private Job runner. */
function isWindowsStartCancellationError(error) {
	return error.name === "Error" && error.message === "subprocess target start was cancelled" && error.code === void 0 && error.syscall === void 0 && error.path === void 0;
}
/**
* Re-check the runner entry, bindings, and current Job capability for every spawn.
* @param internals - optional runner and Win32 capability seams used by tests.
* @returns whether the Windows native containment path is currently available.
*/
function probeWindowsJob(internals = {}) {
	try {
		const invocation = internals.runnerInvocation ?? (internals.resolveRunnerInvocation ?? spawnRunnerInvocation)();
		if (!(internals.runnerAvailable ?? runnerInvocationAvailable)(invocation)) return false;
		const api = (internals.loadWin32ProcessBindings ?? loadWin32ProcessBindings)();
		(internals.probeCurrentTokenJobSupport ?? probeCurrentTokenJobSupport)(api);
		return true;
	} catch {
		return false;
	}
}
var WindowsJobOwner = class {
	runner;
	exited;
	directResultType;
	failInfrastructure;
	cancellationReason;
	cancellationReasonSet = false;
	terminationSent = false;
	constructor(runner, exited, directResultType, failInfrastructure) {
		this.runner = runner;
		this.exited = exited;
		this.directResultType = directResultType;
		this.failInfrastructure = failInfrastructure;
		this.exited.catch(() => {});
	}
	signal(_signal, cancellationReason) {
		if (!this.cancellationReasonSet) {
			this.cancellationReason = cancellationReason;
			this.cancellationReasonSet = true;
		}
		if (this.terminationSent || !this.runner.connected) return;
		this.terminationSent = true;
		try {
			this.runner.send?.({ type: "terminate" }, (error) => {
				if (error === null || this.directResultType() !== void 0) return;
				this.failInfrastructure(error);
				this.terminateForHostExit();
			});
		} catch (error) {
			this.failInfrastructure(error);
			this.terminateForHostExit();
		}
	}
	mapStartFailure(failure, serialized) {
		return this.cancellationReasonSet && isWindowsStartCancellationError(serialized) ? this.cancellationReason : failure;
	}
	async waitForExit() {
		await this.exited;
	}
	terminateForHostExit() {
		try {
			this.runner.kill("SIGKILL");
		} catch {}
	}
};
/**
* Launch one target through a runner that uniquely owns its Job handle.
* @param spec - ordinary target request.
* @param targetEnv - validated complete target environment.
* @param internals - optional runner launch seams used by tests.
* @returns direct streams, result, and runner-owned managed range.
*/
function launchWindowsJob(spec, targetEnv, internals = {}) {
	const invocation = internals.runnerInvocation ?? spawnRunnerInvocation();
	const [command, ...prefix] = invocation;
	const ignoredStdinFd = spec.stdio.stdin === "ignore" ? openSync(devNull, "r") : void 0;
	let child;
	try {
		child = (internals.spawn ?? spawn)(command, [
			...prefix,
			"--",
			...spec.argv
		], {
			cwd: process.cwd(),
			windowsHide: true,
			env: runnerEnvironment(WINDOWS_RUNNER_SELECTION, invocation),
			stdio: runnerStdio(spec, true, ignoredStdinFd ?? "pipe")
		});
	} finally {
		if (ignoredStdinFd !== void 0) closeSync(ignoredStdinFd);
	}
	const targetStdin = child.stdio[4];
	const direct = Promise.withResolvers();
	const rangeExit = Promise.withResolvers();
	let directResultType;
	let runnerSpawned = false;
	let runnerExit;
	let ipcDisconnected = false;
	const failInfrastructure = (error) => {
		direct.reject(error);
		rangeExit.reject(error);
	};
	const settleRange = () => {
		if (!runnerSpawned || runnerExit === void 0) return;
		const { exitCode, signal } = runnerExit;
		if (exitCode === 0 && signal === null) {
			if (directResultType !== void 0) {
				rangeExit.resolve();
				return;
			}
			if (!ipcDisconnected) return;
		}
		const status = signal !== null ? `signal ${signal}` : exitCode === null ? "without an exit status" : `exit code ${String(exitCode)}`;
		failInfrastructure(/* @__PURE__ */ new Error(`subprocess-local: Windows Job runner exited with ${status} before proving its managed range empty`));
	};
	const owner = new WindowsJobOwner(child, rangeExit.promise, () => directResultType, failInfrastructure);
	child.on("message", (value) => {
		if (directResultType !== void 0) {
			failInfrastructure(/* @__PURE__ */ new Error("subprocess-local: Windows runner emitted more than one direct result"));
			owner.terminateForHostExit();
			return;
		}
		let result;
		try {
			result = parseWindowsRunnerResult(value);
		} catch (error) {
			failInfrastructure(error);
			owner.terminateForHostExit();
			return;
		}
		directResultType = result.type;
		if (result.type === "target-exit") direct.resolve({
			exitCode: result.exitCode,
			signal: null
		});
		else direct.reject(owner.mapStartFailure(deserializeRunnerError(result.error), result.error));
		settleRange();
	});
	child.once("spawn", () => {
		runnerSpawned = true;
		try {
			if (child.send === void 0) throw new Error("subprocess-local: Windows runner has no IPC channel");
			child.send({
				type: "start",
				cwd: spec.cwd,
				env: targetEnv,
				...spec.stdio.control === void 0 ? {} : { control: spec.stdio.control }
			}, (error) => {
				if (error === null) return;
				failInfrastructure(error);
				owner.terminateForHostExit();
			});
		} catch (error) {
			failInfrastructure(error);
			owner.terminateForHostExit();
		}
	});
	child.once("error", (error) => {
		if (!runnerSpawned) {
			direct.reject(error);
			rangeExit.resolve();
			return;
		}
		failInfrastructure(error);
	});
	child.once("exit", (exitCode, signal) => {
		runnerExit = {
			exitCode,
			signal
		};
		settleRange();
	});
	child.once("disconnect", () => {
		ipcDisconnected = true;
		settleRange();
	});
	return {
		stdin: spec.stdio.stdin === "ignore" ? null : targetStdin,
		stdout: child.stdio[5],
		stderr: child.stdio[6],
		control: controlPipe(child, spec.stdio.control),
		direct: direct.promise,
		owner
	};
}
//#endregion

export {};
