/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
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
			return rows.toSorted((left, right) => (left.provider === "deepseek-account" ? 0 : left.provider === "deepseek-official" ? 1 : 2) - (right.provider === "deepseek-account" ? 0 : right.provider === "deepseek-official" ? 1 : 2));
		}
		/**
		* Derive the conventional credential reference for a provider route: the v1
		* page never asks for an environment-variable name, so a typed key stores
		* under this derived reference and the profile records it as `apiKeyEnv`.
		* @param provider - provider route id (e.g. `anthropic`, `minimax-cn`).
		* @returns the derived reference name (e.g. `MINIMAX_CN_API_KEY`).
		*/
		function deriveKeyRef(provider) {
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
		function protocolChoices(namespace, schema) {
			if (namespace === void 0) return [];
			const list = schema.nodeAtPath(schema.rehydrate(namespace.schema), [
				"providers",
				PROBE_ROUTE,
				"api"
			]);
			if (list?.type !== "union" || list.list === void 0) return [];
			return list.list.map((entry) => entry.value).filter((value) => typeof value === "string");
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
		function reasoningLevelChoices(namespace, schema) {
			if (namespace === void 0) return [];
			const path = [
				"providers",
				PROBE_ROUTE,
				"models",
				"0",
				"reasoningEfforts"
			];
			return (((schema.nodeAtPath(schema.rehydrate(namespace.schema), path)?.list ?? []).find((branch) => branch.type === "dict")?.sKey)?.list ?? []).map((entry) => entry.value).filter((value) => typeof value === "string");
		}
		/** The credential reference a resolved profile names (its `apiKeyEnv` field). */
		function apiKeyEnvOf(namespace, path, schema) {
			if (namespace === void 0) return void 0;
			const profile = schema.getPath(namespace.value, path);
			if (typeof profile !== "object" || profile === null) return void 0;
			const ref = profile.apiKeyEnv;
			return typeof ref === "string" && ref.length > 0 ? ref : void 0;
		}
		/** The models settings page controller (one per settings surface). */
		var ModelsSettingsStore = class {
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
			constructor(ctx, schema, describeFace) {
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
					this.settleLoads(generation, (load) => {
						load.resolve();
					});
				}, (error) => {
					this.settleLoads(generation, (load) => {
						load.reject(error);
					});
				});
				return pending.promise;
			}
			/** Publish one joined answer; stale answers leave the current refresh in charge. */
			async read(generation) {
				this.store.update((s) => {
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
				const namespaces = new Map(views.map((view) => [view.ns, view]));
				const rows = providers.map((entry) => {
					const namespace = namespaces.get(entry.settingsNs);
					return {
						entry,
						configured: namespace !== void 0 && (entry.settingsPath.length === 0 || this.schema.getPath(namespace.value, entry.settingsPath) !== void 0),
						removable: namespace !== void 0 && entry.settingsPath.length > 0 && this.schema.hasPath(namespace.user, entry.settingsPath) && !this.schema.hasPath(namespace.base, entry.settingsPath),
						apiKeyEnv: entry.provider === "deepseek-account" ? void 0 : apiKeyEnvOf(namespace, entry.settingsPath, this.schema),
						credential: void 0
					};
				});
				if (rows.some((row) => row.entry.provider === "deepseek-account")) {
					const catalog = await this.ctx.remote.session.modelCatalog();
					for (const row of rows) if (row.entry.provider === "deepseek-account") row.accountAvailable = catalog.ok && catalog.value.groups.some((group) => group.id === "deepseek-account" && group.models.length > 0);
				}
				const refs = [...new Set(rows.filter((row) => row.entry.provider !== "deepseek-account").flatMap((row) => row.apiKeyEnv === void 0 ? [deriveKeyRef(row.entry.provider), ...row.entry.nativeAuth?.env ?? []] : [row.apiKeyEnv]))];
				const credentials = {};
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
				this.store.update((s) => {
					s.status = "ready";
					s.error = null;
					s.credentialError = credentialError;
					s.writable = writable;
					s.rows = rows.filter((row) => row.entry.provider !== "deepseek-account" || row.accountAvailable === true).map((row) => {
						if (row.entry.provider === "deepseek-account") return row;
						const named = row.apiKeyEnv === void 0 ? void 0 : credentials[row.apiKeyEnv];
						const derived = row.apiKeyEnv !== void 0 ? void 0 : credentials[deriveKeyRef(row.entry.provider)];
						return {
							...row,
							...named === void 0 ? {} : { credential: named },
							...derived === void 0 ? {} : { derivedCredential: derived },
							...credentialError === null ? { credentialChecks: Object.fromEntries((row.apiKeyEnv === void 0 ? row.entry.nativeAuth?.env ?? [] : [row.apiKeyEnv]).flatMap((ref) => {
								const info = credentials[ref];
								return info === void 0 ? [] : [[ref, info]];
							})) } : {}
						};
					});
					s.namespaces = namespaces;
				});
			}
			/** Settle callers only while this read still owns the current refresh. */
			settleLoads(generation, settle) {
				if (generation !== this.generation) return;
				const pending = [...this.pendingLoads];
				this.pendingLoads.clear();
				for (const load of pending) settle(load);
			}
			/** Publish the current joined read's failure text. */
			failLoad(message) {
				this.store.update((s) => {
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
		function providerUsable(row) {
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
		function onboardingReadiness(state) {
			if ((state.status === "idle" || state.status === "loading") && state.rows.length === 0) return { kind: "loading" };
			if (state.status === "error") return {
				kind: "unavailable",
				reason: "load-failed"
			};
			if (state.rows.some(providerUsable)) return { kind: "provider-ready" };
			const row = state.rows.find((candidate) => candidate.entry.provider === "deepseek-official" && candidate.entry.settingsNs === "llm-deepseek" && candidate.entry.settingsPath.length === 0);
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
		//#endregion
		//#region lib/types/client/protocol-label.js
		/**
		* Product names for the wire protocols a pi-ai route may speak. The pickers
		* show these instead of the schema identifiers (`openai-completions`), which
		* are what `settings.yaml` carries and what the option values stay.
		*/
		/** The protocols this page names, keyed by their schema identifier. */
		const PROTOCOL_LABEL_KEYS = {
			"openai-completions": "protocolOpenAiCompletions",
			"openai-responses": "protocolOpenAiResponses",
			"anthropic-messages": "protocolAnthropicMessages"
		};
		/**
		* The picker text for one protocol identifier.
		* @param t - section copy.
		* @param protocol - the schema identifier of the protocol.
		* @returns the product name this page knows the protocol by; a protocol the
		* adapter adds before this page names it shows its identifier, the spelling
		* `settings.yaml` needs anyway.
		*/
		function protocolLabel(t, protocol) {
			const key = PROTOCOL_LABEL_KEYS[protocol];
			return key === void 0 ? protocol : t(key);
		}
		//#endregion
		//#region lib/types/client/CustomProviderCard.js
		/**
		* The card that declares a provider pi-ai does not ship — an OpenAI-compatible
		* gateway, a self-hosted server, or a provider newer than the installed
		* catalog.
		*
		* This is a create, not an edit, which is why it is its own form rather than
		* the provider editor with extra fields: the route id is being *chosen* here,
		* and the settings address does not exist until it is. It renders as the
		* custom-API panel of the section's add card; the card's mode switch names it
		* when both modes are offered, and with the custom mode alone the card shows
		* this form directly. One `settings.mutate` sets the whole profile at
		* `providers.<route>`; the key travels separately through `credentials/set`
		* under the reference the profile records, exactly as an existing provider's
		* key does.
		*
		* The three fields a hand-declared route cannot default — endpoint, protocol,
		* and at least one model — are required here rather than at load, so the
		* failure names the field while the user is still looking at it.
		*
		* There is deliberately no provider-scoped reasoning-effort control, here or
		* on the editor card: effort is a per-MODEL capability, and the models under
		* one provider disagree about it, so a provider-scoped control can only be set
		* to a value some of them reject. Each model row of a hand-declared route
		* declares its own `reasoningEfforts` instead, and the composer's model picker
		* offers each model those levels.
		*/
		/** The settings namespace a hand-declared provider is written into. */
		const NS$1 = "llm-pi-ai";
		/**
		* A route id usable as a settings key AND as the stem of a credential name.
		* The leading letter is the second half of that: `deriveKeyRef` uppercases the
		* id and replaces every non-alphanumeric run with `_`, and a credential
		* reference is a POSIX shell identifier, which cannot start with a digit. A
		* digit-leading id passes every check this card makes and then fails at the
		* credential seam with a raw regular expression the user cannot act on.
		*/
		const ROUTE_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
		function isHttpUrl(value) {
			try {
				const protocol = new URL(value).protocol;
				return protocol === "http:" || protocol === "https:";
			} catch {
				return false;
			}
		}
		/**
		* Render the custom-provider creation card.
		* @param props - existing routes, protocol choices, wire faces, and copy.
		* @returns the creation card.
		*/
		function CustomProviderCard(props) {
			const { taken, protocols, reasoningLevels, operations, t, onBusyChange } = props;
			const [openedAt] = (0, react.useState)(() => props.revision);
			const [route, setRoute] = (0, react.useState)("");
			const [displayName, setDisplayName] = (0, react.useState)("");
			const [baseURL, setBaseURL] = (0, react.useState)("");
			const [protocol, setProtocol] = (0, react.useState)(protocols[0] ?? "");
			const [keyDraft, setKeyDraft] = (0, react.useState)("");
			const [models, setModels] = (0, react.useState)([]);
			const [busy, setBusy] = (0, react.useState)(false);
			const [listBusy, setListBusy] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				onBusyChange?.(busy || listBusy);
			}, [
				busy,
				listBusy,
				onBusyChange
			]);
			const [failure, setFailure] = (0, react.useState)(void 0);
			/**
			* The profile write landed. Only the key write can still be outstanding, so
			* the fields that describe the provider are settled and the retry path is
			* the credential alone.
			*/
			const [committed, setCommitted] = (0, react.useState)(false);
			const disabled = props.readOnly || busy;
			/** Everything but the key stops being editable once the provider exists. */
			const profileDisabled = disabled || committed;
			const routeInvalid = route.length > 0 && !ROUTE_PATTERN.test(route);
			const routeTaken = taken.includes(route);
			const normalizedBaseURL = baseURL.trim();
			const baseUrlInvalid = baseURL.length > 0 && !isHttpUrl(normalizedBaseURL);
			const modelFailure = validateDeepSeekModels(models) ?? validateReasoningEfforts(models);
			const keyFailure = apiKeyFailure(keyDraft);
			const keyValue = keyDraft.trim();
			const ready = route.length > 0 && !routeInvalid && !routeTaken && normalizedBaseURL.length > 0 && !baseUrlInvalid && models.length > 0 && modelFailure === void 0 && keyFailure === void 0;
			const hint = failure !== void 0 || ready || keyFailure !== void 0 || route.length === 0 || routeInvalid || routeTaken || baseUrlInvalid ? void 0 : normalizedBaseURL.length === 0 ? t("customNeedsBaseUrl") : modelFailure !== void 0 ? `${t("model")} ${String(modelFailure.index + 1)}: ${t(modelFailure.key)}` : t("customNeedsModels");
			/** Perform the create, returning a failure message or undefined. */
			const createOnce = async () => {
				const keyRef = deriveKeyRef(route);
				const storesKey = keyValue.length > 0;
				if (!committed) {
					const profile = {
export {};
