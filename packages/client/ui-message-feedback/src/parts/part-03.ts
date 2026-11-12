/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				}
				return surface;
			};
			ctx.effect(() => () => {
				for (const surface of surfaces.values()) surface.dispose();
				surfaces.clear();
			}, "ui-message-feedback: per-session surfaces");
			const feedbackUi = { openSession: (sessionId) => {
				surfaceFor(sessionId).dialog.open({ kind: "session" });
			} };
			ctx.provide("feedbackUi", feedbackUi);
			ctx.on("connection/reset", () => {
				for (const { feedback } of surfaces.values()) if (feedback.getSnapshot().status !== "cold") feedback.resync();
			});
			ctx.slots.inject("conversation.chat.assistant-actions", () => ctx.slots.register({
				name: "conversation.chat.assistant-actions",
				id: "feedback",
				order: 10,
				locale: NS,
				inject: (sessionId) => {
					const { feedback, dialog } = surfaceFor(sessionId);
					return {
						hooks: { feedback },
						ensure: () => feedback.ensure(),
						current: (messageId) => feedback.getSnapshot().items.get(messageId),
						retract: (messageId, rating) => feedback.retract(messageId, rating),
						openDialog: (messageId, rating) => {
							dialog.open({
								kind: "message",
								messageId,
								rating
							});
						}
					};
				}
			}, MessageFeedbackActions));
			ctx.slots.inject("conversation.input.overlay", () => ctx.slots.register({
				name: "conversation.input.overlay",
				id: "feedback-dialog",
				order: 2,
				locale: NS,
				inject: (sessionId) => {
					const { dialog } = surfaceFor(sessionId);
					return {
						hooks: { dialog: dialog.state },
						edit: (draft) => {
							dialog.edit(draft);
						},
						submit: () => dialog.submitDraft(),
						dismiss: () => {
							dialog.dismiss();
						},
						dismissFailure: () => {
							dialog.dismissFailure();
						},
						dismissToast: (seq) => {
							dialog.dismissToast(seq);
						}
					};
				}
			}, FeedbackDialog));
			ctx.inject(["commandUi"], (scope) => {
				scope.effect(() => scope.commandUi.decorate({
					name: "feedback",
					available: () => true,
					ui: {
						kind: "action",
						run: (session) => {
							feedbackUi.openSession(session.sessionId);
						}
					}
				}), "ui-message-feedback: /feedback decoration");
			});
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
