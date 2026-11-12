/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				if (changed) announceSaved(target);
			};
			const closeDelete = () => {
				if (deleting) return;
				setDeleteTarget(void 0);
				setDeleteFailure(void 0);
			};
			const confirmDelete = () => {
				/* v8 ignore next -- the action only renders with a target and is disabled while a deletion is pending */
				if (deleteTarget === void 0 || deleting) return;
				setDeleting(true);
				setDeleteFailure(void 0);
				removeProviderProfile(operations, controller, deleteTarget).then((failure) => {
					if (failure !== void 0) {
						setDeleteFailure(failure);
						return;
					}
					setDeleteTarget(void 0);
				}).finally(() => {
					setDeleting(false);
				});
			};
			if (state.status === "idle") controller.load();
			if (state.status === "error") {
				/* v8 ignore next -- an error status always carries text; the fallback satisfies the nullable type */
				const errorText = state.error ?? "";
				return (0, react_jsx_runtime.jsxs)("div", {
					className: ModelsSection_module_css_default["section"],
					children: [(0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["error"],
						children: `${t("loadFailed")}: ${errorText}`
					}), (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: ModelsSection_module_css_default["secondaryButton"],
						onClick: () => {
							controller.load();
						},
						children: t("retry")
					})]
				});
			}
			if (!hasReadySnapshot && state.status !== "ready") return (0, react_jsx_runtime.jsxs)("div", {
				className: ModelsSection_module_css_default["section"],
				children: [(0, react_jsx_runtime.jsx)("h2", {
					className: ModelsSection_module_css_default["title"],
					children: t("title")
				}), (0, react_jsx_runtime.jsx)("p", {
					className: ModelsSection_module_css_default["intro"],
					children: t("intro")
				})]
			});
			const savedRow = savedTarget === void 0 ? void 0 : state.rows.find((row) => row.entry.provider === savedTarget.provider);
			const savedIdentity = savedRow === void 0 ? savedTarget : {
				provider: savedRow.entry.provider,
				displayName: savedRow.entry.displayName
			};
			const anyUsable = state.rows.some(providerUsable);
			const configured = state.rows.filter((row) => row.configured);
			const configurable = state.rows.filter((row) => state.namespaces.has(row.entry.settingsNs));
			const addable = state.rows.flatMap((row) => {
				const namespace = state.namespaces.get(row.entry.settingsNs);
				return namespace === void 0 || row.configured ? [] : [{
					row,
					namespace
				}];
			});
			const piAi = state.namespaces.get("llm-pi-ai");
			const protocols = protocolChoices(piAi, schema);
			const reasoningLevels = reasoningLevelChoices(piAi, schema);
			const catalogOffered = configurable.length > 0;
			const catalogEnabled = addable.length > 0;
			const customOffered = piAi !== void 0;
			const customEnabled = protocols.length > 0;
			const bothOffered = catalogOffered && customOffered;
			const mode = bothOffered ? addMode : customOffered ? "custom" : "catalog";
			const mounted = (candidate) => mode === candidate || visited.has(candidate);
			const switchLocked = catalogBusy || customBusy;
			const draft = (() => {
				if (!addOpen || !catalogOffered) return void 0;
				const kept = editing === void 0 ? void 0 : state.namespaces.get(editing.settingsNs);
				if (editing !== void 0 && kept !== void 0) return {
					target: editing,
					namespace: kept
				};
				const first = addable[0];
				return first === void 0 ? void 0 : {
					target: targetOf(first.row),
					namespace: first.namespace
				};
			})();
			const addRow = draft === void 0 ? void 0 : state.rows.find((row) => row.entry.provider === draft.target.provider);
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ModelsSection_module_css_default["section"],
				children: [
					(0, react_jsx_runtime.jsx)("h2", {
						className: ModelsSection_module_css_default["title"],
						children: t("title")
					}),
					(0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["intro"],
						children: t("intro")
					}),
					!state.writable && state.status === "ready" ? (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["notice"],
						children: t("readOnly")
					}) : null,
					savedIdentity === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["savedNotice"],
						role: "status",
						"aria-live": "polite",
						children: providerCopy(t("savedProvider"), savedIdentity)
					}),
					(0, react_jsx_runtime.jsx)("ul", {
						className: ModelsSection_module_css_default["rows"],
						children: configured.map((row) => {
							const target = targetOf(row);
							const namespace = state.namespaces.get(target.settingsNs);
							/* v8 ignore next -- the join marks a row configured only when its namespace resolved */
							if (namespace === void 0) return null;
							const error = row.entry.error === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
								role: "alert",
								className: ModelsSection_module_css_default["error"],
								children: row.entry.error
							});
							if (needsSetup(row, anyUsable) && !dismissedSetup.has(row.entry.provider)) return (0, react_jsx_runtime.jsxs)("li", {
								className: ModelsSection_module_css_default["setupCard"],
								children: [
									error,
									renderProviderEditor({
										target,
										row,
										namespace,
										schema,
										operations,
										t,
										readOnly: !state.writable,
										onClose: (changed) => {
											closeSetup(changed, target);
										}
									}),
									renderSlot("settings.models.provider-card", {
										provider: row.entry,
										configured: row.configured,
										keyConfigured: keyConfiguredOf(row)
									}, { entryKey: row.entry.settingsNs })
								]
							}, row.entry.provider);
							const open = !addOpen && editing?.provider === row.entry.provider;
							const credentialConfigured = row.credential?.configured === true;
							const credentialMissing = !credentialConfigured && row.apiKeyEnv !== void 0 && row.credential?.configured === false;
							return (0, react_jsx_runtime.jsxs)("li", {
								className: ModelsSection_module_css_default["rowCard"],
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: ModelsSection_module_css_default["rowHead"],
										children: [(0, react_jsx_runtime.jsxs)("span", {
											className: ModelsSection_module_css_default["rowIdentity"],
											children: [
												(0, react_jsx_runtime.jsx)("span", {
													className: ModelsSection_module_css_default["rowName"],
													children: row.entry.displayName
												}),
												row.entry.declared === true ? (0, react_jsx_runtime.jsx)("span", {
													className: ModelsSection_module_css_default["rowTag"],
													children: t("customTag")
												}) : null,
												row.entry.provider === "deepseek-account" ? (0, react_jsx_runtime.jsxs)("span", {
													className: ModelsSection_module_css_default["accountStatus"],
													children: [(0, react_jsx_runtime.jsx)("span", {
														className: `${ModelsSection_module_css_default["credentialDot"]} ${ModelsSection_module_css_default["credentialDotConfigured"]}`,
														"aria-hidden": "true"
													}), t("accountSignedIn")]
												}) : null,
												credentialConfigured ? (0, react_jsx_runtime.jsx)("span", {
													className: `${ModelsSection_module_css_default["credentialDot"]} ${ModelsSection_module_css_default["credentialDotConfigured"]}`,
													role: "img",
													"aria-label": t("credentialConfigured"),
													title: t("credentialConfigured")
												}) : credentialMissing ? (0, react_jsx_runtime.jsx)("span", {
													className: `${ModelsSection_module_css_default["credentialDot"]} ${ModelsSection_module_css_default["credentialDotMissing"]}`,
													role: "img",
													"aria-label": t("credentialMissing"),
													title: t("credentialMissing")
												}) : null
											]
										}), (0, react_jsx_runtime.jsxs)("span", {
											className: ModelsSection_module_css_default["rowActions"],
											children: [row.entry.provider === "deepseek-account" ? null : (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: ModelsSection_module_css_default["secondaryButton"],
												"aria-label": providerCopy(t("editProvider"), target),
												disabled: !open && state.status !== "ready",
												onClick: () => {
													if (!open && controller.store.getSnapshot().status !== "ready") return;
													setSavedTarget(void 0);
													setAddOpen(false);
													setEditing(open ? void 0 : target);
												},
												children: t("edit")
											}), row.removable ? (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: ModelsSection_module_css_default["dangerButton"],
												"aria-label": providerCopy(t("removeProvider"), target),
												disabled: !state.writable || state.status !== "ready",
												onClick: () => {
													if (controller.store.getSnapshot().status !== "ready") return;
													setSavedTarget(void 0);
													setDeleteFailure(void 0);
													setDeleteTarget(target);
												},
												children: t("remove")
											}) : null]
										})]
									}),
									error,
									renderSlot("settings.models.provider-card", {
										provider: row.entry,
										configured: row.configured,
										keyConfigured: keyConfiguredOf(row)
									}, { entryKey: row.entry.settingsNs }),
									open ? renderProviderEditor({
										target,
										row,
										namespace,
										schema,
										operations,
										t,
										readOnly: !state.writable,
										onClose: (changed) => {
											closeEditor(changed, target);
										}
									}) : null
								]
							}, row.entry.provider);
						})
					}),
					(0, react_jsx_runtime.jsx)("div", {
						className: ModelsSection_module_css_default["addBlock"],
						children: addOpen ? (0, react_jsx_runtime.jsxs)("div", {
							className: ModelsSection_module_css_default["addCard"],
							children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: ModelsSection_module_css_default["addModes"],
									children: [bothOffered ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.SegmentedControl, {
										id: addId,
										label: t("addMode"),
										value: mode,
										disabled: switchLocked,
										options: [{
											value: "catalog",
											label: t("addCatalog"),
											disabled: !catalogEnabled,
											...catalogEnabled ? {} : { title: t("addCatalogExhausted") }
										}, {
											value: "custom",
											label: t("addCustom"),
											disabled: !customEnabled,
											...customEnabled ? {} : { title: t("addCustomUnavailable") }
										}],
										onChange: (next) => {
											setAddMode(next);
											setVisited((previous) => new Set([...previous, next]));
										}
									}) : (0, react_jsx_runtime.jsx)("div", {
										className: ModelsSection_module_css_default["editorHeader"],
										children: (0, react_jsx_runtime.jsx)("span", {
											className: ModelsSection_module_css_default["editorTitle"],
											children: t(mode === "catalog" ? "addCatalog" : "addCustom")
										})
									}), (0, react_jsx_runtime.jsx)("p", {
										className: ModelsSection_module_css_default["advancedHint"],
										children: t(mode === "catalog" ? "addCatalogHint" : "addCustomHint")
									})]
								}),
								mounted("catalog") && draft !== void 0 ? (0, react_jsx_runtime.jsxs)("div", {
									id: `${addId}-catalog-panel`,
									...bothOffered ? {
										role: "tabpanel",
										"aria-labelledby": `${addId}-catalog`
									} : {},
									hidden: mode !== "catalog",
									className: ModelsSection_module_css_default["addPanel"],
									children: [
										(0, react_jsx_runtime.jsxs)("div", {
											className: ModelsSection_module_css_default["field"],
											children: [(0, react_jsx_runtime.jsx)("span", {
												className: ModelsSection_module_css_default["fieldLabel"],
												children: t("provider")
											}), (0, react_jsx_runtime.jsx)("select", {
												className: `${ModelsSection_module_css_default["input"]} ${ModelsSection_module_css_default["selectInput"]}`,
												value: draft.target.provider,
												"aria-label": t("provider"),
												disabled: catalogBusy,
												onChange: (event) => {
													const picked = addable.find((candidate) => candidate.row.entry.provider === event.target.value);
													/* v8 ignore next -- the select only lists addable rows */
													if (picked === void 0) return;
													setEditing(targetOf(picked.row));
												},
												children: addable.map(({ row }) => (0, react_jsx_runtime.jsx)("option", {
													value: row.entry.provider,
													children: row.entry.displayName
												}, row.entry.provider))
											})]
										}),
										(0, react_jsx_runtime.jsx)(ProviderEditor, {
											provider: draft.target.provider,
											displayName: draft.target.displayName,
											hideTitle: true,
											namespace: draft.namespace,
											schema,
											settingsPath: draft.target.settingsPath,
											operations,
											...draft.target.defaultBaseURL === void 0 ? {} : { defaultBaseURL: draft.target.defaultBaseURL },
											...draft.target.baseURLEnv === void 0 ? {} : { baseURLEnv: draft.target.baseURLEnv },
											...draft.target.nativeAuth === void 0 ? {} : { nativeAuth: draft.target.nativeAuth },
											...addRow?.credentialChecks === void 0 ? {} : { credentialChecks: addRow.credentialChecks },
											t,
											readOnly: !state.writable,
											onClose: (changed) => {
												closeEditor(changed, draft.target);
											},
											onBusyChange: setCatalogBusy
										}, draft.target.provider),
										addRow === void 0 ? null : renderSlot("settings.models.provider-card", {
											provider: addRow.entry,
											configured: addRow.configured,
											keyConfigured: keyConfiguredOf(addRow)
										}, { entryKey: addRow.entry.settingsNs })
									]
								}) : null,
								mounted("custom") && piAi !== void 0 ? (0, react_jsx_runtime.jsx)("div", {
									id: `${addId}-custom-panel`,
									...bothOffered ? {
										role: "tabpanel",
										"aria-labelledby": `${addId}-custom`
									} : {},
									hidden: mode !== "custom",
									className: ModelsSection_module_css_default["addPanel"],
									children: (0, react_jsx_runtime.jsx)(CustomProviderCard, {
										taken: state.rows.map((row) => row.entry.provider),
										protocols,
										reasoningLevels,
										revision: piAi.revision,
										operations,
										t,
										readOnly: !state.writable,
										onClose: (changed) => {
											closeAdd();
											if (changed) controller.load();
										},
										onBusyChange: setCustomBusy
									})
								}) : null
							]
						}) : catalogOffered || customOffered ? (0, react_jsx_runtime.jsx)("div", {
							className: ModelsSection_module_css_default["addActions"],
							children: (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								className: ModelsSection_module_css_default["addButton"],
								disabled: !state.writable || state.status !== "ready" || !catalogEnabled && !customEnabled,
								onClick: () => {
									if (controller.store.getSnapshot().status !== "ready") return;
									const first = addable[0];
									const initial = catalogEnabled ? "catalog" : "custom";
									setSavedTarget(void 0);
									setEditing(first === void 0 ? void 0 : targetOf(first.row));
									setAddMode(initial);
									setVisited(new Set([initial]));
									setAddOpen(true);
								},
								children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }), t("add")]
							})
						}) : null
					}),
					renderSlot("settings.models.footer", {}),
					(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: deleteTarget !== void 0,
						onClose: closeDelete,
						title: deleteTarget === void 0 ? "" : providerCopy(t("deleteTitle"), deleteTarget),
						closeLabel: t("close"),
						description: deleteTarget === void 0 ? "" : providerCopy(deleteTarget.credentialRef === void 0 ? t("deleteDescription") : t("deleteDescriptionWithCredential"), deleteTarget),
						className: ModelsSection_module_css_default["deleteDialog"],
						footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							"data-modal-autofocus": true,
							disabled: deleting,
							onClick: closeDelete,
							children: t("cancel")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							className: ModelsSection_module_css_default["deleteConfirm"],
							disabled: deleting,
							onClick: confirmDelete,
							children: deleteTarget === void 0 ? "" : providerCopy(deleting ? t("deleting") : t("deleteConfirm"), deleteTarget)
						})] }),
						children: deleteFailure === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
							className: ModelsSection_module_css_default["error"],
							children: deleteFailure
						})
export {};
