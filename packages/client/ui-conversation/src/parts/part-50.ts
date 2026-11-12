/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					disposeLocale();
					disposeViews();
				};
			}, "ui-conversation: View selection");
			const stop = (sessionId) => {
				scopedConversation(sessions, sessionId).cancel().catch((_error) => {});
			};
			const stopShortcut = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)([]);
			ctx.inject(["shortcuts"], (scope) => {
				const fixedInputs = [
					{
						id: "fixed.send",
						label: () => t("input.send"),
						keys: ["Enter"],
						bindings: [{
							code: "Enter",
							modifiers: []
						}],
						group: "input"
					},
					{
						id: "fixed.newline",
						label: () => t("shortcut.newline"),
						keys: scope.shortcuts.describeBinding({
							code: "Enter",
							modifiers: ["shift"]
						}).keys,
						bindings: [{
							code: "Enter",
							modifiers: ["shift"]
						}],
						group: "input"
					},
					{
						id: "fixed.complementary",
						label: () => t("shortcut.complementary"),
						keys: scope.shortcuts.describeBinding({
							code: "Enter",
							modifiers: ["primary"]
						}).keys,
						bindings: [{
							code: "Enter",
							modifiers: ["control"]
						}, {
							code: "Enter",
							modifiers: ["meta"]
						}],
						group: "input"
					},
					{
						id: "fixed.slash",
						label: () => t("shortcut.slash"),
						keys: ["/"],
						bindings: [{
							code: "Slash",
							modifiers: []
						}],
						group: "input"
					},
					{
						id: "fixed.mention",
						label: () => t("shortcut.mention"),
						keys: ["@"],
						bindings: [{
							code: "Digit2",
							modifiers: ["shift"]
						}],
						group: "input"
					}
				];
				for (const command of fixedInputs) scope.effect(() => scope.shortcuts.registerFixed(command), `ui-conversation: ${command.id}`);
				scope.effect(() => installStopShortcut(scope.shortcuts, sessions, (binding) => uiConversation.binding(binding).openTurn, ctx.uiSession, stop), "ui-conversation: fixed stop input");
				scope.effect(() => {
					const command = {
						id: "response.stop",
						label: () => t("input.stop"),
						keys: ["Esc", "Esc"],
						bindings: [{
							code: "Escape",
							modifiers: []
						}],
						group: "input"
					};
					const dispose = scope.shortcuts.registerFixed(command);
					stopShortcut.set(command.keys);
					return () => {
						stopShortcut.set([]);
						dispose();
					};
				}, "ui-conversation: fixed stop reference");
			});
			const inputHub = new InputHub(ctx, t);
			const composerBlocks = new ComposerBlockRegistry();
			ctx.inject(["commandUi"], (scope) => {
				const commands = scope.get("commandUi");
				scope.effect(() => commands.register({
					name: "file",
					label: () => t("input.file"),
					icon: _deepseek_ai_dsh_client_ui_primitives.IconPaperclipOutlineRegular,
					available: (session) => inputHub.canPickFiles(session.sessionId),
					ui: {
						kind: "action",
						run: (session) => {
							inputHub.pickFiles(session.sessionId);
						}
					}
				}), "ui-conversation: File action");
			});
			ctx.uiSession.provide({
				hooks: ["conversation", "input"],
				props: ["inputActions"],
				resolve: (binding) => {
					trackBinding(binding);
					const shell = inputHub.shellFor(binding);
					const conversation = uiConversation.binding(binding);
					restoreView(binding.sessionId);
					return {
						hooks: {
							conversation: conversation.snapshot,
							input: shell.state
						},
						props: { inputActions: shell.actions }
					};
				}
			});
			const registerConversationRoot = () => slots.register({
				name: "main.conversation",
				children: { "conversation.header": {
					kind: "single",
					scope: "session-maybe"
				} }
			}, ConversationRoot);
			const registerConversationContent = () => slots.registerFactory({
				name: "conversation.content",
				scope: "session-maybe",
				locale: NS,
				children: {
					"conversation.session": {
						kind: "single",
						scope: "session"
					},
					"conversation.composer": {
						kind: "chain",
						scope: "session"
					},
					"conversation.composer.bar": {
						kind: "single",
						scope: "session-maybe"
					},
					"conversation.input.dock": {
						kind: "list",
						scope: "session"
					},
					"conversation.hero.brand.mark": {
						kind: "single",
						scope: "root"
					},
					"conversation.hero.workspace": {
						kind: "single",
						scope: "root"
					},
					"conversation.hero.agentPreset": {
						kind: "single",
						scope: "session-maybe"
					},
					"conversation.hero.options": {
						kind: "list",
						scope: "session"
					}
				},
				slots: {
					views: { scope: "session" },
					widthControls: { scope: "root" }
				},
				inject: (sessionId) => ({
					hooks: { composerBlock: sessionId === void 0 ? ABSENT_BLOCK : composerBlocks.storeFor(sessionId) },
					selectWorkspace: (workspaceId) => workspaceNavigation.openWorkspace(workspaceId, (nextId) => {
						if (sessionId !== void 0 && nextId !== sessionId) {
							const from = inputHub.shell(sessionId);
							const draft = from.draftSnapshot;
							const attachmentIds = from.snapshot.attachmentIds;
							const next = inputHub.shell(nextId);
							if (attachmentIds.length === 0 || next.addAttachments(attachmentIds)) {
								if (sessions.binding(nextId) === void 0) throw new Error(`ui-conversation: session "${nextId}" resolved no binding`);
								concreteConversation(ctx).rebindDraftFiles(nextId, attachmentIds);
								if (draft.text !== "") {
									next.setDraft(draft);
									from.setDraft("");
								}
								if (attachmentIds.length > 0) for (const id of attachmentIds) from.removeAttachment(id);
							}
						}
					})
				})
			}, ConversationContent);
			const registerConversationSession = () => slots.register({
				name: "conversation.session",
				children: { "conversation.view": {
					kind: "list",
					scope: "session"
				} },
				store: conversationStore,
				inject: (sessionId, actions) => {
					const openView = (view, focus) => {
						if (!viewTabs().some((tab) => tab.id === view)) return;
						activateView(sessionId, view);
						actions.openView(view, focus);
					};
					const inspectionTarget = () => uiConversation.views.entries().find((definition) => definition.toolCallFocus !== void 0 && conversationViews.getSnapshot().some((view) => view.id === definition.target));
					const inspectCall = (callId) => {
						const target = inspectionTarget();
						if (target?.toolCallFocus !== void 0) openView(target.target, target.toolCallFocus(callId));
					};
					return {
						hooks: {
							conversationViews,
							inspectCall: {
								getSnapshot: () => inspectionTarget() === void 0 ? void 0 : inspectCall,
								subscribe: (listener) => {
									const disposeViews = conversationViews.subscribe(listener);
									const disposeDefinitions = uiConversation.views.subscribe(listener);
									return () => {
										disposeViews();
										disposeDefinitions();
									};
								}
							}
						},
						bindDraftPersistence: (write) => inputHub.shell(sessionId).bindDraftPersistence(write),
						openView
					};
				}
			}, ConversationSession);
			const registerHeader = () => slots.register({
				name: "conversation.header",
				children: {
					"conversation.header.leading": {
						kind: "single",
						scope: "root"
					},
					"conversation.session.header": {
						kind: "single",
						scope: "session"
					}
				}
			}, ConversationHeader);
			const registerSessionHeader = () => slots.register({
				name: "conversation.session.header",
				locale: NS,
				children: {
					"conversation.session.header.lineage": {
						kind: "single",
						scope: "session"
					},
					"conversation.session.header.actions": {
						kind: "list",
						scope: "session"
					},
					"conversation.session.header.utilities": {
						kind: "list",
						scope: "session"
					},
					"conversation.session.header.corner": {
						kind: "single",
						scope: "session"
					}
				},
				store: conversationStore,
				inject: (sessionId, actions) => ({
					hooks: { conversationViews },
					open: (id) => {
						workspaceNavigation.openSession(id);
					},
					selectView: (view) => {
						activateView(sessionId, view);
						actions.setView(view);
					}
				})
			}, ConversationSessionHeader);
			const registerComposerBar = () => slots.register({
				name: "conversation.composer.bar",
				locale: NS,
				children: {
					"conversation.input.attachments": {
						kind: "single",
						scope: "session-maybe"
					},
					"conversation.input.overlay": {
						kind: "list",
						scope: "session"
					},
					"conversation.input.permission": {
						kind: "single",
						scope: "session"
					},
					"conversation.input.left": {
						kind: "list",
						scope: "session"
					},
					"conversation.input.plan": {
						kind: "single",
						scope: "session"
					},
					"conversation.input.right": {
						kind: "list",
						scope: "session"
					},
					"conversation.input.model": {
						kind: "single",
						scope: "session"
					},
					"conversation.input.activity": {
						kind: "single",
						scope: "session"
					},
					"conversation.composer.dock": {
						kind: "list",
						scope: "session"
					}
				},
				inject: (sessionId) => {
					if (sessionId === void 0) return {
						keyboard: void 0,
						addFiles: void 0,
						removeAttachment: void 0,
						resolveDraftAttachments: void 0,
						retryFileUpload: void 0,
						toggleCommandMenu: void 0,
						stop: void 0,
						hooks: {
							stopShortcut,
							busyEnter: submissionPolicy.busyEnter,
							fileUploads: ABSENT_FILE_UPLOADS,
							notices: ABSENT_NOTICES,
							lexicon: ABSENT_LEXICON,
							menuLauncher: ABSENT_MENU_LAUNCHER
						}
					};
					const conversation = concreteConversation(ctx);
					const shell = inputHub.shell(sessionId);
					const inputTriggers = inputHub.inputTriggers(sessionId);
					const bridge = hostPathBridge();
					return {
						keyboard: shell,
						addFiles: (files, directories = /* @__PURE__ */ new Set()) => {
							if (sessions.binding(sessionId) === void 0) return t("file.sessionUnavailable");
							if (shell.snapshot.phase === "adjudicating" || shell.snapshot.phase === "submitting") return t("attachment.dropBlocked");
							const uploads = [];
							const references = [];
							const cwd = sessions.list.getSnapshot().byId[sessionId]?.cwd;
							for (const file of files) {
								const directory = directories.has(file);
								if (bridge === void 0 && directory) return t("attachment.directoryDesktopOnly");
								const path = bridge?.pathFor(file) ?? "";
								if (directory && path === "") return t("attachment.pathUnavailable");
								if (path === "" || !directory && isImageMediaType(file.type)) {
									uploads.push(file);
									continue;
								}
								const relative = relativizeToCwd(path, cwd);
								const mention = formatFileMention({
									path: directory ? `${relative}/` : relative,
									kind: "file"
								}, false);
								if (mention === void 0) return t("attachment.pathUnsupported");
								const label = workspaceTitleOf(path) || file.name;
								references.push({
									source: "reference",
									ref: mention,
									label: directory ? `${label}/` : label,
									appearance: directory ? "folder" : "file",
									clipboardText: mention
								});
							}
							try {
								const drafts = conversation.createDrafts(sessionId, uploads);
								if (!shell.addFiles(references, drafts.map((draft) => draft.id))) {
									conversation.releaseDraftAttachments(drafts);
									return t("attachment.dropBlocked");
								}
								return null;
							} catch (error) {
								if (error instanceof UnsupportedImageMediaTypeError) return t("image.unsupportedType");
								return error instanceof Error ? error.message : String(error);
							}
						},
						removeAttachment: (id) => {
							if (shell.removeAttachment(id)) conversation.releaseDraftAttachment(id);
						},
						resolveDraftAttachments: (ids) => conversation.resolveDraftAttachments(ids),
						retryFileUpload: (id) => {
							if (sessions.binding(sessionId) !== void 0) conversation.retryFileUpload(sessionId, id);
						},
						toggleCommandMenu: inputTriggers === void 0 ? void 0 : (selection) => {
							shell.dismissPopup();
							const snapshot = shell.snapshot;
							inputTriggers.toggleSource("command", {
								trigger: "/",
								query: "",
								quoted: false,
export {};
