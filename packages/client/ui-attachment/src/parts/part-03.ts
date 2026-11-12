/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				title: variant === "thumbnail" ? labels.loadFailed : void 0,
				"aria-label": variant === "thumbnail" ? labels.loadFailed : void 0,
				onClick: request,
				children: variant === "thumbnail" ? (0, react_jsx_runtime.jsx)("span", {
					"aria-hidden": "true",
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {})
				}) : labels.loadFailed
			});
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: MessageImage_module_css_default.frame,
				"data-variant": variant,
				style: fit === void 0 ? void 0 : {
					width: fit.width,
					height: fit.height
				},
				title: loadingThumbnail ? labels.loading : labels.open,
				"aria-label": loadingThumbnail ? labels.loading : labels.openNamed(label),
				"aria-busy": loadingThumbnail || void 0,
				onClick: () => {
					if (src !== null) setOpen(true);
				},
				children: src === null ? (0, react_jsx_runtime.jsx)("span", {
					className: MessageImage_module_css_default.loading,
					"aria-hidden": loadingThumbnail || void 0,
					children: loadingThumbnail ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconLoadingOutlineRegular, { className: MessageImage_module_css_default.spinner }) : labels.loading
				}) : (0, react_jsx_runtime.jsx)("img", {
					src,
					alt: label,
					style: fit === void 0 ? void 0 : { objectPosition: fit.objectPosition }
				})
			}), open && src !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ImageLightbox, {
				src,
				alt: label,
				labels: labels.lightbox,
				onClose: close
			})] });
		}
		/** Wrapping image group shared by user and assistant history: a lone image
		* renders large unless its owner requests compact tiles or contained list thumbnails. */
		function ImageGallery({ images, load, align, compact = false, thumbnail = false, labels }) {
			if (images.length === 0) return null;
			const variant = thumbnail ? "thumbnail" : compact || images.length > 1 ? "tile" : "single";
			return (0, react_jsx_runtime.jsx)("div", {
				className: MessageImage_module_css_default.gallery,
				"data-align": align,
				children: images.map((image, index) => (0, react_jsx_runtime.jsx)(MessageImage, {
					image,
					load,
					variant,
					labels
				}, `${"attachment" in image ? image.attachment.attachmentId : image.preview.url}:${index}`))
			});
		}
		//#endregion
		//#region lib/types/client/MessageImages.js
		/** Official image gallery Factory and default image Slot adapter. */
		/**
		* Render a gallery with an authorized loader and caller-owned or default labels.
		* @param props - image sources, authorized loader, layout hints, optional labels, and Factory locale seat.
		* @returns the official gallery; no Session binding is needed by this component.
		*/
		function MessageImagesContent({ images, loadImage, align, compact = false, thumbnail = false, labels, t }) {
			return (0, react_jsx_runtime.jsx)(ImageGallery, {
				images,
				load: loadImage,
				align,
				compact,
				thumbnail,
				labels: (0, react.useMemo)(() => labels ?? messageImageLabels(t), [labels, t])
			});
		}
		/**
		* Fill a message, trajectory, or tool image position through the shared Content Factory.
		* @param props - Slot owner image data, authorized loader, and framework Factory renderer.
		* @returns the official gallery occurrence.
		*/
		function MessageImages({ images, loadImage, align, compact, thumbnail, renderFactorySlot }) {
			return renderFactorySlot("conversation.images.content", {
				images,
				loadImage,
				align,
				...compact === void 0 ? {} : { compact },
				...thumbnail === void 0 ? {} : { thumbnail }
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Slot registry required by the attachment presentation plugin. */
		const inject = ["slots"];
		/**
		* Register composer attachments and the shared gallery with its domain adapters.
		* @param ctx - client plugin context with the Slot registry.
		*/
		function apply(ctx) {
			ctx.slots.registerFactory({
				name: "conversation.images.content",
				scope: "root",
				locale: "conversation"
			}, MessageImagesContent);
			ctx.slots.inject("conversation.input.attachments", () => ctx.slots.register({
				name: "conversation.input.attachments",
				locale: "conversation"
			}, ComposerAttachments));
			ctx.slots.inject("conversation.chat.message.images", () => ctx.slots.register({
				name: "conversation.chat.message.images",
				priority: 100
			}, MessageImages));
			ctx.slots.inject("conversation.chat.user.images", () => ctx.slots.register({
				name: "conversation.chat.user.images",
				priority: 100
			}, MessageImages));
			ctx.slots.inject("conversation.trajectory.images", () => ctx.slots.register({
				name: "conversation.trajectory.images",
				priority: 100
			}, MessageImages));
			ctx.slots.inject("tool.call.images", () => ctx.slots.register({
				name: "tool.call.images",
				priority: 100
			}, MessageImages));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
