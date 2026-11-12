/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-attachment",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@galaxy-blackhole/gbh-client-ui-primitives");
		let react_dom = require("react-dom");
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
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-attachment/src/AttachmentRail.module.css.mjs
		const css$4 = ".JVDQca_root{min-width:0;position:relative}.JVDQca_rail{scrollbar-width:none;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);align-items:stretch;gap:10px;display:flex;overflow:auto hidden}.JVDQca_rail::-webkit-scrollbar{display:none}.JVDQca_item{flex:none;height:64px}.JVDQca_thumbnail{border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-interactive-bg-hover);cursor:zoom-in;width:64px;height:64px;padding:0;overflow:hidden}.JVDQca_thumbnail img{object-fit:cover;width:100%;height:100%;display:block}.JVDQca_remove{z-index:1;corner-shape:round;background:var(--dsw-alias-button-contrast-fill);width:18px;height:18px;color:var(--dsw-alias-label-primary-inverted);cursor:pointer;opacity:0;border:none;border-radius:50%;place-items:center;padding:0;transition:opacity .2s ease-in-out;display:grid;position:absolute;top:4px;right:4px}.JVDQca_item:hover .JVDQca_remove,.JVDQca_remove:focus-visible{opacity:1}@media (pointer:coarse){.JVDQca_remove{opacity:1}}@media (prefers-reduced-motion:reduce){.JVDQca_remove{transition:none}}.JVDQca_arrow{z-index:2;--dsw-elevation-stroke-color:var(--dsw-alias-border-l2-darkmode-thin);corner-shape:round;background:var(--dsw-specific-input-major);width:24px;height:24px;color:var(--dsw-alias-label-secondary);box-shadow:var(--dsw-elevation-panel);cursor:pointer;border:0;border-radius:999px;place-items:center;padding:0;display:grid;position:absolute;top:50%;transform:translateY(-50%)}.JVDQca_arrow:hover{background:var(--dsw-alias-interactive-bg-hover-solid)}.JVDQca_arrowLeft{left:4px}.JVDQca_arrowRight{right:4px}";
		const tagId$4 = "@deepseek-ai/dsh-client-ui-attachment/AttachmentRail.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$4) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-attachment";
			tag.dataset.pluginCss = tagId$4;
			tag.textContent = css$4;
			document.head.appendChild(tag);
		}
		var AttachmentRail_module_css_default = {
			"arrow": "JVDQca_arrow",
			"arrowLeft": "JVDQca_arrowLeft",
			"arrowRight": "JVDQca_arrowRight",
			"item": "JVDQca_item",
			"rail": "JVDQca_rail",
			"remove": "JVDQca_remove",
			"root": "JVDQca_root",
			"thumbnail": "JVDQca_thumbnail"
		};
		//#endregion
		//#region lib/types/AttachmentRail.js
		/** Draft-attachment rail: scrollbar-less horizontal overflow paged by edge arrows. */
		/** Approximate pixels per wheel step for `deltaMode` LINE deltas (Firefox
		* notch wheels report lines, not pixels). */
		const WHEEL_LINE_PX = 16;
		/** Smooth paging unless the user asked for reduced motion. */
		function pageBehavior() {
			const matchMedia = window.matchMedia;
			return matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
		}
		/**
		* Horizontal rail over the caller's ordered draft attachments.
		*
		* The rail scrolls with its scrollbar hidden; overflow is announced by edge
		* arrows recomputed from scroll geometry on scroll, item-count changes, and
		* rail size changes (a ResizeObserver on the rail element, so sidebar or
		* panel resizes count, not only window resizes). A vertical wheel pans the
		* rail horizontally and is consumed exclusively (non-passive listener), a
		* newly added item is revealed at the rail's end while a rail that mounts
		* over an existing draft keeps its start position. The owner renders each
		* item and decides mounting; it renders the rail only while items exist.
		*
		* @param props.items - attachments in draft order.
		* @param props.labels - rail-level strings (group name and paging arrows).
		* @param props.renderItem - render one attachment card in draft order.
		* @returns the rail group with its paging arrows.
		*/
		function AttachmentRail({ items, labels, renderItem }) {
			const railRef = (0, react.useRef)(null);
			const countRef = (0, react.useRef)(null);
			const [edges, setEdges] = (0, react.useState)({
				left: false,
				right: false
			});
			const updateEdges = (0, react.useCallback)(() => {
				const el = railRef.current;
				/* v8 ignore next -- defensive: every caller runs while the rail element is mounted. */
				if (el === null) return;
				const left = el.scrollLeft > 1;
				const right = el.scrollLeft < el.scrollWidth - el.clientWidth - 1;
				setEdges((prev) => prev.left === left && prev.right === right ? prev : {
					left,
					right
				});
			}, []);
			(0, react.useLayoutEffect)(() => {
				const grew = countRef.current !== null && items.length > countRef.current;
				countRef.current = items.length;
				const el = railRef.current;
				/* v8 ignore next -- defensive: the rail div renders unconditionally, so the layout effect always finds it. */
				if (el === null) return;
				if (grew) el.scrollLeft = el.scrollWidth - el.clientWidth;
				updateEdges();
			}, [items.length, updateEdges]);
			(0, react.useEffect)(() => {
				const el = railRef.current;
				/* v8 ignore next -- defensive: the rail div renders unconditionally, so the mount effect always finds it. */
				if (el === null) return;
				let disconnect = () => {};
				if (typeof ResizeObserver !== "undefined") {
					const observer = new ResizeObserver(updateEdges);
					observer.observe(el);
					disconnect = () => {
						observer.disconnect();
					};
				}
				const onWheel = (event) => {
					if (event.deltaY === 0) return;
					const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? WHEEL_LINE_PX : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? el.clientWidth : 1;
					event.preventDefault();
					el.scrollBy({
						left: event.deltaX !== 0 ? event.deltaX * scale : Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY) * scale, 60),
						behavior: "auto"
					});
				};
				el.addEventListener("wheel", onWheel, { passive: false });
				return () => {
					disconnect();
					el.removeEventListener("wheel", onWheel);
				};
			}, [updateEdges]);
			const page = (direction) => {
				const el = railRef.current;
				/* v8 ignore next -- defensive: the arrows render only while the rail is mounted, so a click cannot find a null ref. */
				if (el === null) return;
				el.scrollBy({
					left: direction * Math.max(el.clientWidth - 64, 200),
					behavior: pageBehavior()
				});
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: AttachmentRail_module_css_default.root,
				children: [
					edges.left && (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: clsx(AttachmentRail_module_css_default.arrow, AttachmentRail_module_css_default.arrowLeft),
						"aria-label": labels.scrollLeft,
						onClick: () => {
							page(-1);
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronLeftOutlineRegular, {})
					}),
					(0, react_jsx_runtime.jsx)("div", {
						ref: railRef,
						className: AttachmentRail_module_css_default.rail,
						role: "group",
						"aria-label": labels.group,
						onScroll: updateEdges,
						children: items.map((item) => (0, react_jsx_runtime.jsx)("div", {
							className: AttachmentRail_module_css_default.item,
							children: renderItem(item)
						}, item.id))
					}),
					edges.right && (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: clsx(AttachmentRail_module_css_default.arrow, AttachmentRail_module_css_default.arrowRight),
						"aria-label": labels.scrollRight,
						onClick: () => {
							page(1);
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
					})
				]
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-attachment/src/DropOverlay.module.css.mjs
		const css$3 = ".BInVoG_mask{z-index:1000;pointer-events:none;background-color:var(--dsw-alias-bg-mask-drop);backdrop-filter:blur(10px);justify-content:center;align-items:center;animation:.16s ease-out BInVoG_fade-in;display:flex;position:fixed;inset:0}@keyframes BInVoG_fade-in{0%{opacity:0}to{opacity:1}}@media (prefers-reduced-motion:reduce){.BInVoG_mask{animation:none}}.BInVoG_wrap{color:var(--dsw-alias-label-primary);text-align:center;flex-direction:column;align-items:center;margin-top:-3%;padding:0 40px;display:flex}.BInVoG_illustration{width:115px;height:84px}.BInVoG_title{font:var(--dsw-font-l-20);margin-top:16px}.BInVoG_desc{font:var(--dsw-font-s-14);color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;margin-top:16px}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-attachment/DropOverlay.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-attachment";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var DropOverlay_module_css_default = {
			"desc": "BInVoG_desc",
			"fade-in": "BInVoG_fade-in",
			"illustration": "BInVoG_illustration",
			"mask": "BInVoG_mask",
			"title": "BInVoG_title",
			"wrap": "BInVoG_wrap"
		};
		//#endregion
		//#region lib/types/DropOverlay.js
		/**
		* Full-viewport invitation shown while a file drag is over the page
		* (DeepSeek Chat's DragMask). Decoration only: `pointer-events: none` keeps
		* drag targeting on the page below, so the owner's document-level listeners
		* keep an accurate enter/leave count and own accept/reject. Rendered through
		* a body portal for the same transformed-ancestor reason as the lightbox.
		*
		* @param props.disabled - drops are currently refused; renders the blocked
		* illustration and drops the desc line.
		* @param props.labels - resolved title and limits strings.
		* @returns the overlay layer.
		*/
		function DropOverlay({ disabled, labels }) {
			return (0, react_dom.createPortal)((0, react_jsx_runtime.jsx)("div", {
				className: DropOverlay_module_css_default.mask,
				role: "status",
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: DropOverlay_module_css_default.wrap,
					children: [
						(0, react_jsx_runtime.jsx)("div", {
							className: DropOverlay_module_css_default.illustration,
							"aria-hidden": "true",
							children: disabled ? (0, react_jsx_runtime.jsx)(UploadDisabledIllustration, {}) : (0, react_jsx_runtime.jsx)(UploadIllustration, {})
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: DropOverlay_module_css_default.title,
							children: labels.title
						}),
						!disabled && labels.desc !== void 0 && (0, react_jsx_runtime.jsx)("div", {
							className: DropOverlay_module_css_default.desc,
							children: labels.desc
						})
					]
				})
			}), document.body);
		}
		/** Tilted photo-and-note cards (DeepSeek Chat upload illustration). */
		const UploadIllustration = () => (0, react_jsx_runtime.jsxs)("svg", {
			width: "115",
			height: "84",
			viewBox: "0 0 115 84",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [(0, react_jsx_runtime.jsxs)("g", {
				clipPath: "url(#dshDropOverlayClip)",
				children: [
					(0, react_jsx_runtime.jsx)("rect", {
						y: "17.0742",
						width: "44.1832",
						height: "43.6431",
						rx: "12",
						transform: "rotate(-22.7338 0 17.0742)",
						fill: "#9CE5ED"
					}),
					(0, react_jsx_runtime.jsx)("rect", {
						x: "73.4043",
						y: "8.54297",
						width: "43.7267",
						height: "50.5284",
						rx: "8",
						transform: "rotate(17.403 73.4043 8.54297)",
						fill: "#679EFE"
					}),
					(0, react_jsx_runtime.jsx)("path", {
						d: "M30.4917 28.1369L40.8865 33.4564L37.2232 34.9524L29.5302 31.0159L26.7919 39.2122L23.1285 40.7082L26.8287 29.6338L16.8967 24.5516L20.5601 23.0556L27.7902 26.7549L30.3639 19.052L34.0273 17.556L30.4917 28.1369Z",
						fill: "white"
					}),
					(0, react_jsx_runtime.jsx)("path", {
						d: "M77.5088 26.3047L101.057 33.7966",
						stroke: "white",
						strokeWidth: "3"
					}),
					(0, react_jsx_runtime.jsx)("path", {
						d: "M72.2646 42.7871L86.3938 47.2823",
						stroke: "white",
						strokeWidth: "3"
					}),
					(0, react_jsx_runtime.jsx)("path", {
						d: "M74.8867 34.5469L98.4353 42.0388",
						stroke: "white",
						strokeWidth: "3"
					}),
					(0, react_jsx_runtime.jsx)("rect", {
						x: "31.583",
						y: "38.6641",
						width: "44.9157",
						height: "44.3666",
						rx: "12",
						transform: "rotate(-0.134233 31.583 38.6641)",
						fill: "#3964FE"
					}),
					(0, react_jsx_runtime.jsx)("path", {
						d: "M38.9521 73.0337C39.6129 71.7086 41.7113 66.0937 43.5113 61.1663C44.1607 59.3885 46.7484 59.3923 47.4591 61.1465C48.9728 64.8828 50.7969 68.6922 51.9988 69.1925C54.2946 70.1482 57.9854 59.3573 68.0064 70.1801",
						stroke: "white",
						strokeWidth: "3"
					}),
					(0, react_jsx_runtime.jsx)("circle", {
						cx: "60.6157",
						cy: "52.247",
						r: "4.38794",
						transform: "rotate(22.5996 60.6157 52.247)",
						fill: "white"
					})
				]
			}), (0, react_jsx_runtime.jsx)("defs", { children: (0, react_jsx_runtime.jsx)("clipPath", {
				id: "dshDropOverlayClip",
				children: (0, react_jsx_runtime.jsx)("rect", {
					width: "115",
					height: "84",
					fill: "white"
				})
			}) })]
		});
		/** Greyed cards with a blocked badge (DeepSeek Chat disabled illustration). */
		const UploadDisabledIllustration = () => (0, react_jsx_runtime.jsxs)("svg", {
			width: "115",
			height: "84",
			viewBox: "0 0 115 84",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				(0, react_jsx_runtime.jsx)("path", {
					d: "M29.6829 4.63701L11.0677 12.4368C4.95519 14.998 2.07624 22.0294 4.6374 28.1419L12.2285 46.259C14.7896 52.3715 21.8211 55.2505 27.9336 52.6893L46.5488 44.8895C52.6613 42.3283 55.5403 35.2969 52.9791 29.1844L45.388 11.0673C42.8269 4.9548 35.7954 2.07585 29.6829 4.63701Z",
					fill: "#979DA6"
				}),
				(0, react_jsx_runtime.jsx)("path", {
					d: "M30.4915 28.1375L40.8863 33.4569L37.223 34.9529L29.53 31.0165L26.7917 39.2128L23.1283 40.7088L26.8285 29.6344L16.8965 24.5522L20.5599 23.0562L27.79 26.7555L30.3637 19.0526L34.0271 17.5566L30.4915 28.1375Z",
					fill: "white"
				}),
				(0, react_jsx_runtime.jsx)("path", {
					d: "M107.496 19.2285L81.0381 10.9357C76.8221 9.61423 72.333 11.9607 71.0116 16.1768L60.6844 49.1246C59.363 53.3406 61.7095 57.8297 65.9255 59.1511L92.383 67.4439C96.599 68.7654 101.088 66.4189 102.41 62.2029L112.737 29.255C114.058 25.039 111.712 20.55 107.496 19.2285Z",
					fill: "#979DA6"
				}),
				(0, react_jsx_runtime.jsx)("path", {
					d: "M77.5088 26.3047L101.057 33.7967",
					stroke: "white",
					strokeWidth: "3"
				}),
				(0, react_jsx_runtime.jsx)("path", {
					d: "M72.2646 42.7871L86.3938 47.2823",
					stroke: "white",
					strokeWidth: "3"
				}),
				(0, react_jsx_runtime.jsx)("path", {
					d: "M74.8867 34.5469L98.4353 42.0388",
					stroke: "white",
					strokeWidth: "3"
				}),
				(0, react_jsx_runtime.jsx)("path", {
					d: "M66.5798 30.1418L41.481 30.2006C33.5281 30.2193 27.0962 36.6815 27.1148 44.6343L27.172 69.0742C27.1907 77.0271 33.6529 83.459 41.6057 83.4404L66.7045 83.3816C74.6574 83.363 81.0894 76.9008 81.0707 68.9479L81.0135 44.5081C80.9949 36.5552 74.5327 30.1232 66.5798 30.1418Z",
					fill: "#F59E0B"
				}),
				(0, react_jsx_runtime.jsx)("path", {
					d: "M54 70.7969C61.732 70.7969 68 64.5289 68 56.7969C68 49.0649 61.732 42.7969 54 42.7969C46.268 42.7969 40 49.0649 40 56.7969C40 64.5289 46.268 70.7969 54 70.7969Z",
					stroke: "white",
					strokeWidth: "3.5"
				}),
				(0, react_jsx_runtime.jsx)("path", {
					d: "M44 46.7969L64 66.7969",
					stroke: "white",
					strokeWidth: "3.5",
					strokeLinecap: "round"
				})
			]
		});
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-attachment/src/FileCard.module.css.mjs
		const css$2 = ".gSkjMW_card{border:.5px solid var(--dsw-alias-border-l2,#0000001f);border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-input-major,transparent);box-sizing:border-box;text-align:left;align-items:center;gap:10px;width:240px;height:64px;padding:0 12px;display:inline-flex;position:relative}.gSkjMW_failed{border-color:var(--dsw-alias-state-error-primary,#d54941)}.gSkjMW_icon{flex:none;justify-content:center;align-items:center;width:28px;height:28px;display:inline-flex}.gSkjMW_spinner{corner-shape:round;border:2px solid;border-top-color:#0000;border-radius:50%;width:20px;height:20px;animation:.8s linear infinite gSkjMW_file-card-spin}@keyframes gSkjMW_file-card-spin{to{transform:rotate(360deg)}}.gSkjMW_body{flex-direction:column;flex:1;min-width:0;padding:8px 0;display:flex}.gSkjMW_retry{color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;padding:0}.gSkjMW_name{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px;overflow:hidden}.gSkjMW_meta{white-space:nowrap;text-overflow:ellipsis;color:var(--dsw-alias-label-tertiary,#00000073);font-size:12px;line-height:15px;overflow:hidden}.gSkjMW_metaFailed{color:var(--dsw-alias-state-error-primary,#d54941)}.gSkjMW_remove{corner-shape:round;background:var(--dsw-alias-button-contrast-fill,#000000b8);width:18px;height:18px;color:var(--dsw-alias-label-primary-inverted,#fff);opacity:0;cursor:pointer;border:none;border-radius:50%;justify-content:center;align-items:center;padding:0;transition:opacity .2s ease-in-out;display:inline-flex;position:absolute;top:6px;right:6px}.gSkjMW_card:hover .gSkjMW_remove,.gSkjMW_remove:focus-visible{opacity:1}@media (pointer:coarse){.gSkjMW_remove{opacity:1}}@media (prefers-reduced-motion:reduce){.gSkjMW_remove{transition:none}}.gSkjMW_card:hover .gSkjMW_name,.gSkjMW_card:focus-within .gSkjMW_name{padding-right:18px}.gSkjMW_removeFailed{background:var(--dsw-alias-state-error-primary,#d54941);color:#fff;opacity:1}.gSkjMW_progressTrack{background:var(--dsw-alias-fill-tertiary,#00000014);border-radius:1px;height:2px;position:absolute;bottom:5px;left:12px;right:12px;overflow:hidden}.gSkjMW_progressBar{border-radius:inherit;background:var(--dsw-alias-brand-primary,#4d6bfe);width:35%;height:100%;animation:1.2s ease-in-out infinite alternate gSkjMW_file-card-progress;display:block}.gSkjMW_progressBar[style]{animation:none}@keyframes gSkjMW_file-card-progress{0%{transform:translate(-70%)}to{transform:translate(220%)}}@media (pointer:coarse){.gSkjMW_remove{opacity:1}}";
		const tagId$2 = "@deepseek-ai/dsh-client-ui-attachment/FileCard.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-attachment";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var FileCard_module_css_default = {
			"body": "gSkjMW_body",
			"card": "gSkjMW_card",
			"failed": "gSkjMW_failed",
			"file-card-progress": "gSkjMW_file-card-progress",
			"file-card-spin": "gSkjMW_file-card-spin",
			"icon": "gSkjMW_icon",
			"meta": "gSkjMW_meta",
			"metaFailed": "gSkjMW_metaFailed",
			"name": "gSkjMW_name",
			"progressBar": "gSkjMW_progressBar",
			"progressTrack": "gSkjMW_progressTrack",
			"remove": "gSkjMW_remove",
			"removeFailed": "gSkjMW_removeFailed",
			"retry": "gSkjMW_retry",
			"spinner": "gSkjMW_spinner"
		};
		//#endregion
		//#region lib/types/FileCard.js
		/** One pending file card: type glyph, name, size or upload status, remove, retry. */
		function FileCard({ name, bytes, state, progress, labels, onRemove, onRetry }) {
			const extension = (0, _deepseek_ai_dsh_client_ui_primitives.fileExtension)(name).toUpperCase().slice(0, 8);
			const meta = state === "uploading" ? labels.uploading : state === "error" ? labels.failed : [extension, (0, _deepseek_ai_dsh_client_ui_primitives.fileSizeText)(bytes)].filter((part) => part !== "").join(" ");
			const retryable = state === "error";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: `${FileCard_module_css_default.card}${retryable ? ` ${FileCard_module_css_default.failed}` : ""}`,
				title: name,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: FileCard_module_css_default.icon,
						"aria-hidden": true,
						children: state === "uploading" ? (0, react_jsx_runtime.jsx)("span", { className: FileCard_module_css_default.spinner }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, { path: name })
export {};
