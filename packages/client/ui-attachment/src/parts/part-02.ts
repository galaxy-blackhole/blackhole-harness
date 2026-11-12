/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					}),
					retryable ? (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: `${FileCard_module_css_default.body} ${FileCard_module_css_default.retry}`,
						"aria-label": labels.retry,
						onClick: onRetry,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: FileCard_module_css_default.name,
							children: name
						}), (0, react_jsx_runtime.jsx)("span", {
							className: `${FileCard_module_css_default.meta} ${FileCard_module_css_default.metaFailed}`,
							children: meta
						})]
					}) : (0, react_jsx_runtime.jsxs)("span", {
						className: FileCard_module_css_default.body,
						"aria-label": labels.label,
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: FileCard_module_css_default.name,
							children: name
						}), (0, react_jsx_runtime.jsx)("span", {
							className: FileCard_module_css_default.meta,
							children: meta
						})]
					}),
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: retryable ? `${FileCard_module_css_default.remove} ${FileCard_module_css_default.removeFailed}` : FileCard_module_css_default.remove,
						"aria-label": labels.remove,
						onClick: onRemove,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillRegular, { size: 12 })
					}),
					state === "uploading" && (0, react_jsx_runtime.jsx)("span", {
						className: FileCard_module_css_default.progressTrack,
						"aria-hidden": true,
						children: (0, react_jsx_runtime.jsx)("span", {
							className: FileCard_module_css_default.progressBar,
							style: progress === void 0 ? void 0 : { width: `${String(Math.min(1, Math.max(0, progress)) * 100)}%` }
						})
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/labels.js
		/**
		* Resolve original-image lightbox strings from the conversation namespace.
		* @param t - conversation namespace translator.
		* @returns translated lightbox labels.
		*/
		function lightboxLabels(t) {
			return {
				dialog: t("image.preview"),
				close: t("image.closePreview")
			};
		}
		/**
		* Resolve historical message-image strings from the conversation namespace.
		* @param t - conversation namespace translator.
		* @returns translated message-image labels.
		*/
		function messageImageLabels(t) {
			return {
				image: t("image.label"),
				open: t("image.openOriginal"),
				openNamed: (label) => t("image.openOriginalLabel", { label }),
				loading: t("image.loading"),
				loadFailed: t("image.loadFailed"),
				lightbox: lightboxLabels(t)
			};
		}
		/**
		* Resolve the document-level drop invitation and its optional limits line.
		* @param t - conversation namespace translator.
		* @param accepting - whether the composer can accept dropped files.
		* @param limits - optional translated count and size values.
		* @returns translated drop-overlay labels.
		*/
		function dropOverlayLabels(t, accepting, limits) {
			if (!accepting) return { title: t("attachment.dropBlocked") };
			return {
				title: t("attachment.dropTitle"),
				desc: limits === void 0 ? void 0 : t("attachment.dropDesc", limits)
			};
		}
		/**
		* Resolve pending-file card strings from the conversation namespace.
		* @param t - conversation namespace translator.
		* @param name - browser file name interpolated into remove/retry labels.
		* @returns translated file-card labels.
		*/
		function fileCardLabels(t, name) {
			return {
				label: t("file.pending"),
				remove: t("file.remove", { name }),
				uploading: t("file.uploading"),
				failed: t("file.uploadFailed"),
				retry: t("file.retry", { name })
			};
		}
		/**
		* Resolve the mixed draft-attachment rail strings from the conversation namespace.
		* @param t - conversation namespace translator.
		* @returns translated attachment-rail labels.
		*/
		function attachmentRailLabels(t) {
			return {
				group: t("attachment.pending"),
				scrollLeft: t("attachment.scrollLeft"),
				scrollRight: t("attachment.scrollRight")
			};
		}
		//#endregion
		//#region lib/types/client/drop-events.js
		/**
		* Members of a drop that are directories. The `File` a directory drop yields
		* is indistinguishable from an empty file, so the entry API is the only
		* source of that fact; browsers without it report no directories.
		*/
		function droppedDirectories(dataTransfer, files) {
			const directories = /* @__PURE__ */ new Set();
			let fileIndex = 0;
			for (const item of dataTransfer.items) {
				if (item.kind !== "file") continue;
				const file = files[fileIndex++];
				if (typeof item.webkitGetAsEntry !== "function") continue;
				if (item.webkitGetAsEntry()?.isDirectory !== true) continue;
				if (file !== void 0) directories.add(file);
			}
			return directories;
		}
		/**
		* Install one attachment view's file-drop listeners.
		* @param canAcceptDrop - whether this view accepts the dropped files.
		* @param onAddFiles - attachment intake callback.
		* @param dragDepth - the view's retained nested-drag counter.
		* @param setDragActive - publish whether a file drag is active.
		* @returns cleanup for exactly these listeners.
		*/
		function installDocumentDropEvents(canAcceptDrop, onAddFiles, dragDepth, setDragActive) {
			const fileTransfer = (event) => {
				const dataTransfer = event.dataTransfer;
				if (dataTransfer === null || !dataTransfer.types.includes("Files")) return null;
				return dataTransfer;
			};
			const reset = () => {
				dragDepth.current = 0;
				setDragActive(false);
			};
			const onDragEnter = (event) => {
				if (fileTransfer(event) === null) return;
				event.preventDefault();
				dragDepth.current += 1;
				setDragActive(true);
			};
			const onDragOver = (event) => {
				const dataTransfer = fileTransfer(event);
				if (dataTransfer === null) return;
				event.preventDefault();
				dataTransfer.dropEffect = canAcceptDrop ? "copy" : "none";
			};
			const onDragLeave = (event) => {
				if (fileTransfer(event) === null) return;
				dragDepth.current = Math.max(0, dragDepth.current - 1);
				if (dragDepth.current === 0) setDragActive(false);
				const leftViewport = event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight;
				if ((event.target === document.documentElement || event.target === document.body) && leftViewport) reset();
			};
			const onDrop = (event) => {
				const dataTransfer = fileTransfer(event);
				if (dataTransfer === null) return;
				event.preventDefault();
				reset();
				if (canAcceptDrop) {
					const files = [...dataTransfer.files];
					onAddFiles(files, droppedDirectories(dataTransfer, files));
				}
			};
			document.addEventListener("dragenter", onDragEnter);
			document.addEventListener("dragover", onDragOver);
			document.addEventListener("dragleave", onDragLeave);
			document.addEventListener("drop", onDrop);
			window.addEventListener("dragend", reset);
			return () => {
				document.removeEventListener("dragenter", onDragEnter);
				document.removeEventListener("dragover", onDragOver);
				document.removeEventListener("dragleave", onDragLeave);
				document.removeEventListener("drop", onDrop);
				window.removeEventListener("dragend", reset);
			};
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-attachment/src/client/ComposerAttachments.module.css.mjs
		const css$1 = "._54WpYG_rail{min-width:0;margin-bottom:-6px;padding:2px 10px 0}._54WpYG_imageItem{width:64px;height:64px;position:relative}._54WpYG_thumbnail{border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-interactive-bg-hover);cursor:zoom-in;width:64px;height:64px;padding:0;overflow:hidden}._54WpYG_thumbnail img{object-fit:cover;width:100%;height:100%;display:block}._54WpYG_remove{z-index:1;corner-shape:round;background:var(--dsw-alias-button-contrast-fill);width:18px;height:18px;color:var(--dsw-alias-label-primary-inverted);cursor:pointer;opacity:0;border:none;border-radius:50%;place-items:center;padding:0;transition:opacity .2s ease-in-out;display:grid;position:absolute;top:4px;right:4px}._54WpYG_imageItem:hover ._54WpYG_remove,._54WpYG_remove:focus-visible{opacity:1}@media (pointer:coarse){._54WpYG_remove{opacity:1}}@media (prefers-reduced-motion:reduce){._54WpYG_remove{transition:none}}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-attachment/ComposerAttachments.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-attachment";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ComposerAttachments_module_css_default = {
			"imageItem": "_54WpYG_imageItem",
			"rail": "_54WpYG_rail",
			"remove": "_54WpYG_remove",
			"thumbnail": "_54WpYG_thumbnail"
		};
		//#endregion
		//#region lib/types/client/ComposerAttachments.js
		/** Draft image previews, pending-file cards, drop target, and original-image preview. */
		function ComposerAttachments({ attachments, canAcceptDrop, onAddFiles, onRemoveAttachment, uploads, onRetryFile, dropLimits, t }) {
			const [preview, setPreview] = (0, react.useState)(null);
			const [dragActive, setDragActive] = (0, react.useState)(false);
			const dragDepth = (0, react.useRef)(0);
			const closePreview = (0, react.useCallback)(() => {
				setPreview(null);
			}, []);
			(0, react.useEffect)(() => {
				if (preview !== null && !attachments.some((attachment) => attachment.id === preview.id)) setPreview(null);
			}, [attachments, preview]);
			(0, react.useEffect)(() => {
				return installDocumentDropEvents(canAcceptDrop, onAddFiles, dragDepth, setDragActive);
			}, [canAcceptDrop, onAddFiles]);
			const railItems = (0, react.useMemo)(() => attachments.map((attachment) => ({
				id: attachment.id,
				attachment
			})), [attachments]);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				dragActive && (0, react_jsx_runtime.jsx)(DropOverlay, {
					disabled: !canAcceptDrop,
					labels: dropOverlayLabels(t, canAcceptDrop, dropLimits)
				}),
				railItems.length > 0 && (0, react_jsx_runtime.jsx)("div", {
					className: ComposerAttachments_module_css_default.rail,
					children: (0, react_jsx_runtime.jsx)(AttachmentRail, {
						items: railItems,
						labels: attachmentRailLabels(t),
						renderItem: (item) => {
							const attachment = item.attachment;
							if (attachment.kind === "file") {
								const upload = uploads[attachment.id];
								return (0, react_jsx_runtime.jsx)(FileCard, {
									name: attachment.file.name || t("file.label"),
									bytes: attachment.file.size,
									state: upload === void 0 || upload.status === "uploading" ? "uploading" : upload.status === "ready" ? "ready" : "error",
									...upload?.status === "uploading" && upload.total !== void 0 && upload.total > 0 ? { progress: upload.loaded / upload.total } : {},
									labels: fileCardLabels(t, attachment.file.name),
									onRemove: () => {
										onRemoveAttachment(attachment.id);
									},
									onRetry: () => {
										onRetryFile(attachment.id);
									}
								});
							}
							return (0, react_jsx_runtime.jsxs)("div", {
								className: ComposerAttachments_module_css_default.imageItem,
								children: [(0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ComposerAttachments_module_css_default.thumbnail,
									title: t("image.openOriginal"),
									onClick: () => {
										setPreview(attachment);
									},
									children: (0, react_jsx_runtime.jsx)("img", {
										src: attachment.previewUrl,
										alt: attachment.file.name || t("image.pending")
									})
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: ComposerAttachments_module_css_default.remove,
									"aria-label": t("image.remove", { name: attachment.file.name }),
									onClick: () => {
										onRemoveAttachment(attachment.id);
									},
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillRegular, { size: 12 })
								})]
							});
						}
					})
				}),
				preview !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ImageLightbox, {
					src: preview.previewUrl,
					alt: preview.file.name || t("image.original"),
					labels: lightboxLabels(t),
					onClose: closePreview
				})
			] });
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-attachment/src/MessageImage.module.css.mjs
		const css = ".R_Yw7q_gallery{flex-wrap:wrap;gap:10px;max-width:100%;display:flex}.R_Yw7q_gallery[data-align=end]{justify-content:flex-end;align-self:flex-end}.R_Yw7q_gallery[data-align=start]{justify-content:flex-start;align-self:flex-start}.R_Yw7q_frame{border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-interactive-bg-hover);cursor:zoom-in;flex:none;place-items:center;min-width:44px;min-height:44px;padding:0;display:grid;overflow:hidden}.R_Yw7q_frame[data-variant=tile]{width:64px;min-width:64px;height:64px;min-height:64px}.R_Yw7q_frame img{object-fit:cover;width:100%;height:100%;display:block}.R_Yw7q_loading,.R_Yw7q_error{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.R_Yw7q_error{border:.5px solid var(--dsw-alias-border-l2-darkmode-thin);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-interactive-bg-hover-danger);cursor:pointer;max-width:240px;padding:10px 12px}.R_Yw7q_error[data-variant=tile]{border-radius:var(--dsw-radius-xl);width:64px;height:64px;padding:4px;overflow:hidden}.R_Yw7q_frame[data-variant=thumbnail],.R_Yw7q_error[data-variant=thumbnail]{box-sizing:border-box;border-radius:var(--dsw-radius-lg);place-items:center;width:48px;min-width:48px;height:48px;min-height:48px;padding:2px;display:grid;overflow:hidden}.R_Yw7q_frame[data-variant=thumbnail] img{object-fit:contain}.R_Yw7q_spinner{animation:.9s linear infinite R_Yw7q_spinner-rotate}@keyframes R_Yw7q_spinner-rotate{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.R_Yw7q_spinner{animation:none}}.R_Yw7q_frame:focus-visible,.R_Yw7q_error:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}";
		const tagId = "@deepseek-ai/dsh-client-ui-attachment/MessageImage.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-attachment";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var MessageImage_module_css_default = {
			"error": "R_Yw7q_error",
			"frame": "R_Yw7q_frame",
			"gallery": "R_Yw7q_gallery",
			"loading": "R_Yw7q_loading",
			"spinner": "R_Yw7q_spinner",
			"spinner-rotate": "R_Yw7q_spinner-rotate"
		};
		//#endregion
		//#region lib/types/MessageImage.js
		/** Display box for a lone image (DeepSeek Chat rule): long edge 240px with
		* the rendered aspect ratio clamped to [0.25, 4] — the overflow is cropped by
		* `object-fit: cover` — and never upscaled past the image's natural size. The
		* crop anchor keeps the top of very tall images and the left of very wide
		* ones, where the informative content usually starts. */
		function singleFit(dimensions) {
			const natural = dimensions.width / dimensions.height;
			const ratio = Math.min(4, Math.max(.25, natural));
			const box = ratio >= 1 ? {
				width: 240,
				height: 240 / ratio
			} : {
				width: 240 * ratio,
				height: 240
			};
			const scale = Math.min(1, dimensions.width / box.width, dimensions.height / box.height);
			return {
				width: Math.max(1, Math.round(box.width * scale)),
				height: Math.max(1, Math.round(box.height * scale)),
				objectPosition: natural < .25 ? "center top" : natural > 4 ? "left center" : "center"
			};
		}
		/** Intrinsic dimensions of one gallery entry; a preview's stay unknown until its intake probe resolved. */
		function dimensionsOf(image) {
			if ("attachment" in image) return image.attachment;
			return image.preview.width !== void 0 && image.preview.height !== void 0 ? {
				width: image.preview.width,
				height: image.preview.height
			} : void 0;
		}
		/**
		* Compact history renderer with retryable loading and click-to-open original
		* preview. A lone image renders at its `singleFit` size; an image among
		* several renders as a fixed 64px square tile. The preview arm displays its
		* local URL directly — no loader round-trip, no failure/retry surface.
		* List thumbnails use status icons with localized tooltips and accessible names.
		*
		* @param props.image - the durable reference to load, or the local preview to display.
		* @param props.load - session-authorized URL loader for the durable arm.
		* @param props.variant - lone image, cropped gallery tile, or uncropped list thumbnail.
		* @param props.labels - resolved strings (tooltip, loading, retry, lightbox).
		* @returns the bounded thumbnail button, or the retry control on failure.
		*/
		function MessageImage({ image, load, variant, labels }) {
			const preview = "preview" in image ? image.preview : void 0;
			const attachment = "attachment" in image ? image.attachment : void 0;
			const [loaded, setLoaded] = (0, react.useState)(() => attachment === void 0 ? null : load.peek?.(attachment) ?? null);
			const [error, setError] = (0, react.useState)(false);
			const [open, setOpen] = (0, react.useState)(false);
			const [attempt, setAttempt] = (0, react.useState)(0);
			const request = (0, react.useCallback)(() => {
				setAttempt((a) => a + 1);
			}, []);
			const close = (0, react.useCallback)(() => {
				setOpen(false);
			}, []);
			const dimensions = (0, react.useMemo)(() => dimensionsOf(image), [image]);
			const fit = (0, react.useMemo)(() => {
				if (variant !== "single") return void 0;
				return dimensions === void 0 ? {
					width: 240,
					height: 240,
					objectPosition: "center"
				} : singleFit(dimensions);
			}, [dimensions, variant]);
			(0, react.useEffect)(() => {
				if (attachment === void 0) return;
				let live = true;
				setError(false);
				setLoaded(load.peek?.(attachment) ?? null);
				load(attachment).then((url) => {
					if (live) setLoaded(url);
				}).catch(() => {
					if (live) setError(true);
				});
				return () => {
					live = false;
				};
			}, [
				attachment,
				load,
				attempt
			]);
			const src = preview?.url ?? loaded;
			const label = ("attachment" in image ? image.label : void 0) ?? preview?.name ?? attachment?.name ?? labels.image;
			const loadingThumbnail = variant === "thumbnail" && src === null;
			if (error) return (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: MessageImage_module_css_default.error,
				"data-variant": variant,
export {};
