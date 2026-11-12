/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc Bang lop CSS + stylesheet cua panel workflow run — giu NGUYEN ten lop va khai bao cua ban goc
 */

/** Tên lớp CSS của panel — GIỮ NGUYÊN tên lớp của bản gốc để bề mặt DOM không lệch. */
export const CLASS = {
  root: "DBuyfa_root",
  runHeader: "DBuyfa_runHeader",
  runLeading: "DBuyfa_runLeading",
  runTitle: "DBuyfa_runTitle",
  runSummary: "DBuyfa_runSummary",
  statusTail: "DBuyfa_statusTail",
  phaseHeader: "DBuyfa_phaseHeader",
  phaseLeading: "DBuyfa_phaseLeading",
  phaseTitle: "DBuyfa_phaseTitle",
  phaseCount: "DBuyfa_phaseCount",
  phaseStatus: "DBuyfa_phaseStatus",
  separator: "DBuyfa_separator",
  phaseList: "DBuyfa_phaseList",
  phase: "DBuyfa_phase",
  members: "DBuyfa_members",
  memberRow: "DBuyfa_memberRow",
  memberButton: "DBuyfa_memberButton",
  dotSlot: "DBuyfa_dotSlot",
  memberLabelWrap: "DBuyfa_memberLabelWrap",
  memberLabel: "DBuyfa_memberLabel",
  memberStatus: "DBuyfa_memberStatus",
  empty: "DBuyfa_empty",
  headerContent: "DBuyfa_headerContent",
  headerContentLayout: "DBuyfa_headerContentLayout",
} as const;

/**
 * Stylesheet của panel, viết lại theo token `--dsw-*`/`--dsh-*` của DSH (cùng khai báo, cùng tên lớp).
 * Nhúng thẳng vào bundle vì `bh host` chỉ mount `package.json` + `lib/*.js` vào profile.
 */
export const STYLES: string = [
  "." + CLASS.root + "{width:100%;min-width:0}",
  "." + CLASS.runHeader + "{box-sizing:border-box;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);align-items:center;gap:6px;width:100%;min-width:0;height:32px;padding:0 8px;display:flex}",
  "." + CLASS.runHeader + ":focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}",
  "." + CLASS.runLeading + "{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));color:inherit;flex:none;justify-content:center;align-items:center;margin-right:0;display:inline-flex}",
  "." + CLASS.runTitle + "{max-width:42%;color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);font-weight:510;line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:none;overflow:hidden}",
  "." + CLASS.runSummary + "{min-width:0;color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(18px + var(--dsh-content-font-delta-secondary,0px));text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}",
  "." + CLASS.statusTail + "{height:20px;color:inherit;white-space:nowrap;flex:none;align-items:center;gap:4px;font-size:11px;font-weight:510;line-height:16px;display:inline-flex;overflow:hidden}",
  "." + CLASS.phaseHeader + "{box-sizing:border-box;align-items:center;gap:6px;width:100%;min-width:0;height:32px;display:flex}",
  "." + CLASS.phaseHeader + ":focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px;border-radius:var(--dsw-radius-md)}",
  "." + CLASS.phaseLeading + "{width:calc(16px + var(--dsh-content-font-delta,0px));height:calc(16px + var(--dsh-content-font-delta,0px));color:inherit;flex:none;justify-content:center;align-items:center;margin-right:0;display:inline-flex}",
  "." + CLASS.phaseTitle + "{min-width:0;max-width:42%;color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:0 auto;overflow:hidden}",
  "." + CLASS.phaseCount + "{min-width:0;color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}",
  "." + CLASS.phaseStatus + "{width:calc(132px + var(--dsh-content-font-delta-secondary,0px) * 10);color:inherit;font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));text-align:right;text-overflow:ellipsis;white-space:nowrap;flex:none;overflow:hidden}",
  "." + CLASS.separator + "{corner-shape:round;background:var(--dsw-alias-label-tertiary);border-radius:50%;flex:none;width:2px;height:2px}",
  "." + CLASS.phaseList + "{flex-direction:column;gap:4px;min-width:0;padding:4px 0 0 16px;display:flex}",
  "." + CLASS.phase + "{min-width:0}",
  "." + CLASS.members + "{flex-direction:column;gap:2px;min-width:0;padding:0 0 0 16px;display:flex}",
  "." + CLASS.memberRow + ",." + CLASS.memberButton + "{width:100%;min-width:0;min-height:calc(24px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;background:0 0;border:0;align-items:center;gap:12px;padding:0;display:flex}",
  "." + CLASS.memberButton + "{cursor:pointer}",
  "." + CLASS.memberButton + " ." + CLASS.memberLabel + "{color:var(--dsw-alias-link);font-weight:500;text-decoration:none}",
  "." + CLASS.memberButton + ":hover ." + CLASS.memberLabel + ",." + CLASS.memberButton + ":focus-visible ." + CLASS.memberLabel + "{text-underline-offset:3px;text-decoration:underline dotted}",
  "." + CLASS.dotSlot + "{width:16px;height:calc(24px + var(--dsh-content-font-delta,0px));flex:none;justify-content:center;align-items:center;display:inline-flex;overflow:hidden}",
  "." + CLASS.memberButton + ":focus-visible{outline:none}",
  "." + CLASS.memberButton + ":focus-visible ." + CLASS.memberLabelWrap + "{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-1px}",
  "." + CLASS.memberLabelWrap + "{min-width:0;height:calc(24px + var(--dsh-content-font-delta,0px));border-radius:var(--dsw-radius-sm);flex:1;align-items:center;padding:0 2px;display:flex;overflow:hidden}",
  "." + CLASS.memberLabel + "{min-width:0;color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size,14px);line-height:calc(24px + var(--dsh-content-font-delta,0px));text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}",
  "." + CLASS.memberStatus + "{width:64px;color:var(--dsw-alias-label-secondary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));text-align:right;text-overflow:ellipsis;white-space:nowrap;flex:none;overflow:hidden}",
  "." + CLASS.empty + "{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));padding:0}",
  "@media (width<=560px){" + "." + CLASS.phaseList + ",." + CLASS.members + "{padding-left:12px}}",
  "." + CLASS.headerContent + "{flex:1}",
  "." + CLASS.headerContentLayout + "{gap:6px}",
].join("");

/** Id gắn vào thẻ `<style data-plugin-css>` (đường dẫn CSS-module của bản gốc). */
export const STYLE_TAG_SUFFIX = "/WorkflowRunPanel.module.css";
