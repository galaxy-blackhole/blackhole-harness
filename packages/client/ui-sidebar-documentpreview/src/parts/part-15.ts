/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
			}
			async lookup(file, signal, priority) {
				for (let attempt = 0; attempt < 2; attempt++) try {
					return await this.lookupGeneration(file, signal, priority);
				} catch (error) {
					if (error !== this.superseded) throw error;
				}
				throw this.busy();
			}
			async lookupGeneration(file, signal, priority) {
				signal = AbortSignal.any([signal, this.lifetime.signal]);
				signal.throwIfAborted();
				const query = ++this.generationQuery;
				const generation = await this.currentGeneration(signal);
				signal.throwIfAborted();
				if (!generation.ok) return generation;
				if (query < this.acceptedQuery && generation.value !== this.generation) throw this.superseded;
				this.acceptedQuery = Math.max(query, this.acceptedQuery);
				if (generation.value !== this.generation) {
					this.generation = generation.value;
					this.ready.clear();
					this.bytes = 0;
					for (const pending of this.pending.values()) pending.controller.abort(this.superseded);
					this.pending.clear();
				}
				const metadata = await this.stat(file, signal);
				signal.throwIfAborted();
				if (!metadata.ok) return metadata;
				if (generation.value !== this.generation) throw this.superseded;
				const key = JSON.stringify([
					generation.value,
					file.sessionId,
					metadata.value.absolutePath,
					metadata.value.version
				]);
				const cached = this.ready.get(key);
				if (cached !== void 0) {
					this.ready.delete(key);
					this.ready.set(key, cached);
					return cached;
				}
				const pendingKey = JSON.stringify([key, priority]);
				let entry = this.pending.get(pendingKey);
				if (entry === void 0) {
					const pendingLimit = priority === "background" ? this.maxPending - 1 : this.maxPending;
					if (this.tasks.size >= pendingLimit) throw this.busy();
					const controller = new AbortController();
					const promise = Promise.resolve().then(() => {
						controller.signal.throwIfAborted();
						return this.convert(file, controller.signal, priority);
					}).then((result) => {
						controller.signal.throwIfAborted();
						if (generation.value === this.generation && result.ok && result.value.generation === generation.value && result.value.version === metadata.value.version && result.value.absolutePath === metadata.value.absolutePath) this.retain(key, result);
						return result;
					}).finally(() => {
						this.tasks.delete(promise);
						if (this.pending.get(pendingKey)?.controller === controller) this.pending.delete(pendingKey);
					});
					this.tasks.add(promise);
					entry = {
						controller,
						promise,
						users: 0
					};
					this.pending.set(pendingKey, entry);
				}
				const shared = entry;
				shared.users += 1;
				return new Promise((resolve, reject) => {
					let settled = false;
					const finish = () => {
						if (settled) return false;
						settled = true;
						signal.removeEventListener("abort", abort);
						shared.users -= 1;
						if (shared.users === 0 && this.pending.get(pendingKey) === shared) {
							this.pending.delete(pendingKey);
							shared.controller.abort();
						}
						return true;
					};
					const abort = () => {
						const reason = signal.reason;
						finish();
						reject(reason instanceof Error ? reason : new Error("Office preview cancelled", { cause: reason }));
					};
					signal.addEventListener("abort", abort, { once: true });
					shared.promise.then((result) => {
						if (finish()) resolve(result);
					}, (error) => {
						if (finish()) reject(error instanceof Error ? error : new Error("Office preview failed", { cause: error }));
					});
				});
			}
			/** Clear retained bytes, cancel outstanding conversions, and await their completion. */
			async dispose() {
				this.lifetime.abort();
				this.pending.clear();
				this.ready.clear();
				this.bytes = 0;
				await Promise.allSettled([...this.reads, ...this.tasks]);
			}
			retain(key, result) {
				const previous = this.ready.get(key);
				if (previous !== void 0) {
					this.ready.delete(key);
					this.bytes -= previous.value.data.byteLength;
				}
				const size = result.value.data.byteLength;
				if (size > this.maxBytes) return;
				while (this.ready.size >= this.maxEntries || this.bytes + size > this.maxBytes) {
					const oldest = this.ready.entries().next().value;
					this.ready.delete(oldest[0]);
					this.bytes -= oldest[1].value.data.byteLength;
				}
				this.ready.set(key, result);
				this.bytes += size;
			}
		};
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/office/OfficeBody.module.css.mjs
		const css$1 = ".Ku8BfW_body{flex-direction:column;height:100%;min-height:0;display:flex}";
		const tagId$1 = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/OfficeBody.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var OfficeBody_module_css_default = { "body": "Ku8BfW_body" };
		//#endregion
		//#region lib/types/client/office/OfficeBody.js
		/** Office presents retained conversion results and font notices around the shared PDF view. */
		/**
		* Load one Office revision and preserve its result while its tab remains open.
		* @param props - renderer loading request, tab state, conversion callbacks, and PDF slot.
		* @returns conversion status or the PDF scrollport.
		*/
		function OfficeBody(props) {
			const { tab } = props.useTabInfo();
			const { load, retainTab, resourceAddress, t } = props;
			const request = props.content.kind === "renderer" ? props.content : void 0;
			const revision = request?.revision;
			const held = props.useStore((state) => state.byTab[tab.id]);
			const view = held?.revision === revision ? held : void 0;
			const settled = view?.file !== void 0 || view?.failure !== void 0;
			(0, react.useEffect)(() => {
				retainTab(tab.id, tab.signal);
			}, [
				retainTab,
				tab.id,
				tab.signal
			]);
			(0, react.useEffect)(() => {
				if (request === void 0 || settled || tab.signal.aborted) return;
				const controller = new AbortController();
				const signal = AbortSignal.any([controller.signal, tab.signal]);
				load(tab.id, request.revision, hostFileOf(resourceAddress), signal, request.loaded, request.failed);
				return () => {
					controller.abort();
				};
			}, [
				revision,
				resourceAddress,
				tab.id,
				tab.signal,
				load,
				settled
			]);
			const file = view?.file;
			if (request === void 0) return null;
			if (view?.failure !== void 0) {
				const { name } = pathPartsOf(resourceAddress);
				return (0, react_jsx_runtime.jsxs)("div", {
					className: TextPreview_module_css_default.empty,
					"data-textpreview-failed": view.failure.code,
					children: [
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.FileTypeIcon, {
							kind: (0, _deepseek_ai_dsh_client_ui_primitives.classifyFileType)(name),
							size: 36
						}),
						(0, react_jsx_runtime.jsx)("p", {
							className: TextPreview_module_css_default.emptyLine,
							children: view.failure.message
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							onClick: request.reload,
							children: t("retry")
						})
					]
				});
			}
			if (file === void 0) return (0, react_jsx_runtime.jsx)(LoadingIndicator, { label: t("loading") });
			return (0, react_jsx_runtime.jsx)("div", {
				className: OfficeBody_module_css_default.body,
				children: props.renderSlot("sidebar.right.tab.document.office.pdf", {
					resourceAddress,
					content: {
						kind: "bytes",
						data: file.data
					},
					wrap: props.wrap,
					scrollportRef: props.scrollportRef,
					addResource: props.addResource,
					setResources: props.setResources
				}, {
					entryKey: "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/office",
					hookContext: props.useTabInfo
				})
			});
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-sidebar-documentpreview/src/client/office/FontNotice.module.css.mjs
		const css = ".JqwYuG_anchor{flex:none;display:inline-flex}.JqwYuG_anchor .JqwYuG_warning,.JqwYuG_anchor .JqwYuG_warning:hover{color:var(--dsw-alias-state-warn-label)}.JqwYuG_anchor .JqwYuG_warning:hover,.JqwYuG_anchor .JqwYuG_warning[aria-expanded=true]{background:var(--dsw-alias-state-warn-tertiary)}.JqwYuG_panel{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);z-index:100;box-sizing:border-box;width:min(340px,100vw - 24px);max-height:calc(100dvh - 24px);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);border-radius:var(--dsw-radius-lg);box-shadow:var(--dsw-elevation-prominent);border:0;padding:16px;font-size:13px;line-height:1.6;position:fixed;overflow:auto}.JqwYuG_panelHeader{justify-content:space-between;align-items:center;gap:12px;display:flex}.JqwYuG_panelHeader h3{margin:0;font-size:14px;font-weight:600}.JqwYuG_description{color:var(--dsw-alias-label-secondary);margin:8px 0 16px}.JqwYuG_count{color:var(--dsw-alias-label-tertiary);margin:0 0 6px;font-size:12px}.JqwYuG_fonts{overflow-wrap:anywhere;margin:0;padding:0;list-style:none}.JqwYuG_fonts li{border-top:.5px solid var(--dsw-alias-border-l2);padding:8px 0}";
		const tagId = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview/FontNotice.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar-documentpreview";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var FontNotice_module_css_default = {
			"anchor": "JqwYuG_anchor",
			"count": "JqwYuG_count",
			"description": "JqwYuG_description",
			"fonts": "JqwYuG_fonts",
			"panel": "JqwYuG_panel",
			"panelHeader": "JqwYuG_panelHeader",
			"warning": "JqwYuG_warning"
		};
		//#endregion
		//#region lib/types/client/office/FontNotice.js
		/** Toolbar warning and non-modal details for the current preview’s missing fonts. */
		/**
		* Show a warning while fonts are unavailable for the current preview.
		* @param props - missing font families and localized copy.
		* @returns a warning button and its anchored details, or nothing when fonts are available.
		*/
		function FontNotice({ fonts, t }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const open = fonts.length > 0 && expanded;
			const anchor = (0, react.useRef)(null);
			const panel = (0, react.useRef)(null);
			const id = (0, react.useId)();
			const position = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef: anchor,
				panelRef: panel,
				gap: 8,
				margin: 12
			});
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(anchor, open, () => {
				setExpanded(false);
			}, panel);
			const closeDetails = () => {
				setExpanded(false);
				anchor.current?.querySelector("button")?.focus();
			};
			const positioned = position !== null;
			(0, react.useLayoutEffect)(() => {
				if (!open || !positioned) return;
				panel.current?.focus();
			}, [open, positioned]);
			if (fonts.length === 0) return null;
			const label = t("viewMissingFonts", { count: fonts.length });
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
				label,
				side: "bottom",
				delayMs: 500,
				disabled: open,
				children: (0, react_jsx_runtime.jsx)("span", {
					ref: anchor,
					className: FontNotice_module_css_default.anchor,
					"data-office-font-warning": true,
					children: (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: clsx(TextPreview_module_css_default.tool, FontNotice_module_css_default.warning),
						"aria-label": label,
						"aria-expanded": open,
						"aria-controls": open ? id : void 0,
						"aria-haspopup": "dialog",
						onClick: () => {
							setExpanded((value) => !value);
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningTriangleOutlineRegular, {})
					})
				})
			}), open && (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("div", {
				ref: panel,
				id,
				role: "dialog",
				"aria-labelledby": `${id}-title`,
				"aria-describedby": `${id}-description`,
				tabIndex: -1,
				className: FontNotice_module_css_default.panel,
				style: {
					...position,
					visibility: position === null ? "hidden" : void 0
				},
				onKeyDown: (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						closeDetails();
					}
				},
				onBlur: (event) => {
					if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && !anchor.current?.contains(event.relatedTarget)) setExpanded(false);
				},
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: FontNotice_module_css_default.panelHeader,
						children: [(0, react_jsx_runtime.jsx)("h3", {
							id: `${id}-title`,
							children: t("missingFontsTitle")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							size: "sm",
							"aria-label": t("closeDetails"),
							onClick: closeDetails,
							icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, {})
						})]
					}),
					(0, react_jsx_runtime.jsx)("p", {
						id: `${id}-description`,
						className: FontNotice_module_css_default.description,
						children: t("missingFontsDescription")
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: FontNotice_module_css_default.count,
						children: t("missingFontsCount", { count: fonts.length })
					}),
					(0, react_jsx_runtime.jsx)("ul", {
						className: FontNotice_module_css_default.fonts,
						children: fonts.map((font) => (0, react_jsx_runtime.jsx)("li", { children: font }, font))
					})
				]
			}), document.body)] });
		}
		//#endregion
		//#region lib/types/client/office/OfficeFontAction.js
		/**
		* Expose font details only for the currently loaded Office revision.
		* @param props - toolbar revision, tab reader, Office store, and localized copy.
		* @returns the font warning, or nothing before conversion completes.
		*/
		function OfficeFontAction({ content, useTabInfo, useStore, t }) {
			const { tab } = useTabInfo();
			const held = useStore((state) => state.byTab[tab.id]);
			if (content.kind !== "renderer" || held?.revision !== content.revision || held.file === void 0) return null;
			return (0, react_jsx_runtime.jsx)(FontNotice, {
				fonts: held.file.missingFonts,
				t
			}, content.revision);
		}
		//#endregion
		//#region lib/types/client/office/face.js
		/**
		* Bind Office reads to store actions without exposing Remote work to the component.
		* @param read - authorized conversion reader, including Client cache reuse.
		* @param describeFailure - localized conversion or source-access failure text.
		* @returns Slot inject factory; the file address supplies the read's Session authority.
		*/
		function officeFace(read, describeFailure) {
			return (_sessionId, actions) => ({ load: (tabId, revision, file, signal, loaded, failed) => {
				if (signal.aborted) return;
				actions.loading(tabId, revision);
				read(file, signal).then((result) => {
					if (signal.aborted) return;
					if (result.ok) {
						actions.complete(tabId, revision, result.value);
						loaded(result.value.version);
					} else {
						actions.failed(tabId, revision, {
							code: result.error.code,
							message: describeFailure(result.error)
						});
						failed();
					}
				}, (error) => {
					if (!signal.aborted) {
						actions.failed(tabId, revision, {
							code: "gateway/internal",
							message: describeFailure({ message: error instanceof Error ? error.message : String(error) })
						});
						failed();
					}
				});
			} });
		}
		//#endregion
		//#region lib/types/client/office/store.js
		/** Loaded Office previews survive body remounts until reload or tab closure. */
		/**
		* Retain Office contents across body remounts within a Session.
		* @returns the tab-content store declaration.
		*/
		function createOfficeStore() {
export {};
