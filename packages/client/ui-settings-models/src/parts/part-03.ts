/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
						onClick: () => {
							props.onChange([...props.models.map((model) => ({ ...model })), { id: "" }]);
						},
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }), props.t("addModel")]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/ModelListEditor.js
		/**
		* The model list of one pi-ai provider profile, plus the action that asks the
		* provider what it serves.
		*
		* The list is the profile's `models` array as the card holds it: an empty list
		* means "serve this route's built-in catalog", and any entry replaces that
		* catalog, so a row is only ever added deliberately. Fetching asks the endpoint
		* **the form currently shows** — including a key typed but not yet saved — so
		* adding a provider is one pass instead of save-then-return; the reply is
		* candidates the user picks from, never configuration written behind them.
		*
		* A provider that cannot be interrogated (an unreachable endpoint, a protocol
		* with no readable listing) is not a dead end: the failure is shown next to the
		* rows the user can still fill in by hand.
		*/
		/** A row's text field, or the empty string when unset or not a string. */
		function textOf(model, key) {
			const value = model[key];
			return typeof value === "string" ? value : "";
		}
		/** A row's numeric field, or `undefined` when unset or not a number. */
		function numberOf(model, key) {
			const value = model[key];
			return typeof value === "number" ? value : void 0;
		}
		/**
		* What an empty capacity field is worth, shown as its placeholder so a row left
		* blank does not read as a model with no capacity at all.
		*
		* The magnitudes are the adapter's own route-level fallbacks (`llm-pi-ai`'s
		* `defaultContextWindow` and `defaultMaxTokens`), spelled the way a person
		* would say them. They are a hint, not a mirror: this page counts `K` as 1000,
		* so typing `256K` stores 256000 while leaving the field blank keeps the
		* adapter's 262144. A deployment that overrides those defaults is not
		* reflected here — nothing on this page can read them.
		*/
		const CAPACITY_HINT = {
			contextWindow: "256K",
			maxTokens: "32K"
		};
		/**
		* Spell a stored count for a field that may be unset. The spelling itself is
		* {@link formatCapacity}, shared with the DeepSeek catalog editor so both
		* surfaces read and write one K/M vocabulary.
		* @param value - stored capacity, or `undefined` for an unset field.
		* @returns the field text, empty when unset.
		*/
		function capacitySpelling(value) {
			return value === void 0 ? "" : formatCapacity(value);
		}
		/** Adopt a candidate, preserving disclosed capacities and input types. */
		function adopt(candidate) {
			return {
				id: candidate.id,
				...candidate.name === void 0 ? {} : { name: candidate.name },
				...candidate.contextWindow === void 0 ? {} : { contextWindow: candidate.contextWindow },
				...candidate.maxTokens === void 0 ? {} : { maxTokens: candidate.maxTokens },
				...candidate.inputModalities === void 0 ? {} : { input: [...candidate.inputModalities] }
			};
		}
		/**
		* Render the model list with its fetch action.
		* @param props - the drafted rows, probe target, wire face, and copy.
		* @returns the model-list editor.
		*/
		function ModelListEditor(props) {
			const { models, onChange, probe, operations, t, disabled, onBusyChange } = props;
			const { catalogProvider } = props;
			const [busy, setBusy] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				onBusyChange(busy);
			}, [busy, onBusyChange]);
			const [failure, setFailure] = (0, react.useState)(void 0);
			const [inheritedCatalog, setInheritedCatalog] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				if (catalogProvider === void 0) return;
				let current = true;
				operations.discoverModels(probe.settingsNs, { provider: catalogProvider }).then((answer) => {
					if (!current) return;
					setInheritedCatalog({
						provider: catalogProvider,
						models: answer.kind === "found" ? answer.models : []
					});
					setFailure(answer.kind === "refused" ? answer.message : void 0);
				});
				return () => {
					current = false;
				};
			}, [
				catalogProvider,
				operations,
				probe.settingsNs
			]);
			const catalog = inheritedCatalog?.provider === catalogProvider ? inheritedCatalog?.models : void 0;
			const inputDefaults = (0, react.useMemo)(() => new Map(catalog?.map((model) => [model.id, model.inputModalities])), [catalog]);
			const [candidates, setCandidates] = (0, react.useState)(void 0);
			const [picked, setPicked] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [candidateQuery, setCandidateQuery] = (0, react.useState)("");
			const [expanded, setExpanded] = (0, react.useState)(/* @__PURE__ */ new Set());
			const [editing, setEditing] = (0, react.useState)(/* @__PURE__ */ new Map());
			/** Buffer key for one capacity field; the row half moves when rows do. */
			const bufferKey = (index, field) => `${String(index)}:${field}`;
			const editCapacity = (index, field, text) => {
				setEditing((current) => new Map(current).set(bufferKey(index, field), text));
				patch(index, { [field]: parseCapacity(text) });
			};
			/** What a capacity field shows: the buffer while typing, else the stored count. */
			const capacityText = (model, index, field) => editing.get(bufferKey(index, field)) ?? capacitySpelling(numberOf(model, field));
			/** Drop one row's entries and shift the rows after it down, in one pass. */
			const reindexOnRemove = (current, index) => {
				const next = /* @__PURE__ */ new Map();
				for (const [key, value] of current) {
					const at = Number(key.slice(0, key.indexOf(":")));
					if (at === index) continue;
					next.set(at > index ? key.replace(/^\d+/, String(at - 1)) : key, value);
				}
				return next;
			};
			const toggleExpanded = (index) => {
				setExpanded((current) => {
					const next = new Set(current);
					if (!next.delete(index)) next.add(index);
					return next;
				});
			};
			const patch = (index, next) => {
				onChange(models.map((model, at) => {
					if (at !== index) return model;
					const cleared = new Set(Object.entries(next).filter(([, value]) => value === void 0 || value === "").map(([key]) => key));
					return Object.fromEntries(Object.entries({
						...model,
						...next
					}).filter(([key]) => !cleared.has(key)));
				}));
			};
			const fetchModels = async () => {
				setBusy(true);
				setFailure(void 0);
				try {
					const answer = await operations.discoverModels(probe.settingsNs, {
						...probe.provider === void 0 ? {} : { provider: probe.provider },
						...probe.baseURL === void 0 || probe.baseURL.length === 0 ? {} : { baseURL: probe.baseURL },
						...probe.api === void 0 ? {} : { api: probe.api },
						...probe.apiKey === void 0 ? {} : { apiKey: probe.apiKey }
					});
					if (answer.kind === "refused") {
						setFailure(answer.message);
						return;
					}
					const found = answer.models;
					if (catalogProvider !== void 0) setInheritedCatalog({
						provider: catalogProvider,
						models: found
					});
					if (found.length === 0) {
						setFailure(t("fetchEmpty"));
						return;
					}
					const known = new Set(models.map((model) => textOf(model, "id")));
					setCandidateQuery("");
					setCandidates(found);
					setPicked(new Set(found.filter((model) => !known.has(model.id)).map((model) => model.id)));
				} finally {
					setBusy(false);
				}
			};
			const closePicker = () => {
				setCandidates(void 0);
				setPicked(/* @__PURE__ */ new Set());
				setCandidateQuery("");
			};
			const adoptPicked = () => {
				/* v8 ignore next -- the dialog only renders with candidates loaded */
				if (candidates === void 0) return;
				const byId = new Map(models.map((model) => [textOf(model, "id"), model]));
				for (const candidate of candidates) {
					if (!picked.has(candidate.id)) continue;
					byId.set(candidate.id, byId.get(candidate.id) ?? adopt(candidate));
				}
				onChange([...byId.values()]);
				closePicker();
			};
			const toggle = (id) => {
				setPicked((current) => {
					const next = new Set(current);
					if (!next.delete(id)) next.add(id);
					return next;
				});
			};
			const activeCandidates = candidates ?? [];
			const normalizedCandidateQuery = candidateQuery.trim().toLowerCase();
			const visibleCandidates = normalizedCandidateQuery.length === 0 ? activeCandidates : activeCandidates.filter((candidate) => candidate.id.toLowerCase().includes(normalizedCandidateQuery) || candidate.name?.toLowerCase().includes(normalizedCandidateQuery) === true);
			const allVisibleCandidatesPicked = visibleCandidates.length > 0 && visibleCandidates.every((candidate) => picked.has(candidate.id));
			const toggleVisibleCandidates = () => {
				setPicked((current) => {
					if (visibleCandidates.every((candidate) => current.has(candidate.id))) return /* @__PURE__ */ new Set();
					const next = new Set(current);
					for (const candidate of visibleCandidates) next.add(candidate.id);
					return next;
				});
			};
			const askable = probe.provider !== void 0 || probe.baseURL !== void 0 && probe.baseURL.length > 0;
			return (0, react_jsx_runtime.jsxs)("section", {
				className: ModelsSection_module_css_default["modelCatalog"],
				"aria-label": t("models"),
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: ModelsSection_module_css_default["modelListHead"],
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: ModelsSection_module_css_default["modelCatalogHeading"],
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["modelCatalogTitle"],
									children: t("models")
								}), props.overridden === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
									className: ModelsSection_module_css_default["modelCatalogMeta"],
									children: props.overridden ? t("modelsCustomized") : t("modelsInherited")
								})]
							}),
							props.overridden === true && props.onReset !== void 0 ? (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ModelsSection_module_css_default["linkButton"],
								disabled,
								onClick: props.onReset,
								children: t("resetModels")
							}) : null,
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ModelsSection_module_css_default["linkButton"],
								disabled: disabled || busy || !askable || props.probeBlocked !== void 0,
								title: props.probeBlocked !== void 0 ? t(props.probeBlocked) : askable ? void 0 : t("fetchNeedsBaseUrl"),
								onClick: () => {
									fetchModels();
								},
								children: busy ? t("fetching") : t("fetchModels")
							})
						]
					}),
					models.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["modelEmpty"],
						children: t("modelsEmpty")
					}) : null,
					(0, react_jsx_runtime.jsx)("div", {
						className: ModelsSection_module_css_default["modelList"],
						children: models.map((model, index) => (0, react_jsx_runtime.jsx)(ModelRow, {
							model,
							position: index + 1,
							inputField: "input",
							inputFallback: inputDefaults.get(textOf(model, "id")) ?? props.defaultInput,
							inputLoading: catalogProvider !== void 0 && catalog === void 0,
							reasoningLevels: props.reasoningLevels,
							expanded: expanded.has(index),
							disabled,
							t,
							contextWindow: {
								value: capacityText(model, index, "contextWindow"),
								placeholder: CAPACITY_HINT.contextWindow,
								onChange: (text) => {
									editCapacity(index, "contextWindow", text);
								}
							},
							maxTokens: {
								value: capacityText(model, index, "maxTokens"),
								placeholder: CAPACITY_HINT.maxTokens,
								onChange: (text) => {
									editCapacity(index, "maxTokens", text);
								}
							},
							onFieldChange: (field, value) => {
								patch(index, { [field]: value });
							},
							onChange: (next) => {
								onChange(models.map((row, at) => at === index ? next : row));
							},
							onToggle: () => {
								toggleExpanded(index);
							},
							onRemove: () => {
								onChange(models.filter((_model, at) => at !== index));
								setExpanded((current) => {
									const next = /* @__PURE__ */ new Set();
									for (const at of current) if (at < index) next.add(at);
									else if (at > index) next.add(at - 1);
									return next;
								});
								setEditing((current) => reindexOnRemove(current, index));
							}
						}, index))
					}),
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: ModelsSection_module_css_default["addModelButton"],
						disabled,
						onClick: () => {
							onChange([...models, { id: "" }]);
						},
						children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }), t("addModel")]
					}),
					failure !== void 0 ? (0, react_jsx_runtime.jsx)("p", {
						className: ModelsSection_module_css_default["error"],
						children: failure
					}) : null,
					(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
						open: candidates !== void 0,
						onClose: closePicker,
						title: t("fetchTitle"),
						closeLabel: t("close"),
						description: t("fetchDescription"),
						className: ModelsSection_module_css_default["fetchDialog"],
						footer: (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: closePicker,
							children: t("cancel")
						}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
							variant: "outline",
							onClick: adoptPicked,
							children: t("fetchAdopt")
						})] }),
						children: [(0, react_jsx_runtime.jsxs)("div", {
							className: ModelsSection_module_css_default["candidateToolbar"],
							children: [(0, react_jsx_runtime.jsx)("input", {
								className: `${ModelsSection_module_css_default["input"]} ${ModelsSection_module_css_default["candidateSearch"]}`,
								type: "search",
								value: candidateQuery,
								placeholder: t("fetchSearch"),
								"aria-label": t("fetchSearch"),
								onChange: (event) => {
									setCandidateQuery(event.target.value);
								}
							}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
								variant: "ghost",
								size: "sm",
								disabled: visibleCandidates.length === 0,
								onClick: toggleVisibleCandidates,
								children: t(allVisibleCandidatesPicked ? "fetchDeselectAll" : "fetchSelectAll")
							})]
						}), visibleCandidates.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
							className: ModelsSection_module_css_default["candidateEmpty"],
							role: "status",
							children: t("fetchNoMatches")
						}) : (0, react_jsx_runtime.jsx)("ul", {
							className: ModelsSection_module_css_default["candidateList"],
							children: visibleCandidates.map((candidate) => (0, react_jsx_runtime.jsx)("li", {
								className: ModelsSection_module_css_default["candidate"],
								children: (0, react_jsx_runtime.jsxs)("label", {
									className: ModelsSection_module_css_default["candidateLabel"],
									children: [(0, react_jsx_runtime.jsx)("input", {
										type: "checkbox",
										checked: picked.has(candidate.id),
										onChange: () => {
											toggle(candidate.id);
										}
									}), (0, react_jsx_runtime.jsx)("span", {
										className: ModelsSection_module_css_default["candidateId"],
										title: candidate.name ?? candidate.id,
										children: candidate.id
									})]
								})
							}, candidate.id))
						})]
					})
				]
			});
		}
		//#endregion
		//#region lib/types/client/store.js
		/**
		* Models settings page store: one snapshot joining the configurable-provider
		* directory (`llm/listProviders` joined with `llm/listConfigurableProviders`),
		* the settings namespaces (shared settings mirror),
		* and the referenced credentials (`credentials/describe`). The host stays the
		* single fact source — every mutation writes through the wire and the page
		* re-renders from the next describe, pushed or refetched.
		*/
		/**
		* Any route key walks a dict schema to the same profile node, so the lookup
		* names one that cannot collide with a configured route.
		*/
		const PROBE_ROUTE = "\0probe";
		/**
		* Join declared configurable providers with the currently registered routes.
		* @param registered - live provider routes in registration order.
		* @param directory - declared configurable providers in declaration order.
		* @returns account and official routes first, then other routes in their original order.
		*/
		function joinProviderDirectory(registered, directory) {
			const active = new Set(registered.map((provider) => provider.id));
			const declared = new Set(directory.map((entry) => entry.provider));
			const rows = directory.map((entry) => ({
				provider: entry.provider,
export {};
