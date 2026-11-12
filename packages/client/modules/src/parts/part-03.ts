/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				}
			}
			/** Materialize a registered factory (synchronous; memoized in loadCache). */
			materialize(id, ownerId = id) {
				const existing = this.loadCache.get(id);
				if (existing !== void 0) return existing;
				const registered = this.factories.get(id);
				/* v8 ignore next -- callers check the factory branch before dispatching here. */
				if (registered === void 0) throw new Error(`client-modules: no registered factory for "${id}"`);
				if (this.materializing.has(id)) throw new Error(`client-modules: require cycle through "${id}" (factory-form CJS cannot deliver partial exports)`);
				this.materializing.add(id);
				const before = untaggedStyles();
				try {
					const edges = /* @__PURE__ */ new Set();
					const record = {
						id,
						exports: registered.factory(this.makeRequire(ownerId, edges)),
						styles: claimStyles(ownerId, before),
						edges
					};
					this.loadCache.set(id, record);
					return record;
				} catch (error) {
					claimStyles(ownerId, before);
					removeOwnedStyles(ownerId);
					throw error;
				} finally {
					this.materializing.delete(id);
				}
			}
			/** Build the synchronous module-table require and its asynchronous chunk operation. */
			makeRequire(ownerId, edges) {
				const require = (spec) => {
					edges.add(spec);
					if (this.seed.has(spec)) return this.seed.get(spec);
					const id = stripClientSuffix(spec);
					const record = this.loadCache.get(id);
					if (record !== void 0) return record.exports;
					if (this.factories.has(id)) return this.materialize(id).exports;
					throw new Error(`client-modules: require("${spec}") missed the module table — not a platform seed word, not a materialized module, and no registered package factory (a build-time externals drift, or a dynamic dependency that did not arrive)`);
				};
				require.async = async (spec) => {
					edges.add(spec);
					if (!spec.startsWith("./")) return await this.import(spec);
					const fileName = spec.slice(2);
					if (!CLIENT_CHUNK.test(fileName)) throw new Error(`client-modules: invalid relative chunk request ${JSON.stringify(spec)}`);
					return await this.importChunk(ownerId, fileName);
				};
				return require;
			}
			/** Load, register, and materialize one package-local dynamic chunk. */
			async importChunk(ownerId, fileName) {
				const id = chunkId(ownerId, fileName);
				const existing = this.loadCache.get(id);
				if (existing !== void 0) return existing.exports;
				if (!this.factories.has(id)) {
					const generation = this.generations.get(ownerId) ?? 0;
					const row = this.graphRows.get(ownerId);
					if (row === void 0) throw new Error(`client-modules: chunk owner "${ownerId}" is not a boot graph entry`);
					const url = chunkUrl(row, fileName, this.factories.get(ownerId)?.rev ?? this.reloadTargets.get(ownerId)?.rev ?? row.rev);
					let transport = this.pendingArrival.get(url);
					if (transport === void 0) {
						transport = this.loadBundle(url).finally(() => {
							this.pendingArrival.delete(url);
						});
						this.pendingArrival.set(url, transport);
					}
					await transport;
					if ((this.generations.get(ownerId) ?? 0) !== generation) {
						this.factories.delete(id);
						this.loadCache.delete(id);
						return await this.importChunk(ownerId, fileName);
					}
					if (!this.factories.has(id)) throw new Error(`client-modules: bundle ${url} loaded without registering "${id}" via __ModuleLoader__.load`);
				}
				return this.materialize(id, ownerId).exports;
			}
			async import(specifier) {
				if (this.seed.has(specifier)) return this.seed.get(specifier);
				const id = stripClientSuffix(specifier);
				const existing = this.loadCache.get(id);
				if (existing !== void 0) return existing.exports;
				const row = this.graphRows.get(id);
				if (row === void 0) {
					if (this.factories.has(id)) return this.materialize(id).exports;
					throw new Error(`client-modules: cannot resolve "${specifier}" — not a seed word, not a materialized module, and not a row in the boot graph (the runtime mirror of the bundle purity gate)`);
				}
				return this.recordingImportError(id, async () => {
					await this.arriveGraphRow(row);
					return this.materialize(id).exports;
				});
			}
			async prefetch(id) {
				const normalized = stripClientSuffix(id);
				if (this.loadCache.has(normalized)) return;
				const row = this.graphRows.get(normalized);
				if (row === void 0) throw new Error(`client-modules: prefetch("${id}") — not a graph entry`);
				await this.recordingImportError(normalized, () => this.arriveGraphRow(row));
			}
			importError(id) {
				return this.importErrors.get(stripClientSuffix(id));
			}
			/**
			* Run one graph-row operation, recording its failure for the boot audit and
			* clearing the record on success. Arrival and materialization both run in
			* here, so a factory that throws is recorded as well as a bundle that never
			* arrived; the Loader only sees a missing fiber either way.
			*/
			async recordingImportError(id, operation) {
				try {
					const result = await operation();
					this.importErrors.delete(id);
					return result;
				} catch (error) {
					this.importErrors.set(id, error instanceof Error ? error : new Error(describeError(error)));
					throw error;
				}
			}
			/** Refresh descriptors and unowned factory revisions before any entry imports its dependencies. */
			updateManifest(manifest, managed) {
				for (const id of this.bootstrapIds) if (this.manifest.modules.some((row) => row.id === id) && !manifest.modules.some((row) => row.id === id)) throw new Error(`client-modules: removing bootstrap module ${id} requires a page reload`);
				const owned = new Set(managed);
				for (const row of manifest.modules) {
					this.graphRows.set(row.id, {
						...row,
						initialUrl: row.url
					});
					const cachedRevision = this.factories.get(row.id)?.rev ?? this.reloadTargets.get(row.id)?.rev;
					if (!owned.has(row.id) && cachedRevision !== void 0 && cachedRevision !== row.rev) {
						this.invalidate(row.id, row.rev);
						removeOwnedStyles(row.id);
					}
				}
				this.manifest = manifest;
			}
			/** Retain live Loader modules and their transitive requests before evicting unreferenced graph records. */
			prune(roots) {
				const retained = new Set(this.bootstrapIds);
				const visit = (specifier) => {
					const id = stripClientSuffix(specifier);
					if (retained.has(id)) return;
					retained.add(id);
					const row = this.graphRows.get(id);
					for (const request of [
						...row?.external ?? [],
						...row?.inject ?? [],
						...this.loadCache.get(id)?.edges ?? []
					]) visit(request);
				};
				for (const row of this.manifest.modules) visit(row.id);
				for (const id of roots) visit(id);
				for (const id of this.graphRows.keys()) {
					if (retained.has(id)) continue;
					this.graphRows.delete(id);
					this.invalidate(id);
					removeOwnedStyles(id);
				}
			}
			invalidate(id, rev) {
				const normalized = stripClientSuffix(id);
				if (this.bootstrapIds.has(normalized)) return;
				this.importErrors.delete(normalized);
				this.generations.set(normalized, (this.generations.get(normalized) ?? 0) + 1);
				const row = this.graphRows.get(normalized);
				if (row !== void 0) {
					const revision = rev ?? row.rev;
					this.reloadTargets.set(normalized, {
						url: atRevision(row.url, revision),
						rev: revision
					});
				} else this.reloadTargets.delete(normalized);
				for (const key of this.factories.keys()) if (key === normalized || key.startsWith(`${normalized}/client.`)) this.factories.delete(key);
				for (const key of this.loadCache.keys()) if (key === normalized || key.startsWith(`${normalized}/client.`)) this.loadCache.delete(key);
			}
		};
		//#endregion
		//#region lib/types/client/index.js
		/**
		* Build the live module system from the HTML facade's materialized modules bundle.
		* @param target - Stable registration facade whose pending queue becomes the live sink.
		* @param bootstrapModule - This bundle's id and already-materialized exports.
		* @param options - Raw boot graph, platform seed, and optional bundle transport.
		* @returns The created module system.
		*/
		function createClientModuleSystem(target, bootstrapModule, options) {
			return new ClientModuleSystem({
				manifest: parseBootManifest(options.boot),
				staticModules: options.staticModules,
				registrationTarget: target,
				bootstrapModule,
				...options.loadBundle === void 0 ? {} : { loadBundle: options.loadBundle }
			});
		}
		/** Required service: the Loader whose internal module system this plugin publishes. */
		const inject = ["loader"];
		/**
		* Enroll the kernel-built module system as `ctx.modules`.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const modules = ctx.loader.internal;
			if (modules?.version !== "client") throw new Error("client-modules: the Loader has no client module system");
			ctx.reflect.provide("modules", modules);
		}
		//#endregion
		exports.ClientModuleSystem = ClientModuleSystem;
		exports.apply = apply;
		exports.createClientModuleSystem = createClientModuleSystem;
		exports.exactPackageSpecifier = exactPackageSpecifier;
		exports.inject = inject;
		exports.parseBootManifest = parseBootManifest;
		exports.parseDshClient = parseDshClient;
		exports.stripClientSuffix = stripClientSuffix;
		exports.tearDownEntryFiber = tearDownEntryFiber;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
