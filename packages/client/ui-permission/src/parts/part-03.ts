/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				inject: injected
			}, PermissionRow));
			ctx.slots.inject("conversation.input.permission", () => ctx.slots.register({
				name: "conversation.input.permission",
				locale: PERMISSION_ACCESS_NS,
				inject: (sessionId) => ({
					hooks: { permissionCatalog: catalog.store },
					select: (preset) => submit(sessionId, preset)
				})
			}, PermissionSelect));
			ctx.effect(() => command.decorate({
				name: "permission",
				available: (session) => selectionOf(sessionFor(session)) !== void 0,
				ui: {
					kind: "popupSelect",
					options: async (session) => {
						const selection = selectionOf(sessionFor(session));
						if (selection === void 0) throw new Error("permission presets are not available on this host");
						return optionsOf(await catalog.load(), selection.currentValue, t);
					},
					onSelect: (option, session) => submit(session.sessionId, option.id).then(() => void 0)
				}
			}), "ui-permission: /permission decoration");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
