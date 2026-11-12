/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						"data-textpreview-body": true,
						children: (0, react_jsx_runtime.jsxs)("div", {
							className: TextPreview_module_css_default.empty,
							"data-textpreview-unsupported": true,
							children: [
								(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
									kind: (0, _deepseek_ai_dsh_client_ui_primitives.classifyFileType)(unsupportedName),
									size: 36,
									className: TextPreview_module_css_default.emptyIcon
								}),
								(0, react_jsx_runtime.jsx)("p", {
									className: TextPreview_module_css_default.emptyLine,
									children: t("unsupportedFile")
								}),
								fileOwner !== void 0 && renderSlot("sidebar.right.tab.document.unpreviewable", fileOwner)
							]
						})
					})]
				});
			}
			if (state === void 0 || selected === void 0) return (0, react_jsx_runtime.jsx)("div", {
				className: TextPreview_module_css_default.status,
				"data-textpreview-state": "loading",
				children: meta.status === "none" ? (0, react_jsx_runtime.jsx)("p", {
					className: TextPreview_module_css_default.statusLine,
					children: t("resourceUnavailable")
				}) : (0, react_jsx_runtime.jsx)(LoadingIndicator, { label: t("loading") })
			});
			const next = loadedThrough + 1;
			const { name } = pathPartsOf(displayPath);
			const loadNext = () => {
				if (!canRead || current?.loading || current?.eof) return;
				loadPage(tab.id, file, next, signal, meta.value?.version);
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: TextPreview_module_css_default.preview,
				"data-textpreview-state": "text",
				"data-textpreview-url": tab.contentId,
				"data-document-preview": selected.id,
				children: [
					meta.failure !== void 0 && hasContent ? (0, react_jsx_runtime.jsxs)("p", {
						className: TextPreview_module_css_default.changed,
						"data-textpreview-meta-failed": meta.failure.code,
						children: [(0, react_jsx_runtime.jsx)("span", { children: failureLine(t, meta.failure) }), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: TextPreview_module_css_default.action,
							"data-textpreview-reload-now": true,
							onClick: reload,
							children: t("reloadNow")
						})]
					}) : changed && (0, react_jsx_runtime.jsxs)("p", {
						className: TextPreview_module_css_default.changed,
						"data-textpreview-changed": true,
						children: [(0, react_jsx_runtime.jsx)("span", { children: t("changed") }), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: TextPreview_module_css_default.action,
							"data-textpreview-reload-now": true,
							onClick: reload,
							children: t("reloadNow")
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: TextPreview_module_css_default.header,
						children: [
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.PathLabel, {
								path: displayPath,
								className: TextPreview_module_css_default.path,
								"data-textpreview-path": true
							}),
							candidates.length > 1 && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
								open: menuOpen,
								anchor: (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: clsx(TextPreview_module_css_default.tool, TextPreview_module_css_default.viewerTool),
									"aria-label": t("openWith"),
									title: selected.title(),
									"data-document-viewer-menu": true,
									onClick: () => {
										setMenuOpen((value) => !value);
									},
									children: selected.title()
								}),
								items: candidates.map((candidate) => ({
									id: candidate.id,
									label: candidate.title()
								})),
								selectedId: selected.id,
								onSelect: (id) => {
									actions.selected(tab.id, id);
									setMenuOpen(false);
								},
								onClose: () => {
									setMenuOpen(false);
								},
								align: "end",
								portal: true,
								dense: true
							}),
							selected.wrap === true && (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t(state.wrap ? "wrap.disable" : "wrap.enable"),
								side: "bottom",
								delayMs: 500,
								children: (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: TextPreview_module_css_default.tool,
									"aria-pressed": state.wrap,
									"aria-label": t("wrap.aria"),
									"data-textpreview-tool": "wrap",
									onClick: () => {
										actions.toggledWrap(tab.id);
									},
									children: state.wrap ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconNowrapFillRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWrapFillRegular, {})
								})
							}),
							content !== void 0 && renderSlot("sidebar.right.tab.document.action", { content }, {
								entryKey: selected.id,
								hookContext: useTabInfo
							}),
							(0, react_jsx_runtime.jsx)("span", {
								hidden: true,
								children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t(state.autoRefresh ? "autoRefresh.disable" : "autoRefresh.enable"),
									side: "bottom",
									delayMs: 500,
									children: (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: TextPreview_module_css_default.tool,
										"aria-label": t("autoRefresh"),
										"aria-pressed": state.autoRefresh,
										"data-textpreview-tool": "auto-refresh",
										onClick: () => {
											actions.toggledAutoRefresh(tab.id);
										},
										children: state.autoRefresh ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPauseOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlayOutlineRegular, {})
									})
								})
							}),
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
								label: t("reload"),
								shortcutKeys: tab.refreshShortcut?.keys,
								side: "bottom",
								delayMs: 500,
								children: (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: TextPreview_module_css_default.tool,
									"aria-label": t("reload"),
									"data-textpreview-tool": "reload",
									"aria-keyshortcuts": tab.refreshShortcut?.aria,
									onClick: reload,
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, {})
								})
							}),
							fileOwner !== void 0 && renderSlot("sidebar.right.tab.document.actions", fileOwner)
						]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						ref: bindBody,
						className: clsx(TextPreview_module_css_default.body, state.wrap && TextPreview_module_css_default.wrap),
						"data-textpreview-body": true,
						"data-textpreview-wrap": state.wrap ? "" : void 0,
						onScrollCapture: (event) => {
							const body = scrollportRef.current;
							/* v8 ignore next -- callback refs bind the scrollport during commit, before user input. */
							if (body === null) return;
							if (event.target !== body) return;
							actions.scrolled(tab.id, body.scrollTop);
							if (mode === "text-pages" && current?.failure === void 0 && body.clientHeight > 0 && body.scrollTop + body.clientHeight >= body.scrollHeight - 1) loadNext();
						},
						children: [
							mode !== "renderer" && !hasContent && current?.failure === void 0 && (0, react_jsx_runtime.jsx)(LoadingIndicator, { label: t("loading") }),
							content !== void 0 && renderSlot("sidebar.right.tab.document", {
								resourceAddress: tab.contentId,
								content,
								wrap: state.wrap,
								scrollportRef: bindScrollport,
								addResource: add,
								setResources: set
							}, {
								entryKey: selected.id,
								hookContext: useTabInfo,
								fallback: (0, react_jsx_runtime.jsx)("p", {
									className: TextPreview_module_css_default.statusLine,
									children: t("rendererUnavailable", { name: selected.title() })
								})
							}),
							current?.failure !== void 0 && (hasContent ? (0, react_jsx_runtime.jsxs)("p", {
								className: TextPreview_module_css_default.statusLine,
								"data-textpreview-failed": current.failure.code,
								children: [(0, react_jsx_runtime.jsx)("span", { children: failureLine(t, current.failure) }), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: TextPreview_module_css_default.action,
									"data-textpreview-retry": true,
									onClick: loadNext,
									children: t("retry")
								})]
							}) : (0, react_jsx_runtime.jsxs)("div", {
								className: TextPreview_module_css_default.empty,
								"data-textpreview-failed": current.failure.code,
								children: [
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
										kind: (0, _deepseek_ai_dsh_client_ui_primitives.classifyFileType)(name),
										size: 36,
										className: TextPreview_module_css_default.emptyIcon
									}),
									(0, react_jsx_runtime.jsx)("p", {
										className: TextPreview_module_css_default.emptyLine,
										children: failureLine(t, current.failure)
									}),
									emptyFailureRecourse(current.failure) === "open" && fileOwner !== void 0 && renderSlot("sidebar.right.tab.document.unpreviewable", fileOwner),
									emptyFailureRecourse(current.failure) === "retry" && (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: TextPreview_module_css_default.retry,
										"data-textpreview-retry": true,
										onClick: reload,
										children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 }), t("retry")]
									})
								]
							})),
							mode === "text-pages" && current !== void 0 && loaded.length > 0 && !current.eof && current.failure === void 0 && (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: TextPreview_module_css_default.more,
								disabled: current.loading,
								"data-textpreview-more": true,
								onClick: loadNext,
								children: current.loading ? (0, react_jsx_runtime.jsx)(LoadingIndicator, {
									inline: true,
									label: t("loading")
								}) : t("loadMore")
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/TextTitle.js
		/**
		* The title as the chip and a floating panel's header show it.
		* @param props - the tab information hook.
		* @returns the type's 16px sheet followed by the tab's title text.
		*/
		function TextTitle({ useTabInfo }) {
			const { tab } = useTabInfo();
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
				kind: (0, _deepseek_ai_dsh_client_ui_primitives.classifyFileType)(tab.title),
				size: 16,
				className: TextPreview_module_css_default.titleIcon
			}), tab.title] });
		}
		//#endregion
		//#region lib/types/client/definition.js
		/** The tab kind this package owns. */
		const TEXTPREVIEW_KIND = "text";
		/** This implementation's identity in the tab system: the key its body registers under. */
		const TEXTPREVIEW_ID = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
		/**
		* The tab title for one `file:` address: its decoded basename.
		*
		* The whole address stays the content identity, so two files with one name in
		* different directories are two tabs; only the chip text is shortened. Decoding
		* is per segment, matching how the address was built, so a name carrying `#`,
		* `?`, or a space reads as itself.
		* @param address - a `file:`-shaped address.
		* @returns the decoded last path segment, or the address itself when it has none.
		*/
		function basenameOf(address) {
			const name = address.slice(address.lastIndexOf("/") + 1);
			if (name === "") return address;
			try {
				return decodeURIComponent(name);
			} catch {
				return name;
			}
		}
		/**
		* The text type's registry definition.
		* @returns the definition to register.
		*/
		function textDefinition() {
			return {
				id: TEXTPREVIEW_ID,
				kind: TEXTPREVIEW_KIND,
				patterns: ["dsh-resource://file/[\\s\\S]+"],
				priority: "fallback",
				canOpen: (address) => parseFileAddress(address)?.scope === "session",
				title: basenameOf
			};
		}
		//#endregion
		//#region lib/types/client/document/resource-group.js
		/** Forwards member metadata changes to one document preview. */
		var ResourceGroup = class {
			resources;
			changed;
			members = /* @__PURE__ */ new Map();
			/** @param resources - shared file sources. @param changed - marks the owning preview stale. */
			constructor(resources, changed) {
				this.resources = resources;
				this.changed = changed;
			}
			/**
			* Subscribe once; initial metadata establishes the baseline for later changes.
			* @param address - complete resource address.
			*/
			add(address) {
				if (this.members.has(address)) return;
				const source = this.resources.source(address);
				let previous;
				const observe = () => {
					const next = source.getSnapshot();
					if (next.status !== "live" && next.status !== "failed") return;
					const key = next.status === "live" ? `live:${next.value?.version}` : `failed:${next.failure?.code}`;
					const changed = previous !== void 0 && key !== previous;
					previous = key;
					if (changed) this.changed();
				};
				this.members.set(address, source.subscribe(observe));
				observe();
			}
			/**
			* Release dependencies absent from the current document.
			* @param addresses - complete membership of the latest document load.
			*/
			set(addresses) {
				const retained = new Set(addresses);
				for (const address of retained) this.add(address);
				for (const [address, release] of this.members) {
					if (retained.has(address)) continue;
					this.members.delete(address);
					release();
				}
			}
			/** Release every member when the preview tab ends. */
			close() {
				this.set([]);
			}
		};
		//#endregion
		//#region lib/types/client/face.js
		/**
		* Bind the preview's face to one paged read and one complete-byte read.
		* @param read - the bound `workspaceFiles.read` call.
		* @param readAll - complete-byte workspace Remote read.
		* @param resources - shared metadata sources for the document and its dependencies.
		* @returns the Slot `inject` factory: bound actions in, face out. The slot's session id is unused because the address carries its own.
		*/
		function textFace(read, readAll, resources) {
			return (_sessionId, actions) => {
				const tabs = /* @__PURE__ */ new Map();
				const readsOf = (tabId, signal) => {
					const held = tabs.get(tabId);
					if (held !== void 0) return held;
					const created = {
						generation: 0,
						version: void 0,
						mode: "text-pages",
						group: new ResourceGroup(resources, () => {
							actions.resourceChanged(tabId);
						})
					};
					tabs.set(tabId, created);
					signal.addEventListener("abort", () => {
						created.controller?.abort();
						created.group.close();
						tabs.delete(tabId);
						actions.forget(tabId);
					}, { once: true });
					return created;
				};
				const modeOf = (tabId, signal, mode, rendererId) => {
					const reads = readsOf(tabId, signal);
					if (reads.mode !== mode || reads.rendererId !== rendererId) {
						reads.controller?.abort();
						if (rendererId === void 0) delete reads.rendererId;
						else reads.rendererId = rendererId;
						reads.mode = mode;
						reads.generation++;
						reads.version = void 0;
						actions.reset(tabId);
					}
					return reads;
				};
				const loadPage = (tabId, file, offset, signal, observedVersion) => {
					if (signal.aborted) return;
					const reads = modeOf(tabId, signal, "text-pages");
					const { generation } = reads;
					actions.loading(tabId, "text-pages", observedVersion);
					read(file.sessionId, file.path, offset, signal).then((result) => {
						if (signal.aborted || reads.generation !== generation) return;
						if (!result.ok) {
							actions.failed(tabId, result.error);
							return;
						}
						if (offset !== 1 && reads.version !== void 0 && result.value.version !== reads.version) {
							restart(tabId, file, signal, observedVersion);
							return;
						}
						reads.version = result.value.version;
						actions.page(tabId, result.value);
					});
export {};
