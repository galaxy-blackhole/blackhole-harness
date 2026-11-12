/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
															target: row,
															...editorProps
														}, row.id) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("span", {
															className: Reference_module_css_default.rowActions,
															children: (0, react_jsx_runtime.jsx)(ShortcutIcon, { kind: "edit" })
														}), row.keys.length === 0 ? (0, react_jsx_runtime.jsx)("span", {
															className: Reference_module_css_default.unbound,
															children: t("unbound")
														}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ShortcutKeys, {
															keys: row.keys,
															className: Reference_module_css_default.keyBadge
														})] }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ShortcutKeys, {
															keys: row.keys,
															className: Reference_module_css_default.fixedKeyBadge
														})
													})
												]
											}, row.id))
										})]
									}, group);
								}), matches.length === 0 && (0, react_jsx_runtime.jsx)("p", {
									className: Reference_module_css_default.hint,
									role: "status",
									children: t("empty")
								})]
							}),
							(0, react_jsx_runtime.jsxs)("footer", {
								className: Reference_module_css_default.footer,
								children: [(0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: Reference_module_css_default.resetAll,
									disabled: busy || config.status !== "ready" || modifiedCount === 0,
									onClick: (event) => {
										event.currentTarget.focus();
										setTarget(null);
										setResetRevision(config.revision);
									},
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 12 }), t("reset-all")]
								}), modifiedCount > 0 && (0, react_jsx_runtime.jsx)("span", {
									className: Reference_module_css_default.modifiedCount,
									children: t("modified-count", { count: modifiedCount })
								})]
							})
						]
					})
				}),
				(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: open && resetRevision !== null,
					title: t("reset-title"),
					description: t("reset-description"),
					closeLabel: t("close-confirmation"),
					onClose: () => {
						if (!busy) setResetRevision(null);
					},
					footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						"data-modal-autofocus": true,
						disabled: busy,
						onClick: () => {
							setResetRevision(null);
						},
						children: t("cancel")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						disabled: busy || config.status !== "ready",
						onClick: () => {
							resetAll();
						},
						children: t("reset")
					})] })
				}),
				toast !== null && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Toast, {
					text: toast.text,
					onDone: dismissToast,
					icon: (0, react_jsx_runtime.jsx)(ShortcutIcon, {
						kind: toast.error ? "error" : "success",
						className: toast.error ? Reference_module_css_default.toastError : Reference_module_css_default.toastSuccess
					})
				}, toast.seq)
			] });
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Shortcut reference copy; only implemented operations appear in the catalog. */
		const zh = {
			"edit-label": "修改{command}快捷键",
			record: "按下快捷键",
			"record-help": "松开组合键即保存。Tab 切换操作，Esc 退出录键。",
			"web-help": "浏览器可用组合：Mod+/、Mod+Shift+,、Mod+Shift+.。Mod 在 Mac 上为 Command，其他系统为 Ctrl。",
			"unsupported-key": "暂不支持这个按键。",
			reserved: "此组合由系统或文本编辑操作保留。",
			"modifier-required": "请同时按下 Command、Ctrl 或 Alt 修饰键。",
			"too-many-keys": "最多同时按下两个非修饰键。请松开后重试。",
			"macos-web-help": "可设置 Command+/、Command+,、Command+反斜杠、Control+反引号、Command+Option+按键或 Command+Shift+按键。也支持三个或四个不同修饰键的组合。浏览器或系统占用的组合可能无法送达页面。",
			"windows-web-help": "可设置 Ctrl+/、Ctrl+,、Ctrl+Alt+按键或 Ctrl+Shift+按键。也支持三个或四个不同修饰键的组合。浏览器或系统占用的组合可能无法送达页面。",
			"unsupported-browser": "此浏览器暂不支持该组合。",
			conflict: "已被「{commands}」占用",
			saved: "已修改",
			clear: "移除",
			"retry-save": "重试保存",
			reset: "恢复默认",
			"reset-all": "恢复全部默认",
			"modified-count": "{count} 项已自定义",
			"reset-title": "恢复全部默认快捷键？",
			"reset-description": "将恢复当前平台的默认快捷键。你修改或移除的快捷键都会恢复，其他平台不受影响。",
			cancel: "取消",
			"reset-saved": "已恢复默认快捷键",
			"close-confirmation": "关闭确认",
			"reset-failed": "恢复默认失败。原快捷键已保留，请重试。",
			review: "已核对最新配置",
			stale: "快捷键配置或可用命令已更新。请核对最新键位后再保存。",
			"write-failed": "保存失败。原快捷键和当前草稿已保留，请重试。",
			"not-ready": "快捷键尚未准备好，请稍后重试。",
			read: "无法读取 {location}。请检查访问权限后{reload}。",
			invalid: "{location} 的快捷键配置内容损坏。请先备份并修复该配置，然后{reload}。",
			future: "{location} 的快捷键配置由更新版本创建。请升级 Harness 后重试。",
			"web-document": "当前网站本地存储中的 dsh.keybindings.v1",
			"desktop-document": "userData/keybindings.json",
			"web-reload": "刷新页面",
			"desktop-reload": "重新启动 Harness",
			"using-defaults": "当前使用默认键位。",
			"using-accepted": "当前继续使用上次读取成功的键位。",
			"native-failed": "无法启用桌面录键保护，请关闭后重试。",
			"global-hint": "全局唤起查看",
			"clear-search": "清空搜索",
			title: "快捷键",
			open: "快捷键速查",
			settings: "快捷键",
			view: "编辑快捷键",
			description: "查看和编辑当前可用的快捷键和输入操作",
			search: "搜索快捷键",
			close: "关闭快捷键",
			application: "应用操作",
			input: "消息输入",
			menus: "菜单与弹层",
			approval: "审批区域",
			unbound: "暂无快捷键",
			empty: "没有匹配的快捷键",
			move: "移动菜单选择",
			select: "选择菜单项",
			dismiss: "关闭菜单或顶层弹窗"
		};
		/** Typed English counterpart. */
		const en = {
			"edit-label": "Edit shortcut for {command}",
			record: "Press a shortcut",
			"record-help": "Release the keys to save. Tab moves between actions; Esc cancels.",
			"web-help": "Browser combinations: Mod+/, Mod+Shift+,, Mod+Shift+.. Mod is Command on Mac and Ctrl elsewhere.",
			"unsupported-key": "This key is not supported.",
			reserved: "This combination is reserved for system or text editing actions.",
			"modifier-required": "Include Command, Ctrl, or Alt in the combination.",
			"too-many-keys": "Hold at most two non-modifier keys. Release the keys to try again.",
			"macos-web-help": "Use Command+/, Command+,, Command+Backslash, Control+Backquote, Command+Option+key, or Command+Shift+key. Combinations with three or four distinct modifiers are also supported. Browser or system shortcuts may not reach the page.",
			"windows-web-help": "Use Ctrl+/, Ctrl+,, Ctrl+Alt+key, or Ctrl+Shift+key. Combinations with three or four distinct modifiers are also supported. Browser or system shortcuts may not reach the page.",
			"unsupported-browser": "This browser does not support this combination yet.",
			conflict: "Already used by “{commands}”",
			saved: "Modified",
			clear: "Remove",
			"retry-save": "Retry save",
			reset: "Restore default",
			"reset-all": "Restore all defaults",
			"modified-count": "{count} customized",
			"reset-title": "Restore all default shortcuts?",
			"reset-description": "Restore the default shortcuts for this platform. All modified or removed shortcuts will be restored. Other platforms are unaffected.",
			cancel: "Cancel",
			"reset-saved": "Default shortcuts restored",
			"close-confirmation": "Close confirmation",
			"reset-failed": "Could not restore defaults. Your shortcuts are unchanged. Please retry.",
			review: "I have reviewed the latest configuration",
			stale: "Shortcut configuration or available commands changed. Review the latest bindings before saving.",
			"write-failed": "Could not save. Your previous shortcuts and current draft are preserved. Please retry.",
			"not-ready": "Shortcuts are not ready. Please try again.",
			read: "Could not read {location}. Check access permissions, then {reload}.",
			invalid: "Shortcut configuration in {location} is damaged. Back up and repair this configuration, then {reload}.",
			future: "Shortcut configuration in {location} was created by a newer version. Upgrade Harness and try again.",
			"web-document": "this site’s localStorage entry dsh.keybindings.v1",
			"desktop-document": "userData/keybindings.json",
			"web-reload": "reload the page",
			"desktop-reload": "restart Harness",
			"using-defaults": "Default bindings are active.",
			"using-accepted": "The last successfully read bindings remain active.",
			"native-failed": "Could not protect desktop key recording. Exit recording and try again.",
			"global-hint": "Open from anywhere",
			"clear-search": "Clear search",
			title: "Keyboard shortcuts",
			open: "Open keyboard shortcuts",
			settings: "Keyboard shortcuts",
			view: "Edit shortcuts",
			description: "View and edit available shortcuts and input actions",
			search: "Search shortcuts",
			close: "Close keyboard shortcuts",
			application: "Application",
			input: "Message input",
			menus: "Menus and dialogs",
			approval: "Approval area",
			unbound: "No shortcut",
			empty: "No matching shortcuts",
			move: "Move menu selection",
			select: "Select menu item",
			dismiss: "Close menu or top dialog"
		};
		//#endregion
		//#region lib/types/client/fixed.js
		/**
		* Describe shared menu actions for display and conflict checking.
		* @param t - shortcut dictionary.
		* @returns read-only actions and each physical combination they occupy.
		*/
		function fixedCommands(t) {
			return [
				{
					id: "move",
					keys: ["↑", "↓"],
					bindings: [{
						code: "ArrowUp",
						modifiers: []
					}, {
						code: "ArrowDown",
						modifiers: []
					}],
					group: "menus"
				},
				{
					id: "select",
					keys: ["Enter"],
					bindings: [{
						code: "Enter",
						modifiers: []
					}],
					group: "menus"
				},
				{
					id: "dismiss",
					keys: ["Esc"],
					bindings: [{
						code: "Escape",
						modifiers: []
					}],
					group: "menus"
				}
			].map((row) => ({
				...row,
				id: `fixed.${row.id}`,
				label: () => t(row.id)
			}));
		}
		//#endregion
		//#region lib/types/client/index.js
		/** Required command, locale, and slot services. */
		const inject = [
			"shortcuts",
			"locale",
			"slots"
		];
		/**
		* Register the reference command, settings row, and single shell overlay.
		* @param ctx - plugin-owned client context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register("shortcuts", {
				zh,
				en
			}), "shortcuts: dictionaries");
			const t = ctx.locale.bind("shortcuts");
			const handle = createShortcutsStore();
			const instance = handle.create();
			const store = {
				...handle,
				create: () => instance
			};
			const edit = (...args) => ctx.shortcuts.edit(...args);
			const recording = (active) => ctx.shortcuts.recording(active);
			const describeBinding = (binding) => ctx.shortcuts.describeBinding(binding);
			for (const command of fixedCommands(t)) ctx.effect(() => ctx.shortcuts.registerFixed(command), `shortcuts: ${command.id}`);
			const injected = () => ({
				platform: ctx.shortcuts.platform,
				runtime: ctx.shortcuts.runtime,
				edit,
				recording,
				describeBinding,
				hooks: {
					catalog: ctx.shortcuts.catalog,
					config: ctx.shortcuts.config,
					fixedCatalog: ctx.shortcuts.fixedCatalog
				}
			});
			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "shortcuts",
				order: 16,
				locale: "shortcuts",
				store,
				inject: injected
			}, ShortcutsRow));
			ctx.slots.inject("shell.overlay", () => {
				const disposeCommand = ctx.shortcuts.register({
					id: "shortcuts.open",
					label: () => t("open"),
					aliases: ["shortcuts", "keyboard shortcuts"],
					defaults: {
						"desktop:macos": {
							code: "Slash",
							modifiers: ["primary"]
						},
						"desktop:windows": {
							code: "Slash",
							modifiers: ["primary"]
						},
						"desktop:linux": {
							code: "Slash",
							modifiers: ["primary"]
						},
						"web:macos": {
							code: "Slash",
							modifiers: ["primary"]
						},
						"web:windows": {
							code: "Slash",
							modifiers: ["primary"]
						},
						"web:linux": {
							code: "Slash",
							modifiers: ["primary"]
						}
					},
					regions: [
						"page",
						"editable",
						"terminal"
					],
					modals: ["settings", "shortcuts"],
					resolve: ({ modal }) => {
						if (modal !== null && modal !== "settings" && modal !== "shortcuts") return {
							status: "blocked",
							reason: "modal"
						};
						return {
							status: "handled",
							run: () => {
								if (modal === "shortcuts") (0, _deepseek_ai_dsh_client_ui_primitives.closeTopModal)(document);
								else instance.actions.open();
							}
						};
					}
				});
				const disposeSlot = ctx.slots.register({
					name: "shell.overlay",
					id: "shortcuts",
					locale: "shortcuts",
					store,
					inject: injected
				}, ShortcutReference);
				return () => {
					disposeCommand();
					disposeSlot();
				};
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
