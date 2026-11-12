/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
								className: PluginManagerPage_module_css_default.rowLine,
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: PluginManagerPage_module_css_default.rowIcon,
										"aria-hidden": "true",
										children: (0, react_jsx_runtime.jsx)(PackageArtwork, {
											src: row.meta?.icon,
											row: true
										}, row.meta?.icon)
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: PluginManagerPage_module_css_default.rowMain,
										children: [
											configure?.has(row) === true ? (0, react_jsx_runtime.jsxs)("button", {
												type: "button",
												className: PluginManagerPage_module_css_default.rowOpen,
												"aria-label": t("configureRow", { name: title }),
												onClick: () => {
													configure.open(row);
												},
												children: [(0, react_jsx_runtime.jsx)("span", {
													className: PluginManagerPage_module_css_default.rowId,
													children: title
												}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {
													className: PluginManagerPage_module_css_default.rowOpenIcon,
													"aria-hidden": "true"
												})]
											}) : (0, react_jsx_runtime.jsx)("span", {
												className: PluginManagerPage_module_css_default.rowId,
												children: title
											}),
											description === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
												className: PluginManagerPage_module_css_default.rowModule,
												children: description
											}),
											title === row.rowId ? null : (0, react_jsx_runtime.jsx)("code", {
												className: PluginManagerPage_module_css_default.rowModule,
												children: row.rowId
											}),
											title === row.moduleName ? null : (0, react_jsx_runtime.jsx)("code", {
												className: PluginManagerPage_module_css_default.rowModule,
												children: row.moduleName
											})
										]
									}),
									(0, react_jsx_runtime.jsxs)("span", {
										className: PluginManagerPage_module_css_default.rowState,
										children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: rowDotState(row) }), rowStateText(row, t)]
									}),
									toggle === void 0 ? null : (0, react_jsx_runtime.jsx)(RowSwitch, {
										row,
										title,
										t,
										busy: toggle.busy(row),
										onChange: (enabled) => {
											toggle.onSetEnabled(row, enabled);
										}
									})
								]
							}), (0, react_jsx_runtime.jsx)(MetadataError, {
								error: row.meta?.error,
								t
							})]
						}, row.rowId))
					})
				]
			});
		}
		/** Declared install source and versions; unavailable files retain their recorded dependency spec. */
		function SourceSection({ pkg, t }) {
			if (pkg.source === void 0 && !pkg.installed && pkg.availability === "installation" && !pkg.optional) return null;
			return (0, react_jsx_runtime.jsxs)("section", {
				className: PluginManagerPage_module_css_default.detailSection,
				"data-plugin-source": true,
				children: [(0, react_jsx_runtime.jsx)("h4", {
					className: PluginManagerPage_module_css_default.sectionTitle,
					children: t("sourceTitle")
				}), (0, react_jsx_runtime.jsxs)("dl", {
					className: PluginManagerPage_module_css_default.facts,
					children: [
						(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("sourceSpec") }), (0, react_jsx_runtime.jsx)("dd", { children: pkg.source !== void 0 ? (0, react_jsx_runtime.jsx)("code", { children: pkg.source }) : pkg.availability === "missing" ? t(pkg.installed ? "statusMissingFiles" : "sourceNotInstalled") : t("sourceBuiltIn") })] }),
						pkg.version === void 0 ? null : (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("sourceVersion") }), (0, react_jsx_runtime.jsx)("dd", { children: pkg.version })] }),
						pkg.installTarget === void 0 ? null : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("sourceTargetSpec") }), (0, react_jsx_runtime.jsx)("dd", { children: (0, react_jsx_runtime.jsx)("code", { children: pkg.installTarget.spec }) })] }), (0, react_jsx_runtime.jsxs)("div", { children: [(0, react_jsx_runtime.jsx)("dt", { children: t("sourceTargetVersion") }), (0, react_jsx_runtime.jsx)("dd", { children: pkg.installTarget.version })] })] })
					]
				})]
			});
		}
		/**
		* A bundle's enable switch on its card and its page: locked, saying why, for
		* one the Host protects; off and locked for one it cannot read.
		*/
		function EnableSwitch({ pkg, title, t, busy, onSetEnabled }) {
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
				checked: pkg.enabled,
				label: t("enableToggle", { name: title }),
				disabled: busy || pkg.readOnlyReason !== void 0 || !pkg.enabled && pkg.error !== void 0 && !(pkg.availability === "missing" && pkg.installTarget !== void 0),
				...pkg.readOnlyReason === void 0 ? {} : { title: managementText({ code: pkg.readOnlyReason }, t) },
				onChange: onSetEnabled
			});
		}
		/** The status one card carries: running, off, or a problem the Host reported. */
		function packageStatus(pkg) {
			if (pkg.error !== void 0) return "problem";
			return pkg.enabled ? "running" : "disabled";
		}
		/** The head every card shares: the artwork, the name that opens the page beside its tags, its one-liner, and what sits at the end. */
		function CardHead({ title, t, onOpen, icon, tags, description, end }) {
			const descriptionId = (0, react.useId)();
			return (0, react_jsx_runtime.jsxs)("div", {
				className: PluginManagerPage_module_css_default.cardHead,
				children: [
					(0, react_jsx_runtime.jsx)("span", {
						className: PluginManagerPage_module_css_default.cardIcon,
						"aria-hidden": "true",
						children: icon
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.cardMain,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: PluginManagerPage_module_css_default.titleRow,
							children: [(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: `${PluginManagerPage_module_css_default.cardTitle} ${PluginManagerPage_module_css_default.cardOpen}`,
								"aria-label": t("openDetail", { name: title }),
								"aria-describedby": description === void 0 ? void 0 : descriptionId,
								onClick: onOpen,
								children: title
							}), tags]
						}), description === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
							className: PluginManagerPage_module_css_default.cardDesc,
							id: descriptionId,
							children: description
						})]
					}),
					end === void 0 ? null : (0, react_jsx_runtime.jsx)("div", {
						className: PluginManagerPage_module_css_default.cardEnd,
						children: end
					})
				]
			});
		}
		/** First-read placeholders share the core configuration group's card and text-line layout. */
		function ListSkeleton({ label }) {
			return (0, react_jsx_runtime.jsxs)("section", {
				className: PluginManagerPage_module_css_default.group,
				role: "status",
				"aria-label": label,
				"data-plugin-loading": true,
				children: [(0, react_jsx_runtime.jsx)("div", {
					className: PluginManagerPage_module_css_default.groupHead,
					"aria-hidden": "true",
					children: (0, react_jsx_runtime.jsx)("span", {
						className: `${PluginManagerPage_module_css_default.groupTitle} ${PluginManagerPage_module_css_default.skeletonText} ${PluginManagerPage_module_css_default.skeletonHeading}`,
						children: (0, react_jsx_runtime.jsx)("span", { className: `${PluginManagerPage_module_css_default.skeletonFill} ${PluginManagerPage_module_css_default.skeletonBar}` })
					})
				}), (0, react_jsx_runtime.jsx)("ul", {
					className: PluginManagerPage_module_css_default.cards,
					"aria-hidden": "true",
					children: [
						0,
						1,
						2,
						3
					].map((index) => (0, react_jsx_runtime.jsx)("li", {
						className: PluginManagerPage_module_css_default.card,
						children: (0, react_jsx_runtime.jsxs)("div", {
							className: PluginManagerPage_module_css_default.cardHead,
							children: [
								(0, react_jsx_runtime.jsx)("span", { className: `${PluginManagerPage_module_css_default.cardIcon} ${PluginManagerPage_module_css_default.skeletonFill} ${PluginManagerPage_module_css_default.skeletonIcon}` }),
								(0, react_jsx_runtime.jsxs)("div", {
									className: PluginManagerPage_module_css_default.cardMain,
									children: [(0, react_jsx_runtime.jsx)("div", {
										className: PluginManagerPage_module_css_default.titleRow,
										children: (0, react_jsx_runtime.jsx)("span", {
											className: `${PluginManagerPage_module_css_default.cardTitle} ${PluginManagerPage_module_css_default.skeletonText} ${PluginManagerPage_module_css_default.skeletonTitle}`,
											children: (0, react_jsx_runtime.jsx)("span", { className: `${PluginManagerPage_module_css_default.skeletonFill} ${PluginManagerPage_module_css_default.skeletonBar}` })
										})
									}), (0, react_jsx_runtime.jsx)("span", {
										className: `${PluginManagerPage_module_css_default.cardDesc} ${PluginManagerPage_module_css_default.skeletonText} ${PluginManagerPage_module_css_default.skeletonDescription}`,
										children: (0, react_jsx_runtime.jsx)("span", { className: `${PluginManagerPage_module_css_default.skeletonFill} ${PluginManagerPage_module_css_default.skeletonBar}` })
									})]
								}),
								(0, react_jsx_runtime.jsx)("div", { className: `${PluginManagerPage_module_css_default.cardEnd} ${PluginManagerPage_module_css_default.skeletonActions}` })
							]
						})
					}, index))
				})]
			});
		}
		/** The top every page shares: the crumb that leads back, then the icon with the page's actions at its right. */
		function DetailTop({ crumbLabel, crumbText, onBack, icon, actions }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: PluginManagerPage_module_css_default.detailTop,
				"data-window-drag": true,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: PluginManagerPage_module_css_default.crumb,
					"aria-label": crumbLabel,
					onClick: onBack,
					children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
						className: PluginManagerPage_module_css_default.crumbIcon,
						"aria-hidden": "true"
					}), (0, react_jsx_runtime.jsx)("span", { children: crumbText })]
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: PluginManagerPage_module_css_default.detailHead,
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: PluginManagerPage_module_css_default.cardIcon,
						"aria-hidden": "true",
						children: icon
					}), actions]
				})]
			});
		}
		function updateAvailable(pkg) {
			const target = pkg.installTarget;
			if (!pkg.installed || !pkg.removable || pkg.availability === "installation" || target === void 0) return false;
			return pkg.version !== target.version || (target.spec.startsWith("link:") || pkg.source?.startsWith("link:") === true) && pkg.source !== target.spec;
		}
		/** One package as a card that opens its page: its name, its one-liner, its tags, and its bundle switch. */
		function PackageCard({ pkg, t, resolveText, busy, highlighted, onOpen, onSetEnabled }) {
			const { title, description, beta } = packageText(pkg, resolveText);
			const status = packageStatus(pkg);
			return (0, react_jsx_runtime.jsxs)("li", {
				className: `${PluginManagerPage_module_css_default.card} ${PluginManagerPage_module_css_default.cardLink}`,
				"data-plugin-package": pkg.name,
				"data-plugin-status": status,
				...highlighted ? { "data-plugin-highlight": "" } : {},
				children: [(0, react_jsx_runtime.jsx)(CardHead, {
					title,
					t,
					onOpen,
					icon: (0, react_jsx_runtime.jsx)(PackageArtwork, { src: pkg.meta?.icon }, pkg.meta?.icon),
					tags: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
						beta ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							className: PluginManagerPage_module_css_default.statusTag,
							tone: "info",
							children: t("statusBeta")
						}) : null,
						status === "problem" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							className: PluginManagerPage_module_css_default.statusTag,
							tone: "danger",
							children: t("statusProblem")
						}) : null,
						pkg.availability === "missing" ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							className: PluginManagerPage_module_css_default.statusTag,
							children: t(pkg.installed ? "statusMissingFiles" : "statusNotInstalled")
						}) : null,
						updateAvailable(pkg) ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
							className: PluginManagerPage_module_css_default.statusTag,
							tone: "info",
							children: t("statusUpdateAvailable")
						}) : null
					] }),
					description,
					end: (0, react_jsx_runtime.jsx)(EnableSwitch, {
						pkg,
						title,
						t,
						busy,
						onSetEnabled
					})
				}), (0, react_jsx_runtime.jsx)(MetadataError, {
					error: pkg.meta?.error,
					t
				})]
			});
		}
		/**
		* One official plugin as a card that opens its page: its icon, its title from
		* the registration, and the one-liner the entry renders in its summary view.
		*/
		function ItemCard({ item, t, onOpen, renderSlot }) {
			return (0, react_jsx_runtime.jsx)("li", {
				className: `${PluginManagerPage_module_css_default.card} ${PluginManagerPage_module_css_default.cardLink}`,
				"data-plugin-item": item.id,
				children: (0, react_jsx_runtime.jsx)(CardHead, {
					title: item.label,
					t,
					onOpen,
					icon: itemArtwork(item.id),
					description: renderSlot("plugins.item", { view: "summary" }, { only: item.id })
				})
			});
		}
		/** One row as the detail slots see it. */
		function rowRef(row) {
			return {
				rowId: row.rowId,
				moduleName: row.moduleName,
				enabled: row.enabled
			};
		}
		/** One bundle as the detail slots see it. */
		function packageRef(pkg) {
			return {
				name: pkg.name,
				...pkg.version === void 0 ? {} : { version: pkg.version },
				installed: pkg.installed,
				availability: pkg.availability,
				official: pkg.official,
				enabled: pkg.enabled,
				rows: pkg.rows.map(rowRef)
			};
		}
		/**
		* An official plugin's page: the crumb back to the cards, its icon with the
		* contributed actions, its title with the contributed badges over its
		* one-liner, the form the entry renders, and the contributed sections.
		*/
		function ItemDetail({ item, t, onBack, renderSlot, form }) {
			const subject = {
				kind: "item",
				id: item.id
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: PluginManagerPage_module_css_default.detail,
				"data-plugin-item-detail": item.id,
				children: [
					(0, react_jsx_runtime.jsx)(DetailTop, {
						crumbLabel: t("backToList"),
						crumbText: t("crumbRoot"),
						onBack,
						icon: itemArtwork(item.id),
						actions: (0, react_jsx_runtime.jsx)("div", {
							className: PluginManagerPage_module_css_default.detailActions,
							children: renderSlot("plugins.detail.actions", { subject })
						})
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.detailMain,
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: PluginManagerPage_module_css_default.titleRow,
							children: [(0, react_jsx_runtime.jsx)("h3", {
								className: PluginManagerPage_module_css_default.detailTitle,
								children: item.label
							}), renderSlot("plugins.detail.badge", { subject })]
						}), (0, react_jsx_runtime.jsx)("p", {
							className: PluginManagerPage_module_css_default.detailDesc,
							children: renderSlot("plugins.item", { view: "summary" }, { only: item.id })
						})]
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.detailSections,
						children: [(0, react_jsx_runtime.jsx)("section", {
							className: PluginManagerPage_module_css_default.detailSection,
							"data-plugin-config": true,
							children: renderSlot("plugins.item", {
								view: "page",
								form
							}, { only: item.id })
						}), renderSlot("plugins.detail.section", { subject })]
					})
				]
			});
		}
		/**
		* A row's configuration page keeps its technical identity beside local package
		* text and the form supplied by its configuration entry.
		*/
		function RowDetail({ pkg, row, t, resolveText, onBack, renderSlot, form }) {
			const { title } = packageText(pkg, resolveText);
			const { title: rowTitle, description } = rowText(row, resolveText);
			const key = rowConfigKey(pkg.name, row.rowId);
			const subject = {
				kind: "row",
				pkg: packageRef(pkg),
				row: rowRef(row)
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: PluginManagerPage_module_css_default.detail,
				"data-plugin-row-detail": key,
				children: [
					(0, react_jsx_runtime.jsx)(DetailTop, {
						crumbLabel: t("backToPackage", { name: title }),
						crumbText: title,
						onBack,
						icon: (0, react_jsx_runtime.jsx)(PackageArtwork, {
							src: row.meta?.icon,
							row: true,
							size: CARD_ARTWORK_SIZE
						}, row.meta?.icon),
						actions: (0, react_jsx_runtime.jsx)("div", {
							className: PluginManagerPage_module_css_default.detailActions,
							children: renderSlot("plugins.detail.actions", { subject })
						})
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.detailMain,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: PluginManagerPage_module_css_default.titleRow,
								children: [(0, react_jsx_runtime.jsx)("h3", {
									className: PluginManagerPage_module_css_default.detailTitle,
									children: rowTitle
								}), renderSlot("plugins.detail.badge", { subject })]
							}),
							rowTitle === row.rowId ? null : (0, react_jsx_runtime.jsx)("p", {
								className: PluginManagerPage_module_css_default.detailName,
								children: (0, react_jsx_runtime.jsx)("code", { children: row.rowId })
							}),
export {};
