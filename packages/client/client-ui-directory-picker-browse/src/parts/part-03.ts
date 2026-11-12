/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
											filterPrefix: typedPrefix,
											pathEditing: draftPending
										})
									]
								}),
								loading && slowScan && (0, react_jsx_runtime.jsx)("div", {
									className: clsx(DirectoryBrowser_module_css_default.status, DirectoryBrowser_module_css_default.loadingFloat),
									role: "status",
									children: t("browser.loading")
								}),
								(parent?.truncated === true || child?.truncated === true) && (0, react_jsx_runtime.jsx)("div", {
									className: DirectoryBrowser_module_css_default.status,
									role: "status",
									children: t("browser.truncated")
								}),
								error !== null && (0, react_jsx_runtime.jsx)("div", {
									className: DirectoryBrowser_module_css_default.error,
									role: "alert",
									children: error
								})
							]
						}),
						(0, react_jsx_runtime.jsxs)("div", {
							className: DirectoryBrowser_module_css_default.footerBar,
							children: [
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }),
									disabled: parent === null || loading || parentInert || draftPending,
									onClick: () => {
										setFolderDraft("");
										setCreateError(null);
									},
									children: t("browser.newFolder")
								}),
								(0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: clsx(DirectoryBrowser_module_css_default.showHiddenToggle, showHidden && DirectoryBrowser_module_css_default.showHiddenToggleActive),
									"aria-pressed": showHidden,
									disabled: parentInert,
									onMouseDown: draftPending ? (event) => {
										event.preventDefault();
									} : void 0,
									onClick: () => {
										setShowHidden((prev) => !prev);
									},
									children: [t("browser.showHidden"), showHidden && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCheckOutlineRegular, { size: 14 })]
								}),
								(0, react_jsx_runtime.jsx)("span", { className: DirectoryBrowser_module_css_default.footerGap }),
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									className: clsx(DirectoryBrowser_module_css_default.footerAction),
									disabled: parentInert,
									onClick: onClose,
									children: t("browser.cancel")
								}),
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									className: clsx(DirectoryBrowser_module_css_default.footerAction),
									disabled: targetPath === null || loading || parentInert || draftPending,
									/* v8 ignore next -- narrowing guard: Open disables while no target exists. */
									onClick: () => {
										if (targetPath !== null) onOpen(targetPath);
									},
									children: t("browser.open")
								})
							]
						})
					]
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: folderDraft !== null,
					onClose: () => {
						if (!creatingFolder) setFolderDraft(null);
					},
					title: t("browser.newFolder"),
					className: clsx(DirectoryBrowser_module_css_default.createDialog),
					headless: true,
					children: (0, react_jsx_runtime.jsxs)("div", {
						className: DirectoryBrowser_module_css_default.createBody,
						children: [
							(0, react_jsx_runtime.jsx)("h3", {
								className: DirectoryBrowser_module_css_default.createTitle,
								children: t("browser.newFolder")
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: DirectoryBrowser_module_css_default.createIn,
								children: t("browser.createIn", { name: targetName })
							}),
							(0, react_jsx_runtime.jsx)("input", {
								className: DirectoryBrowser_module_css_default.createInput,
								value: folderDraft ?? "",
								"aria-label": t("browser.folderName"),
								placeholder: t("browser.untitledFolder"),
								"data-modal-autofocus": true,
								disabled: creatingFolder,
								onChange: (event) => {
									setFolderDraft(event.target.value);
								},
								...compositionGuard,
								onKeyDown: (event) => {
									if (event.key === "Enter" && !composingRef.current) {
										event.preventDefault();
										confirmCreate();
									}
									if (event.key === "Escape") {
										event.stopPropagation();
										if (!creatingFolder) setFolderDraft(null);
									}
								}
							}),
							createError !== null && (0, react_jsx_runtime.jsx)("div", {
								className: DirectoryBrowser_module_css_default.error,
								role: "alert",
								children: createError
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: DirectoryBrowser_module_css_default.createActions,
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									disabled: creatingFolder,
									onClick: () => {
										setFolderDraft(null);
									},
									children: t("browser.cancel")
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "primary",
									disabled: creatingFolder || folderDraft === null || folderDraft.trim() === "",
									onClick: confirmCreate,
									children: t("browser.create")
								})]
							})
						]
					})
				})]
			});
		}
		//#endregion
		//#region lib/types/client/flow.js
		/**
		* The browse picking occupant (package-internal; the `./client` surface
		* exposes only the Loader exports). Same-package tests exercise it directly
		* through this module.
		*/
		/**
		* Flow occupant: adapts the hole's owner conversation onto the browser
		* dialog — a confirmed directory is the picked path, dismissal is the
		* cancellation. Browse failures (unreadable targets, create conflicts) stay
		* inside the dialog's own alert surfaces, so the owner's `onError` arm is
		* never driven by this occupant.
		* @param props - owner conversation plus the injected browse face.
		* @returns the dialog element (renders nothing while closed).
		*/
		function BrowseDirectoryFlow(props) {
			return (0, react.createElement)(DirectoryBrowser, {
				open: props.open,
				busy: props.busy,
				listDirectory: props.listDirectory,
				createDirectory: props.createDirectory,
				t: props.t,
				onOpen: props.onPicked,
				onClose: props.onCancel
			});
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Locale namespace owning the browser dialog's copy. */
		const LOCALE_NS = "directory-browser";
		/** Required services (cordis fiber inject): the slot registry, workspace UI service, and locale. */
		const inject = [
			"slots",
			"uiWorkspace",
			"locale"
		];
		/**
		* Client plugin body: register the dialog's dictionaries and the browse flow
		* into both directory-flow holes through `slots.inject()` because the
		* ui-workspace entries may activate later or replace their declarations.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => {
				const disposers = [];
				const dictionaries = [["zh", {
					"browser.title": "选择工作区目录",
					"browser.home": "主目录",
					"browser.newFolder": "新建文件夹",
					"browser.folderName": "文件夹名称",
					"browser.createIn": "在\"{name}\"中新建文件夹",
					"browser.untitledFolder": "未命名文件夹",
					"browser.create": "创建",
					"browser.cancel": "取消",
					"browser.open": "打开",
					"browser.editPath": "编辑路径",
					"browser.loading": "加载中…",
					"browser.truncated": "文件夹过多，仅显示开头部分。",
					"browser.showHidden": "显示隐藏文件"
				}], ["en", {
					"browser.title": "Select Workspace Directory",
					"browser.home": "Home",
					"browser.newFolder": "New folder",
					"browser.folderName": "Folder name",
					"browser.createIn": "New folder in \"{name}\"",
					"browser.untitledFolder": "Untitled folder",
					"browser.create": "Create",
					"browser.cancel": "Cancel",
					"browser.open": "Open",
					"browser.editPath": "Edit path",
					"browser.loading": "Loading…",
					"browser.truncated": "Too many folders to list; only the beginning is shown.",
					"browser.showHidden": "Show hidden files"
				}]];
				try {
					for (const [locale, dict] of dictionaries) disposers.push(ctx.locale.register(LOCALE_NS, locale, dict));
				} catch (error) {
					for (const dispose of disposers.reverse()) dispose();
					throw error;
				}
				return () => {
					for (const dispose of disposers) dispose();
				};
			}, "directory-picker-browse: dialog dictionaries");
			const injected = () => ({
				listDirectory: (path, signal) => ctx.uiWorkspace.listDirectory(path, signal),
				createDirectory: (path, name) => ctx.uiWorkspace.createDirectory(path, name),
				t: ctx.locale.bind(LOCALE_NS)
			});
			ctx.slots.inject("conversation.hero.workspace.directoryFlow", () => ctx.slots.inject("sidebar.workspaces.directoryFlow", function* () {
				yield ctx.slots.register({
					name: "conversation.hero.workspace.directoryFlow",
					inject: injected
				}, BrowseDirectoryFlow);
				yield ctx.slots.register({
					name: "sidebar.workspaces.directoryFlow",
					inject: injected
				}, BrowseDirectoryFlow);
			}));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
