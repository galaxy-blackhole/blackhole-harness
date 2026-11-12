/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Khung hop thoai chung cho moi buoc onboarding
 */

import * as reactModule from "react";
import * as jsxRuntimeModule from "react/jsx-runtime";
import * as primitivesModule from "@galaxy-blackhole/gbh-client-ui-primitives";
import { CSS_ONBOARDING } from "./styles.ts";

/** Namespace React cua bang module (khai long de giu nguyen dang ma cua ban goc). */
const react: any = reactModule;
/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;
/** Nguyen thu giao dien dung chung cua DSH. */
const _deepseek_ai_dsh_client_ui_primitives: any = primitivesModule;

/** Shared modal chrome for every step registered by this onboarding plugin. */
const ignoreImplicitDismiss = () => {};
/**
* Render a blocking onboarding dialog and keep the application root inert.
* @param props.title - accessible and visible dialog title.
* @param props.focusTitle - focus the title when the step has no form control.
* @param props.children - step-owned body and actions.
* @returns the body-portaled modal.
*/
export function OnboardingModal({ title, focusTitle = false, children }: any) {
	const titleRef = (0, react.useRef)(null);
	(0, react.useEffect)(() => {
		const appRoot = document.getElementById("root");
		if (appRoot === null) return;
		const previous = appRoot.inert;
		appRoot.inert = true;
		return () => {
			appRoot.inert = previous;
		};
	}, []);
	(0, react.useEffect)(() => {
		if (focusTitle) titleRef.current?.focus();
	}, [focusTitle]);
	return (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Modal, {
		open: true,
		title,
		onClose: ignoreImplicitDismiss,
		headless: true,
		className: CSS_ONBOARDING.dialog,
		children: (0, react_jsx_runtime.jsxs)("div", {
			className: CSS_ONBOARDING.content,
			children: [(0, react_jsx_runtime.jsx)("h2", {
				ref: titleRef,
				className: CSS_ONBOARDING.title,
				tabIndex: focusTitle ? -1 : void 0,
				children: title
			}), (0, react_jsx_runtime.jsx)("div", {
				className: CSS_ONBOARDING.body,
				children
			})]
		})
	});
}
