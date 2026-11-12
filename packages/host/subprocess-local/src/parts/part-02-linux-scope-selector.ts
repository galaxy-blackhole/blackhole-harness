/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN cua bundle goc @deepseek-ai/dsh-subprocess-local — sinh boi tools/split-stock-bundle.ts, khong sua tay
 */
// @ts-nocheck

//#region lib/types/linux-scope-selector.js
/** Linux native containment decisions over injected host observations. */
/**
* Provider-lifetime Linux scope selection. A probe runs on the first selection and again only after
* a scope launch never started its target, a different user-manager listener appears under a
* negative verdict, or the systemd-run binary changes under a positive one. A positive verdict
* confirms the user manager on every selection. Selection is synchronous, so a decision stays
* valid for the launch that follows it.
*/
var LinuxScopeSelector = class {
	observe;
	state = {
		kind: "unprobed",
		trigger: "first"
	};
	generation = 0;
	/** @param observe - host checks consulted by each selection. */
	constructor(observe) {
		this.observe = observe;
	}
	/**
	* Choose containment for one eligible launch.
	* @returns the decision and the branch that produced it.
	*/
	select() {
		const state = this.state;
		if (state.kind === "unprobed") return this.probe(state.trigger);
		if (state.kind === "available") {
			if (this.observe.launcherIdentity() !== state.launcher) return this.probe("launcher-changed");
			return this.observe.confirmManager() ? {
				kind: "scope",
				reason: "manager-confirmed",
				literalArgv: state.literalArgv,
				generation: this.generation,
				probe: void 0
			} : {
				kind: "fallback",
				reason: "manager-unconfirmed",
				probe: void 0
			};
		}
		const listener = this.observe.managerListener();
		if (listener === void 0) return {
			kind: "fallback",
			reason: "no-listener",
			probe: void 0
		};
		if (listener === state.listener) return {
			kind: "fallback",
			reason: "same-listener",
			probe: void 0
		};
		return this.probe("new-listener");
	}
	/**
	* Record that a scope launched under generation exited before its bootstrap started the target,
	* so the next selection probes again. Launches from a superseded probe are ignored.
	* @param generation - generation of the scope decision that launched it.
	*/
	scopeNotStarted(generation) {
		if (generation === this.generation) this.state = {
			kind: "unprobed",
			trigger: "scope-not-started"
		};
	}
	probe(trigger) {
		this.generation += 1;
		const listener = this.observe.managerListener();
		const launcher = this.observe.launcherIdentity();
		const literalArgv = this.observe.probe();
		if (literalArgv === void 0) {
			this.state = {
				kind: "unavailable",
				listener
			};
			return {
				kind: "fallback",
				reason: "probe-unavailable",
				probe: trigger
			};
		}
		this.state = {
			kind: "available",
			literalArgv,
			launcher
		};
		return {
			kind: "scope",
			reason: "probe-available",
			literalArgv,
			generation: this.generation,
			probe: trigger
		};
	}
};
//#endregion

export {};
