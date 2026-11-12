/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bang muc do suy luan cua mot model
 */

import * as reactModule from "react";
import * as jsxRuntimeModule from "react/jsx-runtime";
import * as primitivesModule from "@galaxy-blackhole/gbh-client-ui-primitives";
import { modelDrafts } from "./deepseek-models-editor.ts";
import { CSS_SECTION } from "./styles.ts";

/** Namespace React cua bang module (khai long de giu nguyen dang ma cua ban goc). */
const react: any = reactModule;
/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;
/** Nguyen thu giao dien dung chung cua DSH. */
const _deepseek_ai_dsh_client_ui_primitives: any = primitivesModule;

/** Reasoning-level declarations for a model on a hand-declared pi-ai route. */
/** Levels a model offers when the switch is turned on, where the schema lists them: Off plus the common OpenAI-compatible trio. */
const INITIAL_LEVELS = [
	"off",
	"low",
	"medium",
	"high"
];
/** The wire value a level sends unless its row says otherwise; `null` is the Off entry that sends nothing. */
function defaultValue(level: any) {
	return level === "off" ? null : level;
}
/**
* Whether pi-ai accepts a stored value: a non-empty string, or nothing for Off.
* @param level - the declared level.
* @param wire - the value stored for it.
* @returns whether the adapter would resolve the entry.
*/
function acceptedValue(level: any, wire: any) {
	return typeof wire === "string" ? wire.length > 0 : wire === null && level === "off";
}
/**
* Read the declared levels from a row in their stored order, including a key
* the offered levels do not name, so an edit never drops it.
* @param model - model row as drafted.
* @returns the entries; empty for a valueless field, which pi-ai refuses, and
* `undefined` when the field is absent or `false`.
*/
function readEfforts(model: any) {
	const value = model["reasoningEfforts"];
	if (value === null) return [];
	if (typeof value !== "object" || Array.isArray(value)) return void 0;
	return Object.entries(value);
}
/**
* Replace a row's declared levels, preserving every other field.
* @param model - model row as drafted.
* @param entries - the levels to write in row order, or `undefined` to remove the field.
* @returns the replacement row.
*/
function withEfforts(model: any, entries: any) {
	const next = { ...model };
	if (entries === void 0) {
		Reflect.deleteProperty(next, "reasoningEfforts");
		return next;
	}
	next["reasoningEfforts"] = Object.fromEntries(entries);
	return next;
}
/**
* Mirror the pi-ai refusals of a hand-declared `reasoningEfforts`, so a card
* names the row instead of failing at the write.
* @param value - drafted `models` value, or `undefined` while inherited.
* @returns the first refused row, or `undefined` when the adapter will accept every row.
*/
export function validateReasoningEfforts(value: any) {
	for (const [index, model] of modelDrafts(value).entries()) {
		const entries = readEfforts(model);
		if (entries === void 0) continue;
		if (entries.some(([level, wire]) => !acceptedValue(level, wire))) return {
			index,
			key: "modelReasoningValueRequired"
		};
		if (!entries.some(([level]) => level !== "off")) return {
			index,
			key: "modelReasoningNeedsLevel"
		};
	}
}
/**
* Edit the `reasoningEfforts` a hand-declared pi-ai model offers: a switch,
* then one row per level pairing the level with the value sent for it. Every
* row is read from the model, so a reused instance shows its new model.
* @param props - model declaration and row replacement action.
* @returns the reasoning-level group.
*/
export function ModelReasoningEfforts({ model, levels, position, disabled, t, onChange }: any) {
	const entries = readEfforts(model);
	const [typing, setTyping] = (0, react.useState)(void 0);
	const label = `${t("modelReasoning")} ${String(position)}`;
	const used = entries?.map(([level]) => level) ?? [];
	const write = (next: any) => {
		onChange(withEfforts(model, next));
	};
	const replaceAt = (current: any, index: any, entry: any) => current.map((existing: any, at: any) => at === index ? entry : existing);
	const changeLevel = (current: any, index: any, from: any, wire: any, to: any) => {
		write(replaceAt(current, index, [to, typeof wire === "string" && wire.length > 0 && wire !== from && from !== "off" && to !== "off" ? wire : defaultValue(to)]));
	};
	const addLevel = (current: any) => {
		const highest = Math.max(-1, ...used.map((level) => levels.indexOf(level)));
		const level = levels.find((candidate: any, index: any) => index > highest && !used.includes(candidate)) ?? levels.find((candidate: any) => !used.includes(candidate));
		/* v8 ignore next -- the add button is disabled once every level has a row */
		if (level === void 0) return;
		write([...current, [level, defaultValue(level)]]);
	};
	const editValue = (current: any, index: any, level: any, text: any) => {
		setTyping({
			level,
			text
		});
		const trimmed = text.trim();
		write(replaceAt(current, index, [level, trimmed.length === 0 ? defaultValue(level) : trimmed]));
	};
	const leaveValue = (current: any, index: any, level: any, wire: any) => {
		setTyping(void 0);
		if (!acceptedValue(level, wire)) write(replaceAt(current, index, [level, defaultValue(level)]));
	};
	const choicesFor = (level: any) => [...levels.includes(level) ? [] : [level], ...levels.filter((choice: any) => choice === level || !used.includes(choice))];
	const initialEntries = INITIAL_LEVELS.filter((level) => levels.includes(level)).map((level) => [level, defaultValue(level)]);
	const refused = entries?.some(([level, wire]) => !acceptedValue(level, wire)) === true;
	const missingLevel = entries !== void 0 && !used.some((level) => level !== "off");
	return (0, react_jsx_runtime.jsxs)("div", {
		className: CSS_SECTION["modelReasoning"],
		role: "group",
		"aria-label": label,
		children: [(0, react_jsx_runtime.jsxs)("div", {
			className: CSS_SECTION["modelReasoningHead"],
			children: [(0, react_jsx_runtime.jsxs)("span", {
				className: `${CSS_SECTION["modelFieldLabel"]} ${CSS_SECTION["modelReasoningLabel"]}`,
				children: [t("modelReasoning"), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
					label: t("modelReasoningHelpText"),
					side: "right",
					delayMs: 0,
					focusDelayMs: 0,
					portal: true,
					openOnClick: true,
					children: (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: CSS_SECTION["helpButton"],
						"aria-label": t("modelReasoningHelp"),
						children: "?"
					})
				})]
			}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
				checked: entries !== void 0,
				label,
				disabled,
				onChange: (on: any) => {
					write(on ? initialEntries : void 0);
				}
			})]
		}), entries === void 0 ? null : (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
			entries.length > 0 ? (0, react_jsx_runtime.jsxs)("div", {
				className: CSS_SECTION["modelReasoningRow"],
				"aria-hidden": "true",
				children: [(0, react_jsx_runtime.jsx)("span", {
					className: CSS_SECTION["modelFieldLabel"],
					children: t("modelReasoningLevel")
				}), (0, react_jsx_runtime.jsx)("span", {
					className: CSS_SECTION["modelFieldLabel"],
					children: t("modelReasoningValue")
				})]
			}) : null,
			entries.map(([level, wire], index) => (0, react_jsx_runtime.jsxs)("div", {
				className: CSS_SECTION["modelReasoningRow"],
				children: [
					(0, react_jsx_runtime.jsx)("select", {
						className: `${CSS_SECTION["input"]} ${CSS_SECTION["selectInput"]}`,
						value: level,
						"aria-label": `${t("modelReasoningLevel")} ${String(index + 1)}`,
						disabled,
						onChange: (event: any) => {
							changeLevel(entries, index, level, wire, event.target.value);
						},
						children: choicesFor(level).map((choice) => (0, react_jsx_runtime.jsx)("option", {
							value: choice,
							children: choice
						}, choice))
					}),
					(0, react_jsx_runtime.jsx)("input", {
						className: `${CSS_SECTION["input"]} ${CSS_SECTION["modelReasoningValueInput"]}`,
						type: "text",
						value: typing?.level === level ? typing.text : typeof wire === "string" ? wire : "",
						placeholder: level === "off" ? t("modelReasoningOffValuePlaceholder") : level,
						"aria-label": `${level} ${t("modelReasoningValue")}`,
						"aria-invalid": !acceptedValue(level, wire),
						disabled: disabled || level === "off",
						onChange: (event: any) => {
							editValue(entries, index, level, event.target.value);
						},
						onBlur: () => {
							leaveValue(entries, index, level, wire);
						}
					}),
					(0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: `${CSS_SECTION["iconButton"]} ${CSS_SECTION["iconButtonDanger"]}`,
						"aria-label": `${t("modelReasoningRemove")} ${level}`,
						title: t("modelReasoningRemove"),
						disabled,
						onClick: () => {
							write(entries.filter((_entry, at) => at !== index));
						},
						children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
					})
				]
			}, index)),
			refused ? (0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["error"],
				children: t("modelReasoningValueRequired")
			}) : missingLevel ? (0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["error"],
				children: t("modelReasoningNeedsLevel")
			}) : null,
			(0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: CSS_SECTION["addModelButton"],
				disabled: disabled || levels.every((level: any) => used.includes(level)),
				onClick: () => {
					addLevel(entries);
				},
				children: [(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutlineRegular, { size: 14 }), t("modelReasoningAdd")]
			})
		] })]
	});
}
