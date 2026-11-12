/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				anchorRef: registryToggleRef,
				panelRef: registryPanelRef,
				align: "end",
				gap: 6,
				margin: 12
			});
			const registryReady = registryShown && registryPosition !== null;
			(0, react.useEffect)(() => {
				if (registryReady && install.registryError) registryCustomRef.current?.focus();
			}, [registryReady, install.registryError]);
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(registryToggleRef, registryShown, onToggleRegistry, registryPanelRef);
			(0, react.useEffect)(() => {
				if (!registryShown) return;
				const onKeyDown = (event) => {
					if (event.key !== "Escape") return;
					event.stopPropagation();
					onToggleRegistry();
				};
				document.addEventListener("keydown", onKeyDown, true);
				return () => {
					document.removeEventListener("keydown", onKeyDown, true);
				};
			}, [registryShown, onToggleRegistry]);
			if (githubRecoveryRegistry(install) !== void 0) {
				const anotherWay = asksMirror(install);
				return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: install.open,
					onClose,
					title: t(install.failure?.kind === "timeout" ? "installGithubTimeoutTitle" : "installGithubFailedTitle"),
					closeLabel: t("close"),
					description: t("installGithubFailedDescription"),
					footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						onClick: onClose,
						children: t("cancel")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						autoFocus: true,
						onClick: () => {
							if (anotherWay) setGuideOpen(true);
							onUseGithubMirror();
						},
						children: t(anotherWay ? "installTryAnotherWay" : "installUseGithubMirror")
					})] })
				});
			}
			if ((phase === "idle" || phase === "checking") && install.confirmed !== void 0) {
				const checking = phase === "checking";
				const problem = install.inputError;
				return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: install.open,
					onClose,
					title: t(problem === null ? "installConfirmedTitle" : "installConfirmedRefused"),
					closeLabel: t("close"),
					className: PluginManagerPage_module_css_default.installDialog,
					footer: checking ? void 0 : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "outline",
						onClick: onClose,
						children: t("close")
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
						variant: "primary",
						autoFocus: true,
						onClick: onRun,
						children: t(problem === null ? "installRun" : "retry")
					})] }),
					children: (0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.installBody,
						"data-install-phase": phase,
						children: [(0, react_jsx_runtime.jsx)(SubjectBlock, {
							t,
							lines: {
								spec: install.spec,
								...install.confirmed,
								showSpec: true
							}
						}), checking ? (0, react_jsx_runtime.jsxs)("p", {
							className: `${PluginManagerPage_module_css_default.status} ${PluginManagerPage_module_css_default.statusWithDot}`,
							role: "status",
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }), t("installChecking")]
						}) : problem === null ? null : (0, react_jsx_runtime.jsx)("p", {
							className: PluginManagerPage_module_css_default.inputError,
							role: "alert",
							children: inputProblemSentence(problem, t, install.registries?.resolved ?? null)
						})]
					})
				});
			}
			if (phase === "idle" || phase === "checking") {
				const checking = phase === "checking";
				const empty = install.spec.trim() === "";
				const choice = install.registry;
				const resolved = install.registries?.resolved ?? null;
				const chosenTitle = choice.kind === "custom" ? t("registryCustom") : registryText(choice.registry, t, resolved).name;
				const inputSentence = install.inputError === null ? null : inputProblemSentence(install.inputError, t, resolved);
				const templateHint = install.spec === "https://github.com/author/dsh-plugin" ? t("installGitTemplateHint") : install.spec === "/Users/name/my-plugin" ? t("installPathTemplateHint") : null;
				return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
					open: install.open,
					onClose,
					title: t("installTitle"),
					closeLabel: t("close"),
					...install.mirrorRecovery ? {} : { description: t("installDescription") },
					className: PluginManagerPage_module_css_default.installDialog,
					contentClassName: PluginManagerPage_module_css_default.installContent,
					footer: (0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.installFooter,
						children: [(0, react_jsx_runtime.jsxs)("p", {
							className: PluginManagerPage_module_css_default.installSafety,
							role: "note",
							children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconWarningOutlineRegular, {
								size: 14,
								"aria-hidden": "true"
							}), (0, react_jsx_runtime.jsxs)("span", {
								className: PluginManagerPage_module_css_default.installSafetyText,
								children: [(0, react_jsx_runtime.jsx)("span", { children: t("installGuideSafety") }), (0, react_jsx_runtime.jsx)("span", { children: t("installUpgradeNotice") })]
							})]
						}), (0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "primary",
							className: PluginManagerPage_module_css_default.wide,
							disabled: checking || empty,
							"aria-busy": checking,
							onClick: onRun,
							children: [checking ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.StateDot, { state: "ongoing" }) : null, t(checking ? "installChecking" : "installRun")]
						})]
					}),
					children: (0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.installBody,
						children: [
							(0, react_jsx_runtime.jsx)("div", {
								className: PluginManagerPage_module_css_default.installField,
								children: (0, react_jsx_runtime.jsx)("input", {
									type: "text",
									autoFocus: install.mirrorRecovery === true,
									"data-modal-autofocus": true,
									value: install.spec,
									placeholder: t("installSpecPlaceholder"),
									disabled: checking,
									"aria-label": t(install.mirrorRecovery ? "installPackageLabel" : "installSpecLabel"),
									"aria-invalid": install.inputError !== null,
									"aria-describedby": inputSentence !== null ? errorId : templateHint !== null ? templateHintId : void 0,
									onChange: (event) => {
										onEditSpec(event.currentTarget.value);
									},
									onCompositionStart: specComposition.onCompositionStart,
									onCompositionEnd: specComposition.onCompositionEnd,
									onBlur: specComposition.onBlur,
									onKeyDown: (event) => {
										if (specComposition.isComposing(event.nativeEvent)) return;
										if (event.key === "Enter" && !empty && !checking) onRun();
									}
								})
							}),
							inputSentence === null ? null : (0, react_jsx_runtime.jsx)("p", {
								id: errorId,
								className: PluginManagerPage_module_css_default.inputError,
								role: "alert",
								children: inputSentence
							}),
							inputSentence === null && templateHint !== null ? (0, react_jsx_runtime.jsx)("p", {
								id: templateHintId,
								className: PluginManagerPage_module_css_default.templateHint,
								role: "status",
								children: templateHint
							}) : null,
							(0, react_jsx_runtime.jsxs)("div", {
								className: PluginManagerPage_module_css_default.optionsRow,
								children: [(0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									className: PluginManagerPage_module_css_default.guideToggle,
									"aria-expanded": guideOpen,
									"aria-controls": guideId,
									onClick: () => {
										setGuideOpen((open) => !open);
									},
									children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
										className: PluginManagerPage_module_css_default.guideChevron,
										"aria-hidden": "true"
									}), (0, react_jsx_runtime.jsx)("span", { children: t(guideOpen ? "installGuideHide" : "installGuideToggle") })]
								}), (0, react_jsx_runtime.jsxs)("button", {
									ref: registryToggleRef,
									type: "button",
									className: PluginManagerPage_module_css_default.registryToggle,
									"aria-expanded": install.registryOpen,
									"aria-controls": registryId,
									"aria-haspopup": "dialog",
									disabled: checking,
									onClick: onToggleRegistry,
									children: [
										(0, react_jsx_runtime.jsx)("span", { children: t("registryToggle") }),
										" ",
										(0, react_jsx_runtime.jsx)("span", {
											className: PluginManagerPage_module_css_default.registryChosen,
											children: chosenTitle
										}),
										(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {
											className: PluginManagerPage_module_css_default.guideChevron,
											"aria-hidden": "true"
										})
									]
								})]
							}),
							guideOpen ? (0, react_jsx_runtime.jsx)("div", {
								id: guideId,
								className: PluginManagerPage_module_css_default.guide,
								"data-install-guide": true,
								children: (0, react_jsx_runtime.jsx)("ol", {
									className: PluginManagerPage_module_css_default.guideList,
									children: GUIDE_EXAMPLES.map(({ key, titleKey, exampleKey, hintKey }) => (0, react_jsx_runtime.jsxs)("li", {
										className: PluginManagerPage_module_css_default.guideItem,
										children: [(0, react_jsx_runtime.jsxs)("div", {
											className: PluginManagerPage_module_css_default.guideMain,
											children: [
												(0, react_jsx_runtime.jsx)("span", {
													className: PluginManagerPage_module_css_default.guideTitle,
													children: t(titleKey)
												}),
												(0, react_jsx_runtime.jsx)("span", {
													className: PluginManagerPage_module_css_default.guideHint,
													children: t(hintKey)
												}),
												(0, react_jsx_runtime.jsxs)("span", {
													className: PluginManagerPage_module_css_default.guideExample,
													children: [(0, react_jsx_runtime.jsx)("span", {
														className: PluginManagerPage_module_css_default.guideExampleLabel,
														children: t("installGuideExampleLabel")
													}), (0, react_jsx_runtime.jsx)("code", { children: t(exampleKey) })]
												})
											]
										}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
											variant: "outline",
											size: "sm",
											"aria-label": t("installGuideFillAria", { example: t(exampleKey) }),
											disabled: checking,
											onClick: () => {
												onEditSpec(t(exampleKey));
											},
											children: t("installGuideFill")
										})]
									}, key))
								})
							}) : null,
							registryShown ? (0, react_dom.createPortal)((0, react_jsx_runtime.jsxs)("fieldset", {
								ref: registryPanelRef,
								id: registryId,
								className: PluginManagerPage_module_css_default.registry,
								style: registryPosition ?? {
									visibility: "hidden",
									left: 0,
									top: 0
								},
								"data-install-registry": true,
								"aria-label": t("registryLegend"),
								onKeyDown: (event) => {
									if (event.key !== "Tab" || event.ctrlKey || event.altKey || event.metaKey || event.nativeEvent.isComposing) return;
									event.preventDefault();
									event.stopPropagation();
									const radio = event.currentTarget.querySelector("input[type=\"radio\"]:checked");
									const field = registryCustomRef.current;
									if (event.shiftKey && event.target === field) radio?.focus();
									else if (!event.shiftKey && event.target !== field) field?.focus();
									else {
										onToggleRegistry();
										registryToggleRef.current?.focus();
									}
								},
								children: [offeredRegistries(install.registries).map((registry) => {
									const checked = choice.kind === "offered" && choice.registry === registry;
									return (0, react_jsx_runtime.jsxs)("label", {
										className: PluginManagerPage_module_css_default.registryOption,
										"data-checked": checked,
										children: [(0, react_jsx_runtime.jsx)("input", {
											type: "radio",
											name: registryId,
											checked,
											onChange: () => {
												if (choice.kind === "custom") setCustomRegistryDraft(choice.url);
												onChooseRegistry({
													kind: "offered",
													registry
												});
											}
										}), (0, react_jsx_runtime.jsx)("span", {
											className: PluginManagerPage_module_css_default.registryTitle,
											children: registryOption(registry, t, resolved)
										})]
									}, registry ?? "");
								}), (0, react_jsx_runtime.jsxs)("div", {
									className: PluginManagerPage_module_css_default.registryOption,
									"data-checked": choice.kind === "custom",
									onClick: (event) => {
										if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
										registryCustomRef.current?.focus();
									},
									children: [
										(0, react_jsx_runtime.jsxs)("label", {
											className: PluginManagerPage_module_css_default.registryCustomPick,
											children: [(0, react_jsx_runtime.jsx)("input", {
												type: "radio",
												name: registryId,
												checked: choice.kind === "custom",
												onChange: () => {
													onChooseRegistry({
														kind: "custom",
														url: customRegistryDraft
													});
													registryCustomRef.current?.focus();
												}
											}), (0, react_jsx_runtime.jsx)("span", {
												className: PluginManagerPage_module_css_default.registryTitle,
												children: (0, react_jsx_runtime.jsx)("span", { children: t("registryCustom") })
											})]
										}),
										(0, react_jsx_runtime.jsx)("input", {
											ref: registryCustomRef,
											type: "text",
											className: PluginManagerPage_module_css_default.registryCustomField,
											"aria-label": t("registryCustom"),
											placeholder: t("registryCustomPlaceholder"),
											value: choice.kind === "custom" ? choice.url : customRegistryDraft,
											"aria-invalid": install.registryError,
											"aria-describedby": install.registryError ? registryErrorId : void 0,
											onFocus: () => {
												if ((0, _deepseek_ai_dsh_client_ui_primitives.pointerModality)() && choice.kind !== "custom") onChooseRegistry({
													kind: "custom",
													url: customRegistryDraft
												});
											},
											onChange: (event) => {
												onChooseRegistry({
													kind: "custom",
													url: event.currentTarget.value
												});
											},
											onCompositionStart: registryComposition.onCompositionStart,
											onCompositionEnd: registryComposition.onCompositionEnd,
											onBlur: registryComposition.onBlur,
											onKeyDown: (event) => {
												if (registryComposition.isComposing(event.nativeEvent)) return;
												if (event.key === "Enter" && !empty) onRun();
											}
										}),
										install.registryError ? (0, react_jsx_runtime.jsx)("p", {
											id: registryErrorId,
											className: PluginManagerPage_module_css_default.inputError,
											role: "alert",
											children: t("registryCustomInvalid")
										}) : null,
										(0, react_jsx_runtime.jsx)("span", {
											className: PluginManagerPage_module_css_default.registryHint,
											children: t("registryCustomHint")
										})
									]
								})]
							}), document.body) : null
						]
					})
				});
			}
			const heading = t(SCREEN_TITLE_KEYS[phase]);
			const pending = isInstallPending(phase);
			const cancellable = phase === "starting" || phase === "running" || phase === "unconfirmed";
			const stoppable = cancellable || phase === "failed" || phase === "unknown";
			const failure = install.failure;
			const uncertainty = failure?.uncertainty;
			const uncertaintyText = failure?.uncertainty === void 0 ? null : t({
				result: "installResultUnconfirmed",
				cancellation: phase === "applying" ? "installApplyingCancellationError" : "installCancelUnconfirmed",
				acceptance: "installAwaitingAcceptance"
			}[failure.uncertainty], { reason: failure.reason });
			const pendingBuilds = phase === "failed" ? install.failure?.pendingBuilds ?? [] : [];
			const approvable = pendingBuilds.length > 0;
			const firstRun = install.runs[0];
			const asked = install.attempts !== null && install.attempts.registries.length > 1 ? install.attempts : null;
			const current = asked === null ? void 0 : asked.registries.at(-1);
			const previous = asked === null ? void 0 : asked.registries.at(-2);
			const resolved = install.registries?.resolved ?? null;
			const attemptLine = pending && asked !== null && current !== void 0 && previous !== void 0 ? t("installAttempt", {
				previous: registryText(previous, t, resolved).name,
				registry: registryText(current, t, resolved).name,
				index: String(asked.registries.length),
				total: String(asked.total)
			}) : null;
			const changeable = phase === "failed" && !approvable && install.failure?.failedAt === "registry" && install.confirmed === void 0;
			const subject = install.subject;
			return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: install.open,
				onClose,
				title: heading,
				headless: true,
				className: PluginManagerPage_module_css_default.installDialog,
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: PluginManagerPage_module_css_default.wizard,
					"data-install-phase": phase,
					children: [(0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.wizardHead,
						children: [phase === "done" || install.confirmed !== void 0 && !pending ? (0, react_jsx_runtime.jsx)("span", {}) : (0, react_jsx_runtime.jsxs)("button", {
							type: "button",
							className: PluginManagerPage_module_css_default.wizardBack,
							"aria-label": t(install.confirmed !== void 0 ? "cancel" : pending ? "installCancelAndEdit" : "installEditAria"),
							disabled: !stoppable,
							onClick: onCancel,
export {};
