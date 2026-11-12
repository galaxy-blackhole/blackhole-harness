/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
					(0, react_jsx_runtime.jsxs)("div", {
						className: DiscoverSection_module_css_default.detailHead,
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: DiscoverSection_module_css_default.icon,
								"aria-hidden": "true",
								children: (0, react_jsx_runtime.jsx)(MarketIcon, {
									src: entry.icon,
									size: ICON
								})
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: DiscoverSection_module_css_default.main,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: DiscoverSection_module_css_default.titleRow,
									children: [(0, react_jsx_runtime.jsx)("h3", {
										className: DiscoverSection_module_css_default.detailTitle,
										children: title
									}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
										tone: "neutral",
										children: version.version
									})]
								}), title === entry.name ? null : (0, react_jsx_runtime.jsx)("span", {
									className: DiscoverSection_module_css_default.meta,
									children: entry.name
								})]
							}),
							(0, react_jsx_runtime.jsx)(EntryAction, {
								entry,
								title,
								t,
								onInstall,
								onOpenInstalled
							})
						]
					}),
					entry.description === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
						className: DiscoverSection_module_css_default.detailDescription,
						children: face.resolveText(entry.description)
					}),
					compatibility.compatible ? null : (0, react_jsx_runtime.jsxs)("p", {
						className: DiscoverSection_module_css_default.notice,
						role: "note",
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {
							size: 14,
							"aria-hidden": "true"
						}), (0, react_jsx_runtime.jsx)("span", { children: compatibility.exempted ? t("exempted") : t("incompatible", {
							runtime: compatibility.runtimeVersion,
							range: Object.values(compatibility.requirements).join(" ")
						}) })]
					}),
					(0, react_jsx_runtime.jsxs)("section", {
						className: DiscoverSection_module_css_default.detailSection,
						children: [(0, react_jsx_runtime.jsx)("h4", {
							className: DiscoverSection_module_css_default.sectionTitle,
							children: t("factSource")
						}), (0, react_jsx_runtime.jsxs)("dl", {
							className: DiscoverSection_module_css_default.facts,
							children: [
								entry.author === void 0 ? null : (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("factAuthor") }), (0, react_jsx_runtime.jsx)("dd", { children: entry.author })] }),
								entry.homepage === void 0 ? null : (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("factHomepage") }), (0, react_jsx_runtime.jsx)("dd", { children: (0, react_jsx_runtime.jsx)("a", {
									className: DiscoverSection_module_css_default.link,
									href: entry.homepage,
									target: "_blank",
									rel: "noopener noreferrer",
									children: entry.homepage
								}) })] }),
								entry.repository === void 0 ? null : (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("factSourceCode") }), (0, react_jsx_runtime.jsxs)("dd", { children: [(0, react_jsx_runtime.jsx)("a", {
									className: DiscoverSection_module_css_default.link,
									href: entry.repository.url,
									target: "_blank",
									rel: "noopener noreferrer",
									children: entry.repository.url
								}), entry.repository.directory === void 0 ? null : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [" ", (0, react_jsx_runtime.jsx)("code", { children: entry.repository.directory })] })] })] }),
								sourceFacts(entry.name, version).map((fact) => (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t(FACT_KEYS[fact.kind]) }), (0, react_jsx_runtime.jsx)("dd", { children: (0, react_jsx_runtime.jsx)("code", { children: fact.value }) })] }, fact.kind)),
								(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("factPublished") }), (0, react_jsx_runtime.jsx)("dd", { children: date })] }),
								category === void 0 ? null : (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("factCategory") }), (0, react_jsx_runtime.jsx)("dd", { children: face.resolveText(category.title) })] }),
								labels.length === 0 ? null : (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("factLabels") }), (0, react_jsx_runtime.jsx)("dd", {
									className: DiscoverSection_module_css_default.tags,
									children: labels.map((label) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, { children: label.title }, label.id))
								})] }),
								(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("factMarket") }), (0, react_jsx_runtime.jsx)("dd", { children: face.resolveText(listing.title) })] })
							]
						})]
					}),
					(0, react_jsx_runtime.jsxs)("section", {
						className: DiscoverSection_module_css_default.detailSection,
						children: [(0, react_jsx_runtime.jsx)("h4", {
							className: DiscoverSection_module_css_default.sectionTitle,
							children: t("versionsTitle")
						}), (0, react_jsx_runtime.jsx)("ul", {
							className: DiscoverSection_module_css_default.versions,
							"aria-label": t("versionsLabel", { name: title }),
							children: entry.versions.map((item) => (0, react_jsx_runtime.jsx)(VersionRow, {
								entry,
								version: item,
								title,
								t,
								language,
								onInstall
							}, item.version))
						})]
					})
				]
			});
		}
		function SourcesDialog({ state, t, face }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: state.editing,
				onClose: face.toggleSources,
				title: t("sourcesTitle"),
				closeLabel: t("close"),
				description: t("sourcesDescription"),
				className: DiscoverSection_module_css_default.dialog,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: DiscoverSection_module_css_default.dialogBody,
					children: [
						state.indexes.length === 0 ? null : (0, react_jsx_runtime.jsx)("ul", {
							className: DiscoverSection_module_css_default.sourceList,
							"aria-label": t("sourcesLabel"),
							children: state.indexes.map((index) => (0, react_jsx_runtime.jsxs)("li", {
								className: DiscoverSection_module_css_default.sourceRow,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: DiscoverSection_module_css_default.main,
									children: [
										(0, react_jsx_runtime.jsx)("span", {
											className: DiscoverSection_module_css_default.strong,
											children: indexLabel(index, face.resolveText)
										}),
										(0, react_jsx_runtime.jsx)("span", {
											className: DiscoverSection_module_css_default.meta,
											children: index.url
										}),
										index.error === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
											className: DiscoverSection_module_css_default.sourceError,
											children: index.error
										})
									]
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
									label: t("removeSource"),
									side: "bottom",
									portal: true,
									delayMs: 300,
									children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										size: "sm",
										icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 13 }),
										"aria-label": t("removeSourceNamed", { url: index.url }),
										disabled: state.saving,
										onClick: () => {
											face.removeSource(index.url);
										}
									})
								})]
							}, index.url))
						}),
						(0, react_jsx_runtime.jsxs)("form", {
							className: DiscoverSection_module_css_default.sourceForm,
							onSubmit: (event) => {
								event.preventDefault();
								face.addSource();
							},
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
								className: DiscoverSection_module_css_default.grow,
								value: state.draft,
								placeholder: t("sourcePlaceholder"),
								"aria-label": t("sourceUrl"),
								"aria-invalid": state.sourceFailure !== null,
								"data-modal-autofocus": true,
								onChange: (event) => {
									face.editDraft(event.target.value);
								}
							}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								type: "submit",
								variant: "primary",
								size: "sm",
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 13 }),
								disabled: state.saving || state.draft.trim() === "",
								children: t("addSource")
							})]
						}),
						state.sourceFailure === null ? null : (0, react_jsx_runtime.jsx)("p", {
							className: DiscoverSection_module_css_default.error,
							role: "alert",
							children: sourceFailureText(state.sourceFailure, t)
						}),
						(0, react_jsx_runtime.jsxs)("p", {
							className: DiscoverSection_module_css_default.notice,
							role: "note",
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {
								size: 14,
								"aria-hidden": "true"
							}), (0, react_jsx_runtime.jsx)("span", { children: t("sourcesTrust") })]
						})
					]
				})
			});
		}
		function ConfirmDialog({ choice, t, face, onCancel, onConfirm }) {
			if (choice === null) return null;
			const { entry, version } = choice;
			const title = entryTitle(entry, face);
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: true,
				onClose: onCancel,
				title: t("confirmTitle", { name: title }),
				closeLabel: t("close"),
				className: DiscoverSection_module_css_default.dialog,
				footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					onClick: onCancel,
					children: t("cancel")
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					autoFocus: true,
					onClick: () => {
						onConfirm(choice);
					},
					children: t("install")
				})] }),
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: DiscoverSection_module_css_default.dialogBody,
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: DiscoverSection_module_css_default.confirmHead,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: DiscoverSection_module_css_default.icon,
								"aria-hidden": "true",
								children: (0, react_jsx_runtime.jsx)(MarketIcon, {
									src: entry.icon,
									size: ICON
								})
							}), (0, react_jsx_runtime.jsxs)("div", {
								className: DiscoverSection_module_css_default.main,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: DiscoverSection_module_css_default.strong,
									children: title
								}), (0, react_jsx_runtime.jsx)("span", {
									className: DiscoverSection_module_css_default.meta,
									children: version.version
								})]
							})]
						}),
						(0, react_jsx_runtime.jsxs)("dl", {
							className: DiscoverSection_module_css_default.facts,
							children: [entry.author === void 0 ? null : (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("factAuthor") }), (0, react_jsx_runtime.jsx)("dd", { children: entry.author })] }), sourceFacts(entry.name, version).map((fact) => (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t(FACT_KEYS[fact.kind]) }), (0, react_jsx_runtime.jsx)("dd", { children: (0, react_jsx_runtime.jsx)("code", { children: fact.value }) })] }, fact.kind))]
						}),
						version.compatibility.compatible ? null : (0, react_jsx_runtime.jsxs)("p", {
							className: DiscoverSection_module_css_default.notice,
							role: "note",
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {
								size: 14,
								"aria-hidden": "true"
							}), (0, react_jsx_runtime.jsx)("span", { children: t("exempted") })]
						}),
						(0, react_jsx_runtime.jsxs)("p", {
							className: DiscoverSection_module_css_default.notice,
							role: "note",
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {
								size: 14,
								"aria-hidden": "true"
							}), (0, react_jsx_runtime.jsx)("span", { children: t("installTrust") })]
						})
					]
				})
			});
		}
		function ListSkeleton({ label }) {
			return (0, react_jsx_runtime.jsx)("ul", {
				className: DiscoverSection_module_css_default.cards,
				role: "status",
				"aria-label": label,
				"aria-busy": "true",
				children: [
					0,
					1,
					2,
					3
				].map((index) => (0, react_jsx_runtime.jsxs)("li", {
					className: DiscoverSection_module_css_default.card,
					"aria-hidden": "true",
					children: [(0, react_jsx_runtime.jsx)("span", { className: `${DiscoverSection_module_css_default.icon} ${DiscoverSection_module_css_default.skeletonFill}` }), (0, react_jsx_runtime.jsxs)("div", {
						className: DiscoverSection_module_css_default.main,
						children: [(0, react_jsx_runtime.jsx)("span", { className: `${DiscoverSection_module_css_default.skeletonBar} ${DiscoverSection_module_css_default.skeletonTitle} ${DiscoverSection_module_css_default.skeletonFill}` }), (0, react_jsx_runtime.jsx)("span", { className: `${DiscoverSection_module_css_default.skeletonBar} ${DiscoverSection_module_css_default.skeletonDescription} ${DiscoverSection_module_css_default.skeletonFill}` })]
					})]
				}, index))
			});
		}
		/** The sort menu id of a sort. */
		function sortMenuId(sort) {
			return sort.kind === "key" ? `key:${sort.id}` : sort.kind;
		}
		/** Whether a query selects every plugin of the index. */
		function unfiltered(query) {
			return query.text.trim() === "" && query.category === null && query.labels.length === 0;
		}
		function Browser({ state, listing, t, face, language, onInstall, openPackage }) {
			const { query, value } = listing;
			const [text, setText] = (0, react.useState)(query.text);
			const [menu, setMenu] = (0, react.useState)(null);
			const [opened, setOpened] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				if (text === query.text) return void 0;
				const timer = setTimeout(() => {
					face.search(withText(query, text));
				}, TEXT_DELAY_MS);
				return () => {
					clearTimeout(timer);
				};
			}, [
				text,
				query,
				face
			]);
			const declarations = (0, react.useMemo)(() => ({
				categories: value === null ? [] : displayDeclarations(value.metadata.categories, face.resolveText, language),
				labels: value === null ? [] : displayDeclarations(value.metadata.labels, face.resolveText, language),
				sortKeys: value === null ? [] : displayDeclarations(value.metadata.sortKeys, face.resolveText, language)
			}), [
				value,
				face,
				language
			]);
			const openEntry = opened === null ? void 0 : value?.entries.find((entry) => entry.name === opened.name) ?? opened;
			if (openEntry !== void 0 && value !== null) return (0, react_jsx_runtime.jsx)(EntryDetail, {
				entry: openEntry,
				listing: value,
				t,
				face,
				language,
				onBack: () => {
					setOpened(null);
				},
				onInstall: (version) => {
					onInstall({
						entry: openEntry,
						version
					});
				},
				onOpenInstalled: () => {
					openPackage(openEntry.name);
				}
			});
			const market = indexLabel(state.indexes.find((index) => index.url === listing.url) ?? { url: listing.url }, face.resolveText);
			const { sort } = query;
			const sortOptions = [
				...query.text.trim() === "" ? [] : [{
					id: "relevance",
					label: t("sortRelevance")
				}],
				{
					id: "index",
					label: t("sortDefault")
				},
				{
					id: "published",
					label: t("sortPublished")
				},
				...declarations.sortKeys.map((item) => ({
					id: `key:${item.id}`,
					label: item.title
				}))
			];
			const sortName = sortOptions.find((option) => option.id === sortMenuId(sort)).label;
			const directed = sort.kind === "published" || sort.kind === "key";
			const chooseSort = (id) => {
				setMenu(null);
				if (id === "direction" && directed) {
					face.search({
						...query,
						sort: {
							...sort,
							direction: sort.direction === "asc" ? "desc" : "asc"
						}
					});
					return;
				}
				if (id === "index" || id === "relevance") {
					face.search({
						...query,
						sort: { kind: id }
					});
					return;
				}
				if (id === "published") {
					face.search({
						...query,
						sort: {
							kind: "published",
							direction: "desc"
						}
					});
					return;
				}
				const key = declarations.sortKeys.find((item) => `key:${item.id}` === id);
				/* v8 ignore next -- every other menu id names a declared sort key */
				if (key !== void 0) face.search({
					...query,
					sort: {
						kind: "key",
export {};
