/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-modules",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region lib/types/client/manifest.js
		/**
		* Client module system: the browser peer of Node's internal ESM loader, built
		* as a lazy CJS table. The vendored cordis Loader consumes this object
		* through its `internal` contract (the only call site is `EntryTree.import` →
		* `internal.import`), which keeps entry governance (fiber lifecycle, inject
		* waiting, update/refresh) entirely on the vendored side while this package
		* owns code arrival.
		*
		* Lazy CJS model: executing a plugin bundle only REGISTERS its
		* factory (`window.__ModuleLoader__.load({id, factory})`); every module body
		* side effect — including CSS injection — lives inside the factory closure
		* and runs at materialization, not at script execution. Materialization
		* (factory(require) → exports) happens on first import/require and is
		* memoized in {@link ClientModuleLoader.loadCache}; a factory that requires
		* another registered-but-unmaterialized module materializes it recursively,
		* so load order needs no external sequencing.
		*
		* Resolution branch order (import): seed word → shell instance; memoized
		* record → exports; graph row → register its dependency factories and own
		* factory; registered factory → materialize; anything else → throw (loud —
		* the runtime mirror of the build-time bundle purity gate).
		* The synchronous `require` handed to factories walks the same order minus
		* the load branch. Loading is async, so a requested dynamic package must have
		* registered its factory before a consumer materializes.
		*
		* This file is the browser-safe contract face (zero node imports): the
		* `__DSH_BOOT__` wire types, the boot-manifest parser, and the boundaries around
		* {@link ClientModuleSystem}. The package root is the host-side service that
		* composes the wire.
		*/
		/**
		* Validate an optional string-array field read from a `dsh.client` declaration
		* or from the boot wire.
		* @param subject - diagnostic prefix naming the package or the wire row.
		* @param field - field name as it appears in the diagnostic.
		* @param value - the raw field value.
		* @returns the validated array, or undefined when the field is absent.
		* @throws {Error} when the value is present but is not an array of strings.
		*/
		function optionalStringArray(subject, field, value) {
			if (value === void 0) return void 0;
			if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new Error(`client-modules: ${subject} ${field} must be a string array`);
			return value;
		}
		/**
		* Narrow an unknown parsed JSON value to the `dsh.client` declaration. Shared
		* by the node half's Loader scan and the roster generator, so both read a
		* package's browser declaration through one validator.
		* @param pkgName - package name used as the diagnostic prefix.
		* @param value - the raw `dsh.client` field of the package manifest.
		* @returns the validated declaration, or undefined when the field is absent.
		* @throws {Error} when the field is present but any member is malformed.
		*/
		function parseDshClient(pkgName, value) {
			if (value === void 0) return void 0;
			if (typeof value !== "object" || value === null) throw new Error(`client-modules: ${pkgName} has a non-object dsh.client declaration`);
			const decl = value;
			if (typeof decl.platform !== "string") throw new Error(`client-modules: ${pkgName} dsh.client.platform must be a string`);
			const inject = optionalStringArray(pkgName, "dsh.client.inject", decl.inject);
			const external = optionalStringArray(pkgName, "dsh.client.external", decl.external);
			if (decl.immediately !== void 0 && typeof decl.immediately !== "boolean") throw new Error(`client-modules: ${pkgName} dsh.client.immediately must be a boolean`);
			return {
				platform: decl.platform,
				...inject !== void 0 ? { inject } : {},
				...external !== void 0 ? { external } : {},
				...decl.immediately !== void 0 ? { immediately: decl.immediately } : {}
			};
		}
		/**
		* The bare package-root specifier `specifier` names, or undefined for a subpath, a path, or any scheme-qualified
		* specifier (`cordis:` builtins, `node:` modules, URLs).
		* @param specifier - Loader row name.
		* @returns the package name, or undefined.
		*/
		function exactPackageSpecifier(specifier) {
			if (specifier.startsWith("@")) {
				const parts = specifier.split("/");
				return parts.length === 2 && parts.every(Boolean) ? specifier : void 0;
			}
			return specifier.length > 0 && !specifier.includes("/") && !specifier.includes(":") ? specifier : void 0;
		}
		/**
		* Normalize a module specifier onto the graph row that owns it: a plugin bundle
		* IS its package's client half, so `<id>/client` (the exports subpath external
		* bundles emit) and the bare package name resolve to the same exports. Both the
		* require path and graph composition normalize here, which is what lets each
		* importing package request the subpath its own code imports.
		* @param spec - module specifier as a bundle requires it or a declaration spells it.
		* @returns the specifier with a trailing `/client` removed.
		*/
		function stripClientSuffix(spec) {
			return spec.endsWith("/client") ? spec.slice(0, -7) : spec;
		}
		/**
		* Parse `window.__DSH_BOOT__` into the two consumer views. Wire boundary:
		* a missing or malformed graph throws (the shell shows the loud failure —
		* a page without a valid manifest cannot boot anything).
		* @param wire - the raw `window.__DSH_BOOT__` value.
		* @returns the manifest with optional plugin-view fields normalized.
		*/
		function parseBootManifest(wire) {
			if (typeof wire !== "object" || wire === null) throw new Error("client-modules: window.__DSH_BOOT__ is missing or not an object");
			const graph = wire;
			if (typeof graph.rev !== "string") throw new Error("client-modules: boot manifest rev must be a string");
			const release = decodeRelease(graph.release);
			if (release === null) throw new Error("client-modules: boot manifest release must carry a string version and an optional string commit");
			if (!Array.isArray(graph.entries)) throw new Error("client-modules: boot manifest entries must be an array");
			if (!Array.isArray(graph.batches)) throw new Error("client-modules: boot manifest batches must be an array");
			const moduleFields = [];
			const plugins = [];
			const seenEntryIds = /* @__PURE__ */ new Set();
			for (const value of graph.entries) {
				if (typeof value !== "object" || value === null) throw new Error("client-modules: boot manifest entry is not an object");
				const row = value;
				const where = typeof row.id === "string" ? `"${row.id}"` : JSON.stringify(row);
				if (typeof row.id !== "string" || typeof row.url !== "string" || typeof row.rev !== "string") throw new Error(`client-modules: boot manifest entry ${where} must carry string id/url/rev`);
				if (seenEntryIds.has(row.id)) throw new Error(`client-modules: duplicate graph entry "${row.id}"`);
				seenEntryIds.add(row.id);
				const subject = `boot manifest entry ${where}`;
				const inject = optionalStringArray(subject, "inject", row.inject);
				const external = optionalStringArray(subject, "external", row.external);
				if (row.immediately !== void 0 && typeof row.immediately !== "boolean") throw new Error(`client-modules: boot manifest entry ${where} immediately must be a boolean`);
				moduleFields.push({
					id: row.id,
					url: row.url,
					rev: row.rev,
					inject: inject === void 0 ? [] : [...inject],
					external: external === void 0 ? [] : [...external]
				});
				plugins.push({
					id: row.id,
					inject: inject === void 0 ? [] : [...inject],
					immediately: row.immediately === true
				});
			}
			const entryIds = new Set(moduleFields.map((row) => row.id));
			const initialUrls = /* @__PURE__ */ new Map();
			const batchUrls = /* @__PURE__ */ new Set();
			for (const value of graph.batches) {
				if (typeof value !== "object" || value === null) throw new Error("client-modules: boot manifest batch is not an object");
				const batch = value;
				const phase = batch.phase;
				if (phase !== "bootstrap" && phase !== "application") throw new Error(`client-modules: boot manifest batch phase must be "bootstrap" or "application", received ${JSON.stringify(phase)}`);
				if (typeof batch.url !== "string" || typeof batch.rev !== "string") throw new Error(`client-modules: boot manifest ${phase} batch must carry string url/rev`);
				if (batchUrls.has(batch.url)) throw new Error(`client-modules: boot manifest carries duplicate batch URL ${JSON.stringify(batch.url)}`);
				batchUrls.add(batch.url);
				const entries = optionalStringArray(`boot manifest ${phase} batch`, "entries", batch.entries);
				if (entries === void 0 || entries.length === 0) throw new Error(`client-modules: boot manifest ${phase} batch entries must be a non-empty string array`);
				for (const id of entries) {
					if (!entryIds.has(id)) throw new Error(`client-modules: boot manifest ${phase} batch names unknown entry "${id}"`);
					if (initialUrls.has(id)) throw new Error(`client-modules: boot manifest entry "${id}" belongs to more than one batch`);
					initialUrls.set(id, batch.url);
				}
			}
			const modules = moduleFields.map((row) => {
				const initialUrl = initialUrls.get(row.id);
				if (initialUrl === void 0) throw new Error(`client-modules: boot manifest entry "${row.id}" belongs to no initial-load batch`);
				return {
					...row,
					initialUrl
				};
			});
			return {
				rev: graph.rev,
				...release === void 0 ? {} : { release },
				modules,
				plugins
			};
		}
		/**
		* Decode a wire release identity, dropping members outside {@link WebBootRelease}.
		* @param value - the graph's `release` member.
		* @returns the release, undefined when absent, or null when present but malformed.
		*/
		function decodeRelease(value) {
			if (value === void 0) return void 0;
			const release = typeof value === "object" && value !== null ? value : void 0;
			const commit = release?.commit;
			if (release === void 0 || typeof release.version !== "string" || commit !== void 0 && typeof commit !== "string") return null;
			return {
				version: release.version,
				...commit === void 0 ? {} : { commit }
			};
		}
		/**
		* Read a Host graph's release without validating the rest of the graph, so releases stay comparable
		* when another release changes the graph format.
		* @param wire - JSON-decoded graph received from the Host.
		* @returns the release, or undefined when the graph carries none or it cannot be read.
		*/
		function readRelease(wire) {
			if (typeof wire !== "object" || wire === null) return void 0;
			return decodeRelease(wire.release) ?? void 0;
		}
		//#endregion
		//#region lib/types/client/notify.js
		/** Subscriber notification for the page controller's observable sources. */
		/**
		* Call every subscriber; one throwing subscriber must not skip the rest.
		* @param listeners - current subscribers; copied before dispatch.
		* @param label - diagnostic owner named in the error log.
		*/
		function notifySubscribers(listeners, label) {
			for (const listener of [...listeners]) try {
				listener();
			} catch (error) {
				console.error(`client-modules: ${label} subscriber failed`, error);
			}
		}
		//#endregion
		//#region lib/types/client/release-change.js
		/** Whether two releases are the same: both absent, or equal in every field. */
		function sameRelease(left, right) {
			return left?.version === right?.version && left?.commit === right?.commit;
		}
		/** Release identity as diagnostic text. */
		function describeRelease(release) {
			return release === void 0 ? "none" : JSON.stringify(release);
		}
		/**
		* Tracks the connected Host's release against the page's boot release. The page applies graphs and
		* rebuilt frames only while both match, so every module it runs belongs to its boot release; another
		* release waits for a page reload. A mismatch is announced unless the page dismissed that Host release.
		*/
		var ReleaseChangeGate = class {
			page;
			/** Prompt-worthy release change; undefined while the Host serves the boot release or a dismissed one. */
			change = {
				getSnapshot: () => this.snapshot,
				subscribe: (listener) => {
					this.listeners.add(listener);
					return () => {
						this.listeners.delete(listener);
					};
				}
			};
			snapshot;
			listeners = /* @__PURE__ */ new Set();
			host;
			/** Host release the page last dismissed; a holder because an unpublished release is itself a value. */
			dismissed;
			/**
			* Start with the Host that served the boot graph.
			* @param page - boot graph's release identity.
			*/
			constructor(page) {
				this.page = page;
				this.host = page;
			}
			/** Whether the connected Host serves the page's boot release; graphs and rebuilt frames apply only then. */
			get matches() {
				return sameRelease(this.host, this.page);
			}
			/**
			* Record the release of a received Host graph and update the announced change.
			* @param release - release identity of the received graph.
			* @returns true when the graph belongs to the page's boot release and may be applied.
			*/
			observe(release) {
				const previous = this.host;
				this.host = release;
				if (this.matches || this.dismissed !== void 0 && sameRelease(release, this.dismissed.release)) {
					if (this.snapshot !== void 0) this.publish(void 0);
				} else if (this.snapshot === void 0 || !sameRelease(this.snapshot.host, release)) {
					console.warn(`client-modules: Host release changed from ${describeRelease(previous)} to ${describeRelease(release)}; plugin updates pause until this page reloads`);
					this.publish({
						page: this.page,
						previous,
						host: release
					});
				}
				return this.matches;
			}
			/** Stop announcing the connected Host's release; the page keeps its boot release and still applies no other release. */
			dismiss() {
				if (this.snapshot === void 0) return;
				this.dismissed = { release: this.host };
				this.publish(void 0);
			}
			publish(snapshot) {
				this.snapshot = snapshot;
				notifySubscribers(this.listeners, "release change");
			}
		};
		//#endregion
		//#region lib/types/client/entry-lifecycle.js
		/**
		* Release a runtime before clearing its entry fiber so Loader refresh can import new code.
		* Registry deletion prevents Loader from treating replacement as a user disable.
		* @param entry - Entry retained for code replacement.
		*/
		async function tearDownEntryFiber(entry) {
			const fiber = entry.fiber;
			if (fiber === void 0) return;
			const runtime = fiber.runtime;
			/* v8 ignore next -- Loader entries own plugin fibers; only the root context has a null runtime. */
			if (runtime !== null) entry.ctx.registry.delete(runtime.callback);
			while (fiber.inertia !== void 0) await fiber.inertia;
			delete entry.fiber;
		}
		/**
		* Remove styles after their plugin's effect cleanup has settled.
		* @param id - Package whose factory owns the style tags.
		*/
		function removeOwnedStyles(id) {
			if (typeof document === "undefined") return;
			for (const el of document.querySelectorAll("style[data-plugin]")) if (el.getAttribute("data-plugin") === id) el.remove();
		}
		//#endregion
		//#region lib/types/client/entries.js
		/** Numeric values mirror Cordis's const enum, which bundle loaders cannot import as a runtime object. */
		const ACTIVE = 2;
		const FAILED = 3;
		/** Revisions and requests identify desired code; URLs only select its immutable delivery resource. */
		function entryTargets(manifest) {
			return JSON.stringify(manifest.modules.map((row) => [
				row.id,
				row.rev,
				row.inject,
				row.external
			]));
		}
		/** Manages only entries created from the Host manifest; other Loader contributors retain ownership. */
		var ClientEntries = class {
			modules;
			index;
			/** Stable observable consumed by page diagnostics through the renderer's injected hook. */
			state = {
				getSnapshot: () => this.snapshot,
				subscribe: (listener) => {
					this.listeners.add(listener);
					return () => {
						this.listeners.delete(listener);
					};
				}
			};
			snapshot = {
				syncing: false,
				failures: []
			};
			listeners = /* @__PURE__ */ new Set();
			/** Admits only Host graphs of the page's boot release. */
			release;
			managed = /* @__PURE__ */ new Map();
			revisions = /* @__PURE__ */ new Map();
			loader;
			queue = Promise.resolve();
			desired;
			generation = 0;
			stopped = false;
			/**
			* Construct the page controller before Cordis boot.
			* @param modules - Module arrival and materialization owner.
			* @param index - Private descriptor replacement and unused-module cleanup.
			*/
			constructor(modules, index) {
				this.modules = modules;
				this.index = index;
				this.desired = modules.manifest;
				this.release = new ReleaseChangeGate(modules.manifest.release);
			}
			/** Host release change to announce; undefined while the Host serves the page's boot release or a dismissed one. */
			get releaseChange() {
				return this.release.change;
			}
			/** Stop announcing the connected Host's release; updates stay paused until the Host returns to the boot release or the page reloads. */
			dismissRelease() {
				this.release.dismiss();
			}
			/**
			* Create the initial roster and retain its entry identities for subsequent reconciliation.
			* @param loader - Page Loader, already configured with the module system.
			* @param manifest - Initial roster audited by the boot caller.
			* @returns after initial entries and their activation settle; boot owns its activation audit.
			*/
			start(loader, manifest) {
				if (this.loader !== void 0) throw new Error("client-modules: entries already started");
				this.loader = loader;
				this.desired = manifest;
				loader.ctx.effect(() => () => {
					this.stopped = true;
					this.generation++;
					return this.queue;
				}, "client-modules: entry reconciliation");
				return this.enqueue(async () => {
					await Promise.all(this.desired.plugins.map(async ({ id }) => {
						await this.create(loader, id);
					}));
					await loader.await();
					for (const row of this.modules.manifest.modules) this.revisions.set(row.id, row.rev);
				});
			}
			/**
export {};
