/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				unarchiveSession: async (sessionId) => {
					await uiWorkspace.unarchiveSession(sessionId);
				},
				createWorkspace: (input) => workspaces.create(input),
				requestSearch: shortcutControls.search,
				requestAddWorkspace: shortcutControls.add,
				closeAddWorkspace: shortcutControls.closeAdd,
				setDirectoryBusy: shortcutControls.directoryBusy,
				hooks: {
					directoryFlow: browserFlowSource,
					hostInfo,
					workspaceShortcuts: shortcutControls.state,
					shortcuts: ctx.shortcuts.catalog
				}
			});
			const pickerInjected = () => ({
				createWorkspace: (input) => workspaces.create(input),
				hooks: { directoryFlow: pickerFlowSource }
			});
			ctx.slots.inject("sidebar.workspaces", () => ctx.slots.register({
				name: "sidebar.workspaces",
				children: {
					"sidebar.workspaces.directoryFlow": {
						kind: "single",
						scope: "root"
					},
					"sidebar.workspaces.session.menu.item": {
						kind: "list",
						scope: "root",
						inject: { hooks: {
							menuOpenState: menuOpenStateFactory,
							shortcuts: ctx.shortcuts.catalog
						} }
					},
					"sidebar.workspaces.session.row.action": {
						kind: "list",
						scope: "root"
					},
					"sidebar.session.row.leading": {
						kind: "list",
						scope: "root"
					},
					"sidebar.session.row.hover": {
						kind: "list",
						scope: "root"
					}
				},
				store: viewStore,
				inject: browserInjected,
				locale: NS
			}, WorkspaceBrowser));
			ctx.slots.inject("sidebar.workspaces.session.menu.item", function* () {
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item",
					id: "pin",
					order: 100,
					locale: NS,
					inject: pinInjected
				}, PinSessionMenuItem);
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item",
					id: "rename",
					order: 200,
					locale: NS,
					inject: renameInjected
				}, RenameSessionMenuItem);
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item",
					id: "fork",
					order: 300,
					locale: NS,
					inject: forkInjected
				}, ForkSessionMenuItem);
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item",
					id: "archive",
					order: 400,
					locale: NS,
					inject: archiveInjected
				}, ArchiveSessionMenuItem);
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.menu.item",
					id: "session-id",
					order: 450,
					locale: NS,
					inject: sessionIdInjected
				}, SessionIdMenuItem);
			});
			ctx.slots.inject("sidebar.workspaces.session.row.action", function* () {
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.row.action",
					id: "archive",
					order: 100,
					locale: NS,
					inject: archiveInjected
				}, ArchiveSessionRowButton);
				yield ctx.slots.register({
					name: "sidebar.workspaces.session.row.action",
					id: "pin",
					order: 200,
					locale: NS,
					inject: pinInjected
				}, PinSessionRowButton);
			});
			ctx.slots.inject("shell.overlay", function* () {
				yield ctx.slots.register({
					name: "shell.overlay",
					id: "workspace.session-rename",
					locale: NS,
					inject: renameDialogInjected
				}, SessionRenameDialog);
				yield ctx.slots.register({
					name: "shell.overlay",
					id: "workspace.session-archive",
					locale: NS,
					inject: archiveConfirmInjected
				}, SessionArchiveConfirmDialog);
				yield ctx.slots.register({
					name: "shell.overlay",
					id: "workspace.row-toast",
					inject: rowToastInjected,
					children: { "workspace.toast": {
						kind: "keyed",
						scope: "root"
					} }
				}, RowActionToast);
			});
			ctx.slots.inject("conversation.hero.workspace", () => ctx.slots.register({
				name: "conversation.hero.workspace",
				children: { "conversation.hero.workspace.directoryFlow": {
					kind: "single",
					scope: "root"
				} },
				inject: pickerInjected,
				locale: NS
			}, WorkspacePicker));
		}
		/**
		* The activity a Host `workspace/session-active` refusal reported, or nothing
		* for any other failure. The class identity check goes by name: client plugin
		* bundles do not share error-class identity.
		*/
		function activeSessionRefusal(reason) {
			if (!(reason instanceof Error) || reason.name !== "WorkspaceArchiveError") return void 0;
			const { rpcError } = reason;
			return rpcError.code === "workspace/session-active" ? rpcError.details.activity : void 0;
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
export {};
