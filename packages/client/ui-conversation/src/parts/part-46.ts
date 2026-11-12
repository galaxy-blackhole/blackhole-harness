/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
							const title = last ? (0, react_jsx_runtime.jsx)("span", {
								className: clsx(ConversationRoot_module_css_default.crumb, summary.subagent && ConversationRoot_module_css_default.crumbSubagent, ConversationRoot_module_css_default.crumbCurrent),
								children: summary.displayTitle
							}) : (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: clsx(ConversationRoot_module_css_default.crumb, summary.subagent && ConversationRoot_module_css_default.crumbSubagent),
								onClick: () => {
									open(summary.id);
								},
								children: summary.displayTitle
							});
							const lineage = last || summary.subagent;
							const lineageOwner = {
								lineageSessionId: summary.id,
								displayTitle: summary.displayTitle,
								...last ? {} : { openTitle: () => {
									open(summary.id);
								} }
							};
							return (0, react_jsx_runtime.jsxs)("span", {
								className: ConversationRoot_module_css_default.crumbSeg,
								children: [index > 0 && (0, react_jsx_runtime.jsx)("span", {
									className: ConversationRoot_module_css_default.crumbSep,
									children: "/"
								}), lineage ? summary.subagent ? renderSlot("conversation.session.header.lineage", lineageOwner, { fallback: title }) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [title, renderSlot("conversation.session.header.lineage", lineageOwner, { fallback: null })] }) : title]
							}, summary.id);
						}), ancestry.length === 0 && (0, react_jsx_runtime.jsx)("span", {
							className: ConversationRoot_module_css_default.crumbCurrent,
							children: sessionId
						})]
					}), (0, react_jsx_runtime.jsx)("div", {
						className: ConversationRoot_module_css_default.headerActions,
						children: renderSlot("conversation.session.header.actions", {})
					})]
				}), (0, react_jsx_runtime.jsx)("div", {
					className: ConversationRoot_module_css_default.headerUtilities,
					children: renderSlot("conversation.session.header.utilities", {})
				})] }), (0, react_jsx_runtime.jsx)("div", {
					className: ConversationRoot_module_css_default.headerCorner,
					"data-conversation-header-corner": "",
					children: renderSlot("conversation.session.header.corner", {})
				})]
			}), showTabs && (0, react_jsx_runtime.jsx)("div", {
				className: ConversationRoot_module_css_default.tabs,
				role: "tablist",
				"data-conversation-tabs": "",
				children: tabs.map((viewTab) => (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					role: "tab",
					"aria-selected": viewTab.id === active?.id,
					className: clsx(ConversationRoot_module_css_default.tab, viewTab.id === active?.id && ConversationRoot_module_css_default.tabActive),
					onClick: () => {
						selectView(viewTab.id);
					},
					children: viewTab.label
				}, viewTab.id))
			})] });
		}
		/**
		* Renders the active Session view inside the resident scrollport and keeps
		* the input draft mirrored while blank Hero chrome is visible.
		* @param props - Strict Session input/store, view ledger, and render shares.
		* @returns the active view area, or null while the Session remains blank.
		*/
		function ConversationSession(props) {
			return (0, react_jsx_runtime.jsx)(DefaultConversationViews, { ...props });
		}
		//#endregion
		//#region lib/types/client/input/editor/ComposerContentEditable.js
		/**
		* The composer's contenteditable host: binds one shell-owned Lexical editor
		* to a resident div. Session-maybe by design — a null editor renders the
		* same DOM inert (the no-session Workspace-trigger state), so switching
		* between the two never swaps the element tree. Editability has ONE writer:
		* this component reflects the `editable` prop onto the editor; nothing else
		* calls setEditable.
		*/
		/**
		* Render the composer's editable surface.
		* @param props - editor binding, editability, and div passthroughs.
		* @returns the resident contenteditable div.
		*/
		function ComposerContentEditable({ editor, editable, ...rest }) {
			const ref = (0, react.useRef)(null);
			(0, react.useLayoutEffect)(() => {
				const el = ref.current;
				if (editor === null || el === null) return;
				editor.setRootElement(el);
				return () => {
					editor.setRootElement(null);
				};
			}, [editor]);
			(0, react.useLayoutEffect)(() => {
				if (editor !== null) editor.setEditable(editable);
			}, [editor, editable]);
			return (0, react_jsx_runtime.jsx)("div", {
				ref,
				contentEditable: editor !== null && editable,
				suppressContentEditableWarning: true,
				role: "textbox",
				"aria-multiline": "true",
				"data-composer-input": true,
				...rest
			});
		}
		//#endregion
		//#region lib/types/client/input/editor/DecoratorPortals.js
		/**
		* Decorator render loop: portals every decorator node's React face into its
		* host element (what @lexical/react's composer does internally, scoped to
		* this composer's needs). Chip DOM identity rides the NodeKey — text edits
		* around a chip never remount its portal.
		*/
		/**
		* Render every decorator's React face into its editor host element.
		* @param props - the editor to observe.
		* @returns the live portal set.
		*/
		function DecoratorPortals({ editor }) {
			const [decorators, setDecorators] = react.useState(() => editor === null ? {} : editor.getDecorators());
			react.useLayoutEffect(() => {
				if (editor === null) return;
				setDecorators(editor.getDecorators());
				return editor.registerDecoratorListener((next) => {
					setDecorators(next);
				});
			}, [editor]);
			if (editor === null) return null;
			return (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: Object.entries(decorators).map(([key, jsx]) => {
				const el = editor.getElementByKey(key);
				return el === null ? null : (0, react_dom.createPortal)(jsx, el, key);
			}) });
		}
		//#endregion
		//#region lib/types/client/input/editor/DraftEditor.js
		/**
		* Render the existing scrollport, editable surface, placeholder, and chip portals.
		* @param props - borrowed editor and presentation values; this component owns no Hooks.
		* @returns the existing text-area DOM without an additional wrapper.
		*/
		function DraftEditor({ classNames: css, editor, scrollRef, editable, editorDisabled, phase, placeholderText, ariaLabel, workspaceTrigger, workspacePickerOpen, onWorkspaceKeyDown, hint, showPlaceholder }) {
			return (0, react_jsx_runtime.jsx)("div", {
				ref: scrollRef,
				className: css.scroll,
				"data-input-scroll": true,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: css.grow,
					children: [
						(0, react_jsx_runtime.jsx)(ComposerContentEditable, {
							editor: workspaceTrigger ? null : editor,
							editable,
							className: clsx(css.input, editorDisabled && css.inputDisabled),
							"data-phase": phase,
							"aria-disabled": editorDisabled || void 0,
							"data-placeholder": placeholderText,
							"aria-label": ariaLabel,
							"aria-haspopup": workspaceTrigger ? "menu" : void 0,
							"aria-expanded": workspaceTrigger ? workspacePickerOpen : void 0,
							tabIndex: workspaceTrigger ? 0 : void 0,
							onKeyDown: workspaceTrigger ? onWorkspaceKeyDown : void 0,
							style: hint === null ? void 0 : { "--dsh-composer-hint": JSON.stringify(hint) }
						}),
						showPlaceholder && (0, react_jsx_runtime.jsx)("div", {
							"aria-hidden": true,
							className: css.placeholder,
							"data-composer-placeholder": true,
							children: placeholderText
						}),
						(0, react_jsx_runtime.jsx)(DecoratorPortals, { editor: workspaceTrigger ? null : editor })
					]
				})
			});
		}
		//#endregion
		//#region lib/types/client/input/editor/keymap.js
		/** Composition state a keydown can trust (see the module doc's Safari note). */
		function isComposingEvent(event, recentlyComposing) {
			return event.isComposing || event.keyCode === 229 || recentlyComposing();
		}
		/**
		* Register the composer keymap on one editor.
		* @param editor - the shell-owned editor.
		* @param handlers - bar-supplied behavior.
		* @returns the unregister disposer.
		*/
		function registerComposerKeymap(editor, handlers) {
			let composing = false;
			let composingUntil = 0;
			let rootElement = null;
			const syncComposition = () => {
				rootElement?.toggleAttribute("data-composer-composing", composing || editor.isComposing());
			};
			const onCompositionStart = () => {
				composing = true;
				syncComposition();
			};
			const onCompositionEnd = () => {
				composing = false;
				composingUntil = Date.now() + 10;
				editor.update(() => {}, { onUpdate: syncComposition });
			};
			const recentlyComposing = () => composing || Date.now() < composingUntil;
			const arrow = (key) => (event) => {
				const inComposition = event !== null && isComposingEvent(event, recentlyComposing);
				if (handlers.arbitrate(key, inComposition) !== "pass") {
					event?.preventDefault();
					return true;
				}
				return false;
			};
			return Eu(editor.registerRootListener((root, prevRoot) => {
				prevRoot?.removeEventListener("compositionstart", onCompositionStart);
				prevRoot?.removeEventListener("compositionend", onCompositionEnd);
				prevRoot?.removeAttribute("data-composer-composing");
				composing = false;
				composingUntil = 0;
				rootElement = root;
				root?.addEventListener("compositionstart", onCompositionStart);
				root?.addEventListener("compositionend", onCompositionEnd);
				syncComposition();
			}), editor.registerUpdateListener(syncComposition), editor.registerCommand(sn$2, arrow("up"), 4), editor.registerCommand(ln$2, arrow("down"), 4), editor.registerCommand(hn$2, (event) => arrow(event.shiftKey ? "tabBack" : "tab")(event), 4), editor.registerCommand(fn$1, (event) => {
				handlers.dismissPopup();
				if (handlers.arbitrate("escape", isComposingEvent(event, recentlyComposing)) === "consumed") {
					event.preventDefault();
					return true;
				}
				return false;
			}, 4), editor.registerCommand(an$1, (event) => {
				if (isComposingEvent(event, recentlyComposing)) return false;
				if (handlers.space()) {
					event.preventDefault();
					return true;
				}
				return false;
			}, 4), editor.registerCommand(cn$1, (event) => {
				if (event !== null && (event.altKey || event.getModifierState("AltGraph") || event.ctrlKey && event.metaKey || event.shiftKey && (event.ctrlKey || event.metaKey))) return true;
				if (event?.shiftKey === true) return false;
				if (event !== null && isComposingEvent(event, recentlyComposing)) return true;
				if (handlers.arbitrate("enter", false) !== "pass") {
					event?.preventDefault();
					return true;
				}
				event?.preventDefault();
				if (event?.repeat === true) return true;
				if (!handlers.canSubmit()) return true;
				handlers.submit(event?.ctrlKey === true || event?.metaKey === true);
				return true;
			}, 4), editor.registerCommand(Je$2, (event) => {
				const clipboardData = event.clipboardData ?? null;
				if (clipboardData === null) return false;
				const files = [];
				const directories = /* @__PURE__ */ new Set();
				for (const item of clipboardData.items) {
					if (item.kind !== "file") continue;
					const file = item.getAsFile();
					if (file === null) continue;
					files.push(file);
					if (typeof item.webkitGetAsEntry === "function" && item.webkitGetAsEntry()?.isDirectory === true) directories.add(file);
				}
				if (files.length > 0) handlers.intakeFiles(files, directories.size === 0 ? void 0 : directories);
				const text = clipboardData.getData("text/plain");
				if (text === "") {
					if (files.length === 0) return false;
					event.preventDefault();
					return true;
				}
				event.preventDefault();
				handlers.pasteText(text);
				return true;
			}, 4));
		}
		//#endregion
		//#region lib/types/client/input/editor/view-binding.js
		/**
		* Reveal the DOM selection within the draft's own scrollport.
		* @param scrollRef - the InputBar-owned scrollport reference.
		*/
		function revealDraftSelection(scrollRef) {
			const scrollEl = scrollRef.current;
			if (scrollEl === null || scrollEl.scrollHeight <= scrollEl.clientHeight) return;
			const selection = window.getSelection();
			if (selection === null || selection.rangeCount === 0) return;
			let rect = selection.getRangeAt(0).getBoundingClientRect();
			if (rect.height === 0 && rect.width === 0) {
				const anchor = selection.anchorNode;
				const el = anchor instanceof HTMLElement ? anchor : anchor?.parentElement;
				if (el === void 0 || el === null) return;
				rect = el.getBoundingClientRect();
			}
			const box = scrollEl.getBoundingClientRect();
			if (rect.bottom > box.bottom) scrollEl.scrollTop += rect.bottom - box.bottom;
			else if (rect.top < box.top) scrollEl.scrollTop -= box.top - rect.top;
		}
		/**
		* Focus the borrowed editor and reveal its restored selection.
		* @param editor - the Session-owned editor.
		* @param revealSelection - reveal the selection after Lexical restores it.
		*/
		function focusDraftEditor(editor, revealSelection) {
			editor.getRootElement()?.focus({ preventScroll: true });
			editor.focus(() => {
				revealSelection();
			});
		}
		/**
		* Forward wheel movement at the draft's edge to its conversation scrollport.
		* @param scrollRef - the InputBar-owned scrollport reference.
		* @returns the listener cleanup, or undefined when the element is absent.
		*/
		function installDraftWheel(scrollRef) {
			const el = scrollRef.current;
			if (el === null) return;
			const onWheel = (e) => {
				const host = el.closest("[data-conversation-scroll]");
				if (!(host instanceof HTMLElement) || e.deltaY === 0) return;
				const atTop = el.scrollTop <= 0;
				const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
				if (e.deltaY < 0 && !atTop || e.deltaY > 0 && !atEnd) return;
				e.preventDefault();
				host.scrollTop += e.deltaY;
			};
			el.addEventListener("wheel", onWheel, { passive: false });
			return () => {
				el.removeEventListener("wheel", onWheel);
			};
		}
		/**
		* Bind this view's file dialog through the existing keyboard face.
		* @param keyboard - the Session-owned composer operations.
		* @param gate - live intake availability retained by InputBar.
		* @param fileInputRef - the view's native file input.
		* @returns the picker unbind disposer.
		*/
		function installDraftFilePicker(keyboard, gate, fileInputRef) {
			return keyboard.bindFilePicker({
				available: () => gate.current.canAcceptDrop && fileInputRef.current !== null && !fileInputRef.current.disabled,
				open: () => {
					fileInputRef.current?.click();
				}
			});
		}
		/**
		* Bind editor gestures to the view's live guards and Session operations.
		* @param editor - the borrowed Session-owned editor.
		* @param keyboard - the existing composer keyboard operations.
		* @param gate - live view values read by the installed handlers.
		* @returns the keymap disposer.
		*/
		function installDraftKeymap(editor, keyboard, gate) {
			return registerComposerKeymap(editor, {
				arbitrate: (key, composing) => keyboard.arbitrate(key, composing),
				space: () => {
					if (gate.current.machineBusy || gate.current.locked) return false;
					return keyboard.space();
				},
				dismissPopup: () => {
					keyboard.dismissPopup();
				},
				canSubmit: () => !gate.current.locked && !gate.current.machineBusy,
				submit: (accelerated) => {
					const g = gate.current;
					if (accelerated && g.canSteerQueue) {
						keyboard.steerQueue();
						return;
					}
					if (g.uploadsPending) {
						g.showToast(g.t("file.stillUploading"));
						return;
					}
					keyboard.submit(resolveSubmitMode(g.busyEnter, g.running, accelerated ? "accelerated" : "enter", g.steeringAvailable), "enter");
				},
				intakeFiles: (files, directories) => {
					gate.current.intakeFiles(files, directories);
				},
				pasteText: (text) => {
					if (gate.current.machineBusy || gate.current.locked) return;
					keyboard.paste(text);
				}
			});
		}
		/**
		* Keep a toolbar press from moving focus away from the draft.
		* @param event - the toolbar button's mouse event.
		* @param editor - the borrowed editor, absent in the inert view.
		*/
		function keepDraftFocus(event, editor) {
			event.preventDefault();
			editor?.getRootElement()?.focus({ preventScroll: true });
		}
		//#endregion
		//#region lib/types/client/image-labels.js
		/** Attachment error and limit copy owned by the conversation input flow. */
		/**
		* Byte count as user-facing megabytes (`10MB`, `2.5MB`).
		* @param bytes - the byte count.
		* @returns the rounded megabyte text.
		*/
		function imageSizeText(bytes) {
			const mb = bytes / (1024 * 1024);
			return `${Number.isInteger(mb) ? String(mb) : mb.toFixed(1)}MB`;
export {};
