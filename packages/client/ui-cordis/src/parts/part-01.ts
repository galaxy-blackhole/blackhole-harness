/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-cordis",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let react = require("react");
		//#region lib/types/client/card-model.js
		/** Replay-stable view models for Cordis lifecycle Tool calls. */
		function firstLine(text) {
			const newline = text.indexOf("\n");
			return newline === -1 ? text : text.slice(0, newline);
		}
		function stringAt(source, key) {
			const value = source[key];
			return typeof value === "string" && value !== "" ? value : null;
		}
		function objectAt(source, key) {
			const value = source[key];
			return typeof value === "object" && value !== null ? value : null;
		}
		function parseArgs(argsRaw) {
			try {
				const parsed = JSON.parse(argsRaw);
				return typeof parsed === "object" && parsed !== null ? parsed : null;
			} catch {
				return null;
			}
		}
		function resultText(block) {
			const text = block.content.map((item) => item.type === "text" ? item.text : JSON.stringify(item, null, 2)).join("\n");
			if (text !== "") return text;
			return block.error === void 0 ? null : `${block.error.name}: ${block.error.code}`;
		}
		function stateOf(block) {
			if (!("kind" in block)) return "running";
			if (block.error?.code === "interrupted") return "stopped";
			return block.isError ? "error" : "ok";
		}
		function metaObject(block) {
			if (!("kind" in block) || block.isError || typeof block.meta !== "object" || block.meta === null) return null;
			return block.meta;
		}
		/**
		* Derive one Define card from its frozen call/result slice.
		* @param block - active or settled tool-call block.
		* @returns normalized Define card fields.
		*/
		function cordisDefineCard(block) {
			const settled = "kind" in block;
			const argsRaw = (settled ? block.call?.argsRaw : block.argsRaw) ?? "";
			const args = parseArgs(argsRaw);
			const code = args === null ? null : objectAt(args, "code");
			const state = stateOf(block);
			const output = settled ? resultText(block) : null;
			const meta = metaObject(block);
			const rawName = argsRaw === "" ? null : firstLine(argsRaw);
			return {
				pluginId: meta === null ? null : stringAt(meta, "pluginId"),
				packageId: meta === null ? null : stringAt(meta, "packageId"),
				name: args === null ? rawName : stringAt(args, "name") ?? rawName,
				purpose: args === null ? null : stringAt(args, "purpose"),
				hostCode: code === null ? null : stringAt(code, "host"),
				clientCode: code === null ? null : stringAt(code, "client"),
				output,
				errorSummary: state === "error" && output !== null ? firstLine(output) : null,
				state
			};
		}
		/**
		* Derive one Run card and its successful activation metadata.
		* @param block - active or settled tool-call block.
		* @returns normalized Run card fields.
		*/
		function cordisRunCard(block) {
			const settled = "kind" in block;
			const args = parseArgs((settled ? block.call?.argsRaw : block.argsRaw) ?? "");
			const meta = metaObject(block);
			const state = stateOf(block);
			const output = settled ? resultText(block) : null;
			const rawMode = args === null ? null : stringAt(args, "mode");
			const argsPluginId = args === null ? null : stringAt(args, "pluginId");
			const argsPackageId = args === null ? null : stringAt(args, "packageId");
			return {
				pluginId: meta === null ? argsPluginId : stringAt(meta, "pluginId") ?? argsPluginId,
				packageId: meta === null ? argsPackageId : stringAt(meta, "packageId") ?? argsPackageId,
				pluginRunId: meta === null ? null : stringAt(meta, "pluginRunId"),
				mode: rawMode === "run" || rawMode === "update" ? rawMode : null,
				seq: settled ? block.seq : null,
				output,
				errorSummary: state === "error" && output !== null ? firstLine(output) : null,
				state
			};
		}
		/**
		* Derive one Stop or Remove card from its frozen call/result slice.
		* @param block - active or settled tool-call block.
		* @returns normalized lifecycle-action card fields.
		*/
		function cordisActionCard(block) {
			const settled = "kind" in block;
			const args = parseArgs((settled ? block.call?.argsRaw : block.argsRaw) ?? "");
			const state = stateOf(block);
			const output = settled ? resultText(block) : null;
			return {
				pluginId: args === null ? null : stringAt(args, "pluginId") ?? stringAt(args, "id"),
				output,
				errorSummary: state === "error" && output !== null ? firstLine(output) : null,
				state
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/extensions/ui-cordis/src/client/CordisRunRow.module.css.mjs
		const css$2 = ".cvtE3a_card{flex-direction:column;gap:8px;display:flex}.cvtE3a_row{align-items:center;min-height:32px;display:flex}.cvtE3a_icon{color:var(--dsw-alias-state-business-primary);flex:none;margin-right:8px;display:inline-flex}.cvtE3a_title{color:var(--dsw-alias-state-business-primary);flex:none;font-size:14px;font-weight:500;line-height:24px}.cvtE3a_separator{corner-shape:round;background:var(--dsw-alias-state-business-primary);border-radius:50%;flex:none;width:2px;height:2px;margin:0 8px}.cvtE3a_summary,.cvtE3a_error{min-width:0;color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:13px;line-height:24px;overflow:hidden}.cvtE3a_error{color:var(--dsw-alias-state-error-primary)}.cvtE3a_status{color:var(--dsw-alias-label-caption);flex:none;margin-left:8px;font-size:12px;line-height:24px}.cvtE3a_card[data-cordis-status=awaiting-approval] .cvtE3a_status,.cvtE3a_card[data-cordis-status=client-pending] .cvtE3a_status{color:var(--dsw-alias-state-warn-label)}.cvtE3a_card[data-cordis-status=running] .cvtE3a_status{color:var(--dsw-alias-state-success-primary)}.cvtE3a_card[data-cordis-status=failed] .cvtE3a_status{color:var(--dsw-alias-state-error-primary)}.cvtE3a_inspect{corner-shape:round;width:24px;height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;opacity:0;background:0 0;border:none;border-radius:999px;justify-content:center;align-items:center;margin-left:4px;padding:0;display:inline-flex}.cvtE3a_card:hover .cvtE3a_inspect,.cvtE3a_inspect:focus-visible{opacity:1}.cvtE3a_inspect:hover{background:var(--dsw-alias-interactive-bg-hover)}.cvtE3a_message{background:var(--dsw-alias-button-ghost-active-fill);color:var(--dsw-alias-label-tertiary);border-radius:8px;padding:8px 12px;font-size:12px;line-height:18px}.cvtE3a_business{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-base);border-radius:12px;min-width:0;overflow:hidden}.cvtE3a_output{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-markdown-code-block-small);white-space:pre-wrap;overflow-wrap:anywhere;border-radius:8px;margin:0;padding:10px 12px;overflow:auto}.cvtE3a_business .cvtE3a_output{border:none;border-radius:0}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-cordis/CordisRunRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-cordis";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var CordisRunRow_module_css_default = {
			"business": "cvtE3a_business",
			"card": "cvtE3a_card",
			"error": "cvtE3a_error",
			"icon": "cvtE3a_icon",
			"inspect": "cvtE3a_inspect",
			"message": "cvtE3a_message",
			"output": "cvtE3a_output",
			"row": "cvtE3a_row",
			"separator": "cvtE3a_separator",
			"status": "cvtE3a_status",
			"summary": "cvtE3a_summary",
			"title": "cvtE3a_title"
		};
		//#endregion
		//#region lib/types/client/CordisPreparingRow.js
		/* v8 ignore next -- Non-expandable rows never invoke DisclosureRow's required toggle callback. */
		const noop = () => void 0;
		/**
		* Render a Cordis-owned prefix without disclosure.
		* @param props - Cordis prefix, styling, and locale.
		* @returns the preparation row.
		*/
		function CordisPreparingRow({ toolName, t, icon, title, className, rowClassName, titleClassName }) {
			return (0, react_jsx_runtime.jsx)("div", {
				"data-tool": toolName,
				"data-state": "preparing",
				"aria-label": t("a11y.preparing"),
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					icon,
					title,
					className,
					rowClassName,
					titleClassName,
					open: false,
					expandable: false,
					onToggle: noop,
					running: true
				})
			});
		}
		//#endregion
		//#region lib/types/client/CordisActionRow.js
		/** Localized cards for `cordis_stop` and `cordis_undefine`. */
		/** Render one Stop or Remove call with Cordis-owned localized copy. */
		function CordisActionRow(props) {
			if (props.phase === "preparing") {
				const remove = props.toolName === "cordis_undefine";
				return (0, react_jsx_runtime.jsx)(CordisPreparingRow, {
					...props,
					icon: remove ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconStopFillRegular, { size: 14 }),
					title: props.t(remove ? "row.removeTitle" : "row.stopTitle"),
					className: CordisRunRow_module_css_default.card,
					rowClassName: CordisRunRow_module_css_default.row,
					titleClassName: CordisRunRow_module_css_default.title
				});
			}
			return (0, react_jsx_runtime.jsx)(StartedCordisActionRow, { ...props });
		}
		function StartedCordisActionRow({ callId, toolName, block, inspect, t }) {
			const card = cordisActionCard(block);
			const remove = toolName === "cordis_undefine";
			const summary = card.errorSummary ?? card.pluginId ?? callId;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: CordisRunRow_module_css_default.card,
				"data-tool": toolName,
				"data-state": card.state,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: CordisRunRow_module_css_default.row,
					children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: CordisRunRow_module_css_default.icon,
							children: remove ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconStopFillRegular, { size: 14 })
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: CordisRunRow_module_css_default.title,
							children: t(remove ? "row.removeTitle" : "row.stopTitle")
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: CordisRunRow_module_css_default.separator,
							"aria-hidden": true
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: card.errorSummary === null ? CordisRunRow_module_css_default.summary : CordisRunRow_module_css_default.error,
							children: summary
						}),
						inspect !== void 0 && (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: CordisRunRow_module_css_default.inspect,
							"aria-label": t("action.inspect"),
							onClick: inspect,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconInspectOutlineRegular, {})
						})
					]
				}), card.output !== null && (0, react_jsx_runtime.jsx)("pre", {
					className: CordisRunRow_module_css_default.output,
					children: card.output
				})]
			});
		}
		//#endregion
		//#region lib/types/client/status.js
		/** Shared status derivation over Host inventory and this page's Client live set. */
		/**
		* Locate one immutable Package inside a Plugin row.
		* @param row - owning Plugin inventory row.
		* @param packageId - immutable Package identity to locate.
		* @returns the matching Package metadata, or `undefined` when absent.
		*/
		function packageOf(row, packageId) {
			return row.packages.find((pkg) => pkg.packageId === packageId);
		}
		/**
		* Derive the visible state of one Package.
		* @param row - owning Plugin inventory row.
		* @param packageId - Package being described.
		* @param loaded - Client activations loaded in this page.
		* @returns idle, Host-running/Client-pending, or fully running.
		*/
		function cordisVisibleStatus(row, packageId, loaded) {
			const run = row.activeRun;
			if (run === void 0 || run.packageId !== packageId) return "idle";
			if (packageOf(row, packageId)?.hasClientHalf !== true) return "running";
			return loaded.some((live) => live.pluginId === row.pluginId && live.packageId === packageId && live.pluginRunId === run.pluginRunId) ? "running" : "client-pending";
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/extensions/ui-cordis/src/client/CordisDefineRow.module.css.mjs
		const css$1 = ".gNWCoW_card{flex-direction:column;display:flex}.gNWCoW_card .gNWCoW_title,.gNWCoW_card .gNWCoW_chevron{color:var(--dsw-alias-state-business-primary)}.gNWCoW_title{flex:none;font-size:14px;font-weight:500;line-height:24px}.gNWCoW_row{gap:0}.gNWCoW_separator{background:var(--dsw-alias-state-business-primary);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.gNWCoW_name{text-overflow:ellipsis;white-space:nowrap;max-width:40%;color:var(--dsw-alias-label-secondary);flex:none;font-size:14px;line-height:24px;overflow:hidden}.gNWCoW_purpose{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-tertiary);flex:auto;margin-left:8px;font-size:13px;line-height:24px;overflow:hidden}.gNWCoW_errorSummary{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-state-error-primary);flex:auto;font-size:14px;line-height:24px;overflow:hidden}.gNWCoW_requestError{text-overflow:ellipsis;white-space:nowrap;max-width:40%;color:var(--dsw-alias-state-error-primary);flex:none;margin-left:8px;font-size:12px;line-height:24px;overflow:hidden}.gNWCoW_readout{flex:none;align-items:center;margin-left:8px;display:inline-flex}.gNWCoW_panelHint{color:var(--dsw-alias-label-caption);margin:4px 0 2px 4px;font-size:11px;line-height:16px}.gNWCoW_statusLabel{color:var(--dsw-alias-label-caption);font-size:12px;line-height:24px}.gNWCoW_approvalPrompt{text-overflow:ellipsis;white-space:nowrap;max-width:40%;color:var(--dsw-alias-label-secondary);flex:none;margin-left:8px;font-size:12px;line-height:24px;overflow:hidden}.gNWCoW_notice{text-overflow:ellipsis;white-space:nowrap;max-width:40%;color:var(--dsw-alias-label-caption);flex:none;margin-left:8px;font-size:12px;line-height:24px;overflow:hidden}.gNWCoW_switch{height:22px;padding:0 8px;font-size:12px}.gNWCoW_card[data-terminal] .gNWCoW_title,.gNWCoW_card[data-terminal] .gNWCoW_name,.gNWCoW_card[data-terminal] .gNWCoW_purpose,.gNWCoW_card[data-terminal] .gNWCoW_statusLabel{color:var(--dsw-alias-label-caption)}.gNWCoW_card[data-terminal] .gNWCoW_separator{background:var(--dsw-alias-label-caption)}.gNWCoW_bodyWrap{flex-direction:column;display:flex}.gNWCoW_sourceCard{flex-direction:column;margin:4px 0 4px 4px;display:flex}.gNWCoW_sourceTabs{border-bottom:.5px solid var(--dsw-alias-border-l2);height:32px;display:flex}.gNWCoW_sourceTab{color:var(--dsw-alias-label-tertiary);cursor:pointer;font:var(--dsw-font-xs-13);background:0 0;border:0;padding:0 10px;position:relative}.gNWCoW_sourceTab:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.gNWCoW_sourceTab:disabled{cursor:default;opacity:.4}.gNWCoW_sourceTabActive{color:var(--dsw-alias-state-business-primary)}.gNWCoW_sourceTabActive:after{background:var(--dsw-alias-state-business-primary);content:\"\";border-radius:1px 1px 0 0;height:2px;position:absolute;bottom:0;left:10px;right:10px}.gNWCoW_sourceTab:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary);outline-offset:-1px}.gNWCoW_sourcePanel{max-height:260px;overflow:auto}.gNWCoW_sourceCode{margin:0}.gNWCoW_codeSection{flex-direction:column;max-height:260px;margin:4px 0 4px 4px;display:flex;overflow:auto}.gNWCoW_sectionLabel{color:var(--dsw-alias-label-caption);text-transform:uppercase;letter-spacing:.04em;flex:none;padding:2px 0;font-size:11px;font-weight:500;line-height:16px}.gNWCoW_output{border:.5px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-markdown-code-block);white-space:pre-wrap;overflow-wrap:anywhere;font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-secondary);border-radius:8px;margin:0;padding:8px 10px}.gNWCoW_output[data-error]{color:var(--dsw-alias-state-error-primary)}.gNWCoW_inspectButton{border:.5px solid var(--dsw-alias-border-l4);corner-shape:round;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;border-radius:999px;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;font-size:11px;line-height:16px;transition:opacity .1s;display:inline-flex}.gNWCoW_card:hover .gNWCoW_inspectButton,.gNWCoW_inspectButton:focus-visible{opacity:1}.gNWCoW_inspectButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}.gNWCoW_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}@media (prefers-reduced-motion:reduce){.gNWCoW_inspectButton{transition:none}}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-cordis/CordisDefineRow.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-cordis";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var CordisDefineRow_module_css_default = {
			"approvalPrompt": "gNWCoW_approvalPrompt",
			"bodyWrap": "gNWCoW_bodyWrap",
			"card": "gNWCoW_card",
			"chevron": "gNWCoW_chevron",
			"codeSection": "gNWCoW_codeSection",
			"errorSummary": "gNWCoW_errorSummary",
			"inspectButton": "gNWCoW_inspectButton",
			"name": "gNWCoW_name",
			"notice": "gNWCoW_notice",
			"output": "gNWCoW_output",
			"panelHint": "gNWCoW_panelHint",
			"purpose": "gNWCoW_purpose",
			"readout": "gNWCoW_readout",
			"requestError": "gNWCoW_requestError",
			"row": "gNWCoW_row",
			"sectionLabel": "gNWCoW_sectionLabel",
			"separator": "gNWCoW_separator",
			"sourceCard": "gNWCoW_sourceCard",
			"sourceCode": "gNWCoW_sourceCode",
			"sourcePanel": "gNWCoW_sourcePanel",
			"sourceTab": "gNWCoW_sourceTab",
			"sourceTabActive": "gNWCoW_sourceTabActive",
			"sourceTabs": "gNWCoW_sourceTabs",
			"statusLabel": "gNWCoW_statusLabel",
			"switch": "gNWCoW_switch",
			"title": "gNWCoW_title",
			"visuallyHidden": "gNWCoW_visuallyHidden"
		};
		//#endregion
		//#region lib/types/client/CordisDefineRow.js
		/** Read-only `cordis_define` card with Host and Client source tabs. */
		const READING_LABELS$1 = {
			idle: "status.idle",
			"client-pending": "status.clientPending",
			running: "status.running",
			removed: "status.removed"
		};
		function stateStatus(state) {
			switch (state) {
				case "running": return "a11y.defining";
				case "error": return "a11y.failed";
				case "stopped": return "a11y.stopped";
				default: return null;
			}
		}
		/** Render one immutable Package definition. */
		function CordisDefineRow(props) {
			if (props.phase === "preparing") return (0, react_jsx_runtime.jsx)(CordisPreparingRow, {
				...props,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 14 }),
				title: props.t("row.defineTitle"),
				className: CordisDefineRow_module_css_default.card,
				rowClassName: CordisDefineRow_module_css_default.row,
				titleClassName: CordisDefineRow_module_css_default.title
			});
			return (0, react_jsx_runtime.jsx)(StartedCordisDefineRow, { ...props });
		}
		function StartedCordisDefineRow({ callId, block, inspect, useInventory, useLoaded, t }) {
			const card = cordisDefineCard(block);
			const inventory = useInventory((snapshot) => snapshot);
			const loaded = useLoaded((snapshot) => snapshot);
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [selectedSource, setSelectedSource] = (0, react.useState)(card.clientCode !== null ? "client" : "host");
			const sourcePanelId = (0, react.useId)();
			const row = card.pluginId === null ? void 0 : inventory.rows.find((candidate) => candidate.pluginId === card.pluginId);
			const reading = card.pluginId !== null && inventory.removed.has(card.pluginId) ? "removed" : row !== void 0 && card.packageId !== null ? cordisVisibleStatus(row, card.packageId, loaded) : "idle";
			const name = card.name ?? callId;
			const expandable = card.hostCode !== null || card.clientCode !== null || card.output !== null;
			const open = expanded && expandable;
			const a11yState = stateStatus(card.state);
			const hasSource = card.clientCode !== null || card.hostCode !== null;
			const activeSource = selectedSource === "client" && card.clientCode !== null ? "client" : selectedSource === "host" && card.hostCode !== null ? "host" : card.clientCode !== null ? "client" : "host";
			const activeCode = activeSource === "client" ? card.clientCode : card.hostCode;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: CordisDefineRow_module_css_default.card,
				"data-tool": "cordis_define",
				"data-state": card.state,
				"data-terminal": reading === "removed" || void 0,
				"data-cordis-plugin-id": card.pluginId ?? void 0,
				"data-cordis-package-id": card.packageId ?? void 0,
				"data-cordis-status": reading,
				children: [a11yState !== null && (0, react_jsx_runtime.jsx)("span", {
					className: CordisDefineRow_module_css_default.visuallyHidden,
					children: t(a11yState)
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.DisclosureRow, {
					rowClassName: CordisDefineRow_module_css_default.row,
					titleClassName: CordisDefineRow_module_css_default.title,
					chevronClassName: CordisDefineRow_module_css_default.chevron,
					icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCodeOutlineRegular, { size: 14 }),
					title: t("row.defineTitle"),
					open,
					expandable,
					expandOnRowClick: true,
					keepContentWhenOpen: true,
					onToggle: () => {
						setExpanded((value) => !value);
					},
					collapsedContent: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						(0, react_jsx_runtime.jsx)("span", {
							className: CordisDefineRow_module_css_default.separator,
							"aria-hidden": true
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: card.errorSummary === null ? CordisDefineRow_module_css_default.name : CordisDefineRow_module_css_default.errorSummary,
							children: card.errorSummary ?? name
						}),
						card.errorSummary === null && (0, react_jsx_runtime.jsx)("span", {
							className: CordisDefineRow_module_css_default.purpose,
							children: card.purpose ?? t("purpose.missing")
						}),
						card.pluginId !== null && (0, react_jsx_runtime.jsx)("span", {
							className: CordisDefineRow_module_css_default.readout,
							children: (0, react_jsx_runtime.jsx)("span", {
								className: CordisDefineRow_module_css_default.statusLabel,
								children: t(READING_LABELS$1[reading])
							})
						})
					] }),
					children: (0, react_jsx_runtime.jsxs)("div", {
						className: CordisDefineRow_module_css_default.bodyWrap,
						children: [
							hasSource && activeCode !== null && (0, react_jsx_runtime.jsxs)("section", {
								className: CordisDefineRow_module_css_default.sourceCard,
								children: [(0, react_jsx_runtime.jsx)("div", {
									className: CordisDefineRow_module_css_default.sourceTabs,
									role: "tablist",
									"aria-label": t("body.source"),
									children: ["client", "host"].map((source) => {
										const available = source === "client" ? card.clientCode !== null : card.hostCode !== null;
										return (0, react_jsx_runtime.jsx)("button", {
											id: `${sourcePanelId}-${source}`,
											type: "button",
											role: "tab",
											"aria-controls": sourcePanelId,
											"aria-selected": activeSource === source,
											className: activeSource === source ? `${CordisDefineRow_module_css_default.sourceTab} ${CordisDefineRow_module_css_default.sourceTabActive}` : CordisDefineRow_module_css_default.sourceTab,
											disabled: !available,
											onClick: () => {
												setSelectedSource(source);
export {};
