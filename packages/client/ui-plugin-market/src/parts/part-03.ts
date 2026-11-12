/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						id: key.id,
						direction: key.declaration.order
					}
				});
			};
			const toggleMenu = (name) => {
				setMenu(menu === name ? null : name);
			};
			const busy = listing.status === "loading" && value !== null;
			return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				(0, react_jsx_runtime.jsxs)("div", {
					className: DiscoverSection_module_css_default.toolbar,
					children: [
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menu === "market",
							onClose: () => {
								setMenu(null);
							},
							portal: true,
							autoFocus: true,
							selectedId: listing.url,
							items: state.indexes.map((index) => ({
								id: index.url,
								label: indexLabel(index, face.resolveText)
							})),
							footer: [{
								id: "manage",
								label: t("manageSources"),
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSlidersTwoOutlineRegular, { size: 14 })
							}],
							onSelect: (id) => {
								setMenu(null);
								if (id === "manage") face.toggleSources();
								else face.select(id);
							},
							anchor: (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								className: DiscoverSection_module_css_default.marketButton,
								"aria-haspopup": "menu",
								"aria-expanded": menu === "market",
								"aria-label": t("marketMenu", { market }),
								onClick: () => {
									toggleMenu("market");
								},
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: DiscoverSection_module_css_default.marketName,
									children: market
								}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
									size: 12,
									"aria-hidden": "true"
								})]
							})
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Input, {
							className: DiscoverSection_module_css_default.search,
							type: "search",
							icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSearchOutlineRegular, { size: 14 }),
							value: text,
							placeholder: t("search"),
							"aria-label": t("search"),
							onChange: (event) => {
								setText(event.target.value);
							}
						}),
						declarations.labels.length === 0 ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menu === "filter",
							onClose: () => {
								setMenu(null);
							},
							portal: true,
							autoFocus: true,
							align: "end",
							selectedIds: query.labels,
							items: declarations.labels.map((item) => ({
								id: item.id,
								label: item.title
							})),
							onSelect: (id) => {
								const labels = query.labels.includes(id) ? query.labels.filter((label) => label !== id) : [...query.labels, id];
								face.search({
									...query,
									labels
								});
							},
							anchor: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								"aria-haspopup": "menu",
								"aria-expanded": menu === "filter",
								icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconSlidersTwoOutlineRegular, { size: 13 }),
								onClick: () => {
									toggleMenu("filter");
								},
								children: query.labels.length === 0 ? t("filter") : t("filterCount", { count: String(query.labels.length) })
							})
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Menu, {
							open: menu === "sort",
							onClose: () => {
								setMenu(null);
							},
							portal: true,
							autoFocus: true,
							align: "end",
							selectedId: sortMenuId(sort),
							items: sortOptions,
							...directed ? { footer: [{
								id: "direction",
								label: t(sort.direction === "asc" ? "switchToDescending" : "switchToAscending")
							}] } : {},
							onSelect: chooseSort,
							anchor: (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								"aria-haspopup": "menu",
								"aria-expanded": menu === "sort",
								onClick: () => {
									toggleMenu("sort");
								},
								children: [t("sortBy", { sort: sortName }), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
									size: 12,
									"aria-hidden": "true"
								})]
							})
						}),
						(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("refresh"),
							side: "bottom",
							portal: true,
							delayMs: 500,
							focusDelayMs: 500,
							children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								"aria-label": t("refresh"),
								disabled: listing.status === "loading",
								onClick: face.refresh,
								icon: busy ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 14 })
							})
						})
					]
				}),
				declarations.categories.length === 0 ? null : (0, react_jsx_runtime.jsxs)("div", {
					className: DiscoverSection_module_css_default.categories,
					role: "group",
					"aria-label": t("categoriesLabel"),
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
						active: query.category === null,
						"aria-pressed": query.category === null,
						onClick: () => {
							face.search({
								...query,
								category: null
							});
						},
						children: t("allCategories")
					}), declarations.categories.map((item) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Pill, {
						active: query.category === item.id,
						"aria-pressed": query.category === item.id,
						onClick: () => {
							face.search({
								...query,
								category: item.id
							});
						},
						children: item.title
					}, item.id))]
				}),
				listing.failure === null ? null : (0, react_jsx_runtime.jsxs)("div", {
					className: DiscoverSection_module_css_default.failure,
					children: [(0, react_jsx_runtime.jsxs)("p", {
						className: DiscoverSection_module_css_default.error,
						role: "alert",
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" }), t(FAILURE_KEYS[listing.failure])]
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						size: "sm",
						onClick: face.retry,
						children: t("retry")
					})]
				}),
				value === null ? listing.status === "loading" ? (0, react_jsx_runtime.jsx)(ListSkeleton, { label: t("loading") }) : null : value.total === 0 ? (0, react_jsx_runtime.jsx)("p", {
					className: DiscoverSection_module_css_default.muted,
					children: t(unfiltered(listing.answered) ? "emptyIndex" : "noMatches")
				}) : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("ul", {
					className: DiscoverSection_module_css_default.cards,
					"aria-busy": busy,
					children: value.entries.map((entry) => (0, react_jsx_runtime.jsx)(EntryCard, {
						entry,
						t,
						face,
						language,
						labels: declarations.labels,
						onOpen: () => {
							setOpened(entry);
						},
						onInstall: (version) => {
							onInstall({
								entry,
								version
							});
						},
						onOpenInstalled: () => {
							openPackage(entry.name);
						}
					}, entry.name))
				}), value.nextOffset === null ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					className: DiscoverSection_module_css_default.more,
					disabled: listing.status !== "ready",
					onClick: face.more,
					children: t("showMore")
				})] })
			] });
		}
		/** Render the Discover tab of the Plugins page. */
		function DiscoverSection(props) {
			const { t, install, openPackage } = props;
			const face = props;
			const state = props.useDiscover((snapshot) => snapshot);
			const language = props.useLocale((snapshot) => snapshot.active);
			const [confirming, setConfirming] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				props.ensure();
			}, [props.ensure]);
			let body;
			if (state.status === "idle" || state.status === "loading") body = (0, react_jsx_runtime.jsx)(ListSkeleton, { label: t("loading") });
			else if (state.status === "error") body = (0, react_jsx_runtime.jsxs)("div", {
				className: DiscoverSection_module_css_default.failure,
				children: [(0, react_jsx_runtime.jsxs)("p", {
					className: DiscoverSection_module_css_default.error,
					role: "alert",
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "error" }), t("sourcesFailed")]
				}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "outline",
					size: "sm",
					onClick: props.reload,
					children: t("retry")
				})]
			});
			else if (state.listing === null) body = (0, react_jsx_runtime.jsxs)("div", {
				className: DiscoverSection_module_css_default.empty,
				children: [
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.PluginArtworkDefault, { size: 48 }),
					(0, react_jsx_runtime.jsx)("p", {
						className: DiscoverSection_module_css_default.emptyTitle,
						children: t("emptyTitle")
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: DiscoverSection_module_css_default.muted,
						children: t("emptyDescription")
					}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						size: "sm",
						icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 13 }),
						onClick: props.toggleSources,
						children: t("addFirstSource")
					})
				]
			});
			else body = (0, react_jsx_runtime.jsx)(Browser, {
				state,
				listing: state.listing,
				t,
				face,
				language,
				onInstall: (choice) => {
					setConfirming(choice);
				},
				openPackage
			}, state.listing.url);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: DiscoverSection_module_css_default.section,
				"data-plugin-tab": "discover",
				children: [
					body,
					(0, react_jsx_runtime.jsx)(SourcesDialog, {
						state,
						t,
						face
					}),
					(0, react_jsx_runtime.jsx)(ConfirmDialog, {
						choice: confirming,
						t,
						face,
						onCancel: () => {
							setConfirming(null);
						},
						onConfirm: ({ entry, version }) => {
							setConfirming(null);
							install({
								...version.install,
								title: entryTitle(entry, face),
								version: version.version
							});
						}
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/locales.js
		/** Discover tab copy. */
		/** Simplified Chinese dictionary and key source of truth. */
		const zh = {
			title: "发现",
			refresh: "刷新",
			loading: "正在读取索引",
			retry: "重试",
			close: "关闭",
			cancel: "取消",
			emptyTitle: "还没有插件市场",
			emptyDescription: "添加一个插件市场索引，即可在这里浏览和安装其中的插件",
			addFirstSource: "添加索引源",
			sourcesFailed: "无法读取索引源",
			manageSources: "管理索引源…",
			marketMenu: "切换插件市场，当前为 {market}",
			sourcesTitle: "索引源",
			sourcesDescription: "插件市场以一个索引文件的 URL 提供，「发现」从这里列出的索引浏览插件",
			sourcesLabel: "已添加的索引源",
			sourceUrl: "索引 URL",
			sourcePlaceholder: "https://example.com/index.json",
			addSource: "添加",
			removeSource: "移除",
			removeSourceNamed: "移除 {url}",
			sourcesTrust: "索引由第三方提供。只添加你信任的来源：其中的插件安装后以你的权限运行",
			sourceInvalid: "请使用 http 或 https 地址，且不要包含用户名、密码或 # 片段",
			sourceDuplicate: "已添加过这个索引源",
			sourceUnavailable: "当前环境无法保存索引源",
			sourceFailed: "无法保存索引源",
			readFailed: "无法读取此索引",
			readInvalid: "此索引的格式无效",
			readChanged: "此索引在加载过程中发生了变化",
			search: "搜索插件",
			filter: "标签",
			filterCount: "标签 · {count}",
			sortBy: "排序：{sort}",
			sortRelevance: "最佳匹配",
			sortDefault: "默认顺序",
			sortPublished: "发布时间",
			switchToAscending: "改为升序",
			switchToDescending: "改为降序",
			categoriesLabel: "分类",
			allCategories: "全部",
			emptyIndex: "此索引没有插件",
			noMatches: "没有符合条件的插件",
			showMore: "显示更多",
			entryMeta: "{version} · {date}",
			entryMetaAuthor: "{version} · {author} · {date}",
			openEntry: "查看 {name}",
			install: "安装",
			installTitle: "安装 {name}",
			installVersionTitle: "安装 {name} {version}",
			openInstalled: "在已安装中查看 {name}",
			statusInstalled: "已安装",
			statusUpdate: "有新版本",
			statusProvided: "随 DSH 提供",
			incompatible: "此版本与当前的 DSH {runtime} 不兼容，它要求 DSH {range}",
			noCompatibleVersion: "没有与当前 DSH {runtime} 兼容的版本",
			exempted: "此版本与当前 DSH 不兼容，但你已为它设置了兼容性豁免",
			backToList: "发现",
			factSource: "来源",
			factPackage: "软件包",
			factRegistry: "注册表",
			factRepository: "仓库",
			factCommit: "提交",
			factDirectory: "目录",
			factPublished: "发布时间",
			factAuthor: "作者",
			factHomepage: "主页",
			factSourceCode: "源代码",
			factCategory: "分类",
			factLabels: "标签",
			factMarket: "插件市场",
			versionsTitle: "版本",
			versionsLabel: "{name} 的版本",
			versionDefault: "推荐",
			versionInstalled: "当前已安装",
			versionIncompatible: "不兼容",
			versionExempted: "已豁免",
			versionPrerelease: "预发布",
			confirmTitle: "安装「{name}」？",
			installTrust: "插件在本机以你的权限运行。请确认你信任它的来源"
		};
		/** English dictionary. */
		const en = {
			title: "Discover",
			refresh: "Refresh",
			loading: "Reading the index",
			retry: "Retry",
			close: "Close",
			cancel: "Cancel",
			emptyTitle: "No plugin markets yet",
			emptyDescription: "Add a plugin market index to browse and install its plugins here.",
			addFirstSource: "Add index source",
			sourcesFailed: "Could not read the index sources.",
			manageSources: "Manage index sources…",
export {};
