/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		}
		/** A refused answer or a change the Host could not apply, carrying what it said and, for a refusal, its code. */
		var RemoteAnswerError = class extends Error {
			reason;
			code;
			incompatible;
			constructor(reason, code, incompatible) {
				super(reason);
				this.reason = reason;
				this.code = code;
				this.incompatible = incompatible;
				this.name = "RemoteAnswerError";
			}
		};
		/** The dialog's reading of a failed change: the Host's code and diagnostic, and the run's classified failure. */
		function failureOf(error, kind, pendingBuilds, failedAt) {
			return {
				reason: error?.diagnostic ?? "",
				...error === void 0 ? {} : { code: error.code },
				...error?.incompatible === void 0 ? {} : { incompatible: error.incompatible },
				...kind === void 0 ? {} : { kind },
				...failedAt === void 0 ? {} : { failedAt },
				...pendingBuilds === void 0 || pendingBuilds.length === 0 ? {} : { pendingBuilds }
			};
		}
		/** The notice a thrown failure becomes: a refusal keeps its code, anything else its words. */
		function failedNotice(error, subject, seq) {
			const code = error instanceof RemoteAnswerError ? error.code : void 0;
			const incompatible = error instanceof RemoteAnswerError ? error.incompatible : void 0;
			return {
				kind: "failed",
				reason: reasonOf(error),
				...code === void 0 ? {} : { code },
				...incompatible === void 0 ? {} : { incompatible },
				...subject,
				seq
			};
		}
		/** The runs with every one still open settled at `exitCode`. */
		function settledRuns(runs, exitCode) {
			return runs.map((run) => run.exitCode === void 0 ? {
				...run,
				exitCode
			} : run);
		}
		/**
		* The key one row occupies in the busy list.
		* @param entryId - the row's Loader entry id.
		* @returns the busy key.
		*/
		function rowKey(entryId) {
			return `row:${entryId}`;
		}
		/**
		* One bundle as the page shows it: its rows joined with the Host's entries.
		* @param bundle - the Host's bundle.
		* @param plugins - the Host's plugin entries.
		* @returns the package view.
		*/
		function packageView(bundle, plugins) {
			const rows = bundle.rows.map((row) => {
				const live = row.entryId === void 0 ? void 0 : plugins.find((plugin) => plugin.entryId === row.entryId);
				return {
					rowId: row.rowId,
					moduleName: row.moduleName,
					enabled: live?.enabled ?? false,
					phase: live?.fiberPhase ?? null,
					...row.meta === void 0 ? {} : { meta: row.meta },
					...row.entryId === void 0 ? {} : { entryId: row.entryId },
					...live?.readOnlyReason === void 0 ? {} : { readOnlyReason: live.readOnlyReason }
				};
			});
			return {
				name: bundle.name,
				official: bundle.official,
				availability: bundle.availability,
				...bundle.installTarget === void 0 ? {} : { installTarget: bundle.installTarget },
				installed: bundle.installed,
				optional: bundle.optional,
				removable: bundle.removable,
				enabled: bundle.enabled,
				rows,
				...bundle.version === void 0 ? {} : { version: bundle.version },
				...bundle.source === void 0 ? {} : { source: bundle.source },
				...bundle.description === void 0 ? {} : { description: bundle.description },
				...bundle.meta === void 0 ? {} : { meta: bundle.meta },
				...bundle.readOnlyReason === void 0 ? {} : { readOnlyReason: bundle.readOnlyReason },
				...bundle.error === void 0 ? {} : { error: bundle.error }
			};
		}
		/**
		* The order the list shows packages in: by the short name a person reads, so a
		* card stays put when its bundle is switched, whatever order the Host answers in.
		* @param packages - the Host's bundles as views.
		* @returns the views sorted by short name.
		*/
		function sortPackages(packages) {
			return [...packages].sort((a, b) => shortName(a.name).localeCompare(shortName(b.name)));
		}
		const IDLE_INSTALL = {
			open: false,
			spec: "",
			registries: null,
			registry: OFFICIAL_REGISTRY,
			registryOpen: false,
			registryError: false,
			attempts: null,
			phase: "idle",
			inputError: null,
			subject: null,
			runs: [],
			detailsOpen: false,
			installed: null,
			installedVersion: null,
			restartRequired: false,
			failure: null,
			approvedBuilds: [],
			enabling: false
		};
		/** The dialog back at its spec: the run and its outcome forgotten, the spec and the registries kept. */
		function specAgain(install) {
			const { open, spec, registries, registry, mirrorRecovery, confirmed } = install;
			return {
				...IDLE_INSTALL,
				open,
				spec,
				registries,
				registry,
				...install.subject?.selection === void 0 ? {} : { subject: install.subject },
				...mirrorRecovery === void 0 ? {} : { mirrorRecovery },
				...confirmed === void 0 ? {} : { confirmed }
			};
		}
		/**
		* The choice as the dialog can show it once the Host has answered: nothing remembered starts from the registry the
		* Host asks first; a remembered registry the Host now asks under another entry takes that entry, and one it no
		* longer offers is kept as a typed one.
		*/
		function reconciled(remembered, registries) {
			if (remembered === null) return {
				kind: "offered",
				registry: registries.registry
			};
			if (remembered.kind === "custom" || remembered.registry === null) return remembered;
			const key = registryKey(remembered.registry, registries.resolved);
			const offered = offeredRegistries(registries).find((registry) => registryKey(registry, registries.resolved) === key);
			return offered === void 0 ? {
				kind: "custom",
				url: remembered.registry
			} : {
				kind: "offered",
				registry: offered
			};
		}
		/** Only the shipped public mirror can replace an unconfigured official npm default. */
		function eligibleMirror(registries) {
			if (registries.registry !== null || registries.resolved === null) return void 0;
			let resolved;
			try {
				resolved = normalizeRegistry(registries.resolved);
			} catch (_error) {
				return;
			}
			if (resolved !== "https://registry.npmjs.org/") return void 0;
			return registries.fallbackRegistries.find((registry) => registry === NPMMIRROR_REGISTRY);
		}
		/** Reads and mutates the profile's plugins through the `pluginManager` Remote. */
		var PluginManagerController = class {
			ctx;
			store;
			inFlight;
			rerun = false;
			generation = 0;
			disposed = false;
			/** A successful managed-profile read remains usable even when it returned no bundles. */
			hasCachedInventory = false;
			pendingConfirm;
			/** Cancels the check the dialog has in flight. */
			inspectAbort;
			request;
			noticeSeq = 0;
			analyticsAttempt;
			registryRead;
			/** A Discover entry chose the dialog's registry; that choice applies to this dialog only and is never remembered. */
			transientRegistry = false;
			/** The registry last used from this browser, kept across dialogs and page loads; null until one was used. */
			registryMemory = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(null, { persist: { name: "dsh.plugin-manager.install-registry" } });
			/**
			* @param ctx - the tab plugin's context, whose `remote.pluginManager` and `remote.pluginInventory` namespaces answer.
			*/
			constructor(ctx) {
				this.ctx = ctx;
				this.store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
					status: "idle",
					refreshStatus: "idle",
					packages: [],
					busy: [],
					notice: null,
					install: IDLE_INSTALL,
					confirm: null,
					highlight: null
				});
			}
			/**
			* Read the tab's state.
			* @returns the current sync snapshot (stable reference until the next change).
			*/
			getSnapshot() {
				return this.store.getSnapshot();
			}
			/** Stop publishing and drop every late settlement. */
			dispose() {
				this.disposed = true;
				this.registryRead = void 0;
				this.request = void 0;
				this.generation += 1;
			}
			/**
			* Build the face the tab's slot registration injects.
			* @param configLedger - the projection of the plugins carrying configuration, bound beside the tab's own state.
			* @param pluginTabs - the tabs other plugins contribute through `plugins.tab`.
			* @param resolveText - render-time package text resolution supplied by the locale service.
			* @returns the tab's snapshot sources and its actions.
			*/
			inject(configLedger, pluginTabs, resolveText) {
				return {
					resolveText,
					hooks: {
						pluginManager: this.store,
						configLedger,
						pluginTabs,
						configurations: this.ctx.configForms.describe()
					},
					configForm: (id) => this.ctx.configForms.get(id),
					ensure: () => {
						if (this.getSnapshot().status === "idle") this.load();
					},
					refresh: () => {
						this.refresh();
					},
					openInstall: () => {
						this.ctx.get("productAnalytics")?.track("plugin_add_button_click", {});
						this.openDialog();
					},
					installFrom: ({ spec, registry, title, version }) => {
						if (!this.openDialog()) return;
						this.transientRegistry = registry !== void 0;
						this.patchInstall({
							spec,
							confirmed: {
								title,
								version
							},
							...registry === void 0 ? {} : { registry: {
								kind: "custom",
								url: registry
							} }
						});
						this.runInstall();
					},
					closeInstall: () => {
						if (isInstallPending(this.getSnapshot().install.phase)) {
							this.patchInstall({ open: false });
							this.cancelInstall();
							return;
						}
						if (this.getSnapshot().install.phase === "checking") this.finishAnalytics("cancelled");
						this.abortInspect();
						this.registryRead = void 0;
						this.patch({ install: IDLE_INSTALL });
					},
					editInstallSpec: (text) => {
						const install = this.getSnapshot().install;
						if (install.phase === "checking" || isInstallPending(install.phase)) return;
						this.patchInstall(install.phase === "idle" ? {
							spec: text,
							inputError: null,
							subject: null
						} : {
							...specAgain(install),
							spec: text,
							subject: null
						});
					},
					runInstall: () => {
						this.runInstall();
					},
					toggleRegistryOptions: () => {
						this.patchInstall({ registryOpen: !this.getSnapshot().install.registryOpen });
					},
					chooseRegistry: (choice) => {
						if (this.getSnapshot().install.phase !== "idle") return;
						this.transientRegistry = false;
						this.patchInstall({
							registry: choice,
							registryError: false
						});
					},
					changeRegistry: () => {
						const install = this.getSnapshot().install;
						if (install.phase === "failed") this.patch({ install: {
							...specAgain(install),
							registryOpen: true
						} });
					},
					useGithubMirror: () => {
						const install = this.getSnapshot().install;
						const mirror = githubRecoveryRegistry(install);
						if (mirror === void 0) return;
						const recovered = {
							...specAgain(install),
							spec: "",
							mirrorRecovery: true
						};
						if (asksMirror(install)) {
							this.patch({ install: recovered });
							return;
						}
						const registry = {
							kind: "offered",
							registry: mirror
						};
						this.registryMemory.set(registry);
						this.patch({ install: {
							...recovered,
							registry
						} });
					},
					approveBuildsAndRetry: () => {
						this.approveBuildsAndRetry();
					},
					cancelInstall: () => {
						this.cancelInstall();
					},
					reconcileInstall: () => {
						this.reconcileInstall();
					},
					toggleInstallDetails: () => {
						this.patchInstall({ detailsOpen: !this.getSnapshot().install.detailsOpen });
					},
					enableInstalled: () => {
						this.enableInstalled();
					},
					clearHighlight: () => {
						if (this.getSnapshot().highlight !== null) this.patch({ highlight: null });
					},
					setEnabled: (packageName, enabled) => {
						const pkg = this.getSnapshot().packages.find((pkg) => pkg.name === packageName);
						if (enabled && pkg?.availability === "missing" && pkg.installTarget !== void 0) {
							this.openCatalogInstall(pkg, pkg.installTarget, true);
							return;
						}
						this.run(packageName, {
							packageName,
							action: enabled ? "enable" : "disable"
						}, async () => {
							const result = await this.ctx.remote.pluginManager.setBundleEnabled(packageName, enabled);
							this.applied(result, packageName);
							if (result.ok && (result.value.application === "applied" || result.value.application === "restart-required")) this.trackToggle(packageName, enabled);
						});
					},
					update: (packageName) => {
						const pkg = this.getSnapshot().packages.find((pkg) => pkg.name === packageName);
						const target = pkg?.installTarget;
						if (pkg === void 0 || target === void 0 || pkg.availability === "installation") return;
						if (!pkg.installed) {
							this.openCatalogInstall(pkg, target, pkg.enabled);
							return;
						}
						this.run(packageName, {
							packageName,
							action: "uninstall"
						}, async () => {
							const removed = await this.ctx.remote.pluginManager.removeBundle(packageName);
							if (removed.ok && removed.value.error?.code === "stop-profile") {
								this.openCatalogInstall(pkg, target, pkg.enabled);
								return;
							}
							this.applied(removed, packageName);
							this.openCatalogInstall(pkg, target, pkg.enabled);
						});
					},
					uninstall: (packageName) => {
						this.pendingConfirm = () => this.run(packageName, {
							packageName,
							action: "uninstall"
						}, async () => {
							this.ctx.get("productAnalytics")?.track("confirm_uninstall_plugin", { plugin_name: packageName });
							this.applied(await this.ctx.remote.pluginManager.removeBundle(packageName), packageName);
						});
						this.patch({ confirm: {
							action: "uninstall",
							packageName
						} });
					},
					confirm: () => {
						this.confirm();
					},
					cancelConfirm: () => {
						this.pendingConfirm = void 0;
export {};
