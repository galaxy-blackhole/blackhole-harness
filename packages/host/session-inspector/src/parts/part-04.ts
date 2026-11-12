/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-experimental-session-inspector/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/InspectorObjectTree.js
		/** Shared value rendering for JSON details and lazy runtime objects with identity links. */
		const PAGE_SIZE = 50;
		function ObjectBranch({ value, name, path, ancestors, root, accessor, absent, navigation, t }) {
			const json = navigation === void 0;
			const objects = navigation?.objects;
			const revision = navigation?.revision;
			const [expanded, setExpanded] = (0, react.useState)(root === true || json);
			const [limit, setLimit] = (0, react.useState)(json ? Infinity : PAGE_SIZE);
			const content = (0, react.useMemo)(() => {
				try {
					const reference = !root && value !== null && typeof value === "object" ? objects?.reference(value) : void 0;
					const circular = value !== null && typeof value === "object" ? ancestors.get(value) : void 0;
					const display = (reference === void 0 || reference.kind === "nodeData") && circular === void 0 && !accessor ? new InspectorObjectValue(value) : void 0;
					const entries = [];
					if (expanded && display?.expandable === true) for (const entry of display.entries()) {
						if (json && entry.properties) continue;
						entries.push(entry);
						if (entries.length > limit) break;
					}
					return {
						reference,
						circular,
						display,
						entries,
						error: void 0
					};
				} catch (error) {
					return { error: error instanceof Error ? error.message : String(error) };
				}
			}, [
				value,
				root,
				objects,
				ancestors,
				accessor,
				expanded,
				limit,
				revision,
				json
			]);
			const children = (0, react.useMemo)(() => {
				const next = new Map(ancestors);
				if (value !== null && typeof value === "object") next.set(value, path);
				return next;
			}, [
				ancestors,
				value,
				path
			]);
			const field = (0, react_jsx_runtime.jsxs)("span", {
				className: inspector_module_css_default.objectField,
				children: [name, ": "]
			});
			if (content.error !== void 0) return (0, react_jsx_runtime.jsxs)("li", {
				role: "alert",
				children: [field, content.error]
			});
			if (absent) return (0, react_jsx_runtime.jsxs)("li", { children: [field, (0, react_jsx_runtime.jsx)("span", {
				className: inspector_module_css_default.objectMuted,
				children: t("object.absent")
			})] });
			if (accessor) return (0, react_jsx_runtime.jsxs)("li", { children: [field, (0, react_jsx_runtime.jsx)("span", {
				className: inspector_module_css_default.objectMuted,
				children: t("object.accessor")
			})] });
			const reference = content.reference;
			const link = reference === void 0 || navigation === void 0 ? void 0 : (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: inspector_module_css_default.objectReference,
				onClick: (event) => {
					event.preventDefault();
					event.stopPropagation();
					navigation.navigate(reference);
				},
				children: [
					"↗ ",
					t(`object.${reference.kind}`),
					" · ",
					reference.identity
				]
			});
			if (reference !== void 0 && (reference.kind !== "nodeData" || content.circular !== void 0)) return (0, react_jsx_runtime.jsxs)("li", { children: [field, link] });
			if (content.circular !== void 0) return (0, react_jsx_runtime.jsxs)("li", { children: [field, (0, react_jsx_runtime.jsxs)("span", {
				className: inspector_module_css_default.objectMuted,
				children: ["↩ ", content.circular]
			})] });
			const display = content.display;
			if (!display.expandable) return (0, react_jsx_runtime.jsxs)("li", { children: [field, (0, react_jsx_runtime.jsx)("span", {
				className: inspector_module_css_default.objectValue,
				children: display.label
			})] });
			return (0, react_jsx_runtime.jsx)("li", { children: (0, react_jsx_runtime.jsxs)("details", {
				open: expanded,
				onToggle: (event) => {
					setExpanded(event.currentTarget.open);
				},
				children: [(0, react_jsx_runtime.jsxs)("summary", { children: [
					field,
					link,
					" ",
					(0, react_jsx_runtime.jsx)("span", {
						className: inspector_module_css_default.objectMuted,
						children: display.label
					})
				] }), expanded && (0, react_jsx_runtime.jsxs)("ul", { children: [
					content.entries.slice(0, limit).map(({ key, properties, ...entry }) => (0, react_jsx_runtime.jsx)(ObjectBranch, {
						...entry,
						name: properties ? t("object.properties") : entry.name,
						path: properties ? path : `${path}.${entry.name}`,
						ancestors: children,
						navigation,
						t
					}, key)),
					content.entries.length === 0 && (0, react_jsx_runtime.jsx)("li", {
						className: inspector_module_css_default.objectMuted,
						children: t("object.empty")
					}),
					content.entries.length > limit && (0, react_jsx_runtime.jsx)("li", { children: (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: inspector_module_css_default.objectReference,
						onClick: () => {
							setLimit((value) => value + PAGE_SIZE);
						},
						children: t("object.more")
					}) })
				] })]
			}) });
		}
		function ValueTree(props) {
			const ancestors = (0, react.useMemo)(() => /* @__PURE__ */ new Map(), []);
			return (0, react_jsx_runtime.jsx)("ul", {
				className: inspector_module_css_default.objectTree,
				children: (0, react_jsx_runtime.jsx)(ObjectBranch, {
					...props,
					name: "$",
					path: "$",
					ancestors,
					root: true
				})
			});
		}
		/**
		* Display serialized Inspector JSON with every container initially expanded and no reference navigation.
		* @param props - Successful inspectorJson output and localized tree labels; empty text represents undefined.
		* @returns The same value tree as Chat details, without collection paging or runtime-object links.
		*/
		function InspectorJsonTree({ text, t }) {
			return (0, react_jsx_runtime.jsx)(ValueTree, {
				value: (0, react.useMemo)(() => text === "" ? void 0 : JSON.parse(text), [text]),
				t
			});
		}
		/**
		* Inspect the root and nested Node Data inline; other registered objects remain navigation links.
		* Node Data titles also navigate, while repeated ancestors never expand recursively.
		* Expanded fields are cached until their value or Conversation publication changes.
		* @param props - Original object, weak identity lookup, locale, and reference activation.
		* @returns A lazily expanded, typed tree that retains Map keys and collection identities.
		*/
		function InspectorObjectTree(props) {
			const updates = props.objects.updates;
			const revision = (0, react.useSyncExternalStore)((0, react.useCallback)((listener) => updates.subscribe(listener), [updates]), (0, react.useCallback)(() => updates.getSnapshot(), [updates]));
			return (0, react_jsx_runtime.jsx)(ValueTree, {
				value: props.value,
				t: props.t,
				navigation: {
					objects: props.objects,
					navigate: props.navigate,
					revision
				}
			});
		}
		/** View-local spacing; constructing without a predecessor resets retained blank areas. */
		var InspectorTableLayout = class {
			hierarchy;
			/** Visible data rows and their virtual sizes; excludes the table header and trailing space. */
			items;
			/** Whether a live block closure shortened the previous visible hierarchy. */
			preservedCollapse;
			/** Trailing space in CSS pixels retained to keep the viewport anchor stable. */
			bottomPadding;
			/** Anchored scroll offset in CSS pixels, or undefined when no anchor adjustment is needed. */
			scrollOffset;
			minimumExtent;
			rowIndexes = /* @__PURE__ */ new Map();
			/**
			* @param hierarchy - Current visible data rows.
			* @param previous - Previous committed layout, omitted after manual disclosure changes.
			* @param viewport - Scroll geometry before the current row change.
			* @param anchor - Clicked disclosure row to retain at its measured viewport position.
			*/
			constructor(hierarchy, previous, viewport = {
				offset: 0,
				height: 0
			}, anchor) {
				this.hierarchy = hierarchy;
				for (const [rowIndex, row] of hierarchy.rows.entries()) this.rowIndexes.set(row.key, rowIndex);
				this.items = hierarchy.rows.map((row, rowIndex) => ({
					key: row.key,
					rowIndex,
					row,
					size: 30
				}));
				this.preservedCollapse = previous !== void 0 && hierarchy.rows.length < previous.hierarchy.rows.length && hierarchy.rows.some((row) => row.disclosure === "closed" && previous.hierarchy.rows[previous.rowIndexes.get(row.key) ?? -1]?.disclosure === "open");
				const anchorIndex = anchor === void 0 ? void 0 : this.rowIndexes.get(anchor.key);
				this.scrollOffset = anchor !== void 0 && anchorIndex !== void 0 ? Math.max(0, (anchorIndex + 1) * 30 - anchor.top) : this.preservedCollapse && previous !== void 0 ? this.anchorOffset(previous, viewport.offset) : void 0;
				const natural = (this.items.length + 1) * 30;
				const minimum = this.scrollOffset === void 0 ? previous?.minimumExtent ?? 0 : Math.max(this.scrollOffset + viewport.height, (previous?.minimumExtent ?? 0) + this.scrollOffset - viewport.offset);
				this.minimumExtent = minimum > natural ? minimum : 0;
				this.bottomPadding = Math.max(0, this.minimumExtent - natural);
			}
			/**
			* Keep the enclosing headers visible above the first visible data row.
			* @param itemIndex - First visible virtual item.
			* @returns Ancestor indexes in the virtual layout.
			*/
			stickyIndexes(itemIndex) {
				return this.hierarchy.stickyIndexes(itemIndex);
			}
			/**
			* Resolve each sticky level below the table header and already occupied sticky rows.
			* @param offset - Scroll offset in CSS pixels.
			* @returns Active ancestor indexes, outermost first.
			*/
			stickyIndexesAtOffset(offset) {
				const indexes = [];
				const first = Math.max(0, Math.floor(offset / 30));
				while (indexes.length < this.items.length) {
					const candidate = Math.min(this.items.length - 1, first + indexes.length);
					const ancestors = this.stickyIndexes(candidate);
					const next = ancestors[indexes.length];
					if (next === void 0 || indexes.some((index, level) => ancestors[level] !== index)) break;
					indexes.push(next);
				}
				return indexes;
			}
			anchorOffset(previous, offset) {
				const first = Math.max(0, Math.min(previous.items.length - 1, Math.floor(offset / 30)));
				const index = Math.min(previous.items.length - 1, first + previous.stickyIndexesAtOffset(offset).length);
				const row = previous.items[index].row;
				const retained = this.rowIndexes.get(row.key);
				if (retained !== void 0) return Math.max(0, offset + (retained - index) * 30);
				const ancestors = previous.stickyIndexes(index);
				for (let level = ancestors.length - 1; level >= 0; level--) {
					const parent = previous.items[ancestors[level]].row;
					const next = this.rowIndexes.get(parent.key);
					if (next !== void 0) return Math.max(0, (next - level) * 30);
				}
				return 0;
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/type-filter.js
		/** Confirmed type filtering preserves the ancestors needed to inspect matching nested rows. */
		/** Case-insensitive containment filter; optional surrounding stars have the same meaning as omission. */
		var InspectorTypeFilter = class {
			/** Trimmed type fragment without optional surrounding stars; preserves the entered case. */
			query;
			needle;
			/** @param query - Type fragment; empty text or only stars clears filtering. */
			constructor(query) {
				this.query = query.trim().replace(/^\*+|\*+$/g, "").trim();
				this.needle = this.query.toLowerCase();
			}
			/**
			* Distinguish a type restriction from an empty or all-stars query.
			* @returns Whether this filter restricts the table.
			*/
			get active() {
				return this.needle !== "";
			}
			/**
			* Match a type by case-insensitive containment, accepting all types when filtering is inactive.
			* @param type - Current raw type, absent while its record is unavailable.
			* @returns Whether the record matches the filter.
			*/
			matches(type) {
				return !this.active || type !== void 0 && type.toLowerCase().includes(this.needle);
			}
			/**
			* Retain matching rows and their ancestors; matching descendants start visible even under closed blocks.
			* @param rows - Complete loaded hierarchy, before user disclosure choices.
			* @param typeOf - Current type reader, independent of React row subscriptions.
			* @returns Matching rows and contextual ancestors in their original order.
			*/
			apply(rows, typeOf) {
				if (!this.active) return {
					rows,
					matches: new Set(rows.map((row) => row.key))
				};
				const matches = new Set(rows.filter((row) => this.matches(typeOf(row.key))).map((row) => row.key));
				const byKey = new Map(rows.map((row) => [row.key, row]));
				const retained = new Set(matches);
				for (const key of matches) {
					let parent = byKey.get(key)?.parent;
					while (parent !== void 0 && !retained.has(parent)) {
						retained.add(parent);
						parent = byKey.get(parent)?.parent;
					}
				}
				const branches = /* @__PURE__ */ new Set();
				for (const key of retained) {
					const parent = byKey.get(key)?.parent;
					if (parent !== void 0) branches.add(parent);
				}
				return {
					matches,
					rows: rows.filter((row) => retained.has(row.key)).map((row) => {
						const { disclosure: _disclosure, ...plain } = row;
						return branches.has(row.key) ? {
							...plain,
							disclosure: "open"
						} : plain;
					})
				};
			}
			/**
			* Resolve candidates asynchronously from all loaded rows, not the already filtered subset.
			* @param rows - Complete loaded row list.
			* @param typeOf - Current raw type reader.
			* @returns Distinct matching types in deterministic order.
			*/
			async suggest(rows, typeOf) {
				await Promise.resolve();
				const types = /* @__PURE__ */ new Set();
				for (const row of rows) {
					const type = typeOf(row.key);
					if (type !== void 0 && this.matches(type)) types.add(type);
				}
				return [...types].sort();
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/TypeFilter.js
		/** Anchored type-filter editor with asynchronous suggestions and explicit confirmation. */
		/**
		* Edit a type fragment without filtering until Enter, Apply, or a candidate is selected.
		* @param props - Confirmed query, candidate resolver, commit callback, and localized copy.
		* @returns A header button and its portaled editor; stale responses cannot replace newer suggestions.
		*/
		function TypeFilter({ value, suggest, apply, t }) {
			const [open, setOpen] = (0, react.useState)(false);
			const [draft, setDraft] = (0, react.useState)(value);
			const [active, setActive] = (0, react.useState)(-1);
			const [result, setResult] = (0, react.useState)();
			const anchor = (0, react.useRef)(null);
			const panel = (0, react.useRef)(null);
			const input = (0, react.useRef)(null);
			const id = (0, react.useId)();
			const listId = `${id}-types`;
			const position = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef: anchor,
				panelRef: panel,
				gap: 4,
				margin: 12
			});
			const close = (0, react.useCallback)((restoreFocus) => {
				setOpen(false);
				if (restoreFocus) anchor.current?.focus({ preventScroll: true });
			}, []);
			const commit = (query) => {
				apply(query);
				close(true);
			};
			(0, react.useEffect)(() => {
				if (!open) return;
				input.current?.focus({ preventScroll: true });
				input.current?.select();
				const outside = (event) => {
					const target = event.target;
					if (target instanceof Node && !panel.current?.contains(target) && !anchor.current?.contains(target)) close(false);
				};
				const blur = () => {
					close(false);
				};
				window.addEventListener("pointerdown", outside, true);
				window.addEventListener("blur", blur);
				return () => {
					window.removeEventListener("pointerdown", outside, true);
					window.removeEventListener("blur", blur);
				};
			}, [open, close]);
			(0, react.useEffect)(() => {
				if (!open) return;
				let current = true;
				setResult(void 0);
				setActive(-1);
				Promise.resolve().then(() => suggest(draft)).then((items) => {
					if (current) setResult({
						query: draft,
						items
					});
				}, (error) => {
					if (current) setResult({
						query: draft,
						items: [],
						error: error instanceof Error ? error.message : String(error)
					});
				});
				return () => {
					current = false;
				};
			}, [
				open,
				draft,
				suggest
			]);
			const current = result?.query === draft ? result : void 0;
			const items = current?.items ?? [];
			const selected = active >= 0 && active < items.length ? active : -1;
			(0, react.useEffect)(() => {
				if (selected >= 0) panel.current?.querySelectorAll("[role=\"option\"]")[selected]?.scrollIntoView({ block: "nearest" });
			}, [selected]);
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("button", {
				ref: anchor,
				type: "button",
				className: inspector_module_css_default.typeFilterButton,
				"aria-label": t("filter.title"),
				title: value === "" ? t("filter.title") : `${t("filter.title")}: *${value}*`,
				"aria-haspopup": "dialog",
				"aria-expanded": open,
				"aria-pressed": value !== "",
				onClick: () => {
					if (open) {
						close(true);
						return;
					}
					setDraft(value);
					setResult(void 0);
					setActive(-1);
					setOpen(true);
				},
				children: (0, react_jsx_runtime.jsx)("svg", {
					width: "13",
					height: "13",
					viewBox: "0 0 16 16",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.3",
					"aria-hidden": "true",
					children: (0, react_jsx_runtime.jsx)("path", { d: "M2 3h12L9.5 8v5l-3-1.5V8L2 3Z" })
				})
			}), open && (0, react_dom.createPortal)((0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MenuSurface, {
				compact: true,
				ref: panel,
				className: inspector_module_css_default.typeFilterPanel,
				role: "dialog",
				"aria-label": t("filter.title"),
				style: position ?? {
					left: 0,
					top: 0,
					visibility: "hidden"
				},
				onKeyDown: (event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						event.stopPropagation();
						close(true);
					}
				},
				onBlur: (event) => {
					if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget) && !anchor.current?.contains(event.relatedTarget)) close(false);
				},
				children: (0, react_jsx_runtime.jsxs)("div", { children: [
					(0, react_jsx_runtime.jsx)("input", {
						ref: input,
						className: inspector_module_css_default.typeFilterInput,
						value: draft,
						role: "combobox",
						"aria-label": t("filter.input"),
						"aria-autocomplete": "list",
						"aria-expanded": true,
						"aria-controls": listId,
						"aria-activedescendant": selected < 0 ? void 0 : `${id}-option-${selected}`,
						placeholder: t("filter.placeholder"),
						onChange: (event) => {
							setDraft(event.currentTarget.value);
							setActive(-1);
						},
						onKeyDown: (event) => {
							if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
							if (event.key === "ArrowDown" || event.key === "ArrowUp") {
								event.preventDefault();
								setActive(items.length === 0 ? -1 : selected < 0 ? event.key === "ArrowDown" ? 0 : items.length - 1 : (selected + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
							} else if (event.key === "Enter") {
								event.preventDefault();
								commit(items[selected] ?? draft);
							}
						}
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: inspector_module_css_default.typeFilterHelp,
						children: t("filter.help")
					}),
					(0, react_jsx_runtime.jsx)("div", {
						id: listId,
						role: "listbox",
						"aria-label": t("filter.candidates"),
						"aria-busy": current === void 0,
						className: inspector_module_css_default.typeFilterOptions,
						children: items.map((type, index) => (0, react_jsx_runtime.jsx)("button", {
							id: `${id}-option-${index}`,
							type: "button",
							role: "option",
							"aria-selected": selected === index,
							tabIndex: -1,
							title: type,
							onPointerDown: (event) => {
								event.preventDefault();
							},
							onClick: () => {
								commit(type);
							},
							children: type
						}, type))
					}),
					current === void 0 && (0, react_jsx_runtime.jsx)("div", {
						role: "status",
						children: t("filter.loading")
					}),
					current?.error !== void 0 ? (0, react_jsx_runtime.jsxs)("div", {
						role: "alert",
						children: [
							t("filter.failed"),
							" ",
							current.error
						]
					}) : current !== void 0 && items.length === 0 && (0, react_jsx_runtime.jsx)("div", {
						role: "status",
						children: t("filter.noCandidates")
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: inspector_module_css_default.typeFilterActions,
						children: [
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									setDraft("");
									setActive(-1);
									input.current?.focus();
								},
								children: t("filter.clear")
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									close(true);
								},
								children: t("filter.cancel")
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									commit(draft);
								},
								children: t("filter.apply")
							})
						]
					})
				] })
			}), document.body)] });
		}
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
