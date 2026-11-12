/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Bay module CSS cua row ui-tool — NGUYEN VAN tung byte tu bundle goc, giu nguyen hash lop goc
 */

import { CSS_ORDER, STYLE_TAGS } from "./ids.ts";

/** Cap [nhan, id the style, van ban CSS, bang ten lop] theo dung thu tu ban goc chen. */
interface StyleModule {
  /** Id the style (data-plugin-css). */
  readonly tagId: string;
  /** Van ban CSS nguyen van. */
  readonly css: string;
  /** Bang anh xa ten lop logic sang ten lop da bam. */
  readonly classes: Record<string, string>;
}

/** Van ban CSS nguyen van cua AskQuestionCard.module.css (bundle goc). */
const askQuestionCardCss = ".fsXYAq_card{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-base);flex-direction:column;gap:16px;max-height:360px;margin:4px 0 4px 4px;padding:16px 20px;display:flex;overflow-y:auto}.fsXYAq_item{flex-direction:column;gap:2px;min-width:0;display:flex}.fsXYAq_question,.fsXYAq_answer{white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));margin:0}.fsXYAq_question{color:var(--dsw-alias-label-tertiary)}.fsXYAq_answer{color:var(--dsw-alias-label-primary)}.fsXYAq_answerLine{display:block}.fsXYAq_skipped{color:var(--dsw-alias-label-tertiary)}.fsXYAq_verdict{color:var(--dsw-alias-label-primary);font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));margin:0}.fsXYAq_questionList{flex-direction:column;gap:8px;margin:0;padding-left:20px;display:flex}.fsXYAq_unansweredQuestion{color:var(--dsw-alias-label-tertiary);white-space:pre-wrap;overflow-wrap:anywhere;font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px))}";

/** Bang ten lop cua AskQuestionCard.module.css — nguyen van hash lop goc. */
export const askQuestionCardClasses: Record<string, string> = {
	"answer": "fsXYAq_answer",
	"answerLine": "fsXYAq_answerLine",
	"card": "fsXYAq_card",
	"item": "fsXYAq_item",
	"question": "fsXYAq_question",
	"questionList": "fsXYAq_questionList",
	"skipped": "fsXYAq_skipped",
	"unansweredQuestion": "fsXYAq_unansweredQuestion",
	"verdict": "fsXYAq_verdict"
};

/** Van ban CSS nguyen van cua ToolDetails.module.css (bundle goc). */
const toolDetailsCss = ".DXqwVW_root{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-13);margin:4px 0 4px 4px;overflow:hidden}.DXqwVW_list{max-height:320px;margin:0;padding:0;list-style:none;overflow-y:auto}.DXqwVW_item,.DXqwVW_empty{margin:0;padding:10px 14px}.DXqwVW_item+.DXqwVW_item{border-top:.5px solid var(--dsw-alias-border-l2)}.DXqwVW_root[data-inspect]:not([data-caption])>.DXqwVW_list>.DXqwVW_item,.DXqwVW_root[data-inspect]:not([data-caption]) .DXqwVW_empty,.DXqwVW_root[data-inspect] .DXqwVW_caption{padding-inline-end:88px}.DXqwVW_caption{color:var(--dsw-alias-label-caption);padding:10px 14px 6px;font-size:12px}.DXqwVW_heading{flex-wrap:wrap;align-items:baseline;gap:8px;display:flex}.DXqwVW_text{white-space:pre-wrap;overflow-wrap:anywhere;flex:1;min-width:0}.DXqwVW_status{flex:none;justify-content:center;align-self:flex-start;align-items:center;width:14px;height:18px;font-size:16px;line-height:18px;display:inline-flex}.DXqwVW_pending{box-sizing:border-box;border:1px solid var(--dsw-alias-label-tertiary);border-radius:2px;width:10px;height:10px}.DXqwVW_heading:has(.DXqwVW_statusText) .DXqwVW_text{flex-basis:12em}.DXqwVW_statusText{color:var(--dsw-alias-label-caption);white-space:nowrap;margin-inline-start:auto;font-size:12px}.DXqwVW_previous,.DXqwVW_unchanged{color:var(--dsw-alias-label-tertiary)}.DXqwVW_item[data-change=added] .DXqwVW_status{color:var(--dsw-alias-state-success-primary)}.DXqwVW_item[data-change=removed] .DXqwVW_status{color:var(--dsw-alias-state-error-primary)}.DXqwVW_item[data-change=removed] .DXqwVW_text{color:var(--dsw-alias-label-tertiary);text-decoration:line-through}.DXqwVW_unchanged{border-top:.5px solid var(--dsw-alias-border-l2)}.DXqwVW_unchanged summary{cursor:pointer;align-items:center;gap:6px;padding:9px 14px;list-style:none;display:flex}.DXqwVW_unchanged summary::-webkit-details-marker{display:none}.DXqwVW_unchanged[open] summary svg{transform:rotate(90deg)}.DXqwVW_fields{margin:0}.DXqwVW_heading+.DXqwVW_fields{margin-top:6px}.DXqwVW_field{grid-template-columns:5.5em minmax(0,1fr);gap:12px;display:grid}.DXqwVW_field+.DXqwVW_field{margin-top:4px}.DXqwVW_field dt{color:var(--dsw-alias-label-caption)}.DXqwVW_field dd{white-space:pre-wrap;overflow-wrap:anywhere;margin:0}.DXqwVW_badge{color:var(--dsw-alias-label-caption);flex:none;align-items:center;gap:5px;font-size:12px;display:inline-flex}.DXqwVW_badge:before{content:\"\";corner-shape:round;background:currentColor;border-radius:50%;width:5px;height:5px}.DXqwVW_badge[data-tone=info]{color:var(--dsw-alias-state-business-primary)}.DXqwVW_badge[data-tone=success]{color:var(--dsw-alias-state-success-primary)}.DXqwVW_badge[data-tone=warning]{color:var(--dsw-alias-state-warn-primary)}.DXqwVW_badge[data-tone=error]{color:var(--dsw-alias-state-error-primary)}.DXqwVW_subtitle{color:var(--dsw-alias-label-tertiary);overflow-wrap:anywhere;margin-top:3px;font-size:12px}.DXqwVW_description{color:var(--dsw-alias-label-caption);white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0}.DXqwVW_lines{white-space:pre-wrap;overflow-wrap:anywhere;margin:6px 0 0;padding-inline-start:18px}.DXqwVW_lines li+li{margin-top:4px}.DXqwVW_group{border-top:.5px solid var(--dsw-alias-border-l2);margin-top:8px}.DXqwVW_group>summary{color:var(--dsw-alias-label-caption);cursor:pointer;overflow-wrap:anywhere;align-items:center;gap:6px;padding:8px 0 0;list-style:none;display:flex}.DXqwVW_group>summary::-webkit-details-marker{display:none}.DXqwVW_group[open]>summary svg{transform:rotate(90deg)}.DXqwVW_group>summary svg{flex:none}.DXqwVW_group .DXqwVW_list{max-height:none;overflow:visible}.DXqwVW_group .DXqwVW_item{padding:9px 0 2px 20px}.DXqwVW_prose,.DXqwVW_code{max-width:100%;font-size:13px}.DXqwVW_prose{margin-top:8px}.DXqwVW_root .DXqwVW_item>.DXqwVW_code{max-height:240px;margin:8px 0 0;overflow:auto}.DXqwVW_root .DXqwVW_item:has(>.DXqwVW_code:only-child){padding:0}.DXqwVW_root .DXqwVW_item>.DXqwVW_code:only-child{margin:0}.DXqwVW_root .DXqwVW_group .DXqwVW_item:has(>.DXqwVW_code:only-child){padding:4px 0 0 20px}.DXqwVW_path{min-width:0;color:inherit;font:inherit;text-align:start;overflow-wrap:anywhere;cursor:pointer;background:0 0;border:none;flex:1;padding:0}.DXqwVW_path:hover{text-decoration:underline}.DXqwVW_path:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:3px}";

/** Bang ten lop cua ToolDetails.module.css — nguyen van hash lop goc. */
export const toolDetailsClasses: Record<string, string> = {
	"badge": "DXqwVW_badge",
	"caption": "DXqwVW_caption",
	"code": "DXqwVW_code",
	"description": "DXqwVW_description",
	"empty": "DXqwVW_empty",
	"field": "DXqwVW_field",
	"fields": "DXqwVW_fields",
	"group": "DXqwVW_group",
	"heading": "DXqwVW_heading",
	"item": "DXqwVW_item",
	"lines": "DXqwVW_lines",
	"list": "DXqwVW_list",
	"path": "DXqwVW_path",
	"pending": "DXqwVW_pending",
	"previous": "DXqwVW_previous",
	"prose": "DXqwVW_prose",
	"root": "DXqwVW_root",
	"status": "DXqwVW_status",
	"statusText": "DXqwVW_statusText",
	"subtitle": "DXqwVW_subtitle",
	"text": "DXqwVW_text",
	"unchanged": "DXqwVW_unchanged"
};

/** Van ban CSS nguyen van cua ExitCodeBadge.module.css (bundle goc). */
const exitCodeBadgeCss = ".YJoo9W_badge{flex:none;gap:5px;margin-left:8px}.YJoo9W_dot{corner-shape:round;background:var(--dsw-alias-state-error-primary);border-radius:50%;flex:none;width:4px;height:4px}";

/** Bang ten lop cua ExitCodeBadge.module.css — nguyen van hash lop goc. */
export const exitCodeBadgeClasses: Record<string, string> = {
	"badge": "YJoo9W_badge",
	"dot": "YJoo9W_dot"
};

/** Van ban CSS nguyen van cua ToolRow.module.css (bundle goc). */
const toolRowCss = ".o3BgMG_root{flex-direction:column;display:flex}.o3BgMG_leading{flex-shrink:0}.o3BgMG_root[data-tool^=cordis_] .o3BgMG_title{font-weight:500}.o3BgMG_title{font-weight:400}.o3BgMG_sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.o3BgMG_summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:auto;overflow:hidden}.o3BgMG_summarySuffix{white-space:nowrap;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:none;margin-left:4px}.o3BgMG_diffStat{font-family:var(--ds-font-family-code);font-size:calc(var(--dsh-content-font-size-secondary,13px) - 2px);margin-left:10px;transform:translateY(.5px)}.o3BgMG_row:is(:hover,[aria-expanded=true]) .o3BgMG_diffAdded{color:var(--dsw-alias-state-success-primary)}.o3BgMG_row:is(:hover,[aria-expanded=true]) .o3BgMG_diffRemoved{color:var(--dsw-alias-state-error-primary)}.o3BgMG_fileLink{text-overflow:ellipsis;white-space:nowrap;min-width:0;font:inherit;text-align:left;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));color:inherit;text-underline-offset:3px;cursor:pointer;background:0 0;border:none;flex:0 auto;margin:0;padding:0;text-decoration:underline 1px dotted;overflow:hidden}.o3BgMG_errorSummary{color:var(--dsw-alias-state-error-primary)}.o3BgMG_stoppedSummary{color:var(--dsw-alias-state-warn-label)}.o3BgMG_bodyWrap{flex-direction:column;display:flex}.o3BgMG_inspectButton{border:.5px solid var(--dsw-alias-border-l3);corner-shape:round;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;border-radius:999px;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;font-size:11px;line-height:16px;transition:opacity .1s;display:inline-flex}.o3BgMG_root:hover .o3BgMG_inspectButton,.o3BgMG_inspectButton:focus-visible{opacity:1}.o3BgMG_detailsBodyWrap{position:relative}.o3BgMG_detailsBodyWrap .o3BgMG_inspectButton{margin:0;position:absolute;top:12px;right:12px}.o3BgMG_inspectButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}.o3BgMG_bodyScroll{max-height:260px;overflow-y:auto}.o3BgMG_ioCard{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small);flex-direction:column;margin:4px 0 4px 4px;display:flex}.o3BgMG_ioSection{grid-template-columns:max-content 1fr;align-items:baseline;column-gap:14px;max-height:150px;padding:12px 16px;display:grid;overflow-y:auto}.o3BgMG_ioSection::-webkit-scrollbar-thumb{border-radius:var(--dsw-radius-sm);background-clip:padding-box;border:2px solid #0000}.o3BgMG_ioSection::-webkit-scrollbar-track{margin:6px 0}.o3BgMG_ioLabel{color:var(--dsw-alias-label-caption);align-self:start;position:sticky;top:0}.o3BgMG_ioDivider{background:var(--dsw-alias-border-l2);flex:none;height:.5px}.o3BgMG_ioText{white-space:pre-wrap;word-break:break-word;min-width:0;color:var(--dsw-alias-label-secondary)}.o3BgMG_ioText[data-error]{color:var(--dsw-alias-state-error-primary)}.o3BgMG_codeBody,.o3BgMG_terminalBody,.o3BgMG_diffBody,.o3BgMG_readBody,.o3BgMG_imageBody,.o3BgMG_searchBody,.o3BgMG_webBody{margin:4px 0 4px 4px}.o3BgMG_searchRecovery{white-space:pre-wrap;overflow-wrap:anywhere;font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-tertiary);margin:4px 0 4px 4px}.o3BgMG_imageMeta{white-space:pre-wrap;overflow-wrap:anywhere;font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-tertiary);margin-top:4px}.o3BgMG_imageExtra{white-space:pre-wrap;overflow-wrap:anywhere;font:var(--dsw-font-xs-13);color:var(--dsw-alias-label-tertiary);margin-top:4px}.o3BgMG_terminalBody{--dsl-terminal-font:var(--dsw-font-markdown-code-block-small);--dsl-terminal-line-height:18px;--dsl-terminal-output-max-height:224px;--dsl-terminal-command-whitespace:pre-wrap;border:.5px solid var(--dsw-alias-border-l1)}.o3BgMG_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";

/** Bang ten lop cua ToolRow.module.css — nguyen van hash lop goc. */
export const toolRowClasses: Record<string, string> = {
	"bodyScroll": "o3BgMG_bodyScroll",
	"bodyWrap": "o3BgMG_bodyWrap",
	"codeBody": "o3BgMG_codeBody",
	"detailsBodyWrap": "o3BgMG_detailsBodyWrap",
	"diffAdded": "o3BgMG_diffAdded",
	"diffBody": "o3BgMG_diffBody",
	"diffRemoved": "o3BgMG_diffRemoved",
	"diffStat": "o3BgMG_diffStat",
	"errorSummary": "o3BgMG_errorSummary",
	"fileLink": "o3BgMG_fileLink",
	"imageBody": "o3BgMG_imageBody",
	"imageExtra": "o3BgMG_imageExtra",
	"imageMeta": "o3BgMG_imageMeta",
	"inspectButton": "o3BgMG_inspectButton",
	"ioCard": "o3BgMG_ioCard",
	"ioDivider": "o3BgMG_ioDivider",
	"ioLabel": "o3BgMG_ioLabel",
	"ioSection": "o3BgMG_ioSection",
	"ioText": "o3BgMG_ioText",
	"leading": "o3BgMG_leading",
	"readBody": "o3BgMG_readBody",
	"root": "o3BgMG_root",
	"row": "o3BgMG_row",
	"searchBody": "o3BgMG_searchBody",
	"searchRecovery": "o3BgMG_searchRecovery",
	"sep": "o3BgMG_sep",
	"stoppedSummary": "o3BgMG_stoppedSummary",
	"summary": "o3BgMG_summary",
	"summarySuffix": "o3BgMG_summarySuffix",
	"terminalBody": "o3BgMG_terminalBody",
	"title": "o3BgMG_title",
	"visuallyHidden": "o3BgMG_visuallyHidden",
	"webBody": "o3BgMG_webBody"
};

/** Van ban CSS nguyen van cua ToolCallTree.module.css (bundle goc). */
const toolCallTreeCss = ".ztWv_q_callRow{border-radius:var(--dsw-radius-sm)}.ztWv_q_subCalls{border-left:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:4px;margin:4px 0 2px 22px;padding-left:8px;display:flex}";

/** Bang ten lop cua ToolCallTree.module.css — nguyen van hash lop goc. */
export const toolCallTreeClasses: Record<string, string> = {
	"callRow": "ztWv_q_callRow",
	"subCalls": "ztWv_q_subCalls"
};

/** Van ban CSS nguyen van cua QuestionToolRow.module.css (bundle goc). */
const questionToolRowCss = ".nvmz7W_panelButton{height:calc(22px + var(--dsh-content-font-delta,0px));corner-shape:round;background:var(--dsw-alias-button-floating-fill);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);white-space:nowrap;cursor:pointer;border:none;border-radius:999px;flex:none;align-items:center;gap:4px;margin-left:8px;padding:0 10px;line-height:1;transition:background .1s;display:inline-flex}.nvmz7W_panelButton svg{width:13px;height:13px}.nvmz7W_panelButton:hover{background:var(--dsw-alias-button-floating-hover)}";

/** Bang ten lop cua QuestionToolRow.module.css — nguyen van hash lop goc. */
export const questionToolRowClasses: Record<string, string> = { "panelButton": "nvmz7W_panelButton" };

/** Van ban CSS nguyen van cua bash-sample.module.css (bundle goc). */
const bashSampleCss = ".CY-8Ka_card{flex-direction:column;display:flex}.CY-8Ka_terminal{--dsl-terminal-font:var(--dsw-font-markdown-code-block-small);--dsl-terminal-line-height:18px;--dsl-terminal-output-max-height:224px;--dsl-terminal-command-whitespace:pre-wrap;border:.5px solid var(--dsw-alias-border-l1);margin:4px 0 4px 4px}.CY-8Ka_ioCard{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);font:var(--dsw-font-markdown-code-block-small);flex-direction:column;margin:4px 0 4px 4px;display:flex}.CY-8Ka_ioSection{grid-template-columns:max-content 1fr;align-items:baseline;column-gap:14px;max-height:150px;padding:12px 16px;display:grid;overflow-y:auto}.CY-8Ka_ioSection::-webkit-scrollbar-thumb{border-radius:var(--dsw-radius-sm);background-clip:padding-box;border:2px solid #0000}.CY-8Ka_ioSection::-webkit-scrollbar-track{margin:6px 0}.CY-8Ka_ioLabel{color:var(--dsw-alias-label-caption);align-self:start;position:sticky;top:0}.CY-8Ka_ioDivider{background:var(--dsw-alias-border-l2);flex:none;height:.5px}.CY-8Ka_ioText{white-space:pre-wrap;word-break:break-word;min-width:0;color:var(--dsw-alias-label-secondary)}.CY-8Ka_ioText[data-error]{color:var(--dsw-alias-state-error-primary)}.CY-8Ka_commandInput{--dsl-command-whitespace:pre-wrap;color:var(--dsw-alias-label-secondary)}.CY-8Ka_root[data-expandable]{cursor:pointer}.CY-8Ka_root{height:calc(24px + var(--dsh-content-font-delta,0px));min-width:0;color:var(--dsw-alias-label-tertiary);align-items:center;transition:color .1s;display:flex}.CY-8Ka_root:hover{color:var(--dsw-alias-label-secondary)}@media (prefers-reduced-motion:reduce){.CY-8Ka_root{transition:none}}.CY-8Ka_leading{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));color:inherit;flex:none;justify-content:center;align-items:center;margin-right:6px;display:inline-flex;position:relative}.CY-8Ka_leading svg:not([data-state]){width:calc(14px + var(--dsh-content-font-delta,0px));height:calc(14px + var(--dsh-content-font-delta,0px))}.CY-8Ka_chevron{color:inherit}.CY-8Ka_iconIdle{opacity:1;transition:opacity .1s;display:inline-flex}.CY-8Ka_chevronHover{opacity:0;margin:auto;transition:opacity .1s;position:absolute;inset:0}.CY-8Ka_root:hover .CY-8Ka_iconIdle{opacity:0}.CY-8Ka_root:hover .CY-8Ka_chevronHover{opacity:1}.CY-8Ka_title{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:none}.CY-8Ka_sep{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}.CY-8Ka_summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:auto;overflow:hidden}.CY-8Ka_errorSummary{color:var(--dsw-alias-state-error-primary)}.CY-8Ka_stoppedSummary{color:var(--dsw-alias-state-warn-label)}.CY-8Ka_bodyWrap{flex-direction:column;display:flex}.CY-8Ka_inspectButton{border:.5px solid var(--dsw-alias-border-l4);corner-shape:round;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;border-radius:999px;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;font-size:11px;line-height:16px;transition:opacity .1s;display:inline-flex}.CY-8Ka_card:hover .CY-8Ka_inspectButton,.CY-8Ka_inspectButton:focus-visible{opacity:1}.CY-8Ka_inspectButton:hover{background:var(--dsw-alias-interactive-bg-hover-solid);color:var(--dsw-alias-label-primary)}.CY-8Ka_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}";

/** Bang ten lop cua bash-sample.module.css — nguyen van hash lop goc. */
export const bashSampleClasses: Record<string, string> = {
	"bodyWrap": "CY-8Ka_bodyWrap",
	"card": "CY-8Ka_card",
	"chevron": "CY-8Ka_chevron",
	"chevronHover": "CY-8Ka_chevronHover",
	"commandInput": "CY-8Ka_commandInput",
	"errorSummary": "CY-8Ka_errorSummary",
	"iconIdle": "CY-8Ka_iconIdle",
	"inspectButton": "CY-8Ka_inspectButton",
	"ioCard": "CY-8Ka_ioCard",
	"ioDivider": "CY-8Ka_ioDivider",
	"ioLabel": "CY-8Ka_ioLabel",
	"ioSection": "CY-8Ka_ioSection",
	"ioText": "CY-8Ka_ioText",
	"leading": "CY-8Ka_leading",
	"root": "CY-8Ka_root",
	"sep": "CY-8Ka_sep",
	"stoppedSummary": "CY-8Ka_stoppedSummary",
	"summary": "CY-8Ka_summary",
	"terminal": "CY-8Ka_terminal",
	"title": "CY-8Ka_title",
	"visuallyHidden": "CY-8Ka_visuallyHidden"
};

/** Bang tra cuu bay module CSS theo nhan trong ids.CSS_ORDER. */
const MODULES: Record<string, StyleModule> = {
  askQuestionCard: { tagId: STYLE_TAGS.askQuestionCard, css: askQuestionCardCss, classes: askQuestionCardClasses },
  toolDetails: { tagId: STYLE_TAGS.toolDetails, css: toolDetailsCss, classes: toolDetailsClasses },
  exitCodeBadge: { tagId: STYLE_TAGS.exitCodeBadge, css: exitCodeBadgeCss, classes: exitCodeBadgeClasses },
  toolRow: { tagId: STYLE_TAGS.toolRow, css: toolRowCss, classes: toolRowClasses },
  toolCallTree: { tagId: STYLE_TAGS.toolCallTree, css: toolCallTreeCss, classes: toolCallTreeClasses },
  questionToolRow: { tagId: STYLE_TAGS.questionToolRow, css: questionToolRowCss, classes: questionToolRowClasses },
  bashSample: { tagId: STYLE_TAGS.bashSample, css: bashSampleCss, classes: bashSampleClasses },
};

/**
 * Chen mot the style neu chua co the nao cung id (idempotent, giong ban goc).
 * Nhan: tagId — id gan vao data-plugin-css; cssText — van ban CSS.
 * Tra: khong co.
 */
function injectStyle(tagId: string, cssText: string): void {
  if (typeof document === "undefined") return;
  if (document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") !== null) return;
  const tag = document.createElement("style");
  tag.dataset.pluginCss = tagId;
  tag.textContent = cssText;
  document.head.appendChild(tag);
}

/**
 * Chen bay the CSS cua row, dung thu tu ban goc.
 * Nhan: khong co.
 * Tra: so the da chen trong lan goi nay.
 */
export function injectStyles(): number {
  let injected = 0;
  for (const key of CSS_ORDER) {
    const mod = MODULES[key];
    if (mod === undefined) continue;
    const before = typeof document === "undefined" ? 0 : document.querySelectorAll("style[data-plugin-css=" + JSON.stringify(mod.tagId) + "]").length;
    injectStyle(mod.tagId, mod.css);
    const after = typeof document === "undefined" ? 0 : document.querySelectorAll("style[data-plugin-css=" + JSON.stringify(mod.tagId) + "]").length;
    injected += after - before;
  }
  return injected;
}
