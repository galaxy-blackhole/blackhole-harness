/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					creatorDraft = startCreatorDraft;
					const chip = scope.slots.register({
						name: "conversation.hero.agentPreset",
						locale: "settings.agentPreset",
						inject: seatInjected
					}, AgentPresetSeat);
					const label = scope.slots.register({
						name: "conversation.session.header.actions",
						id: "agent-preset",
						order: -10,
						locale: "settings.agentPreset",
						inject: labelInjected
					}, AgentPresetLabel);
					return () => {
						creatorDraft = void 0;
						chip();
						label();
					};
				}, "ui-agent-preset: new-session chip and header label");
				scope.slots.inject("plugins.add.actions", () => scope.slots.register({
					name: "plugins.add.actions",
					id: "create-plugin",
					locale: "settings.agentPreset",
					inject: () => ({
						hooks: { agentPresets: controller.store },
						load: () => controller.load(),
						startCreatorDraft
					})
				}, CreatePluginMenuItem));
			});
			/** Capture the exact blank Session one Settings action may update. */
			const captureBlankSessionSync = () => {
				const summary = Object.values(ctx.sessions.list.getSnapshot().byId).find((session) => session.blank && (session.retainedBy.mainView ?? 0) > 0);
				const binding = summary === void 0 ? void 0 : ctx.sessions.binding(summary.id);
				const seat = binding === void 0 ? void 0 : seatFor(binding);
				const sessionId = seat?.blankSessionId();
				return async (id) => {
					if (seat === void 0 || sessionId === void 0 || binding === void 0 || seats.get(binding) !== seat) return void 0;
					return await seat.syncBlankSession(sessionId, id);
				};
			};
			const sectionInjected = () => ({
				hooks: {
					agentPresetSection: section.store,
					developerTools: ctx.configForms.developerTools.enabled
				},
				load: () => section.load(),
				view: (id) => section.view(id),
				closeView: () => {
					section.closeView();
				},
				...creatorDraft === void 0 ? {} : { startCreatorDraft: creatorDraft },
				makeDefault: (id) => section.makeDefault(id, captureBlankSessionSync())
			});
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "agent-presets",
				order: 20,
				label: () => ctx.locale.bind("settings.agentPreset")("nav"),
				locale: "settings.agentPreset",
				inject: sectionInjected
			}, AgentPresetSection));
		}
		//#endregion
		exports.AGENT_PRESET_SETTINGS_NS = AGENT_PRESET_SETTINGS_NS;
		exports.apply = apply;
		exports.inject = inject;
		exports.writeDefaultPreset = writeDefaultPreset;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
