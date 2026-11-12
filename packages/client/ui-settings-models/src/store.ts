/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Kho trang thai cua trang Models (gop thu muc nha cung cap · settings · credentials)
 */

import * as storeModule from "@galaxy-blackhole/gbh-client-store";

/** Kho trang thai ngoai React cua DSH. */
const _deepseek_ai_dsh_client_store: any = storeModule;

/**
* Models settings page store: one snapshot joining the configurable-provider
* directory (`llm/listProviders` joined with `llm/listConfigurableProviders`),
* the settings namespaces (shared settings mirror),
* and the referenced credentials (`credentials/describe`). The host stays the
* single fact source — every mutation writes through the wire and the page
* re-renders from the next describe, pushed or refetched.
*/
/**
* Any route key walks a dict schema to the same profile node, so the lookup
* names one that cannot collide with a configured route.
*/
const PROBE_ROUTE = "\0probe";
/**
* Join declared configurable providers with the currently registered routes.
* @param registered - live provider routes in registration order.
* @param directory - declared configurable providers in declaration order.
* @returns account and official routes first, then other routes in their original order.
*/
function joinProviderDirectory(registered: any, directory: any) {
	const active = new Set(registered.map((provider: any) => provider.id));
	const declared = new Set(directory.map((entry: any) => entry.provider));
	const rows = directory.map((entry: any) => ({
		provider: entry.provider,
		displayName: entry.displayName,
		settingsNs: entry.settingsNs,
		settingsPath: [...entry.settingsPath],
		active: active.has(entry.provider),
		...entry.declared === void 0 ? {} : { declared: entry.declared },
		...entry.defaultBaseURL === void 0 ? {} : { defaultBaseURL: entry.defaultBaseURL },
		...entry.baseURLEnv === void 0 ? {} : { baseURLEnv: entry.baseURLEnv },
		...entry.nativeAuth === void 0 ? {} : { nativeAuth: entry.nativeAuth },
		...entry.error === void 0 ? {} : { error: entry.error }
	}));
	for (const provider of registered) {
		if (declared.has(provider.id)) continue;
		rows.push({
			provider: provider.id,
			displayName: provider.name,
			settingsNs: "",
			settingsPath: [],
			active: true
		});
	}
	return rows.toSorted((left: any, right: any) => (left.provider === "deepseek-account" ? 0 : left.provider === "deepseek-official" ? 1 : 2) - (right.provider === "deepseek-account" ? 0 : right.provider === "deepseek-official" ? 1 : 2));
}
/**
* Derive the conventional credential reference for a provider route: the v1
* page never asks for an environment-variable name, so a typed key stores
* under this derived reference and the profile records it as `apiKeyEnv`.
* @param provider - provider route id (e.g. `anthropic`, `minimax-cn`).
* @returns the derived reference name (e.g. `MINIMAX_CN_API_KEY`).
*/
export function deriveKeyRef(provider: any) {
	return `${provider.toUpperCase().replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
}
/**
* The wire protocols a hand-declared route may name, read out of the owning
* namespace's own schema. This stays a schema read rather than a wire field so
* the choices the page offers cannot drift from the ones the adapter accepts:
* both come from the same `Config`.
* @param namespace - the namespace view whose schema declares the profile shape.
* @param schema - settings schema operations.
* @returns the protocol identifiers, or an empty list when the schema has none.
*/
export function protocolChoices(namespace: any, schema: any) {
	if (namespace === void 0) return [];
	const list = schema.nodeAtPath(schema.rehydrate(namespace.schema), [
		"providers",
		PROBE_ROUTE,
		"api"
	]);
	if (list?.type !== "union" || list.list === void 0) return [];
	return list.list.map((entry: any) => entry.value).filter((value: any) => typeof value === "string");
}
/**
* The reasoning levels a hand-declared route's models may declare, read out of
* the owning namespace's own schema for the same reason as
* {@link protocolChoices}: the levels the page offers and the keys the
* adapter accepts in `reasoningEfforts` come from the same `Config`.
* @param namespace - the namespace view whose schema declares the profile shape.
* @param schema - settings schema operations.
* @returns the levels in the schema's escalation order, or an empty list when the schema has none.
*/
export function reasoningLevelChoices(namespace: any, schema: any) {
	if (namespace === void 0) return [];
	const path = [
		"providers",
		PROBE_ROUTE,
		"models",
		"0",
		"reasoningEfforts"
	];
	return (((schema.nodeAtPath(schema.rehydrate(namespace.schema), path)?.list ?? []).find((branch: any) => branch.type === "dict")?.sKey)?.list ?? []).map((entry: any) => entry.value).filter((value: any) => typeof value === "string");
}
/** The credential reference a resolved profile names (its `apiKeyEnv` field). */
function apiKeyEnvOf(namespace: any, path: any, schema: any) {
	if (namespace === void 0) return void 0;
	const profile = schema.getPath(namespace.value, path);
	if (typeof profile !== "object" || profile === null) return void 0;
	const ref = profile.apiKeyEnv;
	return typeof ref === "string" && ref.length > 0 ? ref : void 0;
}
/** The models settings page controller (one per settings surface). */
export var ModelsSettingsStore = class {
	ctx;
	schema;
	describeFace;
	/** The snapshot the section renders from (uSES-safe store). */
	store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
		status: "idle",
		error: null,
		credentialError: null,
		writable: false,
		rows: [],
		namespaces: /* @__PURE__ */ new Map()
	});
	/** Latest load wins; an older response never overwrites a newer one. */
	generation = 0;
	/** Callers follow the current refresh's outcome, including callers whose read was superseded. */
	pendingLoads = /* @__PURE__ */ new Set();
	/**
	* @param ctx - the page plugin's context, whose `remote.llm` and
	* `remote.credentials` namespaces carry the directory and credential reads.
	* @param schema - settings-owned schema and immutable path operations.
	* @param describeFace - the shared mirror's describe face (namespace views and writability).
	*/
	constructor(ctx: any, schema: any, describeFace: any) {
		this.ctx = ctx;
		this.schema = schema;
		this.describeFace = describeFace;
	}
	/**
	* Refresh the whole page snapshot: the provider directory and the mirror's
	* settings answer in parallel, then one batched credential describe over
	* every referenced ref. Provider failure or absence of an initial settings
	* answer keeps the last good rows and surfaces an error; a failed settings
	* refresh reuses the mirror's held view. Concurrent callers resolve only
	* after the current refresh publishes its ready or error snapshot.
	* @returns resolution after the current snapshot is published.
	* @throws the current read's unexpected rejection; superseded rejections are ignored.
	*/
	load() {
		const pending = Promise.withResolvers();
		this.pendingLoads.add(pending);
		const generation = ++this.generation;
		this.read(generation).then(() => {
			this.settleLoads(generation, (load: any) => {
				load.resolve();
			});
		}, (error) => {
			this.settleLoads(generation, (load: any) => {
				load.reject(error);
			});
		});
		return pending.promise;
	}
	/** Publish one joined answer; stale answers leave the current refresh in charge. */
	async read(generation: any) {
		this.store.update((s: any) => {
			s.status = "loading";
			s.error = null;
		});
		const [registered, declared] = await Promise.all([
			this.ctx.remote.llm.listProviders(),
			this.ctx.remote.llm.listConfigurableProviders(),
			this.describeFace.ensure()
		]);
		if (generation !== this.generation) return;
		if (!registered.ok) {
			this.failLoad(registered.error.message);
			return;
		}
		if (!declared.ok) {
			this.failLoad(declared.error.message);
			return;
		}
		const mirrored = this.describeFace.getSnapshot();
		if (mirrored.view === void 0) {
			/* v8 ignore next -- SettingsDescribeFace.ensure settles with a view or the read's error */
			if (mirrored.error === null) throw new Error("settings describe settled with neither a view nor an error");
			this.failLoad(mirrored.error);
			return;
		}
		const providers = joinProviderDirectory(registered.value, declared.value);
		const writable = mirrored.view.writable;
		const views = mirrored.view.namespaces;
		const namespaces = new Map<string, any>(views.map((view: any) => [view.ns, view] as [string, any]));
		const rows = providers.map((entry: any) => {
			const namespace = namespaces.get(entry.settingsNs);
			return {
				entry,
				configured: namespace !== void 0 && (entry.settingsPath.length === 0 || this.schema.getPath(namespace.value, entry.settingsPath) !== void 0),
				removable: namespace !== void 0 && entry.settingsPath.length > 0 && this.schema.hasPath(namespace.user, entry.settingsPath) && !this.schema.hasPath(namespace.base, entry.settingsPath),
				apiKeyEnv: entry.provider === "deepseek-account" ? void 0 : apiKeyEnvOf(namespace, entry.settingsPath, this.schema),
				credential: void 0
			};
		});
		if (rows.some((row: any) => row.entry.provider === "deepseek-account")) {
			const catalog = await this.ctx.remote.session.modelCatalog();
			for (const row of rows) if (row.entry.provider === "deepseek-account") row.accountAvailable = catalog.ok && catalog.value.groups.some((group: any) => group.id === "deepseek-account" && group.models.length > 0);
		}
		const refs = [...new Set(rows.filter((row: any) => row.entry.provider !== "deepseek-account").flatMap((row: any) => row.apiKeyEnv === void 0 ? [deriveKeyRef(row.entry.provider), ...row.entry.nativeAuth?.env ?? []] : [row.apiKeyEnv]))];
		const credentials: Record<string, any> = {};
		let credentialError = null;
		for (let index = 0; index < refs.length; index += 64) {
			const response = await this.ctx.remote.credentials.describe(refs.slice(index, index + 64));
			if (response.ok) Object.assign(credentials, response.value);
			else {
				credentialError = response.error.message;
				break;
			}
		}
		if (generation !== this.generation) return;
		this.store.update((s: any) => {
			s.status = "ready";
			s.error = null;
			s.credentialError = credentialError;
			s.writable = writable;
			s.rows = rows.filter((row: any) => row.entry.provider !== "deepseek-account" || row.accountAvailable === true).map((row: any) => {
				if (row.entry.provider === "deepseek-account") return row;
				const named = row.apiKeyEnv === void 0 ? void 0 : credentials[row.apiKeyEnv];
				const derived = row.apiKeyEnv !== void 0 ? void 0 : credentials[deriveKeyRef(row.entry.provider)];
				return {
					...row,
					...named === void 0 ? {} : { credential: named },
					...derived === void 0 ? {} : { derivedCredential: derived },
					...credentialError === null ? { credentialChecks: Object.fromEntries((row.apiKeyEnv === void 0 ? row.entry.nativeAuth?.env ?? [] : [row.apiKeyEnv]).flatMap((ref: any) => {
						const info = credentials[ref];
						return info === void 0 ? [] : [[ref, info]];
					})) } : {}
				};
			});
			s.namespaces = namespaces;
		});
	}
	/** Settle callers only while this read still owns the current refresh. */
	settleLoads(generation: any, settle: any) {
		if (generation !== this.generation) return;
		const pending = [...this.pendingLoads];
		this.pendingLoads.clear();
		for (const load of pending) settle(load);
	}
	/** Publish the current joined read's failure text. */
	failLoad(message: any) {
		this.store.update((s: any) => {
			s.status = "error";
			s.error = message;
		});
	}
};
/**
* Whether a joined row can serve model requests as it stands: the route is
* registered with the adapter registry, and whatever credential its resolved
* profile names is stored. A profile naming no reference authenticates through
* the provider's own path (the Bedrock chain, Vertex ADC, a gateway that needs
* nothing), as does a live route with no settings address at all, so neither
* owes this page a key.
* @param row - one joined provider row.
* @returns whether the user already has this provider to talk to.
*/
export function providerUsable(row: any) {
	if (!row.entry.active) return false;
	if (row.entry.provider === "deepseek-account") return row.accountAvailable === true;
	if (row.apiKeyEnv === void 0) return true;
	return row.credential?.configured === true;
}
/**
* Project first-run readiness from the provider/settings/credential join used
* by the Models page. The step exists to leave the user with a model to talk
* to, so ANY usable provider ends it; only when none exists does the official
* DeepSeek route — the one route the prompt can offer a key field for — decide
* whether prompting can help. A missing official configurable-provider
* declaration means the adapter is not repairable by navigating to Models.
* @param state - current shared Models join snapshot.
* @returns the onboarding state without reading a parallel fact source.
*/
export function onboardingReadiness(state: any) {
	if ((state.status === "idle" || state.status === "loading") && state.rows.length === 0) return { kind: "loading" };
	if (state.status === "error") return {
		kind: "unavailable",
		reason: "load-failed"
	};
	if (state.rows.some(providerUsable)) return { kind: "provider-ready" };
	const row = state.rows.find((candidate: any) => candidate.entry.provider === "deepseek-official" && candidate.entry.settingsNs === "llm-deepseek" && candidate.entry.settingsPath.length === 0);
	if (row === void 0) return { kind: "adapter-absent" };
	if (!row.entry.active) return {
		kind: "unavailable",
		reason: "provider-inactive"
	};
	if (state.credentialError !== null || row.credential === void 0) return {
		kind: "unavailable",
		reason: "credentials-unavailable"
	};
	if (!state.writable) return {
		kind: "unavailable",
		reason: "settings-read-only"
	};
	if (!row.credential.writable) return {
		kind: "unavailable",
		reason: "credential-read-only"
	};
	return { kind: "credential-missing" };
}
