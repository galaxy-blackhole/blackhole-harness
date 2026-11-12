/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Mot dong model trong danh sach cua nha cung cap
 */

import * as jsxRuntimeModule from "react/jsx-runtime";
import * as primitivesModule from "@galaxy-blackhole/gbh-client-ui-primitives";
import { ModelReasoningEfforts } from "./model-reasoning-efforts.ts";
import { ModelInputTypes } from "./model-input-types.ts";
import { CSS_SECTION } from "./styles.ts";

/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;
/** Nguyen thu giao dien dung chung cua DSH. */
const _deepseek_ai_dsh_client_ui_primitives: any = primitivesModule;

/**
* Render consistent model identity, capacity, and input-type controls.
* @param props - drafted fields and their owning editor's actions.
* @returns one expandable model entry.
*/
export function ModelRow(props: any) {
	const { model, position, t, disabled } = props;
	return (0, react_jsx_runtime.jsxs)("div", {
		className: CSS_SECTION["modelEntry"],
		children: [(0, react_jsx_runtime.jsxs)("div", {
			className: CSS_SECTION["modelRow"],
			children: [
				["id", "name"].map((field) => (0, react_jsx_runtime.jsx)("input", {
					className: CSS_SECTION["input"],
					type: "text",
					value: typeof model[field] === "string" ? model[field] : "",
					placeholder: t(field === "id" ? "modelId" : "modelName"),
					"aria-label": `${t(field === "id" ? "modelId" : "modelName")} ${String(position)}`,
					disabled,
					onChange: (event: any) => {
						const value = event.target.value;
						props.onFieldChange(field, field === "name" && value === "" ? void 0 : value);
					},
					onBlur: field === "id" ? (event: any) => props.onIdBlur?.(event.target.value) : void 0
				}, field)),
				(0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: CSS_SECTION["iconButton"],
					"aria-label": `${t("modelAdvanced")} ${String(position)}`,
					"aria-expanded": props.expanded,
					title: t("modelAdvanced"),
					onClick: props.onToggle,
					children: props.expanded ? (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutlineRegular, {}) : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronRightOutlineRegular, {})
				}),
				(0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: `${CSS_SECTION["iconButton"]} ${CSS_SECTION["iconButtonDanger"]}`,
					"aria-label": `${t("removeModel")} ${String(position)}`,
					title: t("removeModel"),
					disabled,
					onClick: props.onRemove,
					children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconTrashOutlineRegular, { size: 14 })
				})
			]
		}), props.expanded ? (0, react_jsx_runtime.jsxs)("div", {
			className: CSS_SECTION["modelAdvanced"],
			children: [
				["contextWindow", "maxTokens"].map((field) => (0, react_jsx_runtime.jsxs)("label", {
					className: CSS_SECTION["modelField"],
					children: [(0, react_jsx_runtime.jsx)("span", {
						className: CSS_SECTION["modelFieldLabel"],
						children: t(field)
					}), (0, react_jsx_runtime.jsx)("input", {
						className: CSS_SECTION["input"],
						type: "text",
						inputMode: "numeric",
						value: props[field].value,
						placeholder: props[field].placeholder,
						"aria-label": `${t(field)} ${String(position)}`,
						disabled,
						onChange: (event: any) => {
							props[field].onChange(event.target.value);
						},
						onBlur: props[field].onBlur
					})]
				}, field)),
				(0, react_jsx_runtime.jsx)(ModelInputTypes, {
					model,
					field: props.inputField,
					position,
					fallback: props.inputFallback,
					disabled: disabled || props.inputLoading === true,
					t,
					onChange: props.onChange
				}),
				props.reasoningLevels !== void 0 && props.reasoningLevels.length > 0 ? (0, react_jsx_runtime.jsx)(ModelReasoningEfforts, {
					model,
					levels: props.reasoningLevels,
					position,
					disabled,
					t,
					onChange: props.onChange
				}) : null
			]
		}) : null]
	});
}
