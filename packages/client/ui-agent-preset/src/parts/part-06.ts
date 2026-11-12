/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					error: null,
					introduce
				});
			}
			/** Acknowledge a displayed refusal without dismissing a newer attempt.
			* @param refusal - the selection error whose Toast finished.
			*/
			dismissRefusal(refusal) {
				if (refusal !== null && typeof refusal === "object" && this.store.getSnapshot().error === refusal) this.set({ error: refusal.reason });
			}
			/**
			* Capture the exact blank Session a Settings action may bring along.
			* @returns its id, or undefined outside a blank Session.
			*/
			blankSessionId() {
				const session = this.currentSession();
				return session?.blank === true ? session.id : void 0;
			}
			/**
			* Apply a Settings choice only if its captured Session is still current and
			* blank after any pending selection settles. The selection uses the existing stage/apply path.
			* @param expectedSessionId - blank Session captured before the Settings write.
			* @param id - the effective default that the write persisted.
			* @returns the Host refusal text, or undefined when applied or no longer relevant.
			*/
			async syncBlankSession(expectedSessionId, id) {
				while (this.pendingSelection !== void 0) await this.pendingSelection;
				const session = this.currentSession();
				if (session === void 0 || !session.blank || session.id !== expectedSessionId) return void 0;
				this.stage(id);
				return await this.apply();
			}
			/** Acknowledge the introduction cue once the chip has played it. */
			introduced() {
				if (!this.store.getSnapshot().introduce) return;
				this.staged.introduce = false;
				this.set({ introduce: false });
			}
			/**
			* Hand the staged choice to the current session, if there is one to take it.
			*
			* Called both by `select()` and by whoever observes the current session
			* changing, because the session may appear either before or after the pick.
			* List updates do not repeat a selection while its response is pending.
			* @returns this attempt's Host refusal, or undefined when successful or no switch starts.
			*/
			async apply() {
				if (this.store.getSnapshot().busy) return;
				const staged = this.staged.id;
				const session = this.currentSession();
				if (staged === void 0) {
					const current = session === void 0 ? this.fallback : presetOf(session) ?? "";
					if (current !== this.store.getSnapshot().current) this.set({ current });
					return;
				}
				if (session === void 0) return;
				if (!session.blank || presetOf(session) === staged) {
					this.clearStage();
					return;
				}
				const completion = Promise.withResolvers();
				this.pendingSelection = completion.promise;
				this.clearStage();
				const refuse = (reason) => {
					this.set({
						error: {
							reason,
							preset: this.store.getSnapshot().options.find((option) => option.id === staged) ?? { id: staged }
						},
						current: this.staged.id ?? presetOf(session) ?? ""
					});
					return reason;
				};
				try {
					this.set({
						busy: true,
						error: null
					});
					const result = await this.ctx.remote.agentPresets.select(session.id, staged);
					if (!result.ok) {
						const { error } = result;
						return refuse("reason" in error.details && typeof error.details.reason === "string" ? error.details.reason : error.message);
					}
					this.set({ current: this.staged.id ?? result.value });
				} catch (error) {
					return refuse(error instanceof Error ? error.message : String(error));
				} finally {
					this.pendingSelection = void 0;
					this.set({ busy: false });
					completion.resolve(void 0);
				}
			}
		};
		function presetOf(session) {
			const value = session?.projectionValues?.agentPreset;
			return typeof value === "string" ? value : void 0;
		}
		//#endregion
		//#region lib/types/client/section-store.js
		const INITIAL = {
			status: "idle",
			error: null,
			saving: false,
			rows: [],
			view: null
		};
		const message = (error) => error instanceof Error ? error.message : String(error);
		/** Loads the roster, writes the default, and reads one composition at a time. */
		var AgentPresetSectionController = class {
			ctx;
			/** Observable roster, selection and viewer state. */
			store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)(INITIAL);
			loading;
			pendingSave;
			viewRequest = 0;
			constructor(ctx) {
				this.ctx = ctx;
			}
			set(patch) {
				this.store.set({
					...this.store.getSnapshot(),
					...patch
				});
			}
			/** Refresh the roster; concurrent calls share one read.
			* @returns Once the roster read settles.
			*/
			load() {
				return this.loading ??= this.readRoster().finally(() => {
					this.loading = void 0;
				});
			}
			async readRoster() {
				try {
					const result = await this.ctx.remote.agentPresets.list();
					if (!result.ok) throw new Error(result.error.message);
					this.set({
						status: "ready",
						error: null,
						rows: result.value.presets
					});
				} catch (error) {
					this.set({
						status: "error",
						error: message(error)
					});
				}
			}
			/** Open one preset's declared composition in the viewer.
			* @param id Preset to read.
			* @returns Once the read settles; a current failure lands in `error`, while a read superseded by close or another read is ignored.
			*/
			async view(id) {
				const request = ++this.viewRequest;
				this.set({
					error: null,
					view: null
				});
				try {
					const result = await this.ctx.remote.agentPresets.read(id);
					if (request !== this.viewRequest) return;
					if (!result.ok) throw new Error(result.error.message);
					const { name, content } = result.value;
					this.set({ view: {
						id,
						title: name ?? id,
						content
					} });
				} catch (error) {
					if (request === this.viewRequest) this.set({ error: message(error) });
				}
			}
			/** Close the viewer. */
			closeView() {
				this.viewRequest++;
				this.set({ view: null });
			}
			/** Set the default and synchronize the current blank task when supplied.
			* @param id Selected default.
			* @param sync Blank-session synchronization callback.
			* @returns Once saved and refreshed.
			*/
			async makeDefault(id, sync) {
				await this.save(() => writeDefaultPreset(this.ctx, id), sync);
			}
			/** Replace a hidden built-in default after accepted Coding Tools changes.
			* @param shouldReset Rechecked after waiting; false when tools are enabled or this owner is disposed.
			* @returns Once the conditional save settles; errors remain visible in the section.
			*/
			async reconcileCodingTools(shouldReset) {
				while (this.pendingSave !== void 0) await this.pendingSave;
				if (!shouldReset()) return;
				const settings = this.ctx.configForms.get(AGENT_PRESET_SETTINGS_NS).getSnapshot();
				if (settings.status !== "ready" || !settings.writable || settings.revision === void 0) return;
				await this.load();
				if (!shouldReset() || this.store.getSnapshot().status !== "ready") return;
				const rows = this.store.getSnapshot().rows;
				if (!requiresCodingTools(rows.find((row) => row.isDefault))) return;
				if (!rows.some((row) => row.id === "standard" && row.broken === void 0)) {
					this.set({ error: this.ctx.locale.bind("settings.agentPreset")("standardUnavailable") });
					return;
				}
				await this.save(() => writeDefaultPreset(this.ctx, "standard", settings.revision));
			}
			async save(write, sync) {
				if (this.store.getSnapshot().saving) return;
				const completion = Promise.withResolvers();
				this.pendingSave = completion.promise;
				this.set({
					saving: true,
					error: null
				});
				try {
					const error = await write();
					await this.load();
					if (error !== void 0) throw new Error(error);
					const selected = this.store.getSnapshot().rows.find((row) => row.isDefault);
					if (selected !== void 0) {
						const error = await sync?.(selected.id);
						if (error !== void 0) throw new Error(error);
					}
				} catch (error) {
					this.set({ error: message(error) });
				} finally {
					this.pendingSave = void 0;
					this.set({ saving: false });
					completion.resolve();
				}
			}
		};
		//#endregion
		//#region lib/types/client/index.js
		/**
		* Agent-preset surface plugin, browser half — three surfaces over one roster:
		* a chip on the new-session screen for the session about to start, a
		* read-only label in the session header, and a settings section that lists
		* the roster (selection, the new-task default, a read-only view of each
		* declared composition, and the way into Creator mode).
		*
		* A running session keeps the composition it began with (the host switches a
		* session's preset only before its first turn). That is what splits
		* the choice from the display: the hero chip is before-the-fact, while the
		* header only reports what a session already runs. The default preset is
		* edited where the roster is visible — the settings section's "make default"
		* — so General settings carries no duplicate control for the same field.
		*
		* Coding Tools (General settings) hide PTC and Minimal from the hero menu
		* and Settings roster when off. Hidden saved defaults fall back to Standard;
		* the existing gate clears staged choices while existing sessions keep their composition.
		*/
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"sessions",
			"locale",
			"remote",
			"remote.agentPresets",
			"remote.settings",
			"configForms"
		];
		/**
		* Mount the roster surfaces: hero chip, session-header label, settings section.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const toolsSettings = ctx.configForms.get("ui-settings");
			const presetSettings = ctx.configForms.get(AGENT_PRESET_SETTINGS_NS);
			let active = true;
			const codingToolsDisabled = () => active && toolsSettings.getSnapshot().value?.enabled === false;
			const controller = new AgentPresetSettingsController(ctx);
			const staged = {
				id: void 0,
				introduce: false
			};
			const seats = new WeakMapWithValues();
			const boundSeatDisposers = /* @__PURE__ */ new Set();
			ctx.effect(() => async () => {
				await Promise.all([...boundSeatDisposers].map((dispose) => dispose()));
			}, "ui-agent-preset: bound selections");
			const unboundSeat = new AgentPresetSeatController(ctx, () => void 0, staged);
			const seatFor = (binding) => {
				const existing = seats.get(binding);
				if (existing !== void 0) return existing;
				const seat = new AgentPresetSeatController(ctx, () => {
					if (ctx.sessions.binding(binding.sessionId) !== binding) return void 0;
					const summary = ctx.sessions.list.getSnapshot().byId[binding.sessionId];
					return summary !== void 0 && (ctx.sessions.retainInfo(binding.sessionId).getSnapshot().retainedBy.mainView ?? 0) > 0 ? summary : void 0;
				}, staged);
				seats.set(binding, seat);
				const dispose = binding.ctx.effect(() => {
					const stop = ctx.sessions.list.subscribe(() => {
						seat.apply();
					});
					return () => {
						stop();
						seats.delete(binding);
						boundSeatDisposers.delete(dispose);
					};
				}, "ui-agent-preset: Provider binding");
				boundSeatDisposers.add(dispose);
				return seat;
			};
			const section = new AgentPresetSectionController(ctx);
			const developerTools = ctx.configForms.developerTools.enabled;
			ctx.effect(() => developerTools.subscribe(() => {
				if (developerTools.getSnapshot()) return;
				staged.id = void 0;
				staged.introduce = false;
				unboundSeat.apply();
				for (const seat of seats.values) seat.apply();
			}), "ui-agent-preset: Developer tools gate");
			const mainBlankSeat = () => {
				const summary = Object.values(ctx.sessions.list.getSnapshot().byId).find((session) => {
					/* v8 ignore next -- retained source counts omit zero-valued entries. */
					return session.blank && (session.retainedBy.mainView ?? 0) > 0;
				});
				const binding = summary === void 0 ? void 0 : ctx.sessions.binding(summary.id);
				return binding === void 0 ? void 0 : seatFor(binding);
			};
			ctx.effect(() => ctx.locale.register("settings.agentPreset", {
				zh,
				en
			}), "ui-agent-preset: settings row dictionaries");
			ctx.effect(() => {
				let requested = 0;
				let pending;
				const reconcile = () => {
					requested++;
					pending ??= Promise.resolve().then(async () => {
						try {
							for (;;) {
								const revision = requested;
								await section.reconcileCodingTools(codingToolsDisabled);
								if (!active || requested === revision) return;
							}
						} finally {
							pending = void 0;
						}
					});
				};
				const refresh = () => {
					controller.load();
					if (section.store.getSnapshot().status !== "idle") section.load();
					unboundSeat.load();
					for (const seat of seats.values) seat.load();
					reconcile();
				};
				const disposers = [
					toolsSettings.subscribe(reconcile),
					presetSettings.subscribe(reconcile),
					ctx.remote.$on("settings/document-updated", (ns) => {
						if (ns !== "agent-preset-registry") return;
						refresh();
					}),
					ctx.on("connection/reset", refresh)
				];
				reconcile();
				return async () => {
					active = false;
					for (const dispose of disposers) dispose();
					await pending;
				};
			}, "ui-agent-preset: settings refresh");
			let creatorDraft;
			ctx.inject([
				"slots",
				"conversation",
				"sessions",
				"uiWorkspace"
			], (scope) => {
				const seatInjected = (sessionId) => {
					const binding = sessionId === void 0 ? void 0 : ctx.sessions.binding(sessionId);
					const seat = binding === void 0 ? unboundSeat : seatFor(binding);
					return {
						hooks: {
							agentPresetSeat: seat.store,
							developerTools: ctx.configForms.developerTools.enabled
						},
						load: () => seat.load(),
						select: (id) => seat.select(id),
						dismissRefusal: (error) => {
							seat.dismissRefusal(error);
						},
						introduced: () => {
							seat.introduced();
						}
					};
				};
				const labelInjected = () => ({
					hooks: { agentPresets: controller.store },
					load: () => controller.load()
				});
				const startCreatorDraft = () => {
					(mainBlankSeat() ?? unboundSeat).stage("cordis", true);
					scope.uiWorkspace.startSession(void 0, {
						clearPreviousDraft: false,
						agentPreset: "cordis"
					});
				};
				scope.effect(() => {
export {};
