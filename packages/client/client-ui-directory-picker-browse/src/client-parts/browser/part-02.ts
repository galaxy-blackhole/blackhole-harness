/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc LAT NGUYEN VAN THAN nua client @deepseek-ai/dsh-client-ui-directory-picker-browse — sinh boi tools/split-client-bundle.ts
 */
// @ts-nocheck

		//#region \0dsh-css:/home/runner/work/deepseek-harness/deepseek-harness/packages/client/ui-directory-picker-browse/src/client/DirectoryBrowser.module.css.mjs
		const css = ".ZuhsRW_dialog.ZuhsRW_dialog{--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);gap:0;width:min(680px,100%);height:min(500px,100dvh - 32px);padding:0}.ZuhsRW_editorScope{display:contents}.ZuhsRW_header{border-bottom:.5px solid var(--dsw-alias-border-l3);flex-direction:column;flex:none;gap:8px;padding:16px 14px 8px 24px;display:flex}.ZuhsRW_title{min-height:28px;color:var(--dsw-alias-label-primary);align-items:flex-end;margin:0;font-size:16px;font-weight:510;line-height:24px;display:flex}.ZuhsRW_crumbBar{box-sizing:border-box;border-radius:var(--dsw-radius-sm);border:1px solid #0000;align-items:center;gap:4px;min-height:24px;margin-left:-9px;padding:0 8px;display:flex}.ZuhsRW_crumbBar:has(.ZuhsRW_crumbEditZone:enabled:hover),.ZuhsRW_crumbBar:has(.ZuhsRW_crumbEditZone:focus-visible),.ZuhsRW_crumbBar:has(.ZuhsRW_pathInput){border-color:var(--dsw-alias-border-l2)}.ZuhsRW_millerRow{scrollbar-width:none;flex:1 1 0;align-items:stretch;gap:12px;min-height:0;display:flex;overflow-x:auto}.ZuhsRW_crumbTrail{scrollbar-width:none;flex:0 auto;align-items:center;gap:4px;min-width:0;display:flex;overflow-x:auto}.ZuhsRW_crumbSeat{flex:none;align-items:center;gap:4px;min-width:0;display:inline-flex}.ZuhsRW_crumb{text-overflow:ellipsis;white-space:nowrap;max-width:160px;color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;padding:0;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.ZuhsRW_crumb:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.ZuhsRW_crumb:hover{color:var(--dsw-alias-label-primary)}.ZuhsRW_crumbChevron{color:var(--dsw-alias-label-tertiary);flex:none}.ZuhsRW_crumbEditZone{cursor:text;background:0 0;border:none;outline:none;flex:1 0 34px;justify-content:flex-end;align-items:center;min-width:34px;height:22px;padding:0;display:flex}.ZuhsRW_crumbEditGlyph{color:var(--dsw-alias-label-tertiary);flex:none}.ZuhsRW_crumbEditZone:enabled:hover .ZuhsRW_crumbEditGlyph,.ZuhsRW_crumbEditZone:focus-visible .ZuhsRW_crumbEditGlyph{color:var(--dsw-alias-label-primary)}.ZuhsRW_crumbEditZone:disabled{cursor:default}.ZuhsRW_crumbEditZone:disabled .ZuhsRW_crumbEditGlyph{color:var(--dsw-alias-label-caption)}.ZuhsRW_pathInput{box-sizing:border-box;min-width:0;height:22px;color:var(--dsw-alias-label-primary);background:0 0;border:none;outline:none;flex:1 1 0;padding:0;font-size:13px;line-height:20px}.ZuhsRW_content{flex-direction:column;flex:1 1 0;min-height:0;padding:16px 16px 16px 24px;display:flex;position:relative}.ZuhsRW_column{flex-direction:column;flex:1 1 0;gap:2px;min-width:256px;padding-right:8px;display:flex;overflow-y:auto}.ZuhsRW_divider{background:var(--dsw-alias-border-l3);flex:none;width:.5px}.ZuhsRW_rowSeat{flex:none;display:flex}.ZuhsRW_row{border-radius:var(--dsw-radius-sm);text-align:left;cursor:pointer;background:0 0;border:none;flex:none;align-items:center;gap:4px;width:100%;height:28px;padding:4px;display:flex}.ZuhsRW_row:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.ZuhsRW_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.ZuhsRW_rowSelected,.ZuhsRW_rowSelected:hover{background:var(--dsw-alias-interactive-bg-active,var(--dsw-alias-interactive-bg-hover))}.ZuhsRW_rowIcon{color:var(--dsw-alias-label-secondary);flex:none}.ZuhsRW_rowIconSelected{color:var(--dsw-alias-button-info-fill);flex:none}.ZuhsRW_rowName{text-overflow:ellipsis;white-space:nowrap;min-width:0;color:var(--dsw-alias-label-primary);flex:1 1 0;font-size:13px;font-weight:500;line-height:20px;overflow:hidden}.ZuhsRW_rowChevron{color:var(--dsw-alias-label-tertiary);flex:none}.ZuhsRW_status,.ZuhsRW_error{padding:4px 120px 4px 4px;font-size:12px;line-height:18px}.ZuhsRW_status{color:var(--dsw-alias-label-secondary)}.ZuhsRW_error{color:var(--dsw-alias-state-error-primary)}.ZuhsRW_loadingFloat{background:var(--dsw-alias-bg-layer-2);padding:2px 8px;position:absolute;bottom:8px;right:16px}.ZuhsRW_footerBar{border-top:.5px solid var(--dsw-alias-border-l3);flex-wrap:wrap;flex:none;align-items:center;gap:8px;padding:16px 24px;display:flex}.ZuhsRW_showHiddenToggle{color:var(--dsw-alias-label-secondary);cursor:pointer;white-space:nowrap;background:0 0;border:none;align-items:center;gap:4px;padding:0;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}.ZuhsRW_showHiddenToggle:hover{color:var(--dsw-alias-label-primary)}.ZuhsRW_showHiddenToggle:disabled{color:var(--dsw-alias-label-caption);cursor:default}.ZuhsRW_showHiddenToggleActive{color:var(--dsw-alias-label-primary)}.ZuhsRW_footerGap{flex:1 1 0}.ZuhsRW_footerAction{min-width:72px}.ZuhsRW_createDialog.ZuhsRW_createDialog{gap:0;width:min(380px,100%);padding:0}.ZuhsRW_createBody{flex-direction:column;gap:12px;padding:22px 24px 20px;display:flex}.ZuhsRW_createTitle{color:var(--dsw-alias-label-primary);margin:0;font-size:16px;font-weight:510;line-height:24px}.ZuhsRW_createIn{color:var(--dsw-alias-label-primary);margin:0;font-size:14px;line-height:22px}.ZuhsRW_createInput{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);width:100%;height:44px;color:var(--dsw-alias-label-primary);background:0 0;outline:none;padding:7px 14px;font-size:14px;line-height:22px}.ZuhsRW_createInput::placeholder{color:var(--dsw-alias-label-caption)}.ZuhsRW_createActions{justify-content:flex-end;align-items:center;gap:8px;margin-top:8px;display:flex}";
		const tagId = "@deepseek-ai/dsh-client-ui-directory-picker-browse/DirectoryBrowser.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-directory-picker-browse";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var DirectoryBrowser_module_css_default = {
			"column": "ZuhsRW_column",
			"content": "ZuhsRW_content",
			"createActions": "ZuhsRW_createActions",
			"createBody": "ZuhsRW_createBody",
			"createDialog": "ZuhsRW_createDialog",
			"createIn": "ZuhsRW_createIn",
			"createInput": "ZuhsRW_createInput",
			"createTitle": "ZuhsRW_createTitle",
			"crumb": "ZuhsRW_crumb",
			"crumbBar": "ZuhsRW_crumbBar",
			"crumbChevron": "ZuhsRW_crumbChevron",
			"crumbEditGlyph": "ZuhsRW_crumbEditGlyph",
			"crumbEditZone": "ZuhsRW_crumbEditZone",
			"crumbSeat": "ZuhsRW_crumbSeat",
			"crumbTrail": "ZuhsRW_crumbTrail",
			"dialog": "ZuhsRW_dialog",
			"divider": "ZuhsRW_divider",
			"editorScope": "ZuhsRW_editorScope",
			"error": "ZuhsRW_error",
			"footerAction": "ZuhsRW_footerAction",
			"footerBar": "ZuhsRW_footerBar",
			"footerGap": "ZuhsRW_footerGap",
			"header": "ZuhsRW_header",
			"loadingFloat": "ZuhsRW_loadingFloat",
			"millerRow": "ZuhsRW_millerRow",
			"pathInput": "ZuhsRW_pathInput",
			"row": "ZuhsRW_row",
			"rowChevron": "ZuhsRW_rowChevron",
			"rowIcon": "ZuhsRW_rowIcon",
			"rowIconSelected": "ZuhsRW_rowIconSelected",
			"rowName": "ZuhsRW_rowName",
			"rowSeat": "ZuhsRW_rowSeat",
			"rowSelected": "ZuhsRW_rowSelected",
			"showHiddenToggle": "ZuhsRW_showHiddenToggle",
			"showHiddenToggleActive": "ZuhsRW_showHiddenToggleActive",
			"status": "ZuhsRW_status",
			"title": "ZuhsRW_title"
		};
		//#endregion

export {};
