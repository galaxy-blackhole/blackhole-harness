/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
		* The address for a path as a caller holds it: a relative path, or an absolute
		* path inside the Session's workspace, becomes a `session`-scoped address; an
		* absolute path outside it, or one whose workspace root is unknown, keeps its
		* absolute path in that Session's address.
		* @param sessionId - the Session the path is read in.
		* @param cwd - that Session's workspace root, when known.
		* @param path - absolute or workspace-relative path, in either separator spelling.
		* @returns the `dsh-resource://file/…` address.
		*/
		function fileAddressFor(sessionId, cwd, path) {
			const normalized = path.replace(/\\/g, "/");
			if (!isAbsoluteWorkspacePath(normalized)) return sessionFileAddress(sessionId, normalized);
			const root = cwd === void 0 ? "" : cwd.replace(/\\/g, "/").replace(/\/+$/, "");
			if (root !== "" && normalized === root) return sessionFileAddress(sessionId, "");
			if (root !== "" && normalized.startsWith(`${root}/`)) return sessionFileAddress(sessionId, normalized.slice(root.length + 1));
			return sessionFileAddress(sessionId, normalized);
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-files/src/client/FilesBody.module.css.mjs
		const css = ".k-1LKG_root{height:100%;min-height:0;color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size-secondary,13px);flex-direction:column;flex:auto;line-height:1.5;display:flex}.k-1LKG_header{box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l3);flex:none;align-items:center;gap:4px;height:38px;padding:0 6px 0 16px;display:flex}.k-1LKG_path{margin-right:12px}.k-1LKG_body{scrollbar-gutter:stable;flex:auto;min-height:0;margin-right:2px;padding:8px 0 8px 8px;overflow:auto}.k-1LKG_body::-webkit-scrollbar-track{margin:2px}.k-1LKG_level{margin:0;padding:0;list-style:none}.k-1LKG_level .k-1LKG_level{padding-left:18px}.k-1LKG_item{margin:0;padding:0}.k-1LKG_row{width:100%;min-width:0;color:inherit;font:inherit;text-align:left;border-radius:var(--dsw-radius-md);cursor:pointer;background:0 0;border:0;align-items:center;gap:6px;padding:5px 10px;display:flex}.k-1LKG_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.k-1LKG_icon{color:var(--dsw-alias-label-tertiary);flex:none}.k-1LKG_fileIcon{flex:none}.k-1LKG_name{white-space:nowrap;text-overflow:ellipsis;min-width:0;overflow:hidden}.k-1LKG_other{color:var(--dsw-alias-label-tertiary);cursor:default}.k-1LKG_other:hover{background:0 0}.k-1LKG_note{color:var(--dsw-alias-label-tertiary);margin:0;padding:3px 10px;font-size:12px}.k-1LKG_status{flex-direction:column;padding:12px 10px;display:flex}.k-1LKG_statusLine{color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size-secondary,13px);margin:0;line-height:1.6}.k-1LKG_tool{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);cursor:pointer;background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:6px;line-height:1;display:inline-flex}.k-1LKG_tool svg{width:15px;height:15px}.k-1LKG_tool:hover,.k-1LKG_tool[aria-pressed=true]{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.k-1LKG_titleIcon{flex:none}";
		const tagId = "@deepseek-ai/dsh-client-ui-sidebar-files/FilesBody.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-files";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var FilesBody_module_css_default = {
			"body": "k-1LKG_body",
			"fileIcon": "k-1LKG_fileIcon",
			"header": "k-1LKG_header",
			"icon": "k-1LKG_icon",
			"item": "k-1LKG_item",
			"level": "k-1LKG_level",
			"name": "k-1LKG_name",
			"note": "k-1LKG_note",
			"other": "k-1LKG_other",
			"path": "k-1LKG_path",
			"root": "k-1LKG_root",
			"row": "k-1LKG_row",
			"status": "k-1LKG_status",
			"statusLine": "k-1LKG_statusLine",
			"titleIcon": "k-1LKG_titleIcon",
			"tool": "k-1LKG_tool"
		};
		//#endregion
		//#region lib/types/client/FilesBody.js
		/**
		* The file tree's body: the session's workspace root, listed one level at a time.
		*
		* Everything the tree keeps lives in its store, keyed by tab; everything it asks
		* for goes through its injected face. The component itself only decides what to
		* draw for each absolute path and what a click means: a directory toggles, a
		* file opens through the owner's `tabActions` for a `file:` viewer to claim, and
		* anything else is shown but refuses to open. The header uses the shared
		* PathLabel for the root, followed by reload and workspace directory actions.
		*/
		/** Natural, case-insensitive name order, so `file2` precedes `file10`. */
		const byName = new Intl.Collator(void 0, {
			numeric: true,
			sensitivity: "base"
		});
		/**
		* Order one level's entries for display: directories first, then everything
		* else, each group by name. The endpoint's order is a listing fact; this is the
		* reader's.
		* @param entries - the listing as the endpoint returned it.
		* @returns a new array, directories first, then by name within each group.
		*/
		function orderEntries(entries) {
			return [...entries].sort((left, right) => {
				const group = Number(right.type === "directory") - Number(left.type === "directory");
				return group !== 0 ? group : byName.compare(left.name, right.name);
			});
		}
		/**
		* Say why a directory could not be listed, in terms of the directory.
		* @param t - namespace-bound translate.
		* @param failure - the settled Remote failure.
		* @returns the line to show under the directory.
		*/
		function failureLine(t, failure) {
			switch (failure.code) {
				case "workspace-file/not-found": return t("error.notFound");
				case "workspace-file/outside-workspace": return t("error.outsideWorkspace");
				case "workspace-file/not-directory": return t("error.notDirectory");
				default: return t("error.unavailable", { message: failure.message });
			}
		}
		/** One entry's row, and its children when it is an expanded directory. */
		function Entry({ parent, entry, tree }) {
			const path = childPath(parent, entry.name);
			if (entry.type === "directory") {
				const expanded = tree.state.expanded.includes(path);
				return (0, react_jsx_runtime.jsxs)("li", {
					className: FilesBody_module_css_default.item,
					"data-files-entry": "directory",
					"data-files-path": path,
					children: [(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: FilesBody_module_css_default.row,
						"aria-expanded": expanded,
						onClick: () => {
							tree.onToggle(parent, path);
						},
						children: [expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderOpenRegular, { className: FilesBody_module_css_default.icon }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconFolderCloseRegular, { className: FilesBody_module_css_default.icon }), (0, react_jsx_runtime.jsx)("span", {
							className: FilesBody_module_css_default.name,
							children: entry.name
						})]
					}), expanded && (0, react_jsx_runtime.jsx)("ul", {
						className: FilesBody_module_css_default.level,
						children: (0, react_jsx_runtime.jsx)(Level, {
							path,
							tree
						})
					})]
				});
			}
			if (entry.type === "file") return (0, react_jsx_runtime.jsx)("li", {
				className: FilesBody_module_css_default.item,
				"data-files-entry": "file",
				"data-files-path": path,
				children: (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: FilesBody_module_css_default.row,
					onClick: () => {
						tree.onOpen(path);
					},
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
						kind: (0, _deepseek_ai_dsh_client_ui_primitives.classifyFileType)(entry.name),
						size: 16,
						className: FilesBody_module_css_default.fileIcon
					}), (0, react_jsx_runtime.jsx)("span", {
						className: FilesBody_module_css_default.name,
						children: entry.name
					})]
				})
			});
			return (0, react_jsx_runtime.jsx)("li", {
				className: FilesBody_module_css_default.item,
				"data-files-entry": "other",
				"data-files-path": path,
				children: (0, react_jsx_runtime.jsx)("span", {
					className: clsx(FilesBody_module_css_default.row, FilesBody_module_css_default.other),
					"aria-disabled": "true",
					title: tree.t("entry.other"),
					children: (0, react_jsx_runtime.jsx)("span", {
						className: FilesBody_module_css_default.name,
						children: entry.name
					})
				})
			});
		}
		/** One directory's rows: its state while listing, its entries once listed. */
		function Level({ path, tree }) {
			const { state, t } = tree;
			const level = state.levels[path];
			if (level === void 0 || level.kind === "loading") return (0, react_jsx_runtime.jsx)("li", {
				className: FilesBody_module_css_default.note,
				"data-files-row": "loading",
				children: t("loading")
			});
			if (level.kind === "failed") return (0, react_jsx_runtime.jsx)("li", {
				className: FilesBody_module_css_default.note,
				"data-files-row": "failed",
				"data-files-code": level.failure.code,
				children: failureLine(t, level.failure)
			});
			const entries = orderEntries(level.level.entries);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				level.failure !== void 0 && (0, react_jsx_runtime.jsx)("li", {
					className: FilesBody_module_css_default.note,
					"data-files-row": "failed",
					children: failureLine(t, level.failure)
				}),
				entries.length === 0 && (0, react_jsx_runtime.jsx)("li", {
					className: FilesBody_module_css_default.note,
					"data-files-row": "empty",
					children: t("empty")
				}),
				entries.map((entry) => (0, react_jsx_runtime.jsx)(Entry, {
					parent: path,
					entry,
					tree
				}, entry.name)),
				level.level.truncated && (0, react_jsx_runtime.jsx)("li", {
					className: FilesBody_module_css_default.note,
					"data-files-row": "truncated",
					children: t("truncated")
				})
			] });
		}
		/** The file tree's body: the workspace root and whatever the reader has opened under it. */
		function FilesBody({ useTabInfo, sessionId, useSessions, useStore, actions, start, refresh, setAutoRefresh, toggle, t, renderSlot }) {
			const { tab } = useTabInfo();
			(0, react.useEffect)(() => tab.actions.bindCommands({ refresh: () => {
				refresh(tab.id);
			} }), [
				tab.actions,
				tab.id,
				refresh
			]);
			const { signal, actions: tabActions } = tab;
			const cwd = useSessions((sessions) => sessions.byId[sessionId]?.cwd);
			const state = useStore((store) => store.byTab[tab.id]);
			const bodyRef = (0, react.useRef)(null);
			const scrollTopRef = (0, react.useRef)(0);
			const seeded = state !== void 0;
			(0, react.useLayoutEffect)(() => {
				const body = bodyRef.current;
				if (seeded && body !== null) {
					body.scrollTop = state.scrollTop;
					scrollTopRef.current = body.scrollTop;
				}
			}, [seeded]);
			(0, react.useEffect)(() => () => {
				if (seeded && !signal.aborted) actions.scrolled(tab.id, scrollTopRef.current);
			}, [
				seeded,
				signal,
				tab.id,
				actions
			]);
			(0, react.useEffect)(() => {
				if (state !== void 0 || cwd === void 0 || signal.aborted) return;
				start(tab.id, cwd, signal);
			}, [
				state,
				cwd,
				tab.id,
				signal,
				start
			]);
			if (cwd === void 0) return (0, react_jsx_runtime.jsx)("div", {
				className: FilesBody_module_css_default.status,
				"data-files-state": "no-workspace",
				children: (0, react_jsx_runtime.jsx)("p", {
					className: FilesBody_module_css_default.statusLine,
					children: t("noWorkspace")
				})
			});
			if (state === void 0) return null;
			const tree = {
				state,
				onToggle: (parent, path) => {
					toggle(tab.id, parent, path, state.expanded, signal);
				},
				onOpen: (path) => {
					tabActions.openResource(fileAddressFor(sessionId, state.root, path));
				},
				t
			};
			const reload = () => {
				refresh(tab.id);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: FilesBody_module_css_default.root,
				"data-files-state": "tree",
				"data-files-root": state.root,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: FilesBody_module_css_default.header,
					children: [
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.PathLabel, {
							path: state.root,
							className: FilesBody_module_css_default.path,
							"data-files-path": true
						}),
						(0, react_jsx_runtime.jsx)("span", {
							hidden: true,
							children: (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: FilesBody_module_css_default.tool,
								"aria-label": t("autoRefresh"),
								"aria-pressed": state.autoRefresh,
								"data-files-auto-refresh": true,
								title: t(state.autoRefresh ? "autoRefresh.disable" : "autoRefresh.enable"),
								onClick: () => {
									setAutoRefresh(tab.id, !state.autoRefresh);
								},
								children: state.autoRefresh ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPauseOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutlineRegular, {})
							})
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("reload"),
							shortcutKeys: tab.refreshShortcut?.keys,
							side: "bottom",
							delayMs: 500,
							children: (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: FilesBody_module_css_default.tool,
								"aria-label": t("reload"),
								"aria-keyshortcuts": tab.refreshShortcut?.aria,
								"data-files-reload": true,
								onClick: reload,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {})
							})
						}),
						renderSlot("sidebar.right.tab.files.actions", { absolutePath: state.root })
					]
				}), (0, react_jsx_runtime.jsx)("div", {
					ref: bodyRef,
					className: FilesBody_module_css_default.body,
					"data-files-body": true,
					onScroll: (event) => {
						scrollTopRef.current = event.currentTarget.scrollTop;
					},
					children: (0, react_jsx_runtime.jsx)("ul", {
						className: FilesBody_module_css_default.level,
						children: (0, react_jsx_runtime.jsx)(Level, {
							path: state.root,
							tree
						})
					})
				})]
			});
		}
		//#endregion
		//#region lib/types/client/FilesTitle.js
		/**
		* The title as the chip and a floating panel's header show it.
		* @param props - the tab information hook.
		* @returns the folder sheet followed by the tab's title text.
		*/
		function FilesTitle({ useTabInfo }) {
			const { tab } = useTabInfo();
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
				kind: "folder",
				size: 16,
				className: FilesBody_module_css_default.titleIcon
			}), tab.title] });
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Simplified Chinese dictionary and key-set source of truth. */
		const zh = {
			"shortcut.noSession": "请先选择会话",
			"type.label": "文件",
			"guide.title": "工作区文件",
			"guide.description": "浏览会话工作区的文件",
			loading: "正在读取…",
			empty: "空目录",
			truncated: "条目太多，只显示了一部分。",
			noWorkspace: "这个会话没有工作区目录。",
			reload: "重新读取",
			autoRefresh: "自动刷新",
			"autoRefresh.enable": "开启自动刷新",
			"autoRefresh.disable": "关闭自动刷新",
			"entry.other": "这不是文件或目录，没法打开。",
			"error.notFound": "这个目录不在了。可能已被移动或删除。",
			"error.outsideWorkspace": "这个目录在工作区之外，侧栏不会读取它。",
			"error.notDirectory": "这不是一个目录。",
			"error.unavailable": "读取失败：{message}"
		};
		/** English dictionary, checked against the Chinese key set. */
		const en = {
			"shortcut.noSession": "Select a session first",
			"type.label": "Files",
			"guide.title": "Workspace files",
			"guide.description": "Browse files in this session's workspace",
			loading: "Reading…",
			empty: "Empty directory",
			truncated: "Too many entries, showing only some of them.",
			noWorkspace: "This session has no workspace directory.",
			reload: "Reload",
			autoRefresh: "Auto refresh",
			"autoRefresh.enable": "Enable auto refresh",
			"autoRefresh.disable": "Disable auto refresh",
			"entry.other": "Not a file or a directory, so it cannot be opened.",
			"error.notFound": "That directory is gone. It may have been moved or deleted.",
			"error.outsideWorkspace": "That directory is outside the workspace, so the sidebar will not read it.",
			"error.notDirectory": "That is not a directory.",
			"error.unavailable": "Read failed: {message}"
		};
		//#endregion
		//#region lib/types/client/store.js
		/**
		* The file tree's view state: which directories are expanded, what each
		* loaded level contains, and where the body is scrolled to.
		*
		* The tree is not one resource. A directory listing per level, expanded lazily,
		* is state the type owns — so it lives in a Slot-standard exclusive store
		* (one instance per session), bucketed by tab id because two tabs of this kind
		* in one session expand independently.
		*
		* Writers run between `start` and `forget`: the owner's `signal` is what ends a
		* bucket's life, and the face stops dispatching once it aborts.
		*/
		/**
		* One tab's bucket, which every writer after `start` relies on: the face only
		* dispatches while the record's signal is live, and `forget` runs on its abort.
		* @param state - the draft.
		* @param tabId - the tab being written.
		* @returns the tab's tree.
		*/
		function bucket(state, tabId) {
			const tree = state.byTab[tabId];
			if (tree === void 0) throw new Error(`ui-sidebar-files: no tree for tab "${tabId}"`);
			return tree;
		}
export {};
