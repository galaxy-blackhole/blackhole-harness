/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					onToggle: toggleRow,
					ariaLabel: cardLabel(title, entry.entryId, stateText),
					trailing: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [entry.enabled && showsPhaseDot(entry.fiberPhase) ? (0, react_jsx_runtime.jsx)(PhaseDot, {
						phase: entry.fiberPhase,
						t
					}) : null, (0, react_jsx_runtime.jsx)(StateTag, {
						kind,
						label: stateText
					})] }),
					children: (0, react_jsx_runtime.jsx)(CardFacts, {
						moduleName: entry.moduleName,
						moduleLabel: t("moduleLabel"),
						entryId: entry.entryId,
						facts: providers !== void 0 ? [[t("configuration"), t("presetProvidedDetail")], [t("enabledIn"), providers.map((preset) => presetName(preset)).join(" · ")]] : [[t("configuration"), t(entry.enabled ? "enabledTag" : "disabledTag")], ...entry.enabled ? [[t("runtime"), phaseLabel(entry.fiberPhase, t)]] : []]
					})
				}, key);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: PluginInventorySettingsTab_module_css_default.section,
				"aria-busy": state.status === "loading",
				children: [
					clientSync.syncing ? (0, react_jsx_runtime.jsxs)("p", {
						className: `${PluginInventorySettingsTab_module_css_default.status} ${PluginInventorySettingsTab_module_css_default.statusWithDot}`,
						role: "status",
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }), t("clientSyncing")]
					}) : null,
					clientSync.failures.length === 0 ? null : (0, react_jsx_runtime.jsxs)("div", {
						className: PluginInventorySettingsTab_module_css_default.failure,
						"data-client-sync-failure": true,
						children: [
							(0, react_jsx_runtime.jsxs)("p", {
								className: PluginInventorySettingsTab_module_css_default.statusWithDot,
								role: "alert",
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" }), t("clientSyncFailed")]
							}),
							(0, react_jsx_runtime.jsx)("ul", { children: clientSync.failures.map((failure) => (0, react_jsx_runtime.jsxs)("li", { children: [
								failure.id,
								": ",
								failure.message
							] }, failure.id)) }),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: clientSync.syncing,
								onClick: retryClient,
								children: t("clientSyncRetry")
							})
						]
					}),
					state.status === "loading" ? (0, react_jsx_runtime.jsxs)("div", {
						className: PluginInventorySettingsTab_module_css_default.cards,
						role: "status",
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: PluginInventorySettingsTab_module_css_default.visuallyHidden,
							children: t("loading")
						}), SKELETON_CARDS.map((slot) => (0, react_jsx_runtime.jsxs)("div", {
							className: PluginInventorySettingsTab_module_css_default.skeletonCard,
							"aria-hidden": "true",
							children: [(0, react_jsx_runtime.jsx)("span", { className: PluginInventorySettingsTab_module_css_default.skeletonBar }), (0, react_jsx_runtime.jsx)("span", { className: PluginInventorySettingsTab_module_css_default.skeletonBar })]
						}, slot))]
					}) : null,
					state.status === "error" ? (0, react_jsx_runtime.jsxs)("div", {
						className: PluginInventorySettingsTab_module_css_default.failure,
						children: [(0, react_jsx_runtime.jsxs)("p", {
							className: PluginInventorySettingsTab_module_css_default.statusWithDot,
							role: "alert",
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" }), t("error")]
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: retry,
							children: t("retry")
						})]
					}) : null,
					snapshot !== void 0 ? (0, react_jsx_runtime.jsxs)("div", {
						className: PluginInventorySettingsTab_module_css_default.catalog,
						children: [
							(0, react_jsx_runtime.jsxs)("label", {
								className: PluginInventorySettingsTab_module_css_default.search,
								children: [
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { "aria-hidden": "true" }),
									(0, react_jsx_runtime.jsx)("span", {
										className: PluginInventorySettingsTab_module_css_default.visuallyHidden,
										children: t("search")
									}),
									(0, react_jsx_runtime.jsx)("input", {
										type: "search",
										value: query,
										placeholder: t("search"),
										"aria-label": t("search"),
										onChange: (event) => {
											setQuery(event.currentTarget.value);
										}
									})
								]
							}),
							entries.length === 0 && presets.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
								className: PluginInventorySettingsTab_module_css_default.status,
								children: t("empty")
							}) : null,
							nothingMatches ? (0, react_jsx_runtime.jsx)("p", {
								className: PluginInventorySettingsTab_module_css_default.status,
								children: t("emptySearch")
							}) : null,
							selected !== void 0 ? (0, react_jsx_runtime.jsxs)("section", {
								className: PluginInventorySettingsTab_module_css_default.group,
								"data-plugin-scope": "preset",
								"data-preset-id": selected.id,
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: PluginInventorySettingsTab_module_css_default.groupTitleRow,
										children: [(0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: PluginInventorySettingsTab_module_css_default.groupToggle,
											"aria-expanded": presetEffectiveOpen,
											"aria-controls": `${sectionId}-preset`,
											onClick: () => {
												setPresetOpen(!presetEffectiveOpen);
											},
											children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
												className: PluginInventorySettingsTab_module_css_default.chevron,
												size: 12,
												"aria-hidden": "true"
											}), (0, react_jsx_runtime.jsx)("span", {
												className: PluginInventorySettingsTab_module_css_default.groupTitle,
												children: t("presetTitle")
											})]
										}), (0, react_jsx_runtime.jsx)("div", {
											className: PluginInventorySettingsTab_module_css_default.headerEnd,
											children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
												open: switcherOpen,
												onClose: () => {
													setSwitcherOpen(false);
												},
												items: presets.map((preset) => ({
													id: preset.id,
													label: presetLabel(preset, t, presetName)
												})),
												selectedId: selected.id,
												onSelect: (id) => {
													setSwitcherOpen(false);
													setChosenPreset(id);
												},
												align: "end",
												portal: true,
												anchor: (0, react_jsx_runtime.jsxs)("button", {
													type: "button",
													className: PluginInventorySettingsTab_module_css_default.switcher,
													"aria-haspopup": "menu",
													"aria-expanded": switcherOpen,
													"aria-label": t("switcherLabel"),
													onClick: () => {
														setSwitcherOpen((value) => !value);
													},
													children: [(0, react_jsx_runtime.jsx)("span", {
														className: PluginInventorySettingsTab_module_css_default.switcherLabel,
														children: presetLabel(selected, t, presetName)
													}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
														className: PluginInventorySettingsTab_module_css_default.chevron,
														"aria-hidden": "true"
													})]
												})
											})
										})]
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: PluginInventorySettingsTab_module_css_default.groupSub,
										children: t("presetSubtitle")
									}),
									presetEffectiveOpen ? (0, react_jsx_runtime.jsxs)("div", {
										id: `${sectionId}-preset`,
										className: PluginInventorySettingsTab_module_css_default.groupBody,
										children: [
											selected.broken !== void 0 ? (0, react_jsx_runtime.jsx)("p", {
												className: PluginInventorySettingsTab_module_css_default.brokenNote,
												role: "alert",
												children: selected.broken
											}) : null,
											selectedRows.length > 0 ? (0, react_jsx_runtime.jsx)("ul", {
												className: PluginInventorySettingsTab_module_css_default.cards,
												children: selectedRows.map((row, index) => presetRowCard(selected, row, index))
											}) : null,
											otherMatchCount > 0 ? (0, react_jsx_runtime.jsxs)("p", {
												className: PluginInventorySettingsTab_module_css_default.hint,
												children: [t("matchesInOtherPresets", { count: String(otherMatchCount) }), otherPresetMatches.map((preset) => (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: PluginInventorySettingsTab_module_css_default.jumpLink,
													onClick: () => {
														setChosenPreset(preset.id);
													},
													children: presetName(preset)
												}, preset.id))]
											}) : null
										]
									}) : null
								]
							}) : null,
							entries.length > 0 ? (0, react_jsx_runtime.jsxs)("section", {
								className: PluginInventorySettingsTab_module_css_default.group,
								"data-plugin-scope": "global",
								children: [
									(0, react_jsx_runtime.jsx)("div", {
										className: PluginInventorySettingsTab_module_css_default.groupTitleRow,
										children: (0, react_jsx_runtime.jsxs)("button", {
											type: "button",
											className: PluginInventorySettingsTab_module_css_default.groupToggle,
											"aria-expanded": globalEffectiveOpen,
											"aria-controls": `${sectionId}-global`,
											onClick: () => {
												setGlobalOpen(!globalEffectiveOpen);
											},
											children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
												className: PluginInventorySettingsTab_module_css_default.chevron,
												size: 12,
												"aria-hidden": "true"
											}), (0, react_jsx_runtime.jsx)("span", {
												className: PluginInventorySettingsTab_module_css_default.groupTitle,
												children: t("globalTitle")
											})]
										})
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: PluginInventorySettingsTab_module_css_default.groupSub,
										children: t("globalSubtitle")
									}),
									globalEffectiveOpen && globalCount > 0 ? (0, react_jsx_runtime.jsxs)("ul", {
										className: PluginInventorySettingsTab_module_css_default.cards,
										id: `${sectionId}-global`,
										children: [filteredFailed.map((entry) => globalRowCard(entry)), filteredRegular.map((entry) => globalRowCard(entry, entry.enabled ? void 0 : enabledIn.get(entry.moduleName)))]
									}) : null
								]
							}) : null
						]
					}) : null
				]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Copy dictionaries for the plugin inventory Settings section. */
		/** Simplified Chinese dictionary and key source of truth. */
		const zh = {
			tab: "插件列表",
			loading: "正在读取插件…",
			clientSyncing: "正在同步本页面的插件…",
			clientSyncFailed: "本页面的插件未能完成同步；服务端的启用状态保持不变。",
			clientSyncRetry: "重试本页面同步",
			error: "暂时无法读取插件。",
			metadataError: "包元信息错误：{error}",
			retry: "重试",
			search: "搜索插件",
			empty: "暂无插件。",
			emptySearch: "没有匹配的插件。",
			presetTitle: "会话插件",
			presetSubtitle: "由 Agent 预设按会话组成",
			switcherLabel: "选择要查看的 Agent 预设",
			presetOptionDefault: "{name}（默认）",
			presetOptionBroken: "{name}（加载失败）",
			globalTitle: "全局插件",
			globalSubtitle: "系统与所有会话共用",
			presetProvidedDetail: "全局已停用，由 Agent 预设按会话提供",
			enabledIn: "启用于",
			matchesInOtherPresets: "其他预设中还有 {count} 个匹配：",
			enabledTag: "已启用",
			disabledTag: "已停用",
			conditionalTag: "条件启用",
			presetEnabledTag: "预设中启用",
			failedTag: "启动失败",
			moduleLabel: "完整名称",
			fromPreset: "来自",
			condition: "禁用条件",
			configuration: "配置状态",
			runtime: "运行状态",
			unobserved: "未运行",
			pending: "等待依赖",
			loadingPhase: "加载中",
			active: "运行中",
			failed: "启动失败",
			unloading: "卸载中"
		};
		/** English dictionary checked against the Chinese key set. */
		const en = {
			tab: "Plugin list",
			loading: "Reading plugins…",
			clientSyncing: "Syncing plugins on this page…",
			clientSyncFailed: "Some plugins could not sync on this page. Host enablement is unchanged.",
			clientSyncRetry: "Retry this page",
			error: "Plugins are temporarily unavailable.",
			metadataError: "Package metadata error: {error}",
			retry: "Retry",
			search: "Search plugins",
			empty: "No plugins are available.",
			emptySearch: "No matching plugins.",
			presetTitle: "Session plugins",
			presetSubtitle: "Composed per session by agent presets",
			switcherLabel: "Choose the agent preset to inspect",
			presetOptionDefault: "{name} (default)",
			presetOptionBroken: "{name} (failed to load)",
			globalTitle: "Global plugins",
			globalSubtitle: "Shared by the system and every session",
			presetProvidedDetail: "Disabled globally; agent presets provide it per session",
			enabledIn: "Enabled in",
			matchesInOtherPresets: "{count} more matches in other presets: ",
			enabledTag: "Enabled",
			disabledTag: "Disabled",
			conditionalTag: "Conditional",
			presetEnabledTag: "Via presets",
			failedTag: "Failed",
			moduleLabel: "Module",
			fromPreset: "From",
			condition: "Disabled when",
			configuration: "Configuration",
			runtime: "Status",
			unobserved: "Not running",
			pending: "Waiting for dependencies",
			loadingPhase: "Loading",
			active: "Running",
			failed: "Failed to start",
			unloading: "Unloading"
		};
		//#endregion
		//#region lib/types/client/index.js
		/** Read-only Host plugin inventory registered into Web Settings. */
		/** Dictionary namespace owned by this plugin. */
		const NS = "settings.pluginInventory";
		/** Services required by the Settings registration and generated Remote face. */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.pluginInventory",
			"modules"
		];
		/** Contribute the lazy inventory tab to the Plugins settings section. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-settings-plugin-inventory: dictionaries");
			const t = ctx.locale.bind(NS);
			const list = async () => {
				const result = await ctx.remote.pluginInventory.list();
				if (!result.ok) throw new Error(`pluginInventory.list failed: ${result.error.code}: ${result.error.message}`);
				return result.value;
			};
			const agentPresetCopy = ctx.locale.bind("settings.agentPreset");
			const presetName = (preset) => presetDisplayText(preset, agentPresetCopy).name;
			const injected = () => ({
				list,
				presetName,
				resolveText: (text) => ctx.locale.resolveText(text),
				hooks: { clientSync: ctx.modules.entries.state },
				retryClient: () => {
					ctx.modules.entries.retry().catch((error) => {
						ctx.logger.error(error);
					});
				}
			});
			ctx.slots.inject("settings.plugins.tab", () => ctx.slots.register({
				name: "settings.plugins.tab",
				id: "all",
				order: 10,
				label: () => t("tab"),
				locale: NS,
				inject: injected
			}, PluginInventorySettingsTab));
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
