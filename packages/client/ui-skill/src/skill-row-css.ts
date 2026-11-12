/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc CSS cua the skill nhung o dang chuoi + bang lop (bundle client tu tiem the <style>, khong qua pipeline CSS cua bundler)
 */

/** Toàn bộ luật CSS của thẻ skill — NGUYÊN VĂN tập luật bản gốc, chỉ đổi tiền tố lớp. */
export const SKILL_ROW_CSS = '/* eslint-disable */\n.gbhSkill_card{flex-direction:column;display:flex}\n.gbhSkill_row{height:calc(24px + var(--dsh-content-font-delta,0px));min-width:0;color:var(--dsw-alias-label-tertiary);align-items:center;transition:color .1s;display:flex;position:relative;overflow:hidden}\n.gbhSkill_leading{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));color:inherit;flex:none;justify-content:center;align-items:center;margin-right:6px;display:inline-flex;position:relative}\n.gbhSkill_chevron{color:inherit}\n.gbhSkill_iconIdle{opacity:1;transition:opacity .1s;display:inline-flex}\n.gbhSkill_chevronHover{opacity:0;margin:auto;transition:opacity .1s;position:absolute;inset:0}\n.gbhSkill_iconIdle{opacity:0}\n.gbhSkill_chevronHover{opacity:1}\n.gbhSkill_title{font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:none}\n.gbhSkill_separator{background:var(--dsw-alias-label-caption);border-radius:1px;flex:none;width:2px;height:2px;margin:0 8px}\n.gbhSkill_summary{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));flex:auto;overflow:hidden}\n.gbhSkill_errorSummary{color:var(--dsw-alias-state-error-primary)}\n.gbhSkill_stoppedSummary{color:var(--dsw-alias-state-warn-label)}\n.gbhSkill_bodyWrap{flex-direction:column;display:flex}\n.gbhSkill_instructionsCard{border:.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-markdown-code-block);flex-direction:column;max-height:260px;margin:4px 0 4px 4px;display:flex;overflow:hidden}\n.gbhSkill_instructionsHeader{border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-markdown-code-block-banner);color:var(--dsw-alias-label-caption);text-transform:uppercase;letter-spacing:.04em;flex:none;padding:8px 12px;font-size:11px;font-weight:500;line-height:16px}\n.gbhSkill_instructions{white-space:pre-wrap;overflow-wrap:anywhere;min-height:0;font:var(--dsw-font-markdown-code-block-small);color:var(--dsw-alias-label-secondary);margin:0;padding:10px 12px 12px;overflow:auto}\n.gbhSkill_inspectButton{border:.5px solid var(--dsw-alias-border-l4);corner-shape:round;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);cursor:pointer;opacity:0;border-radius:999px;align-self:flex-start;align-items:center;gap:4px;margin:4px 0 2px 4px;padding:2px 8px;font-size:11px;line-height:16px;transition:opacity .1s;display:inline-flex}\n.gbhSkill_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}\n.gbhSkill_inspectButton{transition:none}';

/** Bảng ánh xạ tên lớp của CSS Module sang tên lớp đã sinh. */
export const SKILL_ROW_CLASSES: Record<string, string> = {
  bodyWrap: "gbhSkill_bodyWrap",
  card: "gbhSkill_card",
  chevron: "gbhSkill_chevron",
  chevronHover: "gbhSkill_chevronHover",
  errorSummary: "gbhSkill_errorSummary",
  iconIdle: "gbhSkill_iconIdle",
  inspectButton: "gbhSkill_inspectButton",
  instructions: "gbhSkill_instructions",
  instructionsCard: "gbhSkill_instructionsCard",
  instructionsHeader: "gbhSkill_instructionsHeader",
  leading: "gbhSkill_leading",
  row: "gbhSkill_row",
  separator: "gbhSkill_separator",
  stoppedSummary: "gbhSkill_stoppedSummary",
  summary: "gbhSkill_summary",
  title: "gbhSkill_title",
  visuallyHidden: "gbhSkill_visuallyHidden",
};

/** Tag định danh để không chèn CSS hai lần khi HMR nạp lại. */
export const SKILL_ROW_STYLE_TAG = "@galaxy-blackhole/gbh-client-ui-skill/SkillRow.module.css";
