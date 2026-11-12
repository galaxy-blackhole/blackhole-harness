/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				addResource,
				setResources,
				signal
			]);
			if (frame?.data !== data || frame.readRelated !== readRelated) return (0, react_jsx_runtime.jsx)(LoadingIndicator, { label: t("loading") });
			if (frame.url === void 0) return (0, react_jsx_runtime.jsx)("p", {
				className: HtmlBody_module_css_default.status,
				role: "alert",
				children: t("failed")
			});
			return (0, react_jsx_runtime.jsx)("iframe", {
				name: frameName,
				className: HtmlBody_module_css_default.frame,
				src: frame.url,
				sandbox: "allow-scripts",
				title: t("frame"),
				"data-html-preview": true
			}, frame.url);
		}
		/**
		* Render complete HTML with the standard file and tab hooks.
		* @param props - document bytes, hooks, related-file reader and locale.
		* @returns an isolated HTML document, or nothing for text delivery.
		*/
		function HtmlBody({ content, resourceAddress, readRelated, useTabInfo, useInteractivePreview, addResource, setResources, t }) {
			const interactivePreview = useInteractivePreview((value) => value);
			const { tab } = useTabInfo();
			(0, react.useEffect)(() => {
				if (!interactivePreview) setResources([]);
			}, [interactivePreview, setResources]);
			if (content.kind !== "bytes") return null;
			const frameName = `dsh-sidebar-html-${tab.id}`;
			if (!interactivePreview) return (0, react_jsx_runtime.jsx)(BasicHtmlFrame, {
				data: content.data,
				frameName,
				t
			});
			return (0, react_jsx_runtime.jsx)(HtmlFrame, {
				data: content.data,
				resourceAddress,
				readRelated,
				signal: tab.signal,
				frameName,
				addResource,
				setResources,
				t
			}, resourceAddress);
		}
		/** Static preview mounts a separate browsing context so a mode change retires running scripts. */
		function BasicHtmlFrame({ data, frameName, t }) {
			const html = (0, react.useMemo)(() => {
				try {
					return createBasicHtmlDocument(data);
				} catch {
					return;
				}
			}, [data]);
			if (html === void 0) return (0, react_jsx_runtime.jsx)("p", {
				className: HtmlBody_module_css_default.status,
				role: "alert",
				children: t("failed")
			});
			return (0, react_jsx_runtime.jsx)("iframe", {
				name: frameName,
				className: HtmlBody_module_css_default.frame,
				srcDoc: html,
				sandbox: "",
				title: t("frame"),
				"data-html-preview": true
			});
		}
		//#endregion
		//#region lib/types/client/html/locales.js
		/** Locale-owned HTML implementation name and iframe status text. */
		const zh$5 = {
			title: "HTML",
			frame: "HTML 文档预览",
			loading: "文档渲染中...",
			failed: "无法预览这份 HTML 文档"
		};
		/** English dictionary with the same keys as the Chinese dictionary. */
		const en$5 = {
			title: "HTML",
			frame: "HTML document preview",
			loading: "Rendering document...",
			failed: "This HTML document could not be previewed."
		};
		//#endregion
		//#region lib/types/client/html/index.js
		/** HTML implementation identity, shared by metadata and the keyed slot. */
		const HTML_BODY_ID = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/html";
		/**
		* Describe the builtin HTML renderer's file types and loading mode.
		* @param title - locale-owned implementation name.
		* @returns metadata for complete HTML documents.
		*/
		function htmlBodyDefinition(title) {
			return {
				id: HTML_BODY_ID,
				extensions: ["html", "htm"],
				priority: "builtin",
				title,
				loading: "bytes-complete",
				wrap: false
			};
		}
		/**
		* Register the HTML dictionary, metadata and body with reversible effects.
		* @param ctx - owning plugin context.
		*/
		function apply$6(ctx) {
			const t = ctx.locale.bind("documentHtml");
			ctx.effect(() => ctx.locale.register("documentHtml", {
				zh: zh$5,
				en: en$5
			}));
			ctx.effect(() => ctx.documentPreviews.register(htmlBodyDefinition(() => t("title"))));
			ctx.effect(() => ctx.slots.inject("sidebar.right.tab.document", () => ctx.slots.register({
				name: "sidebar.right.tab.document",
				key: HTML_BODY_ID,
				locale: "documentHtml",
				inject: () => ({
					hooks: { interactivePreview: ctx.configForms.developerTools.enabled },
					readRelated: (address, relativePath, signal) => {
						const file = hostFileOf(address);
						return ctx.remote.workspaceFiles.readBytes(file.sessionId, relativePath, { baseFile: file.path }, signal);
					}
				})
			}, HtmlBody)));
		}
		//#endregion
		//#region lib/types/client/document/tab-lifetime.js
		/**
		* Release retained view state on tab closure or plugin disposal.
		* @param ctx - owning preview plugin context.
		* @returns a callback accepting the tab, its lifetime signal, and its store's forget action; repeated holds share one listener.
		*/
		function retainDocumentTabs(ctx) {
			const retained = /* @__PURE__ */ new Map();
			ctx.effect(() => () => {
				for (const forget of retained.values()) forget();
			});
			return (tabId, signal, forgetTab) => {
				if (signal.aborted) {
					forgetTab(tabId);
					return;
				}
				if (retained.has(signal)) return;
				const forget = () => {
					signal.removeEventListener("abort", forget);
					retained.delete(signal);
					forgetTab(tabId);
				};
				retained.set(signal, forget);
				signal.addEventListener("abort", forget, { once: true });
			};
		}
		//#endregion
		//#region lib/types/client/zoom/types.js
		/** Default preference for a newly opened zoomable preview. */
		const FIT_WIDTH = { kind: "fit-width" };
		/** Minimum scale retained by a fixed zoom preference. */
		const MIN_FIXED_ZOOM = .25;
		/** Scale interval used by the incremental controls. */
		const ZOOM_STEP = .25;
		/** Fixed scale choices shown in the zoom menu. */
		const ZOOM_OPTIONS = [
			.25,
			.5,
			1,
			1.5,
			2
		];
		//#endregion
		//#region lib/types/client/zoom/store.js
		/** Tab-local zoom preferences for renderers without additional view state. */
		/**
		* Create tab-local zoom state for a document renderer registration.
		* @returns a store declaration retaining zoom until its tab closes.
		*/
		function createZoomStore() {
			return (0, _deepseek_ai_dsh_client_store.defineStore)({
				init: () => ({ byTab: {} }),
				actions: {
					zoom: (draft, tabId, preference) => {
						draft.byTab[tabId] = preference;
					},
					forget: (draft, tabId) => {
						const { [tabId]: _closed, ...remaining } = draft.byTab;
						draft.byTab = remaining;
					}
				}
			});
		}
		/** Default zoom value for a tab without retained state. */
		const DEFAULT_ZOOM = FIT_WIDTH;
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/zoom/ZoomControls.module.css.mjs
		const css$5 = ".lyqg2a_panel{z-index:2;inset-inline-start:50%;box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);opacity:0;pointer-events:none;will-change:opacity, transform;align-items:center;gap:2px;padding:4px 6px;font-size:12px;line-height:18px;transition:opacity .16s ease-in,transform .16s cubic-bezier(.4,0,1,1);display:flex;position:absolute;bottom:14px;transform:translate(-50%,16px)scale(.98);box-shadow:0 8px 24px light-dark(#0000001a,#00000060),0 2px 5px light-dark(#00000009,#00000035)}.lyqg2a_visible{opacity:1;pointer-events:auto;transition:opacity .14s ease-out,transform .18s cubic-bezier(.22,1,.36,1);transform:translate(-50%)scale(1)}.lyqg2a_controlAnchor{display:flex}.lyqg2a_zoomButton{flex:none;width:28px;padding:0}.lyqg2a_percent{font-variant-numeric:tabular-nums;justify-content:center;align-items:center;gap:2px;min-width:58px;padding-inline:6px;display:inline-flex}.lyqg2a_zoomMenu{min-width:112px}@media (hover:none),(pointer:coarse){.lyqg2a_panel{opacity:1;pointer-events:auto;transform:translate(-50%)scale(1)}}@media (prefers-reduced-motion:reduce){.lyqg2a_panel,.lyqg2a_visible{transition-duration:.01ms}}";
		const tagId$5 = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/ZoomControls.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$5) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
			tag.dataset.pluginCss = tagId$5;
			tag.textContent = css$5;
			document.head.appendChild(tag);
		}
		var ZoomControls_module_css_default = {
			"controlAnchor": "lyqg2a_controlAnchor",
			"panel": "lyqg2a_panel",
			"percent": "lyqg2a_percent",
			"visible": "lyqg2a_visible",
			"zoomButton": "lyqg2a_zoomButton",
			"zoomMenu": "lyqg2a_zoomMenu"
		};
		//#endregion
		//#region lib/types/client/zoom/ZoomControls.js
		/** Floating controls shared by every zoomable document renderer. */
		function steppedZoom(zoom, direction) {
			const step = direction === -1 ? Math.ceil(zoom / ZOOM_STEP) - 1 : Math.floor(zoom / ZOOM_STEP) + 1;
			return Math.min(4, Math.max(MIN_FIXED_ZOOM, step * ZOOM_STEP));
		}
		/**
		* Present fit-width, fixed presets, and incremental controls.
		* @param props - current resolved zoom, preference mode, labels, and callbacks.
		* @returns a localized zoom toolbar.
		*/
		const ZoomControls = (0, react.forwardRef)(function ZoomControls({ zoom, fitWidth, labels, visible, onZoom, onFitWidth, onActiveChange }, ref) {
			const [displayZoom, setDisplayZoom] = (0, react.useState)(zoom);
			const [open, setOpen] = (0, react.useState)(false);
			const [hovered, setHovered] = (0, react.useState)(false);
			const [focused, setFocused] = (0, react.useState)(false);
			(0, react.useImperativeHandle)(ref, () => ({ showZoom: setDisplayZoom }), []);
			(0, react.useEffect)(() => {
				onActiveChange(open || hovered || focused);
			}, [
				focused,
				hovered,
				onActiveChange,
				open
			]);
			const items = [
				{
					id: "fit-width",
					label: labels.fitWidth
				},
				{
					type: "separator",
					id: "fit-scale"
				},
				...ZOOM_OPTIONS.map((value) => ({
					id: String(value),
					label: labels.value(value * 100)
				}))
			];
			const selectedId = fitWidth ? "fit-width" : ZOOM_OPTIONS.includes(displayZoom) ? String(displayZoom) : void 0;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: `${ZoomControls_module_css_default.panel} ${visible ? ZoomControls_module_css_default.visible : ""}`,
				role: "toolbar",
				"aria-label": labels.controls,
				"data-document-zoom-controls": true,
				"data-document-zoom-visible": visible || void 0,
				onPointerEnter: () => {
					setHovered(true);
				},
				onPointerLeave: () => {
					setHovered(false);
				},
				onFocusCapture: () => {
					setFocused(true);
				},
				onBlurCapture: () => {
					setFocused(false);
				},
				children: [
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: labels.out,
						side: "top",
						children: (0, react_jsx_runtime.jsx)("span", {
							className: ZoomControls_module_css_default.controlAnchor,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								className: ZoomControls_module_css_default.zoomButton,
								"aria-label": labels.out,
								disabled: displayZoom <= MIN_FIXED_ZOOM,
								onMouseDown: (event) => {
									event.preventDefault();
								},
								onClick: () => {
									onZoom(steppedZoom(displayZoom, -1));
								},
								children: (0, react_jsx_runtime.jsx)("svg", {
									width: "14",
									height: "14",
									viewBox: "0 0 16 16",
									"aria-hidden": "true",
									children: (0, react_jsx_runtime.jsx)("path", {
										d: "M2 8h12",
										fill: "none",
										stroke: "currentColor",
										strokeWidth: "1.5"
									})
								})
							})
						})
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
						open,
						side: "top",
						align: "start",
						portal: true,
						compact: true,
						listClassName: ZoomControls_module_css_default.zoomMenu,
						anchor: (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							className: ZoomControls_module_css_default.percent,
							"aria-label": labels.menu,
							"aria-expanded": open,
							onMouseDown: (event) => {
								event.preventDefault();
							},
							onClick: () => {
								setOpen((value) => !value);
							},
							children: [(0, react_jsx_runtime.jsx)("span", { children: labels.value(Math.round(displayZoom * 100)) }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { size: 12 })]
						}),
						items,
						selectedId,
						onClose: () => {
							setOpen(false);
						},
						onSelect: (selected) => {
							setOpen(false);
							if (selected === "fit-width") onFitWidth();
							else onZoom(Number(selected));
						}
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: labels.into,
						side: "top",
						children: (0, react_jsx_runtime.jsx)("span", {
							className: ZoomControls_module_css_default.controlAnchor,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								size: "sm",
								className: ZoomControls_module_css_default.zoomButton,
								"aria-label": labels.into,
								disabled: displayZoom >= 4,
								onMouseDown: (event) => {
									event.preventDefault();
								},
								onClick: () => {
									onZoom(steppedZoom(displayZoom, 1));
								},
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 })
							})
						})
					})
				]
			});
		});
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/zoom/ZoomViewport.module.css.mjs
		const css$4 = ".rIfSMq_frame{height:100%;min-height:0;position:relative;overflow:hidden}.rIfSMq_scrollport{height:100%;overflow:auto}.rIfSMq_surface{max-width:none}.rIfSMq_revealZone{height:var(--document-zoom-reveal-height);pointer-events:none;position:absolute;inset:auto 0 0}.rIfSMq_frame[data-document-zoom-mode=fit-width] .rIfSMq_surface{width:min(var(--document-zoom-width), 100%)}.rIfSMq_frame[data-document-zoom-mode=fixed] .rIfSMq_surface{width:calc(var(--document-zoom-width) * var(--document-zoom))}";
		const tagId$4 = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/ZoomViewport.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var ZoomViewport_module_css_default = {
			"frame": "rIfSMq_frame",
			"revealZone": "rIfSMq_revealZone",
			"scrollport": "rIfSMq_scrollport",
			"surface": "rIfSMq_surface"
		};
		//#endregion
		//#region lib/types/client/zoom/ZoomViewport.js
		/** Shared zoom viewport, gesture handling, anchoring, and fit-width measurement. */
		const PINCH_SETTLE_DELAY_MS = 120;
		const CONTROLS_HIDE_DELAY_MS = 420;
		const CONTROLS_REVEAL_HEIGHT_PX = 72;
		function pointerAnchor(clientX, clientY) {
			const lookup = Reflect.get(document, "elementFromPoint");
			if (typeof lookup !== "function") return void 0;
			const hit = Reflect.apply(lookup, document, [clientX, clientY]);
			const surface = hit instanceof Element ? hit.closest("[data-document-zoom-surface]") : null;
			if (surface === null) return void 0;
			const bounds = surface.getBoundingClientRect();
			return {
				surface,
				x: clientX - bounds.left,
				y: clientY - bounds.top,
				clientX,
				clientY
			};
		}
		/** @returns an actual-size scale that only shrinks content wider than the viewport. */
		function fitWidthZoom(viewportWidth, intrinsicWidth, horizontalInset = 0) {
export {};
