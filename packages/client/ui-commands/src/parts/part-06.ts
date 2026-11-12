/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
							onClick: () => {
								popup.retry();
							},
							children: t("retry")
						})]
					}),
					state.status === "pending" && (0, react_jsx_runtime.jsx)("div", {
						className: PopupSelectView_module_css_default.status,
						children: t("status.loading")
					}),
					state.submitting && (0, react_jsx_runtime.jsx)("div", {
						className: PopupSelectView_module_css_default.status,
						children: t("status.applying")
					}),
					state.status === "ready" && rows.length === 0 && (0, react_jsx_runtime.jsx)("div", {
						className: PopupSelectView_module_css_default.status,
						children: emptyLabel
					}),
					state.status === "ready" && (0, react_jsx_runtime.jsx)("div", {
						ref: viewportRef,
						role: "listbox",
						"aria-label": t("listbox.aria", { command: String(state.command) }),
						className: PopupSelectView_module_css_default.viewport,
						children: groups.map(({ group, rows: groupRows }) => group === void 0 ? (0, react_jsx_runtime.jsx)(react.Fragment, { children: groupRows.map((option) => renderOption(option, optionIndex++)) }, "ungrouped") : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuGroup, {
							label: group.label,
							children: groupRows.map((option) => renderOption(option, optionIndex++))
						}, `group:${group.name}`))
					})
				]
			}), confirmation !== void 0 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.RiskConfirmation, {
				open: true,
				title: confirmation.title,
				description: confirmation.description,
				acknowledgeLabel: confirmation.acknowledgeLabel,
				cancelLabel: confirmation.cancelLabel,
				closeLabel: t("close"),
				confirmLabel: confirmation.confirmLabel,
				acknowledged: state.acknowledged,
				onAcknowledgedChange: (value) => {
					popup.acknowledge(value);
				},
				onCancel: () => {
					popup.cancelConfirmation();
				},
				onConfirm: () => {
					popup.confirm();
				}
			})] });
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Dictionary namespace owned by this plugin. */
		const NS = "command";
		/** Required services: the '/' source registry, session scopes, commands Remote, and locale registry. */
		const inject = [
			"inputTriggers",
			"sessions",
			"remote",
			"remote.commands",
			"locale"
		];
		/**
		* Mount the command service and its per-session popupSelect overlay.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-commands: dictionaries");
			ctx.plugin(CommandUiRuntime);
			ctx.inject([
				"slots",
				"commandUi",
				"sessions"
			], (scope) => {
				const command = scope.commandUi;
				const sessions = scope.get("sessions");
				scope.slots.inject("conversation.input.overlay", () => scope.slots.register({
					name: "conversation.input.overlay",
					id: "command-popup",
					order: 1,
					locale: NS,
					inject: (sessionId) => {
						const actx = sessions.scope(sessionId);
						if (actx === void 0) throw new Error(`ui-commands: session "${String(sessionId)}" resolved no scope`);
						return { popup: command.popupFor(actx) };
					}
				}, PopupSelectView));
			});
		}
		//#endregion
		exports.CommandDirectory = CommandDirectory;
		exports.CommandUiRuntime = CommandUiRuntime;
		exports.PopupSelectController = PopupSelectController;
		exports.apply = apply;
		exports.filterOptions = filterOptions;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
