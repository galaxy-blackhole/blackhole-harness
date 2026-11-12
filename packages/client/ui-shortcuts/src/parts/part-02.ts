/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Reference_module_css_default.inlineAction,
								disabled: readonly,
								onClick: () => {
									save({
										type: "reset",
										id: target.id
									});
								},
								children: t("reset")
							}),
							target.binding !== null && (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: Reference_module_css_default.inlineAction,
								disabled: readonly,
								onClick: () => {
									save({
										type: "set",
										id: target.id,
										binding: null
									});
								},
								children: t("clear")
							}),
							(0, react_jsx_runtime.jsx)("button", {
								ref: recorder,
								type: "button",
								className: clsx(Reference_module_css_default.recorder, message && Reference_module_css_default.invalid),
								disabled: !nativeReady,
								"aria-disabled": busy || !nativeReady,
								onBlur: () => {
									restart.current();
								},
								"aria-label": t("record"),
								"aria-invalid": message !== "",
								"aria-describedby": descriptionId,
								onClick: () => {
									if (!writing.current) {
										restart.current();
										setCaptured(false);
										setMessage("");
										setRetry(null);
									}
								},
								children: captured && message === "" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.ShortcutKeys, {
									keys: describeBinding(candidate).keys,
									className: Reference_module_css_default.recorded
								}) : t("record")
							})
						]
					}),
					(0, react_jsx_runtime.jsx)("span", {
						id: descriptionId,
						className: Reference_module_css_default.srOnly,
						children: message || (desktopChords ? "" : t(runtime === "web" ? platform === "windows" ? "windows-web-help" : platform === "macos" ? "macos-web-help" : "web-help" : "record-help"))
					}),
					review,
					retry !== null && !stale && (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: Reference_module_css_default.inlineAction,
						disabled: readonly,
						onClick: () => {
							capture(retry, target.id);
						},
						children: t("retry-save")
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/Icons.js
		/** Supplied shortcut-control and feedback artwork, colored by the owning UI. */
		const artwork = {
			edit: (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: (0, react_jsx_runtime.jsx)("path", { d: "M7.4553 1.01221C8.02829 0.676881 8.73746 0.676959 9.31048 1.01221C9.52928 1.14026 9.72631 1.34353 9.98255 1.59978C10.2388 1.85601 10.4421 2.05305 10.5701 2.27185C10.9053 2.84485 10.9054 3.55407 10.5701 4.12703C10.4421 4.34576 10.2387 4.54293 9.98255 4.7991L4.99422 9.78744C4.71024 10.0714 4.50494 10.2832 4.2488 10.4324C3.99266 10.5815 3.70709 10.6557 3.32001 10.7625L2.43268 11.0072C2.08118 11.1042 1.75876 11.1948 1.50071 11.2265C1.2387 11.2585 0.884455 11.2512 0.607798 10.9745C0.331166 10.6979 0.323805 10.3436 0.35587 10.0816C0.387501 9.82358 0.47815 9.50112 0.575111 9.14964L0.819864 8.26232C0.926638 7.87525 1.00083 7.58966 1.14992 7.33353C1.2991 7.07739 1.5109 6.87209 1.79489 6.58811L6.78322 1.59978C7.03941 1.34359 7.23656 1.14027 7.4553 1.01221ZM11.6568 11.13H5.6639L6.72503 10.0689H11.6568V11.13ZM2.54509 7.33831C2.22348 7.65993 2.13155 7.75784 2.06755 7.86768C2.0036 7.97757 1.96369 8.10606 1.84272 8.54454L1.59797 9.43187C1.5011 9.78304 1.44118 10.0065 1.4162 10.1653C1.57504 10.1404 1.79876 10.0814 2.15046 9.98436L3.03779 9.7396C3.47631 9.61863 3.60475 9.57874 3.71464 9.51478C3.82448 9.45077 3.92239 9.35885 4.24401 9.03723L8.04047 5.23998L6.34155 3.54106L2.54509 7.33831ZM8.77473 1.92824C8.53277 1.78664 8.233 1.78664 7.99104 1.92824C7.91987 1.97 7.83628 2.04713 7.53343 2.34998L7.09176 2.79085L8.79068 4.48977L9.23235 4.0489C9.53517 3.74608 9.61232 3.66245 9.65409 3.59128C9.79567 3.34935 9.79564 3.04954 9.65409 2.8076C9.61237 2.73635 9.53565 2.65329 9.23235 2.34998C8.92899 2.04662 8.84598 1.96995 8.77473 1.92824Z" }) }),
			error: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)("path", { d: "M8.90039 3.97328V9.07973H7.09961V3.97328H8.90039Z" }),
				(0, react_jsx_runtime.jsx)("path", { d: "M8.90039 10.341V12.3654H7.09961V10.341H8.90039Z" }),
				(0, react_jsx_runtime.jsx)("path", { d: "M14.5996 8C14.5996 4.35492 11.6451 1.40039 8 1.40039C4.35492 1.40039 1.40039 4.35492 1.40039 8C1.40039 11.6451 4.35492 14.5996 8 14.5996C11.6451 14.5996 14.5996 11.6451 14.5996 8ZM15.9004 8C15.9004 12.363 12.363 15.9004 8 15.9004C3.63695 15.9004 0.0996094 12.363 0.0996094 8C0.0996094 3.63695 3.63695 0.0996094 8 0.0996094C12.363 0.0996094 15.9004 3.63695 15.9004 8Z" })
			] }),
			success: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("path", { d: "M12.5303 6.53027L8.80273 10.2578C8.54967 10.5109 8.31796 10.7439 8.10645 10.9141C7.88375 11.0932 7.616 11.2602 7.27344 11.3145C7.09229 11.3431 6.90771 11.3431 6.72656 11.3145C6.384 11.2602 6.11625 11.0932 5.89355 10.9141C5.68204 10.7439 5.45033 10.5109 5.19727 10.2578L3.46973 8.53027L4.53027 7.46973L6.25781 9.19727C6.53457 9.47402 6.70036 9.63859 6.83398 9.74609C6.95637 9.84453 6.98241 9.83644 6.96094 9.83301C6.98679 9.83709 7.01321 9.83709 7.03906 9.83301C7.01759 9.83644 7.04363 9.84453 7.16602 9.74609C7.29964 9.63859 7.46543 9.47402 7.74219 9.19727L11.4697 5.46973L12.5303 6.53027Z" }), (0, react_jsx_runtime.jsx)("path", { d: "M14.5996 8C14.5996 4.35492 11.6451 1.40039 8 1.40039C4.35492 1.40039 1.40039 4.35492 1.40039 8C1.40039 11.6451 4.35492 14.5996 8 14.5996C11.6451 14.5996 14.5996 11.6451 14.5996 8ZM15.9004 8C15.9004 12.363 12.363 15.9004 8 15.9004C3.63695 15.9004 0.0996094 12.363 0.0996094 8C0.0996094 3.63695 3.63695 0.0996094 8 0.0996094C12.363 0.0996094 15.9004 3.63695 15.9004 8Z" })] })
		};
		/**
		* Render the shortcut design artwork at its supplied size.
		* @param props - glyph kind and semantic color class.
		* @returns an ornamental SVG hidden from assistive technology.
		*/
		function ShortcutIcon({ kind, className }) {
			const size = kind === "edit" ? 12 : 16;
			return (0, react_jsx_runtime.jsx)("svg", {
				width: size,
				height: size,
				viewBox: `0 0 ${size} ${size}`,
				fill: "currentColor",
				className,
				"aria-hidden": "true",
				children: artwork[kind]
			});
		}
		//#endregion
		//#region lib/types/client/Reference.js
		/** Searchable editable shortcut reference and its General Settings row. */
		/** Core reference positions are independent of labels and plugin registration order. */
		const coreActionOrder = new Map([
			"shortcuts.open",
			"session.new",
			"sidebar.left.toggle",
			"session.search",
			"workspace.add",
			"session.rename",
			"session.fork",
			"session.archive",
			"settings.open",
			"fontSize.increase",
			"fontSize.decrease",
			"workspace.openLocal",
			"sidebar.right.toggle",
			"workspace.files",
			"browser.new",
			"terminal.new",
			"pane.split",
			"pane.fullscreen.toggle",
			"page.refresh",
			"page.close"
		].map((id, index) => [id, index]));
		/**
		* Render the General Settings action that opens the shortcut reference.
		* @param props - shared dialog action and localized labels.
		* @returns the settings row.
		*/
		function ShortcutsRow({ actions, t, useCatalog }) {
			const shortcut = useCatalog((rows) => rows.find((row) => row.id === "shortcuts.open"));
			return (0, react_jsx_runtime.jsxs)("div", {
				className: Reference_module_css_default.setting,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: Reference_module_css_default.settingText,
					children: [(0, react_jsx_runtime.jsx)("div", {
						className: Reference_module_css_default.settingTitle,
						children: t("settings")
					}), (0, react_jsx_runtime.jsx)("p", {
						className: Reference_module_css_default.settingDescription,
						children: t("description")
					})]
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					disabled: !shortcut?.keys.length,
					label: t("global-hint"),
					shortcutKeys: shortcut?.keys,
					children: (0, react_jsx_runtime.jsx)("button", {
						className: Reference_module_css_default.button,
						type: "button",
						"aria-label": t("view"),
						"aria-keyshortcuts": shortcut?.aria,
						onClick: () => {
							actions.open();
						},
						children: t("view")
					})
				})]
			});
		}
		/**
		* Render core actions in product order, then other commands by ID within each group. Search relevance takes precedence.
		* @param props - root store, effective catalog, and localized copy.
		* @returns the single reference dialog when open.
		*/
		function ShortcutReference({ useStore, actions, useCatalog, useConfig, useFixedCatalog, platform, runtime, edit, recording, describeBinding, t }) {
			const { open, query, focusRequest } = useStore((state) => state);
			const catalog = useCatalog((value) => value);
			const config = useConfig((value) => value);
			const fixedCatalog = useFixedCatalog((value) => value);
			const [target, setTarget] = (0, react.useState)(null);
			const [resetRevision, setResetRevision] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(false);
			const [toast, setToast] = (0, react.useState)(null);
			const mounted = (0, react.useRef)(true);
			const search = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				mounted.current = true;
				return () => {
					mounted.current = false;
				};
			}, []);
			const dismissToast = (0, react.useCallback)(() => {
				setToast(null);
			}, []);
			const notify = (0, react.useCallback)((text, error = false) => {
				setToast((previous) => {
					if (error && previous?.error && previous.text === text) return previous;
					return {
						text,
						error,
						seq: (previous?.seq ?? 0) + 1
					};
				});
			}, []);
			(0, react.useEffect)(() => {
				if (open && config.status === "unreadable") notify(shortcutReadFailure(config, runtime, t), true);
			}, [
				open,
				config,
				runtime,
				notify,
				t
			]);
			const closeEditor = () => {
				setTarget(null);
				const dialog = search.current?.closest("[role=\"dialog\"]");
				/* v8 ignore next -- Editor callbacks run while its reference dialog and search input are mounted. */
				if (dialog != null) (0, _deepseek_ai_dsh_client_ui_primitives.focusWithoutRing)(dialog, { preventScroll: true });
			};
			const closeReference = () => {
				if (busy) return;
				/* v8 ignore next -- The confirmation modal blocks the reference's close control. */
				if (resetRevision !== null) setResetRevision(null);
				else if (target !== null) closeEditor();
				else actions.close();
			};
			(0, react.useEffect)(() => {
				if (!open) setResetRevision(null);
			}, [open]);
			const persist = async (...args) => {
				setBusy(true);
				const result = await edit(...args);
				if (mounted.current) setBusy(false);
				return result;
			};
			const resetAll = async () => {
				/* v8 ignore next -- The reset control is accessible only while its confirmation is open. */
				if (resetRevision === null) return;
				const result = await persist({ type: "reset-all" }, resetRevision);
				if (!mounted.current) return;
				if (result.status === "saved" || result.status === "stale") setResetRevision(null);
				notify(result.status === "saved" ? t("reset-saved") : result.status === "write-failed" ? t("reset-failed") : shortcutFailure(result, catalog, t, runtime), result.status !== "saved");
			};
			const editorProps = {
				useCatalog,
				useConfig,
				useFixedCatalog,
				platform,
				runtime,
				edit: persist,
				recording,
				describeBinding,
				t,
				onClose: closeEditor,
				onSaved: () => {
					notify(t("saved"));
					closeEditor();
				},
				onError: (message) => {
					notify(message, true);
				}
			};
			(0, react.useLayoutEffect)(() => {
				const input = search.current;
				if (open && input !== null && !(0, _deepseek_ai_dsh_client_ui_primitives.isBehindModal)(input)) (0, _deepseek_ai_dsh_client_ui_primitives.focusWithoutRing)(input);
			}, [open, focusRequest]);
			const ranked = (0, _deepseek_ai_dsh_client_ui_primitives.rankByName)([...catalog.map((row) => ({
				...row,
				names: [
					...row.aliases,
					row.keys.filter((key) => key !== "+").join("+"),
					row.keys.filter((key) => key !== "+").join(""),
					row.aria ?? "",
					row.aria?.replace("Meta", "Cmd") ?? ""
				],
				group: "application"
			})), ...fixedCatalog.map((row) => ({
				...row,
				names: [row.id, row.keys.join(" ")]
			}))].sort((left, right) => Number(left.id === "response.stop") - Number(right.id === "response.stop") || (coreActionOrder.get(left.id) ?? coreActionOrder.size) - (coreActionOrder.get(right.id) ?? coreActionOrder.size) || Number(left.id > right.id) - Number(left.id < right.id)).flatMap((row) => row.names.map((name) => ({
				name,
				label: row.label,
				row
			}))), query.trim());
			const matches = [...new Set(ranked.map((match) => match.row))];
			const modifiedCount = Object.keys(config.document.profiles[`${runtime}:${platform}`] ?? {}).length;
			(0, react.useLayoutEffect)(() => {
				const input = search.current;
				if (open && resetRevision === null && modifiedCount === 0 && document.activeElement === document.body && input !== null) (0, _deepseek_ai_dsh_client_ui_primitives.focusWithoutRing)(input);
			}, [
				open,
				resetRevision,
				modifiedCount
			]);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open,
					onClose: closeReference,
					title: t("title"),
					headless: true,
					shortcutModal: "shortcuts",
					className: Reference_module_css_default.dialog,
					children: (0, react_jsx_runtime.jsxs)("div", {
						className: Reference_module_css_default.contents,
						onPointerDownCapture: (event) => {
							if (target === null || busy || !(event.target instanceof Element) || event.target.closest("button, input, a, [contenteditable=\"true\"], [role=\"group\"]") !== null) return;
							event.preventDefault();
							closeEditor();
						},
						children: [
							(0, react_jsx_runtime.jsxs)("header", {
								className: Reference_module_css_default.header,
								children: [(0, react_jsx_runtime.jsx)("h2", {
									className: Reference_module_css_default.title,
									children: t("title")
								}), (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: Reference_module_css_default.close,
									"aria-label": t("close"),
									disabled: busy,
									onClick: closeReference,
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 14 })
								})]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: Reference_module_css_default.searchRow,
								children: (0, react_jsx_runtime.jsxs)("div", {
									className: Reference_module_css_default.searchField,
									role: "search",
									"aria-label": t("search"),
									children: [
										(0, react_jsx_runtime.jsxs)("svg", {
											className: Reference_module_css_default.searchIcon,
											width: "14",
											height: "14",
											viewBox: "0 0 14 14",
											fill: "none",
											"aria-hidden": "true",
											children: [(0, react_jsx_runtime.jsx)("path", {
												d: "M10.28 5.86536C10.28 3.41381 8.29245 1.42644 5.84094 1.42627C3.38929 1.42627 1.40186 3.4137 1.40186 5.86536C1.40203 8.31686 3.38939 10.3044 5.84094 10.3044C8.29234 10.3043 10.2799 8.31676 10.28 5.86536ZM11.4174 5.86536C11.4172 8.94498 8.92057 11.4416 5.84094 11.4418C2.76117 11.4418 0.263843 8.94509 0.263672 5.86536C0.263672 2.78548 2.76106 0.288086 5.84094 0.288086C8.92067 0.288258 11.4174 2.78559 11.4174 5.86536Z",
												fill: "currentColor"
											}), (0, react_jsx_runtime.jsx)("path", {
												d: "M13.7372 12.9078L12.9323 13.7127L9.9732 10.7536L10.7781 9.94867L13.7372 12.9078Z",
												fill: "currentColor"
											})]
										}),
										(0, react_jsx_runtime.jsx)("input", {
											ref: search,
											"data-modal-autofocus": true,
											className: Reference_module_css_default.search,
											type: "search",
											"aria-label": t("search"),
											placeholder: t("search"),
											value: query,
											onChange: (event) => {
												actions.search(event.target.value);
											}
										}),
										query !== "" && (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: Reference_module_css_default.clearSearch,
											"aria-label": t("clear-search"),
											onClick: () => {
												actions.search("");
												search.current?.focus();
											},
											children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseOutlineRegular, { size: 10 })
										})
									]
								})
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: Reference_module_css_default.list,
								"aria-busy": config.status === "loading",
								children: [[
									"application",
									"input",
									"menus",
									"approval"
								].map((group) => {
									const rows = matches.filter((row) => row.group === group);
									if (rows.length === 0) return null;
									return (0, react_jsx_runtime.jsxs)("section", {
										"aria-label": t(group),
										children: [group !== "application" && (0, react_jsx_runtime.jsx)("h3", {
											className: Reference_module_css_default.group,
											children: t(group)
										}), (0, react_jsx_runtime.jsx)("ul", {
											className: Reference_module_css_default.rows,
											children: rows.map((row) => (0, react_jsx_runtime.jsxs)("li", {
												className: Reference_module_css_default.row,
												children: [
													"modified" in row && target?.id !== row.id && (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: Reference_module_css_default.rowButton,
														"aria-label": t("edit-label", { command: row.label }),
														disabled: busy || config.status !== "ready",
														onClick: () => {
															setTarget(row);
														}
													}),
													(0, react_jsx_runtime.jsx)("span", {
														className: Reference_module_css_default.commandLabel,
														children: row.label
													}),
													(0, react_jsx_runtime.jsx)("span", {
														className: Reference_module_css_default.binding,
														children: "modified" in row ? target?.id === row.id ? (0, react_jsx_runtime.jsx)(ShortcutEditor, {
export {};
