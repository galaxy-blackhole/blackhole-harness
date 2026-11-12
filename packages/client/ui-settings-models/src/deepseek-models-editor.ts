/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Trinh sua danh sach model cua DeepSeek
 */

import * as reactModule from "react";
import * as jsxRuntimeModule from "react/jsx-runtime";
import * as primitivesModule from "@galaxy-blackhole/gbh-client-ui-primitives";
import { ModelRow } from "./model-row.ts";
import { CSS_SECTION } from "./styles.ts";

/** Namespace React cua bang module (khai long de giu nguyen dang ma cua ban goc). */
const react: any = reactModule;
/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;
/** Nguyen thu giao dien dung chung cua DSH. */
const _deepseek_ai_dsh_client_ui_primitives: any = primitivesModule;

/**
* Curated editor for the direct DeepSeek adapter's advisory model catalog.
* The settings layer replaces `models` as one array, so the parent supplies
* the effective inherited rows until the first edit materializes a user
* override; reset removes that override instead of copying defaults into it.
*/
/** Row index encoded in an editing-buffer key. */
function rowOf(key: any) {
	return Number(key.slice(0, key.indexOf(":")));
}
/** Accepted capacity spellings: a decimal count with an optional K/M suffix. */
const CAPACITY_PATTERN = /^(\d+(?:\.\d+)?)([km])?$/i;
/** Decimal suffix scales — `1M` is 1000K, matching how model capacities are quoted. */
const CAPACITY_SCALE = {
	k: 1e3,
	m: 1e6
};
/**
* Read a typed capacity, so a user can write `256K` or `1M` instead of counting
* zeroes. The stored value stays a plain token count.
* @param text - raw field text.
* @returns the count; `undefined` when blank (inherit), `NaN` when unreadable
* (rejected by {@link validateDeepSeekModels} before any write).
*/
export function parseCapacity(text: any) {
	const trimmed = text.trim();
	if (trimmed.length === 0) return void 0;
	const match = CAPACITY_PATTERN.exec(trimmed);
	if (match === null) return NaN;
	const suffix = match[2]?.toLowerCase();
	const scale = suffix === "k" || suffix === "m" ? CAPACITY_SCALE[suffix] : 1;
	const scaled = Number(match[1]) * scale;
	const rounded = Math.round(scaled);
	return Math.abs(scaled - rounded) < 1e-6 ? rounded : scaled;
}
/**
* Spell a stored count back in the shortest form that survives a round trip
* through {@link parseCapacity}; a count that is not a whole number of
* thousands stays written out.
* @param value - stored capacity.
* @returns the field text.
*/
export function formatCapacity(value: any) {
	if (!Number.isInteger(value) || value <= 0) return String(value);
	if (value % CAPACITY_SCALE.m === 0) return `${String(value / CAPACITY_SCALE.m)}M`;
	if (value % CAPACITY_SCALE.k === 0) return `${String(value / CAPACITY_SCALE.k)}K`;
	return String(value);
}
/** Convert a schema-validated catalog value into records without dropping hidden fields. */
export function modelDrafts(value: any) {
	if (!Array.isArray(value)) return [];
	return value.map((entry) => typeof entry === "object" && entry !== null && !Array.isArray(entry) ? entry : {});
}
/**
* Validate adapter constraints that the serialized schema cannot express.
* @param value - user-owned `models` value, or undefined while inherited.
* @returns the first invalid row, or undefined when the adapter will accept it.
*/
export function validateDeepSeekModels(value: any) {
	if (value === void 0) return void 0;
	const models = modelDrafts(value);
	const seen = /* @__PURE__ */ new Set();
	for (const [index, model] of models.entries()) {
		const id = model["id"];
		const trimmed = typeof id === "string" ? id.trim() : void 0;
		if (trimmed === void 0 || trimmed.length === 0) return {
			index,
			key: "modelIdRequired"
		};
		if (seen.has(trimmed)) return {
			index,
			key: "modelIdDuplicate"
		};
		seen.add(trimmed);
		const name = model["name"];
		if (name !== void 0 && (typeof name !== "string" || name.length === 0)) return {
			index,
			key: "modelNameInvalid"
		};
		const contextWindow = model["contextWindow"];
		if (contextWindow !== void 0 && (typeof contextWindow !== "number" || !Number.isInteger(contextWindow) || contextWindow <= 0)) return {
			index,
			key: "modelContextInvalid"
		};
		const maxTokens = model["maxTokens"];
		if (maxTokens !== void 0 && (typeof maxTokens !== "number" || !Number.isInteger(maxTokens) || maxTokens <= 0)) return {
			index,
			key: "modelMaxTokensInvalid"
		};
	}
}
/**
* Render the direct DeepSeek adapter's model catalog: id and display name on
* each row, capacities and input types behind the row's own disclosure.
* @param props - effective rows plus the array-level override actions.
* @returns the catalog editor.
*/
export function DeepSeekModelsEditor(props: any) {
	const [editing, setEditing] = (0, react.useState)(() => /* @__PURE__ */ new Map());
	const [expanded, setExpanded] = (0, react.useState)(() => /* @__PURE__ */ new Set());
	const update = (index: any, key: any, value: any) => {
		const next = props.models.map((model: any, at: any) => {
			const copy = { ...model };
			if (at !== index) return copy;
			if (value === void 0) Reflect.deleteProperty(copy, key);
			else copy[key] = value;
			return copy;
		});
		props.onChange(next);
	};
	const remove = (index: any) => {
		setEditing((current: any) => {
			const next = /* @__PURE__ */ new Map();
			for (const [key, text] of current) {
				const at = rowOf(key);
				if (at === index) continue;
				next.set(at > index ? key.replace(/^\d+/, String(at - 1)) : key, text);
			}
			return next;
		});
		setExpanded((current: any) => {
			const next = /* @__PURE__ */ new Set();
			for (const at of current) {
				if (at === index) continue;
				next.add(at > index ? at - 1 : at);
			}
			return next;
		});
		props.onChange(props.models.filter((_model: any, at: any) => at !== index).map((model: any) => ({ ...model })));
	};
	const reset = () => {
		setEditing(/* @__PURE__ */ new Map());
		setExpanded(/* @__PURE__ */ new Set());
		props.onReset();
	};
	const toggle = (index: any) => {
		setExpanded((current: any) => {
			const next = new Set(current);
			if (!next.delete(index)) next.add(index);
			return next;
		});
	};
	/** The field's text: its live keystrokes, else the stored count spelled short. */
	const capacityText = (model: any, index: any, field: any) => {
		const typed = editing.get(`${String(index)}:${field}`);
		if (typed !== void 0) return typed;
		const value = model[field];
		return typeof value === "number" ? formatCapacity(value) : "";
	};
	const settleCapacity = (index: any, field: any) => {
		const key = `${String(index)}:${field}`;
		const typed = editing.get(key);
		if (typed === void 0) return;
		const parsed = parseCapacity(typed);
		if (parsed !== void 0 && Number.isNaN(parsed)) return;
		setEditing((current: any) => {
			const next = new Map(current);
			next.delete(key);
			return next;
		});
	};
	const capacityInput = (model: any, index: any, field: any, fallback: any) => ({
		value: capacityText(model, index, field),
		placeholder: fallback === void 0 ? props.t(field === "contextWindow" ? "contextWindowPlaceholder" : "maxTokensPlaceholder") : formatCapacity(fallback),
		onChange: (text: any) => {
			setEditing((current: any) => new Map(current).set(`${String(index)}:${field}`, text));
			update(index, field, parseCapacity(text));
		},
		onBlur: () => {
			settleCapacity(index, field);
		}
	});
	return (0, react_jsx_runtime.jsxs)("section", {
		className: CSS_SECTION["modelCatalog"],
		"aria-label": props.t("models"),
		children: [
			(0, react_jsx_runtime.jsxs)("div", {
				className: CSS_SECTION["modelListHead"],
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: CSS_SECTION["modelCatalogHeading"],
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: CSS_SECTION["modelCatalogTitle"],
						children: props.t("models")
					}), (0, react_jsx_runtime.jsx)("span", {
						className: CSS_SECTION["modelCatalogMeta"],
						children: props.overridden ? props.t("modelsCustomized") : props.t("modelsInherited")
					})]
				}), props.overridden ? (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: CSS_SECTION["linkButton"],
					disabled: props.disabled,
					onClick: reset,
					children: props.t("resetModels")
				}) : null]
			}),
			props.models.length === 0 ? (0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["modelEmpty"],
				children: props.t("modelsEmpty")
			}) : (0, react_jsx_runtime.jsx)("div", {
				className: CSS_SECTION["modelList"],
				children: props.models.map((model: any, index: any) => (0, react_jsx_runtime.jsx)(ModelRow, {
					model,
					position: index + 1,
					inputField: "inputModalities",
					expanded: expanded.has(index),
					disabled: props.disabled,
					t: props.t,
					contextWindow: capacityInput(model, index, "contextWindow", props.defaultContextWindow),
					maxTokens: capacityInput(model, index, "maxTokens", props.defaultMaxTokens),
					onFieldChange: (field: any, value: any) => {
						update(index, field, value);
					},
					onIdBlur: (value: any) => {
						const trimmed = value.trim();
						if (trimmed !== value) update(index, "id", trimmed);
					},
					onChange: (next: any) => {
						props.onChange(props.models.map((row: any, at: any) => at === index ? next : row));
					},
					onToggle: () => {
						toggle(index);
					},
					onRemove: () => {
						remove(index);
					}
				}, index))
			}),
			(0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: CSS_SECTION["addModelButton"],
				disabled: props.disabled,
				onClick: () => {
					props.onChange([...props.models.map((model: any) => ({ ...model })), { id: "" }]);
				},
				children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }), props.t("addModel")]
			})
		]
	});
}
