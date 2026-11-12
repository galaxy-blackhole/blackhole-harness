/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			ctx.effect(() => () => {
				controller.dispose();
			}, "ui-plugin-market: controller");
			ctx.effect(() => {
				const disposers = [
					ctx.remote.$on("plugin-market/changed", () => {
						controller.sourcesChanged();
					}),
					ctx.remote.$on("plugin-manager/changed", () => {
						controller.bundlesChanged();
					}),
					ctx.on("connection/reset", () => {
						controller.sourcesChanged();
					})
				];
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "ui-plugin-market: host invalidations");
			const face = controller.face((text) => ctx.locale.resolveText(text));
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("plugins.tab", () => ctx.slots.register({
				name: "plugins.tab",
				id: "discover",
				label: () => t("title"),
				locale: NS,
				inject: () => face
			}, DiscoverSection));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
