/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hang nut huy/luu cua the trinh sua
 */

import * as jsxRuntimeModule from "react/jsx-runtime";
import { CSS_SECTION } from "./styles.ts";

/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;

/**
* Render one provider card's action row.
* @param props - the labels, commit gating, and handlers the owning card supplies.
* @returns the cancel/commit row.
*/
export function EditorFooter(props: any) {
	const { t } = props;
	return (0, react_jsx_runtime.jsxs)("div", {
		className: CSS_SECTION["editorActions"],
		children: [(0, react_jsx_runtime.jsx)("button", {
			type: "button",
			className: CSS_SECTION["secondaryButton"],
			disabled: props.busy,
			onClick: props.onCancel,
			children: t(props.cancelLabelKey ?? "cancel")
		}), (0, react_jsx_runtime.jsx)("button", {
			type: "button",
			className: CSS_SECTION["primaryButton"],
			disabled: props.submitDisabled,
			onClick: props.onSubmit,
			children: props.busy ? t(props.submitBusyLabelKey) : t(props.submitLabelKey)
		})]
	});
}
