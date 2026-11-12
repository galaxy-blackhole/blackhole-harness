/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Thong bao phien ban moi cua ban xem truoc
 */

import * as reactModule from "react";
import * as jsxRuntimeModule from "react/jsx-runtime";
import * as primitivesModule from "@galaxy-blackhole/gbh-client-ui-primitives";
import { OnboardingModal } from "./onboarding-modal.ts";
import { CSS_WELCOME } from "./styles.ts";

/** Namespace React cua bang module (khai long de giu nguyen dang ma cua ban goc). */
const react: any = reactModule;
/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;
/** Nguyen thu giao dien dung chung cua DSH. */
const _deepseek_ai_dsh_client_ui_primitives: any = primitivesModule;

/** Product-wide, versioned preview notice. */
/**
* Render the current notice until its exact copy version is acknowledged.
* @param props - settings-shell owner state and welcome dependencies.
* @returns the welcome modal or null while the step decides not to show.
*/
export function WelcomeNotice(props: any) {
	const { complete, controller, useWelcome, t } = props;
	const state = useWelcome((snapshot: any) => snapshot);
	const finished = (0, react.useRef)(false);
	const finish = (0, react.useCallback)(() => {
		if (finished.current) return;
		finished.current = true;
		complete();
	}, [complete]);
	(0, react.useEffect)(() => {
		if (state.status === "idle") controller.load();
	}, [controller, state.status]);
	(0, react.useEffect)(() => {
		if (state.acknowledged) finish();
	}, [finish, state.acknowledged]);
	if (state.status === "idle" || state.status === "loading" || state.acknowledged) return null;
	const acknowledge = async () => {
		if (await controller.acknowledge()) finish();
	};
	const paragraphs = t("welcomeBody").split("\n\n");
	return (0, react_jsx_runtime.jsxs)(OnboardingModal, {
		title: t("welcomeTitle"),
		focusTitle: true,
		children: [
			(0, react_jsx_runtime.jsx)("div", {
				className: CSS_WELCOME.copy,
				children: paragraphs.map((paragraph: any) => (0, react_jsx_runtime.jsx)("p", { children: paragraph }, paragraph))
			}),
			state.error === null ? null : (0, react_jsx_runtime.jsx)("p", {
				className: CSS_WELCOME.error,
				role: "alert",
				children: t("welcomeError")
			}),
			(0, react_jsx_runtime.jsx)("div", {
				className: CSS_WELCOME.actions,
				children: (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
					variant: "primary",
					className: CSS_WELCOME.primary,
					disabled: state.status === "saving",
					onClick: () => {
						acknowledge();
					},
					children: t("welcomeContinue")
				})
			})
		]
	});
}
