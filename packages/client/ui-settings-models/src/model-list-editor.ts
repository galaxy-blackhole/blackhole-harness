/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Trinh sua danh sach model dung chung
 */

import * as reactModule from "react";
import * as jsxRuntimeModule from "react/jsx-runtime";
import * as primitivesModule from "@galaxy-blackhole/gbh-client-ui-primitives";
import { ModelRow } from "./model-row.ts";
import { parseCapacity } from "./deepseek-models-editor.ts";
import { formatCapacity } from "./deepseek-models-editor.ts";
import { CSS_SECTION } from "./styles.ts";

/** Namespace React cua bang module (khai long de giu nguyen dang ma cua ban goc). */
const react: any = reactModule;
/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;
/** Nguyen thu giao dien dung chung cua DSH. */
const _deepseek_ai_dsh_client_ui_primitives: any = primitivesModule;

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
function textOf(model: any, key: any) {
	const value = model[key];
	return typeof value === "string" ? value : "";
}
/** A row's numeric field, or `undefined` when unset or not a number. */
function numberOf(model: any, key: any) {
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
function capacitySpelling(value: any) {
	return value === void 0 ? "" : formatCapacity(value);
}
/** Adopt a candidate, preserving disclosed capacities and input types. */
function adopt(candidate: any) {
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
export function ModelListEditor(props: any) {
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
		operations.discoverModels(probe.settingsNs, { provider: catalogProvider }).then((answer: any) => {
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
	const inputDefaults = (0, react.useMemo)(() => new Map(catalog?.map((model: any) => [model.id, model.inputModalities])), [catalog]);
	const [candidates, setCandidates] = (0, react.useState)(void 0);
	const [picked, setPicked] = (0, react.useState)(/* @__PURE__ */ new Set());
	const [candidateQuery, setCandidateQuery] = (0, react.useState)("");
	const [expanded, setExpanded] = (0, react.useState)(/* @__PURE__ */ new Set());
	const [editing, setEditing] = (0, react.useState)(/* @__PURE__ */ new Map());
	/** Buffer key for one capacity field; the row half moves when rows do. */
	const bufferKey = (index: any, field: any) => `${String(index)}:${field}`;
	const editCapacity = (index: any, field: any, text: any) => {
		setEditing((current: any) => new Map(current).set(bufferKey(index, field), text));
		patch(index, { [field]: parseCapacity(text) });
	};
	/** What a capacity field shows: the buffer while typing, else the stored count. */
	const capacityText = (model: any, index: any, field: any) => editing.get(bufferKey(index, field)) ?? capacitySpelling(numberOf(model, field));
	/** Drop one row's entries and shift the rows after it down, in one pass. */
	const reindexOnRemove = (current: any, index: any) => {
		const next = /* @__PURE__ */ new Map();
		for (const [key, value] of current) {
			const at = Number(key.slice(0, key.indexOf(":")));
			if (at === index) continue;
			next.set(at > index ? key.replace(/^\d+/, String(at - 1)) : key, value);
		}
		return next;
	};
	const toggleExpanded = (index: any) => {
		setExpanded((current: any) => {
			const next = new Set(current);
			if (!next.delete(index)) next.add(index);
			return next;
		});
	};
	const patch = (index: any, next: any) => {
		onChange(models.map((model: any, at: any) => {
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
			const known = new Set(models.map((model: any) => textOf(model, "id")));
			setCandidateQuery("");
			setCandidates(found);
			setPicked(new Set(found.filter((model: any) => !known.has(model.id)).map((model: any) => model.id)));
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
		const byId = new Map(models.map((model: any) => [textOf(model, "id"), model]));
		for (const candidate of candidates) {
			if (!picked.has(candidate.id)) continue;
			byId.set(candidate.id, byId.get(candidate.id) ?? adopt(candidate));
		}
		onChange([...byId.values()]);
		closePicker();
	};
	const toggle = (id: any) => {
		setPicked((current: any) => {
			const next = new Set(current);
			if (!next.delete(id)) next.add(id);
			return next;
		});
	};
	const activeCandidates = candidates ?? [];
	const normalizedCandidateQuery = candidateQuery.trim().toLowerCase();
	const visibleCandidates = normalizedCandidateQuery.length === 0 ? activeCandidates : activeCandidates.filter((candidate: any) => candidate.id.toLowerCase().includes(normalizedCandidateQuery) || candidate.name?.toLowerCase().includes(normalizedCandidateQuery) === true);
	const allVisibleCandidatesPicked = visibleCandidates.length > 0 && visibleCandidates.every((candidate: any) => picked.has(candidate.id));
	const toggleVisibleCandidates = () => {
		setPicked((current: any) => {
			if (visibleCandidates.every((candidate: any) => current.has(candidate.id))) return /* @__PURE__ */ new Set();
			const next = new Set(current);
			for (const candidate of visibleCandidates) next.add(candidate.id);
			return next;
		});
	};
	const askable = probe.provider !== void 0 || probe.baseURL !== void 0 && probe.baseURL.length > 0;
	return (0, react_jsx_runtime.jsxs)("section", {
		className: CSS_SECTION["modelCatalog"],
		"aria-label": t("models"),
		children: [
			(0, react_jsx_runtime.jsxs)("div", {
				className: CSS_SECTION["modelListHead"],
				children: [
					(0, react_jsx_runtime.jsxs)("div", {
						className: CSS_SECTION["modelCatalogHeading"],
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: CSS_SECTION["modelCatalogTitle"],
							children: t("models")
						}), props.overridden === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
							className: CSS_SECTION["modelCatalogMeta"],
							children: props.overridden ? t("modelsCustomized") : t("modelsInherited")
						})]
					}),
					props.overridden === true && props.onReset !== void 0 ? (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: CSS_SECTION["linkButton"],
						disabled,
						onClick: props.onReset,
						children: t("resetModels")
					}) : null,
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: CSS_SECTION["linkButton"],
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
				className: CSS_SECTION["modelEmpty"],
				children: t("modelsEmpty")
			}) : null,
			(0, react_jsx_runtime.jsx)("div", {
				className: CSS_SECTION["modelList"],
				children: models.map((model: any, index: any) => (0, react_jsx_runtime.jsx)(ModelRow, {
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
						onChange: (text: any) => {
							editCapacity(index, "contextWindow", text);
						}
					},
					maxTokens: {
						value: capacityText(model, index, "maxTokens"),
						placeholder: CAPACITY_HINT.maxTokens,
						onChange: (text: any) => {
							editCapacity(index, "maxTokens", text);
						}
					},
					onFieldChange: (field: any, value: any) => {
						patch(index, { [field]: value });
					},
					onChange: (next: any) => {
						onChange(models.map((row: any, at: any) => at === index ? next : row));
					},
					onToggle: () => {
						toggleExpanded(index);
					},
					onRemove: () => {
						onChange(models.filter((_model: any, at: any) => at !== index));
						setExpanded((current: any) => {
							const next = /* @__PURE__ */ new Set();
							for (const at of current) if (at < index) next.add(at);
							else if (at > index) next.add(at - 1);
							return next;
						});
						setEditing((current: any) => reindexOnRemove(current, index));
					}
				}, index))
			}),
			(0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: CSS_SECTION["addModelButton"],
				disabled,
				onClick: () => {
					onChange([...models, { id: "" }]);
				},
				children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }), t("addModel")]
			}),
			failure !== void 0 ? (0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["error"],
				children: failure
			}) : null,
			(0, react_jsx_runtime.jsxs)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
				open: candidates !== void 0,
				onClose: closePicker,
				title: t("fetchTitle"),
				closeLabel: t("close"),
				description: t("fetchDescription"),
				className: CSS_SECTION["fetchDialog"],
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
					className: CSS_SECTION["candidateToolbar"],
					children: [(0, react_jsx_runtime.jsx)("input", {
						className: `${CSS_SECTION["input"]} ${CSS_SECTION["candidateSearch"]}`,
						type: "search",
						value: candidateQuery,
						placeholder: t("fetchSearch"),
						"aria-label": t("fetchSearch"),
						onChange: (event: any) => {
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
					className: CSS_SECTION["candidateEmpty"],
					role: "status",
					children: t("fetchNoMatches")
				}) : (0, react_jsx_runtime.jsx)("ul", {
					className: CSS_SECTION["candidateList"],
					children: visibleCandidates.map((candidate: any) => (0, react_jsx_runtime.jsx)("li", {
						className: CSS_SECTION["candidate"],
						children: (0, react_jsx_runtime.jsxs)("label", {
							className: CSS_SECTION["candidateLabel"],
							children: [(0, react_jsx_runtime.jsx)("input", {
								type: "checkbox",
								checked: picked.has(candidate.id),
								onChange: () => {
									toggle(candidate.id);
								}
							}), (0, react_jsx_runtime.jsx)("span", {
								className: CSS_SECTION["candidateId"],
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
