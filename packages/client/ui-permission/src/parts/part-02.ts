/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
							className: PermissionSelect_module_css_default.triggerIcon,
							"aria-hidden": true,
							children: permissionGlyph(currentValue)
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: PermissionSelect_module_css_default.triggerLabel,
							children: currentLabel
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: clsx(PermissionSelect_module_css_default.chevron, open && PermissionSelect_module_css_default.chevronOpen),
							"aria-hidden": true,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {})
						})
					]
				})
			}), confirmation !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.RiskConfirmation, {
				open: true,
				title: confirmationTitle,
				description: confirmationDescription,
				acknowledgeLabel: confirmationAcknowledge,
				cancelLabel: t("confirm.cancel"),
				closeLabel: t("close"),
				confirmLabel: confirmationEnable,
				acknowledged,
				disabled: locked,
				onAcknowledgedChange: setAcknowledged,
				onCancel: closeConfirmation,
				onConfirm: () => {
					confirmSelection(confirmation);
				}
			})] });
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-permission-presets/src/client/PermissionRow.module.css.mjs
		const css = ".oY77xG_row{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:center;gap:8px;padding:16px 0;display:flex}.oY77xG_rowText{flex-direction:column;flex:1;gap:4px;min-width:0;padding-right:48px;display:flex}.oY77xG_title{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.oY77xG_desc{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px}.oY77xG_selector{border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;font:inherit;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.oY77xG_selector:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.oY77xG_selector:disabled{cursor:default}.oY77xG_chevron{flex:none}";
		const tagId = "@galaxy-blackhole/gbh-client-ui-permission-presets/PermissionRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@galaxy-blackhole/gbh-client-ui-permission-presets";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PermissionRow_module_css_default = {
			"chevron": "oY77xG_chevron",
			"desc": "oY77xG_desc",
			"row": "oY77xG_row",
			"rowText": "oY77xG_rowText",
			"selector": "oY77xG_selector",
			"title": "oY77xG_title"
		};
		//#endregion
		//#region lib/types/client/PermissionRow.js
		/**
		* Permission preference row: the default preset for subsequently created
		* sessions. Current-session switches remain on the composer `/permission`
		* control.
		*/
		/**
		* Render the new-session Permission default selector.
		* @param props - composed slot props.
		* @returns the row, or null when the host does not expose permission settings.
		*/
		function PermissionRow({ load, select, usePermission, t }) {
			const state = usePermission((snapshot) => snapshot);
			const [open, setOpen] = (0, react.useState)(false);
			const [confirmingFullAccess, setConfirmingFullAccess] = (0, react.useState)(false);
			const [acknowledged, setAcknowledged] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			(0, react.useEffect)(() => {
				if (state.writable && state.status !== "unavailable") return;
				setOpen(false);
				setAcknowledged(false);
				setConfirmingFullAccess(false);
			}, [state.status, state.writable]);
			if (state.status === "unavailable") return null;
			const selected = state.options.find((option) => option.id === state.currentValue);
			const busy = state.status === "loading" || state.status === "saving" || confirmingFullAccess;
			const optionLabel = (option) => displayPermissionPreset(option.id, option.label, t);
			const label = selected !== void 0 ? optionLabel(selected) : busy ? t("loading") : t("unavailable");
			const description = state.error ?? t("description");
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("div", {
				className: PermissionRow_module_css_default.row,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: PermissionRow_module_css_default.rowText,
					children: [(0, react_jsx_runtime.jsx)("div", {
						className: PermissionRow_module_css_default.title,
						children: t("title")
					}), (0, react_jsx_runtime.jsx)("div", {
						className: PermissionRow_module_css_default.desc,
						role: state.error === null ? void 0 : "alert",
						children: description
					})]
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
					open,
					onClose: () => {
						setOpen(false);
					},
					items: state.options.map((option) => ({
						id: option.id,
						label: optionLabel(option)
					})),
					selectedId: state.currentValue,
					onSelect: (id) => {
						setOpen(false);
						if (id === state.currentValue) return;
						if (id === "danger-full-access") {
							setAcknowledged(false);
							setConfirmingFullAccess(true);
							return;
						}
						select(id);
					},
					align: "end",
					portal: true,
					anchor: (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: PermissionRow_module_css_default.selector,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						disabled: busy || !state.writable || state.options.length === 0,
						onClick: () => {
							setOpen((value) => !value);
						},
						children: [label, (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: PermissionRow_module_css_default.chevron })]
					})
				})]
			}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.RiskConfirmation, {
				open: confirmingFullAccess,
				title: t("confirm.title"),
				description: t("confirm.description"),
				acknowledgeLabel: t("confirm.acknowledge"),
				cancelLabel: t("confirm.cancel"),
				closeLabel: t("close"),
				confirmLabel: t("confirm.enable"),
				acknowledged,
				disabled: !state.writable || state.status === "saving",
				onAcknowledgedChange: setAcknowledged,
				onCancel: () => {
					setAcknowledged(false);
					setConfirmingFullAccess(false);
				},
				onConfirm: () => {
					setAcknowledged(false);
					setConfirmingFullAccess(false);
					select(FULL_ACCESS_PRESET);
				}
			})] });
		}
		//#endregion
		//#region lib/types/client/settings-store.js
		/**
		* Permission default-settings controller. The permission descriptor comes
		* from the shared describe mirror and choices from the permission catalog; writes target
		* only `defaultPreset`, carry the descriptor revision, and fold their answer
		* back into the mirror.
		*/
		/** Permission's settings namespace on the host wire. */
		const PERMISSION_SETTINGS_NS = "permission";
		/** Resolve the new-session choices from the permission domain's catalog.
		* @param view Live configuration descriptor.
		* @param catalog Configured permission options and effective default.
		* @returns Current choice and labels for its allowed options.
		*/
		function permissionDefaultOf(view, catalog) {
			const currentValue = view.value.defaultPreset ?? catalog.defaultPreset;
			const options = catalog.defaultOptions.map((option) => ({
				id: option.value,
				label: displayPermissionPreset(option.value, option.name)
			}));
			if (!options.some((option) => option.id === currentValue)) throw new Error("permission catalog does not advertise its current default");
			return {
				currentValue,
				options
			};
		}
		/** Controller deriving the row from the shared mirror and writing the default through it. */
		var PermissionPresetSettingsController = class {
			describeFace;
			ctx;
			catalog;
			/** Row snapshot consumed through a bound selector hook. */
			store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				status: "idle",
				error: null,
				writable: false,
				currentValue: "",
				options: [],
				revision: 0
			});
			following;
			followingCatalog;
			saving = false;
			disposed = false;
			/**
			* @param describeFace - the shared mirror's read/fold face (descriptor and schema source).
			* @param ctx - the row plugin's context, whose `remote.settings` namespace
			* carries the `defaultPreset` write.
			* @param catalog - configured permission choices and their effective default.
			*/
			constructor(describeFace, ctx, catalog) {
				this.describeFace = describeFace;
				this.ctx = ctx;
				this.catalog = catalog;
			}
			/**
			* Begin following the mirror (idempotent) and reflect its current answer.
			* @returns settlement once the snapshot reflects the mirror.
			*/
			async load() {
				if (this.disposed) return;
				this.following ??= this.describeFace.subscribe(() => {
					this.derive();
				});
				this.followingCatalog ??= this.catalog.store.subscribe(() => {
					this.derive();
				});
				this.store.update((state) => {
					state.status = "loading";
					state.error = null;
				});
				await this.describeFace.ensure();
				try {
					await this.catalog.load();
				} catch (error) {
					this.fail(error);
					return;
				}
				this.derive();
			}
			/**
			* Persist one preset as the default for subsequently created sessions.
			* A selection made while one is already saving is ignored — the row's
			* control is disabled during the save, so this only drops programmatic
			* double-submits rather than user intent.
			* @param preset - advertised preset key.
			* @returns nothing; {@link store} carries success or failure.
			*/
			async select(preset) {
				const state = this.store.getSnapshot();
				const view = this.describeFace.getSnapshot().view?.namespaces.find((entry) => entry.ns === PERMISSION_SETTINGS_NS);
				if (view === void 0 || !state.writable || this.saving) return;
				this.saving = true;
				this.store.update((draft) => {
					draft.status = "saving";
					draft.error = null;
				});
				let response;
				try {
					response = await this.ctx.remote.settings.mutate(PERMISSION_SETTINGS_NS, [{
						op: "set",
						path: ["defaultPreset"],
						value: preset
					}], view.revision);
				} finally {
					this.saving = false;
				}
				if (this.disposed) return;
				if (!response.ok) {
					this.fail(response.error);
					return;
				}
				this.describeFace.acceptView(response.value);
			}
			/** Stop following the mirror; later publishes leave the snapshot alone. */
			dispose() {
				this.disposed = true;
				this.following?.();
				this.following = void 0;
				this.followingCatalog?.();
				this.followingCatalog = void 0;
			}
			derive() {
				if (this.disposed || this.saving) return;
				const mirrored = this.describeFace.getSnapshot();
				if (mirrored.view === void 0) {
					if (mirrored.error !== null) this.fail(new Error(mirrored.error));
					return;
				}
				const view = mirrored.view.namespaces.find((entry) => entry.ns === PERMISSION_SETTINGS_NS);
				if (view === void 0) {
					this.store.update((state) => {
						state.status = "unavailable";
						state.writable = false;
						state.currentValue = "";
						state.options = [];
					});
					return;
				}
				try {
					const catalog = this.catalog.store.getSnapshot().value;
					if (catalog === null) return;
					const resolved = permissionDefaultOf(view, catalog);
					const { writable } = mirrored.view;
					this.store.update((state) => {
						state.status = "ready";
						state.error = null;
						state.writable = writable;
						state.currentValue = resolved.currentValue;
						state.options = resolved.options;
						state.revision = view.revision;
					});
				} catch (error) {
					this.fail(error);
				}
			}
			fail(error) {
				this.store.update((state) => {
					state.status = "error";
					state.error = error instanceof Error ? error.message : String(error);
				});
			}
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Required services (cordis fiber inject). */
		const inject = [
			"commandUi",
			"connection",
			"sessions",
			"slots",
			"locale",
			"remote",
			"remote.permissionPresets",
			"remote.settings",
			"configForms",
			"settingsSchema"
		];
		/** Read one session's current permissions projection value (undefined = capability absent). */
		function selectionOf(session) {
			return session?.projections.faceOf("permissions").getSnapshot();
		}
		/** Join the process catalog with one Session's current value. */
		function optionsOf(catalog, currentValue, t) {
			return catalog.options.map((option) => ({
				id: option.value,
				label: option.value === "auto" ? t("auto.label") : displayPermissionPreset(option.value, option.name, t),
				...option.value === "auto" ? { badge: t("auto.badge") } : {},
				...option.value === "auto" ? { detail: t("auto.description") } : option.description !== void 0 ? { detail: option.description } : {},
				...option.value === currentValue ? { active: true } : {},
				...option.value === "danger-full-access" || option.value === "auto" ? { confirmation: {
					title: t(option.value === "auto" ? "auto.confirm.title" : "confirm.title"),
					description: t(option.value === "auto" ? "auto.confirm.description" : "confirm.description"),
					acknowledgeLabel: t(option.value === "auto" ? "auto.confirm.acknowledge" : "confirm.acknowledge"),
					cancelLabel: t("confirm.cancel"),
					confirmLabel: t(option.value === "auto" ? "auto.confirm.enable" : "confirm.enable")
				} } : {}
			}));
		}
		/**
		* Client plugin body: register the /permission popup picker over the
		* permissions projection.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			const command = ctx.get("commandUi");
			const sessions = ctx.sessions;
			ctx.effect(() => ctx.locale.register(PERMISSION_ACCESS_NS, {
				zh: accessZh,
				en: accessEn
			}), "ui-permission: current-session dictionaries");
			const t = ctx.locale.bind(PERMISSION_ACCESS_NS);
			const sessionFor = (session) => sessions.binding(session.sessionId)?.session;
			const submit = async (sessionId, preset) => {
				const live = sessions.binding(sessionId)?.session;
				if (live === void 0) throw new Error("this session is not materialized yet");
				const result = await live.command(`/permission ${preset}`);
				if (!result.ok) throw new Error(`permission switch failed: ${result.error.code}: ${result.error.message}`);
				if (!result.value.matched) throw new Error("the host offers no /permission command");
				return true;
			};
			const catalog = new PermissionCatalogDirectory(ctx);
			ctx.effect(() => () => {
				catalog.dispose();
			}, "ui-permission: process catalog directory");
			ctx.effect(() => catalog.invalidations.subscribe(() => {
				command.dismiss("permission");
			}), "ui-permission: dismiss stale slash choices");
			ctx.effect(() => ctx.locale.register("settings.permission", {
				zh,
				en
			}), "ui-permission: settings row dictionaries");
			const controller = new PermissionPresetSettingsController(ctx.configForms.describe(), ctx, catalog);
			const load = () => controller.load();
			const select = (preset) => controller.select(preset);
			const injected = () => ({
				hooks: { permission: controller.store },
				load,
				select
			});
			ctx.effect(() => () => {
				controller.dispose();
			}, "ui-permission: settings row directory");
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "permission",
				order: -20,
				locale: "settings.permission",
export {};
