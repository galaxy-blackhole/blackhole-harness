/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						this.patch({ confirm: null });
					},
					setRowEnabled: (entryId, enabled) => {
						this.run(rowKey(entryId), {
							packageName: entryId,
							action: enabled ? "rowEnable" : "rowDisable"
						}, async () => {
							const result = await this.ctx.remote.pluginManager.setPluginEnabled(entryId, enabled);
							this.applied(result, entryId);
							if (result.ok && (result.value.application === "applied" || result.value.application === "restart-required")) this.trackToggle(entryId, enabled, true);
						});
					},
					dismissNotice: () => {
						this.patch({ notice: null });
					}
				};
			}
			/**
			* Open the install dialog: a new one starts from the registry last used here and reads what the Host offers; a hidden
			* installation reopens as it is.
			* @returns whether a new dialog started.
			*/
			openDialog() {
				const started = this.getSnapshot().install.requestId === void 0;
				if (started) {
					this.transientRegistry = false;
					this.patch({ install: {
						...IDLE_INSTALL,
						open: true,
						registry: this.registryMemory.getSnapshot() ?? OFFICIAL_REGISTRY
					} });
					const read = { choice: this.getSnapshot().install.registry };
					this.registryRead = read;
					read.done = this.readRegistries(read).finally(() => {
						delete read.done;
					});
				} else this.patchInstall({ open: true });
				this.reconcileInstall();
				return started;
			}
			/**
			* Follow the Host's cancellation window for this dialog's installation.
			* @param progress - a request id and phase received from the Host.
			*/
			installProgress(progress) {
				const install = this.getSnapshot().install;
				if (install.requestId !== progress.requestId || !isInstallPending(install.phase)) return;
				const request = this.request;
				if (request === void 0) return;
				request.acknowledged = true;
				if (install.phase === "applying") return;
				if (progress.phase === "installing" && request.cancellation !== void 0) {
					if (request.cancellation.waitingForStart) this.sendCancellation(request, request.cancellation);
					return;
				}
				const attempt = progress.attempt;
				this.patchInstall({
					phase: progress.phase === "installing" ? "running" : progress.phase,
					...attempt === void 0 ? {} : { attempts: {
						registries: [...install.attempts?.registries ?? [], attempt.registry],
						total: attempt.total
					} }
				});
			}
			currentRegistryRead(read) {
				return !this.disposed && this.registryRead === read;
			}
			/** Read the registries the Host offers, for the dialog just opened; a refused read leaves pnpm's own and a typed one. */
			async readRegistries(read) {
				const answer = await this.ctx.remote.pluginManager.registries();
				const install = this.getSnapshot().install;
				if (!this.currentRegistryRead(read) || !install.open || !answer.ok) return;
				const remembered = this.registryMemory.getSnapshot();
				const untouched = install.registry === read.choice && (install.phase === "idle" || install.phase === "checking");
				if (untouched) read.choice = reconciled(remembered, answer.value);
				this.patchInstall({
					registries: answer.value,
					...untouched ? { registry: read.choice } : {}
				});
				const mirror = eligibleMirror(answer.value);
				if (!untouched || remembered !== null || mirror === void 0) return;
				const fastest = await this.ctx.remote.pluginRegistryProbe.fastest();
				const current = this.getSnapshot().install;
				if (!this.currentRegistryRead(read) || !current.open || current.phase !== "idle" && current.phase !== "checking" || current.registry !== read.choice || !fastest.ok || fastest.value !== mirror) return;
				read.choice = {
					kind: "offered",
					registry: mirror
				};
				this.patchInstall({ registry: read.choice });
			}
			/**
			* Fold a chunk belonging to this installation into its pnpm command.
			* A final chunk may arrive after the install answer and still updates an existing run.
			* @param chunk - the chunk the Host forwarded.
			*/
			appendLog(chunk) {
				const install = this.getSnapshot().install;
				if (chunk.requestId !== install.requestId) return;
				if (install.requestId !== void 0 && (install.phase === "starting" || install.phase === "cancelling" || install.phase === "unconfirmed")) this.installProgress({
					requestId: install.requestId,
					phase: "installing"
				});
				const index = install.runs.findIndex((run) => run.jobId === chunk.jobId);
				if (index === -1 && !isInstallPending(install.phase)) return;
				const settled = chunk.exitCode === void 0 ? {} : { exitCode: chunk.exitCode };
				const runs = index === -1 ? [...install.runs, {
					jobId: chunk.jobId,
					command: chunk.argv.join(" "),
					cwd: chunk.cwd,
					output: chunk.text,
					...settled
				}] : install.runs.map((run, at) => at === index ? {
					...run,
					output: run.output + chunk.text,
					...settled
				} : run);
				this.patchInstall({ runs });
			}
			/**
			* Read the bundles and the entries their rows run as. A call during an
			* in-flight read marks one rerun after it settles.
			* @returns settlement after this call's freshness is reflected.
			*/
			load() {
				if (this.disposed) return Promise.resolve();
				this.reconcileInstall();
				if (this.inFlight !== void 0) {
					this.rerun = true;
					return this.inFlight;
				}
				const run = Promise.resolve().then(() => this.read());
				this.inFlight = run;
				return run;
			}
			/** Keep manual refresh feedback until its coalesced reads settle, without clearing cached cards. */
			async refresh() {
				if (this.disposed || this.getSnapshot().refreshStatus === "refreshing") return;
				const startedAt = Date.now();
				this.patch({
					refreshStatus: "refreshing",
					...this.getSnapshot().notice?.kind === "refresh-failed" ? { notice: null } : {}
				});
				try {
					await this.load();
				} catch (_error) {
					this.patch({ status: "error" });
				} finally {
					const remaining = REFRESH_SPINNER_MIN_MS - (Date.now() - startedAt);
					if (remaining > 0) await new Promise((resolve) => {
						setTimeout(resolve, remaining);
					});
					this.settleRefresh();
				}
			}
			/** Publish refresh feedback only before disposal. */
			settleRefresh() {
				if (this.disposed) return;
				const failed = this.getSnapshot().status === "error";
				this.patch(failed && this.hasCachedInventory ? {
					status: "ready",
					refreshStatus: "idle",
					notice: {
						kind: "refresh-failed",
						seq: ++this.noticeSeq
					}
				} : { refreshStatus: failed ? "failed" : "idle" });
			}
			async read() {
				try {
					do {
						this.rerun = false;
						const generation = ++this.generation;
						if (this.getSnapshot().status === "idle") this.patch({ status: "loading" });
						const inventory = await this.ctx.remote.pluginInventory.list();
						if (generation !== this.generation) return;
						if (!inventory.ok) {
							this.patch({ status: "error" });
							continue;
						}
						if (inventory.value.managementAvailable !== true) {
							this.hasCachedInventory = false;
							this.patch({
								status: "unavailable",
								packages: []
							});
							continue;
						}
						const [bundles, plugins] = await Promise.all([this.ctx.remote.pluginManager.listBundles(), this.ctx.remote.pluginManager.listPlugins()]);
						if (generation !== this.generation) return;
						if (!bundles.ok || !plugins.ok) {
							this.patch({ status: "error" });
							continue;
						}
						this.hasCachedInventory = true;
						this.patch({
							status: "ready",
							refreshStatus: this.getSnapshot().refreshStatus === "refreshing" ? "refreshing" : "idle",
							packages: sortPackages(bundles.value.map((bundle) => packageView(bundle, plugins.value)))
						});
					} while (this.shouldRerun());
				} finally {
					this.inFlight = void 0;
				}
			}
			shouldRerun() {
				return this.rerun;
			}
			async confirm() {
				const pending = this.pendingConfirm;
				this.pendingConfirm = void 0;
				this.patch({ confirm: null });
				if (pending !== void 0) await pending();
			}
			/** Drop the check in flight; its answer is ignored. */
			abortInspect() {
				this.inspectAbort?.abort();
				this.inspectAbort = void 0;
			}
			/** Whether a settlement arrives too late to matter: the store is disposed, or the dialog moved on. */
			gone(signal) {
				return this.disposed || signal.aborted;
			}
			/** Reuse the install dialog with an exact catalog target and an explicit selection outcome. */
			openCatalogInstall(pkg, target, enabled) {
				if (this.disposed) return;
				const { phase } = this.getSnapshot().install;
				if (phase === "checking" || isInstallPending(phase)) {
					this.patchInstall({ open: true });
					return;
				}
				this.abortInspect();
				const registry = this.registryMemory.getSnapshot() ?? OFFICIAL_REGISTRY;
				const local = target.spec.startsWith("link:");
				const subject = {
					status: "accepted",
					kind: local ? "path" : "registry",
					name: pkg.name,
					version: target.version,
					bundle: true,
					spec: target.spec,
					registry: registry.kind === "custom" ? registry.url : registry.registry,
					selection: enabled,
					...local ? {} : { saveExact: true }
				};
				this.patch({ install: {
					...IDLE_INSTALL,
					open: true,
					spec: subject.spec,
					registry,
					subject
				} });
				const read = { choice: registry };
				this.registryRead = read;
				read.done = this.readRegistries(read).finally(() => {
					delete read.done;
				});
				this.runInstall();
			}
			/**
			* Check the typed spec, then install it. The Host reads what the spec
			* names first; a refused spec returns to the field with the reason, an
			* accepted one becomes the subject the next screens show while pnpm runs.
			*/
			async runInstall() {
				const state = this.getSnapshot();
				const install = state.install;
				const spec = install.spec.trim();
				if (install.phase === "checking" || isInstallPending(install.phase) || spec === "") return;
				if (this.ctx.get("productAnalytics")?.enabled) {
					this.analyticsAttempt = {
						input: sanitizeInstallInput(spec),
						started: Date.now()
					};
					this.ctx.get("productAnalytics")?.track("plugin_install_click", { input_value: sanitizeInstallInput(spec) });
				}
				const listed = state.packages.find((pkg) => pkg.name === spec);
				const catalogSubject = install.subject?.selection === void 0 || install.subject.spec !== spec ? void 0 : install.subject;
				if (listed !== void 0 && listed.availability !== "missing" && catalogSubject === void 0) {
					this.finishAnalytics("failed", "already-installed");
					this.patchInstall({
						phase: "idle",
						inputError: {
							problem: listed.availability === "installation" ? "shipped" : "already-installed",
							reason: spec
						}
					});
					return;
				}
				const choice = install.registry;
				const typed = choice.kind === "custom" ? choice.url.trim() : void 0;
				if (typed !== void 0 && !REGISTRY_URL.test(typed)) {
					this.finishAnalytics("failed", "invalid-registry");
					this.patchInstall({
						phase: "idle",
						registryError: true,
						registryOpen: true
					});
					return;
				}
				this.abortInspect();
				const controller = new AbortController();
				this.inspectAbort = controller;
				this.patchInstall({
					phase: "checking",
					inputError: null,
					subject: catalogSubject ?? null,
					runs: [],
					detailsOpen: false,
					attempts: null,
					registryOpen: false,
					installed: null,
					installedVersion: null,
					restartRequired: false,
					failure: null,
					approvedBuilds: []
				});
				const read = this.registryRead;
				if (read !== void 0 && choice === read.choice && read.done !== void 0) {
					await read.done;
					if (this.gone(controller.signal) || this.registryRead !== read) return;
				}
				const currentChoice = this.getSnapshot().install.registry;
				const selected = currentChoice.kind === "custom" ? {
					...currentChoice,
					url: currentChoice.url.trim()
				} : currentChoice;
				const registry = selected.kind === "custom" ? selected.url : selected.registry;
				if (!this.transientRegistry) this.registryMemory.set(selected);
				if (catalogSubject !== void 0) {
					this.inspectAbort = void 0;
					await this.startInstall({
						...catalogSubject,
						registry
					});
					return;
				}
				const inspected = await this.ctx.remote.pluginManager.inspect(spec, { registry }, controller.signal);
				if (this.gone(controller.signal)) return;
				this.inspectAbort = void 0;
				if (!inspected.ok) {
					this.finishAnalytics("failed", inspected.error.code);
					this.patchInstall({
						phase: "idle",
						inputError: {
							problem: "unknown",
							reason: inspected.error.message
						}
					});
					return;
				}
				if (inspected.value.status === "refused") {
					const { problem, reason, registries } = inspected.value;
					this.finishAnalytics("failed", problem);
					this.patchInstall({
						phase: "idle",
						inputError: {
							problem,
							reason,
							...registries === void 0 ? {} : { registries }
						}
					});
					return;
				}
				await this.startInstall({
					spec,
					...inspected.value
				});
			}
			/**
			* Hand the checked spec to the Host and settle the dialog from its answer.
			* `approvedBuilds` names the pending install scripts the person allowed;
			* the Host saves that permission for this profile before pnpm runs.
			*/
			async startInstall(subject, approvedBuilds) {
				const { spec, registry } = subject;
				const requestId = randomUUID();
				const request = {
					requestId,
					acknowledged: false,
					replyLost: false,
					recovering: false
				};
				this.request = request;
				this.patchInstall({
					phase: "starting",
					requestId,
					subject,
					runs: [],
					attempts: null,
					failure: null,
					installed: null,
					installedVersion: null,
					approvedBuilds: []
				});
				const result = await this.ctx.remote.pluginManager.installBundle(spec, {
					enabled: subject.selection ?? false,
					requestId,
					registry,
					...subject.saveExact === void 0 ? {} : { saveExact: subject.saveExact },
					...approvedBuilds === void 0 ? {} : { approvedBuilds: [...approvedBuilds] }
export {};
