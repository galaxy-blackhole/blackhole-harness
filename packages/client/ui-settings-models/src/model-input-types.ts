/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc O chon kieu dau vao text/image cua mot model
 */

import * as jsxRuntimeModule from "react/jsx-runtime";
import * as primitivesModule from "@galaxy-blackhole/gbh-client-ui-primitives";
import { CSS_SECTION } from "./styles.ts";

/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;
/** Nguyen thu giao dien dung chung cua DSH. */
const _deepseek_ai_dsh_client_ui_primitives: any = primitivesModule;

/**
* Edit a nonempty set of input types, displaying inherited types before an override exists.
* @param props - model declaration and row replacement action.
* @returns the labeled text and image checkboxes.
*/
export function ModelInputTypes({ model, field, position, disabled, fallback, t, onChange }: any) {
	const modalities = model[field];
	const selected = Array.isArray(modalities) && modalities.length > 0 ? modalities : fallback ?? ["text"];
	return (0, react_jsx_runtime.jsxs)("fieldset", {
		className: CSS_SECTION["modelInputTypes"],
		"aria-label": `${t("modelInputTypes")} ${String(position)}`,
		children: [(0, react_jsx_runtime.jsx)("legend", {
			className: CSS_SECTION["modelFieldLabel"],
			children: t("modelInputTypes")
		}), (0, react_jsx_runtime.jsx)("div", {
			className: CSS_SECTION["modelInputChoices"],
			children: ["text", "image"].map((modality) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
				label: t(modality === "text" ? "modelInputText" : "modelInputImage"),
				checked: selected.includes(modality),
				disabled: disabled || selected.length === 1 && selected.includes(modality),
				onChange: (checked: any) => {
					const nextSelected = ["text", "image"].filter((value) => value === modality ? checked : selected.includes(value));
					const next = {
						...model,
						[field]: nextSelected
					};
					if (field === "inputModalities" && !nextSelected.includes("image")) {
						Reflect.deleteProperty(next, "imagePixelBudget");
						Reflect.deleteProperty(next, "imageMaxBytes");
					}
					onChange(next);
				}
			}, modality))
		})]
	});
}
