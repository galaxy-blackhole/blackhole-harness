/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
							(0, react_jsx_runtime.jsx)("p", {
								className: PluginManagerPage_module_css_default.detailName,
								children: (0, react_jsx_runtime.jsx)("code", { children: row.moduleName })
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: PluginManagerPage_module_css_default.detailDesc,
								children: description ?? renderSlot("plugins.row.config", { view: "summary" }, { entryKey: key })
							})
						]
					}),
					(0, react_jsx_runtime.jsx)(MetadataError, {
						error: row.meta?.error,
						t
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.detailSections,
						"data-plugin-config": true,
						children: [renderSlot("plugins.row.config", {
							view: "page",
							form
						}, { entryKey: key }), renderSlot("plugins.detail.section", { subject })]
					})
				]
			});
		}
		/**
		* One package's page: the crumb back to the list; its icon with its switch
		* and, for a package the profile installed or a selection the Host can remove, uninstall; its title beside its
		* version tag, its beta tag, and its problem tag; the package name the title
		* stands for; its one-liner; the Host's problem when it reports one; the
		* configuration the bundle registered for itself; its rows with their switches
		* and configure controls; and where it comes from.
		*/
		function PackageDetail({ pkg, t, resolveText, busy, rowBusy, configured, configure, renderSlot, inMore, onBack, onSetEnabled, onUninstall, onUpdate, onSetRowEnabled }) {
			const { title, description, beta } = packageText(pkg, resolveText);
			const status = packageStatus(pkg);
			const previews = undefined;
			const preview = previews === void 0 ? void 0 : resolveText(previews);
			const subject = {
				kind: "bundle",
				pkg: packageRef(pkg)
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: PluginManagerPage_module_css_default.detail,
				"data-plugin-detail": pkg.name,
				children: [
					(0, react_jsx_runtime.jsx)(DetailTop, {
						crumbLabel: inMore ? t("backToPackage", { name: t("moreTitle") }) : t("backToList"),
						crumbText: t(inMore ? "moreTitle" : "crumbRoot"),
						onBack,
						icon: (0, react_jsx_runtime.jsx)(PackageArtwork, { src: pkg.meta?.icon }, pkg.meta?.icon),
						actions: (0, react_jsx_runtime.jsxs)("div", {
							className: PluginManagerPage_module_css_default.detailActions,
							children: [
								renderSlot("plugins.detail.actions", { subject }),
								updateAvailable(pkg) ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconRefreshOutlineRegular, { size: 13 }),
									disabled: busy,
									"aria-label": t("updateLabel", { name: title }),
									onClick: onUpdate,
									children: t("update")
								}) : null,
								pkg.installed || pkg.removable ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
									variant: "outline",
									size: "sm",
									className: PluginManagerPage_module_css_default.danger,
									icon: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 13 }),
									"aria-label": t("uninstallLabel", { name: title }),
									disabled: busy || !pkg.removable || pkg.readOnlyReason !== void 0,
									onClick: onUninstall,
									children: t("uninstall")
								}) : null,
								(0, react_jsx_runtime.jsx)(EnableSwitch, {
									pkg,
									title,
									t,
									busy,
									onSetEnabled
								})
							]
						})
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.detailMain,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: PluginManagerPage_module_css_default.titleRow,
								children: [
									(0, react_jsx_runtime.jsx)("h3", {
										className: PluginManagerPage_module_css_default.detailTitle,
										children: title
									}),
									pkg.version === void 0 ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tag, {
										className: PluginManagerPage_module_css_default.versionTag,
										tone: "neutral",
										children: t("versionTag", { version: pkg.version })
									}),
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
									}) : null,
									renderSlot("plugins.detail.badge", { subject })
								]
							}),
							(0, react_jsx_runtime.jsx)("p", {
								className: PluginManagerPage_module_css_default.detailName,
								children: (0, react_jsx_runtime.jsx)("code", {
									"data-plugin-name": true,
									children: pkg.name
								})
							}),
							description === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
								className: PluginManagerPage_module_css_default.detailDesc,
								children: description
							})
						]
					}),
					(0, react_jsx_runtime.jsx)(MetadataError, {
						error: pkg.meta?.error,
						t
					}),
					pkg.error === void 0 ? null : (0, react_jsx_runtime.jsxs)("p", {
						className: PluginManagerPage_module_css_default.reason,
						role: "status",
						children: [
							t("reasonLabel"),
							": ",
							managementText(pkg.error, t)
						]
					}),
					pkg.readOnlyReason === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
						className: PluginManagerPage_module_css_default.reason,
						role: "status",
						children: managementText({ code: pkg.readOnlyReason }, t)
					}),
					preview === void 0 ? null : (0, react_jsx_runtime.jsx)(PackagePreview, {
						src: preview,
						title,
						t
					}),
					(0, react_jsx_runtime.jsxs)("div", {
						className: PluginManagerPage_module_css_default.detailSections,
						children: [
							configured ? (0, react_jsx_runtime.jsx)("section", {
								className: PluginManagerPage_module_css_default.detailSection,
								"data-plugin-config": true,
								children: renderSlot("plugins.bundle.config", { view: "page" }, { entryKey: pkg.name })
							}) : null,
							pkg.availability === "missing" ? null : (0, react_jsx_runtime.jsx)(RowsSection, {
								rows: pkg.rows,
								t,
								resolveText,
								toggle: pkg.enabled ? {
									busy: (row) => busy || rowBusy(row),
									onSetEnabled: onSetRowEnabled
								} : void 0,
								configure
							}),
							(0, react_jsx_runtime.jsx)(SourceSection, {
								pkg,
								t
							}),
							renderSlot("plugins.detail.section", { subject })
						]
					})
				]
			});
		}
		/** Output lines an install run's terminal shows before its middle folds: the first and last six of a long pnpm log. */
		const INSTALL_TERMINAL_LINES = 12;
		/** The install terminal's display copy, from the tab's dictionary. */
		function terminalLabels(t) {
			return {
				commandLine: (line) => t("terminalCommandLine", { n: String(line) }),
				/* v8 ignore next -- the Host reports a killed pnpm as a null exit code, never a signal name; the label interface needs one */
				signal: (signal) => t("terminalSignal", { signal }),
				exitCode: (code) => t("terminalExitCode", { code: String(code) }),
				noExitCode: t("terminalNoExitCode"),
				running: t("terminalRunning"),
				failed: t("terminalFailed"),
				done: t("terminalDone"),
				copy: t("terminalCopy"),
				copied: t("terminalCopied"),
				noOutput: t("terminalNoOutput"),
				collapseAria: t("terminalCollapseAria"),
				collapse: t("terminalCollapse"),
				expandAria: (hidden) => t("terminalExpandAria", { n: String(hidden) }),
				expand: (hidden) => t("terminalExpand", { n: String(hidden) })
			};
		}
		/** The sentence under the field for a spec the check refused. */
		const INPUT_PROBLEM_KEYS = {
			"invalid-spec": "installProblemInvalid",
			"already-installed": "installProblemInstalled",
			"shipped": "installProblemShipped",
			"not-found": "installProblemNotFound",
			"not-a-package": "installProblemNotPackage",
			"not-a-bundle": "installProblemNotBundle",
			"network": "installProblemNetwork",
			"unknown": "installProblemUnknown"
		};
		/** The spec form the install guide shows, with an example the person can drop into the field. */
		const GUIDE_EXAMPLES = [{
			key: "id",
			titleKey: "installGuideIdTitle",
			exampleKey: "installGuideIdExample",
			hintKey: "installGuideIdHint"
		}];
		/** The one-line reading of a classified pnpm failure. */
		const FAILURE_KIND_KEYS = {
			"pnpm-missing": "installFailurePnpmMissing",
			"timeout": "installFailureTimeout",
			"not-found": "installFailureNotFound",
			"no-matching-version": "installFailureNoMatchingVersion",
			"network": "installFailureNetwork",
			"disk-full": "installFailureDiskFull",
			"permission": "installFailurePermission",
			"build-blocked": "installFailureBuildBlocked",
			"integrity": "installFailureIntegrity",
			"unknown": "installFailureGeneric"
		};
		/** The navigation value of the page's own tab; contributed tabs use their registration ids. */
		const INSTALLED_TAB = "installed";
		/** The heading of each screen past the spec. */
		const SCREEN_TITLE_KEYS = {
			starting: "installStarting",
			running: "installingTitle",
			cancelling: "installCancelling",
			applying: "installApplying",
			unconfirmed: "installUnconfirmedTitle",
			unknown: "installUnknownTitle",
			done: "installedTitle",
			failed: "installFailedTitle"
		};
		/** What the spec's kind reads as when the package carries no description of its own. */
		const SUBJECT_KIND_KEYS = {
			registry: void 0,
			path: "installSubjectPath",
			git: "installSubjectGit",
			tarball: "installSubjectTarball"
		};
		/** A check no registry answered names every registry asked; any other refusal reads by its problem. */
		function inputProblemSentence(problem, t, resolved) {
			const asked = problem.registries ?? [];
			return problem.problem === "network" && asked.length > 1 ? t("installProblemNetworkAll", { registries: registryList(asked, t, resolved) }) : t(INPUT_PROBLEM_KEYS[problem.problem], { reason: problem.reason });
		}
		/** The registries asked, by name, in the dictionary's list form. */
		function registryList(registries, t, resolved) {
			return registries.map((registry) => registryText(registry, t, resolved).name).join(t("registryListSeparator"));
		}
		/** An option's name with its host in tertiary text, unless the host is the name. */
		function registryOption(registry, t, resolved) {
			const { name, host } = registryText(registry, t, resolved);
			return name === host ? name : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
				name,
				" ",
				(0, react_jsx_runtime.jsx)("span", {
					className: PluginManagerPage_module_css_default.registryHint,
					children: host
				})
			] });
		}
		/**
		* The failed screen's one line: a pnpm failure by its kind, a refusal by its
		* code, any other failure in the Host's words; the run's output stays behind the details.
		* A run the Host laid at the spec's own host says so; one it laid at a registry
		* names every registry asked when there were several.
		*/
		function failureText(failure, t, install) {
			if (failure === null) return t("installFailureGeneric");
			if (failure.code === "incompatible-version") {
				const incompatible = failure.incompatible === void 0 ? {} : { incompatible: failure.incompatible };
				return managementText({
					code: failure.code,
					installing: true,
					...incompatible
				}, t);
			}
			if (failure.kind === "build-blocked" && !failure.pendingBuilds?.length) return t("installFailureBuildBlockedManual");
			const host = install?.subject?.host;
			if (failure.failedAt === "spec-host" && host !== void 0) return t("installFailureNetworkHost", { host });
			const asked = install?.attempts?.registries ?? [];
			if (failure.failedAt === "registry" && (failure.kind === "network" || failure.kind === "timeout") && asked.length > 1) return t("installFailureNetworkAll", { registries: registryList(asked, t, install?.registries?.resolved ?? null) });
			if (failure.kind !== void 0) return t(FAILURE_KIND_KEYS[failure.kind]);
			if (failure.code !== void 0) return managementText({
				code: failure.code,
				diagnostic: failure.reason
			}, t);
			return failure.reason === "" ? t("installFailureGeneric") : failure.reason;
		}
		/** The package an install is about: its name, one-liner, version, and, when `showSpec` is set, its spec. */
		function SubjectBlock({ lines, t }) {
			return (0, react_jsx_runtime.jsxs)("div", {
				className: PluginManagerPage_module_css_default.subject,
				"data-install-subject": lines.spec,
				children: [
					(0, react_jsx_runtime.jsx)("p", {
						className: PluginManagerPage_module_css_default.subjectName,
						children: lines.title
					}),
					lines.description === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
						className: PluginManagerPage_module_css_default.subjectDesc,
						children: lines.description
					}),
					lines.version === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
						className: PluginManagerPage_module_css_default.subjectMeta,
						children: t("installVersion", { version: lines.version })
					}),
					lines.showSpec ? (0, react_jsx_runtime.jsx)("p", {
						className: PluginManagerPage_module_css_default.subjectSpec,
						children: lines.spec
					}) : null
				]
			});
		}
		/** The checked package as the Host read it before installing; a confirmed version keeps its tab's name and version. */
		function SubjectCard({ subject, confirmed, t }) {
			const kindKey = SUBJECT_KIND_KEYS[subject.kind];
			return (0, react_jsx_runtime.jsx)(SubjectBlock, {
				t,
				lines: {
					spec: subject.spec,
					title: confirmed?.title ?? subject.name ?? subject.spec,
					description: subject.description ?? (kindKey === void 0 ? void 0 : t(kindKey)),
					version: subject.version ?? confirmed?.version,
					showSpec: confirmed !== void 0
				}
			});
		}
		/** Track one install field's composition, including Safari's 10ms post-composition Enter window. */
		function useInstallComposition(active) {
			const composition = (0, react.useRef)({
				active: false,
				until: 0
			});
			(0, react.useEffect)(() => {
				composition.current = {
					active: false,
					until: 0
				};
			}, [active]);
			return {
				onCompositionStart: () => {
					composition.current.active = true;
				},
				onCompositionEnd: () => {
					composition.current = {
						active: false,
						until: Date.now() + 10
					};
				},
				onBlur: () => {
					composition.current = {
						active: false,
						until: 0
					};
				},
				isComposing: (event) => event.isComposing || Reflect.get(event, "keyCode") === 229 || composition.current.active || Date.now() < composition.current.until
			};
		}
		/**
		* The install dialog: the spec and its check, then the installing, installed,
		* and failed screens over the same subject card. A failed run that left
		* install scripts undecided shows them for approval in place of plain retry.
		*/
		function InstallDialog({ install, t, onClose, onEditSpec, onRun, onCancel, onReconcile, onToggleDetails, onEnableNow, onApproveBuilds, onToggleRegistry, onChooseRegistry, onChangeRegistry, onUseGithubMirror }) {
			const errorId = (0, react.useId)();
			const templateHintId = (0, react.useId)();
			const guideId = (0, react.useId)();
			const approvalId = (0, react.useId)();
			const registryId = (0, react.useId)();
			const registryErrorId = (0, react.useId)();
			const [guideOpen, setGuideOpen] = (0, react.useState)(false);
			const [customRegistryDraft, setCustomRegistryDraft] = (0, react.useState)("");
			const { phase } = install;
			const registryToggleRef = (0, react.useRef)(null);
			const registryPanelRef = (0, react.useRef)(null);
			const registryCustomRef = (0, react.useRef)(null);
			const registryShown = install.registryOpen && phase === "idle";
			const specComposition = useInstallComposition(install.open && phase === "idle");
			const registryComposition = useInstallComposition(install.open && registryShown);
			const registryPosition = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open: registryShown,
export {};
