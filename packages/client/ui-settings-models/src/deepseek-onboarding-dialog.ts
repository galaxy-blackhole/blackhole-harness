/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Hop thoai buoc nhap khoa DeepSeek chinh thuc lan dau
 */

import * as reactModule from "react";
import * as jsxRuntimeModule from "react/jsx-runtime";
import { onboardingReadiness } from "./store.ts";
import { OnboardingModal } from "./onboarding-modal.ts";
import { ProviderEditor } from "./provider-editor.ts";
import { CSS_SIGN_IN } from "./styles.ts";

/** Namespace React cua bang module (khai long de giu nguyen dang ma cua ban goc). */
const react: any = reactModule;
/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;

/* v8 ignore next 3 -- closed-union defaults only defend future source widening */
function assertNever$1(_value: any) {
	throw new Error("unexpected DeepSeek onboarding state");
}
/**
* Prompt a first-run user for the official DeepSeek credential while no
* provider can serve requests and that credential is writable.
* @param props - settings-shell owner state and Models feature dependencies.
* @returns the onboarding modal or null when onboarding needs no intervention.
*/
export function DeepSeekOnboardingDialog(props: any) {
	const { complete, controller, useModels, operations, schema, t, renderSlot, automatic, explicit = false } = props;
	const [apiKey, setApiKey] = (0, react.useState)(explicit);
	const state = useModels((snapshot: any) => snapshot);
	const readiness = onboardingReadiness(state);
	(0, react.useEffect)(() => {
		if ((automatic || explicit) && state.status === "idle") controller.load();
	}, [
		controller,
		state.status,
		automatic,
		explicit
	]);
	(0, react.useEffect)(() => {
		if (!automatic && !explicit || readiness.kind === "adapter-absent" || !explicit && readiness.kind === "provider-ready" || readiness.kind === "unavailable") complete();
	}, [
		complete,
		readiness.kind,
		explicit,
		automatic
	]);
	if (!automatic && !explicit) return null;
	switch (readiness.kind) {
		case "loading":
		case "adapter-absent":
		case "unavailable": return null;
		case "provider-ready":
			if (!explicit) return null;
			break;
		case "credential-missing": break;
		/* v8 ignore next -- every current readiness variant is handled above */
		default: return assertNever$1(readiness);
	}
	const row = state.rows.find((candidate: any) => candidate.entry.provider === "deepseek-official" && candidate.entry.settingsNs === "llm-deepseek" && candidate.entry.settingsPath.length === 0);
	const namespace = state.namespaces.get("llm-deepseek");
	/* v8 ignore next 2 -- credential-missing is derived only from this exact joined row. */
	if (row === void 0 || namespace === void 0) return null;
	const finishCredential = (changed: any) => {
		if (!changed) {
			complete();
			return;
		}
		controller.load();
	};
	const editor = (0, react_jsx_runtime.jsxs)(OnboardingModal, {
		title: t("onboardingTitle"),
		children: [(0, react_jsx_runtime.jsx)("p", {
			className: CSS_SIGN_IN.description,
			children: t("onboardingDescription")
		}), (0, react_jsx_runtime.jsx)("div", {
			className: CSS_SIGN_IN.editor,
			children: (0, react_jsx_runtime.jsx)(ProviderEditor, {
				provider: row.entry.provider,
				displayName: row.entry.displayName,
				namespace,
				schema,
				settingsPath: row.entry.settingsPath,
				operations,
				t,
				readOnly: false,
				hideTitle: true,
				credentialOnly: true,
				onSubmitCredential: () => {
					props.track?.("api_key_save_click", {});
				},
				credentialRequired: true,
				autoFocusCredential: true,
				cancelLabelKey: "onboardingLater",
				submitLabelKey: "onboardingSave",
				submitBusyLabelKey: "onboardingSaving",
				onClose: finishCredential
			})
		})]
	});
	return apiKey ? editor : renderSlot("settings.models.sign-in", {
		complete,
		useApiKey: () => {
			setApiKey(true);
		}
	}, { fallback: editor });
}
