/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 17/10/2026
 * desc CSS của tab kiểm kê plugin (giữ nguyên khai báo như bản gốc, đổi tiền tố lớp) + bảng tên lớp
 */

/** CSS của tab kiểm kê plugin; container query + token --dsw-* như bản gốc. */
export const INVENTORY_TAB_CSS = ".gbhInv_section{width:100%;max-width:760px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:14px;display:flex;container:gbhInv_plugin-inventory/inline-size}.gbhInv_status,.gbhInv_failure p{margin:0}.gbhInv_status,.gbhInv_failure{color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:20px}.gbhInv_failure{color:var(--dsw-alias-state-error-primary);align-items:center;gap:10px;display:flex}.gbhInv_statusWithDot{align-items:center;gap:6px;display:inline-flex}.gbhInv_failure button{border:.5px solid var(--dsw-alias-border-l3);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;padding:4px 10px}.gbhInv_catalog{flex-direction:column;gap:12px;display:flex}.gbhInv_search{width:100%;color:var(--dsw-alias-label-tertiary);align-items:center;display:flex;position:relative}.gbhInv_search>svg{pointer-events:none;position:absolute;left:12px}.gbhInv_search input{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-layer-1);width:100%;height:36px;color:var(--dsw-alias-label-primary);font:inherit;outline:none;padding:0 34px 0 36px;font-size:13px}.gbhInv_search input::placeholder{color:var(--dsw-alias-label-tertiary)}.gbhInv_search input:focus-visible{border-color:var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary)) 18%, transparent)}.gbhInv_cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none;display:grid}.gbhInv_card{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill);flex-direction:column;min-width:0;display:flex;overflow:hidden}.gbhInv_card[data-open=true]{border-color:var(--dsw-alias-border-l3)}.gbhInv_card:nth-child(odd)[data-open=true]+.gbhInv_card,.gbhInv_card:nth-child(odd):has(+.gbhInv_card[data-open=true]){align-self:start}.gbhInv_cardContent{box-sizing:border-box;width:100%;min-height:52px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;flex-direction:column;flex:auto;align-items:stretch;gap:2px;padding:12px 14px;display:flex}.gbhInv_cardContent:hover,.gbhInv_card[data-open=true]>.gbhInv_cardContent{background:var(--dsw-alias-interactive-bg-hover)}.gbhInv_cardContent:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:-2px}.gbhInv_cardMainRow{justify-content:space-between;align-items:center;gap:12px;min-width:0;display:flex}.gbhInv_cardTitle,.gbhInv_cardIdentity{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.gbhInv_cardTitle{flex:1;min-width:0;font-size:14px;font-weight:500;line-height:20px}.gbhInv_cardDescription{color:var(--dsw-alias-label-tertiary);text-wrap:pretty;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:12px;line-height:18px;display:-webkit-box;overflow:hidden}.gbhInv_card[data-open=true] .gbhInv_cardDescription{display:block}.gbhInv_cardMeta{margin-top:auto;padding-top:6px;display:flex}.gbhInv_cardIdentity,.gbhInv_entryValue{font-family:var(--ds-font-family-code);font-size:12px;line-height:18px}.gbhInv_cardIdentity{box-sizing:border-box;border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-module-platform);max-width:100%;color:var(--dsw-alias-label-secondary);padding:1px 6px;display:block}.gbhInv_cardTrailing{color:var(--dsw-alias-label-tertiary);flex:none;align-items:center;gap:8px;display:inline-flex}.gbhInv_phaseDot{flex:none;display:inline-flex}.gbhInv_group{flex-direction:column;gap:10px;display:flex}.gbhInv_groupTitleRow{align-items:center;gap:8px;min-height:36px;display:flex}.gbhInv_group+.gbhInv_group{border-top:.5px solid var(--dsw-alias-border-l2);padding-top:14px}.gbhInv_headerEnd{margin-left:auto}.gbhInv_groupToggle{color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:0;flex:none;align-items:center;gap:8px;padding:0;display:flex}.gbhInv_groupToggle:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.gbhInv_groupToggle>.gbhInv_chevron{transform:rotate(-90deg)}.gbhInv_groupToggle[aria-expanded=true]>.gbhInv_chevron{transform:none}.gbhInv_groupTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:400;line-height:22px}.gbhInv_groupSub{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;flex-wrap:wrap;row-gap:4px;margin:-6px 0 0 20px;font-size:12px;line-height:18px;display:flex}.gbhInv_switcher{white-space:nowrap;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);height:36px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border:none;flex:none;align-items:center;gap:12px;padding:0 14px;font-size:14px;line-height:22px;display:inline-flex}.gbhInv_switcher:hover{background:var(--dsw-alias-interactive-bg-hover)}.gbhInv_switcher:focus-visible{outline:var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}.gbhInv_switcher>.gbhInv_chevron{flex:none}.gbhInv_switcherLabel{text-overflow:ellipsis;max-width:240px;overflow:hidden}.gbhInv_groupBody{flex-direction:column;gap:10px;display:flex}.gbhInv_brokenNote{border-radius:var(--dsw-radius-lg);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere;white-space:pre-line;margin:0;padding:8px 10px;font-size:12px;line-height:18px}.gbhInv_hint{color:var(--dsw-alias-label-tertiary);flex-wrap:wrap;align-items:baseline;gap:4px 8px;margin:0;font-size:12px;line-height:18px;display:flex}.gbhInv_jumpLink{color:var(--dsw-alias-state-business-primary);font:inherit;cursor:pointer;background:0 0;border:0;padding:0;font-size:12px}.gbhInv_skeletonCard{border:.5px solid var(--dsw-alias-settings-card-stroke);border-radius:var(--dsw-radius-xl);background:var(--dsw-alias-settings-card-fill);flex-direction:column;gap:8px;padding:15px 14px;display:flex}.gbhInv_skeletonBar{border-radius:var(--dsw-radius-xs);background:var(--dsw-alias-bg-skeleton);width:40%;height:14px}.gbhInv_skeletonBar+.gbhInv_skeletonBar{width:80%;height:12px}.gbhInv_card[data-failed=true]{border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary) 45%, transparent)}.gbhInv_chevron{color:var(--dsw-alias-label-tertiary);flex:none}.gbhInv_card[data-open=true] .gbhInv_chevron{transform:rotate(180deg)}.gbhInv_cardDetails{border-top:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-module-platform);padding:10px 14px 12px}.gbhInv_entryValue{overflow-wrap:anywhere;color:var(--dsw-alias-label-primary);display:block}.gbhInv_details{grid-template-columns:76px minmax(0,1fr);gap:6px 10px;margin:8px 0 0;display:grid}.gbhInv_details div{display:contents}.gbhInv_details dt{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:17px}.gbhInv_details dd{overflow-wrap:anywhere;min-width:0;color:var(--dsw-alias-label-secondary);margin:0;font-size:12px;line-height:17px}.gbhInv_visuallyHidden{clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;width:1px;height:1px;position:absolute;overflow:hidden}@media (prefers-reduced-motion:no-preference){.gbhInv_chevron{transition:transform .14s var(--ds-ease-in-out)}.gbhInv_skeletonBar{animation:2s cubic-bezier(.36,0,.64,1) infinite gbhInv_plugin-inventory-skeleton}}@keyframes gbhInv_plugin-inventory-skeleton{0%{opacity:1}40%{opacity:.6}80%,to{opacity:1}}@container gbhInv_plugin-inventory (width<=520px){.gbhInv_cards{grid-template-columns:minmax(0,1fr)}}";

/** Tên lớp sau khi đổi tiền tố. */
export const CSS = Object.freeze({
  "brokenNote": "gbhInv_brokenNote",
  "card": "gbhInv_card",
  "cardContent": "gbhInv_cardContent",
  "cardDescription": "gbhInv_cardDescription",
  "cardDetails": "gbhInv_cardDetails",
  "cardIdentity": "gbhInv_cardIdentity",
  "cardMainRow": "gbhInv_cardMainRow",
  "cardMeta": "gbhInv_cardMeta",
  "cardTitle": "gbhInv_cardTitle",
  "cardTrailing": "gbhInv_cardTrailing",
  "cards": "gbhInv_cards",
  "catalog": "gbhInv_catalog",
  "chevron": "gbhInv_chevron",
  "details": "gbhInv_details",
  "entryValue": "gbhInv_entryValue",
  "failure": "gbhInv_failure",
  "group": "gbhInv_group",
  "groupBody": "gbhInv_groupBody",
  "groupSub": "gbhInv_groupSub",
  "groupTitle": "gbhInv_groupTitle",
  "groupTitleRow": "gbhInv_groupTitleRow",
  "groupToggle": "gbhInv_groupToggle",
  "headerEnd": "gbhInv_headerEnd",
  "hint": "gbhInv_hint",
  "jumpLink": "gbhInv_jumpLink",
  "phaseDot": "gbhInv_phaseDot",
  "search": "gbhInv_search",
  "section": "gbhInv_section",
  "skeletonBar": "gbhInv_skeletonBar",
  "skeletonCard": "gbhInv_skeletonCard",
  "status": "gbhInv_status",
  "statusWithDot": "gbhInv_statusWithDot",
  "switcher": "gbhInv_switcher",
  "switcherLabel": "gbhInv_switcherLabel",
  "visuallyHidden": "gbhInv_visuallyHidden",
});
