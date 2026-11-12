/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-settings-plugin-inventory",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		//#region ../../preset/agent-preset-registry/src/display.ts
		const BUILT_IN_PRESET_KEYS = {
			standard: {
				name: "presetStandardName",
				description: "presetStandardDescription"
			},
			ptc: {
				name: "presetPtcName",
				description: "presetPtcDescription"
			},
			minimal: {
				name: "presetMinimalName",
				description: "presetMinimalDescription"
			},
			cordis: {
				name: "presetCordisName",
				description: "presetCordisDescription"
			}
		};
		/**
		* Whether a roster row is one of the shipped presets whose copy the dictionaries carry.
		* A shipped preset publishes no `name`; a declaration that names itself owns its copy.
		* @param preset - roster row.
		* @returns true for a shipped preset id without a published name.
		*/
		function isBuiltInPreset(preset) {
			return preset.name === void 0 && BUILT_IN_PRESET_KEYS[preset.id] !== void 0;
		}
		/**
		* Resolve preset display copy without making user-authored metadata translatable.
		* @param preset - roster row whose copy is being rendered.
		* @param t - active locale lookup covering {@link BuiltInPresetCopyKey}.
		* @returns localized copy for a known shipped preset, otherwise declaration metadata.
		*/
		function presetDisplayText(preset, t) {
			const keys = isBuiltInPreset(preset) ? BUILT_IN_PRESET_KEYS[preset.id] : void 0;
			if (keys !== void 0) return {
				name: t(keys.name),
				description: t(keys.description)
			};
			return {
				name: preset.name ?? preset.id,
				...preset.description === void 0 ? {} : { description: preset.description }
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.module.css.mjs
		const css = ".qSYn7G_section{width:100%;max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex;container:qSYn7G_plugin-inventory/inline-size}.qSYn7G_status,.qSYn7G_failure p{margin:0}.qSYn7G_status,.qSYn7G_failure{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}.qSYn7G_failure{color:var(--dsw-alias-state-error-primary);align-items:center;gap:10px;display:flex}.qSYn7G_statusWithDot{align-items:center;gap:6px;display:inline-flex}.qSYn7G_failure button{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;padding:4px 10px}.qSYn7G_catalog{flex-direction:column;gap:12px;display:flex}.qSYn7G_search{width:100%;color:var(--dsw-alias-label-tertiary);align-items:center;display:flex;position:relative}.qSYn7G_search>svg{pointer-events:none;position:absolute;left:12px}.qSYn7G_search input{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);width:100%;height:36px;color:var(--dsw-alias-label-primary);font:inherit;outline:none;padding:0 34px 0 36px;font-size:13px}.qSYn7G_search input::placeholder{color:var(--dsw-alias-label-tertiary)}.qSYn7G_search input:focus-visible{border-color:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)) 18%, transparent)}.qSYn7G_cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none;display:grid}.qSYn7G_card{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill);flex-direction:column;min-width:0;display:flex;overflow:hidden}.qSYn7G_card[data-open=true]{border-color:var(--dsw-alias-border-l3)}.qSYn7G_card:nth-child(odd)[data-open=true]+.qSYn7G_card,.qSYn7G_card:nth-child(odd):has(+.qSYn7G_card[data-open=true]){align-self:start}.qSYn7G_cardContent{box-sizing:border-box;width:100%;min-height:52px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;flex-direction:column;flex:auto;align-items:stretch;gap:2px;padding:12px 14px;display:flex}.qSYn7G_cardContent:hover,.qSYn7G_card[data-open=true]>.qSYn7G_cardContent{background:var(--dsw-alias-interactive-bg-hover)}.qSYn7G_cardContent:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.qSYn7G_cardMainRow{justify-content:space-between;align-items:center;gap:12px;min-width:0;display:flex}.qSYn7G_cardTitle,.qSYn7G_cardIdentity{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.qSYn7G_cardTitle{flex:1;min-width:0;font-size:14px;font-weight:500;line-height:20px}.qSYn7G_cardDescription{color:var(--dsw-alias-label-tertiary);text-wrap:pretty;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:12px;line-height:18px;display:-webkit-box;overflow:hidden}.qSYn7G_card[data-open=true] .qSYn7G_cardDescription{display:block}.qSYn7G_cardMeta{margin-top:auto;padding-top:6px;display:flex}.qSYn7G_cardIdentity,.qSYn7G_entryValue{font-family:var(--ds-font-family-code);font-size:12px;line-height:18px}.qSYn7G_cardIdentity{box-sizing:border-box;border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-module-platform);max-width:100%;color:var(--dsw-alias-label-secondary);padding:1px 6px;display:block}.qSYn7G_cardTrailing{color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;gap:8px;display:inline-flex}.qSYn7G_phaseDot{flex:none;display:inline-flex}.qSYn7G_group{flex-direction:column;gap:10px;display:flex}.qSYn7G_groupTitleRow{align-items:center;gap:8px;min-height:36px;display:flex}.qSYn7G_group+.qSYn7G_group{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:14px}.qSYn7G_headerEnd{margin-left:auto}.qSYn7G_groupToggle{color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;flex:none;align-items:center;gap:8px;padding:0;display:flex}.qSYn7G_groupToggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.qSYn7G_groupToggle>.qSYn7G_chevron{transform:rotate(-90deg)}.qSYn7G_groupToggle[aria-expanded=true]>.qSYn7G_chevron{transform:none}.qSYn7G_groupTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.qSYn7G_groupSub{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex-wrap:wrap;row-gap:4px;margin:-6px 0 0 20px;font-size:12px;line-height:18px;display:flex}.qSYn7G_switcher{white-space:nowrap;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border:none;flex:none;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.qSYn7G_switcher:hover{background:var(--dsw-alias-interactive-bg-hover)}.qSYn7G_switcher:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.qSYn7G_switcher>.qSYn7G_chevron{flex:none}.qSYn7G_switcherLabel{text-overflow:ellipsis;max-width:240px;overflow:hidden}.qSYn7G_groupBody{flex-direction:column;gap:10px;display:flex}.qSYn7G_brokenNote{border-radius:var(--dsw-radius-lg);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;white-space:pre-line;margin:0;padding:8px 10px;font-size:12px;line-height:18px}.qSYn7G_hint{color:var(--dsw-alias-label-tertiary);flex-wrap:wrap;align-items:baseline;gap:4px 8px;margin:0;font-size:12px;line-height:18px;display:flex}.qSYn7G_jumpLink{color:var(--dsw-alias-state-business-primary);font:inherit;cursor:pointer;background:0 0;border:0;padding:0;font-size:12px}.qSYn7G_skeletonCard{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill);flex-direction:column;gap:8px;padding:15px 14px;display:flex}.qSYn7G_skeletonBar{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-skeleton);width:40%;height:14px}.qSYn7G_skeletonBar+.qSYn7G_skeletonBar{width:80%;height:12px}.qSYn7G_card[data-failed=true]{border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent)}.qSYn7G_chevron{color:var(--dsw-alias-label-tertiary);flex:none}.qSYn7G_card[data-open=true] .qSYn7G_chevron{transform:rotate(180deg)}.qSYn7G_cardDetails{border-top:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);padding:10px 14px 12px}.qSYn7G_entryValue{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);display:block}.qSYn7G_details{grid-template-columns:76px minmax(0,1fr);gap:6px 10px;margin:8px 0 0;display:grid}.qSYn7G_details div{display:contents}.qSYn7G_details dt{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}.qSYn7G_details dd{overflow-wrap:anywhere;min-width:0;color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:17px}.qSYn7G_visuallyHidden{clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}@media (prefers-reduced-motion:no-preference){.qSYn7G_chevron{transition:transform .14s var(--ds-ease-in-out)}.qSYn7G_skeletonBar{animation:2s cubic-bezier(.36,0,.64,1) infinite qSYn7G_plugin-inventory-skeleton}}@keyframes qSYn7G_plugin-inventory-skeleton{0%{opacity:1}40%{opacity:.6}80%,to{opacity:1}}@container qSYn7G_plugin-inventory (width<=520px){.qSYn7G_cards{grid-template-columns:minmax(0,1fr)}}";
		const tagId = "@deepseek-ai/dsh-client-ui-settings-plugin-inventory/PluginInventorySettingsTab.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-plugin-inventory";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PluginInventorySettingsTab_module_css_default = {
			"brokenNote": "qSYn7G_brokenNote",
			"card": "qSYn7G_card",
			"cardContent": "qSYn7G_cardContent",
			"cardDescription": "qSYn7G_cardDescription",
			"cardDetails": "qSYn7G_cardDetails",
			"cardIdentity": "qSYn7G_cardIdentity",
			"cardMainRow": "qSYn7G_cardMainRow",
			"cardMeta": "qSYn7G_cardMeta",
			"cardTitle": "qSYn7G_cardTitle",
			"cardTrailing": "qSYn7G_cardTrailing",
			"cards": "qSYn7G_cards",
			"catalog": "qSYn7G_catalog",
			"chevron": "qSYn7G_chevron",
			"details": "qSYn7G_details",
			"entryValue": "qSYn7G_entryValue",
			"failure": "qSYn7G_failure",
			"group": "qSYn7G_group",
			"groupBody": "qSYn7G_groupBody",
			"groupSub": "qSYn7G_groupSub",
			"groupTitle": "qSYn7G_groupTitle",
			"groupTitleRow": "qSYn7G_groupTitleRow",
			"groupToggle": "qSYn7G_groupToggle",
			"headerEnd": "qSYn7G_headerEnd",
			"hint": "qSYn7G_hint",
			"jumpLink": "qSYn7G_jumpLink",
			"phaseDot": "qSYn7G_phaseDot",
			"plugin-inventory": "qSYn7G_plugin-inventory",
			"plugin-inventory-skeleton": "qSYn7G_plugin-inventory-skeleton",
			"search": "qSYn7G_search",
			"section": "qSYn7G_section",
			"skeletonBar": "qSYn7G_skeletonBar",
			"skeletonCard": "qSYn7G_skeletonCard",
			"status": "qSYn7G_status",
			"statusWithDot": "qSYn7G_statusWithDot",
			"switcher": "qSYn7G_switcher",
			"switcherLabel": "qSYn7G_switcherLabel",
			"visuallyHidden": "qSYn7G_visuallyHidden"
		};
		//#endregion
		//#region lib/types/client/PluginInventorySettingsTab.js
		const PHASE_KEYS = {
			pending: "pending",
			loading: "loadingPhase",
			active: "active",
			failed: "failed",
			unloading: "unloading"
		};
		/** Placeholder cards the loading skeleton lays out in the cards grid. */
		const SKELETON_CARDS = [
			0,
			1,
			2,
			3
		];
		/** Localized accessible label for one root Fiber phase. */
		function phaseLabel(phase, t) {
			return phase === null ? t("unobserved") : t(PHASE_KEYS[phase]);
		}
		/** Compact technical names for Settings without changing their module identity. */
		function moduleShortName(moduleName) {
			return (moduleName.startsWith("@") ? moduleName.slice(moduleName.indexOf("/") + 1) : moduleName).replace(/^cordis:/, "").replace(/^cordis-plugin-/, "").replace(/^dsh-(?:host-|client-)?/, "");
		}
		/** Display an entry identity without the composition-only `include:` marker. */
		function entrySubtitle(entryId) {
			return entryId.replace(/^include:/, "");
		}
		/** Whether a card shows its entry id: the id exists and, without its `include:` marker, differs from the title. */
		function idAddsToTitle(entryId, title) {
			return entryId !== null && entrySubtitle(entryId) !== title;
		}
		/** Accessible card name: the title, the complete entry id when the card shows one, then the enablement state. */
		function cardLabel(title, entryId, state) {
			return idAddsToTitle(entryId, title) ? `${title}, ${entryId}, ${state}` : `${title}, ${state}`;
		}
		/** Preserve translated titles and shorten literal package or module name fallbacks in Settings. */
		function pluginText(row, resolveText) {
			const title = row.meta?.title;
			return {
				title: typeof title === "object" ? resolveText(title) : moduleShortName(title ?? row.moduleName),
				description: row.meta?.description === void 0 ? void 0 : resolveText(row.meta.description) || void 0
			};
		}
		/** Match translated text alongside the row's technical module and entry identities. */
		function matches(row, normalizedQuery, resolveText) {
			if (normalizedQuery.length === 0) return true;
			const { title, description } = pluginText(row, resolveText);
			return [
				row.moduleName,
				row.entryId,
				title,
				description
			].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery));
		}
		/** The roster row shown when the preset switcher has no explicit choice. */
		function fallbackPreset(presets) {
			return presets.find((preset) => preset.isDefault) ?? presets[0];
		}
		/** The switcher's display label for one preset. */
		function presetLabel(preset, t, presetName) {
			const name = presetName(preset);
			if (preset.broken !== void 0) return t("presetOptionBroken", { name });
			if (preset.isDefault) return t("presetOptionDefault", { name });
			return name;
		}
		/** One expandable plugin card; the caller owns the trailing status content. */
		function PluginCard({ rowKey, moduleName, title, description, metadataError, entryId, trailing, ariaLabel, failed, expanded, onToggle, children }) {
			const open = expanded === rowKey;
			const detailId = `plugin-details-${encodeURIComponent(rowKey)}`;
			const descriptionId = (0, react.useId)();
			return (0, react_jsx_runtime.jsxs)("li", {
				className: PluginInventorySettingsTab_module_css_default.card,
				"data-plugin-entry": entryId ?? void 0,
				"data-plugin-module": moduleName,
				"data-failed": failed ? "true" : void 0,
				"data-open": open ? "true" : void 0,
				children: [
					(0, react_jsx_runtime.jsxs)("button", {
						className: PluginInventorySettingsTab_module_css_default.cardContent,
						type: "button",
						"aria-expanded": open,
						"aria-controls": detailId,
						"aria-label": ariaLabel,
						"aria-describedby": description === void 0 ? void 0 : descriptionId,
						onClick: () => {
							onToggle(rowKey);
						},
						children: [
							(0, react_jsx_runtime.jsxs)("span", {
								className: PluginInventorySettingsTab_module_css_default.cardMainRow,
								children: [(0, react_jsx_runtime.jsx)("strong", {
									className: PluginInventorySettingsTab_module_css_default.cardTitle,
									title: moduleName,
									children: title
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: PluginInventorySettingsTab_module_css_default.cardTrailing,
									children: [trailing, (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
										className: PluginInventorySettingsTab_module_css_default.chevron,
										size: 12,
										"aria-hidden": "true"
									})]
								})]
							}),
							description === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
								className: PluginInventorySettingsTab_module_css_default.cardDescription,
								id: descriptionId,
								children: description
							}),
							idAddsToTitle(entryId, title) ? (0, react_jsx_runtime.jsx)("span", {
								className: PluginInventorySettingsTab_module_css_default.cardMeta,
								children: (0, react_jsx_runtime.jsx)("code", {
									className: PluginInventorySettingsTab_module_css_default.cardIdentity,
									title: entryId,
									children: entrySubtitle(entryId)
								})
							}) : null
						]
					}),
					metadataError === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
						className: PluginInventorySettingsTab_module_css_default.brokenNote,
						role: "status",
						"data-package-meta-error": true,
						children: metadataError
					}),
					open ? (0, react_jsx_runtime.jsx)("div", {
						className: PluginInventorySettingsTab_module_css_default.cardDetails,
						id: detailId,
						children
					}) : null
				]
			});
		}
		/** Detail rows shared by every card: the Loader identity, then labeled facts. */
		function CardFacts({ moduleName, moduleLabel, entryId, facts }) {
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [entryId === null ? null : (0, react_jsx_runtime.jsx)("code", {
				className: PluginInventorySettingsTab_module_css_default.entryValue,
				"data-loader-entry": true,
				children: entryId
			}), (0, react_jsx_runtime.jsxs)("dl", {
				className: PluginInventorySettingsTab_module_css_default.details,
				children: [(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: moduleLabel }), (0, react_jsx_runtime.jsx)("dd", { children: moduleName })] }), facts.map(([label, value]) => (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: label }), (0, react_jsx_runtime.jsx)("dd", { children: value })] }, label))]
			})] });
		}
		const PHASE_DOT_STATES = {
			pending: "idle",
			loading: "ongoing",
			unloading: "ongoing"
		};
		/** Whether a live root-fiber phase carries a dot of its own. */
		function showsPhaseDot(phase) {
			return phase === "pending" || phase === "loading" || phase === "unloading";
		}
		/** Status dot naming a live root-fiber phase; rows without a dotted phase show none. */
		function PhaseDot({ phase, t }) {
			const status = phaseLabel(phase, t);
			return (0, react_jsx_runtime.jsx)("span", {
				className: PluginInventorySettingsTab_module_css_default.phaseDot,
				role: "img",
				"aria-label": status,
				title: status,
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: PHASE_DOT_STATES[phase] })
			});
		}
		const TAG_TONES = {
			disabled: "neutral",
			conditional: "warning",
			preset: "info",
			failed: "danger"
		};
		/** Enablement tag for the states that depart from the default; a plainly enabled row carries none. */
		function StateTag({ kind, label }) {
			return kind === "enabled" ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
				tone: TAG_TONES[kind],
				children: label
			});
		}
		/** Render the read-only plugin inventory: agent presets first, then the global plane. */
		function PluginInventorySettingsTab({ list, presetName, resolveText, t, useClientSync, retryClient }) {
			const clientSync = useClientSync((snapshot) => snapshot);
			const sectionId = (0, react.useId)();
			const [request, setRequest] = (0, react.useState)(0);
			const [query, setQuery] = (0, react.useState)("");
			const [expanded, setExpanded] = (0, react.useState)(null);
			const [chosenPreset, setChosenPreset] = (0, react.useState)(null);
			const [switcherOpen, setSwitcherOpen] = (0, react.useState)(false);
			const [presetOpen, setPresetOpen] = (0, react.useState)(null);
			const [globalOpen, setGlobalOpen] = (0, react.useState)(null);
			const [state, setState] = (0, react.useState)({ status: "loading" });
			(0, react.useEffect)(() => {
				let current = true;
				Promise.resolve().then(() => list()).then((snapshot) => {
					if (current) setState({
						status: "ready",
						snapshot
					});
				}, () => {
					if (current) setState({ status: "error" });
				});
				return () => {
					current = false;
				};
			}, [list, request]);
			const normalizedQuery = query.trim().toLocaleLowerCase();
			const searching = normalizedQuery.length > 0;
			const snapshot = state.status === "ready" ? state.snapshot : void 0;
			const presets = snapshot?.agentPresets ?? [];
			const selected = presets.find((preset) => preset.id === chosenPreset) ?? fallbackPreset(presets);
			/** Presets that actually enable a module, keyed by module name. */
			const enabledIn = (0, react.useMemo)(() => {
				const found = /* @__PURE__ */ new Map();
				for (const preset of presets) for (const row of preset.rows) {
					if (row.enabled !== true) continue;
					const groups = found.get(row.moduleName);
					if (groups === void 0) found.set(row.moduleName, [preset]);
					else if (!groups.includes(preset)) groups.push(preset);
				}
				return found;
			}, [presets]);
			const entries = snapshot?.entries ?? [];
			const failedEntries = [];
			const regularEntries = [];
			for (const entry of entries) if (entry.fiberPhase === "failed") failedEntries.push(entry);
			else regularEntries.push(entry);
			const entryMatch = (entry) => matches(entry, normalizedQuery, resolveText);
			const rowMatch = (row) => matches(row, normalizedQuery, resolveText);
			const filteredFailed = failedEntries.filter(entryMatch);
			const filteredRegular = regularEntries.filter(entryMatch);
			const globalCount = filteredFailed.length + filteredRegular.length;
			const selectedRows = selected === void 0 ? [] : selected.rows.filter(rowMatch);
			const otherPresetMatches = searching ? presets.filter((preset) => preset !== selected && preset.rows.some(rowMatch)) : [];
			const otherMatchCount = otherPresetMatches.reduce((total, preset) => total + preset.rows.filter(rowMatch).length, 0);
			const presetEffectiveOpen = searching || (presetOpen ?? true);
			const globalEffectiveOpen = searching || (globalOpen ?? false);
			const nothingMatches = searching && globalCount === 0 && selectedRows.length === 0 && otherPresetMatches.length === 0;
			const retry = () => {
				setState({ status: "loading" });
				setRequest((value) => value + 1);
			};
			const toggleRow = (key) => {
				setExpanded((current) => current === key ? null : key);
			};
			/** Trailing status and detail facts for one row of the selected preset. */
			const presetRowCard = (preset, row, index) => {
				const key = `preset:${preset.id}:${String(index)}`;
				const { title, description } = pluginText(row, resolveText);
				const failed = row.fiberPhase === "failed";
				const stateText = failed ? t("failedTag") : row.enabled === true ? t("enabledTag") : row.enabled === false ? t("disabledTag") : t("conditionalTag");
				const kind = failed ? "failed" : row.enabled === true ? "enabled" : row.enabled === false ? "disabled" : "conditional";
				return (0, react_jsx_runtime.jsx)(PluginCard, {
					rowKey: key,
					moduleName: row.moduleName,
					title,
					description,
					metadataError: row.meta?.error === void 0 ? void 0 : t("metadataError", { error: row.meta.error }),
					entryId: row.entryId,
					failed,
					expanded,
					onToggle: toggleRow,
					ariaLabel: cardLabel(title, row.entryId, stateText),
					trailing: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [row.enabled === true && showsPhaseDot(row.fiberPhase) ? (0, react_jsx_runtime.jsx)(PhaseDot, {
						phase: row.fiberPhase,
						t
					}) : null, (0, react_jsx_runtime.jsx)(StateTag, {
						kind,
						label: stateText
					})] }),
					children: (0, react_jsx_runtime.jsx)(CardFacts, {
						moduleName: row.moduleName,
						moduleLabel: t("moduleLabel"),
						entryId: row.entryId,
						facts: [
							[t("fromPreset"), presetName(preset)],
							[t("configuration"), stateText],
							...row.fiberPhase === null ? [] : [[t("runtime"), phaseLabel(row.fiberPhase, t)]],
							...row.condition === void 0 ? [] : [[t("condition"), (0, react_jsx_runtime.jsx)("code", { children: row.condition }, "condition")]]
						]
					})
				}, key);
			};
			/** One global-plane row; a preset-provided row carries the presets that enable it. */
			const globalRowCard = (entry, providers) => {
				const key = `global:${entry.entryId}`;
				const { title, description } = pluginText(entry, resolveText);
				const failed = entry.fiberPhase === "failed";
				const stateText = failed ? t("failedTag") : providers !== void 0 ? t("presetEnabledTag") : t(entry.enabled ? "enabledTag" : "disabledTag");
				const kind = failed ? "failed" : providers !== void 0 ? "preset" : entry.enabled ? "enabled" : "disabled";
				return (0, react_jsx_runtime.jsx)(PluginCard, {
					rowKey: key,
					moduleName: entry.moduleName,
					title,
					description,
					metadataError: entry.meta?.error === void 0 ? void 0 : t("metadataError", { error: entry.meta.error }),
					entryId: entry.entryId,
					failed,
					expanded,
export {};
