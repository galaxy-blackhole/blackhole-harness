/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		* Client plugin body: register the type, its dictionaries, its body, and its chip title.
		* @param ctx - client root context carrying the registry, slots, copy, and file readers.
		*/
		function apply(ctx) {
			const config = Config(globalThis.__DSH_DOCUMENT_PREVIEW_CONFIG__ ?? {});
			const previews = new DocumentPreviewRegistry();
			const disposePreviews = ctx.reflect.provide("documentPreviews", previews);
			ctx.effect(() => disposePreviews);
			ctx.effect(() => ctx.sidebarRightTabs.register(textDefinition()), "ui-sidebar-documentpreview: text type");
			ctx.effect(() => ctx.locale.register(NS, {
				zh: zh$7,
				en: en$7
			}), "ui-sidebar-documentpreview: dictionaries");
			const store = createTextStore();
			const face = textFace(createReadPage(ctx.remote), (file, signal) => ctx.remote.workspaceFiles.readBytes(file.sessionId, file.path, {}, signal), ctx.resources);
			const source = {
				getSnapshot: previews.getSnapshot,
				subscribe: previews.subscribe
			};
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
				name: "sidebar.right.pane.tab",
				key: TEXTPREVIEW_ID,
				locale: NS,
				store,
				children: {
					"sidebar.right.tab.document": {
						kind: "keyed",
						scope: "session",
						inject: { hooks: { tabInfo: documentTabInfoFactory } }
					},
					"sidebar.right.tab.document.actions": {
						kind: "list",
						scope: "session"
					},
					"sidebar.right.tab.document.unpreviewable": {
						kind: "list",
						scope: "session"
					},
					"sidebar.right.tab.document.action": {
						kind: "keyed",
						scope: "session",
						inject: { hooks: { tabInfo: documentTabInfoFactory } }
					}
				},
				inject: (sessionId, actions) => ({
					...face(sessionId, actions),
					hooks: { documentPreviews: source }
				})
			}, TextPreview)), "ui-sidebar-documentpreview: text body");
			ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab.title", () => ctx.slots.register({
				name: "sidebar.right.pane.tab.title",
				key: TEXTPREVIEW_ID
			}, TextTitle)), "ui-sidebar-documentpreview: text title");
			apply$9(ctx);
			apply$8(ctx);
			apply$6(ctx);
			apply$5(ctx);
			apply$4(ctx);
			apply$2(ctx, config.office);
			apply$1(ctx, config.excel);
			apply$3(ctx);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
