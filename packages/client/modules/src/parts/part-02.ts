/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			* Validate and apply the latest full Host graph. Changed targets cancel obsolete mounts; identical targets share pending loads.
			* The release is compared before the rest of the graph is validated: a graph of another release, including one whose
			* format this page cannot read, is not applied and {@link releaseChange} announces it.
			* @param graph - JSON-decoded graph received from the Host.
			* @returns after the queued reconciliation, or at once for another release; per-package failures remain available in {@link state}.
			*/
			sync(graph) {
				if (!this.release.observe(readRelease(graph))) return Promise.resolve();
				const manifest = parseBootManifest(graph);
				if (entryTargets(manifest) !== entryTargets(this.desired)) this.generation++;
				this.desired = manifest;
				const generation = this.generation;
				return this.enqueue(() => this.reconcile(generation));
			}
			/**
			* Retry failed entries against the latest graph, including an unchanged revision.
			* @returns after retry settlement, with remaining errors in {@link state}.
			*/
			retry() {
				const generation = ++this.generation;
				return this.enqueue(() => this.reconcile(generation));
			}
			/**
			* Replace one entry's code in the same queue as graph updates; duplicate revisions are ignored.
			* Entries missing after a failed import are reconciled; bootstrap replacement fails before teardown.
			* Ignored while the connected Host serves another release than the page's boot release.
			* @param id - Package id from a rebuilt frame.
			* @param rev - Opaque revision selecting the rebuilt artifact.
			* @returns after queued work; replacement errors reject, while per-package reconciliation errors remain in {@link state}.
			*/
			reload(id, rev) {
				if (!this.release.matches) return Promise.resolve();
				this.desired = {
					...this.desired,
					modules: this.desired.modules.map((row) => row.id === id ? {
						...row,
						rev
					} : row)
				};
				return this.enqueue(async () => {
					const desired = this.desired.modules.find((row) => row.id === id);
					if (this.stopped || desired === void 0) return;
					const entry = this.managed.get(id);
					if (entry === void 0) {
						this.modules.invalidate(id, desired.rev);
						removeOwnedStyles(id);
						await this.reconcile(this.generation);
						return;
					}
					if (this.revisions.get(id) === rev) return;
					this.publish({
						syncing: true,
						failures: this.snapshot.failures.filter((failure) => failure.id !== id)
					});
					await this.replace(entry, id, rev, this.generation);
					this.publish({
						syncing: false,
						failures: this.snapshot.failures
					});
				}, id);
			}
			publish(snapshot) {
				this.snapshot = snapshot;
				notifySubscribers(this.listeners, "synchronization");
			}
			enqueue(task, subject = "graph") {
				const run = this.queue.then(task);
				this.queue = run.then(() => void 0, (error) => {
					this.publish({
						syncing: false,
						failures: [...this.snapshot.failures.filter((failure) => failure.id !== subject), {
							id: subject,
							message: String(error)
						}]
					});
				});
				return run;
			}
			current(generation) {
				return !this.stopped && generation === this.generation;
			}
			/** Keep ownership even when Loader rejects a module's plugin exports after inserting its entry. */
			async create(loader, id) {
				const options = { name: id };
				const entryId = loader.ensureId(options);
				try {
					await loader.create(options);
				} finally {
					this.managed.set(id, loader.resolve(entryId));
				}
			}
			async replace(entry, id, rev, generation) {
				this.index.invalidateForReplacement(id, rev);
				await this.modules.prefetch(id);
				if (!this.current(generation)) return;
				await tearDownEntryFiber(entry);
				removeOwnedStyles(id);
				if (!this.current(generation)) return;
				await this.modules.import(id, "", {});
				if (!this.current(generation)) return;
				await entry.refresh();
				await entry.fiber?.await();
				if (entry.fiber === void 0) throw new Error(`client-modules: ${id} import failed (see console)`);
				this.revisions.set(id, rev);
			}
			async reconcile(generation) {
				if (!this.current(generation)) return;
				const loader = this.loader;
				if (loader === void 0) throw new Error("client-modules: entries have not started");
				const manifest = this.desired;
				this.publish({
					syncing: true,
					failures: []
				});
				const failures = [];
				this.index.update(manifest, this.managed.keys());
				const wanted = new Set(manifest.plugins.map((row) => row.id));
				for (const [id, entry] of this.managed) {
					if (wanted.has(id)) continue;
					const fiber = entry.fiber;
					loader.remove(entry.id);
					this.managed.delete(id);
					this.revisions.delete(id);
					while (fiber?.inertia !== void 0) await fiber.inertia;
				}
				for (const row of manifest.modules) {
					if (!this.current(generation)) break;
					try {
						const entry = this.managed.get(row.id);
						if (entry === void 0) {
							await this.modules.prefetch(row.id);
							if (!this.current(generation)) break;
							await this.modules.import(row.id, "", {});
							if (!this.current(generation)) break;
							await this.create(loader, row.id);
							this.revisions.set(row.id, row.rev);
						} else if (this.revisions.get(row.id) !== row.rev) await this.replace(entry, row.id, row.rev, generation);
						else if (entry.fiber === void 0) await this.replace(entry, row.id, row.rev, generation);
						else if (entry.fiber.state === FAILED) entry.fiber.update(entry.options.config);
					} catch (error) {
						failures.push({
							id: row.id,
							message: String(error)
						});
					}
				}
				await loader.await();
				for (const [id, entry] of this.managed) {
					if (failures.some((failure) => failure.id === id)) continue;
					if (entry.fiber?.state === ACTIVE) continue;
					try {
						if (entry.fiber === void 0) throw new Error(`client-modules: ${id} import failed (see console)`);
						await entry.fiber.await();
						failures.push({
							id,
							message: `client-modules: ${id} is waiting for activation`
						});
					} catch (error) {
						failures.push({
							id,
							message: String(error)
						});
					}
				}
				this.index.prune([...loader.entries()].map((entry) => entry.options.name));
				if (this.current(generation)) this.publish({
					syncing: false,
					failures
				});
			}
		};
		//#endregion
		//#region lib/types/client/system.js
		/**
		* ClientModuleSystem — the implementation behind the {@link ClientModuleLoader}
		* contract. The conceptual contract (lazy CJS model, resolution branch order) is
		* documented on the public interfaces in `./manifest.ts`; this file owns the
		* state tables and the load/materialize machinery.
		*/
		/** Default bundle-load hook: same-origin external classic script. */
		const defaultLoadBundle = (url) => new Promise((resolve, reject) => {
			const el = document.createElement("script");
			el.async = true;
			el.src = url;
			el.addEventListener("load", () => {
				el.remove();
				resolve();
			}, { once: true });
			el.addEventListener("error", () => {
				el.remove();
				reject(/* @__PURE__ */ new Error(`client-modules: bundle script ${url} failed to load`));
			}, { once: true });
			document.head.append(el);
		});
		/** Replace the rev query while preserving absolute, protocol-relative, or path-relative form. */
		function atRevision(url, rev) {
			if (!/[?&]rev=[^&#]*/.test(url)) throw new Error(`client-modules: bundle URL ${url} has no revision`);
			return url.replace(/([?&]rev=)[^&#]*/, `$1${encodeURIComponent(rev)}`);
		}
		const CLIENT_CHUNK = /^client\.[A-Za-z0-9][A-Za-z0-9._-]*\.js$/;
		/** The message of a thrown value: an Error's message, anything else stringified. */
		function describeError(error) {
			return error instanceof Error ? error.message : String(error);
		}
		/** Internal module-table key for one package-local chunk. */
		function chunkId(ownerId, fileName) {
			return `${ownerId}/${fileName}`;
		}
		/** Resolve a sibling chunk against the package's one-resource URL and current revision. */
		function chunkUrl(row, fileName, rev) {
			const url = atRevision(row.url, rev);
			const resourceStart = url.indexOf("/??");
			const revisionStart = url.indexOf("&rev=", resourceStart + 3);
			if ((resourceStart < 0 || revisionStart < 0 ? void 0 : url.slice(resourceStart + 3, revisionStart)) !== `${row.id}/client.js`) throw new Error(`client-modules: cannot resolve chunk ${JSON.stringify(fileName)} from bundle URL ${url}`);
			return `${url.slice(0, resourceStart)}/${row.id}/${fileName}?${url.slice(revisionStart + 1)}`;
		}
		/** Untagged <style> elements present before a factory runs; the factory must not claim them. */
		const untaggedStyles = () => typeof document === "undefined" ? /* @__PURE__ */ new Set() : new Set(document.querySelectorAll("style:not([data-plugin])"));
		/**
		* Claim and inventory the <style> tags a factory injected during
		* materialization: preset-emitted tags arrive pre-tagged with data-plugin;
		* an untagged tag that was absent from `before` is claimed for the
		* materializing plugin (HMR bookkeeping).
		*/
		const claimStyles = (id, before) => {
			if (typeof document === "undefined") return [];
			for (const el of untaggedStyles()) if (!before.has(el)) el.setAttribute("data-plugin", id);
			const owned = [];
			for (const el of document.querySelectorAll(`style[data-plugin=${JSON.stringify(id)}]`)) owned.push(el.getAttribute("data-plugin-css") ?? id);
			return owned;
		};
		/**
		* The client module system: state tables plus the arrival/materialization
		* machinery implementing {@link ClientModuleLoader} (whose members carry the
		* contract documentation). Construction indexes the boot rows, retains the
		* already-materialized bootstrap module, and switches the HTML-installed
		* loader facade from its pending queue to live registration.
		*/
		var ClientModuleSystem = class {
			version = "client";
			manifest;
			entries;
			loadCache = /* @__PURE__ */ new Map();
			seed;
			factories = /* @__PURE__ */ new Map();
			bootstrapIds = /* @__PURE__ */ new Set();
			/** In-flight script transport per URL; every row in one batch shares it. */
			pendingArrival = /* @__PURE__ */ new Map();
			/** Owner generation captured by in-flight chunk requests and advanced on invalidation. */
			generations = /* @__PURE__ */ new Map();
			/** Single-resource combo URL selected by HMR after invalidating one row. */
			reloadTargets = /* @__PURE__ */ new Map();
			/** Materialization re-entrancy guard: factory-form CJS cannot deliver partial exports, so a cycle is fatal. */
			materializing = /* @__PURE__ */ new Set();
			graphRows = /* @__PURE__ */ new Map();
			loadBundle;
			/** Last import or prefetch failure per graph row, cleared by a later success or invalidation. */
			importErrors = /* @__PURE__ */ new Map();
			/** Batch URLs whose transport or execution already failed; rows still missing from them go straight to their one-resource URL. */
			failedBundleUrls = /* @__PURE__ */ new Set();
			/** Every URL whose script has executed once; a batch among them is never requested again. */
			executedBundleUrls = /* @__PURE__ */ new Set();
			/**
			* Build the module system over the parsed boot rows.
			* @param options - Parsed graph, platform seed, bootstrap module, registration facade, and transport.
			*/
			constructor(options) {
				this.manifest = options.manifest;
				this.entries = new ClientEntries(this, {
					update: (manifest, managed) => {
						this.updateManifest(manifest, managed);
					},
					invalidateForReplacement: (id, rev) => {
						if (this.bootstrapIds.has(id)) throw new Error(`client-modules: replacing bootstrap module ${id} requires a page reload`);
						this.invalidate(id, rev);
					},
					prune: (roots) => {
						this.prune(roots);
					}
				});
				this.seed = new Map(Object.entries(options.staticModules));
				this.loadBundle = options.loadBundle ?? defaultLoadBundle;
				for (const row of options.manifest.modules) this.graphRows.set(row.id, row);
				const bootstrapId = stripClientSuffix(options.bootstrapModule.id);
				this.bootstrapIds.add(bootstrapId);
				this.loadCache.set(bootstrapId, {
					id: bootstrapId,
					exports: options.bootstrapModule.exports,
					styles: [],
					edges: /* @__PURE__ */ new Set()
				});
				const target = options.registrationTarget;
				if (target.mode !== "queue") throw new Error("client-modules: window.__ModuleLoader__.create called after module-system boot");
				const pending = target.pendingQueue.splice(0);
				target.mode = "live";
				target.load = (registration) => {
					this.register(registration);
				};
				for (const registration of pending) target.load(registration);
			}
			/** Register one bundle factory, rejecting a script that executes twice without invalidation. */
			register(registration) {
				const ownerId = stripClientSuffix(registration.id);
				if (registration.chunk !== void 0 && !CLIENT_CHUNK.test(registration.chunk)) throw new Error(`client-modules: invalid package-local chunk ${JSON.stringify(registration.chunk)}`);
				const id = registration.chunk === void 0 ? ownerId : chunkId(ownerId, registration.chunk);
				if (this.bootstrapIds.has(id) || this.factories.has(id)) {
					const registrationName = registration.chunk === void 0 ? registration.id : id;
					throw new Error(`client-modules: duplicate factory registration for "${registrationName}" (bundle executed twice without invalidate?)`);
				}
				this.factories.set(id, {
					factory: registration.factory,
					rev: this.reloadTargets.get(ownerId)?.rev ?? this.graphRows.get(ownerId)?.rev
				});
			}
			/** Run one bundle transport per URL; every row waiting on the same URL shares the in-flight request. */
			loadShared(url) {
				let transport = this.pendingArrival.get(url);
				if (transport === void 0) {
					transport = this.loadBundle(url).then(() => {
						this.executedBundleUrls.add(url);
					}).finally(() => {
						this.pendingArrival.delete(url);
					});
					this.pendingArrival.set(url, transport);
				}
				return transport;
			}
			/**
			* Load one graph row so its factory is registered (idempotent per in-flight
			* arrival). A batch script is one classic script that registers every
			* package in sequence, and {@link register} rejects a second registration,
			* so the two failure kinds differ: a transport failure (`error` event, nothing
			* executed) is retried once on the same URL; a script that loaded without
			* registering this row (a parse error registered nothing, or a runtime throw
			* stopped it after registering others) is never re-executed, because a replay
			* would stop again at the first duplicate registration; that holds even when
			* the row that first imports from the batch is one it did register, because
			* every executed batch URL is remembered. Either way the row then falls back
			* to its own one-resource URL, which the Host serves for every package, so one
			* failed batch costs at most three requests per missing row and never fails
			* the rows that were registered.
			*/
			async arrive(row) {
				const { id } = row;
				if (this.loadCache.has(id) || this.factories.has(id)) return;
				const reload = this.reloadTargets.get(id);
				const preferred = reload?.url ?? row.initialUrl;
				const fallback = reload === void 0 && row.url !== preferred ? row.url : void 0;
				const failures = [];
				const attempt = async (url) => {
					try {
						await this.loadShared(url);
					} catch (error) {
						failures.push(`${url}: ${describeError(error)}`);
						return "transport-failed";
					}
					if (this.factories.has(id)) return "registered";
					failures.push(`${url}: loaded without registering "${id}" via __ModuleLoader__.load`);
					return "not-registered";
				};
				let outcome = "transport-failed";
				if (this.failedBundleUrls.has(preferred)) failures.push(`${preferred}: skipped after an earlier failure of this bundle`);
				else if (fallback !== void 0 && this.executedBundleUrls.has(preferred)) {
					failures.push(`${preferred}: already executed without registering "${id}"`);
					outcome = "not-registered";
					this.failedBundleUrls.add(preferred);
				} else {
					outcome = await attempt(preferred);
					if (outcome === "transport-failed") outcome = await attempt(preferred);
					if (outcome !== "registered" && fallback !== void 0) this.failedBundleUrls.add(preferred);
				}
				if (outcome !== "registered" && fallback !== void 0) outcome = await attempt(fallback);
				if (outcome !== "registered") throw new Error(`client-modules: could not load "${id}": ${failures.join("; ")}`);
				if (reload !== void 0 && this.reloadTargets.get(id) === reload) this.reloadTargets.delete(id);
			}
			/** Register each injected package and unresolved dynamic request before its consumer. */
			async arriveGraphRow(row, open = [], visited = /* @__PURE__ */ new Set()) {
				const cycleStart = open.indexOf(row.id);
				if (cycleStart !== -1) throw new Error(`client-modules: module arrival cycle ${[...open.slice(cycleStart), row.id].join(" -> ")} (the host must reject this graph before serving it)`);
				if (visited.has(row.id)) return;
				visited.add(row.id);
				const next = [...open, row.id];
				for (const request of row.external) {
					const id = stripClientSuffix(request);
					if (this.seed.has(request) || this.loadCache.has(id)) continue;
					const dependency = this.graphRows.get(id);
					if (dependency !== void 0) await this.arriveDependency(row.id, dependency, next, visited);
				}
				for (const packageName of row.inject) {
					const dependency = this.graphRows.get(packageName);
					if (dependency !== void 0) await this.arriveDependency(row.id, dependency, [], visited);
				}
				await this.arrive(row);
			}
			/** Arrive one dependency, naming the consumer it failed for so a cascade reads as a chain, not as 44 unrelated failures. */
			async arriveDependency(consumerId, dependency, open, visited) {
				try {
					await this.arriveGraphRow(dependency, open, visited);
				} catch (error) {
					throw new Error(`client-modules: "${consumerId}" not loaded because dependency "${dependency.id}" failed: ${describeError(error)}`, { cause: error });
export {};
