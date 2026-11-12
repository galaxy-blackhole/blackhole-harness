/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc CSS nguyen van TUNG BYTE cua bon module + bang ten lop hash cua ban goc ui-workspace
 */

/** CSS cua rows — nguyen van tung byte tu bundle goc. */
export const ROWS_CSS = ".YDXeBa_projectRow,.YDXeBa_sessionRow{border-radius:var(--dsw-radius-md);padding:0 8px;cursor:pointer;user-select:none;color:var(--dsw-alias-label-primary);align-items:center;gap:6px;padding-inline-start:calc(8px + var(--dsh-workspace-indent,0px));display:flex}.YDXeBa_projectRow:hover,.YDXeBa_sessionRow:hover,.YDXeBa_sessionRow.YDXeBa_selected{background:var(--dsw-alias-interactive-bg-hover)}.YDXeBa_searchResultRow{box-sizing:border-box;border-radius:var(--dsw-radius-lg);cursor:pointer;text-align:left;width:100%;min-height:48px;color:var(--dsw-alias-label-primary);background:0 0;border:none;flex-direction:column;align-items:stretch;padding:4px 8px;display:flex}.YDXeBa_searchResultRow:hover,.YDXeBa_searchResultRow.YDXeBa_selected{background:var(--dsw-alias-interactive-bg-hover)}.YDXeBa_searchResultHeading{align-items:center;min-width:0;display:flex}.YDXeBa_searchResultTitle{text-overflow:ellipsis;white-space:nowrap;flex:0 auto;min-width:0;margin-left:4px;font-size:14px;line-height:20px;overflow:hidden}.YDXeBa_searchResultMeta{align-items:center;gap:6px;min-width:0;margin-left:20px;display:flex}.YDXeBa_searchResultWorkspace,.YDXeBa_searchResultSnippet{text-overflow:ellipsis;white-space:nowrap;font-size:12px;line-height:17px;overflow:hidden}.YDXeBa_searchResultWorkspace{max-width:40%;color:var(--dsw-alias-label-tertiary);flex:none}.YDXeBa_searchResultWorkspace:only-child{max-width:100%}.YDXeBa_searchResultSnippet{min-width:0;color:var(--dsw-alias-label-secondary);flex:1}.YDXeBa_projectRow{box-sizing:border-box;align-items:center;height:34px}.YDXeBa_projectRow .YDXeBa_rowActions{height:20px}.YDXeBa_sessionRow{gap:0;height:32px}.YDXeBa_sessionRow .YDXeBa_title{margin:0 6px 0 4px}.YDXeBa_slot{width:16px;height:20px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:center;align-items:center;display:inline-flex}.YDXeBa_visuallyHidden{clip:rect(0 0 0 0);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}.YDXeBa_folderActive{color:var(--dsw-alias-state-business-primary)}.YDXeBa_projectRow .YDXeBa_chevron{display:none}.YDXeBa_projectRow:hover .YDXeBa_chevron{display:inline-flex}.YDXeBa_projectRow:hover .YDXeBa_folder{display:none}.YDXeBa_arrow{transition:transform .15s var(--ds-ease-in-out)}.YDXeBa_arrowOpen{transform:rotate(90deg)}.YDXeBa_projectText{flex-direction:column;flex:1;gap:2px;min-width:0;display:flex}.YDXeBa_title{text-overflow:ellipsis;white-space:nowrap;min-width:0;font-size:14px;line-height:20px;overflow:hidden}.YDXeBa_renameInput{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-button-elevated-fill);min-width:0;color:inherit;outline:none;padding:0 2px;font-size:14px;line-height:20px}.YDXeBa_sessionRow .YDXeBa_title{flex:1}.YDXeBa_sessionRow .YDXeBa_title[data-scrolled]{mask-image:linear-gradient(90deg,#0000,#000 12px)}.YDXeBa_sessionRow .YDXeBa_title[data-clipped]{mask-image:linear-gradient(270deg,#0000,#000 12px)}.YDXeBa_sessionRow .YDXeBa_title[data-scrolled][data-clipped]{mask-image:linear-gradient(90deg,#0000,#000 12px calc(100% - 12px),#0000)}.YDXeBa_meta{text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:20px;overflow:hidden}.YDXeBa_time{color:var(--dsw-alias-label-tertiary);flex:none;font-size:10px;line-height:16px}.YDXeBa_pinIndicator{width:16px;height:20px;color:var(--dsw-alias-label-caption);flex:none;justify-content:center;align-items:center;margin-left:6px;display:inline-flex}.YDXeBa_sessionRow.YDXeBa_archived .YDXeBa_title,.YDXeBa_searchResultRow.YDXeBa_archived .YDXeBa_searchResultTitle,.YDXeBa_searchResultRow.YDXeBa_archived .YDXeBa_searchResultWorkspace,.YDXeBa_searchResultRow.YDXeBa_archived .YDXeBa_searchResultSnippet{color:var(--dsw-alias-label-caption)}.YDXeBa_dot{flex:none}.YDXeBa_rowActions{flex:none;align-items:center;gap:15px;display:none}.YDXeBa_projectRow:hover .YDXeBa_rowActions,.YDXeBa_sessionRow:hover .YDXeBa_rowActions,.YDXeBa_searchResultRow:hover .YDXeBa_rowActions,.YDXeBa_projectRow.YDXeBa_menuOpen .YDXeBa_rowActions,.YDXeBa_sessionRow.YDXeBa_menuOpen .YDXeBa_rowActions{display:inline-flex}.YDXeBa_searchResultHeading .YDXeBa_rowActions{margin-left:auto}.YDXeBa_sessionRow:hover .YDXeBa_time,.YDXeBa_sessionRow.YDXeBa_menuOpen .YDXeBa_time,.YDXeBa_sessionRow:hover .YDXeBa_pinIndicator,.YDXeBa_sessionRow.YDXeBa_menuOpen .YDXeBa_pinIndicator{display:none}@media (hover:hover){.YDXeBa_sessionRow:hover .YDXeBa_title,.YDXeBa_sessionRow.YDXeBa_menuOpen .YDXeBa_title{text-overflow:clip}}.YDXeBa_projectRow.YDXeBa_menuOpen,.YDXeBa_sessionRow.YDXeBa_menuOpen{background:var(--dsw-alias-interactive-bg-hover)}.YDXeBa_sessionRow.YDXeBa_dropBefore,.YDXeBa_sessionRow.YDXeBa_dropAfter{position:relative}.YDXeBa_sessionRow.YDXeBa_dropBefore:before,.YDXeBa_sessionRow.YDXeBa_dropAfter:after{content:\"\";z-index:1;background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:4px}.YDXeBa_sessionRow.YDXeBa_dropBefore:before{top:-7px}.YDXeBa_sessionRow.YDXeBa_dropAfter:after{bottom:-7px}.YDXeBa_hoverContent{flex-direction:column;gap:8px;display:flex}.YDXeBa_hoverTitle{color:#fff;overflow-wrap:break-word;font-size:14px;line-height:20px}.YDXeBa_hoverPath{color:#cfd3d6;word-break:break-all;font-size:12px;line-height:16px}.YDXeBa_hoverTime{color:#cfd3d6;font-size:12px;line-height:16px}.YDXeBa_hoverStatus{color:#adb2b8;align-items:center;gap:8px;font-size:12px;line-height:20px;display:flex}.YDXeBa_hoverArchived svg{flex-shrink:0;margin:0 -4px}.YDXeBa_iconButton{border-radius:var(--dsw-radius-xs);cursor:pointer;width:16px;height:16px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.YDXeBa_iconButton:hover{color:var(--dsw-alias-label-primary)}.YDXeBa_chevron{color:var(--dsw-alias-label-caption)}@media (prefers-reduced-motion:reduce){.YDXeBa_arrow{transition:none;animation:none}}";

/** Bang ten lop hash tuong ung — nguyen van tu bundle goc. */
export const rowsStyles = {
  "archived": "YDXeBa_archived",
  "arrow": "YDXeBa_arrow",
  "arrowOpen": "YDXeBa_arrowOpen",
  "chevron": "YDXeBa_chevron",
  "dot": "YDXeBa_dot",
  "dropAfter": "YDXeBa_dropAfter",
  "dropBefore": "YDXeBa_dropBefore",
  "folder": "YDXeBa_folder",
  "folderActive": "YDXeBa_folderActive",
  "hoverArchived": "YDXeBa_hoverArchived",
  "hoverContent": "YDXeBa_hoverContent",
  "hoverPath": "YDXeBa_hoverPath",
  "hoverStatus": "YDXeBa_hoverStatus",
  "hoverTime": "YDXeBa_hoverTime",
  "hoverTitle": "YDXeBa_hoverTitle",
  "iconButton": "YDXeBa_iconButton",
  "menuOpen": "YDXeBa_menuOpen",
  "meta": "YDXeBa_meta",
  "pinIndicator": "YDXeBa_pinIndicator",
  "projectRow": "YDXeBa_projectRow",
  "projectText": "YDXeBa_projectText",
  "renameInput": "YDXeBa_renameInput",
  "rowActions": "YDXeBa_rowActions",
  "searchResultHeading": "YDXeBa_searchResultHeading",
  "searchResultMeta": "YDXeBa_searchResultMeta",
  "searchResultRow": "YDXeBa_searchResultRow",
  "searchResultSnippet": "YDXeBa_searchResultSnippet",
  "searchResultTitle": "YDXeBa_searchResultTitle",
  "searchResultWorkspace": "YDXeBa_searchResultWorkspace",
  "selected": "YDXeBa_selected",
  "sessionRow": "YDXeBa_sessionRow",
  "slot": "YDXeBa_slot",
  "time": "YDXeBa_time",
  "title": "YDXeBa_title",
  "visuallyHidden": "YDXeBa_visuallyHidden"
} as const;

/** CSS cua animated_rows — nguyen van tung byte tu bundle goc. */
export const ANIMATED_ROWS_CSS = ".Qg_5Eq_exits{contain:strict;pointer-events:none;position:absolute;inset:0;overflow:clip}";

/** Bang ten lop hash tuong ung — nguyen van tu bundle goc. */
export const animatedRowsStyles = { "exits": "Qg_5Eq_exits" } as const;

/** CSS cua workspacepicker — nguyen van tung byte tu bundle goc. */
export const WORKSPACEPICKER_CSS = "._G5b-a_modalAction{min-width:72px}._G5b-a_modalError,._G5b-a_menuStatus{margin-top:8px;font-size:12px;line-height:18px}._G5b-a_modalError{color:var(--dsw-alias-state-error-primary)}._G5b-a_menuStatus{color:var(--dsw-alias-label-secondary)}";

/** Bang ten lop hash tuong ung — nguyen van tu bundle goc. */
export const workspacePickerStyles = {
  "menuStatus": "_G5b-a_menuStatus",
  "modalAction": "_G5b-a_modalAction",
  "modalError": "_G5b-a_modalError"
} as const;

/** CSS cua workspacebrowser — nguyen van tung byte tu bundle goc. */
export const WORKSPACEBROWSER_CSS = ".bhn1Oq_root{--dsh-session-list-edge-inset:var(--dsh-sidebar-inline-padding);--dsh-session-list-scrollbar-width:5px;--dsh-session-list-scrollbar-offset:2px;box-sizing:border-box;min-height:0;padding-right:var(--dsh-session-list-edge-inset);flex-direction:column;flex:1;display:flex}.bhn1Oq_root.bhn1Oq_rail{padding-right:0}.bhn1Oq_iconButton{border-radius:var(--dsw-radius-sm);cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.bhn1Oq_iconButton:focus-visible,.bhn1Oq_searchButton:focus-visible,.bhn1Oq_clearButton:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.bhn1Oq_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.bhn1Oq_viewOptionsMenu{min-width:200px}.bhn1Oq_sectionHeader{box-sizing:border-box;border-radius:var(--dsw-radius-md);height:36px;color:var(--dsw-alias-label-tertiary);flex:none;justify-content:flex-end;align-items:center;gap:4px;margin-bottom:4px;padding-left:4px;display:flex;overflow:hidden}.bhn1Oq_root:not(.bhn1Oq_rail) .bhn1Oq_sectionHeader{margin-top:2px;margin-right:-4px}.bhn1Oq_sectionLabel{white-space:nowrap;opacity:1;visibility:visible;min-width:0;max-width:45%;transition:max-width .18s var(--ds-ease-in-out), margin-right .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out), visibility 0s linear;flex:none;line-height:20px;overflow:hidden}.bhn1Oq_sectionLabelHidden{opacity:0;visibility:hidden;max-width:0;margin-right:-4px;transition-delay:0s,0s,0s,0s,.18s;transform:translate(-4px)}.bhn1Oq_searchSlot{box-sizing:border-box;min-width:0;max-width:28px;transition:max-width .18s var(--ds-ease-in-out), padding-left .18s var(--ds-ease-in-out);flex:1;align-items:center;margin-left:auto;padding-left:0;display:flex}.bhn1Oq_searchSlotExpanded{max-width:100%;padding-left:0}.bhn1Oq_headerActions{opacity:1;visibility:visible;max-width:60px;transition:max-width .18s var(--ds-ease-in-out), opacity .12s var(--ds-ease-in-out), transform .18s var(--ds-ease-in-out), visibility 0s linear;flex:none;align-items:center;gap:4px;display:flex;overflow:hidden}.bhn1Oq_headerActionsHidden{opacity:0;visibility:hidden;pointer-events:none;max-width:0;transition-delay:0s,0s,0s,.18s;transform:translate(4px)}.bhn1Oq_search{box-sizing:border-box;border-radius:var(--dsw-radius-sm);cursor:text;width:100%;height:28px;color:var(--dsw-alias-label-secondary);transition:width .18s var(--ds-ease-in-out), padding .18s var(--ds-ease-in-out), border-color .18s var(--ds-ease-in-out), background-color .18s var(--ds-ease-in-out);background:0 0;border:none;flex:none;align-items:center;gap:0;margin:0;padding:0;display:flex;overflow:hidden}.bhn1Oq_searchExpanded{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);width:calc(100% + 4px);height:30px;color:var(--dsw-alias-label-caption);background:0 0;margin-inline:-2px;padding:0 4px 0 0}.bhn1Oq_searchButton{border-radius:var(--dsw-radius-sm);cursor:pointer;width:28px;height:28px;color:inherit;background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.bhn1Oq_searchExpanded .bhn1Oq_searchButton{width:28px;height:30px}.bhn1Oq_searchButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.bhn1Oq_searchExpanded .bhn1Oq_searchButton:hover{background:0 0}.bhn1Oq_searchInput{opacity:0;pointer-events:none;width:0;min-width:0;color:var(--dsw-alias-label-primary);transition:opacity .12s var(--ds-ease-in-out);background:0 0;border:none;outline:none;flex:1;font-size:13px;line-height:18px}.bhn1Oq_searchExpanded .bhn1Oq_searchInput{opacity:1;pointer-events:auto;margin-left:-2px}.bhn1Oq_searchInput::placeholder{color:var(--dsw-alias-label-tertiary)}.bhn1Oq_clearButton{border-radius:var(--dsw-radius-sm);cursor:pointer;width:24px;height:24px;color:var(--dsw-alias-label-secondary);background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.bhn1Oq_clearButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.bhn1Oq_rail .bhn1Oq_sectionHeader{justify-content:flex-start;gap:0;margin-bottom:12px;padding-left:0}.bhn1Oq_rail .bhn1Oq_headerActions{max-width:none}.bhn1Oq_rail .bhn1Oq_iconButton{border-radius:var(--dsw-radius-md);width:36px;height:36px;color:var(--dsw-alias-label-primary)}.bhn1Oq_rail .bhn1Oq_search{border-radius:var(--dsw-radius-md);background:0 0;border-color:#0000;gap:0;width:36px;height:36px;margin:0 0 12px;padding:0}.bhn1Oq_rail .bhn1Oq_searchButton{border-radius:var(--dsw-radius-md);width:36px;height:36px;color:var(--dsw-alias-label-primary)}.bhn1Oq_rail .bhn1Oq_searchButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.bhn1Oq_listArea{min-height:0;margin-left:-4px;margin-right:calc(-1 * var(--dsh-session-list-edge-inset));flex-direction:column;flex:1;padding-left:4px;display:flex;overflow:visible}.bhn1Oq_rail .bhn1Oq_listArea{margin-left:0;margin-right:0;padding-left:0}.bhn1Oq_treeBody{flex-direction:column;flex:1;min-height:0;display:flex;position:relative}.bhn1Oq_fade{left:0;right:var(--dsh-session-list-edge-inset);background:linear-gradient(to bottom, transparent, var(--dsw-specific-sidebar-fill));pointer-events:none;height:24px;position:absolute;bottom:0}[data-platform=darwin] .bhn1Oq_fade{display:none}.bhn1Oq_wide{animation:bhn1Oq_wide-in .2s var(--ds-ease-in-out)}@keyframes bhn1Oq_wide-in{0%{opacity:0}}.bhn1Oq_list{min-height:0;margin-left:-4px;margin-right:var(--dsh-session-list-scrollbar-offset);padding-left:4px;padding-right:calc(var(--dsh-session-list-edge-inset) - var(--dsh-session-list-scrollbar-width) - var(--dsh-session-list-scrollbar-offset));scrollbar-gutter:stable;flex:1;padding-bottom:16px;overflow-y:auto}.bhn1Oq_flatList>*+*,.bhn1Oq_searchTree>[role=treeitem]+[role=treeitem],.bhn1Oq_groupSection>*+*{margin-top:2px}.bhn1Oq_searchStatus{color:var(--dsw-alias-label-tertiary);padding:10px 12px;font-size:12px;line-height:18px}.bhn1Oq_skeletonRow{box-sizing:border-box;align-items:flex-start;gap:8px;min-height:48px;padding:6px 8px 7px;display:flex}.bhn1Oq_skeletonDot{corner-shape:round;border-radius:50%;flex:none;width:16px;height:16px}.bhn1Oq_skeletonBars{flex-direction:column;flex:1;gap:6px;min-width:0;display:flex}.bhn1Oq_skeletonDot,.bhn1Oq_skeletonBar{background:var(--dsw-alias-bg-skeleton);animation:2s cubic-bezier(.36,0,.64,1) infinite bhn1Oq_search-skeleton}.bhn1Oq_skeletonBar{border-radius:var(--dsw-radius-xs);width:65%;height:16px}.bhn1Oq_skeletonBarWide{width:90%;height:13px}@keyframes bhn1Oq_search-skeleton{0%{opacity:1}40%{opacity:.6}80%,to{opacity:1}}.bhn1Oq_groupSection{position:relative}.bhn1Oq_groupSection+.bhn1Oq_groupSection{margin-top:4px}.bhn1Oq_listTopDropIndicator,.bhn1Oq_workspaceDropBefore:before,.bhn1Oq_workspaceDropAfter:after{content:\"\";z-index:1;background:linear-gradient(55deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 0 / 5px 7px no-repeat, linear-gradient(125deg, transparent calc(50% - 1px), var(--dsw-alias-state-business-primary) calc(50% - 1px) calc(50% + 1px), transparent calc(50% + 1px)) 0 5px / 5px 7px no-repeat, linear-gradient(var(--dsw-alias-state-business-primary) 0 0) 4px 5px / calc(100% - 4px) 2px no-repeat;pointer-events:none;height:12px;position:absolute;left:0;right:0}.bhn1Oq_listTopDropIndicator{top:-8px;left:0;right:var(--dsh-session-list-edge-inset)}.bhn1Oq_listTopDropActive>.bhn1Oq_workspaceDropBefore:first-child:before{display:none}.bhn1Oq_workspaceDropBefore:before{top:-8px}.bhn1Oq_workspaceDropAfter:after{bottom:-8px}.bhn1Oq_sessionOverflowButton{border-radius:var(--dsw-radius-sm);width:100%;height:28px;padding:0 12px 0 calc(28px + var(--dsh-workspace-indent,0px));cursor:pointer;text-align:left;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;font-size:12px}.bhn1Oq_groupSection>.bhn1Oq_sessionOverflowButton{margin-top:0}.bhn1Oq_sessionOverflowButton:hover{color:var(--dsw-alias-label-secondary);background:0 0}.bhn1Oq_empty{color:var(--dsw-alias-label-tertiary);padding:16px 12px;font-size:13px}.bhn1Oq_emptyState{color:var(--dsw-alias-label-tertiary);flex-direction:column;align-items:center;gap:8px;margin-top:80px;padding:0 12px;font-size:13px;line-height:20px;display:flex}.bhn1Oq_emptyState>svg{color:var(--dsw-alias-label-caption);margin-bottom:4px}.bhn1Oq_emptyAction{cursor:pointer;color:var(--dsw-alias-link);background:0 0;border:none;padding:0;font-size:13px;line-height:20px}.bhn1Oq_renameInput{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);width:100%;height:44px;color:var(--dsw-alias-label-primary);background:0 0;outline:none;padding:7px 14px;font-size:14px;font-weight:400;line-height:22px}.bhn1Oq_renameInput:disabled{color:var(--dsw-alias-label-dimmed)}.bhn1Oq_renameError{color:var(--dsw-alias-state-error-primary);margin-top:8px;font-size:12px;line-height:18px}.bhn1Oq_deleteAction:not(:disabled){color:var(--dsw-alias-state-error-primary)}.bhn1Oq_deleteStatus{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}.bhn1Oq_archiveActivity{color:var(--dsw-alias-label-primary);margin:0 0 8px;padding-left:18px;font-size:13px;line-height:20px}.bhn1Oq_archiveActivity li{overflow-wrap:anywhere}@media (prefers-reduced-motion:reduce){.bhn1Oq_wide,.bhn1Oq_skeletonDot,.bhn1Oq_skeletonBar{animation:none}.bhn1Oq_search,.bhn1Oq_sectionLabel,.bhn1Oq_searchSlot,.bhn1Oq_searchInput,.bhn1Oq_headerActions{transition:none}}";

/** Bang ten lop hash tuong ung — nguyen van tu bundle goc. */
export const workspaceBrowserStyles = {
  "archiveActivity": "bhn1Oq_archiveActivity",
  "clearButton": "bhn1Oq_clearButton",
  "deleteAction": "bhn1Oq_deleteAction",
  "deleteStatus": "bhn1Oq_deleteStatus",
  "empty": "bhn1Oq_empty",
  "emptyAction": "bhn1Oq_emptyAction",
  "emptyState": "bhn1Oq_emptyState",
  "fade": "bhn1Oq_fade",
  "flatList": "bhn1Oq_flatList",
  "groupSection": "bhn1Oq_groupSection",
  "headerActions": "bhn1Oq_headerActions",
  "headerActionsHidden": "bhn1Oq_headerActionsHidden",
  "iconButton": "bhn1Oq_iconButton",
  "list": "bhn1Oq_list",
  "listArea": "bhn1Oq_listArea",
  "listTopDropActive": "bhn1Oq_listTopDropActive",
  "listTopDropIndicator": "bhn1Oq_listTopDropIndicator",
  "rail": "bhn1Oq_rail",
  "renameError": "bhn1Oq_renameError",
  "renameInput": "bhn1Oq_renameInput",
  "root": "bhn1Oq_root",
  "search": "bhn1Oq_search",
  "search-skeleton": "bhn1Oq_search-skeleton",
  "searchButton": "bhn1Oq_searchButton",
  "searchExpanded": "bhn1Oq_searchExpanded",
  "searchInput": "bhn1Oq_searchInput",
  "searchSlot": "bhn1Oq_searchSlot",
  "searchSlotExpanded": "bhn1Oq_searchSlotExpanded",
  "searchStatus": "bhn1Oq_searchStatus",
  "searchTree": "bhn1Oq_searchTree",
  "sectionHeader": "bhn1Oq_sectionHeader",
  "sectionLabel": "bhn1Oq_sectionLabel",
  "sectionLabelHidden": "bhn1Oq_sectionLabelHidden",
  "sessionOverflowButton": "bhn1Oq_sessionOverflowButton",
  "skeletonBar": "bhn1Oq_skeletonBar",
  "skeletonBarWide": "bhn1Oq_skeletonBarWide",
  "skeletonBars": "bhn1Oq_skeletonBars",
  "skeletonDot": "bhn1Oq_skeletonDot",
  "skeletonRow": "bhn1Oq_skeletonRow",
  "treeBody": "bhn1Oq_treeBody",
  "viewOptionsMenu": "bhn1Oq_viewOptionsMenu",
  "wide": "bhn1Oq_wide",
  "wide-in": "bhn1Oq_wide-in",
  "workspaceDropAfter": "bhn1Oq_workspaceDropAfter",
  "workspaceDropBefore": "bhn1Oq_workspaceDropBefore"
} as const;
