/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						confirming: option,
						acknowledged: false,
						error: null
					});
					return;
				}
				await this.settle(binding, option);
			}
			/**
			* Update the explicit checkbox for the currently pending risk gate.
			* @param acknowledged - whether the user has acknowledged the displayed risk.
			*/
			acknowledge(acknowledged) {
				const s = this.state.getSnapshot();
				if (!s.open || s.submitting || s.confirming === null || s.acknowledged === acknowledged) return;
				this.state.set({
					...s,
					acknowledged
				});
			}
			/** Cancel only the risk gate and return to the still-open option picker. */
			cancelConfirmation() {
				const s = this.state.getSnapshot();
				if (!s.open || s.submitting || s.confirming === null) return;
				this.state.set({
					...s,
					confirming: null,
					acknowledged: false
				});
			}
			/** Settle the gated option only after the checkbox is acknowledged. */
			async confirm() {
				const binding = this.binding;
				const s = this.state.getSnapshot();
				if (binding === null || !s.open || s.submitting || s.confirming === null || !s.acknowledged) return;
				await this.settle(binding, s.confirming);
			}
			/** Run the business settlement for an already admitted option. */
			async settle(binding, option) {
				const s = this.state.getSnapshot();
				if (this.binding !== binding || !s.open || s.submitting) return;
				this.state.set({
					...s,
					submitting: true,
					confirming: null,
					acknowledged: false,
					error: null
				});
				try {
					await binding.spec.onSelect(option, binding.context);
				} catch (error) {
					console.error(`[ui-commands] popupSelect onSelect failed for /${binding.command}:`, error);
					if (this.binding !== binding) return;
					this.state.set({
						...this.state.getSnapshot(),
						submitting: false,
						error: errorText(error)
					});
					return;
				}
				if (this.binding !== binding) return;
				this.deps.consume(binding.segment);
				this.binding = null;
				this.state.set(CLOSED);
				this.deps.focusComposer();
			}
			/**
			* Close the shell; aborts a flying options fetch and revokes settlement
			* rights. An outside pointer interaction dismisses plainly (the click's own
			* target takes focus); Escape passes focusComposer to return focus explicitly.
			* @param opts - focusComposer: also restore composer focus (Escape path).
			*/
			dismiss(opts) {
				if (this.binding === null) return;
				this.binding.abort.abort();
				this.binding = null;
				this.state.set(CLOSED);
				if (opts?.focusComposer === true) this.deps.focusComposer();
			}
			/** Scope-teardown disposer: abort in-flight work and clear state (no focus side effect). */
			dispose() {
				this.binding?.abort.abort();
				this.binding = null;
				this.state.set(CLOSED);
			}
		};
		//#endregion
		//#region lib/types/client/presentation.js
		/** Row names per section, highest usage first; rows outside both lists close the Commands section in catalog order. */
		const SECTION_ROWS = {
			add: [
				"file",
				"goal",
				"plan",
				"feedback"
			],
			commands: [
				"compact",
				"permission",
				"model",
				"export"
			]
		};
		/** One built-in Host command's face, keyed by its dictionary entries. */
		function hostFace(name, icon) {
			return [name, {
				label: `label.${name}`,
				description: `description.${name}`,
				icon
			}];
		}
		/** Built-in Host commands whose client face this package owns. */
		const HOST_FACES = new Map([
			hostFace("goal", _deepseek_ai_dsh_client_ui_primitives.IconGoalOutlineRegular),
			hostFace("plan", _deepseek_ai_dsh_client_ui_primitives.IconPlanOutlineRegular),
			hostFace("feedback", _deepseek_ai_dsh_client_ui_primitives.IconPaperPlaneOutlineRegular),
			hostFace("compact", _deepseek_ai_dsh_client_ui_primitives.IconCompactOutlineRegular),
			hostFace("permission", _deepseek_ai_dsh_client_ui_primitives.PermissionIconFullAccessRegular),
			hostFace("export", _deepseek_ai_dsh_client_ui_primitives.IconDownloadOutlineRegular)
		]);
		/**
		* The localized menu face of a catalog row.
		* @param descriptor - effective Host command descriptor.
		* @param t - the `command` namespace translator.
		* @returns title, description, and glyph for a built-in command; undefined
		* for any other row, which keeps its catalog description.
		*/
		function builtinRowFace(descriptor, t) {
			const name = builtinCommandName(descriptor);
			const face = name === void 0 ? void 0 : HOST_FACES.get(name);
			return face === void 0 ? void 0 : {
				label: t(face.label),
				description: t(face.description),
				icon: face.icon
			};
		}
		/**
		* Arrange the empty-query menu: the Add section, then the Commands section,
		* each in usage order, with unlisted rows closing Commands in their input
		* order; each row carries its section heading.
		* @param rows - the visible candidates in catalog-then-contribution order.
		* @param t - the `command` namespace translator.
		* @returns the sectioned rows.
		*/
		function sectionRows(rows, t) {
			const listed = new Set([...SECTION_ROWS.add, ...SECTION_ROWS.commands]);
			const byName = new Map(rows.map((row) => [row.name, row]));
			const pick = (names) => names.flatMap((name) => {
				const row = byName.get(name);
				return row === void 0 ? [] : [row];
			});
			const add = pick(SECTION_ROWS.add).map((row) => ({
				...row,
				section: t("section.add")
			}));
			const commands = [...pick(SECTION_ROWS.commands), ...rows.filter((row) => !listed.has(row.name))].map((row) => ({
				...row,
				section: t("section.commands")
			}));
			return [...add, ...commands];
		}
		//#endregion
		//#region lib/types/client/service.js
		/**
		* CommandUiRuntime (`ctx.commandUi`): the '/' command source over the
		* session-keyed directory, the client-contribution registry, and the
		* per-session popupSelect controllers. Candidate synthesis merges the host
		* catalog with contributions by availability, gives built-in Host rows their
		* localized face (presentation.ts), then position-filters; an empty query
		* lists the Add and Commands sections in usage order, a typed query ranks
		* every row by the `/` menu's shared name-and-label ranking (ui-primitives
		* `rankByName`). A host/contribution name collision fails loud. Every
		* execute addresses the session's agent by sessionId — sessions are always
		* agent-backed.
		* Catalog RPCs retain an existing Client Session through completion and
		* wait for its initial history open to succeed before contacting the Host.
		*/
		/** Recover the command name from a line the Host confirmed as executed. */
		function submittedCommandName(line) {
			const trimmed = line.trim();
			const separator = trimmed.search(/\s/u);
			return (separator === -1 ? trimmed : trimmed.slice(0, separator)).slice(1);
		}
		/** Command surface: session-keyed directory + '/' source + contribution registry + per-session popups. */
		var CommandUiRuntime = class extends _deepseek_ai_cordis.Service {
			static inject = [
				"inputTriggers",
				"sessions",
				"remote",
				"remote.commands"
			];
			directory;
			live = {
				contributions: /* @__PURE__ */ new Map(),
				decorations: /* @__PURE__ */ new Map(),
				popups: new WeakMapWithValues()
			};
			/** `command`-namespace translator (composer refusal notices). */
			t;
			/**
			* @param ctx - owning root context (plugin fiber; the service registers
			* itself as `command` and follows that fiber's lifetime).
			*/
			constructor(ctx) {
				super(ctx, "commandUi");
				const locale = ctx.get("locale");
				if (locale === void 0) throw new Error("ui-commands: locale service unavailable");
				this.t = locale.bind("command");
				this.directory = new CommandDirectory(async (sessionId) => {
					const sessions = this.sessions();
					if (sessions.subagentAddress(sessionId) !== void 0) return [];
					if (sessions.binding(sessionId) === void 0) throw new Error(`command catalog requires a retained session "${sessionId}"`);
					return sessions.using(sessionId, { source: "commandCatalog" }, async (reference) => {
						const state = reference.binding.session.getSnapshot();
						if (state.openState !== "open") throw state.openError ?? /* @__PURE__ */ new Error(`session "${sessionId}" is not open`);
						const result = await ctx.remote.commands.list(sessionId);
						if (!result.ok) throw new Error(`command.list failed: ${result.error.code}: ${result.error.message}`);
						return result.value;
					});
				});
				const inputTriggers = ctx.get("inputTriggers");
				if (inputTriggers === void 0) throw new Error("ui-commands: slash service unavailable");
				ctx.effect(() => inputTriggers.registerSource({
					trigger: "/",
					name: "command",
					candidates: (session, req) => this.candidates(session, req),
					onPick: (pick) => this.dispatch(pick),
					matchSpace: (session, token) => this.matchSpace(session, token),
					matchClaim: (session, token, signal) => this.matchClaim(session, token, signal),
					matchEnter: (session, line, signal, envelope) => this.matchEnter(session, line, signal, envelope),
					warm: (session) => {
						this.directory.warm(session.sessionId);
					}
				}), "command: slash source");
				ctx.remote.$on("commands/change", () => {
					this.directory.invalidateAll();
				});
				ctx.remote.$on("agent-preset/selected", (sessionId) => {
					this.directory.resetSession(sessionId);
				});
				ctx.on("connection/reset", () => {
					this.directory.resetConnected();
				});
			}
			/**
			* Register one client command contribution; effect disposer (rides the
			* caller's fiber). Duplicate names throw.
			* @param contribution - the contribution (descriptor + availability + popup spec).
			* @returns the disposer removing the registration.
			*/
			register(contribution) {
				const dispose = this.ctx.effect(() => {
					const { contributions } = this.live;
					if (contributions.has(contribution.name)) throw new Error(`ui-commands: duplicate contribution for /${contribution.name}`);
					contributions.set(contribution.name, contribution);
					return () => {
						contributions.delete(contribution.name);
					};
				}, "command.register()");
				return () => {
					dispose();
				};
			}
			/**
			* Hang a bare-invocation decoration on one host command; effect disposer
			* (rides the caller's fiber). Duplicate names throw.
			* @param decoration - host command name + availability + popup spec.
			* @returns the disposer removing the registration.
			*/
			decorate(decoration) {
				const dispose = this.ctx.effect(() => {
					const { decorations } = this.live;
					if (decorations.has(decoration.name)) throw new Error(`ui-commands: duplicate decoration for /${decoration.name}`);
					decorations.set(decoration.name, decoration);
					return () => {
						decorations.delete(decoration.name);
					};
				}, "command.decorate()");
				return () => {
					dispose();
				};
			}
			/**
			* Close every open popup for a command whose options have become stale.
			* Pending loads and confirmations lose their binding; drafts stay intact.
			* @param name - command name without the leading slash.
			*/
			dismiss(name) {
				for (const popup of this.live.popups.values) if (popup.state.getSnapshot().command === name) popup.dismiss({ focusComposer: true });
			}
			/**
			* Resolve the per-session popup controller (lazy; dies with the session
			* scope). The controller's consume callback dispatches the scoped
			* consume-token event back to this session; focusComposer reaches the
			* session's composer through the conversation input face.
			* @param actx - session-scope ctx.
			* @returns the resident controller.
			* @throws when the Context no longer belongs to a retained Session generation.
			*/
			popupFor(actx) {
				const sessions = this.sessions();
				const session = sessions.sessionOf(actx);
				const binding = session === void 0 ? void 0 : sessions.binding(session.sessionId);
				if (binding === void 0 || binding.session !== session) throw new Error("command.popupFor requires a retained Session scope");
				const { popups } = this.live;
				const existing = popups.get(binding);
				if (existing !== void 0) return existing;
				const controller = new PopupSelectController({
					consume: (segment) => binding.ctx.bail(binding.ctx, "slash/input-consume-token", { guard: segment.via === "menu" ? {
						kind: "span",
						span: segment.span
					} : {
						kind: "bare-token",
						token: segment.token
					} }) === true,
					focusComposer: () => {
						binding.ctx.get("conversation")?.input.for(binding.ctx).focus();
					}
				});
				popups.set(binding, controller);
				binding.ctx.effect(() => () => {
					controller.dispose();
					popups.delete(binding);
				}, "command: session popup");
				return controller;
			}
			/**
			* Menu candidates: host catalog + contribution availability, built-in rows
			* localized, then position filtering; sections for an empty query, the
			* shared name-and-label ranking for a typed one.
			*/
			async candidates(session, req) {
				const list = await this.directory.ensureReady(session.sessionId, req.signal);
				const rows = [];
				const seen = /* @__PURE__ */ new Set();
				for (const c of list) {
					seen.add(c.name);
					rows.push({
						name: c.name,
						...builtinRowFace(c, this.t) ?? { description: c.description },
						...c.input !== void 0 ? { hint: c.input.hint } : {}
					});
				}
				for (const contribution of this.live.contributions.values()) {
					if (!contribution.available(session)) continue;
					if (seen.has(contribution.name)) throw new Error(`ui-commands: contribution /${contribution.name} collides with a host command`);
					rows.push({
						name: contribution.name,
						...contribution.label === void 0 ? {} : { label: contribution.label() },
						...contribution.description === void 0 ? {} : { description: contribution.description() },
						...contribution.icon === void 0 ? {} : { icon: contribution.icon }
					});
				}
				const visible = rows.filter((c) => req.position === "leading" || c.hint === void 0);
				return req.query === "" ? sectionRows(visible, this.t) : (0, _deepseek_ai_dsh_client_ui_primitives.rankByName)(visible, req.query);
			}
			/** Decision table, menu column: contribution/decorated-host → popup or action; host input → claim; host bare → detached execute. */
			dispatch(pick) {
				const name = pick.candidate.name;
				const contribution = this.live.contributions.get(name);
				if (contribution !== void 0 && contribution.available(pick.session)) {
					this.invoke(name, contribution.ui, pick.session, {
						via: "menu",
						span: pick.span
					});
					return "handled";
				}
				const desc = this.directory.resolve(pick.session.sessionId, name);
				if (desc === void 0) return void 0;
				const decoration = this.live.decorations.get(name);
				if (decoration !== void 0 && decoration.available(pick.session)) {
					this.invoke(name, decoration.ui, pick.session, {
						via: "menu",
						span: pick.span
					});
					return "handled";
				}
				if (desc.input !== void 0) return { claim: this.leadingClaim(desc, pick.session, claimToken(desc, this.t)) };
				this.consumeVia(pick.session.sessionId, {
					via: "menu",
					span: pick.span
				});
				this.runDetached(desc, pick.session, `/${name}`);
				return "handled";
			}
			/** Decision table, space column: hot-key sync check; only host leadingInput claims. */
			matchSpace(session, token) {
				const claim = this.claimOf(session, token);
				return claim === void 0 ? void 0 : { claim };
			}
			/**
			* Restore column: the space column's answer once the session's catalog is
			* ready (a warmup failure rejects). It only resolves; nothing is invoked or
			* executed.
			*/
			async matchClaim(session, token, signal) {
				await this.directory.ensureReady(session.sessionId, signal);
				return this.claimOf(session, token);
			}
			/** The host leadingInput claim a token names in the hot catalog; popup and action kinds never claim. */
export {};
