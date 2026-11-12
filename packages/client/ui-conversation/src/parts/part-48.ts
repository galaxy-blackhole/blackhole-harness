/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			}, [
				promptError,
				showToast,
				t,
				imageLimits
			]);
			(0, react.useEffect)(() => {
				if (notice?.level === "error") showToast(notice.text);
			}, [notice, showToast]);
			const rowRef = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => {
				const row = rowRef.current;
				if (row === null) return;
				return observeControlRow(row);
			}, []);
			const cardRef = (0, react.useRef)(null);
			const scrollRef = (0, react.useRef)(null);
			const continuable = subagent?.address.mode === "continuable";
			const parentOffline = continuable && subagent.parentAvailable !== true;
			const disabled = removed || inert || !live || blocked !== void 0 || parentOffline;
			const locked = disabled;
			const modelSeatLocked = removed || inert || !live;
			const machineBusy = input?.phase === "adjudicating" || input?.phase === "submitting";
			const workspaceTrigger = inert && !removed && onRequestWorkspace !== void 0;
			const editorDisabled = removed || locked && !workspaceTrigger;
			const editable = live && !locked && !machineBusy;
			const steeringAvailable = subagent === null || subagent.address.mode === "continuable";
			const canSteerQueue = !locked && !machineBusy && !commandMenuOpen && empty && running && steeringAvailable && input.queue.length > 0;
			(0, react.useEffect)(() => {
				if (input === void 0 || inputActions === void 0) return;
				if (attachments.length !== input.attachmentIds.length) inputActions.pruneAttachments(attachments.map((attachment) => attachment.id));
			}, [
				attachments,
				input?.attachmentIds,
				inputActions
			]);
			const revealSelection = () => {
				revealDraftSelection(scrollRef);
			};
			(0, react.useEffect)(() => {
				if (locked || editor === null) return;
				focusDraftEditor(editor, revealSelection);
			}, [
				locked,
				sessionId,
				editor
			]);
			(0, react.useEffect)(() => {
				if (locked || draft === "") return;
				revealSelection();
			}, [draft !== ""]);
			(0, react.useEffect)(() => {
				return installDraftWheel(scrollRef);
			}, []);
			const intakeFiles = (0, react.useCallback)((files, directories) => {
				if (locked || machineBusy || subagent !== null && !continuable || addFiles === void 0 || files.length === 0) return;
				const rejected = (() => {
					if (continuable && files.some((file) => directories?.has(file) || !isImageMediaType(file.type))) return t("image.unsupportedType");
					if (imageLimits !== void 0) {
						const mediaTypes = imageLimits.mediaTypes;
						const images = files.filter((file) => mediaTypes.includes(file.type));
						const imageAttachments = attachments.filter((attachment) => attachment.kind === "image");
						if (imageAttachments.length + images.length > imageLimits.maxImagesPerMessage) return t("image.tooMany", { count: imageLimits.maxImagesPerMessage });
						if (images.some((file) => file.size > imageLimits.maxImageBytes)) return t("image.fileTooLarge", { size: imageSizeText(imageLimits.maxImageBytes) });
						if (imageAttachments.reduce((sum, attachment) => sum + attachment.file.size, 0) + images.reduce((sum, file) => sum + file.size, 0) > imageLimits.maxMessageImageBytes) return t("image.totalTooLarge", { size: imageSizeText(imageLimits.maxMessageImageBytes) });
					}
					return addFiles(files, directories);
				})();
				if (rejected !== null) showToast(rejected);
			}, [
				locked,
				machineBusy,
				subagent,
				continuable,
				addFiles,
				attachments,
				imageLimits,
				showToast,
				t
			]);
			const canAcceptDrop = (subagent === null || continuable) && !locked && !machineBusy && addFiles !== void 0;
			const fileInputRef = (0, react.useRef)(null);
			const onPickFiles = (e) => {
				const picked = e.target.files === null ? [] : [...e.target.files];
				e.target.value = "";
				if (picked.length > 0) intakeFiles(picked);
			};
			const gate = (0, react.useRef)({
				locked,
				machineBusy,
				canSteerQueue,
				running,
				steeringAvailable,
				busyEnter,
				intakeFiles,
				uploadsPending,
				showToast,
				t,
				canAcceptDrop
			});
			gate.current = {
				locked,
				machineBusy,
				canSteerQueue,
				running,
				steeringAvailable,
				busyEnter,
				intakeFiles,
				uploadsPending,
				showToast,
				t,
				canAcceptDrop
			};
			(0, react.useEffect)(() => {
				if (keyboard === void 0) return;
				return installDraftFilePicker(keyboard, gate, fileInputRef);
			}, [keyboard]);
			(0, react.useEffect)(() => {
				if (editor === null || keyboard === void 0) return;
				return installDraftKeymap(editor, keyboard, gate);
			}, [editor, keyboard]);
			const keepFocus = (e) => {
				keepDraftFocus(e, editor);
			};
			const onCardMouseDown = (e) => {
				if (!editable || editor === null || e.button !== 0 || e.defaultPrevented) return;
				const target = e.target;
				if (!(target instanceof Element) || !e.currentTarget.contains(target)) return;
				if (target.closest("[data-composer-overlay]") !== null) return;
				if (scrollRef.current?.contains(target)) return;
				const control = target.closest("button, a, input, select, textarea, [role=\"button\"], [contenteditable], [tabindex]");
				if (control !== null && e.currentTarget.contains(control)) return;
				e.preventDefault();
				if (document.activeElement !== editor.getRootElement()) focusDraftEditor(editor, revealSelection);
			};
			const onToggleCommandMenu = () => {
				if (keyboard === void 0) return;
				if (editor !== null) focusDraftEditor(editor, revealSelection);
				toggleCommandMenu?.(keyboard.caretSpan());
			};
			const onWorkspaceKeyDown = (e) => {
				if (!workspaceTrigger) return;
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onRequestWorkspace();
				}
			};
			const primaryStops = running && subagent === null && (empty || blocked !== void 0);
			const primaryDisabled = primaryStops ? stop === void 0 : empty || disabled || machineBusy || uploadsPending;
			const interruptible = running && continuable;
			const primarySubmitMode = resolveSubmitMode(busyEnter, running, "enter", steeringAvailable);
			const plainMessageDraft = !empty && input?.phase === "plain" && !draft.trimStart().startsWith("/");
			const primaryLabel = primaryStops ? t("input.stop") : running && steeringAvailable && !disabled && !uploadsPending && plainMessageDraft ? t(primarySubmitMode === "steer" ? "input.send.steer" : "input.send.queue") : t("input.send");
			const onPrimary = () => {
				if (primaryStops) {
					stop?.();
					return;
				}
				if (keyboard === void 0) return;
				/* v8 ignore next -- defensive: the primary button is disabled for empty, disabled, and pending-upload states. */
				if (!empty && !disabled && !machineBusy && !uploadsPending) keyboard.submit(primarySubmitMode, "click");
			};
			const claimActive = (input?.phase === "claimed" || input?.phase === "submitting") && input.claim !== void 0 && draft.startsWith(input.claim.token);
			const rawHint = claimActive && input.claim.hint !== void 0 && draft.slice(input.claim.token.length).trim() === "" ? input.claim.hint : null;
			const hint = (() => {
				if (rawHint === null) return null;
				const commandName = input?.claim?.name ?? "";
				const hintKey = `hint.${commandName === "goal" && hasGoal ? "goal.active" : commandName}`;
				const translated = t(hintKey);
				return translated !== hintKey ? translated : rawHint;
			})();
			const placeholderText = placeholder ?? (parentOffline ? t("placeholder.parentOffline") : disabled ? t("placeholder.unavailable") : canSteerQueue ? t("placeholder.steerQueue") : planActive ? t("placeholder.plan") : t("placeholder.default"));
			return (0, react_jsx_runtime.jsxs)("div", {
				className: clsx(InputBar_module_css_default.root, variant === "hero" && InputBar_module_css_default.hero),
				children: [
					toast !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
						text: toast.text,
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {}),
						anchor: cardRef.current,
						onDone: dismissToast
					}, toast.seq),
					notice?.level === "info" && (0, react_jsx_runtime.jsx)("div", {
						className: InputBar_module_css_default.notice,
						role: "status",
						children: notice.text
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						ref: cardRef,
						className: clsx(InputBar_module_css_default.card, workspaceTrigger && InputBar_module_css_default.cardWorkspaceTrigger),
						"data-composer-card": true,
						onClick: workspaceTrigger ? onRequestWorkspace : void 0,
						onPointerDown: workspaceTrigger ? (e) => {
							e.stopPropagation();
						} : void 0,
						onMouseDown: onCardMouseDown,
						children: [
							sessionId !== void 0 && (0, react_jsx_runtime.jsx)("div", {
								className: InputBar_module_css_default.overlayAnchor,
								"data-composer-overlay": true,
								children: renderSlot("conversation.input.overlay", {})
							}),
							accessory !== void 0 && (0, react_jsx_runtime.jsx)("div", {
								className: InputBar_module_css_default.accessory,
								children: accessory
							}),
							renderSlot("conversation.input.attachments", {
								attachments,
								canAcceptDrop,
								onAddFiles: intakeFiles,
								onRemoveAttachment: (id) => {
									removeAttachment?.(id);
								},
								uploads,
								onRetryFile: (id) => {
									retryFileUpload?.(id);
								},
								dropLimits: imageLimits === void 0 ? void 0 : {
									count: imageLimits.maxImagesPerMessage,
									size: imageSizeText(imageLimits.maxImageBytes)
								}
							}),
							(0, react_jsx_runtime.jsx)(DraftEditor, {
								classNames: InputBar_module_css_default,
								editor,
								scrollRef,
								editable,
								editorDisabled,
								phase: input?.phase ?? "inert",
								placeholderText,
								ariaLabel: workspaceTrigger ? t("hero.chooseWorkspace") : placeholderText,
								workspaceTrigger,
								workspacePickerOpen,
								onWorkspaceKeyDown,
								hint,
								showPlaceholder: draft === "" && attachments.length === 0 && !claimActive
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								ref: rowRef,
								className: InputBar_module_css_default.row,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: InputBar_module_css_default.tools,
									hidden: activity,
									children: [
										(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: t("input.commands"),
											side: "top",
											delayMs: 500,
											children: (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: InputBar_module_css_default.add,
												"aria-label": t("input.commands"),
												"aria-haspopup": "listbox",
												"aria-expanded": commandMenuOpen,
												disabled: locked || toggleCommandMenu === void 0,
												onMouseDown: keepFocus,
												onClick: onToggleCommandMenu,
												children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineMedium, { size: 14 })
											})
										}),
										(0, react_jsx_runtime.jsx)("input", {
											ref: fileInputRef,
											type: "file",
											multiple: true,
											disabled: subagent !== null,
											hidden: true,
											onChange: onPickFiles
										}),
										(0, react_jsx_runtime.jsxs)("div", {
											className: InputBar_module_css_default.modes,
											children: [sessionId === void 0 ? null : renderSlot("conversation.input.permission", { locked }), sessionId === void 0 ? null : renderSlot("conversation.input.plan", { locked })]
										}),
										input === void 0 || sessionId === void 0 ? null : renderSlot("conversation.input.left", {})
									]
								}), (0, react_jsx_runtime.jsxs)("div", {
									className: clsx(InputBar_module_css_default.trailing, activity && InputBar_module_css_default.trailingActive),
									children: [
										(0, react_jsx_runtime.jsxs)("div", {
											className: InputBar_module_css_default.standardControls,
											hidden: activity,
											children: [input === void 0 || sessionId === void 0 ? null : renderSlot("conversation.input.right", {}), sessionId === void 0 ? null : renderSlot("conversation.input.model", { locked: modelSeatLocked })]
										}),
										input === void 0 || sessionId === void 0 ? null : (0, react_jsx_runtime.jsx)("div", {
											className: activity ? InputBar_module_css_default.activityExpanded : InputBar_module_css_default.activity,
											children: renderSlot("conversation.input.activity", {
												locked,
												onActiveChange: setActivity
											})
										}),
										interruptible && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: t("input.stop"),
											shortcutKeys: stopKeys,
											side: "top",
											delayMs: 500,
											disabled: stop === void 0,
											children: (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: InputBar_module_css_default.primary,
												"aria-label": t("input.stop"),
												disabled: stop === void 0,
												onMouseDown: keepFocus,
												onClick: stop,
												children: (0, react_jsx_runtime.jsx)("svg", {
													viewBox: "0 0 16 16",
													width: "16",
													height: "16",
													"aria-hidden": true,
													children: (0, react_jsx_runtime.jsx)("rect", {
														x: "3",
														y: "3",
														width: "10",
														height: "10",
														rx: "3",
														fill: "currentColor"
													})
												})
											})
										}),
										(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
											label: primaryStops ? t("input.stop") : primaryLabel,
											shortcutKeys: primaryStops ? stopKeys : void 0,
											side: "top",
											delayMs: 500,
											disabled: primaryDisabled,
											children: (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: InputBar_module_css_default.primary,
												"aria-label": primaryLabel,
												disabled: primaryDisabled,
												onMouseDown: keepFocus,
												onClick: onPrimary,
												children: primaryStops ? (0, react_jsx_runtime.jsx)("svg", {
													viewBox: "0 0 16 16",
													width: "16",
													height: "16",
													"aria-hidden": true,
													children: (0, react_jsx_runtime.jsx)("rect", {
														x: "3",
														y: "3",
														width: "10",
														height: "10",
														rx: "3",
														fill: "currentColor"
													})
												}) : (0, react_jsx_runtime.jsx)("svg", {
													viewBox: "0 0 16 16",
													width: "16",
													height: "16",
													"aria-hidden": true,
													children: (0, react_jsx_runtime.jsx)("path", {
														d: "M8.3125 0.980183C8.66767 1.0531 8.97902 1.20418 9.2627 1.43233C9.48724 1.61297 9.73029 1.85793 9.97949 2.10714L14.707 6.83468L13.293 8.24874L9 3.95577V15.0417H7V3.95577L2.70703 8.24874L1.29297 6.83468L6.02051 2.10714C6.26971 1.85793 6.51277 1.61297 6.7373 1.43233C6.97662 1.23986 7.28445 1.04402 7.6875 0.980183C7.8973 0.947006 8.1031 0.95516 8.3125 0.980183Z",
														fill: "currentColor"
													})
												})
											})
										})
									]
								})]
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: InputBar_module_css_default.dock,
						"data-composer-dock": true,
						children: [variant === "composer" && input !== void 0 && sessionId !== void 0 ? renderSlot("conversation.composer.dock", {}) : null, activity ? null : (0, react_jsx_runtime.jsx)(ContextMeter, {
							useProjection,
							t
						})]
					})
				]
			});
		});
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-conversation/src/client/skeleton/TodoPanel.module.css.mjs
		const css = ".lXshSW_root{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));max-width:calc(var(--dsh-composer-card-max-width) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-panel);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border:0;flex:none;margin:0 auto;overflow:hidden}.lXshSW_body{flex-direction:column;gap:8px;padding:6px 12px;display:flex}.lXshSW_header{text-align:left;cursor:pointer;background:0 0;border:none;align-items:center;gap:10px;width:100%;padding:0;display:flex}.lXshSW_lead{color:var(--dsw-alias-label-tertiary);flex:none;place-items:center;display:grid}.lXshSW_title{color:var(--dsw-alias-label-primary);flex:none;font-size:13px;font-weight:500;line-height:24px}.lXshSW_progress{min-width:0;color:var(--dsw-alias-label-tertiary);text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:13px;font-weight:400;line-height:20px;overflow:hidden}.lXshSW_chevron{color:var(--dsw-alias-label-tertiary);flex:none;place-items:center;display:grid}.lXshSW_list{flex-direction:column;gap:8px;max-height:180px;margin:0;padding:0;list-style:none;display:flex;overflow-y:auto}.lXshSW_item{min-width:0;color:var(--dsw-alias-label-secondary);align-items:center;gap:10px;font-size:13px;line-height:20px;display:flex}.lXshSW_glyph{flex:none;place-items:center;width:16px;height:16px;display:grid}.lXshSW_content{text-overflow:ellipsis;white-space:nowrap;min-width:0;overflow:hidden}";
		const tagId = "@deepseek-ai/dsh-client-ui-conversation/TodoPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-conversation";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var TodoPanel_module_css_default = {
			"body": "lXshSW_body",
			"chevron": "lXshSW_chevron",
			"content": "lXshSW_content",
			"glyph": "lXshSW_glyph",
			"header": "lXshSW_header",
			"item": "lXshSW_item",
			"lead": "lXshSW_lead",
			"list": "lXshSW_list",
			"progress": "lXshSW_progress",
			"root": "lXshSW_root",
			"title": "lXshSW_title"
		};
		//#endregion
		//#region lib/types/client/skeleton/TodoPanel.js
		/** Local exhaustiveness helper — client packages do not depend on `dsh-llm`. */
		/* v8 ignore next 3 -- closed-union backstop; only reached if status is forged */
		function assertNever(value) {
export {};
