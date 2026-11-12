/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			claimOf(session, token) {
				if (!token.startsWith("/")) return void 0;
				if (this.live.contributions.has(token.slice(1))) return void 0;
				const desc = this.directory.resolve(session.sessionId, token.slice(1));
				if (desc === void 0 || desc.input === void 0) return void 0;
				return this.leadingClaim(desc, session, token.slice(1));
			}
			/**
			* Decision table, enter column. Strong-waits the session's catalog (a
			* warmup failure rejects — never a silent downgrade). Contributions and
			* bare host commands act on the bare token only; leadingInput claims
			* args-tolerant.
			*
			* Envelope policy: an enter submission carrying attachments resolves only
			* through a command declaring attachment acceptance. Every other submitting
			* route — popup, non-accepting claim, bare detached execute — throws the
			* refusal so the machine surfaces one composer notice and the draft and
			* attachments stay in place; nothing executes and nothing is dropped. An
			* action submits nothing and runs regardless.
			*
			* A typed token is resolved through the localized claim tokens, so a line
			* written as `/计划` reaches the `plan` descriptor and executes as `/plan`.
			*/
			async matchEnter(session, line, signal, envelope) {
				const trimmed = line.trim();
				if (!trimmed.startsWith("/")) return void 0;
				const ws = trimmed.search(/\s/);
				const token = ws === -1 ? trimmed : trimmed.slice(0, ws);
				const bare = ws === -1;
				const typedName = token.slice(1);
				if (typedName === "") return void 0;
				const refuseAttachments = () => {
					throw new Error(this.t("notice.attachmentsUnsupported", { command: typedName }));
				};
				const contribution = this.live.contributions.get(typedName);
				if (contribution !== void 0 && contribution.available(session)) {
					if (!bare) return void 0;
					if (envelope.attachments > 0 && contribution.ui.kind !== "action") refuseAttachments();
					this.invoke(typedName, contribution.ui, session, {
						via: "enter",
						token
					});
					return "handled";
				}
				await this.directory.ensureReady(session.sessionId, signal);
				const desc = this.directory.resolve(session.sessionId, typedName);
				if (desc === void 0) return void 0;
				const name = desc.name;
				const canonical = `/${name}${trimmed.slice(token.length)}`;
				if (bare) {
					const decoration = this.live.decorations.get(name);
					if (decoration !== void 0 && decoration.available(session)) {
						if (envelope.attachments > 0 && decoration.ui.kind !== "action") refuseAttachments();
						this.invoke(name, decoration.ui, session, {
							via: "enter",
							token
						});
						return "handled";
					}
				}
				if (desc.input !== void 0) {
					if (envelope.attachments > 0 && desc.input.attachments !== true) refuseAttachments();
					return { claim: this.leadingClaim(desc, session, token.slice(1)) };
				}
				if (!bare) return void 0;
				if (envelope.attachments > 0) refuseAttachments();
				this.consumeVia(session.sessionId, {
					via: "enter",
					token
				});
				this.runDetached(desc, session, canonical);
				return "handled";
			}
			/**
			* Invoke one contribution or decoration (menu pick / bare enter): open the
			* session's popup, or consume the token and run the action.
			*/
			invoke(name, ui, session, segment) {
				if (ui.kind === "action") {
					this.consumeVia(session.sessionId, segment);
					ui.run(session);
					return;
				}
				const actx = this.scopeFor(session.sessionId);
				if (actx === void 0) return;
				this.popupFor(actx).open(name, ui, session, segment);
			}
			/**
			* Build the leadingInput claim. The composer keeps the claimed token in
			* the draft and reads the arguments after it, so the token is the spelling
			* the draft will carry: the locale's token for a menu pick, the typed
			* spelling for Space and Enter. The command.execute submit transaction
			* always sends the catalog name.
			*/
			leadingClaim(desc, session, shown) {
				const token = `/${shown} `;
				const line = `/${desc.name} `;
				return {
					name: desc.name,
					token,
					...desc.input !== void 0 ? { hint: desc.input.hint } : {},
					...desc.input?.attachments === true ? { attachments: true } : {},
					submit: (args, _actx, attachments) => this.execute(session, line + args, attachments)
				};
			}
			/**
			* The command.execute transaction, addressed to the session's agent — pure
			* admission semantics. An unmatched line reports an error outcome (the
			* composer's immediate admission feedback); an admitted command reports
			* plain success regardless of its handler outcome, because the host
			* executor durably logged the lifecycle (`command/run`/`command/done`) and
			* the outcome renders as a persistent flow node — the composer never
			* echoes it. A handler error result reports an error outcome so the
			* composer keeps the draft and attachments for correction.
			* A refused call throws.
			*/
			async execute(session, line, attachments = []) {
				const result = await this.ctx.remote.commands.execute(session.sessionId, line, attachments);
				if (!result.ok) throw new Error(`command.execute failed: ${result.error.code}: ${result.error.message}`);
				if (result.value === void 0) return {
					kind: "error",
					text: `unknown or malformed command: ${line}`
				};
				this.notifyExecuted(session.sessionId, submittedCommandName(line), result.value.result);
				if (attachments.length > 0 && result.value.result.kind === "error") return {
					kind: "error",
					text: result.value.result.text
				};
				return { kind: "success" };
			}
			/** Publish the local acknowledgment without letting an observer change command admission. */
			notifyExecuted(sessionId, name, result) {
				const args = [
					"command/executed",
					sessionId,
					name,
					result
				];
				for (const listener of this.ctx.events.dispatch("emit", args)) try {
					const returned = listener(sessionId, name, result);
					if (returned != null && typeof returned.then === "function") Promise.resolve(returned).then(void 0, (error) => {
						this.warnExecutedListenerFailure(name, error);
					});
				} catch (error) {
					this.warnExecutedListenerFailure(name, error);
				}
			}
			/** Log one contained `command/executed` observer failure. */
			warnExecutedListenerFailure(name, error) {
				this.ctx.logger.warn("client command: a command/executed listener for \"%s\" failed", name);
				this.ctx.logger.warn(error);
			}
			/**
			* Fire-and-forget execute for the internal ('handled') paths. Outcomes are
			* NOT surfaced here: the host executor durably logs the command lifecycle
			* (`command/run`/`command/done`), and the mux-broadcast events render as a
			* persistent flow node on every tab. Only an admission failure — which never
			* entered a handler and therefore never logged — falls back to the composer
			* notice as immediate feedback.
			*/
			runDetached(desc, session, line) {
				this.execute(session, line).then((outcome) => {
					if (outcome.kind === "error") this.noticeFor(session.sessionId, "error", outcome.text ?? `/${desc.name} failed`);
				}, (error) => {
					this.noticeFor(session.sessionId, "error", error instanceof Error ? error.message : String(error));
				});
			}
			/** Dispatch a consume-token event to one session (menu-pick / bare-enter execute paths). */
			consumeVia(id, segment) {
				const actx = this.scopeFor(id);
				if (actx === void 0) return;
				actx.bail(actx, "slash/input-consume-token", { guard: segment.via === "menu" ? {
					kind: "span",
					span: segment.span
				} : {
					kind: "bare-token",
					token: segment.token
				} });
			}
			/** Route an admission failure to the session's composer notice channel (scope gone = attempt died with it). */
			noticeFor(id, level, text) {
				const actx = this.scopeFor(id);
				if (actx === void 0) return;
				const conversation = actx.get("conversation");
				if (conversation === void 0) return;
				conversation.input.for(actx).notify(level, text);
			}
			/** id → actx interchange (registered exchange point: this service coordinates for projection-only sources). */
			scopeFor(id) {
				return this.sessions().scope(id);
			}
			sessions() {
				const sessions = this.ctx.get("sessions");
				if (sessions === void 0) throw new Error("ui-commands: sessions service unavailable");
				return sessions;
			}
		};
		//#endregion
		//#region ../../../node_modules/.pnpm/clsx@2.1.1/node_modules/clsx/dist/clsx.mjs
		function r(e) {
			var t, f, n = "";
			if ("string" == typeof e || "number" == typeof e) n += e;
			else if ("object" == typeof e) if (Array.isArray(e)) {
				var o = e.length;
				for (t = 0; t < o; t++) e[t] && (f = r(e[t])) && (n && (n += " "), n += f);
			} else for (f in e) e[f] && (n && (n += " "), n += f);
			return n;
		}
		function clsx() {
			for (var e, t, f = 0, n = "", o = arguments.length; f < o; f++) (e = arguments[f]) && (t = r(e)) && (n && (n += " "), n += t);
			return n;
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-commands/src/client/PopupSelectView.module.css.mjs
		const css = ".mufS8W_card{box-sizing:border-box;z-index:100;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);min-width:min(220px,100%);max-width:100%;max-height:320px;box-shadow:var(--dsw-elevation-prominent);border:0;outline:none;flex-direction:column;padding:4px;display:flex;position:absolute;bottom:calc(100% + 4px);left:0;right:0;overflow:hidden}.mufS8W_viewport{flex-direction:column;min-height:0;display:flex;overflow-y:auto}.mufS8W_row{border-radius:var(--dsw-radius-md);cursor:pointer;color:var(--dsw-alias-label-primary);align-items:center;gap:6px;padding:5px 7px;font-size:12px;display:flex}.mufS8W_rowActive{background:var(--dsw-alias-interactive-bg-hover)}.mufS8W_label{flex:0 auto;align-items:baseline;gap:4px;min-width:0;display:flex}.mufS8W_labelText{white-space:nowrap;text-overflow:ellipsis;min-width:0;overflow:hidden}.mufS8W_badge{color:var(--dsw-alias-label-tertiary);letter-spacing:.2px;flex:none;align-self:flex-start;margin-top:-1px;font-size:8px;font-weight:600;line-height:10px}.mufS8W_detail{min-width:0;color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;flex:1;font-size:11px;overflow:hidden}.mufS8W_check{color:var(--dsw-alias-label-primary);flex:none;margin-left:auto;display:inline-flex}.mufS8W_check svg{width:14px;height:14px}.mufS8W_status{color:var(--dsw-alias-label-tertiary);padding:7px 8px;font-size:12px}.mufS8W_search{border-radius:var(--dsw-radius-md);color:var(--dsw-alias-label-primary);background:0 0;border:.5px solid #0000;outline:none;margin:2px 2px 3px;padding:5px 7px;font-size:12px}.mufS8W_error{color:var(--dsw-alias-state-error-primary);align-items:center;gap:6px;padding:5px 7px;font-size:11px;display:flex}.mufS8W_errorText{text-overflow:ellipsis;flex:1;overflow:hidden}.mufS8W_retry{border:.5px solid var(--dsw-alias-border-inverted);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;padding:2px 7px;font-size:11px}";
		const tagId = "@deepseek-ai/dsh-client-ui-commands/PopupSelectView.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-commands";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PopupSelectView_module_css_default = {
			"badge": "mufS8W_badge",
			"card": "mufS8W_card",
			"check": "mufS8W_check",
			"detail": "mufS8W_detail",
			"error": "mufS8W_error",
			"errorText": "mufS8W_errorText",
			"label": "mufS8W_label",
			"labelText": "mufS8W_labelText",
			"retry": "mufS8W_retry",
			"row": "mufS8W_row",
			"rowActive": "mufS8W_rowActive",
			"search": "mufS8W_search",
			"status": "mufS8W_status",
			"viewport": "mufS8W_viewport"
		};
		//#endregion
		//#region lib/types/client/PopupSelectView.js
		/**
		* Official popupSelect shell: renders one session's PopupSelectController
		* store into the conversation.input.overlay anchor. Unlike the slash menu
		* (combobox — textarea keeps focus), this shell HOLDS focus while open: the
		* inner search input takes focus, plain typing filters the loaded options
		* locally, Enter and Tab accept the filtered highlight, ↑↓ walk it (wrapping,
		* scrolled into view), and Escape and Shift+Tab dismiss back to the composer.
		* ←→ keep the search input's native caret. Any pointer interaction outside the
		* box dismisses (the click's own target takes focus). Closed state renders
		* null; the overlay slot stays mounted. The card height clamps to the space
		* above the composer.
		*/
		/** Design cap on the card height (same MenuDropdown family as the slash menu). */
		const MAX_HEIGHT = 320;
		/**
		* Render the popupSelect shell overlay entry.
		* @param props - injected face: the session's shell controller; `t` rides the standard locale seat.
		* @returns the select card while open; null while closed.
		*/
		function PopupSelectView({ popup, t }) {
			const state = (0, react.useSyncExternalStore)((fn) => popup.state.subscribe(fn), () => popup.state.getSnapshot());
			const cardRef = (0, react.useRef)(null);
			const searchRef = (0, react.useRef)(null);
			const viewportRef = (0, react.useRef)(null);
			const rows = (0, react.useMemo)(() => filterOptions(state.options, state.search, state.searchMode), [
				state.options,
				state.search,
				state.searchMode
			]);
			const groups = (0, react.useMemo)(() => groupOptions(rows), [rows]);
			(0, react.useEffect)(() => {
				const viewport = viewportRef.current;
				if (viewport === null) return;
				return (0, _deepseek_ai_dsh_client_ui_primitives.observeStickyMenuGroups)(viewport);
			}, [
				state.open,
				state.status,
				state.confirming,
				groups
			]);
			const maxHeight = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredMaxHeight)(cardRef, MAX_HEIGHT, state);
			const active = state.open ? state.active : null;
			(0, react.useEffect)(() => {
				if (active === null) return;
				cardRef.current?.querySelector("[aria-selected=\"true\"]")?.scrollIntoView({ block: "nearest" });
			}, [
				active,
				rows,
				state.confirming
			]);
			(0, react.useEffect)(() => {
				if (!state.open || state.confirming !== null) return;
				const onPointerDown = (ev) => {
					if (cardRef.current !== null && ev.target instanceof Node && cardRef.current.contains(ev.target)) return;
					popup.dismiss();
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				return () => {
					document.removeEventListener("pointerdown", onPointerDown, true);
				};
			}, [
				state.open,
				state.confirming,
				popup
			]);
			(0, react.useEffect)(() => {
				if (state.open && state.confirming === null) searchRef.current?.focus();
			}, [state.open, state.confirming]);
			if (!state.open) return null;
			const confirmation = state.confirming?.confirmation;
			const emptyLabel = state.searchLabels === null ? t("status.empty") : state.options.length === 0 ? state.searchLabels.empty : state.searchLabels.noResults;
			const onKeyDown = (ev) => {
				switch (ev.key) {
					case "ArrowDown":
						ev.preventDefault();
						popup.move(1);
						return;
					case "ArrowUp":
						ev.preventDefault();
						popup.move(-1);
						return;
					case "Enter":
						ev.preventDefault();
						popup.select(state.active);
						return;
					case "Tab":
						if (!ev.shiftKey && (state.status !== "ready" || rows.length === 0)) return;
						ev.preventDefault();
						if (ev.shiftKey) popup.dismiss({ focusComposer: true });
						else popup.select(state.active);
						return;
					case "Escape":
						ev.preventDefault();
						popup.dismiss({ focusComposer: true });
						return;
					default:
				}
			};
			const renderOption = (option, index) => (0, react_jsx_runtime.jsxs)("div", {
				role: "option",
				"aria-selected": index === state.active,
				"aria-label": option.badge === void 0 ? void 0 : `${option.label} ${option.badge}`,
				className: clsx(PopupSelectView_module_css_default.row, index === state.active && PopupSelectView_module_css_default.rowActive),
				onClick: () => {
					popup.select(index);
				},
				onMouseEnter: () => {
					popup.highlight(index);
				},
				children: [
					(0, react_jsx_runtime.jsxs)("span", {
						className: PopupSelectView_module_css_default.label,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: PopupSelectView_module_css_default.labelText,
							children: option.label
						}), option.badge !== void 0 && (0, react_jsx_runtime.jsx)("sup", {
							className: PopupSelectView_module_css_default.badge,
							children: option.badge
						})]
					}),
					option.detail !== void 0 && (0, react_jsx_runtime.jsx)("span", {
						className: PopupSelectView_module_css_default.detail,
						children: option.detail
					}),
					option.active === true && (0, react_jsx_runtime.jsx)("span", {
						className: PopupSelectView_module_css_default.check,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, {})
					})
				]
			}, option.id);
			let optionIndex = 0;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [state.confirming === null && (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.MenuSurface, {
				ref: cardRef,
				className: PopupSelectView_module_css_default.card,
				style: { maxHeight },
				"aria-label": t("overlay.aria", { command: String(state.command) }),
				onKeyDown,
				children: [
					(0, react_jsx_runtime.jsx)("input", {
						ref: searchRef,
						className: PopupSelectView_module_css_default.search,
						type: "text",
						placeholder: state.searchLabels?.placeholder ?? t("search.placeholder"),
						"aria-label": t("search.aria"),
						value: state.search,
						readOnly: state.submitting,
						onChange: (ev) => {
							popup.setSearch(ev.currentTarget.value);
						}
					}),
					state.error !== null && (0, react_jsx_runtime.jsxs)("div", {
						className: PopupSelectView_module_css_default.error,
						role: "alert",
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: PopupSelectView_module_css_default.errorText,
							children: state.error
						}), state.status === "failed" && (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: PopupSelectView_module_css_default.retry,
export {};
