/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			if (intrinsicWidth === void 0 || intrinsicWidth <= 0) return 1;
			return Math.min(1, Math.max(1, viewportWidth - horizontalInset) / intrinsicWidth);
		}
		/**
		* Keep zoom controls and trackpad gestures independent from document rendering.
		* @param props - renderer content, intrinsic width, tab preference, and localized labels.
		* @returns the owned scrollport and floating zoom controls.
		*/
		function ZoomViewport(props) {
			const [viewportWidth, setViewportWidth] = (0, react.useState)(0);
			const [controlsVisible, setControlsVisible] = (0, react.useState)(false);
			const fitZoom = fitWidthZoom(viewportWidth, props.intrinsicWidth, props.horizontalInset);
			const zoom = props.preference.kind === "fit-width" ? fitZoom : props.preference.scale;
			const zoomRef = (0, react.useRef)(zoom);
			const modeRef = (0, react.useRef)(props.preference.kind);
			const frame = (0, react.useRef)(null);
			const scrollport = (0, react.useRef)(null);
			const controls = (0, react.useRef)(null);
			const pinchTimer = (0, react.useRef)();
			const controlsHideTimer = (0, react.useRef)();
			const pointerInRevealZone = (0, react.useRef)(false);
			const controlsActive = (0, react.useRef)(false);
			const clearControlsHide = (0, react.useCallback)(() => {
				clearTimeout(controlsHideTimer.current);
				controlsHideTimer.current = void 0;
			}, []);
			const showControls = (0, react.useCallback)(() => {
				clearControlsHide();
				setControlsVisible(true);
			}, [clearControlsHide]);
			const scheduleControlsHide = (0, react.useCallback)(() => {
				clearControlsHide();
				if (pointerInRevealZone.current || controlsActive.current || pinchTimer.current !== void 0) return;
				controlsHideTimer.current = setTimeout(() => {
					controlsHideTimer.current = void 0;
					setControlsVisible(false);
				}, CONTROLS_HIDE_DELAY_MS);
			}, [clearControlsHide]);
			const handleControlsActive = (0, react.useCallback)((active) => {
				controlsActive.current = active;
				if (active) showControls();
				else scheduleControlsHide();
			}, [scheduleControlsHide, showControls]);
			const handlePointerMove = (0, react.useCallback)((event) => {
				const inRevealZone = event.pointerType === "mouse" && event.clientY >= event.currentTarget.getBoundingClientRect().bottom - CONTROLS_REVEAL_HEIGHT_PX;
				pointerInRevealZone.current = inRevealZone;
				if (inRevealZone) showControls();
				else scheduleControlsHide();
			}, [scheduleControlsHide, showControls]);
			const handlePointerLeave = (0, react.useCallback)(() => {
				pointerInRevealZone.current = false;
				scheduleControlsHide();
			}, [scheduleControlsHide]);
			const attachFrame = (0, react.useCallback)((node) => {
				frame.current = node;
				node?.style.setProperty("--document-zoom", String(zoomRef.current));
			}, []);
			const attachScrollport = (0, react.useCallback)((node) => {
				scrollport.current = node;
				props.scrollportRef(node);
			}, [props.scrollportRef]);
			const showZoom = (0, react.useCallback)((next, clientX, clientY) => {
				const node = scrollport.current;
				const previous = zoomRef.current;
				next = Math.min(4, Math.max(MIN_FIXED_ZOOM, next));
				if (next === previous) return previous;
				const bounds = node.getBoundingClientRect();
				const x = clientX === void 0 ? node.clientWidth / 2 : clientX - bounds.left;
				const y = clientY === void 0 ? node.clientHeight / 2 : clientY - bounds.top;
				const anchor = pointerAnchor(bounds.left + x, bounds.top + y);
				const previousScrollLeft = node.scrollLeft;
				const previousScrollTop = node.scrollTop;
				const ratio = next / previous;
				zoomRef.current = next;
				modeRef.current = "fixed";
				frame.current?.setAttribute("data-document-zoom-mode", "fixed");
				frame.current?.style.setProperty("--document-zoom", String(next));
				controls.current?.showZoom(next);
				if (anchor === void 0) {
					node.scrollLeft = (previousScrollLeft + x) * ratio - x;
					node.scrollTop = (previousScrollTop + y) * ratio - y;
				} else {
					const nextBounds = anchor.surface.getBoundingClientRect();
					node.scrollLeft += nextBounds.left + anchor.x * ratio - anchor.clientX;
					node.scrollTop += nextBounds.top + anchor.y * ratio - anchor.clientY;
				}
				return next;
			}, []);
			const setZoom = (0, react.useCallback)((next) => {
				clearTimeout(pinchTimer.current);
				pinchTimer.current = void 0;
				props.onPreference({
					kind: "fixed",
					scale: showZoom(next)
				});
			}, [props.onPreference, showZoom]);
			const fitWidth = (0, react.useCallback)(() => {
				clearTimeout(pinchTimer.current);
				pinchTimer.current = void 0;
				const node = frame.current;
				zoomRef.current = fitZoom;
				modeRef.current = "fit-width";
				node?.setAttribute("data-document-zoom-mode", "fit-width");
				node?.style.setProperty("--document-zoom", String(fitZoom));
				controls.current?.showZoom(fitZoom);
				props.onPreference(FIT_WIDTH);
			}, [fitZoom, props.onPreference]);
			(0, react.useLayoutEffect)(() => {
				const node = scrollport.current;
				const measure = () => {
					setViewportWidth(node.clientWidth);
				};
				measure();
				if (typeof ResizeObserver === "undefined") return;
				const observer = new ResizeObserver(measure);
				observer.observe(node);
				return () => {
					observer.disconnect();
				};
			}, []);
			(0, react.useEffect)(() => {
				if (pinchTimer.current !== void 0) return;
				zoomRef.current = zoom;
				modeRef.current = props.preference.kind;
				frame.current?.setAttribute("data-document-zoom-mode", props.preference.kind);
				frame.current?.style.setProperty("--document-zoom", String(zoom));
				controls.current?.showZoom(zoom);
				props.onRenderZoom?.(zoom);
			}, [
				props.onRenderZoom,
				props.preference.kind,
				zoom
			]);
			(0, react.useEffect)(() => {
				const node = scrollport.current;
				const clearPendingPinch = () => {
					clearTimeout(pinchTimer.current);
					pinchTimer.current = void 0;
					clearControlsHide();
				};
				const wheel = (event) => {
					if (!event.ctrlKey || props.signal.aborted) return;
					event.preventDefault();
					showControls();
					const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? node.clientHeight : 1;
					const delta = Math.max(-40, Math.min(40, event.deltaY * unit));
					showZoom(zoomRef.current * Math.exp(-delta * .01), event.clientX, event.clientY);
					clearTimeout(pinchTimer.current);
					pinchTimer.current = setTimeout(() => {
						pinchTimer.current = void 0;
						props.onPreference({
							kind: "fixed",
							scale: zoomRef.current
						});
						scheduleControlsHide();
					}, PINCH_SETTLE_DELAY_MS);
				};
				node.addEventListener("wheel", wheel, { passive: false });
				props.signal.addEventListener("abort", clearPendingPinch, { once: true });
				return () => {
					node.removeEventListener("wheel", wheel);
					props.signal.removeEventListener("abort", clearPendingPinch);
					clearPendingPinch();
				};
			}, [
				clearControlsHide,
				props.onPreference,
				props.signal,
				scheduleControlsHide,
				showControls,
				showZoom
			]);
			return (0, react_jsx_runtime.jsxs)("section", {
				ref: attachFrame,
				className: ZoomViewport_module_css_default.frame,
				"data-document-zoom-frame": true,
				"data-document-zoom-mode": modeRef.current,
				style: {
					"--document-zoom": zoomRef.current,
					"--document-zoom-reveal-height": `${String(CONTROLS_REVEAL_HEIGHT_PX)}px`
				},
				onPointerMove: handlePointerMove,
				onPointerLeave: handlePointerLeave,
				children: [
					(0, react_jsx_runtime.jsx)("div", {
						ref: attachScrollport,
						className: ZoomViewport_module_css_default.scrollport,
						"data-document-zoom-scrollport": true,
						children: props.children
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: ZoomViewport_module_css_default.revealZone,
						"data-document-zoom-reveal-zone": true,
						"aria-hidden": "true"
					}),
					props.intrinsicWidth !== void 0 && (0, react_jsx_runtime.jsx)(ZoomControls, {
						ref: controls,
						zoom: zoomRef.current,
						fitWidth: modeRef.current === "fit-width",
						labels: props.labels,
						visible: controlsVisible,
						onZoom: setZoom,
						onFitWidth: fitWidth,
						onActiveChange: handleControlsActive
					})
				]
			});
		}
		/** Shared surface class for actual-size and fit-width layout. */
		const zoomSurfaceClass = ZoomViewport_module_css_default.surface;
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/image/ImageBody.module.css.mjs
		const css$3 = ".JFRUHG_frame{box-sizing:border-box;width:100%;min-width:100%;height:max-content;min-height:100%;font-family:var(--dsw-font,sans-serif);white-space:normal;padding:12px;display:flex}.JFRUHG_frame:has([data-document-loading]){height:100%}.JFRUHG_surface{flex:none;max-width:none;margin:auto;display:block}.JFRUHG_surface[hidden]{display:none}.JFRUHG_image{border-radius:var(--dsw-radius-md);user-select:none;width:100%;max-width:none;height:auto;max-height:none;display:block}.JFRUHG_status{box-sizing:border-box;width:100%;min-height:100%;color:var(--dsw-alias-label-secondary);white-space:normal;justify-content:center;align-items:center;margin:0;padding:10px;font-size:13px;line-height:1.5;display:flex}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/ImageBody.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var ImageBody_module_css_default = {
			"frame": "JFRUHG_frame",
			"image": "JFRUHG_image",
			"status": "JFRUHG_status",
			"surface": "JFRUHG_surface"
		};
		//#endregion
		//#region lib/types/client/image/ImageBody.js
		/** Complete image bytes rendered in a shared zoom viewport. */
		const IMAGE_MEDIA_TYPES = {
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			gif: "image/gif",
			webp: "image/webp",
			bmp: "image/bmp",
			ico: "image/x-icon",
			svg: "image/svg+xml"
		};
		/**
		* Resolve a supported filename to the media type assigned to its Blob.
		* @param path - decoded workspace file path.
		* @returns the image media type, or undefined for an unregistered suffix.
		*/
		function imageMediaType(path) {
			const normalized = path.replaceAll("\\", "/");
			const name = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
			return IMAGE_MEDIA_TYPES[name.slice(name.lastIndexOf(".") + 1)];
		}
		/**
		* Present complete image bytes with fit-width and fixed-scale viewing.
		* @param props - document bytes, resource identity, and locale.
		* @returns a rounded image fitted or scaled at its intrinsic aspect ratio.
		*/
		function ImageBody(props) {
			const { content, resourceAddress, t } = props;
			const { tab } = props.useTabInfo();
			const preference = props.useStore((state) => state.byTab[tab.id] ?? DEFAULT_ZOOM);
			const path = (0, react.useMemo)(() => hostFileOf(resourceAddress).path, [resourceAddress]);
			const mediaType = imageMediaType(path);
			const data = content.kind === "bytes" ? content.data : void 0;
			const [source, setSource] = (0, react.useState)();
			const setPreference = (0, react.useCallback)((value) => {
				props.actions.zoom(tab.id, value);
			}, [props.actions, tab.id]);
			(0, react.useEffect)(() => {
				props.retainTab(tab.id, tab.signal);
			}, [
				props.retainTab,
				tab.id,
				tab.signal
			]);
			(0, react.useEffect)(() => {
				if (data === void 0 || mediaType === void 0) return;
				let url;
				try {
					url = URL.createObjectURL(new Blob([data], { type: mediaType }));
					setSource({
						kind: "ready",
						data,
						mediaType,
						url
					});
				} catch {
					setSource({
						kind: "failed",
						data,
						mediaType
					});
				}
				return () => {
					if (url !== void 0) URL.revokeObjectURL(url);
				};
			}, [data, mediaType]);
			if (data === void 0 || mediaType === void 0) return (0, react_jsx_runtime.jsx)("p", {
				className: ImageBody_module_css_default.status,
				role: "alert",
				children: t("unsupported")
			});
			if (source?.data !== data || source.mediaType !== mediaType) return (0, react_jsx_runtime.jsx)(LoadingIndicator, { label: t("loading") });
			if (source.kind === "failed") return (0, react_jsx_runtime.jsx)("p", {
				className: ImageBody_module_css_default.status,
				role: "alert",
				children: t("failed")
			});
			const { name } = pathPartsOf(path);
			const labels = {
				controls: t("zoomControls"),
				menu: t("zoomMenu"),
				out: t("zoomOut"),
				into: t("zoomIn"),
				fitWidth: t("zoomFitWidth"),
				value: (percent) => t("zoomValue", { percent })
			};
			return (0, react_jsx_runtime.jsx)(LoadedImage, {
				url: source.url,
				name,
				preference,
				onPreference: setPreference,
				labels,
				signal: tab.signal,
				scrollportRef: props.scrollportRef,
				t
			}, source.url);
		}
		/** SVG stays in the browser's static image mode because its bytes only reach an img Blob URL. */
		function LoadedImage({ url, name, preference, onPreference, labels, signal, scrollportRef, t }) {
			const [state, setState] = (0, react.useState)("loading");
			const [width, setWidth] = (0, react.useState)();
			return (0, react_jsx_runtime.jsx)(ZoomViewport, {
				preference,
				intrinsicWidth: width,
				horizontalInset: 24,
				labels,
				signal,
				scrollportRef,
				onPreference,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: ImageBody_module_css_default.frame,
					"data-image-preview": true,
					children: [
						state === "loading" && (0, react_jsx_runtime.jsx)(LoadingIndicator, { label: t("loading") }),
						state === "failed" && (0, react_jsx_runtime.jsx)("p", {
							className: ImageBody_module_css_default.status,
							role: "alert",
							children: t("failed")
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: `${ImageBody_module_css_default.surface} ${zoomSurfaceClass}`,
							"data-document-zoom-surface": true,
							style: { "--document-zoom-width": `${width ?? 0}px` },
							hidden: state !== "ready",
							children: (0, react_jsx_runtime.jsx)("img", {
								className: ImageBody_module_css_default.image,
								src: url,
								alt: t("preview", { name }),
								decoding: "async",
								draggable: false,
								referrerPolicy: "no-referrer",
								onLoad: (event) => {
									setWidth(event.currentTarget.naturalWidth);
									setState("ready");
								},
								onError: () => {
									setState("failed");
								}
							})
						})
					]
				})
			});
		}
		//#endregion
		//#region lib/types/client/zoom/locales.js
		/** Shared zoom copy embedded into renderer-owned dictionaries. */
		const zoomZh = {
			zoomControls: "缩放控件",
			zoomMenu: "选择缩放比例",
			zoomOut: "缩小",
			zoomIn: "放大",
			zoomFitWidth: "适应宽度",
			zoomValue: "{percent}%"
		};
		/** Shared English zoom copy. */
		const zoomEn = {
			zoomControls: "Zoom controls",
			zoomMenu: "Choose zoom",
			zoomOut: "Zoom out",
			zoomIn: "Zoom in",
			zoomFitWidth: "Fit width",
			zoomValue: "{percent}%"
		};
		//#endregion
		//#region lib/types/client/image/locales.js
		/** Locale-owned image renderer labels and status text. */
		const zh$4 = {
			...zoomZh,
			title: "图片",
			preview: "图片预览：{name}",
export {};
