/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc @deepseek-ai/dsh-experimental-session-inspector/lib/client.js (xem tools/split-stock-bundle.ts)
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.

function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/InspectorTable.js
		/** Virtualized raw-data table shared by Session log and Chat structure views. */
		const DataRow = (0, react.memo)(function DataRow({ row, selected, branch, collapsed, added, stickyLevel, pulse, context, select, toggle, useRecord, flash, showTime, t }) {
			const record = useRecord(row.key);
			const element = (0, react.useRef)(null);
			const previous = (0, react.useRef)(record);
			const previousPulse = (0, react.useRef)(0);
			(0, react.useEffect)(() => {
				const changed = previous.current !== record;
				previous.current = record;
				const navigated = pulse > 0 && previousPulse.current !== pulse;
				previousPulse.current = pulse;
				if (!flash && !navigated || !changed && !added && !navigated || element.current === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
				const color = getComputedStyle(element.current).getPropertyValue("--dsw-specific-bubble-highlight");
				const animation = element.current.animate([{ backgroundColor: color }, { backgroundColor: "transparent" }], { duration: 700 });
				return () => {
					animation.cancel();
				};
			}, [
				record,
				added,
				flash,
				pulse
			]);
			const summary = (0, react.useMemo)(() => (collapsed ? record?.collapsedSummary : void 0) ?? record?.summary ?? inspectorPreview(record?.value), [record, collapsed]);
			return (0, react_jsx_runtime.jsxs)("tr", {
				ref: element,
				"aria-selected": selected,
				"data-inspector-context": context ? "" : void 0,
				title: context ? t("filter.context") : void 0,
				className: [
					selected && inspector_module_css_default.selected,
					stickyLevel !== void 0 && inspector_module_css_default.sticky,
					context && inspector_module_css_default.contextRow
				].filter(Boolean).join(" "),
				style: stickyLevel === void 0 ? void 0 : {
					top: (stickyLevel + 1) * 30,
					zIndex: 9 - stickyLevel
				},
				children: [
					(0, react_jsx_runtime.jsx)("td", {
						className: inspector_module_css_default.identity,
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: record?.identity ?? "",
							side: "right",
							portal: true,
							children: (0, react_jsx_runtime.jsx)("span", {
								className: inspector_module_css_default.identityText,
								tabIndex: 0,
								children: record?.identity
							})
						})
					}),
					(0, react_jsx_runtime.jsxs)("td", {
						style: { paddingInlineStart: 8 + row.depth * 20 },
						children: [branch && (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: inspector_module_css_default.disclosure,
							"aria-label": collapsed ? t("table.expand") : t("table.collapse"),
							"aria-expanded": !collapsed,
							onClick: () => {
								toggle(row, element.current);
							},
							children: collapsed ? "▸" : "▾"
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: inspector_module_css_default.record,
							onClick: () => {
								select(row.key);
							},
							children: record?.type
						})]
					}),
					(0, react_jsx_runtime.jsx)("td", { children: record?.location }),
					showTime && (0, react_jsx_runtime.jsx)("td", { children: record?.time === void 0 ? "" : new Date(record.time).toISOString().slice(11, 23) }),
					(0, react_jsx_runtime.jsx)("td", { children: (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: inspector_module_css_default.preview,
						onClick: () => {
							select(row.key);
						},
						children: summary
					}) })
				]
			});
		});
		/**
		* Render a paged hierarchy with stable virtual row keys and live JSON details.
		* @param props - Framework hooks, pagination, locale, and the view's highlight policy.
		* @returns Virtual table and selected raw data.
		*/
		function InspectorTable({ title, flash, showTime, modeSelector, objects, navigation, pickedRow, notice, useRows, useRecord, useSession, loadOlder, typeOf, t }) {
			const allRows = useRows((value) => value);
			const hasMore = useSession((value) => value.hasMore);
			const loading = useSession((value) => value.loadingOlder);
			const openError = useSession((value) => value.openError);
			const [failure, setFailure] = (0, react.useState)(null);
			const [selected, setSelected] = (0, react.useState)(null);
			const record = useRecord(selected ?? "");
			const rowLabel = `${record?.type ?? ""} · ${record?.identity ?? selected}`;
			const [objectHistory, setObjectHistory] = (0, react.useState)(null);
			const objectTarget = objectHistory?.references.at(-1);
			const [reveal, setReveal] = (0, react.useState)(null);
			const appliedReveal = (0, react.useRef)(null);
			const appliedPick = (0, react.useRef)();
			const [disclosures, setDisclosures] = (0, react.useState)(/* @__PURE__ */ new Map());
			const [typeQuery, setTypeQuery] = (0, react.useState)("");
			const typeFilter = (0, react.useMemo)(() => new InspectorTypeFilter(typeQuery), [typeQuery]);
			const filtered = (0, react.useMemo)(() => typeFilter.apply(allRows, typeOf), [
				allRows,
				typeOf,
				typeFilter
			]);
			const suggestTypes = (0, react.useCallback)((query) => new InspectorTypeFilter(query).suggest(allRows, typeOf), [allRows, typeOf]);
			const scroller = (0, react.useRef)(null);
			const followMode = (0, react.useRef)("tail");
			const viewport = (0, react.useRef)({
				offset: 0,
				height: 600
			});
			const disclosureAnchor = (0, react.useRef)();
			const [spacingGeneration, resetSpacing] = (0, react.useState)(0);
			const toggle = (0, react.useCallback)((row, element) => {
				const host = scroller.current;
				followMode.current = "manual";
				disclosureAnchor.current = {
					key: row.key,
					top: element.getBoundingClientRect().top - host.getBoundingClientRect().top - host.clientTop
				};
				viewport.current = {
					offset: host.scrollTop,
					height: host.clientHeight
				};
				setDisclosures((previous) => {
					const next = new Map(previous);
					next.set(row.key, {
						state: row.disclosure,
						collapsed: !inspectorRowCollapsed(row, previous)
					});
					return next;
				});
			}, []);
			const locateChat = (0, react.useCallback)((target) => {
				navigation?.reveal(target ?? {});
			}, [navigation]);
			const select = (0, react.useCallback)((key) => {
				setSelected(key);
				setObjectHistory(null);
				const target = navigation?.target(key);
				locateChat(target);
			}, [navigation, locateChat]);
			const revealRow = (0, react.useCallback)((key) => {
				const clearFilter = typeFilter.active && !filtered.rows.some((row) => row.key === key);
				if (clearFilter) setTypeQuery("");
				followMode.current = "scroll";
				setSelected(key);
				setDisclosures((previous) => {
					const next = new Map(previous);
					const byKey = new Map((clearFilter ? allRows : filtered.rows).map((row) => [row.key, row]));
					let parent = byKey.get(key)?.parent;
					while (parent !== void 0) {
						const row = byKey.get(parent);
						if (row === void 0) break;
						next.set(parent, {
							state: row.disclosure,
							collapsed: false
						});
						parent = row.parent;
					}
					return next;
				});
				setReveal((previous) => ({
					key,
					pulse: (previous?.pulse ?? 0) + 1
				}));
			}, [
				allRows,
				typeFilter,
				filtered.rows
			]);
			const navigate = (0, react.useCallback)((reference) => {
				setObjectHistory((previous) => ({
					rootKey: previous?.rootKey ?? selected,
					rootLabel: previous?.rootLabel ?? rowLabel,
					references: [...previous?.references ?? [], reference]
				}));
				locateChat(reference.target);
				if (reference.rowKey !== void 0) revealRow(reference.rowKey);
			}, [
				revealRow,
				locateChat,
				selected,
				rowLabel
			]);
			const backToObject = (index) => {
				const history = objectHistory;
				const reference = history.references[index - 1];
				const key = index === 0 ? history.rootKey : reference?.rowKey;
				const target = index === 0 ? navigation?.target(history.rootKey) : reference?.target;
				setObjectHistory(index === 0 ? null : {
					...history,
					references: history.references.slice(0, index)
				});
				if (key !== void 0) revealRow(key);
				locateChat(target);
			};
			(0, react.useLayoutEffect)(() => {
				if (pickedRow === void 0 || appliedPick.current === pickedRow || !allRows.some((row) => row.key === pickedRow.key)) return;
				appliedPick.current = pickedRow;
				setObjectHistory(null);
				revealRow(pickedRow.key);
			}, [
				pickedRow,
				allRows,
				revealRow
			]);
			const hierarchy = (0, react.useMemo)(() => new InspectorTableHierarchy(filtered.rows, disclosures), [filtered.rows, disclosures]);
			const rows = hierarchy.rows;
			const committed = (0, react.useRef)();
			const layout = (0, react.useMemo)(() => new InspectorTableLayout(hierarchy, committed.current?.disclosures === disclosures && committed.current.spacingGeneration === spacingGeneration ? committed.current.layout : void 0, viewport.current, disclosureAnchor.current), [
				hierarchy,
				disclosures,
				spacingGeneration
			]);
			const anchoredOffset = committed.current?.layout !== layout ? layout.scrollOffset : void 0;
			const seen = (0, react.useRef)(/* @__PURE__ */ new Map());
			const initialized = (0, react.useRef)(false);
			const arrivals = (0, react.useMemo)(() => {
				const now = performance.now();
				const next = new Map(allRows.map((row) => [row.key, seen.current.get(row.key) ?? (initialized.current ? now : -Infinity)]));
				if (allRows.length > 0) initialized.current = true;
				seen.current = next;
				return next;
			}, [allRows]);
			const keyOf = (0, react.useCallback)((index) => layout.items[index].key, [layout]);
			const sizeOf = (0, react.useCallback)((index) => layout.items[index].size, [layout]);
			const virtualRef = (0, react.useRef)();
			const extractRange = (0, react.useCallback)((range) => {
				const offset = anchoredOffset ?? virtualRef.current.scrollOffset;
				const visible = anchoredOffset === void 0 ? range : {
					...range,
					startIndex: Math.max(0, Math.floor(offset / 30) - 1),
					endIndex: Math.min(range.count - 1, Math.ceil((offset + viewport.current.height) / 30) - 1)
				};
				return [...new Set([...layout.stickyIndexesAtOffset(offset), ...(0, _tanstack_react_virtual.defaultRangeExtractor)(visible)])].sort((left, right) => left - right);
			}, [layout, anchoredOffset]);
			const virtual = (0, _tanstack_react_virtual.useVirtualizer)({
				count: layout.items.length,
				getScrollElement: () => scroller.current,
				estimateSize: sizeOf,
				getItemKey: keyOf,
				overscan: 12,
				initialRect: {
					width: 0,
					height: 600
				},
				anchorTo: layout.scrollOffset !== void 0 || followMode.current === "manual" ? "start" : "end",
				scrollEndThreshold: 40,
				paddingStart: 30,
				scrollPaddingStart: 30,
				rangeExtractor: extractRange,
				paddingEnd: layout.bottomPadding
			});
			virtualRef.current = virtual;
			const viewportHeight = virtual.scrollRect?.height;
			const applyTypeFilter = (query) => {
				followMode.current = "scroll";
				setTypeQuery(new InspectorTypeFilter(query).query);
				setDisclosures(/* @__PURE__ */ new Map());
				resetSpacing((value) => value + 1);
				setSelected(null);
				setObjectHistory(null);
				setReveal(null);
				virtual.scrollToOffset(0);
			};
			(0, react.useLayoutEffect)(() => {
				if (anchoredOffset !== void 0) virtual.scrollToOffset(anchoredOffset);
				else if (followMode.current === "tail" && layout.bottomPadding === 0) virtual.scrollToEnd();
				viewport.current = {
					offset: scroller.current.scrollTop,
					height: viewportHeight ?? 600
				};
				disclosureAnchor.current = void 0;
				committed.current = {
					layout,
					disclosures,
					spacingGeneration
				};
			}, [
				virtual,
				layout,
				disclosures,
				spacingGeneration,
				viewportHeight,
				anchoredOffset
			]);
			(0, react.useLayoutEffect)(() => {
				if (reveal === null || appliedReveal.current === reveal) return;
				const index = layout.items.findIndex((item) => item.key === reveal.key);
				if (index === -1) return;
				virtual.scrollToIndex(index, { align: "center" });
				appliedReveal.current = reveal;
			}, [
				layout,
				reveal,
				virtual
			]);
			const items = virtual.getVirtualItems();
			const sticky = new Map(layout.stickyIndexesAtOffset(anchoredOffset ?? virtual.scrollOffset).map((index, level) => [index, level]));
			const lastItem = items.at(-1);
			const bottom = lastItem === void 0 ? 0 : Math.max(0, virtual.getTotalSize() - lastItem.end);
			const detail = (0, react.useMemo)(() => inspectorJson(objects === void 0 ? record?.value : void 0), [record, objects]);
			const detailValue = objectTarget === void 0 ? record?.value : objectTarget.read();
			const breadcrumbs = [objectHistory?.rootLabel ?? rowLabel, ...objectHistory?.references.map((reference) => `${t(`object.${reference.kind}`)} · ${reference.identity}`) ?? []];
			const columns = showTime ? 5 : 4;
			return (0, react_jsx_runtime.jsxs)("section", {
				className: inspector_module_css_default.root,
				"aria-label": title,
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: inspector_module_css_default.toolbar,
						children: [
							(0, react_jsx_runtime.jsxs)("span", { children: [
								modeSelector ?? title,
								" · ",
								typeFilter.active ? `${filtered.matches.size} / ${allRows.length}` : allRows.length
							] }),
							hasMore && (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								disabled: loading,
								onClick: () => {
									followMode.current = "scroll";
									setFailure(null);
									loadOlder().catch((error) => {
										setFailure(String(error));
									});
								},
								children: loading ? t("table.loading") : t("table.older")
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								onClick: () => {
									followMode.current = "tail";
									resetSpacing((value) => value + 1);
								},
								children: t("table.latest")
							})
						]
					}),
					notice !== void 0 && (0, react_jsx_runtime.jsx)("div", {
						className: inspector_module_css_default.pickNotice,
						role: "status",
						children: notice
					}),
					(failure !== null || openError !== null) && (0, react_jsx_runtime.jsx)("p", {
						role: "alert",
						children: failure ?? openError?.message
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						ref: scroller,
						className: inspector_module_css_default.scroller,
						onScroll: ({ currentTarget }) => {
							viewport.current.offset = currentTarget.scrollTop;
							if (followMode.current !== "manual") followMode.current = currentTarget.scrollHeight - currentTarget.clientHeight - currentTarget.scrollTop <= 40 ? "tail" : "scroll";
						},
						children: [(0, react_jsx_runtime.jsxs)("table", {
							className: inspector_module_css_default.table,
							"aria-label": title,
							"aria-rowcount": rows.length + 1,
							children: [(0, react_jsx_runtime.jsx)("thead", { children: (0, react_jsx_runtime.jsxs)("tr", { children: [
								(0, react_jsx_runtime.jsx)("th", {
									className: inspector_module_css_default.idColumn,
									children: t("table.id")
								}),
								(0, react_jsx_runtime.jsx)("th", {
									className: inspector_module_css_default.typeColumn,
									children: (0, react_jsx_runtime.jsxs)("span", {
										className: inspector_module_css_default.typeHeader,
										children: [t("table.type"), (0, react_jsx_runtime.jsx)(TypeFilter, {
											value: typeQuery,
											suggest: suggestTypes,
											apply: applyTypeFilter,
											t
										})]
									})
								}),
								(0, react_jsx_runtime.jsx)("th", {
									className: inspector_module_css_default.locationColumn,
									children: t("table.location")
								}),
								showTime && (0, react_jsx_runtime.jsx)("th", {
									className: inspector_module_css_default.timeColumn,
									children: t("table.time")
								}),
								(0, react_jsx_runtime.jsx)("th", { children: t("table.data") })
							] }) }), (0, react_jsx_runtime.jsxs)("tbody", { children: [items.map((item, position) => {
								const gap = item.start - (items[position - 1]?.end ?? 30);
								const entry = layout.items[item.index];
								const arrival = arrivals.get(entry.row.key);
								return (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [gap > 0 && (0, react_jsx_runtime.jsx)("tr", {
									"aria-hidden": "true",
									children: (0, react_jsx_runtime.jsx)("td", {
										colSpan: columns,
										style: {
											height: gap,
											padding: 0
										}
									})
								}), (0, react_jsx_runtime.jsx)(DataRow, {
									row: entry.row,
									selected: entry.row.key === selected,
									context: typeFilter.active && !filtered.matches.has(entry.row.key),
									branch: hierarchy.isBranch(entry.row.key),
									collapsed: inspectorRowCollapsed(entry.row, disclosures),
									stickyLevel: sticky.get(item.index),
									pulse: reveal?.key === entry.row.key ? reveal.pulse : 0,
									added: performance.now() - arrival < 700,
									useRecord,
									select,
									toggle,
									flash,
									showTime,
									t
								})] }, item.key);
							}), bottom > 0 && (0, react_jsx_runtime.jsx)("tr", {
								"aria-hidden": "true",
								"data-inspector-fold-space": layout.bottomPadding > 0 ? "" : void 0,
								children: (0, react_jsx_runtime.jsx)("td", {
									colSpan: columns,
									style: {
										height: bottom,
										padding: 0
									}
								})
							})] })]
						}), rows.length === 0 && (0, react_jsx_runtime.jsx)("p", {
							className: inspector_module_css_default.empty,
							children: t("table.empty")
						})]
					}),
					selected !== null && (0, react_jsx_runtime.jsx)(InspectorDetails, {
						failed: detail.failed,
						text: record === void 0 ? t("table.removed") : detail.failed ? `${t("table.rawError")}\n${detail.text}` : detail.text,
						close: () => {
							setSelected(null);
							setObjectHistory(null);
						},
						t,
						children: objects === void 0 ? record === void 0 || detail.failed ? void 0 : (0, react_jsx_runtime.jsx)(InspectorJsonTree, {
							text: detail.text,
							t
						}, selected) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("nav", {
							className: inspector_module_css_default.objectBreadcrumbs,
							"aria-label": t("object.navigation"),
							children: (0, react_jsx_runtime.jsx)("ol", { children: breadcrumbs.map((label, index) => (0, react_jsx_runtime.jsxs)("li", { children: [index > 0 && (0, react_jsx_runtime.jsx)("span", {
								"aria-hidden": "true",
								children: "›"
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								title: label,
								disabled: index === breadcrumbs.length - 1,
								"aria-current": index === breadcrumbs.length - 1 ? "page" : void 0,
								onClick: () => {
									backToObject(index);
								},
								children: label
							})] }, index)) })
						}), (0, react_jsx_runtime.jsx)(InspectorObjectTree, {
							value: detailValue,
							objects,
							navigate,
							t
						}, objectTarget?.id ?? selected)] })
					})
				]
			});
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/chat-node/highlight.js
		/** Clipping geometry for the Inspector's element-picker overlay outside the Chat subtree. */
		/**
		* Intersect a Chat box with its scrollports and the transcript area above the composer.
		* @param element - Existing Chat Node, call, or Group box.
		* @returns The visible rectangle, or undefined when the target is outside the conversation viewport.
		*/
		function visibleChatRect(element) {
			const rect = element.getBoundingClientRect();
			let left = Math.max(0, rect.left), right = Math.min(window.innerWidth, rect.right);
			let top = Math.max(0, rect.top), bottom = Math.min(window.innerHeight, rect.bottom);
			for (let parent = element.parentElement; parent !== null; parent = parent.parentElement) {
				if (!parent.matches("[data-conversation-scroll], [data-step-process-body]")) continue;
				const bounds = parent.getBoundingClientRect();
				left = Math.max(left, bounds.left);
				right = Math.min(right, bounds.right);
				top = Math.max(top, bounds.top);
				bottom = Math.min(bottom, bounds.bottom);
				if (parent.hasAttribute("data-conversation-scroll")) {
					const composer = parent.querySelector(":scope > [data-composer-seat]")?.getBoundingClientRect();
					if (composer !== void 0 && composer.height > 0) bottom = Math.min(bottom, composer.top);
				}
			}
			return bottom <= top || right <= left ? void 0 : {
				left,
				top,
				width: right - left,
				height: bottom - top
			};
		}
		/**
		* Place an Inspector overlay without changing the Chat content box.
		* @param overlay - Inspector-owned fixed-position element.
		* @param element - Existing Chat Node, call, or Group box.
		* @returns Whether any part of the target remains visible after clipping.
		*/
		function placeChatHighlight(overlay, element) {
			const rect = visibleChatRect(element);
			if (rect === void 0) return false;
			Object.assign(overlay.style, {
				left: `${rect.left}px`,
				top: `${rect.top}px`,
				width: `${rect.width}px`,
				height: `${rect.height}px`
			});
			return true;
		}
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/chat-node/reveal.js
		/** Inspector-owned DOM reveal and native scrolling, without a Conversation request channel. */
		const SCROLL_QUIET_MS = 150;
		const SCROLL_KEYS = new Set([
			"ArrowUp",
			"ArrowDown",
			"PageUp",
			"PageDown",
			"Home",
			"End",
			" ",
			"Escape"
		]);
		function hasRenderedBox(element) {
			if (!displayed(element)) return false;
			const box = element.getBoundingClientRect();
			return box.width > 0 && box.height > 0;
		}
		/** Owns one deferred reveal and body-level flash, without modifying Chat content nodes. */
		var InspectorChatRevealer = class {
			getRoot;
			frame;
			overlay;
			animation;
			cancelScroll;
			/** @param getRoot - Current Session's main Chat, or undefined when it is not displayed. */
			constructor(getRoot) {
				this.getRoot = getRoot;
			}
			/**
			* Reveal the first usable occurrence, falling back to the displayed Chat column.
			* Hidden or empty candidates do not prevent nearby content from being highlighted.
			* The highlight waits for scrolling to settle; reduced-motion mode scrolls immediately without a flash.
			* @param targets - Exact and approximate Node, Group, or Turn identities in preference order.
			*/
			reveal(targets) {
				this.dispose();
				this.frame = requestAnimationFrame(() => {
					this.frame = void 0;
					const root = this.getRoot();
					if (root === void 0) return;
					for (const initial of findChatTargets(root, targets)) {
						if (!root.contains(initial)) continue;
						const hidden = [];
						for (let element = initial; element !== null && element !== root; element = element.parentElement) if (element.getAttribute("hidden") === "until-found") hidden.push(element);
						if (hidden.length > 0 || visibleChatRect(initial) === void 0) root.closest("[data-conversation-scroll]")?.dispatchEvent(new Event("beforematch"));
						for (const element of hidden.reverse()) (0, react_dom.flushSync)(() => {
							element.dispatchEvent(new Event("beforematch"));
						});
						if (this.getRoot() !== root) return;
						const row = root.contains(initial) ? initial : findChatTargets(root, targets).find(hasRenderedBox);
						if (row === void 0 || !hasRenderedBox(row)) continue;
						if (visibleChatRect(row) === void 0) {
							if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
								this.smoothScroll(row, root, targets);
								return;
							}
							row.scrollIntoView({
								behavior: "instant",
								block: "center",
								inline: "nearest"
							});
						}
						this.queueFlash(row, root, targets);
						return;
					}
					if (displayed(root) && visibleChatRect(root) !== void 0) this.queueFlash(root, root, targets);
				});
			}
			/** Cancel pending native scrolling and remove the Inspector-owned overlay. */
			dispose() {
				if (this.frame !== void 0) cancelAnimationFrame(this.frame);
				this.frame = void 0;
				this.cancelScroll?.();
				if (this.animation !== void 0) {
					this.animation.onfinish = null;
					this.animation.cancel();
				}
				this.animation = void 0;
				this.overlay?.remove();
				this.overlay = void 0;
			}
			queueFlash(row, root, targets) {
				this.frame = requestAnimationFrame(() => {
					this.frame = void 0;
					if (this.getRoot() !== root) {
						this.dispose();
						return;
					}
					if (this.flash(row)) return;
					for (const candidate of findChatTargets(root, targets)) if (candidate !== row && this.flash(candidate)) return;
					if (row !== root && this.flash(root)) return;
					this.dispose();
				});
			}
			smoothScroll(row, root, targets) {
				const parents = /* @__PURE__ */ new Set();
				for (let element = row.parentElement; element !== null; element = element.parentElement) parents.add(element);
				const moving = /* @__PURE__ */ new Set();
				let pending = true;
				let quiet;
				let settledFrame;
				const targetOf = (event) => {
					const target = event.target === document ? document.scrollingElement : event.target;
					return target instanceof Element && parents.has(target) ? target : void 0;
				};
				const cleanup = () => {
					pending = false;
					window.clearTimeout(quiet);
					if (settledFrame !== void 0) cancelAnimationFrame(settledFrame);
					window.removeEventListener("scroll", onScroll, true);
					window.removeEventListener("scrollend", onEnd, true);
					for (const type of [
						"wheel",
						"touchstart",
						"pointerdown",
						"keydown"
					]) window.removeEventListener(type, interrupt, true);
					this.cancelScroll = void 0;
				};
				const finish = () => {
					if (!pending) return;
					cleanup();
					this.queueFlash(row, root, targets);
				};
				const awaitQuiet = () => {
					window.clearTimeout(quiet);
					quiet = window.setTimeout(finish, SCROLL_QUIET_MS);
				};
				const onScroll = (event) => {
					const target = targetOf(event);
					if (target === void 0) return;
					moving.add(target);
					awaitQuiet();
				};
				const onEnd = (event) => {
					const target = targetOf(event);
					if (target === void 0 || !moving.delete(target) || moving.size > 0 || settledFrame !== void 0) return;
					settledFrame = requestAnimationFrame(() => {
						settledFrame = void 0;
						if (moving.size === 0) finish();
					});
				};
				const cancel = () => {
					if (!pending) return;
					cleanup();
					for (const element of parents) if (element.isConnected && (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)) element.scrollTo({
						top: element.scrollTop,
						left: element.scrollLeft,
						behavior: "instant"
					});
				};
				const interrupt = (event) => {
					if (event instanceof KeyboardEvent && !SCROLL_KEYS.has(event.key)) return;
					cancel();
					this.dispose();
				};
				this.cancelScroll = cancel;
				window.addEventListener("scroll", onScroll, {
					capture: true,
					passive: true
				});
				window.addEventListener("scrollend", onEnd, {
					capture: true,
					passive: true
				});
				for (const type of [
					"wheel",
					"touchstart",
					"pointerdown",
					"keydown"
				]) window.addEventListener(type, interrupt, {
					capture: true,
					passive: true
				});
				awaitQuiet();
				row.scrollIntoView({
					behavior: "smooth",
					block: "center",
					inline: "nearest"
				});
			}
			flash(row) {
				if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
					this.dispose();
					return true;
				}
				if (!displayed(row)) return false;
				const overlay = document.createElement("div");
				if (!placeChatHighlight(overlay, row)) return false;
				overlay.className = inspector_module_css_default.chatReveal;
				overlay.dataset.sessionInspectorHighlight = "reveal";
				overlay.setAttribute("aria-hidden", "true");
				document.body.append(overlay);
				this.overlay = overlay;
				const animation = overlay.animate([
					{ opacity: .65 },
					{ opacity: .1 },
					{ opacity: .5 },
					{ opacity: 0 }
				], { duration: 700 });
				this.animation = animation;
				animation.onfinish = () => {
					if (this.animation === animation) this.dispose();
				};
				return true;
			}
		};
		//#endregion
} // __DSH_FRAGMENT_END__
function __gbh_fragment__() { // __DSH_FRAGMENT_BEGIN__
		//#region lib/types/client/views/View.js
		/** One Sidebar Inspector with locally selected Chat and Session-log presentations. */
		/** @param props - Session-bound sources. @returns One Inspector with an in-toolbar presentation selector. */
		function SessionInspectorView(props) {
			const [mode, setMode] = (0, react.useState)("session-log");
			const [picking, setPicking] = (0, react.useState)(false);
			const [pickFailed, setPickFailed] = (0, react.useState)(false);
			const [pickedRow, setPickedRow] = (0, react.useState)();
			const pickButton = (0, react.useRef)(null);
			const chat = mode === "chat-node";
			const revealer = (0, react.useMemo)(() => new InspectorChatRevealer(props.chatRoot), [props.chatRoot]);
			(0, react.useEffect)(() => () => {
				revealer.dispose();
			}, [revealer, mode]);
			const typeOf = (0, react.useCallback)((key) => props.recordType(key, mode), [props.recordType, mode]);
			const revealChat = (0, react.useCallback)((target) => {
				revealer.reveal(props.resolveChatTargets(target));
			}, [revealer, props.resolveChatTargets]);
			const navigation = (0, react.useMemo)(() => ({
				reveal: revealChat,
				target: chat ? (key) => props.objects.row(key)?.target : props.logChatTarget
			}), [
				chat,
				props.objects,
				props.logChatTarget,
				revealChat
			]);
			(0, react.useEffect)(() => {
				if (!picking || pickButton.current === null) return;
				revealer.dispose();
				const stopPicking = props.pickChat(pickButton.current, (target) => {
					const key = props.pickRow(target, mode);
					if (key === void 0) {
						setPickFailed(true);
						return false;
					}
					setPickedRow({ key });
					setPicking(false);
					setPickFailed(false);
					return true;
				}, () => {
					setPicking(false);
					setPickFailed(false);
				});
				if (stopPicking === void 0) {
					setPicking(false);
					setPickFailed(true);
				}
				return stopPicking;
			}, [
				picking,
				mode,
				props.pickChat,
				props.pickRow,
				revealer
			]);
			const selector = (0, react_jsx_runtime.jsxs)("span", {
				className: inspector_module_css_default.modeControls,
				children: [(0, react_jsx_runtime.jsxs)("select", {
					className: inspector_module_css_default.modeSelector,
					"aria-label": props.t("view.presentation"),
					value: mode,
					onChange: (event) => {
						setPicking(false);
						setPickFailed(false);
						setPickedRow(void 0);
						setMode(event.currentTarget.value === "chat-node" ? "chat-node" : "session-log");
					},
					children: [(0, react_jsx_runtime.jsx)("option", {
						value: "session-log",
						children: props.t("view.sessionLog")
					}), (0, react_jsx_runtime.jsx)("option", {
						value: "chat-node",
						children: props.t("view.chatNode")
					})]
				}), (0, react_jsx_runtime.jsx)("button", {
					ref: pickButton,
					type: "button",
					className: inspector_module_css_default.pickButton,
					"aria-pressed": picking,
					"aria-label": props.t("picker.pick"),
					title: props.t(picking ? "picker.cancel" : "picker.pick"),
					onClick: () => {
						setPickFailed(false);
						setPicking((value) => !value);
					},
					children: (0, react_jsx_runtime.jsxs)("svg", {
						width: "16",
						height: "16",
						viewBox: "0 0 16 16",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.3",
						"aria-hidden": "true",
						children: [(0, react_jsx_runtime.jsx)("circle", {
							cx: "8",
							cy: "8",
							r: "4.5"
						}), (0, react_jsx_runtime.jsx)("path", { d: "M8 0v5M8 11v5M0 8h5M11 8h5" })]
					})
				})]
			});
			return (0, react_jsx_runtime.jsx)(InspectorTable, {
				title: props.t(chat ? "view.chatNode" : "view.sessionLog"),
				modeSelector: selector,
				pickedRow,
				notice: picking ? props.t(pickFailed ? "picker.noMatch" : "picker.instructions") : pickFailed ? props.t("picker.noChat") : void 0,
				useRows: chat ? props.useChatRows : props.useLogRows,
				useRecord: chat ? props.useChatRecord : props.useLogRecord,
				useSession: props.useSession,
				loadOlder: props.loadOlder,
				typeOf,
				t: props.t,
				flash: chat,
				showTime: !chat,
				navigation,
				...chat ? { objects: props.objects } : {}
			}, mode);
		}
		//#endregion
} // __DSH_FRAGMENT_END__

export {};
