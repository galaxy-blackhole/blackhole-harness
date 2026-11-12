/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 18/10/2026
 * desc Ba module CSS cua row ui-sidebar-right: nguyen van TUNG BYTE tu bundle goc, giu nguyen hash lop
 * nguon: port trung thanh tu @deepseek-ai/dsh-client-ui-sidebar-right/lib/client.js (vung dsh-css)
 */

/** CSS cua GuideBody.module.css — nguyen van tung byte tu bundle goc. */
export const GUIDE_BODY_CSS = ".geFEbW_guide{--dsl-guide-entry-radius:var(--dsw-radius-xl);box-sizing:border-box;flex-direction:column;justify-content:center;align-items:center;gap:14px;min-height:100%;padding:0 24px;display:flex}.geFEbW_guide:after{content:\"\";flex:0 10%}.geFEbW_hero{color:var(--dsw-static-neutral-200);margin-bottom:16px;display:flex}body[data-ds-dark-theme] .geFEbW_hero{color:var(--dsw-static-neutral-700)}.geFEbW_entry{box-sizing:border-box;width:380px;max-width:100%;min-height:56px;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;background:var(--dsw-alias-bg-layer-1);border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsl-guide-entry-radius);cursor:pointer;align-items:center;gap:14px;padding:14px 20px;display:flex}.geFEbW_entry:hover{background:var(--dsw-alias-interactive-bg-hover)}.geFEbW_entryIcon{width:26px;height:26px;color:var(--dsw-alias-label-secondary);flex:none;justify-content:center;align-items:center;display:flex}.geFEbW_placeholderInk{color:var(--dsw-alias-label-tertiary)}.geFEbW_entryText{flex-direction:column;flex:1;gap:3px;min-width:0;display:flex}.geFEbW_entryTitle{white-space:nowrap;text-overflow:ellipsis;font-size:14px;line-height:1.4;overflow:hidden}.geFEbW_entryDescription{color:var(--dsw-alias-label-tertiary);white-space:nowrap;text-overflow:ellipsis;font-size:11px;line-height:1.4;overflow:hidden}.geFEbW_titleIcon{color:var(--dsw-alias-label-tertiary);flex:none}.geFEbW_entryCell{width:380px;max-width:100%}";

/** Bang ten lop hash cua GuideBody.module.css — nguyen van tu bundle goc. */
export const GUIDE_BODY_CLASS = {
"entry": "geFEbW_entry",
"entryCell": "geFEbW_entryCell",
"entryDescription": "geFEbW_entryDescription",
"entryIcon": "geFEbW_entryIcon",
"entryText": "geFEbW_entryText",
"entryTitle": "geFEbW_entryTitle",
"guide": "geFEbW_guide",
"hero": "geFEbW_hero",
"placeholderInk": "geFEbW_placeholderInk",
"titleIcon": "geFEbW_titleIcon"
}

/** CSS cua ExpandButton.module.css — nguyen van tung byte tu bundle goc. */
export const EXPAND_BUTTON_CSS = "._1kL45W_button{width:28px;color:var(--dsw-alias-label-secondary);flex:none;padding:0}._1kL45W_button svg{width:15px;height:15px}._1kL45W_icon{transform:scaleX(-1)}";

/** Bang ten lop hash cua ExpandButton.module.css — nguyen van tu bundle goc. */
export const EXPAND_BUTTON_CLASS = {
"button": "_1kL45W_button",
"icon": "_1kL45W_icon"
}

/** CSS cua SidebarRight.module.css — nguyen van tung byte tu bundle goc. */
export const SIDEBAR_RIGHT_CSS = ".P3OORG_session{display:contents}.P3OORG_session[hidden]{display:none}.P3OORG_panel{--dsh-dockkit-dock-layer:10;--dsh-dockkit-float-layer:60;pointer-events:none;flex-direction:column;min-width:0;display:flex;position:absolute;top:0;bottom:0;right:0}.P3OORG_panel [data-dockkit-host=dock],.P3OORG_panel [data-dockkit-empty],.P3OORG_panel [data-dockkit-divider]{transform:translateX(var(--dsh-sidebar-width));visibility:hidden;transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out), visibility 0s linear var(--ds-transition-duration-slow)}.P3OORG_panel[data-sidebar-right-open] [data-dockkit-host=dock],.P3OORG_panel[data-sidebar-right-open] [data-dockkit-empty],.P3OORG_panel[data-sidebar-right-open] [data-dockkit-divider]{visibility:visible;transition:transform var(--ds-transition-duration-slow) var(--ds-ease-in-out);transform:none}.P3OORG_panel[data-sidebar-right-panel=fullscreen]{--dsh-dockkit-dock-layer:40}[data-windows-titlebar] .P3OORG_panel[data-sidebar-right-panel=fullscreen]{max-width:calc(100vw - var(--dsh-windows-sidebar-width))}[data-windows-titlebar] .P3OORG_panel[data-sidebar-right-panel=fullscreen] [data-dockkit-column=\"0\"][data-dockkit-pane]{border-radius:var(--dsh-windows-content-radius) 0 0 0;corner-shape:round}[data-platform=darwin] .P3OORG_panel[data-sidebar-right-panel=fullscreen] [data-dockkit-host=dock][data-dockkit-column=\"0\"]{--dsh-dockkit-strip-inline-start:88px}[data-platform=darwin] .P3OORG_panel[data-sidebar-right-panel=fullscreen] [data-dockkit-host=dock][data-dockkit-column=\"1\"]{--dsh-dockkit-strip-inline-start:10px}[data-platform=darwin][data-fullscreen] .P3OORG_panel[data-sidebar-right-panel=fullscreen] [data-dockkit-host=dock][data-dockkit-column=\"0\"]{--dsh-dockkit-strip-inline-start:10px}@media (prefers-reduced-motion:reduce){.P3OORG_panel [data-dockkit-host=dock],.P3OORG_panel [data-dockkit-empty],.P3OORG_panel [data-dockkit-divider]{transition:none}}.P3OORG_iconButton{width:28px;height:28px;color:var(--dsw-alias-label-secondary);border-radius:var(--dsw-radius-sm);cursor:pointer;background:0 0;border:none;flex:none;justify-content:center;align-items:center;padding:6px;line-height:1;display:inline-flex}.P3OORG_iconButton svg{width:15px;height:15px}.P3OORG_iconButton:hover{background:var(--dsw-alias-interactive-bg-hover)}.P3OORG_collapseGlyph{transform:scaleX(-1)}.P3OORG_panelBody{flex:auto;min-height:0;display:flex}.P3OORG_unavailable{color:var(--dsw-alias-label-tertiary);font-size:var(--dsh-content-font-size-secondary,13px);margin:0;padding:12px}.P3OORG_tabTitle{display:contents}.P3OORG_tabBody{flex-direction:column;min-width:0;height:100%;min-height:0;display:flex;overflow:hidden}";

/** Bang ten lop hash cua SidebarRight.module.css — nguyen van tu bundle goc. */
export const SIDEBAR_RIGHT_CLASS = {
"collapseGlyph": "P3OORG_collapseGlyph",
"iconButton": "P3OORG_iconButton",
"panel": "P3OORG_panel",
"panelBody": "P3OORG_panelBody",
"session": "P3OORG_session",
"tabBody": "P3OORG_tabBody",
"tabTitle": "P3OORG_tabTitle",
"unavailable": "P3OORG_unavailable"
}
