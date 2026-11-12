/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
							workspaces: orderedWorkspaces,
							ungroupedSessionIds: orderedUngroupedSessionIds,
							workspaceReady,
							nestWorkspaces: groupBy === "workspace-tree",
							animationResetKey: `${groupBy}/${orderBy}/${archivedFilter}`,
							groupExpansion,
							setGroupExpanded: actions.setGroupExpanded,
							setSessionOrder: saveSessionOrder,
							rowState,
							onLeaveArchivedOnly: leaveArchivedOnly,
							startSession,
							open: guardedOpen,
							insertWorkspaceBefore,
							revealSessionId,
							onSessionRevealed: acknowledgeSessionReveal,
							home,
							t,
							onRenameRequest: (workspaceId, displayTitle) => {
								setRenameTarget({
									workspaceId,
									storedTitle: storedWorkspaces.find((w) => w.workspaceId === workspaceId)?.title ?? displayTitle
								});
								setRenameDraft(displayTitle);
								setRenameError(null);
							},
							onDeleteRequest: (workspaceId, title) => {
								setDeleteTarget({
									workspaceId,
									title
								});
								setDeleteError(null);
							}
						}))
					}),
					(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: renameTarget !== null,
						onClose: closeRename,
						closeLabel: t("close"),
						title: t("rename.workspace.title"),
						footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: renaming,
							onClick: closeRename,
							children: t("cancel")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							disabled: renameBlocked,
							onClick: confirmRename,
							children: t("rename")
						})] }),
						children: [
							(0, react_jsx_runtime.jsx)("input", {
								className: WorkspaceBrowser_module_css_default.renameInput,
								value: renameDraft,
								"aria-label": t("field.workspaceName"),
								"data-modal-autofocus": true,
								disabled: renaming,
								onFocus: (e) => {
									e.target.select();
								},
								onChange: (e) => {
									setRenameDraft(e.target.value);
									setRenameError(null);
								},
								onCompositionStart: () => {
									composingRef.current = true;
								},
								onCompositionEnd: () => {
									composingRef.current = false;
								},
								onKeyDown: (e) => {
									if (e.key === "Enter" && !composingRef.current) {
										e.preventDefault();
										confirmRename();
									}
								}
							}),
							renameDuplicate && (0, react_jsx_runtime.jsx)("div", {
								className: WorkspaceBrowser_module_css_default.renameError,
								role: "alert",
								children: t("conflict.named", { name: renameTrimmed })
							}),
							renameError !== null && (0, react_jsx_runtime.jsx)("div", {
								className: WorkspaceBrowser_module_css_default.renameError,
								role: "alert",
								children: renameError
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== null,
						onClose: closeDelete,
						closeLabel: t("close"),
						title: t("delete.workspace"),
						...deleteTarget === null ? {} : { description: t("delete.desc", { name: deleteTarget.title }) },
						footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							disabled: deleting,
							onClick: closeDelete,
							children: t("cancel")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							className: WorkspaceBrowser_module_css_default.deleteAction,
							disabled: deleting,
							onClick: confirmDelete,
							children: t("delete.workspace")
						})] }),
						children: [deleting && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.deleteStatus,
							role: "status",
							children: t("delete.pending")
						}), deleteError !== null && (0, react_jsx_runtime.jsx)("div", {
							className: WorkspaceBrowser_module_css_default.renameError,
							role: "alert",
							children: deleteError
						})]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/session-actions/ArchiveSession.js
		/**
		* The archive action: a `sidebar.workspaces.session.menu.item` row and a
		* `sidebar.workspaces.session.row.action` button over one injected behavior,
		* plus the `shell.overlay` dialog that confirms stopping a Session's running
		* work before archiving it. The same entries restore an archived row; the
		* notice a successful archive raises and the diagnostics for Host rejections
		* live in the injected callbacks, not here.
		*/
		/**
		* Menu row (order 400): archive, or restore an archived row.
		* @param props - owner share, the archive share, and the menu open state.
		* @returns the row.
		*/
		function ArchiveSessionMenuItem({ sessionId, useArchived, useMenuOpenState, useShortcuts, archiveSession, unarchiveSession, t }) {
			const [, setMenuOpen] = useMenuOpenState();
			const shortcut = useShortcuts((rows) => rows.find((row) => row.id === "session.archive"));
			const archived = useArchived((set) => set.has(sessionId));
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				shortcut: archived ? void 0 : shortcut,
				icon: archived ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUnarchiveOutlineRegular, { size: 14 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 }),
				onSelect: () => {
					setMenuOpen(false);
					(archived ? unarchiveSession : archiveSession)(sessionId);
				},
				children: t(archived ? "menu.unarchiveSession" : "menu.archiveSession")
			});
		}
		/**
		* Hover button (order 100): archive, or restore an archived row.
		* @param props - owner share and the archive share.
		* @returns the button.
		*/
		function ArchiveSessionRowButton({ sessionId, useArchived, archiveSession, unarchiveSession, t }) {
			const archived = useArchived((set) => set.has(sessionId));
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: t(archived ? "actions.unarchive" : "actions.archive"),
				side: "bottom",
				align: "end",
				delayMs: 500,
				portal: true,
				children: (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: Rows_module_css_default.iconButton,
					"aria-label": t(archived ? "menu.unarchiveSession" : "menu.archiveSession"),
					onClick: () => {
						(archived ? unarchiveSession : archiveSession)(sessionId);
					},
					children: archived ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconUnarchiveOutlineRegular, { size: 14 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconArchiveOutlineRegular, { size: 14 })
				})
			});
		}
		/**
		* The `shell.overlay` entry: nothing while no confirmation is pending,
		* otherwise one dialog per request (keyed by the Session). Confirming asks
		* the Host to stop the listed work and archive; cancelling leaves the
		* Session running and visible.
		* @param props - the request hook, its settlement, the stop-and-archive hop, and the locale seat.
		* @returns the open dialog, or null.
		*/
		function SessionArchiveConfirmDialog({ useArchiveRequest, settleSessionArchive, stopAndArchiveSession, t }) {
			const request = useArchiveRequest((pending) => pending);
			if (request === null) return null;
			return (0, react_jsx_runtime.jsx)(ArchiveConfirmForm, {
				request,
				stopAndArchiveSession,
				onSettle: settleSessionArchive,
				t
			}, request.sessionId);
		}
		/** One request's dialog: in-flight and error state die with it. */
		function ArchiveConfirmForm({ request, stopAndArchiveSession, onSettle, t }) {
			const [archiving, setArchiving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const close = () => {
				if (archiving) return;
				onSettle();
			};
			const confirm = () => {
				setArchiving(true);
				setError(null);
				stopAndArchiveSession(request.sessionId).then(() => {
					setArchiving(false);
					onSettle();
				}).catch((reason) => {
					setArchiving(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose: close,
				closeLabel: t("close"),
				title: t("archive.confirm.title"),
				description: t("archive.confirm.desc", { title: request.displayTitle }),
				footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					disabled: archiving,
					onClick: close,
					children: t("cancel")
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					className: WorkspaceBrowser_module_css_default.deleteAction,
					disabled: archiving,
					onClick: confirm,
					children: t("archive.confirm.action")
				})] }),
				children: [
					(0, react_jsx_runtime.jsx)("ul", {
						className: WorkspaceBrowser_module_css_default.archiveActivity,
						"aria-label": t("archive.confirm.activity"),
						children: request.activity.map((entry, index) => (0, react_jsx_runtime.jsx)("li", { children: activityLine(entry, t) }, `${entry.kind}-${String(index)}`))
					}),
					archiving && (0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.deleteStatus,
						role: "status",
						children: t("archive.confirm.pending")
					}),
					error !== null && (0, react_jsx_runtime.jsx)("div", {
						className: WorkspaceBrowser_module_css_default.renameError,
						role: "alert",
						children: error
					})
				]
			});
		}
		/**
		* One family's line: its count and the items' labels (ids when a family
		* carries no label). A family this dictionary does not know — a provider
		* merged into the kind map — falls through to the generic line.
		*/
		function activityLine(entry, t) {
			const items = entry.items ?? [];
			const n = items.length;
			const names = items.map((item) => item.label ?? item.id).join(t("archive.confirm.listSeparator"));
			const plural = n === 1 ? "one" : "other";
			switch (entry.kind) {
				case "turn": return t("archive.confirm.turn");
				case "subagent": return t(`archive.confirm.subagents.${plural}`, {
					n,
					names
				});
				case "job": return t(`archive.confirm.jobs.${plural}`, {
					n,
					names
				});
				case "schedule": return t(`archive.confirm.schedules.${plural}`, {
					n,
					names
				});
				default: return t(`archive.confirm.other.${plural}`, {
					kind: entry.kind,
					n
				});
			}
		}
		//#endregion
		//#region lib/types/client/session-actions/derived.js
		/**
		* Project one observable into another, recomputing only when the source
		* snapshot changes identity, so consumers that select from the projection
		* (a Set lookup per row) never rebuild it per read.
		* @param source - the observable to project.
		* @param project - pure projection of one source snapshot.
		* @returns the projected observable, subscribing through the source.
		*/
		function derive(source, project) {
			let seen;
			let value;
			return {
				getSnapshot: () => {
					const snapshot = source.getSnapshot();
					if (value === void 0 || snapshot !== seen) {
						seen = snapshot;
						value = project(snapshot);
					}
					return value;
				},
				subscribe: (listener) => source.subscribe(listener)
			};
		}
		//#endregion
		//#region lib/types/client/session-actions/ForkSession.js
		/** The fork action: one `sidebar.workspaces.session.menu.item` row. */
		/**
		* Menu row (order 300): fork at the Session's last completed turn; the child
		* arrives through the Host list beside its source. Absent when the access
		* snapshot excludes `session/fork` for this Session.
		* @param props - owner share, menu open state, access Hook, and the fork share.
		* @returns the row, or nothing when the caller may not fork this Session.
		*/
		function ForkSessionMenuItem({ sessionId, useMenuOpenState, useShortcuts, useSessionAccess, forkSession, t }) {
			const [, setMenuOpen] = useMenuOpenState();
			const shortcut = useShortcuts((rows) => rows.find((row) => row.id === "session.fork"));
			if (!useSessionAccess(sessionId, "session/fork")) return null;
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				shortcut,
				icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconBranchOutlineRegular, {}),
				onSelect: () => {
					setMenuOpen(false);
					forkSession(sessionId);
				},
				children: t("menu.fork")
			});
		}
		//#endregion
		//#region lib/types/client/session-actions/PinSession.js
		/**
		* The pin action: a `sidebar.workspaces.session.menu.item` row and a
		* `sidebar.workspaces.session.row.action` button over one injected behavior.
		* Pin and archive are mutually exclusive on the Host, so the action reads both
		* sets and does not offer itself on an archived row; what a pin does beyond
		* the Host call (fronting the Session in its saved orders, the failure
		* notice) lives in the injected callbacks, not here.
		*/
		/** The row's pin and archive membership, one Set lookup each. */
		function usePinState({ sessionId, usePinned, useArchived }) {
			return {
				pinned: usePinned((pinned) => pinned.has(sessionId)),
				archived: useArchived((archived) => archived.has(sessionId))
			};
		}
		/**
		* Menu row (order 100): pin or unpin by the row's current state; absent on archived rows.
		* @param props - owner share, the pin share, and the menu open state.
		* @returns the row, or null for an archived Session.
		*/
		function PinSessionMenuItem(props) {
			const { sessionId, useMenuOpenState, pinSession, unpinSession, t } = props;
			const [, setMenuOpen] = useMenuOpenState();
			const { pinned, archived } = usePinState(props);
			if (archived) return null;
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuItemButton, {
				icon: pinned ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinOutlineRegular, {}),
				onSelect: () => {
					setMenuOpen(false);
					(pinned ? unpinSession : pinSession)(sessionId);
				},
				children: t(pinned ? "menu.unpinSession" : "menu.pinSession")
			});
		}
		/**
		* Hover button (order 200, rightmost: it lands where the rest-state pin marker sits); absent on archived rows.
		* @param props - owner share and the pin share.
		* @returns the button, or null for an archived Session.
		*/
		function PinSessionRowButton(props) {
			const { sessionId, pinSession, unpinSession, t } = props;
			const { pinned, archived } = usePinState(props);
			if (archived) return null;
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label: t(pinned ? "actions.unpin" : "actions.pin"),
				side: "bottom",
				align: "end",
				delayMs: 500,
				portal: true,
				children: (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: Rows_module_css_default.iconButton,
					"aria-label": t(pinned ? "menu.unpinSession" : "menu.pinSession"),
					onClick: () => {
						(pinned ? unpinSession : pinSession)(sessionId);
					},
					children: pinned ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinFillRegular, { size: 14 }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPinOutlineRegular, { size: 14 })
				})
			});
		}
		//#endregion
		//#region lib/types/client/session-actions/RenameSession.js
		/**
		* The rename action: a `sidebar.workspaces.session.menu.item` row that raises
		* the rename request, and the `shell.overlay` dialog entry that answers it.
		* The dialog lives outside the row menu because the row unmounts with the
		* menu; the browser raises the same request from a title double-click.
		*/
		/**
		* Menu row (order 200): ask for the rename dialog, seeded with the row's current title.
		* @param props - owner share, menu open state, and the rename share.
		* @returns the row.
export {};
