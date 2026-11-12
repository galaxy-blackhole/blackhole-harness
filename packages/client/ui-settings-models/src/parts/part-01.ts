/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 20/10/2026
 * desc LÁT NGUYÊN VĂN của bundle gốc — sinh bằng tools/gen-client-parts.ts, KHÔNG sửa tay
 */
// @ts-nocheck — lát nguyên văn của bundle gốc: không có kiểu, giữ nguyên hành vi.
window.__ModuleLoader__.load({
	id: "@deepseek-ai/dsh-client-ui-settings-models",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region lib/types/client/apiKey.js
		/**
		* Browser-side judgement of a typed API key.
		* @module @deepseek-ai/dsh-client-ui-settings-models/apiKey
		*/
		/**
		* Twin of `normalizeApiKey` in `@deepseek-ai/dsh-llm`: printable ASCII, space
		* excluded. Client packages reference only client packages, so the charset
		* rule is mirrored here rather than imported; keep the two in step, as
		* `validateDeepSeekModels` is kept in step with the host's `catalogModel`.
		*/
		const LEGAL_API_KEY = /^[\x21-\x7E]+$/;
		/**
		* A pasted `NAME=value` environment line. Two narrowings keep real keys clear
		* of it: the name must be upper-case, so `sk-` forms break at the hyphen, and
		* the `=` must be followed by something other than another `=`, so base64
		* padding on an all-upper-case key (`ABCD==`) is not mistaken for an
		* assignment. This heuristic runs only here — a resolver applying it could
		* lock a user out of a gateway whose key legitimately takes this shape, with
		* the environment refusing it too and no way through.
		*/
		const ENV_LINE = /^[A-Z][A-Z0-9_]*=[^=]/;
		/** Whether a value is wrapped in one matching pair of quotes. */
		function isQuoted(value) {
			const first = value[0];
			if (first !== "\"" && first !== "'" && first !== "`") return false;
			return value.length > 1 && value.endsWith(first);
		}
		/**
		* Judge the key input's current value.
		*
		* An empty field is not a failure: every card opens with it empty even when a
		* key is already stored, where it means keep that one. A field holding only
		* whitespace is a failure rather than an empty field, so typed input is never
		* silently discarded.
		* @param draft - the key input's current value, untrimmed.
		* @returns the copy key for a field-level failure, or `undefined` to allow submit.
		*/
		function apiKeyFailure(draft) {
			if (draft.length === 0) return void 0;
			const value = draft.trim();
			if (value.length === 0) return "keyBlank";
			if (ENV_LINE.test(value) || isQuoted(value)) return "keyIllegalCharacters";
			if (!LEGAL_API_KEY.test(value)) return "keyIllegalCharacters";
		}
		//#endregion
		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-settings-models/src/client/ModelsSection.module.css.mjs
		const css$3 = ".zGbnIq_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}.zGbnIq_title{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:500;line-height:24px}.zGbnIq_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:14px;line-height:22px}.zGbnIq_notice{color:var(--dsw-alias-state-warn-label);margin:0;font-size:12px;line-height:18px}.zGbnIq_savedNotice{color:var(--dsw-alias-state-success-primary);margin:0;font-size:12px;line-height:18px}.zGbnIq_rows{flex-direction:column;gap:8px;margin:12px 0 0;padding:0;list-style:none;display:flex}.zGbnIq_rowCard{border:.5px solid var(--dsw-alias-settings-card-stroke);background:var(--dsw-alias-settings-card-fill);border-radius:var(--dsw-radius-xl);flex-direction:column;gap:12px;padding:12px 14px;display:flex}.zGbnIq_rowHead{align-items:center;gap:10px;display:flex}.zGbnIq_rowIdentity{align-items:center;gap:6px;min-width:0;display:inline-flex}.zGbnIq_rowName{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}.zGbnIq_rowTag{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-xs);color:var(--dsw-alias-label-secondary);flex:none;padding:1px 6px;font-size:11px;line-height:16px}.zGbnIq_credentialDot{box-sizing:border-box;corner-shape:round;border-radius:50%;flex:none;width:8px;height:8px;display:inline-block}.zGbnIq_credentialDotConfigured{background:var(--dsw-alias-state-success-primary)}.zGbnIq_credentialDotMissing{background:var(--dsw-alias-state-error-primary)}.zGbnIq_accountStatus{color:var(--dsw-alias-state-success-primary);flex:none;align-items:center;gap:6px;font-size:13px;line-height:20px;display:inline-flex}.zGbnIq_rowActions{align-items:center;gap:4px;margin-left:auto;display:inline-flex}.zGbnIq_primaryButton,.zGbnIq_secondaryButton,.zGbnIq_addButton{box-sizing:border-box;border-radius:var(--dsw-radius-md);height:36px;font:inherit;cursor:pointer;border:none;justify-content:center;align-items:center;gap:4px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.zGbnIq_primaryButton{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}.zGbnIq_primaryButton:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}.zGbnIq_secondaryButton,.zGbnIq_addButton{border:.5px solid var(--dsw-alias-border-l3);color:var(--dsw-alias-label-primary);background:0 0}.zGbnIq_secondaryButton:hover:not(:disabled),.zGbnIq_addButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.zGbnIq_secondaryButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-solid)}.zGbnIq_dangerButton{box-sizing:border-box;border-radius:var(--dsw-radius-md);height:36px;color:var(--dsw-alias-state-error-primary);font:inherit;cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.zGbnIq_dangerButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}.zGbnIq_rowActions .zGbnIq_secondaryButton,.zGbnIq_rowActions .zGbnIq_dangerButton{border-radius:var(--dsw-radius-sm);height:28px;padding:0 10px;font-size:12px;line-height:18px}.zGbnIq_primaryButton:disabled,.zGbnIq_secondaryButton:disabled,.zGbnIq_dangerButton:disabled,.zGbnIq_addButton:disabled,.zGbnIq_linkButton:disabled,.zGbnIq_addModelButton:disabled{opacity:.4;cursor:default}.zGbnIq_primaryButton:focus-visible,.zGbnIq_secondaryButton:focus-visible,.zGbnIq_dangerButton:focus-visible,.zGbnIq_addButton:focus-visible,.zGbnIq_linkButton:focus-visible,.zGbnIq_addModelButton:focus-visible,.zGbnIq_iconButton:focus-visible,.zGbnIq_customizedSummary:focus-visible{box-shadow:0 0 0 2px var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline:none}.zGbnIq_editor{border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-module-platform);flex-direction:column;gap:14px;padding:14px 16px;display:flex}.zGbnIq_editorHeader{align-items:baseline;gap:8px;display:flex}.zGbnIq_editorTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:500;line-height:22px}.zGbnIq_editorRoute{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.zGbnIq_field{flex-direction:column;gap:6px;display:flex}.zGbnIq_fieldLabel{color:var(--dsw-alias-label-secondary);align-items:center;gap:10px;font-size:12px;font-weight:500;line-height:18px;display:inline-flex}.zGbnIq_helpButton{border:.5px solid var(--dsw-alias-border-l3);corner-shape:round;width:16px;height:16px;color:var(--dsw-alias-label-tertiary);font:inherit;text-align:center;cursor:help;background:0 0;border-radius:50%;padding:0;font-size:11px;line-height:15px}.zGbnIq_helpButton:hover,.zGbnIq_helpButton:focus-visible{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-label-tertiary)}.zGbnIq_linkButton{box-sizing:border-box;border-radius:var(--dsw-radius-sm);height:28px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;align-items:center;padding:0 10px;font-size:12px;line-height:18px;display:inline-flex}.zGbnIq_linkButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.zGbnIq_advancedHint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.zGbnIq_editorActions{justify-content:flex-end;gap:8px;display:flex}.zGbnIq_addBlock{flex-direction:column;gap:12px;display:flex}.zGbnIq_addActions{display:flex}.zGbnIq_addButton{border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);flex:1 1 0;gap:6px;min-width:180px;height:44px}.zGbnIq_addModes{flex-direction:column;align-items:flex-start;gap:8px;display:flex}.zGbnIq_addPanel{flex-direction:column;gap:14px;display:flex}.zGbnIq_addPanel[hidden]{display:none}.zGbnIq_addCard,.zGbnIq_setupCard{border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-module-platform);flex-direction:column;gap:14px;padding:14px 16px;list-style:none;display:flex}.zGbnIq_addCard .zGbnIq_editor,.zGbnIq_setupCard .zGbnIq_editor{background:0 0;padding:0}.zGbnIq_customized{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:10px}.zGbnIq_customizedSummary{border-radius:var(--dsw-radius-sm);cursor:pointer;width:fit-content;color:var(--dsw-alias-label-secondary);align-items:center;gap:6px;margin-left:-4px;padding:2px 4px;font-size:12px;font-weight:500;line-height:18px;list-style:none;display:flex}.zGbnIq_customizedSummary::-webkit-details-marker{display:none}.zGbnIq_customizedSummary:before{content:\"\";border-bottom:1.5px solid;border-right:1.5px solid;width:5px;height:5px;transition:transform .12s;transform:rotate(-45deg)translate(-1px,-1px)}.zGbnIq_customized[open]>.zGbnIq_customizedSummary:before{transform:rotate(45deg)translate(-1px,-1px)}.zGbnIq_customizedSummary:hover{color:var(--dsw-alias-label-primary)}.zGbnIq_customizedBody{flex-direction:column;gap:12px;padding-top:12px;display:flex}.zGbnIq_modelCatalog{border-top:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:10px;padding-top:12px;display:flex}.zGbnIq_modelCatalogHeading{flex-direction:column;gap:2px;display:flex}.zGbnIq_modelCatalogTitle{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:18px}.zGbnIq_modelCatalogMeta,.zGbnIq_modelEmpty{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}.zGbnIq_modelList{flex-direction:column;gap:8px;display:flex}.zGbnIq_modelListHead{justify-content:space-between;align-items:flex-start;gap:12px;display:flex}.zGbnIq_modelEntry{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);padding:6px}.zGbnIq_modelRow{grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) auto auto;align-items:center;gap:6px;display:grid}.zGbnIq_iconButton{box-sizing:border-box;border-radius:var(--dsw-radius-sm);width:28px;height:28px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;display:inline-flex}.zGbnIq_iconButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.zGbnIq_iconButton:disabled{cursor:default;opacity:.4}.zGbnIq_iconButtonDanger:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary)}.zGbnIq_modelAdvanced{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:8px 4px 2px;display:grid}.zGbnIq_modelField{flex-direction:column;gap:4px;min-width:0;display:flex}.zGbnIq_modelInputTypes{border:none;grid-column:1/-1;min-width:0;margin:0;padding:0}.zGbnIq_modelInputTypes legend{margin-bottom:4px;padding:0}.zGbnIq_modelInputChoices{flex-wrap:wrap;align-items:center;gap:16px;min-height:32px;display:flex}.zGbnIq_modelFieldLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.zGbnIq_modelReasoning{flex-direction:column;grid-column:1/-1;gap:6px;min-width:0;display:flex}.zGbnIq_modelReasoningLabel{align-items:center;gap:6px;display:inline-flex}.zGbnIq_modelReasoningHead{justify-content:space-between;align-items:center;gap:8px;display:flex}.zGbnIq_modelReasoningRow{grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:center;gap:6px;display:grid}.zGbnIq_modelReasoningRow .zGbnIq_selectInput{max-width:none}.zGbnIq_modelReasoningValueInput{font-family:var(--ds-font-family-code);font-size:13px}.zGbnIq_modelEmpty{border:1px dashed var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-lg);text-align:center;padding:12px}.zGbnIq_addModelButton{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);height:28px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;align-self:flex-start;align-items:center;gap:4px;padding:0 10px;font-size:12px;line-height:18px;display:inline-flex}.zGbnIq_addModelButton:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.zGbnIq_input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);width:100%;height:32px;font:inherit;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font-size:14px;line-height:22px}select.zGbnIq_input{cursor:pointer;max-width:240px}.zGbnIq_input:focus{border-color:var(--dsw-alias-state-business-primary);outline:none}.zGbnIq_input::placeholder{color:var(--dsw-alias-label-dimmed)}.zGbnIq_input:disabled{opacity:.6;cursor:default}.zGbnIq_keyInput{position:relative}.zGbnIq_keyInputFilled{padding-right:40px}.zGbnIq_keyToggle{border-radius:var(--dsw-radius-md);width:32px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;padding:0;display:inline-flex;position:absolute;inset:1px 1px 1px auto}.zGbnIq_keyToggle:hover:not(:disabled){color:var(--dsw-alias-label-primary)}.zGbnIq_keyToggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.zGbnIq_keyToggle:disabled{opacity:.6;cursor:default}.zGbnIq_selectInput{appearance:none;background-image:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12' fill='none'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2381858C' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\");background-position:right 12px center;background-repeat:no-repeat;background-size:12px 12px;padding-right:32px}.zGbnIq_error{color:var(--dsw-alias-state-error-primary);margin:0;font-size:12px;line-height:18px}.zGbnIq_deleteDialog{width:min(480px,100%)}.zGbnIq_deleteConfirm:not(:disabled){border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}.zGbnIq_deleteConfirm:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover-danger)}.zGbnIq_hiddenLabel{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}@media (prefers-reduced-motion:reduce){.zGbnIq_customizedSummary:before,.zGbnIq_switchThumb{transition:none}}.zGbnIq_fetchDialog{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);max-width:520px}.zGbnIq_candidateToolbar{align-items:center;gap:8px;margin-bottom:6px;display:flex}.zGbnIq_candidateSearch{flex:240px;min-width:0}.zGbnIq_candidateList{flex-direction:column;gap:2px;max-height:320px;margin:0;padding:0;list-style:none;display:flex;overflow-y:auto}.zGbnIq_candidate{border-radius:var(--dsw-radius-md)}.zGbnIq_candidateLabel{cursor:pointer;align-items:center;gap:8px;padding:6px 8px;display:flex}.zGbnIq_candidateId{min-width:0;font-family:var(--ds-font-family-code);text-overflow:ellipsis;white-space:nowrap;flex:auto;font-size:13px;overflow:hidden}.zGbnIq_candidateEmpty{color:var(--dsw-alias-label-secondary);text-align:center;margin:24px 0;font-size:13px;line-height:20px}";
		const tagId$3 = "@deepseek-ai/dsh-client-ui-settings-models/ModelsSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$3) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-settings-models";
			tag.dataset.pluginCss = tagId$3;
			tag.textContent = css$3;
			document.head.appendChild(tag);
		}
		var ModelsSection_module_css_default = {
			"accountStatus": "zGbnIq_accountStatus",
			"addActions": "zGbnIq_addActions",
			"addBlock": "zGbnIq_addBlock",
			"addButton": "zGbnIq_addButton",
			"addCard": "zGbnIq_addCard",
			"addModelButton": "zGbnIq_addModelButton",
			"addModes": "zGbnIq_addModes",
			"addPanel": "zGbnIq_addPanel",
			"advancedHint": "zGbnIq_advancedHint",
			"candidate": "zGbnIq_candidate",
			"candidateEmpty": "zGbnIq_candidateEmpty",
			"candidateId": "zGbnIq_candidateId",
			"candidateLabel": "zGbnIq_candidateLabel",
			"candidateList": "zGbnIq_candidateList",
			"candidateSearch": "zGbnIq_candidateSearch",
			"candidateToolbar": "zGbnIq_candidateToolbar",
			"credentialDot": "zGbnIq_credentialDot",
			"credentialDotConfigured": "zGbnIq_credentialDotConfigured",
			"credentialDotMissing": "zGbnIq_credentialDotMissing",
			"customized": "zGbnIq_customized",
			"customizedBody": "zGbnIq_customizedBody",
			"customizedSummary": "zGbnIq_customizedSummary",
			"dangerButton": "zGbnIq_dangerButton",
			"deleteConfirm": "zGbnIq_deleteConfirm",
			"deleteDialog": "zGbnIq_deleteDialog",
			"editor": "zGbnIq_editor",
			"editorActions": "zGbnIq_editorActions",
			"editorHeader": "zGbnIq_editorHeader",
			"editorRoute": "zGbnIq_editorRoute",
			"editorTitle": "zGbnIq_editorTitle",
			"error": "zGbnIq_error",
			"fetchDialog": "zGbnIq_fetchDialog",
			"field": "zGbnIq_field",
			"fieldLabel": "zGbnIq_fieldLabel",
			"helpButton": "zGbnIq_helpButton",
			"hiddenLabel": "zGbnIq_hiddenLabel",
			"iconButton": "zGbnIq_iconButton",
			"iconButtonDanger": "zGbnIq_iconButtonDanger",
			"input": "zGbnIq_input",
			"intro": "zGbnIq_intro",
			"keyInput": "zGbnIq_keyInput",
			"keyInputFilled": "zGbnIq_keyInputFilled",
			"keyToggle": "zGbnIq_keyToggle",
			"linkButton": "zGbnIq_linkButton",
			"modelAdvanced": "zGbnIq_modelAdvanced",
			"modelCatalog": "zGbnIq_modelCatalog",
			"modelCatalogHeading": "zGbnIq_modelCatalogHeading",
			"modelCatalogMeta": "zGbnIq_modelCatalogMeta",
			"modelCatalogTitle": "zGbnIq_modelCatalogTitle",
			"modelEmpty": "zGbnIq_modelEmpty",
			"modelEntry": "zGbnIq_modelEntry",
			"modelField": "zGbnIq_modelField",
			"modelFieldLabel": "zGbnIq_modelFieldLabel",
			"modelInputChoices": "zGbnIq_modelInputChoices",
			"modelInputTypes": "zGbnIq_modelInputTypes",
			"modelList": "zGbnIq_modelList",
			"modelListHead": "zGbnIq_modelListHead",
			"modelReasoning": "zGbnIq_modelReasoning",
			"modelReasoningHead": "zGbnIq_modelReasoningHead",
			"modelReasoningLabel": "zGbnIq_modelReasoningLabel",
			"modelReasoningRow": "zGbnIq_modelReasoningRow",
			"modelReasoningValueInput": "zGbnIq_modelReasoningValueInput",
			"modelRow": "zGbnIq_modelRow",
			"notice": "zGbnIq_notice",
			"primaryButton": "zGbnIq_primaryButton",
			"rowActions": "zGbnIq_rowActions",
			"rowCard": "zGbnIq_rowCard",
			"rowHead": "zGbnIq_rowHead",
			"rowIdentity": "zGbnIq_rowIdentity",
			"rowName": "zGbnIq_rowName",
			"rowTag": "zGbnIq_rowTag",
			"rows": "zGbnIq_rows",
			"savedNotice": "zGbnIq_savedNotice",
			"secondaryButton": "zGbnIq_secondaryButton",
			"section": "zGbnIq_section",
			"selectInput": "zGbnIq_selectInput",
			"setupCard": "zGbnIq_setupCard",
			"switchThumb": "zGbnIq_switchThumb",
			"title": "zGbnIq_title"
		};
		//#endregion
		//#region lib/types/client/ApiKeyInput.js
		/** Write-only credential input with the same reveal behavior as masked conversation text. */
		const EYE_CONTOUR = "M1.5 8C2.9 5.25 5.25 3.5 8 3.5C10.75 3.5 13.1 5.25 14.5 8C13.1 10.75 10.75 12.5 8 12.5C5.25 12.5 2.9 10.75 1.5 8Z";
		const EYE_PATH = `${EYE_CONTOUR}M10 8C10 9.1 9.1 10 8 10C6.9 10 6 9.1 6 8C6 6.9 6.9 6 8 6C9.1 6 10 6.9 10 8Z`;
		const EYE_OFF_PATH = `${EYE_CONTOUR}M2.5 2.5L13.5 13.5`;
		/**
		* Reveal only a nonempty draft; a different value starts masked, as in SecretText.
		* @param props - current draft, input attributes, and translated control labels.
		* @returns a password input with an optional reveal button.
		*/
		function ApiKeyInput({ value, t, ...props }) {
			const [revealedValue, setRevealedValue] = (0, react.useState)();
			const revealed = value.length > 0 && revealedValue === value;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ModelsSection_module_css_default["keyInput"],
				children: [(0, react_jsx_runtime.jsx)("input", {
					...props,
					className: `${ModelsSection_module_css_default["input"]} ${value.length > 0 ? ModelsSection_module_css_default["keyInputFilled"] : ""}`,
					type: revealed ? "text" : "password",
					autoComplete: "new-password",
					value,
					onChange: (event) => {
						setRevealedValue(void 0);
						props.onChange?.(event);
					}
				}), value.length === 0 ? null : (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: ModelsSection_module_css_default["keyToggle"],
					"aria-label": t(revealed ? "keyHide" : "keyReveal"),
					"aria-pressed": revealed,
					disabled: props.disabled,
					onClick: () => {
						setRevealedValue(revealed ? void 0 : value);
					},
					children: (0, react_jsx_runtime.jsx)("svg", {
						width: "16",
						height: "16",
						viewBox: "0 0 16 16",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: 1.3,
						strokeLinecap: "round",
						"aria-hidden": "true",
						children: (0, react_jsx_runtime.jsx)("path", { d: revealed ? EYE_OFF_PATH : EYE_PATH })
					})
				})]
			});
		}
		//#endregion
		//#region lib/types/client/EditorFooter.js
		/**
		* Render one provider card's action row.
		* @param props - the labels, commit gating, and handlers the owning card supplies.
		* @returns the cancel/commit row.
		*/
		function EditorFooter(props) {
			const { t } = props;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ModelsSection_module_css_default["editorActions"],
				children: [(0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: ModelsSection_module_css_default["secondaryButton"],
					disabled: props.busy,
					onClick: props.onCancel,
					children: t(props.cancelLabelKey ?? "cancel")
				}), (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: ModelsSection_module_css_default["primaryButton"],
					disabled: props.submitDisabled,
					onClick: props.onSubmit,
					children: props.busy ? t(props.submitBusyLabelKey) : t(props.submitLabelKey)
				})]
			});
		}
		//#endregion
		//#region lib/types/client/ModelInputTypes.js
		/**
		* Edit a nonempty set of input types, displaying inherited types before an override exists.
		* @param props - model declaration and row replacement action.
		* @returns the labeled text and image checkboxes.
		*/
		function ModelInputTypes({ model, field, position, disabled, fallback, t, onChange }) {
			const modalities = model[field];
			const selected = Array.isArray(modalities) && modalities.length > 0 ? modalities : fallback ?? ["text"];
			return (0, react_jsx_runtime.jsxs)("fieldset", {
				className: ModelsSection_module_css_default["modelInputTypes"],
				"aria-label": `${t("modelInputTypes")} ${String(position)}`,
				children: [(0, react_jsx_runtime.jsx)("legend", {
					className: ModelsSection_module_css_default["modelFieldLabel"],
					children: t("modelInputTypes")
				}), (0, react_jsx_runtime.jsx)("div", {
					className: ModelsSection_module_css_default["modelInputChoices"],
					children: ["text", "image"].map((modality) => (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Checkbox, {
						label: t(modality === "text" ? "modelInputText" : "modelInputImage"),
						checked: selected.includes(modality),
						disabled: disabled || selected.length === 1 && selected.includes(modality),
						onChange: (checked) => {
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
		//#endregion
		//#region lib/types/client/ModelReasoningEfforts.js
		/** Reasoning-level declarations for a model on a hand-declared pi-ai route. */
		/** Levels a model offers when the switch is turned on, where the schema lists them: Off plus the common OpenAI-compatible trio. */
		const INITIAL_LEVELS = [
			"off",
			"low",
			"medium",
			"high"
		];
		/** The wire value a level sends unless its row says otherwise; `null` is the Off entry that sends nothing. */
		function defaultValue(level) {
			return level === "off" ? null : level;
		}
		/**
		* Whether pi-ai accepts a stored value: a non-empty string, or nothing for Off.
		* @param level - the declared level.
		* @param wire - the value stored for it.
		* @returns whether the adapter would resolve the entry.
		*/
		function acceptedValue(level, wire) {
			return typeof wire === "string" ? wire.length > 0 : wire === null && level === "off";
		}
		/**
		* Read the declared levels from a row in their stored order, including a key
		* the offered levels do not name, so an edit never drops it.
		* @param model - model row as drafted.
		* @returns the entries; empty for a valueless field, which pi-ai refuses, and
		* `undefined` when the field is absent or `false`.
		*/
		function readEfforts(model) {
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
		function withEfforts(model, entries) {
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
		function validateReasoningEfforts(value) {
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
		function ModelReasoningEfforts({ model, levels, position, disabled, t, onChange }) {
			const entries = readEfforts(model);
			const [typing, setTyping] = (0, react.useState)(void 0);
			const label = `${t("modelReasoning")} ${String(position)}`;
			const used = entries?.map(([level]) => level) ?? [];
			const write = (next) => {
				onChange(withEfforts(model, next));
			};
			const replaceAt = (current, index, entry) => current.map((existing, at) => at === index ? entry : existing);
			const changeLevel = (current, index, from, wire, to) => {
				write(replaceAt(current, index, [to, typeof wire === "string" && wire.length > 0 && wire !== from && from !== "off" && to !== "off" ? wire : defaultValue(to)]));
			};
			const addLevel = (current) => {
				const highest = Math.max(-1, ...used.map((level) => levels.indexOf(level)));
				const level = levels.find((candidate, index) => index > highest && !used.includes(candidate)) ?? levels.find((candidate) => !used.includes(candidate));
				/* v8 ignore next -- the add button is disabled once every level has a row */
				if (level === void 0) return;
				write([...current, [level, defaultValue(level)]]);
			};
			const editValue = (current, index, level, text) => {
				setTyping({
					level,
					text
				});
				const trimmed = text.trim();
				write(replaceAt(current, index, [level, trimmed.length === 0 ? defaultValue(level) : trimmed]));
			};
			const leaveValue = (current, index, level, wire) => {
				setTyping(void 0);
				if (!acceptedValue(level, wire)) write(replaceAt(current, index, [level, defaultValue(level)]));
			};
			const choicesFor = (level) => [...levels.includes(level) ? [] : [level], ...levels.filter((choice) => choice === level || !used.includes(choice))];
			const initialEntries = INITIAL_LEVELS.filter((level) => levels.includes(level)).map((level) => [level, defaultValue(level)]);
			const refused = entries?.some(([level, wire]) => !acceptedValue(level, wire)) === true;
			const missingLevel = entries !== void 0 && !used.some((level) => level !== "off");
			return (0, react_jsx_runtime.jsxs)("div", {
				className: ModelsSection_module_css_default["modelReasoning"],
				role: "group",
				"aria-label": label,
				children: [(0, react_jsx_runtime.jsxs)("div", {
					className: ModelsSection_module_css_default["modelReasoningHead"],
					children: [(0, react_jsx_runtime.jsxs)("span", {
						className: `${ModelsSection_module_css_default["modelFieldLabel"]} ${ModelsSection_module_css_default["modelReasoningLabel"]}`,
						children: [t("modelReasoning"), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: t("modelReasoningHelpText"),
							side: "right",
							delayMs: 0,
							focusDelayMs: 0,
							portal: true,
							openOnClick: true,
							children: (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ModelsSection_module_css_default["helpButton"],
								"aria-label": t("modelReasoningHelp"),
								children: "?"
							})
						})]
					}), (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Switch, {
						checked: entries !== void 0,
						label,
						disabled,
						onChange: (on) => {
export {};
