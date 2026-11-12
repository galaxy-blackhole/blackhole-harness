/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
								position: snapshot.draft.slice(0, selection.start).trim() === "" ? "leading" : "inline",
								span: {
									...selection,
									draftRev: snapshot.draftRev
								}
							});
						},
						stop: () => {
							stop(sessionId);
						},
						hooks: {
							stopShortcut,
							busyEnter: submissionPolicy.busyEnter,
							fileUploads: conversation.fileUploads,
							notices: shell.notices,
							lexicon: shell.lexicon,
							menuLauncher: inputTriggers?.launcher ?? ABSENT_MENU_LAUNCHER
						}
					};
				}
			}, InputBar);
			slots.inject("main", function* () {
				yield slots.register({
					name: "main",
					key: "conversation",
					children: { "main.conversation": {
						kind: "single",
						scope: "session-maybe"
					} }
				}, ConversationPanel);
				yield registerConversationRoot();
				yield registerConversationContent();
				yield registerConversationSession();
				yield registerHeader();
				yield registerSessionHeader();
				yield registerComposerBar();
			});
			ctx.plugin(ConversationController, {
				input: inputHub,
				blocks: composerBlocks,
				maxConcurrentFileUploads
			});
			ctx.plugin(todoDockEntry);
			ctx.plugin(queueDockEntry);
		}
		//#endregion
		exports.Config = Config;
		exports.ConversationController = ConversationController;
		exports.ConversationDefinitionRegistry = ConversationDefinitionRegistry;
		exports.ConversationEventRegistry = ConversationEventRegistry;
		exports.ConversationLocationIndex = ConversationLocationIndex;
		exports.ConversationNodeAssembler = ConversationNodeAssembler;
		exports.ConversationViewRegistry = ConversationViewRegistry;
		exports.EMPTY_CONVERSATION_SNAPSHOT = EMPTY_CONVERSATION_SNAPSHOT;
		exports.UiConversation = UiConversation;
		exports.UnsupportedImageMediaTypeError = UnsupportedImageMediaTypeError;
		exports.apply = apply;
		exports.conversationPhase = conversationPhase;
		exports.inject = inject;
		exports.inspectRequestPrompt = inspectRequestPrompt;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
