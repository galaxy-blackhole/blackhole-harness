/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
				const endpointEnv = props.baseURLEnv ?? [];
				const endpointHint = family === "deepseek" ? t("deepSeekEndpointHint") : baseURL === void 0 && endpointEnv.length > 0 ? t("baseUrlEnvironment").replace("{env}", () => endpointEnv.join(", ")) : void 0;
				const namedRef = stringAt(fallback, "apiKeyEnv");
				const nativeAuth = namedRef === void 0 ? props.nativeAuth : void 0;
				const authRefs = namedRef === void 0 ? (nativeAuth?.env ?? []).filter((ref) => !endpointEnv.includes(ref)) : [namedRef];
				const visibleRefs = authRefs.filter((ref) => !ref.toLowerCase().includes("oauth"));
				const keyHint = visibleRefs[0];
				const checkedRefs = authRefs.map((ref) => [ref, props.credentialChecks?.[ref] ?? (ref === namedRef ? props.credential : void 0)]);
				const detected = checkedRefs.find(([, info]) => info?.configured === true);
				const detectedRef = detected?.[0];
				const detectedVisibleRef = detectedRef === void 0 || !visibleRefs.includes(detectedRef) ? void 0 : detectedRef;
				const missingRefs = checkedRefs.length > 0 && checkedRefs.every(([, info]) => info?.configured === false);
				const savedCredential = detected?.[1]?.source === "file";
				const credentialHint = keyDraft.length > 0 || savedCredential || keyHint === void 0 || props.credentialRequired === true ? void 0 : t(detectedRef === void 0 ? missingRefs ? "keyFallbackMissing" : "keyFallbackUnchecked" : detectedVisibleRef === void 0 ? "keyFallbackDetectedHidden" : "keyFallbackDetected").replace("{hint}", () => detectedVisibleRef ?? keyHint);
				const keyHelp = visibleRefs.length === 0 ? void 0 : t("keyHelp").replace("{env}", () => visibleRefs.join(" / "));
				const authHelp = keyHelp === void 0 ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: keyHelp,
					side: "right",
					delayMs: 0,
					focusDelayMs: 0,
					portal: true,
					openOnClick: true,
					children: (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: ModelsSection_module_css_default["helpButton"],
						"aria-label": t("authHelp"),
						children: "?"
					})
				});
				const keylessNativeAuth = nativeAuth?.env.length === 0 && nativeAuth.oauth;
				const keyPlaceholder = keyHint === void 0 || props.credentialRequired === true ? t("keyPlaceholder") : t(savedCredential ? "keyPlaceholderSaved" : "keyPlaceholderFallback").replace("{hint}", () => keyHint);
				/** What both family editors take: the rows, whose layer owns them, and the two writes. */
				const catalogProps = {
					models,
					overridden: modelsOverridden,
					t,
					disabled,
					onChange: (next) => {
						setDraft((current) => schema.setPath(current, ["models"], next));
					},
					onReset: () => {
						setDraft((current) => schema.deletePath(current, ["models"]));
					}
				};
				return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [keylessNativeAuth ? null : (0, react_jsx_runtime.jsxs)("div", {
					className: ModelsSection_module_css_default["field"],
					children: [
						(0, react_jsx_runtime.jsxs)("span", {
							className: ModelsSection_module_css_default["fieldLabel"],
							children: [t("keyInput"), authHelp]
						}),
						(0, react_jsx_runtime.jsx)(ApiKeyInput, {
							t,
							value: keyDraft,
							placeholder: keyPlaceholder,
							"aria-label": t("keyInput"),
							"aria-invalid": shownKeyFailure !== void 0,
							"aria-describedby": credentialHint === void 0 ? void 0 : `${props.provider}-credential-hint`,
							required: props.credentialRequired === true,
							autoFocus: props.autoFocusCredential === true,
							disabled,
							onChange: (event) => {
								setKeyDraft(event.target.value);
							}
						}),
						credentialHint === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
							id: `${props.provider}-credential-hint`,
							className: ModelsSection_module_css_default[missingRefs ? "notice" : detectedRef === void 0 ? "advancedHint" : "savedNotice"],
							children: credentialHint
						}),
						shownKeyFailure === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
							className: ModelsSection_module_css_default["error"],
							children: t(shownKeyFailure)
						})
					]
				}), props.credentialOnly === true ? null : (0, react_jsx_runtime.jsxs)("details", {
					className: ModelsSection_module_css_default["customized"],
					children: [(0, react_jsx_runtime.jsx)("summary", {
						className: ModelsSection_module_css_default["customizedSummary"],
						children: t("customized")
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["customizedBody"],
						children: [
							ownsIdentity ? (0, react_jsx_runtime.jsxs)("div", {
								className: ModelsSection_module_css_default["field"],
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["fieldLabel"],
									children: t("customDisplayName")
								}), (0, react_jsx_runtime.jsx)("input", {
									className: ModelsSection_module_css_default["input"],
									type: "text",
									value: stringAt(draft, "displayName") ?? "",
									placeholder: stringAt(schema.getPath(namespace.base, settingsPath), "displayName") ?? props.provider,
									"aria-label": t("customDisplayName"),
									disabled,
									onChange: (event) => {
										setField("displayName", event.target.value);
									}
								})]
							}) : null,
							(0, react_jsx_runtime.jsxs)("div", {
								className: ModelsSection_module_css_default["field"],
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: ModelsSection_module_css_default["fieldLabel"],
										children: t("baseUrl")
									}),
									(0, react_jsx_runtime.jsx)("input", {
										className: ModelsSection_module_css_default["input"],
										type: "text",
										value: stringAt(draft, "baseURL") ?? "",
										placeholder: family === "deepseek" ? t("deepSeekBaseUrl") : baseURL === void 0 ? t(endpointEnv.length > 0 ? "baseUrlConfigured" : "baseUrlDefault") : t("baseUrlPlaceholder").replace("{url}", () => baseURL),
										"aria-describedby": endpointHint === void 0 ? void 0 : `${props.provider}-endpoint-hint`,
										"aria-label": t("baseUrl"),
										disabled,
										onChange: (event) => {
											setField("baseURL", event.target.value === "" ? void 0 : event.target.value);
										}
									}),
									endpointHint === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
										id: `${props.provider}-endpoint-hint`,
										className: ModelsSection_module_css_default["advancedHint"],
										children: endpointHint
									})
								]
							}),
							ownsIdentity ? (0, react_jsx_runtime.jsxs)("div", {
								className: ModelsSection_module_css_default["field"],
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["fieldLabel"],
									children: t("customApi")
								}), (0, react_jsx_runtime.jsxs)("select", {
									className: `${ModelsSection_module_css_default["input"]} ${ModelsSection_module_css_default["selectInput"]}`,
									value: probeApi ?? "",
									"aria-label": t("customApi"),
									disabled,
									onChange: (event) => {
										setField("api", event.target.value);
									},
									children: [probeApi === void 0 ? (0, react_jsx_runtime.jsx)("option", {
										value: "",
										children: t("customApiUnset")
									}) : null, protocols.map((choice) => (0, react_jsx_runtime.jsx)("option", {
										value: choice,
										children: protocolLabel(t, choice)
									}, choice))]
								})]
							}) : null,
							family === "deepseek" ? (0, react_jsx_runtime.jsx)(DeepSeekModelsEditor, {
								...catalogProps,
								defaultContextWindow: typeof defaultContextWindow === "number" ? defaultContextWindow : void 0,
								defaultMaxTokens: typeof defaultMaxTokens === "number" ? defaultMaxTokens : void 0
							}) : (0, react_jsx_runtime.jsx)(ModelListEditor, {
								...catalogProps,
								catalogProvider: props.declared === true ? void 0 : props.provider,
								reasoningLevels,
								defaultInput: Array.isArray(defaultInput) ? defaultInput : void 0,
								probe,
								probeBlocked: keyFailure,
								operations,
								onBusyChange: setListBusy
							})
						]
					})]
				})] });
			};
			return (0, react_jsx_runtime.jsxs)("div", {
				className: props.credentialOnly === true ? ModelsSection_module_css_default["addBlock"] : ModelsSection_module_css_default["editor"],
				children: [
					props.hideTitle === true ? null : (0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["editorHeader"],
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["editorTitle"],
							children: props.displayName
						}), props.provider !== props.displayName ? (0, react_jsx_runtime.jsx)("span", {
							className: ModelsSection_module_css_default["editorRoute"],
							children: props.provider
						}) : null]
					}),
					layout === "unknown" ? (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["advancedHint"],
						children: `${t("advancedHint")} (${namespace.ns})`
					}) : curatedFields(layout),
					failure !== void 0 ? (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["error"],
						children: failure
					}) : null,
					props.credentialOnly === true || modelFailure === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["advancedHint"],
						children: `${t("model")} ${String(modelFailure.index + 1)}: ${t(modelFailure.key)}`
					}),
					(0, react_jsx_runtime.jsx)(EditorFooter, {
						t,
						busy,
						submitDisabled: disabled || layout === "unknown" || props.credentialOnly !== true && modelFailure !== void 0 || shownKeyFailure !== void 0 || props.credentialRequired === true && keyValue.length === 0,
						submitLabelKey: props.submitLabelKey ?? "apply",
						submitBusyLabelKey: props.submitBusyLabelKey ?? "applying",
						...props.cancelLabelKey === void 0 ? {} : { cancelLabelKey: props.cancelLabelKey },
						onCancel: () => {
							props.onClose(false);
						},
						onSubmit: () => {
							props.onSubmitCredential?.();
							apply();
						}
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/ModelsSection.js
		/**
		* Models settings section: the provider rows joined from the configurable
		* directory, settings namespaces, and credential states, with one editor
		* card at a time. Rows retain the account-first order supplied by the store
		* and expose only confirmed API-key state through accessible
		* solid configured or missing dots. A whole-section provider without a
		* configured key renders as its open setup card instead of a row, but only in
		* the first-run posture — no provider on the page can serve requests yet — and
		* only until the user closes that card. The add flow is one card behind one
		* button: a mode switch chooses between adopting a dormant directory provider
		* (the catalog select over the provider editor) and declaring a custom model
		* API (the create form). A panel mounts the first time its mode is shown and
		* stays mounted, hidden, while the card is open and its mode stays offered,
		* so switching modes discards neither draft and an unvisited mode costs
		* nothing; the switch holds still while either panel has a write or an
		* endpoint interrogation in flight, since a switch underneath one would
		* orphan the answer. Each card kind owns its own open state, so closing one
		* never discards a draft in another. Every
		* mutation writes through the wire, while a provider removal first requires
		* confirmation; the page re-renders from pushed invalidations or the
		* post-apply reload.
		*/
		/** Render an editor for either the setup posture or an expanded provider row. */
		function renderProviderEditor({ target, row, ...props }) {
			return (0, react_jsx_runtime.jsx)(ProviderEditor, {
				provider: target.provider,
				displayName: target.displayName,
				settingsPath: target.settingsPath,
				...target.declared === true ? { declared: true } : {},
				...target.defaultBaseURL === void 0 ? {} : { defaultBaseURL: target.defaultBaseURL },
				...target.baseURLEnv === void 0 ? {} : { baseURLEnv: target.baseURLEnv },
				...target.nativeAuth === void 0 ? {} : { nativeAuth: target.nativeAuth },
				...row.credential === void 0 ? {} : { credential: row.credential },
				...row.credentialChecks === void 0 ? {} : { credentialChecks: row.credentialChecks },
				...props
			});
		}
		/**
		* Remove one user-added provider and its page-managed credential. Credential
		* removal comes first so a second-step failure leaves the provider row visible
		* and the whole operation safely retryable; both unsets are idempotent.
		* The settings removal names the profile rather than rebuilding its whole
		* namespace from a partial view.
		* @param operations - the page's Host operations.
		* @param controller - the page store to refresh.
		* @param target - the provider's settings address and optional managed credential.
		* @returns the failure message, or undefined once the write and reload landed.
		*/
		async function removeProviderProfile(operations, controller, target) {
			if (target.credentialRef !== void 0) {
				const credential = await operations.removeCredential(target.credentialRef);
				if (credential !== void 0) return credential;
			}
			const written = await operations.writeSettings(target.settingsNs, [{
				op: "unset",
				path: [...target.settingsPath]
			}], void 0);
			if (written.kind !== "written") return written.message;
			await controller.load();
		}
		/**
		* Whether a whole-section provider still needs its first key: an unconfigured
		* credential opens the setup card instead of showing a row. This is the
		* first-run posture alone — a user who can already reach some provider gets an
		* ordinary row with the missing-key dot, since nothing here is blocking them.
		* @param row - the joined provider row.
		* @param anyUsable - whether any joined row can already serve requests.
		* @returns whether to render the setup card.
		*/
		function needsSetup(row, anyUsable) {
			if (anyUsable || row.entry.provider === "deepseek-account") return false;
			if (row.entry.settingsPath.length > 0) return false;
			return row.credential?.configured !== true;
		}
		/**
		* The provider-card seat's credential fact: the reference this page would use
		* for the row — the profile's `apiKeyEnv`, or the page's derived
		* `<ROUTE>_API_KEY` while the profile names none — confirmed configured. The
		* derived half is what keeps the seat consistent with the editor on the
		* add-provider draft, whose dormant row names no reference yet.
		*/
		function keyConfiguredOf(row) {
			return row.apiKeyEnv !== void 0 ? row.credential?.configured === true : row.derivedCredential?.configured === true;
		}
		function targetOf(row) {
			const managedRef = deriveKeyRef(row.entry.provider);
			const credentialRef = row.apiKeyEnv === managedRef && row.credential?.configured === true && row.credential.writable ? managedRef : void 0;
			return {
				provider: row.entry.provider,
				displayName: row.entry.displayName,
				settingsNs: row.entry.settingsNs,
				settingsPath: row.entry.settingsPath,
				...credentialRef === void 0 ? {} : { credentialRef },
				...row.entry.declared === true ? { declared: true } : {},
				...row.entry.defaultBaseURL === void 0 ? {} : { defaultBaseURL: row.entry.defaultBaseURL },
				...row.entry.baseURLEnv === void 0 ? {} : { baseURLEnv: row.entry.baseURLEnv },
				...row.entry.nativeAuth === void 0 ? {} : { nativeAuth: row.entry.nativeAuth }
			};
		}
		/** Stable visible and accessible identity for one provider target. */
		function providerTargetLabel(target) {
			return target.provider === target.displayName ? target.provider : `${target.displayName} (${target.provider})`;
		}
		/** Replace the one provider placeholder in localized destructive-action copy. */
		function providerCopy(template, target) {
			return template.replace("{provider}", () => providerTargetLabel(target));
		}
		/**
		* Render the Models section content column.
		* @param props - slot-delivered injected dependencies.
		* @returns the section, or null while the shell has not injected yet.
		*/
		function ModelsSection(props) {
			const { controller, useSnapshot, operations, schema, t, renderSlot } = props;
			if (controller === void 0 || useSnapshot === void 0 || operations === void 0 || schema === void 0 || t === void 0) return null;
			return (0, react_jsx_runtime.jsx)(Loaded, {
				injected: {
					controller,
					useSnapshot,
					operations,
					schema,
					t
				},
				renderSlot
			});
		}
		function Loaded({ injected, renderSlot }) {
			const { controller, operations, schema, t } = injected;
			const snapshot = injected.useSnapshot((value) => value);
			const state = {
				...snapshot,
				rows: snapshot.rows.map((row) => row.entry.provider === "deepseek-account" ? {
					...row,
					entry: {
						...row.entry,
						displayName: t("deepSeekAccount")
					}
				} : row)
			};
			/** A new or failed surface waits for a current snapshot; background refreshes preserve its drafts. */
			const [hasReadySnapshot, setHasReadySnapshot] = (0, react.useState)(state.status === "ready");
			if (state.status === "ready" && !hasReadySnapshot) setHasReadySnapshot(true);
			if (state.status === "error" && hasReadySnapshot) setHasReadySnapshot(false);
			const [editing, setEditing] = (0, react.useState)(void 0);
			const [addOpen, setAddOpen] = (0, react.useState)(false);
			const [addMode, setAddMode] = (0, react.useState)("catalog");
			/** The modes shown since the add card opened; each keeps its panel mounted. */
			const [visited, setVisited] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			/** Whether each add panel has a write or an interrogation in flight. */
			const [catalogBusy, setCatalogBusy] = (0, react.useState)(false);
			const [customBusy, setCustomBusy] = (0, react.useState)(false);
			/** Base of the add card's tab and panel ids. */
			const addId = (0, react.useId)();
			const [deleteTarget, setDeleteTarget] = (0, react.useState)(void 0);
			const [deleting, setDeleting] = (0, react.useState)(false);
			const [deleteFailure, setDeleteFailure] = (0, react.useState)(void 0);
			const [savedTarget, setSavedTarget] = (0, react.useState)(void 0);
			const [dismissedSetup, setDismissedSetup] = (0, react.useState)(() => /* @__PURE__ */ new Set());
			const announceSaved = (target) => {
				controller.load().then(() => {
					setSavedTarget(target);
				});
			};
			/**
			* Close the add card whole. The catalog target is forgotten with it, since
			* `editing` doubles as the row editor's target once the card is closed and a
			* refresh could otherwise open the row of a provider the draft never saved.
			* The busy flags reset here because a panel that closes itself on success
			* unmounts before it can report idle.
			*/
			const closeAdd = () => {
				setEditing(void 0);
				setAddOpen(false);
				setCatalogBusy(false);
				setCustomBusy(false);
			};
			const closeEditor = (changed, target) => {
				closeAdd();
				if (changed) announceSaved(target);
			};
			/**
			* Close a setup card, which owns none of the state above: the row-editor
			* and add cards each own one of those, so clearing them here would discard
			* a draft the user opened beside this card. Dismissal is this card's own —
			* the provider falls back to an ordinary row for the rest of the session,
			* and reopens through Edit.
			*/
			const closeSetup = (changed, target) => {
				setDismissedSetup((previous) => new Set([...previous, target.provider]));
export {};
