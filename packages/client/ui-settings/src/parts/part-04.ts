/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				if (this.disposed) return Promise.resolve(false);
				const task = this.tail.then(async () => {
					if (this.disposed) return false;
					return await operation();
				});
				this.tail = task.then(() => {}, () => {});
				return task;
			}
			derive() {
				if (this.disposed) return;
				const mirrored = this.mirror.getSnapshot();
				if (mirrored.view === void 0) return;
				const { writable } = mirrored.view;
				const view = mirrored.view.namespaces.find((candidate) => candidate.ns === this.spec.namespace);
				if (view === void 0) {
					this.store.update((draft) => {
						draft.status = "unavailable";
						draft.writable = writable;
					});
					return;
				}
				const decoded = this.decode(view);
				this.store.update((draft) => {
					draft.revision = view.revision;
					draft.base = view.base;
					draft.user = view.user;
					draft.writable = writable;
					if (decoded === void 0) return;
					draft.status = "ready";
					draft.value = decoded;
				});
			}
			decode(view) {
				if (this.spec.decode !== void 0) return this.spec.decode(view.value);
				if (typeof view.value !== "object" || view.value === null || Array.isArray(view.value)) return void 0;
				let failure;
				try {
					failure = this.schema.validate(this.schema.rehydrate(view.schema), view.value);
				} catch (_malformedSchemaEnvelope) {
					return;
				}
				return failure === void 0 ? view.value : void 0;
			}
		};
		/**
		* The settings domain's base service. Features that own a preference reach the
		* settings transport through this service rather than a shared function: the
		* client bundle purity gate forbids cross-plugin value imports and directs
		* cross-plugin collaboration through cordis services
		* (`packages/client/tsdown.client.ts`).
		*/
		var ConfigForms = class extends _deepseek_ai_cordis.Service {
			forms = /* @__PURE__ */ new Map();
			/** Shared developer-tool preference owned by this settings provider. */
			developerTools;
			mirror;
			schema;
			/**
			* The PROVIDING fiber, kept because a Service reads `ctx` as its *consumer's*
			* fiber: letting a shared form write through the caller's context would make
			* every caller declare `remote.settings` in its own `inject`.
			*/
			owner;
			/**
			* @param ctx - the providing plugin's context.
			* @param config - the shared describe mirror every shared form derives from
			* and the settings-owned schema operations.
			*/
			constructor(ctx, config) {
				super(ctx, "configForms");
				this.mirror = config.mirror;
				this.schema = config.schema;
				this.owner = ctx;
				this.developerTools = new DeveloperToolsPreference(this.get(DEVELOPER_TOOLS_NAMESPACE));
				ctx.effect(() => async () => {
					await Promise.all([...this.forms.values()].map((form) => form.dispose()));
					this.forms.clear();
				}, "ui-settings: configuration forms");
			}
			/**
			* The shared mirror's read/fold face for cross-namespace surfaces (schema
			* introspection, the served-namespace directory). Per-namespace consumers
			* use {@link get}; both derive from the same snapshot, so they can never
			* disagree about the document.
			* @returns the describe face over the shared mirror.
			*/
			describe() {
				return this.mirror;
			}
			/** Get the shared form values and write queue for one Host plugin entry.
			* @param entryId Unique Host plugin entry id.
			* @returns The entry's form, owned by this provider.
			*/
			get(entryId) {
				const existing = this.forms.get(entryId);
				if (existing !== void 0) return existing;
				const form = new ConfigFormController(this.owner, { namespace: entryId }, this.mirror, this.schema);
				this.forms.set(entryId, form);
				this.mirror.ensure();
				return form;
			}
			/**
			* Keep a registration alive while the Host serves any of some namespaces:
			* `register` runs once one of them is in the describe mirror, and its
			* disposer runs when none is or when the returned disposer runs. A plugin
			* whose page edits a namespace another plugin owns registers the page
			* through this, so a deployment that never composed the owner shows no
			* trace of the page. The caller owns the returned disposer and wraps it in
			* `ctx.effect`; unlike {@link bind}, nothing is registered on the caller's
			* context here.
			* @param namespaces - the settings namespaces the registration follows.
			* @param register - registers the contribution, given every namespace the Host serves; returns its disposer.
			* @returns the disposer ending the watch and any live registration.
			*/
			whileServed(namespaces, register) {
				let off;
				const sync = () => {
					const served = new Set(this.mirror.getSnapshot().view?.namespaces.map((view) => view.ns) ?? []);
					const watched = namespaces.some((namespace) => served.has(namespace));
					if (watched && off === void 0) off = register(served);
					else if (!watched && off !== void 0) {
						off();
						off = void 0;
					}
				};
				const unsubscribe = this.mirror.subscribe(sync);
				this.mirror.ensure();
				sync();
				return () => {
					unsubscribe();
					off?.();
					off = void 0;
				};
			}
		};
		//#endregion
		//#region lib/types/client/settings-mirror.js
		/**
		* Client mirror of the Host settings document: the one `settings.describe`
		* reader in the browser. Every settings consumer derives from this store —
		* shared entry forms through `ConfigForms.get`, cross-namespace
		* surfaces through the provider's shared describe face — so startup cost and
		* freshness are properties of this class, not of how many features own a
		* preference. The Host stays the fact source: the mirror re-reads on the
		* invalidations its owning plugin subscribes to and folds write answers in
		* through {@link SettingsDescribeMirror.acceptView}.
		*/
		/**
		* Serializes every Host `settings.describe` read behind one snapshot store.
		* Concurrent {@link load} calls fold into the in-flight read plus one rerun,
		* so an invalidation arriving mid-read is never lost and never duplicated.
		*/
		var SettingsDescribeMirror = class {
			ctx;
			store;
			inFlight;
			rerun = false;
			generation = 0;
			/**
			* @param ctx - the providing plugin's context, whose `remote.settings`
			* namespace answers the describe read.
			*/
			constructor(ctx) {
				this.ctx = ctx;
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
					status: "idle",
					view: void 0,
					error: null
				});
			}
			/** @returns the current sync snapshot (stable reference until the next change). */
			getSnapshot() {
				return this.store.getSnapshot();
			}
			/**
			* Observe snapshot replacements.
			* @param listener - invoked after each snapshot change.
			* @returns the disposer removing this listener.
			*/
			subscribe(listener) {
				return this.store.subscribe(listener);
			}
			/**
			* Refresh from the Host. A call during an in-flight read marks one rerun
			* after it settles instead of racing a second wire read.
			* @returns settlement after this call's freshness is reflected.
			*/
			load() {
				if (this.inFlight !== void 0) {
					this.rerun = true;
					return this.inFlight;
				}
				const run = Promise.resolve().then(() => this.run());
				this.inFlight = run;
				return run;
			}
			/**
			* Resolve once an answer is held, reading only from `idle`.
			* @returns settlement of the current or newly started read, if any.
			*/
			ensure() {
				if (this.inFlight !== void 0) return this.inFlight;
				if (this.getSnapshot().status === "idle") return this.load();
				return Promise.resolve();
			}
			/**
			* Fold one write answer's namespace view into the held view without a wire
			* read, and invalidate any read still in flight. With no held document, the
			* answer is not published as a partial document; an in-flight read reruns so
			* it cannot publish a document fetched before the write committed.
			* @param view - the namespace view a settings write answered with.
			*/
			acceptView(view) {
				const before = this.store.getSnapshot();
				this.generation += 1;
				if (this.inFlight !== void 0) this.rerun = true;
				if (before.view === void 0) return;
				const namespaces = before.view.namespaces.some((row) => row.ns === view.ns) ? before.view.namespaces.map((row) => row.ns === view.ns ? view : row) : [...before.view.namespaces, view];
				this.store.set({
					...before,
					view: {
						...before.view,
						namespaces
					}
				});
			}
			/**
			* Convenience row lookup on the held view.
			* @param ns - namespace identity.
			* @returns the namespace view, or undefined while unanswered or unregistered.
			*/
			namespace(ns) {
				return this.store.getSnapshot().view?.namespaces.find((row) => row.ns === ns);
			}
			async run() {
				try {
					do {
						const before = this.store.getSnapshot();
						if (before.status === "idle") this.store.set({
							...before,
							status: "loading"
						});
						this.rerun = false;
						const generation = ++this.generation;
						let outcome;
						try {
							const response = await this.ctx.remote.settings.describe();
							outcome = response.ok ? { view: response.value } : { failure: response.error.message };
						} catch (error) {
							outcome = { failure: error instanceof Error ? error.message : String(error) };
						}
						if (generation !== this.generation) continue;
						if ("view" in outcome) this.store.set({
							status: "ready",
							view: outcome.view,
							error: null
						});
						else {
							const held = this.store.getSnapshot();
							this.store.set({
								status: held.view === void 0 ? "idle" : "ready",
								view: held.view,
								error: outcome.failure
							});
						}
					} while (this.shouldRerun());
				} finally {
					this.inFlight = void 0;
				}
			}
			shouldRerun() {
				return this.rerun;
			}
		};
		//#endregion
		//#region lib/types/client/index.js
		/**
		* Required services: the Remote namespace the mirror reads through and the
		* forwarded settings invalidation it refreshes on.
		*/
		const inject = ["remote", "remote.settings"];
		/** Provide shared forms and refresh them on document changes and reconnects.
		* @param ctx Client provider context.
		*/
		function apply(ctx) {
			const schema = new SettingsSchemaService(ctx);
			const mirror = new SettingsDescribeMirror(ctx);
			ctx.effect(() => {
				const disposers = [ctx.remote.$on("settings/document-updated", () => {
					mirror.load();
				}), ctx.on("connection/reset", () => {
					mirror.load();
				})];
				mirror.ensure();
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-settings: describe mirror invalidations");
			new ConfigForms(ctx, {
				mirror,
				schema
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
