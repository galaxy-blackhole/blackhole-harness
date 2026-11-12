/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc The trinh sua mot nha cung cap (khoa API · danh sach model)
 */

import * as reactModule from "react";
import * as jsxRuntimeModule from "react/jsx-runtime";
import * as primitivesModule from "@galaxy-blackhole/gbh-client-ui-primitives";
import { ApiKeyInput } from "./api-key-input.ts";
import { apiKeyFailure } from "./api-key.ts";
import { protocolLabel } from "./protocol-label.ts";
import { validateReasoningEfforts } from "./model-reasoning-efforts.ts";
import { modelDrafts } from "./deepseek-models-editor.ts";
import { validateDeepSeekModels } from "./deepseek-models-editor.ts";
import { DeepSeekModelsEditor } from "./deepseek-models-editor.ts";
import { ModelListEditor } from "./model-list-editor.ts";
import { deriveKeyRef } from "./store.ts";
import { protocolChoices } from "./store.ts";
import { reasoningLevelChoices } from "./store.ts";
import { EditorFooter } from "./editor-footer.ts";
import { CSS_SECTION } from "./styles.ts";

/** Namespace React cua bang module (khai long de giu nguyen dang ma cua ban goc). */
const react: any = reactModule;
/** Runtime JSX cua React (jsx/jsxs/Fragment). */
const react_jsx_runtime: any = jsxRuntimeModule;
/** Nguyen thu giao dien dung chung cua DSH. */
const _deepseek_ai_dsh_client_ui_primitives: any = primitivesModule;

/**
* One provider's editor card, hand-written per adapter family: the primary
* field is a single write-only **API key** input (the page never asks for an
* environment-variable name — a typed key stores through `credentials/set`
* under the profile's reference, deriving `<ROUTE>_API_KEY` when the profile
* has none. The pi-ai profile records that derivation as `apiKeyEnv` only when
* a key is entered; a blank key materializes a reference-free profile for
* provider-native authentication);
* the collapsed 自定义设置 area carries the per-family extras (`baseURL` for
* both families, DeepSeek's id/name/context-window model catalog, and the
* display name and wire protocol of a pi-ai route the adapter does not ship —
* the two fields the create card asked that route for, editable here for the
* same reason).
* Reasoning effort is deliberately absent: it is a per-MODEL capability, and
* the models under one provider disagree about it, so a provider-scoped
* control can only be set to a value some of them reject. The composer's
* model picker offers each model its own levels; `cordis.patch.yml` keeps the
* profile field for a deployment that knows its route. Everything else stays
* owned by `cordis.patch.yml`. Profile edits land as minimal `settings.mutate`
* path ops against the stored section — the card names only the fields it can
* see instead of rebuilding the whole subtree from a partial descriptor.
*/
/** A user-section subtree as a plain draft object (absent → empty). */
function draftAt(schema: any, namespace: any, path: any) {
	const subtree = schema.getPath(namespace.user, path);
	if (typeof subtree !== "object" || subtree === null || Array.isArray(subtree)) return {};
	return structuredClone(subtree);
}
/**
* The minimal path ops carrying `after` over `before`, both as the card sees
* them. Only keys the card observed are named; fields absent from both sides
* produce no op, which is why edits are path-addressed rather than a rebuilt
* section.
* @param base - path of the edited subtree inside the user section.
* @param before - the subtree as loaded, or undefined when it is new.
* @param after - the subtree as edited.
* @returns ordered set/unset ops; empty when nothing changed.
*/
function pathOps(base: any, before: any, after: any) {
	const previous = typeof before === "object" && before !== null && !Array.isArray(before) ? before : {};
	const ops = [];
	for (const [key, value] of Object.entries(after)) {
		if (JSON.stringify(previous[key]) === JSON.stringify(value)) continue;
		ops.push({
			op: "set",
			path: [...base, key],
			value
		});
	}
	for (const key of Object.keys(previous)) if (!(key in after)) ops.push({
		op: "unset",
		path: [...base, key]
	});
	return ops;
}
/** The editor layout the owning namespace selects. */
function layoutOf(ns: any) {
	if (ns === "llm-deepseek") return "deepseek";
	if (ns === "llm-pi-ai") return "pi-ai";
	return "unknown";
}
/** The credential reference this profile resolves keys through. */
function refFor(schema: any, namespace: any, path: any, provider: any) {
	const profile = schema.getPath(namespace.value, path);
	const named = typeof profile === "object" && profile !== null ? profile.apiKeyEnv : void 0;
	return typeof named === "string" && named.length > 0 ? named : deriveKeyRef(provider);
}
/**
* Render one provider's editing card.
* @param props - the addressed profile plus wire faces and copy.
* @returns the editor card.
*/
export function ProviderEditor(props: any) {
	const { namespace, schema, settingsPath, operations, t } = props;
	const [draft, setDraft] = (0, react.useState)(() => draftAt(schema, namespace, settingsPath));
	const [keyDraft, setKeyDraft] = (0, react.useState)("");
	const [busy, setBusy] = (0, react.useState)(false);
	const [listBusy, setListBusy] = (0, react.useState)(false);
	const { onBusyChange } = props;
	(0, react.useEffect)(() => {
		onBusyChange?.(busy || listBusy);
	}, [
		busy,
		listBusy,
		onBusyChange
	]);
	const [failure, setFailure] = (0, react.useState)(void 0);
	const [committedOriginal, setCommittedOriginal] = (0, react.useState)(() => schema.getPath(namespace.user, settingsPath));
	const [expectedRevision, setExpectedRevision] = (0, react.useState)(() => namespace.revision);
	const root = (0, react.useMemo)(() => schema.rehydrate(namespace.schema), [namespace.schema, schema]);
	const node = (0, react.useMemo)(() => schema.nodeAtPath(root, settingsPath), [
		root,
		schema,
		settingsPath
	]);
	const fallback = schema.getPath(namespace.value, settingsPath);
	const disabled = props.readOnly || busy;
	const layout = layoutOf(namespace.ns);
	const keyRef = refFor(schema, namespace, settingsPath, props.provider);
	const protocols = (0, react.useMemo)(() => layout === "pi-ai" ? protocolChoices(namespace, schema) : [], [
		layout,
		namespace,
		schema
	]);
	const stringAt = (source: any, key: any) => {
		const value = schema.getPath(source, [key]);
		return typeof value === "string" && value.trim().length > 0 ? value : void 0;
	};
	const setField = (key: any, next: any) => {
		const value = next === void 0 || next.trim().length === 0 ? void 0 : next;
		setDraft((current: any) => value === void 0 ? schema.deletePath(current, [key]) : schema.setPath(current, [key], value));
	};
	const reasoningLevels = (0, react.useMemo)(() => layout === "pi-ai" && props.declared === true ? reasoningLevelChoices(namespace, schema) : [], [
		layout,
		props.declared,
		namespace,
		schema
	]);
	const editsReasoning = reasoningLevels.length > 0;
	const validateModels = (value: any) => validateDeepSeekModels(value) ?? (editsReasoning ? validateReasoningEfforts(value) : void 0);
	const modelFailure = validateModels(schema.getPath(draft, ["models"]));
	const keyFailure = apiKeyFailure(keyDraft);
	const keyValue = keyDraft.trim();
	/** Lỗi mức trường của ô khoá: bắt buộc mà trống, nếu không thì lỗi định dạng. */
	const requiredKeyFailure: string | undefined = props.credentialRequired === true && keyDraft.length > 0 && keyValue.length === 0 ? "keyRequired" : void 0;
	const shownKeyFailure = requiredKeyFailure ?? keyFailure;
	const probeApi = stringAt(draft, "api") ?? stringAt(fallback, "api");
	const probeBaseURL = stringAt(draft, "baseURL") ?? stringAt(fallback, "baseURL");
	const probe = {
		settingsNs: namespace.ns,
		provider: props.provider,
		...probeBaseURL === void 0 ? {} : { baseURL: probeBaseURL },
		...probeApi === void 0 ? {} : { api: probeApi },
		...keyValue.length === 0 ? {} : { apiKey: keyValue }
	};
	/**
	* The write for this card, or a failure message. Every edit travels as
	* path ops against the STORED section: the draft comes from the redacted
	* descriptor, so a wholesale replace rebuilt from it could delete fields
	* outside the card. Ops name only the fields this card can see.
	*/
	const applyOnce = async () => {
		const ns = namespace.ns;
		const next = layout === "pi-ai" && stringAt(draft, "apiKeyEnv") === void 0 && stringAt(fallback, "apiKeyEnv") === void 0 && keyValue.length > 0 ? schema.setPath(draft, ["apiKeyEnv"], keyRef) : draft;
		if (props.credentialOnly !== true) {
			const failure = validateModels(schema.getPath(next, ["models"]));
			/* v8 ignore next 3 -- unreachable from the card: the same failure disables submit */
			if (failure !== void 0) return `${t("model")} ${String(failure.index + 1)}: ${t(failure.key)}`;
		}
		/* v8 ignore next -- apply is only reachable from the rendered card, which required a resolved node */
		if (props.credentialOnly !== true && node !== void 0 && settingsPath.length === 0) {
			const sectionError = schema.validate(node, next);
			if (sectionError !== void 0) return sectionError;
		}
		const materializesNativeProfile = layout === "pi-ai" && fallback === void 0 && committedOriginal === void 0 && Object.keys(next).length === 0;
		const ops = props.credentialOnly === true ? [] : materializesNativeProfile ? [{
			op: "set",
			path: [...settingsPath],
			value: {}
		}] : pathOps(settingsPath, committedOriginal, next);
		if (ops.length > 0) {
			const written = await operations.writeSettings(ns, ops, expectedRevision);
			if (written.kind !== "written") return written.kind === "conflict" ? t("conflict") : written.message;
			setCommittedOriginal(schema.getPath(written.view.user, settingsPath));
			setExpectedRevision(written.view.revision);
			setDraft(next);
		}
		if (keyValue.length > 0) {
			const stored = await operations.storeCredential(keyRef, keyValue);
			if (stored !== void 0) return stored;
		}
		setKeyDraft("");
	};
	const apply = async () => {
		setBusy(true);
		setFailure(void 0);
		try {
			const failure = await applyOnce();
			if (failure !== void 0) {
				setFailure(failure);
				return;
			}
			props.onClose(true);
		} finally {
			setBusy(false);
		}
	};
	if (node === void 0) return (0, react_jsx_runtime.jsxs)("p", {
		className: CSS_SECTION["error"],
		children: [
			props.provider,
			": ",
			props.t("settingsPathUnresolvable")
		]
	});
	/**
	* The catalog beneath the user layer: what the composition entry pinned, or
	* else the schema default that `resolve` would supply. The effective value
	* cannot answer this — it still carries the stored override until the unset
	* is applied, so reading it would echo that override straight back the
	* moment reset drops it, leaving the rows unchanged until a reload.
	*/
	const inheritedModels = () => {
		return schema.getPath(namespace.base, [...settingsPath, "models"]) ?? schema.nodeAtPath(root, [...settingsPath, "models"])?.meta.default;
	};
	/**
	* The curated fields of one known adapter family. The family arrives
	* narrowed so the per-family branches below are total: an unknown namespace
	* renders the hint instead and never reaches this body.
	*/
	const curatedFields = (family: any) => {
		const ownsIdentity = family === "pi-ai" && props.declared === true;
		const customModels = schema.getPath(draft, ["models"]);
		const modelsOverridden = schema.hasPath(draft, ["models"]);
		const models = modelDrafts(modelsOverridden ? customModels : inheritedModels());
		const defaultContextWindow = schema.getPath(fallback, ["defaultContextWindow"]);
		const defaultMaxTokens = schema.getPath(fallback, ["maxTokens"]);
		const defaultInput = schema.getPath(fallback, ["defaultInput"]);
		const baseURL = stringAt(fallback, "baseURL") ?? props.defaultBaseURL;
		const endpointEnv = props.baseURLEnv ?? [];
		const endpointHint = family === "deepseek" ? t("deepSeekEndpointHint") : baseURL === void 0 && endpointEnv.length > 0 ? t("baseUrlEnvironment").replace("{env}", () => endpointEnv.join(", ")) : void 0;
		const namedRef = stringAt(fallback, "apiKeyEnv");
		const nativeAuth = namedRef === void 0 ? props.nativeAuth : void 0;
		const authRefs = namedRef === void 0 ? (nativeAuth?.env ?? []).filter((ref: any) => !endpointEnv.includes(ref)) : [namedRef];
		const visibleRefs = authRefs.filter((ref: any) => !ref.toLowerCase().includes("oauth"));
		const keyHint = visibleRefs[0];
		const checkedRefs = authRefs.map((ref: any) => [ref, props.credentialChecks?.[ref] ?? (ref === namedRef ? props.credential : void 0)]);
		const detected = checkedRefs.find(([, info]: any) => info?.configured === true);
		const detectedRef = detected?.[0];
		const detectedVisibleRef = detectedRef === void 0 || !visibleRefs.includes(detectedRef) ? void 0 : detectedRef;
		const missingRefs = checkedRefs.length > 0 && checkedRefs.every(([, info]: any) => info?.configured === false);
		const savedCredential = detected?.[1]?.source === "file";
		const credentialHint = keyDraft.length > 0 || savedCredential || keyHint === void 0 || props.credentialRequired === true ? void 0 : t(detectedRef === void 0 ? missingRefs ? "keyFallbackMissing" : "keyFallbackUnchecked" : detectedVisibleRef === void 0 ? "keyFallbackDetectedHidden" : "keyFallbackDetected").replace("{hint}", () => detectedVisibleRef ?? keyHint);
		const keyHelp = visibleRefs.length === 0 ? void 0 : t("keyHelp").replace("{env}", () => visibleRefs.join(" / "));
		// 25/10/2026 (yêu cầu Lead): provider `auto` (Galaxy Blackhole) chỉ nhập khoá ⇒ ẩn luôn nút "?" trợ giúp,
		// vì câu trợ giúp nhắc tới đường dẫn env của bản DSH ($DSH_HOME). Xem docs/adr/0021-galaxy-blackhole-chi-nhap-khoa.md.
		const authHelp = keyHelp === void 0 || props.credentialOnly === true ? null : (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
			label: keyHelp,
			side: "right",
			delayMs: 0,
			focusDelayMs: 0,
			portal: true,
			openOnClick: true,
			children: (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: CSS_SECTION["helpButton"],
				"aria-label": t("authHelp"),
				children: "?"
			})
		});
		const keylessNativeAuth = nativeAuth?.env.length === 0 && nativeAuth.oauth;
		const keyPlaceholder = keyHint === void 0 || props.credentialRequired === true ? t("keyPlaceholder") : t(savedCredential ? "keyPlaceholderSaved" : "keyPlaceholderFallback").replace("{hint}", () => keyHint);
		/** What both family editors take: the rows, whose layer owns them, and the two writes. */
		const catalogProps = {
			models,
			overridden: modelsOverridden,
			t,
			disabled,
			onChange: (next: any) => {
				setDraft((current: any) => schema.setPath(current, ["models"], next));
			},
			onReset: () => {
				setDraft((current: any) => schema.deletePath(current, ["models"]));
			}
		};
		return (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [keylessNativeAuth ? null : (0, react_jsx_runtime.jsxs)("div", {
			className: CSS_SECTION["field"],
			children: [
				(0, react_jsx_runtime.jsxs)("span", {
					className: CSS_SECTION["fieldLabel"],
					children: [t("keyInput"), authHelp]
				}),
				(0, react_jsx_runtime.jsx)(ApiKeyInput, {
					t,
					value: keyDraft,
					placeholder: keyPlaceholder,
					"aria-label": t("keyInput"),
					"aria-invalid": shownKeyFailure !== void 0,
					"aria-describedby": credentialHint === void 0 ? void 0 : `${props.provider}-credential-hint`,
					required: props.credentialRequired === true,
					autoFocus: props.autoFocusCredential === true,
					disabled,
					onChange: (event: any) => {
						setKeyDraft(event.target.value);
					}
				}),
				credentialHint === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
					id: `${props.provider}-credential-hint`,
					className: CSS_SECTION[missingRefs ? "notice" : detectedRef === void 0 ? "advancedHint" : "savedNotice"],
					children: credentialHint
				}),
				shownKeyFailure === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
					className: CSS_SECTION["error"],
					children: t(shownKeyFailure)
				})
			]
		}), props.credentialOnly === true ? null : (0, react_jsx_runtime.jsxs)("details", {
			className: CSS_SECTION["customized"],
			children: [(0, react_jsx_runtime.jsx)("summary", {
				className: CSS_SECTION["customizedSummary"],
				children: t("customized")
			}), (0, react_jsx_runtime.jsxs)("div", {
				className: CSS_SECTION["customizedBody"],
				children: [
					ownsIdentity ? (0, react_jsx_runtime.jsxs)("div", {
						className: CSS_SECTION["field"],
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: CSS_SECTION["fieldLabel"],
							children: t("customDisplayName")
						}), (0, react_jsx_runtime.jsx)("input", {
							className: CSS_SECTION["input"],
							type: "text",
							value: stringAt(draft, "displayName") ?? "",
							placeholder: stringAt(schema.getPath(namespace.base, settingsPath), "displayName") ?? props.provider,
							"aria-label": t("customDisplayName"),
							disabled,
							onChange: (event: any) => {
								setField("displayName", event.target.value);
							}
						})]
					}) : null,
					(0, react_jsx_runtime.jsxs)("div", {
						className: CSS_SECTION["field"],
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: CSS_SECTION["fieldLabel"],
								children: t("baseUrl")
							}),
							(0, react_jsx_runtime.jsx)("input", {
								className: CSS_SECTION["input"],
								type: "text",
								value: stringAt(draft, "baseURL") ?? "",
								placeholder: family === "deepseek" ? t("deepSeekBaseUrl") : baseURL === void 0 ? t(endpointEnv.length > 0 ? "baseUrlConfigured" : "baseUrlDefault") : t("baseUrlPlaceholder").replace("{url}", () => baseURL),
								"aria-describedby": endpointHint === void 0 ? void 0 : `${props.provider}-endpoint-hint`,
								"aria-label": t("baseUrl"),
								disabled,
								onChange: (event: any) => {
									setField("baseURL", event.target.value === "" ? void 0 : event.target.value);
								}
							}),
							endpointHint === void 0 ? null : (0, react_jsx_runtime.jsx)("span", {
								id: `${props.provider}-endpoint-hint`,
								className: CSS_SECTION["advancedHint"],
								children: endpointHint
							})
						]
					}),
					ownsIdentity ? (0, react_jsx_runtime.jsxs)("div", {
						className: CSS_SECTION["field"],
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: CSS_SECTION["fieldLabel"],
							children: t("customApi")
						}), (0, react_jsx_runtime.jsxs)("select", {
							className: `${CSS_SECTION["input"]} ${CSS_SECTION["selectInput"]}`,
							value: probeApi ?? "",
							"aria-label": t("customApi"),
							disabled,
							onChange: (event: any) => {
								setField("api", event.target.value);
							},
							children: [probeApi === void 0 ? (0, react_jsx_runtime.jsx)("option", {
								value: "",
								children: t("customApiUnset")
							}) : null, protocols.map((choice: any) => (0, react_jsx_runtime.jsx)("option", {
								value: choice,
								children: protocolLabel(t, choice)
							}, choice))]
						})]
					}) : null,
					family === "deepseek" ? (0, react_jsx_runtime.jsx)(DeepSeekModelsEditor, {
						...catalogProps,
						defaultContextWindow: typeof defaultContextWindow === "number" ? defaultContextWindow : void 0,
						defaultMaxTokens: typeof defaultMaxTokens === "number" ? defaultMaxTokens : void 0
					}) : (0, react_jsx_runtime.jsx)(ModelListEditor, {
						...catalogProps,
						catalogProvider: props.declared === true ? void 0 : props.provider,
						reasoningLevels,
						defaultInput: Array.isArray(defaultInput) ? defaultInput : void 0,
						probe,
						probeBlocked: keyFailure,
						operations,
						onBusyChange: setListBusy
					})
				]
			})]
		})] });
	};
	return (0, react_jsx_runtime.jsxs)("div", {
		className: props.credentialOnly === true ? CSS_SECTION["addBlock"] : CSS_SECTION["editor"],
		children: [
			props.hideTitle === true ? null : (0, react_jsx_runtime.jsxs)("div", {
				className: CSS_SECTION["editorHeader"],
				children: [(0, react_jsx_runtime.jsx)("span", {
					className: CSS_SECTION["editorTitle"],
					children: props.displayName
				}), props.provider !== props.displayName ? (0, react_jsx_runtime.jsx)("span", {
					className: CSS_SECTION["editorRoute"],
					children: props.provider
				}) : null]
			}),
			layout === "unknown" ? (0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["advancedHint"],
				children: `${t("advancedHint")} (${namespace.ns})`
			}) : curatedFields(layout),
			failure !== void 0 ? (0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["error"],
				children: failure
			}) : null,
			props.credentialOnly === true || modelFailure === void 0 ? null : (0, react_jsx_runtime.jsx)("p", {
				className: CSS_SECTION["advancedHint"],
				children: `${t("model")} ${String(modelFailure.index + 1)}: ${t(modelFailure.key)}`
			}),
			(0, react_jsx_runtime.jsx)(EditorFooter, {
				t,
				busy,
				submitDisabled: disabled || layout === "unknown" || props.credentialOnly !== true && modelFailure !== void 0 || shownKeyFailure !== void 0 || props.credentialRequired === true && keyValue.length === 0,
				submitLabelKey: props.submitLabelKey ?? "apply",
				submitBusyLabelKey: props.submitBusyLabelKey ?? "applying",
				...props.cancelLabelKey === void 0 ? {} : { cancelLabelKey: props.cancelLabelKey },
				onCancel: () => {
					props.onClose(false);
				},
				onSubmit: () => {
					props.onSubmitCredential?.();
					apply();
				}
			})
		]
	});
}
