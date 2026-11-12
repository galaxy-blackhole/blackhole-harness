/**
 * author Bùi Trọng Hiếu
 * email kevinbui210191@gmail.com
 * create date 15/10/2026
 * modify date 19/10/2026
 * desc CSS của thẻ cordis_run — chuỗi CSS và bảng tên lớp CHÉP NGUYÊN VĂN từ lib/client.js của gói gốc (hash cvtE3a_* giữ nguyên nên bề mặt DOM không lệch)
 */

/** CSS của thẻ cordis_run (nguồn: vùng #region CordisRunRow.module.css của bản gốc). */
export const CSS = ".cvtE3a_card{flex-direction:column;gap:8px;display:flex}.cvtE3a_row{align-items:center;min-height:32px;display:flex}.cvtE3a_icon{color:var(--dsw-alias-state-business-primary);flex:none;margin-right:8px;display:inline-flex}.cvtE3a_title{color:var(--dsw-alias-state-business-primary);flex:none;font-size:14px;font-weight:500;line-height:24px}.cvtE3a_separator{corner-shape:round;background:var(--dsw-alias-state-business-primary);border-radius:50%;flex:none;width:2px;height:2px;margin:0 8px}.cvtE3a_summary,.cvtE3a_error{min-width:0;color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;flex:1;font-size:13px;line-height:24px;overflow:hidden}.cvtE3a_error{color:var(--dsw-alias-state-error-primary)}.cvtE3a_status{color:var(--dsw-alias-label-caption);flex:none;margin-left:8px;font-size:12px;line-height:24px}.cvtE3a_card[data-cordis-status=awaiting-approval] .cvtE3a_status,.cvtE3a_card[data-cordis-status=client-pending] .cvtE3a_status{color:var(--dsw-alias-state-warn-label)}.cvtE3a_card[data-cordis-status=running] .cvtE3a_status{color:var(--dsw-alias-state-success-primary)}.cvtE3a_card[data-cordis-status=failed] .cvtE3a_status{color:var(--dsw-alias-state-error-primary)}.cvtE3a_inspect{corner-shape:round;width:24px;height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;opacity:0;background:0 0;border:none;border-radius:999px;justify-content:center;align-items:center;margin-left:4px;padding:0;display:inline-flex}.cvtE3a_card:hover .cvtE3a_inspect,.cvtE3a_inspect:focus-visible{opacity:1}.cvtE3a_inspect:hover{background:var(--dsw-alias-interactive-bg-hover)}.cvtE3a_message{background:var(--dsw-alias-button-ghost-active-fill);color:var(--dsw-alias-label-tertiary);border-radius:8px;padding:8px 12px;font-size:12px;line-height:18px}.cvtE3a_business{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-bg-base);border-radius:12px;min-width:0;overflow:hidden}.cvtE3a_output{border:.5px solid var(--dsw-alias-border-l4);background:var(--dsw-alias-markdown-code-block);color:var(--dsw-alias-label-secondary);font:var(--dsw-font-markdown-code-block-small);white-space:pre-wrap;overflow-wrap:anywhere;border-radius:8px;margin:0;padding:10px 12px;overflow:auto}.cvtE3a_business .cvtE3a_output{border:none;border-radius:0}";

/** Id gắn vào data-plugin-css của thẻ style — id CỦA TA (LUẬT MỘT-ID: không giữ id gói gốc). */
export const TAG_ID = "@galaxy-blackhole/gbh-client-ui-cordis/CordisRunRow.module.css";

/** Bảng tên lớp của CSS module — GIỮ NGUYÊN từng chuỗi của bản gốc. */
export const CLASSES = {
			"business": "cvtE3a_business",
			"card": "cvtE3a_card",
			"error": "cvtE3a_error",
			"icon": "cvtE3a_icon",
			"inspect": "cvtE3a_inspect",
			"message": "cvtE3a_message",
			"output": "cvtE3a_output",
			"row": "cvtE3a_row",
			"separator": "cvtE3a_separator",
			"status": "cvtE3a_status",
			"summary": "cvtE3a_summary",
			"title": "cvtE3a_title"
} as const;
