/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-cordis-client-runner/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/orchestrator.js
		/**
		* Page-side run orchestration for model approvals and direct panel gestures.
		* Host activation always precedes Client loading. The same Plugin-keyed state
		* drives every surface, so remounting a panel never loses an open approval or
		* an in-flight transition.
		*/
		/** Drives Host → Client activation and publishes Plugin-keyed activity. */
		var CordisRunOrchestrator = class {
			env;
			requests = /* @__PURE__ */ new Map();
			activity = /* @__PURE__ */ new Map();
			failures = /* @__PURE__ */ new Map();
			inFlight = /* @__PURE__ */ new Map();
			listeners = /* @__PURE__ */ new Set();
			activityCache;
			failureCache;
			/** @param env - Client loader and folded Host operations. */
			constructor(env) {
				this.env = env;
			}
			/** Open approvals and current activation attempts, keyed by stable Plugin ID. */
			activeRuns = {
				getSnapshot: () => this.activityCache ??= new Map(this.activity),
				subscribe: (fn) => this.observe(fn)
			};
			/** Latest page-side activation failure for each Plugin. */
			lastRunError = {
				getSnapshot: () => this.failureCache ??= new Map(this.failures),
				subscribe: (fn) => this.observe(fn)
			};
			/**
			* Register a Client activation request, starting it immediately when the Plugin is already authorized.
			* @param request - forwarded approval and activation metadata.
			*/
			open(request) {
				this.requests.set(request.requestId, request);
				if (!request.requiresApproval) {
					this.orchestrate({
						agentId: request.agentId,
						pluginId: request.pluginId,
						packageId: request.packageId,
						mode: request.mode,
						requestId: request.requestId,
						hasClientHalf: true
					}).catch((error) => {
						console.error(`[cordis-client-runner] automatic activation ${request.requestId} failed:`, error);
					});
					return;
				}
				if (this.activity.get(request.pluginId)?.phase !== "orchestrating") this.activity.set(request.pluginId, {
					phase: "awaiting-approval",
					requestId: request.requestId,
					agentId: request.agentId,
					packageId: request.packageId,
					mode: request.mode,
					name: request.name,
					purpose: request.purpose
				});
				this.commit();
			}
			/**
			* Rebuild pending approvals and automatic Client activations from an authoritative Host inventory read.
			* @param rows - complete process-wide Plugin inventory.
			*/
			reconcileApprovals(rows) {
				const expected = /* @__PURE__ */ new Map();
				for (const row of rows) {
					const attempt = row.latestRun;
					if (attempt?.approvalRequestId === void 0 || attempt.status !== "awaiting-approval" && attempt.status !== "starting-host" && attempt.status !== "client-pending") continue;
					const pkg = row.packages.find((candidate) => candidate.packageId === attempt.packageId);
					if (pkg === void 0) continue;
					expected.set(attempt.approvalRequestId, {
						requestId: attempt.approvalRequestId,
						agentId: row.agentId,
						pluginId: row.pluginId,
						packageId: attempt.packageId,
						mode: attempt.mode,
						name: pkg.name,
						purpose: pkg.purpose,
						requiresApproval: attempt.requiresApproval ?? attempt.status === "awaiting-approval"
					});
				}
				let changed = false;
				for (const [requestId, request] of [...this.requests]) {
					if (expected.has(requestId)) continue;
					this.requests.delete(requestId);
					const current = this.activity.get(request.pluginId);
					if (current?.phase === "awaiting-approval" && current.requestId === requestId) this.activity.delete(request.pluginId);
					changed = true;
				}
				for (const [requestId, request] of expected) {
					const previous = this.requests.get(requestId);
					const current = this.activity.get(request.pluginId);
					if (!request.requiresApproval && current?.phase === "orchestrating") continue;
					if (request.requiresApproval && sameRequest(previous, request) && current?.phase === "awaiting-approval" && current.requestId === requestId) continue;
					if (!request.requiresApproval) {
						this.open(request);
						changed = true;
						continue;
					}
					this.requests.set(requestId, request);
					if (current?.phase !== "orchestrating") this.activity.set(request.pluginId, {
						phase: "awaiting-approval",
						requestId,
						agentId: request.agentId,
						packageId: request.packageId,
						mode: request.mode,
						name: request.name,
						purpose: request.purpose
					});
					changed = true;
				}
				if (changed) this.commit();
			}
			/**
			* Close an approval settled by another page or by cancellation.
			* @param requestId - approval request that can no longer be answered here.
			*/
			close(requestId) {
				const request = this.requests.get(requestId);
				if (request === void 0) return;
				this.requests.delete(requestId);
				const current = this.activity.get(request.pluginId);
				if (current?.phase === "awaiting-approval" && current.requestId === requestId) this.activity.delete(request.pluginId);
				this.commit();
			}
			/**
			* Approve and execute one still-open model request.
			* @param requestId - approval request to execute.
			* @param approveFutureVersions - whether this approval covers later Packages for the same Plugin.
			*/
			approve(requestId, approveFutureVersions) {
				const request = this.requests.get(requestId);
				if (request === void 0 || !request.requiresApproval) return Promise.resolve();
				return this.orchestrate({
					agentId: request.agentId,
					pluginId: request.pluginId,
					packageId: request.packageId,
					mode: request.mode,
					requestId,
					approveFutureVersions,
					hasClientHalf: true
				});
			}
			/**
			* Reject one still-open model request without executing either half.
			* @param requestId - approval request to reject.
			*/
			async decline(requestId) {
				const request = this.requests.get(requestId);
				if (request === void 0 || !request.requiresApproval) return;
				const current = this.activity.get(request.pluginId);
				if (current?.phase !== "awaiting-approval" || current.requestId !== requestId) return;
				this.requests.delete(requestId);
				this.activity.delete(request.pluginId);
				this.commit();
				await this.answer(requestId, {
					ok: false,
					reason: "rejected"
				});
			}
			/**
			* Execute a direct panel run; the user gesture itself authorizes it.
			* @param request - exact Package activation selected by the user.
			*/
			startUserRun(request) {
				return this.orchestrate(request);
			}
			observe(fn) {
				this.listeners.add(fn);
				return () => {
					this.listeners.delete(fn);
				};
			}
			commit() {
				this.activityCache = void 0;
				this.failureCache = void 0;
				for (const fn of [...this.listeners]) fn();
			}
			orchestrate(plan) {
				const running = this.inFlight.get(plan.pluginId);
				if (running !== void 0) return running;
				this.activity.set(plan.pluginId, {
					phase: "orchestrating",
					agentId: plan.agentId,
					packageId: plan.packageId,
					mode: plan.mode
				});
				this.failures.delete(plan.pluginId);
				if (plan.requestId !== void 0) this.requests.delete(plan.requestId);
				this.commit();
				const attempt = this.drive(plan).finally(() => {
					this.inFlight.delete(plan.pluginId);
					this.activity.delete(plan.pluginId);
					this.commit();
				});
				this.inFlight.set(plan.pluginId, attempt);
				return attempt;
			}
			async drive(plan) {
				const started = await this.startHost(plan);
				if (!started.ok) {
					this.fail(plan, "host-half-failed", started);
					if (plan.requestId !== void 0) await this.answer(plan.requestId, {
						...started,
						reason: "host-half-failed"
					});
					return;
				}
				if (!plan.hasClientHalf) return;
				let source;
				try {
					source = await this.env.host.getClientCode(plan.agentId, plan.pluginId, started.pluginRunId);
				} catch (error) {
					await this.finishClientFailure(plan, started.pluginRunId, started.startedHere, errorDetails(error), error);
					return;
				}
				const loaded = await this.env.runner.load({
					pluginId: source.pluginId,
					packageId: source.packageId,
					pluginRunId: source.pluginRunId,
					agentId: plan.agentId,
					name: source.name,
					code: source.code
				}).catch((error) => ({
					ok: false,
					cause: "evaluate",
					...errorDetails(error),
					error
				}));
				if (!loaded.ok) {
					await this.finishClientFailure(plan, started.pluginRunId, started.startedHere, {
						message: `${loaded.cause}: ${loaded.message}`,
						...loaded.stack === void 0 ? {} : { stack: loaded.stack }
					}, loaded.error);
					return;
				}
				const resolution = {
					ok: true,
					pluginRunId: loaded.pluginRunId,
					...loaded.waitingFor === void 0 ? {} : { waitingFor: loaded.waitingFor }
				};
				if (plan.requestId !== void 0) {
					await this.answer(plan.requestId, resolution);
					return;
				}
				await this.settleDirect(plan, resolution);
			}
			async startHost(plan) {
				try {
					return await this.env.host.runHostHalf(plan.agentId, plan.pluginId, plan.packageId, plan.mode, plan.requestId ?? null, plan.approveFutureVersions ?? false);
				} catch (error) {
					return {
						ok: false,
						...errorDetails(error)
					};
				}
			}
			async finishClientFailure(plan, pluginRunId, startedHere, failure, originalError) {
				console.error(`[cordis-client-runner] Client activation ${plan.pluginId}/${plan.packageId} (${pluginRunId}) failed:`, originalError ?? failure);
				this.fail(plan, "client-half-failed", failure);
				const resolution = {
					ok: false,
					reason: "client-half-failed",
					pluginRunId,
					startedHere,
					...failure
				};
				if (plan.requestId !== void 0) await this.answer(plan.requestId, resolution);
				else await this.settleDirect(plan, resolution);
			}
			async settleDirect(plan, resolution) {
				try {
					const response = await this.env.host.settleUserRun(plan.agentId, plan.pluginId, resolution);
					if (!response.ok) this.fail(plan, "client-half-failed", response);
				} catch (error) {
					this.fail(plan, "client-half-failed", errorDetails(error));
				}
			}
			async answer(requestId, resolution) {
				try {
					await this.env.host.resolveRequestRun(requestId, resolution);
				} catch (error) {
					console.error(`[cordis-client-runner] answering run request ${requestId} failed:`, error);
				}
			}
			fail(plan, reason, failure) {
				this.failures.set(plan.pluginId, {
					packageId: plan.packageId,
					reason,
					...failure
				});
				this.commit();
			}
		};
		function sameRequest(left, right) {
			return left?.requestId === right.requestId && left.agentId === right.agentId && left.pluginId === right.pluginId && left.packageId === right.packageId && left.mode === right.mode && left.name === right.name && left.purpose === right.purpose && left.requiresApproval === right.requiresApproval;
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/inspect-registry.js
		/** Browser registry for read-only Cordis capability providers. */
		/** Client provider registry, manifest publisher, and live query dispatcher. */
		var ClientCordisInspectRegistry = class {
			host;
			providers = /* @__PURE__ */ new Map();
			active = /* @__PURE__ */ new Map();
			publishQueued = false;
			syncChain = Promise.resolve();
			/** @param host - folded manifest and query result transport. */
			constructor(host) {
				this.host = host;
			}
			/**
			* Register one Client provider and publish a new complete manifest.
			* @param registration - provider manifest and local handler.
			* @returns idempotent disposer.
			*/
			register(registration) {
				const { manifest } = registration;
				if (manifest.id.trim() === "") throw new Error("Client Cordis inspect provider id must not be empty");
				if (this.providers.has(manifest.id)) throw new Error(`Client Cordis inspect provider "${manifest.id}" is already registered`);
				const names = /* @__PURE__ */ new Set();
				for (const method of manifest.methods) {
					if (names.has(method.name)) throw new Error(`Client Cordis inspect provider "${manifest.id}" repeats method "${method.name}"`);
					names.add(method.name);
				}
				this.providers.set(manifest.id, registration);
				this.publish();
				let disposed = false;
				return () => {
					if (disposed) return;
					disposed = true;
					if (this.providers.get(manifest.id) === registration) {
						this.providers.delete(manifest.id);
						this.publish();
					}
				};
			}
			/** Publish the current complete manifest, including after reconnect. */
			publish() {
				if (this.publishQueued) return;
				this.publishQueued = true;
				queueMicrotask(() => {
					this.publishQueued = false;
					const manifests = [...this.providers.values()].map((provider) => provider.manifest);
					this.syncChain = this.syncChain.then(async () => {
						await this.host.sync(manifests);
					}).catch((error) => {
						console.error("[cordis-client-runner] syncing inspect providers failed:", error);
					});
				});
			}
			/**
			* Execute and answer one Host-broadcast query.
			* @param request - exact provider query and Session correlation received from Host.
			* @returns after the first local result has been sent back to Host.
			*/
			async query(request) {
				if (this.active.has(request.requestId)) return;
				const controller = new AbortController();
				this.active.set(request.requestId, controller);
				let resolution;
				try {
					const provider = this.providers.get(request.provider);
					if (provider === void 0) resolution = {
						ok: false,
						reason: "provider-missing",
						message: `Client inspect provider "${request.provider}" is unavailable`
					};
					else if (!provider.manifest.methods.some((method) => method.name === request.method)) resolution = {
						ok: false,
						reason: "method-missing",
						message: `Client inspect provider "${request.provider}" has no method "${request.method}"`
					};
					else {
						const data = await provider.query(request.method, request.input, {
							signal: controller.signal,
							sessionId: request.agentId
						});
						resolution = controller.signal.aborted ? {
							ok: false,
							reason: "cancelled",
							message: "Client inspect query was cancelled"
						} : {
							ok: true,
							data
						};
					}
				} catch (error) {
					resolution = controller.signal.aborted ? {
						ok: false,
						reason: "cancelled",
						message: "Client inspect query was cancelled"
					} : {
						ok: false,
						reason: "provider-error",
						message: error instanceof Error ? error.message : String(error)
					};
				} finally {
					this.active.delete(request.requestId);
				}
				if (controller.signal.aborted) return;
				await this.host.resolve(request.agentId, request.requestId, resolution);
			}
			/**
			* Cancel local work after another page answered or the Tool call ended.
			* @param requestId - query correlation that is no longer answerable.
			*/
			close(requestId) {
				this.active.get(requestId)?.abort();
				this.active.delete(requestId);
			}
		};
		/**
		* Provide the registry as a normal Client service.
		* @param ctx - Client Cordis context receiving the service.
		* @param registry - page-local inspect registry to publish.
		*/
		function provideClientCordisInspect(ctx, registry) {
			ctx.provide("cordisInspect", registry);
		}
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
