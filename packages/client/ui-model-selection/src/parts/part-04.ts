/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				effort: void 0,
				label: t("effort.providerDefault")
			}] : [], ...reasoning.efforts.map((effort) => ({
				key: `effort:${effort.id}`,
				effort: effort.id,
				label: effort.name
			}))], [reasoning, t]);
			const { pending } = state;
			const busy = pending !== null;
			const reload = () => {
				lastActionRef.current = "load";
				load();
			};
			(0, react.useEffect)(() => {
				if (!open) return;
				const closeOutside = (event) => {
					if (rootRef.current?.contains(event.target) === true) return;
					if (menuRef.current?.contains(event.target) === true) return;
					setOpen(false);
				};
				document.addEventListener("mousedown", closeOutside);
				return () => {
					document.removeEventListener("mousedown", closeOutside);
				};
			}, [open]);
			(0, react.useLayoutEffect)(() => {
				if (!showSearch) {
					setQuery("");
					setHighlightedIndex(null);
				}
			}, [showSearch]);
			const paneFocus = (0, react.useRef)(null);
			const previousShowSearch = (0, react.useRef)(showSearch);
			(0, react.useEffect)(() => {
				const changedSearchMode = previousShowSearch.current !== showSearch;
				previousShowSearch.current = showSearch;
				const intent = paneFocus.current ?? (changedSearchMode && pane === "model" ? "drill" : null);
				paneFocus.current = null;
				if (!open || intent === null) return;
				if (intent === "drill") {
					if (pane === "model" && showSearch) {
						searchRef.current?.focus();
						return;
					}
					(menuRef.current?.querySelector("[role=\"menuitemradio\"][aria-checked=\"true\"]:not([disabled])") ?? itemRefs.current.find((item) => item !== null && !item.disabled) ?? triggerRef.current)?.focus();
					return;
				}
				const cell = itemRefs.current[intent === "effort" ? 1 : 0];
				(cell !== null && cell !== void 0 && !cell.disabled ? cell : triggerRef.current)?.focus();
			}, [
				open,
				pane,
				showSearch
			]);
			(0, react.useEffect)(() => {
				const viewport = groupsRef.current;
				if (viewport === null) return;
				return (0, _deepseek_ai_dsh_client_ui_primitives.observeStickyMenuGroups)(viewport);
			}, [
				available,
				open,
				pane,
				filteredGroups
			]);
			(0, react.useLayoutEffect)(() => {
				if (open && pane === "model" && activeModelIndex >= 0) itemRefs.current[activeModelIndex]?.scrollIntoView({ block: "nearest" });
			}, [
				open,
				pane,
				activeModelIndex,
				visibleModels
			]);
			(0, react.useLayoutEffect)(() => {
				if (!open) {
					setMenuPos(null);
					return;
				}
				const place = () => {
					/* v8 ignore next 2 -- the trigger ref is attached whenever the menu is open. */
					const rect = triggerRef.current?.getBoundingClientRect();
					if (rect === void 0) return;
					const MARGIN = 12;
					const lw = menuRef.current?.offsetWidth ?? 0;
					const lh = menuRef.current?.offsetHeight ?? 0;
					let x = rect.right - lw;
					let y = rect.top - 8 - lh;
					if (lw > 0) x = Math.min(Math.max(x, MARGIN), window.innerWidth - lw - MARGIN);
					if (lh > 0) y = Math.min(Math.max(y, MARGIN), window.innerHeight - lh - MARGIN);
					setMenuPos({
						left: x,
						top: y
					});
				};
				place();
				window.addEventListener("scroll", place, true);
				window.addEventListener("resize", place);
				return () => {
					window.removeEventListener("scroll", place, true);
					window.removeEventListener("resize", place);
				};
			}, [
				open,
				pane,
				state,
				query
			]);
			if (!available) return null;
			const show = () => {
				setSelectionFocus(false);
				triggerRef.current?.focus();
				setQuery("");
				setHighlightedIndex(null);
				if (currentChoice === void 0) paneFocus.current = "drill";
				setPane(currentChoice === void 0 ? "model" : "root");
				setOpen(true);
				reload();
			};
			const changeQuery = (next) => {
				setQuery(next);
				setHighlightedIndex(0);
			};
			const close = (restoreFocus = false) => {
				setOpen(false);
				setPane("root");
				if (restoreFocus) queueMicrotask(() => {
					triggerRef.current?.focus();
				});
			};
			const closeAfterSelection = () => {
				setSelectionFocus(true);
				close(true);
			};
			const drill = (next) => {
				setQuery("");
				setHighlightedIndex(null);
				paneFocus.current = "drill";
				setPane(next);
			};
			/** Leave a drilled pane for the root one, handing the keyboard back to its cell. */
			const back = (from) => {
				paneFocus.current = from;
				setPane("root");
			};
			const moveFocus = (offset) => {
				const items = itemRefs.current.filter((item) => item !== null);
				if (items.length === 0) return;
				const active = items.findIndex((item) => item === document.activeElement);
				items[active === -1 ? offset > 0 ? 0 : items.length - 1 : (active + offset + items.length) % items.length]?.focus();
			};
			const onRootKeyDown = (event) => {
				if (event.nativeEvent.isComposing) return;
				if (event.key === "Escape" && open) {
					event.preventDefault();
					if (pane !== "root" && currentChoice !== void 0) back(pane);
					else close(true);
					return;
				}
				if (!open) return;
				if (pane === "model" && showSearch && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
					event.preventDefault();
					if (!busy && visibleModels.length > 0) {
						setHighlightedIndex((activeModelIndex + (event.key === "ArrowDown" ? 1 : -1) + visibleModels.length) % visibleModels.length);
						searchRef.current?.focus();
					}
					return;
				}
				if (pane === "model" && showSearch && event.target instanceof HTMLInputElement && (event.key === "Enter" || event.key === "Tab" && !event.shiftKey)) {
					if (event.key === "Tab" && visibleModels.length === 0) return;
					event.preventDefault();
					const highlighted = visibleModels[activeModelIndex];
					if (!busy && highlighted !== void 0) choose(highlighted);
					return;
				}
				if (event.key === "Tab") {
					if (event.shiftKey) {
						event.preventDefault();
						if (pane !== "root" && currentChoice !== void 0) back(pane);
						else close(true);
						return;
					}
					const focused = document.activeElement;
					const rows = itemRefs.current.filter((item) => item !== null);
					if (focused instanceof HTMLButtonElement && rows.includes(focused)) {
						event.preventDefault();
						focused.click();
						return;
					}
					if (focused !== triggerRef.current) return;
					event.preventDefault();
					if (pane === "model" && showSearch) {
						setHighlightedIndex(null);
						searchRef.current?.focus();
						return;
					}
					(menuRef.current?.querySelector("[role=\"menuitemradio\"][aria-checked=\"true\"]:not([disabled])") ?? rows.find((item) => !item.disabled))?.focus();
					return;
				}
				if (event.key === "ArrowDown" || event.key === "ArrowUp") {
					event.preventDefault();
					moveFocus(event.key === "ArrowDown" ? 1 : -1);
				}
			};
			const onBlur = (event) => {
				if (event.relatedTarget instanceof Node && (rootRef.current?.contains(event.relatedTarget) === true || menuRef.current?.contains(event.relatedTarget) === true)) return;
				close();
			};
			const settleSelection = (result) => {
				if (result === void 0) return;
				if (result.ok) {
					if (rootRef.current !== null) closeAfterSelection();
					return;
				}
				const { error } = result;
				toastSeq.current += 1;
				setToast({
					seq: toastSeq.current,
					text: error.code === "session/writer-held" ? t("error.sessionInUse") : t("error.action", { message: `${error.code}: ${error.message}` })
				});
			};
			const submit = (selection) => {
				lastActionRef.current = "select";
				setSelectionFocus(true);
				triggerRef.current?.focus();
				select(selection).then(settleSelection);
			};
			const choose = (selection) => {
				if (state.current?.provider === selection.provider && state.current.model === selection.model) {
					closeAfterSelection();
					return;
				}
				submit(selection);
			};
			const chooseEffort = (effort) => {
				if (state.current === null) return;
				if (effectiveEffort === effort) {
					closeAfterSelection();
					return;
				}
				submit({
					provider: state.current.provider,
					model: state.current.model,
					...effort === void 0 ? {} : { reasoningEffort: effort }
				});
			};
			const waiting = currentChoice === void 0 && state.status === "loading";
			const modelLabel = waiting ? t("trigger.loading") : currentChoice?.model.name ?? t("trigger.fallback");
			const triggerLabel = effortLabel === void 0 ? modelLabel : `${modelLabel} · ${effortLabel}`;
			const triggerAria = waiting ? t("trigger.loading") : currentChoice === void 0 ? t("trigger.selectAria") : effortLabel === void 0 ? t("trigger.aria", { model: modelLabel }) : t("trigger.ariaEffort", {
				model: modelLabel,
				effort: effortLabel
			});
			itemRefs.current = [];
			let itemIndex = 0;
			let modelIndex = 0;
			const itemRef = () => {
				const at = itemIndex++;
				return (node) => {
					itemRefs.current[at] = node;
				};
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				className: ModelSelect_module_css_default.root,
				onKeyDown: onRootKeyDown,
				onBlur,
				onMouseDown: (event) => {
					if (event.target instanceof Element && event.target.closest("button") !== null) event.preventDefault();
				},
				children: [
					(0, react_jsx_runtime.jsxs)("button", {
						ref: triggerRef,
						type: "button",
						className: ModelSelect_module_css_default.trigger,
						"aria-label": triggerAria,
						"aria-haspopup": "menu",
						"aria-expanded": open,
						"aria-controls": open ? `${id}-menu` : void 0,
						title: triggerLabel,
						"aria-busy": busy,
						"data-selection-focus": selectionFocus ? "" : void 0,
						onBlur: () => {
							setSelectionFocus(false);
						},
						disabled: locked,
						onClick: () => {
							if (open) close(true);
							else show();
						},
						children: [
							(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutlineRegular, {
								className: ModelSelect_module_css_default.triggerIcon,
								size: 16
							}),
							(0, react_jsx_runtime.jsx)("span", {
								className: ModelSelect_module_css_default.triggerLabel,
								children: modelLabel
							}),
							effortLabel !== void 0 && (0, react_jsx_runtime.jsx)("span", {
								className: ModelSelect_module_css_default.triggerEffort,
								children: effortLabel
							}),
							busy ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, { className: clsx(ModelSelect_module_css_default.chevron, open && ModelSelect_module_css_default.chevronOpen) })
						]
					}),
					open && (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.MenuSurface, {
						ref: menuRef,
						id: `${id}-menu`,
						className: ModelSelect_module_css_default.menu,
						style: menuPos ?? MEASURE_STYLE,
						role: pane === "model" ? "group" : "menu",
						"aria-label": t("menu.aria"),
						"aria-busy": state.status === "loading" || busy,
						children: [
							pane === "root" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("button", {
								ref: itemRef(),
								type: "button",
								role: "menuitem",
								className: ModelSelect_module_css_default.cell,
								onClick: () => {
									drill("model");
								},
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: ModelSelect_module_css_default.cellLabel,
										children: t("menu.model")
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: ModelSelect_module_css_default.cellValue,
										children: modelLabel
									}),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { className: ModelSelect_module_css_default.cellChevron })
								]
							}), reasoning !== void 0 && (0, react_jsx_runtime.jsxs)("button", {
								ref: itemRef(),
								type: "button",
								role: "menuitem",
								className: ModelSelect_module_css_default.cell,
								onClick: () => {
									drill("effort");
								},
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: ModelSelect_module_css_default.cellLabel,
										children: t("menu.effort")
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: ModelSelect_module_css_default.cellValue,
										children: effortLabel
									}),
									(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, { className: ModelSelect_module_css_default.cellChevron })
								]
							})] }),
							pane === "model" && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								showSearch && (0, react_jsx_runtime.jsxs)("div", {
									className: ModelSelect_module_css_default.searchRow,
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
										ref: searchRef,
										className: clsx(ModelSelect_module_css_default.search, query !== "" && ModelSelect_module_css_default.searchWithQuery),
										type: "text",
										role: "searchbox",
										"aria-label": t("search.placeholder"),
										"aria-controls": `${id}-models`,
										"aria-activedescendant": activeModelIndex < 0 ? void 0 : `${id}-model-${activeModelIndex}`,
										placeholder: t("search.placeholder"),
										value: query,
										readOnly: busy,
										onChange: (event) => {
											changeQuery(event.target.value);
										}
									}), query !== "" && (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: ModelSelect_module_css_default.searchClear,
										"aria-label": t("search.clear"),
										disabled: busy,
										onClick: () => {
											changeQuery("");
											searchRef.current?.focus();
										},
										children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFillRegular, {})
									})]
								}),
								state.status === "loading" && (0, react_jsx_runtime.jsx)("div", {
									className: ModelSelect_module_css_default.status,
									children: t("status.loading")
								}),
								state.error !== null && lastActionRef.current === "load" && (0, react_jsx_runtime.jsxs)("div", {
									className: ModelSelect_module_css_default.error,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("error.action", { message: state.error }) }), (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: ModelSelect_module_css_default.retry,
										onClick: reload,
										children: t("retry")
									})]
								}),
								state.failures.map((failure) => (0, react_jsx_runtime.jsxs)("div", {
									className: ModelSelect_module_css_default.warning,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("warning.groupLoad", {
										name: failure.id === "deepseek-account" ? t("provider.account") : failure.name,
										message: failure.message
									}) }), (0, react_jsx_runtime.jsx)("button", {
export {};
