/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		}
		/**
		* Product copy for a host attachment rejection (the `details.reason` of
		* `session/attachment-invalid` or `subagent/attachment-invalid`).
		* User-solvable reasons name the limit and the way out;
		* reasons the user cannot act on fold into one send-failed line carrying the
		* reason code for a bug report.
		* @param t - the conversation-namespace translate.
		* @param reason - the wire `details.reason` code.
		* @param limits - projected limits interpolated into count/size copy, when known.
		* @returns the banner text.
		*/
		function attachmentErrorText(t, reason, limits) {
			switch (reason) {
				case "MODEL_DOES_NOT_SUPPORT_IMAGES": return t("image.modelUnsupported");
				case "FILE_NOT_STAGED": return t("file.notStaged");
				case "IMAGE_TOO_MANY_PIXELS": return t("image.tooManyPixels");
				case "IMAGE_DIMENSION_TOO_LARGE":
					if (limits !== void 0) return t("image.dimensionTooLarge", { size: limits.maxImageDimension });
					break;
				case "INVALID_IMAGE":
				case "IMAGE_TYPE_MISMATCH": return t("image.unsupportedType");
				case "TOO_MANY_IMAGES":
					if (limits !== void 0) return t("image.tooMany", { count: limits.maxImagesPerMessage });
					break;
				case "IMAGE_TOO_LARGE":
					if (limits !== void 0) return t("image.fileTooLarge", { size: imageSizeText(limits.maxImageBytes) });
					break;
				case "IMAGES_TOO_LARGE":
					if (limits !== void 0) return t("image.totalTooLarge", { size: imageSizeText(limits.maxMessageImageBytes) });
					break;
				default: break;
			}
			return t("image.sendFailed", { reason });
		}
		//#endregion
		//#region lib/types/client/context-occupancy.js
		/**
		* Resolve bounded display occupancy from independently updated pressure fields.
		* @param pressure - latest token-meter projection.
		* @returns occupancy, or null until numerator and capacity are known.
		*/
		function contextOccupancy(pressure) {
			const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens;
			if (usedTokens === void 0 || pressure?.contextWindow === void 0) return null;
			return {
				percent: Math.min(100, Math.round(usedTokens / pressure.contextWindow * 100)),
				usedTokens,
				contextWindow: pressure.contextWindow
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/ContextMeter.module.css.mjs
		const css$2 = ".JObwrW_root{flex:none;display:inline-flex}.JObwrW_trigger{border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);font-family:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-variant-numeric:tabular-nums;line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));white-space:nowrap;cursor:pointer;background:0 0;border:none;flex:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}.JObwrW_trigger:hover,.JObwrW_trigger[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.JObwrW_track{fill:none;stroke:var(--dsw-alias-border-l3);stroke-width:2px}.JObwrW_fill{fill:none;stroke:var(--dsw-alias-label-tertiary);stroke-width:2px;stroke-linecap:round}.JObwrW_panel{z-index:1100;box-sizing:border-box;border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);width:min(264px,100vw - 24px);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;padding:12px;font-size:12px;line-height:20px;position:fixed}.JObwrW_header{align-items:center;gap:6px;display:flex}.JObwrW_figures{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin-left:auto;font-weight:500}.JObwrW_percent{color:var(--dsw-alias-label-primary);font-weight:500}.JObwrW_headline{color:var(--dsw-alias-label-tertiary)}.JObwrW_headline:empty{display:none}.JObwrW_bar{corner-shape:round;background:var(--dsw-alias-interactive-bg-hover);border-radius:999px;gap:1px;height:4px;margin:10px 0 12px;display:flex;overflow:hidden}.JObwrW_segment{background:var(--meter-tint,var(--dsw-alias-label-tertiary));border-radius:1px;flex:none;min-width:2px;height:100%}.JObwrW_swatch{background:var(--meter-tint);vertical-align:baseline;border-radius:2px;width:8px;height:8px;margin-right:6px;display:inline-block}.JObwrW_colorSystem{--meter-tint:var(--dsw-static-neutral-bluish-400)}.JObwrW_colorTools{--meter-tint:#a78bfa}.JObwrW_colorMessages{--meter-tint:var(--dsw-static-blue-450)}.JObwrW_rows{margin:6px 0 0}.JObwrW_row{justify-content:space-between;align-items:center;gap:12px;padding:2px 0;display:flex}.JObwrW_row dt{color:var(--dsw-alias-label-secondary)}.JObwrW_row dd{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);margin:0}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-conversation/ContextMeter.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var ContextMeter_module_css_default = {
			"bar": "JObwrW_bar",
			"colorMessages": "JObwrW_colorMessages",
			"colorSystem": "JObwrW_colorSystem",
			"colorTools": "JObwrW_colorTools",
			"figures": "JObwrW_figures",
			"fill": "JObwrW_fill",
			"header": "JObwrW_header",
			"headline": "JObwrW_headline",
			"panel": "JObwrW_panel",
			"percent": "JObwrW_percent",
			"root": "JObwrW_root",
			"row": "JObwrW_row",
			"rows": "JObwrW_rows",
			"segment": "JObwrW_segment",
			"swatch": "JObwrW_swatch",
			"track": "JObwrW_track",
			"trigger": "JObwrW_trigger"
		};
		//#endregion
		//#region lib/types/client/skeleton/ContextMeter.js
		/** Composer context-occupancy meter: a ring and percentage below the card fed by the
		* `contextPressure` projection, with a click-open panel of the heuristic
		* `contextBreakdown` composition (system prompt, tools, conversation).
		* Renders nothing until a provider reports both pressure and a route
		* capacity. */
		/** Ring geometry: 14px viewBox, 2px stroke. */
		const RADIUS = 5.5;
		const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
		/**
		* Marker the localized occupancy sentence is split on, so the panel headline
		* keeps the reading in its own tone while each locale still owns the word
		* order (`45% of context used` / `上下文已用 45%`).
		*/
		const READING_SLOT = "\0";
		/** Panel legend rows, in bar-segment order; each color class carries the shared swatch/segment tint. */
		const ROWS = [
			{
				key: "systemTokens",
				label: "context.system",
				color: ContextMeter_module_css_default.colorSystem
			},
			{
				key: "toolsTokens",
				label: "context.tools",
				color: ContextMeter_module_css_default.colorTools
			},
			{
				key: "messageTokens",
				label: "context.messages",
				color: ContextMeter_module_css_default.colorMessages
			}
		];
		/**
		* Format a token count for the compact context panel.
		* @param value - token count.
		* @param t - Conversation locale seat with shared compact-number templates.
		* @returns Compact localized count using K or M when needed.
		*/
		function formatTokens(value, t) {
			const scaled = (candidate) => candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10);
			if (value < 1e3) return String(value);
			if (value < 1e6) return t("number.thousand", { value: scaled(value / 1e3) });
			return t("number.million", { value: scaled(value / 1e6) });
		}
		function ContextMeter({ useProjection, t }) {
			const pressure = useProjection("contextPressure");
			const breakdown = useProjection("contextBreakdown");
			const [open, setOpen] = (0, react.useState)(false);
			const rootRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const context = contextOccupancy(pressure);
			const available = context !== null;
			const position = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open: open && available,
				anchorRef: rootRef,
				panelRef,
				side: "top",
				gap: 8,
				margin: 12
			});
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open && available, setOpen, panelRef);
			(0, react.useEffect)(() => {
				if (!available && open) setOpen(false);
			}, [available, open]);
			(0, react.useEffect)(() => {
				if (!open || !available) return;
				const onKeyDown = (e) => {
					if (e.key === "Escape") setOpen(false);
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [available, open]);
			if (context === null) return null;
			const percent = context.percent;
			const reading = `${percent}%`;
			const [headBefore = "", headAfter = ""] = t("context.aria", { percent: READING_SLOT }).split(READING_SLOT).map((part) => part.trim());
			const breakdownTotal = breakdown === void 0 ? 0 : breakdown.systemTokens + breakdown.toolsTokens + breakdown.messageTokens;
			const segments = (breakdown === void 0 || breakdownTotal === 0 ? [{
				key: "total",
				color: void 0,
				width: percent
			}] : ROWS.map((row) => ({
				key: row.key,
				color: row.color,
				width: percent * breakdown[row.key] / breakdownTotal
			}))).filter((part) => part.width > 0);
			return (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: ContextMeter_module_css_default.root,
				children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: t("context.aria", { percent: reading }),
					side: "top",
					delayMs: 200,
					disabled: open,
					children: (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: ContextMeter_module_css_default.trigger,
						"aria-label": t("context.aria", { percent: reading }),
						"aria-haspopup": "dialog",
						"aria-expanded": open,
						onClick: () => {
							setOpen(!open);
						},
						children: [(0, react_jsx_runtime.jsxs)("svg", {
							viewBox: "0 0 14 14",
							width: "14",
							height: "14",
							"aria-hidden": true,
							children: [(0, react_jsx_runtime.jsx)("circle", {
								className: ContextMeter_module_css_default.track,
								cx: "7",
								cy: "7",
								r: RADIUS
							}), (0, react_jsx_runtime.jsx)("circle", {
								className: ContextMeter_module_css_default.fill,
								cx: "7",
								cy: "7",
								r: RADIUS,
								strokeDasharray: `${CIRCUMFERENCE * percent / 100} ${CIRCUMFERENCE}`,
								transform: "rotate(-90 7 7)"
							})]
						}), (0, react_jsx_runtime.jsx)("span", { children: reading })]
					})
				}), open && (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: ContextMeter_module_css_default.panel,
					style: position ?? {
						visibility: "hidden",
						left: 0,
						top: 0
					},
					role: "dialog",
					"aria-label": t("context.used"),
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: ContextMeter_module_css_default.header,
							children: [
								(0, react_jsx_runtime.jsx)("span", {
									className: ContextMeter_module_css_default.headline,
									children: headBefore
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: ContextMeter_module_css_default.percent,
									children: reading
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: ContextMeter_module_css_default.headline,
									children: headAfter
								}),
								(0, react_jsx_runtime.jsx)("span", {
									className: ContextMeter_module_css_default.figures,
									children: `~${formatTokens(context.usedTokens, t)} / ${formatTokens(context.contextWindow, t)}`
								})
							]
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: ContextMeter_module_css_default.bar,
							children: segments.map((segment) => (0, react_jsx_runtime.jsx)("div", {
								className: segment.color === void 0 ? ContextMeter_module_css_default.segment : `${ContextMeter_module_css_default.segment} ${segment.color}`,
								style: { width: `${segment.width}%` }
							}, segment.key))
						}),
						breakdown !== void 0 && (0, react_jsx_runtime.jsx)("dl", {
							className: ContextMeter_module_css_default.rows,
							children: ROWS.map((row) => (0, react_jsx_runtime.jsxs)("div", {
								className: ContextMeter_module_css_default.row,
								children: [(0, react_jsx_runtime.jsxs)("dt", { children: [(0, react_jsx_runtime.jsx)("span", {
									className: `${ContextMeter_module_css_default.swatch} ${row.color}`,
									"aria-hidden": true
								}), t(row.label)] }), (0, react_jsx_runtime.jsx)("dd", { children: `~${formatTokens(breakdown[row.key], t)}` })]
							}, row.key))
						})
					]
				}), document.body)]
			});
		}
		//#endregion
		//#region lib/types/client/skeleton/control-row-layout.js
		/** Content-sized model collapse for the composer's two control groups. */
		/**
		* Collapse the model text only when the expanded controls cannot share a line.
		* The model seat consumes the row's inherited display variables; wrapping remains
		* available when even the icon cannot fit. Each notification is measured synchronously.
		* @param row - Composer control row with its leading and trailing groups.
		* @returns Disconnect the layout observers and font listener.
		*/
		function observeControlRow(row) {
			const measure = () => {
				row.removeAttribute("data-model-compact");
				const style = getComputedStyle(row);
				const available = row.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
				const widths = Array.from(row.children, (child) => child.getBoundingClientRect().width).filter((width) => width > 0);
				const needed = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, widths.length - 1) * parseFloat(style.columnGap);
				row.toggleAttribute("data-model-compact", needed > available);
			};
			const resize = new ResizeObserver(measure);
			resize.observe(row);
			for (const child of row.children) resize.observe(child);
			const mutation = new MutationObserver(measure);
			mutation.observe(row, {
				subtree: true,
				childList: true,
				characterData: true,
				attributes: true,
				attributeFilter: ["hidden"]
			});
			const fonts = document.fonts;
			fonts.addEventListener("loadingdone", measure);
			measure();
			return () => {
				resize.disconnect();
				mutation.disconnect();
				fonts.removeEventListener("loadingdone", measure);
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/InputBar.module.css.mjs
		const css$1 = ".uV2eYG_root{padding:0 var(--dsh-composer-side-clearance) 4px;flex-direction:column;align-items:center;display:flex}.uV2eYG_dock{justify-content:center;align-items:center;gap:12px;max-width:100%;padding-top:4px;display:flex}.uV2eYG_hero .uV2eYG_dock:empty{display:none}.uV2eYG_hero{padding:0 var(--dsh-composer-side-clearance)}.uV2eYG_notice{width:100%;max-width:var(--dsh-composer-card-max-width);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary);margin-bottom:6px;padding:4px 8px;font-size:12px;line-height:18px}.uV2eYG_card{box-sizing:border-box;width:100%;max-width:var(--dsh-composer-card-max-width);--dsw-elevation-stroke-color:var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-panel);background:var(--dsw-specific-input-major);box-shadow:var(--dsw-elevation-soft);font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:0;flex-direction:column;gap:12px;padding-top:8px;display:flex;position:relative}.uV2eYG_cardWorkspaceTrigger{--dsw-elevation-stroke-color:transparent;cursor:pointer}.uV2eYG_cardWorkspaceTrigger:after{content:\"\";box-sizing:border-box;border-radius:var(--dsw-radius-panel);color:var(--dsw-alias-border-l4);pointer-events:none;border:1px dashed;transition:color .1s;position:absolute;inset:0}.uV2eYG_cardWorkspaceTrigger :disabled{pointer-events:none}.uV2eYG_cardWorkspaceTrigger:hover:after{color:var(--dsw-alias-state-business-primary)}.uV2eYG_accessory{align-items:center;gap:8px;padding:10px 12px 0;display:flex}.uV2eYG_overlayAnchor{height:0;position:absolute;inset:0 0 auto}.uV2eYG_scroll{max-height:var(--dsh-composer-text-max-height);margin-right:4px;overflow-y:auto}.uV2eYG_scroll::-webkit-scrollbar-track{margin-top:8px}.uV2eYG_grow{position:relative}.uV2eYG_pending{corner-shape:round;background:var(--dsw-alias-state-business-primary);border-radius:50%;width:8px;height:8px;animation:1s ease-in-out infinite alternate uV2eYG_input-pending}@keyframes uV2eYG_input-pending{0%{opacity:.35}to{opacity:1}}.uV2eYG_input{box-sizing:border-box;min-height:36px;font-family:var(--dsw-font-family);font-size:inherit;line-height:inherit;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);caret-color:var(--dsw-alias-state-business-primary);outline:none;padding:4px 8px 0 14px}.uV2eYG_input p{margin:0}.uV2eYG_input p:last-child:after{content:var(--dsh-composer-hint);color:var(--dsw-alias-label-caption)}.uV2eYG_input[data-composer-composing] p:last-child:after{content:none}.uV2eYG_input[data-composer-chip-selected]{caret-color:#0000}.uV2eYG_input[data-composer-composing]+.uV2eYG_placeholder{visibility:hidden}.uV2eYG_placeholder{color:var(--dsw-alias-label-caption);white-space:nowrap;text-overflow:ellipsis;pointer-events:none;user-select:none;position:absolute;inset:4px 8px auto 14px;overflow:hidden}.uV2eYG_inputDisabled{color:var(--dsw-alias-label-tertiary);cursor:not-allowed}.uV2eYG_input[aria-haspopup=menu]{cursor:pointer}.uV2eYG_hero .uV2eYG_input{min-height:52px}.uV2eYG_hero .uV2eYG_placeholder{white-space:normal;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical;display:-webkit-box}.uV2eYG_row{flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px;min-width:0;padding:2px 8px 6px;display:flex;container-type:inline-size}.uV2eYG_row[data-model-compact]{--dsh-composer-model-text-display:none;--dsh-composer-model-icon-display:block}.uV2eYG_tools,.uV2eYG_modes,.uV2eYG_trailing{align-items:center;min-width:0;display:flex}.uV2eYG_tools,.uV2eYG_modes{gap:12px}.uV2eYG_trailing{flex:none;gap:12px;margin-left:auto}@container (width<=560px){.uV2eYG_tools,.uV2eYG_modes,.uV2eYG_trailing{gap:8px}}.uV2eYG_add{corner-shape:round;background:var(--dsw-specific-selector);width:28px;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;display:grid}.uV2eYG_add:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.uV2eYG_add:disabled{opacity:.5;cursor:default}.uV2eYG_select{border-radius:var(--dsw-radius-sm);max-width:220px;height:28px;color:var(--dsw-alias-label-secondary);white-space:nowrap;cursor:pointer;appearance:none;background-color:#0000;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-position:right 4px center;background-repeat:no-repeat;background-size:12px 12px;border:none;outline:none;padding:0 20px 0 8px;font-size:13px;font-weight:500;line-height:20px}.uV2eYG_select:hover:not(:disabled){background-color:var(--dsw-alias-interactive-bg-hover)}.uV2eYG_select:disabled{opacity:.5;cursor:default}.uV2eYG_primary{corner-shape:round;background:var(--dsw-alias-button-info-fill);color:#fff;cursor:pointer;border:none;border-radius:999px;flex:none;place-items:center;width:34px;height:34px;transition:background-color .1s;display:grid;transform:translateY(-2px)}.uV2eYG_primary:hover:not(:disabled){background:var(--dsw-alias-button-info-hover)}.uV2eYG_primary:disabled{opacity:.4;cursor:default}.uV2eYG_retry{border-radius:var(--dsw-radius-sm);color:inherit;cursor:pointer;background:0 0;border:1px solid;margin-left:8px;padding:1px 8px;font-size:12px}.uV2eYG_standardControls{align-items:center;gap:12px;min-width:0;display:flex}.uV2eYG_tools[hidden],.uV2eYG_standardControls[hidden]{display:none}.uV2eYG_trailingActive{flex:1;margin-left:0}.uV2eYG_activity{flex:none;align-items:center;display:flex}.uV2eYG_activity:empty{display:none}.uV2eYG_activityExpanded{flex:1;min-width:0}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-conversation/InputBar.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var InputBar_module_css_default = {
			"accessory": "uV2eYG_accessory",
			"activity": "uV2eYG_activity",
			"activityExpanded": "uV2eYG_activityExpanded",
			"add": "uV2eYG_add",
			"card": "uV2eYG_card",
			"cardWorkspaceTrigger": "uV2eYG_cardWorkspaceTrigger",
			"dock": "uV2eYG_dock",
			"grow": "uV2eYG_grow",
			"hero": "uV2eYG_hero",
			"input": "uV2eYG_input",
			"input-pending": "uV2eYG_input-pending",
			"inputDisabled": "uV2eYG_inputDisabled",
			"modes": "uV2eYG_modes",
			"notice": "uV2eYG_notice",
			"overlayAnchor": "uV2eYG_overlayAnchor",
			"pending": "uV2eYG_pending",
			"placeholder": "uV2eYG_placeholder",
			"primary": "uV2eYG_primary",
			"retry": "uV2eYG_retry",
			"root": "uV2eYG_root",
			"row": "uV2eYG_row",
			"scroll": "uV2eYG_scroll",
			"select": "uV2eYG_select",
			"standardControls": "uV2eYG_standardControls",
			"tools": "uV2eYG_tools",
			"trailing": "uV2eYG_trailing",
			"trailingActive": "uV2eYG_trailingActive"
		};
		//#endregion
		//#region lib/types/client/skeleton/InputBar.js
		/** The default composer body: the 'conversation.composer.bar' slot entry.
		* Machine state arrives through the standard provide channel
		* (useInput + inputActions); the keyboard/DOM command face and stop arrive
		* through this entry's own inject, whose hooks compartment binds
		* useNotices/useLexicon; layout-phase inputs (variant and placeholder) ride
		* the owner props. Session facts
		* (running/removed/promptError) are self-selected via useSession.
		*
		* The text surface is the shell-owned Lexical editor bound here through
		* ComposerContentEditable; chips render as decorator portals, and the
		* keymap registers submit/menu/paste gestures on the editor command layer.
		* The no-session state renders the SAME div inert as the Workspace-picker
		* trigger instead of a parallel tree.
		*/
		const InputBar = (0, react.memo)(function InputBar({ useSession, useInput, inputActions, keyboard, addFiles, removeAttachment, resolveDraftAttachments, retryFileUpload, toggleCommandMenu, stop, t, renderSlot, useBusyEnter, useFileUploads, useNotices, useLexicon, useMenuLauncher, useStopShortcut, useProjection, sessionId, variant, disabled: inert = false, blocked, workspacePickerOpen = false, onRequestWorkspace, placeholder, accessory }) {
			const input = useInput((s) => s);
			const notice = useNotices((s) => s);
			const busyEnter = useBusyEnter((s) => s);
			const stopKeys = useStopShortcut((keys) => keys);
			const commandMenuOpen = useMenuLauncher((source) => source === "command");
			const [activity, setActivity] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				setActivity(false);
			}, [sessionId]);
			const promptError = useSession((s) => s.promptError) ?? null;
			const running = useSession((s) => s.running) ?? false;
			const subagent = useSession((s) => s.subagent) ?? null;
			const removed = useSession((s) => s.removed) ?? false;
			const planActive = useProjection("plan", (plan) => plan !== void 0 && (plan.pending ? !plan.active : plan.active));
			const hasGoal = useProjection("goal", (goal) => goal != null);
			const live = input !== void 0 && keyboard !== void 0 && inputActions !== void 0;
			const draft = input?.draft ?? "";
			const editor = keyboard?.editor ?? null;
			const attachments = (0, react.useMemo)(() => input === void 0 || resolveDraftAttachments === void 0 ? [] : resolveDraftAttachments(input.attachmentIds), [resolveDraftAttachments, input?.attachmentIds]);
			const empty = draft.trim() === "" && attachments.length === 0;
			const uploads = useFileUploads((snapshot) => snapshot);
			const uploadsPending = attachments.some((attachment) => attachment.kind === "file" && uploads[attachment.id]?.status !== "ready");
			const [toast, setToast] = (0, react.useState)(null);
			const toastSeq = (0, react.useRef)(0);
			const showToast = (0, react.useCallback)((text) => {
				toastSeq.current += 1;
				setToast({
					seq: toastSeq.current,
					text
				});
			}, []);
			const dismissToast = (0, react.useCallback)(() => {
				setToast(null);
			}, []);
			const imageLimits = useProjection("imageLimits");
			(0, react.useEffect)(() => {
				if (promptError === null) return;
				const { error } = promptError;
				if (error.code === "session/writer-held") {
					showToast(t("error.sessionInUse"));
					return;
				}
				showToast(error.code === "session/attachment-invalid" || error.code === "subagent/attachment-invalid" ? attachmentErrorText(t, error.details.reason, imageLimits) : `${error.message} (${error.code})`);
export {};
